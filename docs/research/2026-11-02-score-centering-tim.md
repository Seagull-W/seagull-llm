---
title: "奖励都给满分，策略为什么还会变？Score Centering 消除逐前缀的梯度漂移"
description: "在语言模型的强化学习中，一个引擎生成答案，另一个引擎计算梯度。只要两者给下一个词元的概率不同，即使每个答案都得满分，普通策略梯度也可能让模型越来越偏爱采样器常选的词。"
tags: ["每日调研", "强化学习", "策略梯度", "训练推理不一致", "模型量化"]
date: "2026-11-02"
---

# 奖励都给满分，策略为什么还会变？Score Centering 消除逐前缀的梯度漂移

<div class="research-article">

<p class="lead">在语言模型的强化学习中，一个引擎生成答案，另一个引擎计算梯度。只要两者给下一个词元的概率不同，即使每个答案都得满分，普通策略梯度也可能让模型越来越偏爱采样器常选的词。Score Centering（SC）在每个生成前缀上减去这股漂移，使更新只保留奖励与词元选择之间的关联。重量化实验显示，单做这项修正就能稳住训练，而采样器长期使用旧权重时，再加重要性加权效果更好。<sup id="cite-1"><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup><sup id="cite-4"><a href="#ref-4" aria-label="参考文献 4">[4]</a></sup><sup id="cite-5"><a href="#ref-5" aria-label="参考文献 5">[5]</a></sup></p>

## 满分也能产生一个更新方向

<p>
  把生成停在同一个前缀，例如一道算术题刚写到等号。采样器按分布 <i>q</i> 选下一个词元 <i>v</i>，训练器用自己的分布 <i>p</i> 计算 <i>s</i><sub><i>v</i></sub> = ∇<sub>θ</sub> log <i>p</i><sub><i>v</i></sub>。这个向量叫作 score，表示怎样改变参数能提高该词元的概率。一次策略更新用最终答案的奖励 <i>R</i> 乘这个向量，所以同一步上的词元也会受到后续解题结果的影响。<sup id="cite-1-2"><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup>
</p>
<p>
  设想等号后只有甲、乙两个选项。训练器给两者各一半概率，用一个参数控制甲相对乙的对数几率，此时两个 score 分别是 +0.5 和 −0.5。如果采样器也各选一半，所有答案都得 +1 时，两个方向平均起来刚好抵消。若采样器有九成机会选甲，平均更新便成了 0.9 × 0.5 + 0.1 × (−0.5) = 0.4。题目的评分规则一字未改，训练器却会提高甲的概率。这是按论文公式构造的算例。<sup id="cite-1-3"><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup>
</p>
<p>论文把固定前缀处的期望更新写成两项：</p>
<div class="equation">
  <math xmlns="http://www.w3.org/1998/Math/MathML" display="block">
    <mrow>
      <msub><mi>𝔼</mi><mi>q</mi></msub>
      <mo>[</mo><mi>R</mi><mi>s</mi><mo>]</mo>
      <mo>=</mo>
      <msub><mi>𝔼</mi><mi>q</mi></msub>
      <mo>[</mo><mi>R</mi><mo>]</mo>
      <mspace width="0.18em" />
      <mover><mi>s</mi><mo>¯</mo></mover>
      <mo>+</mo>
      <msub><mi>Cov</mi><mi>q</mi></msub>
      <mo>(</mo><mi>R</mi><mo>,</mo><mi>s</mi><mo>)</mo>
      <mo>.</mo>
    </mrow>
  </math>
  <p>其中 <math xmlns="http://www.w3.org/1998/Math/MathML"><mover><mi>s</mi><mo>¯</mo></mover></math> = 𝔼<sub><i>q</i></sub>[<i>s</i>] 为采样器分布 <i>q</i> 下的平均 score。<sup id="cite-1-4"><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup></p>
