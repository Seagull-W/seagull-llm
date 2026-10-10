// 侧边栏结构（共享模块）：config.mts 与 ChapterTag.vue 共用，保证标签与分组一致
// 多模块多侧边栏：按路径前缀区分

// ===== LLM 科普书侧边栏（/llm-book/）=====
export const llmBookSidebar = [
  {
    text: '开篇',
    collapsed: false,
    items: [{ text: '第 0 章 大模型全景', link: '/llm-book/ch00-overview' }]
  },
  {
    text: '第一层 · 建立直觉',
    collapsed: false,
    items: [
      { text: '第 1 章 从一次对话说起', link: '/llm-book/ch01-what-is-lm' },
      { text: '第 2 章 Token 化', link: '/llm-book/ch02-tokenization' }
    ]
  },
  {
    text: '新版重构试读',
    collapsed: false,
    items: [
      { text: '学习地图与样章', link: '/llm-book/rebuild/' },
      { text: '一次回答是怎样生成的', link: '/llm-book/rebuild/how-generation-works' },
      { text: '带引用的回答，怎样才算有依据', link: '/llm-book/rebuild/verifiable-answers' },
      { text: '图与动画的来源及范围', link: '/llm-book/rebuild/visual-resources' }
    ]
  }
]

// ===== Nathan Lambert RL BOOK 学习笔记侧边栏（/rl-book/）=====
export const rlBookSidebar = [
  {
    text: '学习笔记',
    collapsed: false,
    items: [
      { text: '对话模板与监督微调', link: '/rl-book/cha4对话模板与监督微调' },
      { text: '奖励建模', link: '/rl-book/cha5奖励建模' },
      { text: '奖励模型训练实验与分析', link: '/rl-book/奖励模型训练实验' },
      { text: '强化学习', link: '/rl-book/cha6强化学习' }
    ]
  }
]

// ===== 西湖大学强化学习笔记侧边栏（/westlake-rl/）=====
export const westlakeRlSidebar = [
  {
    text: '学习笔记',
    collapsed: false,
    items: [
      { text: '随机近似', link: '/westlake-rl/随机近似/' },
      { text: '价值函数', link: '/westlake-rl/价值函数/' },
      { text: '策略梯度', link: '/westlake-rl/策略梯度/' },
      { text: '第 1–2 讲 强化学习基本概念与贝尔曼方程', link: '/westlake-rl/强化学习基本概念与贝尔曼方程/' },
      { text: '第 3 讲 最优状态价值与贝尔曼最优方程', link: '/westlake-rl/最优状态价值与贝尔曼最优方程/' },
      { text: '第 4 讲 值迭代与策略迭代', link: '/westlake-rl/值迭代与策略迭代/' },
      { text: '第 5 讲 蒙特卡洛方法', link: '/westlake-rl/蒙特卡洛方法/' },
      { text: '第 6 讲 随机近似', link: '/westlake-rl/随机近似/课程讲义' },
      { text: 'TD 算法', link: '/westlake-rl/TD算法/TD' }
    ]
  }
]

// ===== 论文阅读笔记侧边栏（/papers/）=====
export const papersSidebar = [
  {
    text: '强化学习与推理模型',
    collapsed: false,
    items: [
      { text: 'DeepSeek-R1 技术报告', link: '/papers/deepseek-r1/' },
      { text: 'GiGPO', link: '/papers/gigpo/' },
      { text: 'Graph-GPO', link: '/papers/graph-gpo/' }
    ]
  }
]

// ===== Rust 学习笔记侧边栏（/rust-notes/）=====
export const rustNotesSidebar = [
  {
    text: 'Rust 学习笔记',
    collapsed: false,
    items: [
      { text: '笔记目录', link: '/rust-notes/' },
      { text: '多线程并发编程', link: '/rust-notes/多线程并发编程' }
    ]
  }
]

// VitePress 多侧边栏：按路径前缀匹配
export const sidebar = {
  '/llm-book/': llmBookSidebar,
  '/papers/': papersSidebar,
  '/rl-book/': rlBookSidebar,
  '/westlake-rl/': westlakeRlSidebar,
  '/rust-notes/': rustNotesSidebar
}
