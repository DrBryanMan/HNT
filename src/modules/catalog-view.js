import { formatMediaType, formatScore, getDisplayTitle } from "./formatters.js";
import { iconMarkup } from "./icons.js";

const PAGE_SIZE = 50;
const PAGINATION_RADIUS = 2;

export function createCatalogController(elements, catalogs, ignoredSlugs) {
  const state = {
    catalogMode: "filtered",
    ignoredSlugs,
    showIgnored: false,
    page: 1,
    query: "",
    type: "all",
    sort: "score-desc",
  };

  elements.releaseModalClose.innerHTML = iconMarkup("x", 18);

  async function deleteItem(item) {
    setFeedback(elements, `Видаляю "${getDisplayTitle(item)}"...`, "info");

    try {
      await deleteCatalogItem(item.slug);
      const itemIndex = catalogs.filtered.findIndex((entry) => entry.slug === item.slug);
      if (itemIndex !== -1) {
        catalogs.filtered.splice(itemIndex, 1);
      }
      setFeedback(elements, `Видалено "${getDisplayTitle(item)}" з відфільтрованого JSON.`, "success");
      syncTypeFilter(elements.typeFilter, getActiveItems(catalogs, state, ignoredSlugs), state);
      render(elements, catalogs, state, deleteItem, ignoreItem, showReleaseTeams);
    } catch (error) {
      setFeedback(
        elements,
        "Не вдалося видалити запис. Запусти локальний сервер з README, а не звичайний static server.",
        "error",
      );
      console.error(error);
    }
  }

  async function ignoreItem(item) {
    setFeedback(elements, `Ігнорую "${getDisplayTitle(item)}"...`, "info");
    try {
      await ignoreCatalogItem(item.slug);
      ignoredSlugs.add(item.slug);
      setFeedback(elements, `Додано "${getDisplayTitle(item)}" до ігнорованих.`, "success");
      syncTypeFilter(elements.typeFilter, getActiveItems(catalogs, state, ignoredSlugs), state);
      render(elements, catalogs, state, deleteItem, ignoreItem, showReleaseTeams);
    } catch (error) {
      setFeedback(elements, "Не вдалося зберегти ігнорований тайтл.", "error");
      console.error(error);
    }
  }

  function showReleaseTeams(item) {
    elements.releaseModalTeams.replaceChildren(
      ...item.releaseTeams.map((team) => createReleaseTeam(team)),
    );
    elements.releaseModal.showModal();
  }

  const closeReleaseModal = () => elements.releaseModal.close();
  elements.releaseModalClose.addEventListener("click", closeReleaseModal);
  elements.releaseModal.addEventListener("click", (event) => {
    if (event.target === elements.releaseModal) {
      closeReleaseModal();
    }
  });

  fillTypeFilter(elements.typeFilter, getActiveItems(catalogs, state, ignoredSlugs));
  render(elements, catalogs, state, deleteItem, ignoreItem, showReleaseTeams);

  const updateFilters = () => {
    state.query = elements.search.value.trim().toLowerCase();
    state.type = elements.typeFilter.value;
    state.sort = elements.sortOrder.value;
    state.page = 1;
    render(elements, catalogs, state, deleteItem, ignoreItem, showReleaseTeams);
  };

  elements.filters.addEventListener("input", updateFilters);
  elements.filters.addEventListener("change", updateFilters);

  elements.showAll.addEventListener("change", () => {
    state.catalogMode = elements.showAll.checked ? "all" : "filtered";
    state.page = 1;
    syncTypeFilter(elements.typeFilter, getActiveItems(catalogs, state, ignoredSlugs), state);
    elements.title.textContent = elements.showAll.checked
      ? "Усі тайтли"
      : "Тайтли без українського перекладу";
    render(elements, catalogs, state, deleteItem, ignoreItem, showReleaseTeams);
  });

  elements.showIgnored.addEventListener("change", () => {
    state.showIgnored = elements.showIgnored.checked;
    state.page = 1;
    syncTypeFilter(elements.typeFilter, getActiveItems(catalogs, state, ignoredSlugs), state);
    render(elements, catalogs, state, deleteItem, ignoreItem, showReleaseTeams);
  });
}

