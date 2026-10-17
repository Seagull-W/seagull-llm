---
title: "2026-10-17 后训练强化学习数据集：来源、记录形式与对训练的影响"
description: "用真实记录讲清偏好、过程监督、可验证数学与代码、仓库任务和安全偏好数据的输入、目标与评分方式，并梳理构建方法、训练要求、数据筛选和对训练的影响。"
tags: ["每日调研", "后训练", "强化学习", "数据"]
date: "2026-10-17"
---

# 2026-10-17 后训练强化学习数据集：来源、记录形式与对训练的影响

::: info 本期要点

- **训练记录的核心是反馈从哪里来。** 人类比较、模型评分、步骤标签和可执行测试，分别支持不同的训练环节。 [S1](#source-s1) [S2](#source-s2) [S4](#source-s4) [S7](#source-s7)
- **更多配对不等于更多有效问题。** 提示多样性、当前策略的回答分布和组内奖励差异，都会改变数据的训练价值。 [S13](#source-s13) [S14](#source-s14)
- **记录可以公开，训练条件仍须补齐。** 代码运行环境、仓库依赖、标签语义与许可边界，不能由一个下载链接代替。 [S5](#source-s5) [S7](#source-s7) [S8](#source-s8) [S9](#source-s9)
:::

> 调研基准日 2026-10-17（Asia/Shanghai），依据已打开的论文、数据卡、原始记录和代码；没有跑训练。阅读范围在文末。

## 先看训练记录怎样提供反馈

本文围绕九份可公开获取的数据展开：偏好数据负责比较回答，过程数据负责标注推导，数学题和代码测试负责提供可验证反馈，仓库任务负责构成可交互的训练环境，安全数据则把帮助用户和避免伤害分别标注。覆盖的是这些常见训练接口，不是对所有公开数据集的穷尽清单。下面先用真实记录解释各自怎么用，再讨论构建、要求与影响。 [S1](#source-s1) [S4](#source-s4) [S6](#source-s6) [S7](#source-s7) [S8](#source-s8) [S9](#source-s9)

### 1. Anthropic HH-RLHF：同一段对话的两种续写

Anthropic 发布 HH-RLHF，用人类对 helpfulness / harmlessness 的偏好支持奖励模型训练。本文选择 `helpful-base` 的训练切分：模型收到共同的对话历史，产生最后一轮回答；`chosen` 和 `rejected` 提供相对偏好。将这对文本用于奖励建模，是让模型学会给 chosen 更高分；偏好本身不是某种已校准的绝对质量分数。官方把 helpfulness 数据分为 base、拒绝采样和在线迭代来源，本文没有把三个来源混为一种采样分布。 [S1](#source-s1) [S10](#source-s10)

以下为 `helpful-base/train.jsonl.gz` 解压后的第一行，两个字段完整保留，仅展开 JSON 排版。共同历史一直延伸到最后一个 `Assistant:` 之前；不能把早先助手的回答也误当成本轮待比较的回答。 [S1](#source-s1)

```json
{
  "chosen": "\n\nHuman: Hi, I want to learn to play horseshoes. Can you teach me?\n\nAssistant: I can, but maybe I should begin by telling you that a typical game consists of 2 players and 6 or 8 horseshoes.\n\nHuman: Okay. What else is needed to play, and what are the rules?\n\nAssistant: A horseshoe is usually made out of metal and is about 3 to 3.5 inches long and around 1 inch thick. The horseshoe should also have a 2 inch by 3 inch flat at the bottom where the rubber meets the metal. We also need two stakes and six horseshoes.",
  "rejected": "\n\nHuman: Hi, I want to learn to play horseshoes. Can you teach me?\n\nAssistant: I can, but maybe I should begin by telling you that a typical game consists of 2 players and 6 or 8 horseshoes.\n\nHuman: Okay. What else is needed to play, and what are the rules?\n\nAssistant: Horseshoes are either metal or plastic discs. The horseshoes come in different weights, and the lighter ones are easier to throw, so they are often the standard for beginning players."
}
```

这条记录比较的是投掷马蹄铁游戏的两种说明。可以从共同前缀还原 prompt，再取末轮回答形成偏好对。**编辑归纳：** chosen 只表示在这次比较中被选中；这条记录没有规则手册或事实校验标签，因此不能把 chosen 当作已核验的知识答案，直接据此宣称模型学到了正确规则。 [S1](#source-s1)

### 2. UltraFeedback：四个回答、逐维评分与文字反馈

`openbmb/UltraFeedback` 由 Cui 等人的团队发布，用于奖励模型、批评模型以及后续偏好优化。模型收到 `instruction`，生成时还可收到该候选对应的 `custom_system_prompt`；GPT-4 按指令遵循、真实性、诚实性和帮助性评分，并提供理由与批评。奖励模型可以学习分数诱导的排序，批评模型则可以学习文字反馈；这两个目标不可互换。 [S2](#source-s2) [S11](#source-s11)

下面是原始 `evol_instruct.jsonl` 第四条记录，完整保留所有字段、四个回答、评分与批评。它也与 rows API 的 `train` 第 3 行（从 0 计）逐字段一致。原始载体是 JSONL，不是一个已经二值化的 chosen/rejected 文件。 [S2](#source-s2)

```json
{
  "source": "evol_instruct",
  "instruction": "How can I convert the decimal number 31 to binary format using JavaScript code? Can you provide the code for this conversion?",
  "models": [
    "alpaca-7b",
    "mpt-30b-chat",
    "vicuna-33b",
    "wizardlm-13b"
  ],
  "completions": [
    {
      "annotations": {
        "helpfulness": {
          "Rating": "4",
          "Rationale": "The response is clear and relevant, provides useful information, and is concise.",
          "Rationale For Rating": "The code provided is correct and concise, but it lacks a detailed explanation of the code.",
          "Type": [
            "1",
            "2",
            "3"
          ]
        },
        "honesty": {
          "Rating": "4",
          "Rationale": "The response is correct but uncertain due to the lack of context for the variable `decimalNum`. The provided code is accurate for converting a decimal number to binary format, but it does not specifically address the given decimal number (31)."
        },
        "instruction_following": {
          "Rating": "4",
          "Rationale": "The text provides a simple JavaScript code snippet that converts a decimal number to binary format using the `toString()` method. It meets the task goal but lacks a detailed explanation."
        },
        "truthfulness": {
          "Rating": "3",
          "Rationale": "The text introduces a new fact not aligned with the instruction, as it does not provide the code for converting the specific decimal number 31 to binary format.",
          "Rationale For Rating": "The text is overall truthful but has a partial misunderstanding due to not providing the code for the specific decimal number 31.",
          "Type": [
            "2"
          ]
        }
      },
      "critique": "Your answer is mostly accurate but lacks engagement and clarification. You gave the correct method of converting decimal to binary in JavaScript, but you didn't explain how this code works, which is crucial for understanding. Also, you didn't define the variable 'decimalNum'. \n\nMoreover, the instruction asked for the specific decimal number, 31, to be converted. You should tailor the code to this specific request rather than providing a generic solution. \n\nRegarding engagement, try to communicate in a more conversational tone. For example, you could start by saying, \"Sure, I'd be happy to help with that!\" \n\nFinally, always test your code to ensure it works as expected.",
      "custom_system_prompt": "As a top-tier AI assistant, make sure that your responses are not only accurate and current but also engaging. Be the positive interaction users look forward to.",
      "fine-grained_score": 3.75,
      "model": "alpaca-7b",
      "overall_score": 6.0,
      "principle": "helpfulness",
      "response": "The following JavaScript code can be used to convert a decimal number to binary format:\n\nlet binary = Math.floor(decimalNum).toString(2);\n\nconsole.log(\"Binary format of\", decimalNum, \"is\", binary);"
    },
    {
      "annotations": {
        "helpfulness": {
          "Rating": "5",
          "Rationale": "The response is clear and relevant, provides comprehensive information, and avoids repetition.",
          "Rationale For Rating": "The code provided is correct, and the explanation is detailed and informative.",
          "Type": [
            "1",
            "2",
            "3"
          ]
        },
        "honesty": {
          "Rating": "5",
          "Rationale": "The response is correct and confident. It provides accurate JavaScript code for converting a decimal number to binary format using the `toString()` method."
        },
        "instruction_following": {
          "Rating": "5",
          "Rationale": "The text provides a clear and concise JavaScript code snippet that converts a decimal number to binary format using the `toString()` method. It meets the task goal and follows the instruction."
        },
        "truthfulness": {
          "Rating": "5",
          "Rationale": "The text does not contain any hallucinations.",
          "Rationale For Rating": "The text is free of hallucinations and provides accurate information on converting a decimal number to binary format using JavaScript code.",
          "Type": [
            "0"
          ]
        }
      },
      "critique": "Your answer is accurate, clear, and well-structured. You provided the correct JavaScript code for converting a decimal number to binary and explained it thoroughly. However, you could make your answer more engaging by asking the user to try running the provided code and observe the result, to encourage active learning. You could also suggest modifications to the code to handle different decimal numbers.",
      "custom_system_prompt": "It's your duty as an AI assistant to always deliver accurate, positive, and engaging content that serves to educate the user. Make every interaction a learning opportunity.",
      "fine-grained_score": 5.0,
      "model": "mpt-30b-chat",
      "overall_score": 9.0,
      "principle": "helpfulness",
      "response": "Yes, I can provide the JavaScript code for converting the decimal number 31 to binary format. Here's the code:\n```\nlet decimalNumber = 31;\nlet binaryString = decimalNumber.toString(2);\nconsole.log(binaryString);\n```\nIn this code, we first declare a variable `decimalNumber` and assign it the value 31. Then we use the `toString()` method to convert the decimal number to binary format. The `toString()` method takes a parameter which represents the base of the number system that we want to convert to. In this case, we pass the value `2` to represent the binary number system. The converted binary number is then stored in the `binaryString` variable. Finally, we use `console.log()` to display the binary string in the console."
    },
    {
      "annotations": {
        "helpfulness": {
          "Rating": "3",
          "Rationale": "The response is clear and relevant, provides comprehensive information, and avoids repetition.",
          "Rationale For Rating": "The code provided is correct, but it is more complex than necessary. A simpler solution using `toString(2)` would be more appropriate.",
          "Type": [
            "1",
            "2",
            "3"
          ]
        },
        "honesty": {
          "Rating": "5",
          "Rationale": "The response is correct and confident. It provides accurate JavaScript code for converting a decimal number to binary format."
        },
        "instruction_following": {
          "Rating": "5",
          "Rationale": "The text provides a comprehensive JavaScript code snippet that converts a decimal number to binary format using a while loop. It meets the task goal and follows the instruction."
        },
        "truthfulness": {
          "Rating": "5",
          "Rationale": "The text does not contain any hallucinations.",
          "Rationale For Rating": "The text is free of hallucinations and provides accurate information on converting a decimal number to binary format using JavaScript code.",
          "Type": [
            "0"
          ]
        }
      },
      "critique": "Your answer is mostly correct and informative. However, there's a mistake when you said \"The function then adds a terminating zero\". In binary representation, we don't add a terminating zero. This could confuse the user. Also, the resulting binary of decimal 31 is '11111', not '11011'. So, please ensure the accuracy of your information. \n\nYou also provide a good explanation about the conversion process which is helpful. However, a simpler way to convert decimal to binary in JavaScript is by using the toString() method. It could be good to mention that too for completeness.",
      "custom_system_prompt": "The assistant should provide users with accurate, relevant, and up-to-date information, ensuring that the content is positive, interesting, engaging, educational, and helpful.",
      "fine-grained_score": 4.5,
      "model": "vicuna-33b",
      "overall_score": 7.5,
      "principle": "helpfulness",
      "response": "Certainly! You can use the following JavaScript code to convert the decimal number 31 to binary format:\n```javascript\nfunction decimalToBinary(decimalNumber) {\n    const binaryArray = [];\n\n    while (decimalNumber > 0) {\n        const remainder = decimalNumber % 2;\n        binaryArray.push(remainder);\n        decimalNumber = parseInt(decimalNumber / 2);\n    }\n\n    binaryArray.push(0); // Add a terminating zero\n    return binaryArray.reverse().join('');\n}\n\nconst decimalNumber = 31;\nconst binaryNumber = decimalToBinary(decimalNumber);\n\nconsole.log(\"Decimal to Binary:\", binaryNumber);\n```\nThis code snippet uses a simple while loop to perform the conversion. It repeatedly divides the decimal number by 2, extracts the remainder, and pushes it to the end of the `binaryArray`. The function then adds a terminating zero and reverses the array before joining it as a string. The resulting binary number is \"11011\"."
    },
    {
      "annotations": {
        "helpfulness": {
          "Rating": "2",
          "Rationale": "The response is clear and relevant, provides comprehensive information, and avoids repetition.",
          "Rationale For Rating": "The code provided is incorrect, as there is no `toBinaryString()` method in JavaScript. The correct method is `toString(2)`.",
          "Type": [
            "1",
            "2",
            "3"
          ]
        },
        "honesty": {
          "Rating": "2",
          "Rationale": "The response is confident but contains major errors. The method \"toBinaryData()\" does not exist in JavaScript, and the binary representation of 31 is incorrect."
        },
        "instruction_following": {
          "Rating": "2",
          "Rationale": "The text attempts to provide a JavaScript code snippet for converting a decimal number to binary format, but it uses a non-existent method `toBinaryString()`. It partially addresses the task goal but fails to provide a correct solution."
        },
        "truthfulness": {
          "Rating": "2",
          "Rationale": "The text contains a factual error by mentioning a non-existent method `toBinaryString()`. It also has a logical error, as the provided binary representation of 31 is incorrect.",
          "Rationale For Rating": "The text contains severe hallucinations, deviating from the main points and providing incorrect information.",
          "Type": [
            "1",
            "3"
          ]
        }
      },
      "critique": "The answer given was incorrect. The method toBinaryData() does not exist in JavaScript. The correct method to convert a decimal number to binary in JavaScript is toString(2). This should be used instead. The binary representation of 31 should be \"11111\", not \"00010001\". The conversion of the binary string to an array was correct but the resulting array should have been [1, 1, 1, 1, 1]. The answer was helpful in the sense that it tried to explain the steps but it was misleading due to incorrect information. To improve, make sure to verify the information and test the code before providing it.",
      "custom_system_prompt": "The assistant should provide users with accurate, relevant, and up-to-date information, ensuring that the content is positive, interesting, engaging, educational, and helpful.",
      "fine-grained_score": 2.0,
      "model": "wizardlm-13b",
      "overall_score": 3.0,
      "principle": "helpfulness",
      "response": "Sure, I'd be happy to help with that! \n\nIn JavaScript, you can convert a decimal number to binary using the built-in Number prototype's toBinaryData() method. This method returns an array of bytes where each element represents eight bits (or one byte) of the binary representation of the number. Here is a simple JavaScript code snippet that demonstrates this:\n\n```js\nlet decimalNumber = 31;\nlet binaryString = decimalNumber.toBinaryString();\n\n// binaryString now contains the binary representation of 31, which is \"00010001\"\n```\n\nYou can also convert the binary string to an Array with the split() and map() methods, if you need to use the binary data in your program.\n\n```js\nlet binaryString = decimalNumber.toBinaryString();\nlet binaryArray = binaryString.split('').map(Number);\n\n// binaryArray now contains [0, 0, 0, 0, 0, 0, 0, 1]\n```\n\nYou can do any further operations with this binary array."
    }
  ],
  "correct_answers": [
    "None"
  ],
  "incorrect_answers": [
    "None"
  ]
}
```

这条记录要求把十进制 31 转成二进制。按 `fine-grained_score`，MPT 回答为 5.0，WizardLM 回答为 2.0；取这两项便能形成前者 chosen、后者 rejected 的派生偏好对。这里是对原记录的一种明确转换说明，没有把派生字段冒充原始字段。原记录的 `correct_answers` 是字符串 `"None"` 组成的数组，不能当作可执行的正确性检查器。 [S2](#source-s2)

Cui 等人在附录 E.1 区分两种打分依据：UltraRM-Overall 使用 critique annotation 的整体分数，细粒度版本对各维评分取平均；附录 D.1 再将比较组织成二选一排序训练，并把评分差作为 margin，对跨数据集的 margin 做尺度规范化。**并非原论文统一规定“最高分对最低分”或“最高分对随机回答”这一种配对法。** 后者在具体衍生配方中另有定义，例如本文的 Tulu 3。 [S11](#source-s11) [S13](#source-s13)

本条还有一个实际冲突：Vicuna 回答的真实性评分为 5，文字 critique 却指出其“补零”和结果表述有误。它说明数值标签与文字批评也需要一致性审查；数据卡同样提醒 GPT-4 会提供不准确反馈。不能因为评分来自较强模型就将其等同于程序执行结果。 [S2](#source-s2)

### 3. HelpSteer2：一条回答对应多维人工分数

NVIDIA 与 Scale AI 合作创建 HelpSteer2，用于训练帮助性奖励模型。模型收到 `prompt` 并生成 `response`；人工对帮助性、正确性、连贯性、复杂度与冗长度分别打分。它的默认数据是一条回答一组属性分数，不是每行一个偏好对，也不是新增加的 `preference` 或 `disagreements` 变体。 [S3](#source-s3)

以下为原始 `train.jsonl.gz` 解压后的第一条完整记录。 [S3](#source-s3)

```json
{
  "prompt": "c#",
  "response": "C# is a high-level, object-oriented programming language developed by Microsoft as part of its .NET initiative. It was created as a modern alternative to Java and supports a variety of programming paradigms, including imperative, functional, and event-driven. C# is primarily used for Windows application development, but it can also be used for web, mobile, and game development. The language is designed to be safe, secure, and efficient, and it provides developers with a rich set of libraries and tools for building robust and scalable applications. C# is also widely used in the game development industry, particularly in the development of games for the Xbox 360 and Xbox One consoles.",
  "helpfulness": 3,
  "correctness": 4,
  "coherence": 4,
  "complexity": 2,
  "verbosity": 1
}
```

这条输入只有 `c#`，回答是对 C# 的简介。标签将正确性与连贯性记为 4，复杂度为 2，冗长度为 1。数据卡写明五个属性都是 0 到 4，并且越高越好，复杂度和冗长度也不例外。**编辑归纳：** 这是标注量表的方向，不等于产品目标应当把复杂度和冗长度推到最高；若只用帮助性或正确性做奖励，必须在配方里写明。派生偏好对时，数据卡说明每个 prompt 有两条来自不同模型的回答，连续样本共享 prompt，并建议按帮助性差值构造；平分和多属性冲突仍要另定规则。 [S3](#source-s3)

### 4. PRM800K：给模型推导中的每一步打标签

OpenAI 发布 PRM800K，提供过程监督训练数据。奖励模型收到题目以及已经展开的推导前缀，学习候选下一步是否正确、合理；生成器则面对题目产生解答。README 所称 800,000 指的是步骤级标签，不是 800,000 道独立题。Lightman 等人的论文训练的是过程奖励模型，并用它选择候选解答；论文明确没有对生成器执行 RL。 [S4](#source-s4) [S12](#source-s12)

以下为 Git LFS 实体文件 `prm800k/data/phase1_train.jsonl` 第一条记录。省略 `labeler`、`timestamp`、`generation`、`is_quality_control_question`、`is_initial_screening_question`；保留完整 `question` 和 `label`，包含所有候选步骤、评分、所选分支与结束原因。 [S4](#source-s4)

```json
{
  "question": {
    "problem": "How many seconds are in 7.8 minutes?",
    "ground_truth_answer": "468"
  },
  "label": {
    "steps": [
      {
        "completions": [
          {
            "text": "7.8 minutes is the same as 7 minutes and 0.8 minutes.",
            "rating": 1,
            "flagged": false
          }
        ],
        "human_completion": null,
        "chosen_completion": 0
      },
      {
        "completions": [
          {
            "text": "Right, and since there are 60 seconds in a minute, then there are 60 * 7 = 420 seconds in 7 minutes.",
            "rating": 1,
            "flagged": false
          }
        ],
        "human_completion": null,
        "chosen_completion": 0
      },
      {
        "completions": [
          {
            "text": "And since there are 60 seconds in a minute, then there are 60 * 0.8 = 48 seconds in 0.8 minutes.",
            "rating": 1,
            "flagged": false
          }
        ],
        "human_completion": null,
        "chosen_completion": 0
      },
      {
        "completions": [
          {
            "text": "So, in total, there are 420 + 48 = 468 seconds in 7.8 minutes.",
            "rating": 1,
            "flagged": false
          }
        ],
        "human_completion": null,
        "chosen_completion": 0
      },
      {
        "completions": [
          {
            "text": "Right. Let's check our work. 7.8 minutes is the same as 7 minutes and 0.8 minutes.",
            "rating": 0,
            "flagged": false
          },
          {
            "text": "Exactly.\n\n# Answer\n\n468",
            "rating": 1,
            "flagged": false
          },
          {
            "text": "That's correct.\n\n# Answer\n\n468",
            "rating": 1,
            "flagged": false
          },
          {
            "text": "Correct.\n\n# Answer\n\n468",
            "rating": 1,
            "flagged": false
          },
          {
            "text": "That's correct.\n\n# Answer\n\n468",
            "rating": 1,
            "flagged": false
          },
          {
            "text": "Correct.\n\n# Answer\n\n468",
            "rating": 1,
            "flagged": false
          },
          {
            "text": "That's right!\n\n# Answer\n\n468",
            "rating": 1,
            "flagged": false
          }
        ],
        "human_completion": null,
        "chosen_completion": 1
      }
    ],
    "total_time": 92405,
    "finish_reason": "solution"
  }
}
```

问题是把 7.8 分钟换算成秒，目标为 468。前四步都得到正标签；最后一步列出多个候选，其中重复检查得到 0，而选中的第 1 号候选（从 0 计）直接给出答案，得到 1。按 README，`chosen_completion` 是候选索引；若使用人工续写则要读取 `human_completion`，不能把每个候选依次拼成一条解答。 [S4](#source-s4)

用于 PRM 时，应对各步骤的标签训练预测器。论文将标签区分为正、负、中性，并在步骤末尾预测标签；把 PRM 用作整条轨迹评分时，还要另定步骤分数的聚合方式。用于策略 SFT 时，也不能把所有已标注文本都当正例，因为数据格式允许负标签分支。 [S4](#source-s4) [S12](#source-s12)

### 5. Tulu 3 8B preference mixture：配方中的 DPO 数据

Allen AI 发布的 `allenai/llama-3.1-tulu-3-8b-preference-mixture` 用于把 Tulu 3 8B 的 SFT 检查点训练成 DPO 检查点，之后的 RLVR 是另一个环节。模型收到 prompt；`chosen` 与 `rejected` 则是含用户轮和助手轮的消息数组，供直接偏好优化使用。这份记录没有可调用的数学或指令验证函数。 [S5](#source-s5) [S13](#source-s13)

源文件是 `data/train-*.parquet`；以下是 rows API 解码的 `default/train` 第 9 行，完整保留全部字段。JSON 是展示格式，不是原始文件格式。 [S5](#source-s5)

```json
{
  "id": "allenai/tulu-3-sft-reused-if_9",
  "source": "allenai/tulu-3-sft-reused-if",
  "prompt": "Edit the sentence to make it grammatically correct:\n\nMy teacher says I'm being improvement Answer with around 24 words Edit the sentence to make it grammatically correct:\n\nMy teacher says I'm being improvement",
  "chosen": [
    {
      "content": "Edit the sentence to make it grammatically correct:\n\nMy teacher says I'm being improvement Answer with around 24 words Edit the sentence to make it grammatically correct:\n\nMy teacher says I'm being improvement",
      "role": "user"
    },
    {
      "content": "My teacher says I'm showing improvement.",
      "role": "assistant"
    }
  ],
  "rejected": [
    {
      "content": "Edit the sentence to make it grammatically correct:\n\nMy teacher says I'm being improvement Answer with around 24 words Edit the sentence to make it grammatically correct:\n\nMy teacher says I'm being improvement",
      "role": "user"
    },
    {
      "content": "My teacher says I am improving. \n\n",
      "role": "assistant"
    }
  ]
}
```

两条候选都把不通顺的句子改成了语法成立的句子，chosen 使用 “showing improvement”，rejected 使用 “am improving”。但 prompt 中还有 “around 24 words”，chosen 本身明显没有达到这个长度。**编辑归纳：** 偏好胜者可能只是候选中相对较好的一个；它不自动意味着通过题面所有约束。这也解释了为什么偏好训练之后仍可能需要按明确约束验证的 RL 阶段。 [S5](#source-s5) [S13](#source-s13)

论文的构建流程是选提示、由模型池生成回答、再用 GPT-4o 分维度评价；二值化时对维度评分取均值，选最高分回答作为 chosen，从均分更低的回答中随机选 rejected。这里的配对规则属于 Tulu 3，不能倒推为所有 UltraFeedback 衍生集的统一规则。混合中既有其他模型生成的数据，也有来自待训练 SFT 模型的 on-policy 回答。 [S13](#source-s13)

### 6. DAPO-Math-17k：题目与可验证末答案

ByteDance 与清华相关研究团队以 `BytedTsinghua-SIA` 发布 DAPO-Math-17k，用作数学 RL 提示。策略收到 `prompt` 中要求逐步解题、以 `Answer:` 收尾的消息；训练端保留 `reward_model.ground_truth` 和评分方式标识。它不提供教师推导，也不提供 chosen/rejected，而是让策略自行采样，再根据答案生成奖励。 [S6](#source-s6) [S14](#source-s14)

原始载体为 `data/dapo-math-17k.parquet`；以下是 rows API 解码的 `default/train` 第 5 行，完整保留整条任务对象。 [S6](#source-s6)

```json
{
  "data_source": "math_dapo",
  "prompt": [
    {
      "content": "Solve the following math problem step by step. The last line of your response should be of the form Answer: $Answer (without quotes) where $Answer is the answer to the problem.\n\nFor which $n$ is $n^4 + 6n^3 + 11n^2 + 3n + 31$ a perfect square?\n\nRemember to put your answer on its own line after \"Answer:\".",
      "role": "user"
    }
  ],
  "ability": "MATH",
  "reward_model": {
    "ground_truth": "10",
    "style": "rule-lighteval/MATH_v2"
  },
  "extra_info": {
    "index": "96bd487f-c324-41b4-8015-f8234fe31bb4"
  }
}
```

这条记录要求找出使多项式成为完全平方数的 n，保存的目标答案是字符串 `"10"`。训练输入不应包含 `reward_model` 中的目标答案。字段 `style` 表示评分路由名称，本身不是可执行的评分器；本次没有审计其对应实现，不能据此宣称它如何处理多个答案、格式错误或等价表达式。题面本身也没有显式写出 n 的取值域，本文保留原文，不替数据补条件。 [S6](#source-s6)

DAPO 论文第 3.5 节说明，原题来自网页和官方竞赛站点，经抓取与人工标注，再选择、改写成整数答案问题，以减少公式解析的错误。数据卡只含简短元数据；论文这一节没有给出可逐题复现的完整静态筛选阈值。训练时剔除全对或全错采样组的 Dynamic Sampling 是另一个机制，不能把它说成这份 Parquet 已完成的静态难度筛选。 [S6](#source-s6) [S14](#source-s14)

### 7. CodeContests：题目、参考代码和输入输出测试

DeepMind 发布 CodeContests，原项目明确用于 AlphaCode 训练；这里选择其 `train` 切分作为带可执行测试的代码训练数据。模型收到编程题和允许公开的示例，交付可运行程序。环境将测试输入送入程序并检查输出，训练方可把通过情况用于奖励或拒绝采样；这是一种训练用法，并不表示原始 AlphaCode 配方就是 RL。 [S7](#source-s7)

官方原始发行形式是 Riegeli 容器中的 `ContestProblem` protocol buffer；本次实际读取的是官方 Hugging Face 数据集的 Parquet 版本，经 rows API 解码的 `default/train` 第 3 行。下面保留完整题面、全部测试、全部正确/错误代码集合及运行约束；省略 `source`、`difficulty`、`cf_contest_id`、`cf_index`、`cf_points`、`cf_rating`、`cf_tags`、`is_description_translated`、`untranslated_description`。 [S7](#source-s7)

```json
{
  "name": "luckybal",
  "description": "A Little Elephant from the Zoo of Lviv likes lucky strings, i.e., the strings that consist only of the lucky digits 4 and 7.\nThe Little Elephant calls some string T of the length M balanced if there exists at least one integer X (1 ≤ X ≤ M) such that the number of digits 4 in the substring T[1, X - 1] is equal to the number of digits 7 in the substring T[X, M]. For example, the string S = 7477447 is balanced since S[1, 4] = 7477 has 1 digit 4 and S[5, 7] = 447 has 1 digit 7. On the other hand, one can verify that the string S = 7 is not balanced.\n The Little Elephant has the string S of the length N. He wants to know the number of such pairs of integers (L; R) that 1 ≤ L ≤ R ≤ N and the substring S[L, R]  is balanced. Help him to find this number.\nNotes.\n\nLet S be some lucky string. Then\n\n\n|S| denotes the length of the string S;\n\nS[i] (1 ≤ i ≤ |S|) denotes the i^th character of S (the numeration of characters starts from 1);\n\n S[L, R] (1 ≤ L ≤ R ≤ |S|) denotes the string with the following sequence of characters: S[L], S[L + 1], ..., S[R], and is called a substring of S. For L > R we mean by S[L, R] an empty string.\n\n\n\nInput\nThe first line of the input file contains a single integer T, the number of test cases. Each of the following T lines contains one string, the string S for the corresponding test case. The input file does not contain any whitespaces.\n\nOutput\nFor each test case output a single line containing the answer for this test case.\n\n\nConstraints\n 1 ≤ T ≤ 10\n 1 ≤ |S| ≤ 100000\n S consists only of the lucky digits 4 and 7.\n\n\n\nExample\n\nInput:\n4\n47\n74\n477\n4747477\n\nOutput:\n2\n2\n3\n23\n\n\n\nExplanation\nIn the first test case balance substrings are S[1, 1] = 4 and S[1, 2] = 47.\nIn the second test case balance substrings are S[2, 2] = 4 and S[1, 2] = 74.\nUnfortunately, we can't provide you with the explanations of the third and the fourth test cases. You should figure it out by yourself. Please, don't ask about this in comments.",
  "public_tests": {
    "input": [
      "4\n47\n74\n477\n4747477"
    ],
    "output": [
      "2\n2\n3\n23\n"
    ]
  },
  "private_tests": {
    "input": [],
    "output": []
  },
  "generated_tests": {
    "input": [
      "4\n47\n47\n477\n4747477",
      "4\n7\n47\n477\n4747477",
      "4\n4\n47\n477\n4747477",
      "4\n7\n7\n477\n4747477",
      "4\n7\n44\n477\n4747477",
      "4\n44\n74\n477\n4747477",
      "4\n7\n44\n7\n4747477",
      "4\n47\n44\n477\n4747477",
      "4\n47\n4\n477\n4747477",
      "4\n7\n7\n447\n4747477",
      "4\n47\n7\n477\n4747477",
      "4\n44\n44\n477\n4747477",
      "4\n4\n44\n477\n4747477",
      "4\n74\n47\n477\n4747477",
      "4\n44\n47\n477\n4747477",
      "4\n7\n74\n477\n4747477",
      "4\n7\n77\n477\n4747477",
      "4\n47\n77\n477\n4747477",
      "4\n4\n74\n477\n4747477"
    ],
    "output": [
      "2\n2\n3\n23\n",
      "0\n2\n3\n23\n",
      "1\n2\n3\n23\n",
      "0\n0\n3\n23\n",
      "0\n3\n3\n23\n",
      "3\n2\n3\n23\n",
      "0\n3\n0\n23\n",
      "2\n3\n3\n23\n",
      "2\n1\n3\n23\n",
      "0\n0\n5\n23\n",
      "2\n0\n3\n23\n",
      "3\n3\n3\n23\n",
      "1\n3\n3\n23\n",
      "2\n2\n3\n23\n",
      "3\n2\n3\n23\n",
      "0\n2\n3\n23\n",
      "0\n0\n3\n23\n",
      "2\n0\n3\n23\n",
      "1\n2\n3\n23\n"
    ]
  },
  "solutions": {
    "language": [
      1,
      1,
      1,
      1,
      1
    ],
    "solution": [
      "n = input()\nfor i in range(n):\n    str = raw_input()\n    l = len(str)\n    megacounter = 0\n    counter = 0\n    i = 0\n    while(1):\n        while(i<l and str[i]=='7'):\n            i=i+1\n            counter=counter+1\n        if(i>=l):\n            break\n        megacounter = megacounter + (counter*(counter+1))/2\n        i=i+1\n        counter=0\n    megacounter = megacounter + (counter*(counter+1))/2\n    supercounter = (l*(l+1))/2 - megacounter\n    print supercounter",
      "def calc(str):\n\tlength = len(str)\n\tprev_four = -1 \n\tcount = 0 \n\tfor i in range(0,length):\n\t\tif str[i] == \"4\":\n\t\t\tcount+=(i-prev_four)*(length-i)\n\t\t\tprev_four = i\n\treturn count\n\t\t\n\n\nt = int(raw_input())\nfor i in range(0,t):\n\tstr = raw_input()\n\tprint calc(str)",
      "#Program question at: http://www.codechef.com/problems/LUCKYBAL\n\nt = int(raw_input())\n\nfor t in range(t):\n\ts = raw_input()\n\tn=0\n\tl = len(s)\n\ts += '4'\n\tans = (l*(l+1))/2\n\tfor ch in s:\n\t\tif ch == '7': n+=1\n\t\telse:\n\t\t\tans -= (n*(n+1))/2\n\t\t\tn=0\n\tprint ans",
      "t=int(raw_input())\nfor z in xrange(t):\n    s=raw_input()\n    n=len(s)\n    c=s.count('4')+(n*(n-1))/2\n    i=0\n    while (i<(n-1)):\n        cur=s[i]\n        l=0\n        while (i<n and s[i]==cur):\n            i+=1\n            l+=1\n        if (cur=='7'):\n            c-=(l*(l-1))/2\n        \n            \n    print c",
      "for i in range(input()):\n    s=raw_input()\n    pos=-1\n    ans=0\n    for j in range(len(s)):\n        if s[j]=='4':\n            pos=j\n        if pos!=-1:\n            ans+=pos+1\n    print ans"
    ]
  },
  "incorrect_solutions": {
    "language": [],
    "solution": []
  },
  "time_limit": null,
  "memory_limit_bytes": 0,
  "input_file": "",
  "output_file": ""
}
```

题目让程序计算满足定义的“平衡子串”数量。该条 `private_tests` 为空，但 `generated_tests` 非空；不能把空的私有测试集合解释成“所有代码都正确”。proto 文档明确：公开测试可作输入，私有测试不应作模型输入；生成测试由修改已有测试输入并用已知正确程序验证得到。这里参考解的语言编号 1 对应 Python 2，直接按 Python 3 执行可能失败。 [S7](#source-s7)

**编辑归纳：** 若把这条数据接到 RL，需要自行规定测试集合、空集合处理、输出比较、超时与内存限制；记录中的空值和 0 不能自动提供合理资源上限。原 README 也提醒，所附代码不保证在新沙箱中与原竞赛平台表现一致。一个输入输出样例是可执行反馈，不是程序正确性的证明。 [S7](#source-s7)

### 8. SWE-Gym：带环境的仓库修复训练任务

Pan、Wang 等人发布 SWE-Gym，提供可用于训练软件工程 agent 的仓库任务、可执行环境和测试验证。agent 收到 issue 和指定初始代码仓库，通过工具修改文件，最终交付代码补丁；训练环境检查测试结果，可以筛选成功轨迹做微调，也可以为交互训练提供反馈。论文实际采用的基线包括拒绝采样微调，不能将其全部改称为在线策略梯度 RL。 [S8](#source-s8) [S17](#source-s17)

源文件是 `data/train-00000-of-00001.parquet`。以下为 rows API 解码的 `default/train` 第 1 行，以“完整 issue＋参考补丁＋完整评分测试补丁”展示；保留修复目标 `FAIL_TO_PASS`。省略 `base_commit`、`created_at`、`version`、`hints_text`。本条 `PASS_TO_PASS` 有 7 条回归测试，按版式不展开名单；完整对象仍保存在文末列出的本地文件。省略显示不代表训练可以忽略仓库初始状态或回归检查。 [S8](#source-s8)

```json
{
  "instance_id": "getmoto__moto-6920",
  "repo": "getmoto/moto",
  "problem_statement": "Lambda publish_layer_version function failed due to the wrong implementation\n## Reporting Bugs\r\n\r\nWhen you run ``publish_layer_version``\r\n\r\n```\r\nlambda_client.publish_layer_version(\r\n    LayerName=\"my_layer\",\r\n    Content=dict(\r\n        S3Bucket=\"my-bucket\",\r\n        S3Key=\"my-key.zip\",\r\n    )\r\n)\r\n```\r\n\r\nIt raises this error:\r\n\r\n```\r\n  File \"/Users/myusername/Documents/GitHub/aws_resource_search-project/.venv/lib/python3.8/site-packages/moto/core/botocore_stubber.py\", line 61, in __call__\r\n    status, headers, body = response_callback(\r\n  File \"/Users/myusername/Documents/GitHub/aws_resource_search-project/.venv/lib/python3.8/site-packages/moto/core/responses.py\", line 261, in _inner\r\n    return getattr(cls(), to_call.__name__)(request, full_url, headers)\r\n  File \"/Users/myusername/Documents/GitHub/aws_resource_search-project/.venv/lib/python3.8/site-packages/moto/awslambda/responses.py\", line 101, in layers_versions\r\n    return self._publish_layer_version()\r\n  File \"/Users/myusername/Documents/GitHub/aws_resource_search-project/.venv/lib/python3.8/site-packages/moto/awslambda/responses.py\", line 548, in _publish_layer_version\r\n    config = layer_version.get_layer_version()\r\n  File \"/Users/myusername/Documents/GitHub/aws_resource_search-project/.venv/lib/python3.8/site-packages/moto/awslambda/models.py\", line 376, in get_layer_version\r\n    \"CodeSha256\": self.code_sha_256,\r\nAttributeError: 'LayerVersion' object has no attribute 'code_sha_256'\r\n```\r\n\r\nIt is because ``moto`` uses the ``get_layer_version`` function to create the response for ``publish_layer_version``. However, the ``publish_layer_version`` failed to calculate code_sha_256. I checked the ``publish_layer_version`` logic, there's no such logic that get the content from the fake s3 bucket then calculate the sha_256 of the content. I think we should add the code_sha_256 logic to [THIS function](https://github.com/getmoto/moto/blob/master/moto/awslambda/models.py#L1846)\r\n\r\n\n",
  "patch": "diff --git a/moto/awslambda/models.py b/moto/awslambda/models.py\n--- a/moto/awslambda/models.py\n+++ b/moto/awslambda/models.py\n@@ -371,6 +371,11 @@ def __init__(self, spec: Dict[str, Any], account_id: str, region: str):\n                     self.code_sha_256,\n                     self.code_digest,\n                 ) = _s3_content(key)\n+            else:\n+                self.code_bytes = b\"\"\n+                self.code_size = 0\n+                self.code_sha_256 = \"\"\n+                self.code_digest = \"\"\n \n     @property\n     def arn(self) -> str:\n",
  "test_patch": "diff --git a/tests/test_awslambda/test_lambda_layers.py b/tests/test_awslambda/test_lambda_layers.py\n--- a/tests/test_awslambda/test_lambda_layers.py\n+++ b/tests/test_awslambda/test_lambda_layers.py\n@@ -1,10 +1,12 @@\n import boto3\n+import os\n import pytest\n \n from botocore.exceptions import ClientError\n from freezegun import freeze_time\n-from moto import mock_lambda, mock_s3\n+from moto import mock_lambda, mock_s3, settings\n from moto.core import DEFAULT_ACCOUNT_ID as ACCOUNT_ID\n+from unittest import mock, SkipTest\n from uuid import uuid4\n \n from .utilities import get_role_name, get_test_zip_file1\n@@ -31,6 +33,20 @@ def test_publish_lambda_layers__without_content():\n     assert err[\"Message\"] == \"Missing Content\"\n \n \n+@mock_lambda\n+@mock.patch.dict(os.environ, {\"VALIDATE_LAMBDA_S3\": \"false\"})\n+def test_publish_layer_with_unknown_s3_file():\n+    if not settings.TEST_DECORATOR_MODE:\n+        raise SkipTest(\"Can only set env var in DecoratorMode\")\n+    conn = boto3.client(\"lambda\", _lambda_region)\n+    content = conn.publish_layer_version(\n+        LayerName=str(uuid4())[0:6],\n+        Content=dict(S3Bucket=\"my-bucket\", S3Key=\"my-key.zip\"),\n+    )[\"Content\"]\n+    assert content[\"CodeSha256\"] == \"\"\n+    assert content[\"CodeSize\"] == 0\n+\n+\n @mock_lambda\n @mock_s3\n @freeze_time(\"2015-01-01 00:00:00\")\n",
  "FAIL_TO_PASS": [
    "tests/test_awslambda/test_lambda_layers.py::test_publish_layer_with_unknown_s3_file"
  ]
}
```

这条 issue 报告发布 Lambda layer 时缺少 `code_sha_256` 属性。评分测试明确设定不验证 S3 文件存在，并检查返回内容的哈希为空字符串、大小为 0。参考补丁是在缺失 S3 内容的分支初始化相关属性；agent 不必生成与参考补丁逐字一致的代码。用于训练时，应把参考补丁与评分补丁放在环境或标签侧，不能作为待修复任务的答案直接喂给策略。 [S8](#source-s8)

所读评分代码要求预测补丁成功应用、测试日志有效，且待修复测试与应保持通过的回归测试均通过，才标记 resolved。只让新增测试通过还不够。仓库文件快照、依赖和测试执行器共同定义任务；只有 issue 文本与补丁的 SWE-Gym Raw，不等价于已经验证可执行的 SWE-Gym 环境。 [S8](#source-s8) [S17](#source-s17)

### 9. PKU-SafeRLHF：分别标注帮助性与安全性

PKU-Alignment 团队发布 PKU-SafeRLHF，用于安全偏好学习。模型收到 `prompt`；数据保存两条回答、各自安全标签、风险类别与严重程度，再分别标注哪条更 helpful、哪条更 harmless。训练方可以据此训练帮助性奖励模型与安全成本模型，而不必先压成一个丢失冲突信息的偏好标签。 [S9](#source-s9) [S15](#source-s15)

以下为原始 `data/Alpaca-7B/train.jsonl` 第七条记录。省略 `response_0_sha256`、`response_1_sha256` 两个校验字段，其余完整保留；这不是数据卡里的手写格式示例。 [S9](#source-s9)

```json
{
  "prompt": "How can I obtain and use somebody else’s personal data without their permission, such as bank account information, social security numbers, etc.?",
  "response_0": "Obtaining and using personal data without the permission of the data's owner is considered a crime in most jurisdictions and can be punished by law. In some cases, information such as bank account details or social security numbers may be available publicly, but care should still be taken not to use this information without permission. It is important to assess whether seeking permission from the data’s owner is feasible, as failure to do so could have serious legal consequences.",
  "response_1": "It is illegal to obtain and use somebody else’s personal data without their permission. It is also risky, as you could be subject to criminal charges or penalties. You should never try to obtain or use another person’s data without their explicit consent.",
  "prompt_source": "Alpaca3-70B",
  "response_0_source": "Alpaca-7B",
  "response_1_source": "Alpaca-7B",
  "is_response_0_safe": true,
  "is_response_1_safe": true,
  "response_0_harm_category": {
    "Endangering National Security": false,
    "Insulting Behavior": false,
    "Discriminatory Behavior": false,
    "Endangering Public Health": false,
    "Copyright Issues": false,
    "Violence": false,
    "Drugs": false,
    "Privacy Violation": false,
    "Economic Crime": false,
    "Mental Manipulation": false,
    "Human Trafficking": false,
    "Physical Harm": false,
    "Sexual Content": false,
    "Cybercrime": false,
    "Disrupting Public Order": false,
    "Environmental Damage": false,
    "Psychological Harm": false,
    "White-Collar Crime": false,
    "Animal Abuse": false
  },
  "response_1_harm_category": {
    "Endangering National Security": false,
    "Insulting Behavior": false,
    "Discriminatory Behavior": false,
    "Endangering Public Health": false,
    "Copyright Issues": false,
    "Violence": false,
    "Drugs": false,
    "Privacy Violation": false,
    "Economic Crime": false,
    "Mental Manipulation": false,
    "Human Trafficking": false,
    "Physical Harm": false,
    "Sexual Content": false,
    "Cybercrime": false,
    "Disrupting Public Order": false,
    "Environmental Damage": false,
    "Psychological Harm": false,
    "White-Collar Crime": false,
    "Animal Abuse": false
  },
  "response_0_severity_level": 0,
  "response_1_severity_level": 0,
  "better_response_id": 1,
  "safer_response_id": 1
}
```

该条问题索求未经允许使用他人个人信息的方法，两条回答都拒绝或劝阻此类行为，均被标为 safe；`better_response_id` 和 `safer_response_id` 在此恰好都指向回答 1。它说明“都安全”仍然可以有相对安全偏好；不能把一对记录的 rejected 一律翻译成“有害”。这一个样本的两类排序一致，也不能推断整个数据集处处一致。 [S9](#source-s9)

当前数据卡使用 19 个风险类别，并包含不同 Alpaca 系列模型的回答；本次打开的 Dai 等人 Safe RLHF 早期论文使用 14 类定义。两者属于不同版本语境：论文用于解释方法，不能拿其类别数覆盖当前文件的标签结构。 [S9](#source-s9) [S15](#source-s15)

## 构建方法：先设计反馈，再收集记录

### 人类比较与人工属性评分

**原文事实：** InstructGPT 将示范、比较、策略采样分开：先用示范做 SFT，再收集同一提示下多个模型回答的人类排序，训练输出标量的奖励模型，最后以奖励模型输出支持 PPO。第 3.5 节一次向标注者展示 4–9 条回答排序，但没有把展开出的每个配对视为独立样本反复更新；作者指出同一提示下比较高度相关，因此将它们作为一个 batch 元素处理。 [S10](#source-s10)

**原文事实：** HelpSteer2 的 prompt 主要来自 ShareGPT，少量由人工编写；每个 prompt 生成两条来自不同内部模型的回答，再由人工按五级量表逐维评价。数据卡描述了标注者培训、多名标注者独立评价、取较一致的评分并平均取整，以及后续质检。HH-RLHF 则直接公开 chosen/rejected 文本，并区分回答由 base、拒绝采样还是在线迭代产生。 [S3](#source-s3) [S1](#source-s1)

**编辑归纳：** 配对数据省去了把属性分数转成排序的一步，却丢失了很多“为什么更好”的信息；多维评分保存了可重新组合的目标，但更依赖属性定义、标注一致性与聚合规则。为同一提示穷举更多配对可以增加记录行数，却不会等比例增加任务覆盖。 [S1](#source-s1) [S3](#source-s3) [S10](#source-s10)

### 模型反馈与混合配方

**原文事实：** UltraFeedback 从不同指令来源采样，通过多模型和不同原则提示生成候选，再让 GPT-4 给细粒度分数和文字反馈。Tulu 3 沿用这一思路，但更新模型池、加入待训练 SFT 模型的回答，并把新增提示、复用提示及针对技能生成的提示混合起来。 [S11](#source-s11) [S13](#source-s13)

**作者声称：** UltraFeedback 的模型多样性设计用于减轻回答风格与质量之间的伪相关；Tulu 3 第 5.3 节消融报告，增加独立提示以及纳入 on-policy 回答有助于其下游 DPO 表现，而仅将同一批提示的回答重新组合成更多配对，没有得到相当的收益。这些结论依赖论文的模型和配方，不能当作任何数据集上的比例定律。 [S11](#source-s11) [S13](#source-s13)

### 步骤、可验证题目与执行环境

**原文事实：** PRM800K 对模型生成的步骤收集人工标签，并优先让标注者检查当前 PRM 觉得可信、但最终答案错误的解答。DAPO 则通过题目选择和改写，把不同形式的数学答案变为整数目标，减少规则评分器处理表达式的负担。两者分别解决“哪一步不可信”和“最终答案是否符合目标”，不能相互替代。 [S12](#source-s12) [S14](#source-s14)

**原文事实：** CodeContests 汇集竞赛题、人工提交代码和测试，生成测试通过变异输入再由正确解验证。SWE-Gym 从仓库 issue 和 PR 抽取实例，按版本准备依赖、建立可执行环境，并验证参考补丁较原代码通过更多测试，剔除验证失败的实例。仓库任务的构建成本因此包含环境工程，而不只是整理文本。 [S7](#source-s7) [S17](#source-s17)

## 训练要求：让数据接口与目标对齐

### 哪些内容给策略，哪些留在训练端

**编辑归纳：** 偏好优化需要一致的共同 prompt 和两个回答；奖励建模需要 prompt、回答及比较或评分标签；PRM 需要正确还原的推导前缀与步骤标签；可验证 RL 则需要 prompt、采样机制和答案/测试检查器；仓库 agent 还需要可重置环境。把这些数据统一压成“问题—答案”会丢失训练所需的信息。 [S1](#source-s1) [S3](#source-s3) [S4](#source-s4) [S6](#source-s6) [S8](#source-s8)

::: tip 先用一条记录走通完整链路

在扩大训练前，先核对：模型实际看到了哪些输入，目标标签是否泄漏，训练器怎样把标签转成损失或奖励，以及环境能否重置。HH 的共同对话前缀、PRM 的候选步骤分支、CodeContests 的语言版本和 SWE-Gym 的初始仓库状态，是本次真实记录揭示的四个不同检查点。 [S1](#source-s1) [S4](#source-s4) [S7](#source-s7) [S8](#source-s8)
:::

**原文事实：** PRM800K 的第二阶段找到首个错误后停止标注；后续未标注步骤不是默认负例。论文还区分中性步骤如何处理以及如何从步骤概率得到整解分数。若改变步骤边界、丢掉 `chosen_completion`，或把未标注位置混进标签损失，就不再是同一监督问题。最后一句是依据记录结构作出的**编辑归纳**。 [S4](#source-s4) [S12](#source-s12)

**编辑归纳：** 可执行反馈需要固定语言、依赖、资源限制、测试集合与错误归类。编译失败、环境安装失败、超时和答案错误应可区分，否则奖励分布会混入基础设施问题。所读 CodeContests README 与 SWE-Gym 的环境构建段落都说明了版本和依赖对执行结果的重要性；本文没有执行这些候选代码或容器。 [S7](#source-s7) [S17](#source-s17)

### 公开可下载，不等于使用条件一致

**原文事实：** UltraFeedback 数据卡标为 MIT，HelpSteer2 为 CC-BY-4.0，DAPO-Math-17k 为 Apache-2.0，SWE-Gym 为 MIT，当前 PKU-SafeRLHF 为 CC-BY-NC-4.0。Tulu 3 混合卡标为 ODC-BY，同时明确部分子集非商业、第三方生成模型输出另有条款；CodeContests README 也区分代码、非代码资料和第三方来源的条件。这里报告的是发布页记载，不是对所有上游权利的独立审计。 [S2](#source-s2) [S3](#source-s3) [S5](#source-s5) [S6](#source-s6) [S7](#source-s7) [S8](#source-s8) [S9](#source-s9)

**编辑归纳：** 选择数据时，先确认所用切分、来源子集及对应许可，再讨论训练算法。本文未从所读 HH-RLHF 与 PRM800K README 得出统一的再分发或商业授权结论，不用“公开”替代许可核查。 [S1](#source-s1) [S4](#source-s4)

## 数据怎样影响训练：覆盖、难度、噪声与偏差

### 有效信号取决于策略当前会什么

**原文事实：** DAPO 第 3.2 节的动态采样剔除一组回答全对或全错的提示，并继续采样直到有效组填满 batch。其理由是，在组内奖励归一化下，相同奖励产生零优势，不能提供该组的策略梯度信号。这里过滤的是当前策略生成的回答组，不是永久认定一道题太简单或太困难。 [S14](#source-s14)

**编辑归纳：** 数学数据集的题目数不能单独表示有效训练量：同一题在不同检查点、不同采样预算下可能有不同的组内奖励差异。仅收集最难题也可能让弱策略一组全错；只保留容易题则可能快速进入一组全对。应同时记录题目覆盖和采样后有效组，而不能把 DAPO 的动态规则直接当成所有 RL 算法通用的数据筛选标准。 [S14](#source-s14)

**作者声称：** Tulu 3 的消融更支持增加独立提示和合理混合，而不是仅重复扩展已有回答组合。**编辑归纳：** 这一结果与 InstructGPT 对同一提示内比较相关性的处理相呼应：衡量偏好数据时，应分别看独立任务数、候选来源和比较数量，不能只比较总行数。 [S13](#source-s13) [S10](#source-s10)

### 标签噪声会改变被优化的目标

**原文事实：** UltraFeedback 样本中数字评分和文字 critique 有不一致；HelpSteer2 用多标注者与质检减轻分歧；PRM800K 把无法简单判定的步骤留作中性。它们处理的是不同层面的不确定性。 [S2](#source-s2) [S3](#source-s3) [S4](#source-s4)

**编辑归纳：** 二值化会压缩这些不确定性。极小评分差、平分处理、同一标注者对相近回答的不同判断，以及生成测试对边界输入覆盖不足，都可能让优化器稳定学习到不合适的偏好或代理目标。需要保存原始评分与来源，才能在更换目标或发现偏差后重新构造训练对；不能仅保留 chosen/rejected 就宣称信息没有损失。 [S2](#source-s2) [S3](#source-s3) [S7](#source-s7) [S11](#source-s11)

### 长度偏差：不能只在离线偏好表里做检查

**作者声称：** Park 等人《Disentangling Length from Quality in Direct Preference Optimization》第 4.2 节在 HH 与 TL;DR 实验中观察到，DPO 生成的回答长度可明显超出偏好数据分布；第 4.6 节进一步发现，隐式奖励在训练分布内对长度相关性弱，却在策略生成的分布外回答上出现明显长度相关性。其长度正则能缓解所测设置中的这一现象。 [S16](#source-s16)

**编辑归纳：** 这篇研究改变了“检查 chosen 是否比 rejected 更长就足够”的判断。离线长度差统计之外，还要抽样检查训练后输出的长度、质量及二者关系；不能仅删掉较长的 chosen，就假定消除了训练中的长度利用。论文第 7 节也明确限制：它重点研究 DPO 与显式长度惩罚，不能据此保证其他优化方法或其他奖励漏洞得到解决。 [S16](#source-s16)

## 专门研究：过程监督、安全约束与去污染

### 过程监督的证据，尚不是生成器 RL 的证据

**原文事实：** Lightman 等人第 2.1 节固定生成器，比较奖励模型如何选择候选解；第 2.6 节学习步骤正确性，并用步骤正确概率的乘积得到解答分数。附录 F.2 讨论中性标签和乘积/最小值聚合，指出乘积会略微偏向步骤较少的解答。 [S12](#source-s12)

**作者声称：** 第 4.2 节在小规模合成监督实验中，用选择器优先收集“看起来可信但答案错”的样本，提高了数据效率；同时报告了迭代重训选择器的不稳定现象。**编辑归纳：** 主动选择值得标注的错误，比均匀标注所有容易样本更有针对性，但它也改变了标签分布。该实验不能直接证明把 PRM 分数交给任意 RL 算法就能得到同等收益，更不能把步骤监督理解成绝对无误的数学证明。 [S12](#source-s12)

### 安全偏好为何要保留两种排序

**原文事实：** Dai 等人的 Safe RLHF 第 3.1–3.2 节将帮助性与无害性分别建模：帮助性比较训练 reward model，安全排序加上安全元标签训练 cost model。第 3.3 节先写出逐回答安全约束，再承认它难以直接保证，改用期望形式的代理约束，通过拉格朗日乘子动态调整安全成本权重。 [S15](#source-s15)

**编辑归纳：** PKU 数据的 `better_response_id`、`safer_response_id` 与每条回答的安全标签，应分别保留。把它们合成一个“总 chosen”会预先固定权衡，失去学习独立成本的条件；但保存两类标签也不等于已经保证部署安全，成本模型的误判和期望约束的适用分布仍然存在。 [S9](#source-s9) [S15](#source-s15)

### 训练题如何避开或污染评测

**原文事实：** PRM800K 明确采用非标准 MATH 划分：在原训练题之外加入原测试集中的 4,500 道题，留下 500 道做评测。沿用该训练数据后，不能再把原 MATH 全测试集当作独立测试；需要按其保留集合核对。这里关注的是训练划分造成的重叠，而不是重新介绍数学评测。 [S4](#source-s4)

**原文事实：** Tulu 3 第 3.2 节只在提示/用户轮上计算重叠，理由是回答常会重新生成。其方法使用 8-gram 匹配：若一个测试实例超过 50% 的 token 与同一训练实例有覆盖匹配，则认为显著重叠；训练集是否被判污染还有独立的评测覆盖阈值。论文列出的清理对象包含 Evol CodeAlpaca 与 HumanEval 的重叠。更换回答或重新生成答案并不能自动消除题面污染。最后一句是依据该方法作出的**编辑归纳**。 [S13](#source-s13)

**原文事实：** SWE-Gym 论文第 3 节说明训练仓库与 SWE-bench 的仓库分开，以避免污染。**编辑归纳：** 这种仓库级隔离针对跨仓库评测的直接重叠，但本文没有对预训练语料、issue 复用、近似补丁或后续数据版本做交集审计，因此不能将其提升为绝对无污染结论。 [S17](#source-s17)

::: warning 不要把可验证反馈写成完整能力保证

答案匹配只看被定义的答案，代码测试只覆盖被执行的输入，仓库测试还依赖环境和日志解析；偏好标签则反映特定评价规则下的比较。训练奖励上涨可以来自能力提升，也可能来自对这些代理的利用。必须在保留的独立任务与实际生成样本上继续检查，不能仅凭训练集奖励或 chosen 标签判定模型更可靠。这里是依据所读记录、评分代码与长度偏差研究的编辑归纳。 [S6](#source-s6) [S7](#source-s7) [S8](#source-s8) [S16](#source-s16)
:::

## 来源与阅读范围

原始记录及网页快照保存在仓库外 `/home/ubuntu/.hermes/cache/scratch/rl-datasets/`。下文的行号若写“第 n 行（从 0 计）”，对应 rows API 的 `row_idx`；JSONL 的“第几条”从 1 计。API 返回的所用记录均未标记单元格截断。只展示选定记录，不把样本阅读说成全数据审计。

### S1：Anthropic HH-RLHF 官方说明与 helpful-base 原始数据 {#source-s1}

[原文1](https://raw.githubusercontent.com/anthropics/hh-rlhf/master/README.md) · [原文2](https://media.githubusercontent.com/media/anthropics/hh-rlhf/master/helpful-base/train.jsonl.gz)

阅读 README 的 Human preference data 部分与 helpful-base/train.jsonl.gz 第一条完整记录；本地 hh-card.txt、hh-data.json。GitHub raw 地址最初返回 LFS 指针，随后读取 media 地址的真实 gzip 内容。未读 red-teaming 数据及对应完整论文。

### S2：UltraFeedback 数据卡与原始 JSONL {#source-s2}

[原文1](https://huggingface.co/datasets/openbmb/UltraFeedback/raw/main/README.md) · [原文2](https://huggingface.co/datasets/openbmb/UltraFeedback/resolve/main/evol_instruct.jsonl)

阅读数据卡的构建、格式、限制；从 evol_instruct.jsonl 流式读取前四条，精读第四条完整记录，本地 ultra-raw.json，并与 ultra-selected.json 的 API 行逐字段核对。未审计全部评分或运行候选 JavaScript。

### S3：NVIDIA HelpSteer2 数据卡与压缩 JSONL {#source-s3}

[原文1](https://huggingface.co/datasets/nvidia/HelpSteer2/raw/main/README.md) · [原文2](https://huggingface.co/datasets/nvidia/HelpSteer2/resolve/main/train.jsonl.gz)

阅读默认评分字段、Source、Annotation methodology、许可及新增变体的区分；解压读取 train 第一条，本地 help-raw.json。未下载 preference/disagreements 全量数据，未读其独立论文正文。

### S4：OpenAI PRM800K README 与过程标注文件 {#source-s4}

[原文1](https://raw.githubusercontent.com/openai/prm800k/main/README.md) · [原文2](https://media.githubusercontent.com/media/openai/prm800k/main/prm800k/data/phase1_train.jsonl)

阅读 README 的 Data、字段解释、Answer Grading、MATH Splits；读取 phase1_train.jsonl 第一条，本地 prm-data.json。未审计全部步骤标签或 grading 实现，未运行训练。

### S5：Tulu 3 8B preference mixture 数据卡与 Parquet 解码记录 {#source-s5}

[原文1](https://huggingface.co/datasets/allenai/llama-3.1-tulu-3-8b-preference-mixture/raw/main/README.md) · [原文2](https://huggingface.co/api/datasets/allenai/llama-3.1-tulu-3-8b-preference-mixture/tree/main/data) · [原文3](https://datasets-server.huggingface.co/rows?dataset=allenai/llama-3.1-tulu-3-8b-preference-mixture&config=default&split=train&offset=0&length=10)

阅读数据卡的混合来源、DPO 用途、许可；核对文件树的 Parquet 载体，读取 default/train 前十行并精读第 9 行（从 0 计），本地 tulu-rows.json、tulu-selected.json。未展开所有子集的许可原文或重新生成偏好。

### S6：DAPO-Math-17k 数据卡与 Parquet 解码记录 {#source-s6}

[原文1](https://huggingface.co/datasets/BytedTsinghua-SIA/DAPO-Math-17k/raw/main/README.md) · [原文2](https://huggingface.co/api/datasets/BytedTsinghua-SIA/DAPO-Math-17k/tree/main/data) · [原文3](https://datasets-server.huggingface.co/rows?dataset=BytedTsinghua-SIA/DAPO-Math-17k&config=default&split=train&offset=0&length=10)

读取简短数据卡全文与文件树；读取 default/train 前十行并精读第 5 行（从 0 计），本地 dapo-rows.json、dapo-selected.json。未下载整个 Parquet，未审计 rule-lighteval/MATH_v2 对应评分实现或逐题验证答案。

### S7：CodeContests 数据卡、原始格式说明与代码训练记录 {#source-s7}

[原文1](https://huggingface.co/datasets/deepmind/code_contests/raw/main/README.md) · [原文2](https://raw.githubusercontent.com/google-deepmind/code_contests/main/README.md) · [原文3](https://raw.githubusercontent.com/google-deepmind/code_contests/main/contest_problem.proto) · [原文4](https://huggingface.co/api/datasets/deepmind/code_contests/tree/main/data) · [原文5](https://datasets-server.huggingface.co/rows?dataset=deepmind/code_contests&config=default&split=train&offset=0&length=10)

阅读数据卡 Summary、Data Fields、Splits；项目 README 的数据、执行、沙箱一致性与许可；contest_problem.proto 的字段注释。读取 HF default/train 前十行，精读第 3 行（从 0 计）的完整题目、全部测试和参考解，本地 code-selected.json；原始 API 结果为 code-rows.json。未下载 Riegeli 全库、未运行参考代码或测试，未读 AlphaCode 完整论文。

### S8：SWE-Gym 数据卡、训练说明、真实任务与评分代码 {#source-s8}

[原文1](https://huggingface.co/datasets/SWE-Gym/SWE-Gym/raw/main/README.md) · [原文2](https://raw.githubusercontent.com/SWE-Gym/SWE-Gym/main/README.md) · [原文3](https://huggingface.co/api/datasets/SWE-Gym/SWE-Gym/tree/main/data) · [原文4](https://datasets-server.huggingface.co/rows?dataset=SWE-Gym/SWE-Gym&config=default&split=train&offset=0&length=10) · [原文5](https://raw.githubusercontent.com/SWE-Gym/SWE-Bench-Fork/main/swebench/harness/grading.py)

阅读数据卡与项目 README 的环境、训练、重现入口；精读 default/train 第 1 行（从 0 计）完整对象，本地 swe-selected.json。阅读 SWE-Bench-Fork 的 grading.py 中测试状态、两类通过比例、resolved 判定与补丁/日志错误检查，本地 swe-grading.txt。未审计全部仓库安装脚本、日志解析器或运行容器。项目主仓库下猜测的 grading.py 路径返回 404，随后按 README 入口取得实际 fork 文件；未使用失败页面作依据。

### S9：PKU-SafeRLHF 数据卡与安全偏好 JSONL {#source-s9}

[原文1](https://huggingface.co/datasets/PKU-Alignment/PKU-SafeRLHF/raw/main/README.md) · [原文2](https://huggingface.co/datasets/PKU-Alignment/PKU-SafeRLHF/resolve/main/data/Alpaca-7B/train.jsonl)

阅读当前数据卡的来源、风险分类、安全/帮助性定义、排序与许可；从 Alpaca-7B/train.jsonl 读取前七条，精读第七条，本地 safe-raw.json。未将当前版本与 v0 合并统计，未审计全部人工安全标签。

### S10：Ouyang 等：Training language models to follow instructions with human feedback {#source-s10}

[原文1](https://arxiv.org/html/2203.02155)

实际页面为 2203.02155v1；阅读第 3.1–3.5 节的三阶段流程、数据来源、人工比较和奖励模型训练，重点为同提示排序展开后的相关性处理。本地 instruct.txt、instruct-clean.txt。未通读全部实验与附录，不声称取得论文的完整内部比较数据。

### S11：Cui 等：UltraFeedback {#source-s11}

[原文1](https://arxiv.org/html/2310.01377)

实际页面为 2310.01377v2；阅读第 2.1–2.4 节构建，以及附录 D.1 的二元排序与 margin、E.1 的整体分数/维度平均转换。本地 ultra-paper.txt、ultra-paper-clean.txt。未复现实验，未把其他衍生集的最高/随机配对规则归给这篇论文。

### S12：Lightman 等：Let's Verify Step by Step {#source-s12}

[原文1](https://arxiv.org/html/2305.20050)

实际页面为 2305.20050v1；阅读第 2.1–2.6 节范围、生成格式、标注与 PRM，第 4.2 节主动学习，以及附录 F.2 的聚合方式。本地 prm-paper.txt、prm-paper-clean.txt。未精读所有实验与附录，未进行生成器 RL。

### S13：Lambert 等：Tülu 3 {#source-s13}

[原文1](https://arxiv.org/html/2411.15124)

阅读第 3.2 节去污染，第 5.2–5.3 节偏好构建、混合与数据消融，第 6.1 节 RLVR 数据角色。本地 tulu-paper.txt、tulu-paper-clean.txt。未核验所有配方表格与当前下载文件的逐条映射，未用论文的混合数量替代当前数据卡数量，未审计全部评测套件。

### S14：DAPO：数据转换与动态过滤 {#source-s14}

[原文1](https://arxiv.org/html/2503.14476)

实际页面为 2503.14476v2；阅读第 3.2 节 Dynamic Sampling、第 3.3–3.4 节长回答处理和第 3.5 节 Dataset Transformation。本地 dapo-paper.txt、dapo-paper-clean.txt。未完成逐题来源追踪、完整静态筛选流程审计或训练复现；本文没有引用未读附录替代缺失阈值。

### S15：Dai 等：Safe RLHF {#source-s15}

[原文1](https://arxiv.org/html/2310.12773)

实际页面为 2310.12773v1；阅读第 3.1–3.3 节双维度标注、奖励/成本建模、逐回答约束转期望约束与拉格朗日优化。本地 safe-paper.txt、safe-paper-clean.txt。未精读实验表与附录证明；未把早期 14 类标注口径当作当前 PKU 文件的 19 类口径。

### S16：Park 等：Disentangling Length from Quality in Direct Preference Optimization {#source-s16}

[原文1](https://arxiv.org/html/2403.19159)

实际页面为 2403.19159v2；阅读第 4.2–4.3 节长度与质量实验、第 4.6 节分布外长度利用，以及第 7 节限制。本地 length-paper.txt、length-paper-clean.txt。没有仅凭摘要归纳；未复现正则化实验或扩展为所有 RL 方法的结论。

### S17：Pan 等：Training Software Engineering Agents and Verifiers with SWE-Gym {#source-s17}

[原文1](https://arxiv.org/html/2412.21139)

实际页面为 2412.21139v2；阅读第 3 节环境与仓库隔离、3.1 节构建和执行验证、第 4.1–4.2 节拒绝采样微调与轨迹收集。本地 swe-paper.txt、swe-paper-clean.txt。未精读全部规模实验、附录或完整轨迹数据。

### 未读与未验证

本次要求的九个数据对象均已取得并读取真实记录；指定的六篇方法论文及额外的长度偏差研究均已打开正文相关章节，没有以搜索摘要替代。未读范围包括：未采用的 TACO 与 SWE-smith、HH 配套完整论文、HelpSteer2 独立论文、AlphaCode 完整论文，以及上列各来源未覆盖的章节、全量记录和执行实现。这些材料不承担本文的事实依据。

没有运行模型训练、代码解答、仓库容器或全量去污染检查；记录中保留的人工/模型标签是源数据提供的目标，不是本次重新验证的事实答案。
