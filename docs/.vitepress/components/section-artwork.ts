// Original, code-native paper studies and their grid-drawn counterparts.
// These are decorative compositions, not diagrams of the underlying subjects.
type Tone = 'paper' | 'shade' | 'ink' | 'light' | 'accent' | 'line' | 'ground'
interface Layer { tone: Tone; d: string }
interface Study { paper: Layer[]; pixel: Layer[] }

export const sectionArtwork: Record<string, Study> = {
  cs336: {
    // An accordion of matrix-like planes: building a model, fold by fold.
    paper: [
      { tone: 'ground', d: 'M10 75 66 79 110 65 53 62Z' },
      { tone: 'shade', d: 'M19 26 41 17 41 64 19 72Z' },
      { tone: 'paper', d: 'M41 17 63 29 63 75 41 64Z' },
      { tone: 'ink', d: 'M63 29 85 17 85 63 63 75Z' },
      { tone: 'light', d: 'M85 17 106 28 106 73 85 63Z' },
      { tone: 'line', d: 'm24 36 12-5m-12 16 12-5m-12 16 12-5M47 31l10 5m-10 7 10 5m-10 7 10 5M90 31l10 5m-10 7 10 5m-10 7 10 5' },
      { tone: 'accent', d: 'm65 11 7-4 7 4-7 4Z' },
    ],
    pixel: [
      { tone: 'ground', d: 'M4 37h7v-2h37v-2h8v4h-8v3H13v-1H4Z' },
      { tone: 'shade', d: 'M9 15h4v-3h12v3h4v20H9Z' },
      { tone: 'paper', d: 'M12 17h14v15H12Z' },
      { tone: 'shade', d: 'M25 19h4v-3h13v3h4v18H25Z' },
      { tone: 'light', d: 'M28 20h15v14H28Z' },
      { tone: 'accent', d: 'M37 9h12v3h4v18h-7V16h-9ZM15 21h3v3h-3Zm6 0h3v3h-3Zm-6 6h3v3h-3Zm6 0h3v3h-3Z' },
      { tone: 'ink', d: 'M31 23h3v3h-3Zm6 0h3v3h-3Zm-6 6h3v3h-3Zm6 0h3v3h-3Z' },
    ],
  },
  'rl-book': {
    // A folded, continuous ribbon, with one small point of progress.
    paper: [
      { tone: 'ground', d: 'M24 74 58 80 99 67 65 65Z' },
      { tone: 'paper', d: 'M23 35 43 13 83 18 69 32 47 29 36 42Z' },
      { tone: 'light', d: 'M43 13 83 18 69 32 47 29Z' },
      { tone: 'ink', d: 'M83 18 102 50 81 74 73 56 85 44 69 32Z' },
      { tone: 'shade', d: 'M81 74 42 72 23 35 36 42 49 55 73 56Z' },
      { tone: 'paper', d: 'M42 72 23 35 36 42 49 55Z' },
      { tone: 'line', d: 'm43 13 4 16m36-11 2 26M42 72l7-17' },
      { tone: 'accent', d: 'm93 22 7 4-2 8-8-1-2-7Z' },
    ],
    pixel: [
      { tone: 'ground', d: 'M12 37h7v-2h29v2h4v2H39v2H19v-2h-7Z' },
      { tone: 'paper', d: 'M15 16h5v-5h22v4H25v4h-5v10h-5Z' },
      { tone: 'light', d: 'M20 11h22v4H25v4h-5Z' },
      { tone: 'shade', d: 'M42 15h5v5h4v9h-5v5h-5v4H23v-5h17v-4h5V20h-3Z' },
      { tone: 'shade', d: 'M15 29h5v4h20v5H23v-4h-8Z' },
      { tone: 'accent', d: 'M45 8h5v5h-5Z' },
    ],
  },
  'westlake-rl': {
    // A book becomes a sail; the lake is just two cut-paper ripples.
    paper: [
      { tone: 'ground', d: 'M8 68Q34 57 59 65T112 63L102 74Q76 80 53 73T8 77Z' },
      { tone: 'paper', d: 'M24 56 57 60 94 51 79 72 44 74Z' },
      { tone: 'shade', d: 'M24 56 57 60 44 74Z' },
      { tone: 'ink', d: 'M57 60 94 51 79 72 44 74Z' },
      { tone: 'light', d: 'M59 10 61 57 32 49Z' },
      { tone: 'paper', d: 'M64 23 88 49 63 55Z' },
      { tone: 'line', d: 'm59 10 2 47m-29-8 27-39M14 82h25m44-3h20' },
      { tone: 'accent', d: 'M68 13 82 18 68 21Z' },
    ],
    pixel: [
      { tone: 'ground', d: 'M5 34h12v-2h28v-2h10v5h-7v3H18v-1H5Z' },
      { tone: 'light', d: 'M28 6h2v22H13v-3h3v-4h3v-4h3v-4h3v-4h3Z' },
      { tone: 'paper', d: 'M32 14h3v3h3v3h3v3h3v3H32Z' },
      { tone: 'accent', d: 'M12 29h35v3h-3v3h-4v3H21v-3h-5v-3h-4Z' },
      { tone: 'shade', d: 'M12 29h18v3H16v-1h-4Z' },
      { tone: 'accent', d: 'M33 7h9v3h-9Z' },
      { tone: 'paper', d: 'M4 41h13v1H4Zm41-2h10v1H45Z' },
    ],
  },
  papers: {
    // Loose folios, caught in an updraft.
    paper: [
      { tone: 'ground', d: 'M13 74 61 80 105 64 63 66Z' },
      { tone: 'shade', d: 'M20 43 55 28 73 67 38 79Z' },
      { tone: 'paper', d: 'M38 23 74 22 77 69 41 69Z' },
      { tone: 'light', d: 'M59 12 96 24 83 65 49 53Z' },
      { tone: 'paper', d: 'M59 12 63 29 49 53Z' },
      { tone: 'line', d: 'm70 29 15 5m-18 3 15 5m-18 3 10 3M27 49l9-4m-6 12 7-3' },
      { tone: 'accent', d: 'M88 23 94 25 90 38 88 34 84 36Z' },
      { tone: 'line', d: 'M92 63q13-3 14-14' },
    ],
    pixel: [
      { tone: 'ground', d: 'M7 37h9v-2h33v3h-7v3H17v-1H7Z' },
      { tone: 'shade', d: 'M10 18h20v20H10Z' },
      { tone: 'paper', d: 'M18 12h21v23H18Z' },
      { tone: 'light', d: 'M28 6h17v4h4v21H28Z' },
      { tone: 'paper', d: 'M45 6v4h4V8h-2V6Z' },
      { tone: 'ink', d: 'M33 15h11v2H33Zm0 6h8v2h-8ZM13 24h3v2h-3Zm0 6h3v2h-3Z' },
      { tone: 'accent', d: 'M38 6h4v6h-2v2h-2Z' },
      { tone: 'shade', d: 'M51 27h3v6h-3v3h-4v-2h4Z' },
    ],
  },
  research: {
    // An angular paper telescope, following a distant scrap of light.
    paper: [
      { tone: 'ground', d: 'M15 76 48 81 92 72 65 69Z' },
      { tone: 'shade', d: 'M56 46 67 48 88 75 80 75 60 55 38 77 31 77Z' },
      { tone: 'paper', d: 'M24 35 76 16 85 39 36 57Z' },
      { tone: 'light', d: 'M24 35 76 16 80 27 30 45Z' },
      { tone: 'ink', d: 'm76 16 10 1 9 24-10-2Z' },
      { tone: 'shade', d: 'm24 35 12 22-10 3-9-22Z' },
      { tone: 'line', d: 'm58 22 9 24M60 55l2 21' },
      { tone: 'accent', d: 'm100 9 5 5-5 5-5-5Z' },
    ],
    pixel: [
      { tone: 'ground', d: 'M9 38h7v-2h26v2h6v2H32v2H15v-2H9Z' },
      { tone: 'shade', d: 'M28 23h4v5h3v4h4v5h4v2h-7v-5h-4v-5h-4v5h-4v5h-7v-2h4v-5h4v-4h3Z' },
      { tone: 'paper', d: 'M13 17h7v-3h8v-3h8V8h5v5h3v6h-8v3h-8v3h-8v3h-4v-5h-3Z' },
      { tone: 'light', d: 'M13 17h7v-3h8v-3h8V8h5v5h-5v3h-8v3h-8v3h-7Z' },
      { tone: 'accent', d: 'M39 7h4v5h3v8h-4v-5h-3ZM10 19h4v8h-4Z' },
      { tone: 'accent', d: 'M50 4h3v3h-3Z' },
    ],
  },
  'rust-notes': {
    // Ferris, reduced to interlocking folded planes rather than a mascot sticker.
    paper: [
      { tone: 'ground', d: 'M17 72 61 77 108 68 59 65Z' },
      { tone: 'shade', d: 'm31 51-18 9 8 15 2-13 20-6m46-5 18 9-8 15-2-13-20-6M39 62l-9 16 16-12m35-4 9 16-16-12' },
      { tone: 'ink', d: 'M31 40 44 29 77 29 91 40 80 63 42 63Z' },
      { tone: 'paper', d: 'M31 40 60 45 42 63Zm60 0-31 5 20 18Z' },
      { tone: 'light', d: 'm44 29 16 16 17-16Z' },
      { tone: 'accent', d: 'M31 43 18 35 12 14 25 23 30 12 36 29Zm58 0 13-8 6-21-13 9-5-11-6 17Z' },
      { tone: 'line', d: 'm18 35 18-6m66 6-18-6M60 45v12' },
    ],
    pixel: [
      { tone: 'ground', d: 'M7 37h8v-2h29v2h9v2H40v2H19v-2H7Z' },
      { tone: 'shade', d: 'M13 26h7v3h-7v4H8v4H5v-7h8Zm27 0h7v4h8v7h-3v-4h-5v-4h-7ZM22 32h4v5h-4v4h-4v-5h4Zm12 0h4v4h4v5h-4v-4h-4Z' },
      { tone: 'shade', d: 'M19 17h22v3h5v10h-5v4H19v-4h-5V20h5Z' },
      { tone: 'paper', d: 'M19 20h22v10H19Z' },
      { tone: 'light', d: 'M23 20h14v3H23Z' },
      { tone: 'accent', d: 'M5 6h4v5h4V6h4v13h-4v5H9v-5H5Zm38 0h4v5h4V6h4v13h-4v5h-4v-5h-4Z' },
    ],
  },
  'linux-notes': {
    // An origami penguin: Tux's silhouette without a literal logo or badge.
    paper: [
      { tone: 'ground', d: 'M28 77 58 81 91 74 64 70Z' },
      { tone: 'ink', d: 'M52 12 70 13 80 29 78 43 93 63 77 59 73 75 45 75 40 58 25 63 41 39 43 25Z' },
      { tone: 'shade', d: 'M52 12 57 33 41 39 43 25Zm18 1 10 16-13 6Z' },
      { tone: 'light', d: 'M57 33 67 35 76 58 65 71 48 60Z' },
      { tone: 'paper', d: 'm57 33 8 38-17-11Z' },
      { tone: 'accent', d: 'm64 29 15 5-13 5ZM45 72l13 3-18 4Zm19 3 9-3 9 7Z' },
      { tone: 'line', d: 'm41 39 7 21m30-17-2 15' },
    ],
    pixel: [
      { tone: 'ground', d: 'M12 38h8v-2h20v2h7v2H34v2H21v-2h-9Z' },
      { tone: 'shade', d: 'M25 5h10v3h4v10h-2v5h4v5h4v5h-7v4H22v-4h-7v-5h4v-5h3V11h3Z' },
      { tone: 'paper', d: 'M25 8h5v7h-3v5h-5V11h3Z' },
      { tone: 'light', d: 'M29 18h5v5h3v10H25V23h4Z' },
      { tone: 'paper', d: 'M25 25h4v8h-4Z' },
      { tone: 'accent', d: 'M34 14h8v3h-8ZM21 37h8v3H18v-2h3Zm12 0h7v1h3v2H33Z' },
    ],
  },
}
