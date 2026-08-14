# 第 0 章 大语言模型：世界规模的信息压缩器

## 本章导引

> 大语言模型的快速发展和横跨各领域发挥的巨大效用是显著的，然而，在这场狂欢之中，有多少是真实，又有多少是无耻的炒作和噱头？或许你是积极拥抱大模型的一员，或许你是被动着、被焦虑裹挟着前进。一方面，要完全迈入一个新领域是需要耗费极大精力和沉没成本的事，另一方面，大模型的累累成果让无数与之相关的人感到危机。为了避免陷入“智械危机”的悲观主义，也为了充分地利用新时代的机遇，每一个人都应该对大模型的运行机理和能力边界有科学的认知：大模型仍然是科学的产物，而不是无所不能的魔法机器。

## 0.1 信息的压缩器

自人类有记载以来，信息的总量就在不断膨胀。在数学界，一般认为庞加莱是最后的数学全才，而后的数学家在纷繁复杂的数学分支中往往只能选择一角。就科研界而言，论文发表的数量不断增加，论文发表体系的意义却反而在消减：过多的信息很难有效的统合。有一个笑谈是，如果你证明了一个数学定理，不妨去翻阅一下苏联时期的文稿，说不定你的证明就藏在某个角落里。大模型，更准确地说，大语言模型，为统合这种世界-历史范围的庞大信息提供了相当高效的实现。

语言是有限的，或者说语言的基本单元--可以称为词表--是有限的，因此，对一个给定的问题，我们可以在给定长度下对每个位置进行词表大小的遍历组合，只需要简单的高中数学里的乘法原理，我们就可以知道，总的组合数是词表大小的指数。在信息论的视角下，这种庞大的组合数或者说不确定性，代表着巨量的信息。

于是，在这个视角下，我们可以将大模型视为一个压缩了巨量信息的机器，并且可以根据输入的信息（我们的提问），来输出具有一定规律的的信息。这里的规律就是压缩的体现，大模型识别到了语料的规律（比如模式匹配，如病症-病因匹配，这种匹配在研究中倾向是非因果的，你可以理解为它并没有真正理解这两者的物理规律，只是一种表层的学习，当然，你给出更多的底层信息，他学习到的也越多，这种匹配能够在更大程度上接近真实），于是输出不再是随机的，即压缩了信息。


## 0.2 为什么是现在？

你也许会好奇，大模型是怎样“突然冒出来的”，这个问题当然有很多具体的和概括的答案，在这里，你可以认为是信息规模（对应互联网时期以来快速增长的各种信息）和计算能力（如英伟达显卡的强大并行计算能力）在必然的偶然下，相互配合最终得到的结果。

## 0.3 它已走进每一个专业

以下是根据 trae work（字节打钱）检索整理的一些大模型的多领域应用。这里的trae work是一个agent智能体产品，我们会在后面介绍相关概念。

**医学与生命科学**：Google DeepMind 的 Med-Gemini 在美国医师执照考试（USMLE）的基准 MedQA 上达到 91.1% 的准确率 [1]——这场考试，人类医学生要准备数年。2025 年发布的 GPT-5 在医疗健康基准 HealthBench 上进一步突破，能像"主动思考的伙伴"一样标记潜在问题、根据患者背景调整建议 [2]。而在结构生物学领域，AlphaFold 系列让蛋白质结构预测从"数月的实验"变成"数秒的计算"，其团队获 2024 年诺贝尔化学奖 [3]。英矽智能（Insilico Medicine）的 INS018_055 成为全球首个由生成式 AI 发现并进入 II 期临床试验的全新机制药物 [4]。

**工科**：GitHub 的受控实验显示，使用 Copilot 的开发者完成任务的速度快了 55%，完成率从 70% 提升到 78% [5]。Google 用强化学习设计 TPU 芯片布局（AlphaChip），将人类专家需要数月的工作压缩到数小时 [6]。DeepMind 的 GNoME 系统一口气预测了 220 万种潜在新材料，其中 38 万种是稳定的——相当于人类约 800 年的实验积累 [7]。而到 2026 年，AI 编程工具已从"补全代码"进化为"自主解决完整工程问题"：Claude Code、Cursor、GitHub Copilot 三大工具全部进入 Agent 时代 [8]。DEEPSEEK在8月13日发布了deepseek harness开源项目。

**数学与理科**：2025 年 4 月，OpenAI 的 o4-mini 在美国数学邀请赛（AIME 2025）上拿到 99.5% 的正确率——基本是满分 [9]。再往前，Google DeepMind 的 AlphaProof 在 2024 年国际数学奥林匹克（IMO）中拿到 28 分，达到银牌水平，仅差金牌线 1 分 [10]。这意味着 AI 已能在需要严格逻辑证明的领域与顶尖人类选手同台竞技。在实际研究方面，也已经解决了数个著名的问题。

