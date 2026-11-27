# 调研原生 HTML 排版组件速查

本指南服务于**论断清晰、图文并茂的原生 HTML 调研稿**。全套 CSS 与零依赖交互脚本（原图灯箱放大、场景切换、侧栏滚动高亮）已完整内置在 [../assets/article.html](../assets/article.html) 的 `.research-page` 中；上线到站内「每日调研」时，对应样式由 `docs/.vitepress/theme/styles/research-article.css` 承接并自动适配昼夜主题。

## 1. 先选对表达组件（发挥原生 HTML 优势）

| 表达目的 | 推荐组件 | 使用要点 |
| --- | --- | --- |
| 首屏速览多个核心问题判断 | `.thesis-bento` + `.thesis-card` | 2×2 卡片，每张卡给出“问题标签 + 关键量级徽章 + 一句话硬判断 + 决定性数字” |
| 每节开篇亮明核心论断与边界 | `.thesis-banner` | 一两句话直接给判断（`data-tone="caution"` 切琥珀强调），避免温吞过渡段 |
| 论文原图精读（曲线/相图/消融） | `.visual-card` + `.paper-studio` / `.paper-shot-pair` | 300 DPI 原图挂 `data-lightbox` 支持点击放大，紧邻配 3 栏 `.note-point` 拆解看图要点 |
| 跨论文定量光谱、架构解剖、决策相图 | `.visual-card` + 内联 `<svg>` | 信息图级绘制，不用简陋三框图；连线文字垫底色，保证文字不溢出边框 |
| 阶段跃迁 / 多路线正面对决数据表 | `.table-card` + `.bar-track` + `.delta-tag` | 关键数值列嵌比例进度条与涨跌徽章，最优行加 `.row-highlight`，反例行加 `.row-warn` |
| 正反机制对比 / 分类器偏科对照 | `.ab-grid` + `.ab-card` | 双栏并排呈现本质差异，配 `.pill-good` / `.pill-bad` 徽章 |
| 多场景工程选型速查 | `.decision-widget` | 2–3 个场景 Tab 切换展示“首选路线 / 算力账 / 必避陷阱”，零外部依赖 |
| 核心数学公式 | `.equation`（独立稿用 MathML；站内稿用 `data-tex`） | 只放决定理解的公式，下方 `.equation-note` 点出关键项物理意义 |
| 次要口径、评测差异与未核实空白 | `details.supplement` | 默认折叠，保持主线锋利 |
| 双向溯源引用 | `sup#cite-N > a` + `ol.reference-list` | 唯一锚点，确保每条 `.reference-backlink` 指向真实正文 `id` |

---

## 2. 首屏论断看板与章节论断条

```html
<div class="thesis-bento" aria-label="核心问题直接结论">
  <div class="thesis-card">
    <div class="thesis-q"><span>Q1 · 核心问题</span><span>关键锚点数字</span></div>
    <p class="thesis-verdict">一句话直接给判断，不绕弯。</p>
    <p class="thesis-evidence">一句决定性消融证据与出处角标<sup id="cite-1"><a href="#ref-1">[1]</a></sup>。</p>
  </div>
  <div class="thesis-card" data-accent="amber"><!-- 支持 default / amber / indigo / danger --></div>
</div>

<section class="article-section" id="sec-1">
  <h2><span class="sec-num">01</span>直接点破结论的章节标题</h2>
  <div class="thesis-banner">
    <strong>核心判断：</strong>用 1–2 句话点清机制与成立前提。
  </div>
  <div class="prose">
    <p>紧凑正文段落，保持 ~70ch 舒适行宽。</p>
  </div>
</section>
```

---

## 3. 原论文配图精读（带点击灯箱放大）

单幅宽图使用 `.paper-studio.wide-top`，双图并排对比使用 `.paper-shot-pair`；图片放在同目录 `./figures/`（站内放 `docs/public/research/<slug>/`）：

