---
title: "主流 RL 框架的架构分歧：控制面、训练-推理耦合与环境边界"
description: "把 verl、OpenRLHF、TRL、slime、AReaL、ROLL 等放在同一组结构决策上比较：谁在控制调度、权重怎么过河、异步到什么程度、环境放在哪一侧，以及每种选择的代价。"
date: "2026-10-31"
tags: ["每日调研", "强化学习", "框架", "架构"]
---

# 主流 RL 框架的架构分歧：控制面、训练-推理耦合与环境边界

主流 LLM 强化学习框架的分歧，集中在三处结构决策：谁决定工作何时执行，训练与推理怎样共享设备和交换权重，环境与 agent 的状态由哪一侧掌管。同一种 GRPO，可以被组织成轮流占满一组 GPU 的同步作业，也可以变成持续消费旧轨迹的异步系统。前者付出等待和显存切换，后者付出版本管理与分布修正。选型的关键，是判断自己的任务首先会被哪一种代价限制，而不是数算法名称或异步开关。

基础闭环与配置含义见[站内 10 月 16 日的框架文章](./2026-10-16-post-training-rl-frameworks.md)。这里沿架构决策比较九个框架，另外用 AsyncFlow、PipelineRL 检验异步主张。版本固定在各节与末尾来源条目中；旧版本的明确设计与新版本的新增实现分开陈述。

## 先把坐标放对：单控制器也可以调度 Ray actor

