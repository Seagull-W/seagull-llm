---
title: "九种大模型强化学习框架如何组织一次策略更新"
description: "把生成服务搬到另一组 GPU，训练仍可能等整批回答到齐。反过来，训练和生成共用一组 GPU，也可以让慢任务跨过一次更新。比较这九种框架，值得追问的是谁安排生成与打分，哪批数据到齐就能更新，以及一次多轮交互在训练时算几份样本。"
tags: ["每日调研", "强化学习", "框架", "架构"]
date: "2026-10-31"
---

# 九种大模型强化学习框架如何组织一次策略更新

<div class="research-article">

<p class="lead">把生成服务搬到另一组 GPU，训练仍可能等整批回答到齐。反过来，训练和生成共用一组 GPU，也可以让慢任务跨过一次更新。比较这九种框架，值得追问的是谁安排生成与打分，哪批数据到齐就能更新，以及一次多轮交互在训练时算几份样本。<sup id="cite-1"><a href="#ref-1">[1]</a></sup><sup id="cite-9"><a href="#ref-9">[9]</a></sup></p>

## 谁决定下一步做什么

<p>
  假设要训练模型解题，同一道题先生成几种解法，按最终答案打分，再用同题解法之间的得分差异更新策略。在 TRL 里，想改变判分规则，只需给 <code>GRPOTrainer</code> 换一个奖励函数。训练器负责生成一批回答、打分，再切成小批供训练使用。接入 vLLM 可以改变回答在哪里生成，何时拿这一批回答来训练，仍由训练器决定。<sup><a href="#ref-1">[1]</a></sup>
</p>
<p>
  如果要改变的是整个算法顺序，例如先让当前策略作答，再让另一个模型评分，就要能直接表达两次调用之间的数据依赖。verl 把这个顺序写在单个控制器里，一次生成调用会分派给整组工作进程。在 HybridFlow 论文的图 5 中，控制器把结果的引用交给下一个模型，其工作进程再按各自负责的数据分片取回所需输出。算法作者可以在一处读懂流程，大批量的模型输出也能直接在工作进程间传递。<sup id="cite-2"><a href="#ref-2">[2]</a></sup>
</p>
<p>
  同样要改一条采样流程，写代码的位置可以很不同。slime 把多轮工具调用和验分留给自定义生成函数，再由主循环把采样结果交给训练端，更新后把权重送回生成端。<sup id="cite-3"><a href="#ref-3">[3]</a></sup> OpenRLHF 则按角色组织工作进程，策略、参考策略、价值模型和奖励模型可按训练配方分别建立。<sup id="cite-4"><a href="#ref-4">[4]</a></sup> 前者给任务作者一个编写交互逻辑的入口，后者让维护者能沿着角色找到相应的模型与设备。
</p>

## 设备分在哪里，训练在等谁

<p>
  生成时，模型逐个预测下一个词元。训练时，模型对已有回答计算梯度。两者使用同一份策略参数，适用的参数切分方式却可以不同。HybridFlow 即使让它们轮用同一批卡，也要在切换阶段时按下一阶段的布局重新组织权重。<sup><a href="#ref-2">[2]</a></sup> OpenRLHF 的源码还能看出设备布局对传输的影响：只有选用 NCCL、所有角色共置且关闭异步训练时，才通过 CUDA IPC 句柄在进程间交接权重。估算一次切换的时间，需要从训练完成算到生成端真正能接下一条请求。<sup><a href="#ref-4">[4]</a></sup>
</p>

<div class="table-scroll" role="region" aria-labelledby="tbl-1" tabindex="0">
  <table>
    <caption id="tbl-1">
      表 1｜沿同一轮更新观察三种执行路径
      <span>完整提示组指同一提示所需的多条独立轨迹都已返回；来源：TRL、Agent Lightning 与 AReaL 文档及论文。<sup><a href="#ref-1">[1]</a></sup><sup><a href="#ref-6">[6]</a></sup><sup><a href="#ref-9">[9]</a></sup></span>
    </caption>
    <thead>
      <tr>
        <th scope="col">执行路径</th>
        <th scope="col">训练与生成用卡</th>
        <th scope="col">何时开始更新</th>
        <th scope="col">更新时的生成工作</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <th scope="row">TRL · GRPO 的 vLLM 服务模式</th>
        <td>各用一组</td>
        <td>本次生成批次完成并打分</td>
        <td>常规训练循环等到下次生成调用</td>
      </tr>
      <tr>
        <th scope="row">Agent Lightning · 共置异步</th>
        <td>轮用同一组</td>
        <td>收够完整提示组，排空在途模型请求</td>
        <td>慢组保留，新的模型请求暂停</td>
      </tr>
      <tr>
        <th scope="row">AReaL · 论文中的异步流水线</th>
        <td>各用一组</td>
        <td>缓冲区收够一个训练批次</td>
        <td>继续解码，新权重到达时短暂停顿</td>
      </tr>
    </tbody>
  </table>
