---
title: "语言模型蒸馏：学生换了一条解题路径，教师还能教什么？"
description: "教师示范一次解题，学生就能沿着这份答案学习每一步该写什么。学生独立作答时，却可能从另一个同样合理的步骤开始。教师若能读到学生自己写的开头，就能在这条路径上给出下一步的反馈。"
tags: ["每日调研", "知识蒸馏", "大语言模型", "模型压缩"]
date: "2026-10-23"
---

# 语言模型蒸馏：学生换了一条解题路径，教师还能教什么？

<div class="research-article">

<p class="lead">教师示范一次解题，学生就能沿着这份答案学习每一步该写什么。学生独立作答时，却可能从另一个同样合理的步骤开始。教师若能读到学生自己写的开头，就能在这条路径上给出下一步的反馈。学生学到什么，取决于教师能提供哪些信号、在哪些开头上给信号，以及训练时优先纠正哪种差距。<sup id="cite-1"><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup><sup id="cite-4"><a href="#ref-4" aria-label="参考文献 4">[4]</a></sup></p>

## 一份教师答案里，学生能学到什么

<p>
  Kim 和 Rush 做机器翻译蒸馏时，让教师用束搜索保留几个有希望的译法，最后选出一整句作为范例。学生读原句和范例开头，逐词预测范例的下一个词。这样做只需保存教师给出的译文，同一批数据可以反复使用。代价是，一个近义词和一个不通顺的词都没有入选，学生从这条记录无从知道教师对两者的评价相差多远。若能读到教师在这个位置给各候选词的概率，这层区别就能进入训练。<sup id="cite-1-2"><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup>
</p>
<p>
  即使教师只交出文本，也可以改变学生学什么。在 Hsieh 等人的推断实验中，学生要根据一段话判断另一句话成立、与之矛盾，还是证据不足。教师写出理由后，研究者用两种提示训练同一个学生。要求“给标签”时预测判断结果，要求“给理由”时解释判断依据。部署时只用第一种提示即可。把理由和答案串成一段也能训练，但会让标签预测依赖前面已经生成的理由。下表中，这两种利用理由的方式在 ANLI 上拉开了约六个百分点。<sup id="cite-2"><a href="#ref-2" aria-label="参考文献 2">[2]</a></sup>
</p>

<div class="table-scroll" role="region" aria-labelledby="tbl-1" tabindex="0">
  <table>
    <caption id="tbl-1">
      表 1｜同用 2.2 亿参数的 T5 和各任务的完整训练集，比较测试准确率
      <span>来源：Distilling Step-by-Step! 表 2<sup id="cite-2-2"><a href="#ref-2" aria-label="参考文献 2">[2]</a></sup></span>
    </caption>
    <thead>
      <tr>
        <th scope="col">训练时要求学生输出</th>
        <th scope="col" class="num">e-SNLI（%）</th>
        <th scope="col" class="num">ANLI 第一轮（%）</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <th scope="row">只给标签</th>
        <td class="num">88.38</td>
        <td class="num">43.58</td>
      </tr>
      <tr>
        <th scope="row">先给理由，再接标签</th>
        <td class="num">88.88</td>
        <td class="num">43.50</td>
      </tr>
      <tr>
        <th scope="row">用两种提示分别给标签、给理由</th>
        <td class="num">89.51</td>
        <td class="num">49.58</td>
      </tr>
    </tbody>
  </table>
</div>
<p class="table-hint">左右滑动查看完整表格</p>

<p>
  DeepSeek-R1 把教师文本用于更长的解题过程。研究者用经过强化学习的模型为每道题生成多份解答，筛出答对的轨迹，得到约 60 万条推理样本，再配入约 20 万条写作、问答等非推理样本。学生只做监督微调。这道筛选改变了学习目标。教师经常尝试但最终算错的路径会被剔除，学生只在入选的解法上得到直接示范。即便最终答案正确，轨迹里的每一步也没有因此获得独立的正确性标签。<sup id="cite-3"><a href="#ref-3" aria-label="参考文献 3">[3]</a></sup>
