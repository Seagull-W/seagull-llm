---
tags: ["RLHF","GRPO","训练实验","策略梯度"]
search: false
---

# GRPO 训练实践

写在前面，所有的任务都只是出于训练的方便出发的，实际这些任务可能完全不用RL后训练，这里只是出于方便进行实际训练的考量。

### 一、GRPO

#### 1.1 grpo.yaml

```yaml
data:
  size: 3000
  specs:
    - name: spell_backward
      weight: 1
      config:
        min_word_len: 3
        max_word_len: 10

loss: grpo
model_name: Qwen/Qwen3-1.7B
clip_eps_lo: 0.2
clip_eps_hi: 0.2
beta: 0.0  # KL penalty coefficient (0 = disabled, set >0 to enable)
kl_estimator: kl3  # KL estimator: kl1, kl2, or kl3
lr: 5e-6
temperature: 0.6
top_p: 0.95
top_k: 20
min_p: 0.0
max_new_tokens: 512
prompts_per_step: 4
num_rollouts: 8
train_batch_size: 2
batch_acc: 4
max_norm: 1.0
seed: 42
model_device_id: 0
wandb_project: rlhf-book
wandb_run_name: grpo_spell_backwards
```

数据描述为：3000个数据，类型名词为`spell_backward`(该任务的目标是训练模型对反向输出单词的指令遵循)，此类型的数据占比为1，单词允许的最小和最大长度为3和10。

使用的模型为Qwen3-1 7B，每次rollout对`prompts_per_step=4`个问题进行采样，每个问题采样`num_rollouts=8`个回答，每个回答的长度不超过512个tokens，损失为grpo损失，不设置KL惩罚（kl1/kl2/kl3是不同的KL惩罚近似方法）。

\[
J_{\mathrm{GRPO}}(\theta)
=
\mathbb E
\left[
\frac1G
\sum_{i=1}^{G}
\frac1{|y_i|}
\sum_t
\min
\left(
\rho_{i,t}A_i,
\operatorname{clip}
\left(
\rho_{i,t},
1-\epsilon_{\mathrm{lo}},
1+\epsilon_{\mathrm{hi}}
\right)A_i
\right)
-\beta D_{\mathrm{KL}}
\right]
\]
设置$\epsilon_{\mathrm{lo}}=\epsilon_{\mathrm{hi}}=0.2$。

`train_batch_size`和`batch_acc`代表单次梯度计算的批次大小以及批次累积次数，故一次参数更新的有效批次大小为8。

梯度裁剪参数设为1。

#### 1.2 train\.py

设置随机数，设备编号（model/ref_model用于KL散度计算/val_model价值模型）。

通过`reasoning gym`的`rg.create_dataset()`按照配置文件的数据描述创建数据集。

加载模型(`AutoModelForCausalLM`)与`RolloutEngine`。

`get_loss_objective`初始化损失类，通过`.forward(self, log_probs: torch.Tensor, experience: Experience, **kwargs)`返回损失值。

进入`rollout_engine`的迭代，代码细节如下：
```python
with progress_bar() as progress:
    task = progress.add_task("Training", total=len(experience_sampler))

    optimizer.zero_grad(set_to_none=True)
    accumulated_loss = 0.0

    for idx, exp in enumerate(experience_sampler):
        exp: Experience = exp.to(model.device)

        log_probs = compute_log_probs(model, exp.sequence_ids, exp.attention_mask)
        values = compute_values(val_model, exp.sequence_ids, exp.attention_mask)
        loss = objective(log_probs=log_probs, experience=exp, values=values)
        if not loss.isfinite():
            continue
        scaled_loss = loss / cfg.batch_acc
        scaled_loss.backward()
        accumulated_loss += loss.item()

        # Update weights every batch_acc steps
        if (idx + 1) % cfg.batch_acc == 0 or (idx + 1) == len(experience_sampler):
            grad_norm = clip_grad_norm_(params, max_norm=cfg.max_norm)
            optimizer.step()
            optimizer.zero_grad(set_to_none=True)
            torch.cuda.empty_cache()

            num_accumulated = min(cfg.batch_acc, (idx % cfg.batch_acc) + 1)
            avg_loss = accumulated_loss / num_accumulated
            hours = (time.time() - start_time) / 3600
            wandb.log({"loss": avg_loss, "grad_norm": grad_norm, "hours": hours})
            progress.update(task, advance=1, description=f"[dim]Loss: {avg_loss:.4f}[/dim]")
            accumulated_loss = 0.0
        else:
            progress.update(task, advance=1)

```


