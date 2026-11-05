import { computed, inject, onMounted, onUnmounted, ref, type ComputedRef, type InjectionKey, type Ref } from 'vue'

export interface VisualStyle {
  id: string
  name: string
  description: string
  collectionTitle: string
  closingTitle: string
  version: number
  iconSet: 'paper' | 'pixel' | 'cinema' | 'grace'
  assets: { heroLight: string; heroDark: string; mobile: string; mobileDark?: string; coverLight: string; coverDark: string; closing: string; closingDark?: string; closingMobile?: string; closingMobileDark?: string; logo: string }
  icons?: Record<string, string>
  sectionArt?: Record<string, string>
  sectionPhotos?: Record<string, { src: string; night?: string }>
}

// A style is a coordinated asset set, not a light/dark theme. Add complete sets here.
export const visualStyles = {
  'paper-coast': {
    id: 'paper-coast', name: '剪纸', version: 1.1, iconSet: 'paper',
    description: '纸页、海风与留白', collectionTitle: '分册目录', closingTitle: '卷尾',
    assets: {
      logo: '/logo-paper-coast.svg',
      heroLight: '/images/home/hero-light.webp',
      heroDark: '/images/home/hero-dark.webp',
      mobile: '/images/home/gull-mobile.webp',
      coverLight: '/images/home/cover-light.webp',
      coverDark: '/images/home/cover-dark.webp',
      closing: '/images/home/closing/paper-tide-day.webp',
      closingDark: '/images/home/closing/paper-tide-night.webp',
      closingMobile: '/images/home/closing/paper-tide-day-small.webp',
      closingMobileDark: '/images/home/closing/paper-tide-night-small.webp',
    },
  },
  'pixel-voyage': {
    id: 'pixel-voyage', name: '像素', version: 1.3, iconSet: 'pixel',
    description: '像素、海岛与探索', collectionTitle: '栏目航线', closingTitle: '返航',
    assets: {
      logo: '/logo-pixel-voyage.svg',
      heroLight: '/images/pixel-voyage/mobile.png',
      heroDark: '/images/pixel-voyage/mobile.png',
      mobile: '/images/pixel-voyage/mobile.png',
      coverLight: '/images/pixel-voyage/mobile.png',
      coverDark: '/images/pixel-voyage/mobile.png',
      closing: '/images/pixel-voyage/closing/mountain-day.png',
      closingDark: '/images/pixel-voyage/closing/mountain-night.png',
    },
    icons: Object.fromEntries(Object.entries({ cs336: 'chip', 'rl-book': 'repeat', 'westlake-rl': 'book', papers: 'papers', research: 'magnifier', 'rust-notes': 'terminal', 'linux-notes': 'layers', videos: 'play', tags: 'tag' }).map(([section, icon]) => [section, `/images/pixel-voyage/icons/${icon}.png`])),
    sectionArt: Object.fromEntries(Object.entries({ cs336: 'learning', 'rl-book': 'learning', 'westlake-rl': 'learning', papers: 'reading', research: 'reading', tags: 'reading', 'rust-notes': 'systems', 'linux-notes': 'systems' }).map(([section, art]) => [section, `/images/pixel-voyage/${art}.png`])),
  },
  'along-the-way': {
    id: 'along-the-way', name: '灿烂人生', version: 1.1, iconSet: 'cinema',
    description: '窗光、远方与生活', collectionTitle: '镜头索引', closingTitle: '片尾',
    assets: {
      logo: '/logo-along-the-way.svg',
      heroLight: '/images/along-way/train-rest.webp',
      heroDark: '/images/along-way/night-window.webp',
      mobile: '/images/along-way/train-rest-small.webp',
      mobileDark: '/images/along-way/night-window-small.webp',
      coverLight: '/images/along-way/cover-light.webp',
      coverDark: '/images/along-way/cover-dark.webp',
      closing: '/images/along-way/country-road.webp',
      closingDark: '/images/along-way/night-window.webp',
      closingMobile: '/images/along-way/country-road-small.webp',
      closingMobileDark: '/images/along-way/night-window-small.webp',
    },
    sectionPhotos: {
      cs336: { src: '/images/along-way/study-small.webp' },
      'rl-book': { src: '/images/along-way/country-road-small.webp' },
      'westlake-rl': { src: '/images/along-way/fjord-small.webp' },
      papers: { src: '/images/along-way/room-day-small.webp', night: '/images/along-way/room-night-small.webp' },
      research: { src: '/images/along-way/night-window-small.webp' },
      'rust-notes': { src: '/images/along-way/train-detail-small.webp' },
      'linux-notes': { src: '/images/along-way/train-rest-small.webp' },
      tags: { src: '/images/along-way/fjord-small.webp' },
    },
  },
  'grace-archive': {
    id: 'grace-archive', name: '艾尔登法环', version: 1, iconSet: 'grace',
    description: '古卷、金枝与烛光', collectionTitle: '馆藏目录', closingTitle: '卷末印记',
    assets: {
      logo: '/logo-grace-archive.svg',
      heroLight: '/images/grace-archive/limgrave.webp',
      heroDark: '/images/grace-archive/night-sky.webp',
      mobile: '/images/grace-archive/limgrave-small.webp',
      mobileDark: '/images/grace-archive/night-sky-small.webp',
      coverLight: '/images/grace-archive/cover-light.webp',
      coverDark: '/images/grace-archive/cover-dark.webp',
      closing: '/images/grace-archive/closing/rest-day.webp',
      closingDark: '/images/grace-archive/closing/rest-night.webp',
      closingMobile: '/images/grace-archive/closing/rest-day-small.webp',
      closingMobileDark: '/images/grace-archive/closing/rest-night-small.webp',
    },
  },
} satisfies Record<string, VisualStyle>

