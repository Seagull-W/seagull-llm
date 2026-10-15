---
title: "2026-10-15 大模型强化学习、后训练与 agentic RL"
description: "摘要筛选显示，本周 RLVR 仍在处理单轨迹信用分配和动量，自蒸馏方法继续增加，但同期对照研究发现相对 GRPO 的优势并不稳定；语言智能体工作则转向中间动作监督和执行环境内训练。"
tags: ["每日调研", "RLHF", "后训练", "Agent"]
date: "2026-10-15"
research_run: "2026-10-15-llm-post-training-agentic-rl"
---

# 2026-10-15 大模型强化学习、后训练与 agentic RL

> 检索窗口：2026-10-09T00:00:00+08:00 至 2026-10-16T00:00:00+08:00（右端不含）；实际采集截止：2026-10-15T06:39:57.303415+00:00。本篇基于公开摘要或资料摘录筛选，未进行全文精读或实验复现。

## 本周主题判断

本篇只根据公开摘要筛选，没有阅读全文，也没有复现实验。编辑判断，2026-10-15 这一窗口里与大模型后训练最贴近的摘要，并没有换成一套全新范式，而是在可验证奖励强化学习内部处理两件已经存在的问题：终端对错如何分到单个 token，以及一阶动量在采样噪声下是否还有用。智能体一侧则同时出现新的自蒸馏或中间监督方法，以及要求这些方法接受统一对照的研究。 [S1](#source-s1) [S4](#source-s4) [S6](#source-s6)

## 单轨迹信用分配与动量

Hindsight-Privileged RLVR 针对的是 GRPO 一类组内相对方法的已知缺口：同一提示下如果多次采样得到相同结果，基于奖励的学习信号会消失。摘要称，HP-RLVR 不做组采样，而是用生成策略的快照，在因果历史和包含已实现未来及验证器反馈的后见上下文中分别为合格 token 打分，再用归一化的 Jensen-Shannon 散度把终端奖励相对历史基线变成有界的 token 信用；它不需要参考解答，也不训练 critic。作者报告，在配对的 Qwen3-8B、共享 100 步日程上，HP-RLVR 在数学、代码生成和 ALFWorld 上分别比 GRPO 快 1.21 倍、1.46 倍和 2.30 倍，每个提示只用八分之一的 rollout；总体准确率大体相当，数学上三种规模都是 HP-RLVR 领先，代码和 ALFWorld 上是 GRPO 领先。摘要还称，ALFWorld 里 GRPO 的梯度范数记录有 43.2%（4B）和 49.0%（8B）为零，HP-RLVR 则没有。这些倍数和比例都是作者在摘要中的结果，不是本篇复核。 [S1](#source-s1)

另一篇摘要不改信用分配，而追问 RLVR 里的一阶动量何时有用。作者把问题写成带可验证奖励的赌博机，并用偏差校正的指数移动平均，由系数 beta 控制历史梯度权重衰减。摘要称，策略梯度被精确计算时，在避免过冲的范围内增大 beta 会严格加速；梯度来自采样回答时，学习率变小会使固定 beta 的期望收益比采样波动消失得更快，而把 beta 提高到使学习率除以一减 beta 仍处于安全区间，则可以留下最终压过波动的收益。赌博机模拟被用来定量核对这一预测。在 Qwen3-4B-Base 上，SGD 加指数移动平均以及 AdamW 的实验被作者用来支持后训练中取更大系数；在 Qwen2.5-32B 的 AdamW 上，只增大 beta1，平均验证准确率相对常规取值提高近 2 个百分点。这是摘要中的理论结论和作者实验，不能从摘要判断证明假设是否覆盖真实语言模型的全部训练动态。 [S4](#source-s4)

编辑推断：两篇都处在 RLVR 后训练，但一个改单条轨迹内部的奖励权重，一个改优化器如何累计过去梯度。摘要没有把二者放在同一实验里，因此不能推断 HP-RLVR 加上更大的动量系数会更好，也不能用其中一篇的速度或准确率数字描述另一篇。 [S1](#source-s1) [S4](#source-s4)

## 自蒸馏方法与对照检验

Function-Space Policy Optimization 仍属于用自蒸馏给 RLVR 补充 token 级监督的路线。摘要指出，无辅助策略和带反馈的自教师会一起变化，目标不稳定，因而常常再加正则。作者提出的 FSPO 是单策略框架：把稀疏的历史下一 token 分布存成固定的时间目标，从而不必一直维护一个教师模型；同时用特权分歧校正压制局部被高估的动作，在自生成证据反复失败时加强参考监督，并用质量和覆盖感知的时间记忆保留已验证行为。摘要报告，在推理和工具使用基准上、5 小时训练预算内，FSPO 的平均准确率最高，相对最强基线平均大约提高 4 个百分点，并在 Olmo3-7B-Instruct 上将峰值显存从约 70 GB 降到 56 GB。这里的提升和显存是作者给出的摘要数字。 [S2](#source-s2)

同一窗口里的对照研究直接质疑这类方法是否越加越好。摘要说，智能体强化学习中的自蒸馏评价常常复用不同实验条件下的已发表基线，同期方法之间缺少直接比较，也较少报告训练稳定性和计算成本。作者在 ALFWorld、ScienceWorld、Search-QA 和 WebShop 上，用三种模型规模把十种代表性方法与 GRPO 比较；研究包括 132 次训练、合计 12124.4 个有记录的 H800 GPU 小时，并对预训练骨干和全部十一种已训练方法用八个 rollout 种子重复评价。摘要给出的三点是：相对 GRPO 的收益范围有限，没有方法在各设置上一致更好；最终成绩可以掩盖不稳定的训练；额外训练成本并不总换成更好成绩。这是作者对这十种方法的摘要结论，不是本篇对原始日志的核对。 [S6](#source-s6)

编辑推断：不能把上述十种方法理解成已经包含 FSPO。对照摘要没有列出方法名单，FSPO 摘要也没有声称参加了该对照。因此本周同时存在两种不能直接相减的说法：一篇新方法摘要报告在自身预算下平均超过最强基线，一篇大规模再评价摘要报告没有方法稳定超过 GRPO。要判断 FSPO 落在哪一边，必须阅读全文和实验协议，摘要筛选做不到。 [S2](#source-s2) [S6](#source-s6)

## 语言智能体的中间监督与执行环境

长程语言智能体的摘要把瓶颈放在 rollout 成本和终端标量奖励浪费中间步骤。作者认为，逐步价值目标往往只是把同一个标量分到每一步，而网页或终端日志这类观测目标又长、又吵，并且只看到下一步。他们增加第三类监督：在成功的同策略轨迹上，让共享骨干根据每个历史生成随后的动作序列，并使每个动作也能从更早的历史被预测到，训练时吸收这种时间上的集成；推理时仍一步一步行动，不增加额外模型或推理开销。摘要称，在 ALFWorld、ScienceWorld、WebShop、tau 平方 bench 和 AppWorld 上，该方法相对 GRPO 以及带预测辅助目标的强化学习基线有更强的合计表现，并在两类真实应用上提高总体表现；在 ScienceWorld 上，样本效率最高达到 ECHO 的 1.9 倍和 GRPO 的 2.0 倍。采集到的摘要把方法名渲染成未展开的宏，只在代码库地址末段给出 CoPE。编辑据此暂时用仓库路径指代该方法，不能把未展开的宏当成已经核对的论文标题。 [S3](#source-s3)

接口稳健性是另一条后训练问题。摘要称，改名动作或更换记法并不改变任务，却会让智能体变差；如果每条样本仍独立打分，随机化接口只是把依赖从单一接口扩大到训练接口分布，分布外扰动依旧有害。Cross-Interface Policy Regularization 用无信息标识符替换动作名，并把同一样本放在两个按构造对齐的等价接口下，惩罚两侧动作分布的 KL 散度。作者在监督和强化学习后训练里都做了评价，并称它能提高稳健性。在智能体函数调用上，留出的接口扰动使后训练智能体的准确率下降近 25%，该方法收回 10.5%，同时未改动接口上的准确率保持不变。下降和收回的幅度是摘要中的作者结果。 [S8](#source-s8)

HarnessSQL 讨论的是训练和部署所用交互结构不一致。摘要指出，常见 text-to-SQL 训练把问题直接映射成静态查询，而真实数据库智能体要在有状态的多轮交互里查看模式、执行试探查询、诊断错误并修改假设，执行工具往往只在推理时才出现。作者的框架在监督微调和强化学习中都保留这套交互：构造隔离且可执行的数据库，并配上隐藏的执行真值；教师直接在目标 SQL 工具环境里 rollout，只保留核验过的轨迹做全序列监督微调，再用执行奖励做强化学习。摘要报告，在 Spider 2.0-SQLite 上，Qwen3-8B 的执行准确率从 15.5% 提到 45.2%，Qwen3-14B 从 22.2% 提到 54.8%，并迁移到 BIRD-Interact 和 LiveSQLBench。这是作者声称的提升，摘要没有给出误差线或对照是否使用了同一执行环境。 [S9](#source-s9)

编辑判断，这三篇摘要的共同点不是同一个算法，而是都拒绝只在终端奖励或静态输入输出上做后训练：一篇利用成功轨迹里的未来动作，一篇约束不同接口下的动作分布，一篇把数据库执行工具放进训练本身。它们的基准、模型和奖励定义不同，摘要之间不能横向排名。 [S3](#source-s3) [S8](#source-s8) [S9](#source-s9)

## 阅读建议与局限

优先阅读顺序取决于问题。如果关心 GRPO 的组采样成本和全组同结果时信号消失，先看 HP-RLVR 的全文实验设置，尤其是速度、准确率和梯度范数是否在同一日程、同一模型族上同时成立。如果关心自蒸馏是否值得继续加方法，先看那项 132 次训练的对照，再回头核对新方法摘要里的基线是不是同一协议。动量一文更适合作为优化器系数的理论线索，而不是直接替换现有训练脚本的依据。数据库和函数调用两篇则说明，后训练是否包含真实工具和接口扰动，会改变摘要里的准确率含义。 [S1](#source-s1) [S4](#source-s4) [S6](#source-s6) [S8](#source-s8) [S9](#source-s9)

关键词候选里还有三篇不应算作本周主线，但摘要内容需要单独标明，避免误当成语言模型推理后训练。Player-1 是游戏控制的后训练：作者用 6044 条带视觉推理的游戏轨迹做监督初始化，再在十六个可编程验证的合成环境里用 PPO 训练；摘要称 Player-1-9B 和 Player-1-35B-A3B 在 MineDojo-300 上相对各自监督策略提高 27.8 和 17.7 个百分点，Player-1-9B 达到 38.33%，对照评测中最强基线为 12.63%。BluePixel 把原生 4K 图像编辑写成模型加智能体工具的系统，并用强化学习调节美感与保真，摘要称在 3305 个原生 4K 案例上七个模型中排第二。NIL-TTS 则在流匹配语音模型上用 Flow-GRPO 优化噪声中的可懂度。后两篇使用了强化学习或智能体工具，但任务不是语言模型的推理后训练。 [S7](#source-s7) [S5](#source-s5) [S10](#source-s10)

局限有四层。第一，全部材料的阅读范围都是摘要，方法细节、统计检验和失败案例都可能只写在正文。第二，摘要中的速度、准确率、显存和 GPU 小时都是作者声称，本篇没有加入材料之外的数值，也没有核对这些数值。第三，资料包对候选数量有上限，关键词初筛会留下图像和语音等弱相关工作，同时可能漏掉标题和摘要都未命中关键词的论文。第四，Hugging Face 条目在本包中是发现渠道，规范链接仍指向 arXiv 摘要；社区讨论本身没有被当作证据。因此本篇不能代表该窗口的全部更新，也不能作为采用某个训练方法的决定。 [S1](#source-s1) [S5](#source-s5) [S6](#source-s6) [S7](#source-s7) [S10](#source-s10)

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
