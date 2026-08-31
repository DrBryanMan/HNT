import { loadCatalog } from "./modules/catalog-data.js";
import { createCatalogController } from "./modules/catalog-view.js";
import { renderIcon } from "./modules/icons.js";

const THEME_STORAGE_KEY = "hikka-filter-theme";

const elements = {
  catalog: document.querySelector("#catalog"),
  empty: document.querySelector("#empty"),
  feedback: document.querySelector("#feedback"),
  filters: document.querySelector("#filters"),
  pagination: document.querySelector("#pagination"),
  search: document.querySelector("#search"),
  showIgnored: document.querySelector("#show-ignored"),
  showAll: document.querySelector("#show-all"),
  stats: document.querySelector("#stats"),
  title: document.querySelector("#page-title"),
  typeFilter: document.querySelector("#type-filter"),
  sortOrder: document.querySelector("#sort-order"),
  releaseModal: document.querySelector("#release-modal"),
  releaseModalClose: document.querySelector("#release-modal-close"),
  releaseModalTeams: document.querySelector("#release-modal-teams"),
  themeToggle: document.querySelector("#theme-toggle"),
};

function initTheme() {
  const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  const prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
  applyTheme(storedTheme ?? (prefersLight ? "light" : "dark"));

  elements.themeToggle?.addEventListener("click", () => {
    const nextTheme = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    applyTheme(nextTheme);
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  });
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;

  if (!elements.themeToggle) {
    return;
  }

  renderIcon(elements.themeToggle, theme === "light" ? "moon" : "sun");
  elements.themeToggle.setAttribute(
    "aria-label",
    theme === "light" ? "Увімкнути темну тему" : "Увімкнути світлу тему",
  );
}

async function bootstrap() {
  renderIcon(document.querySelector("#search-icon"), "search", 16);

  try {
    const [filteredItems, allItems, ignoredSlugs] = await Promise.all([
      loadCatalog("./data/anime-filtered.json"),
      loadCatalog("./data/anime.json"),
      loadIgnoredSlugs("./data/anime-ignored.json"),
    ]);
    createCatalogController(elements, { all: allItems, filtered: filteredItems }, ignoredSlugs);
  } catch (error) {
    elements.empty.hidden = false;
    elements.empty.textContent = "Не вдалося завантажити каталог.";
    console.error(error);
  }
}

async function loadIgnoredSlugs(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Ignored catalog request failed with ${response.status}`);
  }
  const slugs = await response.json();
  return new Set(Array.isArray(slugs) ? slugs.filter((slug) => typeof slug === "string") : []);
}

initTheme();
bootstrap();