```html
<div class="visual-card">
  <div class="visual-card-header">
    <strong>原图精读 1｜直接写出这张图证明了什么</strong>
    <span class="visual-badge">来源：作者 (年份) Figure X · 点击原图可放大</span>
  </div>
  <div class="paper-studio wide-top">
    <div class="paper-shot" data-lightbox="./figures/fig-example.png" data-caption="原图完整图注说明。">
      <img src="./figures/fig-example.png" alt="清晰的图意替代文本" loading="lazy">
      <span class="zoom-hint">点击放大查看 300 DPI 原图</span>
    </div>
    <div class="studio-notes-row">
      <div class="note-point">
        <strong>1. 看基准线</strong>
        指出读者最该先盯住的曲线或趋势。
      </div>
      <div class="note-point" data-kind="warn">
        <strong>2. 看关键拐点</strong>
        给出精确坐标数字与反常反转现象。
      </div>
      <div class="note-point" data-kind="amber">
        <strong>3. 机制推论</strong>
        点破背后原因及适用边界。
      </div>
    </div>
  </div>
</div>
```

> 避坑：`.zoom-hint` 已设为图下方右对齐标签，绝不叠压原图坐标轴；`.note-point` 内只有首个直系 `<strong>` 独占一行，正文里的加粗关键词保持行内显示。

---

## 4. 内嵌比例数据条的视觉化表格

```html
<div class="table-card">
  <div class="table-scroll" role="region" aria-labelledby="tbl-1" tabindex="0">
    <table>
      <caption id="tbl-1">
        表 1｜核心路线等算力对照
        <span>口径与来源简注</span>
      </caption>
      <thead>
        <tr>
          <th scope="col">方案</th>
          <th scope="col" class="bar-cell">核心指标</th>
          <th scope="col">结论</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <th scope="row">基线</th>
          <td class="bar-cell">
            <div class="bar-wrap">
              <span class="bar-val">24.36</span>
              <div class="bar-track"><div class="bar-fill danger" style="width:45%"></div></div>
            </div>
          </td>
          <td>接近随机水平</td>
        </tr>
        <tr class="row-highlight">
          <th scope="row">最优方案</th>
          <td class="bar-cell">
            <div class="bar-wrap">
              <span class="bar-val">42.45</span>
              <div class="bar-track"><div class="bar-fill" style="width:80%"></div></div>
            </div>
            <span class="delta-tag">+18.1 pp</span>
          </td>
          <td><strong>等算力显著胜出</strong></td>
        </tr>
      </tbody>
    </table>
  </div>
</div>
```

---

## 5. 双栏正反对照卡与交互场景选型器

```html
<div class="ab-grid">
  <div class="ab-card">
    <h4><span>方案 A</span><span class="pill-good">优势场景</span></h4>
    <p>说明机制与关键消融数字。</p>
  </div>
  <div class="ab-card">
    <h4><span>方案 B</span><span class="pill-bad">失败陷阱</span></h4>
    <p>说明为何在对应条件下失效。</p>
  </div>
</div>

<div class="decision-widget" aria-label="工程路线交互选型">
  <div class="decision-tabs" role="tablist">
    <button class="decision-tab" role="tab" aria-selected="true" data-target="panel-a" type="button">
      <strong>场景 A · 条件描述</strong>一句话特征
    </button>
    <button class="decision-tab" role="tab" aria-selected="false" data-target="panel-b" type="button">
      <strong>场景 B · 条件描述</strong>一句话特征
    </button>
  </div>
  <div class="decision-panel is-active" id="panel-a" role="tabpanel">
    <div class="dp-box"><span class="kicker">首选路线</span><strong>核心方案</strong><br>执行要点。</div>
    <div class="dp-box"><span class="kicker">预算口径</span><strong>数据/算力量级</strong><br>关键参数。</div>
    <div class="dp-box"><span class="kicker">必避陷阱</span><strong>常见误区</strong><br>反例依据。</div>
  </div>
  <div class="decision-panel" id="panel-b" role="tabpanel"><!-- 同上 --></div>
</div>
```