export type VisualStyleId = keyof typeof visualStyles
export const defaultVisualStyle: VisualStyleId = 'paper-coast'
export const visualStyleStorageKey = 'seagull-visual-style'
export const heroMobileMedia = '(max-width: 639px)'
export function heroImageFor(style: VisualStyle, dark: boolean, mobile: boolean): string {
  const assets = style.assets
  if (mobile) return dark ? assets.mobileDark || assets.mobile : assets.mobile
  return dark ? assets.heroDark : assets.heroLight
}
export function closingImageFor(style: VisualStyle, dark: boolean, mobile = false): string {
  const { closing, closingDark, closingMobile, closingMobileDark } = style.assets
  if (mobile && closingMobile) return dark && closingMobileDark ? closingMobileDark : closingMobile
  return dark && closingDark ? closingDark : closing
}

// Runs before stylesheets and VitePress's own appearance script, so use the
// persisted preference (or the system scheme) rather than the initial DOM.
export function homeHeroPreload(base: string) {
  const paths = Object.fromEntries(Object.values(visualStyles).map(style => [
    style.id,
    [false, true].map(mobile => [false, true].map(dark =>
      base.replace(/\/$/, '') + heroImageFor(style, dark, mobile))),
  ]))
  return `(()=>{
    const paths=${JSON.stringify(paths)};
    let style, scheme;
    try {
      style=localStorage.getItem('${visualStyleStorageKey}');
      scheme=localStorage.getItem('vitepress-theme-appearance');
    } catch {}
    const sources=Object.hasOwn(paths,style)?paths[style]:paths['${defaultVisualStyle}'];
    const dark=!scheme||scheme==='auto'?matchMedia('(prefers-color-scheme: dark)').matches:scheme==='dark';
    const link=document.createElement('link');
    link.rel='preload';
    link.as='image';
    link.fetchPriority='high';
    link.href=sources[+matchMedia('${heroMobileMedia}').matches][+dark];
    document.head.appendChild(link);
  })()`
}
export function resolveVisualStyle(value: unknown): VisualStyleId {
  return typeof value === 'string' && Object.hasOwn(visualStyles, value) ? value as VisualStyleId : defaultVisualStyle
}
// Runs before page rendering; only a known ID may become an HTML attribute.
export const visualStyleBoot = `(()=>{let s='${defaultVisualStyle}';try{const v=localStorage.getItem('${visualStyleStorageKey}');if(${JSON.stringify(Object.keys(visualStyles))}.includes(v))s=v}catch{}document.documentElement.dataset.visualStyle=s})()`

export interface VisualStyleControls { selected: Ref<VisualStyleId>; select: (value: unknown) => void }
export const visualStyleControlsKey: InjectionKey<VisualStyleControls> = Symbol('visual-style-controls')
export function createVisualStyleControls(): VisualStyleControls {
  // State belongs to each layout instance; never shared between SSR requests.
  const selected = ref<VisualStyleId>(defaultVisualStyle)
  function apply(value: unknown) {
    selected.value = resolveVisualStyle(value)
    if (typeof document !== 'undefined') document.documentElement.dataset.visualStyle = selected.value
  }
  function select(value: unknown) {
    apply(value)
    try { localStorage.setItem(visualStyleStorageKey, selected.value) } catch { /* In-memory choice still works. */ }
  }
  function sync(event: StorageEvent) {
    if (event.key === visualStyleStorageKey || event.key === null) apply(event.newValue)
  }
  onMounted(() => {
    apply(document.documentElement.dataset.visualStyle)
    try { apply(localStorage.getItem(visualStyleStorageKey)) } catch { /* Storage may be disabled. */ }
    window.addEventListener('storage', sync)
  })
  onUnmounted(() => window.removeEventListener('storage', sync))
  return { selected, select }
}
export const visualStyleKey: InjectionKey<ComputedRef<VisualStyle>> = Symbol('visual-style')
export function useVisualStyle() {
  return inject(visualStyleKey, computed(() => visualStyles[defaultVisualStyle]))
}
