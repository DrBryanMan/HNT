const HIKKA_ANIME_URL = "https://hikka.io/anime/";

export async function loadCatalog(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Catalog request failed with ${response.status}`);
  }

  const items = await response.json();
  return items.map(normalizeItem).filter(Boolean);
}

export function normalizeGenres(genres) {
  if (!Array.isArray(genres)) {
    return [];
  }

  return genres
    .filter((genre) => genre && genre.name_ua)
    .map((genre) => ({
      nameUa: genre.name_ua,
      nameEn: genre.name_en || "",
      type: genre.type || "genre",
    }));
}

function normalizeItem(item) {
  if (!item || !item.slug) {
    return null;
  }

  return {
    mediaType: item.media_type || "unknown",
    titleUa: item.title_ua || "",
    titleEn: item.title_en || "",
    titleJa: item.title_ja || "",
    image: item.image || "",
    releaseCount: Number.isInteger(Number(item.release_count)) ? Number(item.release_count) : 0,
    releaseTeams: Array.isArray(item.release_teams)
      ? item.release_teams.filter((team) => team && team.name)
      : [],
    score: Number.isFinite(Number(item.score)) ? Number(item.score) : null,
    year: Number.isInteger(Number(item.year)) ? Number(item.year) : null,
    genres: normalizeGenres(item.genres),
    slug: item.slug,
    hikkaUrl: `${HIKKA_ANIME_URL}${item.slug}`,
  };
}