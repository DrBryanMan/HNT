import { formatMediaType, formatScore, getDisplayTitle } from "./formatters.js";

const PAGE_SIZE = 50;
const PAGINATION_RADIUS = 2;

export function createCatalogController(elements, items) {
  const state = {
    page: 1,
    query: "",
    type: "all",
    sort: "score-desc",
  };

  async function deleteItem(item) {
    setFeedback(elements, `Видаляю "${getDisplayTitle(item)}"...`, "info");

    try {
      await deleteCatalogItem(item.slug);
      const itemIndex = items.findIndex((entry) => entry.slug === item.slug);
      if (itemIndex !== -1) {
        items.splice(itemIndex, 1);
      }
      setFeedback(elements, `Видалено "${getDisplayTitle(item)}" з JSON.`, "success");
      syncTypeFilter(elements.typeFilter, items, state);
      render(elements, items, state, deleteItem);
    } catch (error) {
      setFeedback(
        elements,
        "Не вдалося видалити запис. Запусти локальний сервер з README, а не звичайний static server.",
        "error",
      );
      console.error(error);
    }
  }

  fillTypeFilter(elements.typeFilter, items);
  render(elements, items, state, deleteItem);

  const updateFilters = () => {
    state.query = elements.search.value.trim().toLowerCase();
    state.type = elements.typeFilter.value;
    state.sort = elements.sortOrder.value;
    state.page = 1;
    render(elements, items, state, deleteItem);
  };

  elements.filters.addEventListener("input", updateFilters);
  elements.filters.addEventListener("change", updateFilters);
}

