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
      { text: '第 2 章 Token 化', link: '/llm-book/ch02-tokenization' },
      { text: '第 3 章 词嵌入', link: '/llm-book/ch03-embedding' },
      { text: '第 4 章 Transformer 架构概览', link: '/llm-book/ch04-transformer' },
      { text: '第 5 章 注意力机制', link: '/llm-book/ch05-attention' },
      { text: '第 6 章 训练过程', link: '/llm-book/ch06-training' },
      { text: '第 7 章 涌现能力', link: '/llm-book/ch07-emergence' }
    ]
  },
  {
    text: '第二层 · 理解边界',
    collapsed: false,
    items: [
      { text: '第 8 章 上下文窗口', link: '/llm-book/ch08-context-window' },
      { text: '第 9 章 幻觉问题', link: '/llm-book/ch09-hallucination' },
      { text: '第 10 章 能力边界', link: '/llm-book/ch10-capability-boundary' },
      { text: '第 11 章 提示工程基础', link: '/llm-book/ch11-prompt-engineering' },
      { text: '第 12 章 模型评估', link: '/llm-book/ch12-evaluation' }
    ]
  },
  {
    text: '第三层 · 走向实践',
    collapsed: false,
    items: [
      { text: '第 13 章 开源与闭源生态', link: '/llm-book/ch13-ecosystem' },
      { text: '第 14 章 模型选择策略', link: '/llm-book/ch14-model-selection' },
      { text: '第 15 章 RAG 检索增强生成', link: '/llm-book/ch15-rag' },
      { text: '第 16 章 微调入门', link: '/llm-book/ch16-finetuning' },
      { text: '第 17 章 部署方式概览', link: '/llm-book/ch17-deployment' },
      { text: '第 18 章 成本与性能考量', link: '/llm-book/ch18-cost-performance' }
    ]
  }
]

// ===== Nathan Lambert RL BOOK 学习笔记侧边栏（/rl-book/）=====
export const rlBookSidebar = [
  {
    text: '学习笔记',
    collapsed: false,
    items: [
      // 添加笔记时在此登记，如：
      // { text: '第 1 章 RLHF 概述', link: '/rl-book/ch01-rlhf-overview' }
    ]
  }
]

// ===== 西湖大学强化学习笔记侧边栏（/westlake-rl/）=====
export const westlakeRlSidebar = [
  {
    text: '学习笔记',
    collapsed: false,
    items: [
      // 添加笔记时在此登记，如：
      { text: '随即近似', link: '/westlake-rl/随即近似/' }
    ]
  }
]

// ===== 论文阅读笔记侧边栏（/papers/）=====
export const papersSidebar = [
  {
    text: '强化学习与推理模型',
    collapsed: false,
    items: [
      { text: 'DeepSeek-R1 技术报告', link: '/papers/deepseek-r1/' }
    ]
  }
]

// VitePress 多侧边栏：按路径前缀匹配
export const sidebar = {
  '/llm-book/': llmBookSidebar,
  '/papers/': papersSidebar,
  '/rl-book/': rlBookSidebar,
  '/westlake-rl/': westlakeRlSidebar
}
