# Assignment2
## A1 Benchmarking Script

### (b) 
**QUESTION**
对 §2.1.2 各模型尺寸：5 次 warmup、10 次测量，报告平均值与标准差；回答 forward/backward 耗时、波动是否大。

**Answer**
配置有限，只有一张可怜的4060tap，跑几个意思一下。
<!--
```shell
(cs336-systems) PS D:\objects\LLM\CS336-2026\assignment\assignment2-systems> uv run benchmark.py --model-size 'small' --mode 'forward'
[small  | forward] warmup=5 steps=10 -> mean=0.109715 s  std=0.000242 s  (CV=0.2%)  params=128,625,408
```

```shell
(cs336-systems) PS D:\objects\LLM\CS336-2026\assignment\assignment2-systems> uv run benchmark.py --model-size 'small' --mode 'for_bac'
[small  | for_bac] warmup=5 steps=10 -> mean=0.372372 s  std=0.042184 s  (CV=11.3%)  params=128,625,408
```

```shell
(cs336-systems) PS D:\objects\LLM\CS336-2026\assignment\assignment2-systems> uv run benchmark.py --model-size 'small' --mode 'full'   
[small  | full   ] warmup=5 steps=10 -> mean=0.401314 s  std=0.001933 s  (CV=0.5%)  params=128,625,408
```

```shell
(cs336-systems) PS D:\objects\LLM\CS336-2026\assignment\assignment2-systems> uv run benchmark.py --model-size 'medium' --mode 'forward'
[medium | forward] warmup=5 steps=10 -> mean=0.335881 s  std=0.000744 s  (CV=0.2%)  params=423,183,360
```

```shell
(cs336-systems) PS D:\objects\LLM\CS336-2026\assignment\assignment2-systems> uv run benchmark.py --model-size 'medium' --mode 'for_bac'
[medium | for_bac] warmup=5 steps=10 -> mean=12.009977 s  std=0.013813 s  (CV=0.1%)  params=423,183,360
```


```shell
(cs336-systems) PS D:\objects\LLM\CS336-2026\assignment\assignment2-systems> uv run benchmark.py --model-size 'medium' --mode 'full'   
[medium | full   ] warmup=5 steps=10 -> mean=15.529772 s  std=0.395929 s  (CV=2.5%)  params=423,183,360
```

```shell
(cs336-systems) PS D:\objects\LLM\CS336-2026\assignment\assignment2-systems> uv run benchmark.py --model-size 'large' --mode 'forward' 
[large  | forward] warmup=5 steps=10 -> mean=0.803627 s  std=0.069286 s  (CV=8.6%)  params=969,411,840 
```-->
| Model Size | Mode      | Mean (s)    | Std (s)     | CV  | Parameters   |
|:------------:|:-----------:|-------------|-------------|--------|--------------|
| small  | forward   | 0.109715    | 0.000242    | 0.2%   | 128,625,408  |
| small  | for_bac   | 0.372372    | 0.042184    | 11.3%  | 128,625,408  |
| small  | full      | 0.401314    | 0.001933    | 0.5%   | 128,625,408  |
| medium | forward   | 0.335881    | 0.000744    | 0.2%   | 423,183,360  |
| medium | for_bac   | 12.009977   | 0.013813    | 0.1%   | 423,183,360  |
| medium | full      | 15.529772   | 0.395929    | 2.5%   | 423,183,360  |
<!--| large  | forward   | 0.803627    | 0.069286    | 8.6%   | 969,411,840  |-->

从数值来看，似乎反向传播是主要的运行时间波动来源。

根据一些公开信息，可以先认为“全过程”的波动，主要源于反向传播。而反向传播的波动，又主要源于在GPU等硬件上执行时固有的非确定性（如线程的异步执行，并行带来的顺序不一致，算法选择的不确定性等等）。
### (c) 
**QUESTION**
去掉 warmup 重测；试 1~2 次 warmup；解释差异原因（懒惰初始化、cuDNN autotune、缓存预热等）。

