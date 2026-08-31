#!/usr/bin/env python3
"""
Hikka Anime Parser — будує JSON-каталог аніме з Hikka.

Опис
────
Скрипт звертається до публічного API Hikka (api.hikka.io) і зберігає
компактний каталог усіх тайтулів у data/anime.json — саме той файл, який
роздає scripts/server.py для SPA. Фільтрація за наявністю українського
перекладу виконується окремим скриптом.

Хентай (rating = "rx") не потрапляє у вибірку. На самому hikka.io це працює
так: якщо в запиті немає текстового "query" і не задано "rating"/"genres"
явно, бекенд сам ховає rx-тайтули (app/service.py::anime_search_filter у
відкритому репозиторії github.com/hikka-io/hikka). Тут ці поля лишаються
порожніми, щоб не зламати цю поведінку, і додатково rating перевіряється
самостійно — незалежно від --query і про всяк випадок, якщо API зміниться.

Режими запуску
──────────────
  latest — інкрементально дозаписує нові тайтули (сортування created:desc,
           найновіші спочатку). Зупиняється, щойно ЦІЛА сторінка вже є
           в каталозі. Наявні записи не змінює — лише додає нові.

  all    — повний прохід по всьому каталогу. Перезаписує data/anime.json
           повністю, тому оновлює рейтинг, тип, назви (ua/ja/en), статус
           і статус перекладу для геть усіх тайтулів.

Приклади використання
──────────────────────
  python scripts/fetch_hikka_anime.py latest
  python scripts/fetch_hikka_anime.py latest --sleep 0.5
  python scripts/fetch_hikka_anime.py all
  python scripts/fetch_hikka_anime.py all --max-pages 2 --output /tmp/test.json
  python scripts/fetch_hikka_anime.py all --query "наруто"

Поля запису в data/anime.json
──────────────────────────────
  media_type, title_ua, title_en, title_ja, image, score,
  status, translated_ua, slug
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
import time
from collections import Counter
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")
if sys.stderr.encoding and sys.stderr.encoding.lower() != "utf-8":
    sys.stderr.reconfigure(encoding="utf-8")


API_URL = "https://api.hikka.io/anime"
USER_AGENT = "HikkaNotTranslated-Codex/2.0"

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = PROJECT_ROOT / "data" / "anime.json"

DEFAULT_PAGE_SIZE = 100
DEFAULT_SORT = ["score:desc", "scored_by:desc"]
REQUEST_DELAY_SECONDS = 0.25

# Типи медіа на Hikka: special, movie, music, ova, ona, tv.
# Музичні кліпи — це не "тайтули" у звичному розумінні каталогу, тож пропускаємо.
EXCLUDED_MEDIA_TYPES = {"music"}

# rating = "rx" — позначення хентаю на Hikka (шкала як у MAL/Shikimori:
# g, pg, pg_13, r, r_plus, rx). Дивись коментар у build_search_payload().
AGE_RATING_HENTAI = "rx"

LOGGER = logging.getLogger("hikka_anime_parser")


# ── HTTP ─────────────────────────────────────────────────────────────────────

def api_request(
    url: str,
    method: str = "GET",
    payload: dict[str, Any] | None = None,
    retries: int = 3,
) -> dict[str, Any]:
    """Запит до Hikka API з повторними спробами при 429 і мережевих збоях."""
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    headers = {"Accept": "application/json", "User-Agent": USER_AGENT}
    if payload is not None:
        headers["Content-Type"] = "application/json"

    for attempt in range(1, retries + 1):
        request = Request(url, data=data, method=method, headers=headers)
        try:
            with urlopen(request, timeout=30) as response:
                return json.loads(response.read().decode("utf-8"))
        except HTTPError as error:
            details = error.read().decode("utf-8", errors="replace")
            if error.code == 429 and attempt < retries:
                wait = 5 * attempt
                LOGGER.warning("Ліміт запитів (429), чекаю %sс...", wait)
                time.sleep(wait)
                continue
            raise RuntimeError(f"Hikka API повернув {error.code}: {details}") from error
        except (URLError, TimeoutError) as error:
            if attempt < retries:
                wait = 3 * attempt
                LOGGER.warning("Запит не вдався, повтор через %sс: %s", wait, error)
                time.sleep(wait)
                continue
            raise RuntimeError(f"Не вдалося достукатись до Hikka API: {error}") from error

    raise RuntimeError("Вичерпано спроби запиту до Hikka API")


def build_search_payload(sort: list[str], query: str | None = None) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "years": [None, None],
        "score": [None, None],
        "native_score": [None, None],
        "media_type": [],
        # rating лишаємо порожнім навмисно: якщо його не чіпати (і не задавати
        # query/genres), Hikka сама ховає rating="rx" на бекенді. Заповнення
        # цього списку своїми руками, навпаки, прибрало б і тайтули без
        # рейтингу взагалі (SQL IN не бачить NULL-значень).
        "rating": [],
        # False не обмежує вибірку за статусом перекладу.
        "only_translated": False,
        "sort": sort,
    }
    if query:
        payload["query"] = query
    return payload


def fetch_anime_page(
    page: int, size: int, sort: list[str], query: str | None = None
) -> dict[str, Any]:
    params = urlencode({"page": page, "size": size})
    payload = build_search_payload(sort=sort, query=query)
    return api_request(f"{API_URL}?{params}", method="POST", payload=payload)


# ── Фільтрація та нормалізація ──────────────────────────────────────────────

def skip_reason(item: dict[str, Any]) -> str | None:
    """Причина, чому тайтул не йде в каталог, або None, якщо тайтул лишаємо."""
    if item.get("media_type") in EXCLUDED_MEDIA_TYPES:
        return "media_type"
    if item.get("rating") == AGE_RATING_HENTAI:
        return "hentai"
    return None


def normalize_anime(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "media_type": item.get("media_type"),
        "title_ua": item.get("title_ua"),
        "title_en": item.get("title_en"),
        "title_ja": item.get("title_ja"),
        "image": item.get("image"),
        "score": item.get("score"),
        "status": item.get("status"),
        "translated_ua": item.get("translated_ua"),
        "slug": item.get("slug"),
    }


def dedupe_by_slug(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Прибирає можливі дублікати за slug (останній запис перемагає)."""
    return list({item["slug"]: item for item in items}.values())


