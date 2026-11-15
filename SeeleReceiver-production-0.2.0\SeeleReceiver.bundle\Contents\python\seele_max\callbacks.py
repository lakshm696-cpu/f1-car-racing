from __future__ import annotations

import json
import time
import urllib.error
import urllib.request


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):  # type: ignore[no-untyped-def]
        return None


class StatusReporter:
    """Best-effort callback delivery; failures never alter the transfer result."""

    def __init__(self, timeout: float = 10.0, attempts: int = 3) -> None:
        self.timeout = timeout
        self.attempts = attempts

    def report(self, url: str | None, event: dict) -> bool:
        if not url:
            return True
        request = urllib.request.Request(
            url,
            data=json.dumps(event, separators=(",", ":")).encode("utf-8"),
            headers={"Content-Type": "application/json", "User-Agent": "Seele3dsMaxReceiver/0.1"},
            method="POST",
        )
        opener = urllib.request.build_opener(_NoRedirect())
        for attempt in range(self.attempts):
            try:
                with opener.open(request, timeout=self.timeout) as response:
                    return 200 <= response.status < 300
            except urllib.error.HTTPError as exc:
                if exc.code != 429 and exc.code < 500:
                    return False
            except (urllib.error.URLError, OSError):
                pass
            if attempt + 1 < self.attempts:
                time.sleep(0.25 * (2 ** attempt))
        return False