**文科与人文**：2023 年，维苏威火山挑战赛（Vesuvius Challenge）的参赛者用 AI 成功从公元 79 年被火山灰碳化、无法物理展开的赫库兰尼姆莎草纸卷轴中识别出古希腊文字——这些卷轴已沉默了近两千年 [11]。可汗学院的 Khanmigo 将大模型打造为个性化辅导教师 [12]；法律 AI 平台 Harvey 覆盖了美国百强律所中的 50 家，估值达 155 亿美元 [13]。

讲这么多，不是为了让你恐慌，**大模型不是真理机器。** 相反，我想说的是，大模型就像是一个外置大脑，它可以处理单体人类乃至团体都绝对无法处理的庞大信息，你可以大胆地去利用好这个外置大脑为你服务，不管是生活还是研究，方方面面，当然，这一切的前提是，你对他的能力边界和运作方式有真实的认知，先进的模型会成为人类进步的助力，而不是带来毁灭。



## 0.4 当 AI 越来越强，你的价值在哪里

2025 年，麦肯锡的调查覆盖了 105 个国家的近 2000 家企业：88% 的组织已在用 AI，但只有 39% 获得了真金白银的收益 [16]。这个落差说明什么？——AI 不缺使用者，缺的是知道在哪儿用、怎么用、什么时候不该用的人。

这就引出一个你可能已经隐约感到不安的问题：如果 AI 能通过医师执照考试、能在数学竞赛中拿到 99.5%、能读取两千年前的古卷……那你的价值在哪里？

答案不在于"AI 还有哪些做不到"——技术迭代太快，今天的短板可能是明天的标配。答案在于：**理解它怎么工作、知道它的能力边界，本身就是一种不可替代的能力。**

试想：一个不懂医学的人用 AI 开出的处方，和一个精通医学的医生用 AI 辅助做出的诊断，差距不在 AI，而在那个判断"AI 这个建议该不该听"的人。AI 能列出十种治疗方案，但只有人能权衡这个特定患者的经济状况、家庭意愿和生活质量。反过来，2023 年纽约律师 Steven Schwartz 用 ChatGPT 检索法律文献，提交了 6 个 AI 编造的虚假判例，被法院罚款 [17]——他错在不了解 AI 会"一本正经地胡说"，也就是不了解它的能力边界。

这并非孤例。苹果团队 2024 年的研究发现，仅仅在小学数学题里加一个不影响解题的无关子句，所有顶级模型的准确率就下降高达 65% [18]——模型并非真正在"推理"，而是在复现见过的模式。即便是最新的 GPT-5，幻觉率比 GPT-4o 降低了约 45%，但并未归零 [2]。Vectara 的评测显示，一些推理类模型在摘要任务上的幻觉率仍高达 18–24% [19]。加拿大航空的聊天机器人曾向乘客谎称可事后申请丧亲机票退款，法院裁定航空公司须对此负责 [20]——这是首批认定企业须为 AI 客服幻觉担责的判例之一。

世界经济论坛预测，未来五年 30% 的岗位将被重构 [21]——不是"消失"，而是"重新定义"。而重新定义的前提，是从业者自己理解 AI 能做什么、不能做什么。程序员是最先被 AI"逼到墙角"的白领群体，但也是最先学会与 AI 协作、用 AI 放大自己产出的群体——Copilot 让开发速度提升 55% [5]，不是因为程序员变成了 AI，而是因为程序员学会了驾驭 AI。

这就是这本书存在的理由。它不是要让你成为 AI 工程师，而是给你一种**素养**：知道这台机器大致怎么运转，知道它在哪些地方可靠、哪些地方会把你带偏。拥有这种素养的人，不是被 AI 替代的人，而是能驾驭 AI 的人。方向盘，始终在你手里。

## 0.5 这本书怎么读

全书分三层，由浅入深：

- **第一层 · 建立直觉**（第 1–7 章）：大模型到底在做什么、怎么做到的。从一个字一个字蹦出来的对话开始，经过 Token、词嵌入、Transformer、注意力，到训练和"涌现"。读完这层，黑盒就不再是黑盒。
- **第二层 · 理解边界**（第 8–12 章）：它擅长什么、做不好什么、为什么会"一本正经地胡说八道"，以及怎样更好地使用和评估它。
- **第三层 · 走向实践**（第 13–18 章）：开源生态、模型选型、后训练、Harness、部署和成本——面向有实践需求的读者。

