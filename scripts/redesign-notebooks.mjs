// One-time editorial restructuring. The resulting HTML is the maintained
// page, rather than a skin added around the old article at runtime.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { parse } from '@vue/compiler-dom'
import matter from 'gray-matter'

const sections = {
  papers: ['论文与项目随谈', '从问题、方法到证据'],
  'rl-book': ['RL 学习笔记', '从算法到训练实践'],
  'westlake-rl': ['西湖 RL 笔记', '概念、推导与算法'],
  'rust-notes': ['Rust 学习笔记', '用代码理解系统行为'],
  'linux-notes': ['Linux 学习笔记', '机制图解与命令实践']
}
// Each map follows the actual subject of its article; arrows express a
// reading / data path, not a measured result or a claim about a new source.
const maps = {
  'rl-book/cha4对话模板与监督微调': ['一条样本怎样进入监督微调', '将数据组织、模板转换与训练目标分开理解。', [['结构化对话', '角色、消息与轮次'], ['对话模板', '转换为词元序列'], ['监督目标', '确定哪些回答位置参与损失']]],
  'rl-book/cha5奖励建模': ['从人类偏好到奖励信号', 'Bradley–Terry 模型比较的是同一提示下两个回答的分数差。', [['偏好对', '同一问题：chosen / rejected'], ['奖励模型', '分别输出标量分数'], ['偏好概率', 'sigmoid 连接分数差与偏好'], ['训练损失', '优化偏好的负对数似然']]],
  'rl-book/cha6强化学习': ['把强化学习放回训练闭环', '奖励提供评价，优势决定相对方向，策略梯度负责更新。', [['采样轨迹', '策略生成回答'], ['评价与优势', '把回报变为学习信号'], ['策略更新', '在约束下优化目标'], ['再次采样', '使用更新后的策略']]],
  'rl-book/cha6-experiment': ['沿数据流阅读 GRPO 实验', '先追踪一轮训练的输入输出，再进入配置、源码与显存分析。', [['Prompt 批次', 'prompts_per_step'], ['组内采样', 'num_rollouts 个回答'], ['奖励与优势', '同一问题内比较'], ['策略更新', '裁剪目标与梯度累积']]],
  'rl-book/奖励模型训练实验': ['对照实验怎样读', '先统一指标与 step，再观察精度差异；曲线与表格保留原始记录口径。', [['运行条件', 'bf16 与 f32'], ['同一指标', '损失、准确率、奖励分数'], ['对齐记录', '比较 step 与变化趋势'], ['解释边界', '区分观测与归因']]],
  'rust-notes/多线程并发编程': ['Rust 并发的两条组织路线', '选择任务间如何交换数据，再理解所有权与线程安全约束。', [['创建线程', 'spawn 与 join'], ['消息传递', 'channel 转移数据'], ['共享状态', 'Arc 与 Mutex'], ['安全边界', 'Send / Sync 与所有权']]],
  'westlake-rl/随机近似/index': ['从均值估计走向随机近似', '用可获得的随机观测替代不可直接求出的期望，再讨论迭代的收敛条件。', [['目标', '求期望或函数的根'], ['观测', '带噪声的样本'], ['递推', '用步长控制每次修正'], ['收敛', '检验条件与误差']]],
  'westlake-rl/策略梯度/index': ['策略梯度的推导路线', '先确定优化指标，随后推导梯度，最后用采样估计落实为算法。', [['参数化策略', '用参数描述动作概率'], ['标量目标', '明确优化什么'], ['梯度推导', '连接回报与参数变化'], ['采样估计', 'REINFORCE 等方法']]],
  'westlake-rl/价值函数/index': ['用函数代替价值表', '表示能力、计算开销与状态特征共同决定近似方法的取舍。', [['状态特征', '把状态映射为输入'], ['价值近似', '线性函数或神经网络'], ['学习目标', 'MC / TD 形成估计'], ['参数更新', '用梯度方法修正近似']]],
  'westlake-rl/TD算法/TD': ['比较 TD 控制算法时，先看策略', '目标策略与行为策略是否一致，决定这里所说的 on-policy / off-policy。', [['当前状态', '观察状态与动作'], ['估计目标', 'Sarsa / Q-learning 的差异'], ['TD 误差', '目标减去当前估计'], ['更新价值', '用步长混合新旧信息']]],
  'papers/deepseek-r1/index': ['两条训练路线放在一起看', '先读 R1-Zero 的直接强化学习，再看 R1 如何加入多阶段训练。', [['R1-Zero', '直接 RL 的探索'], ['观察与限制', '推理表现与可读性'], ['DeepSeek-R1', '冷启动与多阶段训练'], ['训练分析', '奖励、采样与系统实现']]],
  'papers/gigpo/index': ['两层信用分配', '回合级评价与锚点状态下的步骤比较，分别回答全局与局部的问题。', [['多条轨迹', '同一任务的 rollout'], ['回合分组', '比较整体结果'], ['锚点状态', '对齐相近决策情境'], ['步骤优势', '补充局部信用信号']]],
  'papers/graph-gpo/index': ['从轨迹转向状态转移图', '图中的动作边用于分析对接近目标的贡献，而不只继承整条轨迹的结果。', [['Rollout 轨迹', '收集状态与动作'], ['聚合为图', '共享状态连接起来'], ['目标距离', '到成功状态的距离'], ['步骤信用', '评价动作带来的进展']]],
  'papers/post-training-guide': ['带着问题进入项目', '项目记录、工程专题和证据索引提供三个互补的阅读入口。', [['选项目', '先明确对象与版本'], ['走全链路', '数据、训练、评测与上线'], ['查工程', '围绕实际问题交叉阅读'], ['回到证据', '核对原始材料与缺口']]],
  'papers/engineering/workflow': ['后训练不是一个孤立的 loss', '把每个阶段的产物与下一阶段的输入连接起来，才能定位问题。', [['数据与环境', '任务、执行与验证'], ['采样与奖励', '生成可学习的经验'], ['更新与评测', '策略、checkpoint 与指标'], ['上线与反馈', '观察行为并推动下一轮']]],
  'papers/engineering/data-and-environments': ['一个可验证任务的组成', '任务文本、可执行环境和判定器要一起进入检查范围。', [['任务来源', '生成或收集任务'], ['执行环境', '依赖、状态与资源'], ['验证反馈', '区分成功与失败类型'], ['数据过滤', '保留可解释的训练信号']]],
  'papers/engineering/rewards-and-algorithms': ['区分三种学习信号', '奖励、优势和优化目标相互连接，但承担不同职责。', [['原始反馈', '任务与验证器的结果'], ['Reward', '按规则形成分数'], ['Advantage', '相对基线的评价'], ['Policy loss', '实现策略的参数更新']]],
  'papers/engineering/async-and-consistency': ['异步系统要保留对应关系', '任务、生成时的策略版本和训练时的样本必须能够重新关联。', [['采样请求', '任务与版本标识'], ['推理输出', '回答与行为概率'], ['训练消费', '样本、权重与 staleness'], ['一致性检查', '定位格式与数值偏差']]],
  'papers/engineering/distributed-performance': ['先分清资源，再谈吞吐', '训练、生成、环境执行三套资源预算，共同影响端到端性能。', [['训练资源', '并行、显存与优化器'], ['生成资源', 'KV cache 与采样'], ['环境资源', '容器与任务执行'], ['端到端', '调度、传输与等待']]],
  'papers/engineering/operations-and-recovery': ['一次可追溯运行的证据链', '启动配置、运行记录与恢复状态要能指向同一次实验。', [['启动配置', '代码、依赖、参数'], ['运行观测', '日志、指标与状态'], ['检查点', '模型及必要训练状态'], ['恢复核对', '明确继续了什么']]],
  'papers/engineering/evaluation-and-feedback': ['让一个分数有完整语境', '分数与模型版本、评测协议、checkpoint 和行为变化一起解释。', [['评测协议', '数据、环境与采样设置'], ['模型版本', '对应 checkpoint'], ['结果比较', 'benchmark 与行为回归'], ['上线反馈', '推动核验与修复']]],
  'papers/engineering/failure-handbook': ['沿故障影响路径定位', '先识别症状所在阶段，再回到来源、修复动作和证据边界。', [['症状', '异常奖励、吞吐或行为'], ['阶段', '数据 / 环境 / 训练 / 评测'], ['证据', '日志、配置与原始反馈'], ['处置', '修复、恢复与回归验证']]],
  'papers/evidence/project-metrics': ['读指标前先核对身份', '不同运行、任务分布和统计口径下的数值，不能直接混为同一条比较。', [['指标定义', '计算什么'], ['运行身份', '哪次实验与 checkpoint'], ['统计口径', '样本与聚合方法'], ['证据状态', '数值、曲线或缺失记录']]],
  'papers/evidence/sources': ['顺着证据回到版本', '资料类型和固定版本共同决定一个结论能够支持到哪里。', [['作者材料', '报告与原始记录'], ['实现材料', '代码与配置'], ['运行反馈', '看板、Issue 与修复'], ['版本定位', '保留链接和提交信息']]],
  'papers/evidence/gaps': ['缺失信息也需要明确记录', '区分未公开、尚未取得和未核验，避免把资料缺口写成确定结论。', [['已有材料', '记录可访问证据'], ['缺失部分', '配置、日志或协议'], ['影响范围', '哪些判断受限制'], ['待核验项', '明确下一步需要什么']]],
  'papers/projects/coverage': ['沿同一条链检查不同项目', '统一检查项用于定位证据覆盖，不代表各项目实现相同。', [['任务与数据', '来源和验证方式'], ['算法与系统', '更新、采样与资源'], ['指标与评测', '结果与对应条件'], ['故障与恢复', '实际反馈和证据边界']]],
  'papers/projects/mimo-v2-6/index': ['把 MiMo 的运行与复现分开读', '公开运行记录、9B 配置与看板是不同层次的材料，需要各自定位。', [['运行归档', 'Pro / Flash 的公开记录'], ['指标分析', 'loss、reward 与 benchmark'], ['9B 复现', '逐领域核对配置'], ['工程反馈', '事故、回滚与上线修复']]],
  'papers/projects/mimo-v2-6/9b-config': ['按领域核对复现条件', '资源、采样、评分和恢复设置应以对应领域的固定配置为准。', [['领域任务', '明确数据与执行环境'], ['资源布局', '核对训练与采样配置'], ['奖励规则', '验证反馈如何进入训练'], ['复现记录', '保存版本、指标与状态']]],
  'papers/projects/mimo-v2-6/dashboard-guide': ['从原始记录到可解释图表', '缺失值、namespace 与派生 CSV 都需要保留原始统计口径。', [['原始 JSON', '归档的记录点'], ['指标字典', 'namespace 与字段'], ['派生 CSV', '说明计算和缺失值'], ['配套图表', '回到记录解释变化']]],
  'papers/projects/mimo-v2-6/loss-and-metrics': ['联合解释训练曲线', '单条曲线的升降不足以证明训练成功或失败，需要交叉检查。', [['Loss 与梯度', '观察更新数值'], ['KL 与 Reward', '观察策略和反馈'], ['任务与吞吐', '检查分布和系统变化'], ['Benchmark', '联系实际能力表现']]],
  'papers/projects/miles-glm-5-2/index': ['终端 Agent 的异步训练链', '终端环境、采样和大型训练系统共同构成参考运行。', [['终端任务', '环境与交互反馈'], ['异步采样', 'rollout 与版本关联'], ['GRPO / TIS', '核对更新算法'], ['运行排错', 'Slurm、Ray、KV 与 replay']]],
  'papers/projects/intellect-3/index': ['训练阶段与工程运行一起读', '将两阶段 SFT、异步 RL、资源和评测放在对应阶段解释。', [['SFT 阶段', '数据与监督训练'], ['异步 RL', '采样与策略更新'], ['多节点系统', '资源与调度'], ['评测与反馈', '结果、故障和边界']]],
  'papers/projects/deepswe-preview/index': ['软件工程 Agent 的反馈闭环', '任务执行环境既产生学习反馈，也会带来独立的工程约束。', [['R2E-Gym', '软件工程任务与环境'], ['Rollout', '执行与验证反馈'], ['GRPO++', '训练配置和更新'], ['评测复现', '脚本、协议与边界']]],
  'papers/projects/codemidas/index': ['从源码构建可验证任务', '把环境构建、任务过滤与 RL 实验的输入输出连起来。', [['源码与环境', '建立可执行条件'], ['执行验证', '生产与筛选任务'], ['RL 实验', 'GRPO 配置与更新'], ['结果分析', 'benchmark、故障与发布']]]
}

