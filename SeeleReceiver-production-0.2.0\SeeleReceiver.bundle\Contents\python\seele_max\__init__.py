"""Seele asset receiver for Autodesk 3ds Max."""

__version__ = "0.2.0"

from .config import ReceiverConfig
from .service import TransferService

__all__ = ["ReceiverConfig", "TransferService", "__version__"]
