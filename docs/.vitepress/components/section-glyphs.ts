// Small, semantic paper-cut glyphs. Labels remain real text outside the SVG.
export const sectionGlyphs = {
  cs336: { paper: 'M10 7h28v33H10Z', ink: 'M15 13h18v19H15ZM21 13v19m6-19v19M15 19h18m-18 6h18M18 37h12' },
  'rl-book': { paper: 'M7 24a17 17 0 1 1 34 0 17 17 0 0 1-34 0', ink: 'M12 20a13 13 0 0 1 23-4m0-6v7h-7M36 28a13 13 0 0 1-23 4m0 6v-7h7M20 24h8m-3-3 3 3-3 3' },
  'westlake-rl': { paper: 'M6 12q9-4 18 1 9-5 18-1v27q-9-4-18 1-9-5-18-1Z', ink: 'M24 13v27M11 19h7m-7 6h7m12-6h6m-6 7 3-3 4 6M8 43q8-3 16 0 8-3 16 0' },
  papers: { paper: 'M12 5h20l7 8v26H12Z', ink: 'M32 5v9h7M18 21h15m-15 6h15m-15 6h9M7 14v30h25' },
  research: { paper: 'M8 6h27v31H8Z', ink: 'M14 13h15m-15 6h9M29 23a9 9 0 1 0 0 18 9 9 0 0 0 0-18m7 16 7 6M15 27h3' },
  'rust-notes': { paper: 'M7 8h34v32H7Z', ink: 'M7 17h34M12 12h1m4 0h1m4 0h1M17 23l-5 5 5 5m14-10 5 5-5 5m-5-11-4 13' },
  'linux-notes': { paper: 'm7 15 17-9 17 9v21l-17 9-17-9Z', ink: 'm7 15 17 9 17-9M24 24v21M15 11l18 9v10M12 29l7 4' },
  videos: { paper: 'M6 10h36v29H6Z', ink: 'm20 18 12 7-12 7ZM11 6h26M14 43h20' },
  tags: { paper: 'M6 12h18l18 18-15 14L6 23Z', ink: 'M14 16a3 3 0 1 0 0 6 3 3 0 0 0 0-6M29 6l15 15' },
} as const
export type SectionGlyph = keyof typeof sectionGlyphs