const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;')
const attr = (node, name) => node.props?.find(p => p.type === 6 && p.name === name)?.value?.content
const text = node => node.type === 2 ? node.content : (node.children ?? [])
  .filter(child => !attr(child, 'class')?.includes('header-anchor')).map(text).join('').trim()
const heading = node => node.type === 1 && /^h[2-6]$/.test(node.tag)

function mapHtml(map) {
  return `<figure class="note-diagram" aria-label="${escape(map[0])}">
  <p class="note-diagram-title">${escape(map[0])}</p>
  <div class="note-flow">${map[2].map(([title, detail], index) => `
    <div class="note-flow-step tone-${index % 3}"><strong>${escape(title)}</strong><span>${escape(detail)}</span></div>`).join('')}
  </div>
  <figcaption>${escape(map[1])}</figcaption>
</figure>`
}

let count = 0
for (const [section, [label, subtitle]] of Object.entries(sections)) {
  for (const filename of readdirSync(`docs/${section}`, { recursive: true }).filter(f => f.endsWith('.html'))) {
    const file = `docs/${section}/${filename}`
    let source = readFileSync(file, 'utf8')
    if (source.includes('data-design="linux-notebook"') || source.includes('format-system')) continue
    const { data } = matter(readFileSync(file.replace(/\.html$/, '.md'), 'utf8'))
    const tree = parse(source)
    const root = tree.children.find(node => attr(node, 'class')?.includes('native-document'))
    if (!root) continue
    const isDirectory = attr(root, 'data-format') === 'directory'
    const flat = root.children.flatMap(node => ['document-intro', 'document-section'].includes(attr(node, 'class')) ? node.children : [node])
      .filter(node => node.type === 1 || node.type === 3 || (node.type === 2 && node.content.trim()))
    const h1 = flat.find(node => node.tag === 'h1')
    const levels = flat.filter(heading).map(node => Number(node.tag[1]))
    const topLevel = Math.min(...levels)
    const parts = []
    let current = { title: '阅读起点', id: 'reading-context', nodes: [] }
    for (const node of flat) {
      if (node === h1) continue
      if (heading(node) && Number(node.tag[1]) === topLevel) {
        if (current.nodes.length) parts.push(current)
        current = { title: text(node), id: attr(node, 'id'), nodes: [node] }
      } else current.nodes.push(node)
    }
    if (current.nodes.length) parts.push(current)
    const pageKey = `${section}/${filename.replaceAll('\\', '/').replace(/\.html$/, '')}`
    const diagram = maps[pageKey]
    const chips = (data.tags ?? []).slice(0, 4)
    let title = h1?.loc.source ?? `<h1 id="note-title">${escape(data.title)} <a class="header-anchor" href="#note-title" aria-label="文章链接">&#8203;</a></h1>`
    let body = parts.map((part, index) => {
      let html = part.nodes.map(node => node.loc.source).join('\n')
      if (topLevel > 2 && topLevel < Infinity) html = html.replace(/<(\/?)(h[2-6])\b/g, (_, slash, h) => `<${slash}h${Math.max(2, Number(h[1]) - topLevel + 2)}`)
      if (!heading(part.nodes[0])) html = `<h2 id="${part.id}" tabindex="-1">${part.title} <a class="header-anchor" href="#${part.id}" aria-label="章节链接">&#8203;</a></h2>\n${html}`
      // Native details keep long implementation examples available without
      // making the initial reading route a wall of code. Headings stay outside.
      html = html.replace(/<div class="(language-[^"]*)"[\s\S]*?<div class="line-numbers-wrapper"[\s\S]*?<\/div><\/div>/g, block => {
        const lines = (block.match(/class="line-number"/g) ?? []).length
        return lines >= 24 ? `<details class="note-details"><summary>展开代码与配置 <span>${lines} 行</span></summary>\n${block}\n</details>` : block
      })
      html = html.replace(/<p><img\b([^>]*)><\/p>/g, (all, attrs) => {
        const alt = attrs.match(/alt="([^"]*)"/)?.[1]
        const amended = alt ? attrs : attrs.replace(/alt=""/, `alt="${escape(part.title)}配图"`)
        return `<figure class="note-figure"><img${amended}><figcaption>${escape(alt || part.title + ' · 原文配图')}</figcaption></figure>`
      })
      html = html.replace(/<table\b[\s\S]*?<\/table>/g, table => `<div class="note-table" role="region" aria-label="${escape(part.title)}表格" tabindex="0">${table}</div>`)
      return `<section class="document-section note-panel" aria-labelledby="${escape(part.id)}">\n${html}\n</section>`
    }).join('\n\n')
    const jumps = parts.map((part, index) => `<a href="#${escape(part.id)}"><span>${String(index + 1).padStart(2, '0')}</span>${escape(part.title)}</a>`)
    const toc = parts.length > 1 ? `<nav class="note-jump" aria-label="本篇阅读导航">\n${jumps.slice(0, 8).join('\n')}${parts.length > 8 ? `\n<details><summary>其余 ${parts.length - 8} 节</summary><div>${jumps.slice(8).join('\n')}</div></details>` : ''}\n</nav>` : ''
    const rootTag = root.tag
    const opening = root.loc.source.slice(0, root.loc.source.indexOf('>')).replace(/>$/, '')
    const rebuilt = `${opening} data-design="linux-notebook">
<header class="document-intro note-hero">
  <p class="note-kicker">${escape(label)}<span>${escape(isDirectory ? subtitle : data.pdf ? '课程讲义' : subtitle)}</span></p>
  ${title}
  <p class="note-deck">${escape(data.description)}</p>
  <div class="note-chips">${chips.map(tag => `<span>${escape(tag)}</span>`).join('')}</div>
</header>
${toc}
${diagram ? mapHtml(diagram) + '\n' : ''}
${body}
</${rootTag}>`
    source = source.slice(0, root.loc.start.offset) + rebuilt + source.slice(root.loc.end.offset)
    writeFileSync(file, source)
    count++
  }
}
console.log(`Redesigned ${count} notebook and directory HTML sources.`)
