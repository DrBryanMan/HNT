import { loadCatalog } from "./modules/catalog-data.js";
import { createCatalogController } from "./modules/catalog-view.js";

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
};

async function bootstrap() {
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

bootstrap();