#### 1.3 rollout\.py

`RolloutEngine` **每次迭代输出一个 `ReplayBuffer`，里面存放本轮生成的训练经验**，不是直接返回生成文本或 loss。

##### 1\. 各层返回什么

调用关系如下：

```
_generate_experience(一道题)
    → Experience：同题 K 个回答的批量经验

_filter(exp)
    → Experience 或 None（DAPO 可能丢弃整个组）

_step()
    → ReplayBuffer：收集多个题目的回答经验

__iter__()
    → yield ReplayBuffer：交给训练循环
```

对应代码：

- `policy_gradients/rollout.py:104`：生成一组经验。
- `policy_gradients/rollout.py:85`：收集当前轮的 buffer。
- `policy_gradients/rollout.py:72`：通过 `yield` 逐轮输出 buffer。

##### 2\. `Experience` 包含哪些数据

`_generate_experience()` 返回：

```
Experience(
    sequence_ids=sequence_ids,
    attention_mask=attention_mask,
    action_mask=action_mask,
    rewards=rewards,
    log_probs_old=log_probs_old,
    log_probs_ref=log_probs_ref,
    values_old=values_old,
    advantages=advantages,
).to(self.cpu_device)
```

设同题生成 `K=num_rollouts` 个回答，完整序列长度为 `T`：

| 字段 | 形状 | 用途 |
|---|---|---|
| `sequence_ids` | `[K,T]` | prompt + 回答的 token IDs |
| `attention_mask` | `[K,T]` | 模型前向的有效位置 |
| `action_mask` | `[K,T-1]` | 只在生成 token 上计算 loss |
| `rewards` | 每个分量 `[K,1]` | total、correctness、format、penalty、binary |
| `log_probs_old` | `[K,T-1]` | 采样时策略的 token 对数概率 |
| `log_probs_ref` | `[K,T-1]` 或 `None` | reference 概率，供 KL 使用 |
| `values_old` | `[K,T-1]` 或 `None` | PPO 的旧价值估计 |
| `advantages` | `[K,1]`；PPO 为 `[K,T-1]` | 加权策略梯度 |

这些数据在 `no_grad()` 中计算，最后移到 **CPU**，不会保留采样计算图。

##### 3\. 最终 `ReplayBuffer` 如何组织

例如：

```
prompts_per_step: 4
num_rollouts: 8
```

正常情况下，一轮包含：

```
4 道题 × 每题 8 个回答 = 32 条经验
```

注意，`ReplayBuffer.add()` 会把组内批量 `Experience` **拆成单回答经验**，见 `policy_gradients/buffer.py:106`：

```
ReplayBuffer.buffer
├── Experience：题目1的回答1
├── Experience：题目1的回答2
├── ...
└── Experience：题目4的回答8
```

所以：

```
len(replay_buffer)              # 通常为 32
replay_buffer.buffer[0]         # 一个回答的 Experience
```

组内优势在拆开前已经算好，因此后面可以打乱这些回答进行训练。

DAPO 可能过滤题目组，再继续采样补满；数据耗尽时可能返回不足 32 条的 buffer。空 buffer 不会被 `yield`，而是直接结束迭代。

##### 4\. 训练代码如何接收

`policy_gradients/train.py:91`：

```
for replay_buffer in rollout_engine:
    ...
```

每次循环拿到一个 buffer，再由训练 DataLoader 把单回答经验拼成 batch，重新计算**当前模型**的概率，计算 loss 并更新参数。