</div>
<p>
  试着把这个前缀后的奖励在样本间打乱。第一项只用到平均奖励，完全保留下来。第二项取决于哪个选择更常伴随高奖励，打乱配对就丢失了这层信息。第一项就是漂移。固定采样器求导时，<math xmlns="http://www.w3.org/1998/Math/MathML"><mover><mi>s</mi><mo>¯</mo></mover></math> 恰好等于拟合采样器分布的交叉熵负梯度。平均奖励为正，训练器就被拉向采样器，平均奖励为负则方向相反。在线训练还会把更新过的权重同步回采样器，下一轮量化后的副本可能再次带来同方向的偏差。<sup id="cite-1-5"><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup>
</p>
<p>
  把采样器固定住，奖励的效果就变了。作者给 Qwen3-1.7B 的采样器施加权重扰动，用同一个 Countdown 任务比较在线与离线训练。在三种奖励设定中，答对给一分、答错给零分，是离线训练唯一稳定的一种，换成在线训练却最不稳定。固定教师时，训练器可以逐渐拟合它。教师随训练器移动时，上一轮学进去的偏差还会影响下一轮出什么答案。这是作者对上述反转的解释。<sup id="cite-1-6"><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup>
</p>

## 让每个前缀自己的 score 均值归零

<p>
  一种直观做法是让同一题生成多个回答，再从每个回答的奖励中减去组均值。这样得到的优势值全组之和为零。可一旦回答开始分叉，已经列对方程的前缀更可能得到高于组均值的奖励，列错方程的前缀则相反。两处的期望优势可以一正一负，各自乘上的平均 score 却是不同向量。题目层面的加减法因此仍会留下前缀层面的漂移。<sup id="cite-1-7"><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup>
</p>
<p>
  SC 在每个前缀上做另一笔计算。它按采样器赋给各个候选词元的概率算出平均 score，再从实际抽中词元的 score 中减去这个平均值，最后乘奖励或优势。上例中，甲、乙修正后的 score 分别是 0.1 和 −0.9，按九比一抽取恰好均值为零。单个样本仍然更新，但恒定奖励带来的期望更新消失了。如果两个选项的奖励有差异，减去同一个向量会保留原来的协方差。<sup id="cite-1-8"><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup>
</p>

<figure class="figure" id="fig-sc-drift">
  

  
  <picture>
<source media="(max-width: 720px)" srcset="/research/score-centering-tim/fig-sc-drift-narrow.svg">
<img loading="lazy" decoding="async" src="/research/score-centering-tim/fig-sc-drift-wide.svg" alt="同一前缀、同样满分，修正前后更新方向对比示意图（宽屏版）">
</picture>
<figcaption>
    <strong>图 1｜同一前缀、同样满分，为什么修正前后方向不同。</strong>橙色实线汇合原始 score，蓝色虚线汇合 SC 修正后的 score；图据第一节教学算例。<sup id="cite-1-9"><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup>
  </figcaption>
</figure>

<p>
  实际计算这笔均值时，只记录抽中词元的概率是不够的，因为其他候选也有贡献。作者保留采样器概率最高的 128 个词元及其原始概率，把剩余概率质量按训练器对尾部词元给出的相对比例分配。在最重的 30B 量化配置中，这 128 个词元平均覆盖 99.45% 的概率质量。用 32 个或 128 个词元得到的训练曲线都与全词表版本相近。精确抵消来自对真实 <i>q</i> 求期望，精简记录能否接近它，还取决于尾部估得多准。<sup id="cite-2"><a href="#ref-2" aria-label="参考文献 2">[2]</a></sup>
</p>

## 重度量化拉开了两种修正的差距

<p>
  作者固定训练器精度和数学题来源，所有方法都用组内中心化的奖励做策略梯度更新，只改变采样精度和修正规则。对照方法 TIS（截断重要性采样）用训练器与采样器给抽中词元的概率比加权，并限制权重上界。这里 SC 单独使用，因此可以观察只做加性修正时，在何种量化强度下仍能稳定训练。<sup id="cite-3"><a href="#ref-3" aria-label="参考文献 3">[3]</a></sup><sup id="cite-4-2"><a href="#ref-4" aria-label="参考文献 4">[4]</a></sup>
</p>

