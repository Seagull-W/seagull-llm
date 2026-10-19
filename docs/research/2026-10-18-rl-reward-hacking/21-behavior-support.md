---
title: 奖励数据的行为支持：从token概率到价值约束
description: 核对BSPO的支持集合、Bellman算子、理想策略迭代与实际PPO实验之间的联系。
tags: [强化学习, Reward Hacking, RLHF, 分布外泛化]
next: false
---

# 奖励数据的行为支持：从token概率到价值约束

## 1. 直接约束奖励数据之外的生成

Dai等的 *Mitigating Reward Over-Optimization in RLHF via Behavior-Supported Regularization*（ICLR2025；arXiv:2503.18130v1，2025-03-23）试图把“奖励模型训练时见过哪些生成行为”显式放进策略优化。与只限制策略离SFT有多远不同，它保留RM的LM head，联合学习成对奖励与下一个token分布$\beta(a\mid s)$；称后者为奖励偏好数据的behavior policy。ScoreLM同时承担打分与行为分布预测，生成损失也含[GRM式表示正则](./19-information-bottleneck.md)的作用，因此主比较让各基线使用同一ScoreLM，尽量将差别放在策略/价值更新。[§3–4、Appendix C.1](https://arxiv.org/abs/2503.18130v1)

理论支持动作定义为$\beta(a\mid s)>0$。对支持动作应用普通Bellman更新，对其余动作直接令$Q=Q_{min}=r_{min}/(1-\gamma)$。在有界奖励、已知支持及$\gamma<1$下，这一算子是sup范数$\gamma$压缩，固定点对一般策略低估原$Q$；只有策略本身一直选择支持动作时，支持动作上的$Q$才与普通策略评价相同。因此“不改变ID值”应保留策略已受支持这一条件，不能对任意仍有OOD分支的策略宣称所有支持动作价值完全不变。[Theorems1–2、Corollary2、Appendix A，PDF pp.5–6、16–21](https://arxiv.org/abs/2503.18130v1)

再做精确贪心策略改进，可在支持集合内得到标准策略迭代的单调改进直觉，但有几个实现前提。理论需要准确固定点、足够的状态/动作评价覆盖、可实现的贪心更新及非空支持；若支持与不支持动作都等于$Q_{min}$，还需优先支持动作的tie-breaking，弱不等式本身不排除选到不支持动作。原文称“严格单调直到最优”，证明主要写出非下降关系；实际神经critic、有限批次PPO剪切和近似梯度不能直接继承精确策略迭代的全程保证。这些边界影响如何使用定理，未否定该价值正则的实验贡献。[Corollary1、Theorem3及证明，PDF pp.5–7、18–21](https://arxiv.org/abs/2503.18130v1)

## 2. 从零支持到概率阈值

真实softmax通常对所有词给正概率，所以实现用$\beta(a\mid s)>\epsilon_\beta$替代理论的非零支持，默认$10^{-4}$；把不支持分支的V target设为固定−15，而非逐状态精确计算无限折扣$Q_{min}$。利用文本前缀树的确定转移，作者把Q形式改写成按上一步token是否支持的V更新，再用该critic计算GAE/PPO。该确定性来自完整生成前缀，不是一般带工具或隐藏环境状态的agent系统都满足的条件。[§4、Algorithm1、Appendix B、C.2，PDF pp.6–7、21–23、26](https://arxiv.org/abs/2503.18130v1)

概率阈值是有用的经验近似，却不是奖励有效性的语义证书。常见token可组合成未见错误论证，罕见但正确token可能被惩罚；模型给高概率也不保证其偏好正确。实测支持响应的代理/gold偏好一致率约71.56%–75.91%，未支持约58.10%–62.25%，说明该划分在这些rollout中可区分可靠性，而非支持区内没有错误。若prompt本身域外，可能不存在足够可靠的支持响应，作者明确把这种情况以及RM在ID上就学错偏好列为局限。[§3.1、Limitations、Appendix D.1，PDF pp.4、10、28](https://arxiv.org/abs/2503.18130v1)

## 3. 实验改善与残余缺口

主合成实验以Llama3-8B gold在57000条UltraFeedback偏好上训练，再重标30000条训练三种proxy：GPT2-large774M、TinyLlama1.1B、ShearedLlama2.7B；策略初始化Alpaca7B。RM训练2epoch、学习率$2\times10^{-5}$，ScoreLM生成损失系数0.01；RL训练3epoch、最大512token、temperature1.2、actor $10^{-5}$、critic $5\times10^{-6}$，在8张A100上运行。基线包括无KL PPO、KL、CPPO及4成员UWO/WCO，实际测得BSPO减少未支持token并维持更高gold，部分基线proxy继续上升而gold下降。[§5.1–5.3、Appendix C，PDF pp.8–9、24–27](https://arxiv.org/abs/2503.18130v1)

这支持行为支持正则可以限制一种外推失败，但不能把“曲线最高”写成实验证明找到了ID全局最优；gold仍是有限的另一个RM。与KL扫描比较，BSPO可在更远的策略分布处维持gold，说明简单距离与该RM的可靠区域不完全重合。CPPO对照还使用gold曲线确定proxy阈值，并把原tanh乘子改为clip以加快更新，故它是本实验适配版，不是对原方法所有变体的统一否定。图中未支持token减少既是被正则直接干预的量，也可能与输出长度共同变化，尚不是对所有语义漏洞的因果解释。[§5.4、Appendix C.1.4、D.4，PDF pp.9–10、25–26、29–30](https://arxiv.org/abs/2503.18130v1)

附录加15%标签噪声时各方法gold均降低，BSPO仍较好；在AlpacaFarm额外数据设置中也延迟过度优化。阈值扫描$10^{-3}\ldots10^{-7}$显示中间$10^{-4},10^{-5},10^{-6}$较好，两端改善慢，作者归因于误拒正常动作或漏过OOD动作；V下界−10至−25附近曲线较接近。这说明“支持”存在实际选择性，而非可完全免调的零阈值。ScoreLM准确率比较报告4次重复，支持分类rollout诊断为3随机种子；不能将这两组重复自动视为全部主RL结果的多种子置信区间。[Appendix D.6–D.7、Figure2，PDF pp.6、28、31–33](https://arxiv.org/abs/2503.18130v1)

所谓non-synthetic补充实验以Alpaca7B RM直接拟合UltraFeedback偏好，随后用**GPT-4o**模拟人类比较，而非真人研究。BSPO158步对初始模型胜率61.51%，对PPO158步63.10%，对WCO158步56.75%；从这些checkpoint两两胜率拟合Elo并非独立的新测量，不能把1253.68等评分当作真实用户效用。附录虽然多处称“human evaluation”，方法明确是LLM。评审样本量、换位及重复训练等信息不足以给出可靠的显著性解释，本章保留为自动评价证据。[Appendix D.5、Tables3–4，PDF pp.30–32](https://arxiv.org/abs/2503.18130v1)

DPO/RPO补充比较均优于初始策略和严重过度优化的PPO，但对BSPO的胜率仅26.27%/29.70%。它支持该具体数据、奖励和训练配置的相对结果，不能把差异全归为“在线一定比离线优越”：目标、探索、训练量和模型选择都不同，且本论文未系统研究DPO的隐式偏好外推。更可复用的结论是：奖励可靠区域可以通过生成分布建模获得一条额外线索，价值层面的惩罚与策略KL互补；其可靠性仍取决于支持预测、ID奖励质量及任务分布。[Appendix D.8，PDF pp.33–35](https://arxiv.org/abs/2503.18130v1)

## 阅读范围

已读v1全部35页，含所有Bellman与策略迭代证明、Q/V改写、实现阈值、基线适配、GPT-4o评价、噪声/超参数/DPO/AlpacaFarm附录；图中文字乱码处已通过实际PDF图补，查看PDF8、9、28、31–35。未运行作者代码或复现实验。
