---
title: 奖励变换的作用边界：相对偏好、饱和与训练稳定

description: 核对PAR怎样改变优化信号，以及方差界、actor-critic稳定和真实目标改善之间的区别。
tags: [强化学习, Reward Hacking, 奖励建模, RLHF]
search: false
published: false
---

# 奖励变换的作用边界：相对偏好、饱和与训练稳定

## 1. 保留RM，改变被优化的量

奖励去偏重新训练预测器，悲观方法构造奖励不确定集，另一类方法则直接变换已有RM的输出。Fu等的 *Reward Shaping to Mitigate Reward Hacking in RLHF* 首发2025-02-26，本章读截止前的2026-09-18 v8，不能把2026年补充实验统称为2025首版已经包含的结果。其Preference as Reward（PAR）以参考策略生成的回答为锚，对当前回答使用

$$
r_{RL}(x,y)=\frac1M\sum_{m=1}^M\sigma\bigl(r_\phi(x,y)-r_\phi(x,y_{ref}^{m})\bigr).
$$

若RM满足BT建模假设，每项是RM认为当前回答优于参考的概率。概率属于该RM的偏好，不保证是人类真实胜率；取参考差能去掉prompt共同的奖励平移，但仍依赖奖励尺度、参考分布及错误排序。[§3.2、版本记录](https://arxiv.org/abs/2502.18770v8)

设计原则是先在初始参考附近保留较陡的奖励变化，再向高分端饱和，使策略不因极端proxy分值继续获得线性增长的信号。Sigmoid变换对固定参考保留单个回答的排序，却改变随机策略的期望目标及其与KL惩罚的相对尺度；它不是具有策略不变保证的potential-based shaping。在未直接对RM反向传播的policy gradient中，“梯度变小”也应理解为回答间奖励差受压缩，并非把sigmoid导数作为策略梯度的链式因子。[§3.1–3.2、Appendix H，PDF pp.4–5、26–29](https://arxiv.org/abs/2502.18770v8)

## 2. 两条方差结果各自保证什么

第一条定理假设所有每步奖励$|r_l|<1$且$0\le\gamma<1$，由几何级数和Popoviciu不等式得到$\operatorname{Var}(G_t)\le(1-\gamma)^{-2}$。这是有界支持产生的方差上界，没有证明每个具体训练分布的方差都小于某一未变换基线。更关键的是实际每token奖励还含$-\eta\log(\pi_\theta/\pi_{ref})$，仅把终端RM值限制到[0,1]并不自动限制该log比；任意小的正$\eta$也不在没有概率下界时给出统一有界性。实验使用$\gamma=1$，因此不能直接套这个无限折扣上界；有限长度下可另作与长度有关的界。[Theorem3.1、Appendix B.1、F.1，PDF pp.5、18、23–24](https://arxiv.org/abs/2502.18770v8)

第二条把所有竞争估计量的条件均值预先固定为同一$\sigma(z)$，其中$z$是当前与参考的奖励差。全方差公式说明，直接用确定的$\sigma(z)$比再加随机性的无偏估计量有更小的REINFORCE方差。它可解释为何直接用BT概率优于采样一个Bernoulli偏好标签，但没有在sigmoid、tanh、identity这些**不同条件均值**的变换之间证明sigmoid全局最优，也不是PPO含critic估计、剪切与归一化后的方差定理。正文称其为sigmoid最小方差时必须保留这个比较类。[Theorem3.2、Appendix F.2，PDF pp.5、24–25](https://arxiv.org/abs/2502.18770v8)

## 3. 饱和延迟了崩溃，未修复奖励语义

第一组在UltraFeedback-Binarized过滤后约33000条数据训练Gemma2-2B：提示/chosen/rejected分别小于512token，chosen分更高，剔除含“confidence”的回答，并跨训练测试去重；测试只有256提示。SFT2epoch、RM1epoch，学习率均$5\times10^{-6}$；PPO1epoch策略$3\times10^{-7}$、critic $5\times10^{-6}$、KL0.005，默认每提示10个参考。DeepSeek-V3评估与SFT相比的质量，每对换位两次，平局计半胜。[§4.1、Appendix B.1、C，PDF pp.6、17–20](https://arxiv.org/abs/2502.18770v8)

对照包括WARM、ODIN、RM输出L2正则、running mean/std标准化、动态剪切、minmax及log-sigmoid-centered变换。终点AlpacaEval-2的PAR长度控制/原始胜率70.81%/75.37%，Minmax66.98%/70.93%，WARM60.67%/63.17%；MT-Bench总分分别5.063、4.881、4.731。这里基准比较对象是本实验SFT，评价器是DeepSeek-V3，不能与其他论文对GPT-4基准或官方judge的同名胜率直接排序。ODIN等在这套长优化配方下明显崩溃，只能说明这些实现与超参数未阻止该设置的失败，不能覆盖它们原论文的全部调参和最佳checkpoint结论。[Table1、Figure5，PDF pp.8–9](https://arxiv.org/abs/2502.18770v8)

参考数消融中1个参考接近10个，未中心化sigmoid较差，说明锚点比单纯有界化更有作用。延长到2epoch时，Minmax和WARM再度下降，PAR保持较高胜率；作者最终明确承认主要收益是扩大可早停的时间窗口，**不显著提高最佳checkpoint峰值**，足够久的训练仍不能消除hacking。偏好概率超过约0.8后与外部胜率的对应变差是该实验的观测，不是可跨RM使用的通用校准阈值。[Appendix D.1–D.2、Limitations，PDF pp.11、21、31–32](https://arxiv.org/abs/2502.18770v8)

第二组用HH helpful-base过滤后约43000条，四个基模型，分别测PPO、A2C和GRPO，DPO作为无显式奖励的参考；各模型/算法使用不同学习率和0.1–0.5epoch时长，评价改为GPT-5-nano，并未对所有模型重跑上一组全部防御或外部基准。Gemma2-9B和Llama3.1-8B的vanilla PPO先出现proxy升而胜率跌，后来proxy和胜率一起崩溃；应把过度优化阶段与整体训练崩溃分开。PAR对这些actor-critic设置改善明显，支持critic稳定可能参与其机制，但没有单独随机化critic误差完成因果归因。[§5、Appendix B.2、D.3–D.4，PDF pp.9–10、18–22、32–35](https://arxiv.org/abs/2502.18770v8)

反例同样清楚：Llama3.1-8B的GRPO下PAR仍呈proxy增、胜率降，只是末端约0.62优于vanilla约0.52，DPO约0.74；Qwen3-4B的GRPO无持续崩溃，vanilla约0.84略高于PAR约0.81。Qwen上收益较小，作者把原因猜为基模型训练差异，本文不将该猜测当作验证过的训练史或机制。没有critic的算法可能已消除一部分尺度敏感性，但不能据此说GRPO对reward hacking免疫。[Appendix D.4、Figures19、21，PDF pp.22、34–35](https://arxiv.org/abs/2502.18770v8)

人工核查仅针对Gemma2-2B、HH、PAR-PPO：从所有checkpoint比较中抽200例，两位作者独立标注，平局计半胜，得到70.0%/71.5%，GPT-5-nano为68.5%；人与人一致78%、Cohen’s $\kappa=0.527$，人与judge约75%、$\kappa=0.451$。这是小样本一致性核查，并非所有模型和方法经过独立盲评，也不是最终checkpoint独立胜率的直接估计。论文未给各方法重复训练种子的结果区间。[§6、Table2，PDF pp.10–11](https://arxiv.org/abs/2502.18770v8)

这些实验支持把PAR视为训练信号的稳定化手段：避免极端分数支配critic与策略，可让有限训练期的外部表现更好。它没有改变RM遗漏了什么；若虚假、迎合或篡改回答本来就稳定优于参考，饱和只压缩收益，仍可能选择错误方向。要评价更一般的效果，需同时报告峰值、终点、训练窗口、基础模型与算法，并对剩余语义漏洞作独立核查。

## 阅读范围

PAR v8已读PDF全部37页，含全部算法伪代码、方差证明、四模型三在线算法加DPO的附图、校准与案例；实际查看PDF8、9、24、31、34、35图表。版本页已核v8在2026-09-18提交，符合截止日期。没有运行作者代码或训练。contrastive、log-sigmoid变换及其他未读直接防御不承担本章论据，相关缺口见主文。
