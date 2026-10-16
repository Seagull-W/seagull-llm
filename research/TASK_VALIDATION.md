# 通用检索与调研 v2 验收

日期：2026-10-16。本记录区分离线回归、真实网络发现、当前会话写作与网站构建；不代表独立 Agent 已自动完成全网检索。

## 回归与网站

- `python3 scripts/test-research-workflow.py`：旧日报 19 项通过，包含来源解析、日期筛选、去重、可选失败、旧知识轴和文章接入。
- `python3 scripts/test-research-tasks.py`：新任务流程 20 项通过，包含模式隔离、跨年代与无日期背景、近期资料日期限制、转载独立性、候选/证据分离、真实搜索状态、补查预算、摘要上下文预算、部分报告开关、缺口披露、跨轴引用、文章实际引用门槛、状态与本地报告、导航保留。
- `node scripts/test-public-content.mjs`：4 项通过；内部文档仍排除。
- `node scripts/check-research-content.mjs`：3 篇既有文章的目录、卡片、标签和公开范围一致。
- `npm run build`：通过，38.44 秒；保留现有的大分块提示。构建未发布网站。
- `git diff --check`：通过。

手工专题 `2026-10-16-post-training-rl-frameworks` 已登记进统一 catalog，移除侧边栏单独追加逻辑，防止以后生成入口时覆盖或重复。既有文章正文与原有标签不改写。

## 真实资料的小型端到端验证

问题：混杂如何使相关偏离因果，为什么不能随意控制变量？模式 concept，两个必需知识轴：共同原因、控制变量边界；每轴要求 2 个独立作品及直接出处。此例仅用于验收局部概念，不声称完成整门因果推断课程或真实数据分析。

本地目录：`.research/runs/2026-10-16-causal-smoke/`；任务：`.research/tasks/causal-smoke/task.json`。这些文件被 Git 忽略。

实际执行了：

1. CLI plan，细化范围、两轴和查询。
2. CLI discover：Crossref 实际返回 3 条候选，已知教材网页提取返回 1 条候选，共 4 条；两种适配器的原始响应保存于 raw/ 并记录 SHA256。
3. 当前会话用网页工具完成两次教材检索，打开作者讲义 PDF 和作者在线教材章节，记录真实 query、工具、结果 URL 与访问限制。
4. 导入 2 条已读摘录：一份 2020 年讲义，一份未取得可靠修订日期的在线教材。两条都未被新闻窗口或固定 RL 关键词排除。Crossref 的候选没有被自动当作正文证据。
5. CLI collect：两轴各有 2 个独立作品，ready=true；无日期材料保留警示。
6. CLI prompt，当前会话生成 article.json，再 CLI generate --runner external --article 校验，CLI report 生成本地 report.md；最终状态 reported。

阅读来源与定位：

- [Brady Neal 讲义](https://www.bradyneal.com/Introduction_to_Causal_Inference-Aug28_2020-Neal.pdf)：封面 2020-08-28；1.3.2 和 4.5.3，仅读取所列段落。
- [Scott Cunningham 在线教材第 3 章](https://mixtape.scunning.com/03-directed_acyclical_graphs)：3.1 及 Colliding 段；未获得可靠修订日期，不作为“当前最新”证据。

另尝试读取 Hernán/Robins 教材 PDF，但网页工具返回文件过大（约 11 MB），未把未读正文导入证据。未安装额外 PDF 下载器来绕过本次读取限制。

这次验证使用当前会话进行网页检索、阅读和写作，没有调用独立 Codex/Hermes 模型；没有运行 GPU、分析实际数据、integrate、Git 推送、启用定时或验证线上部署。

## 尚需按实际任务核验的边界

来源和知识轴随任务变化，本次两份教材不能代表所有来源类型已验收。arXiv 的跨年代查询参数、RSS 和 Release 兼容路径已做离线回归；不把它们说成本次又做了一轮真实网络验收。新站点、付费/登录连接器、独立 Agent 搜索能力和真实长篇调研需要在各自环境验证。

覆盖、独立键和引用映射只能检查结构。Agent 仍须核对原文是否支持主张、不同证据是否真独立、资料是否适用于目标版本和条件；预算耗尽时必须披露缺口。
