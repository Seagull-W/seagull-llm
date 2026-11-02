---
title: "Score Centering：消掉追随采样器的漂移，仍要面对采样分布偏差"
description: "精读 Score Centering Stabilizes Off-policy Reinforcement Learning：从逐前缀梯度分解解释训推不一致如何产生蒸馏漂移、分组中心化与裁剪为何留有残差，以及量化、陈旧和 top-k 近似实验能支持到哪里。"
date: "2026-11-02"
tags: ["每日调研", "强化学习", "策略梯度", "训练推理不一致", "模型量化"]
---

# Score Centering：消掉追随采样器的漂移，仍要面对采样分布偏差

训推不一致（training-inference mismatch，TIM）最反常的后果，是模型可能在没有任何奖励差异可学时仍然更新。采样器与训练器只差一点数值，策略梯度就会多出一个方向：把训练器推向采样器。下一轮采样器又从训练器同步权重，带着同一种偏差回来，更新于是可能反复吸收这份误差。

Martin Marek 与 Max Ryabinin 的 **Score Centering Stabilizes Off-policy Reinforcement Learning** 把这个方向从奖励学习信号中拆出，称为 drift，再用 score centering（SC）逐前缀消掉它。论文最有力的证据，是在刻意加重的量化失配中，只做这一项加性修正也能让训练保持稳定。它的边界同样清楚：消掉 drift 后，学习信号仍由采样器分布决定；采样器严重陈旧时，SC 与重要性采样组合更好。论文于 2026 年 9 月 17 日提交，当前为 arXiv v1；摘要页未列出会议或期刊接收信息。[论文与版本记录](https://arxiv.org/abs/2609.20807)

## 奖励完全一样，梯度为什么还会动

固定一个生成前缀 $h$。下一个 token 从采样器 $q(\cdot\mid h)$ 抽取，梯度却通过训练器 $p_\theta(\cdot\mid h)$ 计算。记

$$
p_v=p_\theta(v\mid h),\qquad q_v=q(v\mid h),\qquad
s_v=\nabla_\theta\log p_v,\qquad
\bar s=\sum_vq_vs_v.
$$

这里的 score 是参数梯度向量，不是奖励分数。以下期望都固定前缀；奖励 $R$ 可以来自后续整条 completion，因此期望也包含后续生成的随机性。采样分布在本次求梯度时视为固定。

On-policy 时，score 的均值自动为零：

$$
\mathbb E_p[s]=\sum_vp_v\nabla_\theta\log p_v
=\sum_v\nabla_\theta p_v=0.
$$

所以，如果所有回答都得到 $+1$，期望更新就是零。换成从 $q$ 采样，这个抵消关系通常失效：$\sum_vq_v\nabla_\theta\log p_v$ 没有理由等于零。论文第 4 节的式（3）用协方差恒等式将更新写成

$$
\mathbb E_q[R s]
=\underbrace{\mathbb E_q[R]\,\bar s}_{\text{drift}}
+\underbrace{\operatorname{Cov}_q(R,s)}_{\text{signal}}.
$$

第二项需要知道奖励与 token 的配对关系：哪些选择更常伴随高奖励。第一项只看奖励均值；即使在同一前缀后把奖励与 token 的对应关系打乱，只要均值不变，这一项就不变。恒定奖励时协方差为零，留下的全部更新都是 drift。[第 4 节](https://arxiv.org/html/2609.20807v1#S4)

一个两 token 的教学例子能把它算出来。设训练器用一个 logit $\theta$ 控制 token $a$ 的概率，$p_a=\sigma(\theta)$，$p_b=1-p_a$。在 $p_a=p_b=0.5$ 时，两个 score 分别为 $s_a=0.5$、$s_b=-0.5$。若采样器给出 $q_a=0.9$、$q_b=0.1$，则

$$
\bar s=0.9\times0.5+0.1\times(-0.5)=0.4.
$$

所有 token 都得 $+1$，普通更新仍会增大 $\theta$，提高 $p_a$。环境没有偏爱 $a$，采样器偏爱了它，训练器便跟着偏爱它。这是用于解释公式的构造例子，并非论文实验。

## Drift 为什么是蒸馏，以及为什么在线循环会放大它

把采样器当作教师，在同一前缀上定义交叉熵

$$
\mathcal L_{\mathrm{CE}}(q,p)=-\sum_vq_v\log p_v.
$$

固定 $q$ 求导，有 $-\nabla_\theta\mathcal L_{\mathrm{CE}}=\bar s$。因此，drift 正好沿着向采样器蒸馏的方向，强度由该前缀的期望奖励决定。期望奖励为正时拉向采样器，为负时推离采样器；它对所有 token 的处理取决于教师分布，而不取决于这些 token 是否影响最终正确性。

这也解释了为何“小误差”仍值得担心。固定教师的离线蒸馏有一个相对固定的拟合对象。在线 TIM 中，教师是学生经过量化或延迟同步得到的有偏副本：训练器吸收偏差，更新后的权重又交给采样器，采样器继续生成带偏的数据。论文的因果解释落在这个反馈循环上，而不是单次前向误差的绝对大小上。[第 3、4 节](https://arxiv.org/html/2609.20807v1#S3)

<figure><img loading="lazy" src="/research/2026-11-02-score-centering-tim/fig-1-drift-loop.svg" alt="训练器与采样器构成回路的示意图，以及期望更新拆成 drift 与 signal 两项" /><figcaption>图 1｜本文自绘。支撑上面这一句：梯度沿回路回到训练器，而 drift 的方向由同步权重带下去的有偏副本决定，所以每一轮都会重新进入更新；右侧那行只在 $p=q$ 时成立。</figcaption></figure>

图 2 的在线与离线结果恰好相反。在 Qwen3-1.7B／Countdown 的人为权重失配设置中，离线训练只有 $+1/0$ 奖励稳定；在线训练却以 $+1/0$ 最不稳定，group-centered 奖励最稳定。作者据此提出两个独立机制：离线负奖励可能把已经很低的 logprob 继续压低，在线正奖励则不断追随移动的有偏教师。SC 主要处理后者。[图 2 与第 3 节](https://arxiv.org/html/2609.20807v1#S3)

## 分组奖励和 score，中心化的不是同一个量

GRPO 式的 group centering 对同一 prompt 的多条 completion 做

$$
A_i=R_i-\bar R_{\mathrm{group}},\qquad \sum_iA_i=0.
$$

这个零和约束位于 **prompt 的回答组**。而 drift 出现在 **每个生成前缀**，其系数是 $\mathbb E_q[A\mid h]$。回答生成到中途，各条轨迹已经走向不同前缀：一个已经形成正确解题路线的前缀，后续奖励更可能高于组均值；一个已经犯错的前缀，则更可能低于组均值。全组的正负 advantage 抵消，不会让每个前缀的条件均值也变成零。

从实际更新也能看出区别：即使 $\sum_iA_i=0$，一般仍有 $\sum_iA_i\bar s(h_i)\ne0$，因为不同前缀的 $\bar s(h_i)$ 是不同向量。正 advantage 前缀被拉向自己的采样器分布，负 advantage 前缀被推离自己的采样器分布，两个动作不必抵消。分组中心化可以减弱 drift，这与图 2 的在线结果相符，却无法逐前缀清除它。[第 4 节：Group centering does not remove drift](https://arxiv.org/html/2609.20807v1#S4)

SC 改动的是 score 本身：

$$
\tilde s_v=s_v-\bar s,\qquad
\mathbb E_q[\tilde s]=0,
$$

因此

$$
\mathbb E_q[R\tilde s]
=\mathbb E_q[Rs]-\mathbb E_q[R]\bar s
=\operatorname{Cov}_q(R,s).
$$

在前面的两 token 例子里，中心化后的 score 为 $0.1$ 和 $-0.9$，它们在 $q$ 下的平均值是 $0.9\times0.1+0.1\times(-0.9)=0$。每条样本仍可能有非零梯度，但恒定奖励不再产生系统性的期望更新。若 $p=q$，修正项本来就为零，SC 对原更新没有影响。

这与经典 baseline 的作用不同。On-policy 时减去仅依赖前缀的 $b(h)$，因为 $b(h)\mathbb E_p[s]=0$，只改变方差、不改变期望。Off-policy 时则有

$$
\mathbb E_q[(R-b)s]
=\operatorname{Cov}_q(R,s)+(\mathbb E_q[R]-b)\bar s.
$$

精确的 $b(h)=\mathbb E_q[R\mid h]$ 也能消 drift，但要得到逐前缀的 value；估计不准便留下残差。SC 直接从下一个 token 的分布算 $\bar s$，不需要训练 critic，其目标是改变有偏更新的均值。[第 4 节：式（4）—（5）与 baseline 对照](https://arxiv.org/html/2609.20807v1#S4)

**消掉这一项仍不等于恢复完整 on-policy 更新。** 剩下的是 $\operatorname{Cov}_q(R,s)$，不是 $\operatorname{Cov}_p(R,s)$。哪个 token 被多采、哪些前缀被访问、后续 rollout 如何展开，仍由 $q$ 决定。SC 恢复了“没有奖励差异就没有期望更新”这一性质，却没有把数据重新变成训练器自己采出的数据。

## 裁剪如何把 drift 带回来，SC 又该减去哪一项

在固定前缀上，令重要性比值 $r_v=p_v/q_v$，并假设 $q$ 覆盖 $p$ 的支持集。精确重要性采样满足

$$
\mathbb E_q[r s]=\sum_vq_v\frac{p_v}{q_v}s_v
=\sum_vp_vs_v=0.
$$

它也消除了恒定奖励下的 drift。若要把整条轨迹的期望精确换测度，论文第 2.2 节使用的是轨迹概率比；实践中的 token 级比值首先修正当前位置的条件分布，不能因此自动把整条轨迹都换成 $p$。[第 2.2 节](https://arxiv.org/html/2609.20807v1#S2.SS2)

问题在于乘性权重的尾部：$q_v$ 很小而 $p_v$ 不小时，偶然采中的 token 会获得很大的权重。TIS 将比值截到上界，MIS 将区间外的 token 权重置零，以换取可控的更新。记处理后的权重为 $w_v=f(r_v)$，则 $q_vw_v$ 通常不再等于 $p_v$，零均值恒等式也随之失效：

$$
\mathbb E_q[Rws]
=\mathbb E_q[R]\,\mathbb E_q[ws]
+\operatorname{Cov}_q(R,ws).
$$

两 token 例子的精确比值是 $5/9$ 和 $5$。不裁剪时，两个加权 score 的平均贡献为 $0.25$ 和 $-0.25$，正好抵消；若按论文 TIS 的上界 $2$ 截断，第二项只剩 $-0.1$，恒定奖励下仍有 $0.15$ 的期望更新。降低极端样本的影响，同时破坏了精确抵消。

所以 SC 与 TIS/MIS 组合时，正确形式是

$$
R\left(w_y s_y-\sum_vq_vw_vs_v\right).
$$

先加权，再中心化 **加权后的 score**。只减原来的 $\bar s$，或直接写成 $Rw_y(s_y-\bar s)$，一般都不能令其在 $q$ 下零均值。这里减去的向量在给定前缀后是确定的，不依赖本次恰好抽中了哪个 token；它仍乘以该样本的奖励或 advantage。[附录 A.2](https://arxiv.org/html/2609.20807v1#A1.SS2)

组合的分工于是很明确：重要性权重部分纠正采样分布，SC 清掉裁剪或掩码后剩下的均值漂移。完整精确 IS 已满足零均值，额外 SC 项自动为零；使用裁剪 IS 时，SC 恢复的是加权 score 的零均值，而非未经裁剪的完整梯度。

## 实现难处在期望，不在多加一次减法

精确 $\bar s$ 需要采样器在每个位置的全词表概率。只保存实际采中 token 的 logprob，足以形成这个 token 的重要性比值，却不够计算其他 token 对期望的贡献。论文的实用方案是记录采样器 top-$k$ 的 token ID 和原始 logprob，默认 $k=128$；头部之外的概率用训练器尾部近似。

设头部集合为 $H$，则

$$
\hat q_v=
\begin{cases}
q_v,&v\in H,\\
\rho p_v,&v\notin H,
\end{cases}
\qquad
\rho=\frac{1-\sum_{v\in H}q_v}{1-\sum_{v\in H}p_v}.
$$

它保留采样器的头部概率和尾部总质量，只用训练器补尾部内部的相对比例。不能把 top-$k$ 重新归一化到和为一，否则会抹掉要保留的尾部质量。再利用 $\sum_vp_vs_v=0$，可把尾部求和折回头部：

$$
\mathbb E_{\hat q}[s]
=\sum_{v\in H}(q_v-\rho p_v)s_v.
$$

组合重要性权重时，近似尾部上的比值恒为 $1/\rho$，令 $\alpha=\rho f(1/\rho)$，便得到可直接反向传播的单 token 损失：

$$
L=-A\left(
\operatorname{sg}[w_y]\log p_y
-\sum_{v\in H}\operatorname{sg}[q_vw_v-\alpha p_v]\log p_v
\right).
$$

$\operatorname{sg}$ 表示 stop-gradient。需要截断梯度的是整个系数，包括其中的 $p_v$、$\rho$ 和重要性权重；否则自动微分会产生目标 score 更新之外的导数。取 $f=1$ 就回到单独 SC。[第 4.1 节、附录 A.1—A.3](https://arxiv.org/html/2609.20807v1#A1)

官方仓库的实际 `losses.py` 沿用这条路径：`log_mass` 统一计算有效质量 $q\,w$；全词表分支减去 detached mass 加权的 logprob，top-$k$ 分支减去 detached residual 加权的头部 logprob。`compute_advantages` 先将奖励映射为正负值，再按 prompt 分组减均值；最终损失以生成 token 总数归一化。实际采中 token 即使落在头部之外，仍需保留它自己的采样 logprob，供样本项计算比值。[实际损失实现](https://github.com/martin-marek/score-centering/blob/main/losses.py)、[输入约定与参考代码](https://github.com/martin-marek/score-centering/blob/main/README.md)

全词表 SC 的精确性与 top-$k$ SC 的经验有效性应分开看。使用 $\hat q$ 后，单独 SC 剩下的均值误差可写为 $\mathbb E_q[s]-\mathbb E_{\hat q}[s]$：尾部形状近似错了，仍可能有残差。附录 A.4／图 5 中，$k=32$ 和 $128$ 的表现均与全词表版本相当；最重的 30B INT8 权重／激活＋INT4 KV 设置中，top-128 平均覆盖采样器概率质量的 99.45%，最差 batch 为 95.8%。这些结果支持在所测分布上采用头尾近似；概率质量覆盖率本身并不是梯度误差上界，尾部 score 的大小也会影响残差。[附录 A.4](https://arxiv.org/html/2609.20807v1#A1.SS4)

## 实验支持的是漂移修正，还是一整套训练配方

论文把各种方法放在共同目标上比较：REINFORCE 加 group-centered 奖励，原始 $R\in\{-1,+1\}$，SGD 学习率 $10^{-2}$，每 batch 只更新一步，每 prompt 采 8 条 completion。差别主要落在修正规则。它没有复现每篇基线论文的完整配方，例如 DAPO 的动态采样和过长惩罚未纳入，MIS 对应的 IcePop 配方中另一个策略版本间 PPO surrogate 也未纳入。因此图中的方法名应读作该共同目标上的修正规则。[第 5.1 节、附录 B.1—B.2 与表 1](https://arxiv.org/html/2609.20807v1#A2)

| 模型与任务 | 每 batch | 最长生成长度 |
| --- | --- | --- |
| Qwen3-0.6B-Instruct／Countdown | 64 prompt，512 序列 | 512 token |
| Qwen3-30B-A3B-Base／INTELLECT-2 math 子集 | 16 prompt，128 序列 | 1024 token |

指标口径也随图变化：图 2、3 使用留出评估 prompt 的准确率；图 1、4、5 使用采样 rollout 的训练准确率，并沿训练步做居中移动平均。图中阴影是正负一个标准误。下面的 30B 百分比因此描述训练过程中的答对比例，不是独立数学测试集成绩。[附录 B.3](https://arxiv.org/html/2609.20807v1#A2.SS3)

### 固定偏差越大，崩溃越早

图 3 在训练开始时采样一次高斯权重偏移 $\Delta\theta$，此后保持这个偏移固定，使 $\theta_{\mathrm{sampler}}=\theta_{\mathrm{trainer}}+\Delta\theta$。固定的是偏移，不是采样器权重；采样器仍随训练器移动。这直接构造了持续有偏的教师。

| 权重噪声标准差 | DPPO 崩溃步数（约） | TIS 表现 |
| --- | --- | --- |
| 0.01 | 160 | 所测训练内稳定 |
| 0.02 | 80 | 约第 180 步崩溃 |
| 0.05 | 20 | 约第 40 步崩溃 |

最重噪声下，只有 SC 及其与 MIS/TIS 的组合保持稳定。这里的步数是第 5.2 节对图 3 的近似描述，不是统一阈值检测出的精确故障时间。噪声越强、失稳越早，与误差在反馈中累积的解释相符；单独 SC 不需要重要性比值就能改变这一结果，则把证据进一步指向了 drift。[第 5.2 节与图 3](https://arxiv.org/html/2609.20807v1#S5.SS2)

### 量化与陈旧把两种剩余问题分开了

图 4 的量化设置只降低采样器的权重、激活和 KV cache 精度，训练器仍为 bf16。SC 单独使用和与 TIS/MIS 复合都表现最好。陈旧设置则让推理引擎 **每 64 步才同步一次**，不是只给一个最大陈旧 64 步的准入限制。此时复合方法优于单独 SC，正对应前面的公式边界：score 均值可以清零，旧策略的协方差仍可能偏离当前训练器，重要性权重能补上一部分。

同一组实验里，PPO、DAPO 的修正规则能撑过陈旧，却在量化和权重噪声下崩溃。论文将差异解释为：它们的 clip 原本服务于策略移动所产生的比值，数值误差产生的比值未必有同样含义。[第 5.3 节与图 4](https://arxiv.org/html/2609.20807v1#S5.SS3)

严重陈旧下的组合收益，也使工程上的同步频率仍有意义。异步为何引入这种代价，可对照站内[同步屏障与长尾任务的讨论](/research/2026-10-31-rl-framework-architecture#同步屏障值多少钱-取决于长尾从哪来)；SC 没有使旧轨迹与新策略之间的距离消失。

### 30B 的优势随失配加重才拉开

图 1 在 Qwen3-30B-A3B-Base／INTELLECT-2 math 上改变采样器精度，训练器保持 bf16。权重／激活（W/A）与 KV cache 分开标识，才能看清是哪次改动使方法分离。

| 采样器精度 | SC 与 TIS | 普通 PG／其余方法 |
| --- | --- | --- |
| FP8 W/A＋FP8 KV | 与强基线接近 | PG 稳定，训练准确率 58% |
| FP8 W/A＋FP4 KV | SC 52%，TIS 51% | PG 200 步内崩溃；MIS 后期崩溃 |
| INT8 W/A＋INT4 KV | SC 30%，TIS 12% | 其余方法最终均低于 5% |

第一行是理解后两行的必要对照：轻度量化时，普通 PG 在图示的 800 步内也能训练。到最重设置，SC 的优势大幅扩大；但 SC 自己的训练准确率也降到了 30%，稳定并不意味着量化造成的性能损失全部消失。这一 MoE 实验没有重放采样时的 router indices，专家路由失配也包含在测试条件里；作者明确建议实际使用时重放路由。[第 5.4 节与图 1](https://arxiv.org/html/2609.20807v1#S5.SS4)

这些百分比的确定性并不一致。附录 B.3 说明，30B 先对每种方法各跑一个 seed，再给表现最好的方法增加 seed。FP8 KV 一栏全部为单 seed；FP4 KV 和 INT4 KV 下，SC 分别为 5、4 个 seed，TIS 为 4、3 个，MIS 为 3、3 个。30B 的 top-$k$ 消融还复用图 1 的 $k=128$ 结果，$k=32$ 和全词表版本则为单 seed。因此 SC 的 52% 与 TIS 的 51% 不宜读成已确定的微小优势，重度量化下的分离才是更清楚的证据。[附录 B.3、图 5](https://arxiv.org/html/2609.20807v1#A2.SS3)

## 短程压力测试留下的外推距离

论文主动放大 TIM，是因为在自然失配设置中，有限的短程 GPU 预算不足以区分最强的几种方法。第 5.1 节将重度 TIM 的短训练作为轻度 TIM 长训练的代理；第 6 节又把这一点明确列为限制。量化程度与训练时长可以共同影响偏差积累，但论文没有给出把两者相互换算的定量关系，短序列上的优势仍需长训练检验。

它引用的前作也保留了分歧：Qiu 等的 FP8-RL 报告 fp8 rollout 加 token 级重要性采样即可稳定，Microsoft AI Team 的报告则在尽量压低 TIM、使用 bf16 采样后仍观察到发散。SC 论文用“轻微 drift 需要更久才累积出来”解释两种观察；这是它提出的解释，并非对两套系统做受控对照后验证的结论。[第 5.1 节及其所引前作、第 6 节限制](https://arxiv.org/html/2609.20807v1#S5.SS1)

预算确实限制了对照的厚度。附录 B.3 表 2 汇总约 6,180 H100 GPU 小时、296 次运行，主要使用 8×H100 SXM 节点；其中 30B 图 1 占约 3,750 GPU 小时、47 次运行。这是设备小时，不是节点墙钟小时。较小模型的主要比较采用多 seed，30B 则把新增预算集中在较强方法上，因而结论应着重于机制和明显分离，而不是给所有修正规则排出精细名次。[附录 B.3 表 2](https://arxiv.org/html/2609.20807v1#A2.SS3)

## 框架采用带来独立支持，也暴露真实开销

官方 README 列出 verl、TRL、slime、Miles 等框架的接入入口，其中 TRL 标为 `AsyncGRPOTrainer` 默认目标，部分其他入口指向 PR 或后续默认项的说明。对实现而言，额外要求很具体：采样时输出并传递 top-$k$ logprob，再在训练时形成中心化项。[官方 README](https://github.com/martin-marek/score-centering/blob/main/README.md)

TRL v1.17.0 的发布说明给出另一组自测。在 FP8 采样器、bf16 训练器下，旧裁剪目标的 reward 从 0.60 降至第 300 步的 0.34（仅 FP8 权重），或 0.10（FP8 权重与 KV cache）；bf16 采样器对照为 0.71。改用 SC 与区间 $[0.5,5.0]$ 的 MIS 后，FP8 采样器达到 0.72。这支持了该修正在另一个异步框架中的实用性，但目标同时换成了 SC＋MIS，不能单凭这个对照分离两项各自的贡献。[TRL v1.17.0：Score centering is the default AsyncGRPO objective](https://github.com/huggingface/trl/releases/tag/v1.17.0)

这组 reward 不与前面的训练准确率合并：它来自另一套框架自测，设置与论文不同。开销也有实质区别。论文附录 A.1 在自定义 JAX 采样栈中测得，$k=128$ 的 0.6B 和 30B 运行墙钟时间均与基线相差 1% 以内，并明确没有测量 vLLM/SGLang 原生 top-$k$ 输出的开销；TRL 则报告生成吞吐下降 15–20%。前者测整次训练墙钟，后者测生成吞吐，既不能直接相减，也不能用论文的“低开销”替代框架中的实际测量。[论文附录 A.1](https://arxiv.org/html/2609.20807v1#A1.SS1)、[TRL 发布说明](https://github.com/huggingface/trl/releases/tag/v1.17.0)

## 相邻的 BPO 从目标函数推导修正

比 SC 早三天提交的 Bellman Policy Optimization（BPO，2026 年 9 月 14 日）从 Policy Mirror Descent 出发，用 Bellman 等式把终局奖励问题改写成轨迹级目标；其摘要把实际 mismatch-correction weight 描述为互补 token 概率的平滑比值。这个入口与 SC 直接分解 score 均值不同：一条从目标函数近似得到修正，一条从更新中的 drift 得到修正。[BPO 摘要与版本记录](https://arxiv.org/abs/2609.15987)

## 来源与阅读范围

- **主论文**：[Score Centering Stabilizes Off-policy Reinforcement Learning，arXiv:2609.20807v1](https://arxiv.org/abs/2609.20807)，Martin Marek、Max Ryabinin，2026-09-17。[HTML 全文](https://arxiv.org/html/2609.20807v1)与 [PDF](https://arxiv.org/pdf/2609.20807)：第 3 节／图 2 支撑在线与离线机制的区分；第 4 节支撑 drift、蒸馏方向、group centering 与 baseline 的差别；第 5.1—5.4 节及图 1、3、4 支撑共同目标、噪声、量化和陈旧实验；第 6 节支撑外推边界；附录 A.1—A.4／图 5 支撑头尾近似、加权中心化、损失与消融；附录 B.1—B.3／表 1、2 支撑超参、指标口径、seed 和算力。正文涉及 Qiu 等与 Microsoft AI Team 的分歧，依据的是此论文第 5.1 节对其参考文献的讨论。
- **官方实现**：[README](https://github.com/martin-marek/score-centering/blob/main/README.md)与 [losses.py](https://github.com/martin-marek/score-centering/blob/main/losses.py)：支撑框架接入状态、采样 logprob 输入要求，以及实际 JAX 损失中的有效质量、stop-gradient、分组 advantage 和归一化方式。
- **独立框架自测与采用记录**：[Hugging Face TRL v1.17.0 发布说明](https://github.com/huggingface/trl/releases/tag/v1.17.0)中“Score centering is the default AsyncGRPO objective”：支撑 FP8／bf16 对照 reward、默认 SC＋MIS 目标及生成吞吐代价；这是另一设置的自测，不是本文复现实验。
- **相邻工作**：[Bellman Policy Optimization，arXiv:2609.15987v1](https://arxiv.org/abs/2609.15987)，2026-09-14：摘要及版本记录支撑 PMD—Bellman 推导入口与互补概率比的描述，不用于认定其与 SC 的梯度等价。
