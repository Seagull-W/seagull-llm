# HTML 正文与板块格式

2026-10-16 起，除每日调研外的读者内容以 HTML 为正文主文件。每日调研、仓库指导文件和 ADR 保留 Markdown。站点继续使用 VitePress 提供导航、侧边栏、本页目录、标签、搜索、翻页、主题切换和阅读进度。

## 2026-10-17 阅读设计修订

公开学术文章共用西湖讲义的阅读版式，包括六个 HTML 文字栏目和使用 Markdown 的每日调研。`theme/reading-design.ts` 根据源路径与公开范围启用 `academic-reading`，样式位于 `theme/styles/academic-reading.css`。正文使用本地 Noto Serif SC 和 720px 版心，开篇与分节以留白和分隔线划分。代码使用等宽字体，导航、图中标注、表格、图注和交互控件使用无衬线字体。首页、栏目目录、标签索引与视频各有自己的布局。

共享字体位于 `docs/.vitepress/theme/fonts/`，400／600 两个 WOFF2 子集由 `python scripts/update-reading-font.py` 根据当前公开文章生成；原字体缓存在忽略的 `.research/font-cache`，文章清单保存在 `scripts/data/academic-reading-pages.json`。新增字符后更新子集，未覆盖字符使用系统宋体回退。原奖励建模比较开关已结束试用，使用确定后的学术排版。

笔记沿用 Linux 隔离机制笔记的内容结构。开篇交代问题与阅读线索，长文提供页内导航，机制、比较、公式和图片紧邻相关解释。现有栏目的普通文章只维护一份正文；纸海、像素航海、沿途的颜色与页面过渡由站点主题提供。栏目装饰与昼夜效果见 [VISUAL_STYLES.md](./VISUAL_STYLES.md)。

HTML 源文件使用 `data-design="linux-notebook"` 标记，页内按实际内容维护以下元素：

- `header.note-hero`：真实栏目名、一个 h1、人工编写的摘要和主题标签。
- `nav.note-jump`：链接到已有小节 ID，长目录用原生 details 展开，右侧目录仍保留。
- `figure.note-diagram`：根据当前文章绘制机制、数据路径或阅读地图，并注明简化范围；不把比较关系画成实际的因果流水线。
- `section.note-panel`：按 h2 组织正文，保留稳定的标题 ID；原先从 h3 起步的页面应校正标题层级。
- `div.note-comparison`：偏好对、算法差异等并列概念的对照。
- `figure.note-figure`：原有配图、替代文本与可读图注。
- `div.note-table`：可键盘聚焦的横向滚动区域，宽表不撑开页面。
- `details.note-details`：可展开长代码与配置，保留复制与高亮；解释和标题放在折叠区域外。

共用视觉由 `docs/.vitepress/theme/styles/notebook-design.css` 维护，样式限定在上述页面标记内，不改变调研页面。设计必须实际查看桌面、窄屏和暗色模式；构建通过不能替代视觉检查。

### 文章流程图（2026-10-30）

`figure.note-diagram` 内的 `note-flow` 使用白色阅读底、石墨灰文字与单一靛蓝强调色，共用样式在 `theme/styles/note-flow.css`。节点左对齐，以细线箭头和步骤号表达顺序；并列维度使用 `note-flow note-flow-options`，以分隔线区分，不显示箭头或步骤号。按文章可用宽度自动切换纵向布局，深色模式同步适配。

节点采用 `<div class="note-flow-step"><NoteFlowIcon kind="dialogue" /><strong>结构化对话</strong><span>角色、消息与轮次</span></div>`。`NoteFlowIcon` 为同步注册、服务端渲染的轻量 SVG 组件，不需要 `ClientOnly`。图形在 `components/flow-glyphs.ts` 集中维护，由作者根据节点含义明确选择；不按位置轮换图标或颜色，不再使用 `tone-0/1/2`。SVG 仅作辅助，节点文字和图注必须能独立说明内容。添加图形时使用统一线宽、视框和颜色变量，不在图中绘制正文文字。

LLM 科普书目前整体撤下：源文件保留，但不参与站点构建、导航、首页、卡片、标签、全文搜索与翻页。未经用户明确要求，不重新添加入口。此状态优先于下方保留的科普书格式约定。

## 文件与路由

使用 HTML 的读者页面由两个相邻文件组成。`name.html` 保存唯一正文，`name.md` 保存 title、description、tags、发布状态及 `contentFormat: html`，元数据下方只有 `<!--@include: ./name.html-->`。目录式页面使用 `index.html` 和 `index.md`。扁平文章路由如 `/cs336/lecture-01`，目录式文章如 `/papers/deepseek-r1/`。每日调研在 `docs/research/` 下直接维护 Markdown。

HTML 是页面模板片段，编译后直接出现在主文档中，不是嵌入另一个网页。不要添加 `html/head/body` 或第二个 `main`，也不要使用 iframe、`v-html` 或运行时拉取文章。HTML 中保留 Vue 组件和可选的顶层 `script setup`、`style scoped`，因此需要通过 `npm run dev` 或构建预览，而不是双击源文件。

## 各板块约定

