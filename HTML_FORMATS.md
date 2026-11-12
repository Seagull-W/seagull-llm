# HTML 正文与板块格式

本文是 L2 正文格式规范，规定文件对、HTML 标记、公式、图注和组件用法。语气与组织按 [写作总则](./writing/README.md) 选择体例；页面外观见 [视觉规范](./VISUAL_STYLES.md)，接入与验证见 [发布流程](./writing/publishing.md)。

2026-10-16 起，除每日调研外的读者内容以 HTML 为正文主文件。每日调研、仓库指导文件和 ADR 保留 Markdown。站点继续使用 VitePress 提供导航、侧边栏、本页目录、标签、搜索、翻页、主题切换和阅读进度。

## 笔记 HTML 元素

笔记 HTML 元素沿用 Linux 隔离机制笔记的格式样本，按 [知识笔记体例](./writing/note.md) 组织正文。长文提供页内导航，图注与对应图形放在同一 `figure` 中。

HTML 源文件使用 `data-design="linux-notebook"` 标记，页内按实际内容维护以下元素：

- `header.note-hero`：真实栏目名、一个 h1、人工编写的摘要和主题标签。
- `nav.note-jump`：链接到已有小节 ID，长目录用原生 details 展开，右侧目录仍保留。
- `figure.note-diagram`：容纳机制、数据路径或阅读地图，图注标明简化范围；图形关系按对应体例确定。
- `section.note-panel`：按 h2 组织正文，保留稳定的标题 ID；原先从 h3 起步的页面应校正标题层级。
- `div.note-comparison`：偏好对、算法差异等并列概念的对照。
- `figure.note-figure`：原有配图、替代文本与可读图注。
- `div.note-table`：可键盘聚焦的横向滚动区域，宽表不撑开页面。
- `details.note-details`：可展开长代码与配置，保留复制与高亮；解释和标题放在折叠区域外。