async function deleteCatalogItem(slug) {
  const response = await fetch(`/api/anime/${encodeURIComponent(slug)}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(`Delete failed with ${response.status}`);
  }
}

async function ignoreCatalogItem(slug) {
  const response = await fetch(`/api/ignored/${encodeURIComponent(slug)}`, { method: "POST" });
  if (!response.ok) {
    throw new Error(`Ignore failed with ${response.status}`);
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
  const types = [...new Set(items.map((item) => item.mediaType))].toSorted();

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

function getActiveItems(catalogs, state, ignoredSlugs) {
  const items = catalogs[state.catalogMode];
  if (state.catalogMode === "all" || state.showIgnored) {
    return items;
  }
  return items.filter((item) => !ignoredSlugs.has(item.slug));
}

function render(elements, catalogs, state, onDelete, onIgnore, onShowReleaseTeams) {
  const items = getActiveItems(catalogs, state, state.ignoredSlugs);
  const visibleItems = getVisibleItems(items, state);
  const totalPages = getTotalPages(visibleItems.length);
  state.page = clampPage(state.page, totalPages);

  const pageStart = (state.page - 1) * PAGE_SIZE;
  const pageItems = visibleItems.slice(pageStart, pageStart + PAGE_SIZE);
  const showReleaseButton = state.catalogMode === "all";

  elements.catalog.replaceChildren(
    ...pageItems.map((item) =>
      createCard(item, showReleaseButton, onDelete, onIgnore, onShowReleaseTeams),
    ),
  );
  elements.empty.hidden = visibleItems.length > 0;
  elements.stats.textContent = getStatsText(visibleItems.length);
  renderPagination(elements.pagination, state, totalPages, () => {
    render(elements, catalogs, state, onDelete, onIgnore, onShowReleaseTeams);
  });
}

function getTotalPages(totalItems) {
  return Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
}

function clampPage(page, totalPages) {
  return Math.min(Math.max(page, 1), totalPages);
}

function getStatsText(totalCount) {
  return `${totalCount} тайтлів`;
}

function renderPagination(container, state, totalPages, onPageChange) {
  container.replaceChildren();
  container.hidden = totalPages <= 1;

  if (totalPages <= 1) {
    return;
  }

  const controls = document.createElement("div");
  controls.className = "pagination__controls";
  controls.append(
    createNavButton("Назад", "chevron-left", "start", state.page - 1, state.page === 1, state, onPageChange),
    ...getPageItems(state.page, totalPages).map((page) =>
      page === "ellipsis"
        ? createPaginationEllipsis()
        : createPageButton(String(page), page, state, onPageChange),
    ),
    createNavButton("Далі", "chevron-right", "end", state.page + 1, state.page === totalPages, state, onPageChange),
  );

  container.append(controls);
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

function createPageButton(label, page, state, onPageChange) {
  const button = document.createElement("button");
  button.className = "pagination__button";
  button.type = "button";
  button.textContent = label;

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

function createNavButton(label, icon, iconPosition, page, disabled, state, onPageChange) {
  const button = document.createElement("button");
  button.className = "pagination__button pagination__button--nav";
  button.type = "button";
  button.disabled = disabled;
  button.setAttribute("aria-label", label);

  const iconHtml = iconMarkup(icon, 14);
  const labelHtml = `<span>${label}</span>`;
  button.innerHTML = iconPosition === "start" ? `${iconHtml}${labelHtml}` : `${labelHtml}${iconHtml}`;

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
    .toSorted((left, right) => compareItems(left, right, state.sort));
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

function createCard(item, showReleaseButton, onDelete, onIgnore, onShowReleaseTeams) {
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

  const actions = document.createElement("div");
  actions.className = "anime-card__actions";
  actions.append(
    createActionButton({
      className: "anime-card__ignore",
      icon: "ban",
      ariaLabel: `Ігнорувати ${getDisplayTitle(item)}`,
      onClick: () => onIgnore(item),
    }),
    createActionButton({
      className: "anime-card__delete",
      icon: "x",
      ariaLabel: `Видалити ${getDisplayTitle(item)}`,
      onClick: () => onDelete(item),
    }),
  );

  const posterExtras = [meta, actions];

  if (showReleaseButton) {
    const releaseButton = document.createElement("button");
    releaseButton.className = "anime-card__releases";
    releaseButton.type = "button";
    releaseButton.innerHTML = `${iconMarkup("users", 14)}<span>Релізів: ${item.releaseCount}</span>`;
    releaseButton.hidden = item.releaseCount === 0 || item.releaseTeams.length === 0;
    releaseButton.setAttribute("aria-label", `Показати команди релізу: ${item.releaseCount}`);
    releaseButton.addEventListener("click", () => onShowReleaseTeams(item));
    posterExtras.push(releaseButton);
  }

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

  posterWrap.append(poster, ...posterExtras);
  body.append(title, originalTitle);
  card.append(posterWrap, body, link);

  return card;
}

function createActionButton({ className, icon, ariaLabel, onClick }) {
  const button = document.createElement("button");
  button.className = `anime-card__action-btn ${className}`;
  button.type = "button";
  button.innerHTML = iconMarkup(icon, 16);
  button.setAttribute("aria-label", ariaLabel);
  button.addEventListener("click", onClick);
  return button;
}

function createReleaseTeam(team) {
  const entry = document.createElement("li");
  entry.className = "release-modal__team";

  if (team.logo) {
    const logo = document.createElement("img");
    logo.className = "release-modal__team-logo";
    logo.src = team.logo;
    logo.alt = "";
    entry.append(logo);
  }

  const name = document.createElement("span");
  name.textContent = team.name;
  entry.append(name);
  return entry;
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