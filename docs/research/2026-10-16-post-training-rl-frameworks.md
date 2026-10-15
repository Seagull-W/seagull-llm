---
title: "2026-10-16 大模型后训练：强化学习框架的配置与故障现场"
description: "从 verl、TRL、OpenRLHF 的实际训练配置出发，核对 slime 与 AReaL 的活跃实现，分析显存切换、奖励设计及异步 rollout 偏差。"
tags: ["每日调研", "RLHF", "后训练", "GRPO"]
date: 2026-10-16
---

# 2026-10-16 大模型后训练：强化学习框架的配置与故障现场

**编辑归纳：**选后训练框架，首先要确认训练与生成怎样交接：权重如何同步、哪些模型共用 GPU、batch 指提示还是回答、奖励是否真的代表任务成功。算法名称相同，以上约定也可能不同。下面沿着 DAPO、Open R1 和 ProRL v2 的公开实现检查这些约定，再用故障记录说明排查顺序。

> 调研基准日：2026-10-16，Asia/Shanghai。重点回看 2025–2026 的实现与实践，不限定最近一天。实际阅读包含仓库 README、指定版本的配置与局部代码、release notes、issue/discussion 正文及可见回复、工程博客全文；没有运行 GPU 训练，也没有独立复现实验。文中的“配置事实”表示文件确实这样设置，不表示该设置已经在本地跑通；“作者声称”保留原作者的适用条件。可变分支与历史配置分开引用，完整阅读范围见文末。

## 框架覆盖：先确认实际使用的训练路径

这张表比较代码组织与使用入口，不比较各项目发布的分数或吞吐量。

