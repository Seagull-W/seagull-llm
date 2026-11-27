import catalog from '../research/catalog.json'

interface ResearchEntry {
  title: string
  route: string
  date: string
  description: string
  featured?: boolean
  featuredNote?: string
  label?: string
  sidebarTitle?: string
  children?: { text: string; link: string }[]
}

// List newest issues first, keeping the catalog order within each date.
const entries: ResearchEntry[] = [...catalog].sort((a, b) => b.date.localeCompare(a.date))
export const researchCards = entries.map(({ title, route, description, label, date, featured = false, featuredNote }) => ({
  title, link: route, description, label: label || date, date, featured, featuredNote,
}))
export const featuredResearchCards = researchCards.filter(card => card.featured === true)

function sidebarGroup(text: string, rows: ResearchEntry[]) {
  return {
    text,
    collapsed: false,
    items: rows.map(({ title, route, sidebarTitle, children }) => ({
      text: sidebarTitle || title, link: route,
      ...(children?.length ? { collapsed: false, items: children } : {}),
    })),
  }
}

export const researchSidebar = featuredResearchCards.length
  ? [sidebarGroup('精选调研', entries.filter(entry => entry.featured === true)), sidebarGroup('全部调研', entries)]
  : [sidebarGroup('每日调研', entries)]
