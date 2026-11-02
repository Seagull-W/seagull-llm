# CS336 Assignment 2 (Systems) —— 手动完成指南

> 本文档是 PDF《cs336_assignment2_systems.pdf》的任务拆解与导航手册，不含实现代码。
> 每个任务列出：**要做什么 / 交付什么 / 怎么验证 / 学习要点 / 易踩的坑**。
> 作业仓库：`assignment/assignment2-systems/`

---

## 0. 任务总览

**目标**：提升单 GPU 训练速度，并把训练扩展到多 GPU。

**要实现的六件事**：
1. 基准测试与性能剖析工具（Benchmarking & Profiling）
2. 激活检查点（Activation Checkpointing）
3. FlashAttention-2 的 Triton Kernel
4. 分布式数据并行训练（DDP）
5. 优化器状态分片（Optimizer State Sharding）
6. 全分片数据并行（FSDP）

**提交物**：
- `writeup.pdf`：回答所有书面问题（建议用 LaTeX / Typst 排版）
- `code.zip`：运行 `./test_and_make_submission.sh` 生成

**仓库结构**：
- `cs336-basics/`：Assignment 1 的官方实现（`cs336_basics` 包）。想用自己的实现可替换或在 `pyproject.toml` 里改指向。
- `cs336_systems/`：几乎为空，是你 Assignment 2 要写的模块。
- `tests/`：所有测试。`tests/adapters.py` 是你实现与测试之间的“接口桥”，必须逐个实现里面的函数。
- 运行方式：`uv run pytest ...`

**分值汇总**：

| 问题 | 分值 | 章节 |
|---|---|---|
| benchmarking_script | 4 | 2.1.3 |
| nsys_profile | 5 | 2.1.4 |
| mixed_precision_accumulation | 1 | 2.1.5 |
| benchmarking_mixed_precision | 2 | 2.1.5 |
| memory_profiling | 4 | 2.1.6 |
| gradient_checkpointing | 4 | 3.2 |
| pytorch_attention | 2 | 4.1 |
| torch_compile | 2 | 4.2 |
| flash_forward | 15 | 4.2.2 |
| flash_backward | 5 | 4.2.2 |
| flash_benchmarking | 5 | 4.2.2 |
| distributed_communication_single_node | 5 | 5.1 |
| naive_ddp | 5 | 5.2 |
| naive_ddp_benchmarking | 3 | 5.2 |
| minimal_ddp_flat_benchmarking | 2 | 5.3.1 |
| ddp_overlap_individual_parameters | 5 | 5.3.2 |
| ddp_overlap_individual_parameters_benchmarking | 1 | 5.3.2 |
| optimizer_state_sharding | 15 | 6 |
| optimizer_state_sharding_accounting | 5 | 6 |
| fsdp | 15 | 7 |
| fsdp_accounting | 5 | 7 |
| alternate_ring_all_reduce | 1 | 8.1 |
| data_parallel_calcs | 3 | 8.2 |
| fsdp_calcs | 3 | 8.3 |
| tp_calcs | 4 | 8.4 |
| fsdp_tp_calcs | 6 | 8.5 |
| leaderboard | 10 | 9 |

**模型尺寸表**（默认 vocab=10000，batch=4，context=512）：

| Size | d_model | d_ff | layers | heads |
|---|---|---|---|---|
| small | 768 | 3072 | 12 | 12 |
| medium | 1024 | 4096 | 24 | 16 |
| large | 1280 | 5120 | 36 | 20 |
| xl | 2560 | 10240 | 32 | 32 |
| 10B | 4608 | 12288 | 50 | 36 |

---

## 1. 实施路线图（推荐顺序）