| Model Size | Mode      | warmup |Mean (s)    | Std (s)     | CV  | Parameters   |
|:------------:|:-----------:|:-----------:|-------------|-------------|--------|--------------|
| small  | forward   | 0| 0.145029    | 0.110388    | 76.1%   | 128,625,408  |
| small  | forward   | 1| 0.110275    | 0.001186    | 1.1%   | 128,625,408  |
| small  | forward   | 2| 0.110091    | 0.000548    | 0.5%   | 128,625,408  |
| small  | for_bac   | 0|0.406312    | 0.127535    | 31.4%  | 128,625,408  |
| small  | for_bac   | 1|0.352873    | 0.000894    | 0.3%  | 128,625,408  |
| small  | for_bac   | 2|0.352853    | 0.000856    | 0.2%  | 128,625,408  |
| small  | full      | 0|0.449742    | 0.091283    | 20.3%   | 128,625,408  |
| small  | full      | 1|0.402489    | 0.001032    | 0.3%   | 128,625,408  |
| small  | full      | 2|0.401591    | 0.001382    | 0.3%   | 128,625,408  |

>前后程序的warmup是否会相互影响？
## A2 Nsight Systems Profiling

### (a)

forward 总时间与 Python 侧测的是否一致；

### (b) 
**QUESTION**
forward 中最耗时的 CUDA kernel 是什么、调用多少次；fwd+bwd 时是否还是它；

### (c) 
**QUESTION**
除 matmul 外还有哪些 kernel 占比不小；

### (d) 
**QUESTION**
完整训练 step 中 matmul 占比与纯推理相比如何变化；

### (e) 
**QUESTION**
attention 内部 softmax 与 matmul 的运行时差异 vs FLOPs 差异。

## A3 mixed_precision_accumulation

32+16表示`float32`精度的s累加1000次`float16`的0.01，当然，都是`tensor`。
16to32表示精度经过了一次转换。

| 32 + 32 | 16 + 16 | 32 + 16 | 32 + 16to32 |
| ----- | ----- | ----- | ----- |
| ensor(10.0001) | tensor(9.9531) | tensor(10.0021) | tensor(10.0021) |

可以看出一些精度与储存或者累计运算的规律，显然 16 + 16 的累计误差最大。

1. 累加器保持高精度，哪怕加数精度低，误差也会相对（低精度加低精度）小很多。
2. 事后转变类型提高位宽无法挽回精度损失

### A4 benchmarking_mixed_precision

考虑简单模型：

```python
class ToyModel(nn.Module):
    def __init__(self, in_features: int, out_features: int):
        super().__init__()
        self.fc1 = nn.Linear(in_features, 10, bias=False)
        self.ln = nn.LayerNorm(10)
        self.fc2 = nn.Linear(10, out_features, bias=False)
        self.relu = nn.ReLU()
    def forward(self, x):
        x = self.relu(self.fc1(x))
        x = self.ln(x)
        x = self.fc2(x)
        return x
```

模型初始精度为`float32`，使用`torch.autocast(dtype=torch.float16)`。
autocast例：
```python
# Creates model and optimizer in default precision
model = Net().cuda()
optimizer = optim.SGD(model.parameters(), ...)

for input, target in data:
    optimizer.zero_grad()

    # Enables autocasting for the forward pass (model + loss)
    with torch.autocast(device_type="cuda"):
        output = model(input)
        loss = loss_fn(output, target)

    # Exits the context manager before backward()
    loss.backward()
    optimizer.step()
```
>明显地，反向传播和优化器更新在autocast上下文外；

只有在autocast维护的算子列表内算子的浮点张量输入会被cast。

