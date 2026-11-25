---
title: "一次任务只给一个结果，多轮智能体该奖惩哪一步？"
description: "一次成功可能夹着几步弯路，一次失败也可能始于正确的动作。DeltaTTG 估计每一步之后还剩多少工作，ProAS 用成功路径画出哪些状态算有进展。"
tags: ["每日调研", "RLHF", "后训练", "Agent"]
date: "2026-10-14"
research_run: "2026-10-14-llm-post-training-agentic-rl"
---

# 一次任务只给一个结果，多轮智能体该奖惩哪一步？

<div class="research-article">

<p class="lead">一次成功可能夹着几步弯路，一次失败也可能始于正确的动作。DeltaTTG 估计每一步之后还剩多少工作，ProAS 用成功路径画出哪些状态算有进展。两种方法都保留任务的最终奖励，改变的是训练时每个动作从这个结果中分到多少鼓励或惩罚。<sup id="cite-1"><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup><sup id="cite-2"><a href="#ref-2" aria-label="参考文献 2">[2]</a></sup></p>

## 同一张书桌前，两段历史带来不同的结果

<p>在文本家务环境 ALFWorld 里，智能体要把钥匙扣放到书桌上。ProAS 作者让它走到边桌、拿起钥匙扣，再走到书桌前。从这里继续尝试 50 次，有 41 次完成任务。作者又做了一组实验，只在模型看得见的历史开头插入四步绕路，包括走向柜子、打开柜门。这些动作没有在环境里执行。智能体仍站在同一张书桌前，手里拿着同一个钥匙扣，剩余步数相同，50 次续跑中有 29 次成功。<sup id="cite-2-2"><a href="#ref-2" aria-label="参考文献 2">[2]</a></sup></p>
<p>绕路既会干扰下一轮决策，也可能随着补救成功被记入一条高分轨迹。用分组相对策略优化（GRPO）训练时，同一任务的多次尝试相互比较，得分高于组均值的轨迹获得正优势，低于均值的获得负优势。原始做法把这个优势均分给轨迹内每个动作。如果一次绕路最终得到了补救，训练仍会鼓励模型下次在相同前缀下重复绕路。两篇论文都从这个相对优势出发；如果一组尝试得分完全相同，GRPO 给出的优势就是零，各步也就没有可分的奖惩。<sup id="cite-1-2"><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup><sup id="cite-2-3"><a href="#ref-2" aria-label="参考文献 2">[2]</a></sup></p>

## DeltaTTG 从动作前后的剩余工作量读出进展

<p>DeltaTTG 的训练标签可以直接从交互日志里数出来。把一条成功记录截在模型即将行动的位置，数出从这里到完成任务，助手还生成了多少 token。推理、工具调用和最终回答都计入，工具返回的观察只作为输入。把切点移到下一步，同一条记录便给出另一个标签。失败记录提供“这次尝试没有完成”的标签，剩余量留空，避免把很快放弃的尝试当成距离成功很近的样本。<sup id="cite-1-3"><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup></p>
<p>这个计数描述的是一条已经走过的路线。从同一局面出发，另一种策略可能花更多文字核对信息，也可能一次就选对工具。作者汇集不同策略留下的记录，训练进度估计器，再冻结它，给新策略采样到的轨迹逐步打分。估计器能看到模型做了什么，以及环境如何回应。在论文的一条短信发送记录里，智能体查到服务信息后，估计还需生成 770 个 token。它用猜测的账户标识发送，工具返回空结果，估计升到 980，原样重试后又升到 1,200。智能体已经多做了两步，预计收尾的工作反而增加了。<sup id="cite-1-4"><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup></p>
<p>训练策略时，轨迹优势的符号决定了怎么使用这两次读数之差。在正优势轨迹里，预计剩余量下降越多，这一步分到的鼓励越多；在负优势轨迹里，预计剩余量上升越多，这一步承担的惩罚越重。算法留一部分权重均摊给各步，再按动作包含的可训练 token 数归一化。这样，一条失败轨迹里做对的查询可以少受罚，轨迹优势的符号和按 token 计算的平均值都保留下来。在短信案例中，智能体最后声称已经完成操作，环境记录的结果仍然是失败。<sup id="cite-1-5"><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup></p>

