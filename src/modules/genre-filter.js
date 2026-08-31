import { iconMarkup } from "./icons.js";

const GROUP_LABELS = {
  genre: "Жанри",
  theme: "Теми",
};

const GROUP_ORDER = ["genre", "theme"];

export function genreKey(genre) {
  return `${genre.type}::${genre.nameEn || genre.nameUa}`;
}

export function buildGenreGroups(genres) {
  const uniqueByKey = new Map();
  for (const genre of genres) {
    if (!genre || !genre.nameUa) {
      continue;
    }
    uniqueByKey.set(genreKey(genre), genre);
  }

  const grouped = new Map();
  for (const genre of uniqueByKey.values()) {
    if (!grouped.has(genre.type)) {
      grouped.set(genre.type, []);
    }
    grouped.get(genre.type).push(genre);
  }

  for (const group of grouped.values()) {
    group.sort((left, right) => left.nameUa.localeCompare(right.nameUa, "uk"));
  }

  return grouped;
}

export function createGenreFilter(elements, genres, state, onChange) {
  const genreGroups = buildGenreGroups(genres);

  elements.genreTriggerIcon.innerHTML = iconMarkup("chevron-down", 16);
  if (elements.genreTagsResetIcon) {
    elements.genreTagsResetIcon.innerHTML = iconMarkup("trash", 14);
  }

  const setMode = (genre, mode) => {
    const key = genreKey(genre);
    const entry = state.genres.get(key);
    if (entry && entry.mode === mode) {
      state.genres.delete(key);
    } else {
      state.genres.set(key, { genre, mode });
    }
    refresh();
    onChange();
  };

  const swapMode = (key) => {
    const entry = state.genres.get(key);
    if (!entry) {
      return;
    }
    entry.mode = entry.mode === "include" ? "exclude" : "include";
    refresh();
    onChange();
  };

  const removeGenre = (key) => {
    state.genres.delete(key);
    refresh();
    onChange();
  };

  const resetGenres = () => {
    state.genres.clear();
    refresh();
    onChange();
  };

  function refresh() {
    renderList(elements.genreList, genreGroups, elements.genreSearch.value.trim().toLowerCase(), state, setMode);
    renderTags(elements, state, swapMode, removeGenre);
  }

  function openPanel() {
    elements.genrePanel.hidden = false;
    elements.genreTrigger.setAttribute("aria-expanded", "true");
    elements.genreSearch.value = "";
    renderList(elements.genreList, genreGroups, "", state, setMode);
    elements.genreSearch.focus();
  }

  function closePanel() {
    elements.genrePanel.hidden = true;
    elements.genreTrigger.setAttribute("aria-expanded", "false");
  }

  elements.genreTrigger.addEventListener("click", () => {
    elements.genrePanel.hidden ? openPanel() : closePanel();
  });

  elements.genreSearch.addEventListener("input", () => {
    renderList(elements.genreList, genreGroups, elements.genreSearch.value.trim().toLowerCase(), state, setMode);
  });

  document.addEventListener("click", (event) => {
    if (!elements.genrePanel.hidden && !elements.genreField.contains(event.target)) {
      closePanel();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !elements.genrePanel.hidden) {
      closePanel();
      elements.genreTrigger.focus();
    }
  });

  elements.genreTagsReset.addEventListener("click", resetGenres);

  refresh();
}

function renderList(listEl, genreGroups, query, state, onToggle) {
  listEl.replaceChildren();

  const knownTypes = [...GROUP_ORDER, ...[...genreGroups.keys()].filter((type) => !GROUP_ORDER.includes(type))];
  let hasRows = false;

  for (const type of knownTypes) {
    const genres = genreGroups.get(type);
    if (!genres) {
      continue;
    }

    const filteredGenres = genres.filter((genre) => matchesGenreQuery(genre, query));
    if (filteredGenres.length === 0) {
      continue;
    }

    hasRows = true;
    const title = document.createElement("div");
    title.className = "genre-group__title";
    title.textContent = GROUP_LABELS[type] || type;
    listEl.append(title, ...filteredGenres.map((genre) => createGenreRow(genre, state, onToggle)));
  }

  if (!hasRows) {
    const empty = document.createElement("div");
    empty.className = "genre-panel__empty";
    empty.textContent = "Нічого не знайдено.";
    listEl.append(empty);
  }
}