这些元素的字体、配色和布局见 [共享文章阅读版式](./VISUAL_STYLES.md#共享文章阅读版式)。

### 文章流程图（2026-10-30）

`figure.note-diagram` 内的流程使用 `note-flow`，并列维度使用 `note-flow note-flow-options`。节点采用 `<div class="note-flow-step"><NoteFlowIcon kind="dialogue" /><strong>结构化对话</strong><span>角色、消息与轮次</span></div>`。`NoteFlowIcon` 为同步注册、服务端渲染的轻量 SVG 组件，不需要 `ClientOnly`。图形在 `components/flow-glyphs.ts` 集中维护，由作者根据节点含义明确选择。

SVG 仅作辅助，节点文字和图注必须能独立说明内容。颜色、线宽和响应式布局见 [流程图外观](./VISUAL_STYLES.md)。

## 文件与路由

使用 HTML 的读者页面由两个相邻文件组成。`name.html` 保存唯一正文，`name.md` 保存 title、description、tags、发布状态及 `contentFormat: html`，元数据下方只有 `<!--@include: ./name.html-->`。目录式页面使用 `index.html` 和 `index.md`。扁平文章路由如 `/cs336/lecture-01`，目录式文章如 `/papers/deepseek-r1/`。每日调研在 `docs/research/` 下直接维护 Markdown。

HTML 是页面模板片段，编译后直接出现在主文档中。不要添加 `html/head/body` 或第二个 `main`，也不要使用 iframe、`v-html` 或运行时拉取文章。HTML 中保留 Vue 组件和可选的顶层 `script setup`、`style scoped`；预览方法见 [发布流程](./writing/publishing.md)。

## 各板块约定

| 板块 | 根元素格式 | 格式补充与体例入口 |
| --- | --- | --- |
| LLM 科普书 | `article.format-book` | [科普书体例与内容计划入口](./writing/llm-book.md) |
| 论文与项目随谈 | `article.format-paper` | [知识笔记体例](./writing/note.md) |
| RL 学习笔记 | `article.format-lab` | [知识笔记体例](./writing/note.md)；实验区外观见视觉规范 |
| 西湖 RL 笔记 | `article.format-course` | [知识笔记体例](./writing/note.md)；LaTeX 导入页额外使用 `academic-lecture`，原 PDF 用 `details` 按需展开 |
| CS336 学习笔记 | 讲义用 `article.format-course`，作业和实验用 `article.format-lab` | [知识笔记体例](./writing/note.md) |
| Rust 学习笔记 | `article.format-code` | [知识笔记体例](./writing/note.md)；保留代码语言与复制操作 |
| Linux 学习笔记 | `article.format-system` | [知识笔记体例](./writing/note.md)；图解和分节面板使用上文元素 |
| 栏目首页与标签页 | `div.format-directory` | `DirectoryIntro` 包含标题与简介，接 `ChapterCards` 或 `TagsIndex`；保留 `pageClass: chapter-index` |
| 视频 | `div.format-gallery` | `VideoGallery` 管理封面、简介及观看入口 |
| 网站首页 | `div.format-home` | 首屏文案在 `docs/index.md` 的 `hero` 中维护；栏目入口来自 `docs/.vitepress/sections.json` |
| 每日调研 | Markdown | [调研体例](./writing/research.md)；目录登记见发布流程 |

科普书的「本章导引」正文和 `〔深入·可选〕` 小节开头的「跳过不影响主线」提示均使用 `<blockquote>`。章节顺序及提示内容按科普书体例确定。

### 西湖讲义导入格式（2026-10-27 试用）

现有第 1–6 讲的五篇 PDF 页面已由对应 LaTeX 源稿接入 HTML 正文。格式包含定义／定理／证明／算法区域；其视觉表现见 [西湖讲义学术排版](./VISUAL_STYLES.md)。

公式保留 `data-tex` 源码与原有编号，原 `eqref/ref` 转为可定位链接。文末原生 `details` 保留 PDF 及讲义目录，展开后才挂载异步 `PdfViewer`。本页目录保持启用，元数据移除旧 `pdf: true`、`outline: false` 和 `aside: false`。

HTML 是正文主版本；导入工具、来源摘要与 SHA-256、重跑参数和验证步骤见 [发布流程](./writing/publishing.md)。

## 正文示例

```html
<article class="native-document format-paper" data-format="paper" data-design="linux-notebook" aria-label="文章标题">
  <header class="document-intro note-hero">
    <h1 id="paper-title" tabindex="-1">文章标题 <a class="header-anchor" href="#paper-title" aria-label="文章链接">&#8203;</a></h1>
    <p class="note-deck">介绍本文问题与来源。</p>
  </header>
  <section class="document-section note-panel" aria-labelledby="method">
    <h2 id="method" tabindex="-1">方法 <a class="header-anchor" href="#method" aria-label="章节链接">&#8203;</a></h2>
    <p>正文说明。</p>
    <figure class="note-figure">
      <img src="/cs336/figures/lecture03-p45.png" alt="四个 GPU 各负责一层，前向和反向箭头连接相邻层。">
      <figcaption>各层分布在不同 GPU 上，后续层仍须等待前一层的结果。图源：CS336 第三讲，第 45 页，引自 Tay 等（2021）。</figcaption>
    </figure>
  </section>
</article>
```

每篇文字文章一个 h1，小节按 h2–h6 组织。标题 ID 要唯一且稳定，保留原有 ID 以兼容链接。标题内部的 `a.header-anchor` 同时供直接链接与全文搜索使用，不要省略。本页目录从正文标题生成，使用页面唯一滚动位置。

## 公式、代码与交互

公式在源 HTML 中保存 TeX，构建时转换为带辅助 MathML 的静态 SVG，无需在浏览器下载数学渲染器：

```html
<p>行内公式 <span class="math-inline" data-tex="V(s) = \mathbb{E}[G_t \mid S_t=s]"></span> 的说明。</p>
<div class="math-block" data-tex="Q(s,a) = r + \gamma \max_{a'}Q(s',a')"></div>
```

`data-tex` 必须对 `&`、`<`、双引号做 HTML 转义，分别写成 `&amp;`、`&lt;`、`&quot;`。保持上述元素和属性格式。不要把原始 LaTeX 分隔符直接散写在 HTML 正文中。

代码使用 `<pre v-pre><code>...</code></pre>`，转义示例代码中的 `<`、`>`、`&`，`v-pre` 防止示例中的 Vue 插值被执行。迁移内容已保留原有 Shiki 高亮与复制按钮；新增长代码示例可沿用对应结构，或使用简洁的 pre/code。

Vue 重组件继续全局异步注册，正文中使用 `<ClientOnly><ComponentName /></ClientOnly>`。本地脚本通过单独的顶层 `<script setup lang="ts">` 导入，路径相对于同目录源文件。

将读者需要看到的本地配图放入 `docs/public/` 下的栏目资源目录。上例文件为 `docs/public/cs336/figures/lecture03-p45.png`，HTML 的 `src` 从公共目录的根写起。HTML 接入层会为双引号中的静态根路径 `src` 和 `href` 补齐部署前缀；Vue 组件动态拼出的站内路径用 VitePress 的 `withBase`。随 HTML include 使用的 `./figures/` 相对路径曾在生产构建中漏拷贝，资源验证见 [发布流程](./writing/publishing.md)。

Mermaid 保留原有按需加载组件；HTML 中用 `<ClientOnly><Mermaid id="unique-diagram" graph="URL 编码后的 Mermaid 源码" /></ClientOnly>`，图 ID 在页面中唯一。局部样式使用独立的 `<style scoped>` 块；样式作用范围及共用实现见 [视觉规范](./VISUAL_STYLES.md)。

## 发布与验证

入口登记、标签、草稿、开发预览、发布验证、子路径部署和迁移工具统一按 [发布流程](./writing/publishing.md) 执行。
