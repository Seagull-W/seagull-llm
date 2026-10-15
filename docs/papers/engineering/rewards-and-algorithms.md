---
title: 奖励、优势与策略更新
description: 区分原始奖励、优势估计与策略更新，核对算法和实现边界。
tags: ["论文与项目随谈","后训练","GRPO","奖励建模"]
---

# 奖励、优势与策略更新

> 资料快照：本组后训练项目资料整理截至 2026-10-11；文中的运行状态、访问结果和未核验项均以该次归档为准。

## 1. 先确定训练路线

| 路线 | 学习信号 | 工程上需要的额外对象 | 本资料的实际入口 |
|---|---|---|---|
| SFT | 示范 token 的监督学习 | 数据格式、renderer、role/message mask | MiMo 9B 起点；prime-rl SFT 文档 |
| 偏好训练 | 两个或多个回答的相对偏好 | 偏好数据与选择协议 | 按项目检查是否采用；未核验时保留阶段缺口 |
| RLVR / agent RL | 测试、规则或 judge 给出的成果反馈 | 环境、grader、group、采样器、策略版本 | MiMo、DeepSWE、INTELLECT-3 |
| OPD / MOPD | 教师对学生生成行为的指导 | 教师 endpoint、评分与 token 对齐、蒸馏 loss | MiMo 上线后的行为修复 |

这不是固定线性顺序。选择哪条路线应由目标行为和反馈可用性决定，不能因为配方里常出现 SFT→RL 就替没有公开的阶段补写数据规模。

## 2. SFT 的基本验收

prime-rl 当前文档接受 prompt-completion 和 messages 两种输入；前者屏蔽 prompt，后者按 assistant 角色训练，并可用 `message_loss_mask` 选择训练轮次。它把模板渲染与 mask 归属放在 renderer 内统一处理。[SFT 文档](https://github.com/PrimeIntellect-ai/prime-rl/blob/main/docs/training.md#sft-trainer)

整理建议：抽取真实工具轨迹做人工检查，逐 token 看哪些位置计算 loss。确认历史 thinking 被模板删除或保留时，mask 仍对应正确 token；确认工具观察是否应训练。不能简单按字符串长度拼接 mask。

## 3. 成功、模型失败、基础设施失败

| 状态 | 例子 | 建议保留字段 | 后处理应复核什么 |
|---|---|---|---|
| 有效成功 | 成果通过测试 | 测试版本、原始分数、产物 | 是否真的完成题目而非利用 grader 漏洞 |
| 有效失败 | 代码可执行但测试未通过 | 失败测试与模型动作 | 是否应给 0、部分分数或行为惩罚 |
| 不可评分 | Pod 创建失败、评分服务断连 | error category、异常栈、服务状态 | 是否剔除/重试，是否改变 group 分母 |
| 截断 | 超 token/时间/轮次预算 | 截断原因、可用上下文 | 按当前任务协议是有效失败还是 infra 状态 |

上表是工程建议，不代表所有项目采用同一错误语义。General 开源 AgentLoop 在开启 `invalid_reward_for_infra` 时，对特定 infra category 返回 `-999` sentinel，用于区分不可用反馈；这个值应沿数据处理链核验，不能当成普通的“极差奖励”直接解释。[General 错误分类代码](https://github.com/XiaomiMiMo/verl/blob/a2ad9f6160b03ff2d47e59832bfb6b289f37c917/recipes/general/agent_loop.py)

verl 的 reward 接口按 data_source 路由不同评分逻辑；自定义评分要检查返回值与 token/sequence 聚合边界。[verl reward 接口](https://github.com/verl-project/verl/blob/main/docs/preparation/reward_function.rst)

## 4. 从 reward 到 advantage

GRPO 的直观作用是比较同一道题的多次尝试，成功的尝试获得相对正反馈，较差的尝试获得相对负反馈。一个简化教学表达为：

\[
A_i=R_i-\frac{1}{n}\sum_j R_j
\]

这是不做标准差归一化的示意，不能替代实际代码：长度惩罚、token mask、跨轮 credit、infra 剔除和 group 过滤均可能改变最终优势。MiMo Code 开源启动器采用 GRPO，`norm_adv_by_std_in_grpo=False`，并使用 `prompt-mean` loss 聚合和 group filtering。[Code 启动配置](https://github.com/XiaomiMiMo/verl/blob/a2ad9f6160b03ff2d47e59832bfb6b289f37c917/scripts/code/train.sh)

同组全成功或全失败，在上述简化形式下没有相对学习信号。是否过滤、补采或保留必须由算法定义决定。过滤会改变任务分布；若难题更容易全失败，就应检查难题是否被系统性丢弃。

## 5. Loss 聚合是一项算法选择

| 聚合视角 | 关注的问题 | 必须检查的风险 |
|---|---|---|
| token 平均 | 每个有 loss 的 token 权重 | 长轨迹会占更大总权重 |
| sequence 平均 | 每次尝试等权或按序列归一化 | prompt 下尝试数不等时是否失衡 |
| prompt/group 平均 | 每道题的影响 | infra 剔除后 group 大小是否变化 |

这张表是用于理解和核验的分类；具体 `prompt-mean` 如何归一化应查实现，不应从名字推导所有 mask 处理细节。公开生产看板的 `critic/*` 名称也不证明有一个学习中的 value critic：它首先只是记录奖励、优势等统计的命名空间。

## 6. 行为概率与 importance ratio

对异步多轮训练，需保存产生动作时的实际概率。最基本的比值为：

\[
r_t=\exp(\log\pi_{\mathrm{train}}(a_t\mid c_t)-\log\pi_{\mathrm{behavior}}(a_t\mid c_t))
\]

这是解释数据依赖的表达，不规定 clipping、TIS 或 loss 的完整形式。`c_t` 必须是生成该动作时的真实 token 上下文，不能换成重渲染后字符串近似的上下文。跨权重更新的 partial rollout 还要考虑 token/turn 所属版本。[prime-rl 算法文档](https://github.com/PrimeIntellect-ai/prime-rl/blob/main/docs/algorithms.md)

MiMo Code 开源训练脚本中的 clip 参数、loss 选项和 off-policy 规则是该复现工程配置；Pro/Flash archive 另有 `actor/clip_*` 和 TIS 指标，应从公开运行本身读取，不能把 9B 默认值直接套在生产模型上。[Code run_train.sh](https://github.com/XiaomiMiMo/verl/blob/a2ad9f6160b03ff2d47e59832bfb6b289f37c917/recipes/code/run_train.sh)

## 7. 行为惩罚与 credit assignment

建议分别记录原始任务分数、每种行为惩罚、最终训练 reward、惩罚前后 advantage 与受影响 token mask。否则“reward 降了”可能来自新惩罚，而不是能力下降。

小米公开指标包含 action/signed penalty 与 stage credit group 统计，能够定位相关数值变化；公开 JSON 没有定义所有内部字段，因此本整理为这些字段提供索引，不补写未知算法。具体重复调用修复见 [案例第 6 节](/papers/projects/mimo-v2-6/)。

Code 开源默认启用重复检测，但 `zero_reward` 与 repetition penalty 默认关闭。**有检测指标不等于已经惩罚。** 参数还可能被环境变量/CLI 覆盖，真正运行应核验 resolved config。[Code 启动器](https://github.com/XiaomiMiMo/verl/blob/a2ad9f6160b03ff2d47e59832bfb6b289f37c917/scripts/code/train.sh)

继续阅读：[异步与一致性](/papers/engineering/async-and-consistency)、[训练损失分析](/papers/projects/mimo-v2-6/loss-and-metrics)。
