import { computed, inject, onMounted, onUnmounted, ref, type ComputedRef, type InjectionKey, type Ref } from 'vue'

export interface VisualStyle {
  id: string
  name: string
  version: number
  iconSet: 'paper' | 'pixel' | 'cinema'
  assets: { heroLight: string; heroDark: string; mobile: string; mobileDark?: string; closing: string; closingDark?: string; logo: string }
  icons?: Record<string, string>
  sectionArt?: Record<string, string>
  sectionPhotos?: Record<string, { src: string; night?: string }>
}

// A style is a coordinated asset set, not a light/dark theme. Add complete sets here.
export const visualStyles = {
  'paper-coast': {
    id: 'paper-coast', name: '纸海', version: 1.1, iconSet: 'paper',
    assets: {
      logo: '/logo-paper-coast.svg',
      heroLight: '/images/home/hero-light.webp',
      heroDark: '/images/home/hero-dark.webp',
      mobile: '/images/home/gull-mobile.webp',
      closing: '/images/home/closing.webp',
    },
  },
  'pixel-voyage': {
    id: 'pixel-voyage', name: '像素航海', version: 1.3, iconSet: 'pixel',
    assets: {
      logo: '/logo-pixel-voyage.svg',
      heroLight: '/images/pixel-voyage/mobile.png',
      heroDark: '/images/pixel-voyage/mobile.png',
      mobile: '/images/pixel-voyage/mobile.png',
      closing: '/images/pixel-voyage/footer.png',
    },
    icons: Object.fromEntries(Object.entries({ cs336: 'chip', 'rl-book': 'repeat', 'westlake-rl': 'book', papers: 'papers', research: 'magnifier', 'rust-notes': 'terminal', 'linux-notes': 'layers', videos: 'play', tags: 'tag' }).map(([section, icon]) => [section, `/images/pixel-voyage/icons/${icon}.png`])),
    sectionArt: Object.fromEntries(Object.entries({ cs336: 'learning', 'rl-book': 'learning', 'westlake-rl': 'learning', papers: 'reading', research: 'reading', tags: 'reading', 'rust-notes': 'systems', 'linux-notes': 'systems' }).map(([section, art]) => [section, `/images/pixel-voyage/${art}.png`])),
  },
  'along-the-way': {
    id: 'along-the-way', name: '沿途', version: 1.1, iconSet: 'cinema',
    assets: {
      logo: '/logo-along-the-way.svg',
      heroLight: '/images/along-way/train-rest.webp',
      heroDark: '/images/along-way/night-window.webp',
      mobile: '/images/along-way/train-rest-small.webp',
      mobileDark: '/images/along-way/night-window-small.webp',
      closing: '/images/along-way/country-road.webp',
      closingDark: '/images/along-way/room-night.webp',
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
} satisfies Record<string, VisualStyle>

export type VisualStyleId = keyof typeof visualStyles
export const defaultVisualStyle: VisualStyleId = 'paper-coast'
export const visualStyleStorageKey = 'seagull-visual-style'
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