| 阶段 | 内容 | 依赖 | 是否需要 GPU |
|---|---|---|---|
| 0 | 环境准备：`uv run python` 能 import `cs336_basics` | — | 否 |
| 1 | §2 基准/剖析基础设施 | 0 | 部分（nsys、memory profiling 需要） |
| 2 | §3 激活检查点 | 1 的脚本 | 否（可在 CPU 上验证思路） |
| 3 | §4 Attention：PyTorch 基准 → torch.compile → FA2 | 1 | Triton 部分需要 |
| 4 | §5 DDP：单机通信 → naive → flat → overlap | 1 | 测试可用 gloo/CPU，基准需要 NCCL |
| 5 | §6 优化器状态分片 | 4 | 测试可用 gloo/CPU |
| 6 | §7 FSDP | 4、5 | 测试可用 gloo/CPU |
| 7 | §8 并行策略理论计算 | — | 否（纯数学，可随时穿插） |
| 8 | §9 Leaderboard（可选，10 分） | 3、6 | 需要 |
| 9 | 写报告 + 提交 | 全部 | 否 |

建议先把 §2 的 benchmark 脚本做扎实并参数化，后续所有优化（精度、compile、kernel）都靠它测量。

---

## 2. 逐题拆解

### Part A —— Profiling & Benchmarking（§2）

#### A1. Benchmarking Script（4 分）
- **做什么**：写一个脚本（如 `benchmark.py`）：
  - 根据超参数（层数等）初始化 basics Transformer 模型；
  - 生成随机 batch；
  - 先跑 W 次 warm-up，再计时 N 步；支持三种模式（仅 forward / forward+backward / 完整含 optimizer step），用命令行参数切换；
  - 每步后 `torch.cuda.synchronize()`；计时用 `timeit.default_timer()`。
- **(b)** 对 §2.1.2 各模型尺寸：5 次 warmup、10 次测量，报告平均值与标准差；回答 forward/backward 耗时、波动是否大。
- **(c)** 去掉 warmup 重测；试 1~2 次 warmup；解释差异原因（懒惰初始化、cuDNN autotune、缓存预热等）。
- **交付**：脚本 + (b) 1-2 句 + (c) 2-3 句。
- **学习要点**：CUDA 是异步的，`synchronize()` 后才能得到真实 GPU 耗时；warmup 为什么必要。
- **坑**：别用 `time.time()`；别忘同步；脚本务必参数化，后面每个任务都要复用。

#### A2. Nsight Systems Profiling（5 分）
- **做什么**：用 `nsys profile` 剖析 forward / backward / optimizer step。自选 Table 1 中**两个模型尺寸** × **3 个 2 的幂 context length**（>128，最大取能塞进显存的那个）。
- **建议**：在代码里加 NVTX range 标注（如把 scaled-dot-product-attention 拆成 scores / softmax / final matmul 三段），用 `--nvtx-capture` 过滤 warmup；看 “CUDA GPU Kernel Summary” 回答：
  - (a) forward 总时间与 Python 侧测的是否一致；
  - (b) forward 中最耗时的 CUDA kernel 是什么、调用多少次；fwd+bwd 时是否还是它；
  - (c) 除 matmul 外还有哪些 kernel 占比不小；
  - (d) 完整训练 step 中 matmul 占比与纯推理相比如何变化；
  - (e) attention 内部 softmax 与 matmul 的运行时差异 vs FLOPs 差异。
- **交付**：每个 profile 对应的 1-2 句回答 + 报告中附截图。
- **坑**：`--cudabacktrace`/`--python-backtrace` 开销大，按需开；`torch.compile` 会模糊归因，需要时手动包/剥 compile。

#### A3. Mixed-Precision Accumulation（1 分）
- **做什么**：运行 PDF 中四段累加 0.01×1000 次的代码（FP32 累加 FP32 / FP16 累加 FP16 / FP32 累加 FP16 / 先把 FP16 转回 FP32 再累加），解释精度差异。
- **交付**：2-3 句评论。
- **学习要点**：累加必须保持高精度；FP16 动态范围小、精度低。

