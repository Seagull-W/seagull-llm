---
title: "智能体沙箱该优化哪段时间？从模型等待到训练批次就绪"
description: "沿用同一工作区的编程会话，沙箱只需创建一次，却要反复等模型决定下一步。服务端要决定空闲多久值得让出内存，以及下一条命令到来时该恢复什么。"
tags: ["每日调研", "Agent", "沙箱", "智能体基础设施"]
date: "2026-10-20"
---

# 智能体沙箱该优化哪段时间？从模型等待到训练批次就绪

<div class="research-article">

<p class="lead">沿用同一工作区的编程会话，沙箱只需创建一次，却要反复等模型决定下一步。服务端要决定空闲多久值得让出内存，以及下一条命令到来时该恢复什么。大批量训练时，上万个环境可能同时准备代码和工具，落后的实例会推迟一批任务与模型的首次交互。<sup id="cite-2"><a href="#ref-2" aria-label="参考文献 2">[2]</a></sup><sup id="cite-5"><a href="#ref-5" aria-label="参考文献 5">[5]</a></sup></p>

## 创建只发生一次，为什么整段会话都在计费？

<p>
  智能体改代码时，沙箱给它一份能实际修改的工作目录。模型给出命令，沙箱运行命令，再把结果送回模型。创建计时在环境可执行时就结束了，用户的任务却可能刚刚开始。即使下一轮只需模型阅读测试结果，上一轮改过的文件仍要留给它。只观测从请求到环境就绪的时间，就会漏掉这段反复出现的资源占用。<sup id="cite-1"><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup><sup id="cite-2-2"><a href="#ref-2" aria-label="参考文献 2">[2]</a></sup>
</p>
<p>
  TrEnv-X 在恢复虚拟机时按需装入内存页。在论文的对照实验中，这套系统比 E2B 缩短了约 35%–49% 的智能体启动时间。这项改进对很快就结束的任务尤其有用。把计时延伸到任务结束，用浏览器整理博客的一次运行持续了三分多钟。<sup id="cite-1-2"><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup>
</p>

<div class="table-scroll" role="region" aria-labelledby="tbl-1" tabindex="0">
  <table>
    <caption id="tbl-1">
      表 1｜TrEnv-X 在 Firecracker 上测得的任务耗时<sup id="cite-1-3"><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup>
      <span>原表 2 节选；同一任务的端到端耗时与实际 CPU 时间对比</span>
    </caption>
    <thead>
      <tr>
        <th scope="col">任务</th>
        <th scope="col" class="num">端到端耗时（秒）</th>
        <th scope="col" class="num">CPU 时间（秒）</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <th scope="row">修复给定代码</th>
        <td class="num">36.5</td>
        <td class="num">0.809</td>
      </tr>
      <tr>
        <th scope="row">在网站上选购商品</th>
        <td class="num">140.7</td>
        <td class="num">10.3</td>
      </tr>
      <tr>
        <th scope="row">搜集并摘要博客</th>
        <td class="num">193.1</td>
        <td class="num">56.8</td>
      </tr>
    </tbody>
  </table>
</div>
<p class="table-hint">左右滑动查看完整表格</p>

<p>
  CPU 时间记录任务实际占用处理器的时长。要区分等模型、等网页和实际执行工具各用了多久，还得看调用轨迹。账单采用另一种计时方法。TrEnv-X 按 AWS Lambda 的方式，将分配内存乘以端到端时长和单位价格，再用输入、输出 token 计算模型费用。按论文采用的 Gemini 2.5 Flash 价格，博客摘要的执行环境费用约占两项之和的 42%。这个分子既含等待，也含浏览器实际工作。<sup id="cite-1-4"><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup>
</p>

## 在两次调用之间，什么时候值得暂停？

<p>
  AgentSysBench 跟踪了 35,037 个生产编程会话。按会话分别计算，模型与工具实际执行时间占会话寿命的比例，中位数只有 20%。多数空闲间隔在一到十分钟，也有人隔夜才发来下一条指令。此时会话仍有效，读回上次修改的文件就能继续工作，但让这些会话一直占着内存，也会挤掉原本可以接纳的新任务。<sup id="cite-2-3"><a href="#ref-2" aria-label="参考文献 2">[2]</a></sup>
</p>

<figure class="figure" id="fig-planning-paths">
  

  

  <picture>
