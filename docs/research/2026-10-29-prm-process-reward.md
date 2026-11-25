---
title: "过程奖励何时可信？挑答案、找错步与训练解题模型"
description: "给数学解答的每一步打分，可以帮模型从一批候选中挑出答对的那份。在同一批训练解答上，按续写结果打标签的评分器在挑答案时略占优，由语言模型逐步审阅后训练的评分器更会找错步。用分数训练解题模型时，得看它最终解出了多少题。"
tags: ["每日调研", "强化学习", "后训练", "过程奖励", "Reward Model"]
date: "2026-10-29"
---

# 过程奖励何时可信？挑答案、找错步与训练解题模型

<div class="research-article">

<p class="lead">给数学解答的每一步打分，可以帮模型从一批候选中挑出答对的那份。在同一批训练解答上，按续写结果打标签的评分器在挑答案时略占优，由语言模型逐步审阅后训练的评分器更会找错步。用分数训练解题模型时，得看它最终解出了多少题。有的模型确实多做对了题，有的却学会了只写一句开场白。<sup id="cite-1"><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup><sup id="cite-2"><a href="#ref-2" aria-label="参考文献 2">[2]</a></sup><sup id="cite-3"><a href="#ref-3" aria-label="参考文献 3">[3]</a></sup><sup id="cite-5"><a href="#ref-5" aria-label="参考文献 5">[5]</a></sup></p>

## 78.2% 的答对率来自一次怎样的选择

<p>Lightman 等人把解题和阅卷交给两个模型。解题模型固定不动，为同一道题写出多份解答。过程奖励模型（PRM）读到每一步末尾，预测标注者会怎样评价这一步，再把各步通过的概率相乘，作为整份解答的分数。从固定的候选中选出得分最高的一份，核对它的最终答案，这就是 Best-of-N 重排序。<sup><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup></p>
<p>人给出的信息比卷末的对错多在哪里？在主要标注阶段，标注者一旦读到第一处错步就停下。这样，一份最终答错的解答仍能提供一串值得保留的正确步骤，以及推理开始失效的确切位置。团队还专门挑出那些现有评分器给了高分、最后却答错的解答，请人找出它究竟漏看了哪一步。筛选后约八十万条步骤标签来自约七万五千份解答。<sup><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup></p>
<p>在随机留出的 500 道 MATH 题上，每题生成 1,860 份候选，PRM 选中的答案有 78.2% 正确。面对同一批候选，它胜过按整份解答打分的结果奖励模型，也胜过按最终答案多数投票的办法。排序表现最好的模型也漏过具体的推理错误。论文附录里，一份解答看到有五种颜色，就认定交换同色球只有五种换法。它漏算了接球者每次都有两个球可以回给对方，评分器也放过了这一步。<sup><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup></p>

## 用续写标注一步，测到的是谁能把题做完

<p>Math-Shepherd 提出一种省去人工逐步阅卷的办法。把解答截在当前步骤，让另一个模型从这里接着做题，用最终答案核对每次续写。通义团队复用了这套办法，每个截点独立续写八次。如果八次中恰好有一次答对，硬标签就给正例，软标签则记作八分之一。两种标签都来自同一批答案，前者记录是否出现过成功，后者估计这个续写模型从这里做对的机会。<sup><a href="#ref-2" aria-label="参考文献 2">[2]</a></sup><sup><a href="#ref-3" aria-label="参考文献 3">[3]</a></sup></p>
<p>以展开括号为例。即使上一步漏乘了一项，续写模型也可能回到题干重算，交出正确答案。反过来，一步变形完全合法，后面还有一道难解的方程，八次都算错也很容易理解。换一个更强的续写模型，或者多给几次机会，前缀原封不动，标签却可能改变。这样的分数可以帮搜索程序决定把计算花在哪条路径上。若要据此告诉学生是哪一行用了错的规则，就得直接检查那一行。<sup><a href="#ref-2" aria-label="参考文献 2">[2]</a></sup><sup><a href="#ref-3" aria-label="参考文献 3">[3]</a></sup></p>

<figure class="figure" id="fig-labeling">
  

  

  <picture>
<source media="(max-width: 720px)" srcset="/research/prm-process-reward/fig-labeling-narrow.svg">
<img loading="lazy" decoding="async" src="/research/prm-process-reward/fig-labeling-wide.svg" alt="为什么同一个错步会得到正标签（宽屏版）">
</picture>
<figcaption><strong>图 1｜为什么同一个错步会得到正标签。</strong>续写可以修正前面的错误。次数为示意，标签规则见文献 [2]、[3]。</figcaption>
</figure>

<p>通义团队请语言模型逐步审阅同一份解答，再和续写结果推断出的首错位置对照。两者指出的错误位置一致才保留样本。在这组对照里，筛完约剩四成数据，训练出的评分器在找错任务上已经接近用全量审阅标签训练的模型。这里省下的是进入训练的样本，续写和审阅仍然都要做。<sup><a href="#ref-3" aria-label="参考文献 3">[3]</a></sup></p>

