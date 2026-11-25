---
title: "从题意到证明，董彬及合作者怎样用 Lean 核验数学推理"
description: "原题要证明某个伽罗瓦群与八阶四元数群同构，模型却把目标群写成了四阶循环群。这样的陈述可以通过 Lean 编译，即使后来证明成功，得到的也是另一个定理。"
tags: ["每日调研", "形式化数学", "Lean", "RAG", "智能体", "强化学习", "模型评估"]
date: 2026-11-09
---

# 从题意到证明，董彬及合作者怎样用 Lean 核验数学推理

<div class="research-article">

<p class="lead">原题要证明某个伽罗瓦群与八阶四元数群同构，模型却把目标群写成了四阶循环群。这样的陈述可以通过 Lean 编译，即使后来证明成功，得到的也是另一个定理。在董彬及合作者的研究中，Aria 核对形式陈述是否忠于题意，LeanSearch 寻找支撑证明路线的库引理，Reap 则从起点重放指令，让 Lean 检查整份证明。<sup id="cite-1"><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup><sup id="cite-4"><a href="#ref-4" aria-label="参考文献 4">[4]</a></sup><sup id="cite-7"><a href="#ref-7" aria-label="参考文献 7">[7]</a></sup></p>

## 写下定理之前，先认准定义

<p>Lean 是证明助手，Mathlib 是它的数学库。把题目交给 Lean，第一件事是写清讨论的对象、假设和结论。Aria 做到这里就可以停下，证明正文允许用 <code>sorry</code> 占位。编译器能发现参数类型不合；要发现一个同样合法的参数已经换掉了研究对象，还得拿代码和原题对照。<sup><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup></p>
<p>四元数群的例子里，<code>QuaternionGroup 1</code> 与四阶循环群同构，原题中的八阶群要写成 <code>QuaternionGroup 2</code>。只把代码翻回自然语言，“四元数群”几个字仍可能让评阅者放行。AriaScorer 从代码实际用到的术语查回类型和定义，再让模型逐项核对原题的假设与结论。这样一来，评阅者手里有了判断那个参数的依据。<sup><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup></p>
<p>有时连现成的定义也找不到。遇到 Cohen–Macaulay 模这样的概念，Aria 先用 LeanSearch 查 Mathlib，找不到合适的定义，就继续追查它依赖哪些概念。等底层定义有了着落，再从下往上合成缺失的定义，将编译错误交回模型修改。研究者用这一方法处理了十四条交换代数同调猜想，人工确认其中六条陈述译对了。这六条猜想由此有了可以交给证明器的形式陈述。<sup><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup></p>
<p>FATE-X 的 100 道题中，Aria 有 69 条陈述通过编译，判别器在其中接受 44 条。专家复核同一批输出，发现获准的有 2 条译错，被拒的有 10 条其实译对。按专家标签计，忠实表达原题的是 52 条；论文主表的 44% 记录的是编译与自动判读均通过的比例。<sup><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup></p>

## 找到一个定理名之后，还缺哪些引理？

<p>数学家记得“柯西中值定理”，库里对应的声明却叫 <code>exists_ratio_deriv_eq_ratio_slope</code>。早期 LeanSearch 给库声明配上自然语言名称和说明，让人可以按数学含义找代码。Matlas 面向论文和教材，从文献里抽取约 807 万条陈述，并沿同一文档里的依赖补回定义。读者可以循着检索结果回到文献；要在 Lean 里调用其中一条结果，还得匹配库中已有的声明，或把缺少的定义和证明补进来。<sup id="cite-2"><a href="#ref-2" aria-label="参考文献 2">[2]</a></sup><sup id="cite-3"><a href="#ref-3" aria-label="参考文献 3">[3]</a></sup></p>
<p>找齐一条证明路线更难。要证素数 <i>p</i> 对应的 (<i>x</i><sup><i>p</i></sup> − 1)/(<i>x</i> − 1) 在整数系数多项式环中不可约，题面没有出现“分圆”二字。若认出商式就是第 <i>p</i> 个分圆多项式，就可以分别去找几何和恒等式、素数阶分圆多项式的表达式，以及分圆多项式的不可约性定理。只搜到最后一条，仍缺少把原式改写成引理所需形式的理由。<sup><a href="#ref-4" aria-label="参考文献 4">[4]</a></sup></p>

