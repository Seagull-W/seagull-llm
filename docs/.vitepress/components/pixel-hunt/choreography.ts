import { themeImagePath } from '../../theme/visual-styles.ts'

// Positions are in the 512 × 160 mountain scene. Both actors pivot at their feet.
export const stage = { width: 512, height: 160, ground: 132 }
const home = 166
const den = 305
export const sheets = {
  hunter: {
    file: 'hunter.webp', columns: 4, rows: 3, width: 216, height: 156,
    pivotX: 84, pivotY: 148, scale: 0.49, home,
    poses: ['guard', 'dodge', 'rise', 'sheathe', 'draw', 'thrust', 'vault', 'fall', 'coil', 'cleave', 'cast'],
  },
  zinogre: {
    file: 'zinogre.webp', columns: 4, rows: 2, width: 464, height: 168,
    pivotX: 220, pivotY: 158, scale: 0.60, home: den,
    poses: ['guard', 'crouch', 'leap', 'howl', 'charged', 'turn', 'sweep'],
  },
} as const

export function huntSheetPath(sheet: { file: string }) {
  const url = themeImagePath('/images/pixel-voyage/closing/' + sheet.file)
  return import.meta.env?.DEV ? url + '?v=2' : url
}

export type Fighter = keyof typeof sheets
type Pose<F extends Fighter> = typeof sheets[F]['poses'][number]
type Key<P> = readonly [ms: number, pose: P, x: number, lift?: number]
type CueKind = 'cut' | 'draw' | 'spark' | 'tail' | 'thrust' | 'fall' | 'break' | 'charge' | 'bugs' | 'bolt' | 'finish' | 'dust'
export type Cue = readonly [start: number, duration: number, kind: CueKind, x: number, y: number]
export interface Move {
  name: string
  description: string
  duration: number
  still: number
  hunter: readonly Key<Pose<'hunter'>>[]
  zinogre: readonly Key<Pose<'zinogre'>>[]
  cues: readonly Cue[]
  // Time and contact point of a successful counter eligible for Harvest Moon echoes.
  counter?: readonly [ms: number, x: number, y: number]
}