</div>
<p class="table-hint">表格可左右滑动查看。</p>

<figure class="figure" id="fig-wait">
  <svg class="flow-wide" viewBox="0 0 700 364" role="img" aria-labelledby="fig-wait-title">
    <title id="fig-wait-title">两种“等齐”的时间线</title>
    <!-- Group 1: TRL 服务模式 -->
    <text x="12" y="24" data-kind="label">TRL 服务模式</text>
    <text x="324" y="24" data-kind="sub" text-anchor="middle">开始更新</text>
    <text x="12" y="68" data-kind="sub">生成 GPU</text>
    <text x="12" y="126" data-kind="sub">训练 GPU</text>

    <rect x="116" y="42" width="140" height="42" rx="6" />
    <rect x="330" y="42" width="160" height="42" rx="6" data-kind="wait" />
    <rect x="536" y="42" width="150" height="42" rx="6" />
    <rect x="116" y="100" width="140" height="42" rx="6" data-kind="wait" />
    <rect x="330" y="100" width="160" height="42" rx="6" data-tone="training" />

    <g text-anchor="middle">
      <text x="186" y="69">整批生成</text>
      <text x="410" y="69">等待</text>
      <text x="611" y="69">下一批生成</text>
      <text x="186" y="127">等待</text>
      <text x="410" y="127">用已评分批次更新</text>
    </g>

    <path d="M324 32 V148" data-kind="sync" />
    <path d="M256 63 H293 V121 H324" />
    <polygon points="321,116 329,121 321,126" />
    <rect x="261" y="81" width="64" height="20" rx="3" data-kind="mask" />
    <text x="293" y="96" data-kind="edge" text-anchor="middle">评分完成</text>

    <path d="M490 121 H513 V63 H530" />
    <polygon points="527,58 535,63 527,68" />
    <rect x="491" y="81" width="44" height="20" rx="3" data-kind="mask" />
    <text x="513" y="96" data-kind="edge" text-anchor="middle">新权重</text>

    <line x1="12" y1="166" x2="688" y2="166" data-kind="divider" />

    <!-- Group 2: Agent Lightning 共置异步 -->
    <text x="12" y="194" data-kind="label">Agent Lightning 共置异步</text>
    <text x="408" y="194" data-kind="sub" text-anchor="middle">开始更新</text>
    <text x="12" y="240" data-kind="sub">提示组</text>
    <text x="12" y="316" data-kind="sub">共享 GPU</text>

    <rect x="116" y="214" width="118" height="40" rx="6" />
    <rect x="244" y="214" width="132" height="40" rx="6" data-kind="wait" />
    <rect x="566" y="214" width="120" height="40" rx="6" />

    <rect x="116" y="288" width="92" height="44" rx="6" />
    <rect x="226" y="284" width="166" height="52" rx="6" />
    <rect x="414" y="288" width="130" height="44" rx="6" data-tone="training" />
    <rect x="566" y="288" width="120" height="44" rx="6" />

    <g text-anchor="middle">
      <text x="175" y="240">快组已齐</text>
      <text x="310" y="240">慢组等工具</text>
      <text x="626" y="240">下一轮继续</text>
      <text x="162" y="316">生成</text>
      <text x="309" y="305">暂停新请求、</text>
      <text x="309" y="325">排空在途请求</text>
      <text x="479" y="316">更新</text>
      <text x="626" y="316">恢复生成</text>
    </g>

    <path d="M408 202 V342" data-kind="sync" />
    <path d="M376 234 H560" data-kind="dashed" />
    <polygon points="557,229 565,234 557,239" />

    <path d="M208 310 H220" />
    <polygon points="217,305 225,310 217,315" />
    <path d="M392 310 H408" />
    <polygon points="405,305 413,310 405,315" />
    <path d="M544 310 H560" />
    <polygon points="557,305 565,310 557,315" />

    <path d="M175 254 V270 H266 V278" />
    <polygon points="261,275 266,283 271,275" />
    <rect x="184" y="259" width="66" height="20" rx="3" data-kind="mask" />
    <text x="217" y="274" data-kind="edge" text-anchor="middle">已收够组</text>

    <text x="688" y="358" data-kind="sub" text-anchor="end">时间 →（块宽仅示先后）</text>
  </svg>

  <svg class="flow-narrow" viewBox="0 0 340 582" role="img" aria-labelledby="fig-wait-narrow-title">
    <title id="fig-wait-narrow-title">两种“等齐”的时间线（窄屏竖向版）</title>
    <!-- Group 1: TRL 服务模式 -->
    <text x="10" y="22" data-kind="label">TRL 服务模式</text>
    <text x="86" y="44" data-kind="sub" text-anchor="middle">生成 GPU</text>
    <text x="254" y="44" data-kind="sub" text-anchor="middle">训练 GPU</text>

    <rect x="14" y="54" width="144" height="40" rx="6" />
    <rect x="182" y="54" width="144" height="40" rx="6" data-kind="wait" />
    <rect x="14" y="128" width="144" height="40" rx="6" data-kind="wait" />
    <rect x="182" y="128" width="144" height="40" rx="6" data-tone="training" />
    <rect x="14" y="202" width="144" height="40" rx="6" />

    <g text-anchor="middle">
      <text x="86" y="79">整批生成</text>
      <text x="254" y="79">等待</text>
      <text x="86" y="153">等待</text>
      <text x="254" y="153">已评分批次更新</text>
      <text x="86" y="227">下一批生成</text>
    </g>

    <path d="M14 118 H326" data-kind="sync" />
    <path d="M86 94 V111 H254 V122" />
    <polygon points="249,119 254,127 259,119" />
    <rect x="136" y="101" width="68" height="20" rx="3" data-kind="mask" />
    <text x="170" y="115" data-kind="edge" text-anchor="middle">评分完成</text>

    <path d="M254 168 V185 H86 V196" />
    <polygon points="81,193 86,201 91,193" />
    <rect x="144" y="175" width="52" height="20" rx="3" data-kind="mask" />
    <text x="170" y="189" data-kind="edge" text-anchor="middle">新权重</text>

    <line x1="10" y1="260" x2="330" y2="260" data-kind="divider" />

    <!-- Group 2: Agent Lightning 共置异步 -->
    <text x="10" y="284" data-kind="label">Agent Lightning 共置异步</text>
    <text x="86" y="306" data-kind="sub" text-anchor="middle">提示组</text>
    <text x="254" y="306" data-kind="sub" text-anchor="middle">共享 GPU</text>

    <rect x="14" y="316" width="70" height="40" rx="6" />
    <rect x="90" y="316" width="72" height="40" rx="6" data-kind="wait" />
    <rect x="182" y="316" width="144" height="40" rx="6" />

    <rect x="182" y="388" width="144" height="50" rx="6" />
    <rect x="182" y="462" width="144" height="40" rx="6" data-tone="training" />
    <rect x="14" y="524" width="144" height="40" rx="6" />
    <rect x="182" y="524" width="144" height="40" rx="6" />

    <g text-anchor="middle">
      <text x="49" y="341">快组已齐</text>
      <text x="126" y="341">慢组等工具</text>
      <text x="254" y="341">生成</text>
      <text x="254" y="408">暂停新请求、</text>
      <text x="254" y="427">排空在途请求</text>
      <text x="254" y="487">更新</text>
      <text x="86" y="549">下一轮继续</text>
      <text x="254" y="549">恢复生成</text>
    </g>

    <path d="M176 452 H330" data-kind="sync" />
    <path d="M254 356 V382" />
    <polygon points="249,379 254,387 259,379" />
    <path d="M254 438 V456" />
    <polygon points="249,453 254,461 259,453" />
    <path d="M254 502 V518" />
    <polygon points="249,515 254,523 259,515" />

    <path d="M126 356 V508 H86 V518" data-kind="dashed" />
    <polygon points="81,515 86,523 91,515" />

    <path d="M49 356 V372 H210 V382" />
    <polygon points="205,379 210,387 215,379" />
    <rect x="96" y="362" width="68" height="20" rx="3" data-kind="mask" />
    <text x="130" y="376" data-kind="edge" text-anchor="middle">已收够组</text>
  </svg>
  <figcaption>
    <strong>图 1｜两种“等齐”的时间线。</strong>橙色虚线标出各自开始更新的时刻；TRL 服务模式需等整批生成并评分完成，Agent Lightning 共置异步在收够完整提示组并排空在途请求后即可更新，慢组跨过更新区继续。<sup><a href="#ref-1">[1]</a></sup><sup><a href="#ref-9">[9]</a></sup>
  </figcaption>
