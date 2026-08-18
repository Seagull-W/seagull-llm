// 侧边栏结构（共享模块）：config.mts 与 ChapterTag.vue 共用，保证标签与分组一致
export const sidebar = [
  {
    text: '开篇',
    collapsed: false,
    items: [
      { text: '第 0 章 大模型全景', link: '/ch00-overview' }
    ]
  },
  {
    text: '第一层 · 建立直觉',
    collapsed: false,
    items: [
      { text: '第 1 章 从一次对话说起', link: '/ch01-what-is-lm' },
      { text: '第 2 章 Token 化', link: '/ch02-tokenization' },
      { text: '第 3 章 词嵌入', link: '/ch03-embedding' },
      { text: '第 4 章 Transformer 架构概览', link: '/ch04-transformer' },
      { text: '第 5 章 注意力机制', link: '/ch05-attention' },
      { text: '第 6 章 训练过程', link: '/ch06-training' },
      { text: '第 7 章 涌现能力', link: '/ch07-emergence' }
    ]
  },
  {
    text: '第二层 · 理解边界',
    collapsed: false,
    items: [
      { text: '第 8 章 上下文窗口', link: '/ch08-context-window' },
      { text: '第 9 章 幻觉问题', link: '/ch09-hallucination' },
      { text: '第 10 章 能力边界', link: '/ch10-capability-boundary' },
      { text: '第 11 章 提示工程基础', link: '/ch11-prompt-engineering' },
      { text: '第 12 章 模型评估', link: '/ch12-evaluation' }
    ]
  },
  {
    text: '第三层 · 走向实践',
    collapsed: false,
    items: [
      { text: '第 13 章 开源与闭源生态', link: '/ch13-ecosystem' },
      { text: '第 14 章 模型选择策略', link: '/ch14-model-selection' },
      { text: '第 15 章 RAG 检索增强生成', link: '/ch15-rag' },
      { text: '第 16 章 微调入门', link: '/ch16-finetuning' },
      { text: '第 17 章 部署方式概览', link: '/ch17-deployment' },
      { text: '第 18 章 成本与性能考量', link: '/ch18-cost-performance' }
    ]
  }
]