**一句话总结：`RolloutEngine` 输出的是“生成结果 + 奖励 + 优势 + 旧概率”等固定训练数据；loss 和参数更新由 `train.py` 完成**

#### 1.4 dataloader

`DataLoader` 是 PyTorch 的**数据迭代与组批工具**：从数据集取样，按指定大小组成 batch，供循环使用。它本身不生成回答、不计算 loss，也不更新参数。

结合本项目，需要区分两个 DataLoader。

##### 1\. 核心工作机制

```
Dataset：提供单条数据
    ↓
Sampler：决定取哪些索引、什么顺序
    ↓
BatchSampler：按 batch_size 组织索引
    ↓
Dataset[index]：取得各条数据
    ↓
collate_fn：把多条数据拼成一个 batch
    ↓
for batch in dataloader：逐批消费
```

例如数据集有 10 条数据：

```
loader = DataLoader(
    dataset,
    batch_size=4,
    shuffle=False,
    drop_last=False,
)
```

每次迭代分别取得：

```
第1批：索引 [0,1,2,3]
第2批：索引 [4,5,6,7]
第3批：索引 [8,9]
```

设置 `drop_last=True` 后，最后不足 4 条的一批会被丢弃。

##### 2\. Rollout 阶段的 DataLoader

`RolloutEngine` 中：

```
self._dataloader = DataLoader(
    dataset=dataset,
    batch_size=cfg.prompts_per_step,
    shuffle=True,
    pin_memory=False,
    drop_last=True,
    collate_fn=lambda x: x,
)
```

它负责**取题目**：

| 参数 | 本项目中的含义 |
|---|---|
| `dataset` | reasoning-gym 程序化题目数据集 |
| `batch_size` | 每批取得多少道题 |
| `shuffle=True` | 打乱题目的访问顺序 |
| `drop_last=True` | 丢弃不足一批的尾部题目 |
| `collate_fn=lambda x: x` | 保留原始题目列表，不做张量堆叠 |
| `pin_memory=False` | 不将输出放入 CPU 锁页内存 |

假设每条数据是：

```
{
    "question": "把 apple 倒着写",
    "answer": "elppa",
    ...
}
```

那么一个 batch 是：

```
[
    {"question": "...", "answer": "...", ...},
    {"question": "...", "answer": "...", ...},
]
```

**为什么用 `lambda x: x`？**

因为默认 `collate_fn` 会尝试重组字典、堆叠数值等，而这里希望每道题保留为完整、独立的字典。

随后代码又把题目批次展开：

```
for batch in self._dataloader:
    for entry in batch:
        self._consumed += 1
        yield entry
```

所以最终仍是**逐题生成**，不是同时对 `prompts_per_step` 道不同题目进行生成。每题的 `num_rollouts` 个回答由后面的 `generate()` 产生，与此处 DataLoader 的 batch size 不同。

##### 3\. 训练阶段的 DataLoader

`train.py` 中：

```
experience_sampler = DataLoader(
    dataset=replay_buffer.buffer,
    batch_size=cfg.train_batch_size,
    shuffle=True,
    pin_memory=False,
    drop_last=True,
    collate_fn=join_experiences_batch,
)
```

它负责**取回答经验、拼训练 batch**。

这里 `dataset` 是 Python 列表：

```
replay_buffer.buffer
    → 单回答 Experience
    → 单回答 Experience
    → ...
```

列表支持 `len()` 和按索引取元素，因此也可以交给 DataLoader。

###### `collate_fn` 在这里尤其关键

单回答的 token 序列长度可能不同：

```
回答1：完整序列长度 100
回答2：完整序列长度 120
```

默认堆叠无法直接处理不等长张量，所以使用：

```
collate_fn=join_experiences_batch
```

该函数将多个 `Experience` 的对应字段左补齐、堆叠，最终返回**一个批量 Experience**：

```
输入：list[Experience]
输出：Experience
```

例如：