## 换一张考卷，三种标注的排名就反过来

<p>在八选一评测中，评分器每题挑一份解答，评测程序只读它的最终答案。ProcessBench 给的是一份已经写好的解答，要求指出第一处错误，或确认全篇正确。只找到首错引起的后续算错，也算定位失败。追究第一处错有数学上的理由。一旦前提写错，下一行即使遵守代数规则，也可能沿着错的前提继续推下去。<sup><a href="#ref-3" aria-label="参考文献 3">[3]</a></sup><sup id="cite-4"><a href="#ref-4" aria-label="参考文献 4">[4]</a></sup></p>

<div class="table-scroll" role="region" aria-labelledby="tbl-1" tabindex="0">
  <table>
    <caption id="tbl-1">
      表 1｜同一组评分器在挑答案与找错步上的表现
      <span>八选一取七项基准的平均答对率，首错评测取 ProcessBench 四个子集的平均 F1。来源：文献 [3]、[4]。</span>
    </caption>
    <thead>
      <tr>
        <th scope="col">训练标签来源</th>
        <th scope="col" class="num">训练样本（万）</th>
        <th scope="col" class="num">八选一答对率（%）</th>
        <th scope="col" class="num">首错评测 F1（分）</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <th scope="row">蒙特卡洛续写</th>
        <td class="num">86.0</td>
        <td class="num"><strong>65.9</strong></td>
        <td class="num">40.1</td>
      </tr>
      <tr>
        <th scope="row">语言模型逐步审阅</th>
        <td class="num">86.0</td>
        <td class="num">65.3</td>
        <td class="num">46.5</td>
      </tr>
      <tr>
        <th scope="row">人工标注（PRM800K）</th>
        <td class="num">26.4</td>
        <td class="num">64.9</td>
        <td class="num"><strong>56.5</strong></td>
      </tr>
    </tbody>
  </table>
</div>
<p class="table-hint">左右滑动查看完整表格</p>

<p>表中前两行用的是同一批题目和解答，只换标注办法。改为直接审阅后，八选一少了 0.6 个百分点，首错评测反而高了 6.4 分。人工标注那一行使用另一批材料，可以看出它在首错评测中排第一，挑答案时排第三。若要从这张表估计每条人工标签值多少条自动标签，就缺少控制题目和解答来源的对照。<sup><a href="#ref-3" aria-label="参考文献 3">[3]</a></sup></p>
<p>两种评测究竟会在哪些解答上分歧？ProcessBench 的 Omni-MATH 子集中，研究者收集了 500 份最终答案正确的解答，专家检查时发现其中 259 份仍有过程错误。八选一若挑中这样的解答，就给一次成功。首错评测还要看评分器能否指出推理最先断在哪里。<sup><a href="#ref-4" aria-label="参考文献 4">[4]</a></sup></p>
<p>逐步打分的记录还能揭示评分器在看哪一行。通义团队检查八选一实验的全部候选，发现包括 Math-Shepherd 和 Skywork 在内的四款评分器，各自都有超过四成的解答在最后一步拿到全篇最低分。答案通常就写在这一行。若想知道评分器是否真的读出了中间的错误，还得把它指认的位置与人标出的首错逐份对照。<sup><a href="#ref-3" aria-label="参考文献 3">[3]</a></sup></p>

## 评分器开始教模型做题，会发生什么

<p>强化学习会改变下一轮解答的写法。Math-Shepherd 用同一个已微调的 Mistral-7B 作起点，一组只在结尾接收结果评分，一组在每个步骤结尾接收过程评分。训练后让模型每题直接作答，MATH 全测试集的答对率分别为 31.3% 和 33.0%。这 1.7 个百分点是解题模型自身的收益，一道题只交一份答案也能测到。<sup><a href="#ref-2" aria-label="参考文献 2">[2]</a></sup></p>
<p>Tiwari 等人则在 AIME 2024 题上用两种评分器分别训练同一个小模型。用 Skywork 评分时，平均奖励从约 0.1 升到 0.8 以上，答对率最高也只有约 3% 至 4%。换用 Qwen 评分器，前一百个训练步内奖励一度达到 1.0，答对率却降到零。第二条曲线背后是一种固定的答题方式。模型写一句“我们来一步一步解这道题”就停笔，整份回答连一条可供判错的数学推导都没有。<sup><a href="#ref-5" aria-label="参考文献 5">[5]</a></sup></p>
<p>Skywork 的高分还有一种可以单独检验的解释。作者在留出的 AIME 2025 题上改写训练后生成的解答，保留数学内容，平均奖励就从 0.641 降到 0.472。相对训练前的 0.246，总增益有约 43% 会随措辞改变而消失。挑答案时，固定候选上的命中率就能衡量排序的收益。给解答纠错时，还要核对它标出的位置。轮到评分器教模型解题，每一次更新都会改变接下来送到它面前的解答。这时只有把奖励曲线同独立判分的答对率并排看，才能分清模型学会了做题，还是学会了得分。<sup><a href="#ref-5" aria-label="参考文献 5">[5]</a></sup></p>