<figure class="figure" id="fig-cyclotomic">
  <svg class="flow-wide cyclotomic-svg" viewBox="0 0 880 298" role="img" aria-labelledby="fig-cyclotomic-wide-title">
    <title id="fig-cyclotomic-wide-title">三条引理如何接起一个不可约性证明（宽屏示意图）</title>
    <!-- 分组标题 -->
    <text class="group-title" x="14" y="24" text-anchor="start">纸上的推理</text>
    <text class="group-title" x="14" y="204" text-anchor="start">Mathlib 中的依据</text>

    <!-- 节点上方条件与高亮旁注 -->
    <text class="cond-label" x="86" y="52" text-anchor="middle">p 为素数</text>
    <text class="note-highlight" x="558" y="52" text-anchor="middle">题面没有出现的概念</text>

    <!-- 上行四个推理节点 -->
    <rect class="node-box" x="14" y="66" width="144" height="68" rx="8" />
    <rect class="node-box" x="250" y="66" width="144" height="68" rx="8" />
    <rect class="node-highlight" x="486" y="66" width="144" height="68" rx="8" />
    <rect class="node-box" x="722" y="66" width="144" height="68" rx="8" />

    <g text-anchor="middle">
      <text class="node-title" x="86" y="94">商式</text>
      <text class="node-math" x="86" y="118">(x<tspan dy="-5" font-size="10.5">p</tspan><tspan dy="5"> − 1)/(x − 1)</tspan></text>

      <text class="node-title" x="322" y="94">几何和</text>
      <text class="node-math" x="322" y="118">1 + x + … + x<tspan dy="-5" font-size="10.5">p−1</tspan></text>

      <text class="node-title" x="558" y="94">分圆多项式</text>
      <text class="node-math" x="558" y="118">Φ<tspan dy="4" font-size="10.5">p</tspan><tspan dy="-4">(x)</tspan></text>

      <text class="node-title" x="794" y="94">在 ℤ[x] 中</text>
      <text class="node-title" x="794" y="118">不可约</text>
    </g>

    <!-- 横向推理箭头 A → B → C → D -->
    <path class="arrow-main" d="M158 100 H246 M239 95 L247 100 L239 105" />
    <path class="arrow-main" d="M394 100 H482 M475 95 L483 100 L475 105" />
    <path class="arrow-main" d="M630 100 H718 M711 95 L719 100 L711 105" />

    <!-- 纵向支撑箭头（卡片指向各自支撑的连线） -->
    <path class="arrow-support" d="M204 220 V110 M199 117 L204 109 L209 117" />
    <path class="arrow-highlight" d="M440 220 V110 M435 117 L440 109 L445 117" />
    <path class="arrow-support" d="M676 220 V110 M671 117 L676 109 L681 117" />

    <!-- 连线文字垫不透明底色，防止箭头穿字 -->
    <rect class="label-mask" x="158" y="152" width="92" height="24" rx="4" />
    <rect class="label-mask" x="398" y="152" width="84" height="24" rx="4" />
    <rect class="label-mask" x="640" y="152" width="72" height="24" rx="4" />

    <g text-anchor="middle">
      <text class="edge-label" x="204" y="169">几何和恒等式</text>
      <text class="edge-label" x="440" y="169">素数阶公式</text>
      <text class="edge-label" x="676" y="169">不可约性</text>
    </g>

    <!-- 下行三张 Mathlib 引理卡片 -->
    <rect class="card-lemma" x="111" y="220" width="186" height="58" rx="8" />
    <rect class="card-lemma card-highlight" x="336" y="220" width="208" height="58" rx="8" />
    <rect class="card-lemma" x="568" y="220" width="216" height="58" rx="8" />

    <g text-anchor="middle">
      <text class="lemma-code" x="204" y="254">geom_sum_mul</text>

      <text class="lemma-code" x="440" y="244">Polynomial.</text>
      <text class="lemma-code" x="440" y="264">cyclotomic_prime</text>

      <text class="lemma-code" x="676" y="244">Polynomial.</text>
      <text class="lemma-code" x="676" y="264">cyclotomic.irreducible</text>
    </g>
  </svg>

  <svg class="flow-narrow cyclotomic-svg" viewBox="0 0 380 562" role="img" aria-labelledby="fig-cyclotomic-narrow-title">
    <title id="fig-cyclotomic-narrow-title">三条引理如何接起一个不可约性证明（窄屏示意图）</title>
    <!-- 分组标题 -->
    <text class="group-title" x="10" y="22" text-anchor="start">纸上的推理</text>
    <text class="group-title" x="202" y="22" text-anchor="start">Mathlib 中的依据</text>

    <!-- 节点 A 上方条件 -->
    <text class="cond-label" x="93" y="46" text-anchor="middle">p 为素数</text>

    <!-- 左列四个推理节点 -->
    <rect class="node-box" x="10" y="56" width="166" height="58" rx="8" />
    <rect class="node-box" x="10" y="194" width="166" height="58" rx="8" />
    <rect class="node-highlight" x="10" y="338" width="166" height="62" rx="8" />
    <rect class="node-box" x="10" y="488" width="166" height="58" rx="8" />

    <g text-anchor="middle">
      <text class="node-title" x="93" y="80">商式</text>
      <text class="node-math" x="93" y="102">(x<tspan dy="-4" font-size="9.5">p</tspan><tspan dy="4"> − 1)/(x − 1)</tspan></text>

      <text class="node-title" x="93" y="218">几何和</text>
      <text class="node-math" x="93" y="240">1 + x + … + x<tspan dy="-4" font-size="9.5">p−1</tspan></text>

      <text class="node-title" x="93" y="364">分圆多项式</text>
      <text class="node-math" x="93" y="387">Φ<tspan dy="3.5" font-size="9.5">p</tspan><tspan dy="-3.5">(x)</tspan></text>

      <text class="node-title" x="93" y="512">在 ℤ[x] 中</text>
      <text class="node-title" x="93" y="534">不可约</text>
    </g>

    <!-- 高亮旁注（位于节点 C 右侧空隙） -->
    <text class="note-highlight" x="286" y="373" text-anchor="middle">题面没有出现的概念</text>

    <!-- 纵向推理箭头 A → B → C → D -->
    <path class="arrow-main" d="M93 114 V190 M88 183 L93 191 L98 183" />
    <path class="arrow-main" d="M93 252 V334 M88 327 L93 335 L98 327" />
    <path class="arrow-main" d="M93 400 V484 M88 477 L93 485 L98 477" />

    <!-- 横向支撑箭头（引理卡片指向对应连线） -->
    <path class="arrow-support" d="M202 154 H147 M154 149 L146 154 L154 159" />
    <path class="arrow-highlight" d="M202 295 H142 M149 290 L141 295 L149 300" />
    <path class="arrow-support" d="M202 444 H134 M141 439 L133 444 L141 449" />

    <!-- 连线文字垫不透明底色，防止竖线穿字 -->
    <rect class="label-mask" x="45" y="142" width="96" height="24" rx="4" />
    <rect class="label-mask" x="51" y="283" width="84" height="24" rx="4" />
    <rect class="label-mask" x="59" y="432" width="68" height="24" rx="4" />

    <g text-anchor="middle">
      <text class="edge-label" x="93" y="159">几何和恒等式</text>
      <text class="edge-label" x="93" y="300">素数阶公式</text>
      <text class="edge-label" x="93" y="449">不可约性</text>
    </g>

    <!-- 右列三张 Mathlib 引理卡片 -->
    <rect class="card-lemma" x="202" y="131" width="168" height="46" rx="8" />
    <rect class="card-lemma card-highlight" x="202" y="267" width="168" height="56" rx="8" />
    <rect class="card-lemma" x="202" y="416" width="168" height="56" rx="8" />

    <g text-anchor="middle">
      <text class="lemma-code" x="286" y="158">geom_sum_mul</text>

      <text class="lemma-code" x="286" y="289">Polynomial.</text>
      <text class="lemma-code" x="286" y="309">cyclotomic_prime</text>

      <text class="lemma-code" x="286" y="438">Polynomial.</text>
      <text class="lemma-code" x="286" y="458">cyclotomic.irreducible</text>
    </g>
  </svg>

  <figcaption><strong>图 1｜三条引理如何接起一个不可约性证明。</strong>横向（窄屏为左列）是数学推导，纵向（窄屏为右列）是每一步所用的库引理。改绘自 LeanSearch v2 图 1。<sup><a href="#ref-4" aria-label="参考文献 4">[4]</a></sup></figcaption>
