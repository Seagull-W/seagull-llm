# LLM 介绍文档网站 — 设计文档

> **版本**：v2.0  
> **日期**：2026-08-12  
> **状态**：待执行  
> **前置文档**：`REQUIREMENTS.md`、`REDESIGN.md`、`STYLE_GUIDE.md`

---

## 1. 项目概述

### 1.1 项目目标

构建一个基于 VitePress 的静态文档网站，承载大语言模型（LLM）介绍文档。网站以 Markdown 为内容源，提供美观的阅读体验、交互式演示组件和便捷的部署流程。

### 1.2 需求摘要

从 `REQUIREMENTS.md` 提取的核心需求：

| 维度 | 决策 |
|---|---|
| 内容格式 | Markdown 源文件 |
| SSG 框架 | VitePress |
| 图表 | Mermaid（流程图、架构图） |
| 数学公式 | MathJax3（LaTeX 语法） |
| 交互组件 | Vue 3（分词演示、注意力可视化等） |
| 部署 | Cloudflare Pages |
| 版本控制 | Git + GitHub |
| 布局风格 | 参考 course.rs / Hello-Agents，左侧边栏 + 正文 + 翻页导航 |
| 叙事风格 | 严谨且亲和；可用"你"、适度口语；类比是首选入口工具；公式在直觉之后、标注〔深入·可选〕 |
| 内容结构 | 开篇全景 + 三层 18 章（建立直觉 / 理解边界 / 走向实践） |
| 章节规范 | 每章含"本章导引"、正文、"〔深入·可选〕"形式化小节、"本章小结"、"参考文献" |
| 主题 | 亮色/暗色双模式 |
| 多笔记扩展 | 未来需求，当前仅做 LLM 文档 |

### 1.3 站点信息架构

```
seagull-llm/                     # 项目根目录
├── docs/                        # VitePress 文档根目录
│   ├── .vitepress/              # VitePress 配置与主题
│   │   ├── config.mts           # 站点配置（核心，.mts 扩展名确保 ESM 兼容）
│   │   ├── theme/               # 自定义主题扩展
│   │   │   ├── index.ts         # 主题入口
│   │   │   └── styles/          # 自定义样式
│   │   │       └── custom.css   # 主题变量覆盖
│   │   └── components/          # Vue 交互组件
│   │       ├── TokenDemo.vue    # 分词演示组件
│   │       ├── AttentionViz.vue # 注意力权重可视化
│   │       └── WordEmbedViz.vue # 词向量降维可视化
│   ├── public/                  # 静态资源
│   │   ├── favicon.ico          # （可选，未来添加）
│   │   └── _headers             # Cloudflare Pages 缓存策略
│   ├── index.md                 # 首页（hero 页）
│   ├── ch00-overview.md         # 第 0 章 开篇全景（新增）
│   ├── ch01-what-is-lm.md       # 第 1 章 从一次对话说起
│   ├── ch02-tokenization.md     # 第 2 章 Token 化
│   ├── ch03-embedding.md        # 第 3 章 词嵌入
│   ├── ch04-transformer.md      # 第 4 章 Transformer 架构概览
│   ├── ch05-attention.md        # 第 5 章 注意力机制
│   ├── ch06-training.md         # 第 6 章 训练过程
│   ├── ch07-emergence.md        # 第 7 章 涌现能力
│   ├── ch08-context-window.md   # 第 8 章 上下文窗口
│   ├── ch09-hallucination.md    # 第 9 章 幻觉问题
│   ├── ch10-capability-boundary.md  # 第 10 章 能力边界
│   ├── ch11-prompt-engineering.md   # 第 11 章 提示工程基础
│   ├── ch12-evaluation.md       # 第 12 章 模型评估
│   ├── ch13-ecosystem.md        # 第 13 章 开源与闭源生态
│   ├── ch14-model-selection.md  # 第 14 章 模型选择策略
│   ├── ch15-rag.md              # 第 15 章 RAG 检索增强生成
│   ├── ch16-finetuning.md       # 第 16 章 微调入门
│   ├── ch17-deployment.md       # 第 17 章 部署方式概览
│   └── ch18-cost-performance.md # 第 18 章 成本与性能考量
├── package.json
├── .gitignore
└── README.md                     # （可选，未来添加）
```

