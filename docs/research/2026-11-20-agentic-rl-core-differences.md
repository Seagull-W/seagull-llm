---
title: "在 Agentic RL 中，模型的动作会改变下一轮看到的证据"
description: "在固定输入的大模型强化学习中，模型拿到题目和给定材料，生成一份供评分的回答。在 Agentic RL 的训练中，模型还可以先做一个动作，读到环境返回的新信息，再决定下一步。"
tags: ["每日调研", "强化学习", "Agentic RL", "信用分配", "后训练"]
date: "2026-11-20"
---

# 在 Agentic RL 中，模型的动作会改变下一轮看到的证据

<div class="research-article">

<p class="lead">在固定输入的大模型强化学习中，模型拿到题目和给定材料，生成一份供评分的回答。在 Agentic RL 的训练中，模型还可以先做一个动作，读到环境返回的新信息，再决定下一步。哪怕两者都只按最终答案给分，交互中的模型也有机会学会此刻值得查什么，以及证据够了该何时收手。</p>

## 一次检索怎样改变下一问

<p>“推出 Curious 女士香水的歌手出生在哪座城市、哪个州？”面对 Search-R1 附录里的这道题，无检索的 R1 把歌手认成碧昂丝，答了休斯敦。Search-R1 先查香水，返回的段落提到布兰妮·斯皮尔斯。这个姓名随即成了第二次查询的关键词，检索器返回密西西比州麦库姆市。模型又查了一次麦库姆的位置，才提交答案。<sup id="cite-1"><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup></p>
<p>把两段资料预先放进题面，模型也有机会答对，此时训练考查的是它怎样使用给定证据。换成 Search-R1 的采样方式，模型必须自己决定从香水入手，还是先猜一位歌手去查。即使检索器和索引始终固定，第一问选得不同，第二轮可用的证据也可能不同。这样一来，写出能找到线索的查询，本身就成了策略可以通过奖励学会的动作。<sup id="cite-1-2"><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup></p>

<div class="table-scroll" role="region" aria-labelledby="tbl-sampling" tabindex="0">
  <table>
    <caption id="tbl-sampling">
      表 1｜固定输入与交互式采样的机制差异
      <span>同一道问答，均按最终答案评分</span>
    </caption>
    <thead>
      <tr>
        <th scope="col">阶段</th>
        <th scope="col">固定输入</th>
        <th scope="col">交互式采样</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <th scope="row">开始生成时</th>
        <td>题目，可附预取资料</td>
        <td>题目，可附预取资料</td>
      </tr>
      <tr>
        <th scope="row">写出查询后</th>
        <td>作为回复的一部分继续生成</td>
        <td>执行查询，把返回段落交给模型</td>
      </tr>
      <tr>
        <th scope="row">下一次决策的依据</th>
        <td>初始输入和自己的生成前缀</td>
        <td>初始输入、此前动作和已返回的观察</td>
      </tr>
    </tbody>
  </table>
</div>

<figure class="figure" id="fig-trajectory">
  

  
  <picture>
<source media="(max-width: 720px)" srcset="/research/agentic-rl-core-differences/fig-trajectory-narrow.svg">
<img loading="lazy" decoding="async" src="/research/agentic-rl-core-differences/fig-trajectory-wide.svg" alt="一个名字怎样进入下一次查询（宽屏版）">
</picture>
<figcaption><strong>图 1｜一个名字怎样进入下一次查询。</strong>图据 Search-R1 附录 I 表 9 同题样例绘制。<sup id="cite-1-3"><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup></figcaption>
</figure>

<p>判断一条轨迹是否属于这种交互，可以沿时间顺序做个检验。假设模型把第一个查询换成另一位歌手的名字，接下来交给它的资料会跟着变吗？若系统只是重放预先写好的两段检索记录，模型仍能学会引用资料，却没有机会在这道题里试出改写查询会带来什么后果。</p>

## 检索段落给模型读，哪些词要算进策略损失？

<p>沿着布兰妮这条线索看，同一个姓名在轨迹里出现了两次：第一次是检索器送来的，第二次是模型把它写进新查询。前者是一次<strong>观察</strong>，后者是模型选择的<strong>动作</strong>。Search-R1 把两段文字都保留在上下文里，并用掩码标出来源。计算策略损失时，只在模型生成的位置计算它选中这些词的概率。如此一来，训练能强化“读到姓名后用它追问”的行为，同时保留促成这次追问的原始证据。<sup id="cite-1-4"><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup></p>
<p>Search-R1 用 Qwen2.5-7B-Base 和 PPO 做了一个对照，两组都允许模型检索，也都把返回的段落交给模型阅读。把检索器返回的词元计入损失时，七个问答集的平均精确匹配率是 34.3%。屏蔽这些位置后是 43.1%，高出 8.8 个百分点。这个差值衡量的是交互已经存在时，改变外部文字的损失掩码对答题表现的影响。<sup id="cite-1-5"><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup></p>
<p>观察和奖励也要按用途区分。Search-R1 把每次查到的段落送回模型，任务评分器直到最后才核对答案。反过来，DeepSeekMath 的过程监督做法是先从一道固定数学题采样完整解答，再给各推理步骤评分：开头的词元可以用到本步和后续各步的归一化分数，写到末步时只用末步分数。评分精细到步骤，模型在写这份解答时用到的材料却始终来自题面和自己的前文。<sup id="cite-1-6"><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup><sup id="cite-2"><a href="#ref-2" aria-label="参考文献 2">[2]</a></sup></p>

