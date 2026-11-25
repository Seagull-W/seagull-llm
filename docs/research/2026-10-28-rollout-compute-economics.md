---
title: "Rollout 的算力账：同样的 GPU 时间，怎样让模型多做对几道题？"
description: "在数学推理强化学习里，模型每试答一次（一次 rollout），每个生成的 token 都要付费。同一道题连续答对十次，在只看对错、按组比较的训练里，反而给不出哪种回答应当更常出现的信号。"
tags: ["每日调研", "强化学习", "后训练", "rollout", "推理系统"]
date: "2026-10-28"
---

# Rollout 的算力账：同样的 GPU 时间，怎样让模型多做对几道题？

<div class="research-article">

<p class="lead">在数学推理强化学习里，模型每试答一次（一次 rollout），每个生成的 token 都要付费。同一道题连续答对十次，在只看对错、按组比较的训练里，反而给不出哪种回答应当更常出现的信号。要判断下一笔算力该花在多试几次、写得更长，还是缩短等待，可以先算每组有对照的答案耗了多少 token，再看模型达到同一验证正确率用了多少 GPU 小时。</p>

## 一道题采几次，才有可学的差别？

<p>给同一道题采一组答案，组相对策略优化（GRPO）用每个答案的奖励减去本组均值，再按组内波动做归一化。只按对错给奖时，有对有错，正确答案就高于均值，错误答案就低于均值。若答案奖励全相同，这一组对奖励驱动的策略更新贡献为零。DAPO 的训练中，随着模型变强，整组全对的题越来越多。即使每步抽取的题数相同，能教模型区分解法的题也会减少。<sup id="cite-1"><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup></p>
<p>可以用一个算例给这种对照定价。假设每道题单次答对的概率都是一半，各次试答独立，每个答案等长。每题答两次，有一半的组会一对一错。每题答四次，出现对错兼有的概率升到八分之七。如果一共只能生成三十二个答案，两种分法平均分别得到八组和七组对照。多试两次更容易看清同一道题，却挤掉了试其他题的机会。在训练日志里，用<strong>所有已生成的 token 数除以对错兼有的组数</strong>，就能把被筛掉的答案也算进成本。</p>
<p>DAPO 选择继续抽新题，直到对错兼有的组凑满一批。表中最后一步保留此前的长度处理、裁剪和损失聚合，仅再加入动态采样。作者报告每步需要生成更多答案，但达到相近成绩所需的更新步数减少，总训练时间受影响不大。图 6 的横轴是训练步数，无法据此换算节省了多少 GPU 小时。<sup id="cite-1-2"><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup></p>

<div class="table-scroll" role="region" aria-labelledby="tbl-dapo" tabindex="0">
  <table>
    <caption id="tbl-dapo">
      表 1｜DAPO 累计配方消融结果
      <span>基座：Qwen2.5-32B；指标：AIME 2024 平均正确率（avg@32）；来源：DAPO 表 1</span>
    </caption>
    <thead>
      <tr>
        <th scope="col">Qwen2.5-32B 的累计训练配方</th>
        <th scope="col">AIME 2024 平均正确率（avg@32）</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <th scope="row">基础 GRPO</th>
        <td>30%</td>
      </tr>
      <tr>
        <th scope="row">已加入超长处理、提高裁剪上限和 token 级损失</th>
        <td>42%</td>
      </tr>
      <tr>
        <th scope="row">上述配方再加入动态采样</th>
        <td>50%</td>
      </tr>
    </tbody>
  </table>
</div>

<p>筛选发生在什么时候，也决定哪笔费用能省下来。DAPO 在答案生成之后筛出有对照的组，这一批被丢弃的 token 已经花出去了。ScaleRL 还试了在生成之前选题，记录历次作答的通过率，把已达到九成的题移出后续轮次。前一种做法稳住每次更新能用的题数，后一种做法把下一轮本要花在熟题上的生成预算留给了其他题。<sup id="cite-1-3"><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup><sup id="cite-3"><a href="#ref-3" aria-label="参考文献 3">[3]</a></sup></p>

## 长答案多花的 token 怎样进入更新？

