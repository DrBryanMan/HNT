# Hikka Not Translated Catalog

Статичний SPA-каталог для тайтлів Hikka, у яких `translated_ua` не дорівнює `true`.

## Структура

- `scripts/fetch_hikka_anime.py` - парсер Hikka API, який зберігає компактний JSON.
- Парсер пропускає перекладені тайтли та записи з `media_type: "music"`.
- `data/anime.json` - тестові дані для каталогу.
- `src/modules/` - окремі модулі завантаження, форматування та рендеру.
- `index.html` - вхідна сторінка SPA.

## Запуск каталогу

```bash
python scripts/server.py
```

Після цього відкрий `http://localhost:5173`.

Цей сервер не тільки віддає SPA, а й дозволяє кнопці видалення переписувати `data/anime.json`.

Каталог показує по 50 записів на сторінку. Пагінація закріплена зверху під час прокрутки.

## Запуск парсера

```bash
python scripts/fetch_hikka_anime.py
```

Парсер використовує базовий запит:

```json
{
  "years": [],
  "score": [0, 10],
  "native_score": [0, 10],
  "sort": ["score:desc", "scored_by:desc"]
}
```

Додаткові параметри:

```bash
python scripts/fetch_hikka_anime.py --query "frieren" --max-pages 2
```

Тестовий режим опрацьовує тільки першу сторінку:

```bash
python scripts/fetch_hikka_anime.py --test
```

За замовчуванням результат зберігається у кореневу папку `data/anime.json`, незалежно від того, з якої папки запущено скрипт.