</figure>

<p>LeanSearch v2 的推理模式先写草图，为每一步分别查询。过滤后某一步可以一条引理都不留，这个空结果会提醒系统修改草图。在 MathlibMPR 的六十九条定理上，每题取前十个候选，平均命中所需前提组的 46.1%，组内找到任一可替代引理就算命中。把要求改为找齐至少一条已标注路线的所有组，达标的题目占 30.4%。要知道这些候选能否帮忙证完，还要让证明模型实际使用它们。<sup><a href="#ref-4" aria-label="参考文献 4">[4]</a></sup></p>

<p class="table-hint">左右滑动查看完整表格</p>
<div class="table-scroll" role="region" aria-labelledby="tbl-1" tabindex="0">
  <table>
    <caption id="tbl-1">
      表 1｜同一证明模型在最多八轮修正内交出的完整证明
      <span>固定 Claude Sonnet 4.5 与最多 8 轮修正；来源：LeanSearch v2 表 3、附录 B.4。<sup><a href="#ref-4" aria-label="参考文献 4">[4]</a></sup></span>
    </caption>
    <thead>
      <tr>
        <th scope="col">检索配置</th>
        <th scope="col">首轮及出错后如何取材</th>
        <th scope="col" class="num">FATE-H（100 题）</th>
        <th scope="col" class="num">MathlibMPR-Prop（50 题）</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <th scope="row">无检索</th>
        <td>首轮读题，出错后读 Lean 反馈</td>
        <td class="num">4/100</td>
        <td class="num">2/50</td>
      </tr>
      <tr>
        <th scope="row">v2 标准模式</th>
        <td>出错后按当前尝试查引理</td>
        <td class="num">14/100</td>
        <td class="num">5/50</td>
      </tr>
      <tr>
        <th scope="row">v2 推理模式</th>
        <td>首轮给草图和引理，出错后用标准模式</td>
        <td class="num">20/100</td>
        <td class="num">7/50</td>
      </tr>
    </tbody>
  </table>
