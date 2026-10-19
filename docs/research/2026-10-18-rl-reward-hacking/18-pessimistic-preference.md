---
title: 悲观偏好优化：SFT、对抗奖励与覆盖条件
description: 核对SFT正则如何由奖励不确定性目标导出，以及理论保证与神经网络实验的距离。
tags: [强化学习, Reward Hacking, DPO, 奖励建模]
search: false
published: false
---

# 悲观偏好优化：SFT、对抗奖励与覆盖条件

## 1. 在不确定奖励下做保守选择

前章的去偏方法先指定一个待移除特征；悲观方法则允许多个与偏好数据相容的奖励，让策略避免只在某个乐观奖励下高分的回答。关键在于不确定集合怎样定义、是否覆盖真实奖励，以及保守目标能否实际求解。它与“限制所有分布外输出”有联系，但可只要求数据足够覆盖一个有竞争力的目标策略，而非所有可能回答。

Liu等的 *Provably Mitigating Overoptimization in RLHF: Your SFT Loss is Implicitly an Adversarial Regularizer*（首发2024；本章读arXiv:2405.16436v3，2024-12-04，正文封面日期12-05）在离线contextual bandit里提出

\[
\max_\pi\min_{r\in\mathcal R}
\left\{\mathcal L_D(r)+\eta\left[
\mathbb E_{x\sim d_0,a\sim\pi,b\sim\pi_{base}}(r(x,a)-r(x,b))
-\beta\mathbb E_{d_0}D_{KL}(\pi\|\pi_{ref})\right]\right\}.
\]