</figure>

<p>
  这里的“等”还可能发生在环境里。ROLL 为每个环境独立运行交互循环，一道题在等工具返回，另一道可以继续；但上层取批函数仍要等到收够指定数量的轨迹才返回。<sup id="cite-5"><a href="#ref-5">[5]</a></sup> Agent Lightning 按完整提示组取数，已经凑齐的组可以先训练，慢组留到下一轮，不过同一提示下用于比较奖励的几条回答仍须到齐。<sup><a href="#ref-9">[9]</a></sup> 诊断长尾时，应该先标出拖慢更新的是一次模型请求、一组回答，还是整个采样批次。
</p>

## 让生成领先几步，旧回答还能不能用

<p>
  在 AReaL 的生成池里，一条长答案可能写到一半，训练池已经完成更新。新权重送达后，生成端保留已写出的词元，丢弃用旧权重计算的键值缓存（KV cache），用新权重重算前缀后续写；同一答案的前后两段于是可能由不同版本生成。为限制版本差，控制器会暂缓可能超过陈旧度上限的新请求，训练时优先取较早的轨迹。<sup id="cite-6"><a href="#ref-6">[6]</a></sup> NeMo-RL 的异步 GRPO 则在缓冲区检查轨迹的年龄：若最多允许落后一个训练步，版本 v10 生成的轨迹在训练步 v11 仍能用，到 v12 就会被丢弃。<sup id="cite-7"><a href="#ref-7">[7]</a></sup>
