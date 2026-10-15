---
title: "2026-10-16 后训练强化学习框架：五个入口与三组配置"
description: "介绍 verl、TRL、OpenRLHF、slime 和 AReaL 各自的训练与生成入口，再对照 DAPO、Open R1、ProRL v2 的公开配置和故障记录。"
tags: ["每日调研", "RLHF", "后训练", "GRPO"]
date: "2026-10-16"
---

# 2026-10-16 后训练强化学习框架：五个入口与三组配置

::: info 本期要点
- **先认框架，再看配置。** verl、TRL、OpenRLHF、slime、AReaL 解决的是训练与生成如何交接，不是同一套算法。 [S1](#source-s1) [S4](#source-s4) [S7](#source-s7) [S10](#source-s10) [S11](#source-s11)
- **同名脚本不等于同一次实验。** DAPO、Open R1、ProRL v2 的报告、博客和仓库脚本要分开读。 [S2](#source-s2) [S3](#source-s3) [S6](#source-s6) [S8](#source-s8)
- **故障先看发生在哪一段。** 显存切换、主机内存、集合通信卡住和奖励失真，不是同一个旋钮。 [S12](#source-s12) [S13](#source-s13) [S14](#source-s14)
:::

> 调研基准日：2026-10-16（Asia/Shanghai）。这不是按最近一天筛摘要的日报，而是回看 2025–2026 仍能打开的实现与实践。阅读范围是 README、指定版本的配置和局部代码、release 正文、issue 可见回复，以及几篇工程博客。没有跑 GPU，也没有复现实验。文中的「配置事实」只表示文件里这样写。

## 五个框架分别做什么

选框架时先回答三件事：谁做参数更新，谁做采样，权重怎么交回去。算法名相同，这三件事仍可能不同。

### verl：配方落在 FSDP 或 Megatron 上，采样交给 vLLM / SGLang

verl 把后训练拆成训练后端和 rollout 后端。官方 README 列出的训练路径是 FSDP、FSDP2 和 Megatron-LM，rollout 路径是 vLLM 和 SGLang。具体算法不都写在核心 trainer 里，而是放到配方；本次用 DAPO 配方核对它怎么落地。 [S1](#source-s1) [S2](#source-s2)

使用前要先对上四样东西：配方锁的依赖版本、动态采样会不会丢掉整组、loss 按什么聚合，以及训练和生成各用哪种并行。本次读了 README、发布页、DAPO 复现表和一份固定 commit 的脚本，没有通读核心 trainer。 [S1](#source-s1)

### TRL：入口叫 GRPOTrainer，损失不一定还是 GRPO

TRL 是 Hugging Face 放在 Transformers 和 Accelerate 上的 trainer 库。Open R1 的训练入口直接构造 `GRPOTrainer`。名字只说明走这条 trainer，不说明损失公式。当前快照里 `loss_type` 默认是 `dapo`，还可以分别选 token 级或 sequence 级重要性采样。 [S4](#source-s4) [S6](#source-s6)

`beta=0` 时不加载 reference 模型。原始 `grpo` 按回答长度归一化，作者注明有长度偏差；`dr_grpo` 用固定长度常量；`dapo` 按全局累积 batch 里的有效 token 数归一化。所以不能用今天的默认值反推早期 Open R1 实验。本次读了 README、release 页、`GRPOConfig` 和文档里的 loss 段落，没有通读 trainer 实现。 [S4](#source-s4) [S5](#source-s5)

### OpenRLHF：Ray 调度，DeepSpeed 训练，vLLM 生成

本次核对的路径是 Ray 调度进程、DeepSpeed ZeRO 更新参数、vLLM 负责生成。官方工程文说明训练和 rollout 可以共置，权重通过 NCCL 或 CUDA IPC 同步。远程 reward 进程也占主机内存，不能只算 GPU。 [S7](#source-s7) [S9](#source-s9)

共置时，脚本里 actor、reference、vLLM 各自写的 GPU 数不能相加成物理卡数。本次读了 README、release 页、ProRL v2 脚本和两条内存 issue，没有审计全部算法。 [S7](#source-s7) [S12](#source-s12)

### slime：Megatron 训练，SGLang 采样，同步和全异步走同一个入口

slime 用 Megatron 做训练、SGLang 做 rollout。训练循环里能看到生成、训练、权重更新和 KV 恢复的次序。2026-10-09 的 v0.4.0 把同步和完全异步都收进 `train.py`，并移除旧的 `train_async.py`，同时加上持久化 rollout 和训练失败后的恢复。这是已发布的维护记录，不是路线图。 [S10](#source-s10)

示例脚本会自动检测卡数，检测失败时回退到 8，而且没有写 GPU 型号，不能把它当成某张卡的最低配置。本次读了 README、v0.4.0 发布说明、`train.py`、Qwen3-4B 示例和调试文档。 [S10](#source-s10)

### AReaL：异步是允许策略落后，不是多开几个 worker

AReaL 把训练和生成拆开跑。本次 v2.1.0 的 GSM8K 示例明确是 FSDP actor 加 SGLang rollout。异步时，生成策略可以落后于正在更新的策略；一条 partial rollout 还可能跨过多个权重版本。文档用 `max_head_offpolicyness` 限制落后步数，并用 decoupled loss；设为 0 可以回到同步。2026-08-25 的 v2.1.0 修了 Megatron optimizer sharding 和恢复状态，2026-07-01 的 v2.0.0 已经改成训练、推理、agent、权重更新的微服务。 [S11](#source-s11)

文档写的是 `recompute_logprobs`，示例 YAML 的字段是单数 `recompute_logprob`。照抄前要以该版本的配置定义为准。本次读了 README、release 正文、异步文档和这份 YAML，没有通读调度器。 [S11](#source-s11)

| 框架 | 本次看到的交接方式 | 先核对什么 |
| --- | --- | --- |
| verl | FSDP / FSDP2 / Megatron 训练，vLLM 或 SGLang 采样，算法放在配方。 [S1](#source-s1) | 依赖版本、动态采样、loss 聚合、训练/生成并行。 [S2](#source-s2) |
| TRL | Transformers trainer；`GRPOTrainer` 不等于原始 GRPO。 [S4](#source-s4) | `loss_type`、重要性采样粒度、vLLM 是同进程还是独立服务。 [S6](#source-s6) |
| OpenRLHF | Ray + DeepSpeed ZeRO + vLLM，可共置并用 NCCL/CUDA IPC 同步。 [S9](#source-s9) | 共置后的真实卡数，以及 reward 进程的主机内存。 [S7](#source-s7) [S12](#source-s12) |
| slime | Megatron + SGLang；v0.4.0 起同步和全异步共用 `train.py`。 [S10](#source-s10) | 参数映射、共置时的内存恢复顺序、脚本回退的卡数。 [S10](#source-s10) |
| AReaL | FSDP 与 SGLang 解耦，允许策略滞后。 [S11](#source-s11) | 滞后上限、logprob 是否重算、字段名以 YAML 还是文档为准。 [S11](#source-s11) |

::: warning 待核验：活跃只说明仓库还在改
slime v0.4.0 和 AReaL v2.1.0 的发布记录，加上仍能读到的配置，只支持「检索当日还有人维护」。不能据此说每条示例都在所有机器上跑通。上表也不比较分数或吞吐。 [S10](#source-s10) [S11](#source-s11)
:::

## 三组公开配置：报告和脚本不要并成一次实验

### DAPO：生成 batch 和训练 batch 不是同一个数

这里引用的是 verl 配方作者公开的复现，不是把论文、当前主分支和旧脚本合成同一次运行。复现表写的硬件是 16 节点、每节点 8 张 H800，镜像名里包含 vLLM 0.8.3，commit 是 `4f80e465`。下面的数字来自这个 commit 的完整脚本。 [S2](#source-s2)

- **配置事实：**Qwen2.5-32B，数据 `dapo-math-17k.parquet`，优势估计 `grpo`。生成提示 batch 是 `512 * 3`，训练提示 batch 是 `512`，每条提示 16 个回答，提示 mini-batch 是 32。 [S2](#source-s2)
- **配置事实：**FSDP 打开参数和 optimizer offload；Ulysses sequence parallel 为 8；vLLM tensor parallel 为 4，`gpu_memory_utilization=0.7`，并打开动态 token batch。 [S2](#source-s2)
- **配置事实：**prompt 上限 2048，response 上限 20480，overlong buffer 4096。clip 下限/上限是 0.2/0.28，loss 聚合是 `token-mean`。reward 里的 KL 和单独的 KL loss 都关掉。这里的 clip 是概率比裁剪，不是梯度范数阈值。 [S2](#source-s2)
- **配方作者的处理：**动态采样丢掉组内指标完全相同的提示，继续生成直到凑够训练 batch，最多尝试 10 批。超过上限时，配方正文里的代码抛出 `Generated too many. Please check your data.` [S2](#source-s2)

**和报告对不上的地方要保留。** DAPO 报告 v2 第 4.1 节写的是 AdamW、学习率 1e-6、20 个 rollout step 的线性 warm-up、每批 512 个提示、每提示 16 个回答、训练 mini-batch 512，并写明每次 rollout 做 16 次梯度更新。历史脚本的提示 mini-batch 是 32，warm-up 字段是 10。两边不能只按同名字段对齐，也不能说逐项相同。 [S2](#source-s2) [S3](#source-s3)

**编辑归纳：**日志里的一个训练 batch 不等于生成成本。全对或全错的组被丢掉之后，rollout 已经花过了。凑不够 batch 时，先看题目难度和组内奖励是不是挤在一起。这是按配方代码推的排查方向，不是本篇看到的一次崩溃。 [S2](#source-s2)

### Open R1：同一个项目里有两种 vLLM 摆法

- **配置事实：**Qwen2.5-1.5B-Instruct 的 GRPO demo 用 OpenR1-Math-220k，打开 vLLM。`num_generations=16`，`per_device_train_batch_size=16`，梯度累积 4。prompt / completion 上限是 512 / 1024，学习率 `2e-5`。accuracy、format、tag_count 三个 reward 权重都是 1.0。 [S6](#source-s6)
- **部署事实：**README 的训练命令按 8×H100 80GB 来写。GRPO 一节同时给出同进程 `colocate`，以及训练节点之外单独起 vLLM server。多节点例子是 2 个节点、训练 DP=8、TP=1。配套 `zero2.yaml` 是 ZeRO stage 2、8 个进程。 [S6](#source-s6)

**编辑归纳：**这是项目给出的入口，不是一份已经跑完的逐卡账单。每设备 batch、生成组大小和提示数不能互换。复现时要同时留下 YAML、启动命令和 TRL 版本。 [S4](#source-s4) [S6](#source-s6)

### ProRL v2：博客参数和仓库脚本差在 clip 与长度惩罚

- **作者声称：**NVIDIA 工程文以 DeepSeek-R1-Distill-Qwen-1.5B 做长期 RL，损失是 PPO-Clip 加 REINFORCE++-baseline，并加上 Clip-Higher、dynamic sampling、KL、reference reset 和阶段性长度惩罚。正文里的 clip 是 0.20/0.28。reference 在每 200–500 步，或遇到 KL 尖峰、验证停滞时重置，optimizer 状态保留。页面署名日期是 2025-08-13。 [S8](#source-s8)
- **配置事实：**OpenRLHF 的同名脚本用这个 1.5B、数据集 `OpenRLHF/dapo-math-17k`、估计器 `reinforce_baseline`。训练 batch 1024，rollout batch 512，每提示 16 个回答。actor 和 reference 都写成单节点 8 GPU，并打开共置；vLLM engine 数 8、TP 1；ZeRO stage 3；最大新 token 8192。脚本没写 GPU 型号。 [S7](#source-s7)
- **对不上的地方：**脚本的 clip 是 0.2/0.27，不是博客的 0.28。token 级重要性修正打开后，区间 `[0.5, 5.0]` 之外的样本被 mask。长度惩罚有一部分只出现在注释里，不能当成已经启用。脚本本身也证明不了博客里的周期性 reference reset 已经接进训练循环。 [S7](#source-s7) [S8](#source-s8)

::: warning 待核验：三组配置不能横着比分数
DAPO 的 32B 复现、Open R1 的 1.5B demo、ProRL 的 1.5B 脚本，硬件、损失和 KL 都不一样。DAPO 示例关掉 KL，ProRL 工程文保留 KL 和 reference reset。这是两套配方，不能收成「后训练都该关 KL」。 [S2](#source-s2) [S6](#source-s6) [S8](#source-s8)
:::

### 框架自带示例只说明接口，不说明外部项目的效果

| 固定版本 | 脚本里写了什么 | 没有写什么 |
| --- | --- | --- |
| slime v0.4.0，Qwen3-4B [S10](#source-s10) | GRPO。rollout 提示 batch 32，每提示 8 个回答，global batch 256，response 上限 8192。Megatron TP 2、PP 1、CP 1，打开 sequence parallel。每个 SGLang engine 2 张 GPU，静态显存比例 0.7，训练和生成共置。 | GPU 型号。卡数检测失败才回退到 8，不能写成最低配置。 |
| AReaL v2.1.0，GSM8K GRPO [S11](#source-s11) | Qwen2.5-1.5B-Instruct。集群 1×8 GPU。actor `fsdp:d4p1t1`，rollout `sglang:d4p1t1`。训练 batch 256，每提示 4 个回答，最大新 token 1024。策略滞后允许 2，打开 decoupled loss 和 logprob 重算。 | GPU 型号和峰值显存。这个 batch 也不能直接对 TRL 的每设备 batch。 |

## 故障记录：先分阶段，再拧旋钮

### 切回 rollout 时的显存，和 Ray 杀掉的主机内存，不是一回事

Biao He 和 Ata Fatahi 写的是 verl 加 SGLang 的内存切换。他们的顺序是：先载入训练权重，恢复推理权重，同步，卸掉训练模型，最后恢复 KV cache；底层用带 tag 的暂停和恢复。作者报告最终能在 8×H200 上、KV cache 比例 0.9 训练 Qwen 32B。这是他们的结果，本篇没有复现，也不能只抄一个显存比例。 [S14](#source-s14)

OpenRLHF #911 是另一类现场。2025-03-24，报告者用 8×A800 训练 7B，估计器 `reinforce_baseline`，训练 batch 256，rollout batch 64，每提示 16 个回答，vLLM 是 2 engine × TP 2，ZeRO stage 2。触发 Ray 阈值时，节点内存是 239.02/251.56 GB，日志里的 `nl2sql_reward.py` 占了 176.97 GB。这是主机内存，不是 CUDA OOM。页面上没有维护者确认的修复。被杀掉的是权重更新 worker，不表示它就是内存涨起来的那个进程。 [S12](#source-s12)

相关的 #1013 里，另一位报告者说去掉 `--vllm_enable_sleep` 之后不再遇到问题，但同时在问这样做对不对。这句话不能升级成已确认根因。 [S12](#source-s12)

**编辑建议：**OOM 如果正好发生在权重同步或 KV 恢复，先记阶段交界的显存，再看训练权重、推理权重和 KV 是不是叠在一起。降低 micro-batch 未必打中这个峰值。Ray 杀 worker 时，先看 RSS、reward 服务和对象存储。关掉监控也不等于把占用降下去。 [S12](#source-s12) [S14](#source-s14)

### 日志停住，不一定停在 W&B 显示的那一步

Open R1 discussion #512：报告者在 DGX H100 上用 4 个进程跑 GRPO，W&B 停在 step 8，减小 batch 仍然复现。维护者要求中断堆栈并核对 vLLM 版本。后续回复给出 vLLM 0.7.2，并说明控制台其实到了 step 15，最后抓到的是 `_ALLGATHER_BASE` 的 NCCL watchdog timeout。讨论结尾仍在追原因，没有已验证的修复。 [S13](#source-s13)

**编辑归纳：**能直接用的动作是留下各 rank 日志、对上运行版本、找到真正堵住的位置，再判断是生成、reward 还是集合通信没有返回。这条讨论支持不了「把超时调大」或「升级到某个版本就好」。 [S13](#source-s13)

### 奖励涨了，先确认它量的是任务成功

Open R1 在 2025-03-11 的更新里检查了 7 道竞赛题：R1 的解答都通过公开短测试，却都没通过 Codeforces 的完整测试。这说明测试覆盖不够。它没有证明 RL 模型在主动 reward hacking。 [S15](#source-s15)

kalomaze 在 2025-03-03 的语义判断实验里，把 XML 格式加分 0.2 限定为「判断也对才给」，长度加分同样要求判断正确。作者偏好 `constant_with_warmup` 和 `max_grad_norm=0.2`，并写明奖励幂次没有严格对照。这些是个人调参记录，不是普适最优值。 [S16](#source-s16)

**编辑建议：**正确性、格式、长度和留出集通过率分开记。格式权重抬高之后总 reward 上升，不能直接写成能力变强。梯度范数裁剪和 PPO 的概率比 clip 也要分开看。 [S15](#source-s15) [S16](#source-s16)

### 长度异常和异步偏差，各有自己的记录字段

DAPO 报告第 3.1–3.4 节把三件事拆开：早期熵塌缩、长回答里的重复和乱码、对截断回答一律惩罚带来的奖励噪声。对应做法是 Clip-Higher、token 级 loss，以及 overlong filtering / shaping。这只支持「先分清是哪一种长度问题」，不支持把所有变长都叫同一种崩溃。本篇没有足够材料给出跨任务的长度惩罚系数或数据配比。 [S3](#source-s3)

AReaL 要求给 rollout 记下策略版本。落后由 `max_head_offpolicyness` 限制；重要性修正不能代替权重同步本身是否正确。队列变长也不等于有效训练变快。slime 可以用 `--debug-rollout-only` 把 rollout 存下来，再用 `--load-debug-rollout-data` 只跑训练，用来把优化问题和生成问题分开。调试文档还建议对齐 checkpoint、参数映射和 chat template，并检查随后加载权重时的 OOM。 [S10](#source-s10) [S11](#source-s11)

::: tip 拿到自己机器上时先固定什么
1. 从最接近自己模型和卡的那份完整启动命令开始。记下框架 commit、推理引擎、镜像，以及提示 batch、回答组、训练 mini-batch 各自指什么。 [S2](#source-s2) [S6](#source-s6) [S7](#source-s7)
2. 先走通生成、reward、训练、同步之后的再次生成，以及 checkpoint 恢复。第一步 loss 正常，不能说明循环是对的。 [S10](#source-s10) [S14](#source-s14)
3. 先留一个同步或固定 rollout 的重放，再一次只改共置、offload、异步或重要性修正中的一项。看验证成功率和有效样本量，不要只看 rollout 吞吐。 [S11](#source-s11)
4. 对外写结果时，把脚本默认值、作者声称的运行、自己复现的结果分成三列。没有 GPU 型号或峰值显存，就留空。 [S8](#source-s8) [S10](#source-s10)
:::

## 阅读边界

- **没有复现。** 配置事实来自指定 commit 或 tag 的文件。作者报告的 H200、H800 结果没有在本机重跑。 [S2](#source-s2) [S14](#source-s14)
- **issue 不是修复说明。** #911、#1013 和 discussion #512 都没有维护者确认的修复。 [S12](#source-s12) [S13](#source-s13)
- **个人博客不是对照实验。** kalomaze 自己写了缺少严格对照。 [S16](#source-s16)
- **这次没读到的入口：**知乎专栏在代理和直连下都立刻返回 403，正文是拦截页，没有引用。X 和微信公众号没有读。SimpleRL 只读到 README，尝试的脚本路径 404，默认分支是 `v1`，所以没有把它写进配置表。 [S17](#source-s17)

## 来源与阅读范围

### S1：verl README 与发布页 {#source-s1}

[README](https://github.com/verl-project/verl/blob/5b550b0c3dad8c7bb7aab834a3fe195f8cdfc517/README.md) · [releases](https://github.com/verl-project/verl/releases)

阅读范围：README 里的后端、算法和配方入口；发布页可见正文。没有逐个打开 PR，也没有通读核心 trainer。

### S2：DAPO 配方与历史训练脚本 {#source-s2}

[配方 README](https://github.com/verl-project/verl-recipe/blob/main/dapo/README.md) · [commit 4f80e465 的脚本](https://github.com/verl-project/verl/blob/4f80e465c2ec79ab9c3c30ec74b9745de61d0490/recipe/dapo/run_dapo_qwen2.5_32b.sh)

阅读范围：复现表、过滤逻辑摘录，以及该 commit 的完整脚本。未打开 W&B。

### S3：DAPO 技术报告 v2 {#source-s3}

[报告 HTML](https://arxiv.org/html/2503.14476v2)

阅读范围：第 2–3 节方法和第 4.1 节训练设置。没有精读附录，也没有复核图中的原始数据。

### S4：TRL 的 GRPOConfig 与 GRPO 文档 {#source-s4}

[GRPOConfig](https://github.com/huggingface/trl/blob/9d76f2f8c0421fcf8a4a72113a9e226ce796e592/trl/trainer/grpo_config.py) · [GRPO 文档](https://github.com/huggingface/trl/blob/main/docs/source/grpo_trainer.md)

阅读范围：生成、训练、loss、KL 和重要性采样的配置定义，以及文档中的 loss 聚合段落。未通读 trainer 实现。

### S5：TRL README 与发布页 {#source-s5}

[README](https://github.com/huggingface/trl) · [releases](https://github.com/huggingface/trl/releases)

阅读范围：架构、安装、trainer 示例和发布页可见变更。

### S6：Open R1 的调用链和配置 {#source-s6}

[README](https://github.com/huggingface/open-r1/blob/5b6ff22b3fb7aa069c54866e517f39dfc3160e09/README.md) · [grpo.py](https://github.com/huggingface/open-r1/blob/5b6ff22b3fb7aa069c54866e517f39dfc3160e09/src/open_r1/grpo.py) · [GRPO YAML](https://github.com/huggingface/open-r1/blob/5b6ff22b3fb7aa069c54866e517f39dfc3160e09/recipes/Qwen2.5-1.5B-Instruct/grpo/config_demo.yaml) · [zero2.yaml](https://github.com/huggingface/open-r1/blob/5b6ff22b3fb7aa069c54866e517f39dfc3160e09/recipes/accelerate_configs/zero2.yaml)

阅读范围：硬件和部署段落、trainer 调用，以及两份配置全文。

### S7：OpenRLHF README、发布页与 ProRL v2 脚本 {#source-s7}

[README](https://github.com/OpenRLHF/OpenRLHF) · [releases](https://github.com/OpenRLHF/OpenRLHF/releases) · [脚本](https://github.com/OpenRLHF/OpenRLHF/blob/dc2a7ad326f619fc5a47737ea47d1920ce2c0b53/examples/scripts/train_prorlv2_math_hybrid_engine.sh)

阅读范围：README 的架构和用法、发布页正文、脚本全文（含未启用的注释）。

### S8：ProRL v2 工程文 {#source-s8}

[NVIDIA 开发者博客](https://developer.nvidia.com/blog/scaling-llm-reinforcement-learning-with-prolonged-training-using-prorl-v2/)

阅读范围：署名正文全文。没有把页面上的 AI 摘要当证据，也没有从图里估读分数。

### S9：OpenRLHF 与 vLLM 的权重同步说明 {#source-s9}

[vLLM 博客](https://vllm.ai/blog/2025-04-23-openrlhf-vllm)

阅读范围：全文和权重同步示例。旧博客地址会跳到这里。

### S10：slime v0.4.0 {#source-s10}

[README](https://github.com/THUDM/slime) · [v0.4.0](https://github.com/THUDM/slime/releases/tag/v0.4.0) · [train.py](https://github.com/THUDM/slime/blob/v0.4.0/train.py) · [Qwen3-4B 脚本](https://github.com/THUDM/slime/blob/v0.4.0/scripts/run-qwen3-4B.sh) · [调试文档](https://github.com/THUDM/slime/blob/v0.4.0/docs/en/developer_guide/debug.md) · [policy mismatch](https://github.com/THUDM/slime/blob/main/docs/en/advanced/policy-mismatch.md)

阅读范围：发布正文、训练入口、示例脚本、调试文档，以及当前分支上的策略偏差说明。没有执行脚本，也没有用可变分支推断旧实验。policy mismatch 文档的链接论文未追读。

### S11：AReaL v2.1.0 {#source-s11}

[README](https://github.com/areal-project/AReaL) · [releases](https://github.com/areal-project/AReaL/releases) · [GSM8K YAML](https://github.com/areal-project/AReaL/blob/v2.1.0/examples/math/gsm8k_grpo.yaml) · [异步文档](https://github.com/areal-project/AReaL/blob/v2.1.0/docs/en/algorithms/async.md)

阅读范围：README、v2.0.0 与 v2.1.0 的发布正文、示例 YAML 和异步文档全文。未审计调度器。

### S12：OpenRLHF 内存 issue {#source-s12}

[#911](https://github.com/OpenRLHF/OpenRLHF/issues/911) · [#1013](https://github.com/OpenRLHF/OpenRLHF/issues/1013)

阅读范围：可见正文、启动命令和日志。没有读到维护者确认的修复。

### S13：Open R1 discussion #512 {#source-s13}

[讨论](https://github.com/huggingface/open-r1/discussions/512)

阅读范围：正文、维护者追问和可见跟帖。

### S14：verl 与 SGLang 的内存切换 {#source-s14}

[rl-memory-management](https://hebiao064.github.io/rl-memory-management)

阅读范围：全文里的阶段顺序和代码示意。未追读全部 RFC，也没有跑性能测试。

### S15：Open R1 Update #3 {#source-s15}

[Hugging Face 博客](https://huggingface.co/blog/open-r1/update-3)

阅读范围：正文全文。竞赛测试覆盖、SFT 经验和 GRPO 更新分开理解，没有把 SFT 的 OOM 数字写成 RL 结果。

### S16：kalomaze 的 GRPO 奖励笔记 {#source-s16}

[GRPO Judge](https://kalomaze.bearblog.dev/grpo-judge-experiments-findings-and-empirical-observations/)

阅读范围：全文文字。未打开外链 W&B，也没有把配图趋势当成测量。

### S17：只核对了入口、没有纳入配置的材料 {#source-s17}

[SimpleRL README](https://github.com/hkust-nlp/simpleRL-reason/blob/cf1c7858bfc145a27aa733e75d930d34f0d318a6/README.md)

阅读范围：README 中与 PPO、OpenRLHF、vLLM 相关的使用说明。尝试的归档和训练脚本返回 404。知乎链接 `https://zhuanlan.zhihu.com/p/2073117804711113332` 返回 403，未读正文。