---

## 2. 技术规格

### 2.1 依赖清单

**package.json**：

```json
{
  "name": "seagull-llm",
  "version": "1.0.0",
  "description": "大语言模型介绍文档",
  "scripts": {
    "dev": "vitepress dev docs",
    "build": "vitepress build docs",
    "preview": "vitepress preview docs"
  },
  "devDependencies": {
    "vitepress": "^1.6.3",
    "vue": "^3.5.13",
    "vitepress-plugin-mermaid": "^2.0.17",
    "mermaid": "^11.4.1",
    "markdown-it-mathjax3": "^4.3.2"
  }
}
```

> 版本号在执行时以 npm 最新稳定版为准，上述为最低兼容版本。

### 2.2 VitePress 配置规格

**`.vitepress/config.mts`** 完整配置约束：

```ts
import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'

export default withMermaid({
  // ===== 站点元数据 =====
  lang: 'zh-CN',
  title: '大语言模型入门',
  description: '面向零基础读者的大语言模型工作原理与实践指南',
  base: '/',
  cleanUrls: true,

  // ===== 主题外观 =====
  appearance: true, // 亮色/暗色双模式，跟随系统 + 手动切换

  // ===== Markdown 配置 =====
  markdown: {
    math: true, // 启用 MathJax3 数学公式渲染
    theme: {
      light: 'github-light',
      dark: 'github-dark'
    },
    lineNumbers: true, // 代码块显示行号
    config(md) {
      // 如需额外 markdown-it 插件在此注册
    }
  },

  // ===== 主题配置 =====
  themeConfig: {
    // --- 导航栏 ---
    nav: [
      { text: '首页', link: '/' },
      { text: 'LLM 指南', link: '/ch00-overview' },
      // 未来扩展：{ text: '笔记', link: '/notes/' }
    ],

    // --- 侧边栏（扁平结构，数组形式）---
    sidebar: [
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
    ],

    // --- 右侧大纲 ---
    outline: {
      level: [2, 3], // 显示 h2 和 h3
      label: '本页目录'
    },

    // --- 搜索 ---
    search: {
      provider: 'local', // 本地搜索，无需外部服务
      options: {
        translations: {
          button: {
            buttonText: '搜索文档',
            buttonAriaLabel: '搜索文档'
          },
          modal: {
            noResultsText: '无法找到相关结果',
            resetButtonTitle: '清除查询条件',
            footer: {
              selectText: '选择',
              navigateText: '切换'
            }
          }
        }
      }
    },

    // --- 底部翻页 ---
    docFooter: {
      prev: '上一页',
      next: '下一页'
    },

    // --- 主题切换标签 ---
    darkModeSwitchLabel: '主题',
    lightModeSwitchTitle: '切换到浅色模式',
    darkModeSwitchTitle: '切换到深色模式',
    sidebarMenuLabel: '菜单',
    returnToTopLabel: '回到顶部',

    // --- 社交链接 ---
    socialLinks: [
      // 部署到 GitHub 后替换 <username> 为实际用户名
      { icon: 'github', link: 'https://github.com/<username>/seagull-llm' }
    ],

    // --- 页脚 ---
    footer: {
      message: '基于 VitePress 构建',
      copyright: 'Copyright © 2026'
    },

    // --- 外部链接图标 ---
    externalLinkIcon: true
  },

  // ===== Mermaid 配置 =====
  mermaid: {
    // 亮色模式使用 default 主题
    // 插件自动检测暗色模式（html.dark 类），自动切换为 dark 主题
    theme: 'default'
  }
})
```

