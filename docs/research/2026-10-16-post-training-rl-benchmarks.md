---
title: "2026-10-16 后训练与 agentic RL 的 benchmark：准则、保证与数据形式"
description: "用一条真实记录讲清数学、代码、仓库修复、工具对话和网页任务各自的输入、交付和判分，并说明训练奖励与独立评测如何分开，以及可验证奖励理论保证的适用条件。"
tags: ["每日调研", "后训练", "强化学习", "评测"]
date: "2026-10-16"
---

# 2026-10-16 后训练与 agentic RL 的 benchmark：准则、保证与数据形式

::: info 本期要点

- **先看模型要完成什么。** 算出数值、补完函数、修好仓库、处理用户请求、操作网页，是不同的任务；它们需要不同的输入和验收方式。 [S1](#source-s1) [S4](#source-s4) [S5](#source-s5) [S8](#source-s8) [S9](#source-s9)
- **奖励与独立评测要分开。** 训练中反复使用的答案或测试可以提供反馈；保留测试题一旦用于选模型或调 agent，也已参与开发决策。 [S2](#source-s2) [S10](#source-s10)
- **可执行的评分仍有边界。** 末答案、单测和数据库终态各自只验收一部分行为；后文集中讨论误判、污染和理论结论的适用条件。 [S2](#source-s2) [S7](#source-s7) [S8](#source-s8) [S14](#source-s14)
:::

> 调研基准日：2026-10-16（Asia/Shanghai）。本文依据已读论文、官方说明、源码和真实记录，介绍各基准的任务与评分。没有运行模型或 benchmark；具体阅读范围列在文末。

## 从一条真实任务看各个 benchmark

### GSM8K：读懂应用题，算出最后的数值

GSM8K 让模型解多步小学数学应用题。题目由人工编写，通常需要 2–8 步基本算术。下面这道长袍题问：蓝布用两卷，白布用蓝布的一半，一共需要几卷？这是标准 `test.jsonl` 的第二条，完整保留了题目和参考解答；原文件每行存一个 JSON 对象，这里仅为阅读展开排版。 [S1](#source-s1)

```json
{
  "question": "A robe takes 2 bolts of blue fiber and half that much white fiber.  How many bolts in total does it take?",
  "answer": "It takes 2/2=<<2/2=1>>1 bolt of white fiber\nSo the total amount of fabric is 2+1=<<2+1=3>>3 bolts of fabric\n#### 3"
}
```

模型收到的是 `question`，应生成解答，并把最终数值放在 `####` 后；`answer` 是参考标签，不随测试题交给模型。这条记录先算出白布一卷，再得到总计三卷，末行是 `#### 3`。原仓库的示例评分器提取生成文本中首个符合格式的数值字符串，去掉逗号，再与参考答案提取出的 `3` 比较；未提取到答案则记为无效。它给末答案判分，不逐步检查推导，也不做代数等价判断。 [S1](#source-s1)

官方分别提供标准 `train.jsonl` 与 `test.jsonl`；本文采用这一形式，未使用 Socratic 变体。若训练时用答案给奖励，应从训练题取标签，并把是否允许计算器写进实验协议。 [S1](#source-s1)

### MATH-500：从数学题生成表达式答案

MATH-500 让模型解较高难度的数学题，答案可以是表达式，而不只是一个数。Hugging Face H4 发布的这份文件包含 OpenAI 在 Let's Verify Step by Step 中从 MATH 选出的 500 道评测题。下面是一道展开并化简多项式的真实记录，保留完整题目、参考推导和答案，省去学科、难度与题目标识。原始载体是 `test.jsonl`，公式源码在代码块中原样保留。 [S2](#source-s2)

```json
{
  "problem": "Expand and simplify completely: \\begin{align*}\nx\\left(x(1+x)+2x\\right)-3(x^2-x+2)\n\\end{align*}",
  "solution": "Begin by distributing in the innermost parentheses: \\begin{align*}\n&\\ \\ \\ \\ x\\left(x(1+x)+2x\\right)-3(x^2-x+2) \\\\&= x(x+x^2+2x) - 3(x^2-x+2)\n\\end{align*} Now, distribute again: \\begin{align*}\nx^2+x^3+2x^2-3x^2+3x-6\n\\end{align*} Finally, combine like terms to get \\begin{align*}\n\\boxed{x^3+3x-6}\n\\end{align*}",
  "answer": "x^3+3x-6"
}
```

模型只接收 `problem`，应交出完全化简的表达式；这条题目的目标是 `x^3+3x-6`。`solution` 展示参考推导，`answer` 是用于末答案比较的标签，二者都不是测试输入。PRM800K 的评分说明推荐 `grader.grade_answer(model_answer, gt_answer)`：先规范化数学答案，再用 sympy 检查表达式是否相等。因此判分关注表达式的数学意义，不要求生成文字逐字等于参考推导。作者同时承认该逻辑可能误拒正确答案，也可能接受错误答案；本次阅读的是这一说明，未审计完整评分实现。 [S2](#source-s2)

使用时尤其要认清切分：PRM800K 在原 MATH 的 7,500 道训练题之外，加入原测试集的 4,500 道题，只在随机保留的 500 道题上评测。采用这套训练配方后，原 MATH 全部测试题就不能再整体视为独立测试集。 [S2](#source-s2)

### AIME 2024：解竞赛题，交出整数结果

这里的 AIME 2024 专指 Math-AI 整理的 `math-ai/aime24` 测试文件，共 30 条竞赛数学题。下面是本地留存的首条真实记录：Aya 每天步行九公里并停留咖啡店，题目给出两种速度下的总用时，要求算出另一种速度下的总分钟数。原始数据载体是 Parquet，下面将题目与参考结果按 JSON 展示；省去记录编号和题目来源网址，未改写字段值。 [S3](#source-s3)

```json
{
  "problem": "Every morning Aya goes for a $9$-kilometer-long walk and stops at a coffee shop afterwards. When she walks at a constant speed of $s$ kilometers per hour, the walk takes her 4 hours, including $t$ minutes spent in the coffee shop. When she walks $s+2$ kilometers per hour, the walk takes her 2 hours and 24 minutes, including $t$ minutes spent in the coffee shop. Suppose Aya walks at $s+\\frac{1}{2}$ kilometers per hour. Find the number of minutes the walk takes her, including the $t$ minutes spent in the coffee shop.",
  "solution": "\\boxed{204}"
}
```

模型收到完整的 `problem`，应解出包含咖啡店停留时间在内的总时长；本条参考结果是 204 分钟。这里的 `solution` 实际只存 `\boxed{204}`，没有逐步解答，也没有名为 `answer` 的字段。它是评分目标，不是模型输入。这份文件未附统一评测器：从生成文本中怎样抽取整数、每题采样多少次，必须由实际评测协议说明。 [S3](#source-s3)

例如 DAPO 在 AIME 2024 上重复采样 32 次，报告 `avg@32`，使用温度 1.0、top-p 0.7。这个分数统计多次采样的平均正确表现，不能解释为“32 次中只要答对一次”。 [S12](#source-s12)

### HumanEval：接着函数提示写实现，再运行测试

HumanEval 测的是函数补全：模型得到导入语句、函数签名和描述，继续写函数体。原版有 164 道手写题；下面采用原版 `HumanEval/0`，任务是判断数列中是否存在两个不同位置的数，其距离严格小于给定阈值。数据原本存于压缩的 `HumanEval.jsonl.gz`；为看清补全边界，这里把同一条记录的代码字段分别展开。 [S4](#source-s4)

模型输入是完整的 `prompt`：

```python
from typing import List


def has_close_elements(numbers: List[float], threshold: float) -> bool:
    """ Check if in given list of numbers, are any two numbers closer to each other than
    given threshold.
    >>> has_close_elements([1.0, 2.0, 3.0], 0.5)
    False
    >>> has_close_elements([1.0, 2.8, 3.0, 4.0, 5.0, 2.0], 0.3)
    True
    """
```

模型应在提示末尾继续生成函数体。下面是记录中的完整 `canonical_solution`，展示一种参考补全；它属于参考答案，**不交给模型**：

```python
    for idx, elem in enumerate(numbers):
        for idx2, elem2 in enumerate(numbers):
            if idx != idx2:
                distance = abs(elem - elem2)
                if distance < threshold:
                    return True

    return False
```

评分器使用同一条记录的 `check(candidate)`，把生成的 `has_close_elements` 作为 `candidate` 传入。下面保留全部断言，只省去测试字段中记录作者与数据集名称的 `METADATA`；这些测试也**不属于模型输入**。 [S4](#source-s4)

```python
def check(candidate):
    assert candidate([1.0, 2.0, 3.9, 4.0, 5.0, 2.2], 0.3) == True
    assert candidate([1.0, 2.0, 3.9, 4.0, 5.0, 2.2], 0.05) == False
    assert candidate([1.0, 2.0, 5.9, 4.0, 5.0], 0.95) == True
    assert candidate([1.0, 2.0, 5.9, 4.0, 5.0], 0.8) == False
    assert candidate([1.0, 2.0, 3.0, 4.0, 5.0, 2.0], 0.1) == True
    assert candidate([1.1, 2.2, 3.1, 4.1, 5.1], 1.0) == True
    assert candidate([1.1, 2.2, 3.1, 4.1, 5.1], 0.5) == False
```

这样，一条任务的三部分能对上：输入提示要求找“距离小于阈值”的一对数，输出是可执行的函数体，判分则运行上述断言。例如同一组数在阈值 0.3 时应为真，在 0.05 时应为假；不能只检查有没有重复值。生成补全通过该题测试才记为 `passed`，不要求代码与参考实现相同。 [S4](#source-s4)

提交文件采用 JSONL，包含 `task_id` 与 `completion`，补全中不重复提示。评测再跨题汇总 `pass@k`，衡量 k 次尝试至少成功一次的表现；所读实现默认检查 k 为 1、10、100，且只有每题采样数都不小于 k 才计算对应项，默认超时为 3.0 秒。 [S4](#source-s4)

### SWE-bench：根据 issue 修改已有仓库

SWE-bench 把模型放进软件维护任务：给它一个 GitHub issue 和问题尚未修复的仓库，让它生成可应用的补丁。原论文从 12 个 Python 仓库收集 issue 与解决它的 PR；成功要同时修复问题并维持已有功能。访问当日数据卡列出测试集 2,294 条、开发集 225 条。下面用官方数据首条 Astropy 的 WCS 绘图问题说明，一条任务怎样把 issue、代码和测试连起来。 [S5](#source-s5)

这条 issue 很长，正文有重复。下面只留任务本身：带非线性畸变的 WCS 在绘图时不收敛，作者希望不必改库就能得到图。原文里的两张 4×4 SIP 系数只是把这个畸变造出来，不改变要修的行为，这里不逐格抄。评分用的测试在后面按记录给全。 [S5](#source-s5)

````text
'WCS.all_world2pix' failed to converge when plotting WCS with non linear distortions

### Description
When trying to plot an image with a WCS as projection that contains non linear Distortions it fails with a `NoConvergence` error.

### Expected behavior
When I add `quiet=True` as parameter to the call
```pixel = self.all_world2pix(*world_arrays, 0)```
at line 326 of `astropy/wcs/wcsapi/fitswcs.py` I get the good enough looking plot below.

It would be nice if there was a way of getting that plot without having to hack the library code like that.

### Actual behavior
NoConvergence: 'WCS.all_world2pix' failed to converge to the requested accuracy.
After 20 iterations, the solution is diverging at least for one input point.
````

模型需要读懂的目标是：带非线性畸变的 WCS 绘图遇到不收敛时，仍能返回可用结果，而不被异常打断。题面与**修复前的 `astropy/astropy` 仓库**一起构成输入；仅有这段文字不能替代仓库。参考补丁中的上下文显示，原先的 `world_to_pixel_values` 直接调用 `all_world2pix`，让不收敛异常传出。模型应提交修改仓库代码的补丁，下面是该记录的完整参考 `patch`，用来说明可交付物的形态，不作为测试时的已知答案。 [S5](#source-s5)

```diff
diff --git a/astropy/wcs/wcsapi/fitswcs.py b/astropy/wcs/wcsapi/fitswcs.py
--- a/astropy/wcs/wcsapi/fitswcs.py
+++ b/astropy/wcs/wcsapi/fitswcs.py
@@ -323,7 +323,17 @@ def pixel_to_world_values(self, *pixel_arrays):
         return world[0] if self.world_n_dim == 1 else tuple(world)
 
     def world_to_pixel_values(self, *world_arrays):
-        pixel = self.all_world2pix(*world_arrays, 0)
+        # avoid circular import
+        from astropy.wcs.wcs import NoConvergence
+        try:
+            pixel = self.all_world2pix(*world_arrays, 0)
+        except NoConvergence as e:
+            warnings.warn(str(e))
+            # use best_solution contained in the exception and format the same
+            # way as all_world2pix does (using _array_converter)
+            pixel = self._array_converter(lambda *args: e.best_solution,
+                                         'input', *world_arrays, 0)
+
         return pixel[0] if self.pixel_n_dim == 1 else tuple(pixel)
 
     @property
```

评分一侧另有 `test_patch` 和两组测试目标，不把它们当作模型的修复提示。其中新增的完整问题测试如下；这里只去掉补丁格式的行首加号，省去导入调整和一处无关注释修改。 [S5](#source-s5)

```python
def test_non_convergence_warning():
    """Test case for issue #11446
    Since we can't define a target accuracy when plotting a WCS `all_world2pix`
    should not error but only warn when the default accuracy can't be reached.
    """
    # define a minimal WCS where convergence fails for certain image positions
    wcs = WCS(naxis=2)
    crpix = [0, 0]
    a = b = ap = bp = np.zeros((4, 4))
    a[3, 0] = -1.20116753e-07

    test_pos_x = [1000, 1]
    test_pos_y = [0, 2]

    wcs.sip = Sip(a, b, ap, bp, crpix)
    # first make sure the WCS works when using a low accuracy
    expected = wcs.all_world2pix(test_pos_x, test_pos_y, 0, tolerance=1e-3)

    # then check that it fails when using the default accuracy
    with pytest.raises(NoConvergence):
        wcs.all_world2pix(test_pos_x, test_pos_y, 0)

    # at last check that world_to_pixel_values raises a warning but returns
    # the same 'low accuray' result
    with pytest.warns(UserWarning):
        assert_allclose(wcs.world_to_pixel_values(test_pos_x, test_pos_y),
                        expected)
```

这项测试先确认低精度调用可用、默认精度会触发 `NoConvergence`，再要求 `world_to_pixel_values` 发出警告并返回与低精度结果相近的坐标。它就是这条记录里唯一要新通过的测试。另外还有 27 条同文件里原本已经通过的测试，修复后必须继续通过；那些名字不决定这条任务在修什么，这里不逐条列出。 [S5](#source-s5)

模型交出的补丁应用到同一份修复前仓库后，评分环境加入测试补丁并运行测试。只有问题修复测试全部转为通过、原有维护测试也全部保持通过，才算 `FULL`，最终记为 `resolved`。调试报告里的 `PARTIAL` 不能替代任务解决率；参考补丁也不是唯一允许的实现。 [S5](#source-s5)

### SWE-bench Verified：仍然修仓库，但题目经过人工筛选

Verified 沿用同一种仓库修复任务，是 OpenAI 与 SWE-bench 作者从原测试集中人工审核选出的 500 条测试样本。筛选关注问题描述是否充分、测试是否接受合理实现，并改进评测环境。它提供的是经筛选的测试子集。下面是该子集首条 Astropy 任务的完整 `problem_statement`，没有删改题面。 [S5](#source-s5) [S6](#source-s6)

````text
Modeling's `separability_matrix` does not compute separability correctly for nested CompoundModels
Consider the following model:

```python
from astropy.modeling import models as m
from astropy.modeling.separable import separability_matrix

cm = m.Linear1D(10) & m.Linear1D(5)
```

It's separability matrix as you might expect is a diagonal:

```python
>>> separability_matrix(cm)
array([[ True, False],
       [False,  True]])
```

If I make the model more complex:
```python
>>> separability_matrix(m.Pix2Sky_TAN() & m.Linear1D(10) & m.Linear1D(5))
array([[ True,  True, False, False],
       [ True,  True, False, False],
       [False, False,  True, False],
       [False, False, False,  True]])
```

The output matrix is again, as expected, the outputs and inputs to the linear models are separable and independent of each other.

If however, I nest these compound models:
```python
>>> separability_matrix(m.Pix2Sky_TAN() & cm)
array([[ True,  True, False, False],
       [ True,  True, False, False],
       [False, False,  True,  True],
       [False, False,  True,  True]])
```
Suddenly the inputs and outputs are no longer separable?

This feels like a bug to me, but I might be missing something?
````

模型收到这份 issue 和修复前的 Astropy 仓库，应修改嵌套复合模型的可分离性计算。题面已给出预期关系：两个线性模型各自独立，嵌套组合不应把它们错误地判成互相依赖。记录中的参考补丁只改了 `_cstack` 的一处赋值：保留右侧模型已有的依赖矩阵，而不是把相应区域全部填成 1。下面完整展示该 `patch`；它仍是参考答案，不属于模型输入。 [S5](#source-s5)

```diff
diff --git a/astropy/modeling/separable.py b/astropy/modeling/separable.py
--- a/astropy/modeling/separable.py
+++ b/astropy/modeling/separable.py
@@ -242,7 +242,7 @@ def _cstack(left, right):
         cright = _coord_matrix(right, 'right', noutp)
     else:
         cright = np.zeros((noutp, right.shape[1]))
-        cright[-right.shape[0]:, -right.shape[1]:] = 1
+        cright[-right.shape[0]:, -right.shape[1]:] = right
 
     return np.hstack([cleft, cright])
```

同一条任务的完整测试补丁如下，评分环境用它补充嵌套组合与相应布尔矩阵的验收目标：

```diff
diff --git a/astropy/modeling/tests/test_separable.py b/astropy/modeling/tests/test_separable.py
--- a/astropy/modeling/tests/test_separable.py
+++ b/astropy/modeling/tests/test_separable.py
@@ -28,6 +28,13 @@
 p1 = models.Polynomial1D(1, name='p1')
 
 
+cm_4d_expected = (np.array([False, False, True, True]),
+                  np.array([[True,  True,  False, False],
+                            [True,  True,  False, False],
+                            [False, False, True,  False],
+                            [False, False, False, True]]))
+
+
 compound_models = {
     'cm1': (map3 & sh1 | rot & sh1 | sh1 & sh2 & sh1,
             (np.array([False, False, True]),
@@ -52,7 +59,17 @@
     'cm7': (map2 | p2 & sh1,
             (np.array([False, True]),
              np.array([[True, False], [False, True]]))
-            )
+            ),
+    'cm8': (rot & (sh1 & sh2), cm_4d_expected),
+    'cm9': (rot & sh1 & sh2, cm_4d_expected),
+    'cm10': ((rot & sh1) & sh2, cm_4d_expected),
+    'cm11': (rot & sh1 & (scl1 & scl2),
+             (np.array([False, False, True, True, True]),
+              np.array([[True,  True,  False, False, False],
+                        [True,  True,  False, False, False],
+                        [False, False, True,  False, False],
+                        [False, False, False, True,  False],
+                        [False, False, False, False, True]]))),
 }
```

上面的测试补丁就是验收目标：嵌套之后，两个线性模型仍应各自独立。记录里要新通过的测试有 2 条，另外 13 条是原来已经通过、修完还必须保持通过的回归测试。评分只看这些测试，不看补丁文本是否和参考补丁相同。安装脚本、难度和镜像不在这里展开。人工筛选后来是否还站得住，放在后面的复查里。 [S5](#source-s5) [S6](#source-s6)

### tau-bench：在对话中查信息、调用工具，完成用户请求

原版 tau-bench 让 agent 扮演服务人员，与语言模型模拟的用户多轮交互，利用领域 API 处理请求，同时遵守业务政策。用户不会一次性给出数据库里的全部信息，agent 要询问、查询并执行操作。下面取零售领域第一条任务：用户想更换订单中的机械键盘和温控器，还给出了找不到符合偏好的键盘时的备选方案。它原本就是 `retail/tasks_test.py` 中的 Python `Task` 对象；下面仅省去标注者编号，完整保留任务指令、参考动作和回答目标。 [S8](#source-s8)

```python
Task(
    user_id="yusuf_rossi_9620",
    instruction="You are Yusuf Rossi in 19122. You received your order #W2378156 and wish to exchange the mechanical keyboard for a similar one but with clicky switches and the smart thermostat for one compatible with Google Home instead of Apple HomeKit. If there is no keyboard that is clicky, RGB backlight, full size, you'd go for no backlight. You are detail-oriented and want to make sure everything is addressed in one go.",
    actions=[
        Action(
            name="find_user_id_by_name_zip",
            kwargs={"first_name": "Yusuf", "last_name": "Rossi", "zip": "19122"},
        ),
        Action(name="get_order_details", kwargs={"order_id": "#W2378156"}),
        Action(name="get_product_details", kwargs={"product_id": "1656367028"}),
        Action(name="get_product_details", kwargs={"product_id": "4896585277"}),
        Action(
            name="exchange_delivered_order_items",
            kwargs={
                "order_id": "#W2378156",
                "item_ids": ["1151293680", "4983901480"],
                "new_item_ids": ["7706410293", "7747408585"],
                "payment_method_id": "credit_card_9513926",
            },
        ),
    ],
    outputs=[],
)
```

这里必须区分两端输入：`instruction` 是给**用户模拟器**的人设与请求，agent 实际收到的是模拟用户逐轮说的话，以及工具返回的观察；agent 还获得业务政策和工具接口。`actions` 是评估一侧的参考操作，不是预先发给 agent 的行动脚本。本例先根据姓名与邮编查用户，读订单和商品，再把订单中指定的键盘、温控器换为目标商品，并指定支付方式。agent 应通过真实对话和工具调用完成同样的业务结果。 [S8](#source-s8)

分数来自执行后的数据库，而不是动作文字相似度：评分器从初始数据库重放这些参考动作得到目标数据库，再比较 agent 执行后数据库的哈希是否相同。本例的 `outputs=[]`，没有额外的回答关键词目标；若任务在 `outputs` 中列了必要内容，回答还须包含它们。只有满足目标才得二元终局奖励 1。原论文明确指出，这仍可能漏掉“操作前是否取得用户确认”等过程要求。 [S8](#source-s8)

因此这个对象说明了请求与验收目标，但它不是一份可独立运行的完整环境：还须有初始数据库、政策、工具和用户模拟器。本文采用原版任务与实现；其 README 已提醒这些任务没有更新。跨重复执行时，论文的 `pass^k` 衡量同一任务独立运行 k 次**全部成功**的概率，关注稳定性；它与 HumanEval 至少成功一次的 `pass@k` 不同。 [S8](#source-s8)

### WebArena：在网页中找到信息或完成操作

WebArena 让 agent 根据自然语言目标操作自托管网站，包括电商、论坛、协作开发和内容管理等应用。任务通过人工探索、模板与实例化构建，共 812 个；评测看功能是否完成，允许不同的网页操作路径。下面这条任务要在电商管理后台查询 2022 年销量最高的产品。原始 `test.raw.json` 是 JSON 数组，运行准备阶段再生成每任务一个 JSON 配置；下面取首个配置，完整保留任务目标、起始环境与评分配置；省去任务编号、模板生成信息和空的地理位置字段。 [S9](#source-s9)

```json
{
  "sites": [
    "shopping_admin"
  ],
  "require_login": true,
  "storage_state": "./.auth/shopping_admin_state.json",
  "start_url": "__SHOPPING_ADMIN__",
  "intent": "What is the top-1 best-selling product in 2022",
  "require_reset": false,
  "eval": {
    "eval_types": [
      "string_match"
    ],
    "reference_answers": {
      "exact_match": "Quest Lumaflex™ Band"
    },
    "reference_url": "",
    "program_html": [],
    "string_note": "",
    "reference_answer_raw_annotation": "Quest Lumaflex™ Band"
  }
}
```

agent 的任务输入是 `intent`，并从 `start_url` 指定的网站开始观察和操作；`__SHOPPING_ADMIN__` 是部署时替换的地址占位符。`require_login` 和 `storage_state` 让运行器准备认证状态。agent 要在后台找到年度销量信息，最后交出产品名；标准答案在 `eval.reference_answers` 中，供评分器使用，不展示给 agent。配置也不包含整个网站数据库或当前页面观察。 [S9](#source-s9)

本条评分采用 `string_match` 中的 `exact_match`：取最终回答，清理首尾空白、成对外引号并转为小写后，与 `Quest Lumaflex™ Band` 比较，相等得 1，否则得 0。它不核对浏览路径，也不要求在这条任务中修改页面。其他 WebArena 任务可检查目标 URL 或页面内容，组合评分会相乘；其中 `fuzzy_match` 还会调用模型判断语义，所以不能把整个基准的评分都视为纯确定性检查。 [S9](#source-s9)

运行这些配置需要自行部署网站与初始数据，演示站只供浏览。所读 README 示例采用 `accessibility_tree` 观察和 1280 × 720 视口，并要求整批任务运行后重置环境；这组设置应随评测记录，但并非所有 agent 只能采用这一种观察方式。 [S9](#source-s9)

## 怎样选择和使用这些评分

一份任务在实验中可以承担不同角色。下面是根据保留切分和训练用途整理的分工建议： [S2](#source-s2) [S10](#source-s10) [S11](#source-s11)

| 用途 | 怎样使用反馈 | 关键区别 |
| --- | --- | --- |
| RL 奖励环境 | 反复采样，用训练答案或执行结果更新参数 | 反馈直接参与训练 |
| 开发评测 | 据结果改提示、调奖励或选 checkpoint | 任务已影响开发决策 |
| 上线前独立评测 | 固定模型和 agent 设置后，在预留任务上运行 | 保留任务不参与前面的选择 |

文件名为 `test` 不能单独证明独立性；若用它筛训练题、选模型或反复修改 agent，就应按真实用途重新登记。对于 tau-bench 与 WebArena，还要把模型、工具、观察方式、用户模拟器和环境一起视为评测对象。 [S2](#source-s2) [S7](#source-s7) [S8](#source-s8) [S9](#source-s9)

### 可验证性：核对判定目标，也核对误判方向

PRM800K 的评分说明承认数学等价判断可能误拒与误收。Verified 的人工说明要求问题足够明确，测试应覆盖描述中的合理解法，不能依赖描述之外的新函数名或错误消息。tau-bench 则要求任务有唯一数据库终态，减少用户模拟带来的目标歧义。这些都是原文明确提出或用于筛选的要求。 [S2](#source-s2) [S6](#source-s6) [S8](#source-s8)

选基准时，可以分别检查“错误解能否混过”和“正确解会否被错杀”。两种问题不能用一个“有测试”标签代替。这里是对上述原文要求的归纳。 [S2](#source-s2) [S6](#source-s6)

::: warning Verified 的人工筛选需要后续复查

OpenAI 在 **2026-02-23** 的复查中写，审计了模型经常失败的 **27.6% 子集**，其中**至少 59.4%** 的题有会拒绝功能上正确提交的缺陷测试。这个比例属于被审计子集，不能外推为全部 500 道题的错误率。同一则说明还写，受测前沿模型能复现参考补丁或题面中的原句，并因此不再用该基准衡量前沿编程能力。这里保留复查对象和比例的原有范围。 [S7](#source-s7)
:::

### 污染与时间切分：名称、去重与训练截止日分别核对

作者声称：SWE-bench 原论文把持续更新列为特点，提出可收集模型训练日期之后创建的问题，避免解决方案已经存在于训练语料。这个主张要求题目时间确实晚于相应模型的训练截止日；原文没有为所有以后提交的模型担保无污染。 [S5](#source-s5)

DeepSeekMath 在预训练语料去污染部分写了 `10-gram` 精确匹配；短于该长度但至少 `3` gram 的基准文本采用精确匹配过滤。它另在 RL 节说明使用来自 SFT 的 GSM8K、MATH 相关题。不能把预训练语料的过滤规则直接转述成 RL 数据逐条去重证书。 [S13](#source-s13)

作者声称：Verified 后续复查用模型复现参考补丁与题面细节作为污染证据。时间切分要与模型截止日、改写后近重复、答案与仓库版本暴露一起核对。后一项是本篇结合原文做的审查建议，不是已经执行过的全面去污染。 [S7](#source-s7)

### 难度与饱和：训练难度和评测区分度是两个问题

作者声称：SimpleRL-Zoo 的对照实验发现，训练题难度需匹配基础模型的探索能力；对较弱模型，过难题缺少正反馈，对较强模型，过易题也限制提升。它把训练题分为 `Easy`、`Medium`、`Hard`。这是训练数据选择的实验证据，不是“所有模型都应使用同一种难度”的定理。 [S10](#source-s10)

Verified 发布说明按预计修复时间分层报告；后续复查又指出，当分数增长放缓，剩余失败可能来自测试缺陷与污染。接近饱和时，先审查失败样本，再解释微小分差。本文没有依据旧成绩宣布 GSM8K、AIME 或 HumanEval 在基准日已普遍饱和。 [S6](#source-s6) [S7](#source-s7)

### 评分协议与复现：把采样、超时和环境写成协议的一部分

HumanEval 的 README 限制了样本不足时的 `pass@k` 计算；DAPO 明写 AIME 的重复次数、温度与 top-p；tau-bench 区分 `pass^k` 与 `pass@k`；WebArena 要求自托管和重置环境。这些都说明，同一批题不自动产生同口径的分数。 [S4](#source-s4) [S8](#source-s8) [S9](#source-s9) [S12](#source-s12)

一份可比较的记录应包括模型与 agent 版本、输入范围、样本数、生成参数、工具与模拟器版本、超时和步数预算、环境初态、评分实现。以上清单来自把几份协议拼合，并非单篇原文逐字列出的统一标准。本次只核实了正文列出的具体设置，未测量执行成本或跨机器复现误差。 [S4](#source-s4) [S8](#source-s8) [S9](#source-s9)

### 过程分与部分分：增加反馈，也改变优化目标

ReFT 对数值题允许在答案可提取但不正确时给 `0.1`，正确给 `1`，不可提取给 `0`。这是训练时的辅助反馈，不是 GSM8K 官方评测定义。其 MathQA 多选题实验还出现“中间算错、末尾猜中选项而得分”的 reward hacking。这里引用的是 ReFT 的原文反例，不额外把 MathQA 扩展为本文的数据集调研对象。 [S11](#source-s11)

作者声称：DeepSeek-R1 报告在 PRM 失败尝试中列出三项困难：步骤难定义，步骤正确性难标注，以及优化过程奖励时发生 reward hacking。作者也明确说这些失败经验不代表方法不可能有效。这里保留实验范围，不能把文中强措辞扩展成“任何 PRM 都必然失败”的定理。 [S16](#source-s16)

SimpleRL-Zoo 报告严格格式奖励可能使部分基础模型过度追逐格式并出现训练退化。过程分、格式分、可提取分和测试部分通过率，应分别报告，并用独立的末端正确性或完整任务成功率复核。不能把辅助分上升直接写成能力提升。 [S10](#source-s10) [S11](#source-s11)

## benchmark 怎样成为 RL 奖励或训练数据

### SimpleRL-Zoo：明确使用 GSM8K 与 MATH 的训练集

论文 v2 第 2.1 节写明使用 GSM8K 与 MATH 的 training datasets。`Easy` 是 GSM8K 加 MATH `lv.1`，`Medium` 是 MATH `lv.1–4`，`Hard` 是 MATH `lv.3–5`，每类约 `8,000` 道题。训练奖励是正确 `+1`、错误 `0`，不使用格式奖励。评测列出 GSM8K、MATH 500、AIME 2024 等集合。 [S10](#source-s10)

这是明确区分训练题来源和评测集合的例子。所读部分没有给出逐条训练 ID 与所有测试 ID 的交集审计，也没有证明其底座预训练无污染。因此只能写“声明使用训练集”，不能写成“已验证所有阶段完全隔离”。 [S10](#source-s10)

### ReFT：同一批训练问题，SFT 后继续用答案奖励做 PPO

ReFT v3 用 SFT 热身，再从相同训练问题取问题和答案做 PPO。奖励直接来自生成结果与标准答案的比较，无需另训奖励模型。表 1 的 GSM8k 数据为 `Train N-CoT: 7,465`、`Train P-CoT: 7,356`、`Test: 1,319`；这些是其处理后的版本，不能当作原始 GSM8K 文件行数。 [S11](#source-s11)

算法区分训练数据，统计表区分 train 与 test，并明确不增加额外训练问题。所读部分没有提供针对底座预训练语料的去污染审计。这篇展示了 benchmark 训练分割成为奖励题的直接用法；不是把保留测试题拿来训练。 [S11](#source-s11)

### DAPO：AIME 风格的整数奖励数据，不等于把 AIME test 用作训练

DAPO v2 第 3.5 节把从网络和竞赛官网收集的题筛选、改写为整数答案，得到 `DAPO-Math-17K`，含 `17K` 提示。其基本正确性奖励为答对 `1`、否则 `−1`，另有过长惩罚。AIME 2024 用于结果评测；第 4.1 节写重复 `32` 次，报告 `avg@32`，`temperature 1.0`、`topp 0.7`。 [S12](#source-s12)

所读 v2 正文的数据转换与训练设置没有给出训练题对 AIME 2024 测试题的逐条排除清单，也没有给出完整去污染程序。因此本文只确认两套数据被描述为不同用途，保留隔离审计缺口。 [S12](#source-s12)

### DeepSeekMath：相关题、SFT 数据与预训练去污染要分别理解

DeepSeekMath v3 第 4.2 节写，RL 使用 SFT 数据中与 GSM8K、MATH 相关的 CoT 题，约 `144K`，排除其他 SFT 题，以检验域外任务变化。它使用训练出的奖励模型与 GRPO。 [S13](#source-s13)

所读段落没有把这 `144K` 题落实成可下载的 GSM8K `train.jsonl` 或某个明确 MATH 分割名单。第 2.1 节的去污染说的是预训练语料。不能据此写“RL 恰好用了两个 benchmark 的原始 train”，也不能声称已经核实与测试题零重叠。 [S13](#source-s13)

## 理论保证约束的是哪一种奖励

### 固定、不完美 verifier 的 RLVR：信息不足与审计控制

Moya、Thornley、Lin 的 Verifier Errors in RLVR，PDF 标注 `2609.35677v1`、`28 Sep 2026`，状态为预印本、审稿中。它研究固定 verifier 的奖励梯度流，区分真正正确、被接受的错误和被拒绝的回答。研究对象是一类奖励与训练动力学，不是针对 AIME、HumanEval 或 SWE-bench 成绩的保证。 [S14](#source-s14)

作者在文中提出：命题 `4.1–4.3` 给出检测、识别与选择性控制的限制。比较不同但与同一 verifier 相容的正确性标注时，保持问题分布、verifier、初始化和训练算法相同；训练日志不含 verifier 之外的正确性反馈，并假设没有假阴性。这样的日志在不同正确性世界中可以同分布，因而无法统一保证识别被接受的错误。选择性控制命题还要求组概率可微，并考虑初始策略对正确回答和错误接受都有正概率的情形。 [S14](#source-s14)

定理 `5.1` 对 projected audit correction 给出有条件的保证。核心假设为：

1. `A1`：正确、错误接受及已审计错误的概率对参数连续可微；所考察有限时间区间内，正确与错误接受概率都为正。
2. `A2`：固定审计集合在整个区间覆盖全部具有概率质量的错误接受，使已审计错误概率及其梯度与总体错误接受一致。
3. 轨迹界还要求 `A3`：投影校正方向在整个区间保持统一的校正强度下界，并对错误增长压力有统一上界。

按该定理，在前两项假设下，投影校正保留总接受概率的瞬时增长率；校正足够强时，错误接受占比下降，正确回答概率上升。更强的条件能使错误接受的绝对概率也下降。再加 `A3` 与增长压力上界，定理给出占比由指数衰减项和残余项构成的界。论文明确提醒：有限样本梯度、实际优化器与有限步长可能破坏这些效果。它没有证明离散 GRPO 在本文任一 benchmark 上达到全局最优。 [S14](#source-s14)

### 代理奖励的形式化：何时“奖励更高”不会颠倒真实偏好

Skalse 等人的 Defining and Characterizing Reward Hacking，本次打开 PDF 为 `2209.13085v2`。第 4 节假设状态与动作有限、动作不止一个、所有状态可达、奖励有限均值。它把 hacking 定义为存在两条策略：一个奖励偏好前者，另一个奖励偏好后者。 [S15](#source-s15)

作者声称：第 5.1 节定理 `1` 表明，若考虑的策略集合包含开集，一对非平凡且不可 hacking 的奖励，在该策略集上必须诱导相同排序。第 5.2 节定理 `2` 转而讨论有限策略集：当至少两条策略的状态动作访问计数不同，可以构造非平凡、不可 hacking 但不等价的奖励对。这里的“平凡”按策略回报是否恒定定义，不能只看奖励函数的表面写法。 [S15](#source-s15)

这些结果给的是代理奖励与真实目标的结构条件。若把测试通过率当作真实功能正确性的代理，可以用这个框架提出问题；但原文没有替 HumanEval 单测、tau-bench 哈希检查或某个 PRM 验证条件。它也没有证明训练算法必然找到某种漏洞。不能把“存在可 hacking 策略”改写成“实际一定会被攻破”。 [S15](#source-s15)

### 从条件性定理回到具体任务

数学末答案比较、HumanEval 单测、SWE-bench 修复测试和 tau-bench 数据库终态，都可以成为实际目标的代理；但本次读到的定理没有逐一验证这些代理满足相应假设。第一篇研究固定 verifier 与连续奖励梯度流，尤其依赖对错误接受的完整审计覆盖；第二篇研究有限 MDP 中两种奖励对策略排序的关系。两者都不能直接推出这些基准上的神经网络 RL 更新具有某个收敛率、遗憾界或任务覆盖下界。 [S14](#source-s14) [S15](#source-s15)

还要把指标估计与能力保证分开：HumanEval 的采样数要求、tau-bench 在独立同分布试验下的估计条件，约束的是如何估计指标；WebArena 的可重置环境和 Verified 的人工筛选，提供的是实验设计与经验依据。它们没有因此证明任意输入上的功能正确、整段交互的政策合规或未来模型的无污染。这是本次阅读范围内的结论，不能扩展为对未读版本与后续研究的否定。 [S4](#source-s4) [S6](#source-s6) [S8](#source-s8) [S9](#source-s9)

## 来源与阅读范围

### S1：GSM8K 官方说明与标准数据 {#source-s1}

[README](https://raw.githubusercontent.com/openai/grade-school-math/master/README.md) · [train.jsonl](https://raw.githubusercontent.com/openai/grade-school-math/master/grade_school_math/data/train.jsonl) · [test.jsonl](https://raw.githubusercontent.com/openai/grade-school-math/master/grade_school_math/data/test.jsonl) · [dataset.py](https://raw.githubusercontent.com/openai/grade-school-math/master/grade_school_math/dataset.py)

阅读范围：README 的数据、计算标注与答案提取部分；标准 train/test 文件与 test 第二条完整题目和解答；dataset.py 的答案正则、extract_answer 与 is_correct。未读 Socratic 文件，未运行模型或完整训练流程。

### S2：MATH-500 与 PRM800K 的切分和评分说明 {#source-s2}

[MATH-500 数据卡](https://huggingface.co/datasets/HuggingFaceH4/MATH-500/raw/main/README.md) · [test.jsonl](https://huggingface.co/datasets/HuggingFaceH4/MATH-500/resolve/main/test.jsonl) · [PRM800K README](https://raw.githubusercontent.com/openai/prm800k/main/README.md)

阅读范围：MATH-500 数据卡全文、JSONL 样本，正文采用代数展开题；PRM800K README 的 Answer Grading、MATH Splits。没有审计 grader.py，也没有阅读 PRM800K 全部人工标注。

### S3：math-ai/aime24 的 AIME 2024 文件 {#source-s3}

[数据卡](https://huggingface.co/datasets/math-ai/aime24/raw/main/README.md) · [Parquet 数据](https://huggingface.co/datasets/math-ai/aime24/resolve/main/test-00000-of-00001.parquet)

阅读范围：数据卡全文；Parquet 文件及留存的首条 Aya 步行题记录，正文保留完整题目和参考结果。未打开各行所指的 AoPS 解答，未读其他年份 AIME。

### S4：原版 HumanEval 的数据与评测实现 {#source-s4}

[README（所读快照）](https://raw.githubusercontent.com/openai/human-eval/6d43fb980f9fee3c892a914eda09951f772ad10d/README.md) · [HumanEval.jsonl.gz](https://raw.githubusercontent.com/openai/human-eval/6d43fb980f9fee3c892a914eda09951f772ad10d/data/HumanEval.jsonl.gz) · [evaluation.py](https://raw.githubusercontent.com/openai/human-eval/6d43fb980f9fee3c892a914eda09951f772ad10d/human_eval/evaluation.py)

阅读范围：原版 README Usage、原始压缩数据及 evaluation.py 全文；重点读 HumanEval/0 的完整提示、参考实现和测试。未审计完整沙箱实现，未执行生成代码。

### S5：SWE-bench 论文、两份数据卡与实际记录 {#source-s5}

[论文 v3](https://arxiv.org/html/2310.06770v3) · [SWE-bench 数据卡](https://huggingface.co/datasets/SWE-bench/SWE-bench/raw/main/README.md) · [Verified 数据卡](https://huggingface.co/datasets/SWE-bench/SWE-bench_Verified/raw/main/README.md) · [SWE-bench 首条记录](https://datasets-server.huggingface.co/rows?dataset=SWE-bench/SWE-bench&config=default&split=test&offset=0&length=1) · [Verified 首条记录](https://datasets-server.huggingface.co/rows?dataset=SWE-bench/SWE-bench_Verified&config=default&split=test&offset=0&length=1) · [grading.py](https://raw.githubusercontent.com/SWE-bench/SWE-bench/main/swebench/harness/grading.py)

阅读范围：论文 v3 第 2 节的构建、输入、评分、持续更新；访问当日两份数据卡全文与两个 test 首条记录；grading.py 的通过比例、状态与 resolved 判定。正文核对两条记录的题面、参考补丁、测试补丁和测试目标；未通读论文附录，未审计所有安装脚本、日志解析器或执行容器。

### S6：SWE-bench Verified 的发布与标注规范 {#source-s6}

[发布说明](https://openai.com/index/introducing-swe-bench-verified/) · [标注说明 PDF](https://cdn.openai.com/introducing-swe-bench-verified/swe-b-annotation-instructions.pdf)

阅读范围：发布页的背景、筛选方法和难度分层；标注说明 PDF 第 1–5 页，重点读问题充分性、测试范围与难度规则。未逐一展开交互案例，也未审查全部人工标注记录。

### S7：Verified 的 2026 年复查 {#source-s7}

[OpenAI 复查原文](https://openai.com/index/why-we-no-longer-evaluate-swe-bench-verified/)

阅读范围：2026-02-23 正文导言、Background、Too narrow and too wide tests，以及 Contamination 的方法与例子。未独立复现其审计，未逐条审查所有模型轨迹。

### S8：原版 tau-bench 的论文、任务与执行接口 {#source-s8}

[论文 v1](https://arxiv.org/html/2406.12045v1) · [README（所读快照）](https://raw.githubusercontent.com/sierra-research/tau-bench/59a200c6d575d595120f1cb70fea53cef0632f6b/README.md) · [types.py](https://raw.githubusercontent.com/sierra-research/tau-bench/59a200c6d575d595120f1cb70fea53cef0632f6b/tau_bench/types.py) · [retail/tasks_test.py](https://raw.githubusercontent.com/sierra-research/tau-bench/59a200c6d575d595120f1cb70fea53cef0632f6b/tau_bench/envs/retail/tasks_test.py) · [base.py](https://raw.githubusercontent.com/sierra-research/tau-bench/59a200c6d575d595120f1cb70fea53cef0632f6b/tau_bench/envs/base.py) · [cancel_pending_order.py](https://raw.githubusercontent.com/sierra-research/tau-bench/59a200c6d575d595120f1cb70fea53cef0632f6b/tau_bench/envs/retail/tools/cancel_pending_order.py)

阅读范围：论文 v1 的交互、奖励、指标、构建与奖励不充分的说明；原版 README、types.py、base.py、取消订单工具全文，以及 retail/tasks_test.py 的前三条，正文采用第一条完整任务指令与参考动作。未读全部数据库、政策、其他任务和 tau²/tau³ 的修订。

### S9：WebArena 的环境、任务与评分器 {#source-s9}

[论文 v4](https://arxiv.org/html/2307.13854v4) · [README（所读快照）](https://raw.githubusercontent.com/web-arena-x/webarena/dce04686a56253aefba7b18a4fa0937cf1dc987b/README.md) · [test.raw.json](https://raw.githubusercontent.com/web-arena-x/webarena/dce04686a56253aefba7b18a4fa0937cf1dc987b/config_files/test.raw.json) · [evaluators.py](https://raw.githubusercontent.com/web-arena-x/webarena/dce04686a56253aefba7b18a4fa0937cf1dc987b/evaluation_harness/evaluators.py)

阅读范围：论文 v4 的环境复现、任务构建与第 3.2 节评分；README、test.raw.json 首条完整配置及数组结构、evaluators.py 的字符串评分与组合路由。未部署网站、未测外部模型评分一致性、未通读附录。

### S10：SimpleRL-Zoo v2 {#source-s10}

[论文 HTML](https://arxiv.org/html/2503.18892v2)

阅读范围：v2 第 2.1 节训练数据、奖励与评测，表 1 的采样注释，第 3.1–3.2 节格式和难度实验。未打开训练数据仓库逐条交集检查，未精读其余实验与附录。

### S11：ReFT v3 {#source-s11}

[论文 HTML](https://arxiv.org/html/2401.08967v3)

阅读范围：v3 第 3 节 SFT 与 PPO、终局和部分奖励；第 4.1 节及表 1；第 4.4 节的 MathQA reward hacking 与部分奖励消融。未逐条审计处理后的数据，未通读附录和所有实验。

### S12：DAPO v2 {#source-s12}

[论文 HTML](https://arxiv.org/html/2503.14476v2)

阅读范围：v2 第 2 节基本奖励、第 3.5 节数据转换、第 4.1 节评测协议与第 5 节训练奖励观察。未读完附录，未打开全部训练题与去重实现。

### S13：DeepSeekMath v3 {#source-s13}

[论文 HTML](https://arxiv.org/html/2402.03300v3)

阅读范围：v3 第 2.1 节语料去污染、第 3.1 节 SFT 来源、第 4.2 节 RL 数据与奖励模型。未取得 144K 题的逐条清单，未通读附录梯度分析。

### S14：Verifier Errors in RLVR 的条件性定理 {#source-s14}

[论文 PDF v1](https://arxiv.org/pdf/2609.35677)

阅读范围：PDF v1 第 2 节定义，第 4–7 页的动力学、命题 4.1–4.3 与定理 5.1、假设和证明提纲。已核对作者网页对应段落；未精读附录证明及全部实验，未验证实现能否满足假设。

### S15：Defining and Characterizing Reward Hacking {#source-s15}

[论文 PDF v2](https://arxiv.org/pdf/2209.13085)

阅读范围：实际 PDF 为 v2，阅读第 4 节定义和假设、第 5.1–5.2 节定理 1、2。未精读附录证明；其摘要措辞没有代替正文定理，也没有据此推断某个 benchmark 的漏洞发生率。

### S16：DeepSeek-R1 v1 的过程奖励经验 {#source-s16}

[报告 HTML](https://arxiv.org/html/2501.12948v1)

阅读范围：v1 第 2.2.2 节奖励建模、第 4.2 节 PRM 失败尝试及其限定语。没有据此还原训练题切分，没有精读全部评测表和附录。