<p>一个答案因达到长度上限而中断时，验证器可能连最后的数值都没见到。若一律按错答处罚，一条本可算对的推理也会收到负反馈。DAPO 先试着屏蔽截断答案的损失，基础配方的平均正确率由 30% 升至 36%。另一种处理是把长度代价单独计入奖励。生成长度进入缓冲区以后，每多写一个 token，扣分就增加一点。这样，即使最后答对，拖到上限才交卷也有代价。<sup id="cite-1-4"><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup></p>
<p>对完整答案，长度还决定每个 token 在损失中占多大分量。设同题的两个答案分别写了两百和两千个 token。先在各答案内部取平均，再对答案等权平均，长答案里单个 token 的系数只有短答案的十分之一。DAPO 改为在同一道题的所有回答中按 token 取平均，两处 token 的系数随之相同。长答案里有助于答对的写法和伴随错答的重复片段，都会更充分地参与相应方向的更新。实际梯度仍取决于奖励与模型概率。<sup id="cite-1-5"><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup></p>

## 生成快一倍，学习能快多少？

<p>同步训练先生成整批答案，再更新模型。短答案陆续交卷后，仍在解码的序列越来越少，最后一条长答案决定训练何时开工。PipelineRL 让完成的答案先入队，训练端凑齐一批就更新，同时把新权重送回仍在生成的模型。一条长回答可以用旧权重起笔、用新权重收尾。这样缩短了等待，也使同一条回答里的 token 有了不同的滞后程度。等到训练时，当前模型给开头那些词的概率可能已经变了。<sup id="cite-2"><a href="#ref-2" aria-label="参考文献 2">[2]</a></sup></p>