#### A4. Benchmarking Mixed Precision（2 分）
- **(a)** 对 PDF 给的 `ToyModel` + `torch.autocast(dtype=torch.float16)`，回答以下对象在 autocast 内的数据类型：模型参数、fc1 输出、LayerNorm 输出、logits、loss、梯度。
- **(b)** LayerNorm 的哪部分对混合精度敏感？换 BF16 是否仍需特殊对待？为什么？
- **(c)** 给 benchmark 脚本加 BF16 autocast 选项（用 `nullcontext` 作全精度对照），对 Table 1 所有尺寸测 forward+backward，对比并评论随模型尺寸变化的趋势。
- **交付**：数据类型清单 + 2-3 句 + 2-3 句（含计时数据）。
- **学习要点**：`autocast` 的策略（matmul 降精度、归一化层保持 FP32）、FP16 vs BF16 的差异。

#### A5. Memory Profiling（4 分）
- **做什么**：用 `torch.cuda.memory._record_memory_history` + `_dump_snapshot` 导出 pickle，拖进 pytorch.org/memory_viz 查看 “Active Memory Timeline”。对象：xl 模型，context = 128 与 2048。
- **(a)** 推理（仅 forward）与完整训练 step 各一张 timeline 图；根据峰值判断当前在哪个阶段。
- **(b)** 每个 context 下 forward 与完整 step 的峰值内存表。
- **(c)** 混合精度下的峰值内存是否显著变化。
- **(d)** 推导 xl 模型 residual stream 单条激活张量的大小（MiB，除以 1024²）。
- **(e)** 把 memory_viz 的 Detail 调低，看最大分配多大、来自哪里（stack trace）。
- **(f)** 用 Nsight 内存剖析 + NVTX label：单个 TransformerBlock 为 backward 保存多少内存（residuals），前 5 大操作及占比；backward 时释放的残差 vs 新产生的梯度张量内存，估算一个 block 的梯度内存，与预期对照。
- **交付**：图 + 表 + 各小问的 1-2 句 / 1-2 段回答。
- **学习要点**：激活内存 ∝ batch × seq × d_model，峰值出现在 backward；混合精度主要省激活与参数。

### Part B —— 激活检查点（§3）

#### B1. Memory-Optimal Gradient Checkpointing（4 分）
- **(a)** 忽略计算成本，什么策略让峰值激活内存最小？可以任意嵌套 `torch.utils.checkpoint.checkpoint`。给出策略描述 + 代码草图 + 峰值内存与计算量的渐近复杂度（关于层数 N）。要点：递归/树状嵌套可以显著压峰值，代价是重算次数增加。
- **(b)** xl 配置（batch=4, seq=2048），预算只有**一次 recomputation（不许嵌套）**：找出最佳 checkpoint 块大小，profile 实测峰值内存验证，并对比相邻（更小/更大）块大小。
- **交付**：3-5 句 + 草图；3-5 句 + 实测数字。
- **学习要点**：checkpoint 自身存储 vs 块内重算时 materialize 的残差之间的权衡；可用 `saved_tensors_hooks` 观察保存了哪些张量（PDF §3.1 有完整示例）。

### Part C —— GPU Kernels：FlashAttention-2（§4）

#### C1. PyTorch Attention Benchmarking（2 分）
- **做什么**：脚本固定 batch=8、去掉 head 维，遍历 d_model ∈ {16,32,64,128} × seq ∈ {256,1024,4096,8192,16384}；随机 QKV；warmup；100 次 forward 计时；backward 前量内存；100 次 backward 计时；每步 `synchronize`。
- **交付**：完整计时表（OOM 也记录）；OOM 从哪个尺寸开始；对最小 OOM 配置做注意力内存核算（用 Assignment 1 的内存公式）；backward 保存的内存随 seq 怎么变；如何消除。
- **学习要点**：attention 矩阵 O(seq²) 是瓶颈。

#### C2. Torch Compile（2 分）
- **(a)** attention benchmark 加 `torch.compile` 版本，同配置对比 forward/backward 计时表。
- **(b)** 整个 Transformer 用 `torch.compile`，与 vanilla 对比 forward 及完整训练 step 的表格。
- **学习要点**：torch.compile 自动融合算子，但长序列下注意力内存访问模式仍然差——这正是要手写 Triton FA2 的原因。