## ProAS 用成功路径判断动作是否合理、是否推进

<p>ProAS 先用已有的成功示范建一张参考图。节点表示任务进展到的状态，边表示连接这些状态的动作。购物时必须先打开商品页才能选规格，但只要颜色和尺码都选对，先选绿色或先选加大码都说得通。图把这两条路径归到同一个子目标。匹配新轨迹时，算法先查这次转移在图上有无依据，再查它是否抵达了本次尝试尚未访问的有效状态。重复点选已选好的尺码，可以是图上允许的操作，却没有带来新进展。<sup id="cite-2-4"><a href="#ref-2" aria-label="参考文献 2">[2]</a></sup></p>
<p>对于正优势轨迹，算法把图上不支持的动作优势置零，保留合理动作的正优势。对于原本各步共用同一负优势的轨迹，它从当前位置一直数到结尾，把当前步也算进去，统计有多少步没有推进。这个数越高，相对惩罚就越重。一个偏差若发生在反复空转之前，承担的惩罚会比尾声的一次空转更重。作者在同一条失败记录的第 3 步和第 47 步分别禁止原动作，各续跑 50 次，前者挽回了 12 次，后者为零。较早改道也有更多步数可用，所以这组结果只说明这个案例中的补救机会。<sup id="cite-2-5"><a href="#ref-2" aria-label="参考文献 2">[2]</a></sup></p>
<p>从示范建起的图，起初可能会漏掉可行的新路。论文里有个任务要求在台灯下看铅笔，参考示范拿的是二号铅笔。智能体换拿一号铅笔也成功了，这一步在当时的图上却找不到。ProAS 等环境确认成功，再从整条记录中去掉无效动作和原地重复，把通向一号铅笔的新转移并入下一轮的图。这样既能学到另一种解法，也避免把同一次尝试里反复查看书桌的动作一并收录。<sup id="cite-2-6"><a href="#ref-2" aria-label="参考文献 2">[2]</a></sup></p>

## 从任务成功率看，两种步骤信号各贡献了什么

<p>DeltaTTG 作者分别替换了进度估计器的训练标签和分配惩罚的规则。在相同的历史轨迹上，把每个前缀的训练标签都换成整条轨迹的最终得分，两个划分上的成功率都下降。另一种改动保留剩余量估计，却在负优势轨迹上也给推进动作较大权重，结果下降更多。这说明即使得到了有用的进度读数，惩罚究竟落在哪一步，仍会影响训练效果。<sup id="cite-1-6"><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup></p>

<div class="table-scroll" role="region" aria-labelledby="tbl-deltattg" tabindex="0">
  <table class="compact-table">
    <caption id="tbl-deltattg">
      表 1｜DeltaTTG 论文内对照
      <span>Qwen3-4B 在 ALFWorld 两个测试划分上的任务成功率（%）；来源：DeltaTTG 原文表 1、表 2</span>
    </caption>
    <thead>
      <tr>
        <th scope="col">训练方式</th>
        <th scope="col" class="num">Seen</th>
        <th scope="col" class="num">Unseen</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <th scope="row">GRPO</th>
        <td class="num">81.43</td>
        <td class="num">71.89</td>
      </tr>
      <tr>
        <th scope="row">DeltaTTG，改用最终得分监督估计器</th>
        <td class="num">85.71</td>
        <td class="num">83.58</td>
      </tr>
      <tr>
        <th scope="row">DeltaTTG，负优势也按推进量加权</th>
        <td class="num">82.38</td>
        <td class="num">76.87</td>
      </tr>
      <tr>
        <th scope="row">完整 DeltaTTG</th>
        <td class="num"><strong>91.67</strong></td>
        <td class="num"><strong>87.81</strong></td>
      </tr>
    </tbody>
  </table>