</p>
<p>
  版本差也改变了优化目标。AReaL 为每个词元保留采样时的概率，用它修正旧策略采样带来的偏差，同时以本训练步更新前的策略为基准，裁剪新策略的变化幅度。这样，一条旧回答仍能提供学习信号，约束更新幅度的基准也能跟随最近的策略。表 2 中，上限同为四步时，换用解耦目标，分数由 23.3 升至 42.2，接近同步参照的 42.0；取消上限后，即使用解耦目标也只得到 36.9。<sup><a href="#ref-6">[6]</a></sup>
</p>

<div class="table-scroll" role="region" aria-labelledby="tbl-2" tabindex="0">
  <table>
    <caption id="tbl-2">
      表 2｜同一 1.5B 模型数学消融，训练 250 步后的 AIME 2024 评测分数
      <span>同步参照只报告一个值（42.0），异步两列逐行对应论文表 2 的同一陈旧度上限。<sup><a href="#ref-6">[6]</a></sup></span>
    </caption>
    <thead>
      <tr>
        <th scope="col">最大陈旧度（训练步）</th>
        <th scope="col" class="num">常规 PPO</th>
        <th scope="col" class="num">解耦 PPO</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <th scope="row">1</th>
        <td class="num">41.8</td>
        <td class="num">42.1</td>
      </tr>
      <tr>
        <th scope="row">2</th>
        <td class="num">40.0</td>
        <td class="num">41.8</td>
      </tr>
      <tr>
        <th scope="row">4</th>
        <td class="num">23.3</td>
        <td class="num">42.2</td>
      </tr>
      <tr>
        <th scope="row">8</th>
        <td class="num">35.7</td>
        <td class="num">41.0</td>
      </tr>
      <tr>
        <th scope="row">16</th>
        <td class="num">35.8</td>
        <td class="num">38.7</td>
      </tr>
      <tr>
        <th scope="row">无上限</th>
        <td class="num">34.0</td>
        <td class="num">36.9</td>
      </tr>
    </tbody>
  </table>