#### C3. FlashAttention-2 Forward Pass（15 分）
三小问：
- **(a) 纯 PyTorch 版**：写一个 `torch.autograd.Function`，按 tiled + online softmax 实现 FA2 forward（不用 Triton）。接口 `forward(ctx, Q, K, V, is_causal=False)`；保存 L、Q、K、V、O 供 backward 用；backward 暂时 `raise NotImplementedError`；tile 至少 16×16；测试维度都是 ≥16 的 2 的幂。用 PDF 的公式 (4)-(6)、(12) 做对照。
  - 验证：`uv run pytest -k test_flash_forward_pass_pytorch`
- **(b) Triton 版**：按 Algorithm 1 写 `flash_fwd_kernel`：
  - 用 `tl.make_block_ptr` 建 Q/K/V/O/L 的 block pointer；
  - launch grid = (n_query_tiles, batch_size)；
  - 单层循环遍历 key tiles；`tl.dot` 做 matmul；
  - 运行中的 m（running max）、l（running sum）、O 用 fp32 缓冲，`acc=` 参数累积；
  - P 先 cast 到 V 的 dtype 再乘，写回前 O 也 cast 回合适 dtype；
  - 最后写 O 与 logsumexp L。
  - 验证：`uv run pytest -k test_flash_forward_pass_triton`（需要 GPU）
- **(c) causal masking**：给 Function 加末尾可选布尔参数（默认 False）；kernel 加 `is_causal: tl.constexpr` 参数；构造 query/key 索引向量比较生成 Q_TILE×K_TILE 掩码，被掩元素在 S 上加 `-1e6`；`ctx.is_causal = is_causal` 保存。
- **适配器**：`get_flashattention_autograd_function_pytorch`、`get_flashattention_autograd_function_triton`
- **坑**：block pointer 的 offsets 记得乘 tile 大小；更新 m/l/O 的顺序不能错；测试断言 O 与 L 都要与参考接近，L 的形状必须是 (batch, seq)。

#### C4. FlashAttention-2 Backward Pass（5 分）
- **做什么**：用**纯 PyTorch + torch.compile**（不是 Triton）实现 backward：输入 Q、K、V、O、dO、L，返回 dQ、dK、dV。先预计算 `D = rowsum(O ⊙ dO)`，再按 PDF 公式 (13)-(19) 重算 S 与 P。
- **验证**：`uv run pytest -k test_flash_backward`（同时测 PyTorch 版与 Triton 版）。
- **学习要点**：用 recomputation 避免保存 O(seq²) 的 attention 矩阵；L 让 backward 不再需要显式 softmax。
- **坑**：L 必须正确从 forward 保存并传给 backward；dO 别在函数里覆盖。

#### C5. FlashAttention-2 Benchmarking（5 分）
- **做什么**：用 `triton.testing.do_bench` 对比“Triton forward + torch.compile backward”的 FA2 与普通 PyTorch attention。配置：batch=1、causal；seq ∈ 2 的幂 128~65536；d ∈ 2 的幂 16~128；bf16 与 fp32。报 forward、backward、端到端三个延迟。可能要根据输入尺寸调 tile。
- **交付**：对比表。
- **坑**：65536 这种超长 seq 大概率 OOM 或极慢，属预期，记录即可；tile 尺寸与精度要配合。

#### C6.（可选）Triton Backward Pass
- 若想冲 leaderboard：按 Algorithm 2 写 Triton 版 backward。关键技巧是 S 算两次（一次算 dQ，一次算 dK/dV），避免跨 block 同步与 atomics。

### Part D —— 分布式数据并行（§5）

