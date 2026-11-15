from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
import threading
from typing import Any

from .errors import SeeleError
from .protocol import Manifest, PROTOCOL

TERMINAL = {"succeeded", "failed", "cancelled"}
TRANSITIONS = {
    "queued": {"downloading", "cancelled", "failed"},
    "downloading": {"verifying", "cancelled", "failed"},
    "verifying": {"importing", "cancelled", "failed"},
    "importing": {"succeeded", "failed"},
    "succeeded": set(),
    "failed": set(),
    "cancelled": set(),
}


@dataclass
class TransferRecord:
    manifest: Manifest
    fingerprint: str
    status: str = "queued"
    sequence: int = 1
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    progress: dict[str, Any] = field(default_factory=dict)
    result: dict[str, Any] | None = None
    error: dict[str, Any] | None = None
    history: list[dict[str, Any]] = field(default_factory=list)
    cancel_event: threading.Event = field(default_factory=threading.Event, repr=False)

    def __post_init__(self) -> None:
        self.history.append(self.snapshot(include_history=False))

    def snapshot(self, include_history: bool = True) -> dict[str, Any]:
        value: dict[str, Any] = {
            "protocol": PROTOCOL,
            "transferId": self.manifest.transfer_id,
            "status": self.status,
            "sequence": self.sequence,
            "createdAt": self.created_at.isoformat().replace("+00:00", "Z"),
            "updatedAt": self.updated_at.isoformat().replace("+00:00", "Z"),
        }
        if self.progress:
            value["progress"] = dict(self.progress)
        if self.result is not None:
            value["result"] = self.result
        if self.error is not None:
            value["error"] = self.error
        if include_history:
            value["history"] = list(self.history)
        return value


class TransferStore:
    def __init__(self) -> None:
        self._records: dict[str, TransferRecord] = {}
        self._lock = threading.RLock()

    def create(self, manifest: Manifest) -> tuple[TransferRecord, bool]:
        with self._lock:
            existing = self._records.get(manifest.transfer_id)
            fingerprint = manifest.fingerprint()
            if existing:
                if existing.fingerprint != fingerprint:
                    raise SeeleError("TRANSFER_CONFLICT", "transferId already has different content")
                return existing, False
            record = TransferRecord(manifest, fingerprint)
            self._records[manifest.transfer_id] = record
            return record, True

    def get(self, transfer_id: str) -> TransferRecord | None:
        with self._lock:
            return self._records.get(transfer_id)

    def transition(self, transfer_id: str, status: str, *, progress: dict[str, Any] | None = None,
                   result: dict[str, Any] | None = None, error: dict[str, Any] | None = None) -> dict[str, Any]:
        with self._lock:
            record = self._records[transfer_id]
            if status not in TRANSITIONS.get(record.status, set()):
                raise SeeleError("INTERNAL_ERROR", f"Invalid status transition {record.status} -> {status}")
            record.status = status
            record.sequence += 1
            record.updated_at = datetime.now(timezone.utc)
            if progress is not None:
                record.progress = progress
            if result is not None:
                record.result = result
            if error is not None:
                record.error = error
            event = record.snapshot(include_history=False)
            record.history.append(event)
            return event

    def request_cancel(self, transfer_id: str) -> dict[str, Any]:
        with self._lock:
            record = self._records[transfer_id]
            if record.status in TERMINAL:
                return record.snapshot()
            record.cancel_event.set()
            if record.status != "importing":
                self.transition(transfer_id, "cancelled")
            return record.snapshot()