<source media="(max-width: 720px)" srcset="/research/agent-sandbox-wrong-target/fig-planning-paths-narrow.svg">
<img loading="lazy" decoding="async" src="/research/agent-sandbox-wrong-target/fig-planning-paths-wide.svg" alt="同一轮模型规划，沙箱的两条路径（宽屏版）">
</picture>
<figcaption>
    <strong>图 1｜同一轮模型规划，沙箱的两条路径。</strong>
    工具返回结果后沙箱进入空闲计时；在阈值前收到下一条命令则保持驻留，越过阈值则卸载并在收到命令后恢复。<sup id="cite-2-4"><a href="#ref-2" aria-label="参考文献 2">[2]</a></sup>
  </figcaption>
</figure>

<p>
  研究者选了一个更容易辨认的空档做实验。Mini-SWE 把工具结果交给模型后，沙箱会闲到模型完成下一步规划。模型每步新读入和生成的文字长短不一，靠上下文总长度很难预判要等多久。原型等到本轮规划用时越过固定阈值才卸载沙箱，执行下一步工具前再恢复。与保持驻留相比，这次运行中并发沙箱进程的合计常驻内存，平均值降到约 1/4.6，峰值降到约 1/2.1，延迟增幅在 0.5% 以内。<sup id="cite-2-5"><a href="#ref-2" aria-label="参考文献 2">[2]</a></sup>
</p>
<p>
  如果工具调用接连到来，暂停可能更贵。Aries 按 AWS Lambda MicroVM 的价格回放工具调用轨迹，若每次调用结束就拆掉沙箱，实例费用会下降 65%，加上反复保存和恢复快照，沙箱总费用却达到常驻方案的 4.9 倍。对一段给定的等待，只有省下的驻留费盖过一次保存和恢复的费用，暂停才会降低这段会话的账单。下一条命令若要等快照读完才能运行，还得把用户多等的时间单独记下来。<sup id="cite-3"><a href="#ref-3" aria-label="参考文献 3">[3]</a></sup>
</p>

## 编译时占用的内存，下一步还要保留多少？

<p>
  假设智能体刚改完源码，也装好了依赖。恢复后，测试必须看到这些改动，运行中的进程也可能要从中断处继续。模型侧的键值缓存则可由对话历史重新计算，代价是下一轮要多等。还有一类内存只在工具运行时有用，例如编译器的临时页。选在命令结束后的安静时段保存现场，可以避开已经释放的临时页，又能保留继续任务所需的状态。<sup id="cite-2-6"><a href="#ref-2" aria-label="参考文献 2">[2]</a></sup>
</p>
<p>
  OpenSandbox 的 Fast Sandbox 有两条不同的路径。按模板创建环境时，平台在预热的 Fastlet Pod 内启动微虚拟机，省去为每个沙箱单独调度 Pod 的等待。要让已有会话换个宿主继续运行，平台还得把该会话的可写文件系统、客户机内存以及虚拟处理器和设备状态写入共享存储。检查点完整写入后，原来占用的容量才能交给其他会话。<sup id="cite-6"><a href="#ref-6" aria-label="参考文献 6">[6]</a></sup>
</p>
<p>
  实际执行工具时，一台机器能容纳的会话数还受瞬时内存需求限制。AgentSysBench 测得单会话沙箱峰值内存的中位数约为 0.8 GB，编译与单元测试期间，个别会话可到 28 GB。做容量规划时，得给编译中的沙箱留足余量。估算检查点大小，则要看命令结束后还有多少状态留在现场。<sup id="cite-2-7"><a href="#ref-2" aria-label="参考文献 2">[2]</a></sup>
</p>
<p>
  AgentCgroup 把内存采样对齐到每次工具调用。按同一阈值统计超过 300 MB 的内存突发，Haiku 的工具调用占采样时间的 28.5%，却集中了 98.5% 的突发；GLM 对应的是 35.8% 和 67.3%。突发可以只持续一两秒。同一台机器即便大部分时候空闲，几个会话同时跑测试，也可能一起争内存。提高部署密度时，需要同时看空档里能归还多少内存、工具重叠执行时又需要多少。<sup id="cite-4"><a href="#ref-4" aria-label="参考文献 4">[4]</a></sup>
</p>

## 训练批次里，第一条工具命令要等什么？

