## 强化学习

![RLHF 训练循环](./figures/RLHF训练循环.png)

### 策略梯度算法
>强化学习中策略梯度优化是指，通过优化策略函数的参数来寻求最优策略的一类方法。

我们先对优化目标$J(\theta)$做一个讨论。

自然地，定性为最大化给定状态分布以及当前策略$\pi_{\theta}$下状态价值的期望值。
由状态价值的定义$V_{\pi_{\theta}}(s)=\mathbb{E}_{\pi_{\theta}}(R(\tau)|s)$，这里的$R$是轨迹$\tau$的return
**随机性**，不难看出$J(\theta)=\mathbb{E}_sV_{\pi_{\theta}}(s)$有两层随机性，一是对状态s的随机，这个在实际中可以体现为从批次中采样$x_i$，二是对固定初始状态下的轨迹的随机，即固定$x_i$下生成不同回答$y_i$的可能性。

实际中，令$R(x_i,y_i)$为该轨迹下的return，具体的优化目标与批次和奖励的具体形式有关，比如可以对上述$R(x_i,y_i)$做批次平均。

>在将词元作为最小生成来作MDP推演时，一般将折扣因子设为1，因为我们关注的目标是生成整体。

#### 策略梯度的推导

令$p_{\theta}(\tau)$表示初始状态分布、策略以及环境共同诱导出的轨迹的概率分布（注意此处的$\tau$吸收了前述初始状态$s$的随机），从而有：
$$J(\theta)=\mathbb{E}_{\tau \sim p_{\theta}}[R(\tau)]$$

有$p_{\theta}(\tau)=d_0(s_0)\prod_{t=0}^{\infty}\pi_{\theta}(a_t|s_t)p(s_{t+1}|a_t,s_t)$

使用$\nabla f=f\nabla \text{log}f$的技巧，得到：

$$
\nabla_{\theta}J(\theta)=\mathbb{E}_{\tau \sim p_{\theta}}[R(\tau)\nabla_{\theta} \text{log}p_{\theta}(\tau)]
$$

简化中间过程，大致是$p$中只有$\pi$是含参的，化简之后得到：

$$
\nabla_{\theta}J(\theta)=\mathbb{E}_{\tau \sim p_{\theta}}[\Sigma_{t=0}^{\infty}R(\tau)\nabla_{\theta} \text{log}\pi_{\theta}(a_t|s_t)]
$$

，稍加推广得到:

$$
\nabla_{\theta}J(\theta)=\mathbb{E}_{\tau \sim p_{\theta}}[\Sigma_{t=0}^{\infty}\Psi_t\nabla_{\theta} \text{log}\pi_{\theta}(a_t|s_t)]
$$

其中，$\Psi_t$ 表示用于策略梯度估计的回报信号；有些奖励均采用折扣因子 $\gamma$。常见选择依次为：

