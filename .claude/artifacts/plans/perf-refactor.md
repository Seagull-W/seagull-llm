# Web 性能架构重构 Implementation Plan

> Status: APPROVED
> Source: .claude/artifacts/designs/perf-refactor.md
> Mode: (default)
> Iterations: 1 / 3
> Author: user
> Last updated: 2026-09-02

## Requirements summary

seagull-llm（VitePress 文档站）首页及全站交互不流畅，表现为首屏加载慢、滚动/动画掉帧、交互响应迟滞。根因为用法问题：`theme/index.ts` 同步注册全部组件使章节页重组件（含 NextTokenViz→useModelManager→transformers 链路）进入首页主 bundle；满屏 `backdrop-filter` + `body` fixed 多层渐变；SeagullLens rAF 常驻；Layout 拖拽无节流。本 plan 把已收敛的 spec 拆成 cite 到文件/行号的实施步骤，保留 VitePress（ADR 0001）。

## Acceptance criteria

- AC-1 构建后首页入口 chunk 不含 `@huggingface/transformers` / ONNX wasm / NextTokenViz 引用。
- AC-2 用户首次访问首页（未点加载模型按钮）时网络请求不含模型权重文件。
- AC-3 NextTokenViz/TokenDemo/AttentionViz/WordEmbedViz 重组件仅在访问其所在章节后加载对应 chunk。
- AC-4 `useModelManager.loadRealModel` 仅由用户点击按钮触发，不自动触发。
- AC-5 SeagullLens 无交互且淡出完成后无活跃 rAF。
- AC-6 侧边栏拖拽用 rAF 批处理，不再每帧同步写 DOM + Vue 重渲染。
- AC-7 首页 Lighthouse Performance（移动端模拟）较重构前提升，且移动端 Performance 绝对值 >= 70。
- AC-8 `npm run build` 零错误零警告，SSG 首页 HTML 正常生成。

---

## RALPLAN-DR

### Principles

1. 最小代码：改 `theme/index.ts` 注册方式能解决就不重写组件。
2. 跟随 spec In scope，不擅自扩（不动后端代理、不换框架）。
3. 外科手术式：每步 cite 文件/行号，不碰无关代码。
4. 可验证：每步对应 AC，build + 网络面板可验证。
5. 渐进收益：先拆包拿最大首屏收益，再逐项减负，分阶段验证。

### Decision drivers

1. 首屏加载性能（用户主诉之一，AC-1/AC-2/AC-7）。
2. 改动成本/风险（保留 VitePress、不破坏现有模型功能）。
3. SSR 兼容性（原 `[object Promise]` 约束必须解决，不可回归）。

### Viable options

**Option A: 组件级异步注册（defineAsyncComponent）** 【favored → chosen】
- 实现思路：`theme/index.ts` 把 NextTokenViz/TokenDemo/AttentionViz/WordEmbedViz 改为 `defineAsyncComponent(() => import(...))`，SeagullLens/HilbertQuote/ReadingProgress/ChapterTag 保留同步。章节页组件引用包 `ClientOnly`。Vite 自动按组件 split chunk，首页不再加载章节页重组件。
- 改动文件：`theme/index.ts:1-23`、`docs/llm-book/ch01-what-is-lm.md`、`ch02-tokenization.md`、`ch03-embedding.md`、`ch05-attention.md`。
- Pros：改动集中（~5 文件），VitePress/Vue 原生，最小代码，直接命中 AC-1/AC-3；模型加载本就是按钮触发（`useModelManager.ts:197 loadRealModel`），保持即满足 AC-4。
- Cons：重组件 chunk 在路由进入章节页时即加载（非"点击按钮后"），但 spec 只要求模型权重点击后加载——已满足；章节页首屏仍背组件 chunk。

**Option B: 组件级异步 + 占位懒挂载**
- 实现思路：A 基础上，章节页重组件先用轻量占位，用户点"开始演示"才挂载真实组件（加载 chunk）。
- 改动文件：`theme/index.ts` + 4 章节 .md + 新建懒挂载 wrapper 组件。
- Pros：章节页首屏也不背重组件 chunk，极致按需。
- Cons：改动大、每个演示需加入口按钮、交互变重。

**invalidation rationale for B**：spec 的"按需加载"约束明确为"模型和重组件在对应页面 + 点击按钮后加载使用"——模型权重已由按钮触发；重组件 chunk 在路由进入时加载符合"对应页面"语义。B 超出 spec，违反最小代码原则，rejected。

---

## Planner draft

### Implementation steps（基于 Option A）

