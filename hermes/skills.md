# 写作与调研技能：选用、适配与来源

正文目的、规则强度与成稿标准统一见 [写作总则](../writing/README.md)。技能提供检索、组织或编辑方法；根据当前缺口选择，不把下表串成每篇文章必走的流水线。阶段回传、协作分工与发布权限见 [共用约定](README.md)。

## 按任务缺口选用

| 技能 | 适用阶段与作用 | 当前可用性 | 使用边界 |
| --- | --- | --- | --- |
| [seagull-research](../.agents/skills/seagull-research/SKILL.md) | 主题调研：识别证据缺口，检索、阅读、核对并综合材料 | 项目共用 | 按问题选方法；普通改写与给定材料核对无需扩大为主题调研 |
| [scholar-deep-research](../.agents/skills/scholar-deep-research/SKILL.md) | 多文献发现、去重、引文追踪、批量证据整理 | 项目已安装，0.5.0 | 可恢复的批量检索需要时使用状态流水线；来源数量和引用排名不证明质量 |
| [scientific-writing](../.agents/skills/scientific-writing/SKILL.md) | 已有证据基础上的学术报告、论文论证与正式投稿材料 | 项目已安装，元数据 2.1 | 按稿件用途选报告规范；一般技术调研不套正式投稿结构与审批流程 |
| [unslop-academic-writing](../.agents/skills/unslop-academic-writing/SKILL.md) | 学术初稿的空泛措辞、重复、过度强调与论断精度修订 | 项目已安装，元数据 1.0，含本地补丁 | 英文词表与 linter 只作编辑线索，不能给中文稿评分验收；结构和推理缺失先回正文解决 |
| [affirmative-first-writing](../.agents/skills/affirmative-first-writing/SKILL.md) | 检查防御性否定、预设反方与无信息增量的对照 | 项目共用 | 逐句判断作用；真实比较、事实更正、反证和证据限制保留，不设次数配额 |
| `humanizer-zh` | 中文初稿或现稿的语言编辑，保留事实、确定程度、衔接与作者声音 | Hermes 本机已安装；项目未随仓库分发 | 当前已核实名称为 `humanizer-zh`；用户写作 `humanier-zh` 时按此识别。用于润色，不承担研究和事实核验 |
| `humanizer` | 英文通用文稿的语言编辑与声音校准 | Hermes 本机已安装，元数据 2.5.1 | 与 Unslop 功能重叠，按语域择用；不为“有个性”补造观点、经历或情绪 |

委派备忘与阶段回传显式标注“本次选用的技能—用途”，有相关技能却未使用时只在影响交付时解释。实际成稿无需列出技能清单。文件存在、当前 Agent 能自动发现、实际执行成功分别说明；不要因 Hermes 能加载就声称 Codex 已自动注册。

## 本项目对上游规则的适配

以下适配在本页维护，技能原文中的写作默认值服从本项目总则和当前任务要求。

- **取材与研究。** Scholar 的八阶段状态文件、固定饱和阈值、引用排名与阶段 gate 按可恢复检索或可复现综述的需要采用。普通调研可以直接阅读和综合；对照证据决定是否继续查找。
- **科学写作。** Scientific Writing 的 ID 清单、投稿声明和审计工具用于相应的正式稿件。一般报告只采用相关方法。Agent 核对如实称为 Agent 核对，正式投稿的人类责任和批准仍由相应流程处理。
- **语言编辑。** Humanizer、Humanizer-zh、Unslop 和 Affirmative 的模式列表都是诊断线索。读者理解所需的动机、过渡、回扣、限定与术语可以保留；不以词频、句长、否定次数或分数代替试读。目标语域仍由任务决定，不自动改成口语、第一人称或戏剧化表达。
- **编辑后核对。** 修订保持事实、引用、数字、因果关系、比较对象、确定程度与作者立场；新证据另行核实。语言润色不能用来掩盖尚未完成的解释，也不保证通过任何 AI 文本检测器。
- **执行环境。** 上游提及的其他技能、MCP 和付费服务仅在已可用且当前任务获授权时采用。缺少作者范文时使用当前语域，不强制索取。安装版本固定，不自动更新；Scholar 使用 `SCHOLAR_SKIP_UPDATE_CHECK=1` 跳过自动更新检查。

## Humanizer-zh 与相关文风技能核对

