# 调研 HTML 排版要素速查

本指南只负责**视觉呈现**，不规定文章结构、章节数或必选模块。所有 CSS 样式已完整内置在 [../assets/article.html](../assets/article.html) 的 `.research-page` 中，起稿时直接基于该文件替换正文，按需选用下方片段即可。

## 1. 先选对表达方式（多用图表省文字）

| 内容需要 | 推荐组件 | 使用原则 |
| --- | --- | --- |
| 首屏交代核心问题与结论 | `.article-header` + `.lead` | 2–4 句话直接给答案，不写空泛导读 |
| 流程、架构、机制对比或思路分岔 | `figure.figure` + 内联 `<svg>` | 优先用图替代大段流程叙述；节点少、字大、窄屏可读 |
| 多方法/多实验/多配置对比 | `.table-scroll` + `table` | 关键条件放表头或 `caption`，不在正文逐格复述 |
| 全文 1–2 处核心结论或关键前提 | `.callout` | 少而精，避免连续加框；普通段落清楚就不加框 |
| 解释少量术语或记号 | `dl.term-list` | 简短的“名称—解释”；复杂论证改回正文 |
| 核心数学公式 / 代码与配置 | `.equation`（MathML） / `pre.code-block` | 只写影响理解的公式，离线可用，紧邻说明符号 |
| 原文逐字摘录 | `blockquote` + `footer` | 仅在原文措辞本身影响判断时使用 |
| 次要细节、口径说明、检索范围 | `details.supplement` | 默认折叠，不打断主线阅读 |
| 关键判断溯源 | `sup > a` + `ol.reference-list` | 唯一锚点，点击可双向跳转 |

---

## 2. 页面骨架与篇首

短文保持 `assets/article.html` 默认的**单栏结构**即可，不必加目录。篇首用 `header.article-header` 直接亮明标题与核心结论：

```html
<header class="article-header">
  <p class="eyebrow">论文精读</p>
  <h1>直接点破核心问题或结论的标题</h1>
  <p class="meta">
    <time datetime="2026-11-24">2026 年 11 月 24 日</time>
    <span>·</span>
    <span>依据原文：Paper Title (arXiv v1)</span>
  </p>
  <p class="lead">用 2–4 句话直接回答核心问题，让读者 10 秒内看清全文主旨。</p>
</header>

<section class="article-section" id="mechanism">
  <h2><span class="section-number">01</span>核心机制</h2>
  <p>正文段落。</p>
</section>
```

> 仅在章节超过 4–5 节、确实需要跳转时，才把 `<main>` 外层改为 `<div class="layout">` 并加上 `<nav class="toc">`（宽屏侧栏）和 `<details class="toc-mobile">`（窄屏折叠目录）。

---

## 3. 图与表（优先使用）

### 3.1 内联 SVG 机制图

内联 SVG 随 HTML 离线可用。配色沿用页面暖白纸面系：浅绿节点 `#edf3ef`（描边 `#79a99b`）、普通节点 `#fbf9f5`（描边 `#bfc8c4`）、强调暖色 `#f2c690`、文字 `#26364a`、箭头 `#536773`。

```html
<figure class="figure" id="fig-flow">
  <svg viewBox="0 0 640 130" role="img" aria-labelledby="fig-flow-title">
    <title id="fig-flow-title">核心流程示意图</title>
    <rect x="12" y="34" width="170" height="60" rx="8" fill="#fbf9f5" stroke="#bfc8c4" />
    <rect x="235" y="34" width="170" height="60" rx="8" fill="#edf3ef" stroke="#79a99b" />
    <rect x="458" y="34" width="170" height="60" rx="8" fill="#fbf9f5" stroke="#bfc8c4" />
    <g fill="#26364a" font-size="18" text-anchor="middle">
      <text x="97" y="70">输入 / 问题</text>
      <text x="320" y="70">关键改动步骤</text>
      <text x="543" y="70">结果变化</text>
    </g>
    <g fill="none" stroke="#536773" stroke-width="2">
      <path d="M182 64 H225 M217 58 L225 64 L217 70" />
      <path d="M405 64 H448 M440 58 L448 64 L440 70" />
    </g>
  </svg>
  <figcaption><strong>图 1｜方法分岔点。</strong>简明说明图中重点与来源；每张 SVG 的 <code>id</code> 须保持唯一。</figcaption>
</figure>
```