async function deleteCatalogItem(slug) {
  const response = await fetch(`/api/anime/${encodeURIComponent(slug)}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(`Delete failed with ${response.status}`);
  }
}

function syncTypeFilter(select, items, state) {
  const selectedType = state.type;
  select.replaceChildren(createTypeOption("all", "Усі"));
  fillTypeFilter(select, items);

  const hasSelectedType = [...select.options].some((option) => option.value === selectedType);
  state.type = hasSelectedType ? selectedType : "all";
  select.value = state.type;
}

function fillTypeFilter(select, items) {
  const types = [...new Set(items.map((item) => item.mediaType))].sort();

  for (const type of types) {
    select.append(createTypeOption(type, formatMediaType(type)));
  }
}

function createTypeOption(value, label) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  return option;
}

function render(elements, items, state, onDelete) {
  const visibleItems = getVisibleItems(items, state);
  const totalPages = getTotalPages(visibleItems.length);
  state.page = clampPage(state.page, totalPages);

  const pageStart = (state.page - 1) * PAGE_SIZE;
  const pageItems = visibleItems.slice(pageStart, pageStart + PAGE_SIZE);
  const pageEnd = pageStart + pageItems.length;

  elements.catalog.replaceChildren(...pageItems.map((item) => createCard(item, onDelete)));
  elements.empty.hidden = visibleItems.length > 0;
  elements.stats.textContent = getStatsText(pageStart, pageEnd, visibleItems.length, items.length);
  renderPagination(elements.pagination, state, totalPages, () => {
    render(elements, items, state, onDelete);
  });
}

function getTotalPages(totalItems) {
  return Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
}

function clampPage(page, totalPages) {
  return Math.min(Math.max(page, 1), totalPages);
}

function getStatsText(pageStart, pageEnd, visibleCount, totalCount) {
  if (visibleCount === 0) {
    return `0 з ${totalCount} тайтлів`;
  }

  return `${pageStart + 1}-${pageEnd} з ${visibleCount} тайтлів`;
}

function renderPagination(container, state, totalPages, onPageChange) {
  container.replaceChildren();
  container.hidden = totalPages <= 1;

  if (totalPages <= 1) {
    return;
  }

  const summary = document.createElement("span");
  summary.className = "pagination__summary";
  summary.textContent = `Сторінка ${state.page} з ${totalPages}`;

  const controls = document.createElement("div");
  controls.className = "pagination__controls";
  controls.append(
    createPageButton("Назад", state.page - 1, state.page === 1, state, onPageChange),
    ...getPageItems(state.page, totalPages).map((page) =>
      page === "ellipsis"
        ? createPaginationEllipsis()
        : createPageButton(String(page), page, false, state, onPageChange),
    ),
    createPageButton("Далі", state.page + 1, state.page === totalPages, state, onPageChange),
  );

  container.append(summary, controls);
}

function getPageItems(currentPage, totalPages) {
  const pages = new Set([1, totalPages]);
  const start = Math.max(1, currentPage - PAGINATION_RADIUS);
  const end = Math.min(totalPages, currentPage + PAGINATION_RADIUS);

  for (let page = start; page <= end; page += 1) {
    pages.add(page);
  }

  const sortedPages = [...pages].sort((left, right) => left - right);
  const items = [];

  for (const page of sortedPages) {
    const previousPage = items.at(-1);
    if (typeof previousPage === "number" && page - previousPage > 1) {
      items.push("ellipsis");
    }
    items.push(page);
  }

  return items;
}

function createPaginationEllipsis() {
  const ellipsis = document.createElement("span");
  ellipsis.className = "pagination__ellipsis";
  ellipsis.textContent = "...";
  return ellipsis;
}

function createPageButton(label, page, disabled, state, onPageChange) {
  const button = document.createElement("button");
  button.className = "pagination__button";
  button.type = "button";
  button.textContent = label;
  button.disabled = disabled;

  if (page === state.page) {
    button.classList.add("pagination__button--active");
    button.setAttribute("aria-current", "page");
  }

  button.addEventListener("click", () => {
    state.page = page;
    onPageChange();
    scrollToCatalogTop();
  });

  return button;
}

function scrollToCatalogTop() {
  document.querySelector(".catalog-shell")?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

function getVisibleItems(items, state) {
  return items
    .filter((item) => matchesQuery(item, state.query))
    .filter((item) => state.type === "all" || item.mediaType === state.type)
    .sort((left, right) => compareItems(left, right, state.sort));
}

function matchesQuery(item, query) {
  if (!query) {
    return true;
  }

  const haystack = [item.titleUa, item.titleJa, item.slug].join(" ").toLowerCase();
  return haystack.includes(query);
}

function compareItems(left, right, sort) {
  if (sort === "score-asc") {
    return scoreValue(left) - scoreValue(right);
  }

  if (sort === "title-asc") {
    return getDisplayTitle(left).localeCompare(getDisplayTitle(right), "uk");
  }

  return scoreValue(right) - scoreValue(left);
}

function scoreValue(item) {
  return item.score ?? -1;
}

function createCard(item, onDelete) {
  const card = document.createElement("article");
  card.className = "anime-card";

  const posterWrap = document.createElement("div");
  posterWrap.className = "anime-card__poster-wrap";

  const poster = document.createElement("img");
  poster.className = "anime-card__poster";
  poster.src = item.image;
  poster.alt = getDisplayTitle(item);
  poster.loading = "lazy";

  const meta = document.createElement("div");
  meta.className = "anime-card__meta";
  meta.append(
    createBadge(formatMediaType(item.mediaType), `badge--type-${item.mediaType}`),
    createBadge(formatScore(item.score), getScoreBadgeClass(item.score)),
  );

  const deleteButton = document.createElement("button");
  deleteButton.className = "anime-card__delete";
  deleteButton.type = "button";
  deleteButton.textContent = "Видалити";
  deleteButton.setAttribute("aria-label", `Видалити ${getDisplayTitle(item)}`);
  deleteButton.addEventListener("click", () => onDelete(item));

  const body = document.createElement("div");
  body.className = "anime-card__body";

  const title = document.createElement("h2");
  title.className = "anime-card__title";
  title.textContent = getDisplayTitle(item);

  const originalTitle = document.createElement("p");
  originalTitle.className = "anime-card__original";
  originalTitle.textContent = item.titleUa && item.titleJa ? item.titleJa : item.slug;

  const link = document.createElement("a");
  link.className = "anime-card__hitarea";
  link.href = item.hikkaUrl;
  link.target = "_blank";
  link.rel = "noreferrer";
  link.setAttribute("aria-label", `Відкрити ${getDisplayTitle(item)} на Hikka`);

  posterWrap.append(poster, meta, deleteButton);
  body.append(title, originalTitle);
  card.append(posterWrap, body, link);

  return card;
}

function createBadge(text, className) {
  const badge = document.createElement("span");
  badge.className = `badge ${className}`;
  badge.textContent = text;
  return badge;
}

function getScoreBadgeClass(score) {
  if (score === null) {
    return "badge--score-empty";
  }

  if (score >= 8) {
    return "badge--score-high";
  }

  if (score >= 6) {
    return "badge--score-mid";
  }

  return "badge--score-low";
}

function setFeedback(elements, message, type) {
  elements.feedback.textContent = message;
  elements.feedback.dataset.type = type;
  elements.feedback.hidden = false;

  window.clearTimeout(elements.feedback.hideTimer);
  elements.feedback.hideTimer = window.setTimeout(() => {
    elements.feedback.hidden = true;
  }, 3600);
}
