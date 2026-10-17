import { readFileSync, writeFileSync } from 'node:fs'
import matter from 'gray-matter'

const descriptions = {
  'rl-book/cha5奖励建模': '从成对偏好出发，理解 Bradley–Terry 模型、奖励头与训练损失，并比较结果奖励和过程奖励。',
  'rl-book/index': '从对话模板与监督微调走向奖励建模和强化学习，结合训练实验理解 RLHF 的完整学习路径。',
  'rl-book/奖励模型训练实验': '对照 bf16 与 f32 两次偏好奖励模型训练，通过交互曲线和验证结果观察损失、准确率与奖励分数。',
  'westlake-rl/index': '以概念笔记连接课程讲义，循序理解价值函数、策略梯度、随机近似与强化学习算法。',
  'westlake-rl/强化学习基本概念与贝尔曼方程/index': '第 1–2 讲课程资料：从强化学习基本概念进入价值函数与贝尔曼方程，保留讲义目录和逐页阅读。',
  'westlake-rl/最优状态价值与贝尔曼最优方程/index': '第 3 讲课程资料：围绕最优状态价值与贝尔曼最优方程，继续理解最优策略的刻画。',
  'westlake-rl/值迭代与策略迭代/index': '第 4 讲课程资料：学习值迭代与策略迭代，比较寻找最优价值和改进策略的思路。',
  'westlake-rl/蒙特卡洛方法/index': '第 5 讲课程资料：通过采样回合学习蒙特卡洛方法，连接经验回报与价值估计。',
  'westlake-rl/随机近似/课程讲义': '第 6 讲课程资料：学习随机近似的递推思想，并与均值估计、Robbins–Monro 算法笔记对照阅读。',
  'rust-notes/index': '从线程创建、消息传递和共享状态出发，用代码、行为对照与示意图理解 Rust 的并发编程。'
}
const escape = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;')
for (const [path, description] of Object.entries(descriptions)) {
  const md = `docs/${path}.md`
  const page = matter(readFileSync(md, 'utf8'))
  page.data.description = description
  writeFileSync(md, matter.stringify(page.content, page.data))
  const file = `docs/${path}.html`
  const source = readFileSync(file, 'utf8').replace(/<p class="note-deck">[\s\S]*?<\/p>/, `<p class="note-deck">${escape(description)}</p>`)
  writeFileSync(file, source)
}

const additions = {
  'rl-book/cha5奖励建模': String.raw`<div class="note-comparison" aria-label="偏好对的两个回答">
  <div class="note-compare positive"><span class="note-compare-label">Chosen · 被偏好的回答</span><p>奖励模型输出 <span class="math-inline" data-tex="r_\theta(y_c \mid x)"></span>。</p><small>学习信号来自偏好比较，而不是一个预先给定的绝对分数。</small></div>
  <div class="note-compare neutral"><span class="note-compare-label">Rejected · 对照回答</span><p>同一提示下输出 <span class="math-inline" data-tex="r_\theta(y_r \mid x)"></span>。</p><small>两个分数的差通过 sigmoid 映射为偏好概率。</small></div>
</div>`,
  'westlake-rl/TD算法/TD': `<div class="note-comparison" aria-label="Sarsa 与 Q-learning 对照">
  <div class="note-compare positive"><span class="note-compare-label">Sarsa</span><p>用下一步实际选择的动作构造更新目标。</p><small>这里讨论的是目标策略与行为策略一致的 on-policy 控制。</small></div>
  <div class="note-compare neutral"><span class="note-compare-label">Q-learning</span><p>用下一状态下最大的动作价值构造更新目标。</p><small>目标策略与行为策略可以不同；off-policy 不等于离线学习。</small></div>
</div>`,
  'rust-notes/多线程并发编程': `<figure class="note-diagram thread-diagram" aria-label="并发与并行的时间线示意">
<p class="note-diagram-title">同时存在，与同时执行</p>
<svg viewBox="0 0 660 232" role="img" aria-label="单核上的并发由 A B 两个任务交替执行，多核上的并行可以在同一时段执行两个任务">
  <text x="16" y="25" class="thread-label">单核上的并发（示意）</text>
  <path d="M116 64H636 M116 146H636 M116 198H636" stroke="#a4b7cf" stroke-width="2"/>
  <text x="16" y="68" class="thread-label">CPU 核 1</text>
  <g fill="#dbeafe" stroke="#8bb7f5"><rect x="120" y="42" width="110" height="36" rx="7"/><rect x="370" y="42" width="110" height="36" rx="7"/><rect x="120" y="124" width="480" height="36" rx="7"/></g>
  <g fill="#dcf6ef" stroke="#8bcdb8"><rect x="245" y="42" width="110" height="36" rx="7"/><rect x="495" y="42" width="110" height="36" rx="7"/><rect x="120" y="176" width="480" height="36" rx="7"/></g>
  <g fill="#234778" font-size="14" text-anchor="middle"><text x="175" y="66">任务 A</text><text x="425" y="66">任务 A</text><text x="360" y="148">任务 A</text></g>
  <g fill="#096954" font-size="14" text-anchor="middle"><text x="300" y="66">任务 B</text><text x="550" y="66">任务 B</text><text x="360" y="200">任务 B</text></g>
  <text x="16" y="108" class="thread-label">多核上的并行（示意）</text><text x="16" y="148" class="thread-label">CPU 核 1</text><text x="16" y="200" class="thread-label">CPU 核 2</text>
</svg>
<figcaption>横向表示时间；色块只说明调度关系，不代表真实任务的运行时长。</figcaption>
</figure>`
}
for (const [path, addition] of Object.entries(additions)) {
  const file = `docs/${path}.html`
  const source = readFileSync(file, 'utf8')
  if (source.includes('note-comparison') && addition.includes('note-comparison')) {
    writeFileSync(file, source.replace(/<div class="note-comparison"[\s\S]*?\n<\/div>/, () => addition))
    continue
  }
  if (source.includes('thread-diagram')) continue
  // Keep the overview mechanism map, then place a focused visual at the
  // beginning of the first content section, near the explanation it supports.
  writeFileSync(file, source.replace(/(<section class="document-section note-panel"[^>]*>\s*<h2\b[\s\S]*?<\/h2>)/,
    `$1\n${addition}`))
}
