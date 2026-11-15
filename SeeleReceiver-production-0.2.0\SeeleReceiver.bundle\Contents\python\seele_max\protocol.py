from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
import hashlib
import json
import re
from typing import Any
from urllib.parse import urlsplit

from .config import ReceiverConfig
from .errors import SeeleError

PROTOCOL = "dcc-transfer.v1"
TRANSFER_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$")
SHA256_RE = re.compile(r"^[0-9a-fA-F]{64}$")


@dataclass(frozen=True)
class AssetManifest:
    url: str
    size: int
    sha256: str
    format: str | None = None
    file_name: str | None = None


@dataclass(frozen=True)
class Manifest:
    protocol: str
    transfer_id: str
    asset: AssetManifest
    status_callback_url: str | None = None
    expires_at: datetime | None = None
    metadata: dict[str, Any] | None = None

    def fingerprint(self) -> str:
        canonical = {
            "protocol": self.protocol,
            "transferId": self.transfer_id,
            "asset": {
                "url": self.asset.url,
                "size": self.asset.size,
                "sha256": self.asset.sha256,
                "format": self.asset.format,
                "fileName": self.asset.file_name,
            },
            "statusCallbackUrl": self.status_callback_url,
            "expiresAt": self.expires_at.isoformat() if self.expires_at else None,
            "metadata": self.metadata,
        }
        data = json.dumps(canonical, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
        return hashlib.sha256(data.encode("utf-8")).hexdigest()


def parse_manifest(raw: bytes | str | dict[str, Any], config: ReceiverConfig, now: datetime | None = None) -> Manifest:
    if isinstance(raw, bytes):
        try:
            raw = raw.decode("utf-8")
        except UnicodeDecodeError as exc:
            raise SeeleError("MANIFEST_INVALID", "Request body must be UTF-8 JSON") from exc
    if isinstance(raw, str):
        try:
            data = json.loads(raw)
        except (json.JSONDecodeError, RecursionError) as exc:
            raise SeeleError("MANIFEST_INVALID", "Request body is not valid JSON") from exc
    else:
        data = raw
    if not isinstance(data, dict):
        raise SeeleError("MANIFEST_INVALID", "Manifest root must be an object")

    protocol = data.get("protocol")
    if protocol != PROTOCOL:
        raise SeeleError("PROTOCOL_UNSUPPORTED", "Unsupported protocol version")
    transfer_id = data.get("transferId")
    if not isinstance(transfer_id, str) or not TRANSFER_ID_RE.fullmatch(transfer_id):
        raise SeeleError("MANIFEST_INVALID", "transferId has an invalid format")
    asset = data.get("asset")
    if not isinstance(asset, dict):
        raise SeeleError("MANIFEST_INVALID", "asset must be an object")
    url = asset.get("url")
    size = asset.get("size")
    digest = asset.get("sha256")
    if not isinstance(url, str) or len(url) > 4096:
        raise SeeleError("MANIFEST_INVALID", "asset.url must be a URL string")
    _validate_url(url, config.allowed_cdn_hosts, config.allow_http, "ASSET_URL_REJECTED")
    if isinstance(size, bool) or not isinstance(size, int) or size < 0:
        raise SeeleError("MANIFEST_INVALID", "asset.size must be a non-negative integer")
    if size > config.max_asset_bytes:
        raise SeeleError("MANIFEST_INVALID", "asset.size exceeds the configured limit")
    if not isinstance(digest, str) or not SHA256_RE.fullmatch(digest):
        raise SeeleError("MANIFEST_INVALID", "asset.sha256 must be 64 hexadecimal characters")
    fmt = asset.get("format")
    if fmt is not None and (not isinstance(fmt, str) or not 1 <= len(fmt) <= 32):
        raise SeeleError("MANIFEST_INVALID", "asset.format must be a short string")
    file_name = asset.get("fileName")
    if file_name is not None and (not isinstance(file_name, str) or not 1 <= len(file_name) <= 255):
        raise SeeleError("MANIFEST_INVALID", "asset.fileName must be a short string")

    callback = data.get("statusCallbackUrl")
    if callback is not None:
        if not isinstance(callback, str):
            raise SeeleError("MANIFEST_INVALID", "statusCallbackUrl must be a URL string")
        _validate_url(callback, config.allowed_callback_hosts, config.allow_http, "ASSET_URL_REJECTED")
    expires = _parse_expiry(data.get("expiresAt"))
    current = now or datetime.now(timezone.utc)
    if expires is not None and expires <= current:
        raise SeeleError("MANIFEST_EXPIRED", "Manifest has expired")
    metadata = data.get("metadata")
    if metadata is not None and not isinstance(metadata, dict):
        raise SeeleError("MANIFEST_INVALID", "metadata must be an object")
    return Manifest(
        protocol=protocol,
        transfer_id=transfer_id,
        asset=AssetManifest(url, size, digest.lower(), fmt.lower() if fmt else None, file_name),
        status_callback_url=callback,
        expires_at=expires,
        metadata=metadata,
    )


def _parse_expiry(value: Any) -> datetime | None:
    if value is None:
        return None
    if not isinstance(value, str):
        raise SeeleError("MANIFEST_INVALID", "expiresAt must be an ISO-8601 timestamp")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise SeeleError("MANIFEST_INVALID", "expiresAt must be an ISO-8601 timestamp") from exc
    if parsed.tzinfo is None:
        raise SeeleError("MANIFEST_INVALID", "expiresAt must include a timezone")
    return parsed.astimezone(timezone.utc)


def _validate_url(url: str, hosts: frozenset[str], allow_http: bool, code: str) -> None:
    parsed = urlsplit(url)
    scheme_allowed = parsed.scheme == "https" or (allow_http and parsed.scheme == "http")
    if not scheme_allowed or not parsed.hostname or parsed.username or parsed.password:
        raise SeeleError(code, "URL scheme or authority is not allowed")
    host = parsed.hostname.lower().rstrip(".")
    if not hosts or host not in {item.lower().rstrip(".") for item in hosts}:
        raise SeeleError(code, "URL host is not in the configured allowlist")


def redacted_url(url: str) -> str:
    parsed = urlsplit(url)
    return f"{parsed.scheme}://{parsed.hostname or '<invalid>'}{parsed.path}"
