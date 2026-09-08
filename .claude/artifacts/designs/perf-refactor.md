# Web 性能架构重构 Spec

> Status: DRAFT
> Author: user
> Last updated: 2026-09-02

## Background

seagull-llm 是一个 VitePress 文档站（4 本"书"：llm-book / papers / rl-book / westlake-rl），首页为 Hero + 4 特性卡。用户反馈首页及全站交互明显不流畅，表现为：首屏加载慢/白屏久、滚动/动画掉帧、交互响应迟滞（用户未将"模型相关卡顿"列为主诉）。

经代码分析定位根因为**用法问题而非框架问题**：

1. `theme/index.ts` 为规避 SSR 下 `[object Promise]`，将所有组件**同步导入**主 bundle——其中 `NextTokenViz` → `useModelManager` → `import('@huggingface/transformers')`，使首页主包捆绑 transformers.js + ONNX Runtime（512MB 模型加载链路），即使用户从未使用模型功能也拖累全站首屏。
2. `custom.css` 满屏 `backdrop-filter: blur(14px) saturate(150%)`（导航栏、侧边栏、特性卡、搜索弹窗、按钮、HilbertQuote 叠加）。
3. `body` 用 `background-attachment: fixed` + 3 层 `radial-gradient`（fixed 背景滚动时强制重绘）。
4. `SeagullLens` 用 `requestAnimationFrame` 常驻循环（无 hover 仍每帧 clearRect+drawImage）。
5. `Layout.vue` 侧边栏拖拽用全局 `mousemove` 监听，每帧同步写 CSS 变量 + 触发 Vue 响应式更新，无 rAF 节流。

决策：保留 VitePress（见 ADR 0001），从架构层重构。

## In scope

- **组件按需加载/代码分割**：`theme/index.ts` 中重组件改为按路由/按交互懒加载（异步组件 + ClientOnly，解决 SSR `[object Promise]`），使首页主 bundle 不含 transformers.js / ONNX Runtime 链路。
- **真实模型推理严格按需**：`useModelManager.loadRealModel` 仅由用户在对应页面点击"加载真实模型"按钮触发；`useTokenizer` 同理仅在 TokenDemo 页面交互后加载；移除任何自动/预加载路径。
- **首页运行时减负**：`SeagullLens` Canvas rAF 改为空闲/按需驱动（无 hover 且淡出完成后 cancelAnimationFrame）；review `backdrop-filter` 用量，保留视觉但减少叠加层级或降级移动端；`body` fixed 多层渐变背景优化。
- **侧边栏拖拽节流**：`Layout.vue` 的 `mousemove` 改用 `requestAnimationFrame` 批处理，避免每帧触发 Vue 重渲染 + 同步 DOM 写。
- **字体加载**：Google Fonts 非阻塞（确认 display=swap + preconnect，可考虑自托管减少外链）。
- **首页主 bundle 体积下降**：首页入口 chunk 不再引用 transformers/ONNX。

## Out of scope

- 更换 SSG 框架（保留 VitePress，见 ADR 0001）。
- 砍掉真实模型推理功能（保留，仅改加载时机）。
- 内容/章节 Markdown 文本改动。
- 后端 ModelScope 代理逻辑（worker/functions）改动。
- 新增功能/页面。

## Assumptions

- 保留 VitePress 框架，做架构层重构（用户已确认）。
- 真实模型推理能力保留，但严格按需加载（用户已确认：仅在对应页面 + 点击按钮后）。
- 性能根因是组件加载架构 + 重 CSS 效果 + rAF 常驻，非框架本身。
- Mermaid 按图表类型分 chunk 已是默认行为（仅页面用到时加载），非首页主因，本次不重点改。

## Solution sketch

1. **组件懒加载**：`theme/index.ts` 中重组件改为 `defineAsyncComponent` / 异步注册，用 `ClientOnly` 包裹解决 SSR `[object Promise]`，使首页主 bundle 不含 transformers 链路。`SeagullLens`/`HilbertQuote`/`ReadingProgress`/`ChapterTag` 为首页/全局必需，保留但评估体积。
2. **模型按需**：确保 `loadRealModel` 仅由用户点击触发；`useTokenizer` 同理仅在 TokenDemo 交互后加载。
3. **首页动画优化**：`SeagullLens` 在 `lensAlpha` 收敛到 0 且无交互时 `cancelAnimationFrame`，`mouseenter`/`mousemove` 时重启；拖拽 resize 用 rAF 批处理。
4. **CSS 减负**：评估 `backdrop-filter` 叠加层级，对滚动性能影响大的改半透明纯色或减小 blur 半径；`body` fixed 背景改非 fixed 或减少层数；移动端降级。
5. **验证**：构建后检查首页入口 chunk 依赖图确认不含 transformers/ONNX；Lighthouse 跑首页。