### 2.3 自定义主题入口

**`.vitepress/theme/index.ts`**：

```ts
import DefaultTheme from 'vitepress/theme'
import './styles/custom.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    // 注册全局 Vue 组件
    app.component('TokenDemo', () => import('../components/TokenDemo.vue'))
    app.component('AttentionViz', () => import('../components/AttentionViz.vue'))
    app.component('WordEmbedViz', () => import('../components/WordEmbedViz.vue'))
  }
}
```

### 2.4 自定义样式

**`.vitepress/theme/styles/custom.css`** 约束：

```css
/* 覆盖 VitePress CSS 变量实现自定义主色调 */
:root {
  /* 主色调：待建站后确定，当前使用默认蓝色 */
  --vp-c-brand-1: #3451b2;
  --vp-c-brand-2: #3a5ccc;
  --vp-c-brand-3: #5672cd;
  /* 自定义容器颜色 */
  --vp-custom-block-info-border: #3451b2;
  --vp-custom-block-tip-bg: rgba(52, 81, 178, 0.05);
}

.dark {
  --vp-c-brand-1: #a8b1ff;
  --vp-c-brand-2: #9aaadf;
  --vp-c-brand-3: #b4bdff;
}

/* 正文字体 */
:root {
  --vp-font-family-base: 'Inter', 'Noto Sans SC', -apple-system,
    BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
```

### 2.5 首页规格

**`docs/index.md`** 使用 VitePress 内置 Hero 布局：

```yaml
---
layout: home

hero:
  name: 大语言模型入门
  text: 从原理到实践
  tagline: 面向零基础读者的严谨指南
  actions:
    - theme: brand
      text: 开始阅读
      link: /ch00-overview

features:
  - title: 建立直觉
    details: 从"预测下一个词"出发，理解大模型的核心工作原理
  - title: 理解边界
    details: 认识大模型的能力局限与常见问题的成因
  - title: 走向实践
    details: 为垂类应用与私有化部署提供基础知识地图
---
```

### 2.6 章节文件规格

每个章节 `.md` 文件必须遵循以下结构：

```markdown
# 第 N 章 章节标题

## 本章导引

> 2-3 句话说明本章解决什么问题、读者将获得什么理解。
> 作为本章的高层预览，先给读者一张"本章在全书地图的哪里"的认知。

---

## N.1 第一节标题

[正文内容，优先从读者已有的体验切入]

### N.1.1 子节标题

[子节内容]

## N.x〔深入·可选〕形式化标题

> 这一节是给"想看看严谨版本长什么样"的读者准备的。跳过不影响主线理解。

[公式与形式化表述，每个公式配逐符号文字解释]

## 本章小结

- 要点 1
- 要点 2
- 要点 3

## 参考文献

[1] 作者. 标题. 发表场所, 年份. 链接
```

**Frontmatter 规范**（可选）：

```yaml
---
title: 第 N 章 章节标题
description: 章节描述，用于 SEO
---
```

### 2.7 Mermaid 使用规范

在 Markdown 中直接使用 mermaid 代码块：

```
```mermaid
graph LR
    A[输入文本] --> B[Token 化]
    B --> C[词嵌入]
    C --> D[Transformer 层]
    D --> E[输出概率]
```
```

约束：
- Mermaid 图表必须有明确的 `graph` 类型（LR/TD/BT/RL）
- 节点文本使用中文，简洁明了
- 复杂架构图使用子图（subgraph）分组

### 2.8 数学公式使用规范

行内公式使用 `$...$`，块级公式使用 `$$...$$`：

```markdown
注意力权重的计算公式为：

$$
\text{Attention}(Q, K, V) = \text{softmax}\left(\frac{QK^T}{\sqrt{d_k}}\right)V
$$

其中 $Q$、$K$、$V$ 分别代表查询矩阵、键矩阵和值矩阵，$d_k$ 为键向量的维度。
```

