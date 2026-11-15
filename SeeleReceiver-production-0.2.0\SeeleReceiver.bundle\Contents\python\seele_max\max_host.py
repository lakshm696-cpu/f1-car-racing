from __future__ import annotations

import json
import logging
import os
from pathlib import Path
import threading
from typing import Any

from .config import ReceiverConfig
from .importers import QueueDispatcher, max_registry
from .receiver import ReceiverServer
from .service import TransferService

LOG = logging.getLogger("seele_max.max")
_HOST: "MaxReceiverHost | None" = None


def _config_path() -> Path:
    root = Path(os.environ.get("LOCALAPPDATA") or str(Path.home()))
    return root / "Seele" / "3dsMaxReceiver" / "config.json"


def load_config(path: Path | None = None) -> ReceiverConfig:
    config_path = path or _config_path()
    data: dict[str, Any] = {}
    if config_path.exists():
        try:
            loaded = json.loads(config_path.read_text(encoding="utf-8"))
            if isinstance(loaded, dict):
                data = loaded
        except (OSError, json.JSONDecodeError):
            LOG.exception("Cannot load Seele receiver configuration")
    defaults = ReceiverConfig()
    return ReceiverConfig(
        host=data.get("host", defaults.host),
        port=int(data.get("port", defaults.port)),
        cache_dir=Path(data.get("cacheDir", defaults.cache_dir)),
        auth_token=data.get("authToken") or os.environ.get("SEELE_RECEIVER_TOKEN"),
        allowed_cdn_hosts=frozenset(data.get("allowedCdnHosts", [])),
        allowed_callback_hosts=frozenset(data.get("allowedCallbackHosts", [])),
        allow_http=bool(data.get("allowHttp", False)),
        max_request_bytes=int(data.get("maxRequestBytes", defaults.max_request_bytes)),
        max_asset_bytes=int(data.get("maxAssetBytes", defaults.max_asset_bytes)),
        cache_quota_bytes=int(data.get("cacheQuotaBytes", defaults.cache_quota_bytes)),
        max_workers=int(data.get("maxWorkers", defaults.max_workers)),
        queue_capacity=int(data.get("queueCapacity", defaults.queue_capacity)),
        connect_timeout=float(data.get("connectTimeout", defaults.connect_timeout)),
        read_timeout=float(data.get("readTimeout", defaults.read_timeout)),
        max_redirects=int(data.get("maxRedirects", defaults.max_redirects)),
        cache_ttl_seconds=int(data.get("cacheTtlSeconds", defaults.cache_ttl_seconds)),
    )


class MaxReceiverHost:
    def __init__(self, config: ReceiverConfig) -> None:
        self.config = config
        self.dispatcher = QueueDispatcher()
        self.service = TransferService(config, self.dispatcher, max_registry())
        self.server = ReceiverServer(self.service)
        self._thread = threading.Thread(target=self.server.serve_forever, name="seele-http", daemon=True)
        self._timer = self._make_timer()

    def _make_timer(self):
        try:
            from PySide6.QtCore import QTimer  # type: ignore[import-not-found]
        except ImportError:
            from PySide2.QtCore import QTimer  # type: ignore[import-not-found,no-redef]
        timer = QTimer()
        timer.setInterval(50)
        timer.timeout.connect(lambda: self.dispatcher.drain(1))
        return timer

    def start(self) -> None:
        self._thread.start()
        self._timer.start()
        LOG.info("Seele receiver listening on %s:%s", self.config.host, self.config.port)

    def stop(self) -> None:
        self._timer.stop()
        self.server.shutdown()
        self.server.server_close()
        self.service.close()


def start() -> MaxReceiverHost:
    global _HOST
    if _HOST is None:
        _HOST = MaxReceiverHost(load_config())
        _HOST.start()
    return _HOST


def stop() -> None:
    global _HOST
    if _HOST is not None:
        _HOST.stop()
        _HOST = None
