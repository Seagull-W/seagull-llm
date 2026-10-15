---
title: "2026-10-16 后训练强化学习：框架运行机制与项目材料"
description: "先梳理 verl、TRL、OpenRLHF、slime 和 AReaL 的训练、采样与权重交接，再分别核对项目配置、框架自带示例和故障记录。"
tags: ["每日调研", "RLHF", "后训练", "GRPO"]
date: "2026-10-16"
---

# 2026-10-16 后训练强化学习：框架运行机制与项目材料

::: info 本期要点
- **前半篇只讲框架怎么跑。** 谁更新参数、谁采样、权重怎么交回去、同步和异步差在哪里。 [S1](#source-s1) [S4](#source-s4) [S7](#source-s7) [S10](#source-s10) [S11](#source-s11)
- **后半篇一篇材料一节。** 项目脚本、框架自带示例和故障帖分开读。同名材料不一定是同一次实验。 [S2](#source-s2) [S6](#source-s6) [S8](#source-s8)
- **故障帖只保留现场里写明的事。** 没有修复结论的，就停在观察。 [S12](#source-s12) [S13](#source-s13)
:::

> 调研基准日：2026-10-16（Asia/Shanghai）。这篇沿用已核对过的来源，没有另开一轮检索，也没有跑 GPU。文件里写了的配置、作者报告的结果、编辑把两者对上的地方，下面分开说。

## 第一部分：五个框架怎么运行

这里只写运行分工。具体配方、示例数字和故障帖在第二部分。

### verl：训练和采样用两套后端，中间重新切分权重

verl 是 HybridFlow 的开源实现。一个控制器把后训练数据流串起来，训练和推理各自接不同后端。 [S1](#source-s1)

一次循环里，actor 用 FSDP、FSDP2 或 Megatron-LM 更新参数；回答由 vLLM、SGLang 或 HF Transformers 生成。两边的并行方式可以不同。README 里的 3D-HybridEngine 在训练和生成切换时，把 actor 权重按另一套并行布局重新切分，再交给采样。具体走哪次传输调用，README 没有写到函数。 [S1](#source-s1)

按阶段看，同步就是：采样，更新，把新权重交给下一轮采样。README 另外列了 `fully_async_policy` 等实验入口。队列怎么排、隔几步更新、策略允许落后多少，要到那些实现里看，这里只记有这个入口。 [S1](#source-s1)

### TRL：trainer 更新参数，生成可以留在模型里，也可以交给 vLLM

TRL 是架在 Transformers 和 Accelerate 上的 trainer 库。这里只看 `GRPOTrainer` 的配置。 [S4](#source-s4) [S5](#source-s5)

trainer 拿生成结果和奖励组成训练目标，再反传更新策略。`use_vllm=False` 时调用模型自己的 `generate()`，权重就是正在训练的那份。打开 vLLM 之后，采样在推理侧做，训练完的策略要交过去。配置里两种摆法：`colocate` 是和训练进程共享 GPU，`server` 是单独的生成服务。配置没有写权重用什么协议传。 [S4](#source-s4)

`colocate` 和 `server` 说的是生成服务放在哪。采样和训练是否重叠、策略允许落后几步，这份 `GRPOConfig` 没有定义。 [S4](#source-s4)

### OpenRLHF：Ray 负责调度，DeepSpeed 更新，vLLM 采样

Ray 把训练、生成和其他组件编排在一起。组件可以分到不同机器，也可以共置在同一组 GPU 上。这里核对的是 DeepSpeed 加 vLLM 这条路径。 [S7](#source-s7) [S9](#source-s9)

一步里面，vLLM 先出回答，actor 用 DeepSpeed ZeRO 更新参数，再把策略交回生成侧。梯度在 DeepSpeed 里算，Ray 只调度。权重同步有两条已写明的路：actor 和 vLLM 之间用 NCCL；共置的 hybrid engine 还可以用 CUDA IPC 把权重组过去。走哪条，看部署。 [S7](#source-s7) [S9](#source-s9)

同步是串行的「生成，再训练」，每轮生成用的是刚更新的权重。异步用队列让两边重叠，样本可能来自更早的策略。partial rollout 还可以在中途停下、换权重、接着生成，于是一条回答里会混进不同版本打出来的 token。共置只决定卡怎么分，异步与否要看有没有这条队列。 [S7](#source-s7)

### slime：一个 train.py 接 Megatron 和 SGLang

slime 用 Megatron 训练、SGLang 采样。v0.4.0 起，同步和完全异步都从 `train.py` 进，异步调度放在 rollout 实现里。 [S10](#source-s10)

入口先向 rollout manager 要数据，再调用 actor 的 `async_train` 并等它结束；开了 critic 就再训 critic。`async_train` 这个函数名只说明这次更新调用是异步等待的，整条流水线是否异步要看 rollout 那边。 [S10](#source-s10)

权重交回的顺序写在入口里：初始化加载之后先 `actor_model.update_weights()`。每一轮训练前会暂停接收新 rollout，更新生成侧权重，再按条件恢复。开了 rollout offload 时，权重恢复和 KV cache 恢复是两次调用。传输协议不在这个入口文件里。 [S10](#source-s10)

同步是一轮生成数据拿齐再训练。完全异步时，rollout 一直在生产，训练批次可以只收已经完成的组，不必等所有生成 worker。入口能看到这个差别；队列内部怎么保证一致，在 rollout 实现里。 [S10](#source-s10)

### AReaL：生成和训练可以同时进行，并限制策略落后几步

AReaL 让 rollout 和训练分在不同 GPU 上并行。这一节只按它的异步文档来。文档这一页没有规定必须配哪种训练后端或推理后端。 [S11](#source-s11)

生成侧产轨迹，训练侧消费轨迹并更新策略。异步时两边同时干活。生成侧会拿到更新后的策略；partial rollout 允许同一条轨迹跨过多个策略版本。这一页讲的是版本关系，没有写权重传输协议，也没有写更新调用的先后。 [S11](#source-s11)

`max_head_offpolicyness=0` 时回到同步，生成用的策略和训练侧对齐。大于 0 时允许生成落后，并规定最多落后几步。文档用 decoupled loss 处理这种偏差，打开时要重算 logprob。和同步循环的差别就在这里：旧策略打出来的样本可以进训练，但落后步数有上限。 [S11](#source-s11)

## 第二部分：具体项目、自带示例和故障记录

### DAPO 复现：生成了多少，和拿去训练的不是同一个数

关注点是生成提示 batch 和训练提示 batch，以及报告和历史脚本对不上的两个字段。

材料是 verl 配方的复现表和 commit `4f80e465` 的脚本。复现表写的机器是 16 节点、每节点 8 张 H800。数字以这个 commit 为准，不用当前分支替换。 [S2](#source-s2)

脚本里 `gen_prompt_bsz=512 * 3`，`train_prompt_bsz=512`，每条提示 16 个回答，`train_prompt_mini_bsz=32`。动态采样会丢掉组内指标完全一样的提示，继续生成，直到凑够训练 batch，最多试 10 批。所以训练步吃掉的提示数，小于前面已经生成过的提示数。 [S2](#source-s2)

同一次脚本里还有：Qwen2.5-32B，优势估计 `grpo`，clip 下限/上限 0.2/0.28，loss 聚合 `token-mean`，reward KL 和单独的 KL loss 都关着。rollout 张量并行是 4，`gpu_memory_utilization=0.7`。这些是这份历史脚本的设置。 [S2](#source-s2)

| 对照项 | DAPO 报告 v2 第 4.1 节 | commit 4f80e465 脚本 |
| --- | --- | --- |
| rollout 提示数 | 512，每提示 16 个回答 | 生成 batch `512 * 3`，训练 batch `512`，每提示 16 个回答 |
| 训练 mini-batch | 512，并写明每次 rollout 做 16 次梯度更新 | `train_prompt_mini_bsz=32`，传给 `ppo_mini_batch_size` |
| warm-up | 20 个 rollout step 的线性 warm-up | `lr_warmup_steps=10` |

三列各自摘自原文。报告里的 mini-batch 和脚本里的提示 mini-batch，计步单位没有在材料里对齐；两处 warm-up 也没有写成同一个口径。先按表里的差异留着。 [S2](#source-s2) [S3](#source-s3)

### Open R1：两种 vLLM 摆法，YAML 里没有 loss

关注点是这个项目怎么摆 vLLM，以及这份 YAML 没有填写损失类型。

固定快照的 README 写了两种入口。`colocate` 和训练共用 GPU；另一种是训练节点之外单独起 vLLM server。训练命令按 8×H100 80GB 来写，另外给了多节点启动例子。这是文档里的机器假设。 [S6](#source-s6)

YAML 使用 Qwen2.5-1.5B-Instruct 和 OpenR1-Math-220k，`use_vllm=true`。`num_generations=16`，每设备训练 batch 16，梯度累积 4，prompt / completion 上限 512 / 1024。文件里没有 `loss_type`。入口构造的是 `GRPOTrainer`，trainer 的名字不决定损失公式。 [S6](#source-s6)

另有一份后来核对的 TRL `GRPOConfig`，里面 `loss_type` 的默认值是 `dapo`。那是那份 TRL 快照的默认值。这份 Open R1 YAML 当时装的是哪个 TRL、默认损失实际解析成什么，要同时钉住项目 commit、TRL 版本和生效配置才能知道。 [S4](#source-s4) [S6](#source-s6)

### ProRL v2：工程文和同名脚本各记各的

关注点是 NVIDIA 工程文和 OpenRLHF 里同名脚本的三处差异：clip、长度惩罚、reference reset。

| 对照项 | NVIDIA 工程文 | OpenRLHF 固定 commit 脚本 |
| --- | --- | --- |
| 概率比 clip 下限/上限 | 0.20 / 0.28 | 0.2 / 0.27 |
| 长度惩罚 | 周期性启停的 cosine 长度惩罚 | overlong 参数在注释里；命令行是 `stop_properly_penalty_coef=0.0`，注释把它解释为截断样本奖励归零 |
| reference reset | 每 200–500 步，或遇到 KL 尖峰、验证停滞时重置，optimizer 状态保留 | 启动命令里没有这条日程 |

注释里的参数不算已经启用。同名只说明两份材料相关。 [S7](#source-s7) [S8](#source-s8)

脚本自身写的是：DeepSeek-R1-Distill-Qwen-1.5B，估计器 `reinforce_baseline`，训练 batch 1024，rollout batch 512，每提示 16 个回答，开启共置。GPU 型号没有写。长度日程和 reference reset 是否进了训练循环，要看对应版本的实现和运行记录，这次没有审到那里。 [S7](#source-s7) [S8](#source-s8)

### slime v0.4.0 的 Qwen3-4B 示例

这是框架自带示例，不是外部项目的训练报告。关注点只是脚本写了什么、没写什么。

写了：GRPO；rollout 提示 batch 32，每提示 8 个回答，global batch 256，response 上限 8192。Megatron 的 TP 2、PP 1、CP 1，打开 sequence parallel。每个 SGLang engine 2 张 GPU，`sglang-mem-fraction-static=0.7`，训练和生成共置。 [S10](#source-s10)

没写：GPU 型号、峰值显存、这次跑出来的成绩。脚本会检测卡数，检测失败才回退到 8。8 是回退值，不是最低硬件要求。 [S10](#source-s10)

### AReaL v2.1.0 的 GSM8K 示例

同样是框架自带示例。关注点是 YAML 里的字段，以及它和异步文档的拼写差一个字母。

写了：Qwen2.5-1.5B-Instruct，集群 1×8 GPU。actor 是 `fsdp:d4p1t1`，rollout 是 `sglang:d4p1t1`。`train_dataset.batch_size=256`，每提示 4 个回答，最大新 token 1024。`max_head_offpolicyness=2`，`use_decoupled_loss=true`，`recompute_logprob=true`，`weight_update_mode=xccl`。 [S11](#source-s11)

没写：GPU 型号、峰值显存、训练结果。异步文档把重算字段写成复数 `recompute_logprobs`，这份 YAML 是单数。两处先按原文保留，这次没有再去对配置解析代码。 [S11](#source-s11)

### verl 加 SGLang：切回 rollout 时先同步权重，再恢复 KV

关注点是内存恢复的顺序，以及这个顺序怎么把峰值显存顶上去。

作者的顺序是：训练权重载入 GPU，恢复推理权重，做同步，卸掉训练模型，最后恢复 KV cache。底层用带 tag 的暂停和恢复，把权重和 KV cache 分开。峰值出在这几步叠在一起的时候，而不是稳定训练那一段。 [S14](#source-s14)

文中的结果是：8×H200、KV cache 比例 0.9、Qwen 32B。这是他们那台机器上的数。 [S14](#source-s14)

### OpenRLHF #911：Ray 杀掉进程，是因为主机内存

关注点是被杀掉的 worker 和真正占内存的进程不是同一个。

节点内存 239.02 / 251.56 GB，过了 Ray 的阈值。进程列表里 `nl2sql_reward.py` 占了 176.97 GB。日志记的是主机内存。Ray 按最近调度的任务挑选被杀 worker，所以被杀的那个不一定是把内存吃掉的进程。回复里有配置建议，没有经确认的修复。 [S12](#source-s12)

### OpenRLHF #1013：关掉 sleep 之后能跑，帖子停在这里

关注点是报告者对 `--vllm_enable_sleep` 的一次观察。

保留这个选项时，加载数据或模型阶段遇到 Ray OOM；去掉之后能跑。报告者同时在问这样改对不对。帖子没有把选项、内存变化和故障串成一条因果，也没有维护者确认的修法。 [S12](#source-s12)

### Open R1 discussion #512：W&B 停住的步数，不是进程停住的步数

关注点是用控制台和堆栈校正监控上的停滞位置。

报告者在 DGX H100 上用 4 个进程跑。W&B 停在 step 8，减小 batch 仍然这样。维护者要求看中断堆栈和 vLLM 版本。后面的回复给出 vLLM 0.7.2，控制台至少走到 step 15，最后的日志是 `_ALLGATHER_BASE` 的 NCCL watchdog timeout。讨论停在继续查原因。帖子留下的做法是保留各 rank 日志、版本和阻塞堆栈。 [S13](#source-s13)

### Open R1 Update #3：公开短测试过了，完整测试没过

关注点是公开测试覆盖不够时，可验证奖励会失真。

作者挑了 7 道题，R1 的解答通过了全部公开测试。交到 Codeforces 之后，完整测试全部失败。这 7 道题说明公开样例盖不住隐藏测试。 [S15](#source-s15)

### kalomaze：格式分和长度分都要判断正确才给

关注点是这次语义判断实验怎么限制辅助奖励。

XML 格式奖励固定 0.2，判断正确才发；长度奖励同样挂在判断正确上。作者写明，奖励缩放没有和替代方案做过严格比较。权重是这次实验的记录。 [S16](#source-s16)

::: tip 读的时候标三列
文件里的配置、作者报告的结果、把两份材料对上之后的差异，分开记。示例没写 GPU 型号就空着。帖子没有修复结论，就停在观察。第二部分的数字不要回填到第一部分的运行机制里。
:::

## 来源与阅读范围

### S1：verl README 与发布页 {#source-s1}

[README](https://github.com/verl-project/verl/blob/5b550b0c3dad8c7bb7aab834a3fe195f8cdfc517/README.md) · [releases](https://github.com/verl-project/verl/releases)

阅读范围：README 的控制器、训练与采样后端、权重重新切分和异步实验入口。发布页保留为入口。未通读核心 trainer 和异步实现。

### S2：DAPO 配方与历史训练脚本 {#source-s2}

[配方 README](https://github.com/verl-project/verl-recipe/blob/main/dapo/README.md) · [commit 4f80e465 的脚本](https://github.com/verl-project/verl/blob/4f80e465c2ec79ab9c3c30ec74b9745de61d0490/recipe/dapo/run_dapo_qwen2.5_32b.sh)

阅读范围：复现表、过滤逻辑摘录，以及该 commit 的完整脚本。未打开 W&B。

### S3：DAPO 技术报告 v2 {#source-s3}

[报告 HTML](https://arxiv.org/html/2503.14476v2)

阅读范围：第 2–3 节方法和第 4.1 节训练设置。未精读附录，未复核图中的原始数据。

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

阅读范围：署名正文全文。页面上的 AI 摘要和图中估读的分数没有当作证据。

### S9：OpenRLHF 与 vLLM 的权重同步说明 {#source-s9}

[vLLM 博客](https://vllm.ai/blog/2025-04-23-openrlhf-vllm)

阅读范围：全文和权重同步示例。旧博客地址会跳到这里。

### S10：slime v0.4.0 {#source-s10}

[README](https://github.com/THUDM/slime) · [v0.4.0](https://github.com/THUDM/slime/releases/tag/v0.4.0) · [train.py](https://github.com/THUDM/slime/blob/v0.4.0/train.py) · [Qwen3-4B 脚本](https://github.com/THUDM/slime/blob/v0.4.0/scripts/run-qwen3-4B.sh) · [调试文档](https://github.com/THUDM/slime/blob/v0.4.0/docs/en/developer_guide/debug.md) · [policy mismatch](https://github.com/THUDM/slime/blob/main/docs/en/advanced/policy-mismatch.md)

阅读范围：v0.4.0 发布正文、`train.py` 和 Qwen3-4B 脚本。调试文档与 policy mismatch 保留为原文入口，这次没有据此扩展运行结论。未执行脚本，未审计具体权重传输实现。

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

阅读范围：正文全文。竞赛测试覆盖、SFT 经验和 GRPO 更新分开看。SFT 的 OOM 数字没有写成 RL 结果。

### S16：kalomaze 的 GRPO 奖励笔记 {#source-s16}

[GRPO Judge](https://kalomaze.bearblog.dev/grpo-judge-experiments-findings-and-empirical-observations/)

阅读范围：正文里的正确性门槛、格式与长度奖励，以及作者自己写的「没有严格对照」。未打开外链 W&B，配图趋势没有当成测量。