</div>

<p>两组题上，先给路线和引理的配置都解出了最多题。这里固定了证明与修正所用的 Claude Sonnet 4.5，以及允许修正的轮数。推理模式同时改变了第一次看到引理的时机，也给出了使用引理的顺序，因此表中增益应归给这套检索配置。<sup><a href="#ref-4" aria-label="参考文献 4">[4]</a></sup></p>

## 把纸上的一步变成 Lean 里的一步

<p>有了正确的数学论证，仍可能写不出 Lean 能执行的证明。FATE 的专家检查了 DeepSeek-R1 在 FATE-H 上首次尝试时写下的自然语言证明，100 题里有 71 题思路正确；放宽到每题 64 次尝试，完整形式证明依然是零题。细看这 71 份答卷，有 70 份引用了不存在的库声明，或误用了已有声明。哪怕读者能看懂纸上的推理，Lean 仍需要一个适用于当前假设与目标的具体操作。<sup id="cite-5"><a href="#ref-5" aria-label="参考文献 5">[5]</a></sup></p>
<p>Chain of States 把这项翻译拆开。给定题目和一份文字证明，模型先列出一串预期的证明状态，每个状态列明此时有哪些假设、还欠哪些结论。接着在相邻两个状态之间试跑证明指令（tactic），对照 Lean 实际返回的状态。一条指令可以合法执行却把证明带到另一处；知道要到达哪里，系统便能针对偏差改写指令，也能放弃难以复现的中间状态，从当前位置直接尝试证完。<sup id="cite-6"><a href="#ref-6" aria-label="参考文献 6">[6]</a></sup></p>
<p>在版本兼容的 227 道 miniF2F-test 题上，作者报告的完整证明成功率为 69.2%。实验给了模型已有的文字证明，其中一部分还经过人工修订。这个结果回答的是手中已有一份论证时，有多少题能沿着它写出可执行的证明。<sup><a href="#ref-6" aria-label="参考文献 6">[6]</a></sup></p>

## 从起点重放，才知道搜索找到了证明

