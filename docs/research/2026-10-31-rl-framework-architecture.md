---
title: "主流 RL 框架的架构分歧：控制面、训练-推理耦合与环境边界"
description: "九个框架各用一句话讲清理念与落地方式，再把三处结构决策摊开比较：谁表达算法流程、权重怎么过河、异步到什么程度、环境放在哪一侧。"
date: "2026-10-31"
tags: ["每日调研", "强化学习", "框架", "架构"]
---

# 主流 RL 框架的架构分歧：控制面、训练-推理耦合与环境边界

这些框架跑的算法几乎是同一套：GRPO 或它的变体，加一点重要性修正与裁剪。差别在三处工程决策上——**算法流程由谁表达**，**训练与推理怎样共享设备、怎样交换权重**，**环境与 agent 的状态放在哪一侧**。三处各自独立，组合起来才决定一个框架的脾气：能扩到多大、换模型多贵、长尾生成时 GPU 空转多久、调试一次停顿时要看几个进程。

九家按第一处决策分成三派。把 RL 当一个训练器：TRL。把 RL 当一件分布式作业、由一个控制器统管角色与设备：verl、ROLL、SkyRL、NeMo-RL，以及编排更薄的 slime。把训练挪到外面、让生成与更新各跑各的：OpenRLHF 的角色隔离、AReaL 的异步流、Agent Lightning 的网关。

下面先一家一段，说清理念、怎么落地、代价落在哪；再把三处决策横向摊开；最后回到几个真正的分歧。基础闭环（rollout、优势、权重交接的含义）见[站内 10 月 16 日的框架文章](./2026-10-16-post-training-rl-frameworks.md)，这里不重复。

<figure><img loading="lazy" src="/research/2026-10-31-rl-framework-architecture/decision-map.svg" alt="以训练推理耦合为横轴、环境边界为纵轴、控制面为颜色的九框架位置图" /><figcaption>图 1｜本文自绘。三处结构决策彼此独立，所以同一框架落在主格、可选模式落在邻格；颜色只表示控制面，不是性能等级。</figcaption></figure>

## 一、九家各自的理念

