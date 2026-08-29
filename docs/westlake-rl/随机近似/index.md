## 均值估计——动机

有增量式更新如下：

$$
w_{k+1} = w_k - \frac{1}{k}(w_k - x_k)
$$

更一般的，

$$
w_{k+1} = w_k - \alpha_k(w_k - x_k)
$$

可以称 $w_k - x_k$ 为新息（*innovation*），顾名思义，新的数据带来的新的信息。

$\alpha_k$ 为步长，代表新信息对估计产出多大程度影响。

## Robbins-Monro 算法

> Robbins-Monro (RM) 算法是随机近似领域的开创性工作。著名的随机梯度下降算法是 RM 算法的一种特殊形式。

下面我们介绍 RM 算法的细节。

> 从来源而论：
>
> 假设我们需要求解方程：
>
> $$ g(w) = 0 $$
>
> 其中 $w \in \mathbb{R}$ 是未知变量，$g: \mathbb{R} \to \mathbb{R}$ 是一个函数。
>
> 我们面临的问题是：函数 $g$ 的表达式是未知的。我们只能获得 $g(w)$ 的带噪观测值：
>
> $$ \tilde{g}(w, \eta) = g(w) + \eta $$
>
> 其中 $\eta \in \mathbb{R}$ 是观测误差（不一定服从高斯分布）。简而言之，这是一个黑箱系统，只有输入 $w$ 和带噪输出 $\tilde{g}(w, \eta)$ 是已知的。我们的目标是用 $w$ 和 $\tilde{g}$ 求解 $g(w) = 0$。
>
> 直观地考虑，用传统高斯不动点迭代去求解方程 $\tilde{g}(w_k, \eta_k)=0$，即
>
> $$ w_{k+1} = w_k - a\cdot \tilde{g}(w_k, \eta_k), \quad k = 1, 2, 3, \dots $$
>
> 在常数项下噪声会不断累积，从而偏离最终解。
>
> 于是，我们想用一个**"合适的"**的步长来抵消噪声的偏差。

给出求解 $g(w) = 0$ 的 **RM 算法**形式为：

$$
w_{k+1} = w_k - a_k \tilde{g}(w_k, \eta_k), \quad k = 1, 2, 3, \dots \tag{*}
$$

其中 $w_k$ 是对根的第 $k$ 次估计，$\tilde{g}(w_k, \eta_k)$ 是第 $k$ 次带噪观测，$a_k$ 是正系数步长。可以看出，RM 算法不需要函数的任何信息，只需要输入和输出。

### 收敛性

在 RM 算法 (*) 中，若以下条件成立：

1. $0 < c_1 \leq \nabla_w g(w) \leq c_2$ 对所有 $w$ 成立；

2. $\sum_{k=1}^\infty a_k = \infty$ 且 $\sum_{k=1}^\infty a_k^2 < \infty$；

3. $\mathbb{E}[\eta_k \mid \mathcal{H}_k] = 0$ 且 $\mathbb{E}[\eta_k^2 \mid \mathcal{H}_k] < \infty$；

其中 $\mathcal{H}_k = \{w_k, w_{k-1}, \dots\}$，则 $w_k$ 几乎必然收敛到满足 $g(w^*) = 0$ 的根 $w^*$。

> Condition 1 对待估函数的梯度做了限制，要求函数单增且梯度有限（立刻可扩展为对原函数凹凸性的条件）
>
> Condition 2 给出步长的合适条件
>
> Condition 3 对观测误差的随机性做了一定的界定
