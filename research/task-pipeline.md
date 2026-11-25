# 可选任务流水线契约

本页记录独立 CLI 的文件接口、运行状态与恢复方法。围绕指定主题或方向撰写论文调研，从[仓库入口](../AGENTS.md#论文调研)开始。

本流水线同样执行 [阶段回传与反馈](../hermes/README.md#阶段回传与反馈)：方案回传后可取材，初稿在本地报告处交付并等待反馈。程序状态和内部 `accept` 不代替操作者反馈；收到反馈改变范围时，按本契约更新任务绑定。

## CLI 模式与时间

| 模式 | 组织目标 | 默认时间策略 |
| --- | --- | --- |
| concept | 定义、直觉、机制、经典出处、例子、边界 | all-time，经典资料不限年代 |
| comparison | 在同一口径下比较方案、版本、成本与限制 | mixed，基础不限年代，现状单独核验 |
| landscape | 分类、演进、主要路线、代表工作、当前缺口 | mixed |
| decision | 约束、候选、证据、风险、条件化建议 | mixed |
| news | 明确窗口内的新进展及其证据 | recent，默认 7 天 |
| custom | 自定义问题和验收标准 | mixed，可调整 |

`all-time` 不代表忽略时效：回答当前状态的资料仍须 `role=current` 并通过近期日期检查。`mixed` 默认近期范围 365 天，可以按问题调整为数日到数年。日期未知的教材/文档可作为背景，保留日期空值与访问时间，不得据此断言“最新”。年份或月份按原精度保存，不补造具体日期。

## 从问题到报告

在完整仓库根目录执行。一次运行固定日期和 slug；这里用 2026-10-16 演示。问题、slug 和知识轴可完全脱离大模型领域。

```bash
python3 scripts/research-workflow.py plan --question "什么是因果推断，它与相关分析有什么区别？" --mode concept --slug causal-inference
```

先编辑 `.research/tasks/causal-inference/task.json`，细化范围、读者、排除项、术语和知识轴；把通用中文查询扩展成实际适用的中英文查询、同义词和原始资料入口。模板是起点，不是模型完成的调研计划。每个轴可设 `required`、`min_sources`（默认 2 个独立作品）、`require_primary`（默认 true）。术语消歧、比较对象、地域/版本或决策约束影响结论时应先明确；其余可陈述假设继续查。

```bash
python3 scripts/research-workflow.py discover --task .research/tasks/causal-inference/task.json --date 2026-10-16
```

读取 `.research/runs/2026-10-16-causal-inference/search-brief.md`，执行待查的网页检索，打开原文，写同目录 `search-log.json` 和 `evidence.json`。无需发布网站也能完成通用调研。

```bash
python3 scripts/research-workflow.py collect --task .research/tasks/causal-inference/task.json --date 2026-10-16
```

默认读运行目录内的这两个 JSON，也支持多次传入 `--import-items <文件>` 和 `--search-log <文件>`。每次 collect 要提交**累计全部证据和执行记录**；不隐式合并旧 bundle。它总会写 `review.json` 与 `bundle.json`。未达门槛返回非零，保留真实状态；这不是来源没有更新。

缺口优先复查尚未执行/受阻的原始查询；需要扩大覆盖时执行：

```bash
python3 scripts/research-workflow.py discover --task .research/tasks/causal-inference/task.json --date 2026-10-16 --round 2
```

它将 `review.json` 的 followups 追加到发现任务。完成补查，更新累计 JSON，再 collect。默认最多 3 轮、60 个查询、150 个候选、40 条已审阅证据，证据摘要合计最多 60000 字符。耗尽预算保留缺口；少量材料足以解决小问题时可在采集前调整轴与门槛，不能事后改指标掩盖失败。必需搜索受阻不算完成；有意义的无结果搜索可记 no-results。预算只是上限，质量审核通过即可停止。

资料齐全后：

```bash
python3 scripts/research-workflow.py prompt --task .research/tasks/causal-inference/task.json --date 2026-10-16
# 当前 Agent 读取 prompt.txt 和 research/task-article.schema.json，写 article.json
python3 scripts/research-workflow.py generate --task .research/tasks/causal-inference/task.json --date 2026-10-16 --runner external --article .research/runs/2026-10-16-causal-inference/article.json
python3 scripts/research-workflow.py report --task .research/tasks/causal-inference/task.json --date 2026-10-16
```

最后生成本地 `report.md`。证据不足但需要阶段性报告时，显式 `collect ... --allow-partial` 后写作，每个不足的必需轴必须有 gap 段，报告显示缺口。失败的 collect 产生的 bundle 不能绕过该开关直接写作。

新任务的 report 同时生成 acceptance-prompt.md。先按其中的审阅提示词实际读成稿并修订，再填写具体判断与位置，执行 accept；之后才 integrate/publish。不能用程序通过替代这一步。选择目录型交付时，须在 collect 前完成 cards.json 和所要求的源文件样本，article 使用 catalog-article.schema.json；详见 delivery-contract.md。

`run --task ...` 会做发现并停在 Agent 检索交接；带明确的 `--import-items` 时也可继续审查、写作和本地报告。默认 task runner 为 external；独立 CLI 可选 `--runner codex`，它只负责依据审阅证据写 JSON。`run --task` 不自动接入或发布网站。

## 按问题选择来源

不设固定机构/域名白名单。检索覆盖以下层次，按问题选择，不为凑来源数量添加无关材料：

1. 定义与基础：教材、大学课程、标准、规范、原始论文、官方文档。
2. 综合与追溯：综述、引用链、领域报告、参考书目；向前追经典出处，向后查新证据。
3. 当前实现与数据：固定版本源码、官方配置、数据集、技术报告、统计机构原始数据。
4. 争议与实践：反例、复现、负面结果、Issue、维护者讨论、社区经验。区分观点与验证结果。

通用搜索由 Agent 的网页工具完成；GitHub、知乎、用户提供资料或其他连接器按已有授权与各自 skill 使用，不自动申请新账号、接口费用或绕过限制。不能读取的资料记访问缺口。技术事实优先使用原始论文、官方文档或代码；综述和社区材料可用于发现线索与解释观点，需追溯关键事实。

`plan --profile academic` 在网页任务外增加 arXiv 和 Crossref 查询，仍需先编辑准确查询。自动发现适配器：

| provider | 用途 | 必填/关键字段 |
| --- | --- | --- |
| web | 任意领域的网页检索，交给 Agent | query |
| arxiv | 按任务查询论文，可不限年代，以相关性排序 | query（arXiv 语法） |
| crossref | DOI 学术元数据及可用摘要，跨学科发现 | query |
| url | 读取已知 HTTPS 网页或文本文件，提取有限文本 | url，可选 title/published_at |
| rss | 按任务读取某订阅 | url |
| github-releases | 某项目正式发布记录 | repository |

每个 search 都包含 `id`、`provider`、`axis_ids`、`role`（foundation/current/critical/practice）、`time_policy`（all-time/recent）、`required` 和 `limit`。`url` 的纯文本提取候选不代表 Agent 已阅读，也不保证网页正文提取完整；PDF 由 Agent 的 PDF 工具读取并记录页码。不能读取的页面不会被填成全文。arXiv/Crossref/url 的原始响应保存在本地 `raw/` 并记录 SHA256；RSS/Release 候选保留解析结果与来源，未声称保存原始响应。

接口依据：[arXiv API 手册](https://info.arxiv.org/help/api/user-manual.html)、[Crossref REST API](https://www.crossref.org/documentation/retrieve-metadata/rest-api/)及[过滤器](https://www.crossref.org/documentation/retrieve-metadata/rest-api/rest-api-filters/)。Crossref 有些条目只含元数据，不能直接拿标题写结论。

## 搜索执行记录

`search-log.json` 是数组。`search_id` 对应 discovery 中的 web job；日志中的 query 是实际执行的查询，可不同于计划。一个 job 多次查询时可合并 URL 和过程说明；结果为空和工具失败分开记录。不要将占位示例当作执行记录。

```json
[
  {
    "search_id": "definition-foundation",
    "query": "实际执行的中英文查询",
    "tool": "实际使用的搜索工具名称",
    "searched_at": "2026-10-16T10:00:00+08:00",
    "status": "executed",
    "urls": ["https://example.org/original"],
    "notes": "检索范围、追溯过程与访问限制；这里只演示格式"
  }
]
```

status 可为 executed、no-results、blocked。executed 必须有真实结果 URL；no-results 的 urls 为空。blocked 的 notes 说明失败原因。自动适配器的执行日志由脚本生成，不从手工日志覆盖。

## 已审阅证据

`evidence.json` 是数组。不能直接将 discovery.candidates 复制过来当作已读材料。

```json
[
  {
    "url": "https://example.org/original",
    "title": "真实原文标题",
    "summary": "实际读到且与问题相关的摘录或忠实概述，不补造未读内容",
    "published_at": "",
    "updated_at": "",
    "retrieved_at": "2026-10-16T10:10:00+08:00",
    "discovery_method": "browser-search",
    "access": {"method": "browser", "surface": "excerpt", "limitations": ["仅阅读下述定位段落"]},
    "reading_scope": "full-text-excerpt",
    "locator": "第 2 节，定义和例子；或 PDF 第 12 页",
    "version_note": "适用版本、评测条件或快照；未知则留空",
    "source_kind": "textbook",
    "authority": "primary",
    "independence_key": "原始作品或实验的稳定标识，同一作品的转载沿用它",
    "axis_ids": ["definition"],
    "search_ids": ["definition-foundation"],
    "role": "foundation",
    "stance": "context",
    "relevance": "这段材料如何回答该知识轴，能支持什么、不能支持什么"
  }
]
```

source_kind 可用 original-paper、review、textbook、course、official-docs、standard、dataset、code、report、research-blog、community；authority 用 primary、secondary、community。这里的 primary 表示当前主张的直接出处，不是权威性/正确性的自动评分；教材可以直接支持其定义，不能据此冒称原始实验。stance 用 supports、contradicts、context。reading_scope 用 abstract、manual-excerpt、full-text-excerpt、feed-excerpt、release-notes。

同一 URL 多次摘录应先合并为一条，保留各处定位；不同 URL 转述同一作品要共享 independence_key。脚本检查独立键，不可能自动证明两个作者/实验独立。证据来源可来自引文追踪，不要求出现在直接搜索结果里，但必须指向真实执行过的 search_id。

## 审核、写作和发布边界

`review.json` 按轴检查独立来源数量、直接出处、必需检索的执行状态，并列出反驳材料和缺口；单域名、无日期、全摘要等情况给出提示。来源数量不是语义正确性的判定器。Agent 仍须核对每项主张的原文支持、版本/条件、矛盾和局限。`covered` 仅表示结构门槛满足，不能在报告中改称“已经证明”。

文章沿用顶层 bundle_sha256/title/description/sections，每段新增 kind、axis_ids：fact 是有直接支持的事实，inference 是明确标注的推断，gap 只描述未解决的问题。事实和推断必须引用同轴证据；已知缺口不能省略。该输出接口使用纯文本段落；需要丰富排版时按网站流程处理，已接入的流水线文章修改后必须更新绑定与验收，不能直接改网页绕过检查。

问题文件与 bundle 分别以内容哈希绑定。discover 之后改任务必须另开 slug/run；已有 article.json 后如需补查，应按工具支持的新运行重新采集、生成文章并验收，不能沿用旧文章绑定。discover 重跑复用已成功查询，重试失败的自动适配器；网页执行状态以审查时合并的 search-log 为准，缺口通过新轮次继续。全局锁仍只覆盖单次调用，人工检索/写作间隙应确保同一任务只有一个执行者。

运行状态依次为 awaiting-research、needs-followup/reviewed、reported；网站接入后另记 integrated、built、pushed、site-verified。本地报告不会被网站 verify/publish 误当成已经接入的文章。

新任务另有 accepted 内容验收状态，与构建/发布分开。程序检查的 ready/covered 仍不等于负责人读后接受。

任务模式默认交付本地 Markdown 报告。用户要求接入网站时才执行 `integrate --task ...`、`verify --task ...`。已授权发布时再执行 `publish --task ...`，核验 CI/部署与 `verify-site --task ...`。调研栏目接入遵循[发布流程](../writing/publishing.md)，证据与数字口径按[写作总则](../writing/README.md#跨类硬规则)。

离线验证：

```bash
python3 scripts/test-research-workflow.py
python3 scripts/test-research-tasks.py
```

测试不等于真实网络检索、模型写作或线上部署；实测记录见 TASK_VALIDATION.md。

## 新任务的证据记录

带 delivery 约定的新任务，在原 evidence 字段上增加：

```json
{
  "discovery_method": "browser-search",
  "access": {
    "method": "browser",
    "surface": "excerpt",
    "limitations": ["只读取定义段和示例，未通读全文"]
  }
}
```

discovery_method 可用 browser-search、web-search、api、citation、direct-url、connector、user-file。access.method 用 browser、http、api、local-file、connector；surface 用 full-text、excerpt、screenshot、downloaded-data。搜索摘要和 metadata 留在候选/搜索日志，不作为已审阅事实证据。没有观察到访问限制可填空数组；截图必须说明其范围限制。URL、版本、定位和 retrieval 时间仍按 task-pipeline.md 记录。

这些标注必须对应真实操作，不能为了通过检查谎报 full-text 或 downloaded-data。程序检查来源记录是否自洽；负责人仍须判断原文是否支持文章里的说法。