</p>
<p>
  检验这种监督能教会什么，可以让学生从题目开始独立生成答案。在 Qwen 32B 基座的对照中，这批示范训练出的学生在 AIME 2024 上的单次作答正确率估计为 72.6%，直接做强化学习的学生为 47.0%。这个对照检验的是整套示范的效果。要把增益具体归给某种理由写法，还需要像表 1 那样单独改变理由的使用方式。<sup id="cite-3-2"><a href="#ref-3" aria-label="参考文献 3">[3]</a></sup><sup id="cite-2-3"><a href="#ref-2" aria-label="参考文献 2">[2]</a></sup>
</p>

## 换一个开头，下一步该学什么也会变

<p>
  用一道折扣题看这种变化。一件八十元的商品打七五折，教师从“直接算应付金额”开始，下一步乘以四分之三。学生却写了“先算省下的钱”，此时该乘的是四分之一。两条路都能得到六十元。如果训练集只收了第一条，学生即使把它的每一步都学对了，也没有在第二个开头上练过怎样接下去。这种训练与使用的差异，在学生算错第一步时同样存在。<sup id="cite-4-2"><a href="#ref-4" aria-label="参考文献 4">[4]</a></sup>
</p>

<figure class="figure" id="fig-prefix-feedback">
  

  

  <picture>
<source media="(max-width: 720px)" srcset="/research/llm-distillation/fig-prefix-feedback-narrow.svg">
<img loading="lazy" decoding="async" src="/research/llm-distillation/fig-prefix-feedback-wide.svg" alt="同一道折扣题，固定示范与在策略蒸馏在前缀和反馈上的差异">
</picture>
<figcaption>
    <strong>图 1｜同一道折扣题，两种前缀会收到什么反馈。</strong>两条路都能算出 60 元，教师要看的前缀决定此处该教哪一步。<sup id="cite-1-3"><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup><sup id="cite-4-7"><a href="#ref-4" aria-label="参考文献 4">[4]</a></sup>
  </figcaption>
</figure>

<p>
  GKD 给学生一次自己起笔的机会。学生按当前参数生成完整回答，教师再读同一问题和学生写出的每段前缀，给出各位置下一词的概率。学生据此调整自己的预测，下次采样时又会遇到新的前缀。这样的训练称为在策略蒸馏（on-policy distillation）。固定示范也可以混入训练，两者的比例决定教师有多少次机会指导学生自己选的走法。<sup id="cite-4-3"><a href="#ref-4" aria-label="参考文献 4">[4]</a></sup>
</p>
<p>
  GKD 的英译德实验把这个选择单独拿出来比较。作者从同一份已监督微调的学生参数出发，分别只用固定数据、混入学生译文，或全部使用学生译文，再对各组尝试不同的分布匹配准则。在两种大小的学生上，后两组的验证集 BLEU 都优于只用固定数据的相应设置。教师和任务相同，仅改变教师在哪些前缀上给反馈，就足以影响学生独立翻译的表现。<sup id="cite-4-4"><a href="#ref-4" aria-label="参考文献 4">[4]</a></sup>
</p>

## 比较师生概率，要看差距由谁加权

<p>
  给定同一道题和同一段开头，记教师的下一词分布为 <i>p</i>，学生的为 <i>q</i>。正向 KL 散度 <i>D</i><sub>KL</sub>(<i>p</i> ∥ <i>q</i>) 按教师概率加权。如果教师认为两种续写都常见，学生几乎忽略其中一种，就会付出较大损失。反向 KL 散度 <i>D</i><sub>KL</sub>(<i>q</i> ∥ <i>p</i>) 按学生概率加权。如果学生经常写出教师认为极不合适的续词，这个偏差就会突出。两者都在师生分布完全一致时取零。学生容量有限时，前一种目标鼓励覆盖多种可行写法，后一种允许把概率集中到教师更偏好的写法上。<sup id="cite-4-5"><a href="#ref-4" aria-label="参考文献 4">[4]</a></sup><sup id="cite-5"><a href="#ref-5" aria-label="参考文献 5">[5]</a></sup>
