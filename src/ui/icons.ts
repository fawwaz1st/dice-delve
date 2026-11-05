// Dice Delve — custom line-style icon set (64x64, stroke 3px, currentColor, rounded caps).
// Single-color outline set for cards & upgrades. Use icon(name) to get inline SVG string.
export const ICON_NAMES = [
  "flame", "shield", "wind", "clover", "eye",
  "spark", "wave", "magnet", "wall", "tomb",
  "heart", "sword", "coin", "dagger", "dice",
  "potion", "star", "crown", "gem", "key",
] as const;

export type IconName = (typeof ICON_NAMES)[number];

function S(inner: string): string {
  return '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + inner + '</svg>';
}

function P(d: string): string { return '<path d="' + d + '"/>'; }

const ICONS: Record<IconName, string> = {
  flame: S(P("M32 8c4 8 10 12 10 21a10 10 0 0 1-20 0c0-4 2-7 4-10 1 3 3 4 4 4-1-5 0-11 2-15Z") + P("M32 34c3 2 5 4 5 7a5 5 0 0 1-10 0c0-3 2-5 5-7Z")),
  shield: S(P("M32 8l18 6v16c0 13-8 21-18 26C22 51 14 43 14 30V14L32 8Z") + P("M32 17v30")),
  wind: S(P("M10 22h30a8 8 0 1 0-8-8") + P("M6 32h38a8 8 0 1 1-8 8") + P("M12 42h22")),
  clover: S(P("M32 30v26") + P("M32 24a8 8 0 1 0 0.01 0Z") + P("M24 24a8 8 0 1 0 0.01 0Z") + P("M40 24a8 8 0 1 0 0.01 0Z") + P("M32 16a8 8 0 1 0 0.01 0Z") + P("M32 30c-2 5-6 8-10 10")),
  eye: S(P("M8 32c7-10 15-15 24-15s17 5 24 15c-7 10-15 15-24 15S15 42 8 32Z") + '<circle cx="32" cy="32" r="8"/>' + '<circle cx="32" cy="32" r="2.5" fill="currentColor" stroke="none"/>'),
  spark: S(P("M32 10v14M32 40v14M10 32h14M40 32h14M17 17l8 8M39 39l8 8M47 17l-8 8M25 39l-8 8") + P("M32 25l2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5Z")),
  wave: S(P("M8 24c6-8 10-8 16 0s10 8 16 0 10-8 16 0") + P("M8 40c6-8 10-8 16 0s10 8 16 0 10-8 16 0")),
  magnet: S(P("M16 10v22a16 16 0 0 0 32 0V10") + P("M16 10h10v12H16zM38 10h10v12H38z") + P("M21 16v6M43 16v6")),
  wall: S('<rect x="10" y="12" width="44" height="40" rx="2"/>' + P("M10 25h44M10 38h44M24 12v13M40 25v13M24 38v14M40 12v13")),
  tomb: S(P("M32 8v32M20 20h24M14 40h36v14H14z") + P("M18 54h28") + P("M32 14l8 10-8 10")),
  heart: S(P("M32 52C20 42 12 34 12 24a10 10 0 0 1 20-4 10 10 0 0 1 20 4c0 10-8 18-20 28Z") + P("M32 36c2 1 3 2 3 4a3 3 0 0 1-6 0c0-2 1-3 3-4Z")),
  sword: S(P("M14 50L40 24M40 24L50 14a4 4 0 0 1 5 5L45 29l-5-5Z") + P("M36 28l-8 8M24 40l-6 6") + '<circle cx="18" cy="46" r="4"/>'),
  coin: S('<circle cx="28" cy="32" r="18"/>' + P("M28 21l3 6 6 1-4 4 1 7-6-3-6 3 1-7-4-4 6-1 3-6Z") + '<circle cx="46" cy="44" r="8"/>'),
  dagger: S(P("M32 8v26M26 34h12v6H26zM32 40v14M28 54h8")),
  dice: S('<rect x="12" y="12" width="40" height="40" rx="8"/>' + '<circle cx="22" cy="22" r="2.5" fill="currentColor" stroke="none"/>' + '<circle cx="42" cy="42" r="2.5" fill="currentColor" stroke="none"/>' + '<circle cx="32" cy="32" r="2.5" fill="currentColor" stroke="none"/>' + '<circle cx="42" cy="22" r="2.5" fill="currentColor" stroke="none"/>' + '<circle cx="22" cy="42" r="2.5" fill="currentColor" stroke="none"/>'),
  potion: S(P("M26 8h12M28 8v14a10 10 0 1 0 8 0V8") + P("M22 44h20") + '<circle cx="28" cy="48" r="2.5" fill="currentColor" stroke="none"/>' + '<circle cx="38" cy="52" r="2" fill="currentColor" stroke="none"/>'),
  star: S(P("M32 10l7 14 16 2-12 11 3 15-14-7-14 7 3-15L9 26l16-2 7-14Z")),
  crown: S(P("M12 46L8 20l12 8 12-16 12 16 12-8-4 26H12Z") + P("M12 54h40") + '<circle cx="32" cy="20" r="2.5" fill="currentColor" stroke="none"/>'),
  gem: S(P("M20 10h24l10 12-22 32L10 22l10-12Z") + P("M10 22h44M32 54L22 22M32 54l10-32")),
  key: S('<circle cx="20" cy="20" r="10"/>' + P("M27 27l22 22M42 40l8-8M48 46l6-6")),
};

const FALLBACK = S('<circle cx="32" cy="32" r="18" stroke-dasharray="6 8"/>');

export function icon(name: string): string {
  return (ICONS as Record<string, string>)[name] ?? FALLBACK;
}
