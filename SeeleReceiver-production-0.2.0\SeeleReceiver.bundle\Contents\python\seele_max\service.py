from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
import logging
from pathlib import Path
import threading

from .cache import AssetCache
from .callbacks import StatusReporter
from .config import ReceiverConfig
from .downloader import Downloader
from .errors import SeeleError, internal_error
from .importers import Dispatcher, ImporterRegistry
from .protocol import Manifest, parse_manifest
from .state import TERMINAL, TransferStore

LOG = logging.getLogger("seele_max")


class TransferService:
    def __init__(self, config: ReceiverConfig, dispatcher: Dispatcher, importers: ImporterRegistry) -> None:
        self.config = config
        self.dispatcher = dispatcher
        self.importers = importers
        self.store = TransferStore()
        self.cache = AssetCache(config.cache_dir, config.cache_ttl_seconds, config.cache_quota_bytes)
        self.downloader = Downloader(config)
        self.reporter = StatusReporter(config.connect_timeout)
        self._executor = ThreadPoolExecutor(max_workers=config.max_workers, thread_name_prefix="seele-transfer")
        self._slots = threading.BoundedSemaphore(config.queue_capacity)
        self.cache.cleanup()

    def submit(self, raw: bytes | str | dict) -> tuple[dict, bool]:
        manifest = parse_manifest(raw, self.config)
        record, created = self.store.create(manifest)
        if not created:
            return record.snapshot(), False
        try:
            self.cache.ensure_capacity(manifest.asset.size)
        except SeeleError as exc:
            self.store.transition(manifest.transfer_id, "failed", error=exc.as_dict())
            raise
        if not self._slots.acquire(blocking=False):
            self.store.transition(manifest.transfer_id, "failed", error=SeeleError("QUEUE_FULL", "Transfer queue is full", True, "queued").as_dict())
            raise SeeleError("QUEUE_FULL", "Transfer queue is full", True, "queued")
        self._executor.submit(self._run, manifest)
        return record.snapshot(), True

    def get(self, transfer_id: str) -> dict | None:
        record = self.store.get(transfer_id)
        return record.snapshot() if record else None

    def cancel(self, transfer_id: str) -> dict | None:
        record = self.store.get(transfer_id)
        if not record:
            return None
        return self.store.request_cancel(transfer_id)

    def _transition(self, manifest: Manifest, status: str, **kwargs) -> dict:
        event = self.store.transition(manifest.transfer_id, status, **kwargs)
        self._executor.submit(self.reporter.report, manifest.status_callback_url, event)
        return event

    def _run(self, manifest: Manifest) -> None:
        record = self.store.get(manifest.transfer_id)
        assert record is not None
        temp, final = self.cache.paths(manifest.transfer_id, manifest.asset.file_name, manifest.asset.format)
        try:
            if record.cancel_event.is_set():
                return
            self._transition(manifest, "downloading", progress={"phase": "downloading", "bytesTotal": manifest.asset.size})
            received = self.downloader.download(
                manifest.asset,
                temp,
                final,
                record.cancel_event,
                lambda count: self._transition(
                    manifest,
                    "verifying",
                    progress={"phase": "verifying", "bytesDownloaded": count, "bytesTotal": manifest.asset.size},
                ),
            )
            if record.cancel_event.is_set():
                self._cancel_if_needed(manifest)
                return
            self._transition(manifest, "importing", progress={"phase": "max-main-thread", "bytesDownloaded": received, "bytesTotal": received})
            future = self.dispatcher.enqueue(lambda: self.importers.import_asset(final, manifest))
            result = future.result()
            self._transition(manifest, "succeeded", result=result)
        except SeeleError as exc:
            current = self.store.get(manifest.transfer_id)
            if current and current.status not in TERMINAL:
                target = "cancelled" if exc.code == "CANCELLED" else "failed"
                self._transition(manifest, target, error=exc.as_dict())
            LOG.warning("transfer failed id=%s code=%s phase=%s", manifest.transfer_id, exc.code, exc.phase)
        except Exception:
            current = self.store.get(manifest.transfer_id)
            if current and current.status not in TERMINAL:
                self._transition(manifest, "failed", error=internal_error().as_dict())
            LOG.exception("unexpected transfer failure id=%s", manifest.transfer_id)
        finally:
            self._slots.release()

    def _cancel_if_needed(self, manifest: Manifest) -> None:
        record = self.store.get(manifest.transfer_id)
        if record and record.status not in TERMINAL:
            self._transition(manifest, "cancelled")

    def close(self) -> None:
        self._executor.shutdown(wait=False, cancel_futures=True)