<div class="table-scroll" role="region" aria-labelledby="tbl-1" tabindex="0">
  <table>
    <caption id="tbl-1">
      表 1｜Qwen3-30B-A3B-Base 在 INTELLECT-2 数学子集上的训练准确率
      <span>训练器均为 BF16，表中两列百分比取自训练时采样的回答。<sup id="cite-4-3"><a href="#ref-4" aria-label="参考文献 4">[4]</a></sup><sup id="cite-6"><a href="#ref-6" aria-label="参考文献 6">[6]</a></sup></span>
    </caption>
    <thead>
      <tr>
        <th scope="col">采样器权重与激活</th>
        <th scope="col">采样器 KV 缓存</th>
        <th scope="col" class="num">SC</th>
        <th scope="col" class="num">TIS</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <th scope="row">FP8</th>
        <td>FP4</td>
        <td class="num">52%</td>
        <td class="num">51%</td>
      </tr>
      <tr>
        <th scope="row">INT8</th>
        <td>INT4</td>
        <td class="num">30%</td>
        <td class="num">12%</td>
      </tr>
    </tbody>
  </table>
</div>
<p class="table-hint">左右滑动可查看完整表格</p>

<p>
  先看较轻的参照条件。权重、激活和缓存都用 FP8 时，未经修正的策略梯度在 800 步内也能稳定训练，准确率达到 58%。只把缓存降到 FP4，普通策略梯度就在 200 步内崩溃，表中两种修正却几乎持平。在最重的一档，SC 比 TIS 高出 18 个百分点，其余方法最终均低于 5%。这里要分别看曲线是否崩溃、还能答对多少题。SC 在两档配置中都能维持训练，自身的准确率仍从过半降到了三成。<sup id="cite-4-4"><a href="#ref-4" aria-label="参考文献 4">[4]</a></sup>
</p>

## 采样器落后时，旧轨迹仍决定学到什么

<p>
  即使精确减掉漂移，剩下的也是 Cov<sub><i>q</i></sub>(<i>R</i>, <i>s</i>)。如果旧策略很少走到某条解题路线，训练器就很少看到这条路线上的选择和奖励。把每个已访问前缀的 score 均值归零，只改变了拿这些样本怎么算更新。哪些前缀出现、从那里往后会写出什么，仍取决于生成数据的旧策略。<sup id="cite-1-10"><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup><sup id="cite-5-2"><a href="#ref-5" aria-label="参考文献 5">[5]</a></sup>
</p>
<p>
  在 Qwen3-0.6B 的 Countdown 实验中，作者让采样器每隔 64 个训练步才同步一次权重。此时把 SC 与 TIS 或 MIS（将区间外权重置零的重要性采样）组合，训练准确率都高于单用 SC。两种方法的权重都针对当前位置的词元，能部分纠正旧策略对不同选择的偏好。要精确恢复训练器对整条回答的期望，还需要考虑抵达该前缀以及完成后续回答的概率，用整条轨迹的概率比加权。<sup id="cite-3-2"><a href="#ref-3" aria-label="参考文献 3">[3]</a></sup><sup id="cite-5-3"><a href="#ref-5" aria-label="参考文献 5">[5]</a></sup>
</p>
<p>
  为什么加过权还要减均值？仍以前面的乙为例。训练器给它一半概率，采样器只给一成，按精确概率比就该给它五倍权重，使它对平均更新的贡献从 −0.05 变成 −0.25，恰好抵消甲加权后的 +0.25。论文里的 TIS 把权重上限设为 2，乙的贡献便只到 −0.1，奖励全给满分也会留下正向更新。因此组合时要先加权，再减去加权 score 在采样器下的均值，即用 <i>ws</i> − 𝔼<sub><i>q</i></sub>[<i>ws</i>] 乘奖励。这样既能调整罕见选择的分量，也能消掉截断造成的平均偏移。<sup id="cite-3-3"><a href="#ref-3" aria-label="参考文献 3">[3]</a></sup><sup id="cite-5-4"><a href="#ref-5" aria-label="参考文献 5">[5]</a></sup>
</p>

