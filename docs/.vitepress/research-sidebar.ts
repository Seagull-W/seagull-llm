import catalog from '../research/catalog.json'

interface ResearchEntry {
  title: string
  route: string
  date: string
  description: string
  label?: string
  sidebarTitle?: string
  children?: { text: string; link: string }[]
}

// Both public entrances use the same editorial order, labels and nesting.
const entries: ResearchEntry[] = catalog
export const researchCards = entries.map(({ title, route, description, label, date }) => ({
  title, link: route, description, label: label || date,
}))
export const researchSidebar = [{
  text: '每日调研',
  collapsed: false,
  items: entries.map(({ title, route, sidebarTitle, children }) => ({
    text: sidebarTitle || title, link: route,
    ...(children?.length ? { collapsed: false, items: children } : {}),
  })),
}]
