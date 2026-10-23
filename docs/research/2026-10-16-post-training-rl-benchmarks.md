---
title: "2026-10-16 后训练与 agentic RL 的 benchmark：准则、保证与数据形式"
description: "基准名不等于分数。评分器接受的对象、模型实际收到的输入，以及训练已经用过的反馈要分开；筛选标准与事后审计、pass@k 与 pass^k 也不是同一个结论。"
tags: ["每日调研", "后训练", "强化学习", "评测"]
date: "2026-10-16"
---

# 2026-10-16 后训练与 agentic RL 的 benchmark：准则、保证与数据形式

报出来的分数挂在基准名上，产生这个数的却是另一套东西：模型当时拿到什么，评分器把什么算作成功，以及训练或选模型时有没有已经用过相近的反馈。这三件事可以同时成立，也可以只成立一件。把它们收成“在 GSM8K 上做了 RL”或“有测试，所以可验证”，会把不同的结论叠在同一个名字下。

数学题、函数补全、仓库补丁、工具对话和网页操作的差别，就出在这三件事上，不在任务看起来像不像智能体。

## 评分器接受的，常常不是题目在问的

GSM8K 的官方评分只认末尾那个数。标准 `test.jsonl` 的第二条是蓝布、白布的卷数，参考解答末行是 `#### 3`。模型只应看到 `question`。示例评分器从生成文本里抽出第一个符合格式的数值，去掉逗号，再和参考答案里的 `3` 比较；抽不出来记为无效。推导错了但末数对，按这个规则仍算对；末数对了但写法不是它要的数值串，可以算错。它不做逐步检查，也不做代数等价。[S1](#source-s1)

MATH-500 换的是等价，不是格式。Hugging Face H4 的 500 题来自 OpenAI 在 Let's Verify Step by Step 里从 MATH 留出的评测题。`grader.grade_answer` 先规范化，再用 sympy 看表达式是否相等，所以 `x^3+3x-6` 不要求和参考推导逐字相同。同一份说明承认：这个判断会拒绝一些正确答案，也会放过一些错误答案。PRM800K 的切分还改了“测试集”的含义：原 MATH 的 7,500 道训练题之外，又放进原测试集的 4,500 道，只随机留 500 道做评测。用了这套配方之后，把原 MATH 全部测试题再当作没见过的考试，和这 500 道不是同一件事。[S2](#source-s2)

`math-ai/aime24` 更靠前就停了。30 道题的 `solution` 字段可以只是 `\boxed{204}`，文件里没有统一的抽取器和采样协议。DAPO 在 AIME 2024 上重复采样 32 次，报告 `avg@32`，温度 1.0、top-p 0.7。这是 32 次的平均正确率，不是“32 次里对过一次”。换一套抽取或采样，同一批题会得到另一个数。[S3](#source-s3) [S12](#source-s12)

HumanEval 把“写对了”定义成测试通过，不是和参考实现相同。`HumanEval/0` 的 `prompt` 只到函数签名和文档字符串；`canonical_solution` 不交给模型。`check` 用断言看具体输入，例如同一组数在阈值 0.3 时为真、0.05 时为假。通过该题测试才记 `passed`。汇总的 `pass@k` 是 k 次里至少成功一次。`evaluation.py` 只在每题采样数不少于 k 时计算 k 为 1、10、100 的项，默认超时 3.0 秒。采样不够就把缺的 k 当成 0，和“模型做不到”不是同一个结果。[S4](#source-s4)

仓库修复的成功条件更窄。SWE-bench 给的是 issue 和修复前的仓库，模型交补丁。记为 `resolved` 要同时满足：新增的问题测试全部变成通过，原有的维护测试也全部保持通过。调试报告里的 `PARTIAL` 不是这个指标，参考补丁也不是唯一合法实现。测试集 2,294 条、开发集 225 条，来自 12 个 Python 仓库。原论文把“可以收集训练截止日期之后的 issue”写成持续更新的办法；这要求题目时间确实晚于该模型的截止日，并不自动覆盖以后每一个模型。[S5](#source-s5)

Verified 是从原测试集里人工选出的 500 条。筛选时的要求是：问题描述够用，测试接受合理实现，而不是只认题面没写的函数名或报错字符串。2026-02-23 的复查看的是另一群题：模型经常失败的 27.6% 子集里，至少 59.4% 有会拒绝功能上正确提交的测试。59.4% 的分母是这个子集，不是 500。同一则说明还把前沿模型复现参考补丁或题面原句当作污染，并因此不再用该基准衡量前沿编程能力。测试过窄和答案已经进了训练，都会让分数难解释，但它们否定的不是同一件事：前者是评分器拒绝了不该拒绝的补丁，后者是模型可能见过解。[S6](#source-s6) [S7](#source-s7)

对话和网页任务里，执行轨迹也不是分数。tau-bench 零售域第一条的 `instruction` 写的是用户人设和换货要求，这份文字交给用户模拟器；agent 看到的是逐轮发言、工具观察、业务政策和接口。`actions` 里的查用户、读订单、换键盘和温控器是评估用的参考操作，不是发给 agent 的脚本。评分从初始数据库重放这些动作，再比 agent 执行后的数据库哈希。这条的 `outputs` 为空，没有额外的回答关键词；若列了 `outputs`，回答还得包含它们。只有终态符合才得 1。论文写明，这样仍可能漏掉“操作前有没有得到用户确认”。跨次稳定性用的 `pass^k` 是同一任务独立跑 k 次全部成功，和 HumanEval 至少成功一次的 `pass@k` 方向相反。[S8](#source-s8)

WebArena 的 812 个任务允许不同操作路径，但“功能完成”的检查并不统一。电商后台那条问 2022 年销量第一的产品，`exact_match` 在去掉首尾空白和成对引号、转成小写之后，和 `Quest Lumaflex™ Band` 比较。它不看浏览路径。别的任务可以查目标 URL 或页面内容，组合时分数相乘；`fuzzy_match` 还会叫模型做语义判断。所以不能从这一条推出整个基准都是确定性字符串比较。运行这些配置要自托管网站；README 示例用的是 `accessibility_tree` 和 1280×720 视口，并在整批之后重置环境。换观察方式或忘了重置，比的就不是同一批交互。[S9](#source-s9)

## 训练反馈和报出来的分数

同一套题名可以一边当奖励，一边当考试，也可以只是看起来像。

SimpleRL-Zoo 写明用 GSM8K 与 MATH 的训练集。`Easy` 是 GSM8K 加 MATH 难度 1，`Medium` 是 MATH 难度 1–4，`Hard` 是难度 3–5，每类约 8,000 题。训练奖励是对了 +1、错了 0，不用格式奖励。评测列表里则有 GSM8K、MATH-500 和 AIME 2024。难度实验说的是另一件事：题要和基座还能不能探索到正反馈相配。弱模型碰上过难题会缺少正样本，强模型碰上过易题提升有限。这不是“所有模型用同一难度”。严格格式奖励在他们的部分基座上会把更新拉向格式，训练变差。格式分上升和题目做对，在这个实验里可以分开。[S10](#source-s10)

ReFT 在 SFT 之后，用同一批训练题的问题和答案做 PPO，奖励来自和标准答案的比较，不另训奖励模型。表 1 的 GSM8K 计数是处理后的 `Train N-CoT: 7,465`、`Train P-CoT: 7,356`、`Test: 1,319`，不是原始 `train.jsonl` 的行数。它另外允许：答案能抽出来但不对给 0.1，对给 1，抽不出来给 0。这是训练时的辅助信号，不是 GSM8K 官方的对错。MathQA 上还出现中间算错、末尾猜中选项因而得分。辅助分变好，不能当成官方评测变好。[S11](#source-s11)

DAPO 的 `DAPO-Math-17K` 是从网上和竞赛站收来、改写成整数答案的约 17K 条提示，基本奖励是对 1、错 −1，另有过长惩罚。AIME 2024 放在评测里，协议就是上面的 `avg@32`。正文把两套数据写成不同用途，但没有给出训练题相对 AIME 2024 的逐条排除清单。没有这份清单，就既不能写成已经隔离，也不能写成已经重叠。[S12](#source-s12)

DeepSeekMath 的 RL 用的是 SFT 数据里和 GSM8K、MATH 相关的约 144K 道 CoT，并拿掉其他 SFT 题，用来看域外变化；优化是奖励模型加 GRPO。这 144K 没有对应到可下载的 GSM8K `train.jsonl` 或一份 MATH 分割名单。预训练语料的去污是另一条规则：10-gram 精确匹配，短于这个长度但至少 3-gram 的基准文本也做精确匹配过滤。把这条规则说成“RL 题和测试题已经逐条查过”，换了数据阶段。[S13](#source-s13)

过程奖励和上面几种末答案奖励也不是同一类目标。DeepSeek-R1 把 PRM 试失败的原因写成三件：步骤不好定义，步骤对错不好标，以及优化过程奖励时出现 reward hacking。报告同时写，这些失败不表示方法不可能有效。不能从这次试法推出任何过程奖励都会失败，也不能把过程分上升直接写成任务成功率上升。[S16](#source-s16)

## 定理管的是哪一种奖励

固定 verifier 上的 RLVR 分析，对象是奖励梯度流里的真正正确、被接受的错误和被拒绝的回答，不是 AIME、HumanEval 或 SWE-bench 的排行榜。命题 4.1–4.3 在一组条件下限制检测、识别和选择性控制：比较两种都与同一 verifier 相容的正确性标注时，问题分布、verifier、初始化和训练算法保持不变，训练日志里没有 verifier 以外的正确性反馈，并且没有假阴性。这样的日志可以在不同的“真正正确”世界里同分布，于是不能统一保证找出被接受的错误。

定理 5.1 给的是投影审计校正的瞬时行为，假设要一起成立。A1：正确、错误接受和已审计错误的概率对参数连续可微，所看的时间区间里前两者都为正。A2：固定审计集合盖住全部有概率质量的错误接受。校正够强时，总接受概率的瞬时增长率保留，错误接受的占比下降，正确回答的概率上升；更强的条件才让错误接受的绝对概率下降。再加上 A3 对校正强度和错误增长压力的统一界，才有占比的指数衰减加余项。论文写明，有限样本梯度、实际优化器和有限步长可能破坏这些效果。它没有证明离散 GRPO 在上面任何一个基准上达到全局最优。[S14](#source-s14)

Skalse 等人把 reward hacking 定义成两条策略被两个奖励排成相反的序。定理 1 和定理 2 的前提不同，结论也不同。状态和动作有限、动作不止一个、所有状态可达、奖励均值有限。若策略集合包含开集，一对非平凡且不会 hacking 的奖励，在这个集合上必须给出相同排序。若策略集合有限，而且至少两条策略的状态—动作访问计数不同，就可以造出非平凡、不会 hacking、但并不等价的奖励对。“平凡”指策略回报是否恒定，不是奖励函数看起来简不简单。

测试通过率、数据库哈希或单测，都可以被拿来代理“功能真的对了”。这个框架能把问题写成两个奖励会不会把策略排反；它没有替 HumanEval 的断言、tau-bench 的哈希或某个 PRM 检查假设是否成立，也没有证明优化器一定会找到那个反序。存在一对可被排反的策略，和这次训练已经走到了那一对，不是同一个命题。[S15](#source-s15)

所以，末答案比较、单测、修复测试和数据库终态都可以当代理奖励，但上面两组定理都不给出这些基准上的收敛率、遗憾或任务覆盖下界。`pass@k` 和 `pass^k` 约束的是怎样估计一个指标。可重置的网页环境和人工筛选提供的是实验设计。它们都不等于任意输入上都功能正确，也不等于整段对话遵守了政策。

## 来源与阅读范围

### S1：GSM8K {#source-s1}

[README](https://raw.githubusercontent.com/openai/grade-school-math/master/README.md) · [train.jsonl](https://raw.githubusercontent.com/openai/grade-school-math/master/grade_school_math/data/train.jsonl) · [test.jsonl](https://raw.githubusercontent.com/openai/grade-school-math/master/grade_school_math/data/test.jsonl) · [dataset.py](https://raw.githubusercontent.com/openai/grade-school-math/master/grade_school_math/dataset.py)

支撑：标准 test 第二条的 `#### 3`，以及 `extract_answer` / `is_correct` 只比较抽出的数值。阅读的是 README 的答案提取、该条完整记录和 dataset.py 的正则。

### S2：MATH-500 与 PRM800K {#source-s2}

[MATH-500 数据卡](https://huggingface.co/datasets/HuggingFaceH4/MATH-500/raw/main/README.md) · [test.jsonl](https://huggingface.co/datasets/HuggingFaceH4/MATH-500/resolve/main/test.jsonl) · [PRM800K README](https://raw.githubusercontent.com/openai/prm800k/main/README.md)

支撑：500 题的来源、sympy 等价及误拒/误收，以及 7,500 + 4,500 / 留 500 的切分。阅读的是数据卡、一条代数题和 README 的 Answer Grading、MATH Splits。

### S3：math-ai/aime24 {#source-s3}

[数据卡](https://huggingface.co/datasets/math-ai/aime24/raw/main/README.md) · [Parquet](https://huggingface.co/datasets/math-ai/aime24/resolve/main/test-00000-of-00001.parquet)

支撑：30 题、首条只存 `\boxed{204}`、文件不附统一评测器。阅读的是数据卡和该条记录。

### S4：HumanEval {#source-s4}

[README](https://raw.githubusercontent.com/openai/human-eval/6d43fb980f9fee3c892a914eda09951f772ad10d/README.md) · [数据](https://raw.githubusercontent.com/openai/human-eval/6d43fb980f9fee3c892a914eda09951f772ad10d/data/HumanEval.jsonl.gz) · [evaluation.py](https://raw.githubusercontent.com/openai/human-eval/6d43fb980f9fee3c892a914eda09951f772ad10d/human_eval/evaluation.py)

支撑：`HumanEval/0` 的提示与测试分离、通过测试即 `passed`、`pass@k` 在采样数不少于 k 时计算以及 3.0 秒超时。阅读的是该快照的 README、压缩数据和 evaluation.py。

### S5：SWE-bench {#source-s5}

[论文 v3](https://arxiv.org/html/2310.06770v3) · [数据卡](https://huggingface.co/datasets/SWE-bench/SWE-bench/raw/main/README.md) · [Verified 数据卡](https://huggingface.co/datasets/SWE-bench/SWE-bench_Verified/raw/main/README.md) · [grading.py](https://raw.githubusercontent.com/SWE-bench/SWE-bench/main/swebench/harness/grading.py)

支撑：2,294 / 225 的规模、`resolved` 同时要求新测试通过和旧测试保持通过、参考补丁不是唯一解，以及截止日期之后收集 issue 的条件。阅读的是论文 v3 第 2 节、两份数据卡、grading.py 和 test 首条记录。

### S6：Verified 的筛选 {#source-s6}

[发布说明](https://openai.com/index/introducing-swe-bench-verified/) · [标注说明](https://cdn.openai.com/introducing-swe-bench-verified/swe-b-annotation-instructions.pdf)

支撑：500 条来自人工筛选，测试应接受合理实现，而不是只认题面之外的函数名或报错。阅读的是发布页和标注说明第 1–5 页。

### S7：Verified 的复查 {#source-s7}

[OpenAI，2026-02-23](https://openai.com/index/why-we-no-longer-evaluate-swe-bench-verified/)

支撑：27.6% 子集上至少 59.4% 的题会拒绝功能正确的提交，以及用复现补丁或题面原句作为不再用该基准衡量前沿能力的理由。阅读的是该文的导言、过窄/过宽测试和污染部分。

### S8：tau-bench {#source-s8}

[论文 v1](https://arxiv.org/html/2406.12045v1) · [零售第一条任务](https://raw.githubusercontent.com/sierra-research/tau-bench/59a200c6d575d595120f1cb70fea53cef0632f6b/tau_bench/envs/retail/tasks_test.py) · [执行接口](https://raw.githubusercontent.com/sierra-research/tau-bench/59a200c6d575d595120f1cb70fea53cef0632f6b/tau_bench/envs/base.py)

支撑：`instruction` 给用户模拟器、分数是数据库哈希、`pass^k` 要求 k 次全部成功，以及终态奖励漏掉确认步骤。阅读的是论文 v1 的奖励与指标，和该快照第一条零售任务。

### S9：WebArena {#source-s9}

[论文 v4](https://arxiv.org/html/2307.13854v4) · [README 快照](https://raw.githubusercontent.com/web-arena-x/webarena/dce04686a56253aefba7b18a4fa0937cf1dc987b/README.md) · [evaluators.py](https://raw.githubusercontent.com/web-arena-x/webarena/dce04686a56253aefba7b18a4fa0937cf1dc987b/evaluation_harness/evaluators.py)

支撑：812 个任务、首条 `exact_match`、其他任务的 URL/页面检查与 `fuzzy_match`，以及示例观察和重置。阅读的是论文 v4 第 3.2 节、该快照 README、`test.raw.json` 首条和字符串评分实现。

### S10：SimpleRL-Zoo v2 {#source-s10}

[论文](https://arxiv.org/html/2503.18892v2)

支撑：GSM8K 与 MATH 训练集的三档难度和约 8,000 题、+1/0 奖励、评测列表，以及过难/过易和严格格式奖励的实验。阅读的是 v2 第 2.1 节和第 3.1–3.2 节。

### S11：ReFT v3 {#source-s11}

[论文](https://arxiv.org/html/2401.08967v3)

支撑：同一批训练题上的 PPO、处理后的 GSM8K 计数、0.1 的可提取分，以及 MathQA 上猜中选项仍得分。阅读的是 v3 第 3 节、第 4.1 节表 1 和第 4.4 节。

### S12：DAPO v2 {#source-s12}

[论文](https://arxiv.org/html/2503.14476v2)

支撑：17K 整数题、1/−1 与过长惩罚，以及 AIME 2024 的 `avg@32`、温度 1.0、top-p 0.7。阅读的是 v2 第 3.5 节和第 4.1 节。

### S13：DeepSeekMath v3 {#source-s13}

[论文](https://arxiv.org/html/2402.03300v3)

支撑：约 144K 相关 CoT、GRPO 与奖励模型，以及预训练语料的 10-gram / 3-gram 过滤不是 RL 题单。阅读的是 v3 第 2.1 节和第 4.2 节。

### S14：Verifier Errors in RLVR {#source-s14}

[PDF v1](https://arxiv.org/pdf/2609.35677)

支撑：命题 4.1–4.3 的不可识别性，以及定理 5.1 在 A1–A3 下的瞬时界和不延伸到离散 GRPO 的全局最优。阅读的是 v1 第 4–5 节的命题、定理和假设。

### S15：Defining and Characterizing Reward Hacking {#source-s15}

[PDF v2](https://arxiv.org/pdf/2209.13085)

支撑：hacking 的相反排序定义，定理 1 的开集条件，以及定理 2 在有限策略集上可以不等价。阅读的是 v2 第 4 节和第 5.1–5.2 节。

### S16：DeepSeek-R1 {#source-s16}

[报告 v1](https://arxiv.org/html/2501.12948v1)

支撑：PRM 试失败的三个原因，以及作者不把这次失败写成方法不可能。阅读的是 v1 第 2.2.2 节和第 4.2 节。

