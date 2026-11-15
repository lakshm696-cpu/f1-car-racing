from __future__ import annotations

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import hmac
import json
import re
from typing import Any

from . import __version__
from .errors import SeeleError, internal_error
from .protocol import PROTOCOL
from .service import TransferService

TRANSFER_PATH = re.compile(r"^/v1/transfers/([A-Za-z0-9][A-Za-z0-9_.:-]{0,127})(/cancel)?$")
ALLOWED_WEB_ORIGINS = {
    "https://code4agent-feature-3dsmax-dcc-server.seele.chat",
    "https://www.seele.chat",
    "https://test.seeles.ai",
    "https://www.seeles.ai",
}


class ReceiverServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True

    def __init__(self, service: TransferService):
        self.service = service
        super().__init__((service.config.host, service.config.port), ReceiverHandler)


class ReceiverHandler(BaseHTTPRequestHandler):
    server: ReceiverServer

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self._cors_headers()
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self) -> None:
        if self.path == "/healthz":
            self._json(200, {"status": "ok", "version": __version__, "protocol": PROTOCOL,
                             "listen": f"{self.server.server_address[0]}:{self.server.server_address[1]}"})
            return
        match = TRANSFER_PATH.fullmatch(self.path)
        if match and not match.group(2):
            if not self._authorized():
                return
            value = self.server.service.get(match.group(1))
            self._json(200, value) if value else self._error(404, SeeleError("TRANSFER_NOT_FOUND", "Transfer was not found"))
            return
        self._error(404, SeeleError("NOT_FOUND", "Route was not found"))

    def do_POST(self) -> None:
        if not self._authorized():
            return
        if self.path == "/v1/transfers":
            if self.headers.get_content_type() != "application/json":
                self._error(415, SeeleError("MANIFEST_INVALID", "Content-Type must be application/json"))
                return
            raw_length = self.headers.get("Content-Length")
            if raw_length is None:
                self._error(411, SeeleError("MANIFEST_INVALID", "Content-Length is required"))
                return
            try:
                length = int(raw_length)
            except ValueError:
                self._error(400, SeeleError("MANIFEST_INVALID", "Content-Length is invalid"))
                return
            if length < 0 or length > self.server.service.config.max_request_bytes:
                self._error(413, SeeleError("MANIFEST_INVALID", "Request body is too large"))
                return
            try:
                state, created = self.server.service.submit(self.rfile.read(length))
                self._json(202 if created else 200, {"protocol": PROTOCOL, "transferId": state["transferId"],
                                                        "accepted": True, "status": state["status"], "duplicate": not created})
            except SeeleError as exc:
                status = 409 if exc.code == "TRANSFER_CONFLICT" else 503 if exc.code == "QUEUE_FULL" else 422
                self._error(status, exc)
            except Exception:
                self._error(500, internal_error())
            return
        match = TRANSFER_PATH.fullmatch(self.path)
        if match and match.group(2):
            value = self.server.service.cancel(match.group(1))
            self._json(200, value) if value else self._error(404, SeeleError("TRANSFER_NOT_FOUND", "Transfer was not found"))
            return
        self._error(404, SeeleError("NOT_FOUND", "Route was not found"))

    def _authorized(self) -> bool:
        expected = self.server.service.config.auth_token
        if expected is None:
            return True
        supplied = self.headers.get("Authorization", "")
        valid = supplied.startswith("Bearer ") and hmac.compare_digest(supplied[7:], expected)
        if not valid:
            self._error(401, SeeleError("AUTH_FAILED", "Receiver authentication failed"))
        return valid

    def _error(self, status: int, error: SeeleError) -> None:
        self._json(status, {"protocol": PROTOCOL, "accepted": False, "error": error.as_dict()})

    def _cors_headers(self) -> None:
        origin = self.headers.get("Origin")
        if origin in ALLOWED_WEB_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
            self.send_header("Access-Control-Max-Age", "600")
            if self.headers.get("Access-Control-Request-Private-Network") == "true":
                self.send_header("Access-Control-Allow-Private-Network", "true")

    def _json(self, status: int, value: Any) -> None:
        payload = json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self._cors_headers()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, format: str, *args: Any) -> None:
        return