约束：
- 每个公式必须配文字解释，说明每个符号的含义
- 不连续堆砌多个公式，公式之间用文字过渡
- 行内公式仅用于简单符号引用（如 $d_k$），完整公式使用块级

### 2.9 交互组件使用规范

在 Markdown 中引用已注册的 Vue 组件：

```markdown
以下是一个分词演示，可以输入文字查看 Token 化结果：

<TokenDemo />
```

约束：
- 组件名使用 PascalCase
- 组件必须先在 `theme/index.ts` 中注册
- 组件应有合理的默认状态，不依赖外部数据加载

---

## 3. 交互组件规格

### 3.1 TokenDemo.vue — 分词演示

| 属性 | 说明 |
|---|---|
| 功能 | 用户输入文本，实时展示分词结果 |
| 输入 | 文本输入框，默认值 "大语言模型正在改变世界" |
| 输出 | 每个 Token 显示为独立色块，标注 Token ID |
| 交互 | 输入框实时响应，Token 块可悬停查看详细信息 |
| 技术约束 | 使用简化的 BPE 规则模拟，不需要调用真实 API |
| 样式 | Token 块使用品牌色系，亮暗模式适配 |

### 3.2 AttentionViz.vue — 注意力权重可视化

| 属性 | 说明 |
|---|---|
| 功能 | 展示自注意力机制的权重矩阵热力图 |
| 输入 | 预设一句话（如 "猫坐在垫子上"），分词后展示 |
| 输出 | 二维热力图矩阵，行列为 Token，颜色深浅表示注意力权重 |
| 交互 | 鼠标悬停某个单元格时高亮对应的行列，显示权重数值 |
| 技术约束 | 使用预设权重数据（硬编码），不需要真实模型推理 |
| 样式 | 热力图使用蓝-红渐变色阶，亮暗模式适配 |

### 3.3 WordEmbedViz.vue — 词向量降维可视化

| 属性 | 说明 |
|---|---|
| 功能 | 展示词向量在二维空间中的分布，体现语义相似性 |
| 输入 | 预设 20-30 个词语（含语义聚类） |
| 输出 | 二维散点图，语义相近的词在空间中距离更近 |
| 交互 | 鼠标悬停显示词语，可拖拽旋转视角（可选） |
| 技术约束 | 使用预设降维后坐标（硬编码），使用 SVG 或 Canvas 渲染 |
| 样式 | 散点使用品牌色，不同语义类别用不同色调区分 |

---

## 4. Cloudflare Pages 部署规格

### 4.1 构建配置

| 配置项 | 值 |
|---|---|
| 构建命令 | `npm run build` |
| 输出目录 | `docs/.vitepress/dist` |
| Node.js 版本 | 22（或 20+） |
| 环境变量 | `NODE_VERSION=22` |

### 4.2 部署流程

```
1. 本地开发 → npm run dev → 预览调试
2. git push → GitHub 仓库更新
3. Cloudflare Pages webhook 触发 → 自动构建
4. 构建产物部署到 CDN → 线上更新
```

### 4.3 缓存策略

在 `docs/public/_headers` 文件中配置：

```
/assets/*
  Cache-Control: max-age=31536000
  Cache-Control: immutable
```

### 4.4 域名

- 初期：`<project-name>.pages.dev`（Cloudflare 默认域名）
- 后续：绑定自定义域名（待定）

---

## 5. Agent 执行约束

### 5.1 执行顺序

Agent 必须按以下顺序执行，不可跳步：