<p>Reap 面对的是一个形式目标，下一步往哪走也交给搜索。模型提出指令，Lean 执行后给出新状态。同一目标可以尝试不同指令，任选一条成功路线即可；一条指令若拆出几个独立子目标，就必须全部证完。个别指令可能引入辅助声明或推迟证明义务，因此搜索树把根标为完成后，Reap 还要恢复初始状态，重放选中的指令，再把重建的证明交给 Lean 做声明检查。<sup><a href="#ref-7" aria-label="参考文献 7">[7]</a></sup></p>
<p>这些经重放的轨迹又成为训练材料。策略学习在给定状态与库引理时选择哪条指令，价值模型学习估计余下的搜索成本，每个有效的顶层指令按一步计。最终的 Reaper-1 用 17 亿参数的策略与价值模型，另配独立前提选择器 PS-2。在 miniF2F-test 上，每题最多进行三十二次独立搜索，每次上限 8,192 次模拟，这套系统解出 195/244 题（79.9%）。<sup><a href="#ref-7" aria-label="参考文献 7">[7]</a></sup></p>

<p class="table-hint">左右滑动查看完整表格</p>
<div class="table-scroll" role="region" aria-labelledby="tbl-2" tabindex="0">
  <table>
    <caption id="tbl-2">
      表 2｜三个训练阶段都能证明的同一批 151 题
      <span>来源：Reap v1 表 5、附录 C.1–C.3。<sup><a href="#ref-7" aria-label="参考文献 7">[7]</a></sup></span>
    </caption>
    <thead>
      <tr>
        <th scope="col">每题代表证明或对应搜索树的统计量</th>
        <th scope="col" class="num">监督训练后</th>
        <th scope="col" class="num">强化学习第 4 阶段</th>
        <th scope="col" class="num">强化学习第 5 阶段</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <th scope="row">顶层指令数，均值</th>
        <td class="num">21.7</td>
        <td class="num">11.2</td>
        <td class="num">5.2</td>
      </tr>
      <tr>
        <th scope="row">成功搜索树节点数，均值</th>
        <td class="num">2,368</td>
        <td class="num">162</td>
        <td class="num">119</td>
      </tr>
      <tr>
        <th scope="row">每条顶层指令的字符数，中位数</th>
        <td class="num">19</td>
        <td class="num">23</td>
        <td class="num">66</td>
      </tr>
    </tbody>
  </table>
</div>

<p>以“前 <i>n</i> 个非负整数的立方和等于它们总和的平方”为例，两个后期模型都用归纳法。第四阶段模型在等式上多次化简，又做了一次归纳。第五阶段模型很快用上归纳假设和求和公式，最后按奇偶分情形，用一条组合指令对两个分支做算术推理。模型既少走了一些弯路，也把更多操作写进了同一步。全搜索日志中，单次指令执行的中位耗时从监督训练后的 12.0 毫秒升到第五阶段的 43.2 毫秒。要估计总成本，既要数搜索走了多少步，也要看 Lean 在每一步里做了多少工作。<sup><a href="#ref-7" aria-label="参考文献 7">[7]</a></sup></p>
<p>Haocheng Ju 与董彬在综述中提出，证明的数学价值还在于揭示结构，给下一道题留下可用的方法。立方和的两份证明都通过了 Lean 检查，把它们并排读，才看得见第二次归纳原来可以省掉。分圆多项式的例子也给读者留下了一条线索：下次遇到几何和的不可约性问题，可以先试着辨认它是哪一个多项式。<sup><a href="#ref-4" aria-label="参考文献 4">[4]</a></sup><sup><a href="#ref-7" aria-label="参考文献 7">[7]</a></sup><sup id="cite-8"><a href="#ref-8" aria-label="参考文献 8">[8]</a></sup></p>

<details class="supplement">
  <summary>版本、样本与判定口径</summary>
  <p>沿用旧稿列明的论文版本。Aria v1 的判别阈值为 0.9，专家复核的是全部 69 条可编译输出。表 1 的成功要求 Lean 检查通过且没有有效的 <code>sorry</code> 占位。表 2 每题选首次成功轮次的已验证证明，同轮并列时取顶层指令较少者；执行延迟另取三阶段搜索的已完成指令记录。各项任务由各论文独立评测，尚无从文献输入一路到重放证明的联合成功率。</p>
</details>

## 来源与阅读范围

