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
  

  
  <picture>
<source media="(max-width: 720px)" srcset="/research/rl-framework-architecture/fig-wait-narrow.svg">
<img loading="lazy" decoding="async" src="/research/rl-framework-architecture/fig-wait-wide.svg" alt="两种“等齐”的时间线">
</picture>
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
  

  
  <picture>
<source media="(max-width: 720px)" srcset="/research/rl-framework-architecture/fig-segment-narrow.svg">
<img loading="lazy" decoding="async" src="/research/rl-framework-architecture/fig-segment-wide.svg" alt="切分样本怎样改变组内平均奖励">
</picture>
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