<p>
  DSec 的生产记录里，单个训练或评测作业最多在短时间内请求约 3.2 万个沙箱。每个实例都得拿到任务指定的代码和工具才能参与交互。一周内用到的镜像等产物合计超过 130 TB，单节点装不下。单个任务对同一容器镜像的复用也有限，每个镜像服务的沙箱数中位数只有三个。即便提前启动了一批空环境，实例仍要等各自指定的工作区就绪。<sup id="cite-5-2"><a href="#ref-5" aria-label="参考文献 5">[5]</a></sup>
</p>
<p>
  DSec 把基础环境、工作区和工具包拆成可组合的层。容器直接挂载只读 EROFS 层，访问文件时才从共享存储读取所需数据，运行中对代码的修改写在节点本地。为测出准备工作区的代价，作者固定了代码、工具和调用顺序，用预先录好的工具调用替代模型生成，只改变工作区和工具包的交付方式。<sup id="cite-5-3"><a href="#ref-5" aria-label="参考文献 5">[5]</a></sup>
</p>

<div class="table-scroll" role="region" aria-labelledby="tbl-2" tabindex="0">
  <table>
    <caption id="tbl-2">
      表 2｜DSec 在同一评测任务上的工作区交付对照<sup id="cite-5-4"><a href="#ref-5" aria-label="参考文献 5">[5]</a></sup>
      <span>累计磁盘写入以 EROFS 为 1；固定代码、工具与调用顺序，仅改变交付方式</span>
    </caption>
    <thead>
      <tr>
        <th scope="col">交付方式</th>
        <th scope="col" class="num">整项任务完成时间（分钟）</th>
        <th scope="col" class="num">累计磁盘写入（相对量）</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <th scope="row">每个沙箱解压 tar.gz</th>
        <td class="num">79</td>
        <td class="num">约 5.5</td>
      </tr>
      <tr>
        <th scope="row">直接挂载 EROFS 只读层</th>
        <td class="num">45</td>
        <td class="num">1</td>
      </tr>
    </tbody>
  </table>
</div>
<p class="table-hint">左右滑动查看完整表格</p>

<p>
  直接挂载后，许多实例更早开始执行工具，反而把 CPU 峰值推高了。原先有些实例还在往本地磁盘写文件，现在它们已经能和其他实例一起做评测了。这里判断准备工作省了多少，应看累计写入和整项任务用时。<sup id="cite-5-5"><a href="#ref-5" aria-label="参考文献 5">[5]</a></sup>
</p>
<p>
  训练作业遇到 GPU 抢占时，优化目标又会改变。训练框架明确发出暂停信号，DSec 随即冻结容器并回收内存页，或为微虚拟机保存快照，后续请求到达时恢复。服务端往往只能从调用间隔推测还要等多久，训练框架能直接告诉沙箱一整批任务何时需要暂停。<sup id="cite-2-8"><a href="#ref-2" aria-label="参考文献 2">[2]</a></sup><sup id="cite-5-6"><a href="#ref-5" aria-label="参考文献 5">[5]</a></sup>
</p>

<details class="supplement">
  <summary>补充口径与检索记录（按需展开）</summary>
  <p>
    TrEnv-X 的成本比例依赖论文采用的模型价格与计费方式。AgentSysBench 的生产会话包含等用户的空档，卸载实验只覆盖 Mini-SWE 等模型规划的间隔。Aries 的总费用合计实例和快照两项，未计模型费，图 10 排除了工具 CPU 用量较低的 DeepResearch。AgentCgroup 用 GLM 运行 111 个任务，Haiku 运行其中 33 个，两组比例取自各自样本。DSec 的 3.2 万来自生产记录，表 2 来自独立测试集群。<sup id="cite-1-5"><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup><sup id="cite-2-9"><a href="#ref-2" aria-label="参考文献 2">[2]</a></sup><sup id="cite-3-2"><a href="#ref-3" aria-label="参考文献 3">[3]</a></sup><sup id="cite-4-2"><a href="#ref-4" aria-label="参考文献 4">[4]</a></sup><sup id="cite-5-7"><a href="#ref-5" aria-label="参考文献 5">[5]</a></sup>
  </p>
  <p>
    本轮已复核五篇论文的计费分母、卸载触发条件、快照回放基线、分模型内存突发与工作区交付实验，并核对 OpenSandbox 官方文档中的创建和恢复路径。添茶《Agent Sandbox 前沿综述》（<a href="https://zhuanlan.zhihu.com/p/2094034668836411382" target="_blank" rel="noopener">原专栏链接</a>）本轮未取得全文，旧稿转述的 256 条轨迹及 32% 中位数未纳入正文。
  </p>