# ── Каталог (файл) ──────────────────────────────────────────────────────────

def load_existing_catalog(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    return json.loads(path.read_text(encoding="utf-8"))


def save_catalog(path: Path, items: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(items, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


# ── Режим "all" ──────────────────────────────────────────────────────────────

def fetch_all_anime(
    page_size: int,
    start_page: int,
    max_pages: int | None,
    sort: list[str],
    query: str | None,
    sleep_seconds: float,
) -> tuple[list[dict[str, Any]], Counter, bool]:
    page = start_page
    pages_fetched = 0
    results: list[dict[str, Any]] = []
    skip_counts: Counter[str] = Counter()

    while True:
        if max_pages is not None and pages_fetched >= max_pages:
            LOGGER.info("Досягнуто --max-pages, зупиняюсь.")
            break

        try:
            response = fetch_anime_page(page, page_size, sort=sort, query=query)
        except RuntimeError as error:
            LOGGER.error("Мережева помилка на сторінці %s: %s", page, error)
            LOGGER.error("Продовжити з цього місця: --start-page %s", page)
            return results, skip_counts, False

        pagination = response.get("pagination") or {}
        total_pages = int(pagination.get("pages") or page)
        page_items = response.get("list") or []

        kept_on_page = 0
        for item in page_items:
            reason = skip_reason(item)
            if reason:
                skip_counts[reason] += 1
                continue
            results.append(normalize_anime(item))
            kept_on_page += 1

        LOGGER.info(
            "Сторінка %s/%s: %s залишено, %s пропущено",
            page,
            total_pages,
            kept_on_page,
            len(page_items) - kept_on_page,
        )

        pages_fetched += 1
        if page >= total_pages:
            break
        page += 1
        time.sleep(sleep_seconds)

    return results, skip_counts, True


def run_all(args: argparse.Namespace) -> bool:
    results, skip_counts, completed = fetch_all_anime(
        page_size=args.page_size,
        start_page=args.start_page,
        max_pages=args.max_pages,
        sort=args.sort,
        query=args.query,
        sleep_seconds=args.sleep,
    )
    results = dedupe_by_slug(results)
    save_catalog(args.output, results)

    LOGGER.info(
        "Збережено %s тайтулів у %s (пропущено: тип медіа=%s, хентай=%s)",
        len(results),
        args.output,
        skip_counts["media_type"],
        skip_counts["hentai"],
    )
    if not completed:
        LOGGER.warning("Прохід перервано мережевою помилкою — каталог збережено частково.")

    return completed


# ── Режим "latest" ───────────────────────────────────────────────────────────

def fetch_latest_anime(
    known_slugs: set[str],
    page_size: int,
    start_page: int,
    max_pages: int | None,
    sleep_seconds: float,
) -> tuple[list[dict[str, Any]], Counter, bool]:
    page = start_page
    pages_fetched = 0
    new_items: list[dict[str, Any]] = []
    skip_counts: Counter[str] = Counter()

    while True:
        if max_pages is not None and pages_fetched >= max_pages:
            LOGGER.info("Досягнуто --max-pages, зупиняюсь.")
            break

        try:
            response = fetch_anime_page(page, page_size, sort=["created:desc"])
        except RuntimeError as error:
            LOGGER.error("Мережева помилка на сторінці %s: %s", page, error)
            LOGGER.error("Продовжити з цього місця: --start-page %s", page)
            return new_items, skip_counts, False

        pagination = response.get("pagination") or {}
        total_pages = int(pagination.get("pages") or page)
        page_items = response.get("list") or []

        if not page_items:
            LOGGER.info("Порожня відповідь на сторінці %s — зупиняюсь.", page)
            break

        unseen_items = [item for item in page_items if item.get("slug") not in known_slugs]

        LOGGER.info(
            "Сторінка %s/%s: %s вже в каталозі, %s нових",
            page,
            total_pages,
            len(page_items) - len(unseen_items),
            len(unseen_items),
        )

        if not unseen_items:
            LOGGER.info("Уся сторінка вже є в каталозі — зупиняюсь.")
            break

        for item in unseen_items:
            known_slugs.add(item.get("slug"))  # щоб не обробити той самий slug двічі за прогін

            reason = skip_reason(item)
            if reason:
                skip_counts[reason] += 1
                continue
            new_items.append(normalize_anime(item))

        pages_fetched += 1
        if page >= total_pages:
            break
        page += 1
        time.sleep(sleep_seconds)

    return new_items, skip_counts, True


def run_latest(args: argparse.Namespace) -> bool:
    existing_items = load_existing_catalog(args.output)
    known_slugs = {item.get("slug") for item in existing_items}

    if not existing_items:
        LOGGER.info("Каталог %s ще порожній — це буде повний прохід.", args.output)

    new_items, skip_counts, completed = fetch_latest_anime(
        known_slugs=known_slugs,
        page_size=args.page_size,
        start_page=args.start_page,
        max_pages=args.max_pages,
        sleep_seconds=args.sleep,
    )

    combined = dedupe_by_slug(existing_items + new_items)
    save_catalog(args.output, combined)

    LOGGER.info(
        "Додано %s нових тайтулів (усього в каталозі: %s; пропущено серед нових: "
        "тип медіа=%s, хентай=%s)",
        len(new_items),
        len(combined),
        skip_counts["media_type"],
        skip_counts["hentai"],
    )
    if not completed:
        LOGGER.warning("Прохід перервано мережевою помилкою — додано лише частину нових тайтулів.")

    return completed


# ── CLI ──────────────────────────────────────────────────────────────────────

def _add_common_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument(
        "-o", "--output", default=DEFAULT_OUTPUT, type=Path,
        help=f"Шлях до JSON-каталогу. За замовч.: {DEFAULT_OUTPUT}",
    )
    parser.add_argument(
        "--page-size", default=DEFAULT_PAGE_SIZE, type=int,
        choices=range(1, DEFAULT_PAGE_SIZE + 1), metavar=f"1-{DEFAULT_PAGE_SIZE}",
        help=f"Тайтулів на сторінку API. За замовч.: {DEFAULT_PAGE_SIZE}",
    )
    parser.add_argument(
        "--start-page", default=1, type=int,
        help="Сторінка, з якої почати (щоб відновити перерваний запуск).",
    )
    parser.add_argument(
        "--max-pages", default=None, type=int,
        help="Обмежити кількість сторінок за цей запуск (тести, запобіжник для latest).",
    )
    parser.add_argument(
        "--sleep", default=REQUEST_DELAY_SECONDS, type=float,
        help=f"Пауза між сторінками, сек. За замовч.: {REQUEST_DELAY_SECONDS}",
    )
    parser.add_argument(
        "--log-level", default="INFO",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
        help="Рівень логування. За замовч.: INFO",
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Парсер каталогу аніме з Hikka.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    sub = parser.add_subparsers(dest="mode", required=True)

    p_latest = sub.add_parser(
        "latest", help="Дозаписує нові тайтули (сортування за датою додавання).",
    )
    _add_common_args(p_latest)

    p_all = sub.add_parser(
        "all",
        help="Повний прохід: оновлює рейтинг/тип/назви/статус/переклад усіх тайтулів.",
    )
    _add_common_args(p_all)
    p_all.add_argument(
        "--sort", default=DEFAULT_SORT, nargs="+",
        help=f"Поля сортування Hikka. За замовч.: {' '.join(DEFAULT_SORT)}",
    )
    p_all.add_argument(
        "--query", default=None,
        help="Необов'язковий текстовий пошук у каталозі Hikka.",
    )

    return parser.parse_args()


def configure_logging(level: str) -> None:
    logging.basicConfig(
        level=getattr(logging, level),
        format="%(asctime)s %(levelname)s %(message)s",
        datefmt="%H:%M:%S",
    )


def main() -> None:
    args = parse_args()
    configure_logging(args.log_level)

    dispatch = {"latest": run_latest, "all": run_all}

    try:
        ok = dispatch[args.mode](args)
    except KeyboardInterrupt:
        LOGGER.warning("Перервано користувачем (Ctrl+C)")
        sys.exit(1)

    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