## Edge cases & risks

| Category | Notes |
|---|---|
| SSR `[object Promise]` | 原同步导入正是为此；改异步需用 ClientOnly + 异步组件，验证 SSG 构建不报错 |
| 模型缓存失效 | transformers.js 依赖浏览器 Cache Storage 缓存 512MB；改加载时机不影响缓存逻辑，需确认卸载/重载仍正常 |
| 移动端 backdrop-filter | 移动端 blur 极贵；减负时需保证视觉不崩，或移动端降级 |
| 异步组件闪烁 | 重组件懒加载时首屏可能有占位闪烁，需 loading 状态 |
| Mermaid 首屏 | 首页无 mermaid 不受影响；章节页 mermaid chunk 按需加载保持 |
| 失败回退 | NextTokenViz 已有 n-gram fallback；懒加载失败需有错误边界 |

## Acceptance criteria

- AC-1 构建后首页入口 chunk（`index.md` 对应 lean js）的依赖图中不包含 `@huggingface/transformers` / ONNX wasm 引用 → grep 构建产物确认。
- AC-2 用户首次访问首页（未点击任何"加载模型"按钮）时，首页网络请求不含任何模型权重文件（`.onnx` / `model_quantized` 等）→ 网络面板验证。
- AC-3 `NextTokenViz` / `TokenDemo` / `AttentionViz` / `WordEmbedViz` 重组件仅在访问其所在章节页面后才开始加载对应 chunk → 路由切换后网络请求验证。
- AC-4 `useModelManager.loadRealModel` 仅由用户点击"加载真实模型"按钮触发，组件挂载/页面进入不自动触发 → 代码审查 + 行为验证。
- AC-5 `SeagullLens` 在无鼠标/触摸交互且淡出完成后，不再有活跃的 `requestAnimationFrame`（rAF id 为空）→ 性能面板/代码验证。
- AC-6 侧边栏拖拽时不再每帧同步写 DOM + 触发 Vue 重渲染，改为 rAF 批处理 → 代码审查。
- AC-7 首页 Lighthouse Performance 分数（移动端模拟）较重构前提升，且无 P50 以下明显回归 → 跑分前后对比（具体数字目标见 Open questions）。
- AC-8 `npm run build` 零错误零警告，SSG 构建首页 HTML 正常生成 → 构建验证。

## Open questions

- AC-7 的量化数字目标（如 LCP < 2.5s、Performance >= 90、CLS < 0.1、INP < 200ms）需用户确认，或由实现阶段跑分后回填；当前以"较重构前提升 + 无回归"为底线。

## Core entities (ontology)

| Entity | Type | Key fields | Relationship |
|---|---|---|---|
| 按需加载 | 架构原则 | 路由级/交互级触发 | 约束所有重组件 |
| 真实模型推理 | 功能 | Qwen2.5-0.5B ONNX, WebGPU/WASM | 仅 NextTokenViz，按需 |
| n-gram 模拟 | 功能 | 统计语言模型 | NextTokenViz 默认 fallback |
| 玻璃拟态 | 视觉风格 | backdrop-filter blur | 全站，需减负 |
| 海鸥透镜 (SeagullLens) | 组件 | Canvas rAF | 首页 hero |

## Interview metadata

- Mode: default
- Waves: 3
- Final ambiguity: ~30%
- Status: PASSED

### Clarity breakdown

| Dimension | Score | Weight | Weighted |
|---|---|---|---|
| Goal | 0.80 | 0.40 | 0.32 |
| Scope | 0.85 | 0.25 | 0.21 |
| AC | 0.35 | 0.25 | 0.09 |
| Context | 0.85 | 0.10 | 0.085 |

### Ontology convergence

- Wave1: 加载性能 / 运行时流畅度 / 交互响应（new baseline）
- Wave2: + 按需加载（new，stable）
- Wave3: 技术栈 = VitePress（confirmed）
- stability_ratio: 100%（no drift）