1. **轨迹总回报**
   $$
   \Psi_t = R(\tau)=\sum_{t'=0}^{\infty}\gamma^{t'}r_{t'}.
   $$
   整条轨迹中的折扣奖励之和。

2. **从时刻 \(t\) 开始的回报**
   $$
   \Psi_t = G_t=\sum_{t'=t}^{\infty}\gamma^{t'-t}r_{t'}.
   $$
   表示执行动作 \(a_t\) 后、从当前时刻起获得的未来折扣回报。

3. **带基线的回报**
   $$
   \Psi_t = G_t-b(s_t).
   $$
   在回报中减去仅依赖状态的基线 \(b(s_t)\)，不会改变梯度估计的期望，但能降低方差。

4. **状态—动作价值**
   $$
   \Psi_t=Q^\pi(s_t,a_t).
   $$
   表示在状态 \(s_t\) 采取动作 \(a_t\) 后，后续回报的期望。

5. **优势函数**
   $$
   \Psi_t=A^\pi(s_t,a_t)=Q^\pi(s_t,a_t)-V^\pi(s_t).
   $$
   衡量动作 \(a_t\) 相对于该状态下策略平均表现的增益；若能准确估计，通常具有更低的梯度方差。

6. **时序差分（TD）残差**
   $$
   \Psi_t=\delta_t=r_t+\gamma V^\pi(s_{t+1})-V^\pi(s_t).
   $$
   它比较价值函数的当前预测与一步 bootstrap 目标，常用于近似优势函数。

其中，
$$
V^\pi(s_t)=\mathbb{E}_{a_t\sim\pi(\cdot\mid s_t)}[Q^\pi(s_t,a_t)]
$$
是状态价值，表示在 \(s_t\) 下遵循策略 \(\pi\) 的期望回报；而
$$
Q^\pi(s_t,a_t)=\mathbb{E}[r_t+\gamma V^\pi(s_{t+1})\mid s_t,a_t]
$$
是状态—动作价值。于是，优势函数可写为
$$
A^\pi(s_t,a_t)=r_t+\gamma V^\pi(s_{t+1})-V^\pi(s_t),
$$
即一步 TD 残差。*这是因为在确定性环境中，上式不再需要对状态转移取期望*。

#### 朴素策略梯度

一个关于时刻t的简单版本为：

$$
\nabla_{\theta}J(\theta)=\mathbb{E}_{\tau \sim p_{\theta}}[\Sigma_{t=0}^{T}G_t\nabla_{\theta} \text{log}\pi_{\theta}(a_t|s_t)]
$$

简单地用当前轨迹的生成token来进行计算，即$G_t=\Sigma_{k=t}^{T_i}\gamma^{k-1}r_{i,k}$。这里每个token的分数取决于怎么将RM的分数分配到每个分数上（比如中间token置0，只分配给最后的token）。

一个众所周知的问题，由于缺少基线，朴素策略梯度的方差极大，缓解的方式有优势函数（PPO），组平均值（GRPO）等。


#### REINFORCE

#####  核心思想

REINFORCE 是最基本的策略梯度方法之一，其核心思想是：

> **提高获得高于预期回报的动作的概率，降低获得低于预期回报的动作的概率。**

早期 REINFORCE 的参数更新可以概括为：

$$
\Delta \theta
=
\alpha (r-b)e
$$

其中：

- $\alpha$：学习率；
- $b$：基线（baseline），用于降低梯度估计的方差；
- $r-b$：奖励相对于基线的增量；
- $e$：资格迹（eligibility），表示奖励应归因于哪些参数。

#####  现代策略梯度形式

对于策略 $\pi_\theta(a_t\mid s_t)$，使用从时刻 $t$ 开始的回报 $G_t$，REINFORCE 的策略梯度为：

$$
\boxed{
\nabla_\theta J(\theta)
=
\mathbb E_{\tau\sim\pi_\theta}
\left[
\sum_{t=0}^{T}
\left(G_t-b(s_t)\right)
\nabla_\theta
\log\pi_\theta(a_t\mid s_t)
\right]
}
$$

其中：

- $G_t$：动作 $a_t$ 之后获得的累计回报；
- $b(s_t)$：状态相关的 baseline；
- $\nabla_\theta\log\pi_\theta(a_t\mid s_t)$：调整该动作概率的方向。

#####  使用优势函数表示

定义优势：

$$
A_t=G_t-b(s_t),
$$

则 REINFORCE 可以简写为：

$$
\boxed{
\nabla_\theta J(\theta)
=
\mathbb E_{\tau\sim\pi_\theta}
\left[
\sum_{t=0}^{T}
A_t
\nabla_\theta
\log\pi_\theta(a_t\mid s_t)
\right]
}
$$

因此：

$$
A_t>0
\quad\Rightarrow\quad
\text{提高 }a_t\text{ 的概率},
$$

$$
A_t<0
\quad\Rightarrow\quad
\text{降低 }a_t\text{ 的概率}.
$$

REINFORCE 的核心可以概括为：

$$
\boxed{
\text{优势 }A_t
\times
\text{对数策略梯度 }
\nabla_\theta\log\pi_\theta(a_t\mid s_t)
}
$$

即用优势决定动作应该被**鼓励还是抑制以及更新强度**，再通过对数策略梯度更新模型参数。




#### REINFORCE留一法（RLOO）

优势$A_t=G_t-b(s_t)$

留一法的前提是：对一个提示生成了多条轨迹。

显然，即利用其余轨迹的均值作为当前轨迹return的基线。

>优势通过整个生成的奖励来计算，具体分不分配到token上是单纯的处理。一般会将并入KL惩罚后得到的优势广播到每个token

值得注意的是，RLOO以及传统的策略梯度将KL惩罚加到奖励上，而GRPO则在损失层面施加KL惩罚。

#### PPO近端策略优化

![PPO 架构](./figures/PPO.png)

##### 价值网络




#### GRPO：Group Relative Policy Optimization

![](./figures/grpo_tikz.png)


GRPO（Group Relative Policy Optimization，组相对策略优化）的核心思想可以概括为：

> **对于同一个 prompt 一次采样多个回答，让这些回答在组内相互比较，用“相对于组内其他回答好多少”来构造优势，而不再像 PPO 那样额外训练一个 Critic / Value Model 来估计价值函数。**

对于一个提示 \(q\)，旧策略一次生成 \(G\) 个回答：

\[
\{o_1,o_2,\ldots,o_G\}\sim \pi_{\theta_{\mathrm{old}}}(\cdot|q)
\]

奖励模型或可验证奖励函数分别给这些回答打分。GRPO 使用组内奖励构造优势：**高于组内平均水平的回答得到正优势，低于平均水平的回答得到负优势**，然后使用类似 PPO 的 clipped objective 更新策略。

与 PPO 相比，最关键的变化是：

\[
\boxed{
\text{PPO：通过 Critic 估计 baseline}
\qquad\longrightarrow\qquad
\text{GRPO：通过同组其他回答构造 baseline}
}
\]

因此 GRPO 不需要单独训练一个与策略模型规模相近的价值模型。

##### GRPO 的目标函数

对于第 \(i\) 个回答的第 \(t\) 个 token，定义新旧策略的概率比：

\[
\rho_{i,t}(\theta)
=
\frac{
\pi_\theta(o_{i,t}\mid q,o_{i,<t})
}{
\pi_{\theta_{\mathrm{old}}}(o_{i,t}\mid q,o_{i,<t})
}.
\]

GRPO 的目标函数为：

\[
\boxed{
J_{\mathrm{GRPO}}(\theta)
=
\mathbb{E}
\left[
\frac{1}{G}
\sum_{i=1}^{G}
\frac{1}{|o_i|}
\sum_{t=1}^{|o_i|}
\left(
\min
\left(
\rho_{i,t}\hat A_{i,t},
\operatorname{clip}(\rho_{i,t},1-\epsilon,1+\epsilon)\hat A_{i,t}
\right)
-
\beta D_{\mathrm{KL}}
\left[
\pi_\theta\|\pi_{\mathrm{ref}}
\right]
\right)
\right].
}
\]

其中前半部分基本沿用了 PPO 的 clipping 机制：

\[
\min
\left(
\rho_{i,t}\hat A_{i,t},
\operatorname{clip}(\rho_{i,t},1-\epsilon,1+\epsilon)\hat A_{i,t}
\right),
\]

限制策略一次更新不能偏离旧策略太远；KL 项

\[
\beta D_{\mathrm{KL}}[\pi_\theta\|\pi_{\mathrm{ref}}]
\]

则约束当前策略不要过度偏离参考模型。

因此 GRPO 和 PPO 的一个核心区别并不在 clipping，而在于 **\(\hat A_{i,t}\) 如何得到**。

##### GRPO 的优势计算

最基本的 GRPO 优势来自**组内相对奖励**。

假设同一个 prompt 生成 \(G\) 个回答，其奖励为

\[
r_1,r_2,\ldots,r_G.
\]

首先计算组内均值和标准差：

\[
\mu
=
\frac{1}{G}\sum_{j=1}^{G}r_j,
\qquad
\sigma
=
\operatorname{std}(r_1,\ldots,r_G).
\]

然后将第 \(i\) 个回答的奖励标准化：

\[
\boxed{
\tilde r_i
=
\frac{r_i-\mu}{\sigma}
}
\]

它表达的就是：

\[
\text{第 }i\text{ 个回答相对于同一问题下其他回答好多少。}
\]

因此 GRPO 不需要学习 \(V(s)\)，而是直接利用同组回答作为相对比较基准。

##### 结果监督与过程监督

GRPO 可以使用两种不同粒度的奖励：**结果监督（Outcome Supervision）**和**过程监督（Process Supervision）**。两者的根本区别在于奖励落在什么位置。

**结果监督**只评价整个回答最终是否好，例如数学题只判断最终答案是否正确：

\[
\text{回答 }o_i
=
(x_{i,1},x_{i,2},\ldots,x_{i,T})
\longrightarrow r_i.
\]

因此一个回答只有一个最终奖励。将组内奖励标准化：

\[
\tilde r_i
=
\frac{
r_i-\operatorname{mean}(r_1,\ldots,r_G)
}{
\operatorname{std}(r_1,\ldots,r_G)
},
\]

然后把这个值直接赋给该回答的**所有 token**：

\[
\boxed{
\hat A_{i,t}=\tilde r_i,
\qquad
t=1,\ldots,|o_i|
}
\]

也就是说，同一个回答中的所有 token 共用相同的优势。例如：

\[
o_i:
\quad
x_1\rightarrow x_2\rightarrow x_3\rightarrow x_4
\]

若最终标准化奖励为 \(0.8\)，则

\[
(A_1,A_2,A_3,A_4)
=
(0.8,0.8,0.8,0.8).
\]

它的优点是简单，而且最终正确性通常容易验证；缺点是**无法判断一个长推理过程中究竟哪一步做得好、哪一步出现了错误**。

**过程监督**则进一步评价推理过程中的各个步骤。例如：

\[
\underbrace{x_1,x_2}_{\text{step 1}}
\rightarrow
\underbrace{x_3,x_4}_{\text{step 2}}
\rightarrow
\underbrace{x_5,x_6}_{\text{step 3}}.
\]

过程奖励模型分别在每一步结束时产生奖励：

\[
r_i^{\operatorname{index}(1)},
\quad
r_i^{\operatorname{index}(2)},
\quad
\ldots,
\quad
r_i^{\operatorname{index}(K_i)}.
\]

这些过程奖励同样先进行标准化：

\[
\tilde r_i^{\operatorname{index}(j)}
=
\frac{
r_i^{\operatorname{index}(j)}-\operatorname{mean}(R)
}{
\operatorname{std}(R)
}.
\]

对于回答 \(i\) 中的 token \(t\)，其优势定义为**从当前位置开始，后续所有步骤的标准化奖励之和**：

\[
\boxed{
\hat A_{i,t}
=
\sum_{\operatorname{index}(j)\ge t}
\tilde r_i^{\operatorname{index}(j)}
}
\]

因此不同位置的 token 可以具有不同的 advantage。例如三个步骤的标准化奖励为

\[
(\tilde r^1,\tilde r^2,\tilde r^3)
=
(0.2,-0.5,1.0),
\]

那么位于不同步骤中的 token 大致会获得：

\[
\begin{aligned}
\text{step 1中的 token}:&\quad
A=0.2-0.5+1.0=0.7,\\
\text{step 2中的 token}:&\quad
A=-0.5+1.0=0.5,\\
\text{step 3中的 token}:&\quad
A=1.0.
\end{aligned}
\]

所以两种监督方式最直观的区别就是：

\[
\boxed{
\begin{aligned}
\text{结果监督：}&\quad
\text{整个回答一个 reward}
\Rightarrow
\text{所有 token 共用一个 advantage},\\[2mm]
\text{过程监督：}&\quad
\text{每个推理步骤都有 reward}
\Rightarrow
\text{不同位置可以得到不同 advantage}.
\end{aligned}}
\]

过程监督的 credit assignment 更细，可以告诉模型“哪部分推理值得强化”；结果监督则只告诉模型“整个答案最终好不好”。

##### 与 RLOO 的关系

如果进一步去掉 GRPO 中的标准差归一化，就得到常见的 **Dr. GRPO** 形式：

\[
\tilde A_i
=
r_i-\frac{1}{G}\sum_{j=1}^{G}r_j.
\]

而 RLOO（REINFORCE Leave-One-Out）使用**除自己以外其他 \(G-1\) 个样本的平均奖励**作为 baseline：

\[
A_i^{\mathrm{RLOO}}
=
r_i-
\frac{1}{G-1}
\sum_{j\ne i}r_j.
\]

两者满足简单的缩放关系：

\[
\boxed{
A_i^{\mathrm{RLOO}}
=
\frac{G}{G-1}\tilde A_i
}
\]

因此在忽略这个常数缩放（实践中通常可被学习率等吸收）后，**Dr. GRPO 的优势估计与 RLOO 的 leave-one-out 优势估计本质上非常接近。**


#### 组序列策略优化（GSPO）

##### 动机

在 PPO、GRPO 等策略梯度方法中，训练样本通常由旧策略 $\pi_{\theta_{\mathrm{old}}}$ 生成，而我们希望优化当前策略 $\pi_\theta$。因此需要通过重要性采样修正两个策略之间的分布差异：

$$
\mathbb{E}_{p}[f(x)]
=
\mathbb{E}_{q}
\left[
f(x)\frac{p(x)}{q(x)}
\right].
$$

其中 $\frac{p(x)}{q(x)}$ 为重要性权重。在策略优化中：

$$
p=\pi_\theta,\qquad
q=\pi_{\theta_{\mathrm{old}}}.
$$

GRPO 在 **token 级别**计算重要性比率：

$$
r_{i,t}(\theta)
=
\frac{
\pi_\theta(a_{i,t}\mid s,a_{i,<t})
}{
\pi_{\theta_{\mathrm{old}}}(a_{i,t}\mid s,a_{i,<t})
}.
$$

然后分别对每个 token 的重要性比率进行裁剪。

但 GRPO 的奖励和优势通常是在**完整回答级别**计算的，即同一个回答 $a_i$ 中的 token 通常共享回答级优势 $A_i$。因此存在粒度上的不一致：

$$
\underbrace{A_i}_{\text{序列级优势}}
\qquad+\qquad
\underbrace{r_{i,t}}_{\text{token 级重要性比率}}.
$$

对于长序列、大模型或 MoE 模型，个别 token 的重要性比率还可能发生较大波动，使一次回答内部不同 token 的更新强度不一致。

GSPO（Group Sequence Policy Optimization）的核心思想就是将重要性采样从 **token 级提升到序列级**：

$$
\boxed{
\text{token-level importance ratio}
\quad\longrightarrow\quad
\text{sequence-level importance ratio}
}
$$

使重要性采样的粒度与回答级奖励、优势的粒度保持一致。

##### 序列概率

对于输入 $s$，设模型生成回答

$$
a_i=(a_{i,1},a_{i,2},\cdots,a_{i,|a_i|}).
$$

由于语言模型采用自回归生成，整个回答的概率可以分解为：

$$
\pi_\theta(a_i\mid s)
=
\prod_{t=1}^{|a_i|}
\pi_\theta(a_{i,t}\mid s,a_{i,<t}).
$$

因此，当前策略与旧策略之间的序列级重要性比率可以写为：

$$
\frac{
\pi_\theta(a_i\mid s)
}{
\pi_{\theta_{\mathrm{old}}}(a_i\mid s)
}
=
\prod_{t=1}^{|a_i|}
\frac{
\pi_\theta(a_{i,t}\mid s,a_{i,<t})
}{
\pi_{\theta_{\mathrm{old}}}(a_{i,t}\mid s,a_{i,<t})
}.
$$

直接使用这一乘积会使重要性比率强烈依赖序列长度：即使每个 token 的概率只发生很小变化，长序列累乘后也可能得到非常大或非常小的比率。

##### 长度归一化的序列级重要性比率

为消除序列长度带来的尺度问题，GSPO 对完整序列的重要性比率进行长度归一化：

$$
\boxed{
\rho_i(\theta)
=
\left(
\frac{
\pi_\theta(a_i\mid s)
}{
\pi_{\theta_{\mathrm{old}}}(a_i\mid s)
}
\right)^{\frac{1}{|a_i|}}
}
$$

将自回归概率分解代入：

$$
\rho_i(\theta)
=
\left[
\prod_{t=1}^{|a_i|}
\frac{
\pi_\theta(a_{i,t}\mid s,a_{i,<t})
}{
\pi_{\theta_{\mathrm{old}}}(a_{i,t}\mid s,a_{i,<t})
}
\right]^{\frac{1}{|a_i|}}.
$$

为了避免长序列概率连乘导致的数值不稳定，实际计算通常转换到对数空间：

$$
\boxed{
\rho_i(\theta)
=
\exp
\left(
\frac{1}{|a_i|}
\sum_{t=1}^{|a_i|}
\log
\frac{
\pi_\theta(a_{i,t}\mid s,a_{i,<t})
}{
\pi_{\theta_{\mathrm{old}}}(a_{i,t}\mid s,a_{i,<t})
}
\right)
}
$$

因此，$\rho_i(\theta)$ 本质上是一个回答中所有 **token 重要性比率的几何平均值**。

经过长度归一化后，不同长度回答的重要性比率具有更加可比的尺度，同时一个回答中的所有 token 共享同一个序列级重要性权重 $\rho_i$。

##### GSPO 的优势计算

GSPO 的优势计算与 GRPO 基本相同。对于同一个输入 $s$，从旧策略中采样 $G$ 个回答：

$$
a_1,a_2,\cdots,a_G
\sim
\pi_{\theta_{\mathrm{old}}}(\cdot\mid s),
$$

并获得对应奖励：

$$
R_1,R_2,\cdots,R_G.
$$

通过组内奖励的均值和标准差进行标准化，可以得到：

$$
\boxed{
A_i
=
\frac{
R_i-\operatorname{mean}(R_1,\cdots,R_G)
}{
\operatorname{std}(R_1,\cdots,R_G)+\delta
}
}
$$

其中 $A_i$ 是整个回答 $a_i$ 的序列级优势：

- $A_i>0$：该回答优于组内平均水平，应提高其生成概率；
- $A_i<0$：该回答劣于组内平均水平，应降低其生成概率。

因此 GSPO 中，重要性比率和优势都处于序列级：

$$
\boxed{
a_i
\quad\longrightarrow\quad
\left(\rho_i(\theta),A_i\right)
}
$$

##### GSPO 的优化目标

GSPO 保留了与 GRPO 类似的 PPO-style clipped objective，但将 token 级重要性比率替换为序列级重要性比率(此处省略KL散度)：

$$
\boxed{
J_{\mathrm{GSPO}}(\theta)
=
\mathbb E
\left[
\frac{1}{G}
\sum_{i=1}^{G}
\min
\left(
\rho_i(\theta)A_i,\,
\operatorname{clip}
\left(
\rho_i(\theta),
1-\epsilon,
1+\epsilon
\right)A_i
\right)
\right]
}
$$

其中：

$$
\rho_i(\theta)
=
\exp
\left(
\frac{1}{|a_i|}
\sum_{t=1}^{|a_i|}
\log
\frac{
\pi_\theta(a_{i,t}\mid s,a_{i,<t})
}{
\pi_{\theta_{\mathrm{old}}}(a_{i,t}\mid s,a_{i,<t})
}
\right).
$$

与 GRPO 最核心的区别可以概括为：

$$
\boxed{
r_{i,t}(\theta)
\quad\longrightarrow\quad
\rho_i(\theta)
}
$$

即 GRPO 对每个 token 分别计算和裁剪重要性比率，而 GSPO 首先将整个回答的策略变化聚合为一个长度归一化的序列级比率，再对整个回答统一进行重要性采样校正和裁剪。

因此，GSPO 可以概括为：

$$
\boxed{
\text{GSPO}
=
\text{使用序列级重要性比率的 GRPO}
}
$$

其核心目的在于使

$$
\underbrace{\text{序列级奖励与优势}}_{A_i}
\qquad\text{与}\qquad
\underbrace{\text{序列级重要性采样}}_{\rho_i}
$$

处于相同的优化粒度，从而提高长序列以及大规模模型训练时策略更新的稳定性。


#### 裁剪重要性采样策略优化（CISPO）

#####  动机

PPO / GRPO 的做法是对**代理目标函数进行裁剪**：

$$
\min
\left(
\rho_{i,t}A_{i,t},
\operatorname{clip}(\rho_{i,t},1-\epsilon,1+\epsilon)A_{i,t}
\right).
$$

这种方式在重要性比率超出裁剪范围后，可能使对应 token 的梯度直接变为 0，即出现“丢弃 token 梯度”的现象。

CISPO（Clipped Importance Sampling Policy Optimization）的核心思想是：

$$
\boxed{
\text{不裁剪目标函数，而只裁剪重要性采样权重}
}
$$

这样即使某个 token 的重要性比率过大或过小，它仍然可以产生策略梯度，只是其梯度的权重受到限制。

#####  裁剪重要性采样权重

首先计算 token 级重要性比率：

$$
\rho_{i,t}(\theta)
=
\frac{
\pi_\theta(a_{i,t}\mid s,a_{i,<t})
}{
\pi_{\theta_{\mathrm{old}}}(a_{i,t}\mid s,a_{i,<t})
}.
$$

然后直接对重要性比率进行裁剪：

$$
\boxed{
\hat{\rho}_{i,t}(\theta)
=
\operatorname{clip}
\left(
\rho_{i,t}(\theta),
1-\epsilon_{\mathrm{low}},
1+\epsilon_{\mathrm{high}}
\right)
}
$$

其中可以使用非对称裁剪：

$$
\epsilon_{\mathrm{low}}
\neq
\epsilon_{\mathrm{high}}.
$$

例如增大 $\epsilon_{\mathrm{high}}$，可以允许模型对希望提高概率的 token 进行更大幅度的更新。

##### 停止梯度

CISPO 对裁剪后的重要性权重使用停止梯度：

$$
\operatorname{sg}
\left(
\hat{\rho}_{i,t}(\theta)
\right).
$$

$\operatorname{sg}(\cdot)$ 表示该值参与前向计算，但反向传播时：

$$
\frac{\partial\,\operatorname{sg}(\hat{\rho})}
{\partial\theta}
=0.
$$

因此 $\hat{\rho}_{i,t}$ 只作为**梯度的权重**，真正产生梯度的是：

$$
\log\pi_\theta(a_{i,t}\mid s,a_{i,<t}).
$$

#####  CISPO 目标函数

CISPO 采用类似 REINFORCE 的目标：

$$
\boxed{
J_{\mathrm{CISPO}}(\theta)
=
\mathbb E
\left[
\frac{1}{\sum_{j=1}^{K}|a_j|}
\sum_{i=1}^{K}
\sum_{t=1}^{|a_i|}
\operatorname{sg}
\left(
\hat{\rho}_{i,t}(\theta)
\right)
A_{i,t}
\log
\pi_\theta(a_{i,t}\mid s,a_{i,<t})
\right]
}
$$

因此单个 token 对参数产生的梯度近似为：

$$
\nabla_\theta J
\propto
\hat{\rho}_{i,t}
A_{i,t}
\nabla_\theta
\log\pi_\theta(a_{i,t}\mid s,a_{i,<t}).
$$

这里 $\hat{\rho}_{i,t}$ 控制**梯度大小**，$A_{i,t}$ 控制**更新方向及强度**。

#####  与 PPO / GRPO 的核心区别

PPO / GRPO：

$$
\boxed{
\text{裁剪代理目标}
}
$$

当重要性比率超出一定范围时，部分 token 可能进入目标函数的平坦区域，从而不再提供策略梯度。

CISPO：

$$
\boxed{
\text{裁剪重要性权重，但保留策略梯度}
}
$$

即：

$$
\rho_{i,t}
\rightarrow
\hat{\rho}_{i,t}
\rightarrow
\operatorname{sg}(\hat{\rho}_{i,t})
A_{i,t}
\nabla_\theta\log\pi_\theta.
$$

因此 CISPO 的核心可以概括为：

$$
\boxed{
\text{保留所有 token 的梯度}
+
\text{通过裁剪重要性权重限制梯度幅度}
}
$$

这种方法允许重要性采样裁剪引入一定偏差，以换取更低的梯度方差和更稳定的训练。






### 辅助方法

#### 广义优势估计GAE

##### 1. \(k\) 步优势估计

一步优势：

$$
\hat A_t^{(1)}
=
r_t+\gamma V(s_{t+1})-V(s_t)
$$

两步优势：

$$
\hat A_t^{(2)}
=
r_t+\gamma r_{t+1}+\gamma^2V(s_{t+2})-V(s_t)
$$

一般的 \(k\) 步优势：

$$
\boxed{
\hat A_t^{(k)}
=
\sum_{i=0}^{k-1}\gamma^i r_{t+i}
+
\gamma^kV(s_{t+k})
-
V(s_t)
}
$$

其中 \(k\) 越大，使用的真实奖励越多、对价值函数 \(V\) 的 bootstrap 依赖越少；通常偏差降低，但方差增大。

##### 2. 用 TD 误差表示 \(k\) 步优势

定义一步 TD 误差：

$$
\boxed{
\delta_t
=
r_t+\gamma V(s_{t+1})-V(s_t)
}
$$

例如两步：

$$
\begin{aligned}
\delta_t+\gamma\delta_{t+1}
&=
r_t+\gamma V(s_{t+1})-V(s_t)\\
&\quad+\gamma
\left[
r_{t+1}+\gamma V(s_{t+2})-V(s_{t+1})
\right]\\
&=
r_t+\gamma r_{t+1}
+\gamma^2V(s_{t+2})-V(s_t)\\
&=
\hat A_t^{(2)}
\end{aligned}
$$

中间的 \(V(s_{t+1})\) 恰好抵消。因此一般有：

$$
\boxed{
\hat A_t^{(k)}
=
\sum_{i=0}^{k-1}\gamma^i\delta_{t+i}
}
$$

##### 3. GAE 的第一种表示：不同 \(k\) 步优势的加权平均

GAE 不选择固定的 \(k\)，而是将不同长度的优势估计进行指数加权：

$$
\boxed{
\hat A_t^{GAE(\gamma,\lambda)}
=
(1-\lambda)
\left(
\hat A_t^{(1)}
+\lambda\hat A_t^{(2)}
+\lambda^2\hat A_t^{(3)}
+\cdots
\right)
}
$$

即：

$$
\hat A_t^{GAE}
=
(1-\lambda)
\sum_{k=1}^{\infty}
\lambda^{k-1}\hat A_t^{(k)}
$$

##### 4. GAE 的第二种表示：TD 误差的加权和

将

$$
\hat A_t^{(k)}
=
\sum_{i=0}^{k-1}\gamma^i\delta_{t+i}
$$

代入上式并整理，可以得到：

$$
\boxed{
\hat A_t^{GAE(\gamma,\lambda)}
=
\sum_{i=0}^{\infty}
(\gamma\lambda)^i\delta_{t+i}
}
$$

也就是：

$$
\boxed{
\hat A_t^{GAE}
=
\delta_t
+
\gamma\lambda\delta_{t+1}
+
(\gamma\lambda)^2\delta_{t+2}
+\cdots
}
$$

因此实际计算时还能写成反向递推：

$$
\boxed{
\hat A_t^{GAE}
=
\delta_t
+
\gamma\lambda
\hat A_{t+1}^{GAE}
}
$$

##### 5. 两个折扣参数的含义

- **\(\gamma\)：奖励折扣因子**。控制未来奖励本身的重要程度：

$$
r_t+\gamma r_{t+1}+\gamma^2r_{t+2}+\cdots
$$

\(\gamma\) 越大，越重视长期奖励；越小，越重视近期奖励。

- **\(\lambda\)：GAE 衰减参数**。控制 Advantage 估计时使用多远的 TD 信息，也控制偏差—方差折中：

$$
\lambda=0
\quad\Longrightarrow\quad
\hat A_t^{GAE}=\delta_t
$$

即退化为一步 TD，通常**低方差、高偏差**；而

$$
\lambda\rightarrow1
$$

时会纳入更多远期 TD 误差，更接近长步数/Monte Carlo 的优势估计，通常**低偏差、高方差**。

所以可以简单记成：

$$
\boxed{
\gamma:\ \text{未来奖励看多远}
\qquad
\lambda:\ \text{优势估计看多远}
}
$$


##### 6. GAE 的 Batch 并行计算示例

实际 PPO / RLHF 中通常不会只计算一条轨迹，而是把多条轨迹组成 Batch 并行计算。假设 `Batch Size = 2`，两条轨迹的有效长度分别为 3 和 2：

$$
\begin{aligned}
\text{轨迹 1: }&
s_0^{(1)}
\xrightarrow{r_0=1}
s_1^{(1)}
\xrightarrow{r_1=2}
s_2^{(1)}
\xrightarrow{r_2=3}
\text{终止}
\\
\text{轨迹 2: }&
s_0^{(2)}
\xrightarrow{r_0=2}
s_1^{(2)}
\xrightarrow{r_1=1}
\text{终止}
\rightarrow \text{PAD}
\end{aligned}
$$

为了组成相同长度的 Tensor，需要将第二条轨迹 padding 到长度 3：

$$
R=
\begin{bmatrix}
1 & 2 & 3\\
2 & 1 & 0
\end{bmatrix},
\qquad
V=
\begin{bmatrix}
3 & 4 & 2\\
2 & 2 & 0
\end{bmatrix}
$$

定义 `valid_mask` 表示当前位置是否为有效 token：

$$
M=
\begin{bmatrix}
1&1&1\\
1&1&0
\end{bmatrix}
$$

因此数据形状都是：

$$
(B,L)=(2,3)
$$

这里最重要的是：**Batch 维度可以完全并行，但时间维度仍然需要从后向前递推。**

GAE 的递推公式为：

$$
\hat A_t
=
\delta_t+\gamma\lambda\hat A_{t+1}
$$

对于 Batch 中的两条轨迹，可以同时计算：

$$
\begin{bmatrix}
\hat A_t^{(1)}\\
\hat A_t^{(2)}
\end{bmatrix}
=
\begin{bmatrix}
\delta_t^{(1)}\\
\delta_t^{(2)}
\end{bmatrix}
+
\gamma\lambda
\begin{bmatrix}
\hat A_{t+1}^{(1)}\\
\hat A_{t+1}^{(2)}
\end{bmatrix}
$$

也就是说，每次循环处理的不是一个标量，而是一个长度为 `B=2` 的向量。

对应代码：

```python
import torch

# shape = (B=2, L=3)
rewards = torch.tensor([
    [1.0, 2.0, 3.0],
    [2.0, 1.0, 0.0],   # 最后一个位置是 padding
])

values = torch.tensor([
    [3.0, 4.0, 2.0],
    [2.0, 2.0, 0.0],
])

# 1 = 有效位置，0 = padding
valid_mask = torch.tensor([
    [1.0, 1.0, 1.0],
    [1.0, 1.0, 0.0],
])

gamma = 0.9
lam = 0.95

B, L = rewards.shape

advantages = torch.zeros_like(rewards)

# shape = (B,)
next_v = torch.zeros(B)
gae = torch.zeros(B)

for t in reversed(range(L)):

    valid = valid_mask[:, t]

    # 当前时间步之后是否还能继续传播
    if t == L - 1:
        next_valid = torch.zeros(B)
    else:
        next_valid = valid_mask[:, t + 1]

    # 下面所有运算都是 B 条轨迹并行进行
    delta = (
        rewards[:, t]
        + gamma * next_valid * next_v
        - values[:, t]
    )

    gae = (
        delta
        + gamma * lam * next_valid * gae
    )

    # padding 位置直接清零
    gae = gae * valid

    advantages[:, t] = gae

    next_v = values[:, t]

print(advantages)
```

核心在于：

```python
rewards[:, t]
values[:, t]
gae
```

它们都不是标量，而是：

$$
\text{shape}=(B,)
$$

例如在 $t=1$ 时：

```python
rewards[:, 1]
```

得到：

$$
\begin{bmatrix}
2\\
1
\end{bmatrix}
$$

因此 GPU 会同时计算两条轨迹的：

$$
\delta_1^{(1)},\qquad \delta_1^{(2)}
$$

而不是先完整计算轨迹 1，再计算轨迹 2。

整个计算结构可以理解为：

```text
             Batch 维：并行
          ↓                 ↓
       轨迹 1             轨迹 2

t=2    [计算]              [PAD]      ← 同时计算
         ↑                   ↑
t=1    [计算]              [计算]      ← 同时计算
         ↑                   ↑
t=0    [计算]              [计算]      ← 同时计算

        时间维：反向递推
```

所以 GAE 的并行设计实际上是：

$$
\boxed{
\text{时间维 }L\text{：必须反向循环}
\qquad
\text{Batch 维 }B\text{：完全向量化并行}
}
$$

`mask` 则负责阻止 GAE 穿过轨迹终点或 padding 继续传播。例如第二条轨迹的最后一个位置是 PAD，因此该位置不会产生 advantage，也不会把信息传播回有效轨迹。