<figure class="figure" id="fig-pipeline">
  <svg class="flow-wide" viewBox="0 0 740 426" role="img" aria-labelledby="fig-pipeline-wide-title">
    <title id="fig-pipeline-wide-title">同步训练与 PipelineRL 流水线生成—训练时序对比</title>
    <defs>
      <pattern id="wait-hatch-wide" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="8" stroke="#c7cdc9" stroke-width="2" />
      </pattern>
    </defs>

    <!-- 三条共用竖向时标 -->
    <path data-kind="guide" d="M250 38 V382" />
    <path data-kind="guide" d="M390 38 V382" />
    <path data-kind="guide" d="M552 38 V382" />

    <rect data-kind="bg-label" x="198" y="8" width="104" height="24" rx="4" />
    <rect data-kind="bg-label" x="312" y="8" width="156" height="24" rx="4" />
    <rect data-kind="bg-label" x="500" y="8" width="104" height="24" rx="4" />
    <g text-anchor="middle">
      <text x="250" y="25" data-size="sm" data-kind="muted">短答案完成</text>
      <text x="390" y="25" data-size="sm" data-kind="muted">可更新的一批已凑齐</text>
      <text x="552" y="25" data-size="sm" data-kind="muted">长答案完成</text>
    </g>

    <!-- 组 1：同步 -->
    <text x="14" y="70" data-kind="label" data-size="md">同步</text>
    <text x="14" y="122" data-size="sm" data-kind="muted">生成</text>
    <text x="14" y="178" data-size="sm" data-kind="muted">训练</text>

    <!-- 同步生成：短答案（细条）与长答案（粗条） -->
    <rect x="96" y="84" width="154" height="22" rx="4" />
    <text x="173" y="100" text-anchor="middle" data-size="xs">权重 v0</text>

    <rect x="96" y="114" width="456" height="34" rx="5" />
    <text x="324" y="136" text-anchor="middle" data-size="sm">权重 v0</text>

    <!-- 同步训练：斜线等待 + 开始更新 -->
    <rect data-tone="hatch-wide" x="96" y="158" width="456" height="30" rx="4" />
    <rect data-kind="bg-label" x="272" y="162" width="104" height="22" rx="3" />
    <text x="324" y="178" text-anchor="middle" data-size="xs" data-kind="muted">等最后一条</text>

    <rect data-tone="training" x="568" y="158" width="144" height="30" rx="5" />
    <text x="640" y="178" text-anchor="middle" data-size="sm">开始更新</text>

    <!-- 长答案右端向下实线箭头至开始更新 -->
    <path data-kind="answer" d="M552 131 H640 V156 M634 148 L640 156 L646 148" />

    <!-- 分隔线 -->
    <path data-kind="guide" d="M14 214 H724" />

    <!-- 组 2：流水线 -->
    <text x="14" y="242" data-kind="label" data-size="md">流水线</text>
    <text x="14" y="294" data-size="sm" data-kind="muted">生成</text>
    <text x="14" y="354" data-size="sm" data-kind="muted">训练</text>

    <!-- 流水线生成：短答案（细条） -->
    <rect x="96" y="250" width="154" height="22" rx="4" />
    <text x="173" y="266" text-anchor="middle" data-size="xs">权重 v0</text>

    <!-- 流水线生成：长答案（粗条，v0 前缀 + v1 后缀，共用外框，高亮分界） -->
    <rect data-tone="v0" x="96" y="280" width="322" height="36" />
    <rect data-tone="v1" x="418" y="280" width="134" height="36" />
    <rect data-tone="split-glow" x="412" y="276" width="12" height="44" rx="2" />
    <path data-kind="split" d="M418 276 V320" />
    <rect data-tone="outline" x="96" y="280" width="456" height="36" rx="5" />

    <text x="257" y="303" text-anchor="middle" data-size="sm">v0 前缀</text>
    <text x="485" y="303" text-anchor="middle" data-size="sm">v1 后缀</text>

    <!-- 流水线训练：完成队列 -> 更新到 v1 -->
    <rect x="266" y="336" width="106" height="30" rx="5" />
    <text x="319" y="356" text-anchor="middle" data-size="sm">完成队列</text>

    <rect data-tone="training" x="390" y="336" width="124" height="30" rx="5" />
    <text x="452" y="356" text-anchor="middle" data-size="sm">更新到 v1</text>

    <!-- 实线箭头：短答案右端 -> 完成队列 -> 更新到 v1 -->
    <path data-kind="answer" d="M250 261 H292 V334 M286 326 L292 334 L298 326" />
    <path data-kind="answer" d="M372 351 H388 M381 346 L388 351 L381 356" />

    <!-- 虚线箭头：更新到 v1 向上至长答案分界处 -->
    <path data-kind="weight" d="M418 336 V318 M412 325 L418 318 L424 325" />
    <rect data-kind="bg-label" x="424" y="317" width="84" height="18" rx="3" />
    <text x="466" y="330" text-anchor="middle" data-size="xs" data-kind="weight">送回新权重</text>

    <!-- 图例 -->
    <path data-kind="answer" d="M210 406 H252 M245 401 L252 406 L245 411" />
    <text x="262" y="411" data-size="sm" data-kind="muted">实线传答案</text>
    <path data-kind="weight" d="M398 406 H440 M433 401 L440 406 L433 411" />
    <text x="450" y="411" data-size="sm" data-kind="muted">虚线传权重</text>
  </svg>

  <svg class="flow-narrow" viewBox="0 0 340 536" role="img" aria-labelledby="fig-pipeline-narrow-title">
    <title id="fig-pipeline-narrow-title">同步训练与 PipelineRL 流水线生成—训练时序对比（窄屏版）</title>
    <defs>
      <pattern id="wait-hatch-narrow" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="8" stroke="#c7cdc9" stroke-width="2" />
      </pattern>
    </defs>

    <!-- 三条共用竖向时标 -->
    <path data-kind="guide" d="M112 52 V478" />
    <path data-kind="guide" d="M188 52 V478" />
    <path data-kind="guide" d="M266 52 V478" />

    <rect data-kind="bg-label" x="74" y="8" width="76" height="36" rx="4" />
    <rect data-kind="bg-label" x="150" y="8" width="76" height="36" rx="4" />
    <rect data-kind="bg-label" x="228" y="8" width="76" height="36" rx="4" />
    <g text-anchor="middle">
      <text x="112" y="23" data-size="xs" data-kind="muted">短答案</text>
      <text x="112" y="39" data-size="xs" data-kind="muted">完成</text>
      <text x="188" y="23" data-size="xs" data-kind="muted">可更新一批</text>
      <text x="188" y="39" data-size="xs" data-kind="muted">已凑齐</text>
      <text x="266" y="23" data-size="xs" data-kind="muted">长答案</text>
      <text x="266" y="39" data-size="xs" data-kind="muted">完成</text>
    </g>

    <!-- 组 1：同步 -->
    <text x="10" y="74" data-kind="label" data-size="md">同步</text>
    <text x="10" y="114" data-size="xs" data-kind="muted">生成</text>
    <text x="10" y="182" data-size="xs" data-kind="muted">训练</text>

    <rect x="46" y="86" width="66" height="20" rx="4" />
    <text x="79" y="100" text-anchor="middle" data-size="xs">权重 v0</text>

    <rect x="46" y="114" width="220" height="32" rx="5" />
    <text x="156" y="135" text-anchor="middle" data-size="sm">权重 v0</text>

    <rect data-tone="hatch-narrow" x="46" y="162" width="220" height="28" rx="4" />
    <rect data-kind="bg-label" x="114" y="166" width="84" height="20" rx="3" />
    <text x="156" y="181" text-anchor="middle" data-size="xs" data-kind="muted">等最后一条</text>

    <rect data-tone="training" x="274" y="162" width="58" height="28" rx="4" />
    <text x="303" y="181" text-anchor="middle" data-size="xs">开始更新</text>

    <path data-kind="answer" d="M266 130 H303 V160 M298 153 L303 160 L308 153" />

    <!-- 分隔线 -->
    <path data-kind="guide" d="M10 218 H330" />

    <!-- 组 2：流水线 -->
    <text x="10" y="246" data-kind="label" data-size="md">流水线</text>
    <text x="10" y="294" data-size="xs" data-kind="muted">生成</text>
    <text x="10" y="424" data-size="xs" data-kind="muted">训练</text>

    <rect x="46" y="260" width="66" height="20" rx="4" />
    <text x="79" y="274" text-anchor="middle" data-size="xs">权重 v0</text>

    <!-- 流水线长答案：v0 前缀 + v1 后缀 -->
    <rect data-tone="v0" x="46" y="290" width="160" height="34" />
    <rect data-tone="v1" x="206" y="290" width="60" height="34" />
    <rect data-tone="split-glow" x="201" y="286" width="10" height="42" rx="2" />
    <path data-kind="split" d="M206 286 V328" />
    <rect data-tone="outline" x="46" y="290" width="220" height="34" rx="5" />

    <text x="126" y="312" text-anchor="middle" data-size="sm">v0 前缀</text>
    <text x="236" y="312" text-anchor="middle" data-size="xs">v1 后缀</text>

    <!-- 完成队列 与 更新到 v1 -->
    <rect x="112" y="406" width="68" height="28" rx="4" />
    <text x="146" y="425" text-anchor="middle" data-size="xs">完成队列</text>

    <rect data-tone="training" x="190" y="406" width="76" height="28" rx="4" />
    <text x="228" y="425" text-anchor="middle" data-size="xs">更新到 v1</text>

    <!-- 实线箭头 -->
    <path data-kind="answer" d="M112 270 H134 V404 M129 397 L134 404 L139 397" />
    <path data-kind="answer" d="M180 420 H188 M183 416 L188 420 L183 424" />

    <!-- 虚线箭头：送回新权重 -->
    <path data-kind="weight" d="M206 406 V326 M201 333 L206 326 L211 333" />
    <rect data-kind="bg-label" x="212" y="354" width="74" height="20" rx="3" />
    <text x="249" y="369" text-anchor="middle" data-size="xs" data-kind="weight">送回新权重</text>

    <!-- 图例 -->
    <path data-kind="answer" d="M48 506 H82 M76 502 L82 506 L76 510" />
    <text x="90" y="511" data-size="xs" data-kind="muted">实线传答案</text>
    <path data-kind="weight" d="M188 506 H222 M216 502 L222 506 L216 510" />
    <text x="230" y="511" data-size="xs" data-kind="muted">虚线传权重</text>
  </svg>

  <figcaption><strong>图 1｜短答案交卷时，长答案还在用哪一版权重？</strong> 依据 PipelineRL 算法 1–2，时间从左到右，位置仅示意先后。<sup id="cite-2-2"><a href="#ref-2" aria-label="参考文献 2">[2]</a></sup></figcaption>
