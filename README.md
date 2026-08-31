# Hikka Not Translated Catalog

SPA-каталог аніме Hikka з двома режимами перегляду: усі тайтли та тайтли,
які ще не мають українського перекладу.

## Структура

- `scripts/fetch_hikka_anime.py` - парсер Hikka API, який зберігає всі тайтли у `data/anime.json`.
- `scripts/filter_anime_catalog.py` - створює `data/anime-filtered.json`, не змінюючи вихідний каталог.
- Відфільтрований каталог не містить тайтлів з `translated_ua: true` або записів,
  для яких у CPRcatalog є непорожній масив `releases`.
- `src/modules/` - окремі модулі завантаження, форматування та рендеру.
- `index.html` - вхідна сторінка SPA.

## Запуск каталогу

```bash
python scripts/server.py
```

Після цього відкрий `http://localhost:5173`.

Перед запуском сервер завантажує CPRcatalog і створює `data/anime-filtered.json`.
Фронтенд завантажує обидва каталоги одразу; чекбокс «Показати всі тайтли» лише
перемикає між ними. Кнопка видалення оновлює обидва локальні каталоги.

Каталог показує по 50 записів на сторінку. Пагінація закріплена зверху під час прокрутки.

## Запуск парсера

```bash
python scripts/fetch_hikka_anime.py all
```

Парсер використовує базовий запит:

```json
{
  "years": [null, null],
  "score": [null, null],
  "native_score": [null, null],
  "media_type": [],
  "rating": [],
  "only_translated": false,
  "sort": ["score:desc", "scored_by:desc"]
}
```

Додаткові параметри:

```bash
python scripts/fetch_hikka_anime.py all --query "frieren" --max-pages 2
```

Щоб сформувати відфільтрований каталог окремо від сервера:

```bash
python scripts/filter_anime_catalog.py
```

За замовчуванням результат зберігається у `data/anime.json`, незалежно від того,
з якої папки запущено скрипт.
