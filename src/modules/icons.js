const ICON_PATHS = Object.freeze({
  sun: `<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>`,
  moon: `<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>`,
  x: `<path d="M18 6 6 18"/><path d="m6 6 12 12"/>`,
  ban: `<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>`,
  "chevron-left": `<path d="m15 18-6-6 6-6"/>`,
  "chevron-right": `<path d="m9 18 6-6-6-6"/>`,
  search: `<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>`,
  users: `<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>`,
});

export function iconMarkup(name, size = 18) {
  const path = ICON_PATHS[name];
  if (!path) {
    throw new Error(`Unknown icon: ${name}`);
  }

  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${path}</svg>`;
}

export function renderIcon(target, name, size = 18) {
  if (!target) {
    return;
  }
  target.innerHTML = iconMarkup(name, size);
}