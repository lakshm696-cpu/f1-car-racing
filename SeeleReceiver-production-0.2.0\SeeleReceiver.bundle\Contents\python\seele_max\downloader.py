from __future__ import annotations

import hashlib
import hmac
from pathlib import Path
import ssl
import urllib.error
import urllib.request

from .config import ReceiverConfig
from .errors import SeeleError
from .protocol import AssetManifest, _validate_url


class _SafeRedirect(urllib.request.HTTPRedirectHandler):
    def __init__(self, config: ReceiverConfig) -> None:
        self.config = config
        self.count = 0

    def redirect_request(self, req, fp, code, msg, headers, newurl):  # type: ignore[no-untyped-def]
        self.count += 1
        if self.count > self.config.max_redirects:
            raise SeeleError("ASSET_URL_REJECTED", "Too many asset redirects")
        _validate_url(newurl, self.config.allowed_cdn_hosts, self.config.allow_http, "ASSET_URL_REJECTED")
        return super().redirect_request(req, fp, code, msg, headers, newurl)


class Downloader:
    def __init__(self, config: ReceiverConfig) -> None:
        self.config = config

    def download(self, asset: AssetManifest, temporary: Path, final: Path, cancel_event,
                 on_download_complete=None) -> int:
        temporary.parent.mkdir(parents=True, exist_ok=True)
        request = urllib.request.Request(asset.url, headers={"User-Agent": "Seele3dsMaxReceiver/0.1"})
        opener = urllib.request.build_opener(
            urllib.request.HTTPSHandler(context=ssl.create_default_context()),
            _SafeRedirect(self.config),
        )
        digest = hashlib.sha256()
        received = 0
        try:
            with opener.open(request, timeout=self.config.read_timeout) as response, temporary.open("wb") as output:
                length = response.headers.get("Content-Length")
                if length and int(length) > asset.size:
                    raise SeeleError("ASSET_SIZE_MISMATCH", "Asset response is larger than declared", False, "downloading")
                while True:
                    if cancel_event.is_set():
                        raise SeeleError("CANCELLED", "Transfer was cancelled", False, "downloading")
                    chunk = response.read(1024 * 1024)
                    if not chunk:
                        break
                    received += len(chunk)
                    if received > asset.size or received > self.config.max_asset_bytes:
                        raise SeeleError("ASSET_SIZE_MISMATCH", "Downloaded asset is larger than declared", False, "downloading")
                    digest.update(chunk)
                    output.write(chunk)
                output.flush()
            if on_download_complete is not None:
                on_download_complete(received)
            if received != asset.size:
                raise SeeleError("ASSET_SIZE_MISMATCH", "Downloaded asset size does not match manifest", False, "verifying")
            if not hmac.compare_digest(digest.hexdigest(), asset.sha256):
                raise SeeleError("ASSET_HASH_MISMATCH", "Downloaded asset failed integrity verification", False, "verifying")
            temporary.replace(final)
            return received
        except SeeleError:
            raise
        except TimeoutError as exc:
            raise SeeleError("ASSET_DOWNLOAD_TIMEOUT", "Asset download timed out", True, "downloading") from exc
        except (urllib.error.URLError, urllib.error.HTTPError, OSError, ValueError) as exc:
            raise SeeleError("ASSET_DOWNLOAD_FAILED", "Asset download failed", True, "downloading") from exc
        finally:
            try:
                temporary.unlink(missing_ok=True)
            except OSError:
                pass