“slime 用单控制器，OpenRLHF 用 Ray actor”把两层问题混在一起了。单控制器回答的是**全局算法流程在哪里表达**；Ray actor 回答的是**有状态工作进程怎样启动、寻址和调用**。slime 的 `train.py` 本身就调用 Ray，verl 的单控制器背后也是 Ray WorkerGroup。NeMo-RL 更直接把设计写成“使用 Ray 的单进程控制器”。这些系统的区别，需继续追问数据是否也经过控制器、控制命令有多细、worker 能否持续独立推进。[verl 控制器设计](https://verl.readthedocs.io/en/latest/single_controller.html)、[slime 固定版主循环](https://github.com/THUDM/slime/blob/540ea919e45b8b929198abce008a103be9cfc779/train.py)、[NeMo-RL v0.7.0 设计](https://github.com/NVIDIA-NeMo/RL/blob/v0.7.0/docs/design-docs/design-and-philosophy.md)

<figure><img loading="lazy" src="/research/2026-10-31-rl-framework-architecture/decision-map.svg" alt="以训练推理耦合为横轴、环境边界为纵轴、执行控制方式为颜色的框架位置图" /><figcaption>图 1：本文自绘。支撑“控制面、设备耦合、环境边界是独立决策”这一判断；点位表示注明的代表路径，不把一个框架的全部模式压成唯一位置。</figcaption></figure>

下表每行的来源锚点对应末尾固定版本、文档与代码位置，覆盖该行各列。同步一列注明常规入口或配置默认，不能拿另一个可选入口替代；规模列区分设计声明、示例与论文实验，并非性能排名。“未说明”表示没有足够依据填写统一上限。

| 框架与版本来源 | 控制面 | 训练引擎 | 推理引擎 | 权重同步方式 | 默认同步或异步 | 环境接口 | 声明的扩展规模 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [verl 0.7](#source-verl) | 单控制器 + Ray WorkerGroup，worker 内 SPMD | FSDP、MCore；VeOmni alpha | vLLM、SGLang | 布局转换；checkpoint engine 的 NCCL / NIXL | 常规 PPO 同步；另有一步延迟、完全异步 trainer | reward manager、agent loop / tool 接口 | 文档将 128+ GPU 列为完全异步适用场景；非上限 |
| [OpenRLHF 0.10.2 文档及固定提交](#source-openrlhf) | Ray 角色 actor + 集中编排 | HF + DeepSpeed ZeRO-3；AutoTP、RingAttention | vLLM | 参数 gather 后 NCCL；同步共置可用 CUDA IPC | CLI 异步默认关闭；Hybrid 是推荐而非默认共置 | reward function / server、自定义 agent 执行 | 官方声明 70B+；统一 GPU 上限未说明 |
| [TRL 1.17.1](#source-trl) | Trainer 循环 + Accelerate 分布式执行 | Transformers / PyTorch；FSDP、DeepSpeed | 默认模型 generate；可选 vLLM | 本地加载；server 路径 NCCL | GRPO 主循环同步；vLLM 默认不启用，启用后默认共置 | reward callable、tools、environment_factory | vLLM 文档有单节点 8 GPU 示例；非规模上限 |
| [slime，2026-10-27](#source-slime) | 单主循环 + Ray rollout manager / 训练 worker | Megatron | SGLang | 分离 NCCL；共置 tensor / IPC；可选完整 HF 文件 | 普通主循环同步，资源默认分离；完全异步须换 rollout 路径 | 自定义 rollout 函数组织 agent 与奖励 | 多节点；统一上限未说明 |
| [AReaL 论文 v5](#source-areal) | 独立生成 / 训练调度，队列与限流；论文用 SLURM | Megatron-Core 0.11.0 | SGLang 0.4.6 | 在线版本化权重更新；此论文口径未说明统一传输后端 | 论文主方案完全异步；现行文档可设同步 | 独立 Reward Service；通用环境接口未说明 | 论文报告至 512 H800 GPU |
| [ROLL，2026-10-14](#source-roll) | 单控制器 + Ray worker / 资源管理 | FSDP2、Megatron | vLLM、SGLang | 分离 collective broadcast；共置 bucket / tensor handle | async_generation_ratio 默认 0；可启用异步 | EnvManager / 环境 worker，agentic rollout | README 声明单机至数千 GPU；非同口径实测 |
| [SkyRL，2026-10-31 UTC](#source-skyrl) | 单控制器 + PPORayActorGroup | FSDP、Megatron | HTTP 推理服务，vLLM 路径 | NCCL；共置 CUDA IPC；可选 delta 共享存储 | colocate_all=True；fully async 默认关闭 | SkyRL-Gym 的 init / step / close | 统一上限未说明 |
| [NeMo-RL 0.7.0](#source-nemo) | 单控制器 + RayVirtualCluster / WorkerGroup | AutoModel / FSDP2、Megatron | vLLM、Megatron；代码含 SGLang 共置路径 | 共置 vLLM IPC / ZMQ，分离 collective；后端专用路径 | 基础 GRPO 配置关闭 async；可选异步需分离设备 | EnvironmentInterface、Ray 环境 actor、NeMo Gym | 设计声明 1–1000 GPU；不等于实测线性扩展 |
| [Agent Lightning 1.0，2026-10-20 提交](#source-lightning) | Trainer + API Gateway + Rollout Controller | verl 后端 | vLLM 后端 | 交给后端；网关负责暂停 / 排空请求 | 提供同步与跨步 rollout；未说明统一默认，跨步不等于 GPU 并行 | 外部 agent 经网关，runner 本地或 Kubernetes | 控制器可扩 rollout worker；GPU 上限未说明 |

## 控制面的瓶颈是数据路径和命令粒度

集中表达算法流程有一个很实际的好处：修改“先过滤、再算概率、最后更新”的顺序时，可以在一个调用图里检查依赖。verl 的 `dispatch_fn` 把全局 batch 分给 WorkerGroup，worker 内再执行分布式模型运算；slime 把 rollout 的具体任务逻辑收进可替换函数。前者提供较多通用数据与并行抽象，后者把定制责任留给 rollout 实现者。代价分别落在框架内部的数据转换，以及用户需要维护的任务调度代码上。[verl 设计页，更新于 2025-05-21](https://verl.readthedocs.io/en/latest/single_controller.html)、[slime 设计博客，更新于 2026-10-19](https://thudm.github.io/slime/blogs/introducing_slime.html)

**控制集中，不要求大张量集中。** verl 0.7 博客指出，旧 RLTrainer 同时承担控制流和数据流，多模态数据与 MoE router replay 会放大集中数据处理的开销。TransferQueue 的方向是把元数据调度与数据存储分开，让下游直接取得所需字段；在这个版本它仍属实验功能，“0.8 默认使用”是当时的计划。不能把后续目标反写成 0.7 已完成的性能条件。[verl 0.7 release blog，2026-01-03](https://verl.readthedocs.io/en/latest/blog/v0.7.html)

AsyncFlow 将这一方向推进到调度粒度：Ray 分配资源，TransferQueue 保存样本状态，消费者按可用数据取微批，接口层仍可以保留单控制器。需要消除的是“控制器收到整批、复制整批、再发整批”的依赖，而不是单个 Python 文件。细粒度调度增加状态转换和队列管理；当任务短到接近消息处理成本时，把每个小步骤都变成远程调用反而可能更贵。[AsyncFlow v2，§3–5](https://arxiv.org/html/2507.01663v2)

OpenRLHF 的 Ray actor 则使 actor、critic、reference 与奖励角色能有独立的设备归属和生命周期。ZeRO 训练仍由角色内部的进程组执行，Ray 没有替代梯度 collective。其收益是可以移动一个角色或改变共置关系；成本是调试一次停顿时，必须同时看 driver、actor 日志、对象引用与 NCCL 进程组。同步调用的栈不再足以说明所有工作在哪里等待。[OpenRLHF 0.10.2 架构](https://openrlhf.readthedocs.io/en/latest/architecture.html)

因此，“多少张 GPU 后单控制器必然崩”没有统一阈值。应测的是每秒多少命令、控制器必须经手多少字节，以及远端一次调用能覆盖多少计算。一次调度触发数秒 GPU 工作，与逐 token 经 Python 控制器往返，瓶颈完全不同。这里的判断来自上述数据路径，而非某个未经测量的 Ray RPC 延迟数字。

故障边界同样要沿路径看。actor 隔离可以让失败局限在一个进程，但训练 rank 死亡仍可能使整个 collective 无法继续；controller 死亡后，也必须恢复 batch 游标、策略版本和在途请求。分布式 actor 不自动提供训练语义上的容错。异步系统恢复时尤其需要保存队列：NeMo-RL 0.7 的异步文档明确记录 replay buffer、目标版本和水位，恢复后丢弃过旧样本、补齐未完成目标。它用更多持久化状态，换取不必全部重新生成的能力。[NeMo-RL 0.7 异步恢复](https://github.com/NVIDIA-NeMo/RL/blob/v0.7.0/docs/guides/async-grpo.md)

## 训练与推理怎样耦合：节省的设备会变成搬运与屏障

### 共置主张的是轮流充分使用设备

HybridFlow 的核心动机，是训练与推理各自需要不同并行布局，却可以按阶段使用同一批 GPU。训练结束后的参数不能简单视为推理端已可用：分片、参数命名、布局与缓存生命周期都要交接。共置节省独立推理副本占用的设备预算，也避免训练一组卡、生成另一组卡时的整组闲置；代价是阶段不能重叠，切换时需要 reshard、卸载状态或释放推理内存。[HybridFlow 论文](https://arxiv.org/abs/2409.19256)、[verl 0.7 后端与 checkpoint engine](https://verl.readthedocs.io/en/latest/blog/v0.7.html)

OpenRLHF 的 Hybrid Engine 使用 sleep / offload 让训练与 vLLM 分时利用显存。固定提交中，CUDA IPC 权重路径要求 NCCL 后端、全角色共置且没有开启异步；参数还需 gather、clone、收集 IPC 句柄，再同步。**IPC 缩短传输路径，不等于同步没有复制或临时显存。** 开启异步后 vLLM sleep 与之互斥，共置规则也改变，不能将两个模式的优势简单相加。[OpenRLHF `ppo_actor.py`](https://github.com/OpenRLHF/OpenRLHF/blob/dc2a7ad326f619fc5a47737ea47d1920ce2c0b53/openrlhf/trainer/ray/ppo_actor.py)

slime 支持共置，却把设备分离设为普通资源配置的默认。其单主循环首先维护清楚的生成—训练依赖，是否共置是另一层选择。固定版的共置权重路径还暴露了一个具体调试代价：消费者的 HTTP / Ray 请求返回时，GPU copy 可能只是入队；生产者若立即复用供 IPC 读取的 buffer，可能与消费者复制竞争而损坏权重。显存复用把一部分通信开销换成跨进程 CUDA 生命周期约束。[slime Usage](https://thudm.github.io/slime/get_started/usage.html)、[tensor 更新实现](https://github.com/THUDM/slime/blob/540ea919e45b8b929198abce008a103be9cfc779/slime/backends/megatron_utils/update_weight/update_weight_from_tensor.py)

这解释了共置与完全异步为何没有一个通用胜者。卡数紧张、生成较整齐、训练和推理都能充分占用同一组设备时，共置的阶段切换可能比维持两个副本便宜；长轨迹和慢工具造成持续长尾时，分时方案无法用下一阶段掩盖它们。AReaL 选择保留两个资源池，购买的正是同时推进的可能性。

### 分离设备只创造重叠条件，控制器还可以让它们互等

TRL 1.17.1 的 vLLM server 模式是清晰的反例：生成请求经 HTTP，权重经 NCCL 更新，服务器拥有专用设备，但 GRPO 主循环仍按批生成和更新。把进程分开便于独立调整推理 TP 与显存预算，代价是两侧常驻模型和权重交接；若依旧保留全局屏障，另一组卡仍会等待。该版默认 `use_vllm=False`，只有启用 vLLM 后，`colocate` 才是模式默认。[TRL 固定版集成文档](https://github.com/huggingface/trl/blob/v1.17.1/docs/source/vllm_integration.md)、[GRPOConfig](https://github.com/huggingface/trl/blob/v1.17.1/trl/trainer/grpo_config.py)

权重同步至少有四种不同含义，不能统一叫“共享内存”。OpenRLHF、slime 的分离路径和 TRL server 路径使用 NCCL 广播；slime、OpenRLHF、NeMo-RL 的共置路径可以传 CUDA IPC 句柄，涉及 GPU 内存可见性；AsyncFlow v2 把待发布权重异步暂存主机内存，再在生成轮边界搬到计算设备，这仍含 D2H / H2D；Ray object store 的 CPU 共享存储则主要解释对象与数据交换，不能据此断言模型权重零拷贝。CPU 共享内存作为统一权重主传输，本表没有足够证据作跨框架归类。[TRL client](https://github.com/huggingface/trl/blob/v1.17.1/trl/generation/vllm_client.py)、[NeMo 同步工厂](https://github.com/NVIDIA-NeMo/RL/blob/v0.7.0/nemo_rl/weight_sync/factory.py)、[AsyncFlow §5.2](https://arxiv.org/html/2507.01663v2)

磁盘中转也确有实现。slime 的 disk transport 写出带版本目录的完整 HF checkpoint，再让 SGLang reload；代码还提供写后 hook，处理对象存储支持的共享文件系统跨机器可见性。SkyRL 的 delta backend 在非共置 vLLM 路径，经共享文件或对象存储发布更新。它们适合无法方便组建同一个 collective 的部署，却把成本转到写读带宽、版本原子发布和加载时延。共享文件系统不是共享内存；verl 的 checkpoint engine 名称也不表示必须落盘，其 0.7 文档列出的是 NCCL 和 NIXL。[slime 磁盘实现](https://github.com/THUDM/slime/blob/540ea919e45b8b929198abce008a103be9cfc779/slime/backends/megatron_utils/update_weight/update_weight_from_disk.py)、[SkyRL 固定版配置](https://github.com/NovaSky-AI/SkyRL/blob/50cfa014aff1c42292fdd7811f24ff96d4aa3600/skyrl/train/config/config.py)

### 一次交接到底有多贵

可以先算一个与框架无关、但能约束选型的下界。假设全量发送 BF16 参数、参数量按十进制计、忽略元数据，7B 模型约 14 GB，70B 约 140 GB。若某个必须跨越的链路实际有效吞吐只有 25 GB/s，那么仅将一份完整参数送过该瓶颈，就至少需要约 0.56 秒或 5.6 秒。这是**条件化带宽估算，不是任何框架 benchmark**；分片并行可避开单链路瓶颈，多接收副本又会改变流量分布。

reshard 还可能在传输前产生 all-gather，接收端也可能重排、量化或复制参数；offload 的对象若包括优化器状态，数据量又超过这里的模型权重。若每步只训练一两秒，70B 的全量交接就不能当作小常数；若生成持续数分钟，相同开销可能值得接受。LoRA 更新、小桶流水和布局一致都可能改变这个结论，须按实际发送的张量计量。

共置的显存下界也不是“只留一份权重”。OpenRLHF 的临时 clone、slime 的 IPC buffer，以及训练状态与推理缓存交接时的重叠窗口都占显存。选择共置前要观察切换时峰值，而非只看稳定训练阶段的占用；选择分离前则要测权重发布周期能否跟上更新速度。两项成本分别决定能否装下和能否及时追上。

<figure><img loading="lazy" src="/research/2026-10-31-rl-framework-architecture/scheduling-timeline.svg" alt="共置同步、设备分离但同步、完全异步的生成等待更新时间线" /><figcaption>图 2：本文自绘。支撑“设备分离不等于阶段重叠，消除等待会引入策略陈旧度”这一判断；块宽仅作机制示意，不表示实测利用率。</figcaption></figure>

## 异步的单位决定了 off-policy 的单位

**“支持异步”至少要补上：什么跨过了哪道屏障。** 环境请求可以并发，但训练仍等完整 batch；生成可以领先一个 batch，但轮末仍统一换权重；也可以每次更新都向在途序列发布参数，使同一条轨迹包含多个行为策略。这三种方案对收敛提出的要求不同，不能靠一个 `async=True` 描述。

ROLL 的环境并行是第一层例子：EnvManager 在 Ray worker 内独立运行 rollout loop，环境之间没有逐步 barrier，但 `get_batch()` 仍阻塞到收够训练批次。其 `async_generation_ratio=0` 是同步默认，增加该值才允许提前生成。NeMo-RL 0.7 的基本 GRPO 配置也关闭异步；切换异步模式还要关闭推理共置、开启重要性修正并设轨迹年龄。因此，“框架已支持异步”并不表示普通示例就承担了陈旧轨迹训练。[ROLL 环境并行文档，2026-09-29](https://alibaba.github.io/ROLL/docs/User%20Guides/Advanced%20Features/async_parallel_rollout/)、[ROLL 异步配置](https://alibaba.github.io/ROLL/docs/User%20Guides/Advanced%20Features/async_training/)、[NeMo-RL 固定配置](https://github.com/NVIDIA-NeMo/RL/blob/v0.7.0/examples/configs/grpo_math_1B.yaml)

### 从一轮延迟，到在途序列换权重

AsyncFlow v2 的主要换权重方案仍有一轮边界：生成使用旧参数，新参数异步写入主机侧，待生成轮结束再加载到计算设备。微批数据流水减少阶段之间的等待，但不能据此说每个 token 都使用最新模型。论文的 sub-step 异步仍标成 prototype；实验结论对应其已实现的 GRPO 路径。[AsyncFlow v2，2026-09-11，§5、§7](https://arxiv.org/html/2507.01663v2)

AReaL v5 选择更强的解耦。已完成样本进入缓冲区，生成和训练独立推进，权重更新可以打断未完成序列。其实现丢弃旧 KV cache 并重算；这保留了新权重下前缀状态的一致性，却要重新做已有前缀的计算。PipelineRL v2 同样支持 in-flight 更新，但保留旧 KV cache。后者把吞吐收益建立在缓存近似上，论文专门比较其引入的 KL 变化。两者都叫 partial rollout，区别落在额外 prefill 与采样分布近似之间。[AReaL v5 §4–5](https://arxiv.org/html/2505.24298v5)、[PipelineRL v2 §4、§5.1](https://arxiv.org/html/2509.19128v2)

陈旧度也不能直接跨表比较。AReaL 的最大陈旧度 η 按全局训练批次的步数计，每步内部可以有多个 minibatch；PipelineRL 的 lag 按 optimizer steps 计，长回答开头的 token 比结尾更旧。SkyRL 的 `max_staleness_steps` 则约束轨迹组在第 i 步调度、第 j 步用于训练时的 j−i。步长不同，“允许 4 步”并不是同一种宽松程度。[SkyRL 固定版 FullyAsyncConfig](https://github.com/NovaSky-AI/SkyRL/blob/50cfa014aff1c42292fdd7811f24ff96d4aa3600/skyrl/train/config/config.py)

版本差也只是代理指标。同样落后一步，大学习率、更多 minibatch、不同奖励分布都可能产生不同的策略偏移；推理和训练引擎的数值差异甚至会让“版本相同”的概率不完全一致。因此异步训练需要保留真正生成时的行为概率，将它与当前更新所用的近端策略概率区分。额外概率计算、重要性权重的方差控制、过期样本丢弃，都是取消同步屏障之后新增的成本。[AReaL decoupled PPO](https://arxiv.org/html/2505.24298v5#S5)、[TRL 1.17.1 重要性修正配置](https://github.com/huggingface/trl/blob/v1.17.1/trl/trainer/grpo_config.py)

异步队列还改变了样本选择。若只消费最早完成的轨迹，短回答和快环境可能被更频繁地送入训练；若超龄就丢弃，最慢任务又可能持续被排除。保持 prompt 组完整、限制生产超前、记录被丢弃任务的长度与类型，才能区分吞吐提升究竟来自更好的调度，还是换了一种训练分布。这是由队列消费规则推导出的风险，不是上述论文都已报告的退化。

“最新权重立即发布”也未必是最佳调度：过于频繁地暂停推理、搬权重、重算前缀，可能吃掉刚节约的等待时间。实际需要联合选择更新频率、并发请求数与陈旧度上限。NeMo-RL 0.7 的例子把年龄设为一步：v10 的轨迹可在 v10 或 v11 消费，到 v12 就丢弃；这个限制约束了队列，却也意味着生成跟不上时训练必须等数据，而不能无限消费库存。[NeMo-RL 版本追踪](https://github.com/NVIDIA-NeMo/RL/blob/v0.7.0/docs/guides/async-grpo.md)

### 收敛代价有直接消融，空转比例却不能从加速比倒推

AReaL v5 的表 2 给出一组有条件的对照：1.5B 模型、数学任务、250 个训练步，η=4 时普通 PPO 的 AIME24 结果为 23.3，decoupled PPO 为 42.2，同步 oracle 为 42.0；把 η 放宽到无穷，decoupled 也降到 36.9。这里显示的不是“异步免费”，而是**损失修正与有限陈旧度共同构成接近同步结果的条件**。42.2 与 42.0 的差异也不足以单独证明异步提高最终能力。[AReaL v5 §7.4、表 2](https://arxiv.org/html/2505.24298v5#S7.SS4)

同步长尾的严重性可先用透明的示例理解：假设八个等容量生成槽位各只有一项任务，七项用 20 秒、一项用 100 秒，期间不能补入新任务，那么槽位忙时是 240 秒，分配时长是 800 秒，空闲比例为 70%。这是**合成的槽位占用示例**，不是 GPU 利用率实测。连续批处理能在一轮内部补请求；到了轮末只剩长回答时，仍可能因全局屏障无法启动下一轮。真实 GPU 空转比例还取决于批量、TP、prefill / decode 混合和工具等待，不能由这个示例直接赋给任何框架。

论文吞吐数字有助于判断问题量级，却必须保留分母。AsyncFlow v2 在 32–512 张 Ascend NPU、Qwen2.5 7B / 32B、DeepScaleR GRPO 设置下，报告平均吞吐 1.59 倍、7B / 256 NPU 的峰值 2.03 倍；它的 MindSpeed 训练侧对比的是 2025-04-07 提交 `d13434f` 的 verl FSDP，双方均用 vLLM-Ascend 0.7.3。后端和历史版本差异使该结果不能全部归因于异步，更不能搬成今日 NVIDIA 集群上的框架排名。[AsyncFlow v2 §7](https://arxiv.org/html/2507.01663v2)

PipelineRL v2 的 Qwen2.5-base-7B 数学实验使用 128 H100，其中 48 张生成、80 张训练，相对 G=32 的 conventional baseline，报告达到相同 reward 约快两倍；但 conventional baseline 的吞吐来自较小规模运行后的校正估计，不是同一 128 GPU 配置上的直接对跑。它说明持续流水值得研究，不能充当跨框架统一实测。缺少同硬件、同引擎、同样本长度分布的阶段计时，当前证据不足以给九家排出“同步空转百分比”榜单。[PipelineRL v2 §5，2025-09-26](https://arxiv.org/html/2509.19128v2)

## 环境边界：把状态移出去，就要把轨迹可靠地接回来

### 同步函数最先被长程状态和失败恢复逼到边界

短答案验证只需输入回答、返回分数，TRL 的 reward callable 或 slime 的自定义奖励函数可以直接表达。省掉服务协议，也容易把一条样本与其奖励对应起来。到多轮工具任务，环境却要拥有会话、文件、任务终止条件与中间 observation；若仍全塞在一个评分函数里，训练框架只能看见“这条样本很慢”，无法区分模型生成、工具挂起还是环境失联。

这并不意味着 TRL 只能做终局奖励。1.17.1 的 GRPOTrainer 已有 tools 与 `environment_factory`，可以让每个环境提供奖励。真正分歧是由训练侧托管这个交互生命周期，还是把执行独立出去。前者便于把 token、mask 和 reward 当场对齐；成本是环境阻塞、依赖冲突与异常处理进入训练任务的故障域。[TRL 固定版 GRPOTrainer](https://github.com/huggingface/trl/blob/v1.17.1/trl/trainer/grpo_trainer.py)

SkyRL-Gym 将环境写成 `init / step / close`，返回 observation、reward、done 和 metadata；Generator 负责把模型与这些步骤连接起来。这比终局 reward 函数多了可控状态边界，适合需要逐轮观测的任务，但 Gym 接口本身并不承诺独立服务。ROLL 则让多个环境在 Ray worker 内并发推进，一个 worker 可以持有多份环境；慢环境不必阻塞其他环境的每一步，但收批屏障仍存在。此时应扩的是环境并发或解决慢任务，而非只增加推理 GPU。[SkyRL 环境接口](https://github.com/NovaSky-AI/SkyRL/blob/50cfa014aff1c42292fdd7811f24ff96d4aa3600/skyrl-gym/skyrl_gym/core.py)、[ROLL 环境并行](https://alibaba.github.io/ROLL/docs/User%20Guides/Advanced%20Features/async_parallel_rollout/)

独立 environment server 进一步把会话和执行资源搬到另一侧。NeMo-RL 的环境 actor / NeMo Gym 接入，以及 Agent Lightning 的外部 runner，体现了不同层级的隔离：环境可以按 CPU、沙箱或浏览器资源扩容，训练 GPU 不必承载这些依赖；代价是 observation 的传输、会话标识、超时取消和恢复协议。长程任务首先要求明确“重试一个 step”和“重跑整个 episode”的区别，否则服务化只是把阻塞换成了状态不一致。[NeMo-RL 环境指南](https://docs.nvidia.com/nemo/rl/latest/guides/environments.html)、[Agent Lightning Controller](https://microsoft.github.io/agent-lightning/stable/30-controller-configuration/)

### Agent Lightning 保留 agent 循环，却增加样本重建责任

Agent Lightning 1.0 的“不改 agent”有具体边界：不重写原有交互循环，但要把模型 endpoint 指向 OpenAI-compatible gateway，接好任务运行入口与奖励。Gateway 保存模型调用的 token IDs、生成概率及 rollout 关联信息。它不能仅凭任意文本日志恢复一条可训练轨迹。[Agent Lightning Basics，2026-08-12](https://microsoft.github.io/agent-lightning/stable/05-basics/)

与把交互循环直接写进 slime 自定义 rollout 或 SkyRL Generator 的接入路径相比，Lightning 把边界放得更靠外。由训练侧直接组织模型请求、工具返回和 loss mask 时，调试训练数据时路径更短；接入既有 coding agent 时，则可能要迁移交互循环。Lightning 把应用循环保留下来，让网关与后处理承担重建成本，适合不愿把已有 harness 改写成训练框架插件的团队。

代价在上下文压缩和子 agent 中尤其具体。一次 agent 任务可以分成多个不连续的模型上下文；Lightning 1.0 只在 token 前缀完全连续时合并调用，否则拆成多个训练样本。论文的 coding-agent 运行平均每条 rollout 产生 2.4 个样本，只有 36% 仍是一条样本；这不是所有 agent 的通用比例。其 rollout-level advantage 与 loss normalization，正是为避免“拆成更多片段的任务自动获得更高训练权重”。接口解耦并未消除算法耦合，只是把它推到了轨迹重建与加权处。[Agent Lightning v1.0，2026-08-18，§2.2](https://arxiv.org/html/2608.17528v1)

它的“异步”还保留了另一个边界。文档举例启动 64 组，收到 32 个完整组即可更新，未完成组跨步保留；同组 sibling 仍需全部完成。更新前 gateway 暂停接收新请求、排空在途模型请求，共置 GPU 随后才用于训练，再恢复推理。因此它减少的是等待所有活跃组结束的长尾，既没有取消组内屏障，也没有让同一组 GPU 上的生成与反传并行。[Agent Lightning 异步指南，2026-08-12](https://microsoft.github.io/agent-lightning/stable/35-asynchronous-training/)

独立服务也不能只返回最终字符串和总分。为了区分可训练动作与环境 observation，训练侧需要稳定的轨迹关联、模型调用边界以及相应 token 信息；为了复现一次失败，还要知道当时的环境状态与工具版本。这些信息可以由框架内 rollout 直接生成，也可以由网关采集，但跨边界后必须显式传递。把执行成本移到便宜的 CPU worker 上，常常是合理选择；同时也要为任务状态、轨迹记录和取消协议留出工程预算。

长程任务下，独立执行域会先遇到“重试是否重复产生副作用”。Lightning Controller 可以在本地子进程或 Kubernetes Job 中运行 agent，通过网关状态进行协调重试；这是执行管理能力，不代表文件写入、网页提交等环境动作天然只发生一次。若任务不可安全重放，环境必须提供快照或幂等边界。把环境揉进训练循环省掉了这层网络协议，却把训练恢复与环境恢复绑在一起；两个方向的成本无法同时省去。

## 训练引擎决定移植成本，控制框架不能替它补齐模型

**Megatron 路线把并行布局做深，HF 路线把模型接入面做宽；二者的代价在新模型与 MoE 上最容易暴露。** verl 0.7 给出的并行表，FSDP 路径是 FSDP + SP，MCore 路径包括 DP / TP / PP / EP / CP，VeOmni alpha 则尝试 FSDP + SP + EP。这里描述的是框架已接入的组合，不等于底层 PyTorch 只能实现这些组合。[verl 0.7 后端比较](https://verl.readthedocs.io/en/latest/blog/v0.7.html)

slime 固定版使用 Megatron + SGLang。已有 Megatron 模型和集群配方的团队，可以复用 TP、PP、CP、EP 等能力；HF 新模型则要同时解决训练端模块、HF 到 Megatron checkpoint 转换，以及训练到 SGLang 的权重映射。只在推理引擎里能启动模型，不等于训练框架已经能为它更新参数。其 Usage Guide 明确要求转换 HF checkpoint，这就是换模型成本可以落地检查的位置。[slime Usage](https://thudm.github.io/slime/get_started/usage.html)

OpenRLHF 沿 HF + DeepSpeed 路线，以 ZeRO-3 分片，并接入 AutoTP、RingAttention；TRL 继承 Trainer / Accelerate 的生态。熟悉 HF 的团队通常能少维护一套模型定义，但若要大规模 MoE，还须验证 expert placement、token dispatch 和训练—推理 expert 权重对应关系。ZeRO 能分片参数状态，并不自动提供与 Megatron EP 相同的专家计算布局。本篇没有足够证据把 OpenRLHF 的所有 MoE 组合写成与 MCore 等价。[OpenRLHF 架构](https://openrlhf.readthedocs.io/en/latest/architecture.html)、[TRL GRPOTrainer](https://github.com/huggingface/trl/blob/v1.17.1/trl/trainer/grpo_trainer.py)

NeMo-RL 0.7 提供了减少生态转换的另一种选择：训练可用 AutoModel 或 Megatron，推理除了 vLLM 还有 Megatron-native 路径，后者减少训练与推理之间的格式转换，但也让模型与部署继续依赖同一套引擎。文档中的后端菜单仍须和具体代码约束一起读：该版权重同步工厂明确拒绝 SGLang 的非共置模式。不能因为训练、推理两个列表分别出现某后端，就推导任意交叉组合都已实现。[NeMo-RL 后端说明](https://github.com/NVIDIA-NeMo/RL/blob/v0.7.0/docs/about/backends.md)、[同步工厂约束](https://github.com/NVIDIA-NeMo/RL/blob/v0.7.0/nemo_rl/weight_sync/factory.py)

MoE 的“激活参数少”也不保证交接便宜。若实现仍发送完整专家权重，前文通信估算按总参数而非每 token 激活参数计算；router replay 又增加训练数据流量。选择 Megatron 通常是在购买成熟的模型并行与专家布局，同时接受适配和版本依赖；选择 HF / FSDP 则需确认大模型所需的并行组合已被当前框架接通，而不是把生态丰富当成所有组合开箱即用。

## 把选择落在当前最贵的那条路径上

单机或少量节点、短答案验证、频繁换 HF 模型，先比较 TRL 的直接循环与 OpenRLHF 的角色隔离是否值得增加部署层。需要改分布式数据流、比较多个训练后端，可从 verl 的 WorkerGroup 与 backend 边界入手；已有 Megatron 资产、希望自己掌握 rollout 组织，则 slime 的薄编排更契合，但任务调度责任也更多地落在团队手里。

卡数有限且回答长度较整齐，优先实测共置切换峰值显存与交接时延；若它们低于另建推理池的成本，Hybrid 路径有充分理由。若生成长尾、工具等待和批末空槽占主导，再比较 AReaL 类完全异步与 ROLL / SkyRL 的环境并发、有限预生成。后两者可能已足以消除主要等待，未必需要承担在途换权重与多版本 token 的全部复杂性。

既有 agent harness 是产品资产时，Agent Lightning 的网关边界比重写循环更有吸引力，但上线前要检查 token 轨迹、分段归一化与失败重放。任务本来就在训练侧开发，SkyRL-Gym 或 ROLL 环境循环则让 observation 到训练样本的关系更直接。若核心约束是大 MoE 与既有 NVIDIA 训练栈，NeMo-RL / Megatron 路线值得优先验证，但模型、并行与推理组合仍须逐项落到固定版本。

真正需要比较的最终指标，是固定设备预算下到达目标质量的时间。它同时计入吞吐、因陈旧而丢弃的样本、额外概率计算、重算 KV，以及失败后的恢复损失。只有生成 token/s 增长而训练质量或有效样本比例下降，尚不能回答这套架构是否适合当前任务。

## 来源与阅读范围

以下为事实与表格的版本锚点；代码阅读用于核对实现及默认值，论文结果均为原作者报告，本篇未运行训练。动态文档以 2026-10-31 为阅读日；同一项目的论文历史实现不自动代表当前全部后端。

- <a id="source-verl"></a>**verl / HybridFlow**：[论文 2409.19256](https://arxiv.org/abs/2409.19256)；[v0.7.0 release，提交 f9c855f，2026-01-05](https://github.com/verl-project/verl/releases/tag/v0.7.0)；[Single Controller，更新于 2025-05-21](https://verl.readthedocs.io/en/latest/single_controller.html)；[0.7 博客，2026-01-03](https://verl.readthedocs.io/en/latest/blog/v0.7.html)。范围：控制器 / WorkerGroup、混合并行、后端表、三类异步程度、checkpoint engine、TransferQueue 的实验状态；[0.7 agent loop 文档源码](https://github.com/verl-project/verl/blob/v0.7.0/docs/advance/agent_loop.rst)用于环境接口。
- <a id="source-openrlhf"></a>**OpenRLHF**：[0.10.2 架构文档](https://openrlhf.readthedocs.io/en/latest/architecture.html)；固定提交 [dc2a7ad，2026-09-17](https://github.com/OpenRLHF/OpenRLHF/tree/dc2a7ad326f619fc5a47737ea47d1920ce2c0b53)。范围：Ray + DeepSpeed + vLLM、70B+ 声明及[固定 README](https://github.com/OpenRLHF/OpenRLHF/blob/dc2a7ad326f619fc5a47737ea47d1920ce2c0b53/README.md) 中的 reward / agent 接口；`openrlhf/cli/train_ppo_ray.py` 的共置 / 异步默认，`openrlhf/trainer/ray/ppo_actor.py` 的 IPC 条件、gather 与广播。
- <a id="source-trl"></a>**TRL**：[v1.17.1，2026-10-30](https://github.com/huggingface/trl/releases/tag/v1.17.1)。固定版 [vLLM 集成文档](https://github.com/huggingface/trl/blob/v1.17.1/docs/source/vllm_integration.md)、[GRPOConfig](https://github.com/huggingface/trl/blob/v1.17.1/trl/trainer/grpo_config.py)、[GRPOTrainer](https://github.com/huggingface/trl/blob/v1.17.1/trl/trainer/grpo_trainer.py)、[vLLMClient](https://github.com/huggingface/trl/blob/v1.17.1/trl/generation/vllm_client.py)。范围：默认生成 / 共置、NCCL 更新、奖励与环境接口；不把 release 中的 SFT 模型规模当成 RL 实测。
- <a id="source-slime"></a>**slime**：固定 [540ea91，2026-10-27](https://github.com/THUDM/slime/tree/540ea919e45b8b929198abce008a103be9cfc779)；[设计博客，2026-10-19](https://thudm.github.io/slime/blogs/introducing_slime.html)、[Usage](https://thudm.github.io/slime/get_started/usage.html)。范围：`train.py`、`slime/backends/megatron_utils/update_weight/` 的选择器及 tensor / distributed / disk 实现；设备默认分离、checkpoint 转换、fully async rollout 入口。
- <a id="source-areal"></a>**AReaL**：[论文 v5，2026-03-02](https://arxiv.org/html/2505.24298v5)，§4–6 架构及实现，§7 实验、§7.4 表 2；[现行异步文档](https://areal-ai.io/docs/en/algorithms/async.html)。表格后端、硬件规模依论文；文档的 `max_head_offpolicyness=0` 表示同步，示例值不作为项目默认。
- <a id="source-roll"></a>**ROLL**：固定 [d3506ea，2026-10-14 README](https://github.com/alibaba/ROLL/blob/d3506ea9e280ae720fb74df9f82db6efac1c72d5/README.md)；[异步训练](https://alibaba.github.io/ROLL/docs/User%20Guides/Advanced%20Features/async_training/)、[环境并行，2026-09-29](https://alibaba.github.io/ROLL/docs/User%20Guides/Advanced%20Features/async_parallel_rollout/)；[Megatron model_update.py](https://github.com/alibaba/ROLL/blob/d3506ea9e280ae720fb74df9f82db6efac1c72d5/roll/third_party/megatron/model_update.py)、[tensor 序列化](https://github.com/alibaba/ROLL/blob/d3506ea9e280ae720fb74df9f82db6efac1c72d5/roll/utils/send_recv_utils.py)。范围：角色与后端、默认比例、环境并发与收批、权重广播 / bucket handle。异步实现状态依具体文档，不沿用 README 中仍称 RLVR 异步在开发的旧条目。
- <a id="source-skyrl"></a>**SkyRL**：固定 [50cfa01，提交时间 2026-10-30 17:05 −0700，即 UTC 10-31](https://github.com/NovaSky-AI/SkyRL/tree/50cfa014aff1c42292fdd7811f24ff96d4aa3600)；[System Overview](https://docs.skyrl.ai/docs/getting-started/overview)、[Inference Architecture](https://docs.skyrl.ai/docs/getting-started/inference_architecture)、[Fully Async](https://docs.skyrl.ai/docs/tutorials/fully_async)。范围：`skyrl/train/config/config.py` 的默认、陈旧度与 delta 配置，`skyrl-gym/skyrl_gym/core.py` 的环境接口；delta 共享存储路径限定非共置 vLLM。
- <a id="source-nemo"></a>**NeMo-RL**：[v0.7.0，2026-07-29](https://github.com/NVIDIA-NeMo/RL/releases/tag/v0.7.0)；固定版 `docs/design-docs/design-and-philosophy.md`、`docs/about/backends.md`、`docs/guides/async-grpo.md`、`examples/configs/grpo_math_1B.yaml` 与 `nemo_rl/weight_sync/factory.py`，正文附直接链接。另读 [Environments](https://docs.nvidia.com/nemo/rl/latest/guides/environments.html) 的接口、资源分配；1–1000 GPU 是设计声明。
- <a id="source-lightning"></a>**Agent Lightning**：[v1.0 论文 v1，2026-08-18](https://arxiv.org/html/2608.17528v1)，§2–3；固定 [05c7fe1，2026-10-20](https://github.com/microsoft/agent-lightning/tree/05c7fe133175653e48c990546a3509e52dc56512)。文档 [Basics](https://microsoft.github.io/agent-lightning/stable/05-basics/)、[Asynchronous Training](https://microsoft.github.io/agent-lightning/stable/35-asynchronous-training/) 均为 2026-08-12，[Controller Configuration](https://microsoft.github.io/agent-lightning/stable/30-controller-configuration/) 为 2026-09-02。范围：网关、轨迹重建、组屏障、本地 / Kubernetes 执行；不将社区修改分支规模当成核心框架验证。
- **异步补充证据**：[AsyncFlow v2，2026-09-11](https://arxiv.org/html/2507.01663v2)，§3–5、§7 的队列、权重交接、Ascend 实验与基线版本；[PipelineRL v2，2025-09-26](https://arxiv.org/html/2509.19128v2)，§4–5 的流水线、KV 近似和吞吐估计。PipelineRL 引言与实验节的节点数表述不一致，正文采用 §5 明确的 16 DGX / 128 H100 配置。
