import type { ContentEntry } from '../content-catalog'
import { normalizeContentPath } from '../public-content'

type TopicKey = 'sandbox' | 'gpu' | 'reward'
interface CuratedTopic {
  key: TopicKey
  name: string
  short: string
  deck: string
  readings: [role: string, path: string][]
}

// Only the editorial route and reading angle live here. Titles, column
// membership and actual destination URLs come from the public catalog.
const topics: CuratedTopic[] = [
  {
    key: 'sandbox', name: '智能体的沙箱，究竟隔离了什么？', short: '智能体沙箱',
    deck: '从一个 Linux 进程的边界，读到沙箱的恢复成本，再看大批容器怎样分摊调度。',
    readings: [
      ['隔离边界', '/linux-notes/linux-isolation'],
      ['运行成本', '/research/2026-10-20-agent-sandbox-wrong-target'],
      ['训练实例', '/papers/projects/deepswe-preview/'],
    ],
  },
  {
    key: 'gpu', name: 'GPU 怎样转置矩阵？', short: '矩阵转置',
    deck: '从一块矩阵的数据搬运读起，再到训练实验里看 GPU 的时间该怎样测。',
    readings: [
      ['显存访问', '/cs336/lecture-05'],
      ['分块转置', '/cuda-notes/simt-kernels'],
      ['计时方法', '/cs336/a2-benchmark'],
    ],
  },
  {
    key: 'reward', name: '两个回答，模型怎样学会偏好？', short: '偏好与奖励',
    deck: '从成对比较建立奖励模型，再用两次训练结果检验它，最后看看奖励怎样进入策略更新。',
    readings: [
      ['训练目标', '/rl-book/cha5奖励建模'],
      ['实验记录', '/rl-book/奖励模型训练实验'],
      ['策略更新', '/papers/engineering/rewards-and-algorithms'],
    ],
  },
]

export function getHomeTopics(pages: readonly ContentEntry[]) {
  const byPath = new Map(pages.map(page => [normalizeContentPath(page.url), page]))
  return topics.flatMap(({ readings: routes, ...topic }) => {
    const readings = routes.flatMap(([role, path]) => {
      const page = byPath.get(normalizeContentPath(path))
      return page ? [{ role, page }] : []
    })
    if (!readings.length) return []
    return [{ ...topic, deck: readings.length === routes.length ? topic.deck : '', readings }]
  })
}

export const discoveryGroups = [
  { name: '课程与训练', art: 'westlake-rl', sectionIds: ['cs336', 'rl-book', 'datawhale-agentic-rl', 'westlake-rl'] },
  { name: '系统与推理', art: 'linux-notes', sectionIds: ['cuda-notes', 'vllm-notes', 'linux-notes', 'rust-notes'] },
  { name: '研究与影像', art: 'research', sectionIds: ['papers', 'research', 'videos'] },
]
