from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
import os


def _default_cache() -> Path:
    root = os.environ.get("LOCALAPPDATA") or str(Path.home())
    return Path(root) / "Seele" / "3dsMaxReceiver" / "cache"


@dataclass(frozen=True)
class ReceiverConfig:
    host: str = "127.0.0.1"
    port: int = 9880
    cache_dir: Path = field(default_factory=_default_cache)
    auth_token: str | None = None
    allowed_cdn_hosts: frozenset[str] = field(default_factory=frozenset)
    allowed_callback_hosts: frozenset[str] = field(default_factory=frozenset)
    allow_http: bool = False
    max_request_bytes: int = 256 * 1024
    max_asset_bytes: int = 2 * 1024 * 1024 * 1024
    cache_quota_bytes: int = 10 * 1024 * 1024 * 1024
    max_workers: int = 2
    queue_capacity: int = 32
    connect_timeout: float = 10.0
    read_timeout: float = 60.0
    max_redirects: int = 3
    cache_ttl_seconds: int = 7 * 24 * 60 * 60

    def __post_init__(self) -> None:
        if self.host not in {"127.0.0.1", "::1", "localhost"}:
            raise ValueError("Receiver must bind to a loopback address")
        if not 0 <= self.port <= 65535:
            raise ValueError("port must be between 0 and 65535")
        if self.max_request_bytes <= 0 or self.max_asset_bytes <= 0 or self.cache_quota_bytes <= 0:
            raise ValueError("size limits must be positive")
        if self.max_workers <= 0 or self.queue_capacity <= 0:
            raise ValueError("worker and queue limits must be positive")
