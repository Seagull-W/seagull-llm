---
title: "2026-10-15 大模型强化学习、后训练与 agentic RL"
description: "摘要筛选显示，本周 RLVR 仍在处理单轨迹信用分配和动量，自蒸馏方法继续增加，但同期对照研究发现相对 GRPO 的优势并不稳定；语言智能体工作则转向中间动作监督和执行环境内训练。"
tags: ["每日调研", "RLHF", "后训练", "Agent"]
date: "2026-10-15"
research_run: "2026-10-15-llm-post-training-agentic-rl"
---

# 2026-10-15 大模型强化学习、后训练与 agentic RL

::: info 本期要点
- **信用分配与动量要分开看。** HP-RLVR 改单轨迹 token 信用，动量论文研究历史梯度的累计。 [S1](#source-s1) [S4](#source-s4)
- **自蒸馏收益需要统一对照。** 新方法的摘要优势与同期再评价结论，不能直接相减。 [S2](#source-s2) [S6](#source-s6)
- **中间动作与执行环境进入训练。** 语言智能体工作分别利用未来动作、接口一致性和数据库工具交互。 [S3](#source-s3) [S8](#source-s8) [S9](#source-s9)

以上为对所选摘要的编辑归纳，属于摘要筛选，尚未核验全文或复现实验。
:::

> 检索窗口：2026-10-09T00:00:00+08:00 至 2026-10-16T00:00:00+08:00（右端不含）；实际采集截止：2026-10-15T06:39:57.303415+00:00。本篇基于公开摘要或资料摘录筛选，未进行全文精读或实验复现。

## 本次筛选：训练信号与对照证据如何一起看

**编辑归纳：**这一窗口里与大模型后训练最贴近的摘要，仍在可验证奖励强化学习内部处理终端对错如何分到单个 token，以及一阶动量在采样噪声下是否有用。智能体一侧同时出现新的自蒸馏或中间监督方法，以及要求这些方法接受统一对照的研究；这些摘要并未显示一套全新范式。 [S1](#source-s1) [S4](#source-s4) [S6](#source-s6)

## 单轨迹信用分配与动量

### Hindsight-Privileged RLVR

HP-RLVR 针对 GRPO 一类组内相对方法的缺口：同一提示下多次采样得到相同结果时，基于奖励的学习信号会消失。 [S1](#source-s1)

**方法要点：**

- 不做组采样，用生成策略的快照，在因果历史和包含已实现未来及验证器反馈的后见上下文中，分别为合格 token 打分。 [S1](#source-s1)
- 用归一化的 Jensen-Shannon 散度，把终端奖励相对历史基线变成有界的 token 信用；不需要参考解答，也不训练 critic。 [S1](#source-s1)

**摘要里的作者结果：**

- 在配对的 Qwen3-8B、共享 100 步日程上，数学、代码生成和 ALFWorld 分别比 GRPO 快 1.21 倍、1.46 倍和 2.30 倍，每个提示只用八分之一的 rollout。 [S1](#source-s1)
- 总体准确率大体相当；数学上三种规模都是 HP-RLVR 领先，代码和 ALFWorld 上是 GRPO 领先。 [S1](#source-s1)
- ALFWorld 中，GRPO 的梯度范数记录有 43.2%（4B）和 49.0%（8B）为零，HP-RLVR 则没有。以上倍数和比例均为作者摘要结果。 [S1](#source-s1)

**编辑精读问题：**速度、准确率和梯度范数是否在同一日程、同一模型族上同时成立？需要核对全文实验设置。 [S1](#source-s1)

### RLVR 中的一阶动量

动量论文追问一阶动量在 RLVR 里何时有用，关注优化器如何累计过去梯度。 [S4](#source-s4)

**方法要点：**把问题写成带可验证奖励的赌博机，用偏差校正的指数移动平均，由系数 beta 控制历史梯度权重衰减。 [S4](#source-s4)

**摘要里的作者理论与实验结果：**

- 精确计算策略梯度时，在避免过冲的范围内增大 beta 会严格加速。 [S4](#source-s4)
- 梯度来自采样回答时，学习率变小会使固定 beta 的期望收益比采样波动消失得更快；把 beta 提高到使学习率除以一减 beta 仍处于安全区间，可以留下最终压过波动的收益。作者用赌博机模拟定量核对这一预测。 [S4](#source-s4)
- Qwen3-4B-Base 上的 SGD 加指数移动平均及 AdamW 实验，被作者用于支持后训练中取更大系数；Qwen2.5-32B 的 AdamW 上，只增大 beta1，平均验证准确率相对常规取值提高近 2 个百分点。 [S4](#source-s4)

**编辑精读问题：**摘要中的证明假设是否覆盖真实语言模型的全部训练动态？这些结果更适合作为优化器系数的理论线索，不能直接作为替换现有训练脚本的依据。 [S4](#source-s4)

| 工作 | 核心做法 | 摘要里的作者结果 | 精读时要检查 |
| --- | --- | --- | --- |
| HP-RLVR | 调整单条轨迹内部的 token 信用，无需组采样。 [S1](#source-s1) | 报告 rollout 与速度收益，同时保留准确率的分任务差异。 [S1](#source-s1) | 速度、准确率与梯度范数的实验条件是否一致。 [S1](#source-s1) |
| 动量论文 | 用指数移动平均累计历史梯度。 [S4](#source-s4) | 报告理论加速条件及语言模型实验收益。 [S4](#source-s4) | 理论假设是否覆盖真实训练动态。 [S4](#source-s4) |

::: warning 待核验：两篇没有放在同一实验
编辑判断：两篇都处在 RLVR 后训练，但一个改轨迹内部的奖励权重，一个改优化器如何累计过去梯度。摘要没有把二者放在同一实验里，不能推断 HP-RLVR 加上更大动量系数会更好，也不能用一篇的速度或准确率数字描述另一篇。 [S1](#source-s1) [S4](#source-s4)
:::

## 自蒸馏方法与对照检验

### Function-Space Policy Optimization

FSPO 用自蒸馏给 RLVR 补充 token 级监督。摘要指出，无辅助策略和带反馈的自教师会一起变化，使目标不稳定，因而常常再加正则。 [S2](#source-s2)

**方法要点：**

- 采用单策略框架，将稀疏的历史下一 token 分布存成固定的时间目标，不必一直维护一个教师模型。 [S2](#source-s2)
- 用特权分歧校正压制局部被高估的动作；自生成证据反复失败时加强参考监督，用质量和覆盖感知的时间记忆保留已验证行为。 [S2](#source-s2)

**摘要里的作者结果：**在推理和工具使用基准上、5 小时训练预算内，平均准确率最高，相对最强基线平均大约提高 4 个百分点；在 Olmo3-7B-Instruct 上，峰值显存从约 70 GB 降到 56 GB。 [S2](#source-s2)

**编辑精读问题：**新方法摘要里的基线是否使用同一实验协议？要判断其与同期对照研究的关系，必须阅读全文和实验协议。 [S2](#source-s2) [S6](#source-s6)

### 自蒸馏的统一对照研究

这项研究追问自蒸馏方法是否越加越好。摘要指出，已有评价常复用不同实验条件下的已发表基线，同期方法缺少直接比较，也较少报告训练稳定性和计算成本。 [S6](#source-s6)

**方法要点：**

- 在 ALFWorld、ScienceWorld、Search-QA 和 WebShop 上，用三种模型规模将十种代表性方法与 GRPO 比较。 [S6](#source-s6)
- 包括 132 次训练、合计 12124.4 个有记录的 H800 GPU 小时；对预训练骨干和全部十一种已训练方法，用八个 rollout 种子重复评价。 [S6](#source-s6)

**摘要里的作者结果：**

- 相对 GRPO 的收益范围有限，没有方法在各设置上一致更好。 [S6](#source-s6)
- 最终成绩可以掩盖不稳定的训练；额外训练成本并不总换成更好成绩。 [S6](#source-s6)

**编辑精读问题：**需要核对方法名单、实验协议和原始日志；上述结果是作者对这十种方法的摘要结论，本篇尚未复核。 [S6](#source-s6)

| 工作 | 核心做法 | 摘要里的作者结果 | 精读时要检查 |
| --- | --- | --- | --- |
| FSPO | 用固定时间目标和时间记忆进行单策略自蒸馏。 [S2](#source-s2) | 自身预算下平均准确率超过所比较的最强基线，且降低峰值显存。 [S2](#source-s2) | 基线是否使用同一协议。 [S2](#source-s2) [S6](#source-s6) |
| 自蒸馏对照研究 | 统一比较十种方法与 GRPO，并重复评价。 [S6](#source-s6) | 没有方法在各设置上一致更好，成本与最终成绩需分开看。 [S6](#source-s6) | 方法名单、训练稳定性与计算成本。 [S6](#source-s6) |

::: warning 待核验：不能把 FSPO 算入十种方法
编辑判断：对照摘要没有列出方法名单，FSPO 摘要也没有声称参加了该对照，不能理解为 FSPO 已进入那十种自蒸馏对照。一篇新方法在自身预算下平均超过最强基线，与一篇再评价报告没有方法稳定超过 GRPO，是不能直接相减的两种说法；摘要筛选无法判断 FSPO 落在哪一边。 [S2](#source-s2) [S6](#source-s6)
:::

## 语言智能体的中间监督与执行环境

### 未来动作监督：暂用代码库路径末段 CoPE 指代

这篇工作针对长程语言智能体的 rollout 成本，以及终端标量奖励未充分利用中间步骤的问题。作者认为，逐步价值目标常只是把同一标量分到每一步，而网页或终端日志等观测目标又长、又吵，且只看到下一步。 [S3](#source-s3)

**方法要点：**

- 增加第三类监督：在成功的同策略轨迹上，让共享骨干根据每个历史生成随后的动作序列，使每个动作也能从更早的历史被预测到，在训练时吸收这种时间上的集成。 [S3](#source-s3)
- 推理时仍一步一步行动，不增加额外模型或推理开销。 [S3](#source-s3)

**摘要里的作者结果：**

- 在 ALFWorld、ScienceWorld、WebShop、tau 平方 bench 和 AppWorld 上，相对 GRPO 及带预测辅助目标的强化学习基线有更强的合计表现，并在两类真实应用上提高总体表现。 [S3](#source-s3)
- ScienceWorld 上，样本效率最高达到 ECHO 的 1.9 倍和 GRPO 的 2.0 倍。 [S3](#source-s3)

**编辑精读问题与命名边界：**采集到的摘要中，方法名是未展开的宏；CoPE 只是代码库地址的路径末段。本篇暂用仓库路径指代，不能把未展开的宏当成已核对的论文标题；方法细节仍需全文核验。 [S3](#source-s3)

### Cross-Interface Policy Regularization

这篇工作处理接口稳健性：摘要称，改名动作或更换记法不改变任务，却会让智能体变差；独立给每条样本打分时，随机化接口只是将依赖扩大到训练接口分布，分布外扰动依旧有害。 [S8](#source-s8)

- **方法要点：**用无信息标识符替换动作名，把同一样本放在两个按构造对齐的等价接口下，惩罚两侧动作分布的 KL 散度。 [S8](#source-s8)
- **摘要里的作者结果：**在监督和强化学习后训练中均有评价，并报告稳健性提高。智能体函数调用上，留出的接口扰动使后训练智能体准确率下降近 25%，该方法收回 10.5%，未改动接口上的准确率保持不变。 [S8](#source-s8)
- **编辑精读问题：**核对接口扰动设置；后训练是否包含接口扰动，会改变这些准确率的含义。下降与收回的幅度目前均为作者摘要结果。 [S8](#source-s8)

### HarnessSQL

HarnessSQL 讨论训练和部署交互结构不一致：常见 text-to-SQL 训练将问题映射成静态查询，真实数据库智能体却需要在有状态的多轮交互中查看模式、执行试探查询、诊断错误并修改假设，而执行工具往往只在推理时出现。 [S9](#source-s9)

**方法要点：**

- 在监督微调和强化学习中都保留交互，构造隔离且可执行的数据库，配上隐藏的执行真值。 [S9](#source-s9)
- 教师直接在目标 SQL 工具环境里 rollout，只保留核验过的轨迹做全序列监督微调，再用执行奖励做强化学习。 [S9](#source-s9)

**摘要里的作者结果：**Spider 2.0-SQLite 上，Qwen3-8B 的执行准确率从 15.5% 提到 45.2%，Qwen3-14B 从 22.2% 提到 54.8%，并迁移到 BIRD-Interact 和 LiveSQLBench。 [S9](#source-s9)

**编辑精读问题：**摘要没有给出误差线，也未说明对照是否使用同一执行环境，需要在全文核对。 [S9](#source-s9)

::: warning 待核验：三篇不能横向排名
编辑归纳：三篇分别利用成功轨迹的未来动作、约束不同接口的动作分布、将数据库执行工具放进训练。它们共同超出了只依赖终端奖励或静态输入输出的后训练，但并非同一算法，基准、模型和奖励定义也不同，不能从摘要横向排名。 [S3](#source-s3) [S8](#source-s8) [S9](#source-s9)
:::

## 关键词命中的工作：哪些不属于本期主线

**编辑范围判断：**Player-1、BluePixel、NIL-TTS 都不属于本期语言模型推理后训练主线，需单独标明任务边界。 [S7](#source-s7) [S5](#source-s5) [S10](#source-s10)

### Player-1

Player-1 是游戏控制的后训练。 [S7](#source-s7)

- **方法要点：**用 6044 条带视觉推理的游戏轨迹做监督初始化，再在十六个可编程验证的合成环境里用 PPO 训练。 [S7](#source-s7)
- **摘要里的作者结果：**Player-1-9B 和 Player-1-35B-A3B 在 MineDojo-300 上，相对各自监督策略提高 27.8 和 17.7 个百分点；Player-1-9B 达到 38.33%，对照评测中最强基线为 12.63%。 [S7](#source-s7)
- **编辑精读问题：**这些数字尚未核对全文实验条件；应放在游戏控制任务中理解。 [S7](#source-s7)

### BluePixel

BluePixel 面向原生 4K 图像编辑。 [S5](#source-s5)

- **方法要点：**将任务写成模型加智能体工具的系统，用强化学习调节美感与保真。 [S5](#source-s5)
- **摘要里的作者结果：**在 3305 个原生 4K 案例上，七个模型中排第二。 [S5](#source-s5)
- **编辑精读问题：**该结果仍需全文核验；强化学习或智能体工具的使用，不能将图像编辑变成语言模型推理后训练。 [S5](#source-s5)

### NIL-TTS

NIL-TTS 面向噪声中的语音可懂度。 [S10](#source-s10)

- **方法要点：**在流匹配语音模型上用 Flow-GRPO 优化可懂度。 [S10](#source-s10)
- **摘要里的作者结果：**现有摘录仅说明优化目标，未列出具体实验结果。 [S10](#source-s10)
- **编辑精读问题：**方法细节和实验结果仍需全文核验；该任务属于语音合成，不能归入语言模型推理后训练主线。 [S10](#source-s10)

## 接下来优先精读什么

::: tip 精读路径
- 关注 GRPO 的组采样成本和全组同结果时信号消失：先读 HP-RLVR，核对速度、准确率和梯度范数的全文实验条件。 [S1](#source-s1)
- 关注自蒸馏是否值得继续加方法：先读 132 次训练的对照，再核对新方法摘要中的基线是否为同一协议。 [S6](#source-s6) [S2](#source-s2)
- 关注优化器系数：将动量论文作为理论线索，核对其假设与真实训练动态的关系。 [S4](#source-s4)
- 关注工具使用：核对数据库和函数调用工作是否把真实工具及接口扰动纳入后训练，再理解准确率。 [S8](#source-s8) [S9](#source-s9)
:::

## 阅读边界与尚未核验的问题

- **只读摘要：**全部材料的阅读范围都是摘要，未进行全文精读或实验复现。方法细节、统计检验和失败案例都可能只写在正文。 [S1](#source-s1) [S5](#source-s5) [S6](#source-s6) [S7](#source-s7) [S10](#source-s10)
- **数字属于作者声称：**速度、准确率、显存和 GPU 小时均未由本篇核对，也没有补入材料之外的数值。 [S1](#source-s1) [S2](#source-s2) [S4](#source-s4) [S5](#source-s5) [S6](#source-s6) [S7](#source-s7) [S8](#source-s8) [S9](#source-s9)
- **检索有上限：**资料包限制候选数量，关键词初筛会留下图像、语音等弱相关工作，也可能漏掉标题与摘要未命中关键词的论文。 [S5](#source-s5) [S7](#source-s7) [S10](#source-s10)
- **发现渠道不等于证据：**Hugging Face 条目在本包中用于发现工作，规范链接仍指向 arXiv 摘要；社区讨论没有被当作证据。本篇不能代表窗口内全部更新，也不能作为采用某个训练方法的决定。 [S6](#source-s6) [S7](#source-s7) [S9](#source-s9)

## 来源与阅读范围

### S1：Hindsight-Privileged RLVR: Single-Rollout Token Credit Without Group Sampling {#source-s1}

[原始来源](https://arxiv.org/abs/2610.20497)

发布时间：2026-10-14T17:06:59Z；更新时间：2026-10-14T17:06:59Z。

阅读范围：abstract；发现渠道：arxiv。

### S2：Function-Space Temporal Self-Distillation for Policy Optimization {#source-s2}

[原始来源](https://arxiv.org/abs/2610.19687)

发布时间：2026-10-14T07:10:49Z；更新时间：2026-10-14T07:10:49Z。

阅读范围：abstract；发现渠道：arxiv。

### S3：Co-Evolving Acting and Forecasting for Language Agents {#source-s3}

[原始来源](https://arxiv.org/abs/2610.20597)

发布时间：2026-10-14T17:59:28Z；更新时间：2026-10-14T17:59:28Z。

阅读范围：abstract；发现渠道：arxiv。

### S4：When Does Momentum Help in Reinforcement Learning with Verifiable Rewards? {#source-s4}

[原始来源](https://arxiv.org/abs/2610.20413)

发布时间：2026-10-14T16:11:14Z；更新时间：2026-10-14T16:11:14Z。

阅读范围：abstract；发现渠道：arxiv。

### S5：BluePixel: Toward Native 4K Agentic Image Editing {#source-s5}

[原始来源](https://arxiv.org/abs/2610.19882)

发布时间：2026-10-14T09:37:09Z；更新时间：2026-10-14T09:37:09Z。

阅读范围：abstract；发现渠道：arxiv。

### S6：More Methods, Better Agents? A Reality Check on Self-Distillation in Agentic Reinforcement Learning {#source-s6}

[原始来源](https://arxiv.org/abs/2610.19789) · [Hugging Face 社区条目](https://huggingface.co/papers/2610.19789)

发布时间：2026-10-14T08:36:31Z；更新时间：2026-10-14T08:36:31Z。

阅读范围：abstract；发现渠道：arxiv, huggingface-daily。

### S7：Player-1: Learning to Play from Synthetic Experience {#source-s7}

[原始来源](https://arxiv.org/abs/2610.20584) · [Hugging Face 社区条目](https://huggingface.co/papers/2610.20584)

发布时间：2026-10-14T17:57:12Z；更新时间：2026-10-14T17:57:12Z。

阅读范围：abstract；发现渠道：arxiv, huggingface-daily。

### S8：One Task, Many Interfaces: Simple Cross-Interface Consistency Training Improves LLM Agent Robustness {#source-s8}

[原始来源](https://arxiv.org/abs/2610.20576)

发布时间：2026-10-14T17:56:06Z；更新时间：2026-10-14T17:56:06Z。

阅读范围：abstract；发现渠道：arxiv。

### S9：HarnessSQL: Harness-Native Training for SQL Agents in Realistic Database Environments {#source-s9}

[原始来源](https://arxiv.org/abs/2610.12274) · [Hugging Face 社区条目](https://huggingface.co/papers/2610.12274)

发布时间：2026-10-08T16:36:39Z；更新时间：2026-10-14T16:34:47Z。

阅读范围：abstract；发现渠道：arxiv, huggingface-daily。

### S10：Noise-Aware Lombard Speech Synthesis via Flow-GRPO for Intelligibility Optimization {#source-s10}

[原始来源](https://arxiv.org/abs/2610.20181)

发布时间：2026-10-14T13:29:29Z；更新时间：2026-10-14T13:29:29Z。

阅读范围：abstract；发现渠道：arxiv。
