/**
 * Sober category palette. Each swatch has a soft background, a solid "ink"
 * for text/icons and a chart color. Keys are stored on categories.
 */
export const PALETTE = {
  clay: { label: "Clay", bg: "#F6E4DC", ink: "#9A4B33", chart: "#D97757" },
  sage: { label: "Sage", bg: "#E1EBE3", ink: "#3F6A4F", chart: "#6B9080" },
  ochre: { label: "Ochre", bg: "#F5EBD2", ink: "#8A6414", chart: "#D1A24A" },
  slate: { label: "Slate", bg: "#E2E6EC", ink: "#3D4A5C", chart: "#6C7A8F" },
  plum: { label: "Plum", bg: "#ECE2EC", ink: "#6B3F6B", chart: "#9A6B9A" },
  moss: { label: "Moss", bg: "#E6EAD7", ink: "#55602A", chart: "#8A9A4E" },
  sky: { label: "Sky", bg: "#DEEAF0", ink: "#2F5A6E", chart: "#5B8FA8" },
  rose: { label: "Rose", bg: "#F3E1E3", ink: "#8E3B45", chart: "#C4616C" },
  sand: { label: "Sand", bg: "#EFE6D8", ink: "#7A5A33", chart: "#B9926A" },
  stone: { label: "Stone", bg: "#E8E6DC", ink: "#5B5A54", chart: "#9C9A91" },
  teal: { label: "Teal", bg: "#DCEBE8", ink: "#2F6359", chart: "#4F968A" },
  ink: { label: "Ink", bg: "#DEDEE2", ink: "#2B2B33", chart: "#4A4A55" },
} as const;

export type PaletteKey = keyof typeof PALETTE;
export const PALETTE_KEYS = Object.keys(PALETTE) as PaletteKey[];

export function swatch(key: string | null | undefined) {
  return PALETTE[key && key in PALETTE ? (key as PaletteKey) : "stone"];
}

/** Colors used for the two sides of the ledger everywhere in the UI. */
export const KIND_COLORS = {
  debit: { chart: "#6B9080", ink: "#3F6A4F", bg: "#E1EBE3" },
  credit: { chart: "#D97757", ink: "#9A4B33", bg: "#F6E4DC" },
} as const;
