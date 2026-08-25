# 第 0 章 大语言模型：世界规模的信息压缩器

## 本章导引

>大语言模型的快速发展，以及它跨领域发挥的显著效用，是有目共睹的事实。但在这场热潮中，有多少是真实的进展，又有多少是炒作与噱头？有人积极拥抱大模型，有人被动地、被焦虑裹挟着前进。完全迈入一个新领域，需要耗费大量精力和沉没成本；而大模型的累累成果，又让无数与之相关的人感到危机。要避免陷入悲观的宿命论，也要充分利用这个时代的机遇，每个人都应当对大模型的运行机理和能力边界建立科学的认知：大模型是科学的产物，而不是无所不能的魔法机器。更关键的是，它是可以被掌握的——掌握的方法不在于比模型懂得更多，而在于用对的方式使用它。

## 0.1 信息的压缩器

自人类有记载以来，信息总量就在不断膨胀。数学界一般认为庞加莱是最后的"全才"，此后的数学家只能在纷繁复杂的数学分支中选择一角。科研界的情况类似：论文发表数量持续增加，发表体系的意义却反而在消减——过多的信息难以有效统合。有一个流传的笑谈：如果你证明了一个数学定理，不妨翻翻苏联时期的文稿，你的证明说不定就藏在某个角落。大语言模型为统合这种世界历史范围的庞大信息，提供了一种相当高效的实现。

语言的基本单元——词表——是有限的。因此，对给定长度的句子，每个位置都可以在词表大小范围内组合；用高中数学里的乘法原理即可得知，总的组合数是词表大小的指数。在信息论的视角下，这种庞大的组合数，或者说不确定性，本身就代表着巨量的信息。

在这个视角下，大模型可以被视为一台压缩了巨量信息的机器：它根据输入（我们的提问）输出具有一定规律的信息。这里的"规律"正是压缩的体现——模型识别出了语料中的模式（例如病症与病因的匹配），于是输出不再是随机的。需要说明的是，这种匹配在研究中倾向于非因果的：模型并没有真正理解两者背后的物理规律，只是学到了表层关联。你给出的底层信息越多，它学到的也就越多，这种匹配就越能接近真实。

## 0.2 为什么是现在？

大模型不是凭空冒出来的。概括地说，是信息规模（互联网时期以来快速增长的数据）与计算能力（如英伟达显卡强大的并行计算）在必然与偶然的配合下，相互催生、最终得到的结果。

## 0.3 它已走进每一个专业

以下应用案例由 Trae（字节跳动出品的 agent 智能体产品）检索整理；agent 相关概念将在后文介绍。

**医学与生命科学**：Google DeepMind 的 Med-Gemini 在美国医师执照考试（USMLE）的基准 MedQA 上达到 91.1% 的准确率 [1]——这场考试，人类医学生要准备数年。2025 年发布的 GPT-5 在医疗健康基准 HealthBench 上进一步突破，能像"主动思考的伙伴"一样标记潜在问题、根据患者背景调整建议 [2]。在结构生物学领域，AlphaFold 系列将蛋白质结构预测从"数月的实验"变成"数秒的计算"，其团队获 2024 年诺贝尔化学奖 [3]。英矽智能（Insilico Medicine）的 INS018_055 成为全球首个由生成式 AI 发现并进入 II 期临床试验的全新机制药物 [4]。

**工科**：GitHub 的受控实验显示，使用 Copilot 的开发者完成任务的速度快了 55%，完成率从 70% 提升到 78% [5]。Google 用强化学习设计 TPU 芯片布局（AlphaChip），将人类专家需要数月的工作压缩到数小时 [6]。DeepMind 的 GNoME 系统预测了 220 万种潜在新材料，其中 38 万种是稳定的——相当于人类约 800 年的实验积累 [7]。到 2026 年，AI 编程工具已从"补全代码"进化为"自主解决完整工程问题"：Claude Code、Cursor、GitHub Copilot 三大工具全部进入 Agent 时代 [8]。8 月 13 日，DeepSeek 发布了 deepseek-harness 开源项目，为构建可约束、可验证的 agent 工作流提供了基础设施。