```
sequence_ids   → [2,120]
attention_mask → [2,120]
action_mask    → [2,119]
advantages    → [2,1]      # 非 PPO
```

因此训练循环中：

```
for idx, exp in enumerate(experience_sampler):
    exp = exp.to(model.device)
```

`exp` 不是列表，而是已经组好 batch 的 `Experience` 对象。

##### 4\. batch size 与梯度累积的关系

假设：

```
buffer 有 32 个回答
train_batch_size = 2
batch_acc = 4
```

则：

```
DataLoader 每次输出 2 个回答
    ↓
总共输出 16 个 microbatch
    ↓
每处理 4 个 microbatch 更新一次参数
    ↓
每次更新通常累计 8 个回答，总计更新 4 次
```

**DataLoader 只管理 microbatch；梯度累积由训练循环负责。**

另外：

```
len(experience_sampler)
```

返回的是 **batch 数量**，不是回答数量。这里为 `32 // 2 = 16`，也就是进度条的总数。

##### 5\. 两个常见误解

- `shuffle=True` **只改变取样顺序，不改变内容**。组内优势已经提前算好，训练时打乱回答不会重新计算优势。
- 本项目没有设置 `num_workers`，所以使用默认值 `0`，数据读取与组批在主进程完成；不是后台多进程加载。

**总结：rollout DataLoader 组织“题目”，训练 DataLoader 组织“回答经验”；`collate_fn` 决定它们每次迭代最终输出什么结构**

#### 1.5 显存占用分析

以下分析对应 1.1 的 GRPO 配置和当前源码，是理论内存账本与峰值风险分析，**不是已经运行得到的显存实测值**。单位采用 GiB（1 GiB = 2^30 字节），参数量暂按约 1.7×10^9 估算；实际值取决于加载后的参数数量、PyTorch/Transformers 版本、实际 token 长度和 CUDA 后端。

##### 1. 当前有哪些模型驻留显存

| 设置 | 实际效果 |
|---|---|
| `model_name: Qwen/Qwen3-1.7B` | 加载一个策略模型，完整参数训练 |
| `torch_dtype=torch.bfloat16` | 模型权重以 BF16 加载，每参数约 2 字节 |
| `beta: 0.0` | 不加载 reference model，不保留参考概率 |
| `loss: grpo` | 不加载 value model，也没有学习式 reward model |
| gradient checkpointing 开启 | 训练时通过重算减少保存的中间激活，不减少模型/梯度/Adam 状态 |
| `train_batch_size: 2`、`batch_acc: 4` | 每次前向/反向仅处理 2 个回答，梯度累计 4 次后更新 |
| `num_rollouts: 8` | 每次逐题生成 8 个回答；不是 4×8=32 个回答同时生成 |
| Experience 存到 CPU | 当前轮 32 个回答的经验不全部常驻 GPU |

这里没有 LoRA、量化、参数分片或 optimizer offload。`log_probs_old` 是保存的旧概率张量，**并不是额外复制一份 old policy 模型**。

##### 2. 模型、梯度和 Adam 状态：基础内存账本