</div>
<p class="table-hint">表格可左右滑动查看。</p>

## 一次交互切成三段，奖励应该算几次

<p>
  在 SkyRL 的 Gym 接口里，环境收到动作就返回下一条观察、奖励和结束标记，训练系统可以逐步收集这些量。<sup id="cite-8"><a href="#ref-8">[8]</a></sup> 如果已有一个会查文件、运行测试、压缩对话历史的编程智能体，交互顺序已经写在应用里。Agent Lightning 让应用把模型请求发往网关，网关按任务执行编号记录提示和回答的词元编号，以及回答中每个词元被采到的对数概率；训练端拿到这些调用后，还要判断哪些可以接成同一条样本。<sup><a href="#ref-9">[9]</a></sup>
</p>
<p>
  拼接要求前一次调用的提示和回答，在词元层面恰好构成下一次提示的前缀。即使屏幕上的文字相同，重新分词也可能改变词元边界；如果智能体压缩了对话历史，连文字前缀也会改变。Agent Lightning 遇到前缀不匹配就另起一段，保留模型当时真正看到的上下文。在论文图 10 的编程智能体实验中，平均只有 36% 的完整轨迹能合成一条训练样本，每条轨迹平均产生 2.41 条样本。<sup><a href="#ref-9">[9]</a></sup>
</p>
<p>
  分段会改变奖励的分母。设同题两次尝试一次成功、一次失败，奖励分别为 1 和 0。如果成功轨迹切成三段，失败轨迹只有一段，按样本行求平均就会把组内平均奖励从 ½ 推到 ¾，尽管解出题的仍只有一次。Agent Lightning 先把每次尝试的奖励与组内其他尝试比较，算出各自的优势，再让同一尝试的各个片段继承这个值；算损失时，先在每条轨迹内对所有回答词元求平均，再对轨迹等权平均。这样，训练时多占了两行的那次成功，仍只占一次尝试的份额。<sup><a href="#ref-9">[9]</a></sup>
</p>