#### D1. Distributed Communication（Single Node）（5 分）
- **做什么**：写脚本 benchmark all-reduce：fp32 数据大小 ∈ {1MB, 10MB, 100MB, 1GB} × 进程数 ∈ {2, 4, 6}。每次先 5 次 warmup；`torch.cuda.synchronize()` 后计时；用 `dist.all_gather_object` 收集所有 rank 的测量结果汇总。
- **交付**：图/表 + 2-3 句评论（数据量、进程数如何影响时间）。
- **学习要点**：NCCL vs Gloo；同步/异步 collectives 的语义（`async_op=True` 返回 handle，`wait()` 只是确保已排队）。
- **约束**：最多 6 张 GPU；单次运行 < 5 分钟。

#### D2. Naïve DDP（5 分）+ Benchmarking（3 分）
- **做什么**：实现最朴素的数据并行：backward 完成后对**每个参数梯度单独 all-reduce**（取平均）。
- **适配器**：`get_ddp`（可配合 `ddp_on_after_backward` 在 backward 后、`optimizer.step()` 前做同步）。
- **验证**：`uv run pytest tests/test_ddp.py`（gloo 后端，CPU 即可跑）。
- **Benchmark**：xl 模型、1 节点 × 2 GPU，测每训练迭代总时间与花在梯度通信上的时间占比。
- **学习要点**：DP 四步：切 batch → 本地 fwd/bwd → all-reduce 平均梯度 → 各自 optimizer step；每参数一次 all-reduce 的调用开销。

#### D3. Minimal DDP with Flat Gradients（2 分）
- **做什么**：把所有参数梯度 flatten 拼接成一个大 tensor，一次 all-reduce（可参考 `torch._utils._flatten_dense_tensors` / `_unflatten_dense_tensors`）。与 D2 同配置对比每步时间与通信时间。
- **交付**：数字 + 1-2 句对比（批量 vs 逐个的调用开销差异）。

#### D4. DDP with Overlapping Individual Parameters（5 分）+ Benchmarking（1 分）
- **做什么**：实现一个 DDP 容器类：
  - `__init__(module)`：构造时广播参数，保证各 rank 初始一致；
  - `forward(*inputs, **kwargs)`：透传给被包装模块；
  - `finish_gradient_synchronization()`：等待所有异步通信完成；
  - 用 `register_post_accumulate_grad_hook` 在**每个参数的梯度就绪时立刻异步 all-reduce**（`async_op=True`），让通信与 backward 计算重叠。
- **适配器**：`get_ddp`、`ddp_on_after_backward`（后者可选）。
- **验证**：`uv run pytest tests/test_ddp.py`，建议连跑 5 次确认无竞态。
- **Benchmark (a)**：同配置（1 节点 2 GPU、xl）对比 D2/D3，报每步时间。
- **Benchmark (b)**：用 Nsight 对朴素版与重叠版各截一张图，直观展示通信是否与 backward 重叠。
- **坑**：optimizer.step() 前必须调 `finish_gradient_synchronization()`；hook 注册在参数上；注意 tied weights 会共享参数（测试覆盖）。

### Part E —— 优化器状态分片（§6）

#### E1. Optimizer State Sharding（15 分）
- **做什么**：实现一个 `torch.optim.Optimizer` 子类，包装任意底层优化器（如 AdamW）：
  - `__init__(params, optimizer_cls, **kwargs)`：调 `super().__init__()`；把参数按 rank 切成约 1/world_size 的子集；
  - `add_param_group(param_group)`：处理新参数组的分配（构造时 super 会调用，训练中也可能调用，如逐层解冻）；
  - `step(closure=None, **kwargs)`：只让本 rank 的优化器更新自己的分片，然后与其他 rank 同步（把更新后的参数广播/同步给所有 rank，保证参数一致）。
- **适配器**：`get_sharded_optimizer`
- **验证**：`uv run pytest tests/test_sharded_optimizer.py`，建议 5 次。
- **学习要点**：AdamW 每参数两份状态（m、v）≈ 2× 权重内存；这就是 ZeRO stage 1 想省的；思考按什么规则把参数分到各 rank（如展平后切片）。
- **坑**：测试覆盖 tied weights 模型；参数组的 `requires_grad=False` 参数也要处理；广播前先完成本 rank 更新。

