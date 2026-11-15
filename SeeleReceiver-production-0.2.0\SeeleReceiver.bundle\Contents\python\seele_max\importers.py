from __future__ import annotations

from concurrent.futures import Future
from dataclasses import dataclass
from pathlib import Path
import queue
from typing import Callable, Protocol

from .errors import SeeleError
from .protocol import Manifest


class Dispatcher(Protocol):
    def enqueue(self, job: Callable[[], dict]) -> Future: ...


class ImmediateDispatcher:
    def enqueue(self, job: Callable[[], dict]) -> Future:
        future: Future = Future()
        try:
            future.set_result(job())
        except BaseException as exc:
            future.set_exception(exc)
        return future


class QueueDispatcher:
    """Thread-safe queue; call drain() from the DCC main thread."""

    def __init__(self) -> None:
        self._jobs: queue.Queue[tuple[Callable[[], dict], Future]] = queue.Queue()

    def enqueue(self, job: Callable[[], dict]) -> Future:
        future: Future = Future()
        self._jobs.put((job, future))
        return future

    def drain(self, limit: int = 1) -> int:
        processed = 0
        while processed < limit:
            try:
                job, future = self._jobs.get_nowait()
            except queue.Empty:
                break
            if not future.set_running_or_notify_cancel():
                continue
            try:
                future.set_result(job())
            except BaseException as exc:
                future.set_exception(exc)
            processed += 1
        return processed


@dataclass
class ImporterRegistry:
    handlers: dict[str, Callable[[Path, Manifest], dict]]

    def import_asset(self, path: Path, manifest: Manifest) -> dict:
        fmt = (manifest.asset.format or path.suffix.lstrip(".")).lower()
        handler = self.handlers.get(fmt)
        if handler is None:
            raise SeeleError("FORMAT_UNSUPPORTED", "No importer is available for this asset format", False, "importing")
        try:
            return handler(path, manifest)
        except SeeleError:
            raise
        except Exception as exc:
            raise SeeleError("IMPORT_FAILED", "The 3ds Max importer failed", False, "importing") from exc


def max_registry() -> ImporterRegistry:
    from pymxs import runtime as rt  # type: ignore[import-not-found]

    def import_file(path: Path, manifest: Manifest) -> dict:
        before = int(rt.objects.count)
        ok = rt.importFile(str(path), rt.name("noPrompt"))
        after = int(rt.objects.count)
        if ok is False:
            raise SeeleError("IMPORT_FAILED", "The 3ds Max importer rejected the asset", False, "importing")
        return {"format": manifest.asset.format or path.suffix.lstrip("."), "objectsCreated": max(0, after - before), "warnings": []}

    return ImporterRegistry({"obj": import_file, "fbx": import_file, "glb": import_file, "gltf": import_file})