<details class="supplement">
  <summary>实验口径与推论范围</summary>
  <p>
    原论文图 1、4、5 的训练准确率都按训练步做居中移动平均，图 2 则用留出题目评估。30B 实验先给各方法各跑一个随机种子，再给表现较好的方法增加种子。表中从上到下，SC 分别用了 5、4 个种子，TIS 用了 4、3 个，52% 与 51% 的差距不足以判定方法优劣。作者有意放大失配，以便在短序列、数百步内观察分离。较轻失配要累积多久才显现，仍需长程训练验证。<sup id="cite-4-5"><a href="#ref-4" aria-label="参考文献 4">[4]</a></sup><sup id="cite-6-2"><a href="#ref-6" aria-label="参考文献 6">[6]</a></sup>
  </p>
</details>

## 来源与阅读范围

<ol class="reference-list">
  <li id="ref-1">
    Martin Marek、Max Ryabinin，<cite>Score Centering Stabilizes Off-policy Reinforcement Learning</cite>，arXiv:2609.20807v1。
    <a href="https://arxiv.org/html/2609.20807v1#S3" target="_blank" rel="noopener">第 3 节及图 2，在线与离线奖励对照</a> ·
    <a href="https://arxiv.org/html/2609.20807v1#S4" target="_blank" rel="noopener">第 4 节，式（3）至（5），蒸馏方向与组内中心化</a>
    <a class="reference-backlink" href="#cite-1" aria-label="返回正文引用">↩</a>
  </li>
  <li id="ref-2">
    同文，
    <a href="https://arxiv.org/html/2609.20807v1#A1.SS1" target="_blank" rel="noopener">附录 A.1，式（9）至（10），头部记录与尾部估计</a> ·
    <a href="https://arxiv.org/html/2609.20807v1#A1.SS4" target="_blank" rel="noopener">附录 A.4，图 5 与概率质量统计</a>
    <a class="reference-backlink" href="#cite-2" aria-label="返回正文引用">↩</a>
  </li>
  <li id="ref-3">
    同文，
    <a href="https://arxiv.org/html/2609.20807v1#S2.SS2" target="_blank" rel="noopener">第 2.2 节，式（2），轨迹概率比</a> ·
    <a href="https://arxiv.org/html/2609.20807v1#S5.SS1" target="_blank" rel="noopener">第 5.1 节，共同训练目标</a> ·
    <a href="https://arxiv.org/html/2609.20807v1#A2.T1" target="_blank" rel="noopener">附录 B.2，表 1，截断与掩码规则</a>
    <a class="reference-backlink" href="#cite-3" aria-label="返回正文引用">↩</a>
  </li>
  <li id="ref-4">
    同文，
    <a href="https://arxiv.org/html/2609.20807v1#S5.SS4" target="_blank" rel="noopener">第 5.4 节，30B 三档量化的数值</a> ·
    <a href="https://arxiv.org/html/2609.20807v1#S0.F1" target="_blank" rel="noopener">图 1，训练准确率曲线</a>
    <a class="reference-backlink" href="#cite-4" aria-label="返回正文引用">↩</a>
  </li>
  <li id="ref-5">
    同文，
    <a href="https://arxiv.org/html/2609.20807v1#S5.SS3" target="_blank" rel="noopener">第 5.3 节及图 4，量化与延迟同步</a> ·
    <a href="https://arxiv.org/html/2609.20807v1#A1.SS2" target="_blank" rel="noopener">附录 A.2，式（11），加权与中心化的顺序</a>
    <a class="reference-backlink" href="#cite-5" aria-label="返回正文引用">↩</a>
  </li>
  <li id="ref-6">
    同文，
    <a href="https://arxiv.org/html/2609.20807v1#A2.SS3" target="_blank" rel="noopener">附录 B.3，指标、平滑和种子数</a> ·
    <a href="https://arxiv.org/html/2609.20807v1#S6" target="_blank" rel="noopener">第 6 节，短程重失配实验的外推范围</a>
    <a class="reference-backlink" href="#cite-6" aria-label="返回正文引用">↩</a>
  </li>
</ol>

</div>
