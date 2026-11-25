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
  <svg class="flow-wide" viewBox="0 0 960 460" role="img" aria-labelledby="fig-wide-title">
    <title id="fig-wide-title">同一个终局优势怎样分到每一步（宽屏示意图）</title>
    <!-- 分组底框 -->
    <rect data-tone="blue-group" x="220" y="14" width="544" height="192" rx="10" />
    <rect data-tone="green-group" x="220" y="244" width="544" height="202" rx="10" />
    <text data-kind="blue-label" x="236" y="38">DeltaTTG</text>
    <text data-kind="green-label" x="236" y="268">ProAS</text>

    <!-- 左列共用节点 -->
    <rect x="16" y="96" width="170" height="52" rx="8" />
    <rect x="16" y="182" width="170" height="52" rx="8" />
    <rect x="16" y="268" width="170" height="48" rx="8" />
    <g text-anchor="middle">
      <text x="101" y="127">同一任务的多条尝试</text>
      <text x="101" y="213">终局奖励与组内比较</text>
      <text x="101" y="297">轨迹优势 A</text>
    </g>
    <path data-tone="neutral" d="M101 148 V182 M96 175 L101 182 L106 175" />
    <path data-tone="neutral" d="M101 234 V268 M96 261 L101 268 L106 261" />

    <!-- 轨迹优势 A 分流至两组（走组间通道 y=225 不穿框） -->
    <path data-tone="neutral" d="M186 292 H204 V225 H646" />
    <path data-tone="neutral" d="M646 225 V96 H654 M647 91 L654 96 L647 101" />
    <path data-tone="neutral" d="M646 225 V314 H658 M651 309 L658 314 L651 319" />

    <!-- 中列上组：DeltaTTG -->
    <rect data-tone="blue-node" x="234" y="52" width="152" height="54" rx="7" />
    <rect data-tone="blue-node" x="234" y="124" width="152" height="48" rx="7" />
    <rect data-tone="blue-node" x="408" y="82" width="108" height="58" rx="7" />
    <rect data-tone="blue-highlight" x="536" y="56" width="100" height="48" rx="7" />
    <rect data-tone="blue-node" x="654" y="56" width="100" height="52" rx="7" />

    <g text-anchor="middle">
      <text x="310" y="75">历史轨迹的前缀与</text>
      <text x="310" y="96">剩余 token 标签</text>
      <text x="310" y="153">本步前后两段历史</text>
      <text x="462" y="106">冻结的</text>
      <text x="462" y="127">进度估计器</text>
      <text x="586" y="85">剩余量变化</text>
      <text x="704" y="78">按 A 的正负</text>
      <text x="704" y="98">分配</text>
      <text data-size="sm" x="704" y="130">正优势侧重推进</text>
      <text data-size="sm" x="704" y="150">负优势侧重倒退</text>
    </g>

    <path data-tone="blue" d="M386 79 H397 V102 H408 M401 97 L408 102 L401 107" />
    <path data-tone="blue" d="M386 148 H397 V120 H408 M401 115 L408 120 L401 125" />
    <path data-tone="blue" d="M516 111 H526 V80 H536 M529 75 L536 80 L529 85" />
    <path data-tone="blue" d="M636 78 H654 M647 73 L654 78 L647 83" />

    <!-- 中列下组：ProAS -->
    <rect data-tone="green-node" x="234" y="280" width="108" height="40" rx="7" />
    <rect data-tone="green-node" x="234" y="386" width="132" height="46" rx="7" />
    <rect data-tone="green-node" x="388" y="332" width="96" height="42" rx="7" />
    <rect data-tone="green-node" x="388" y="280" width="96" height="40" rx="7" />
    <rect data-tone="green-highlight" x="514" y="302" width="122" height="56" rx="7" />
    <rect data-tone="green-node" x="658" y="300" width="96" height="52" rx="7" />

    <path data-tone="green" d="M342 300 H365 V344 H388 M381 339 L388 344 L381 349" />
    <path data-tone="green" data-dash="true" d="M366 409 H376 V362 H388 M381 357 L388 362 L381 367" />
    <path data-tone="green" d="M484 300 H499 V320 H514 M507 315 L514 320 L507 325" />
    <path data-tone="green" d="M484 353 H499 V340 H514 M507 335 L514 340 L507 345" />
    <path data-tone="green" d="M636 330 H658 M651 325 L658 330 L651 335" />

    <!-- 虚线文字垫底色防穿线 -->
    <rect data-kind="text-bg-green" x="343" y="376" width="66" height="20" rx="3" />
    <g text-anchor="middle">
      <text x="288" y="305">成功示范</text>
      <text x="300" y="405">经验证的</text>
      <text x="300" y="424">新成功路径</text>
      <text data-size="sm" x="376" y="391">下轮并入</text>
      <text x="436" y="305">当前轨迹</text>
      <text x="436" y="358">参考图</text>
      <text x="575" y="325">图上有依据？</text>
      <text x="575" y="346">首次抵达？</text>
      <text x="706" y="322">按 A 的正负</text>
      <text x="706" y="342">分配</text>
    </g>
    <g text-anchor="end">
      <text data-size="sm" x="754" y="384">正优势屏蔽无依据动作</text>
      <text data-size="sm" x="754" y="406">负优势按后续未推进步数加权（含本步）</text>
    </g>

    <!-- 右列共用节点 -->
    <rect x="788" y="174" width="156" height="54" rx="8" />
    <rect x="788" y="264" width="156" height="50" rx="8" />
    <g text-anchor="middle">
      <text x="866" y="206">各动作的训练优势</text>
      <text x="866" y="294">更新策略</text>
    </g>
    <path data-tone="blue" d="M754 82 H774 V192 H788 M781 187 L788 192 L781 197" />
    <path data-tone="green" d="M754 326 H774 V210 H788 M781 205 L788 210 L781 215" />
    <path data-tone="neutral" d="M866 228 V264 M861 257 L866 264 L871 257" />
  </svg>

  <svg class="flow-narrow" viewBox="0 0 348 820" role="img" aria-labelledby="fig-narrow-title">
    <title id="fig-narrow-title">同一个终局优势怎样分到每一步（窄屏示意图）</title>
    <!-- 顶部共用节点 -->
    <rect x="44" y="8" width="252" height="36" rx="7" />
    <rect x="44" y="54" width="252" height="36" rx="7" />
    <rect x="95" y="100" width="150" height="34" rx="7" />
    <g text-anchor="middle">
      <text x="170" y="31">同一任务的多条尝试</text>
      <text x="170" y="77">终局奖励与组内比较</text>
      <text x="170" y="122">轨迹优势 A</text>
    </g>
    <path data-tone="neutral" d="M170 44 V54 M166 49 L170 54 L174 49" />
    <path data-tone="neutral" d="M170 90 V100 M166 95 L170 100 L174 95" />

    <!-- 轨迹优势 A 沿右侧干线分流 -->
    <path data-tone="neutral" d="M245 117 H338 V564 H320 M326 559 L320 564 L326 569" />
    <path data-tone="neutral" d="M338 315 H320 M326 310 L320 315 L326 320" />

    <!-- 中段上：DeltaTTG -->
    <rect data-tone="blue-group" x="10" y="152" width="320" height="218" rx="8" />
    <text data-kind="blue-label" x="22" y="174">DeltaTTG</text>
    <rect data-tone="blue-node" x="20" y="186" width="146" height="44" rx="6" />
    <rect data-tone="blue-node" x="174" y="186" width="146" height="44" rx="6" />
    <rect data-tone="blue-node" x="66" y="244" width="208" height="36" rx="6" />
    <rect data-tone="blue-highlight" x="20" y="296" width="122" height="38" rx="6" />
    <rect data-tone="blue-node" x="172" y="296" width="148" height="38" rx="6" />
    <g text-anchor="middle">
      <text x="93" y="204">历史轨迹前缀与</text>
      <text x="93" y="222">剩余 token 标签</text>
      <text x="247" y="213">本步前后两段历史</text>
      <text x="170" y="267">冻结的进度估计器</text>
      <text x="81" y="320">剩余量变化</text>
      <text x="246" y="320">按 A 的正负分配</text>
      <text data-size="sm" x="170" y="355">正优势侧重推进 · 负优势侧重倒退</text>
    </g>
    <path data-tone="blue" d="M93 230 V244 M89 239 L93 244 L97 239" />
    <path data-tone="blue" d="M247 230 V244 M243 239 L247 244 L251 239" />
    <path data-tone="blue" d="M120 280 V288 H81 V296 M77 291 L81 296 L85 291" />
    <path data-tone="blue" d="M142 315 H172 M166 310 L172 315 L166 320" />

    <!-- 中段下：ProAS -->
    <rect data-tone="green-group" x="10" y="384" width="320" height="296" rx="8" />
    <text data-kind="green-label" x="22" y="406">ProAS</text>
    <rect data-tone="green-node" x="20" y="418" width="106" height="36" rx="6" />
    <rect data-tone="green-node" x="164" y="418" width="106" height="36" rx="6" />
    <rect data-tone="green-node" x="20" y="478" width="156" height="44" rx="6" />
    <rect data-tone="green-node" x="208" y="478" width="112" height="44" rx="6" />
    <rect data-tone="green-highlight" x="20" y="542" width="144" height="46" rx="6" />
    <rect data-tone="green-node" x="184" y="546" width="136" height="38" rx="6" />

    <path data-tone="green" d="M126 436 H164 M158 431 L164 436 L158 441" />
    <path data-tone="green" data-dash="true" d="M98 478 V464 H217 V454 M213 459 L217 454 L221 459" />
    <path data-tone="green" d="M264 522 V532 H112 V542 M108 537 L112 542 L116 537" />
    <path data-tone="green" d="M196 454 V468 H92 V542 M88 537 L92 542 L96 537" />
    <path data-tone="green" d="M164 565 H184 M178 560 L184 565 L178 570" />

    <!-- 虚线文字垫底色防穿线 -->
    <rect data-kind="text-bg-green" x="128" y="454" width="64" height="18" rx="3" />
    <g text-anchor="middle">
      <text x="73" y="441">成功示范</text>
      <text x="217" y="441">参考图</text>
      <text x="98" y="497">经验证的</text>
      <text x="98" y="514">新成功路径</text>
      <text data-size="sm" x="160" y="468">下轮并入</text>
      <text x="264" y="505">当前轨迹</text>
      <text x="92" y="561">图上有依据？</text>
      <text x="92" y="579">首次抵达？</text>
      <text x="252" y="570">按 A 的正负分配</text>
      <text data-size="sm" x="170" y="616">正优势屏蔽无依据动作</text>
      <text data-size="sm" x="170" y="636">负优势按后续未推进步数加权（含本步）</text>
    </g>

    <!-- 底部共用节点 -->
    <rect x="66" y="706" width="208" height="38" rx="7" />
    <rect x="96" y="766" width="148" height="38" rx="7" />
    <g text-anchor="middle">
      <text x="170" y="730">各动作的训练优势</text>
      <text x="170" y="790">更新策略</text>
    </g>
    <path data-tone="blue" d="M246 334 V376 H333 V692 H194 V706 M190 701 L194 706 L198 701" />
    <path data-tone="green" d="M300 584 V662 H170 V706 M166 701 L170 706 L174 701" />
    <path data-tone="neutral" d="M170 744 V766 M166 761 L170 766 L174 761" />
  </svg>

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