#### E2. Optimizer State Sharding Accounting（5 分）
- **(a)** xl、1 节点 2 GPU：profile 有/无 sharding 时“模型初始化后 / optimizer step 前 / step 后”的峰值内存，并分解内存构成（参数、优化器状态、梯度、激活）。
- **(b)** 每迭代时间对比（有/无 sharding）。
- **(c)** 与 ZeRO stage 1 的差异（尤其内存与通信量方面）——自己查 ZeRO 论文对照思考。
- **交付**：2-3 句 + 2-3 句 + 2-3 句。

### Part F —— Fully-Sharded Data Parallel（§7）

#### F1. FSDP（15 分）
- **做什么**：实现 FSDP 容器类，包装任意 `nn.Module`，hook 或包装其中**所有 Linear / Embedding 层**（norm 层不 shard）：
  - `__init__(module, compute_dtype=None)`：构造时把各层权重按 rank 分片；给出 `compute_dtype` 时，先 cast 再通信/计算，master weights 与优化器更新保持 FP32；
  - `forward(*inputs, **kwargs)`：forward 前 all-gather 权重（按 PDF 建议，比当前层早两层开始 gather 以便隐藏延迟），用后释放；
  - `finish_gradient_synchronization()`：等待异步通信结束；
  - backward：all-gather 权重供计算；梯度就绪后 reduce-scatter 到对应 rank；释放 gathered 权重。
  - 每个 shard 要能被标准 AdamW 直接优化。
- **适配器**：`get_fsdp`、`fsdp_on_after_backward`、`fsdp_gather_full_params`（后两个按需）。
- **验证**：`uv run pytest tests/test_fsdp.py`，建议 5 次抓竞态。
- **学习要点**：FSDP 生命周期（gather → forward → free → backward → reduce-scatter）；prefetch 与通信/计算重叠；权重先 cast 再通信省带宽。
- **坑**：gathered 权重必须释放否则显存爆；tied weights；只 shard `cs336_basics` 的 Linear/Embedding（不是 `nn.Linear`）。

#### F2. FSDP Accounting（5 分）
- **(a)** 基于 §6 的账目，预估 FSDP 相对 DDP 能从峰值省多少内存（忽略 all-gather 预分配缓冲区）。
- **(b)** 2 GPU 跑 xl，观察权重 all-gather 是否赶在 forward 前完成；附 Nsight 截图与计时。
- **交付**：2-3 句 × 2 + 截图。

### Part G —— 并行策略理论计算（§8，纯数学）

通用设定：N 台设备两两直连，每台 egress 带宽 B；单设备算力 X FLOP/s；权重/激活均为 FP16（2 字节）；分析单个 FFN 层（激活 (S, H)，权重 (H, H_FF)、(H_FF, H)）；matmul (A,B)×(B,C) = 2ABC FLOPs；ring all-gather 与 ring reduce-scatter 均耗时 (N-1)/N × 数据量/B；ring all-reduce = 两者之和。

- **G0. alternate_ring_all_reduce（1 分）**：推导 PDF 给出的另一种 ring all-reduce 算法耗时（用数据量 P、设备数 N、带宽 B 表达），并给一句理由。注意它和“reduce-scatter + all-gather”的差异。
- **G1. data_parallel_calcs（3 分）**：
  - (a) DP 下 backward 的 FLOPs；
  - (b) backward 的通信时间（全量梯度 all-reduce）；
  - (c) 通信成为瓶颈前 N_DP 的上界不等式。
- **G2. fsdp_calcs（3 分）**：FSDP 下 forward/backward 的 FLOPs 与通信时间（权重 all-gather + 梯度 reduce-scatter），以及各自的上界不等式。
- **G3. tp_calcs（4 分）**：先写出给定 TP 配置（W1、W2 列并行，W3 行并行）的 backward 方程；再算 forward/backward FLOPs、通信时间（激活 all-reduce）、上界不等式。
- **G4. fsdp_tp_calcs（6 分）**：2D 并行（FSDP+TP）：
  - (a) forward FLOPs；
  - (b) forward 通信时间 = max(FSDP 轴成本, TP 轴成本)（两轴可重叠）；
  - (c) 最优 N_TP、N_FSDP 下总设备数 N 的上界；
  - (d) 两轴**不能**重叠时再推一遍（总成本相加）。