export const moves = {
  foresight: {
    name: '见切', description: '猎人后撤避过雷爪，踏回一步，迎着前爪挥刀。', duration: 1570, still: 810,
    hunter: [[0,'guard',home], [260,'dodge',home], [500,'dodge',147], [645,'dodge',150],
      [735,'rise',192], [815,'rise',208], [1020,'fall',208], [1230,'guard',193], [1570,'guard',home]],
    zinogre: [[0,'guard',den], [215,'crouch',den], [415,'leap',294], [540,'leap',234,4],
      [760,'leap',232], [890,'crouch',251], [1190,'crouch',281], [1480,'guard',den]],
    cues: [[440,220,'bolt',222,113], [655,190,'dust',154,132], [720,275,'cut',211,127]],
    counter: [785,226,101],
  },
  iai: {
    name: '纳刀大居合', description: '猎人特殊纳刀，等尾甲扫到身前才拔刀穿过，身后留下一线斩痕。', duration: 2440, still: 1220,
    hunter: [[0,'guard',home], [170,'fall',169], [340,'sheathe',169], [920,'sheathe',169],
      [1030,'draw',183], [1140,'draw',252], [1320,'draw',255], [1510,'fall',255],
      [1770,'dodge',240], [2070,'dodge',199,4], [2350,'guard',home]],
    zinogre: [[0,'guard',den], [300,'turn',den], [820,'turn',297],
      [970,'sweep',293], [1100,'sweep',288], [1390,'sweep',300], [1610,'turn',308],
      [1910,'crouch',den], [2310,'guard',den]],
    cues: [[850,190,'spark',171,107], [950,290,'tail',288,119], [1020,230,'dust',170,132],
      [1050,370,'draw',217,108]],
    counter: [1130,223,109],
  },
  helm: {
    name: '登龙（气刃兜割）', description: '气刃突刺命中，猎人借力跃起，在雷狼龙肩上空纵斩，落地后七道斩痕依次显出。', duration: 3020, still: 1320,
    hunter: [[0,'guard',home], [220,'dodge',172], [345,'thrust',193], [500,'thrust',218],
      [630,'vault',229,9], [920,'vault',253,50], [1160,'vault',267,64], [1380,'vault',272,64],
      [1490,'fall',272,53], [1670,'fall',271,5], [1710,'fall',268], [2100,'fall',266],
      [2300,'dodge',248], [2570,'dodge',214,6], [2850,'guard',188], [3020,'guard',home]],
    zinogre: [[0,'guard',den], [280,'crouch',299], [520,'crouch',300], [980,'howl',den],
      [1530,'guard',den], [1710,'crouch',312], [1950,'crouch',315], [2180,'crouch',312],
      [2480,'guard',310], [3020,'guard',den]],
    cues: [[380,230,'thrust',245,112], [560,230,'dust',220,132], [1420,370,'fall',272,68],
      [1650,240,'dust',268,132], [1770,620,'break',283,95]],
  },
  sacred: {
    name: '神威居合', description: '猎人缓缓纳刀，三次蓄力后连斩三刀。对面的雷狼龙聚集雷光虫，白鬃竖起，进入超带电状态。', duration: 3830, still: 2550,
    hunter: [[0,'guard',home], [240,'fall',171], [510,'sheathe',174], [860,'coil',174],
      [1680,'coil',175], [1860,'rise',202], [2010,'rise',220], [2130,'fall',233],
      [2270,'fall',237], [2390,'cleave',251], [2560,'cleave',266], [2810,'cleave',266],
      [3000,'fall',260], [3280,'dodge',231,4], [3530,'dodge',202], [3830,'guard',home]],
    zinogre: [[0,'guard',den], [270,'crouch',den], [710,'howl',den], [1510,'charged',den],
      [1890,'charged',294], [2100,'charged',300], [2290,'charged',307], [2530,'crouch',318],
      [2850,'crouch',320], [3280,'charged',311], [3830,'charged',den]],
    cues: [[390,1160,'bugs',289,83], [665,1050,'charge',174,109], [1760,330,'cut',221,127],
      [2075,300,'fall',256,83], [2370,440,'finish',270,111], [2420,260,'dust',248,132]],
  },
  moon: {
    name: '圆月', description: '翔虫牵出圆形铁虫丝。雷狼龙扑进圈内，猎人见切反击，丝线在命中处追加斩击。', duration: 3140, still: 2100,
    hunter: [[0,'guard',home], [180,'cast',173], [700,'cast',177], [960,'guard',179],
      [1420,'guard',182], [1520,'dodge',166], [1720,'dodge',160], [1840,'rise',197],
      [1960,'rise',216], [2230,'rise',219], [2390,'fall',218], [2650,'dodge',202], [3140,'guard',home]],
    zinogre: [[0,'guard',den], [940,'guard',den], [1260,'crouch',293], [1470,'leap',281],
      [1650,'leap',237,5], [1860,'leap',237], [1990,'crouch',254], [2290,'crouch',264],
      [2630,'guard',286], [3140,'guard',den]],
    cues: [[1510,260,'bolt',231,113], [1780,220,'dust',160,132], [1840,280,'cut',224,126]],
    counter: [1950,241,103],
  },
} as const satisfies Record<string, Move>

export type MoveId = keyof typeof moves
export const moveIds = Object.keys(moves) as MoveId[]
export const moonCast = 280
export const moonDuration = 12000
export const chargeComplete = 1510

// The cel changes on the beat. Only travel between the two foot positions is interpolated.
export function poseAt<P extends string>(keys: readonly Key<P>[], time: number) {
  const next = keys.findIndex(key => key[0] > time)
  const from = keys[next < 0 ? keys.length - 1 : Math.max(0, next - 1)]
  const to = keys[next < 0 ? keys.length - 1 : next]
  const fraction = to[0] === from[0] ? 0 : (time - from[0]) / (to[0] - from[0])
  const t = fraction * fraction * (3 - 2 * fraction)
  return { pose: from[1], x: from[2] + (to[2] - from[2]) * t, lift: (from[3] ?? 0) + ((to[3] ?? 0) - (from[3] ?? 0)) * t }
}