</div>

<div class="table-scroll" role="region" aria-labelledby="tbl-proas" tabindex="0">
  <table class="compact-table">
    <caption id="tbl-proas">
      表 2｜ProAS 论文内对照
      <span>Qwen2.5-1.5B-Instruct 以 GRPO 为底座，两列均为验证集任务成功率（%）；来源：ProAS 原文表 2</span>
    </caption>
    <thead>
      <tr>
        <th scope="col">训练方式</th>
        <th scope="col" class="num">ALFWorld</th>
        <th scope="col" class="num">WebShop</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <th scope="row">GRPO</th>
        <td class="num">70.3</td>
        <td class="num">57.0</td>
      </tr>
      <tr>
        <th scope="row">只重分负优势轨迹的惩罚</th>
        <td class="num">71.6</td>
        <td class="num">63.8</td>
      </tr>
      <tr>
        <th scope="row">只屏蔽正优势轨迹中无依据的动作</th>
        <td class="num">83.3</td>
        <td class="num"><strong>64.6</strong></td>
      </tr>
      <tr>
        <th scope="row">完整 ProAS</th>
        <td class="num"><strong>87.0</strong></td>
        <td class="num"><strong>64.6</strong></td>
      </tr>
    </tbody>
  </table>
</div>

<p>在 ProAS 的家务任务里，只屏蔽正优势轨迹中的无依据动作，就已拿到大部分提升，再按后续未推进的步数重分惩罚，成功率还能提高。在购物任务里，只屏蔽和完整方法的成功率均值持平。<sup id="cite-2-7"><a href="#ref-2" aria-label="参考文献 2">[2]</a></sup></p>
<p>任务成功率衡量的是整套训练的效果。要知道估计器对每个动作看得准不准，DeltaTTG 作者在 AgentProcessBench 上做了单独的测试。他们依据相邻预测的变化判断一个动作有益还是有害，剔除中性步骤后，留出测试轨迹上的总体准确率为 56.91%，直接提示模型判断为 50.83%。这里测的是不同轨迹里的步骤，训练和测试可以包含同一个任务。回到短信例子，读数回升值得留意，因为工具也连续返回了空结果。把两者联系起来，才能说清智能体究竟在哪里开始走偏。<sup id="cite-1-7"><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup></p>

<figure class="figure" id="fig-advantage-flow">
  

  

  <picture>
<source media="(max-width: 720px)" srcset="/research/llm-post-training-agentic-rl/fig-advantage-flow-narrow.svg">
<img loading="lazy" decoding="async" src="/research/llm-post-training-agentic-rl/fig-advantage-flow-wide.svg" alt="同一个终局优势怎样分到每一步（宽屏示意图）">
</picture>
<figcaption><strong>图 1｜同一个终局优势，怎样分到每一步。</strong>上下两路代表 DeltaTTG 与 ProAS 各自的训练方法，高亮节点为两篇论文引入的核心步骤判断；两套方法均保留组内比较得到的轨迹终局优势符号与规模。<sup id="cite-1-8"><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup><sup id="cite-2-8"><a href="#ref-2" aria-label="参考文献 2">[2]</a></sup></figcaption>
</figure>

<details class="supplement">
  <summary>实验口径与原文版本（按需展开）</summary>
  <p>DeltaTTG 使用 arXiv v1。ALFWorld 的 Seen 和 Unseen 分别有 140、134 个测试任务，所报波动来自同一训练检查点的三次评测。AgentProcessBench 的步骤诊断另训估计器，按轨迹划分数据，汇总各数据集的非中性步骤计算准确率。<sup id="cite-1-9"><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup></p>
  <p>ProAS 使用 10 月 25 日的 arXiv v2，晚于旧稿的采集日。两个环境各用 128 个验证任务，分别用官方众包示范和官方标注的子目标初始化参考图。每个训练种子取验证成功率最高的检查点，再对三个种子取均值。表 2 的购物结果只取成功率，商品属性部分匹配也能得分的 Task Score 另计。两篇论文的 ALFWorld 模型、划分和重复方式均不同，横向比较限于各自表内。<sup id="cite-2-9"><a href="#ref-2" aria-label="参考文献 2">[2]</a></sup></p>
