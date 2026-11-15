"""3ds Max ApplicationPlugins entrypoint."""

from pathlib import Path
import logging
import sys

PACKAGE_ROOT = Path(__file__).resolve().parents[2]
PYTHON_ROOT = PACKAGE_ROOT / "python"
if str(PYTHON_ROOT) not in sys.path:
    sys.path.insert(0, str(PYTHON_ROOT))

logging.basicConfig(level=logging.INFO)

try:
    from seele_max.max_host import start

    start()
except Exception:
    logging.getLogger("seele_max.startup").exception("Seele Receiver failed to start")