**数学与理科**：2025 年 4 月，OpenAI 的 o4-mini 在美国数学邀请赛（AIME 2025）上拿到 99.5% 的正确率——基本是满分 [9]。更早之前，Google DeepMind 的 AlphaProof 在 2024 年国际数学奥林匹克（IMO）中拿到 28 分，达到银牌水平，仅差金牌线 1 分 [10]。在需要严格逻辑证明的领域，AI 已能与顶尖人类选手同台竞技，并在实际研究中解决了数个著名问题。

**文科与人文**：2023 年，维苏威火山挑战赛（Vesuvius Challenge）的参赛者用 AI 从公元 79 年被火山灰碳化、无法物理展开的赫库兰尼姆莎草纸卷轴中识别出古希腊文字——这些卷轴已沉默了近两千年 [11]。可汗学院的 Khanmigo 将大模型打造为个性化辅导教师 [12]；法律 AI 平台 Harvey 覆盖了美国百强律所中的 50 家，估值达 155 亿美元 [13]。

讲这些不是为了让你恐慌。恰恰相反，这些例子的共同点是：大模型以超人的规模处理信息，把原本以年计、以月计的工作压缩成以小时计、以秒计。它不是真理机器，但它是一个强大的外置大脑，可以处理单个人乃至团队绝对无法处理的庞大信息——无论生活还是研究，你都可以大胆地利用它。前提是，你对它的能力边界和运作方式有真实的认知。理解了这一点，先进的模型就会成为人类进步的助力，而不是带来毁灭。

## 0.4 掌握大模型：深入领域，严格对齐，用 agent 工作流产出成果

2025 年，麦肯锡的调查覆盖了 105 个国家的近 2000 家企业：88% 的组织已在用 AI，但只有 39% 获得了真金白银的收益 [16]。这个落差说明什么？——AI 不缺使用者，缺的是知道在哪儿用、怎么用、什么时候不该用的人。

如果你会问：AI 能通过医师执照考试、能在数学竞赛中拿到 99.5%、能读取两千年前的古卷，那我的价值在哪里？

答案不在于"AI 还有哪些做不到"——技术迭代太快，今天的短板可能是明天的标配。答案在于：**理解它怎么工作、知道它的能力边界，本身就是一种不可替代的能力。** 更进一步，掌握大模型有一套可以实践的方法，核心是三件事：在一个领域深入，用严格的对齐方法约束模型，让 agent 自动工作流替你产出成果。

**第一，在一个领域深入。** 一个不懂医学的人用 AI 开出的处方，和一个精通医学的医生用 AI 辅助做出的诊断，差距不在 AI，而在那个判断"这个建议该不该听"的人。AI 能列出十种治疗方案，但只有人能权衡这个特定患者的经济状况、家庭意愿和生活质量。深度领域知识让你成为模型的审查者与裁判：你知道什么是对的，因此能判断模型什么时候可靠、什么时候出错。这是所有其他环节的前提——没有领域深度，就无法设定标准，更无法验证输出。

**第二，用严格的对齐方法约束模型。** 大模型默认输出的是"概率最高的流畅回答"，而不是"你要的正确结果"。要让它在具体任务上可靠，需要主动施加约束。可行的做法包括：把任务规格写清楚——输入是什么、输出格式是什么、质量标准是什么；设立可验证的检查点，让每一步输出都能对照领域知识核实；明确模型的权限边界——哪些事它不能做、哪些情况必须上报给人；建立一小套评估用例，定期检验模型的表现是否退化。这些约束的共同作用，是把一个开放式生成器变成一个有边界的可靠工具。