</figure>

<p>PipelineRL 用两条曲线解释学习速度。一条看单位时间处理了多少答案，另一条看处理相同数量的答案后，平均奖励提高了多少。在 Qwen2.5-7B 数学训练中，流水线达到相同平均训练奖励的速度约为常规基线的两倍，样本吞吐也约为两倍。基线每轮生成后做 32 次优化更新，耗时由较小规模测量折算。再按答案数对齐进度，流水线的奖励曲线与每轮更新八次、十六次的常规训练接近。加速主要来自同一段时间装进了更多次试答。<sup id="cite-2-3"><a href="#ref-2" aria-label="参考文献 2">[2]</a></sup></p>
<p>作者还按当前策略与生成策略给同一 token 的概率比加权，用归一化有效样本量（ESS）观察权重是否集中在少数样本上。与常规基线相比，流水线里最旧的 token 横跨的更新步数更多，整批 ESS 却与常规基线每轮做八次更新时接近。附录里把更新次数提到 64 后发散的也是常规基线。这个实验检验的是同一版策略采完数据后可以接连更新几次。要判断同一道题值得采几个答案，还得固定总回答数来比。<sup id="cite-2-4"><a href="#ref-2" aria-label="参考文献 2">[2]</a></sup></p>

## 固定预算后，多答几遍还是多写几步？

