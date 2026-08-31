#!/usr/bin/env python3
"""Update Hikka release metadata and incrementally prune the filtered catalog."""

from __future__ import annotations

import argparse
import json
from collections import defaultdict
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SOURCE_FILE = PROJECT_ROOT / "data" / "anime.json"
DEFAULT_OUTPUT = PROJECT_ROOT / "data" / "anime-filtered.json"
CPR_BASE_URL = "https://raw.githubusercontent.com/DrBryanMan/CPRcatalog/refs/heads/main/json/"
CPR_CATALOG_URL = f"{CPR_BASE_URL}AnimeTitlesDB.json"
CPR_RELEASES_URL = f"{CPR_BASE_URL}AnimeReleasesDB.json"
CPR_TEAMS_URL = f"{CPR_BASE_URL}TeamsDB.json"
USER_AGENT = "HikkaNotTranslated-Codex/2.0"


def read_json(path: Path) -> list[dict]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise ValueError(f"{path} must contain a JSON array")
    return data


def download_json(url: str) -> list[dict]:
    request = Request(url, headers={"Accept": "application/json", "User-Agent": USER_AGENT})
    try:
        with urlopen(request, timeout=60) as response:
            data = json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        raise RuntimeError(f"CPR catalog returned HTTP {error.code}: {url}") from error
    except (URLError, TimeoutError) as error:
        raise RuntimeError(f"Could not download CPR catalog: {error}") from error

    if not isinstance(data, list):
        raise ValueError(f"CPR catalog must contain a JSON array: {url}")
    return data


def save_catalog(path: Path, items: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(items, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def slug_from_hikka_url(url: object) -> str | None:
    if not isinstance(url, str):
        return None
    path = urlparse(url).path.rstrip("/")
    prefix = "/anime/"
    if not path.startswith(prefix):
        return None
    return path.removeprefix(prefix) or None


def object_ids(values: object) -> set[str]:
    if not isinstance(values, list):
        return set()
    return {value["id"] for value in values if isinstance(value, dict) and isinstance(value.get("id"), str)}


def build_release_metadata(
    titles: list[dict], releases: list[dict], teams: list[dict]
) -> tuple[dict[str, tuple[int, list[dict]]], set[str]]:
    team_by_id = {team.get("id"): team for team in teams if isinstance(team, dict) and team.get("id")}
    release_team_ids: dict[str, set[str]] = defaultdict(set)

    for release in releases:
        if not isinstance(release, dict) or not isinstance(release.get("id"), str):
            continue
        release_team_ids[release["id"]].update(object_ids(release.get("teams")))
        release_team_ids[release["id"]].update(object_ids(release.get("teamscolab")))

    for team in team_by_id.values():
        for release_id in object_ids(team.get("anime_releases")):
            release_team_ids[release_id].add(team["id"])

    metadata: dict[str, tuple[int, list[dict]]] = {}
    released_slugs: set[str] = set()
    for title in titles:
        if not isinstance(title, dict) or not (slug := slug_from_hikka_url(title.get("hikka_url"))):
            continue
        release_ids = object_ids(title.get("releases"))
        if release_ids:
            released_slugs.add(slug)
        team_ids = set().union(*(release_team_ids[release_id] for release_id in release_ids)) if release_ids else set()
        release_teams = [
            {
                "id": team_id,
                "name": team_by_id[team_id].get("name") or "Невідома команда",
                "logo": team_by_id[team_id].get("logo") or team_by_id[team_id].get("cover"),
            }
            for team_id in sorted(team_ids, key=lambda value: str(team_by_id.get(value, {}).get("name", "")))
            if team_id in team_by_id
        ]
        metadata[slug] = (len(release_ids), release_teams)

    return metadata, released_slugs


def update_source_metadata(items: list[dict], metadata: dict[str, tuple[int, list[dict]]]) -> bool:
    changed = False
    for item in items:
        if not isinstance(item, dict):
            continue
        release_count, release_teams = metadata.get(item.get("slug"), (0, []))
        if item.get("release_count") != release_count:
            item["release_count"] = release_count
            changed = True
        if item.get("release_teams") != release_teams:
            item["release_teams"] = release_teams
            changed = True
    return changed


def should_remove(item: dict, released_slugs: set[str]) -> bool:
    return item.get("translated_ua") is True or item.get("slug") in released_slugs


def prune_filtered_catalog(
    source_items: list[dict], output_path: Path, released_slugs: set[str]
) -> tuple[int, int, bool]:
    created = not output_path.exists()
    items = source_items if created else read_json(output_path)
    kept_items = [item for item in items if not should_remove(item, released_slugs)]
    removed = len(items) - len(kept_items)
    if created or removed:
        save_catalog(output_path, kept_items)
    return len(kept_items), removed, created


def generate_filtered_catalog(
    source_path: Path = SOURCE_FILE,
    output_path: Path = DEFAULT_OUTPUT,
    cpr_catalog_url: str = CPR_CATALOG_URL,
    cpr_releases_url: str = CPR_RELEASES_URL,
    cpr_teams_url: str = CPR_TEAMS_URL,
) -> tuple[int, int, bool]:
    source_items = read_json(source_path)
    metadata, released_slugs = build_release_metadata(
        download_json(cpr_catalog_url),
        download_json(cpr_releases_url),
        download_json(cpr_teams_url),
    )
    if update_source_metadata(source_items, metadata):
        save_catalog(source_path, source_items)
    return prune_filtered_catalog(source_items, output_path, released_slugs)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Update Hikka catalog metadata and prune filtered titles.")
    parser.add_argument("--input", default=SOURCE_FILE, type=Path)
    parser.add_argument("--output", default=DEFAULT_OUTPUT, type=Path)
    parser.add_argument("--cpr-catalog-url", default=CPR_CATALOG_URL)
    parser.add_argument("--cpr-releases-url", default=CPR_RELEASES_URL)
    parser.add_argument("--cpr-teams-url", default=CPR_TEAMS_URL)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    saved, removed, created = generate_filtered_catalog(
        source_path=args.input,
        output_path=args.output,
        cpr_catalog_url=args.cpr_catalog_url,
        cpr_releases_url=args.cpr_releases_url,
        cpr_teams_url=args.cpr_teams_url,
    )
    action = "created" if created else "pruned"
    print(f"{action.capitalize()} {args.output}: {saved} titles remain, {removed} removed")


if __name__ == "__main__":
    main()