**第三，把成熟的工作流交给 agent 自动执行。** 当领域知识、任务规格和验证标准都已就位，工作流就可以被编码为 agent：它分解任务、逐步执行、在检查点停下等待确认、根据反馈迭代。人不再亲自完成每一个步骤，而是监督整体过程——在关键节点做判断，在失败点介入。这正是 DeepSeek Harness、Claude Code 等工具在做的事，也是"AI 编程进入 Agent 时代"的真正含义 [8]。

反过来，缺乏约束的使用是危险的。2023 年，纽约律师 Steven Schwartz 用 ChatGPT 检索法律文献，提交了 6 个 AI 编造的虚假判例，被法院罚款 [17]——他错在不了解 AI 会"一本正经地胡说"，也就是不了解它的能力边界。这并非孤例：苹果团队 2024 年的研究发现，仅仅在小学数学题里加一个不影响解题的无关子句，所有顶级模型的准确率就下降高达 65% [18]——模型并非真正在"推理"，而是在复现见过的模式。即便是最新的 GPT-5，幻觉率比 GPT-4o 降低了约 45%，但并未归零 [2]；Vectara 的评测显示，一些推理类模型在摘要任务上的幻觉率仍高达 18–24% [19]。加拿大航空的聊天机器人曾向乘客谎称可事后申请丧亲机票退款，法院裁定航空公司须对此负责 [20]——这是首批认定企业须为 AI 客服幻觉担责的判例之一。

但这些都是"如何用得安全"的问题，而不是"要不要用"的问题。世界经济论坛预测，未来五年 30% 的岗位将被重构 [21]——不是"消失"，而是"重新定义"。而重新定义的前提，是从业者自己理解 AI 能做什么、不能做什么。程序员是最先被 AI"逼到墙角"的白领群体，但也是最先学会与 AI 协作、用 AI 放大自己产出的群体——Copilot 让开发速度提升 55% [5]，不是因为程序员变成了 AI，而是因为程序员学会了驾驭 AI。

这就是这本书存在的理由。它不是要让你成为 AI 工程师，而是给你一种**素养**：知道这台机器大致怎么运转，知道它在哪些地方可靠、哪些地方会把你带偏，以及如何用对的方法让它可靠地为你工作。拥有这种素养的人，不是被 AI 替代的人，而是能驾驭 AI 的人。

## 0.5 这本书怎么读

全书分三层，由浅入深：

- **第一层 · 建立直觉**（第 1–7 章）：大模型到底在做什么、怎么做到的。从一个字一个字蹦出来的对话开始，经过 Token、词嵌入、Transformer、注意力，到训练和"涌现"。读完这层，黑盒就不再是黑盒。
- **第二层 · 理解边界**（第 8–12 章）：它擅长什么、做不好什么、为什么会"一本正经地胡说八道"，以及怎样更好地使用和评估它。这一层对应 0.4 节中的"严格对齐"——你只有知道边界在哪里，才能设计出有效的约束。
- **第三层 · 走向实践**（第 13–18 章）：开源生态、模型选型、后训练、Harness、部署和成本——面向有实践需求的读者。这一层教你如何把约束固化为 agent 工作流，真正让大模型为你产出成果。

最后说一句：**你不需要先懂数学，才能读懂这本书。** 凡是出现公式的地方，我们都先用大白话讲清楚直觉，抓住 insight，不必死磕繁琐的细节。

翻开下一页，我们从一个字一个字蹦出来的对话开始。

---

## 写在最后

Do it before you think.

你可以尝试让 AI 帮你写一个网站并部署，也可以让 AI 收集尚未解决的数学问题，从中挑选表述初等的定理，用 AI 尝试证明，看自己能否跟上。在这些尝试中，你会逐渐体会 0.4 节讲的方法：深入一个领域（哪怕只是写一个网站），把任务规格和验证标准写清楚（严格对齐），让 AI 自动执行重复的步骤（agent 工作流）。或许你会发现自己可以做到很多原本做不到的事；也或许你会逐渐发现，让 AI 处理自己完全无法审阅的项目是一件让人焦虑的事——这一点对所有 AI 驱动的任务都是一致的：你能审阅的深度，决定了你能托付的尺度。

---

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