```
Step 1: 更新 WEB_DESIGN.md
  ├─ 1.1 消除与 REDESIGN.md / STYLE_GUIDE.md 的冲突
  ├─ 1.2 目录结构改为扁平（见 §1.3）
  ├─ 1.3 侧边栏新增第 0 章，链接路径改为扁平（见 §2.2）
  ├─ 1.4 章节骨架新增"〔深入·可选〕"和"参考文献"（见 §2.6）
  └─ 1.5 写作风格约束更新为"严谨且亲和"（见 §5.2）

Step 2: 项目初始化
  ├─ 2.1 创建 package.json（见 §2.1）
  ├─ 2.2 创建 .gitignore（见 §7.3）
  └─ 2.3 安装依赖（npm install）

Step 3: VitePress 配置
  ├─ 3.1 创建 .vitepress/config.mts（见 §2.2）
  ├─ 3.2 创建 theme/index.ts（见 §2.3）
  ├─ 3.3 创建 theme/styles/custom.css（见 §2.4）
  └─ 3.4 创建 public/ 目录和 _headers

Step 4: 首页
  ├─ 4.1 创建 docs/index.md（见 §2.5）
  └─ 4.2 确认首页 hero 按钮跳转到 /ch00-overview

Step 5: 撰写第 0 章内容
  └─ 5.1 创建 docs/ch00-overview.md（见 REDESIGN.md §3 开篇规格）

Step 6: 创建第 2-18 章骨架文件
  ├─ 6.1 创建 17 个骨架 .md 文件（ch02 ~ ch18）
  └─ 6.2 每个骨架含：标题、导引、小节标题占位、小结占位

Step 7: 开发 3 个 Vue 交互组件
  ├─ 7.1 开发 TokenDemo.vue（见 §3.1）
  ├─ 7.2 开发 AttentionViz.vue（见 §3.2）
  └─ 7.3 开发 WordEmbedViz.vue（见 §3.3）

Step 8: 本地验证
  ├─ 8.1 npm run dev → 检查所有页面渲染
  ├─ 8.2 检查侧边栏导航、翻页、搜索功能
  ├─ 8.3 检查 Mermaid 图表渲染
  ├─ 8.4 检查数学公式渲染
  ├─ 8.5 检查交互组件功能
  ├─ 8.6 检查亮色/暗色模式切换
  └─ 8.7 npm run build → 确认无构建错误
```

### 5.2 内容撰写约束

#### 5.2.1 语言规范

| 规则 | 正确示例 | 错误示例 |
|---|---|---|
| 严谨且亲和，用"你"对话 | "你大概率已经用过 ChatGPT" | "嘿，你知道 ChatGPT 吗" |
| 适度口语，去权威化 | "把每一步说人话：切成小块（Token）" | "下面笔者将为您阐述 Token 化之要义" |
| 类比是首选入口工具，用完回到严谨表述 | "注意力机制类似于图书馆检索。其核心操作是计算查询矩阵与键矩阵的点积……" | "注意力就像你读书时盯着重点看，就这么简单" |
| 公式配文字解释，公式在直觉之后 | "前面说大模型在'预测下一个词'，用更精确的语言讲……（公式在后）" | （开篇直接抛公式） |

#### 5.2.2 章节结构约束

每个章节文件必须包含：
1. `# 第 N 章 标题`（一级标题，唯一）
2. `## 本章导引`（紧跟标题，用 blockquote 作为高层预览）
3. 正文内容（使用 `## N.x` 二级标题分节，优先从体验切入）
4. `## N.x〔深入·可选〕标题`（含公式/形式化的小节，开头用 blockquote 说明可跳过）
5. `## 本章小结`（末尾，3-5 个要点列表）
6. `## 参考文献`（末尾，编号引用列表；零公式章节可省略）

禁止：
- 在正文中使用一级标题（`#`）
- 省略"本章导引"或"本章小结"
- 开篇即抛公式或定义，未建立直觉前不出现数学符号
- 用"笔者""吾人""综上所述""之"等书面腔代替正常对话
- 单个章节超过 3000 字（超长应拆分）

#### 5.2.3 公式约束

- 每个块级公式（`$$...$$`）后必须有文字解释段
- 公式中所有符号必须在文字中定义
- 行内公式（`$...$`）仅用于已定义符号的引用
- 禁止连续两个块级公式之间无文字过渡

