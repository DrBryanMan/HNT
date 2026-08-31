#!/usr/bin/env python3
"""Build a deduplicated genres/themes catalog from the Hikka anime source file."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SOURCE_FILE = PROJECT_ROOT / "data" / "anime.json"
DEFAULT_OUTPUT = PROJECT_ROOT / "data" / "genres.json"


def read_json(path: Path) -> list[dict]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise ValueError(f"{path} must contain a JSON array")
    return data


def save_json(path: Path, items: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(items, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def extract_unique_genres(items: list[dict]) -> list[dict]:
    unique: dict[tuple[str, str], dict] = {}

    for item in items:
        if not isinstance(item, dict):
            continue
        for genre in item.get("genres") or []:
            if not isinstance(genre, dict) or not genre.get("name_ua"):
                continue
            genre_type = genre.get("type") or "genre"
            key = (genre_type, genre.get("name_en") or genre["name_ua"])
            unique.setdefault(
                key,
                {
                    "name_ua": genre["name_ua"],
                    "name_en": genre.get("name_en"),
                    "type": genre_type,
                },
            )

    return sorted(unique.values(), key=lambda genre: (genre["type"], genre["name_ua"].casefold()))


def build_genres_catalog(source_path: Path = SOURCE_FILE, output_path: Path = DEFAULT_OUTPUT) -> int:
    items = read_json(source_path)
    genres = extract_unique_genres(items)
    save_json(output_path, genres)
    return len(genres)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build a deduplicated genres catalog from data/anime.json.")
    parser.add_argument("--input", default=SOURCE_FILE, type=Path)
    parser.add_argument("--output", default=DEFAULT_OUTPUT, type=Path)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    count = build_genres_catalog(source_path=args.input, output_path=args.output)
    print(f"Saved {args.output}: {count} unique genres/themes")


if __name__ == "__main__":
    main()