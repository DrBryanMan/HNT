const MEDIA_TYPE_LABELS = {
  movie: "Фільм",
  music: "Кліп",
  ona: "ONA",
  ova: "OVA",
  special: "Спешл",
  tv: "TV",
  unknown: "Невідомо",
};

export function getDisplayTitle(item) {
  return item.titleUa || item.titleJa || item.slug;
}

export function formatMediaType(mediaType) {
  return MEDIA_TYPE_LABELS[mediaType] || mediaType.toUpperCase();
}

export function formatScore(score) {
  return score === null ? "Без рейтингу" : score.toFixed(2);
}
