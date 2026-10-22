---
title: "大语言模型蒸馏：从教师信号到学生自己的生成分布"
description: "围绕教师信号、学生目标与训练上下文，解释语言模型蒸馏的经典机制、黑盒指令与理由迁移、reverse KL、on-policy训练及其理论与实验边界。"
date: "2026-10-23"
tags:
  - 每日调研
  - 知识蒸馏
  - 大语言模型
  - 模型压缩
---

# 大语言模型蒸馏：从教师信号到学生自己的生成分布

大语言模型蒸馏的核心问题是：**怎样把教师在任务上的行为，变成有限容量的学生能够学会、并能在独立生成时保持的能力？** 教师给出更多文本并不足以回答这个问题。还要决定哪些行为值得迁移、用什么目标迁移，以及训练时让学生接触谁生成的上下文。近年的算法差异，主要落在这三个选择上。教师也不必严格大于学生；同一模型经过条件改变或数据筛选，也能产生自蒸馏信号。[LLM 蒸馏综述](https://arxiv.org/abs/2402.13116v3)

蒸馏通过教师信号训练学生；量化、剪枝和低秩分解主要改变数值精度或参数结构，可以与蒸馏组合，但不能替代对学习信号的讨论。

## 一、先分清信号、目标和上下文

设教师为 $p$，学生为 $q_\theta$，输入为 $x$，输出为 $y$，生成到当前位置的上下文为 $h_t=(x,y_{<t})$。比较蒸馏方法时，需要分别问：

| 选择 | 常见形式 | 决定了什么 |
| --- | --- | --- |
| 教师提供什么 | 最终答案、完整理由文本、下一个 token 的概率、隐藏表示、评价反馈 | 学生能获得多细的监督，以及需要何种教师访问权限 |
| 学生优化什么 | 文本交叉熵、forward KL、reverse KL、表示距离、奖励或偏好目标 | 有限容量优先保留哪些教师行为 |
| 在哪里接受监督 | 固定数据、教师生成的上下文、学生当下生成的上下文、混合或缓存数据 | 能否覆盖学生实际生成时遇到的错误与偏移 |

这三个维度相互独立。例如，学生生成上下文以后，仍可在该上下文上匹配教师的 **forward KL**；“on-policy”本身没有规定必须使用 reverse KL。反过来，采用反向散度也不自动意味着每次更新都重新采样学生输出。[GKD](https://arxiv.org/abs/2306.13649v3)、[DistiLLM-2](https://arxiv.org/abs/2503.07067v2)

### 从软标签理解蒸馏为何可能有效

普通监督学习把正确类别作为目标；软标签蒸馏还传递教师对其他候选的相对判断。Buciluǎ 等在 2006 年已经用集成模型给大量未标注或合成输入打标签，再训练紧凑神经网络拟合其函数。这里的关键不只是换一个小模型，还包括让迁移数据覆盖教师有意义的输入区域。[Model Compression](https://www.cs.cornell.edu/~caruana/compression.kdd06.pdf)

Hinton 等把软标签机制写成温度化的分布匹配。令 $p_\tau=\operatorname{softmax}(z^T/\tau)$、$q_{\theta,\tau}=\operatorname{softmax}(z^S/\tau)$，常见目标为

$$
\mathcal L=(1-\alpha)\operatorname{CE}(y,q_{\theta,1})
+\alpha\tau^2\operatorname{KL}(p_\tau\|q_{\theta,\tau}).
$$

教师固定时，软标签交叉熵与这个 KL 只差一个不依赖学生的熵项；$\tau^2$ 用来补偿温度导致的梯度缩小。**只有当温度相对 logit 幅度足够高，且教师和学生的 logits 都逐样本中心化时**，未乘 $\tau^2$ 的软标签项对学生 logit 的梯度才近似正比于 $(z^S-z^T)/\tau^2$，从而与 logit 平方误差建立联系。这是有条件的近似，不意味着所有温度下匹配 logits 与匹配概率都一样。较高温度揭示弱候选之间的关系，也可能放大不可靠的尾部信息。[Distilling the Knowledge in a Neural Network，§2–2.1](https://arxiv.org/abs/1503.02531v1)

语言模型把这一思想扩展到每个位置，但监督的粒度可以继续改变：

- **序列蒸馏**把教师生成的一整段文本当作标签。Kim 与 Rush 在机器翻译中用教师 beam search 的高概率译文训练学生，目标仍是文本交叉熵；它将多种可行译法收缩为更易学习的目标，改变了目标分布。用一个 beam 结果训练，是对教师序列分布的近似，不能视为完整软分布的无损转移。[Sequence-Level KD](https://arxiv.org/abs/1606.07947v1)
- **特征蒸馏**进一步约束计算过程。TinyBERT 在 BERT 理解任务中匹配教师的 attention 矩阵、投影后的隐藏表示和输出，并结合通用语料与任务数据上的两轮蒸馏。它提供比最终概率更直接的中间层监督，代价是需要白盒访问和层间对应；这一机制不能直接证明不同架构的生成模型也适合逐层照搬。[TinyBERT](https://arxiv.org/abs/1909.10351v5)

## 二、黑盒路线：把教师能力变成可学习的数据

拿不到教师 logits 时，最直接的目标是

$$
\mathcal L_{\mathrm{text}}
=\mathbb E_{(x,\tilde y)\sim D_T}[-\log q_\theta(\tilde y\mid x)].
$$

它在优化形式上就是 SFT，区别在于目标文本来自教师。若 $\tilde y$ 确实从教师完整分布采样，期望交叉熵对应序列 forward KL；经过确定性解码、正确性筛选或改写后，学生拟合的是**整理后的数据分布**。因此，这条路线的算法贡献往往在数据覆盖与监督内容，而非另造一个损失。[Sequence-Level KD](https://arxiv.org/abs/1606.07947v1)、[DeepSeek-R1](https://arxiv.org/abs/2501.12948v1)

| 路线与代表工作 | 教师信号和学生目标 | 相对只学答案，新增了什么；证据边界 |
| --- | --- | --- |
| 指令数据自举：Self-Instruct（2022） | 模型生成指令及输入输出实例，过滤后做文本 SFT | 把迁移对象从现成任务答案扩展到任务分布本身。原工作用 GPT-3 生成数据再微调自身，说明不改变参数规模也能改善指令跟随；它不是异模型压缩收益的直接证明。 |
| 理由作为辅助任务：Distilling step-by-step（2023） | PaLM 教师给出标签与理由；T5 学生优化标签 CE 加理由 CE | 用理由补充输入到答案之间的关系。T5 的任务专用实验与只用标签的微调、蒸馏对照支持数据效率收益；标签与理由是带不同任务前缀的输出任务，部署时可以只预测标签，并不要求每次都生成长推理链。 |
| 解释数据与递进教学：Orca（2023） | 从 ChatGPT 解释数据过渡到 GPT-4 解释数据，继续训练 LLaMA 学生 | 将理由监督扩展到较广的指令与推理任务，并研究教师辅助的递进学习。AGIEval 上的 GPT-4 数据单独训练对照支持整套方案的收益，但数据量、覆盖与教学顺序共同变化，不能把收益全归给顺序。 |
| 筛选后的长推理迁移：DeepSeek-R1（2025） | 用推理轨迹及其他任务样本对 Qwen、Llama 学生做 SFT | 把强教师经 RL 获得的行为转成离线训练目标。它沿用文本蒸馏目标，新增的是教师能力和数据构造；学生本身没有经历报告中的 RL 训练。 |

本表依据：[Self-Instruct](https://arxiv.org/abs/2212.10560v2)、[Distilling step-by-step](https://arxiv.org/abs/2305.02301v2)、[Orca](https://arxiv.org/abs/2306.02707v1)、[DeepSeek-R1](https://arxiv.org/abs/2501.12948v1)。

**理由蒸馏与过程正确性监督仍有区别。** 对一条教师理由做 CE，是要求学生生成这段文本；它没有为每个中间步骤提供独立的正确性判定。最终答案正确也不保证每一步推理都有效。理由可以提供有用的结构，也会把教师的冗余、错误和表达习惯一起传给学生。若研究问题是“哪一步真正改善了求解”，需要步骤级验证或相应消融，不能仅凭输出变长来判断。[Distilling step-by-step，§3](https://arxiv.org/abs/2305.02301v2)

R1 给出的具体证据也需要保留条件：其学生使用约 **80 万条样本**，包括约 60 万条推理数据和 20 万条非推理数据，而非全部都是最终 R1 生成的长思维链。报告以 Qwen-32B 基座比较直接 RL 与蒸馏：AIME 2024 的 pass@1 分别为 **47.0% 与 72.6%**；评估采用温度 0.6、top-p 0.95，最大生成长度 32,768 tokens，并以多次采样估计 pass@1。这支持在该教师、基座和数据条件下迁移强推理行为，但没有把教师训练成本与学生总算力配平，不能推出“蒸馏普遍胜过 RL”。[DeepSeek-R1，§2.3.3–2.4、§3、表6](https://arxiv.org/abs/2501.12948v1)

能力评估揭示了黑盒模仿的限制。Gudibande 等对 GPT-2、LLaMA 模仿 ChatGPT 的实验发现，流畅、结构化的回答容易获得较好的人评，但在模仿数据缺少覆盖的任务上，事实性和任务能力的差距仍然存在。这不是蒸馏不可能的定理，而是提醒：**风格迁移、特定任务迁移和通用能力迁移，是不同的实验结论。** [The False Promise of Imitating Proprietary LLMs](https://arxiv.org/abs/2305.15717v1)

## 三、白盒路线：改变分布匹配的方向

有完整概率信号时，可以直接比较

$$
D_{\mathrm F}=\mathbb E_{y\sim p}\log\frac{p(y\mid x)}{q_\theta(y\mid x)},
\qquad
D_{\mathrm R}=\mathbb E_{y\sim q_\theta}\log\frac{q_\theta(y\mid x)}{p(y\mid x)}.
$$

两者的差别在容量受限时尤其明显。forward KL 重罚“教师认为可行、学生却不给概率”的输出，倾向覆盖教师的多种模式；reverse KL 重罚“学生会生成、教师却认为不可信”的输出，倾向把有限概率质量放在教师支持的区域。若教师分布在学生模型族内且能优化到全局最优，两者都可以达到 $q=p$；所谓覆盖或择模差异，不能脱离模型族约束来谈。reverse KL 也不是正确性损失：教师高概率只是教师偏好，而非外部事实。[MiniLLM，§2](https://arxiv.org/abs/2306.08543v4)

**MiniLLM 的新增贡献是把序列 reverse KL 作为蒸馏目标并设计策略优化。** 学生先生成输出，教师提供各位置的概率反馈。完整梯度中，当前位置的更新不仅取决于该 token 的教师/学生概率比，还取决于它对后续生成的影响，即未来累计回报。论文通过单步分解、教师混合采样和长度归一化稳定训练；其中重要性权重还采用了减小方差的近似，不能把实际算法称为对原目标的完全无偏优化。Dolly 指令训练及 GPT-2、OPT、LLaMA 系列对照显示，其在多项 ROUGE、模型评判与人评设置中优于 SFT、词级 KD 和 SeqKD；这些结果支持该方案，也不能单独分离散度方向与采样策略的贡献。[MiniLLM，§2–3](https://arxiv.org/abs/2306.08543v4)

**DistiLLM-2（2025）进一步把损失与数据来源配对。** 它在教师输出上采用 skew KL，在学生输出上采用 skew reverse KL。两者都将 KL 对数比的分母分布换成教师与学生的加权混合，以缓和极端概率比；算法再逐渐改变两项权重、调整混合系数，同时增强教师支持的输出、压低学生的偏离。相比给两类数据一律套同一个损失，新增贡献在于二者协同。其 Qwen、Mistral、Gemma 师生组合，以及数学和代码任务，包含 GKD 与 DistiLLM 对照及组件消融；指令评估部分依赖模型裁判。每个训练轮次批量更新学生样本，也意味着它在样本新鲜度与生成开销之间折中，而非始终使用当次参数的严格 on-policy 数据。[DistiLLM-2，§3–5](https://arxiv.org/abs/2503.07067v2)

## 四、学生采样：在自己会走到的地方学习

即使局部概率拟合得很好，学生生成一个不同 token 后，后续上下文也可能离开教师训练轨迹。固定教师文本上的低损失，不能保证学生在这些新上下文上表现良好。因此，第二个重要改变是：**让学生生成轨迹，再让教师评价这些轨迹上的下一步。**

GKD 将这一选择与散度选择分开。其局部更新可以概括为：先从学生当前策略采样 $y$，再在 $h_t$ 上最小化 $D(p(\cdot\mid h_t),q_\theta(\cdot\mid h_t))$，也可混入固定数据。关键是论文明确**不对学生采样分布反向传播**，只更新给定上下文上的分布差异。因此，这是交互式模仿的更新方式，不能仅凭外层写了学生期望，就认作完整序列 KL 的梯度。T5 师生在摘要、翻译和算术任务中从相同 SFT 检查点出发的比较，支持学生采样的价值，同时显示最优散度随任务变化。[GKD，§3–4](https://arxiv.org/abs/2306.13649v3)

Qwen3 把这种方式接到离线蒸馏之后：先学习教师的思考与非思考输出，再由学生生成这两种模式的回答，匹配 Qwen3 教师的 logits、最小化 KL。其有力对照是：**从同一个离线蒸馏的 Qwen3-8B 检查点出发**，仅针对数学和代码任务继续训练，RL 与 on-policy 蒸馏的 AIME 2024 的每题 64 次采样平均正确率分别为 **67.6% 与 74.4%**，消耗分别为 **17,920 与 1,800 GPU 小时**。这表明该教师反馈在此续训设置中具有很好的成本收益；这些 GPU 小时不包含获得教师及前置离线检查点的全部成本。[Qwen3 Technical Report，§4.5、§4.7、表21](https://arxiv.org/abs/2505.09388v1)

学生采样也不能自动解决监督质量。2026 年预印本 *Revisiting On-Policy Distillation* 区分了完整序列 reverse KL 与只使用当前 token 对数概率比的局部更新：后者省略未来回报耦合，带来偏差，但在有界回报与梯度假设下，其最坏情形方差上界更小。其数学与智能体实验还发现，教师在学生异常上下文上可能继续支持重复文本。该工作改用教师 top-$K$ 候选集合内重新归一化的局部 reverse KL，结合采样和特殊 token 处理提升稳定性；它仍是截断目标，会遗漏集合外的概率质量，尚不能视为普适解决方案。[Revisiting OPD，§2–4、附录D](https://arxiv.org/abs/2603.25562v2)

## 五、蒸馏究竟省了什么，还受什么限制

**更强的教师不保证更好的学生。** Busbridge 等的 *Distillation Scaling Laws* 在英文 C4 预训练、师生使用不同数据划分、软标签 forward KL 的设置中，将学生性能建模为学生规模、训练 token 数与教师交叉熵的函数。实验出现容量差距：教师继续变强，固定学生反而可能更难拟合。它也区分了教师已经存在、可以摊销，以及只为一个学生另训教师的成本情形；后者计入教师成本后，直接预训练学生通常更合算。这是该训练分布和目标下的经验规律，不能直接外推为理由 SFT 或 on-policy 推理训练的缩放定律。[Distillation Scaling Laws，§4–5](https://arxiv.org/abs/2502.08606v2)

从上述证据可归纳出三条判断，而非一个通用最优算法。第一，只有文本访问时，任务覆盖、正确性筛选和适合学生的监督粒度，往往决定能迁移什么；换个损失名称不能补回缺失信号。第二，白盒概率让学生获得更细的局部反馈，但必须同时说明散度方向、上下文来源和梯度近似，才能比较方法。第三，学生采样把监督移到实际访问的上下文上，却也增加了生成与教师评分开销，并暴露教师在异常上下文上的不可靠性。[R1](https://arxiv.org/abs/2501.12948v1)、[GKD](https://arxiv.org/abs/2306.13649v3)、[Revisiting OPD](https://arxiv.org/abs/2603.25562v2)

评价一次蒸馏是否成功，至少要同时看任务正确性、独立生成时的稳定性、训练与推理成本。教师的训练成本是否已摊销，比较是否从同一学生检查点开始，输出长度与采样预算是否一致，都会改变结论。单个数学基准不能证明知识全面迁移，模型裁判偏好的表达也不能替代事实核对。长理由能够帮助求解，但其生成成本仍由部署承担；若目标是更便宜的推理，还应比较学生完成同等任务所需的总 token 与延迟。[False Promise](https://arxiv.org/abs/2305.15717v1)、[Qwen3](https://arxiv.org/abs/2505.09388v1)、[Distillation Scaling Laws](https://arxiv.org/abs/2502.08606v2)

## 来源与阅读范围

以下版本支撑相应机制与实验主张；2025–2026 年的技术报告和预印本结论仍受其报告条件约束。

| 文献版本 | 支撑主张 |
| --- | --- |
| Buciluǎ、Caruana、Niculescu-Mizil，2006，[Model Compression，KDD 作者版](https://www.cs.cornell.edu/~caruana/compression.kdd06.pdf) | 集成教师、伪数据与紧凑模型的函数拟合 |
| Hinton、Vinyals、Dean，2015，[Distilling the Knowledge in a Neural Network，v1](https://arxiv.org/abs/1503.02531v1) | 温度软标签、梯度缩放和高温 logit 近似 |
| Kim、Rush，2016，[Sequence-Level Knowledge Distillation，v1](https://arxiv.org/abs/1606.07947v1) | 词级与序列级目标、beam 近似 |
| Jiao 等，2020，[TinyBERT，v5](https://arxiv.org/abs/1909.10351v5) | attention、隐藏状态与两轮蒸馏 |
| Wang 等，2023，[Self-Instruct，v2；初稿2022](https://arxiv.org/abs/2212.10560v2) | 指令数据自举与过滤 |
| Hsieh 等，2023，[Distilling Step-by-Step，v2](https://arxiv.org/abs/2305.02301v2) | 标签与理由的多任务 CE、数据效率 |
| Mukherjee 等，2023，[Orca，v1](https://arxiv.org/abs/2306.02707v1) | 解释数据、教师辅助与递进训练 |
| Gudibande 等，2023，[The False Promise of Imitating Proprietary LLMs，v1](https://arxiv.org/abs/2305.15717v1) | 模仿风格与任务能力的评估差距 |
| Gu 等，2024，[MiniLLM，v4；初稿2023](https://arxiv.org/abs/2306.08543v4) | 序列 reverse KL、策略梯度与稳定化近似 |
| Agarwal 等，2024，[On-Policy Distillation / GKD，v3；初稿2023](https://arxiv.org/abs/2306.13649v3) | 学生采样、散度选择和局部更新 |
| Xu 等，2024，[A Survey on Knowledge Distillation of Large Language Models，v3](https://arxiv.org/abs/2402.13116v3) | 教师信号、训练算法与能力迁移的范围 |
| DeepSeek-AI，2025，[DeepSeek-R1，v1](https://arxiv.org/abs/2501.12948v1) | 离线推理数据、学生 SFT 与直接 RL 对照 |
| Qwen Team，2025，[Qwen3 Technical Report，v1](https://arxiv.org/abs/2505.09388v1) | 离线到 on-policy 蒸馏、同检查点续训对照 |
| Ko 等，2025，[DistiLLM-2，v2](https://arxiv.org/abs/2503.07067v2) | 教师与学生数据采用不同散度、批量采样与消融 |
| Busbridge 等，2025，[Distillation Scaling Laws，v2](https://arxiv.org/abs/2502.08606v2) | 预训练蒸馏的容量差距与算力分配 |
| Fu 等，2026，[Revisiting On-Policy Distillation，v2，预印本](https://arxiv.org/abs/2603.25562v2) | 局部更新偏差、方差分析与教师支持集截断 |
