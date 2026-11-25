# Hermes 串行交接模板（Codex 调研 → Antigravity 写作）

> **硬约束（逐字填空，禁止发挥）：**
> 1. Hermes **只能替换 `<...>` 占位符**，严禁改写用户原话，严禁在模板外新增“建议结构”、自定义子问题、比较轴或额外约束（这些全部交给读过原文的 Codex 和 `agy` 决定）。
> 2. 必须等阶段一进程完全退出并生成 `research-notes.md` 后，再启动阶段二；严禁同时运行多个 CLI 进程。

---

## 阶段一：`task-research.md`（交给 Codex CLI，只做调研）

```markdown
## 用户原话（逐字保留，禁止改写）
> <原样粘贴用户消息；补查轮追加用户最新反馈原话>

## 附带材料与链接
- <原文链接 / PDF / 截图转写路径；无则填“无，由执行者自行检索”>

## 本轮任务与边界（固定文本，Hermes 不得增改）
- 按 `.agents/skills/paper-research/SKILL.md` 第 1–2 节完成选材、检索、读原文与事实核对（优先使用 `scripts/research-fetch.py`）。
- 输出精简、带原文章节/表格定位的调研笔记至 `<绝对路径，如 .research/handoffs/<task>/research-notes.md>`。
- 仅做调研与核对，不写最终 HTML；轻量单线程执行，不拉起并发子进程；允许联网检索：<是/否>；禁止提交或发布。
```

---

## 阶段二：`task-write.md`（交给 Antigravity CLI `agy`，负责写作与 HTML 交付）

```markdown
## 用户原话（逐字保留，禁止改写）
> <原样粘贴与阶段一完全相同的用户消息；修订轮追加用户最新反馈原话>

## 已核对调研笔记与旧稿路径
- 调研笔记：`<绝对路径，如 .research/handoffs/<task>/research-notes.md>`
- 上一版初稿：`<修订轮填旧稿绝对路径；初稿轮填“无”>`

## 本轮任务与边界（固定文本，Hermes 不得增改）
- 按 `.agents/skills/paper-research/SKILL.md` 第 3–4 节与 `references/research-html-guide.md`，基于 `assets/article.html` 独立决定文章结构、图表与排版，产出独立 HTML。
- 事实以 `research-notes.md` 为依据；发现缺口时如实标注或按原文定位复核，绝不编造。
- 输出至 `<绝对路径，如 .research/handoffs/<task>/draft-v1.html>`，完成后停下等待用户反馈，禁止提交或发布。
- 单进程轻量执行，不拉起多个子代理或常驻后台服务。
```
