from __future__ import annotations

from pathlib import Path
import hashlib
import re
import shutil
import time

from .errors import SeeleError


SAFE_SUFFIX = re.compile(r"^\.[A-Za-z0-9]{1,12}$")


class AssetCache:
    def __init__(self, root: Path, ttl_seconds: int, quota_bytes: int) -> None:
        self.root = root.resolve()
        self.ttl_seconds = ttl_seconds
        self.quota_bytes = quota_bytes
        self.root.mkdir(parents=True, exist_ok=True)

    def paths(self, transfer_id: str, file_name: str | None, fmt: str | None) -> tuple[Path, Path]:
        # transfer IDs are protocol identifiers, not filesystem names. Hashing also
        # avoids Windows reserved characters and keeps every path beneath root.
        folder = self.root / hashlib.sha256(transfer_id.encode("utf-8")).hexdigest()
        folder.mkdir(parents=True, exist_ok=True)
        suffix = Path(file_name or "").suffix.lower()
        if not SAFE_SUFFIX.fullmatch(suffix):
            suffix = f".{fmt.lower()}" if fmt and fmt.isalnum() else ".asset"
        final = folder / f"asset{suffix}"
        return final.with_suffix(final.suffix + ".part"), final

    def cleanup(self) -> int:
        cutoff = time.time() - self.ttl_seconds
        removed = 0
        for folder in self.root.iterdir():
            try:
                if folder.is_dir() and folder.stat().st_mtime < cutoff:
                    for item in folder.iterdir():
                        if item.is_file():
                            item.unlink()
                    folder.rmdir()
                    removed += 1
                elif folder.is_dir():
                    for item in folder.glob("*.part"):
                        if item.stat().st_mtime < cutoff:
                            item.unlink()
            except OSError:
                continue
        return removed

    def size_bytes(self) -> int:
        total = 0
        for item in self.root.rglob("*"):
            try:
                if item.is_file():
                    total += item.stat().st_size
            except OSError:
                continue
        return total

    def ensure_capacity(self, incoming_bytes: int) -> None:
        self.cleanup()
        try:
            free = shutil.disk_usage(self.root).free
        except OSError as exc:
            raise SeeleError("CACHE_NO_SPACE", "Cache capacity could not be determined", True, "queued") from exc
        # Some Windows sandbox/container providers report a zero free-space
        # value even though the path is writable. Treat zero as unknown and
        # keep the explicit cache-quota guard; real write failures are handled
        # by the downloader.
        if (free > 0 and incoming_bytes > free) or self.size_bytes() + incoming_bytes > self.quota_bytes:
            raise SeeleError("CACHE_NO_SPACE", "Cache does not have enough capacity", True, "queued")
