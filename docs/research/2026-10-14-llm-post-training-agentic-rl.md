---
title: "2026-10-14 后训练与 agentic RL：从轨迹奖励走向步骤反馈"
description: "基于 arXiv 与 Hugging Face 公开摘要，筛选步骤信用分配、教师指导、反思训练与上下文优化的近期工作，并说明待核验的问题。"
tags: ["每日调研", "RLHF", "后训练", "Agent"]
date: "2026-10-14"
research_run: "2026-10-14-llm-post-training-agentic-rl"
---

# 后训练与 agentic RL：从轨迹奖励走向步骤反馈

::: info 本期要点
- **让反馈落到步骤。** DeltaTTG 与 ProAS 从不同角度重新分配轨迹级信号。 [S5](#source-s5) [S6](#source-s6)
- **教师也需要校准。** 技能生成和 token 级反馈，要与信号可靠性一起考察。 [S1](#source-s1) [S3](#source-s3)
- **区分两类优化。** TextualRL 更新文本上下文，与模型参数训练分开理解。 [S9](#source-s9)

以上为对所选摘要的编辑归纳，尚未核验全文或复现实验。
:::

> 检索窗口：2026-10-08T00:00:00+08:00 至 2026-10-15T00:00:00+08:00（右端不含）；实际采集截止：2026-10-14T05:39:04.095490+00:00。本篇基于公开摘要或资料摘录筛选，未进行全文精读或实验复现。

## 本次筛选：训练信号如何落到具体动作

本次材料中一个反复出现的问题是：多轮任务最终成功或失败，并不能直接告诉模型哪些中间动作值得保留。DeltaTTG 与 ProAS 尝试细化步骤信用分配，RSIPO 与 Agent-Reflex 则把技能或反思纳入训练。这里的共同线索是让轨迹级结果提供更细的行为反馈；这是对所选摘要的编辑归纳，不能据此断言整个领域已经形成统一路线。 [S1](#source-s1) [S4](#source-s4) [S5](#source-s5) [S6](#source-s6)

## 步骤信用分配：学习进度与参考图的两种办法

DeltaTTG 把距任务完成还需生成的 token 数量作为剩余工作量的代理，利用不同策略产生的历史轨迹训练进度估计器。训练策略时，冻结的估计器通过预测变化把结果优势重新分配到各步骤。摘要强调它不修改原始奖励，并保留轨迹优势的符号和平均尺度。作者报告了多个任务上的提升；下一步精读应检查进度估计是否把更短的输出误当作更有效的动作，以及训练数据分布变化时的稳定性。 [S5](#source-s5)

ProAS 从另一侧处理同一问题：成功轨迹里也可能包含无效动作，失败轨迹中的早期偏差则可能产生连锁影响。它使用动态演化的 Agentic Reference Graph，分别屏蔽不合理的正向激励和重新分配惩罚。作者在摘要中报告其可改善基于分组的训练基线。与 DeltaTTG 对照阅读时，值得核验参考图的构建成本、错误图带来的偏差，以及两种方法是否使用了相当的训练预算；摘要不足以直接比较优劣。 [S6](#source-s6) [S5](#source-s5)

| 工作 | 步骤反馈依据 | 精读时要检查 |
| --- | --- | --- |
| DeltaTTG | 剩余 token 的预测变化 | 是否把更短的输出误当作更有效的动作 |
| ProAS | 动态演化的参考图 | 构建成本与错误图带来的偏差 |

::: warning 待核验
两种方法是否使用了相当的训练预算？摘要不足以直接比较优劣，需进一步核对训练配置、基线与消融实验。 [S5](#source-s5) [S6](#source-s6)
:::

## 教师指导：既要提供信号，也要控制信任

RSIPO 把 agentic skills 和策略放在共同演化的训练循环中：策略从完成的轨迹提取技能，再通过轨迹回放优化技能生成。同时，它用经验贝叶斯收缩校准学生对教师 token 评分的信任，针对带技能上下文的教师也可能不可靠这一问题。作者报告在具身交互和搜索任务中优于所比较的基线。后续需要核对技能质量如何评估、教师校准是否独立于技能生成收益，以及额外训练成本。 [S1](#source-s1)

SeTPO 面向小语言模型的工具学习：在低奖励轨迹上引入由反向 KL 导出的 token 级教师反馈，同时用正向 KL 监督保留教师示范行为。它针对单靠强化学习探索困难、直接模仿又存在分布不匹配的问题。摘要里的理论结果建立在理想化双向 KL 目标上，应与实际算法的实验表现分开理解。与 RSIPO 一起看，教师信号的选择、可靠性和学生探索之间的关系，是值得继续追踪的后训练问题。 [S3](#source-s3) [S1](#source-s1)

## 反思训练：把失败恢复变成有监督的行为

Agent-Reflex 把工具返回噪声和用户纠正作为训练环境的一部分。其流程先通过扰动和成功失败配对提取反思元技能，再用 Reflective SFT 学习反思、恢复和响应用户纠正，最后把带噪交互中的 agentic RL 与反思指导的 on-policy 蒸馏结合。作者报告多组长任务工具使用评测上的改善。这里的反思是训练目标与数据组织方式，不等于提示模型写一段自我评价；是否能可靠识别错误原因、避免形式化反思，仍需阅读具体评测与消融。 [S4](#source-s4)

## TextualRL：奖励驱动的上下文更新与参数训练分开看

TextualRL 不更新模型参数，而是根据任务奖励修改指导 Agent 的文本上下文。它在同一任务、同一上下文下比较多次尝试，再汇总跨组证据审查修改提案，用有界文本补丁更新上下文，并通过留出验证奖励决定是否采用。作者报告在多种 Agent 和基准上的收益。对于研究工作流，这提供了一个可以继续考察的思路：将失败案例用于修改可复用的检索或写作规则，但必须用独立样本验证，不能把一次任务的局部修复直接推广为长期规则。这一应用建议是编辑推断，并非论文已验证的本网站实验。 [S9](#source-s9)

## 接下来优先精读什么

::: tip 精读路径
如果主要关注 agentic RL 的训练算法，建议先对照 DeltaTTG 和 ProAS，检查它们怎样改变步骤优势、需要什么额外信号，以及是否保持训练预算可比；再看 RSIPO 的技能生成与教师校准能否分别解释收益。如果主要关注鲁棒工具使用，可先读 Agent-Reflex，再与 SeTPO 的教师指导机制比较。这个顺序按研究问题安排，不是性能排行榜。 [S5](#source-s5) [S6](#source-s6) [S1](#source-s1) [S4](#source-s4) [S3](#source-s3)
:::

## 阅读边界与尚未核验的问题

本篇只对公开摘要作筛选和问题归纳，尚未核对全文中的数据划分、训练配置、预算、基线实现与消融实验，也未运行代码。不同论文的模型规模、环境和评估口径不一致，因此没有把各自报告的分数放在一起比较。Hugging Face Daily Papers 用于发现社区条目，不能代表完整论文集合；arXiv 检索也受查询词和候选数量限制。以上工作值得进入后续精读清单，但摘要中的优势仍是作者报告，不能当作独立复现结论。 [S1](#source-s1) [S3](#source-s3) [S4](#source-s4) [S5](#source-s5) [S6](#source-s6) [S9](#source-s9)

## 来源与阅读范围

### S1：RSIPO: Recursive Self-Improving Policy Optimization for Agentic Reinforcement Learning via Skill-Policy Co-Evolution {#source-s1}

[原始来源](https://arxiv.org/abs/2610.15772) · [Hugging Face 社区条目](https://huggingface.co/papers/2610.15772)

发布时间：2026-10-11T00:00:00.000Z；更新时间：2026-10-11T00:00:00.000Z。

阅读范围：abstract；发现渠道：huggingface-daily。

### S3：Teacher-Guided Tool Learning for Small Language Models via Bidirectional KL Constraints {#source-s3}

[原始来源](https://arxiv.org/abs/2610.18459)

发布时间：2026-10-13T14:26:41Z；更新时间：2026-10-13T14:26:41Z。

阅读范围：abstract；发现渠道：arxiv。

### S4：Agent-Reflex: Teaching Language Agents to Act Reflectively {#source-s4}

[原始来源](https://arxiv.org/abs/2610.17953)

发布时间：2026-10-13T08:36:20Z；更新时间：2026-10-13T08:36:20Z。

阅读范围：abstract；发现渠道：arxiv。

### S5：DeltaTTG: Training Multi-Turn Agents with a Token-to-Go Progress Meter {#source-s5}

[原始来源](https://arxiv.org/abs/2610.17666) · [Hugging Face 社区条目](https://huggingface.co/papers/2610.17666)

发布时间：2026-10-13T00:00:00.000Z；更新时间：2026-10-13T00:00:00.000Z。

阅读范围：abstract；发现渠道：huggingface-daily。

### S6：ProAS: A Progress-Aware Advantage Shaping Framework for Multi-Turn Agentic Reinforcement Learning {#source-s6}

[原始来源](https://arxiv.org/abs/2610.18683)

发布时间：2026-10-13T16:39:38Z；更新时间：2026-10-13T16:39:38Z。

阅读范围：abstract；发现渠道：arxiv。

### S9：TextualRL: Textual Reinforcement Learning for Context Management {#source-s9}

[原始来源](https://arxiv.org/abs/2610.18216)

发布时间：2026-10-13T11:47:32Z；更新时间：2026-10-13T11:47:32Z。

阅读范围：abstract；发现渠道：arxiv。
