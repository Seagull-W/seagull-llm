---
title: 奖励表示的信息瓶颈：压缩、泛化与漏洞监测
description: 核对InfoRM的变分目标、合成与真实偏好实验及表示分布检测的适用范围。
tags: [强化学习, Reward Hacking, 奖励建模, 信息瓶颈]
search: false
published: false
---

# 奖励表示的信息瓶颈：压缩、泛化与漏洞监测

## 1. 压缩什么，保留什么

已知捷径的去偏需要指定长度或格式等变量；信息瓶颈路线尝试只保留预测偏好必需的信息。Miao等的 *InfoRM: Mitigating Reward Hacking in RLHF via Information-Theoretic Reward Modeling*（首发2024-02-14；NeurIPS2024，本章读2024-11-01的v5）在语言模型表示后加入随机高斯瓶颈，再用MLP给奖励。它同时研究一个检测问题：若策略生成进入奖励表示中的新簇，能否预警过度优化？两项贡献应分别评价，减少训练漏洞不自动证明检测器可靠。[§1–3、版本记录](https://arxiv.org/abs/2402.09345v5)

令输入、瓶颈表示和偏好排序分别为$X,S,Y$，提出最大化$I(S;Y)-\beta I(X;S\mid Y)$。在编码器仅由输入生成表示的Markov结构下，附录用$I(X;S)$放宽条件互信息，再以变分分类对数似然和编码分布至标准高斯的KL得到可训练下界。实际目标为带独立采样噪声的成对BT对数似然，减去chosen与rejected各自的高斯KL；均值、对角标准差由语言模型末端head输出。KL是**表示分布**正则，与PPO对参考策略的KL是两种不同约束。[Eq.3–5、Appendix A，PDF pp.4–5、15–16](https://arxiv.org/abs/2402.09345v5)

这一推导给压缩归纳偏置，不保证丢掉的一定是无关因素。偏好标签若本身奖励迎合、格式或错误拒绝，压缩器仍可能优先保留这个容易预测标签的捷径。附录B引用一个sub-Gaussian损失下的期望泛化界，用输入与表示互信息、潜在空间基数及信息损失层数描述复杂度；它不是经过策略优化后真实奖励的regret界。其有限基数项也不能直接把连续高斯的“128维”代成$|S|=128$。因此可把理论用作压缩与同分布泛化的动机，不据此宣布没有优化漏洞。[Appendix B，PDF p.16](https://arxiv.org/abs/2402.09345v5)

## 2. 实验中的真值与控制

合成RLHF以Pythia1.4B作统一策略，以70M、410M、1.4B模型作代理RM，Vicuna7B作gold RM。AlpacaFarm中1万示范用于SFT、2万偏好用于gold训练；SFT在该2万提示生成回答，再由gold排序训练代理；剩余2万无标签提示用于PPO。另把25%偏好翻转测试噪声，比较普通RM、策略KL及集成UWO。InfoRM在所展示的训练范围中，gold与proxy分数更持续同向，普通RM则出现proxy上升、gold下降；Flan提示上的测试进一步检查生成分布变化。这里gold是较大模型的打分，不是真实人类目标，也不能由1.4B对7B推断任意模型规模关系。[§4.1、Figures4–6，PDF pp.5–7](https://arxiv.org/abs/2402.09345v5)

RM训练学习率$5\times10^{-6}$、batch64、1epoch；常用瓶颈128维、$\beta=0.1$，并扫描表示维数与正则强度。PPO策略学习率$5\times10^{-7}$、critic $10^{-6}$、1epoch，最大512token，temperature0.8、top-p0.9；模拟batch16、真实数据实验batch64。KL系数经过人工搜索，不能把InfoRM与单个未调KL基线的差距当成机制唯一贡献。附录H另报告多学习率和KL比较，但未提供多种子置信区间。[Appendix E、H、J.3，PDF pp.23–27](https://arxiv.org/abs/2402.09345v5)

真实偏好实验在Vicuna7B上用HH helpful/harmless学奖并PPO，另测AlpacaFarm域外提示及TL;DR摘要；评价为GPT-4比较，每对交换位置评价两次。相对带KL普通RM，InfoRM在HH-helpful胜/平/负为49.0/31.5/19.5，AlpacaFarm为38.5/35.2/26.3，摘要为68.6/21.5/9.8，不能把“49%”误读为忽略平局的胜率。相对WARM的AlpacaFarm为30.3/40.5/29.2，优势较小，不能只报胜方比例掩盖几乎相等的负方比例。瓶颈与集成、WARM组合也有改善，提示两类归纳偏置可以互补。[Table1、§4.2，PDF pp.7–8](https://arxiv.org/abs/2402.09345v5)

离线RM准确率在HH变化较小，helpful73.62%→73.72%、harmless72.26%→72.65%；域外TruthfulQA多选40.63%→46.87%，AlpacaEval65.38%→66.63%。这与更好的泛化一致，但不把准确率变化与PPO后收益作已识别因果分解。附录长度曲线通常更短，案例减少重复和不相关拒绝，仍不能由短回答证明“只留下真实偏好信息”，也不能由案例的详尽程度认证事实正确。[Appendix D、I、K，PDF pp.21–22、26、29–36](https://arxiv.org/abs/2402.09345v5)

## 3. CSI监测的是表示分布变化

作者用GPT-4-1106-preview标记严重重复、对正常请求过度拒绝和偏题样本，再把它们放进InfoRM潜在空间观察。16个生成数据集的t-SNE图显示，这些标记样本常形成远离SFT输出的簇；普通RM表示没有同样稳定的关系。此处“hacking”标签是文本症状的自动判断，并未逐样本测到“代理奖励增加且真实目标降低”，也未区分有意利用、一般生成退化与正常的新颖回答。[§5、Appendix C、F、J.4，PDF pp.8–10、16–21、24–25、28](https://arxiv.org/abs/2402.09345v5)

CSI先用DBSCAN聚类RLHF输出表示，计算每簇质心$c_i$到最近SFT输出表示的距离$d_i$，再取$\sum_i |C_i|d_i$。它是群体偏移指标，不是单回答的作弊概率；未按总样本量归一化，绝对数值会随样本数、表示尺度及聚类配方改变。附录伪代码还遍历DBSCAN全部标签，因此噪声标签−1也会被合成一组，复现时需要明确这一处理。SFT附近也可能有坏行为，远离SFT也可能是能力改善，论文没有证明两者可由CSI统一分开。[Eq.6–8、Appendix J.2，PDF pp.9、28](https://arxiv.org/abs/2402.09345v5)

实测普通RM在约600–700步出现CSI突增，InfoRM较低；跨数据集图与超参数图支持这一相关性。瓶颈128维、$\beta=0.1$在HH-harmless的忽略平局胜率75.8%，与较低CSI对应，说明它可作该设置下调参线索，但这与主表保留平局的三分比率不同。论文没有提供统一阈值下的AUROC、漏报/误报率或对新颖正确回答的系统负例评估，故不能直接把图中的清晰分簇当成已校准安全检测器。[Figures8、12–18，PDF pp.9、20–24](https://arxiv.org/abs/2402.09345v5)

附录G给出早停配方：当前CSI绝对变化除以此前平均变化，超过经验阈值10时停止。它提出一个可实施方向，但首步没有历史均值、历史变化为零时需要额外约定；全文未给出独立早停策略与gold峰值、最终外部质量的完整量化对照。作者也承认监测有延迟、需要对测试提示推理，并且GPT-4胜率受提示结构影响。因而当前证据更适合支持“信息瓶颈表示提供一个待校准的监测信号”，尚不足以支持无金标准时自动可靠发现所有奖励漏洞。[Appendix G、Limitations，PDF pp.10、25](https://arxiv.org/abs/2402.09345v5)

## 4. 保留生成能力的另一条路线：GRM

InfoRM压缩表示，Yang等的 *Regularizing Hidden States Enables Learning Generalizable Reward Model for LLMs*（首发2024-06-14；NeurIPS2024，本章读2024-10-23的v2）则保留原有LM head，在同一骨干表示上同时做奖励排序与文本生成。其Generalizable Reward Model（GRM）的损失为$(1-\alpha)L_{reward}+\alpha L_{reg}$，生成正则可用DPO、有无reference的偏好目标，或chosen文本的SFT型损失。它不需要显式知道哪个特征是长度、哪个是质量，作用是减小奖励分类微调破坏原有表示的程度。[§3](https://arxiv.org/abs/2406.10216v2)

理论动机与[第18章RPO](./18-pessimistic-preference.md)有共同来源：拟合偏好时，对能够利用当前奖励的策略加入对抗项。KL约束下最优策略具有$\pi_r^*\propto\pi_{ref}\exp(r/\beta)$形式；再引入满足$\mathbb E_{D,\pi_{cal}}r=0$的固定校准策略，可把对抗目标改写为该校准策略对$\pi_r^*$的交叉熵。若校准策略来自chosen数据，就得到SFT动机。校准/定标对于奖励可加任意prompt常数而偏好不变的问题至关重要。实际GRM随后**放松**奖励头与指数倾斜最优策略的精确关系，只共享隐藏表示，并独立选正则系数；因此这是由对抗目标启发的实现，不是证明所有共享LM头的网络仍精确求解了同一minimax问题。[Appendix A，PDF pp.16–17](https://arxiv.org/abs/2406.10216v2)

默认SFT型正则也不是直接的负log似然，而是$-\log\sigma(\beta\log\pi_{LM}(y_c\mid x))$。附录以普通负log似然替代后，适当减小权重仍能达到相近乃至更好的部分OOD结果，说明正则尺度需要与形式共同调节。默认非线性reward head为hidden→1024→1、ReLU，$\alpha=0.01$；线性头采用较小0.001。两种头并非绝对优劣：线性头在部分RewardBench reasoning更好，更多层又在不同OOD任务间有得失。冻结骨干基线在8K数据的HHH强于普通微调，但在40K/400K通常较差，支持保留表示与学习新偏好之间的权衡。[Eq.10、Appendix B、C.1–C.5，PDF pp.4、17–20](https://arxiv.org/abs/2406.10216v2)

实验用Unified-Feedback的40K或400K子集学奖，8K held-out测同分布，HHH-Alignment、MT-Bench人类判断和RewardBench测不同提示/回答来源。Gemma2B的400K SFT正则使ID准确率72.1%→73.2%，HHH73.4%→79.8%，MT71.2%→73.4%；40K的HHH70.3%→78.7%。但它不是所有指标最优：400K集成MT73.7%略高于GRM73.4%。Llama3-8B全参数训练在700K偏好数据上RewardBench平均87.0%，同基座数据的公开RM84.7%；对某一版本GPT-4基准平均更高，不意味着一般判决能力或人类效用超过GPT-4。[Tables1–5，PDF pp.6–8](https://arxiv.org/abs/2406.10216v2)

主实验RM采用rank32、alpha64 LoRA，1024token截断、batch16、学习率$10^{-5}$、2epoch；8B全参为4096token、batch512、$2\times10^{-6}$、1epoch。LoRA的2B/7B在40K上分别约30.4/93.6 A6000 GPU小时，是特定训练成本，不是无额外开销：虽然不必训练多个RM，LM头产生生成损失仍需要计算，带reference的DPO形式也需额外模型。[Appendix B，PDF pp.17–18](https://arxiv.org/abs/2406.10216v2)

优化测试另取20K样本，由全量Unified-Feedback训练的Mistral7B gold RM重标，再训练2B/7B proxy；策略统一为Gemma2B。BoN在1K提示上选$n=1\ldots405$候选，横轴用$\log n-(n-1)/n$表示选择强度。GRM在展示范围内gold随选择提高，基线部分平台或下降；PPO以同一策略、同一20K训练一轮，表6的策略KL系数明确为0。基线较早出现proxy升、gold跌，GRM更能维持gold。因而该PPO结果不能描述成“已胜过调优KL约束”；gold也是另一个RM，而且与训练数据同源，不是未受任何共同偏差影响的真值。[§5.2、Figures2–4、Table6，PDF pp.8–9、18](https://arxiv.org/abs/2406.10216v2)

25%随机翻转标签的BoN/PPO对照支持对这种噪声的稳健性，作者明确承认其不代表现实中有结构的标注偏差。附录另以100个随机测试提示、GPT-4o及随机回答位置评价：2B RM的PPO策略相对普通RM胜/平/负68/5/27，7B RM为73/6/21。它提供gold之外的自动评价，但样本少且没有多种子区间，不能据此宣布长期漏洞消除。案例中的GRM算出剩余土豆需6分钟，却仍给多段分析，违反“只报告数字”的请求；所以案例所称推理正确也应与完整指令遵循分开。[Limitations、Appendix C.8、D，PDF pp.10、21、23–25](https://arxiv.org/abs/2406.10216v2)

与InfoRM合读，表示的“少”与“保留”都只是有条件的归纳偏置：瓶颈可减少记忆，也可能保留错误标签的捷径；生成正则可保存有用结构，也可能保留基模型偏差。两篇都给出有限优化范围内的改善，均未给出针对任意未见奖励利用的保证。实践比较应同时检查外部任务质量、强优化曲线、结构化噪声与成本，而非仅比较离线RM准确率。

## 阅读范围

GRM v2已读PDF全部25页及关键曲线/案例；InfoRM v5已读PDF全部36页，含变分推导、引用的泛化界、16数据集附图、超参数、早停和伪代码及全部案例；实际查看PDF5、8、17、21、24、30的关键图页。没有运行训练或复现实验。已读隐藏状态正则见本章第4节，对抗不确定性见第18章；其他未读路线列于主文缺口。