当前代码直接用 BF16 参数创建 `torch.optim.Adam`，没有显式建立 FP32 master weights。普通 PyTorch Adam 的两个动量状态按参数的 dtype 创建，因此不能直接套用“权重 BF16、梯度 FP32、Adam 状态 FP32”的通用混合精度估算。此行为可见 [PyTorch 2.6 Adam 源码](https://raw.githubusercontent.com/pytorch/pytorch/v2.6.0/torch/optim/adam.py)，实际环境仍应核对 state dtype。

| 项目 | 近似公式 | 按 1.7B 参数估算 |
|---|---|---:|
| BF16 模型参数 | 2N 字节 | 3.17 GiB |
| BF16 参数梯度 | 2N 字节 | 3.17 GiB |
| Adam 一阶动量 `exp_avg` | 2N 字节 | 3.17 GiB |
| Adam 二阶动量 `exp_avg_sq` | 2N 字节 | 3.17 GiB |
| 训练中以上四项合计 | 8N 字节 | **12.67 GiB** |

这只是参数级账本，还没有计入激活、logits、概率计算、optimizer 临时量、CUDA 上下文和缓存。

Adam 状态在第一次有效 `optimizer.step()` 时才分配；因此不能只观察模型刚加载或第一轮生成后的显存就判断长期峰值。`zero_grad(set_to_none=True)` 后梯度通常可以释放，但两份 Adam 状态仍存在，后续 rollout 的参数级基础占用约为 **9.50 GiB（权重 + 两份动量）**，而不是最初的 3.17 GiB。

CUDA 上 Adam 还可能选用 foreach 路径，产生额外的参数量级临时张量。实际实现若将部分参数或状态改为 FP32，上表必须随之修正；低精度 Adam 状态是否满足数值稳定性要求也是另一个问题，不能仅以省显存判断好坏。

##### 3. 最容易忽略的大项：`compute_log_probs()` 的全词表张量

代码虽然最终只返回 `[B,T-1]` 的目标 token 概率，但计算过程中先构建全词表 logits 和 log probabilities：

```python
logits = output.logits[:, :-1, :].to(torch.float32)
log_probs = F.log_softmax(logits, dim=-1)
target_log_probs = torch.gather(log_probs, dim=-1, index=targets).squeeze(-1)
```

因此显存规模与 `B × T × V` 相关，不只是最终返回张量的大小。Qwen3-1.7B 官方配置的词表大小 V=151936，详见 [模型 config.json](https://huggingface.co/Qwen/Qwen3-1.7B/blob/main/config.json)。

T 是 **prompt + completion 的补齐长度**，不是 `max_new_tokens`。以 prompt 128 token、生成 512 token，即 T≈640 为示例假设（没有实际 tokenize 测量）：

| 全词表张量 | 训练 B=2 | rollout 重算旧概率 B=8 |
|---|---:|---:|
| 若模型输出 logits 为 BF16：约 2BTV 字节 | 0.36 GiB | 1.45 GiB |
| 转换后的 FP32 logits：约 4B(T-1)V 字节 | 0.72 GiB | 2.89 GiB |
| FP32 `log_softmax` 输出：同上 | 0.72 GiB | 2.89 GiB |
| 三者可能同时存在的近似量级 | **1.81 GiB** | **7.24 GiB** |

以上是可能重叠的张量量级，不是所有版本都必然相加：有的模型实现本身返回 FP32 logits；分配生命周期、autograd 保存和算子工作区也会改变峰值。训练反向还可能出现同量级的词表维梯度临时量。

尤其要注意：`torch.no_grad()` 只是不保存反向传播图，**不会免除 rollout 的完整前向、FP32 转换和全词表 log_softmax 内存**。当前代码一次对 8 个回答重算 old log probability，这个阶段可能比 B=2 的训练前向更容易触发峰值。

##### 4. 生成 KV cache 与训练激活

生成阶段在模型默认启用缓存的情况下保留 KV cache。其估算公式为：

```text
KV bytes ≈ 2(K与V) × 层数 × 生成batch × 总序列长度
           × KV头数 × head_dim × 每元素字节数
```

按该模型配置的 28 层、8 个 KV 头、head_dim=128，以及 BF16、B=8、T=640 估算，KV cache 约 **0.55 GiB**；实际值随输出提前结束、缓存实现和长度变化。上述结构参数同样来自模型官方 config。

KV cache 主要在 generate 阶段，不能直接把它和后续概率重算的所有临时张量一概相加。`compute_log_probs()` 显式设置 `use_cache=False`，不会为其前向额外保留生成式 KV cache。

训练阶段则需要中间激活和反向工作区；gradient checkpointing 会减少激活保存，但不能消除所有激活，也不能消除完整词表投影与概率张量。实际 attention 后端若回退到非融合实现，显存还可能上升。

梯度累积 4 次不会保留 4 份完整计算图：每次 `backward()` 后该次图通常释放，梯度在相同 `.grad` 上相加。但代码中的 `loss`、`log_probs`、`exp` 等 Python 变量在新值覆盖前仍可能持有上一批的部分张量引用，因此实际峰值也受对象生命周期影响。

##### 5. 当前配置的整体判断

显存峰值应取各阶段的最大值，而不是把所有阶段的独立峰值直接相加：

```text
首次加载：       权重
首次 rollout：  权重 + 生成/旧概率重算工作集
稳定训练阶段：  权重 + Adam状态 + 梯度 + 激活/概率/反向工作区
后续 rollout：  权重 + Adam状态 + 生成或旧概率重算工作集
optimizer step：权重 + Adam状态 + 梯度 + optimizer临时量
```

以 T≈640 的假设计算，后续 rollout 的“参数 + Adam 状态 + 三份全词表张量”账本就约为 **9.50+7.24=16.74 GiB**，还没有完整包含该阶段隐藏状态与工作区。因此 **不能根据“1.7B 权重仅约 3 GiB”得出当前训练只需几 GiB 的结论，也不能承诺 16 GiB 显卡一定可运行**。

此配置可先把 **约 16～24 GiB 或更高** 看作需要验证的峰值预算范围，而不是实测结果或硬上限。24 GiB 卡也需预留显示进程、其他任务、上下文和碎片空间；prompt 更长、FP32 输出/状态更多、后端不同或临时量重叠都可能突破预算。更短回答则可能明显降低实际占用。

`torch.cuda.empty_cache()` 只释放 allocator 中未被活跃张量使用的缓存，**不会释放模型参数、Adam 状态或仍有引用的张量**，不能靠它解决活跃工作集本身过大的 OOM。`accumulated_loss` 是 Python 数字，几乎不占显存；梯度裁剪不会额外存一份完整 old model。

##### 6. 如何实测、如何降低峰值

建议覆盖至少两个完整 rollout/训练周期，并记录第一次 optimizer step、后续 rollout 旧概率重算和训练反向的峰值。只有首轮记录不足以覆盖 Adam 状态已经驻留后的情况。

可在阶段边界同步 GPU 后使用如下诊断调用（下面是建议，不是已加入训练源码的功能）：

```python
torch.cuda.synchronize(model.device)
torch.cuda.reset_peak_memory_stats(model.device)
# 执行待测阶段；需分别测 generate、旧概率重算、backward 和 optimizer.step
torch.cuda.synchronize(model.device)
print(torch.cuda.max_memory_allocated(model.device) / 2**30)
print(torch.cuda.max_memory_reserved(model.device) / 2**30)
```

`allocated` 反映 PyTorch 活跃张量的分配，`reserved` 包含 allocator 保留空间；还应结合 `nvidia-smi` 的进程占用，区分上下文等非张量开销。记录真实 T、参数/梯度/Adam dtype，以及 attention 后端，才能解释结果。

若显存不足，按对应阶段处理：

- 训练反向峰值高：降低 `train_batch_size`；可增大 `batch_acc` 保持有效 batch，但它不降低参数和 Adam 状态的开销。
- rollout 峰值高：降低 `num_rollouts`（组算法仍须 >1），或改代码分块重算旧概率；分块后仍应合并完整题目组计算优势。
- 序列相关开销高：减少 `max_new_tokens` 或 prompt 长度，但要检查答案是否被截断、格式奖励是否失真。
- 参数级开销过高：改用较小模型，或另行实现 LoRA/offload/分片；当前代码没有自动启用这些功能。
- 仅降低 `prompts_per_step`：主要减少每轮 CPU buffer 和训练批次数，不会直接降低“每题 8 回答”的生成/旧概率峰值。

**结论：当前 GRPO 虽省去了 reference/value 模型，但仍是 BF16 全参数 Adam 训练；显存压力主要来自约 12.67 GiB 的训练参数级账本，以及 rollout B=8 时的全词表 FP32 概率计算。需要按阶段实测，不能用权重大小或有效 batch=8 单独推断总显存。**