> 窄屏适配与避坑：尽量控制宽图宽高比或采用紧凑竖向布局；若横向图在手机上字号过小，可提供 `.flow-wide` 与 `.flow-narrow` 两套 SVG（样式已在底稿中配置 `720px` 自动切换）。**若文字标签压在连线上，务必在 `<text>` 下垫一块不透明 `<rect fill="#f6f1e7">` 遮住线条，避免横线穿字。** 无真实数值时，不要用柱高/面积暗示实测大小。

### 3.2 对比表格

```html
<div class="table-scroll" role="region" aria-labelledby="tbl-1" tabindex="0">
  <table>
    <caption id="tbl-1">
      表 1｜核心方案对比
      <span>条件与口径简注（例如：相同基座与预算；来源：原文 Table 2）</span>
    </caption>
    <thead>
      <tr>
        <th scope="col">方法</th>
        <th scope="col">核心改动</th>
        <th scope="col">关键结果</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <th scope="row">基线</th>
        <td>固定单步流程</td>
        <td>68.6%</td>
      </tr>
      <tr>
        <th scope="row">改进方案</th>
        <td>增加动态反馈</td>
        <td>75.9%（+7.3 pp）</td>
      </tr>
    </tbody>
  </table>
</div>
```

---

## 4. 重点提示、公式、代码与引用

### 4.1 提示块（默认浅绿；`data-tone="caution"` 为暖黄）

```html
<div class="callout">
  <h3>核心结论</h3>
  <p>用一两句话概括最关键的判断及其成立前提。</p>
</div>

<div class="callout" data-tone="caution">
  <h3>关键边界</h3>
  <p>仅在会改变核心结论时，写出影响判断的前提或局限。</p>
</div>
```

### 4.2 术语表、原文摘录与代码

```html
<dl class="term-list">
  <dt>术语名</dt>
  <dd>一句话解释。</dd>
</dl>

<blockquote>
  <p>需要逐字讨论的原句。</p>
  <footer>—— <cite>论文标题</cite> §3.2</footer>
</blockquote>

<pre class="code-block"><code># 保留精确格式的配置或核心伪代码（HTML 标签须转义为 &lt; &gt;）
advantage = reward - group_mean</code></pre>
```

### 4.3 原生 MathML 公式（离线直接显示）

简单上下标直接用 `p<sub>θ</sub>`、`x<sup>2</sup>`；复杂公式用原生 MathML（裸写 `$...$` 在独立 HTML 中不会自动渲染）：

```html
<div class="equation">
  <math xmlns="http://www.w3.org/1998/Math/MathML" display="block">
    <mrow>
      <mover><mi>A</mi><mo>^</mo></mover><msub><mrow></mrow><mi>i</mi></msub>
      <mo>=</mo>
      <msub><mi>r</mi><mi>i</mi></msub>
      <mo>−</mo>
      <mfrac><mn>1</mn><mi>G</mi></mfrac>
      <munderover><mo>∑</mo><mrow><mi>j</mi><mo>=</mo><mn>1</mn></mrow><mi>G</mi></munderover>
      <msub><mi>r</mi><mi>j</mi></msub>
    </mrow>
  </math>
  <p>r<sub>i</sub> 为第 i 条轨迹奖励，G 为同组采样数。</p>
</div>
```

### 4.4 折叠次要细节与双向引用

次要实验口径、检索范围或补充细节放进 `<details class="supplement">`，保持正文干净：

```html
<p>
  关键判断写在这里。<sup id="cite-1"><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup>
</p>

<details class="supplement">
  <summary>补充口径与检索记录（按需展开）</summary>
  <p>版本信息、次要超参或筛选说明。</p>
</details>

<section class="article-section" id="references">
  <h2>参考文献</h2>
  <ol class="reference-list">
    <li id="ref-1">
      作者，<cite>论文或材料标题</cite>（年份/版本），定位：§3.2、表 2。
      <a href="https://arxiv.org/abs/0000.00000" target="_blank" rel="noopener">原文链接</a>
      <a class="reference-backlink" href="#cite-1" aria-label="返回正文引用">↩</a>
    </li>
  </ol>
</section>
```