| 板块 | 根元素格式 | 内容组织与阅读重点 |
| --- | --- | --- |
| LLM 科普书 | `article.format-book` | 章节标题、本章导引、概念图与交互演示、小节、小结与参考资料；新版内容遵循 `LLM_BOOK_PLAN.md` |
| 论文与项目随谈 | `article.format-paper` | 标题与来源、问题、方法、证据与结果、工程分析、适用边界及引用；图表紧邻分析 |
| RL 学习笔记 | `article.format-lab` | 学习目标、算法与公式、配置和命令、实验结果与分析；表格用等宽数字、结果区允许更宽布局 |
| 西湖 RL 笔记 | `article.format-course` | 概念、假设、公式推导、算法与课程资料；保持连续阅读。由 LaTeX 源稿导入的五篇讲义额外使用 `academic-lecture` 学术排版，原 PDF 在文末按需展开对照 |
| CS336 学习笔记 | 讲义用 `article.format-course`，作业和实验用 `article.format-lab` | 讲义保留课程概念与推导，作业和实验结合实现、运行条件与结果 |
| Rust 学习笔记 | `article.format-code` | 问题、概念和 API、代码示例、行为解释、易错点与速查；代码语言与复制操作保持可用 |
| Linux 学习笔记 | `article.format-system` | 机制总览、基础概念、机制图、命令与限制、组合边界、速查表；沿用隔离机制笔记的图解和分节面板 |
| 栏目首页与标签页 | `div.format-directory` | 标题与简介、`ChapterCards` 或 `TagsIndex`；保留 `pageClass: chapter-index` |
| 视频 | `div.format-gallery` | `VideoGallery` 管理封面、简介及观看入口 |
| 网站首页 | `div.format-home` | 首屏文案在 `docs/index.md` 的 `hero` 中维护；栏目入口来自 `content-catalog.ts` 的 `sections` |
| 每日调研 | Markdown | 调研正文及栏目卡片均使用 Markdown，卡片位于 `docs/research/index.md` |

正文沿用共享字体、行长与配色。确需给自定义组件配色时，用站点变量表达背景、正文和分隔线，例如 `--vp-c-bg`、`--vp-c-text-1`、`--vp-c-divider`。实验图与宽表可局部加宽，页面保留一处主滚动区域。

### 西湖讲义学术排版（2026-10-27 试用）

现有第 1–6 讲的五篇 PDF 页面已由对应 LaTeX 源稿接入 HTML 正文，沿用原路由、侧边栏与栏目卡片。正文采用本地 Noto Serif SC 字体子集、720px 版心、连续分节及轻量的定义／定理／证明／算法区域；共享样式位于 `docs/westlake-rl/lecture-academic.css`，只作用于 `academic-lecture`。此变体的开篇与分节不要求深色 hero 或白色卡片。

公式保留 `data-tex` 源码与原有编号，原 `eqref/ref` 转为可定位链接。长公式与宽表格局部滚动，行内公式遵循数学基线；源稿未附的教材插图不补造。文末原生 `details` 保留 PDF 及讲义目录，展开后才挂载异步 `PdfViewer`。恢复本页目录，移除旧 `pdf: true`、`outline: false` 和 `aside: false`。

导入工具为 `scripts/import-westlake-lectures.py`（需 Pandoc），来源摘要与 SHA-256 位于 `scripts/data/westlake-lecture-import.json`。HTML 仍为正文主版本；导入工具重跑须显式传 `--overwrite`，不能覆盖后续人工修订。使用原源目录重新导入时，应重新阅读成稿并运行 `node scripts/test-westlake-lectures.mjs`，核对编号、定理标题、证明、表格与 PDF 对照。字库按当前内容生成，新字需更新子集或使用系统宋体回退。

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

将读者需要看到的本地配图放入 `docs/public/` 下的栏目资源目录。上例文件为 `docs/public/cs336/figures/lecture03-p45.png`，HTML 的 `src` 从公共目录的根写起。HTML 接入层会为双引号中的静态根路径 `src` 和 `href` 补齐部署前缀；Vue 组件动态拼出的站内路径用 VitePress 的 `withBase`。随 HTML include 使用的 `./figures/` 相对路径曾在生产构建中漏拷贝，发布前应在构建预览中打开文章，确认实际图片加载且图注对应。三种风格共用同一张内容图。

Mermaid 保留原有按需加载组件；HTML 中用 `<ClientOnly><Mermaid id="unique-diagram" graph="URL 编码后的 Mermaid 源码" /></ClientOnly>`，图 ID 在页面中唯一。局部样式使用独立的 `<style scoped>` 块，不覆盖全局 body、导航或侧边栏；共用板块样式在 `docs/.vitepress/theme/styles/native-html.css`。

## 发布与验证

按 [新增内容.md](./新增内容.md) 接入侧边栏、栏目卡片和标签，也按其中的清单登记新栏目。普通栏目的文章卡片写在栏目 `index.html`；每日调研写在 `docs/research/index.md`。草稿、隐藏内容和内部记录按原有公开范围规则处理。

```bash
npm run tags
npm run test:content
npm run build
npm run dev
```

检查正文直接出现在主文档、目录锚点与侧栏正常、公式和交互可用、标签筛选与全文搜索覆盖公开文章而不包含草稿。子路径部署还需以 `BASE=/your-base/` 构建验证。迁移工具 `scripts/migrate-native-html.mjs` 仅处理尚未迁移的页面，已迁移页面直接维护 HTML。
