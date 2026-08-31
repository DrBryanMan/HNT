#!/usr/bin/env python3
"""Serve the catalog SPA and allow deleting entries from data/anime.json."""

from __future__ import annotations

import argparse
import json
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse


DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 5173
ROOT_DIR = Path(__file__).resolve().parents[1]
DATA_FILE = ROOT_DIR / "data" / "anime.json"


class CatalogRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT_DIR, **kwargs)

    def do_DELETE(self) -> None:
        parsed_url = urlparse(self.path)
        if not parsed_url.path.startswith("/api/anime/"):
            self.send_error(HTTPStatus.NOT_FOUND)
            return

        slug = unquote(parsed_url.path.removeprefix("/api/anime/"))
        if not slug:
            self.send_error(HTTPStatus.BAD_REQUEST, "Missing slug")
            return

        try:
            removed = delete_anime(slug)
        except FileNotFoundError:
            self.send_error(HTTPStatus.NOT_FOUND, "Catalog file not found")
            return
        except json.JSONDecodeError:
            self.send_error(HTTPStatus.INTERNAL_SERVER_ERROR, "Catalog JSON is invalid")
            return

        if not removed:
            self.send_error(HTTPStatus.NOT_FOUND, "Anime not found")
            return

        self.send_json({"removed": slug})

    def send_json(self, payload: dict[str, str]) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def delete_anime(slug: str) -> bool:
    items = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    filtered_items = [item for item in items if item.get("slug") != slug]

    if len(filtered_items) == len(items):
        return False

    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    DATA_FILE.write_text(
        json.dumps(filtered_items, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return True


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Serve Hikka catalog with JSON delete support.")
    parser.add_argument("--host", default=DEFAULT_HOST)
    parser.add_argument("--port", default=DEFAULT_PORT, type=int)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    server = ThreadingHTTPServer((args.host, args.port), CatalogRequestHandler)
    print(f"Serving catalog at http://{args.host}:{args.port}")
    print(f"Editing {DATA_FILE}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