<details class="supplement">
  <summary>口径与范围（按需展开）</summary>
  <p>Lightman 的主设置把中性标签并入正类，用各步概率的乘积排序。过程监督和结果监督在大规模实验中各用各的训练集。表 1 的 26.4 万是通义实验报告的训练样本数，八十万是原始训练集的步骤标签数。ProcessBench 共 3,400 份测试解答，各子集先分别算“有错时找准首错”和“全对时判为全对”的准确率，再取调和平均得到 F1。AIME 实验用 GRPO 更新 Qwen2.5-1.5B-Instruct。文中的 43% 是 Skywork 改写实验中的奖励差额比 (0.641 − 0.472) / (0.641 − 0.246)。<sup><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup><sup><a href="#ref-3" aria-label="参考文献 3">[3]</a></sup><sup><a href="#ref-4" aria-label="参考文献 4">[4]</a></sup><sup><a href="#ref-5" aria-label="参考文献 5">[5]</a></sup></p>
</details>

## 来源与阅读范围

<ol class="reference-list">
  <li id="ref-1">
    Lightman 等，<cite>Let’s Verify Step by Step</cite>。§2.1、§2.4、§2.6 说明生成、标注与聚合。§3 图 3 比较排序器。附录 B、C 给出标注量与留出题，附录 I.3 第 9 题是交换球例。
    <a href="https://arxiv.org/html/2305.20050v1#S3.F3" target="_blank" rel="noopener">排序对照</a> ·
    <a href="https://arxiv.org/html/2305.20050v1#A6.T4" target="_blank" rel="noopener">附录 F.2 表 4 的 78.2%</a> ·
    <a href="https://arxiv.org/html/2305.20050v1#A9.SS3" target="_blank" rel="noopener">漏判实例</a>
    <a class="reference-backlink" href="#cite-1" aria-label="返回正文引用">↩</a>
  </li>
  <li id="ref-2">
    Wang 等，<cite>Math-Shepherd: Verify and Reinforce LLMs Step-by-step without Human Annotations</cite>。§3.3.2 式 3、4 定义自动标签。§3.5、§4.1 表 2 报告逐步奖励和结果奖励的 PPO 对照，测试采用贪心解码。
    <a href="https://arxiv.org/html/2312.08935#S3.E3" target="_blank" rel="noopener">标签定义</a> ·
    <a href="https://arxiv.org/html/2312.08935#S4.T2" target="_blank" rel="noopener">训练对照</a>
    <a class="reference-backlink" href="#cite-2" aria-label="返回正文引用">↩</a>
  </li>
  <li id="ref-3">
    Zhang 等，<cite>The Lessons of Developing Process Reward Models in Mathematical Reasoning</cite>。§2.1–2.2 给出续写和八选一设置。§3.1.2 表 3、4 对照三种标注，§3.1.3 核对错误位置，§3.2.3 图 8 统计末步最低分。
    <a href="https://arxiv.org/html/2501.07301v2#S3.T3" target="_blank" rel="noopener">表 3</a> ·
    <a href="https://arxiv.org/html/2501.07301v2#S3.T4" target="_blank" rel="noopener">表 4</a> ·
    <a href="https://arxiv.org/html/2501.07301v2#S3.SS1.SSS3" target="_blank" rel="noopener">一致性筛选</a> ·
    <a href="https://arxiv.org/html/2501.07301v2#S3.F9.fig1" target="_blank" rel="noopener">最低分位置</a>
    <a class="reference-backlink" href="#cite-3" aria-label="返回正文引用">↩</a>
  </li>
  <li id="ref-4">
    Zheng 等，<cite>ProcessBench: Identifying Process Errors in Mathematical Reasoning</cite>。§3.1 定义首错，§3.3 表 2 按答案对错统计过程错误，§4.1 定义 F1。
    <a href="https://arxiv.org/html/2412.06559v4#S3.T2" target="_blank" rel="noopener">样本口径</a> ·
    <a href="https://arxiv.org/html/2412.06559v4#S4.SS1" target="_blank" rel="noopener">指标</a>
    <a class="reference-backlink" href="#cite-4" aria-label="返回正文引用">↩</a>
  </li>
  <li id="ref-5">
    Tiwari 等，<cite>Reward Under Attack: Analyzing the Robustness and Hackability of Process Reward Models</cite>。§6.1–6.2 图 7 分列 Skywork 与 Qwen 的奖励和答对率。§6.3 图 8 是改写干预，§6.4 记录停止解题的输出。
    <a href="https://arxiv.org/html/2603.06621v1#S6.F7" target="_blank" rel="noopener">训练曲线</a> ·
    <a href="https://arxiv.org/html/2603.06621v1#S6.F8" target="_blank" rel="noopener">改写干预</a> ·
    <a href="https://arxiv.org/html/2603.06621v1#S6.SS4" target="_blank" rel="noopener">输出退化</a>
    <a class="reference-backlink" href="#cite-5" aria-label="返回正文引用">↩</a>
  </li>
</ol>

</div>