<figure class="figure" id="fig-segment">
  <svg class="flow-wide" viewBox="0 0 700 338" role="img" aria-labelledby="fig-segment-title">
    <title id="fig-segment-title">切分样本怎样改变组内平均奖励</title>
    <!-- Left column: 同一道题 -->
    <rect x="14" y="24" width="148" height="236" rx="8" data-kind="group" />
    <text x="88" y="48" data-kind="label" text-anchor="middle">同一道题</text>
    <rect x="28" y="70" width="120" height="46" rx="6" />
    <rect x="28" y="192" width="120" height="46" rx="6" />
    <g text-anchor="middle">
      <text x="88" y="99">成功 · 1</text>
      <text x="88" y="221">失败 · 0</text>
    </g>

    <!-- Middle column: 按轨迹分组 -->
    <rect x="220" y="16" width="186" height="162" rx="8" data-kind="group" />
    <rect x="236" y="28" width="104" height="36" rx="6" />
    <rect x="236" y="72" width="104" height="36" rx="6" />
    <rect x="236" y="116" width="104" height="36" rx="6" />
    <g text-anchor="middle">
      <text x="288" y="52">片段 A1</text>
      <text x="288" y="96">片段 A2</text>
      <text x="288" y="140">片段 A3</text>
    </g>
    <text x="364" y="52" text-anchor="middle">1</text>
    <text x="364" y="96" text-anchor="middle">1</text>
    <text x="364" y="140" text-anchor="middle">1</text>
    <text x="313" y="170" data-kind="edge" text-anchor="middle">继承本轨迹的优势</text>

    <rect x="220" y="190" width="186" height="78" rx="8" data-kind="group" />
    <rect x="236" y="200" width="104" height="36" rx="6" />
    <text x="288" y="224" text-anchor="middle">片段 B1</text>
    <text x="364" y="224" text-anchor="middle">0</text>
    <text x="313" y="258" data-kind="edge" text-anchor="middle">继承本轨迹的优势</text>

    <!-- Arrows Left -> Middle -->
    <path d="M148 93 L230 46" />
    <polygon points="225,43 235,43 230,51" />
    <path d="M148 93 H230" />
    <polygon points="227,88 235,93 227,98" />
    <path d="M148 93 L230 134" />
    <polygon points="229,129 235,136 225,138" />
    <path d="M148 215 H230" />
    <polygon points="227,210 235,215 227,220" />

    <!-- Right column: 两个结果框 -->
    <rect x="462" y="52" width="224" height="76" rx="8" />
    <rect x="462" y="192" width="224" height="76" rx="8" data-tone="training" />
    <g text-anchor="middle">
      <text x="574" y="81" data-kind="bold">按片段计</text>
      <text x="574" y="110">(1 + 1 + 1 + 0) / 4 = ¾</text>
      <text x="574" y="221" data-kind="bold">按任务尝试计</text>
      <text x="574" y="250">(1 + 0) / 2 = ½</text>
    </g>

    <!-- Thin lines Middle -> Upper Result -->
    <path d="M380 46 H426 V90 H456" />
    <path d="M380 90 H456" />
    <path d="M380 134 H426 V90" />
    <path d="M380 218 H426 V90" />
    <polygon points="453,85 461,90 453,95" />

    <!-- Thick bypass lines Left -> Lower Result -->
    <path d="M148 106 H184 V288 H444 V230 H456" data-kind="thick" />
    <path d="M88 238 V288 H184" data-kind="thick" />
    <polygon points="452,224 461,230 452,236" data-kind="thick" />

    <text x="686" y="326" data-kind="sub" text-anchor="end">两条路线只比较奖励基线</text>
  </svg>

  <svg class="flow-narrow" viewBox="0 0 340 528" role="img" aria-labelledby="fig-segment-narrow-title">
    <title id="fig-segment-narrow-title">切分样本怎样改变组内平均奖励（窄屏竖向版）</title>
    <!-- Top: 同一道题 -->
    <rect x="16" y="10" width="308" height="86" rx="8" data-kind="group" />
    <text x="170" y="30" data-kind="label" text-anchor="middle">同一道题</text>
    <rect x="28" y="42" width="132" height="40" rx="6" />
    <rect x="180" y="42" width="132" height="40" rx="6" />
    <g text-anchor="middle">
      <text x="94" y="67">成功 · 1</text>
      <text x="246" y="67">失败 · 0</text>
    </g>

    <!-- Middle: 分段 -->
    <rect x="16" y="124" width="160" height="188" rx="8" data-kind="group" />
    <rect x="28" y="136" width="136" height="34" rx="6" />
    <rect x="28" y="180" width="136" height="34" rx="6" />
    <rect x="28" y="224" width="136" height="34" rx="6" />
    <g text-anchor="middle">
      <text x="96" y="159">片段 A1 · 1</text>
      <text x="96" y="203">片段 A2 · 1</text>
      <text x="96" y="247">片段 A3 · 1</text>
    </g>
    <text x="96" y="286" data-kind="edge" text-anchor="middle">继承本轨迹的优势</text>

    <rect x="186" y="124" width="138" height="100" rx="8" data-kind="group" />
    <rect x="198" y="136" width="114" height="34" rx="6" />
    <text x="255" y="159" text-anchor="middle">片段 B1 · 0</text>
    <text x="255" y="198" data-kind="edge" text-anchor="middle">继承本轨迹的优势</text>

    <!-- Arrows Top -> Middle -->
    <path d="M94 82 V130" />
    <polygon points="89,127 94,135 99,127" />
    <path d="M246 82 V130" />
    <polygon points="241,127 246,135 251,127" />

    <!-- Bottom: 两个结果框 -->
    <rect x="16" y="344" width="308" height="64" rx="8" />
    <rect x="16" y="432" width="308" height="66" rx="8" data-tone="training" />
    <g text-anchor="middle">
      <text x="170" y="370" data-kind="bold">按片段计</text>
      <text x="170" y="395">(1 + 1 + 1 + 0) / 4 = ¾</text>
      <text x="170" y="458" data-kind="bold">按任务尝试计</text>
      <text x="170" y="484">(1 + 0) / 2 = ½</text>
    </g>

    <!-- Thin lines Middle -> Upper Result -->
    <path d="M96 312 V338" />
    <polygon points="91,335 96,343 101,335" />
    <path d="M255 224 V338" />
    <polygon points="250,335 255,343 260,335" />

    <!-- Thick bypass lines Top -> Lower Result -->
    <path d="M28 62 H6 V465 H10" data-kind="thick" />
    <polygon points="7,459 15,465 7,471" data-kind="thick" />
    <path d="M312 62 H334 V465 H330" data-kind="thick" />
    <polygon points="333,459 325,465 333,471" data-kind="thick" />

    <text x="170" y="520" data-kind="sub" text-anchor="middle">两条路线只比较奖励基线</text>
  </svg>
  <figcaption>
    <strong>图 2｜切分样本怎样改变组内平均奖励。</strong>按片段直接平均会抬高成功尝试的权重；先按轨迹计算优势再由片段继承、按轨迹等权平均损失，可保持与任务尝试一致的奖励基线。<sup><a href="#ref-9">[9]</a></sup>
  </figcaption>