1. `theme/index.ts:1-23` — `import { defineAsyncComponent } from 'vue'`；NextTokenViz/TokenDemo/AttentionViz/WordEmbedViz 改 `defineAsyncComponent(() => import('../components/XxxViz.vue'))`，配 `loadingComponent`/`errorComponent` 占位；保留 SeagullLens/HilbertQuote/ReadingProgress/ChapterTag 同步（首页/全局必需）。
2. `docs/llm-book/ch01-what-is-lm.md`、`ch02-tokenization.md`、`ch03-embedding.md`、`ch05-attention.md` — 组件引用包 `<ClientOnly><NextTokenViz /></ClientOnly>`，解决 SSR 异步组件 hydration / `[object Promise]`。
3. `components/SeagullLens.vue:24-47,89-110` — `animate()` 中 `lensAlpha < 0.001 且 !isHovering` 时 `cancelAnimationFrame(rafId)` 并置 `rafId=0`；`onMouseMove`/`onTouchStart` 在 `rafId===0` 时重启 rAF。
4. `theme/Layout.vue:61-68,94-100` — `onMouseMove` 用 rAF 批处理：设 `pending` flag，`requestAnimationFrame` 内统一 `applyWidth` + 更新 `sidebarWidth`，避免每帧同步写 + Vue 重渲染。
5. `theme/styles/custom.css:103-117` — `body` 移除 `background-attachment: fixed`（改默认 scroll），减少滚动重绘；评估 `backdrop-filter` 叠加（`:500-531` NavBar/Sidebar、`:379-465` Feature、`:598-603` SearchBox），移动端 `@media (max-width:768px)` 降级为半透明纯色无 blur。
6. `config.mts:138-155` — Google Fonts 已有 preconnect + `display=swap`，保持；首屏若仍受字体阻塞改自托管（本次默认不动，列为 follow-up）。
7. 验证：`npm run build` → 检查 `dist/assets/llm-book_index.md.*.lean.js` 不引用 NextTokenViz/transformers chunk；`npm run dev` → Lighthouse 首页。

### Workspace setup

- 实施前运行 `git status --short` 和 `git branch --show-current`。
- 当前 `main` 分支，working tree 有未追踪 artifact（`.claude/`、`CONTEXT.md`、`docs/adr/`、`docs/rl-book/cha1-指令微调/`）。**先提交 artifact 文档**（或单独提交），避免与代码改动混入。
- 因在 `main` 且会改核心文件（`theme/index.ts`、`Layout.vue`、`custom.css`），推荐 worktree：`git worktree add -b codex/perf-refactor ../seagull-llm-perf-refactor`。
- 若直接在 `main` 工作，先 `git add` + 提交现有 artifact 再开始改代码。

### Open questions

- AC-7 量化目标（LCP<2.5s / Performance>=90 / CLS<0.1 / INP<200ms）待用户确认或实现阶段跑分回填。

---

## Architect challenge

### Steelman against favored option (Option A)

最强反驳：Option A 的拆包只解决"组件代码进主 bundle"（加载维度，AC-1/2/3），但首页**运行时**贵的渲染成本是满屏 `backdrop-filter` + `fixed` 背景 + Canvas rAF（AC-5/6）。A 把这些放在步骤 3/4/5，像"顺手优化"而非首要结构问题。若拆包后首页仍卡在滚动/动画，说明 A 低估运行时成本。反方论点成立的话，plan 应把"CSS 减负 + rAF 停表"提为第一优先级，拆包为第二，或并行。

**Synthesis**：拆包是首屏加载最大杠杆，运行时优化是滚动/动画杠杆，二者解决用户不同主诉、不冲突。反驳的真正价值是**提示不能只做拆包就声明完成**——运行时项必须同等落地。故保持 A 的步骤集，但在验证里把加载 AC（AC-1/2/3）与运行时 AC（AC-5/6）分开设通过门槛，不合并声明成功。

### Tradeoff tensions

1. **最小代码 vs SSR 兼容**：`defineAsyncComponent` 改动最小，但 VitePress SSR 下异步组件可能仍触发 `[object Promise]`（原注释痛点）。要彻底规避需 `ClientOnly` 包裹 md 引用，增加 4 个 md 文件改动。Planner 取舍：接受 md 包 `ClientOnly` 的额外改动——SSR 报错是不可接受的回归，违反 Principle 3（外科手术但不可回归）。
2. **backdrop-filter 视觉 vs 性能**：玻璃拟态是全站视觉身份（`custom.css` 设计），减负可能损害设计意图。Planner 取舍：不砍 blur，只降级移动端 + 移除 `fixed` 背景（影响小、收益大），保留桌面端视觉。

### Principle violations

无。Principle 5（渐进收益）与 tension 1 的取舍一致。

---

## Critic verdict

