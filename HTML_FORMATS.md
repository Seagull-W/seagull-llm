# HTML 正文与板块格式

2026-10-16 起，除每日调研外的读者内容以 HTML 为正文主文件。每日调研、仓库指导文件和 ADR 保留 Markdown。站点继续使用 VitePress 提供导航、侧边栏、本页目录、标签、搜索、翻页、主题切换和阅读进度。

## 文件与路由

每个页面由两个相邻文件组成：`name.html` 保存唯一正文，`name.md` 保存 title、description、tags、发布状态及 `contentFormat: html`，正文只有 `<!--@include: ./name.html-->`。目录式页面使用 `index.html` 和 `index.md`。不维护两份正文，不自动从旧 Markdown 覆盖现有 HTML。路由保持 `/section/name` 或 `/section/`。

HTML 是页面模板片段，编译后直接出现在主文档中，不是嵌入另一个网页。不要添加 `html/head/body` 或第二个 `main`，也不要使用 iframe、`v-html` 或运行时拉取文章。HTML 中保留 Vue 组件和可选的顶层 `script setup`、`style scoped`，因此需要通过 `npm run dev` 或构建预览，而不是双击源文件。

## 各板块约定

| 板块 | 根元素格式 | 内容组织与阅读重点 |
| --- | --- | --- |
| LLM 科普书 | `article.format-book` | 章节标题、本章导引、概念图与交互演示、小节、小结与参考资料；新版内容遵循 `LLM_BOOK_PLAN.md` |
| 论文与项目随谈 | `article.format-paper` | 标题与来源、问题、方法、证据与结果、工程分析、适用边界及引用；图表紧邻分析 |
| RL 学习笔记 | `article.format-lab` | 学习目标、算法与公式、配置和命令、实验结果与分析；表格用等宽数字、结果区允许更宽布局 |
| 西湖 RL 笔记 | `article.format-course` | 概念、假设、公式推导、算法与课程资料；保持连续阅读。现有 PDF 讲义作为资料保留，`PdfViewer` 仍提供讲义目录 |
| Rust 学习笔记 | `article.format-code` | 问题、概念和 API、代码示例、行为解释、易错点与速查；代码语言与复制操作保持可用 |
| Linux 学习笔记 | `article.format-system` | 机制总览、基础概念、机制图、命令与限制、组合边界、速查表；沿用隔离机制笔记的图解和分节面板 |
| 栏目首页与标签页 | `div.format-directory` | 标题与简介、`ChapterCards` 或 `TagsIndex`；保留 `pageClass: chapter-index` |
| 视频 | `div.format-gallery` | `VideoGallery` 管理封面、简介及观看入口 |
| 网站首页 | `div.format-home` | hero 与 features 元数据仍在 `index.md`；首页主题组件保持现有入口 |
| 每日调研 | Markdown | 保留现有日报流水线、日期、目录和发布方式 |

共同视觉采用白色 `#fcfdff` 阅读底色、`#243247` 正文、`#59677a` 辅助文字、`#e1e7ee` 分隔线及对应栏目强调色；暗色跟随站点变量。正文使用现有中文系统字体，代码使用等宽字体。主文左对齐，优先控制行长，实验和机制图适度加宽；不要给整篇文章建立固定高度或独立滚动条。

## 正文示例

```html
<article class="native-document format-paper" data-format="paper" aria-label="文章标题">
  <header class="document-intro">
    <h1 id="paper-title" tabindex="-1">文章标题 <a class="header-anchor" href="#paper-title" aria-label="文章链接">&#8203;</a></h1>
    <p>介绍本文问题与来源。</p>
  </header>
  <section class="document-section">
    <h2 id="method" tabindex="-1">方法 <a class="header-anchor" href="#method" aria-label="章节链接">&#8203;</a></h2>
    <p>正文说明。</p>
    <figure>
      <img src="./figures/method.svg" alt="说明图中结构与关系">
      <figcaption>图的来源、范围和必要说明。</figcaption>
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

Vue 重组件继续全局异步注册，正文中使用 `<ClientOnly><ComponentName /></ClientOnly>`。本地脚本通过单独的顶层 `<script setup lang="ts">` 导入，路径相对于同目录源文件。图片保持相对路径，Vite 会处理资源；`/` 开头的站内链接与 public 资源由接入层补齐部署 base。动态组件链接使用 VitePress `withBase`。

Mermaid 保留原有按需加载组件；HTML 中用 `<ClientOnly><Mermaid id="unique-diagram" graph="URL 编码后的 Mermaid 源码" /></ClientOnly>`，图 ID 在页面中唯一。局部样式使用独立的 `<style scoped>` 块，不覆盖全局 body、导航或侧边栏；共用板块样式在 `docs/.vitepress/theme/styles/native-html.css`。

## 发布与验证

按 `新增内容.md` 完整接入侧边栏、栏目 `index.html` 卡片及标签。草稿、隐藏内容、内部记录的公开范围规则保持不变，不能为了 HTML 迁移放开标签索引过滤。

```bash
npm run tags
npm run test:content
npm run build
npm run dev
```

检查正文直接出现在主文档、目录锚点与侧栏正常、公式和交互可用、标签筛选与全文搜索覆盖公开文章而不包含草稿。子路径部署还需以 `BASE=/your-base/` 构建验证。迁移工具 `scripts/migrate-native-html.mjs` 仅处理尚未迁移的页面，已迁移页面直接维护 HTML。