</figure>

<p>
  选择架构时，可以拿一条真实的慢任务走完这个闭环。记录它何时交回模型请求、何时凑齐可训练的数据、以哪个策略版本被使用，以及最终对更新贡献几份权重。若要比较改造的收益，就在相同设备预算下看多久能达到同一评测分数；这样既能计入少等一批回答省下的时间，也能计入重算前缀、丢弃过期轨迹和重新组织样本花掉的时间。
</p>

<details class="supplement">
  <summary>统计口径与版本</summary>
  <p>
    表 1 比较明确列出的执行路径。Agent Lightning 的共置异步是可选模式，完整组数达到更新门槛后，网关仍须等在途模型请求结束。表 2 的陈旧度按整批训练步计，一个训练步内可有多次小批更新。图 10 的 36% 与 2.41 均为作者在“按轨迹算优势并按轨迹归一化”这一次编程智能体训练过程中取的均值。实现细节按下列标签或提交定位，数值取自原论文。<sup><a href="#ref-6">[6]</a></sup><sup><a href="#ref-9">[9]</a></sup>
  </p>
</details>

## 来源与阅读范围

<ol class="reference-list">
  <li id="ref-1">
    Hugging Face TRL v1.17.1，奖励函数、生成批次的拆分与缓存、vLLM 更新后再采样。
    <a href="https://github.com/huggingface/trl/blob/v1.17.1/trl/trainer/grpo_trainer.py#L179-L193" target="_blank" rel="noopener">GRPOTrainer 源码（第 179 行起）</a> ·
    <a href="https://github.com/huggingface/trl/blob/v1.17.1/trl/trainer/grpo_trainer.py#L1591-L1622" target="_blank" rel="noopener">取批（第 1591–1622 行）</a> ·
    <a href="https://github.com/huggingface/trl/blob/v1.17.1/trl/trainer/grpo_trainer.py#L1832-L1852" target="_blank" rel="noopener">生成（第 1832–1852 行）</a> ·
    <a href="https://github.com/huggingface/trl/blob/v1.17.1/docs/source/vllm_integration.md#server-mode" target="_blank" rel="noopener">vLLM 集成（Server Mode）</a>
    <a class="reference-backlink" href="#cite-1" aria-label="返回正文引用">↩</a>
  </li>
  <li id="ref-2">
    Sheng 等，<cite>HybridFlow</cite>，§4.1 图 5b（引用与实际数据路径）、§5.2 图 7（权重布局切换）；verl 官方文档给出了生成调用示例。
    <a href="https://arxiv.org/html/2409.19256v2#S4.F5" target="_blank" rel="noopener">论文图 5</a> ·
    <a href="https://arxiv.org/html/2409.19256v2#S5.SS2" target="_blank" rel="noopener">§5.2</a> ·
    <a href="https://verl.readthedocs.io/en/latest/single_controller.html" target="_blank" rel="noopener">The Design of verl.single_controller</a>
    <a class="reference-backlink" href="#cite-2" aria-label="返回正文引用">↩</a>
  </li>
  <li id="ref-3">
    slime，提交 <code>540ea91</code>，自定义生成函数与普通训练入口的生成、更新、权重交接。
    <a href="https://github.com/THUDM/slime/blob/540ea919e45b8b929198abce008a103be9cfc779/README.md#L65-L71" target="_blank" rel="noopener">架构说明（第 65–71 行）</a> ·
    <a href="https://github.com/THUDM/slime/blob/540ea919e45b8b929198abce008a103be9cfc779/train.py#L47-L96" target="_blank" rel="noopener">train.py（第 47–96 行）</a>
    <a class="reference-backlink" href="#cite-3" aria-label="返回正文引用">↩</a>
  </li>
  <li id="ref-4">
    OpenRLHF，提交 <code>dc2a7ad</code>，角色进程组的构造与权重同步分支。
    <a href="https://github.com/OpenRLHF/OpenRLHF/blob/dc2a7ad326f619fc5a47737ea47d1920ce2c0b53/openrlhf/cli/train_ppo_ray.py#L84-L142" target="_blank" rel="noopener">train_ppo_ray.py（第 84–142 行）</a> ·
    <a href="https://github.com/OpenRLHF/OpenRLHF/blob/dc2a7ad326f619fc5a47737ea47d1920ce2c0b53/openrlhf/trainer/ray/ppo_actor.py#L99-L105" target="_blank" rel="noopener">ppo_actor.py（第 99–105 行）</a>
    <a class="reference-backlink" href="#cite-4" aria-label="返回正文引用">↩</a>
  </li>
  <li id="ref-5">
    ROLL，环境各自推进与训练端按批取数。
    <a href="https://alibaba.github.io/ROLL/docs/User%20Guides/Advanced%20Features/async_parallel_rollout/#implementation-principle" target="_blank" rel="noopener">Agentic Asynchronous Parallel Rollout（Implementation Principle）</a>
    <a class="reference-backlink" href="#cite-5" aria-label="返回正文引用">↩</a>
  </li>
  <li id="ref-6">
    AReaL，v5，§4.1 图 3 的在途更新，§5.1–5.2 的限流与式（5），§7.4 图 5、表 2 的数学消融。
    <a href="https://arxiv.org/html/2505.24298v5#S4.SS1" target="_blank" rel="noopener">系统流程</a> ·
    <a href="https://arxiv.org/html/2505.24298v5#S5" target="_blank" rel="noopener">陈旧度与解耦目标</a> ·
    <a href="https://arxiv.org/html/2505.24298v5#S7.T2" target="_blank" rel="noopener">表 2 原始列头与分数</a>
    <a class="reference-backlink" href="#cite-6" aria-label="返回正文引用">↩</a>
  </li>
  <li id="ref-7">
    NeMo-RL v0.7.0，异步 GRPO 缓冲区的生成版本、目标训练步与年龄上限。
    <a href="https://github.com/NVIDIA-NeMo/RL/blob/v0.7.0/docs/guides/async-grpo.md#L100-L113" target="_blank" rel="noopener">Async GRPO（Weight Version Tracking）</a>
    <a class="reference-backlink" href="#cite-7" aria-label="返回正文引用">↩</a>
  </li>
  <li id="ref-8">
    SkyRL，提交 <code>50cfa01</code>，环境动作与返回值。
    <a href="https://github.com/NovaSky-AI/SkyRL/blob/50cfa014aff1c42292fdd7811f24ff96d4aa3600/skyrl-gym/skyrl_gym/core.py#L35-L71" target="_blank" rel="noopener">SkyRL-Gym（Env.step 与 Env.init）</a>
    <a class="reference-backlink" href="#cite-8" aria-label="返回正文引用">↩</a>
  </li>
  <li id="ref-9">
    He 等，<cite>Agent Lightning</cite> v1.0，§2.1–2.3 图 3–5 与式（16），§3.1 图 6，§4.3.3 图 10，附录 A.1 网关事件；官方文档给出了整组收集与排空顺序。
    <a href="https://arxiv.org/html/2608.17528v1#S2" target="_blank" rel="noopener">样本拼接、优势与归一化</a> ·
    <a href="https://arxiv.org/html/2608.17528v1#S3.SS1" target="_blank" rel="noopener">共置调度</a> ·
    <a href="https://arxiv.org/html/2608.17528v1#S4.F10" target="_blank" rel="noopener">图 10</a> ·
    <a href="https://arxiv.org/html/2608.17528v1#A1.SS1" target="_blank" rel="noopener">网关记录</a> ·
    <a href="https://microsoft.github.io/agent-lightning/stable/35-asynchronous-training/#how-it-works" target="_blank" rel="noopener">异步训练（How it works）</a>
    <a class="reference-backlink" href="#cite-9" aria-label="返回正文引用">↩</a>
  </li>
</ol>

</div>
