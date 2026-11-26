import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY } from 'd3-force'
import { sections, type ContentEntry } from '../content-catalog'
import { catalogLoader } from './catalog-source'

export interface GraphNode {
  id: string
  kind: 'article' | 'tag' | 'section'
  label: string
  value: string
  x: number
  y: number
}

export interface KnowledgeGraphData {
  nodes: GraphNode[]
  links: { source: string; target: string }[]
}

function buildKnowledgeGraph(entries: ContentEntry[]): KnowledgeGraphData {
  const byId = new Map<string, GraphNode>()
  const links: KnowledgeGraphData['links'] = []
  const sectionTitles = new Map(sections.map(section => [section.id, section.title]))
  function addNode(kind: GraphNode['kind'], value: string, label: string) {
    const id = `${kind}:${value}`
    // NaN lets D3 seed positions deterministically along its default spiral.
    if (!byId.has(id)) byId.set(id, { id, kind, label, value, x: NaN, y: NaN })
    return id
  }

  // Stable input order keeps the layout independent of publication dates and filesystem order.
  const articles = [...entries].sort((a, b) => a.url < b.url ? -1 : a.url > b.url ? 1 : 0)
  for (const page of articles) {
    const source = addNode('article', page.url, page.title)
    const section = sectionTitles.get(page.section)
    if (section) links.push({ source, target: addNode('section', page.section, section) })
    for (const tag of [...new Set(page.tags)].sort()) {
      links.push({ source, target: addNode('tag', tag, tag) })
    }
  }
  const nodes = [...byId.values()]
  // D3 mutates the endpoints and nodes in place. Keep the public links as IDs
  // and serialize only the fields the SVG renderer uses.
  const simulation = forceSimulation(nodes).stop()
    .force('links', forceLink<GraphNode, KnowledgeGraphData['links'][number]>(links.map(link => ({ ...link })))
      .id(node => node.id).distance(46))
    .force('charge', forceManyBody().strength(-54))
    .force('collision', forceCollide<GraphNode>(node => node.kind === 'section' ? 12 : 8))
    .force('x', forceX().strength(0.035))
    .force('y', forceY().strength(0.035))
  while (simulation.alpha() > simulation.alphaMin()) simulation.tick()
  simulation.stop()
  return {
    nodes: nodes.map(({ id, kind, label, value, x, y }) => ({
      id, kind, label, value, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10
    })),
    links
  }
}

declare const data: KnowledgeGraphData
export { data }
export default catalogLoader(buildKnowledgeGraph)