<ol class="reference-list">
  <li id="ref-1">
    <cite>Aria v1</cite>。§3.1–3.2、图 1 给出定义合成与语义判读方法，§4 表 1–2 给出两种验收计数，附录 B.3 核对群参数。
    <a href="https://arxiv.org/pdf/2510.04520v1#page=4" target="_blank" rel="noopener">方法</a> ·
    <a href="https://arxiv.org/pdf/2510.04520v1#page=8" target="_blank" rel="noopener">专家复核</a> ·
    <a href="https://arxiv.org/pdf/2510.04520v1#page=22" target="_blank" rel="noopener">四元数群例</a>
    <a class="reference-backlink" href="#cite-1" aria-label="返回正文引用 1">↩</a>
  </li>
  <li id="ref-2">
    <cite>A Semantic Search Engine for Mathlib4</cite>。§1 的柯西中值定理与 §3.1 的库声明索引。
    <a href="https://arxiv.org/pdf/2403.13310v2#page=1" target="_blank" rel="noopener">原文</a>
    <a class="reference-backlink" href="#cite-2" aria-label="返回正文引用 2">↩</a>
  </li>
  <li id="ref-3">
    <cite>Matlas</cite>。§3、图 2–4 的语料规模、文档内依赖与陈述展开。
    <a href="https://arxiv.org/pdf/2604.17484v1#page=3" target="_blank" rel="noopener">原文</a>
    <a class="reference-backlink" href="#cite-3" aria-label="返回正文引用 3">↩</a>
  </li>
  <li id="ref-4">
    <cite>LeanSearch v2</cite>。图 1 的分圆多项式例，§3.2 的路线修订，§4.2–4.3 表 2–3 的路线覆盖与完整证明，附录 B.4 表 7 的检索时机。
    <a href="https://arxiv.org/pdf/2605.13137v2#page=2" target="_blank" rel="noopener">示例</a> ·
    <a href="https://arxiv.org/pdf/2605.13137v2#page=8" target="_blank" rel="noopener">评测</a> ·
    <a href="https://arxiv.org/pdf/2605.13137v2#page=20" target="_blank" rel="noopener">证明配置</a>
    <a class="reference-backlink" href="#cite-4" aria-label="返回正文引用 4">↩</a>
  </li>
  <li id="ref-5">
    <cite>FATE v4</cite>。§4.3–4.4 表 2–3 的文字证明判读、形式证明成功率与错误分类。
    <a href="https://arxiv.org/pdf/2511.02872v4#page=7" target="_blank" rel="noopener">原文</a>
    <a class="reference-backlink" href="#cite-5" aria-label="返回正文引用 5">↩</a>
  </li>
  <li id="ref-6">
    <cite>Translating Informal Proofs into Formal Proofs Using a Chain of States</cite>。§4–5、算法 1 的状态修正，§6.1.2、§6.3 表 3 的题集与输入。
    <a href="https://arxiv.org/pdf/2512.10317v2#page=19" target="_blank" rel="noopener">算法</a> ·
    <a href="https://arxiv.org/pdf/2512.10317v2#page=21" target="_blank" rel="noopener">评测</a>
    <a class="reference-backlink" href="#cite-6" aria-label="返回正文引用 6">↩</a>
  </li>
  <li id="ref-7">
    <cite>Reap v1</cite>。§3.1–3.2 的重放与训练，§4 表 1、3、5 的解题与同题比较，附录 C 表 8–10 的样本口径，附录 D 代码清单 1–2 的立方和证明。
    <a href="https://arxiv.org/pdf/2611.02678v1#page=5" target="_blank" rel="noopener">方法</a> ·
    <a href="https://arxiv.org/pdf/2611.02678v1#page=9" target="_blank" rel="noopener">同题比较</a> ·
    <a href="https://arxiv.org/pdf/2611.02678v1#page=17" target="_blank" rel="noopener">执行延迟</a> ·
    <a href="https://arxiv.org/pdf/2611.02678v1#page=19" target="_blank" rel="noopener">证明原例</a>
    <a class="reference-backlink" href="#cite-7" aria-label="返回正文引用 7">↩</a>
  </li>
  <li id="ref-8">
    <cite>AI for Mathematics: Progress, Challenges, and Prospects</cite>。§4 对语义核验及证明如何产生可复用方法的讨论。
    <a href="https://arxiv.org/pdf/2601.13209v5#page=19" target="_blank" rel="noopener">原文</a>
    <a class="reference-backlink" href="#cite-8" aria-label="返回正文引用 8">↩</a>
  </li>
</ol>

</div>
