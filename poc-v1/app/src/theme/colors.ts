/**
 * Identidade visual oficial do SellAI — extraída do site institucional
 * (enter_Site Insti/src/index.css). Mesmos valores hex documentados lá.
 */
export const colors = {
  navy: '#031332',
  electric: '#087CFF',
  violet: '#7338F5',
  magenta: '#D93BEA',
  live: '#FF426B',
  cyan: '#08AEF5',
  soft: '#F7F9FC',

  white: '#FFFFFF',
  border: '#E1E7F0',
  muted: '#64748B',

  // Mapeados do index.css: --destructive = --live
  destructive: '#FF426B',
} as const;

/** Gradiente de marca completo — cyan → electric → violet → magenta → live. */
export const gradientSellai = [
  colors.cyan,
  colors.electric,
  colors.violet,
  colors.magenta,
  colors.live,
] as const;

/** Gradiente "live" (violet → magenta → live) — usado em botões/selos. */
export const gradientLive = [colors.violet, colors.magenta, colors.live] as const;
