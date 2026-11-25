# Hermes 串行交接模板（Codex 调研 → Antigravity 写作）

> **核心原则：原文透传、严格串行、零二次改写。**
> Hermes 不得改写用户原话，不得替下游预设提纲/比较轴/额外硬约束；必须等阶段一进程完全退出并生成 `research-notes.md` 后，再启动阶段二，严禁同时开启多个 CLI 进程。

---

## 阶段一：`task-research.md`（交给 Codex CLI，只做调研）

```markdown
## 用户原话（逐字保留，禁止改写）
> 在此原样粘贴用户消息；补查轮追加用户最新反馈原话。

## 附带材料与链接
- 原文链接 / PDF / 截图转写路径（无则填“无，由执行者自行检索”）

## 本轮任务与边界（仅调研，不写最终 HTML）
- 角色：按 `.agents/skills/paper-research/SKILL.md` 第 1–2 节完成选材、检索、读原文与事实核对。
- 输出：写一份精简、带原文章节/表格定位的调研笔记至 `<绝对路径，如 .research/handoffs/<task>/research-notes.md>`，涵盖：核心问题答案要点、关键机制/步骤、决定性实验数字与对比表素材、会改变核心结论的关键前提/缺口、原文出处列表。
- 约束：不写最终 HTML 排版；轻量单线程执行，不要拉起多余并发子进程；允许联网检索（是/否）；禁止发布。
```

---

## 阶段二：`task-write.md`（交给 Antigravity CLI `agy`，负责写作与 HTML 交付）

```markdown
## 用户原话（逐字保留，禁止改写）
> 在此原样粘贴与阶段一完全相同的用户消息；修订轮追加用户最新反馈原话。

## 已核对调研笔记与旧稿路径
- 调研笔记：`<绝对路径，如 .research/handoffs/<task>/research-notes.md>`
- 若为修订轮：上一版初稿绝对路径 `<draft-v1.html>`

## 本轮任务与边界（独立成文与 HTML 交付）
- 角色：按 `.agents/skills/paper-research/SKILL.md` 第 3–4 节与 `references/research-html-guide.md`，直接基于 `assets/article.html` 写出精简、首屏见主旨、多用 SVG 图表与对比表的独立 HTML。
- 事实边界：以 `research-notes.md` 为依据；如发现缺少影响结论的关键事实，直接标出缺口或按需核查对应原文定位，绝不编造。
- 输出：保存至 `<绝对路径，如 .research/handoffs/<task>/draft-v1.html>`，完成后停下等待用户反馈，禁止提交或发布。
- 资源约束：单进程轻量执行，不要拉起多个子代理或常驻后台服务。
```