</details>

## 来源与阅读范围

<ol class="reference-list">
  <li id="ref-1">
    Xuyan Ye 等，<cite>DeltaTTG: Training Multi-Turn Agents with a Token-to-Go Progress Meter</cite>（arXiv v1）。
    <a href="https://arxiv.org/html/2610.17666v1" target="_blank" rel="noopener">原文 v1</a> ·
    <a href="https://arxiv.org/html/2610.17666v1#S3.SS1" target="_blank" rel="noopener">§3.1 标签</a> ·
    <a href="https://arxiv.org/html/2610.17666v1#S3.SS2" target="_blank" rel="noopener">§3.2 步骤权重</a> ·
    <a href="https://arxiv.org/html/2610.17666v1#S1.F2" target="_blank" rel="noopener">图 2</a> ·
    <a href="https://arxiv.org/html/2610.17666v1#S4.T1" target="_blank" rel="noopener">表 1 主结果</a> ·
    <a href="https://arxiv.org/html/2610.17666v1#S4.T2" target="_blank" rel="noopener">表 2 消融</a> ·
    <a href="https://arxiv.org/html/2610.17666v1#S5.T3" target="_blank" rel="noopener">表 3 步骤诊断</a> ·
    <a href="https://arxiv.org/html/2610.17666v1#A1" target="_blank" rel="noopener">附录 A</a> ·
    <a href="https://arxiv.org/html/2610.17666v1#A3.SS4" target="_blank" rel="noopener">附录 C.4</a> ·
    <a href="https://arxiv.org/html/2610.17666v1#A5.SS6" target="_blank" rel="noopener">附录 E.6 诊断口径</a> ·
    <a href="https://arxiv.org/html/2610.17666v1#A6.T11" target="_blank" rel="noopener">附录 F 表 11 短信轨迹</a>
    <a class="reference-backlink" href="#cite-1" aria-label="返回正文引用">↩</a>
  </li>
  <li id="ref-2">
    Bowen Ding 等，<cite>ProAS: A Progress-Aware Advantage Shaping Framework for Multi-Turn Agentic Reinforcement Learning</cite>（arXiv v2）。
    <a href="https://arxiv.org/html/2610.18683v2" target="_blank" rel="noopener">原文 v2</a> ·
    <a href="https://arxiv.org/html/2610.18683v2#S3.SS2" target="_blank" rel="noopener">§3.2 GRPO</a> ·
    <a href="https://arxiv.org/html/2610.18683v2#S4" target="_blank" rel="noopener">§4.1–4.3 参考图与优势分配</a> ·
    <a href="https://arxiv.org/html/2610.18683v2#S5.SS1" target="_blank" rel="noopener">§5.1 评测</a> ·
    <a href="https://arxiv.org/html/2610.18683v2#S6.T2" target="_blank" rel="noopener">表 2 消融</a> ·
    <a href="https://arxiv.org/html/2610.18683v2#A4.SS1" target="_blank" rel="noopener">附录 D.1 钥匙扣干预</a> ·
    <a href="https://arxiv.org/html/2610.18683v2#A4.SS2" target="_blank" rel="noopener">附录 D.2 步数干预</a> ·
    <a href="https://arxiv.org/html/2610.18683v2#A5.T9" target="_blank" rel="noopener">附录 D.3 表 9 铅笔路径</a> ·
    <a href="https://arxiv.org/html/2610.18683v2#A5.T10" target="_blank" rel="noopener">附录 D.4 表 10 购物路径</a>
    <a class="reference-backlink" href="#cite-2" aria-label="返回正文引用">↩</a>
  </li>
</ol>

</div>