#### 5.2.4 Mermaid 约束

- 图表方向统一使用 `graph TD`（自上而下）或 `graph LR`（从左到右）
- 节点文字使用中文，简洁（≤8 字）
- 超过 10 个节点的图必须使用 `subgraph` 分组
- 禁止使用过于复杂的连线（交叉线过多时应重新设计）

### 5.3 代码规范

#### 5.3.1 Vue 组件规范

- 使用 `<script setup>` 语法
- 组件名使用 PascalCase
- Props 使用 TypeScript 类型标注
- 样式使用 `<style scoped>`
- 亮暗模式通过 CSS 变量适配，不使用硬编码颜色

```vue
<script setup lang="ts">
import { ref } from 'vue'

const inputValue = ref('大语言模型正在改变世界')

// 处理逻辑
</script>

<template>
  <div class="token-demo">
    <!-- 模板内容 -->
  </div>
</template>

<style scoped>
.token-demo {
  /* 使用 var(--vp-c-*) 变量 */
}
</style>
```

#### 5.3.2 文件命名规范

| 类型 | 规范 | 示例 |
|---|---|---|
| 章节文件 | `ch{两位数}-{kebab-case}.md` | `ch05-attention.md` |
| Vue 组件 | `{PascalCase}.vue` | `TokenDemo.vue` |
| 样式文件 | `{kebab-case}.css` | `custom.css` |
| 配置文件 | 按框架约定 | `config.ts` |

#### 5.3.3 Git 提交规范

提交信息格式：

```
<type>: <description>

type 可选值：
- init: 项目初始化
- feat: 新功能/新内容
- fix: 修复问题
- style: 样式调整
- docs: 文档更新
- chore: 构建/配置变更
```

示例：
```
init: 初始化 VitePress 项目结构与配置
feat: 撰写第 5 章注意力机制
feat: 开发分词演示组件 TokenDemo
fix: 修复暗色模式下公式渲染颜色
```

### 5.4 质量检查清单

每个 Step 完成后，Agent 必须执行对应的质量检查：

**Step 1-2 完成后（项目初始化 + 配置）**：
- [ ] `npm run dev` 能正常启动，无报错
- [ ] 访问 `http://localhost:5173` 能看到默认页面
- [ ] 目录结构与 §1.3 一致
- [ ] `config.ts` 中侧边栏链接路径与实际文件路径对应

**Step 3 完成后（首页与入口）**：
- [ ] 首页 hero 布局正确渲染
- [ ] "开始阅读"按钮能跳转到 `/ch00-overview`
- [ ] 文档入口页显示三个层级的概览

**Step 4 每章完成后（内容撰写）**：
- [ ] 章节包含"本章导引"和"本章小结"
- [ ] 所有公式配文字解释
- [ ] Mermaid 图表正确渲染
- [ ] 文风符合 STYLE_GUIDE.md（严谨且亲和，适度口语允许，禁止书面腔）
- [ ] 章节字数在合理范围（800-3000 字）
- [ ] 侧边栏中该章节链接可正常跳转
- [ ] 上一页/下一页导航正确

**Step 5 每个组件完成后（交互组件）**：
- [ ] 组件有合理的默认状态
- [ ] 交互功能正常（输入响应、悬停效果等）
- [ ] 亮色/暗色模式下均可正常显示
- [ ] 在 Markdown 中引用能正确渲染
- [ ] 移动端（窄屏）下布局不崩

**Step 6 完成后（本地验证）**：
- [ ] `npm run build` 零错误零警告
- [ ] 所有 18 章页面均可正常访问
- [ ] 搜索功能可用
- [ ] 主题切换功能正常
- [ ] 无死链（404）