| 框架 | 本次核对的训练与 rollout 路径 | 使用时需要先核对什么 | 阅读深度 |
| --- | --- | --- | --- |
| verl | 官方列出 FSDP/FSDP2、Megatron-LM 训练及 vLLM、SGLang rollout；DAPO 配方提供更具体的落地证据。[仓库 README](https://github.com/verl-project/verl/blob/5b550b0c3dad8c7bb7aab834a3fe195f8cdfc517/README.md) | 配方的依赖版本、动态采样、loss 聚合方式以及训练/生成并行配置。 | README、发布记录、DAPO 脚本与配方说明；没有通读核心 trainer。 |
| TRL | 基于 Transformers/Accelerate 的 trainer；Open R1 的入口直接实例化 `GRPOTrainer`。[调用代码](https://github.com/huggingface/open-r1/blob/5b6ff22b3fb7aa069c54866e517f39dfc3160e09/src/open_r1/grpo.py) | `GRPOTrainer` 名称不保证 loss 仍是原始 GRPO：配置单独控制 loss、重要性采样粒度及 vLLM 部署模式。[配置定义](https://github.com/huggingface/trl/blob/9d76f2f8c0421fcf8a4a72113a9e226ce796e592/trl/trainer/grpo_config.py) | README、release 页面、GRPO 配置定义及文档相关段落、Open R1 调用代码。 |
| OpenRLHF | 本次具体检查 Ray 调度、DeepSpeed ZeRO 训练和 vLLM 生成路径；官方工程文解释共置及 NCCL/CUDA IPC 权重同步。[工程全文](https://vllm.ai/blog/2025-04-23-openrlhf-vllm) | 训练、reference 与 rollout 的资源是否共置；远程 reward 服务也必须算入内存预算。 | README、release 页面、ProRL v2 脚本、内存 issue；没有审计全部算法。 |
| slime | Megatron 训练与 SGLang rollout；训练循环可见生成、训练、权重更新和 KV 恢复的次序。[训练入口](https://github.com/THUDM/slime/blob/v0.4.0/train.py) | 模型转换、参数映射、共置时的内存恢复顺序，以及同步/完全异步模式所对应的版本。 | README、release 正文、训练入口、示例脚本和调试文档。 |
| AReaL | 异步解耦训练；本次示例明确选择 FSDP actor 与 SGLang rollout。[配置](https://github.com/areal-project/AReaL/blob/v2.1.0/examples/math/gsm8k_grpo.yaml) | 允许的策略滞后、logprob 重算、decoupled loss；不能只把异步理解成增加并发。 | README、release 正文、异步算法文档和示例 YAML；没有通读调度器。 |

### slime、AReaL 仍然活跃吗？

**可核对的活动证据：**slime 在 **2026-10-09 发布 v0.4.0**，发布正文说明统一使用 `train.py` 处理同步和完全异步训练，并移除旧的 `train_async.py`；同时增加持久化 rollout 数据和训练失败后的恢复路径。这是已发布的维护动作，而非仅有路线图。[slime v0.4.0](https://github.com/THUDM/slime/releases/tag/v0.4.0)

AReaL 在 **2026-08-25 发布 v2.1.0**，变更包括 Megatron optimizer sharding 和恢复状态的修正；此前 **2026-07-01 的 v2.0.0** 已发布训练、推理、agent 和权重更新的微服务架构。[AReaL 发布记录](https://github.com/areal-project/AReaL/releases)

**编辑判断：**这些发布记录与仍可读取的配置、代码足以支持“本次检索时仍有活跃实现”。它们不能证明每种模型、每条示例在所有环境下都通过验证，也不构成生产可靠性保证。

## 实际项目怎样使用框架

### DAPO：生成预算与训练 batch 必须分开读

这里引用 verl 配方作者公开的复现，而非把原论文、当前主分支和复现脚本混成同一次实验。复现表登记的硬件是 **16 节点 × 每节点 8 张 H800**，并给出包含 **vLLM 0.8.3** 的镜像与 commit `4f80e465`；以下配置取自该 commit 的完整脚本。[复现表](https://github.com/verl-project/verl-recipe/blob/main/dapo/README.md) · [固定版本脚本](https://github.com/verl-project/verl/blob/4f80e465c2ec79ab9c3c30ec74b9745de61d0490/recipe/dapo/run_dapo_qwen2.5_32b.sh)

| 项目 | 脚本中的配置事实 |
| --- | --- |
| 模型与数据 | Qwen2.5-32B；训练文件 `dapo-math-17k.parquet`；优势估计器为 `grpo`。[脚本](https://github.com/verl-project/verl/blob/4f80e465c2ec79ab9c3c30ec74b9745de61d0490/recipe/dapo/run_dapo_qwen2.5_32b.sh) |
| batch / group | 生成提示 batch 为 `512 * 3`，训练提示 batch 为 `512`，每提示 `16` 个回答，提示 mini-batch 为 `32`。[脚本](https://github.com/verl-project/verl/blob/4f80e465c2ec79ab9c3c30ec74b9745de61d0490/recipe/dapo/run_dapo_qwen2.5_32b.sh) |
| 并行与显存 | FSDP 配置启用参数和 optimizer offload；Ulysses sequence parallel 为 `8`；vLLM tensor parallel 为 `4`，`gpu_memory_utilization=0.7`，启用动态 token batch。[脚本](https://github.com/verl-project/verl/blob/4f80e465c2ec79ab9c3c30ec74b9745de61d0490/recipe/dapo/run_dapo_qwen2.5_32b.sh) |
| 长度与更新 | prompt 上限 `2048`、response 上限 `20480`，overlong buffer 为 `4096`；clip 下/上参数为 `0.2/0.28`，loss 为 `token-mean`，reward KL 与单独 KL loss 均关闭。[脚本](https://github.com/verl-project/verl/blob/4f80e465c2ec79ab9c3c30ec74b9745de61d0490/recipe/dapo/run_dapo_qwen2.5_32b.sh) |

**配方作者的处理：**dynamic sampling 丢弃组内指标完全相同的提示组，再继续生成，直到凑够训练提示；脚本设置最多尝试 `10` 批。配方正文展示了超过上限时抛出 `Generated too many. Please check your data.` 的代码。[采样说明与代码摘录](https://github.com/verl-project/verl-recipe/blob/main/dapo/README.md)

**编辑归纳：**训练日志中的一个 batch 不能直接代表生成成本。组内全对或全错的比例升高时，被过滤的回答仍消耗 rollout 资源；遇到“凑不够 batch”，应先看题目难度和组奖励分布。这里是根据配方代码推导出的排查方向，不是本篇观测到的运行故障。上面的 clip 是概率比裁剪参数，也不是梯度范数阈值。

**技术报告的交叉核对：**DAPO v2 报告第 4.1 节写的是 AdamW、恒定学习率 **1e-6**、线性 warm-up **20 个 rollout step**，每批 **512** 个提示、每提示 **16** 个回答，训练 mini-batch **512**，并明确写出每次 rollout **16** 次梯度更新。编辑按组大小归纳：历史脚本中的提示 mini-batch **32** 与报告中的 batch 不能只按字段数值对照；其 warm-up 字段也写成 **10**。报告与复现脚本应分别保留，不能声称逐项完全相同。[报告第 4.1 节](https://arxiv.org/html/2503.14476v2#S4.SS1) · [历史脚本](https://github.com/verl-project/verl/blob/4f80e465c2ec79ab9c3c30ec74b9745de61d0490/recipe/dapo/run_dapo_qwen2.5_32b.sh)

### Open R1 → TRL：同一项目里存在两种 vLLM 部署

**配置事实：**Open R1 的 Qwen2.5-1.5B-Instruct GRPO demo 使用 OpenR1-Math-220k，开启 vLLM；`num_generations=16`、`per_device_train_batch_size=16`、梯度累积 `4`，prompt/completion 上限分别是 `512/1024`，learning rate 为 `2e-5`。accuracy、format、tag_count 三项 reward 权重都为 `1.0`。[固定版本 YAML](https://github.com/huggingface/open-r1/blob/5b6ff22b3fb7aa069c54866e517f39dfc3160e09/recipes/Qwen2.5-1.5B-Instruct/grpo/config_demo.yaml)

项目说明训练命令按 **8 × H100 80GB** 节点准备；GRPO 章节分别展示同进程 `colocate`，以及训练节点之外单设 vLLM server 的部署。其多节点示例使用 **2 节点、训练 DP=8、TP=1**，Accelerate 的 `zero2.yaml` 则明确是 ZeRO stage `2`、`8` 个进程。[硬件假设与部署说明](https://github.com/huggingface/open-r1/blob/5b6ff22b3fb7aa069c54866e517f39dfc3160e09/README.md) · [ZeRO 配置](https://github.com/huggingface/open-r1/blob/5b6ff22b3fb7aa069c54866e517f39dfc3160e09/recipes/accelerate_configs/zero2.yaml)

**编辑归纳：**以上是项目提供的配置与拓扑入口，不是一份已完成训练的逐卡资源报告。每设备 batch、生成组大小与提示数不能直接互换；复现实验应同时保存 YAML、启动命令及 TRL 版本。当前 TRL 的 `GRPOConfig` 已将 `loss_type` 默认设为 `dapo`，并允许分别选择 token/sequence 级重要性采样；不能用今天的默认值反推早期 Open R1 实验。[当前固定快照的定义](https://github.com/huggingface/trl/blob/9d76f2f8c0421fcf8a4a72113a9e226ce796e592/trl/trainer/grpo_config.py)

### ProRL v2 → OpenRLHF：工程博客和示例脚本不是同一份实验记录

**作者声称：**NVIDIA 工程文正文说明，以 DeepSeek-R1-Distill-Qwen-1.5B 为基座进行长期 RL，采用 PPO-Clip loss 与 REINFORCE++-baseline，结合 Clip-Higher、dynamic sampling、KL 正则、reference reset 和阶段性长度惩罚。正文给出的 clip 参数为 **0.20/0.28**，并描述每 **200–500** 步或遇到 KL spike/验证停滞时重置 reference，保留 optimizer 状态。[ProRL v2 工程全文](https://developer.nvidia.com/blog/scaling-llm-reinforcement-learning-with-prolonged-training-using-prorl-v2/)

**当前代码事实：**OpenRLHF 提供同名训练脚本，选择上述 **1.5B** 基座、`OpenRLHF/dapo-math-17k`、`reinforce_baseline`，设置训练 batch **1024**、rollout batch **512**、每提示回答数 **16**；actor/reference 均配置单节点 **8 GPU**，共置运行，vLLM engine 数 **8**、TP **1**，ZeRO stage **3**，最大新 token **8192**。该脚本没有标明 GPU 型号。[固定快照脚本](https://github.com/OpenRLHF/OpenRLHF/blob/dc2a7ad326f619fc5a47737ea47d1920ce2c0b53/examples/scripts/train_prorlv2_math_hybrid_engine.sh)

值得对照的是，脚本实际 clip 参数为 **0.2/0.27**；启用 token 级重要性修正并在区间 **[0.5, 5.0]** 外 mask；长度惩罚的部分选项出现在注释中，不能据此认定已启用。脚本也不能独立证明博客中的周期性 reference reset 已完整实现。[脚本的参数与注释](https://github.com/OpenRLHF/OpenRLHF/blob/dc2a7ad326f619fc5a47737ea47d1920ce2c0b53/examples/scripts/train_prorlv2_math_hybrid_engine.sh)

**编辑归纳：**actor、reference 和 rollout 的配置 GPU 数不能相加成物理卡数，因为该脚本开启共置。更不能把同名示例当成原报告全部实验设置；移植时需要检查实际生效参数与训练循环。本文不横向比较这几个项目的最终分数。

### slime 与 AReaL：可检查的官方配置基线

以下是框架内置示例，证据等级与上面的项目训练报告不同。它们说明接口怎样落地，不证明外部项目的效果。

| 固定版本示例 | 模型、算法、batch 与并行 | 尚未披露的条件 |
| --- | --- | --- |
| [slime v0.4.0 Qwen3-4B](https://github.com/THUDM/slime/blob/v0.4.0/scripts/run-qwen3-4B.sh) | GRPO；rollout 提示 batch `32`，每提示 `8` 个回答，global batch `256`，response 上限 `8192`；Megatron TP `2`、PP `1`、CP `1`，开启 sequence parallel；SGLang 每 engine `2 GPU`，静态显存比例 `0.7`，训练与生成共置。 | 脚本自动检测卡数、检测失败时回退 `8`；未指定 GPU 型号，不能写成某型号的最低配置。 |
| [AReaL v2.1.0 GSM8K GRPO](https://github.com/areal-project/AReaL/blob/v2.1.0/examples/math/gsm8k_grpo.yaml) | Qwen2.5-1.5B-Instruct；集群 `1×8 GPU`，actor `fsdp:d4p1t1`、rollout `sglang:d4p1t1`；训练数据 batch `256`、每提示 `4` 个回答，最大新 token `1024`；允许策略滞后 `2`，开启 decoupled loss 和 logprob 重算。 | 未指定 GPU 型号或峰值显存；batch 字段需沿数据管线解释，不能直接与 TRL 每设备 batch 对照。 |

## 故障与经验：哪些结论能直接用于排查

### OOM 先定位发生阶段，再区分主机内存与显存

**工程作者的经验：**Biao He、Ata Fatahi 的全文介绍 verl + SGLang 的内存切换问题。作者描述，大模型或较高 KV 比例下，训练切回 rollout 时仍可能 OOM，采用的顺序是：先载入训练权重、恢复推理权重、同步、卸载训练模型，最后恢复 KV cache；底层通过带 tag 的内存暂停/恢复实现。作者报告最终能在 **8 × H200** 上以 **0.9** 的 KV cache 内存比例训练 Qwen **32B**，这是该团队的结果，本篇没有复现。[内存优化全文](https://hebiao064.github.io/rl-memory-management)

**编辑归纳：**若 OOM 恰好发生在权重同步或 KV 恢复，降低训练 micro-batch 未必触及峰值原因。应先记录阶段交界处的内存，再检查是否让训练权重、推理权重、KV cache 同时驻留；上述分阶段恢复经验对应特定引擎实现，不能只复制一个显存比例。

另一个现场来自 **2025-03-24 的 OpenRLHF #911**：报告者用 **8 × A800** 训练 **7B** 模型，算法参数为 `reinforce_baseline`，训练 batch **256**、rollout batch **64**、每提示 **16** 个回答，vLLM **2 engine × TP 2**，ZeRO stage **2**。报错时节点内存达到 **239.02/251.56 GB**；日志列出的 `nl2sql_reward.py` 进程占用 **176.97 GB**。这是 Ray 的主机内存阈值触发记录，不能写成 CUDA 显存不足。[issue 正文、命令与日志](https://github.com/OpenRLHF/OpenRLHF/issues/911)

该页面可读内容没有维护者确认的修复。相关 **#1013** 中，另一位报告者称移除 `--vllm_enable_sleep` 后不再遇到问题，但同时询问这是否正确；不能把这句话升级为已确认根因或通用修复。[2025-05-14 的报告者原话](https://github.com/OpenRLHF/OpenRLHF/issues/1013)

**编辑建议：**遇到 Ray 杀 worker，先检查 RSS、reward 服务和对象存储，再检查 GPU。被杀的是权重更新 worker，并不表示它就是内存增长来源；关闭内存监控也不等于解决占用增长。

### “固定步数卡住”可能只是日志表象

**Open R1 discussion #512** 的报告者在 DGX H100 集群以 **4 个进程**运行 GRPO，最初看到 W&B 停在 step **8**，降低 batch 仍复现。维护者要求中断堆栈并核对 vLLM 版本；后续回复给出 **vLLM 0.7.2**，还说明控制台实际到达 step **15**，最终捕获 `_ALLGATHER_BASE` 的 NCCL watchdog timeout。可见讨论末尾仍在追问原因，没有已验证修复。[正文和全部可见回复](https://github.com/huggingface/open-r1/discussions/512)

**编辑归纳：**这里可操作的处理是保留各 rank 日志、确认运行版本和实际阻塞位置，再判断生成、reward 或 collective 哪一方没有返回。该帖不足以推出“调大超时”或“升级某一版本”一定有效。

### 奖励上升之前，先验证奖励确实代表成功

**作者经验：**Open R1 的 2025-03-11 工程文发现，所检查的 **7 道**竞赛题中，R1 解答都通过公开短测试，却全部没通过 CodeForces 的完整测试。这个例子说明测试覆盖不足；它本身没有证明 RL 模型主动学会了 reward hacking。[Open R1 Update #3 全文](https://huggingface.co/blog/open-r1/update-3)

**个人实验观点：**kalomaze 的 2025-03-03 全文在语义判断任务中，把 XML 格式 bonus **0.2** 限定为“判断也正确时才给”，长度 bonus 也要求判断正确；作者还偏好 `constant_with_warmup` 及 `max_grad_norm=0.2`。作者明确承认其奖励幂次缩放没有严格对照，因此这些是调参线索，不能当作普适最优参数。[GRPO Judge 实验全文](https://kalomaze.bearblog.dev/grpo-judge-experiments-findings-and-empirical-observations/)

**编辑建议：**分别记录正确性、格式、长度奖励和留出集真实通过率，并抽查高奖励回答。条件式格式奖励是减少“答错但格式得分”的一种设计选择；不能把格式奖励权重提高后产生的总 reward 上升直接解释为能力提升。梯度 norm clipping 和 PPO 概率比 clipping 则应分开设置、分开观察。

### 长度与 KL：先检查实际目标，不照搬同名参数

**配置证据：**当前 TRL 配置定义明确说明，原始 `grpo` 的按回答长度归一化存在长度偏差，`dr_grpo` 用固定长度常量，`dapo` 按全局累积 batch 的有效 token 数归一化；其 `beta=0` 时不加载 reference。改变 loss 聚合或 KL 系数同时可能改变训练行为与内存占用。[配置正文](https://github.com/huggingface/trl/blob/9d76f2f8c0421fcf8a4a72113a9e226ce796e592/trl/trainer/grpo_config.py)

**报告作者的故障分析：**DAPO 第 3.1–3.4 节将初始训练中的熵塌缩、长回答里的重复/乱码，以及对截断回答一律惩罚引入的 reward noise 分开讨论，分别引入 Clip-Higher、token 级 loss 和 overlong filtering/shaping。它支持“先区分是哪一种长度异常”的排查思路，不能据此把所有长度增长都叫作同一种崩溃。[技术报告方法与训练动态](https://arxiv.org/html/2503.14476v2#S3)

**编辑归纳：**DAPO 示例关闭 KL，而 ProRL v2 工程文使用 KL 与 reference reset；这是不同训练配方的选择，不能归纳成“后训练都应关闭 KL”。发生长度异常时，先同时查看正确/错误回答的长度分布、截断比例和 loss 分母，再考虑惩罚。本文没有足够证据给出跨任务的统一长度惩罚系数或数据配比。

### 同步/异步偏差：给 rollout 记录策略版本

**官方处理：**AReaL 文档解释，异步训练中生成策略可能落后于训练策略，partial rollout 还可能让同一条轨迹跨多个权重版本。它通过 `max_head_offpolicyness` 限制滞后，并使用 decoupled PPO objective；设为 **0** 可切回同步基线。文档写成 `recompute_logprobs`，但本次实际 YAML 字段是单数 `recompute_logprob`，照抄文档前应以对应版本配置定义核对。[异步文档](https://github.com/areal-project/AReaL/blob/v2.1.0/docs/en/algorithms/async.md) · [实际 YAML](https://github.com/areal-project/AReaL/blob/v2.1.0/examples/math/gsm8k_grpo.yaml)

**官方调试经验：**slime 支持 `--debug-rollout-only`、保存 rollout、再通过 `--load-debug-rollout-data` 只跑训练。官方调试文还建议对齐 checkpoint、参数映射和 chat template，并检查后续权重加载阶段的 OOM。[v0.4.0 调试文档](https://github.com/THUDM/slime/blob/v0.4.0/docs/en/developer_guide/debug.md)

**编辑建议：**保存 token、采样时 logprob、生成策略版本、重算 logprob、reward 分项和截断标记。先用固定 rollout 重放训练，隔离优化问题，再恢复异步，检查滞后及重要性修正保留了多少样本。异步流水线中的重要性修正不能代替权重同步正确性检查；队列变长也不自动等于有效训练更快。

## 如何把这些材料变成自己的实验起点

**编辑建议，尚未经本篇实验验证：**

1. 从最接近自己模型和硬件的完整启动命令出发，固定框架 commit、推理引擎、镜像与配置。记录提示 batch、回答 group、训练 mini-batch 和每卡 token 预算各自的含义。
2. 先跑通生成、reward、训练、同步后的再次生成，以及 checkpoint 恢复。检查生成文本、reward 分项和显存/RSS；不要仅以第一步 loss 正常判断整个循环正确。
3. 保留同步或固定数据重放基线，再逐项改变共置、offload、异步、重要性修正。观察验证成功率和有效样本量，避免只追求 rollout 吞吐。
4. 对外报告时，把“脚本默认值”“作者完成的运行”“自己复现的结果”分开。没有公开的 GPU 型号、峰值显存或消融，就保留空缺。

## 来源与阅读范围

下表只登记实际读取的正文或代码。下载仓库不代表通读；搜索结果摘要、博客侧栏推荐、链接指向但未打开的论文、W&B 曲线均未作为训练证据。

| 来源 URL | 实际读了什么 |
| --- | --- |
| [verl README](https://github.com/verl-project/verl/blob/5b550b0c3dad8c7bb7aab834a3fe195f8cdfc517/README.md)；[releases](https://github.com/verl-project/verl/releases) | README 的后端、算法和配方入口；发布页可见正文，未逐个打开 PR。 |
| [TRL README](https://github.com/huggingface/trl)；[releases](https://github.com/huggingface/trl/releases) | README 的架构、安装和 trainer 示例及发布页可见变更；不据此声明所有算法均验证。 |
| [TRL GRPOConfig](https://github.com/huggingface/trl/blob/9d76f2f8c0421fcf8a4a72113a9e226ce796e592/trl/trainer/grpo_config.py)；[GRPO 文档](https://github.com/huggingface/trl/blob/main/docs/source/grpo_trainer.md) | 生成、训练、loss、reward、KL 和重要性采样配置定义；文档的 loss 聚合及监控段落，未通读 trainer 实现。 |
| [OpenRLHF README](https://github.com/OpenRLHF/OpenRLHF)；[releases](https://github.com/OpenRLHF/OpenRLHF/releases) | README 架构、新闻、使用与性能建议；发布页正文。 |
| [DAPO 配方](https://github.com/verl-project/verl-recipe/blob/main/dapo/README.md)；[历史脚本](https://github.com/verl-project/verl/blob/4f80e465c2ec79ab9c3c30ec74b9745de61d0490/recipe/dapo/run_dapo_qwen2.5_32b.sh) | 配方正文、复现表、过滤逻辑摘录；固定 commit 的完整脚本。未打开 W&B，也未精读论文。 |
| [DAPO 技术报告 v2](https://arxiv.org/html/2503.14476v2) | 读了第 2–3 节方法和第 4.1 节训练设置，浏览训练动态文字；未精读全部附录、未复核图表原始数据。 |
| [Open R1 README](https://github.com/huggingface/open-r1/blob/5b6ff22b3fb7aa069c54866e517f39dfc3160e09/README.md)；[调用代码](https://github.com/huggingface/open-r1/blob/5b6ff22b3fb7aa069c54866e517f39dfc3160e09/src/open_r1/grpo.py) | README 的环境、硬件、GRPO 部署段落；数据处理、trainer 初始化和训练调用代码。 |
| [Open R1 YAML](https://github.com/huggingface/open-r1/blob/5b6ff22b3fb7aa069c54866e517f39dfc3160e09/recipes/Qwen2.5-1.5B-Instruct/grpo/config_demo.yaml)；[ZeRO YAML](https://github.com/huggingface/open-r1/blob/5b6ff22b3fb7aa069c54866e517f39dfc3160e09/recipes/accelerate_configs/zero2.yaml) | 两份配置全文。 |
| [ProRL v2 脚本](https://github.com/OpenRLHF/OpenRLHF/blob/dc2a7ad326f619fc5a47737ea47d1920ce2c0b53/examples/scripts/train_prorlv2_math_hybrid_engine.sh) | 完整脚本，包括未启用的注释选项。 |
| [ProRL v2 工程文](https://developer.nvidia.com/blog/scaling-llm-reinforcement-learning-with-prolonged-training-using-prorl-v2/) | 人类署名正文全文；未把页面 AI-generated summary 当证据，未从图中估读分数。页面署名日期是 2025-08-13，OpenRLHF README 后来的新闻月份不用于替代原文日期。 |
| [slime README](https://github.com/THUDM/slime)；[v0.4.0 release](https://github.com/THUDM/slime/releases/tag/v0.4.0) | README 架构与入口；release 正文及发布时间。 |
| [slime 训练入口](https://github.com/THUDM/slime/blob/v0.4.0/train.py)；[Qwen3-4B 脚本](https://github.com/THUDM/slime/blob/v0.4.0/scripts/run-qwen3-4B.sh)；[调试文档](https://github.com/THUDM/slime/blob/v0.4.0/docs/en/developer_guide/debug.md) | 入口、脚本及调试正文；没有执行脚本中的清理或训练命令。 |
| [slime policy mismatch 文档](https://github.com/THUDM/slime/blob/main/docs/en/advanced/policy-mismatch.md) | 当前文档全文，用于梳理训练/行为策略和重要性修正区别；未追读链接论文，不用可变分支推断旧实验。 |
| [AReaL README](https://github.com/areal-project/AReaL)；[releases](https://github.com/areal-project/AReaL/releases) | README、v2.0.0 与 v2.1.0 等可见 release 正文。 |
| [AReaL YAML](https://github.com/areal-project/AReaL/blob/v2.1.0/examples/math/gsm8k_grpo.yaml)；[异步文档](https://github.com/areal-project/AReaL/blob/v2.1.0/docs/en/algorithms/async.md) | 两份全文；未审计调度器或复现论文。 |
| [SimpleRL README](https://github.com/hkust-nlp/simpleRL-reason/blob/cf1c7858bfc145a27aa733e75d930d34f0d318a6/README.md) | 只读 README 的 PPO、OpenRLHF 和 vLLM 使用说明。未取得所尝试路径的脚本，未纳入上面的配置案例。 |
| [OpenRLHF #911](https://github.com/OpenRLHF/OpenRLHF/issues/911)；[#1013](https://github.com/OpenRLHF/OpenRLHF/issues/1013) | 可见 issue 正文、启动命令与日志；没有读到维护者确认修复。 |
| [Open R1 discussion #512](https://github.com/huggingface/open-r1/discussions/512) | 正文、维护者问询和全部可见跟帖、日志。 |
| [OpenRLHF/vLLM 工程文](https://vllm.ai/blog/2025-04-23-openrlhf-vllm) | 全文及示例代码；旧博客地址会跳转到该地址。 |
| [Open R1 Update #3](https://huggingface.co/blog/open-r1/update-3) | 博客正文全文；竞赛验证、SFT 经验与 GRPO 更新分别理解，未把 SFT 的 OOM 数字写成 RL 实验。 |
| [kalomaze GRPO Judge](https://kalomaze.bearblog.dev/grpo-judge-experiments-findings-and-empirical-observations/) | 全文文字；未读取外链 W&B 训练文件，也未把图片趋势当作独立测量。 |
| [Biao He、Ata Fatahi：verl 内存优化](https://hebiao064.github.io/rl-memory-management) | 全文、阶段切换顺序与代码示意；未追读全部 RFC 或运行性能测试。 |

## 未覆盖

- **知乎：**尝试打开[检索返回的入口](https://zhuanlan.zhihu.com/p/2073117804711113332)，网页读取超时，本机代理请求返回 HTTP 403；未引用其正文。该入口本身偏具身训练，也不据它扩展本文范围。
- **GitHub API：**匿名 commits/tree 接口返回 HTTP 403 rate limit exceeded；改读 GitHub 页面、raw 文件及仓库归档，使用 git remote 核对 HEAD。未完成截至基准日的全仓提交历史审计；可变 README 仅作检索时概况，历史配置优先用 commit/tag。
- **未取得的代码入口：**SimpleRL 的 `main`/`master` 归档及尝试的训练脚本路径返回 404；随后确认默认分支为 `v1`。本次仅保留实际读到的 README 记录，不填补 batch、GPU 或显存数字。
- **未检索或未阅读全文：**X、微信公众号、付费/登录内容；没有把它们写成“已访问但没有更新”。其他训练框架也未做本次代码核查，因此不列成候选库清单。
- **未完成的实验核验：**没有 GPU 复现、W&B 原始曲线审计；技术报告仅核对上述章节，未做整篇精读。数据混合比例、跨框架吞吐排名和最低显存配置均不作推断。
