# Hermes 串行交接模板（Codex 调研 → Antigravity 写作）

> **硬约束（逐字填空，禁止发挥）：**
> 1. Hermes **只能替换 `<...>` 占位符**，严禁改写用户原话，严禁在模板外新增“建议结构”、自定义子问题、比较轴或额外约束（结构与写法全权交由 `agy` 独立决定）。
> 2. 严格串行：必须等阶段一进程完全退出并生成 `research-notes.md` 后，再启动阶段二，严禁并行跑多个 CLI。
> 3. 启动阶段二前，由 **Hermes 先执行 `cp .agents/skills/paper-research/assets/article.html <draft-v1.html>`**，让 `agy` 零 Bash 局部编辑，避免空跑并省去重写内置 CSS 的消耗。
> 4. 关键节点主动汇报：Codex 结束报一次简短进度、`agy` 结束报一次简短进度，全部完成后**必发最终完成情况与产物附件**。

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
- 仅做调研与事实核对，不代替写作，不写最终 HTML；轻量单线程执行，不拉起并发子进程；允许联网检索：<是/否>；禁止提交或发布。
```

---

## 阶段二：`task-write.md`（交给 Antigravity CLI `agy`，独立写作与 HTML 交付）

```markdown
## 用户原话（逐字保留，禁止改写）
> <原样粘贴与阶段一完全相同的用户消息；修订轮追加用户最新反馈原话>

## 已核对调研笔记与目标文件
- 调研笔记：`<绝对路径，如 .research/handoffs/<task>/research-notes.md>`
- 上一版初稿：`<修订轮填旧稿绝对路径；初稿轮填“无”>`
- 目标输出文件（已预先复制内置 CSS 底稿）：`<绝对路径，如 .research/handoffs/<task>/draft-v1.html>`

## 本轮任务与边界（固定文本，Hermes 不得增改）
- 目标文件已预先复制好 `assets/article.html` 全部内置样式；**禁止调用任何 Bash/shell 命令**，直接用文件编辑工具只修改 `<title>`、少量补充 `<style>` 与 `<article>...</article>` 内部，严禁从头重写基础 CSS。
- 按 `.agents/skills/paper-research/SKILL.md` 第 3–4 节与 `references/research-html-guide.md`，独立完成文章结构编排、精简正文撰写、表格与宽/窄双版内联 SVG 绘图（连线文字加不透明底色防穿线；次要口径放进 `details.supplement`；正文角标统一用 `<sup id="cite-N"><a href="#ref-N">[N]</a></sup>` 并确保参考文献回链 `href` 指向真实存在的正文 `id`）。
- 事实以 `research-notes.md` 为依据；发现缺口时如实标注或按原文定位复核，绝不编造；完成后停下等待用户反馈，禁止提交或发布。
- 单进程轻量执行，不拉起多个子代理或常驻后台服务。
```