2026-11-15 已读取本机 `/home/ubuntu/.hermes/skills/creative/humanizer-zh/SKILL.md`，并通过 GitHub 核对 [op7418/Humanizer-zh 固定版本](https://github.com/op7418/Humanizer-zh/blob/f4518a8eab97b8bfebc66a89d34320a89bef6930/SKILL.md)。该版本的修订日期为 2026-09-23，使用 31 项编辑线索，重点是保留语义和文体；没有把单个词或句式当作修改依据。具体建议以实际读取的版本为准，不用模式数量概括整个技能。

这一版本适合中文技术文稿的末轮表达修订：它明确保护事实与限定，允许必要连接词，保留正式语域，并允许已通顺的段落不改。它也限制默认文件编辑范围以保护标题和锚点；任务明确要求结构重写时，可以按授权重排并核对引用。

本机文件不是上游的逐字副本：比上述提交多了防御性否定与复述的个案补丁，SHA256 为 `d03428d0d69298312c814fab5fa1b8c6b42a19e5db73d3da2eb50c062dcc01b6`。本次仅核查和登记，未修改或重新安装全局技能。项目选用时按上面的语义编辑适配处理，不再将个案扩成通用禁令。

相关上游 [blader/humanizer v3.0.0](https://github.com/blader/humanizer/blob/v3.0.0/SKILL.md) 也已读取；它为英文编辑提供模式与声音校准。本机英文 `humanizer` 元数据仍为 2.5.1，不能把已查阅的上游版本说成已安装。中文技术稿可选 Humanizer-zh，英文研究稿可选 Unslop；两者都从已有内容开始，无法补足机制推理或验证论文。没有必要为同一段文字依次运行全部风格技能。

## 共用学术技能安装记录

安装日期：2026-10-16。以下三个技能均实际安装到 `/home/ubuntu/seagull-llm/.agents/skills/`。此处保留当时来源与验证；当前文件与安装记录的差异另行标注。

| 技能 | 选用来源 | 固定版本 |
| --- | --- | --- |
| scholar-deep-research | [SkillHub 的 Agents365-ai 分发包](https://skillhub.cn/skills/scholar-deep-research)，包内作者与主页指向 Agents365-ai/scholar-deep-research | 0.5.0 |
| scientific-writing | [KalarisLabs/research-agent-skills](https://github.com/KalarisLabs/research-agent-skills/tree/df088027ff233dc511fa74cb7f406b4e87fa438c/skills/scientific-writing) | 元数据 2.1，commit df088027ff233dc511fa74cb7f406b4e87fa438c |
| unslop-academic-writing | [KalarisLabs/research-agent-skills](https://github.com/KalarisLabs/research-agent-skills/tree/df088027ff233dc511fa74cb7f406b4e87fa438c/skills/unslop-academic-writing) | 元数据 1.0，同上 commit |

2026-10-16 的安装检索同时使用 SkillHub 与公开上游仓库。Scholar 的 GitHub main 原文地址当时返回 404，因此采用可下载的 SkillHub 0.5.0 分发包，不声称已核对其 GitHub 提交。其下载 ZIP SHA256 为 `3655d4b865d1f09e9a5b9508d72edfe1131935cca6967c91560494a8cbe01085`。同名 scientific-writing 有多个实现，本项目选用 KalarisLabs 版本，避免名称相同却内容不同。

详细来源与安装文件摘要见 [skills-installation.json](skills-installation.json)。这是安装溯源记录，不是调研质量检查文件。MIT 许可声明随上游保留，KalarisLabs 的仓库 LICENSE 另随两个技能保存。

2026-11-15 核对：Scholar 与 Scientific Writing 的 `SKILL.md` SHA256 仍与该安装记录一致；Unslop 已增加一条关于无意义否定的本地规则，其 `SKILL.md` SHA256 为 `677488837dff5a955d74b56b62fff66b52ca6ac7eecb8ee13489bad7cdf1fc83`，与固定上游逐字比较确认了该差异。安装 JSON 保留历史值，不能据此宣称当前目录全部未改。这里未重新核验三个包的完整文件树，也未自动升级。

## 环境

Hermes 的 `~/.hermes/config.yaml` 在原有 skills 配置下增加：

```yaml
skills:
  external_dirs:
    - /home/ubuntu/seagull-llm/.agents/skills
```

这是配置片段，不能拿它覆盖完整配置；原有 `creation_nudge_interval` 等设置保留。修改前备份存放在 Hermes 自身 `backups/`，不进入项目。

Scholar 的 Python 依赖安装在项目独立环境 `.research/tools/academic-venv/`，主要版本为 httpx 0.28.1、pypdf 6.21.0。环境被 Git 忽略；换机器需新建 Python 3.11+ 虚拟环境，再按 Scholar 的 requirements.txt 安装依赖。其余两个技能的工具仅用标准库，不要求 API key。

例如需要实际运行某个工具时，从本次任务目录调用：

```bash
/home/ubuntu/seagull-llm/.research/tools/academic-venv/bin/python \
  /home/ubuntu/seagull-llm/.agents/skills/unslop-academic-writing/scripts/slop_check.py \
  /绝对路径/draft.md --json
```

linter 非零退出可能表示风格命中，不等于程序失败或文章不合格；先读输出。Scholar 的网络搜索仍受来源接口、服务可用性和访问额度影响。安装不包含额外 MCP、paper-fetch 或其他关联技能。

## 本机验证记录

2026-10-16：Hermes 实际 `skill_view` 接口读取三个技能均返回 success；Codex CLI 认证可用。在当前外层沙箱中启动 CLI 曾因只读运行目录失败，经授权在外层沙箱之外启动后，子 Codex 保持 workspace-write，成功读取共用文档和全部技能，独立生成并回读了本地示例报告。事件记录包含 turn.completed，进程退出码为 0。

本地证据位于 `.research/handoffs/skills-smoke/`：task.md、report.md、result.md、retry-events.jsonl 与 retry-stderr.log。示例验证了保留 12%→9% 数据的英文改写，以及文献整理/知识汇报的意图区分。另通过 Scholar 自带的 29 项离线测试；Scientific Writing 的准则选择器和 Unslop 的风格检查器均返回有效 JSON，后者发现示例套话而退出 1，符合该工具语义。

上述 2026-10-16 验证覆盖 Hermes 技能加载与文档所示的 Codex CLI 交接执行；当时未通过飞书/微信网关发出真实委派消息，也未执行真实文献数据库的完整联网调研。连接器、网络检索与正式长篇任务仍按具体执行结果报告。
