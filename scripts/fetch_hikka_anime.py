#!/usr/bin/env python3
"""Fetch untranslated anime titles from Hikka and save a compact JSON catalog."""

from __future__ import annotations

import argparse
import json
import logging
import time
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


API_URL = "https://api.hikka.io/anime"
PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = PROJECT_ROOT / "data" / "anime.json"
DEFAULT_PAGE_SIZE = 100
REQUEST_DELAY_SECONDS = 0.25
EXCLUDED_MEDIA_TYPES = {"music"}
LOGGER = logging.getLogger("hikka_parser")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Fetch anime from Hikka API and keep titles where translated_ua is false.",
    )
    parser.add_argument(
        "-o",
        "--output",
        default=DEFAULT_OUTPUT,
        type=Path,
        help=f"Output JSON path. Default: {DEFAULT_OUTPUT}",
    )
    parser.add_argument(
        "--query",
        default=None,
        help="Optional search query for Hikka anime catalog.",
    )
    parser.add_argument(
        "--page-size",
        default=DEFAULT_PAGE_SIZE,
        type=int,
        choices=range(1, DEFAULT_PAGE_SIZE + 1),
        metavar=f"1-{DEFAULT_PAGE_SIZE}",
        help=f"Items per API page. Default: {DEFAULT_PAGE_SIZE}",
    )
    parser.add_argument(
        "--max-pages",
        default=None,
        type=int,
        help="Optional limit for testing partial fetches.",
    )
    parser.add_argument(
        "--sort",
        default=["score:desc", "scored_by:desc"],
        nargs="+",
        help="Hikka sort fields. Default: score:desc scored_by:desc",
    )
    parser.add_argument(
        "--test",
        action="store_true",
        help="Process only the first page and save the result.",
    )
    parser.add_argument(
        "--log-level",
        default="INFO",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
        help="Logging verbosity. Default: INFO",
    )
    return parser.parse_args()


def configure_logging(level: str) -> None:
    logging.basicConfig(
        level=getattr(logging, level),
        format="%(asctime)s %(levelname)s %(message)s",
        datefmt="%H:%M:%S",
    )


def build_search_payload(query: str | None, sort: list[str]) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "years": [],
        "score": [0, 10],
        "native_score": [0, 10],
        "sort": sort,
    }

    if query:
        payload["query"] = query

    return payload


def post_json(url: str, payload: dict[str, Any]) -> dict[str, Any]:
    body = json.dumps(payload).encode("utf-8")
    request = Request(
        url,
        data=body,
        method="POST",
        headers={
            "Accept": "application/json",
            "Content-Type": "application/json",
            "User-Agent": "HikkaNotTranslated-Codex/1.0",
        },
    )

    try:
        with urlopen(request, timeout=30) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        details = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Hikka API returned {error.code}: {details}") from error
    except URLError as error:
        raise RuntimeError(f"Could not reach Hikka API: {error}") from error


def compact_anime(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "media_type": item.get("media_type"),
        "title_ua": item.get("title_ua"),
        "title_ja": item.get("title_ja"),
        "image": item.get("image"),
        "score": item.get("score"),
        "slug": item.get("slug"),
    }


def fetch_untranslated_anime(
    query: str | None,
    page_size: int,
    max_pages: int | None,
    sort: list[str],
) -> list[dict[str, Any]]:
    payload = build_search_payload(query=query, sort=sort)
    results: list[dict[str, Any]] = []
    page = 1
    total_pages = 1

    while page <= total_pages:
        if max_pages is not None and page > max_pages:
            break

        url = f"{API_URL}?page={page}&size={page_size}"
        LOGGER.info("Fetching page %s", page)
        response = post_json(url, payload)
        pagination = response.get("pagination", {})
        total_pages = int(pagination.get("pages") or page)
        page_items = response.get("list", [])
        skipped_translated = 0
        skipped_media_type = 0

        for item in page_items:
            if item.get("translated_ua") is True:
                skipped_translated += 1
                continue
            if item.get("media_type") in EXCLUDED_MEDIA_TYPES:
                skipped_media_type += 1
                continue
            results.append(compact_anime(item))

        LOGGER.info(
            "Page %s processed: %s kept, %s translated skipped, %s media type skipped",
            page,
            len(page_items) - skipped_translated - skipped_media_type,
            skipped_translated,
            skipped_media_type,
        )
        page += 1
        if page <= total_pages:
            time.sleep(REQUEST_DELAY_SECONDS)

    return results


def save_catalog(path: Path, items: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(items, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def main() -> None:
    args = parse_args()
    configure_logging(args.log_level)
    max_pages = 1 if args.test else args.max_pages
    if args.test:
        LOGGER.info("Test mode enabled: only page 1 will be processed")

    items = fetch_untranslated_anime(
        query=args.query,
        page_size=args.page_size,
        max_pages=max_pages,
        sort=args.sort,
    )
    save_catalog(args.output, items)
    LOGGER.info("Saved %s untranslated titles to %s", len(items), args.output)


if __name__ == "__main__":
    main()
