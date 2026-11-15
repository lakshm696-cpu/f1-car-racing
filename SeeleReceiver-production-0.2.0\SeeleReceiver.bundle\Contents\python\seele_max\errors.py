from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass
class SeeleError(Exception):
    code: str
    message: str
    retryable: bool = False
    phase: str = "validation"
    details: dict[str, Any] | None = None

    def as_dict(self) -> dict[str, Any]:
        value: dict[str, Any] = {
            "code": self.code,
            "message": self.message,
            "retryable": self.retryable,
            "phase": self.phase,
        }
        if self.details:
            value["details"] = self.details
        return value


def internal_error(phase: str = "internal") -> SeeleError:
    return SeeleError("INTERNAL_ERROR", "The receiver encountered an internal error", True, phase)