**Step 7 完成后（部署准备）**：
- [ ] `.gitignore` 包含 `node_modules/`、`.vitepress/dist/`、`.vitepress/cache/`
- [ ] Git 仓库已初始化，代码已提交
- [ ] GitHub 仓库已创建并推送
- [ ] Cloudflare Pages 配置指引已输出给用户

### 5.5 禁止事项

1. **禁止使用未在 §2.1 中声明的依赖**，如需新增依赖必须在文档中更新依赖清单并说明理由
2. **禁止修改 VitePress 默认主题的核心布局结构**（侧边栏、导航栏、翻页），仅通过 CSS 变量自定义视觉
3. **禁止在内容中使用未经验证的技术细节**，所有关于 LLM 的技术描述必须准确
4. **禁止在交互组件中调用外部 API**，所有演示数据使用硬编码预设值
5. **禁止使用 `any` 类型**，Vue 组件中的 TypeScript 必须有完整类型标注
6. **禁止在 Git 提交中包含 `node_modules/` 或构建产物**
7. **禁止跳过质量检查清单**，每个 Step 的检查项必须全部通过后才能进入下一步

---

## 6. 执行里程碑

| 阶段 | 对应 Step | 交付物 | 验收标准 |
|---|---|---|---|
| M1 | Step 1-4 | 项目骨架 + 配置 + 首页 | `npm run dev` 正常，首页可访问 |
| M2 | Step 5-6 | 开篇 + 18 章文件 | 19 个 .md 文件，侧边栏可导航 |
| M3 | Step 7 | 3 个交互组件 | 组件在对应章节中正常渲染 |
| M4 | Step 8 | 构建验证 + 部署准备 | `npm run build` 通过，代码推送 GitHub |

---

## 7. 附录

### 7.1 内容章节主题速查

| 章 | 主题 | 层级 | 关键可视化 |
|---|---|---|---|
| 0 | 大模型全景 | 开篇 | Mermaid 学习地图 |
| 1 | 从一次对话说起：大模型到底在做什么 | 建立直觉 | Mermaid 全景流程图 |
| 2 | Token 化 | 建立直觉 | TokenDemo 组件 |
| 3 | 词嵌入 | 建立直觉 | WordEmbedViz 组件 |
| 4 | Transformer 架构概览 | 建立直觉 | Mermaid 架构图 |
| 5 | 注意力机制 | 建立直觉 | softmax 公式 + AttentionViz 组件 |
| 6 | 训练过程 | 建立直觉 | 交叉熵公式 + Mermaid 流程图 |
| 7 | 涌现能力 | 建立直觉 | — |
| 8 | 上下文窗口 | 理解边界 | RoPE 公式 |
| 9 | 幻觉问题 | 理解边界 | — |
| 10 | 能力边界 | 理解边界 | 能力雷达图（Mermaid） |
| 11 | 提示工程基础 | 理解边界 | 代码块示例 |
| 12 | 模型评估 | 理解边界 | — |
| 13 | 开源与闭源生态 | 走向实践 | Mermaid 生态地图 |
| 14 | 模型选择策略 | 走向实践 | Mermaid 决策流程图 |
| 15 | RAG 检索增强生成 | 走向实践 | Mermaid 架构图 |
| 16 | 微调入门 | 走向实践 | — |
| 17 | 部署方式概览 | 走向实践 | — |
| 18 | 成本与性能考量 | 走向实践 | — |

### 7.2 参考站点

| 站点 | URL | 参考维度 |
|---|---|---|
| Rust 语言圣经 | https://course.rs | 布局风格、章节组织、代码块 |
| Hello-Agents | https://datawhalechina.github.io/hello-agents | 内容分层、渐进式结构 |
| VitePress 官方文档 | https://vitepress.dev | 配置参考、组件用法 |

### 7.3 .gitignore 规格

```
node_modules/
docs/.vitepress/dist/
docs/.vitepress/cache/
*.log
.DS_Store
Thumbs.db
.env
.env.*
!.env.example
```
