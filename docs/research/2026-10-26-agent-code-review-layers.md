---
title: "解读 Claude Code 团队的七层代码审查：风险分级、收敛与迁移边界"
description: "解读 Claude Code 团队关于 code review 的文章：七层检查各自挡住什么、风险分级怎样分配人工名额、agent 作者与 agent 审查者为何会互相拖住，以及这组数字在什么条件下才成立。"
date: "2026-10-26"
tags: ["每日调研", "Agent", "代码审查", "工程实践"]
---

# 解读 Claude Code 团队的七层代码审查：风险分级、收敛与迁移边界

一个团队每天往主干合并三万次改动、其中九成代码出自模型之手时，"谁读过这段代码"就不再是一个能回答的问题。Anthropic 的 Claude Code 团队把这个问题换成了另一个：这次改动可能怎么坏，哪一层检查——自动的还是人的——最该拦住它。换掉判据之后，审查从流程末端的关卡变成了贯穿写作过程的检查层，人的阅读集中到分类器判定为高风险的位置。[《How the Claude Code team does code review》](https://claude.dev/blog/solving-code-review-at-anthropic/)，2026-10-15

他们报告的结果是：6 月到 9 月，Claude Code 仓库合并的 PR 翻倍以上，被回滚的比例下降四成多。这个数字容易被读成"自动化让质量变好了"。更值钱的部分在文章后半段：他们承认自己一度把审查做成了不收敛的循环，一个 CLI PR 一夜跑了五十多轮还没结束，最后靠四条约束才把轮数压回去，一轮过审率从 65% 升到 78%。**如果只从这篇文章里带走一件事，应该带走"审查必须定义停止条件"，而不是那张七层流水线的图。**

## 判据换了，审查的位置也跟着换

Code review 一直做两件事：上线前找出并修掉问题，以及让团队对代码形成共同理解。文章主要谈第一件，第二件留在结尾。把"人有没有读"降级成代理指标之后，紧跟着变的是审查发生的时刻：以前是写完、开 PR、等同事；现在多数改动在被要求人看之前，已经被 Claude 至少审过一遍并改过一轮，更像写作时的拼写检查。

驱动这个变化的是成本结构。审查的成本有两段：人花在审上的时间，和人花在修坏代码上的时间。只压第一段没有意义——省下的时间会在第二段还回来。所以他们的目标函数是一对指标：多数 PR 最多经过一个人（作者本人可以算这一个人），同时回滚率和事故率不上升。人类时间的度量取人均批准数（中位数与 95 分位）、人工评论数、PR 等人的时长；回滚与事故率是护栏，一旦上升，说明时间没有被省掉，只是被挪走了。

这个目标函数有一个直接后果：**检查层本身成为系统的单点。** 当"人读过"不再是约束，质量的正确性就取决于每一层的覆盖范围与失效方式，以及失败发生之后能不能快速撤销。文章后面所有设计——分档、flag、合并队列、事故转 eval——都是在补这个单点的两侧。

## 七层，各挡什么、各漏什么

<figure>
  <img src="/research/2026-10-26-agent-code-review-layers/fig-a-life-of-change.svg" alt="一次改动从作者机器到用户的路径：验证、必需 CI、Claude 审查、安全审查、按风险分级的人工批准、合并队列、flag 与渐进发布、观察与回滚" loading="lazy" style="width:100%;max-width:660px;height:auto;display:block;border:1px solid var(--vp-c-divider);border-radius:6px" />
  <figcaption style="margin-top:8px;font-size:13px;line-height:1.65;color:var(--vp-c-text-2)">图 1（原文 FIG A）｜一次改动从作者机器到用户的路径。多数环节自动完成，人的注意力落在风险处。<a href="https://claude.dev/blog/solving-code-review-at-anthropic/">来源：claude.dev</a></figcaption>
</figure>

| 层 | 机制 | 挡住什么 | 前提与盲区 |
| --- | --- | --- | --- |
| 1 合并前自证 | 给 Claude 能运行的东西（测试、构建、与设计稿对比的截图），要求出示输出而非声称完成；再用新鲜上下文的 subagent 审 diff；内部另有查 bug、简化 diff、端到端行为、设计规范几支 skill | 常规错误，以及实现者对自己实现的偏袒 | 只覆盖能被脚本判定的目标；对"该不该这么做"无效 |
| 2 指令文件 | `CLAUDE.md` 交代技术栈、约定、目标与非目标；`REVIEW.md` 由 code owner 写"这块代码什么算坏" | 反复出现的同类评论 | 文件会过期；写太长会被淹没 |
| 3 PR 级 AI 审查 | 多 agent 并行找 bug，另一组投票确认，按严重度排序后贴行内评论，每条必须解答 | 逻辑错误、越界改动、边界条件 | 只读 diff 与周边代码，不构建不运行；排序不等于正确 |
| 4 安全审查 | 独立一遍，未解决的发现阻止合并；工具是 `/security-review` 与开源 GitHub Action | 注入、XSS、认证与授权、数据处理、依赖问题 | 开源 action 未针对 prompt injection 加固 |
| 5 CI | lint、类型检查、多平台测试、构建与打包；一个 CLI PR 可能跑几十项 | 可判定的失败 | 需要 CI 自身能扩展；他们同期 CI job 量涨了 25 倍 |
| 6 人工名额 | 分类器按改动定风险档：低风险自动检查全绿可免人工、中风险 1 人、高风险 2 人 | 高风险代码、会被人复制的架构、方向性判断 | 分类器漏判不可见；信任名单本身是策略 |
| 7 合并队列与回滚 | 合并队列在最新 main 上重跑全部检查；flag 先给内部员工、`latest` 先于 `stable`；flag 免部署关闭 | 两个各自通过的 PR 组合成坏 main；已漏过的错误 | 需要可撤销的发布方式与有人值守的 on-call |

### 指令文件的分工：把重复评论修在源头

当审查者反复标同一件事，他们的处理方式不是再解释一遍，而是改产生评论的地方：改进 skill、加一条 lint 规则、或者改指令文件。`CLAUDE.md` 每次审查都会加载，所以在大型仓库里保持简短，只写项目是什么、指向别的文档；审查者也会反过来标出违反约定的代码，以及那些让某行约定失效的改动。`REVIEW.md` 由 code owner 维护，写的是"在这个仓库里失败长什么样"——文档里是"它在撒谎"，配置里是"它把请求路由错了"——并限制 nit 的数量、列出应当跳过的路径、要求给出文件名与行号而不是从名字猜、要求摘要以计数开头、没有可修的就直说。

产品文档里有一条机制值得单独记：`REVIEW.md` 只从 base 分支或默认分支读取，从 PR 自己的改动里读不到。[Claude Code 文档：Customize Code Review](https://code.claude.com/docs/en/code-review-customize.md) 这意味着被审对象不能顺手改写审查它自己的标准。这属于权限设计而不是提示词技巧：任何"让审查者更懂我"的配置，都需要一条不对称的加载规则。

### 发现的验证：先投票，再让人看

PR 级的审查不是一次生成。多个 agent 同时找 bug，再由另一组对每个候选发现投票，票数足够才发布；只涉及风格、诊断、清理的建议被丢弃。这些过滤器在保留前用自家 PR 做过 A/B。留下来的发现按 Important、Nit、Pre-existing 标注——最后一项让 PR 没引入的旧 bug 不至于算在作者头上——每条都必须解决或带理由关闭。经常是 agent 在夜里把修复做掉，作者回来时看到的是一个已经过了一轮的 PR。

公开产品把同样的流程固定成四段：Find（多 agent 并行读 diff 与周边代码）、Verify（对照代码过滤误报）、Rank（去重并按严重度排序）、Post（行内评论、摘要与一个 check run）。同时有一条不能忽略的边界：**Code Review 从不批准或阻塞 PR，它的 check run 也不会以失败结束。** 合并决定留在团队自己手里。所以"低风险改动零人工合并"是仓库策略加分支保护的组合，不是这个产品的能力。

### 风险分级：改动定档，批准绑定提交

阶梯本身不复杂，难的是让阶梯不被绕过：

- **由改动定档，不由作者定档。** 一个分类器读改动给出风险档；第二个分类器再判断这次改动是否即便在同档里也需要额外一个人。
- **有些路径永远要人。** owner 标注的敏感路径，以及任何 CI workflow 文件，不受档位影响。
- **轻档只对信任名单开放。** 名单主要是拥有该仓库的团队，其他人一律需要第二个人批准。agent 的批准永远不占人的名额；自动审查可以让低风险改动通过，但不能填充需要人的位置。
- **发起改动的人就是责任人。** 在 agent 写的 PR 上，指挥 agent 的人算作必需的审查者之一，和亲手打字的处境相同。
- **批准绑定具体提交。** 一旦出现系统无法背书的新提交——agent 的推送、有人手工解掉的冲突合并——批准需要重新给一次。

这几条合起来把"审查"从一次判断改成了对一组状态的一致约束：档位来自内容，身份来自名单，批准挂在 commit 上。任何一处松动，零人工合并的路径就打开了。

## 收敛：这套流程唯一被自己的产物打回来的地方

七个层都在讲"怎样多挡一点"，文章里最诚实的一段却在讲"挡得太多会让流程停不下来"。

一个 CLI PR 一夜之间跑了五十多轮审查与修复，直到作者手动叫停。他们对审查者反复标记的内容跑 `git blame`：约 59% 是审查者第一遍时就已存在的代码。审查者很少在发现新 bug，它只是每轮再多挖出几个老问题。作者们把这个循环做得更长：既然每跑一轮都能抓到点东西，就默认多跑几轮，风险高的改动上这值得，每个 PR 上都这么做不值。

值得区分这里的两层原因。一层是审查者的目标函数：它被要求"找出 gap"，而"找出 gap"没有停止条件，任何足够大的代码里总能再找出几个。另一层是 agent 作者的修复成本：人可以几秒钟挥掉一个 nit，agent 会去修，于是一个 nit 变成一次提交、一次全量重审，噪音的代价随自动化程度上升而不是下降。这两个原因相乘，就有了五十轮的 PR。

他们的处理是把收敛变成硬约束：

- **轮数上限。** 三轮之后，审查者请作者退一步，重新考虑做法而不是继续改。
- **只审增量。** 头几轮之后只审新增的 diff。
- **按类别提示。** 标出 bug 的类别，让作者一次修掉所有同类实例，而不是修一行。
- **不重复。** 已经贴过的发现不再贴。
- **夜间扫存量。** 审查 agent 每夜跑已有代码，把老 bug 在别处暴露之前找出来。

效果用三个数度量，前后对比都在内部 PR 上：一轮审查加修复就通过的比例从 65% 升到 78%；需要五轮以上的从 8.9% 降到 1.5%；平均过审轮数从 2.08 降到 1.32。他们把 rounds-to-pass 与召回率并列跟踪，并把优先级写下来：先抓真 bug，再减轮数。

<figure>
  <img src="/research/2026-10-26-agent-code-review-layers/fig-d-convergence.svg" alt="收敛改动前后对比：一轮过审 65% 升到 78%，需要五轮以上的从 8.9% 降到 1.5%，平均过审轮数从 2.08 降到 1.32" loading="lazy" style="width:100%;max-width:660px;height:auto;display:block;border:1px solid var(--vp-c-divider);border-radius:6px" />
  <figcaption style="margin-top:8px;font-size:13px;line-height:1.65;color:var(--vp-c-text-2)">图 2（原文 FIG D）｜内部 PR 在收敛改动前后的过审轮数。三个量的分布同时向一轮集中，需要五轮以上的长尾几乎消失。<a href="https://claude.dev/blog/solving-code-review-at-anthropic/">来源：claude.dev</a></figcaption>
</figure>

官方的 best-practices 文档独立描述了同一个失效形态：一个被要求找 gap 的审查者通常会报告一些 gap，即便工作本身没问题，追着每条发现改会变成过度工程——多余的抽象层、防御性代码、为不可能发生的情况写测试。[Claude Code 文档：Best practices](https://code.claude.com/docs/en/best-practices.md) 两处说法合起来指向一个可迁移的一般形式：**任何以"找出更多问题"为目标的检查都必须同时定义停止条件**，否则它的产出会随运行次数增加，而边际价值下降。这个形式对自动修复机器人、fuzz、依赖升级机器人一样成立，不限于 code review。

## 让审查者变好：事故即评测集

改进循环的入口是事故本身。他们把造成过事故的 PR 连同 fix-forward 与回滚收集起来，由熟悉那段代码的工程师逐条确认 bug 是否存在、位于何处，形成一组专家核对过的用例。审查者每天对这套集合跑分；它的 prompt、工具或模型一改，就对着全部用例重新打分，分数上升才保留。事故越多，集合越大，任何一次改动都要通过全部历史。

<figure>
  <img src="/research/2026-10-26-agent-code-review-layers/fig-c-incident-eval.svg" alt="事故转评测集的循环：事故或回滚经专家核对成为用例，加入集合，审查者每次改动都对全集跑分，分数上升才保留" loading="lazy" style="width:100%;max-width:660px;height:auto;display:block;border:1px solid var(--vp-c-divider);border-radius:6px" />
  <figcaption style="margin-top:8px;font-size:13px;line-height:1.65;color:var(--vp-c-text-2)">图 3（原文 FIG C）｜事故变成用例，用例变成每日评分的全集；审查者的 prompt、工具或模型每改一次都要重新通过整套历史。<a href="https://claude.dev/blog/solving-code-review-at-anthropic/">来源：claude.dev</a></figcaption>
</figure>

噪音则用人的行为来度量，而不是用模型自评。审查者留下的每条评论按 PR 上的处理方式分类：被修了、被认为是错的、被认为是有意为之、被认为无所谓。另外在已知干净的 PR 上跑审查者，统计它报出的问题里有多少会导致有害改动。这两个量的区别在于，前一个度量使用侧的接受程度，后一个度量潜在危害，都不依赖"模型觉得自己对不对"。

这里有一处容易被误读的口径。产品公告说不到 1% 的发现被标为不正确，那是"这条发现是错的"的比例；"有意为之"和"无所谓"不计入不正确，但它们同样消耗审查轮次。所以低错误率与低噪音不是同一件事，文章里"噪音在 agent 作者身上更贵"的判断也不能用那个 1% 来反驳或支持。

## 数字的口径

同一篇文章里的数字来自不同系统、不同仓库、不同时间窗，混用会得到错误的结论。

| 数字 | 出处与条件 | 能支持什么，不能推出什么 |
| --- | --- | --- |
| 每日合并改动 5 月约 2,500 → 9 月逾 30,000 | Anthropic monorepo 的 merged changes per day，来自同期的[《Redesigning source control at Anthropic》](https://www.anthropic.com/engineering/redesigning-source-control)（2026-10-13，自研 VCS Scion，主分支历史约 100 GB） | 说明基础设施压力来自合并量；不能当作 Claude Code 仓库的规模，也不能当作功能产出 |
| Claude 写约 90% 的代码 | Claude Code 仓库自身的说法 | 只适用于该仓库；同期 CI 文章给的 80% 是 Anthropic 全部代码的口径，两者不能互换 |
| 6 月到 9 月 PR 翻倍、回滚比例降四成 | Claude Code 仓库 | 比例下降不等于绝对回滚下降：合并量翻倍而比例乘 0.6，绝对回滚数约为原来的 1.2 倍。他们的护栏写的是 rate，因此在其口径内成立 |
| 拿到实质审查评论的 PR 从 16% 升到 54% | 产品研究预览上线前后的内部比例（[Bringing Code Review to Claude Code](https://claude.com/resources/articles/code-review)） | 度量的是审查覆盖率，不是缺陷密度；覆盖率上升也可能只是评论变多了 |
| 千行以上 PR 84% 有发现、平均 7.5 条；五十行以下 31%、平均 0.5 条 | 同一产品公告，内部数月使用 | 说明发现量随 diff 规模增长；不能推出小 PR 的问题更少，只说明审查者的注意力与可发现性都跟规模走 |
| 单次审查约 20 分钟、平均 15–25 美元 | 产品公告的计费与耗时 | 属于产品服务成本；内部七层的总成本没有公开数字 |
| 一轮过审 65%→78%，五轮以上 8.9%→1.5%，平均轮数 2.08→1.32 | 内部 PR，收敛改动前后 | 是目前最能说明"定义停止条件有效"的证据；没有给出同期的漏检变化，所以不能单独证明质量没降 |
| 给 Claude 可运行验证让结果好 2–3 倍 | Boris Cherny 的估计 | 是经验判断，不是对照实验 |

另外两条背景数字来自他们同一时期的基础设施文章：工程师人均每季度产出是 2021–2025 年的 8 倍，Claude 写了其中 80%；六个月里 CI job 量涨了 25 倍、测试量涨了 10 倍。[《Agentic coding is straining CI》](https://claude.com/resources/articles/agentic-coding-is-straining-ci-heres-how-we-scaled-test-impact-analysis-at-anthropic)，2026-09-14 这解释了为什么第 5 层要有测试影响分析这种单独的系统，也解释了"多审几轮"在成本上根本不是免费的。

## 局限与开放问题

**风险分级的正确性没有被度量。** 整个零人工合并的路径依赖于分类器不把高风险改动判成低风险，第二个分类器还要能补上第一个的漏判。文章给出了分档规则、敏感路径与信任名单，但没有给出分类器的漏判率或人工复核抽检的结果。于是外部团队能抄到的只是结构，抄不到"该留多少缓冲"。

**他们自己也说还缺一个安全阀。** 目前发现坏合并仍靠作者、on-call 与回滚/事故看板；还没有在数字恶化时自动收紧审批的断路器，而工程师希望在更多代码走向零人工合并之前把它做出来。这句话实际上承认了当前状态在统计上依赖人的注意力没有断档。

**安全这一层有明确的外部依赖。** 他们推荐的开源安全审查 action 在自己的 README 里写明未针对 prompt injection 加固，只应用于审查可信的 PR，并建议把仓库配置成外部贡献者的工作流需维护者批准。[claude-code-security-review README](https://github.com/anthropics/claude-code-security-review) 也就是说，把它当成阻塞门时，"外部贡献者需批准"不是可选的运维细节，而是安全边界的一部分。HN 上的讨论还提了一条指标层面的问题：把 critical 发现当作误报关掉应当经过 AppSec，而且回滚率下降与漏洞增加完全可以同时发生——回滚与事故这对护栏并不覆盖安全。

**PR 级 AI 审查是静态阅读。** 产品文档写得很清楚：审查在 Anthropic 的托管环境里读 diff 与周边代码，不构建也不运行你的代码，仓库访问是只读的。所以"AI 审查很准"这类结论不能跨层使用：能跑的验证属于第 1 层与第 5 层，静态阅读抓不到只在运行时出现的失败。

**共同理解这一半没有度量。** 他们不设正式流程，理由是没人（也不需要有人）在脑子里装下整个代码库；想懂某块就让 Claude 写一块定制的解释，或者做一个可视化的小工具。这个论证在"要改一个模块"的场景里成立：读一行文案改动的 diff 学不到东西，读即将修改的模块的解释学到很多。代价出现在别处——跨模块改动、新人上手、交接时，理解是靠解释器按需生成的，而它的质量与"团队里有人真的读过"不是一回事。这是我的推断，文章没有给出这方面的任何测量。

<figure>
  <img src="/research/2026-10-26-agent-code-review-layers/fig-e-sharing-context.png" alt="示意图：想理解代码的某一片，就让 Claude 针对那一片写解释或做可视化，而不是逐行读 diff" loading="lazy" style="width:100%;max-width:660px;height:auto;display:block;border:1px solid var(--vp-c-divider);border-radius:6px" />
  <figcaption style="margin-top:8px;font-size:13px;line-height:1.65;color:var(--vp-c-text-2)">图 4（原文插图）｜共同理解不再靠逐行读 diff：挑出要理解的那一片，让 Claude 写针对它的解释，或做一个按自己学习方式组织的可视化。<a href="https://claude.dev/blog/solving-code-review-at-anthropic/">来源：claude.dev</a></figcaption>
</figure>

**社区对产量数字的怀疑值得记一笔。** HN 上这条讨论的批评集中在两点：每日合并改动数不是产出指标，回归可能只是换了个地方出现；以及 Claude Code 仓库数以千计的 issue 里有相当一部分是旧行为回归。[HN 讨论](https://news.ycombinator.com/item?id=50122951)，487 分 这些是观察与推断，不是测量，但它们指向一个真实的不对称：文章能报出"回滚比例下降"，却报不出"用户实际遇到的问题变少了"。

## 可以拿走的部分

把这套流程拆成三类，边界会比照着 checklist 抄清楚得多。

**今天就能装上或写下来的：**

- `/code-review`（任意套餐，本地跑一个轻量版）与 `/security-review`；团队版以上用 Code Review 做 PR 级审查，档位选 Quick／Standard／Deep，按仓库调。
- `CLAUDE.md` 写短，只留"删掉会让 Claude 犯错"的行；`REVIEW.md` 由 owner 写失败形态、限制 nit、列跳过路径、要文件与行号。
- 把验证做成卡口而不只是建议：Stop hook 能在检查通过前阻止回合结束，`/goal` 让独立评审在每轮之后重查。
- required CI、CODEOWNERS 与分支保护把鉴权、计费、CI 与发布流程钉死在人工；打开"新提交时废弃旧批准"；合并队列在最新 main 上重跑检查。

**需要自己建的：**

- 风险分档与敏感路径清单，以及档位由改动而非作者决定的判定方式。
- 信任作者名单，与"名单外一律两个人"的默认。
- 未解决的审查线程阻塞合并，并把 bot 批准排除在人工名额之外。
- 事故与回滚转成每日评测集，审查者每次改 prompt、工具或模型都重跑全套。
- 噪音度量：按人怎么处理评论分类，外加在干净 PR 上测误报。
- 轮数上限、头几轮之后只审增量、按类别修、不重复，以及夜间的存量扫描。

**先决条件（缺一项，抄到的就只是形状）：**

- 改动足够小，能被人快速读懂、调试和回滚。
- 发布可逆：flag 免部署关闭、一次性回滚、分阶段放量。
- CI 可信且能扩展，否则第 5 层会先崩，检查层再准也没用。
- 有内部使用面，让回归在用户之前暴露。

这套流程最值得照抄的不是七层本身。七层里有一半是任何成熟团队都有的东西——CI、分支保护、合并队列——被重新排列了一下。真正新的是两件事：每层都知道自己漏什么、并且假定下一层会兜住；以及把"审查什么时候停"当成和"审查查得多准"同等重要的指标来维护。第一件事靠设计，第二件事只能靠度量，而度量需要一组别人抄不走的数字——他们恰好有。

## 来源与阅读范围

阅读日期 2026-10-26。起点是用户给出的 [Addy Osmani 的 X 帖](https://x.com/addyosmani/status/2114604912520921136)，正文是一个指向 X Article 的链接；同一篇文章的完整版本发在 claude.dev。

一手材料：

- Addy Osmani、Morgan Westlee Lunt、Qing Wang，《How the Claude Code team does code review》，claude.dev，2026-10-15，https://claude.dev/blog/solving-code-review-at-anthropic/ 。七层流程、按风险分配的批准档位、`CLAUDE.md`／`REVIEW.md` 的分工、16%→54% 之外的内部数字、五十轮 PR 与 59% 的 git blame、FIGURE D 的三个收敛数字、事故转评测集、噪音分类、以及"尚无断路器"的自述，全部出自此文全文。
- Anthropic 工程博客，《Redesigning source control at Anthropic》，2026-10-13，https://www.anthropic.com/engineering/redesigning-source-control 。每日 2,500 → 30,000 次合并、Scion、主分支历史约 100 GB、工作副本 25 GB 以上。
- Sachin Malhotra，《Agentic coding is straining CI》，2026-09-14，https://claude.com/resources/articles/agentic-coding-is-straining-ci-heres-how-we-scaled-test-impact-analysis-at-anthropic 。人均季度产出 8 倍、Claude 写 80%、CI job 25 倍、测试量 10 倍。
- 《Bringing Code Review to Claude Code》产品公告，https://claude.com/resources/articles/code-review 。16%→54%、千行以上 PR 84% 有发现且平均 7.5 条、五十行以下 31% 与 0.5 条、不到 1% 被标为不正确、平均 20 分钟、单次 15–25 美元、Code Review 不批准。

产品文档：

- Claude Code，Code Review，https://code.claude.com/docs/en/code-review.md 。Find／Verify／Rank／Post 四段、只读访问、不构建不运行代码、check run 不以失败结束、Quick／Standard／Deep 档位、可用范围（Team 与 Enterprise，GitHub，不含零数据保留与 HIPAA 配置）。
- Claude Code，Customize Code Review，https://code.claude.com/docs/en/code-review-customize.md 。`REVIEW.md` 只从 base 或默认分支读取。
- Claude Code，Best practices，https://code.claude.com/docs/en/best-practices.md 。可运行的验证、Stop hook 与 `/goal` 作为卡口、新鲜上下文 subagent 复审，以及"被要求找 gap 的审查者总会报出一些 gap"的过度工程警告。
- Claude 帮助中心，Automated Security Reviews in Claude Code，https://support.claude.com/en/articles/11932705-automated-security-reviews-in-claude-code 。`/security-review` 与 GitHub Action 的用法、覆盖的问题类型、"补充而非替代"的定位。

其它：

- anthropics/claude-code-security-review README，https://github.com/anthropics/claude-code-security-review 。未针对 prompt injection 加固、只审可信 PR、建议要求外部贡献者的工作流需批准。
- Hacker News 讨论，https://news.ycombinator.com/item?id=50122951 。对每日合并量作为产出指标的质疑、Claude Code 仓库 issue 数量与回归的观察、把 critical 发现当误报关掉应交 AppSec 的意见。这些是社区观察与推断，本文按观点引用，未当作测量。

同一段里的数字经常来自不同仓库或不同时间窗：monorepo 的合并量、Claude Code 仓库的回滚比例、产品研究预览期间的评论比例、内部 PR 的过审轮数，各自的分母不同，不能相加或互相换算。文中标注为推断的地方（绝对回滚量约 1.2 倍、共同理解的延迟代价、把收敛条件推广到其它检查）是我的分析，不是原文结论。