**TRL｜把 RL 做成一个 Trainer。** 理念是让改奖励像改一个 Python 回调：模型、数据、参数、奖励函数都在 Transformers 的 `Trainer` 接口里，接第一个任务时不用先搭分布式。落地方式是 `GRPOTrainer` 走 Accelerate，生成默认用模型自己的 `generate`，vLLM 只是可选加速——1.17.1 里 `use_vllm` 默认关闭，启用后 `vllm_mode` 默认 `colocate`，`server` 模式靠 NCCL 把权重推进独立的 vLLM 服务。环境可以用奖励函数、`tools` 或 `environment_factory` 表达。代价是循环仍是单进程语义：生成端拆出去以后，主循环照样按批生成、按批更新，另一组卡在等。[TRL v1.17.1](#source-trl)

**verl｜用单控制器表达算法，执行交给 worker 群。** 理念是把"先过滤、再算概率、最后更新"写在一张调用图里，把并行与通信藏进 WorkerGroup 内部的 SPMD。落地是单控制器 + Ray WorkerGroup：训练后端可选 FSDP（+SP）、Megatron（DP/TP/PP/EP/CP）或 VeOmni（FSDP+SP+EP），推理可选 vLLM 或 SGLang，权重交接由 CheckpointEngine 承担，提供 NCCL 广播与 NIXL 点对点两条传输路径，trainer 层再组合出 on-policy、一步延迟、完全异步三种管线。0.7 引入 TransferQueue 把控制流与数据流分开——仅实验，文档写明计划在 0.8 才设默认。代价是概念层数多：控制器、WorkerGroup、引擎、传输各一层，读一次配置要同时对上四处。[verl 0.7](#source-verl)

**OpenRLHF｜把 RLHF 的四种角色拆成独立进程。** 理念是 actor、critic、reference、reward 各有设备和生命周期，想动谁就动谁。落地是 Ray 调度角色、HF 模型 + DeepSpeed ZeRO-3 承担训练分片（配 AutoTP、RingAttention），vLLM 生成，Hybrid Engine 用 sleep/offload 让训练与推理分时占用同一批显存。权重交接有一条捷径：CUDA IPC，但代码里的条件是 `backend == "nccl" and colocate_all and not async_enable` 三个同时成立，开异步这条路就关掉。代价是调试：一次停顿要同时看 driver、actor 日志、对象引用与 NCCL 进程组；官方口径是可扩到 70B+。[OpenRLHF](#source-openrlhf)

**slime｜薄编排，把难的部分还给用户。** 理念是主循环只负责"生成—训练"的依赖顺序，任务怎么组织、奖励怎么算，写在你自己的 rollout 函数里。落地是一个单主循环驱动 Megatron 训练与 SGLang 采样，训练与推理默认就分两组 GPU，要共置得显式加 `--colocate`；权重更新有三条路径——tensor（IPC 句柄）、distributed（NCCL 广播）、disk（写完整 HF checkpoint 再让 SGLang reload）。代价写在代码注释里：共置时 SGLang 返回只代表 GPU copy 已入队，生产者若立刻复用那块 buffer，会与消费者侧复制竞争而损坏权重；换模型也要先过 HF→Megatron 的 checkpoint 转换。[slime](#source-slime)

**AReaL｜让生成和更新同时跑，代价用重要性修正换回来。** 理念很直接：同步训练里 GPU 一半时间在等生成，那就别等。落地是独立的生成与训练调度（论文用 SLURM 管资源，SGLang 0.4.6 生成、Megatron-Core 0.11.0 训练，实验规模 512 张 H800），rollout worker 收到 `update_weights` 会打断在途生成、丢弃旧 KV cache 再用新权重重算前缀，算法侧用 decoupled PPO 对行为策略做重要性修正。代价可量化：1.5B 数学任务、250 步的消融里，最大陈旧度 η=4 时普通 PPO 的 AIME24 是 23.3，decoupled PPO 42.2，同步 oracle 42.0；η 放到无穷，decoupled 掉到 36.9——异步不是免费的，是"有限陈旧度 + 损失修正"才换回接近同步的结果。[AReaL](#source-areal)

**ROLL｜一个控制器统管角色，把环境并行当一等公民。** 理念是训练、推理、环境都由同一张资源图调度，环境不只是一次函数调用。落地是单控制器 + Ray worker，训练走 FSDP2 或 Megatron，推理走 vLLM 或 SGLang；环境侧每个 EnvManager 在 worker 里独立跑 `run_rollout_loop`，环境之间没有逐步 barrier，但 `get_batch()` 仍会阻塞到收够一个训练批次。异步是选项：`async_generation_ratio` 默认 0（同步流水），大于 0 才允许提前生成。[ROLL](#source-roll)

**SkyRL｜模块化全栈，环境写成 Gym 式接口。** 理念是每层都能单独换掉：训练、推理、环境、权重同步各有实现与配置。落地是控制器 + `PPORayActorGroup`，训练用 FSDP 或 Megatron，推理走 HTTP 服务（vLLM 路径），共置靠 `colocate_all=True`（默认值），共置时 NCCL 内部走 CUDA IPC；完全异步默认关闭，打开后由 `max_staleness_steps`（默认 4）约束"第 i 步调度、第 j 步训练"的 `j−i`。另有 delta 同步：只发权重差分，经共享存储（本地路径或 `gs://`、`s3://`）发布，限定在非共置的 vLLM 路径。[SkyRL](#source-skyrl)

**NeMo-RL｜在 NVIDIA 栈里做单进程控制器，让训练与推理尽量同源。** 理念是控制器只一个进程、逻辑好读，后端与并行方式都可替换，模型能用同一套引擎训练和部署。落地是设计文档里明写的"Single-Process Controller using Ray"，配 `RayVirtualCluster` 与 `RayWorkerGroup`；训练可用 AutoModel/FSDP2 或 Megatron，推理可用 vLLM 或 Megatron-native，后者省掉格式转换。权重同步按拓扑分叉：共置 vLLM 走 IPC/ZMQ，非共置走 collective，而 SGLang 的非共置模式在工厂函数里直接 `NotImplementedError`。换异步要同时做三件事：关掉共置推理、打开重要性修正、设轨迹年龄（文档例子：v10 的轨迹可用于 v10、v11，到 v12 丢弃）。设计声明是从 1 到 1000 张 GPU，那是目标不是实测曲线。[NeMo-RL](#source-nemo)

**Agent Lightning｜不动 agent 代码，把训练挂在它外面。** 理念是既有 coding agent 是产品资产，不该为了训练重写交互循环，那就把模型入口换成网关，让训练侧从旁边观察。落地是 Trainer + API Gateway + Rollout Controller：agent 把请求发到 OpenAI 兼容网关，网关转发到推理端并记录 prompt/response 的 token id 与所选 token 的 logprob；runner 默认在 Kubernetes Job 里跑，也可以本机子进程。异步按组：可同时挂 64 组，收到 32 组完整结果就开始更新，未完成组带到下一步，但组内 sibling 必须全齐；换权重前网关先暂停收新请求、排空在途请求。代价在轨迹重建：coding agent 的运行里只有 36% 的 rollout 保持单条训练样本，平均一条拆成 2.4 条，所以要配 rollout 级优势与分段归一化。[Agent Lightning](#source-lightning)

## 二、三处决策的横向对照

三张表按决策拆开，每格只放结论，机制在上文与后文。版本与出处见文末锚点；"未说明"表示没有找到能支撑统一上限的依据。

**执行栈：算法流程在哪，重活在哪。**

| 框架 | 控制面 | 训练引擎 | 推理引擎 |
| --- | --- | --- | --- |
| TRL | Trainer 循环 + Accelerate | Transformers / FSDP / DeepSpeed | 默认 `generate`，可选 vLLM |
| verl | 单控制器 + Ray WorkerGroup | FSDP、Megatron、VeOmni | vLLM、SGLang |
| OpenRLHF | Ray 角色 + 集中编排 | HF + DeepSpeed ZeRO-3 | vLLM |
| slime | 薄主循环 + Ray rollout | Megatron | SGLang |
| AReaL | 独立生成/训练调度 | Megatron-Core | SGLang |
| ROLL | 单控制器 + Ray worker | FSDP2、Megatron | vLLM、SGLang |
| SkyRL | 单控制器 + PPORayActorGroup | FSDP、Megatron | HTTP 推理服务（vLLM） |
| NeMo-RL | 单进程控制器 + Ray | AutoModel/FSDP2、Megatron | vLLM、Megatron-native |
| Agent Lightning | Trainer + 网关 + 控制器 | verl 后端 | vLLM 后端 |

**耦合与交接：同一批卡还是两批卡，权重怎么过河。**

| 框架 | 默认耦合 | 权重交接 | 异步默认 |
| --- | --- | --- | --- |
| TRL | 单进程同卡，vLLM 可选 | server 走 NCCL，共置走 IPC | 关 |
| verl | 可共置、可分离 | NCCL 广播 / NIXL 点对点 | 关（另有异步 trainer） |
| OpenRLHF | 可共置（sleep/offload） | NCCL；共置且非异步时 IPC | 关 |
| slime | 默认分离 | tensor IPC / NCCL / 落盘 | 关（另有 fully async 入口） |
| AReaL | 分离、完全异步 | 版本化在线更新 | 开 |
| ROLL | 可共置、可分离 | collective 广播 / bucket | 关（ratio=0） |
| SkyRL | 默认共置 | NCCL + CUDA IPC；可选 delta | 关 |
| NeMo-RL | 默认共置 | 共置 IPC/ZMQ，分离 collective | 关 |
| Agent Lightning | 训练与 agent 分离 | 由后端决定，网关暂停排空 | 按组异步 |

**环境与规模：交互状态归谁，扩到多大。**

| 框架 | 环境接口 | 声明的规模 |
| --- | --- | --- |
| TRL | 奖励函数、`tools`、`environment_factory` | 未说明统一上限 |
| verl | reward manager、agent loop | 文档将 128+ GPU 列为异步适用场景 |
| OpenRLHF | reward function/server、自定义 agent | 声明 70B+ |
| slime | 自定义 rollout 函数 | 未说明统一上限 |
| AReaL | 独立 reward service | 论文实验至 512 H800 |
| ROLL | EnvManager / 环境 worker | README 声明至数千 GPU |
| SkyRL | SkyRL-Gym（init/step/close） | 未说明统一上限 |
| NeMo-RL | EnvironmentInterface、环境 actor | 设计声明 1–1000 GPU |
| Agent Lightning | 外部 agent 经网关，runner 本地或 K8s | 控制器可扩 rollout worker |

## 三、三个真正的分歧

### 同步屏障值多少钱，取决于长尾从哪来

把同步训练换成异步，挣的是同一件事：让 GPU 在等生成时不空转。这笔账有多大，各家给的分母并不一样。

先看机制上的上限。假设八个容量相等的生成槽、每槽只跑一项任务，七项 20 秒、一项 100 秒，期间不能补新任务，槽位忙 240 秒、占用 800 秒，空闲 70%。这是合成的槽位示例，不是任何框架的利用率实测——真实数字还取决于批大小、TP、prefill/decode 混合与工具等待。

再看实测。AsyncFlow 在 32–512 张 Ascend NPU 上对 7B/32B 报告平均吞吐 1.59 倍，7B/256 NPU 峰值 2.03 倍，基线是 2025-04-07 提交 `d13434f` 的 verl FSDP、同为 vLLM-Ascend 0.7.3——后端与历史版本都不同，这个倍数不能直接搬到今天的 NVIDIA 集群上。PipelineRL 用 128 张 H100（48 张生成、80 张训练），报告达到相同 reward 比 G=32 的 conventional 基线快约 2 倍；但它自己写明基线吞吐是用 2 节点加 8 倍校正估出来的，不是同一 128 卡上的直接对跑。

所以"异步能省多少等待"没有统一答案，能比较的是三件具体事：陈旧度上限设多少、换权重时打断还是等轮末、丢弃过期样本的比例。AReaL 的 η=4 消融说明第一件最敏感——同样是 decoupled PPO，η 从 4 放到无穷，AIME24 从 42.2 掉到 36.9。

### 共置省的是设备预算，不是时间

HybridFlow 讲得很清楚：训练和推理需要不同并行布局，却可以按阶段用同一批 GPU，省下的是另建推理池的设备预算，代价是阶段不能重叠。OpenRLHF 用 sleep/offload 把同一批显存分时让给 vLLM，但它的 IPC 路径要求共置、`nccl` 且非异步；开异步后 sleep 与共置规则同时改变，两种模式的优势不能相加。

反方向也有代价。slime 把"设备分离"设成普通配置的默认，就是为了让主循环的依赖关系不被共置的显存约束搞复杂；TRL 的 server 模式让推理侧独立调 TP 与显存，可主循环仍是按批的全局屏障——**设备分离不等于阶段重叠**，两侧各一组卡照样能互相等。

判断标准因此很具体：卡数紧张、生成长度较齐，先量一次共置切换的峰值显存与交接时延；长尾与工具等待占主导，共置救不了分时的时间空洞，解耦才有意义。

交接本身的价格可以估个下界。7B 的 BF16 参数约 14 GB、70B 约 140 GB，若必须跨越的那条链路有效吞吐只有 25 GB/s，仅送一份全量参数就至少 0.56 秒或 5.6 秒；reshard 前的 all-gather、接收端的重排与复制还没算。每步只训练一两秒时，70B 的全量交接不是小常数；生成以分钟计时时，同样的开销可以接受。这是条件化带宽估算，不是框架 benchmark。

<figure><img loading="lazy" src="/research/2026-10-31-rl-framework-architecture/scheduling-timeline.svg" alt="共置同步、设备分离但同步、完全异步三类时间线" /><figcaption>图 2｜本文自绘。省掉的等待会变成留在轨迹里的策略版本问题；块宽只作机制示意，不表示实测利用率。</figcaption></figure>

### 把 agent 移出训练循环，代价在轨迹重建

Agent Lightning 的取舍值得单说，因为它是唯一把"不改 agent 代码"当第一原则的。代价不在训练框架内部，而在边界上：一条 rollout 可能被拆成多条训练样本（36% 保持单条、平均 2.4 条），于是优势要按 rollout 级算、损失要分段归一化，否则"拆得多的任务"会白拿权重。它的异步也没取消组内屏障——同组 sibling 要全齐，只是不再等所有活跃组。

对比之下，SkyRL 的 Gym 式 `init/step/close` 与 ROLL 的 EnvManager 把交互状态留在训练侧。好处是 observation、mask、reward 当场对齐，调试训练数据路径最短；坏处是环境阻塞、依赖冲突与异常处理都进了训练任务的故障域。独立 environment server（NeMo-RL 的环境 actor、Lightning 的外部 runner）把执行资源搬到便宜的 CPU 机器上，代价是会话标识、超时取消、重放协议都要显式设计——尤其要回答"重试一个 step"与"重跑整个 episode"的区别，否则服务化只是把阻塞换成状态不一致。

## 四、按约束选，而不是按排名选

- **单机或少量节点、短答案验证、频繁换 HF 模型**：TRL 的直接循环就够，先别引入 Ray 和第二种推理栈。
- **要改分布式数据流、要在多个训练后端间比较**：从 verl 的 WorkerGroup 与 backend 边界入手，代价是概念多。
- **已有 Megatron 资产、想自己掌握 rollout 组织**：slime 的薄编排更合手，但任务调度与 HF→Megatron 转换的责任归你。
- **卡数紧张、生成长度整齐**：先量共置切换的峰值显存与交接时延，再决定要不要另建推理池。
- **长尾与工具等待占主导**：先试 ROLL 的环境并发或 SkyRL 的有限预生成，它们可能已经吃掉主要等待；不够再上 AReaL 式在途换权重，并准备好重要性修正与 KV 重算的成本。
- **agent harness 是产品资产**：Agent Lightning 的网关边界比重写循环划算，上线前先验轨迹重建、分段归一化与失败重放。
- **大 MoE + 既有 NVIDIA 栈**：NeMo-RL / Megatron 路线优先验证，但训练、并行、推理三者能否组合要逐项落到固定版本——SGLang 的非共置模式在该版就是明确不支持的。

所有选择的最终指标只有一个：固定设备预算下到达目标质量的时间。它同时计入吞吐、因陈旧丢弃的样本、额外概率计算、重算 KV，以及失败后的恢复代价；只看生成 token/s 涨了，还回答不了这套架构是否适合眼前的任务。

## 来源与阅读范围

以下为表格与正文的版本锚点；代码用于核对默认值与实现路径，论文结果均为原作者报告，本篇未运行训练。动态文档以 2026-10-31 为阅读日。

- <a id="source-verl"></a>**verl / HybridFlow**：[论文 2409.19256](https://arxiv.org/abs/2409.19256)；[v0.7.0 标签](https://github.com/verl-project/verl/releases/tag/v0.7.0)、[0.7 博客](https://verl.readthedocs.io/en/latest/blog/v0.7.html)、[Single Controller](https://verl.readthedocs.io/en/latest/single_controller.html)。范围：控制器与 WorkerGroup、三种训练后端、CheckpointEngine 的 NCCL/NIXL、TransferQueue 的实验状态与 0.8 计划、128+ GPU 的异步适用场景。
- <a id="source-openrlhf"></a>**OpenRLHF**：[0.10.2 架构文档](https://openrlhf.readthedocs.io/en/latest/architecture.html)、固定提交 [dc2a7ad](https://github.com/OpenRLHF/OpenRLHF/tree/dc2a7ad326f619fc5a47737ea47d1920ce2c0b53)。范围：Ray 角色、ZeRO-3、Hybrid Engine、70B+ 声明，`ppo_actor.py` 中 `use_cuda_ipc` 的三个前提。
- <a id="source-trl"></a>**TRL**：[v1.17.1](https://github.com/huggingface/trl/releases/tag/v1.17.1)、[vLLM 集成文档](https://github.com/huggingface/trl/blob/v1.17.1/docs/source/vllm_integration.md)、[GRPOConfig](https://github.com/huggingface/trl/blob/v1.17.1/trl/trainer/grpo_config.py)、[GRPOTrainer](https://github.com/huggingface/trl/blob/v1.17.1/trl/trainer/grpo_trainer.py)。范围：`use_vllm` 与 `vllm_mode` 默认值、server 模式的 NCCL 权重传输、`tools` 与 `environment_factory`。
- <a id="source-slime"></a>**slime**：固定 [540ea91](https://github.com/THUDM/slime/tree/540ea919e45b8b929198abce008a103be9cfc779)、[设计博客](https://thudm.github.io/slime/blogs/introducing_slime.html)、[Usage](https://thudm.github.io/slime/get_started/usage.html)。范围：默认分离与 `--colocate`、三条权重更新路径、`update_weight_from_tensor.py` 关于 IPC buffer 复用的注释、HF→`torch_dist` 转换方法。
- <a id="source-areal"></a>**AReaL**：[论文 v5](https://arxiv.org/html/2505.24298v5) §4–6 实现、§7.4 表 2；[现行异步文档](https://areal-ai.io/docs/en/algorithms/async.html)。范围：SLURM + SGLang 0.4.6 + Megatron-Core 0.11.0、512 张 H800、打断生成并丢弃旧 KV、η 消融的 23.3/42.2/42.0/36.9。
- <a id="source-roll"></a>**ROLL**：[固定 README d3506ea](https://github.com/alibaba/ROLL/blob/d3506ea9e280ae720fb74df9f82db6efac1c72d5/README.md)、[异步训练](https://alibaba.github.io/ROLL/docs/User%20Guides/Advanced%20Features/async_training/)、[环境并行](https://alibaba.github.io/ROLL/docs/User%20Guides/Advanced%20Features/async_parallel_rollout/)。范围：单控制器、FSDP2/Megatron、`async_generation_ratio` 默认 0、EnvManager 无 barrier 但 `get_batch()` 收批阻塞。
- <a id="source-skyrl"></a>**SkyRL**：固定 [50cfa01](https://github.com/NovaSky-AI/SkyRL/tree/50cfa014aff1c42292fdd7811f24ff96d4aa3600)、[Overview](https://docs.skyrl.ai/docs/getting-started/overview)、[Inference](https://docs.skyrl.ai/docs/getting-started/inference_architecture)。范围：`config.py` 的 `colocate_all`、`FullyAsyncConfig.enabled` 与 `max_staleness_steps`、delta 仅限非共置 vLLM、`skyrl_gym/core.py` 的 init/step/close。
- <a id="source-nemo"></a>**NeMo-RL**：[v0.7.0](https://github.com/NVIDIA-NeMo/RL/releases/tag/v0.7.0) 的 `design-and-philosophy.md`、`backends.md`、`async-grpo.md`、`examples/configs/grpo_math_1B.yaml`、`nemo_rl/weight_sync/factory.py`。范围：单进程控制器、1–1000 GPU 设计声明、async 三项前置、v10/v11/v12 的轨迹年龄例子、SGLang 非共置不支持。
- <a id="source-lightning"></a>**Agent Lightning**：[v1.0 论文 2608.17528](https://arxiv.org/html/2608.17528v1) §2–3、固定 [05c7fe1](https://github.com/microsoft/agent-lightning/tree/05c7fe133175653e48c990546a3509e52dc56512)、[Basics](https://microsoft.github.io/agent-lightning/stable/05-basics/)、[异步训练](https://microsoft.github.io/agent-lightning/stable/35-asynchronous-training/)、[Controller](https://microsoft.github.io/agent-lightning/stable/30-controller-configuration/)。范围：网关记录的 token 与 logprob、64/32 的组配置、组内屏障、暂停排空、36% 与 2.4 条、k8s 与 local 两种 runner。
- **异步补充证据**：[AsyncFlow v2](https://arxiv.org/html/2507.01663v2) §7（32–512 NPU、1.59 均值、2.03 峰值、基线 `d13434f`）；[PipelineRL v2](https://arxiv.org/html/2509.19128v2) §5（128 H100、48/80 分卡、约 2 倍、基线为 2 节点校正估计）。