</p>
<p>
  写出前缀的模型决定在哪里学习，散度的方向决定到了那里优先纠正什么。GKD 可以让学生写前缀，再用正向 KL 学习教师给出的多种续写。在它的算术题实验中，这个组合就有良好表现。更新时，算法把已经采样的前缀视为给定条件，只对该处的分布差异求梯度。<sup id="cite-4-6"><a href="#ref-4" aria-label="参考文献 4">[4]</a></sup>
</p>
<p>
  MiniLLM 则把反向 KL 用于整段回答。开头选了哪个词，会改变后续的上下文，所以当前选择得到的反馈还包括后续各步的师生对数概率比。这样的目标把一次选择与后果联系起来，也带来了实际困难。作者观察到，较小的学生模型有时会靠重复短语获得教师高分，于是在采样时混入教师分布来缓解重复。教师概率能指导学生组织语言，核验解题是否正确仍需看答案本身。<sup id="cite-5-2"><a href="#ref-5" aria-label="参考文献 5">[5]</a></sup>
</p>

## 从同一学生出发，蒸馏省了哪一段算力

<p>
  Qwen3 把两种监督接在了一起。第一阶段让小模型学习教师在思考和非思考模式下写出的示范。第二阶段改由学生在两种模式下作答，教师在学生实际写出的前缀上给出概率信号。为了衡量第二阶段的价值，作者保留了同一个完成第一阶段的 8B 学生，把它分成两支，只用数学和代码问题继续训练。<sup id="cite-6"><a href="#ref-6" aria-label="参考文献 6">[6]</a></sup>
</p>

<div class="table-scroll" role="region" aria-labelledby="tbl-2" tabindex="0">
  <table>
    <caption id="tbl-2">
      表 2｜Qwen3-8B 从同一离线蒸馏检查点续训，AIME 2024 每题采样 64 次
      <span>来源：Qwen3 Technical Report 表 21<sup id="cite-6-2"><a href="#ref-6" aria-label="参考文献 6">[6]</a></sup></span>
    </caption>
    <thead>
      <tr>
        <th scope="col">训练阶段</th>
        <th scope="col" class="num">作答平均正确率（%）</th>
        <th scope="col" class="num">至少答对一次的题目（%）</th>
        <th scope="col" class="num">续训 GPU 小时</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <th scope="row">共同起点</th>
        <td class="num">55.0</td>
        <td class="num">90.0</td>
        <td class="num">—</td>
      </tr>
      <tr>
        <th scope="row">续做强化学习</th>
        <td class="num">67.6</td>
        <td class="num">90.0</td>
        <td class="num">17,920</td>
      </tr>
      <tr>
        <th scope="row">续做在策略蒸馏</th>
        <td class="num">74.4</td>
        <td class="num">93.3</td>
        <td class="num">1,800</td>
      </tr>
    </tbody>
  </table>
</div>
<p class="table-hint">左右滑动查看完整表格</p>

<p>
  强化学习让学生更经常答对，至少答对过一次的题目比例和起点相同。在策略蒸馏既提高了平均正确率，也把至少答对一次的题目从三十题中的二十七题增至二十八题。与直接续做强化学习相比，这次蒸馏用约十分之一的续训 GPU 小时，平均正确率高出 6.8 个百分点。这个成本判断从已有教师和离线学生开始计算。如果要为一个学生从头训练教师，表中还缺少那笔开支。<sup id="cite-6-3"><a href="#ref-6" aria-label="参考文献 6">[6]</a></sup>
</p>

<details class="supplement">
  <summary>评测指标与成本口径（按需展开）</summary>
  <p>
    DeepSeek-R1 表 6 的 pass@1 用多次采样的平均正确率估计，同表的 cons@64 按多数答案投票。Qwen3 表 21 括号中的 pass@64 统计每题 64 次作答中至少一次正确的题目比例。表 2 的破折号表示共同起点的训练成本未在原表列出。Qwen3 报告说明在学生前缀上最小化 KL，未指明散度方向。<sup id="cite-3-3"><a href="#ref-3" aria-label="参考文献 3">[3]</a></sup><sup id="cite-6-4"><a href="#ref-6" aria-label="参考文献 6">[6]</a></sup>
  </p>
