const HIKKA_ANIME_URL = "https://hikka.io/anime/";

export async function loadCatalog(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Catalog request failed with ${response.status}`);
  }

  const items = await response.json();
  return items.map(normalizeItem).filter(Boolean);
}

function normalizeItem(item) {
  if (!item || !item.slug) {
    return null;
  }

  return {
    mediaType: item.media_type || "unknown",
    titleUa: item.title_ua || "",
    titleJa: item.title_ja || "",
    image: item.image || "",
    score: Number.isFinite(Number(item.score)) ? Number(item.score) : null,
    slug: item.slug,
    hikkaUrl: `${HIKKA_ANIME_URL}${item.slug}`,
  };
}
