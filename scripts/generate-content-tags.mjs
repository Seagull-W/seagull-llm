import { readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readContent } from './content-source.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../docs')
const categories = {
  'llm-book': '大语言模型', 'rl-book': 'RLHF', 'westlake-rl': '强化学习',
  papers: '论文与项目随谈', research: '每日调研', 'rust-notes': 'Rust', 'linux-notes': 'Linux', videos: '科普视频', adr: '网站开发'
}
const topics = [
  ['监督微调', /监督微调|指令微调|\bSFT\b|\bIFT\b/i],
  ['对话模板', /对话模板|chat.?template/i],
  ['奖励建模', /奖励建模|奖励模型|Bradley.?Terry/i],
  ['策略梯度', /策略梯度|\bREINFORCE\b/i],
  ['PPO', /\bPPO\b/i], ['DPO', /\bDPO\b/i], ['GRPO', /\bGRPO\b/i],
  ['信用分配', /信用分配|GiGPO|Graph.?GPO/i],
  ['推理模型', /DeepSeek.?R1|推理模型|R1.?Zero/i],
  ['价值函数', /价值函数|状态价值|\bDQN\b/i],
  ['贝尔曼方程', /贝尔曼/i], ['动态规划', /值迭代|策略迭代|动态规划/i],
  ['蒙特卡洛', /蒙特卡洛|Monte.?Carlo/i],
  ['随机近似', /随机近似|Robbins.?Monro/i],
  ['时序差分', /时序差分|TD.?算法|Q.?learning|Sarsa/i],
  ['Token 化', /Token.?化|分词|tokenization/i],
  ['词嵌入', /词嵌入|embedding/i],
  ['Transformer', /Transformer|注意力机制/i],
  ['预训练', /预训练|pre.?training/i],
  ['微调', /微调|fine.?tuning/i],
  ['生成机制', /生成机制|预测下一个|如何生成|生成过程/i],
  ['可靠性', /可靠性|幻觉|可验证|核查/i],
  ['提示工程', /提示工程|prompt.?engineering/i],
  ['RAG', /\bRAG\b|检索增强/i], ['模型评估', /评估|benchmark/i],
  ['模型部署', /部署|推理服务/i], ['模型选型', /模型选型|模型选择/i],
  ['并发编程', /并发|多线程|消息传递|共享状态/i],
  ['训练实验', /训练实验|训练实践|bf16|grpo\.yaml/i]
]

async function* markdownFiles(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'public') continue
    const path = join(directory, entry.name)
    if (entry.isDirectory()) yield* markdownFiles(path)
    else if (entry.name.endsWith('.md')) yield path
  }
}

let added = 0
let kept = 0
for await (const path of markdownFiles(root)) {
  const name = relative(root, path).replaceAll('\\', '/')
  if (name === 'index.md' || name === 'tags.md' || name.startsWith('adr/')) continue
  const source = await readFile(path, 'utf8')
  const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
  // Preserve hand-edited metadata and tags, including multiline YAML lists.
  if (frontmatter && /^tags\s*:/m.test(frontmatter[1])) { kept++; continue }
  const text = readContent(path).content
    .replace(/```[\s\S]*?```/g, '').replace(/<script\b[\s\S]*?<\/script>/g, '')
  const title = frontmatter?.[1].match(/^title:\s*(.+)$/m)?.[1] ?? text.match(/^#{1,2}\s+(.+)$/m)?.[1] ?? name
  const headings = text.match(/^#{1,6}\s+.+$|<h[1-6]\b[^>]*>[\s\S]*?<\/h[1-6]>/gm)?.join('\n') ?? ''
  const ranked = (name.startsWith('adr/') ? [] : topics).map(([tag, pattern], order) => ({
    tag, order, score: pattern.test(title) ? 10 : pattern.test(headings) ? 4 : pattern.test(text) ? 1 : 0
  })).filter(item => item.score > 0).sort((a, b) => b.score - a.score || a.order - b.order)
  const category = categories[name.split('/')[0]] ?? '学习笔记'
  const tags = [category, ...ranked.slice(0, 3).map(item => item.tag)]
  const line = `tags: ${JSON.stringify([...new Set(tags)])}`
  const newline = source.includes('\r\n') ? '\r\n' : '\n'
  const tagged = frontmatter
    ? source.replace(/^(---\r?\n)/, `$1${line}${newline}`)
    : `---${newline}${line}${newline}---${newline}${newline}${source}`
  await writeFile(path, tagged)
  added++
}
console.log(`Content tags: ${added} pages tagged, ${kept} existing tag sets preserved.`)