</details>

## 来源与阅读范围

<ol class="reference-list">
  <li id="ref-1">
    Kim、Rush，<cite>Sequence-Level Knowledge Distillation</cite>，§3.1–3.2、图 1，逐词软目标与束搜索生成序列的对照。
    <a href="https://arxiv.org/html/1606.07947v1#S3" target="_blank" rel="noopener">论文正文</a>
    <a class="reference-backlink" href="#cite-1" aria-label="返回正文引用 1">↩</a>
  </li>
  <li id="ref-2">
    Hsieh 等，<cite>Distilling Step-by-Step!</cite>，§3.2 式 3–4 的双任务目标，§4.4 表 2 的同规模、全量训练集消融，附录 A.2 的 ANLI 数据划分。
    <a href="https://arxiv.org/html/2305.02301v2#S3.SS2" target="_blank" rel="noopener">训练目标</a> ·
    <a href="https://arxiv.org/html/2305.02301v2#S4.T2" target="_blank" rel="noopener">表 2</a>
    <a class="reference-backlink" href="#cite-2" aria-label="返回正文引用 2">↩</a>
  </li>
  <li id="ref-3">
    DeepSeek-AI，<cite>DeepSeek-R1</cite>，§2.3.3、§2.4 的样本来源与学生训练，§3 的评测定义，§4.1 表 6 的 32B 对照。
    <a href="https://arxiv.org/html/2501.12948v1#S2.SS3.SSS3" target="_blank" rel="noopener">数据构造</a> ·
    <a href="https://arxiv.org/html/2501.12948v1#S4.T6" target="_blank" rel="noopener">表 6</a>
    <a class="reference-backlink" href="#cite-3" aria-label="返回正文引用 3">↩</a>
  </li>
  <li id="ref-4">
    Agarwal 等，<cite>On-policy Distillation of Language Models</cite>，§3.1 式 4、算法 1 的采样与梯度，§4.2 图 6、§4.3 图 7–9 的翻译与算术消融。
    <a href="https://arxiv.org/html/2306.13649v3#S3.SS1" target="_blank" rel="noopener">方法</a> ·
    <a href="https://arxiv.org/html/2306.13649v3#S4.SS2" target="_blank" rel="noopener">翻译实验</a> ·
    <a href="https://arxiv.org/html/2306.13649v3#S4.SS3" target="_blank" rel="noopener">算术实验</a>
    <a class="reference-backlink" href="#cite-4" aria-label="返回正文引用 4">↩</a>
  </li>
  <li id="ref-5">
    Gu 等，<cite>MiniLLM</cite>，§2.1 式 1 定义序列反向 KL，§2.2 式 2、4 给出累计回报与师生混合采样。
    <a href="https://arxiv.org/html/2306.08543v4#S2.SS1" target="_blank" rel="noopener">目标与推导</a>
    <a class="reference-backlink" href="#cite-5" aria-label="返回正文引用 5">↩</a>
  </li>
  <li id="ref-6">
    Qwen Team，<cite>Qwen3 Technical Report</cite>，§4.5 的两阶段蒸馏，§4.6 的 AIME 计分，§4.7 表 21 的独立续训分支与算力。
    <a href="https://arxiv.org/html/2505.09388v1#S4.SS5" target="_blank" rel="noopener">训练流程</a> ·
    <a href="https://arxiv.org/html/2505.09388v1#S4.SS6" target="_blank" rel="noopener">评测定义</a> ·
    <a href="https://arxiv.org/html/2505.09388v1#S4.T21" target="_blank" rel="noopener">表 21</a>
    <a class="reference-backlink" href="#cite-6" aria-label="返回正文引用 6">↩</a>
  </li>
</ol>

</div>