| 策略 | 目标精度 | 代表算子 | 设计动机 |
|---|---|---|---|
| 可降精度（lower_precision_fp） | fp16/bf16 | `linear`、`mm`、`addmm`、`bmm`、`baddbmm`、`matmul`/`__matmul__`、`conv1d/2d/3d`、`conv_transpose*`、`conv_tbc`、`prelu`、`multi_head_attention_forward`、`scaled_dot_product_attention` | 计算密集、数值上安全，且能吃满 Tensor Core |
| 提升到 fp32（fp32） | float32 | 超越函数：`exp`、`expm1`、`log`、`log2`、`log10`、`log1p`、`logcumsumexp`、`logsumexp`、`sin/cos/tan/tanh/sinh/cosh/asin/acos`、`erf/erfc`、`reciprocal`、`rsqrt`；归一化/激活：`softmax`、`log_softmax`、`layer_norm`、`group_norm`；损失函数：`mse_loss`、`nll_loss`、`cross_entropy_loss`、`binary_cross_entropy(_with_logits)`、`kl_div`、`ctc_loss`、`cosine_similarity`、`l1_loss`、`smooth_l1_loss`、`triplet_margin_loss` 等；累积/线代：`cumsum`、`cumprod`、`det`、`inverse`、`norm`、`svd`、`qr`、`cholesky`、`lstsq` | 对舍入/下溢/上溢敏感，低精度会破坏数值稳定性 |
| 提升到最宽输入精度（promote） | 输入中最宽的 dtype | `cat`、`stack`、`index_copy`，较新版本还包括 `add`、`sub`、`mul`、`div`、`pow`、`atan2`、`hypot`、`addcdiv`、`addcmul` 等 | 处理混合 dtype 输入时避免隐式精度丢失，保证输出与输入一致 |

**(a) 回答以下对象在 autocast 内的数据类型：**

1. the model parameters within the autocast context?

    The answer is `float32`

2. the output of the first feed-forward layer (ToyModel.fc1)?

    The answer is `float16`

3. the output of layer norm (ToyModel.ln)?

    The answer is `float32`

4. the model’s predicted logits?

    The answer is `float16`

5. the loss?

    The answer is `float32`

6. the model’s gradients?

    The answer is `float32` 因为梯度更新在aotucast外，故精度同loss保持一致。

**(b) LayerNorm 的哪部分对混合精度敏感？换 BF16 是否仍需特殊对待？为什么？**  
```python
class RMSNorm(nn.Module):
    """
    This module implements root mean square layer normalization, as
    described in Eq. 4 of https://arxiv.org/abs/1910.07467
    Args:
        hidden_size: int
            Dimensionality of the input to normalize.
        eps: float, default is 1e-5
            A value added to the denominator for numerical stability.
    Returns:
        FloatTensor of same shape as input.
    """

    def __init__(
        self,
        hidden_size: int,
        eps: float = 1e-5,
        device=None,
    ):
        super().__init__()
        self.weight = nn.Parameter(torch.ones(hidden_size, device=device))
        self.eps = eps

    def forward(self, x):
        """
        Args:
            x: FloatTensor of shape `(batch_size, *)`.
                The input to apply root mean square layer normalization on.
        Returns:
            FloatTensor of same shape as input
        """
        # NOTE: in practice, many implementations will
        # manually upcast the input to fp32 here to prevent overflow when you
        # square the input.
        # https://github.com/pytorch/pytorch/issues/66707
        in_dtype = x.dtype

        x = x.to(torch.float32)
        rms = torch.rsqrt(x.pow(2).mean(-1, keepdim=True) + self.eps)
        x = x * rms

        return (self.weight * x).to(in_dtype)

    def extra_repr(self):
        return f"hidden_size={self.weight.shape[0]}, eps={self.eps}"
```

显然，layernorm里包含了加法，平方，均值，开方，矩阵逐元素相乘等运算。

| dtype | u（相对舍入） | 最大正常数 | 最小正常数 |
|---|---|---|---|
| fp32 | ≈6e-8 | 3.4e38 | 1.2e-38 |
| fp16 | ≈4.9e-4 | 65504 | 6.1e-5 |
| bf16 | ≈3.9e-3 | 3.4e38 | 1.2e-38 |

总的来说，由于`float16`范围小，容易发生溢出，如平方，`bf16`范围大，不容易溢出。但是`bf16`对累加和相消精度敏感，误差会很大。

**(c) 给 benchmark 脚本加 BF16 autocast 选项（用 nullcontext 作全精度对照），对 Table 1 所有尺寸测 forward+backward，对比并评论随模型尺寸变化的趋势。**


### A5  Memory Profiling