内层RM既要拟合Bradley–Terry偏好，又要压低当前策略相对baseline的奖励差；数据不约束的乐观高分因而不能无代价地被利用。减去baseline不是任意装饰：成对偏好只识别奖励差，无法识别同prompt下共同加的常数。$\pi_{ref}$限制策略支持和漂移，$\pi_{base}$指定需要模仿的回答分布，两者可以不同。[§2–3，PDF pp.5–7](https://arxiv.org/abs/2405.16436v3)

给定奖励$r$，KL正则最优策略是$\pi_r\propto\pi_{ref}e^{r/\beta}$。在可交换max/min的条件下，代回该闭式解再重参数化奖励，得到

\[
\mathcal L_{RPO}(\theta)=\mathcal L_{DPO}(\theta)
+\eta\beta\,\mathbb E_{x\sim d_0,a\sim\pi_{base}}
[-\log\pi_\theta(a\mid x)].
\]

这就是Regularized Preference Optimization（RPO）：DPO加基线回答的SFT交叉熵。实践取chosen回答为baseline，无需额外RM或新的训练数据。chosen的log probability本就在DPO计算图中，额外项很便宜；若另换需要采样的baseline，则不能照搬“无额外开销”。SFT项可改变梯度方向。论文称调DPO的$\beta$只能缩放方向，应限于固定单例的梯度形式；多例加总时各例权重也随$\beta$改变，不能说总梯度方向永远不变。[§4、Appendix A，PDF pp.8–9、21](https://arxiv.org/abs/2405.16436v3)

## 2. 保证从哪些假设来

有限样本结果的前提包括：偏好对独立同分布、Bradley–Terry模型正确、真实奖励$r^\star\in\mathcal R$，所有候选奖励有共同有限范围$[0,R]$，函数类在所需精度下有有限的sup范数covering number，目标策略支持不超出参考策略。其partial coverage系数衡量目标策略与baseline上的期望奖励差误差，相对数据分布上同一差误差的均方根能放大多少；它依赖奖励类和真实奖励，不只是训练样本数量。[Assumptions5.1–5.2，PDF p.10](https://arxiv.org/abs/2405.16436v3)

在相应选择$\beta\sim N^{-1/2}$、$\eta\sim\sqrt{\log\mathcal N/N}$下，作者给出相对被覆盖竞争策略的真实奖励gap为$\widetilde O((C_{coverage}^2+1)/\sqrt N)$，并有竞争策略到reference的KL及奖励范围相关常数。证明用MLE统一集中把拟合差转为偏好分布距离，再借有界sigmoid斜率转成奖励差误差，覆盖系数负责把训练分布误差移到目标分布。它不保证任意未覆盖最优策略，也不把“真实奖励不在类中”的错设纳入相同结论；奖励范围常数还可能使数值界很松。[Theorem5.3、Appendix B，PDF pp.10、22–26](https://arxiv.org/abs/2405.16436v3)

从理论maximin转到RPO还需额外一步：奖励类是紧的拓扑空间，目标关于奖励类具有convex-like性质，且KL使给定奖励的最优策略在训练prompt支持上唯一。作者借minimax定理与零duality gap建立解的对应。这不等于任意神经RM类已经满足这些条件；把理论诱导的策略类改成参数化LLM、用有限SGD求解时，表达与优化误差也未自动消失。因此“DPO+SFT具有一个悲观解释”比“任何SFT系数都已证明安全”准确。[Assumption5.5、Theorem5.6、Appendix C，PDF pp.11、27–28](https://arxiv.org/abs/2405.16436v3)

对新prompt分布$d_1$，保证还要求$\sup_x d_1(x)/d_0(x)<\infty$，界乘上这个比例。文中把1536维prompt embedding投影到前两PCA轴，看到训练与评测点重叠，以此支持覆盖直觉；二维重叠不能认证原始分布的支持或最大密度比。这里只把图当可视化，不能据其宣称MT-Bench和AlpacaEval已验证定理前提。[Corollary5.8、Appendix D，PDF pp.12、28–29](https://arxiv.org/abs/2405.16436v3)

## 3. 实验改善了什么，尚未证明什么

主实验沿Zephyr两条训练路线：Mistral7B的beta模型用约60k Ultrafeedback prompts，Gemma7B用Argilla-DPO-Mix7K；固定seed42，分别训练1和2epoch，RPO与DPO使用同学习率等配置。$\eta=0.005$在单独的验证部分选择。ID评价最初抽200条测试prompt，因GPT4-0613格式不合要求过滤后保留150条，并随机交换回答位置；RPO对DPO的成对分数beta为56.0%、gemma为54.0%。过滤比例与有限样本应保留，不能视作没有缺失输出的大规模人类验证。[§6、Appendix E，PDF pp.13–14、29–30](https://arxiv.org/abs/2405.16436v3)

AlpacaEval2的长度控制胜率beta从21.15%到23.28%，gemma从15.36%到15.51%，对照和judge均为GPT4 Preview11/06；MT-Bench分数分别7.278到7.381、7.688到7.916。后一个AlpacaEval增益很小且未给多训练种子不确定区间，不能只用“全面显著提升”代替数值。附录数学/推理/代码实验则换了设置：chosen SFT项按token数平均，系数0.2、$\beta=0.5$、OpenRLHF实现。GSM8K为49.9对45.3，但ARC Challenge为49.8对50.0，MBPP普通pass@1同为54.2；不能说每项都提高，也不能把此变体当成主实验原系数的独立复现。[Tables1–3、8，PDF pp.14、29、31](https://arxiv.org/abs/2405.16436v3)

作者将chosen回答概率下降视为DPO过度优化的迹象，RPO确实减轻这一现象。但直接增加chosen交叉熵本来就会提高该指标，它不能单独证明外部真实奖励更好；需要与外部质量对照一起读。三动作例中仅观察$a\succ b$，DPO可能把概率转给未观察、作者指定为低奖励的$c$，而chosen SFT把概率推回$a$。这个例子展示了未约束解的可能性，未证明所有DPO优化器都会走到坏解，也没有解决chosen自身错误或偏好语境不一致的情况。[Figure1、Appendix A，PDF pp.3、21](https://arxiv.org/abs/2405.16436v3)

## 4. 从逐样本惩罚到共享奖励对手：AdvPO

Zhang等的 *Overcoming Reward Overoptimization via Adversarial Policy Optimization with Lightweight Uncertainty Estimation*（首发2024-03-08；本章读2024-07-09的v2）把不确定性建在RM末层嵌入上。令$r(x,y)=\phi^\top e(x,y)$，预计算$M_D=\lambda I+\sum_{D,y\in\{y_c,y_r\}}ee^\top$，用$b\sqrt{e^\top M_D^{-1}e}$估计不确定性。训练只需一个7B RM，PPO对每回答额外做$d^2$量级矩阵运算，省去多个完整RM前向；它降低的是这种集成比较下的开销，并非与普通RM零成本相同。[§3，PDF pp.3–4](https://arxiv.org/abs/2403.05171v2)

置信区间动机依赖无限宽网络、正定NTK及局部线性近似。附录再借广义线性bandit的参数置信界，要求链接函数导数下界等正则条件，且奖励误差还有被略去的有界余项。有限宽、已经微调的Llama7B不自动满足这些条件；BT只能从比较识别奖励差，也不能没有定标就认证绝对奖励。实际把$B=b^2$当超参数在1、5、10、15中搜索，没有测出对真实人类奖励达到标称$1-\delta$覆盖。故这里CI可作有理论动机的相对可靠性信号，不能当成已经校准的部署置信度。[Theorem3.1、Appendix A.2、C，PDF pp.4、13、17–18](https://arxiv.org/abs/2403.05171v2)

AdvPO的对手为所有回答共用一个末层权重，限定$\|\phi-\hat\phi\|_{M_D}\le b$，在当前策略相对参考回答的期望奖励差上取最小。记$g=\mathbb E_{\pi}e-\mathbb E_{ref}e$，椭球内线性最小化给出

$$
\min_{\phi}g^\top\phi=g^\top\hat\phi-b\|g\|_{M_D^{-1}},
$$

再减策略KL。$g\ne0$时最差权重为$\hat\phi-bM_D^{-1}g/\|g\|_{M_D^{-1}}$；$g=0$时值为零、任意可行权重都最优，不宜直接计算除零形式。这是在固定表示和给定椭球下的精确内层解，并非原始任意神经奖励集合的精确搜索。[Theorem4.1及证明，PDF pp.5–6、19](https://arxiv.org/abs/2403.05171v2)

为何比逐样本惩罚更不悲观？对同一特征差与同一范数，$\|\mathbb E g_{x,y}\|\le\mathbb E\|g_{x,y}\|$，一个共享对手不能像每条回答各换对手那样把相反方向都惩罚到最坏。引理证明的是这一数值关系，不是策略质量一定更高。参考回答则把被惩罚的方向从绝对表示均值改为相对参考的位移；参考质量会影响目标，但仅凭“参考平均真实奖励为正”不足以认证真实收益——奖励零点本可平移，完整保证还需不确定集覆盖、目标求解等条件。最差权重随策略变化，参考项也不能在外层优化中一律当作不依赖策略的常数。[Lemma4.2、Appendix C.1–C.2，PDF pp.6、18–19](https://arxiv.org/abs/2403.05171v2)

模拟实验在HH和TL;DR将偏好集各分两半，一半训练奖励，一半PPO。HH gold实际为SFT后的Vicuna13B，摘要为Llama13B；代理和策略为Llama7B。gold的BT概率采样产生标签后，再向30%比较加入随机误标；PPO跑1500步、batch64、学习率$10^{-6}$、最多512生成token，策略KL设0以放大过度优化，chosen作参考。CI与gold/proxy差异相关，3个3B集成在摘要上较不稳定；但比较还混有模型规模及骨干差异，不能单独证明表示CI普遍优于任何同成本集成。附录GP仅用2000训练点构造，在摘要100–500步有较早不确定性上升，说明不同可靠性信号也会误报或反应于不同偏移。[§5.1–5.2、Appendix A.3、D，PDF pp.6–8、14、20–21](https://arxiv.org/abs/2403.05171v2)

使用真实偏好训练RM的另一组实验将PPO学习率降至$5\times10^{-7}$、策略KL0.05；基线包括PPO、加入相同参考的PPO-ref、相同CI逐样本惩罚、3B集成、5个LoRA集成及去参考AdvPO。HH上AdvPO对PPO胜/平/负31/49/20，对PPO-ref35.5/39.5/25；摘要相应为75/7/18及55/6/39。后者对照有助于把参考回答质量与不确定性融合的收益分开；它也显示巨大摘要收益的一部分来自参考，而非仅由轻量CI产生。[Table1、§5.3、Appendix A.4，PDF pp.8–9、14](https://arxiv.org/abs/2403.05171v2)

“human-assisted”不等于所有回答由真人评价：HH随机200提示、摘要100提示，GPT-4交换位置判断两次；一致时直接采用GPT-4，矛盾或平局才交3人多数票。它缓解可见的位置偏差，但保留GPT-4的一致性偏误，未报告所有比较中多少被转交真人，也没有多种子区间。PPO按最高验证奖励选checkpoint，AdvPO还要求不确定性不持续增长，且$B$按奖励/不确定性调参；模型选择本身也属于方法，不应把最终质量差异全归为某一固定目标的训练动力学。[Appendix A.2、A.4、B，PDF pp.13–16](https://arxiv.org/abs/2403.05171v2)

AdvPO给出的可复用思想是让不确定性保留跨回答的共享结构，再相对一个可接受参考作保守改进。边界则是表示与不确定集都可能共同错误：最后一层看不到的偏差、不被椭球覆盖的真实奖励，以及同方向有问题的参考均未被这条范数惩罚消除。论文也把中间层不确定性、主动选数据和70B规模列为后续，而非已有验证。[Limitations，PDF p.9](https://arxiv.org/abs/2403.05171v2)

## 5. 悲观对手也需要覆盖约束：P3O与PRPO

Gupta等的 *Mitigating Preference Hacking in Policy Optimization with Pessimism*（2025-03-10，arXiv:2503.06810v1）进一步指出：在允许非传递偏好的问题中，简单地增加悲观程度也可能逼策略选择未覆盖回答。论文采用一般成对偏好$p(y,y')\in[0,1]$、$p(y,y')=1-p(y',y)$，其中BT标量奖励只是子类；用当前策略与竞争策略的偏好博弈替代单一奖励最大化，再对与偏好数据相容的模型取最坏情况。[§2–3](https://arxiv.org/abs/2503.06810v1)

三动作反例最能说明新问题：数据确定$y_1$胜过$y_2$，从未比较$y_3$，所以涉及$y_3$的偏好可任意取值。在无KL的$\max_\pi\min_{\pi'}\min_{p\in\mathcal P}p(\pi,\pi')$中，允许竞争策略任选未观察动作，会迫使最优策略将一半质量放在$y_3$，取$\pi=(1/2,0,1/2)$，最坏值1/4。它用未知动作对冲“该动作可能压倒已知优质动作”的风险，并非有证据认为$y_3$好。限制竞争策略只选被覆盖的$y_1,y_2$，则可避免此问题。这一失效依赖一般偏好的不确定结构，不能机械套回所有标量奖励max-min目标。[Figure2、Appendix B，PDF pp.4、12–13](https://arxiv.org/abs/2503.06810v1)

覆盖集合要求任意两个候选偏好函数的平方差，在两个covered策略配对下的期望，不超过数据采样策略独立配对下的$C$倍。若各策略密度比至多$\sqrt C$，可满足此条件；对共享线性特征，还可用交叉协方差相对数据协方差的方向比控制，比逐点密度比更弱。在真偏好$p^*\in\mathcal P$、凸的可比较策略集合及精确求解等条件下，限制min对手的无正则估计可对任一covered策略$\pi$给出$p^*(\pi_{rp},\pi)\ge1/2-2\sqrt{C\epsilon}$，其中$\epsilon$约束模型集在数据分布下的平均偏好差。它是相对covered竞争者的成对偏好保证，不是全动作最优、逐样本正确或神经优化收敛保证。[Definition3.1、Lemma3.2、Appendix C，PDF pp.5、13–15](https://arxiv.org/abs/2503.06810v1)

实际P3O分三步近似，作者对损失的精确性有明确区分。先以竞争策略对数据/参考策略的KL，启发式替代难以实施的covered集合；解析消去竞争策略后得到log-partition目标；再用变分**上界**替代这个目标，并用历史策略的EMA作近似对手，最大化上界并不等于最大化原目标。最后，把偏好似然定义的版本空间换成对冻结MLE偏好模型的KL锚定，以便不在每轮载入原偏好数据。PRPO则让$p$由BT奖励参数化，并非固定RM不更新；两者都交替更新策略与偏好/奖励对手。[§4、Appendix D–F，PDF pp.5–7、15–17](https://arxiv.org/abs/2503.06810v1)

这里可以理解为把“与数据相容但对当前策略不利”的模型保留下来，而非只惩罚一个RM的高分。MLE锚定是否足够逼近真偏好，EMA对手是否接近变分最优以及KL是否保住覆盖，均需实际检查。主要语言模型实验设$\alpha=0$，理由是数据生成与参考相近；因此语言模型结果主要验证悲观对抗更新，不能单独认证完整的covered对手限制。小表格实验确实测试限制形式，但其版本空间半径取能包含已知真偏好的最小值，使用oracle信息，不能称作无真值时自动选出了可靠不确定集。[§5、Appendix G，PDF pp.7–8、16–18](https://arxiv.org/abs/2503.06810v1)

表格实验每种采样策略收500对偏好，把未充分采样动作概率从0变到0.2，10随机种子给出两倍标准误。限制形式在未知动作实际较差时更稳；若未知动作确实优越，非悲观方法有少量数据就可能利用它而取得更强结果。这体现安全默认与快速利用之间的权衡，而非一律悲观最优。[Figures3、6，PDF pp.7、18](https://arxiv.org/abs/2503.06810v1)

语言实验为TL;DR的T5-large770M策略、T5-XL3B偏好/RM，以及HH-helpfulness上8B PaLM系策略、偏好和RM。对照DPO、REINFORCE、Nash-EMA和附录PDPO，扫描宽范围KL强度，使用Gemini1.5Flash交换位置评价。P3O/PRPO的策略KL系数主要$10^{-5}$，也扫偏好锚定强度、学习率与混合参数；每500步存checkpoint，表格列训练20000梯度步、上下文1024、生成128token，摘要batch32、helpfulness16。文中亦提到较大8B曲线只跑10000步，故不能把全部曲线称相同训练步数；图中95%区间是评价不确定性，未说明是多次独立训练方差。[§5、Appendix H.1–H.2，PDF pp.7–8、17、22–23](https://arxiv.org/abs/2503.06810v1)

结果最重要的对照不是所有judge都一致认同“少写列表”更好。摘要最佳checkpoint的P3O对REINFORCE、Nash-EMA、PRPO的成对偏好约0.63、0.66、0.53，末端仍保持优势；helpfulness的普通评价却强烈偏爱Nash-EMA，P3O对它约0.33。换成明确要求helpful且不冗长的提示，P3O对Nash-EMA约0.59。评价准则改变会改变排序，不能把后者直接当作证实前者无效；可支持的主张是P3O对这种训练/评价偏好错配更稳健，尚没有独立真人判断确定唯一正确取舍。[Figures5、13–14，PDF pp.8、21](https://arxiv.org/abs/2503.06810v1)

行为分析显示REINFORCE与Nash-EMA的helpfulness回答平均长约40%–50%，前者几乎全为列表；P3O/PRPO更接近数据中的长度/格式，摘要长度也更接近chosen。更接近训练形式不能单独定义正确性；但结合与SFT相比的偏好提高，可排除“只是不生成有用内容”这一简单解释。论文明确称例子为挑选展示，并承认悲观方法仍有幻觉，不能把案例当总体错误率。其贡献是证明**怎样限制悲观博弈的对手也会影响安全方向**，并给出可训练近似；各项近似及自动评价均保留覆盖与效用边界。[Figure4、Appendix I，PDF pp.8–9、23–28](https://arxiv.org/abs/2503.06810v1)

## 阅读范围

RPO v3已实际读完全部31页，含完整证明、实验提示、补表及末尾数学/代码变体，关键图实际查看。全文阅读不等于独立形式化认证或实验复现。其他未读悲观目标、约束RLHF及演示引导路线列于主文缺口。

AdvPO v2已读全部21页，含NTK/GLM证明、椭球对偶、参考引理、混合人机评价及GP附录；实际查看PDF7、8、19、21图表。无复现实验。

P3O/PRPO v1已读全部28页，含三动作反例、覆盖证明、全部近似推导、表格实验与案例；实际查看PDF5、8、14、15、21、22图页。