## 答对以后，第三次查询该分多少功劳？

<p>香水题在第二次检索后已经有了城市和州。如果模型当时提交相同答案，按 Search-R1 的评分规则，它会和实际多查一次的轨迹得到相同任务分。训练若只看到最后的对错，就要从许多次尝试中推断哪些早期选择值得重复，这就是多轮交互里的信用分配问题。<sup id="cite-1-7"><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup></p>
<p>结果监督版 GRPO 在同一道题下采样多条轨迹，用每条轨迹相对组内其他轨迹的得分作为优势，即更新时鼓励或抑制这次选择的信号。一条轨迹中，第一次找歌手、第三次核验和最后作答的生成词元共用这个优势。如果全组都答错，单凭最终对错就区分不了“已经找对歌手”和“一开始就认错人”。跨许多组采样，有用查询仍可能因更常出现在高回报轨迹中而得到强化。<sup id="cite-2-2"><a href="#ref-2" aria-label="参考文献 2">[2]</a></sup><sup id="cite-3"><a href="#ref-3" aria-label="参考文献 3">[3]</a></sup></p>
<p>Turn-PPO 给每轮回答前的上下文估一个值，表示模型从这里继续行动预计能拿到多少回报。读到正确姓名后，预期回报可能上升；等城市和州都已知时，再查一次可能只带来很小的变化。即使中间没有任务分，算法仍能用下一轮的折扣估值减去本轮估值，再按权重汇入后续各轮的差值和终局得分，给两次查询算出不同的优势，同一轮回复共享该轮优势。检索偶然命中，以及价值模型本身的误差，也会影响这个估计。<sup id="cite-3-2"><a href="#ref-3" aria-label="参考文献 3">[3]</a></sup></p>
<p>论文在 WebShop 购物任务上比较了下面两种推理设置。横向看同一行，三种方法都从商品搜索、选项选择到下单的多轮交互中学习。Turn-PPO 除了按回合估值，也把 PPO 对新旧策略概率比的裁剪从单个词元改到整轮回复，因此表里的平均奖励衡量的是整套改动的表现。<sup id="cite-3-3"><a href="#ref-3" aria-label="参考文献 3">[3]</a></sup></p>

<div class="table-scroll" role="region" aria-labelledby="tbl-webshop" tabindex="0">
  <table>
    <caption id="tbl-webshop">
      表 2｜WebShop 多轮购物任务平均奖励对比（Qwen3-1.7B）
      <span>来源：Turn-PPO 原文 §3.3 表 2；“训练失败”对应原表 Crash</span>
    </caption>
    <thead>
      <tr>
        <th scope="col">推理设置</th>
        <th scope="col">结果监督 GRPO</th>
        <th scope="col">Token-PPO</th>
        <th scope="col">Turn-PPO</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <th scope="row">关闭长推理</th>
        <td>0.78</td>
        <td>0.77</td>
        <td>0.80</td>
      </tr>
      <tr>
        <th scope="row">开启长推理</th>
        <td>训练失败</td>
        <td>0.54</td>
        <td>0.55</td>
      </tr>
    </tbody>
  </table>
</div>

## 采样系统要把当时的上下文交给训练器

<p>同一条轨迹有明确的先后：发出香水查询，等段落返回，才能生成带歌手姓名的下一问。不同轨迹则可以各自推进。AgentFly 让正在等工具的轨迹暂挂，其他已经拿到观察的轨迹继续生成。如果工具有状态，例如模拟商店里的购物会话，后续动作还要送回同一个环境实例，才能接上此前操作造成的变化。<sup id="cite-4"><a href="#ref-4" aria-label="参考文献 4">[4]</a></sup></p>
<p>保存轨迹也有两种实际做法。Search-R1 留下一条连续序列，用掩码标出哪些词来自检索器。若运行时会压缩历史或切换角色，Agent Lightning 则逐次保存模型实际收到的输入和生成的输出。譬如某轮只读到上轮的摘要，就应当用那份摘要还原决策条件；把事后整理的完整对话交给训练器，会让它在计算动作概率时看见模型当时没有的线索。<sup id="cite-1-8"><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup><sup id="cite-5"><a href="#ref-5" aria-label="参考文献 5">[5]</a></sup></p>
<p>Agent Lightning 论文中的实现把同一条轨迹的终局回报分给每次调用，再交由单轮算法处理各次输出。放回香水题，三次查询都可以单列成样本，三者仍可领到同一个分数。<sup id="cite-5-2"><a href="#ref-5" aria-label="参考文献 5">[5]</a></sup></p>
<p>若还希望模型学会节省调用，可以把每次查询的成本从回报中扣除。这样，在两条路径都能答对时，第二次检索后就提交答案的那条会因省下一次调用而获得更高回报。</p>