- **要点**：所有答案都要能写出表达式与一句推导理由；建议用符号演算整理成报告表格。

### Part H —— Leaderboard（§9，10 分）
- **做什么**：8B 模型（vocab 151936、d_model 4096、d_ff 11008、34 层、32 头、causal、BF16），batch=2、seq=32768，跑 2×B200 上完整训练 step（forward + loss + backward + AdamW）。目标：打败朴素基线 10 秒；空缓存下整个 benchmark 必须在 10 分钟内完成（注意别过度 autotune）。
- **约束**：不能改模型输入/输出行为；必须用自己的实现，不能抄现成实现。
- **PDF 给的优化点子**：Triton autotune 调 tile；fused AdamW；把 LM head 与 cross-entropy 融合（避免物化 [batch, seq, vocab] 的 logits）；Triton 版 backward（§4.2.3）；双 pass 分别算 dQ 与 dK/dV 避免 atomics；causal 下提前终止全零 tile；非掩码 tile 与对角线 tile 分开处理；Hopper 以上用 TMA；必要时用激活检查点换内存。
- **交付**：最优 wall-clock 时间 + 提交到 leaderboard 仓库。

---

## 3. 通用技巧与资源

**GPU 需求对照**：
- 纯 CPU 可做：A1（部分）、A3、A4（思路）、B1、D2-D4 与 E1、F1 的测试（gloo 后端）、G0-G4 全部、报告撰写。
- 需要 GPU：A2（nsys）、A5（memory profiling）、C1-C6（attention 基准与 Triton）、D/E/F 的性能基准（NCCL）、H。

**常用命令**：
```sh
uv run python <script>.py          # 跑脚本
uv run pytest -k test_flash_forward_pass_pytorch
uv run pytest -k test_flash_forward_pass_triton
uv run pytest -k test_flash_backward
uv run pytest tests/test_ddp.py
uv run pytest tests/test_sharded_optimizer.py
uv run pytest tests/test_fsdp.py
uv run nsys profile --trace=cuda,cudnn,cublas,osrt,nvtx --pytorch=functions-trace,autograd-shapes-nvtx -- python benchmark.py
./test_and_make_submission.sh     # 生成提交包
```

**调试 Triton**：`tl.device_print`；`TRITON_INTERPRET=1`（CPU 解释器，PDF 说可能不稳定）；逐步拿 Triton 版与 (a) 的 tiled PyTorch 版对拍。

**写报告建议**：用 `pandas.DataFrame.to_latex()` / `to_typst()` 或自己写生成函数，把表格自动化，避免手排 LaTeX。

**参考资料**（PDF 引用）：
- FlashAttention（Dao et al., 2022）与 FlashAttention-2（Dao, 2023）论文
- Triton 官方教程（注意 PDF 用的是 block pointer 抽象）
- torch.compile 教程（pytorch.org/tutorials）
- PyTorch memory_viz（pytorch.org/memory_viz）
- Nsight Systems 文档
- torch.distributed 文档、`register_post_accumulate_grad_hook`
- ZeRO 论文（Rajbhandari et al., 2020）
- TPU Scaling Book、Ultra-Scale Playbook

---

## 4. 提交检查清单

- [ ] `writeup.pdf`：所有书面问题已作答并排版（含图表、nsys/memory_viz 截图）
- [ ] `code.zip`：`./test_and_make_submission.sh` 成功运行
- [ ] `uv run pytest` 全部通过（Triton/GPU 相关测试在有 GPU 的机器上通过）
- [ ] 分布式相关测试（DDP / sharded optimizer / FSDP）连跑 5 次无偶发失败
- [ ] 报告中的表格与数字来自脚本自动生成（可复现）
- [ ] 如参加 leaderboard：留好最优时间的复现脚本与说明