<p>ScaleRL 做了这个对照。研究者把每题回答数设为 8、16、24 或 32，并相应减少或增加题数，让每批生成的回答总数相同。在所测的中等批量下，四组验证正确率随算力增长的曲线相近。把同一批回答集中到更少的题上，没有表现出稳定的算力优势。这里固定的是回答数，每个答案实际写了多长，仍会影响消耗。<sup id="cite-3-2"><a href="#ref-3" aria-label="参考文献 3">[3]</a></sup></p>
<p>当研究者把额外预算用来放宽生成长度，两条曲线拉开了。研究者以累计 GPU 小时为横轴，从同一题库留出一千题检验正确率。较长设置起步慢，但训练延长后反超。表中“半程”指达到<strong>各自预计总增益的一半</strong>，两行对应不同的目标分数。后一行要晚得多才到半程，也给模型留下了更高的提升空间。<sup id="cite-3-3"><a href="#ref-3" aria-label="参考文献 3">[3]</a></sup></p>

<div class="table-scroll" role="region" aria-labelledby="tbl-scalerl" tabindex="0">
  <table>
    <caption id="tbl-scalerl">
      表 2｜放宽生成长度预算对训练半程与拟合上限的影响
      <span>测试集：同题库留出 1,000 题；来源：ScaleRL §5、附录表 1</span>
    </caption>
    <thead>
      <tr>
        <th scope="col">ScaleRL 生成长度预算</th>
        <th scope="col">到各自增益半程（拟合 GPU 小时）</th>
        <th scope="col">验证通过率的拟合上限</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <th scope="row">14k token</th>
        <td>2,542</td>
        <td>61.0%</td>
      </tr>
      <tr>
        <th scope="row">32k token</th>
        <td>11,272</td>
        <td>64.5%</td>
      </tr>
    </tbody>
  </table>
</div>

<p>ScaleRL 还检验了预算预测本身。在最大的一次数学训练中，作者用前五万 GPU 小时内的验证结果拟合曲线，再把训练延长到十万 GPU 小时，实测通过率与外推接近。对于有明确目标的训练，可以在图上画一条目标正确率水平线，读出各配方到达交点的算力。若手上只有一笔固定预算，就在对应的 GPU 小时处画竖线。两种读法都能让省下的生成、等待和更新成本，最终落实到同一批题上多答对了多少。<sup id="cite-3-4"><a href="#ref-3" aria-label="参考文献 3">[3]</a></sup></p>