<details class="supplement">
  <summary>口径与阅读范围（按需展开）</summary>
  <p>本文对照在线采样中的两种信息条件。“固定输入”以单道任务为单位，允许预取资料和任意多步的内部推理。香水题是论文展示的一组模型输出；估计交互本身的收益，还需对齐两组可获得的资料和检索预算。</p>
  <p>Search-R1 表 4 的百分数取原表 Avg. 列乘以 100。WebShop 表中的数是任务平均奖励，原表的 Crash 表示该配置下训练失败。价值估计的说明沿用 Turn-PPO 图 1 的简化设置，只讨论终局任务分。</p>
</details>

## 来源与阅读范围

<ol class="reference-list">
  <li id="ref-1">
    Jin 等，<cite>Search-R1</cite>（arXiv v5），定位：
    <a href="https://arxiv.org/html/2503.09516v5#S3.SS2" target="_blank" rel="noopener">§3.2 算法 1</a>、
    <a href="https://arxiv.org/html/2503.09516v5#S3.SS1" target="_blank" rel="noopener">§3.1 策略损失</a>、
    <a href="https://arxiv.org/html/2503.09516v5#S3.SS4" target="_blank" rel="noopener">§3.4 任务奖励</a>、
    <a href="https://arxiv.org/html/2503.09516v5#S5.T4" target="_blank" rel="noopener">§5.4 表 4 掩码消融</a>、
    <a href="https://arxiv.org/html/2503.09516v5#A9.T9" target="_blank" rel="noopener">附录 I 表 9 同题轨迹</a>。
    <a class="reference-backlink" href="#cite-1" aria-label="返回正文引用">↩</a>
  </li>
  <li id="ref-2">
    Shao 等，<cite>DeepSeekMath</cite>（arXiv v3），定位：
    <a href="https://arxiv.org/html/2402.03300v3#S4.SS1.SSS2" target="_blank" rel="noopener">§4.1.2 结果监督</a>、
    <a href="https://arxiv.org/html/2402.03300v3#S4.SS1.SSS3" target="_blank" rel="noopener">§4.1.3 过程监督</a>。
    <a class="reference-backlink" href="#cite-2" aria-label="返回正文引用">↩</a>
  </li>
  <li id="ref-3">
    Li 等，<cite>Turn-PPO</cite>（Findings of EACL 2026），定位：
    <a href="https://aclanthology.org/2026.findings-eacl.328.pdf#page=3" target="_blank" rel="noopener">图 1 优势分配示意</a>、
    <a href="https://aclanthology.org/2026.findings-eacl.328.pdf#page=5" target="_blank" rel="noopener">§§2.3–2.4、表 1 估值和裁剪</a>、
    <a href="https://aclanthology.org/2026.findings-eacl.328.pdf#page=7" target="_blank" rel="noopener">§3.3 表 2 平均奖励</a>。
    <a class="reference-backlink" href="#cite-3" aria-label="返回正文引用">↩</a>
  </li>
  <li id="ref-4">
    Wang 等，<cite>AgentFly</cite>（arXiv v1），定位：
    <a href="https://arxiv.org/html/2507.14897v1#S2.SS1" target="_blank" rel="noopener">§2.1 异步采样</a>、
    <a href="https://arxiv.org/html/2507.14897v1#S2.SS4" target="_blank" rel="noopener">§2.4 环境实例绑定</a>。
    <a class="reference-backlink" href="#cite-4" aria-label="返回正文引用">↩</a>
  </li>
  <li id="ref-5">
    Luo 等，<cite>Agent Lightning</cite>（arXiv v1），定位：
    <a href="https://arxiv.org/html/2508.03680v1#S3.SS2.SSS2" target="_blank" rel="noopener">§3.2.2 式（6）逐调用记录</a>、
    <a href="https://arxiv.org/html/2508.03680v1#S3.SS3.SSS2" target="_blank" rel="noopener">§3.3.2 图 3 回报分配</a>。
    <a class="reference-backlink" href="#cite-5" aria-label="返回正文引用">↩</a>
  </li>
</ol>

</div>
