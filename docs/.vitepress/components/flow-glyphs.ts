// Hand-drawn mechanism sketches; labels in the article carry the accessible meaning.
export const flowGlyphs = {
  dialogue: [
    { d: 'M6 4h100v22H18L6 32Z', soft: true },
    { d: 'M18 12h40m-40 7h65M32 36h110v22H44l-12 5ZM44 44h45m-45 7h76' },
  ],
  tokens: [
    { d: 'M5 8h137M5 56h137M5 23h28v18H5Zm35 0h28v18H40Zm35 0h28v18H75Zm35 0h28v18h-28ZM13 32h12m23 0h12m23 0h12m23 0h12' },
  ],
  mask: [
    { d: 'M4 23h22v19H4Zm29 0h22v19H33Z', soft: true },
    { d: 'M62 23h22v19H62Zm29 0h22v19H91Zm29 0h22v19h-22Zm-52 9 4 4 7-8m18 4 4 4 7-8m18 4 4 4 7-8M62 49h80' },
  ],
  document: [
    { d: 'M15 5h69l15 15v38H15Z', soft: true },
    { d: 'M84 5v15h15M29 27h54M29 37h54M29 47h32M106 15h17v45' },
  ],
  branch: [{ d: 'M8 32h29m0 0 34-21m-34 21h34m-34 0 34 21M71 5h35v12H71Zm0 21h35v12H71Zm0 21h35v12H71Z' }],
  chart: [{ d: 'M12 7v48h122M23 44l24-14 24 5 25-22 26-6M90 13h12v12' }],
  monitor: [
    { d: 'M12 6h118v40H12Z', soft: true },
    { d: 'M51 58h40M71 46v12M24 29h19l10-12 15 22 11-16h35' },
  ],
  check: [{ d: 'M15 8h96v48H15ZM28 23l5 5 10-12m10 7h42M28 44l5 5 10-12m10 7h42' }],
  filter: [{ d: 'M10 7h125L87 35v21H61V35ZM32 17h16m15 0h16m15 0h16' }],
  network: [{ d: 'M29 17 74 10l45 22-45 22-45-37m0 0v29l45 8M74 10v44M20 8h18v18H20Zm45-7h18v18H65Zm45 22h18v18h-18ZM65 45h18v18H65ZM20 37h18v18H20Z' }],
  chip: [{ d: 'M46 10h52v44H46Zm11 10h30v24H57ZM54 2v8m18-8v8m18-8v8M54 54v8m18-8v8m18-8v8M36 18h10m-10 14h10m-10 14h10m52-28h10m-10 14h10m-10 14h10' }],
  container: [{ d: 'm28 16 44-14 44 14v32L72 62 28 48Zm0 0 44 16 44-16M72 32v30M50 9l44 15' }],
  clock: [{ d: 'M52 3h38M71 3v8M71 12a24 24 0 1 0 0 48 24 24 0 0 0 0-48Zm0 8v16l14 9' }],
  compare: [{ d: 'M12 55h125M26 12h20v43H26Zm30 15h20v28H56Zm30-9h20v37H86Zm30 20h14v17h-14Z' }],
  checkpoint: [{ d: 'M28 5h84v54H28Zm14 0v19h56V5M43 39h54v20M50 13h38M53 48h34' }],
  loop: [{ d: 'M32 20a43 24 0 0 1 78 0m-13-3 13 3 3-13M110 44a43 24 0 0 1-78 0m13 3-13-3-3 13M51 32h40' }],
  score: [{ d: 'M18 15h36v34H18Zm20 9v16m-8-8h16M69 26h49M69 37h49M129 18v28' }],
  advantage: [{ d: 'M12 52h126M20 31h112M37 31V10h21v21m26 0v13h21V31M29 10h37M76 44h37' }],
  gradient: [{ d: 'M17 8v47h119M29 14c24 0 27 34 48 34s28-23 48-23M47 17l20 20m-13-1 13 1-1-13' }],
  trajectories: [{ d: 'M10 32h18l25-22h27l25 16h30M28 32l25 1h27l25 12h30M28 32l25 22h27l25 5h30' }],
  target: [{ d: 'M71 8a24 24 0 1 0 0 48 24 24 0 0 0 0-48Zm0 12a12 12 0 1 0 0 24 12 12 0 0 0 0-24ZM71 32l47-25m-16-2 16 2-7 12' }],
  distance: [{ d: 'M13 42h25l24-22h28l23 22h24M13 37v10m25-10v10m24-32v10m28-10v10m23 12v10m24-10v10M62 8h28m-24-4-4 4 4 4m20-8 4 4-4 4' }],
  code: [{ d: 'M12 7h124v50H12ZM12 18h124M42 28l-12 9 12 9m61-18 12 9-12 9M82 25l-13 24' }],
  archive: [{ d: 'M19 7h105v12H19Zm6 12v39h93V19M56 31h32M47 45h50' }],
  table: [{ d: 'M15 7h115v50H15ZM15 23h115M15 40h115M51 7v50M92 7v50' }],
  pair: [
    { d: 'M9 10h55v42H9Z', soft: true },
    { d: 'M82 10h55v42H82ZM21 29l8 8 18-18m49 4 28 17m0-17-28 17' },
  ],
  sigmoid: [{ d: 'M12 53h124M23 58V6M31 46c49 0 32-30 81-30M72 10v44' }],
  state: [{ d: 'M11 19h31v27H11ZM55 8h31v49H55Zm44 14h31v21H99ZM20 32h13m31-10h13m-13 10h13m-13 10h13m31-10h13' }],
  noise: [{ d: 'M12 49h124M24 27l11 10 11-21 12 16 12-8 12 19 12-25 13 16 13-9M26 54v4m30-4v4m30-4v4m30-4v4' }],
  converge: [{ d: 'M12 8v47h124M23 17l18 29 18-18 18 13 18-8 18 5 18-2M22 36h112' }],
  lock: [{ d: 'M48 27V17a22 15 0 0 1 44 0v10M36 27h69v32H36ZM71 38v11' }],
  channel: [{ d: 'M8 12h35v40H8Zm96 0h35v40h-35ZM49 25h49m-8-6 8 6-8 6M98 42H49m8-6-8 6 8 6' }],
} satisfies Record<string, { d: string; soft?: boolean }[]>

export type FlowGlyph = keyof typeof flowGlyphs
