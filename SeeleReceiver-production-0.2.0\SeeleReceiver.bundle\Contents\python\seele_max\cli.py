from __future__ import annotations

import argparse
from pathlib import Path
import logging

from .config import ReceiverConfig
from .importers import ImmediateDispatcher, ImporterRegistry
from .receiver import ReceiverServer
from .service import TransferService


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Seele 3ds Max local asset receiver")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=9880)
    parser.add_argument("--cache-dir", type=Path)
    parser.add_argument("--token")
    parser.add_argument("--allow-host", action="append", default=[])
    parser.add_argument("--allow-callback-host", action="append", default=[])
    parser.add_argument("--allow-http", action="store_true", help="Development only")
    return parser


def main() -> None:
    args = build_parser().parse_args()
    defaults = ReceiverConfig()
    config = ReceiverConfig(host=args.host, port=args.port, cache_dir=args.cache_dir or defaults.cache_dir,
                            auth_token=args.token, allowed_cdn_hosts=frozenset(args.allow_host),
                            allowed_callback_hosts=frozenset(args.allow_callback_host), allow_http=args.allow_http)
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    # Standalone mode validates the full transport but intentionally cannot edit a Max scene.
    importers = ImporterRegistry({})
    service = TransferService(config, ImmediateDispatcher(), importers)
    server = ReceiverServer(service)
    try:
        print(f"Seele receiver listening on http://{config.host}:{config.port}")
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        service.close()


if __name__ == "__main__":
    main()

