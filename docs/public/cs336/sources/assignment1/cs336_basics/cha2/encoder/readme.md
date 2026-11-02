# BPE 编码器

本 BPE 编码器使用 **TinyStoriesV2-GPT4-valid** 数据集训练，仅用于检验代码可行性。

## 文件说明

| 文件 | 说明 |
|------|------|
| `vocab.json` | 词汇表，token ID 到 bytes（Base64 编码）的映射 |
| `merge.txt` | BPE 合并规则，每行一个 pair（十六进制编码） |

