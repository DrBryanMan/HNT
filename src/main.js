import { loadCatalog } from "./modules/catalog-data.js";
import { createCatalogController } from "./modules/catalog-view.js";

const elements = {
  catalog: document.querySelector("#catalog"),
  empty: document.querySelector("#empty"),
  feedback: document.querySelector("#feedback"),
  filters: document.querySelector("#filters"),
  pagination: document.querySelector("#pagination"),
  search: document.querySelector("#search"),
  stats: document.querySelector("#stats"),
  typeFilter: document.querySelector("#type-filter"),
  sortOrder: document.querySelector("#sort-order"),
};

async function bootstrap() {
  try {
    const items = await loadCatalog("./data/anime.json");
    createCatalogController(elements, items);
  } catch (error) {
    elements.empty.hidden = false;
    elements.empty.textContent = "Не вдалося завантажити каталог.";
    console.error(error);
  }
}

bootstrap();