function matchesGenreQuery(genre, query) {
  if (!query) {
    return true;
  }
  const haystack = `${genre.nameUa} ${genre.nameEn}`.toLowerCase();
  return haystack.includes(query);
}

function createGenreRow(genre, state, onToggle) {
  const key = genreKey(genre);
  const entry = state.genres.get(key);
  const mode = entry ? entry.mode : "none";

  const row = document.createElement("div");
  row.className = "genre-row";
  row.dataset.state = mode;

  const check = document.createElement("span");
  check.className = "genre-row__check";
  check.innerHTML = iconMarkup(mode === "exclude" ? "minus" : "check", 14);

  const label = document.createElement("span");
  label.className = "genre-row__label";
  label.textContent = genre.nameUa;

  const actions = document.createElement("div");
  actions.className = "genre-row__actions";
  actions.append(
    createGenreActionButton({
      className: "genre-row__btn--include",
      icon: "plus",
      pressed: mode === "include",
      ariaLabel: `Включити жанр ${genre.nameUa}`,
      onClick: () => onToggle(genre, "include"),
    }),
    createGenreActionButton({
      className: "genre-row__btn--exclude",
      icon: "minus",
      pressed: mode === "exclude",
      ariaLabel: `Виключити жанр ${genre.nameUa}`,
      onClick: () => onToggle(genre, "exclude"),
    }),
  );

  row.append(check, label, actions);
  return row;
}

function createGenreActionButton({ className, icon, pressed, ariaLabel, onClick }) {
  const button = document.createElement("button");
  button.className = `genre-row__btn ${className}`;
  button.type = "button";
  button.innerHTML = iconMarkup(icon, 13);
  button.setAttribute("aria-pressed", String(pressed));
  button.setAttribute("aria-label", ariaLabel);
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    onClick();
  });
  return button;
}

function renderTags(elements, state, onSwap, onRemove) {
  const entries = [...state.genres.values()];
  elements.genreTags.hidden = entries.length === 0;
  elements.genreTagsList.replaceChildren(...entries.map((entry) => createGenreChip(entry, onSwap, onRemove)));

  elements.genreTrigger.dataset.hasSelection = String(entries.length > 0);
  elements.genreTriggerLabel.textContent =
    entries.length === 0 ? "Виберіть жанр/жанри..." : `Обрано жанрів: ${entries.length}`;
}

function createGenreChip(entry, onSwap, onRemove) {
  const key = genreKey(entry.genre);
  const chip = document.createElement("span");
  chip.className = "genre-chip";
  chip.dataset.state = entry.mode;

  const icon = document.createElement("span");
  icon.className = "genre-chip__icon";
  icon.innerHTML = iconMarkup("tag", 12);

  const label = document.createElement("span");
  label.textContent = entry.genre.nameUa;

  const swapButton = document.createElement("button");
  swapButton.className = "genre-chip__btn";
  swapButton.type = "button";
  swapButton.innerHTML = iconMarkup("repeat", 12);
  swapButton.setAttribute(
    "aria-label",
    `Перемкнути на ${entry.mode === "include" ? "виключення" : "включення"}: ${entry.genre.nameUa}`,
  );
  swapButton.addEventListener("click", () => onSwap(key));

  const removeButton = document.createElement("button");
  removeButton.className = "genre-chip__btn";
  removeButton.type = "button";
  removeButton.innerHTML = iconMarkup("x", 12);
  removeButton.setAttribute("aria-label", `Прибрати жанр ${entry.genre.nameUa}`);
  removeButton.addEventListener("click", () => onRemove(key));

  chip.append(icon, label, swapButton, removeButton);
  return chip;
}