| 维度 | 状态 | 备注 |
|---|---|---|
| Principle-option consistency | ✓ | Option A 符合最小代码/跟随 spec/外科手术 |
| Fair alternative exploration | ✓ | Option B 真候选，有 invalidation rationale（超 spec） |
| Risk mitigation clarity | ✓ | 风险表每条对应 mitigation |
| AC testability | ✓ | AC-1~AC-8 二值可验证 |
| Verification concreteness | ✓ | 命令/网络面板/Lighthouse 具体 |
| File/line coverage | ✓ | 步骤 1-7 全 cite 文件:行号 |

### Verdict: APPROVED with reservations

### Reservations

1. **Reservation on step 2（ClientOnly 在 .md）**：VitePress 在 Markdown 中直接用 `<ClientOnly>` 包裹自定义 Vue 组件的语法需实现时先单页验证；若无效，回退为组件内部 `onMounted` 守卫或自带 `<ClientOnly>` 包裹。Mitigation 段未说明此回退路径，实现时务必先在 ch01 验证再批量改。
2. **Reservation on AC-7**：原"较重构前提升"底线过松（重构前极差时提升 1 分也算过）。已采纳 Critic 改进：加移动端 Performance 绝对下限 >= 70（见 AC-7）。

---

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| SSR `[object Promise]` 回归 | 异步组件 + `ClientOnly` 包裹 md 引用；先 ch01 单页 build 验证再批量 |
| 异步组件加载闪烁 | `defineAsyncComponent` 配 `loadingComponent`/`errorComponent` 占位 |
| 模型缓存/卸载逻辑回归 | 改加载时机不影响 Cache Storage 逻辑；回归测试 NextTokenViz 加载/卸载/n-gram fallback |
| backdrop-filter 减负损视觉 | 不砍 blur，仅移动端降级 + 移除 `fixed` 背景；保留桌面端视觉，视觉对比验收 |
| ClientOnly 在 .md 无效 | 回退：组件内部自带 `<ClientOnly>` 或 `onMounted` 守卫 |

## Verification steps

- AC-1：`npm run build` 后 `Select-String -Path dist/assets/llm-book_index.md.*.lean.js -Pattern 'transformers','NextTokenViz'` 应无匹配。
- AC-2：`npm run dev` 打开首页，DevTools Network 过滤 `.onnx`/`model_quantized` 应为空。
- AC-3：从首页导航到 ch01，Network 应出现 `NextTokenViz` 对应 chunk；首页时不出现。
- AC-4：代码审查 `useModelManager.ts:197 loadRealModel` 仅由 `NextTokenViz.vue` 按钮 `@click` 调用，无 `onMounted` 自动触发。
- AC-5：首页 hover SeagullLens 再移开，Performance 面板 rAF 空闲后无活跃回调；`rafId===0`。
- AC-6：代码审查 `Layout.vue` `onMouseMove` 含 `requestAnimationFrame` + `pending` flag。
- AC-7：Lighthouse 移动端模拟跑首页，Performance 较重构前提升且 >= 70；CLS/INP 无回归。
- AC-8：`npm run build` 零错误零警告，`dist/llm-book/index.html` 等正常生成。

---

## ADR

- **Decision**：Option A——组件级异步注册 + SeagullLens rAF 停表 + Layout rAF 节流 + CSS `fixed` 移除/移动端玻璃降级。
- **Drivers**：首屏加载性能、改动成本/风险、SSR 兼容性。
- **Alternatives considered**：Option A（chosen，最小代码命中 AC、保留 VitePress/视觉/模型功能）；Option B（rejected，超 spec、over-engineering）。
- **Why chosen**：最小代码改动直接命中 AC-1~AC-6；模型加载本就按钮触发无需改；保留 VitePress 与全站视觉身份。
- **Consequences**：首页主 bundle 减重（移除 4 个章节页重组件代码）；章节页重组件懒加载；SSR 需 `ClientOnly` 配合（不可回归）；移动端玻璃拟态降级为半透明纯色。
- **Follow-ups**：Google Fonts 自托管（未做，列为后续可选）；AC-7 性能数字目标实现阶段跑分回填。

## Review trail

- Planner draft v1：Option A 最小异步注册（7 步，cite 文件:行号）+ 运行时/CSS 优化。
- Architect challenge v1：steelman 提示运行时项不可降级为"顺手"，须与拆包同等落地；2 条 tension（最小代码 vs SSR、视觉 vs 性能）；synthesis 分阶段验证。
- Critic verdict v1：APPROVED with 2 reservations（ClientOnly 在 .md 需先单页验证、AC-7 加绝对下限 >= 70）。
- 改进应用：AC-7 加移动端 Performance >= 70 绝对下限；验证步骤明确 ClientOnly 回退路径。
- Final iterations: 1 / 3（一轮即 APPROVED）。
