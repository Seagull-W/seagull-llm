---
title: "2026-10-16 后训练与 agentic RL 的 benchmark：准则、保证与数据形式"
description: "逐项核对数学短答案、代码、软件工程、工具调用与网页环境基准的评测对象、评分协议和真实样本，区分 RL 训练用途与独立测试，并限定可验证奖励理论保证的假设与缺口。"
tags: ["每日调研", "后训练", "强化学习", "评测"]
date: "2026-10-16"
---

# 2026-10-16 后训练与 agentic RL 的 benchmark：准则、保证与数据形式

::: info 本期要点
- **先分清奖励和评测。** 同一个数据集可以提供训练题，也可以提供保留测试题；必须核对实际切分和评分器。 [S2](#source-s2) [S10](#source-s10)
- **可执行不等于完整正确。** 单测、答案解析和终态检查都有各自的漏检范围。 [S2](#source-s2) [S7](#source-s7) [S8](#source-s8)
- **理论结论都有适用条件。** 本次读到的是奖励代理和 verifier 的形式化边界，不能据此声称某个榜单上的 RL 一定收敛。 [S14](#source-s14) [S15](#source-s15)
:::

> 调研基准日：2026-10-16（Asia/Shanghai）。本文是自己检索、打开原文、阅读说明与真实样本后写成的专题调研，不是近期论文窗口扫描。没有运行模型或 benchmark。固定版本源码与访问当日的数据文件分开注明；未读页面不进入证据链。

## 第一部分：评测对象，以及训练奖励与上线前评测的分工

编辑归纳：这些基准至少对应三种对象。数学题测给定问题后的答案生成；HumanEval 测函数补全；SWE-bench 测利用问题描述和仓库状态生成修复。tau-bench 与 WebArena 进一步把对象扩展到多轮交互系统，模型、工具、观察方式、用户模拟器和执行环境共同影响结果。只比较模型名字，不能保证比较的是同一评测对象。 [S1](#source-s1) [S4](#source-s4) [S5](#source-s5) [S8](#source-s8) [S9](#source-s9)

编辑归纳：可以按下面的用途划分实验。这个划分是本篇的实验组织建议，不是某一篇论文统一颁布的标准。依据是原文中的保留切分、训练用途与污染反例。 [S2](#source-s2) [S7](#source-s7) [S10](#source-s10) [S11](#source-s11)

| 用途 | 允许发生什么 | 应记录什么 |
| --- | --- | --- |
| RL 奖励环境 | 反复采样，读取训练标签或执行训练测试，用结果更新参数 | 题目来源、切分、改写、奖励函数、环境版本 |
| 开发评测 | 观察结果，调整奖励、提示词、预算或选择 checkpoint | 调整历史，以及哪些样本已经影响选择 |
| 上线前独立评测 | 固定模型和 agent 设置后，在预留任务上运行 | 完整测试协议、污染检查、成功与失败轨迹、评分器的边界 |

::: warning 保留集的身份会随使用方式改变
编辑归纳：一个文件叫 `test`，不代表它从未影响训练。若用它筛训练数据、选 checkpoint 或反复修改 agent，它已经参与了开发决策。保留集应按真实用途登记。MATH-500 的非标准切分和 SWE-bench Verified 的后续污染分析，都说明数据集名称不足以证明隔离。 [S2](#source-s2) [S7](#source-s7)
:::

## 第二部分：逐个 benchmark 看说明、评分和样本

### GSM8K：算术应用题，答案中保留推导与最终数值

原文事实：OpenAI 发布的 GSM8K 来自人工题目编写者，测多步小学数学应用题。官方 README 描述问题通常需要 2–8 步，使用基本算术。标准样本包含问题和解答，最终数值位于 `####` 后。原仓库 `dataset.py` 的示例判分器用正则取首个匹配的数值字符串，去掉逗号，再与标准答案字符串比较；未提取到时返回 `[invalid]`。它不做代数等价判定，也不逐步验证推导。 [S1](#source-s1)

原文事实：本次打开的是原仓库的标准 `train.jsonl`、`test.jsonl`，不是 Socratic 变体。README 用 `7.5K` 和 `1K` 概述切分；逐行读取实际文件得到 `7473` 和 `1319`。后两个数是本次文件行数统计，不是把 README 的约数改写成精确引文。 [S1](#source-s1)

| 字段或文件 | 实际内容 |
| --- | --- |
| `question` | 问题字符串 |
| `answer` | 解答字符串，包含计算标注和最终答案 |
| `train.jsonl`、`test.jsonl` | 每行一个 JSON 字典 |
| `####` | 最终数值前的标记 |

原文事实：`test.jsonl` 第二条问一件长袍需要多少蓝色、白色布料。其 `answer` 含计算标注，末行是 `#### 3`。下列只展示该字段中一个原样摘出的计算片段，省略其余解答。 [S1](#source-s1)

```json
{"answer":"It takes 2/2=<<2/2=1>>1 bolt of white fiber"}
```

编辑归纳：这类末答案分数不能证明每一步推导正确，也没有检验工具使用能力。是否允许计算器必须写进协议；原 README 本身介绍了用计算器覆盖部分采样的做法。 [S1](#source-s1)

### MATH-500：必须连同非标准 MATH 切分一起理解

原文事实：Hugging Face H4 的数据卡说明，这 `500` 道题是 OpenAI 在 Let's Verify Step by Step 中从 MATH 取出的子集。PRM800K 原仓库明确解释了用途：原有 `7,500` 道训练题之外，再加入原 MATH 测试集的 `4,500` 道题，只在剩余随机选出的 `500` 道题上评测。这是非标准切分。 [S2](#source-s2)

原文事实：评分不是只比较原始字符串。PRM800K 的 Answer Grading 节推荐 `grader.grade_answer(model_answer, gt_answer)`，先做数学答案规范化，再用 sympy 检查表达式相等。作者同时写明，该逻辑有时拒绝正确答案，也可能接受错误答案。本次读到的是这段说明，没有审计 `grader.py` 的全部实现。 [S2](#source-s2)

| `test.jsonl` 字段 | 所读样本中的值或含义 |
| --- | --- |
| `problem` | 题目字符串 |
| `solution` | 参考解答，可能含 LaTeX 与绘图源码 |
| `answer` | 提取后的参考答案字符串 |
| `subject` | 如 `Algebra` |
| `level` | 如 `3` |
| `unique_id` | 如 `test/algebra/2046.json` |

原文事实：具体样本 `test/algebra/2046.json` 要求展开并完全化简。下列是该行的字段投影，省略了 `problem`、`solution` 的长字符串，没有改写其余值。文件共读取到 `500` 行。 [S2](#source-s2)

```json
{"answer":"x^3+3x-6","subject":"Algebra","level":3,"unique_id":"test/algebra/2046.json"}
```

::: warning 原 MATH 的 test 与 MATH-500 不能混为一谈
编辑归纳：若训练配方采用 PRM800K 的扩展训练切分，再在原 MATH 全部测试题上报分，就会把已用于训练的题算回测试。应核对 `unique_id` 和实际名单。这里的隔离依据是文件级切分，不是“都叫数学测试集”。 [S2](#source-s2)
:::

### AIME 2024：本次只指 math-ai/aime24 的 test

原文事实：本次打开的是 Math-AI 团队整理的 AIME 2024 数据卡与 `test-00000-of-00001.parquet`，不是历年 AIME 合集。数据卡标注 `test`、`30` 条；实际解码 Parquet 后核对了 schema、行数与首行。题目来源地址保存在 `url`。这份文件提供题目和参考结果，没有随文件附上唯一的评测器。 [S3](#source-s3)

原文事实：它测竞赛数学短答案。具体怎么从生成文本提取答案、采样几次，要随使用论文核对。DAPO 对 AIME 评测写的是 `avg@32`；不能把它读成多次尝试中只要成功一次的 `pass@32`。 [S3](#source-s3) [S12](#source-s12)

| Parquet 字段 | 数据卡与文件的类型 |
| --- | --- |
| `id` | `int64` |
| `problem` | `string` |
| `solution` | `string` |
| `url` | `string` |

原文事实：首行 `id` 是 `60`，不是 `0`。`problem` 讲 Aya 步行和停留咖啡店所需的时间；`url` 指向 `2024_AIME_I_Problems/Problem_1`。以下仅投影答案字段；原字段叫 `solution`，没有名为 `answer` 的列。外部来源地址只列于文末。 [S3](#source-s3)

```json
{"id":60,"solution":"\\boxed{204}"}
```

编辑归纳：这份数据卡不能证明它与任何模型预训练语料隔离，也不能证明对某一时期的模型仍有足够难度。本文不把文件年份当作污染检查结果。 [S3](#source-s3)

### HumanEval：函数补全通过测试，与完整工程任务不同

原文事实：OpenAI 的 HumanEval 是手写的代码问题评测集，测给定函数提示后的补全。本文采用原仓库 commit `6d43fb980f9fee3c892a914eda09951f772ad10d`，不是 HumanEval+。读取 `HumanEval.jsonl.gz` 后得到 `164` 条。评测运行生成代码和测试，汇总 `pass@k`。 [S4](#source-s4)

原文事实：`evaluation.py` 中默认 `k=[1, 10, 100]`、`timeout=3.0`；只有每道题的样本数都不少于对应的 k，才计算该项。README 明确把提交文件定义为 JSONL，每条只有 `task_id` 与 `completion`，后者不应重复包含 prompt。 [S4](#source-s4)

| 原始题目字段 | 含义与首条样本 |
| --- | --- |
| `task_id` | `HumanEval/0` |
| `prompt` | 导入、函数签名与带例子的 docstring |
| `entry_point` | `has_close_elements` |
| `canonical_solution` | 参考实现 |
| `test` | `check(candidate)` 及断言 |

原文事实：首条题目判断列表中是否存在距离小于阈值的一对数。下面投影标识和入口，并逐字摘出一个测试断言。提交时模型应生成函数补全；参考实现与隐藏测试不属于补全输入。 [S4](#source-s4)

```json
{"task_id":"HumanEval/0","entry_point":"has_close_elements"}
```

```python
assert candidate([1.0, 2.0, 3.9, 4.0, 5.0, 2.2], 0.3) == True
```

编辑归纳：`passed` 表示通过这份测试集，不能据此推断所有输入都正确。复现时还应固定补全边界、样本数、超时和执行环境。README 对不可信代码执行明确要求安全沙箱；本次只阅读，没有执行这些补全。 [S4](#source-s4)

### SWE-bench 与 SWE-bench Verified：仓库状态、补丁和回归测试共同构成样本

原文事实：SWE-bench 由 Jimenez 等研究者发布。原论文从 `12` 个 Python 仓库收集 GitHub issue 与解决它的 PR，测模型能否根据问题和修复前的代码生成补丁。补丁需成功应用，并通过问题修复测试与原有回归测试；总体指标是解决任务的比例。 [S5](#source-s5)

原文事实：SWE-bench Verified 由 OpenAI 与 SWE-bench 作者合作筛选，是原测试集中的 `500` 条人工审核样本，测的任务没有变。发布说明要求问题描述足够清晰、测试不应排斥合理解法，并改进 Docker 评测环境。它是筛选后的测试子集，不是新增加的训练分割。 [S6](#source-s6)

原文事实：访问当日官方数据卡中，SWE-bench 为 `test: 2294`、`dev: 225`；Verified 只有 `test: 500`。下面按实际数据卡和 rows 接口列字段，不把论文早期 schema、其他变体或仓库指南的示意字段混入。 [S5](#source-s5)

| 字段组 | 两个 test 样本中实际出现的字段 |
| --- | --- |
| 身份与时间 | `instance_id`、`repo`、`created_at`、`version`、`difficulty` |
| 输入与修复前状态 | `problem_statement`、`hints_text`、`base_commit` |
| 参考与测试 | `patch`、`test_patch`、`FAIL_TO_PASS`、`PASS_TO_PASS` |
| 环境与执行 | `environment_setup_commit`、`eval_type`、`image`、`log_parser`、`eval_script` |

原文事实：数据卡指定 Parquet 文件模式 `data/test-*` 和 `data/dev-*`。本次打开 rows 接口的首条真实记录，读取到 `FAIL_TO_PASS`、`PASS_TO_PASS` 是字符串列表；卡片下方旧说明仍称它们是 JSON 列表字符串。写加载器时应以实际文件 schema 为准。以下为两条记录的字段投影。 [S5](#source-s5)

```json
{
  "instance_id": "astropy__astropy-11693",
  "repo": "astropy/astropy",
  "base_commit": "3832210580d516365ddae1a62071001faf94d416",
  "version": "4.2",
  "eval_type": "pass_and_fail",
  "FAIL_TO_PASS": ["astropy/wcs/wcsapi/tests/test_fitswcs.py::test_non_convergence_warning"],
  "difficulty": ""
}
```

```json
{
  "instance_id": "astropy__astropy-12907",
  "repo": "astropy/astropy",
  "base_commit": "d16bfe05a744909de4b27f5875fe0d4ed41ce607",
  "environment_setup_commit": "298ccb478e6bf092953bca67a3d29dc6c35f6752",
  "version": "4.3",
  "difficulty": "15 min - 1 hour",
  "log_parser": "parse_log_astropy"
}
```

原文事实：前一条来自 SWE-bench，问题涉及 `WCS.all_world2pix` 不收敛。后一条来自 Verified，涉及嵌套 `CompoundModels` 的 `separability_matrix`。后一条的 `image` 为 `swebench/sweb.eval.x86_64.astropy_1776_astropy-12907:latest`。这是样本内的原值；`latest` 不是内容不可变的 digest。 [S5](#source-s5)

原文事实：所读 `grading.py` 把修复测试和维护测试的通过比例分别计算。两者均为 `1` 才是 `FULL`；修复测试只通过一部分且维护测试全过，可以得到 `PARTIAL`。最终 `resolved` 依据 `FULL`，不能把调试用部分分替代为榜单解决率。 [S5](#source-s5)

::: warning Verified 的人工筛选不是永久有效性证明
作者声称：OpenAI 在 2026-02-23 的复查中写，审计了模型经常失败的 27.6% 子集，其中至少 59.4% 的题有缺陷测试，会拒绝功能上正确的提交。这个比例属于被审计子集，不能外推成全部 500 道题的错误率。同一则说明还写，受测前沿模型能复现 gold patch 或题面中的原句，并因此不再用该基准衡量前沿编程能力。本次核对到的是公开页的这两项问题；没有把 27.6% 换算成题数。 [S7](#source-s7)
:::

### tau-bench：终态与回答内容判分，另测多次执行的一致性

原文事实：Yao 等人提出的原版 tau-bench 测工具、agent 与用户的交互。用户由语言模型模拟，agent 得到领域 API 和政策。任务、数据库与工具通过人工设计、模型生成和人工审核构建。成功判定比较最终数据库与目标数据库，并检查必要的回答内容。本文读原论文 v1，以及原 `tau-bench` 仓库 commit `59a200c6d575d595120f1cb70fea53cef0632f6b`；不混入 tau² 或 tau³ 的成绩。 [S8](#source-s8)

原文事实：该快照 README 已提醒原仓库任务没有更新。下面的数据形式取自这份旧版实现，不表示最新修订任务。样本是 Python 文件内的 `Task(...)`，不应一概称为 JSONL。 [S8](#source-s8)

| 位置 | 实际字段或规格 |
| --- | --- |
| `Task` | `user_id`、`actions`、`instruction`、`outputs` |
| `Action` | `name`、`kwargs` |
| `tasks_test.py` | `TASKS_TEST` 列表；构造调用还传入 `annotator`，但本次所读 `Task` 类型没有声明它 |
| 工具描述 | `type`、`function`；后者含 `name`、`description`、`parameters` |
| `cancel_pending_order` | `order_id`、`reason` 均必需；`reason` 限于 `no longer needed`、`ordered by mistake` |
| 轨迹结果 `EnvRunResult` | `task_id`、`reward`、`info`、`traj`、`trial` |

原文事实：`tasks_test.py` 首条是用户 `yusuf_rossi_9620` 的键盘与温控器换货任务。参考动作中有下面这条，`outputs` 为 `[]`。这是参考动作投影，不是要求 agent 逐字复制的对话轨迹。 [S8](#source-s8)

```json
{
  "user_id": "yusuf_rossi_9620",
  "actions": [{
    "name": "exchange_delivered_order_items",
    "kwargs": {
      "order_id": "#W2378156",
      "item_ids": ["1151293680", "4983901480"],
      "new_item_ids": ["7706410293", "7747408585"],
      "payment_method_id": "credit_card_9513926"
    }
  }],
  "outputs": []
}
```

原文事实：原样本的 `actions` 还包含查用户、订单和商品的动作，上例只保留换货动作。 [S8](#source-s8)

原文事实：`calculate_reward()` 检查当前数据库哈希与重放参考动作后的哈希是否相同；若 `outputs` 非空，还要求回答包含必要内容。论文把两者组合为二元终局奖励。它明确承认：得 `1` 可能仍未遵守用户确认等政策。工具说明要求确认，也不表示评分器一定检查了确认过程。 [S8](#source-s8)

原文事实：论文的 `pass^k` 是同一道任务独立执行 k 次都成功的概率，衡量一致性；HumanEval 的 `pass@k` 是至少成功一次。论文对无偏估计的讨论以独立同分布试验为条件。这是不同指标的定义与估计条件，不是 agent 可靠性达到某个值的理论保证。 [S8](#source-s8)

### WebArena：可重置网页环境，按任务结果判分

原文事实：Zhou 等人发布 WebArena，用电商、论坛、协作开发与内容管理等自托管网站，测把自然语言目标转成网页操作的能力。网站使用开源应用与导入的数据，任务来自人工探索、模板和实例化。论文提供 `812` 个长程任务，并以功能完成情况评分，而非要求动作序列与参考轨迹相同。本文读论文 v4 与仓库 commit `dce04686a56253aefba7b18a4fa0937cf1dc987b`。 [S9](#source-s9)

原文事实：`test.raw.json` 是含 `812` 个对象的 JSON 数组；脚本据此生成每任务一个 JSON 配置。评分可以检查回答、URL 或页面内容。`evaluator_router()` 支持 `string_match`、`url_match`、`program_html`；组合器把各评分相乘。论文中的 `fuzzy_match` 还会使用模型判断语义，所以不能把整个 WebArena 都称为纯确定性 verifier。 [S9](#source-s9)

| 配置字段 | 实际用途与首条取值 |
| --- | --- |
| `sites`、`task_id` | `['shopping_admin']`、`0` |
| `require_login`、`storage_state` | 登录要求与认证状态文件 |
| `start_url`、`geolocation` | 起始地址占位符与地理位置 |
| `intent_template`、`instantiation_dict`、`intent` | 模板、参数、实例化目标 |
| `require_reset`、`intent_template_id` | 重置标记与模板标识 |
| `eval` | 含 `eval_types`、`reference_answers`、`reference_url`、`program_html`、`string_note`、`reference_answer_raw_annotation` |

原文事实：首条任务查询 `2022` 年最畅销产品。以下是原对象的字段投影，省略认证状态与模板等字段。 `__SHOPPING_ADMIN__` 是待部署配置替换的占位符。 [S9](#source-s9)

```json
{
  "task_id": 0,
  "start_url": "__SHOPPING_ADMIN__",
  "intent": "What is the top-1 best-selling product in 2022",
  "eval": {
    "eval_types": ["string_match"],
    "reference_answers": {"exact_match": "Quest Lumaflex™ Band"},
    "reference_url": "",
    "program_html": [],
    "string_note": "",
    "reference_answer_raw_annotation": "Quest Lumaflex™ Band"
  }
}
```

原文事实：README 要求自己部署网站；演示站只用于浏览。跑完 `812` 个例子后需重置环境。示例观察方式为 `accessibility_tree`，视口为 `1280` × `720`。这些是所读示例的设置，不是所有 agent 只能采用这一种观察方式。 [S9](#source-s9)

::: tip 读取交互基准时，先找组成实验的文件
编辑归纳：至少同时看任务配置、初始环境、工具或动作接口、评分器。只下载自然语言 `instruction` 或 `intent`，无法重建这些任务。本文没有打开 OSWorld 或 Terminal-Bench 的原始说明与样本，因此不把它们并入本节比较。 [S8](#source-s8) [S9](#source-s9)
:::

## 第三部分：文献明确写了哪些设计与选用准则

### 可验证性：核对判定目标，也核对误判方向

原文事实：PRM800K 的评分说明承认数学等价判断可能误拒与误收。Verified 的人工说明要求问题足够明确，测试应覆盖描述中的合理解法，不能依赖描述之外的新函数名或错误消息。tau-bench 则要求任务有唯一数据库终态，减少用户模拟带来的目标歧义。这些都是原文明确提出或用于筛选的要求。 [S2](#source-s2) [S6](#source-s6) [S8](#source-s8)

编辑归纳：选基准时，可以分别检查“错误解能否混过”和“正确解会否被错杀”。两种问题不能用一个“有测试”标签代替。这里是对上述原文要求的归纳。 [S2](#source-s2) [S6](#source-s6)

### 污染与时间切分：名称、去重与训练截止日分别核对

作者声称：SWE-bench 原论文把持续更新列为特点，提出可收集模型训练日期之后创建的问题，避免解决方案已经存在于训练语料。这个主张要求题目时间确实晚于相应模型的训练截止日；原文没有为所有以后提交的模型担保无污染。 [S5](#source-s5)

原文事实：DeepSeekMath 在预训练语料去污染部分写了 `10-gram` 精确匹配；短于该长度但至少 `3` gram 的基准文本采用精确匹配过滤。它另在 RL 节说明使用来自 SFT 的 GSM8K、MATH 相关题。不能把预训练语料的过滤规则直接转述成 RL 数据逐条去重证书。 [S13](#source-s13)

作者声称：Verified 后续复查用模型复现参考补丁与题面细节作为污染证据。编辑归纳：时间切分要与模型截止日、改写后近重复、答案与仓库版本暴露一起核对。后一项是本篇结合原文做的审查建议，不是已经执行过的全面去污染。 [S7](#source-s7)

### 难度与饱和：训练难度和评测区分度是两个问题

作者声称：SimpleRL-Zoo 的对照实验发现，训练题难度需匹配基础模型的探索能力；对较弱模型，过难题缺少正反馈，对较强模型，过易题也限制提升。它把训练题分为 `Easy`、`Medium`、`Hard`。这是训练数据选择的实验证据，不是“所有模型都应使用同一种难度”的定理。 [S10](#source-s10)

原文事实：Verified 发布说明按预计修复时间分层报告；后续复查又指出，当分数增长放缓，剩余失败可能来自测试缺陷与污染。编辑归纳：接近饱和时，先审查失败样本，再解释微小分差。本文没有依据旧成绩宣布 GSM8K、AIME 或 HumanEval 在基准日已普遍饱和。 [S6](#source-s6) [S7](#source-s7)

### 评分协议与复现：把采样、超时和环境写成协议的一部分

原文事实：HumanEval 的 README 限制了样本不足时的 `pass@k` 计算；DAPO 明写 AIME 的重复次数、温度与 top-p；tau-bench 区分 `pass^k` 与 `pass@k`；WebArena 要求自托管和重置环境。这些都说明，同一批题不自动产生同口径的分数。 [S4](#source-s4) [S8](#source-s8) [S9](#source-s9) [S12](#source-s12)

编辑归纳：一份可比较的记录应包括模型与 agent 版本、输入范围、样本数、生成参数、工具与模拟器版本、超时和步数预算、环境初态、评分实现。以上清单来自把几份协议拼合，并非单篇原文逐字列出的统一标准。本次只核实了正文列出的具体设置，未测量执行成本或跨机器复现误差。 [S4](#source-s4) [S8](#source-s8) [S9](#source-s9)

### 过程分与部分分：增加反馈，也改变优化目标

原文事实：ReFT 对数值题允许在答案可提取但不正确时给 `0.1`，正确给 `1`，不可提取给 `0`。这是训练时的辅助反馈，不是 GSM8K 官方评测定义。其 MathQA 多选题实验还出现“中间算错、末尾猜中选项而得分”的 reward hacking。这里引用的是 ReFT 的原文反例，不额外把 MathQA 扩展为本文的数据集调研对象。 [S11](#source-s11)

作者声称：DeepSeek-R1 报告在 PRM 失败尝试中列出三项困难：步骤难定义，步骤正确性难标注，以及优化过程奖励时发生 reward hacking。作者也明确说这些失败经验不代表方法不可能有效。这里保留实验范围，不能把文中强措辞扩展成“任何 PRM 都必然失败”的定理。该来源没有给出理论保证。 [S16](#source-s16)

原文事实：SimpleRL-Zoo 报告严格格式奖励可能使部分基础模型过度追逐格式并出现训练退化。编辑归纳：过程分、格式分、可提取分和测试部分通过率，应分别报告，并用独立的末端正确性或完整任务成功率复核。不能把辅助分上升直接写成能力提升。 [S10](#source-s10) [S11](#source-s11)

## 第四部分：benchmark 怎样成为 RL 奖励或训练数据

### SimpleRL-Zoo：明确使用 GSM8K 与 MATH 的训练集

原文事实：论文 v2 第 2.1 节写明使用 GSM8K 与 MATH 的 training datasets。`Easy` 是 GSM8K 加 MATH `lv.1`，`Medium` 是 MATH `lv.1–4`，`Hard` 是 MATH `lv.3–5`，每类约 `8,000` 道题。训练奖励是正确 `+1`、错误 `0`，不使用格式奖励。评测列出 GSM8K、MATH 500、AIME 2024 等集合。 [S10](#source-s10)

原文事实：这是明确区分训练题来源和评测集合的例子。所读部分没有给出逐条训练 ID 与所有测试 ID 的交集审计，也没有证明其底座预训练无污染。因此只能写“声明使用训练集”，不能写成“已验证所有阶段完全隔离”。该来源没有给出理论保证。 [S10](#source-s10)

### ReFT：同一批训练问题，SFT 后继续用答案奖励做 PPO

原文事实：ReFT v3 用 SFT 热身，再从相同训练问题取问题和答案做 PPO。奖励直接来自生成结果与标准答案的比较，无需另训奖励模型。表 1 的 GSM8k 数据为 `Train N-CoT: 7,465`、`Train P-CoT: 7,356`、`Test: 1,319`；这些是其处理后的版本，不能当作原始 GSM8K 文件行数。 [S11](#source-s11)

原文事实：算法区分训练数据，统计表区分 train 与 test，并明确不增加额外训练问题。所读部分没有提供针对底座预训练语料的去污染审计。这篇展示了 benchmark 训练分割成为奖励题的直接用法；不是把保留测试题拿来训练。该来源没有给出理论保证。 [S11](#source-s11)

### DAPO：AIME 风格的整数奖励数据，不等于把 AIME test 用作训练

原文事实：DAPO v2 第 3.5 节把从网络和竞赛官网收集的题筛选、改写为整数答案，得到 `DAPO-Math-17K`，含 `17K` 提示。其基本正确性奖励为答对 `1`、否则 `−1`，另有过长惩罚。AIME 2024 用于结果评测；第 4.1 节写重复 `32` 次，报告 `avg@32`，`temperature 1.0`、`topp 0.7`。 [S12](#source-s12)

原文事实：所读 v2 正文的数据转换与训练设置没有给出训练题对 AIME 2024 测试题的逐条排除清单，也没有给出完整去污染程序。因此本文只确认两套数据被描述为不同用途，保留隔离审计缺口。该来源没有给出理论保证。 [S12](#source-s12)

### DeepSeekMath：相关题、SFT 数据与预训练去污染要分别理解

原文事实：DeepSeekMath v3 第 4.2 节写，RL 使用 SFT 数据中与 GSM8K、MATH 相关的 CoT 题，约 `144K`，排除其他 SFT 题，以检验域外任务变化。它使用训练出的奖励模型与 GRPO。 [S13](#source-s13)

原文事实：所读段落没有把这 `144K` 题落实成可下载的 GSM8K `train.jsonl` 或某个明确 MATH 分割名单。第 2.1 节的去污染说的是预训练语料。不能据此写“RL 恰好用了两个 benchmark 的原始 train”，也不能声称已经核实与测试题零重叠。该来源没有给出理论保证。 [S13](#source-s13)

::: tip 如何理解这里的“没有给出”
编辑归纳：上面说的是本次明确阅读范围内未找到相应保证或审计，范围逐项列在文末。它不是对所有版本、后续论文与未读仓库的否定。论文中的训练曲线、性能改善和“convergence”措辞，不自动成为收敛定理。 [S10](#source-s10) [S11](#source-s11) [S12](#source-s12) [S13](#source-s13)
:::

## 第五部分：理论保证及其假设

### 固定、不完美 verifier 的 RLVR：信息不足与审计控制

原文事实：Moya、Thornley、Lin 的 Verifier Errors in RLVR，PDF 标注 `2609.35677v1`、`28 Sep 2026`，状态为预印本、审稿中。它研究固定 verifier 的奖励梯度流，区分真正正确、被接受的错误和被拒绝的回答。研究对象是一类奖励与训练动力学，不是针对 AIME、HumanEval 或 SWE-bench 成绩的保证。 [S14](#source-s14)

作者声称：命题 `4.1–4.3` 给出检测、识别与选择性控制的限制。比较不同但与同一 verifier 相容的正确性标注时，保持问题分布、verifier、初始化和训练算法相同；训练日志不含 verifier 之外的正确性反馈，并假设没有假阴性。这样的日志在不同正确性世界中可以同分布，因而无法统一保证识别被接受的错误。选择性控制命题还要求组概率可微，并考虑初始策略对正确回答和错误接受都有正概率的情形。 [S14](#source-s14)

作者声称：定理 `5.1` 对 projected audit correction 给出有条件的保证。核心假设为：

1. `A1`：正确、错误接受及已审计错误的概率对参数连续可微；所考察有限时间区间内，正确与错误接受概率都为正。
2. `A2`：固定审计集合在整个区间覆盖全部具有概率质量的错误接受，使已审计错误概率及其梯度与总体错误接受一致。
3. 轨迹界还要求 `A3`：投影校正方向在整个区间保持统一的校正强度下界，并对错误增长压力有统一上界。

作者声称：在前两项假设下，投影校正保留总接受概率的瞬时增长率；校正足够强时，错误接受占比下降，正确回答概率上升。更强的条件能使错误接受的绝对概率也下降。再加 `A3` 与增长压力上界，定理给出占比由指数衰减项和残余项构成的界。论文明确提醒：有限样本梯度、实际优化器与有限步长可能破坏这些效果。它没有证明离散 GRPO 在本文任一 benchmark 上达到全局最优。 [S14](#source-s14)

### 代理奖励的形式化：何时“奖励更高”不会颠倒真实偏好

原文事实：Skalse 等人的 Defining and Characterizing Reward Hacking，本次打开 PDF 为 `2209.13085v2`。第 4 节假设状态与动作有限、动作不止一个、所有状态可达、奖励有限均值。它把 hacking 定义为存在两条策略：一个奖励偏好前者，另一个奖励偏好后者。 [S15](#source-s15)

作者声称：第 5.1 节定理 `1` 表明，若考虑的策略集合包含开集，一对非平凡且不可 hacking 的奖励，在该策略集上必须诱导相同排序。第 5.2 节定理 `2` 转而讨论有限策略集：当至少两条策略的状态动作访问计数不同，可以构造非平凡、不可 hacking 但不等价的奖励对。这里的“平凡”按策略回报是否恒定定义，不能只看奖励函数的表面写法。 [S15](#source-s15)

编辑归纳：这些结果给的是代理奖励与真实目标的结构条件。若把测试通过率当作真实功能正确性的代理，可以用这个框架提出问题；但原文没有替 HumanEval 单测、tau-bench 哈希检查或某个 PRM 验证条件。它也没有证明训练算法必然找到某种漏洞。不能把“存在可 hacking 策略”改写成“实际一定会被攻破”。 [S15](#source-s15)

### 哪些 benchmark 本身有保证，哪些没有

| 本次已读来源 | 与理论保证有关的结论 |
| --- | --- |
| GSM8K 官方说明与数据 | 该来源没有给出理论保证。 |
| MATH-500 数据卡、样本与 PRM800K 的切分和评分说明 | 该来源没有给出理论保证；还明确承认评分误判。 |
| math-ai/aime24 数据卡与文件 | 该来源没有给出理论保证。 |
| HumanEval README、数据与评测代码 | 该来源没有给出理论保证。README 说明无偏估计所需的样本数条件，不等于训练收敛、覆盖或无污染保证。 |
| SWE-bench 论文所读任务构建、评分与更新部分，及两个数据卡 | 该来源没有给出理论保证。时间切分是构建主张，不是所有模型无污染的证明。 |
| Verified 发布说明、标注规范及后续复查 | 该来源没有给出理论保证。人工标签与复查比例是经验材料。 |
| 原版 tau-bench 论文、schema 与奖励实现 | 该来源没有给出 agent 成功率或政策合规的理论保证；独立同分布条件下的指标估计不等于任务成功保证。 |
| WebArena 论文、任务与评分实现 | 该来源没有给出理论保证。可重置、可执行与实测评分一致性不等于收敛或完备性定理。 |

编辑归纳：本次没有找到把这些具体测试集与实际神经网络 RL 更新同时纳入假设、给出收敛率、遗憾界或任务覆盖下界的已读定理。可确认的理论证据集中在上面两篇的奖励结构与 verifier 信息边界。这个缺口保留，不用通用 RL 教科书结论补齐。 [S14](#source-s14) [S15](#source-s15)

## 未读

- `2209.13085v4` 的 arXiv HTML 请求返回 404；改读 PDF，实际版本为 v2。v4 不作为证据。
- `2609.35677v1` 的 arXiv HTML 请求返回 404；改读并引用 v1 PDF。
- GitHub 的 tau-bench、WebArena tree API 请求受限，未获得目录树；已直接打开正文引用的源码文件。
- OSWorld、Terminal-Bench、BFCL、LiveCodeBench 未展开检索阅读，不给出其 schema、成绩或保证。工具调用采用原版 tau-bench，执行环境采用 WebArena，代码采用原版 HumanEval。

## 来源与阅读范围

### S1：GSM8K 官方说明与标准数据 {#source-s1}

[README](https://raw.githubusercontent.com/openai/grade-school-math/master/README.md) · [train.jsonl](https://raw.githubusercontent.com/openai/grade-school-math/master/grade_school_math/data/train.jsonl) · [test.jsonl](https://raw.githubusercontent.com/openai/grade-school-math/master/grade_school_math/data/test.jsonl) · [dataset.py](https://raw.githubusercontent.com/openai/grade-school-math/master/grade_school_math/dataset.py)

阅读范围：README 的数据、计算标注与答案提取部分；逐行解析标准 train/test 文件，重点读 test 第二条；dataset.py 的答案正则、extract_answer 与 is_correct。未读 Socratic 文件，未运行模型或完整训练流程。

### S2：MATH-500 与 PRM800K 的切分和评分说明 {#source-s2}

[MATH-500 数据卡](https://huggingface.co/datasets/HuggingFaceH4/MATH-500/raw/main/README.md) · [test.jsonl](https://huggingface.co/datasets/HuggingFaceH4/MATH-500/resolve/main/test.jsonl) · [PRM800K README](https://raw.githubusercontent.com/openai/prm800k/main/README.md)

阅读范围：MATH-500 数据卡全文、JSONL 字段与两个样本；PRM800K README 的 Answer Grading、MATH Splits。没有审计 grader.py，也没有阅读 PRM800K 全部人工标注。

### S3：math-ai/aime24 的 AIME 2024 文件 {#source-s3}

[数据卡](https://huggingface.co/datasets/math-ai/aime24/raw/main/README.md) · [Parquet 数据](https://huggingface.co/datasets/math-ai/aime24/resolve/main/test-00000-of-00001.parquet)

阅读范围：数据卡全文；实际解码 test-00000-of-00001.parquet，核对 schema、行数与首条 Aya 步行题。未打开各行所指的 AoPS 解答，未读其他年份 AIME。

### S4：原版 HumanEval 的数据与评测实现 {#source-s4}

[固定版本 README](https://raw.githubusercontent.com/openai/human-eval/6d43fb980f9fee3c892a914eda09951f772ad10d/README.md) · [HumanEval.jsonl.gz](https://raw.githubusercontent.com/openai/human-eval/6d43fb980f9fee3c892a914eda09951f772ad10d/data/HumanEval.jsonl.gz) · [evaluation.py](https://raw.githubusercontent.com/openai/human-eval/6d43fb980f9fee3c892a914eda09951f772ad10d/human_eval/evaluation.py)

阅读范围：commit 6d43fb9 的 README Usage、原始压缩数据及 evaluation.py 全文；重点读 HumanEval/0。固定版本文件与先读的 master 文件字节相同。未审计完整沙箱实现，未执行生成代码。

### S5：SWE-bench 论文、两份数据卡与实际记录 {#source-s5}

[论文 v3](https://arxiv.org/html/2310.06770v3) · [SWE-bench 数据卡](https://huggingface.co/datasets/SWE-bench/SWE-bench/raw/main/README.md) · [Verified 数据卡](https://huggingface.co/datasets/SWE-bench/SWE-bench_Verified/raw/main/README.md) · [SWE-bench 首条记录](https://datasets-server.huggingface.co/rows?dataset=SWE-bench/SWE-bench&config=default&split=test&offset=0&length=1) · [Verified 首条记录](https://datasets-server.huggingface.co/rows?dataset=SWE-bench/SWE-bench_Verified&config=default&split=test&offset=0&length=1) · [grading.py](https://raw.githubusercontent.com/SWE-bench/SWE-bench/main/swebench/harness/grading.py)

阅读范围：论文 v3 第 2 节的构建、输入、评分、持续更新；访问当日两份数据卡全文与两个 test 首条记录；grading.py 的通过比例、状态与 resolved 判定。未通读论文附录，未审计所有安装脚本、日志解析器或执行容器。

### S6：SWE-bench Verified 的发布与标注规范 {#source-s6}

[发布说明](https://openai.com/index/introducing-swe-bench-verified/) · [标注说明 PDF](https://cdn.openai.com/introducing-swe-bench-verified/swe-b-annotation-instructions.pdf)

阅读范围：发布页的背景、筛选方法和难度分层；标注说明 PDF 第 1–5 页，重点读问题充分性、测试范围与难度规则。未逐一展开交互案例，也未审查全部人工标注记录。

### S7：Verified 的 2026 年复查 {#source-s7}

[OpenAI 复查原文](https://openai.com/index/why-we-no-longer-evaluate-swe-bench-verified/)

阅读范围：2026-02-23 正文导言、Background、Too narrow and too wide tests，以及 Contamination 的方法与例子。未独立复现其审计，未逐条审查所有模型轨迹。

### S8：原版 tau-bench 的论文、任务与执行接口 {#source-s8}

[论文 v1](https://arxiv.org/html/2406.12045v1) · [固定版本 README](https://raw.githubusercontent.com/sierra-research/tau-bench/59a200c6d575d595120f1cb70fea53cef0632f6b/README.md) · [types.py](https://raw.githubusercontent.com/sierra-research/tau-bench/59a200c6d575d595120f1cb70fea53cef0632f6b/tau_bench/types.py) · [retail/tasks_test.py](https://raw.githubusercontent.com/sierra-research/tau-bench/59a200c6d575d595120f1cb70fea53cef0632f6b/tau_bench/envs/retail/tasks_test.py) · [base.py](https://raw.githubusercontent.com/sierra-research/tau-bench/59a200c6d575d595120f1cb70fea53cef0632f6b/tau_bench/envs/base.py) · [cancel_pending_order.py](https://raw.githubusercontent.com/sierra-research/tau-bench/59a200c6d575d595120f1cb70fea53cef0632f6b/tau_bench/envs/retail/tools/cancel_pending_order.py)

阅读范围：论文 v1 的交互、奖励、指标、构建与奖励不充分的说明；commit 59a200c 的 README、types.py、base.py、取消订单工具全文，以及 retail/tasks_test.py 的前三条。固定文件与先读 main 字节相同。未读全部数据库、政策、其他任务和 tau²/tau³ 的修订。

### S9：WebArena 的环境、任务与评分器 {#source-s9}

[论文 v4](https://arxiv.org/html/2307.13854v4) · [固定版本 README](https://raw.githubusercontent.com/web-arena-x/webarena/dce04686a56253aefba7b18a4fa0937cf1dc987b/README.md) · [test.raw.json](https://raw.githubusercontent.com/web-arena-x/webarena/dce04686a56253aefba7b18a4fa0937cf1dc987b/config_files/test.raw.json) · [evaluators.py](https://raw.githubusercontent.com/web-arena-x/webarena/dce04686a56253aefba7b18a4fa0937cf1dc987b/evaluation_harness/evaluators.py)

阅读范围：论文 v4 的环境复现、任务构建与第 3.2 节评分；commit dce0468 的 README、test.raw.json 首条及数组结构、evaluators.py 的字符串评分与组合路由。固定文件与先读 main 字节相同。未部署网站、未测外部模型评分一致性、未通读附录。

### S10：SimpleRL-Zoo v2 {#source-s10}

[论文 HTML](https://arxiv.org/html/2503.18892v2)

阅读范围：v2 第 2.1 节训练数据、奖励与评测，表 1 的采样注释，第 3.1–3.2 节格式和难度实验。未打开训练数据仓库逐条交集检查，未精读其余实验与附录。

### S11：ReFT v3 {#source-s11}

[论文 HTML](https://arxiv.org/html/2401.08967v3)

阅读范围：v3 第 3 节 SFT 与 PPO、终局和部分奖励；第 4.1 节及表 1；第 4.4 节的 MathQA reward hacking 与部分奖励消融。未逐条审计处理后的数据，未通读附录和所有实验。

### S12：DAPO v2 {#source-s12}

[论文 HTML](https://arxiv.org/html/2503.14476v2)

阅读范围：v2 第 2 节基本奖励、第 3.5 节数据转换、第 4.1 节评测协议与第 5 节训练奖励观察。未读完附录，未打开全部训练题与去重实现。

### S13：DeepSeekMath v3 {#source-s13}

[论文 HTML](https://arxiv.org/html/2402.03300v3)

阅读范围：v3 第 2.1 节语料去污染、第 3.1 节 SFT 来源、第 4.2 节 RL 数据与奖励模型。未取得 144K 题的逐条清单，未通读附录梯度分析。

### S14：Verifier Errors in RLVR 的条件性定理 {#source-s14}

[论文 PDF v1](https://arxiv.org/pdf/2609.35677)

阅读范围：PDF v1 第 2 节定义，第 4–7 页的动力学、命题 4.1–4.3 与定理 5.1、假设和证明提纲。已核对作者网页对应段落；未精读附录证明及全部实验，未验证实现能否满足假设。

### S15：Defining and Characterizing Reward Hacking {#source-s15}

[论文 PDF v2](https://arxiv.org/pdf/2209.13085)

阅读范围：实际 PDF 为 v2，阅读第 4 节定义和假设、第 5.1–5.2 节定理 1、2。未精读附录证明；其摘要措辞没有代替正文定理，也没有据此推断某个 benchmark 的漏洞发生率。

### S16：DeepSeek-R1 v1 的过程奖励经验 {#source-s16}

[报告 HTML](https://arxiv.org/html/2501.12948v1)

阅读范围：v1 第 2.2.2 节奖励建模、第 4.2 节 PRM 失败尝试及其限定语。没有据此还原训练题切分，没有精读全部评测表和附录。