<details class="supplement">
  <summary>统计口径与范围（按需展开）</summary>
  <p>DAPO 的 avg@32 是同一套题重复作答 32 次的平均正确率。只按对错给奖的算例用来解释组内对照；加上长度扣分后，同为错答也可能奖励不同。PipelineRL 以同等硬件规模估算基线耗时。归一化 ESS 描述重要性权重的集中程度，权重均匀时为 1。ScaleRL 的上限来自同分布验证集的 S 形曲线拟合；表中 64.5% 是拟合参数，单个检查点的实测值另见原论文图 9。</p>
</details>

## 来源与阅读范围

<ol class="reference-list">
  <li id="ref-1">
    Yu 等，<cite>DAPO: An Open-Source LLM Reinforcement Learning System at Scale</cite>，v2。
    <a href="https://arxiv.org/html/2503.14476v2#S3.SS2" target="_blank" rel="noopener">§3.2、式 11（动态采样）</a>、
    <a href="https://arxiv.org/html/2503.14476v2#S3.F3.sf2" target="_blank" rel="noopener">图 3(b)（全对组占比）</a>、
    <a href="https://arxiv.org/html/2503.14476v2#S3.SS3" target="_blank" rel="noopener">§3.3–3.4、式 12–13（损失与超长处理）</a>、
    <a href="https://arxiv.org/html/2503.14476v2#S4.SS1" target="_blank" rel="noopener">§4.1、图 6（评测与步数）</a>、
    <a href="https://arxiv.org/html/2503.14476v2#S4.T1" target="_blank" rel="noopener">§4.2、表 1（累计配方）</a>。
    <a class="reference-backlink" href="#cite-1" aria-label="返回正文引用">↩</a>
  </li>
  <li id="ref-2">
    Piché 等，<cite>PipelineRL: Faster On-policy Reinforcement Learning for Long Sequence Generation</cite>，v2。
    <a href="https://arxiv.org/html/2509.19128v2#S2.SS1" target="_blank" rel="noopener">§2.1、式 5–6（重要性权重与 ESS）</a>、
    <a href="https://arxiv.org/html/2509.19128v2#S3.E7" target="_blank" rel="noopener">§3、式 7（学习速度分解）</a>、
    <a href="https://arxiv.org/html/2509.19128v2#S4" target="_blank" rel="noopener">§4（生成途中更新权重）</a>、
    <a href="https://arxiv.org/html/2509.19128v2#S5" target="_blank" rel="noopener">§5、图 5–6（对照设置与结果）</a>、
    <a href="https://arxiv.org/html/2509.19128v2#A2.F10" target="_blank" rel="noopener">附录 B 图 10（64 次更新）</a>。
    <a class="reference-backlink" href="#cite-2" aria-label="返回正文引用">↩</a>
  </li>
  <li id="ref-3">
    Khatri 等，<cite>The Art of Scaling Reinforcement Learning Compute for LLMs</cite>，v1。
    <a href="https://arxiv.org/html/2510.13786v1#S2.SS1" target="_blank" rel="noopener">§2.1、图 3（验证与拟合参数）</a>、
    <a href="https://arxiv.org/html/2510.13786v1#S3.SS2.SSS0.Px6" target="_blank" rel="noopener">§3.2、图 6(b)（历史通过率选题）</a>、
    <a href="https://arxiv.org/html/2510.13786v1#S0.F1" target="_blank" rel="noopener">图 1（算力外推）</a>、
    <a href="https://arxiv.org/html/2510.13786v1#S5.F9" target="_blank" rel="noopener">§5、图 9（生成长度）</a>、
    <a href="https://arxiv.org/html/2510.13786v1#A1.F17" target="_blank" rel="noopener">附录图 17（每题回答数对照）</a>、
    <a href="https://arxiv.org/html/2510.13786v1#A1.T1" target="_blank" rel="noopener">附录表 1（两种长度的拟合值）</a>。
    <a class="reference-backlink" href="#cite-3" aria-label="返回正文引用">↩</a>
  </li>
</ol>

</div>