最后说一句：**你不需要先懂数学，才能读懂这本书。** 凡是出现公式的地方，我们都先用大白话讲清楚直觉，抓住insight，不必死磕繁琐的细节。

翻开下一页，我们从一个字一个字蹦出来的对话开始。

---

## 本章小结

- AI 已在医学（Med-Gemini、GPT-5、AlphaFold）、工科（Copilot、AlphaChip、GNoME、Agent 编程）、数学（o4-mini、AlphaProof）、文科（维苏威挑战赛、Harvey）等领域产生可量化的实际影响——不是"未来"，而是"已来"。
- 从预训练到后训练对齐、从推理增强到 Harness、从推理基础设施到评测体系——六个环节串成一条完整的链条，本书将逐层展开。
- 当 AI 越来越强，人的价值不在于"比 AI 做得更好"，而在于理解它怎么工作、知道它的能力边界——这是驾驭 AI 而非被 AI 替代的前提。
- 全书三层：建立直觉 → 理解边界 → 走向实践；不需要先懂数学。

## 参考文献

[1] Saab, K., Tu, T., Weng, W.-H., et al. Capabilities of Gemini Models in Medicine. arXiv:2404.18416, 2024. https://arxiv.org/abs/2404.18416

[2] OpenAI. Introducing GPT-5. 2025. https://openai.com/index/introducing-gpt-5/

[3] Abramson, J., Adler, J., et al. Accurate structure prediction of biomolecular interactions with AlphaFold 3. Nature, 630: 493-500, 2024. https://www.nature.com/articles/s41586-024-07487-w

[4] Insilico Medicine. A generative AI-driven TNIK inhibitor for idiopathic pulmonary fibrosis (INS018_055). Nature Biotechnology, 2024. https://www.nature.com/nbt/

[5] GitHub. Quantifying GitHub Copilot's Impact on Developer Productivity and Happiness. 2022. https://github.blog/2022-09-07-research-quantifying-github-copilots-impact-on-developer-productivity-and-happiness/

[6] Mirhoseini, A., Goldie, A., et al. A graph placement methodology for fast chip design. Nature, 594: 207-212, 2021. https://www.nature.com/articles/s41586-021-03544-w

[7] Merchant, A., Batzner, S., et al. Scaling deep learning for materials discovery. Nature, 624: 80-85, 2023. https://www.nature.com/articles/s41586-023-06735-9

[8] AI 编程工具全面进入 Agent 时代：Claude Code、Cursor、GitHub Copilot. 2026. https://m.toutiao.com/group/7658102791965803051/

[9] OpenAI. Introducing o3 and o4-mini. 2025. https://openai.com/index/introducing-o3-and-o4-mini/

[10] DeepMind. AlphaProof: AI achieves silver-medal standard at International Mathematical Olympiad. Nature, 2025. https://www.nature.com/

[11] Vesuvius Challenge: Using AI to read the Herculaneum papyri. 2023-2024. https://scrollprize.org

[12] Khan Academy. Khanmigo: AI-powered tutor. 2023. https://www.khanmigo.ai

[13] Harvey AI: Legal AI platform. 2025. https://www.harvey.ai

[14] DeepSeek-R1: 纯强化学习训练的推理模型. 2025. https://www.cnblogs.com/deephub/p/19347300

[15] Stanford HAI. 2025 AI Index Report. 2025. https://hai.stanford.edu/ai-index/2025-ai-index-report

[16] McKinsey. The State of AI in 2025. 2025. https://cj.sina.cn/article/norm_detail?url=https%3A%2F%2Ffinance.sina.cn%2F2025-11-11%2Fdetail-infwyunf2241384.d.html

[17] Mata v. Avianca, Inc.: Attorney sanctioned for submitting AI-fabricated case citations. 2023. https://m.163.com/dy/article/IC8QERQ20556278W.html

[18] Mirzadeh, I., Alizadeh, K., Shahrokhi, H., et al. GSM-Symbolic: Understanding the Limitations of Mathematical Reasoning in Large Language Models. ICLR, 2025. https://arxiv.org/abs/2410.05229

[19] Vectara. Hallucination Leaderboard (HHEM). 2026. https://github.com/vectara/hallucination-leaderboard

[20] Moffatt v. Air Canada: Tribunal holds airline liable for chatbot's misleading statements. 2024. https://docs.feishu.cn/article/wiki/Bzskw8nW2iPNG7k96TbcylG6nxc

[21] World Economic Forum. Future of Jobs Report 2025. 2025. https://m.toutiao.com/group/7627046455982817842/