</details>

## 来源与阅读范围

<ol class="reference-list">
  <li id="ref-1">
    <cite>TrEnv-X</cite>，定位：§3.1 表 2、§3.3 式（1）和（2）及图 4、§9.6.1 图 23。
    <a href="https://arxiv.org/html/2509.09525v2#S3.T2" target="_blank" rel="noopener">任务耗时</a> ·
    <a href="https://arxiv.org/html/2509.09525v2#S3.SS3" target="_blank" rel="noopener">计费推导与分项</a> ·
    <a href="https://arxiv.org/html/2509.09525v2#S9.SS6.SSS1" target="_blank" rel="noopener">启动延迟对照</a>
    <a class="reference-backlink" href="#cite-1" aria-label="返回正文引用">↩</a>
  </li>
  <li id="ref-2">
    <cite>AgentSysBench</cite>，定位：§4.3 图 6、§7.1 图 20、§8.3 与图 25(c,d)。
    <a href="https://arxiv.org/html/2608.15127v1#S4.SS3" target="_blank" rel="noopener">状态分类与峰值</a> ·
    <a href="https://arxiv.org/html/2608.15127v1#S7.SS1" target="_blank" rel="noopener">生产会话的空档</a> ·
    <a href="https://arxiv.org/html/2608.15127v1#S8.SS3" target="_blank" rel="noopener">卸载条件与实测结果</a>
    <a class="reference-backlink" href="#cite-2" aria-label="返回正文引用">↩</a>
  </li>
  <li id="ref-3">
    <cite>Aries</cite>，定位：§4.3 图 10，以常驻为基线回放不同保活时间的账单。
    <a href="https://arxiv.org/html/2607.29069v1#S4.SS3" target="_blank" rel="noopener">实验与分项成本</a>
    <a class="reference-backlink" href="#cite-3" aria-label="返回正文引用">↩</a>
  </li>
  <li id="ref-4">
    <cite>AgentCgroup</cite>，定位：§3.1 的两组任务与采样间隔，§3.3 图 4–7 及相邻正文的分模型突发统计。
    <a href="https://arxiv.org/html/2602.09345v3#S3.SS1" target="_blank" rel="noopener">实验设置</a> ·
    <a href="https://arxiv.org/html/2602.09345v3#S3.SS3" target="_blank" rel="noopener">资源动态</a>
    <a class="reference-backlink" href="#cite-4" aria-label="返回正文引用">↩</a>
  </li>
  <li id="ref-5">
    <cite>DSec</cite>，定位：§4.1 图 2、§4.4 图 8，§5.1、§5.3，§6.3，§8.1、§8.3 图 11。
    <a href="https://arxiv.org/html/2609.22978v1#S4.SS1" target="_blank" rel="noopener">突发创建</a> ·
    <a href="https://arxiv.org/html/2609.22978v1#S4.SS4" target="_blank" rel="noopener">镜像复用</a> ·
    <a href="https://arxiv.org/html/2609.22978v1#S5.SS1" target="_blank" rel="noopener">可组合层</a> ·
    <a href="https://arxiv.org/html/2609.22978v1#S5.SS3" target="_blank" rel="noopener">按需读取</a> ·
    <a href="https://arxiv.org/html/2609.22978v1#S6.SS3" target="_blank" rel="noopener">训练抢占</a> ·
    <a href="https://arxiv.org/html/2609.22978v1#S8.SS3" target="_blank" rel="noopener">工作区交付对照</a>
    <a class="reference-backlink" href="#cite-5" aria-label="返回正文引用">↩</a>
  </li>
  <li id="ref-6">
    <cite>OpenSandbox 官方文档</cite>，Fast Sandbox Integration 的 How it fits 与 Pause, Resume, and Snapshots 的 What a checkpoint contains、Pause and resume。
    <a href="https://github.com/alibaba/OpenSandbox/blob/main/docs/architecture/fast-sandbox/index.md#how-it-fits" target="_blank" rel="noopener">预热池与创建路径</a> ·
    <a href="https://github.com/alibaba/OpenSandbox/blob/main/docs/architecture/fast-sandbox/checkpoints.md#what-a-checkpoint-contains" target="_blank" rel="noopener">检查点内容与释放条件</a>
    <a class="reference-backlink" href="#cite-6" aria-label="返回正文引用">↩</a>
  </li>
</ol>

</div>
