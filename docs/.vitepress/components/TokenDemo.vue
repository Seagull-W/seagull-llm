<script setup lang="ts">
import { ref, computed } from 'vue'

interface Token {
  text: string
  index: number
  tokenId: number
}

const inputValue = ref('大语言模型正在改变世界')
const hoveredIndex = ref<number | null>(null)

// 常见中文双字词，模拟 BPE 合并规则
const chineseMerges = new Set<string>([
  '语言', '模型', '世界', '改变', '正在', '生成', '人工',
  '智能', '机器', '学习', '深度', '神经', '网络', '自然',
  '处理', '训练', '数据', '计算', '预测', '理解', '阅读',
  '聊天', '对话', '问题', '回答', '知识', '信息', '技术',
  '文字', '字符', '编码', '算法', '概率', '向量', '嵌入',
  '注意', '机制', '变换', '架构', '参数', '规模', '能力',
  '应用', '场景', '提示', '工程', '检索', '增强', '微调',
  '部署', '成本', '性能', '评估', '幻觉', '边界', '窗口',
  '上下', '文本', '输出', '输入', '推理', '生成'
])

// 常见英文后缀（按长度降序排列，优先匹配长后缀）
const englishSuffixes = ['tion', 'ness', 'ment', 'ing', 'ed', 'ly', 'er', 'est', 'es', 's']
// 常见英文前缀
const englishPrefixes = ['under', 'over', 'pre', 'dis', 'un', 're']

/** 模拟 token ID 的哈希函数（djb2 算法） */
function hashToken(text: string): number {
  let hash = 5381
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) & 0x7fffffff
  }
  return hash % 50000
}

type CharType = 'cn' | 'en' | 'punct' | 'space'

function getCharType(char: string): CharType {
  if (/\s/.test(char)) return 'space'
  if (/[\u4e00-\u9fff]/.test(char)) return 'cn'
  if (/[a-zA-Z0-9]/.test(char)) return 'en'
  return 'punct'
}

/** 简化的 BPE 模拟分词 */
function tokenize(input: string): Token[] {
  if (!input) return []

  // 按字符类型分段
  const segments: { text: string; type: CharType }[] = []
  let buffer = ''
  let bufferType: CharType | null = null

  for (const char of input) {
    const charType = getCharType(char)
    if (
      bufferType !== null &&
      charType === bufferType &&
      charType !== 'punct' &&
      charType !== 'space'
    ) {
      buffer += char
    } else {
      if (buffer && bufferType !== null) {
        segments.push({ text: buffer, type: bufferType })
      }
      buffer = char
      bufferType = charType
    }
  }
  if (buffer && bufferType !== null) {
    segments.push({ text: buffer, type: bufferType })
  }

  // 逐段处理为原始 token 字符串
  const rawTokens: string[] = []

  for (const seg of segments) {
    if (seg.type === 'space') continue

    if (seg.type === 'cn') {
      // 中文：尝试合并常见双字词
      let i = 0
      while (i < seg.text.length) {
        if (i + 1 < seg.text.length && chineseMerges.has(seg.text.slice(i, i + 2))) {
          rawTokens.push(seg.text.slice(i, i + 2))
          i += 2
        } else {
          rawTokens.push(seg.text[i])
          i++
        }
      }
    } else if (seg.type === 'en') {
      // 英文：分离常见前缀和后缀
      let word = seg.text
      const parts: string[] = []

      // 检查前缀
      for (const prefix of englishPrefixes) {
        if (word.length > prefix.length + 2 && word.toLowerCase().startsWith(prefix)) {
          parts.push(word.slice(0, prefix.length))
          word = word.slice(prefix.length)
          break
        }
      }

      // 检查后缀
      let suffix = ''
      for (const suf of englishSuffixes) {
        if (word.length > suf.length + 1 && word.toLowerCase().endsWith(suf)) {
          suffix = word.slice(word.length - suf.length)
          word = word.slice(0, word.length - suf.length)
          break
        }
      }

      if (word) parts.push(word)
      if (suffix) parts.push(suffix)
      rawTokens.push(...parts)
    } else {
      // 标点符号：独立成 token
      rawTokens.push(seg.text)
    }
  }

  return rawTokens.map((text, index) => ({
    text,
    index,
    tokenId: hashToken(text)
  }))
}

const tokens = computed<Token[]>(() => tokenize(inputValue.value))
const tokenCount = computed(() => tokens.value.length)
const charCount = computed(() => inputValue.value.replace(/\s/g, '').length)
const efficiency = computed(() =>
  tokenCount.value > 0 ? (charCount.value / tokenCount.value).toFixed(2) : '0.00'
)

function getTokenType(text: string): 'cn' | 'en' | 'punct' {
  if (/[\u4e00-\u9fff]/.test(text)) return 'cn'
  if (/[a-zA-Z0-9]/.test(text)) return 'en'
  return 'punct'
}
</script>

<template>
  <div class="token-demo">
    <div class="demo-section">
      <label class="input-label" for="token-input">输入文本</label>
      <input
        id="token-input"
        v-model="inputValue"
        class="text-input"
        type="text"
        placeholder="输入文字查看分词结果..."
      />
    </div>

    <div class="stats-bar">
      <div class="stat-item">
        <span class="stat-label">字符数</span>
        <span class="stat-value">{{ charCount }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Token 数</span>
        <span class="stat-value">{{ tokenCount }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">字符/Token</span>
        <span class="stat-value">{{ efficiency }}</span>
      </div>
    </div>

    <div class="tokens-container">
      <span
        v-for="token in tokens"
        :key="token.index"
        class="token-block"
        :class="`type-${getTokenType(token.text)}`"
        @mouseenter="hoveredIndex = token.index"
        @mouseleave="hoveredIndex = null"
      >
        <span class="token-index">{{ token.index }}</span>
        <span class="token-text">{{ token.text }}</span>

        <span v-if="hoveredIndex === token.index" class="token-tooltip">
          <span class="tooltip-row">
            <span class="tooltip-label">文本</span>
            <span class="tooltip-value">{{ token.text }}</span>
          </span>
          <span class="tooltip-row">
            <span class="tooltip-label">序号</span>
            <span class="tooltip-value">{{ token.index }}</span>
          </span>
          <span class="tooltip-row">
            <span class="tooltip-label">Token ID</span>
            <span class="tooltip-value">{{ token.tokenId }}</span>
          </span>
        </span>
      </span>

      <span v-if="tokens.length === 0" class="empty-hint">
        在上方输入文字即可看到分词结果
      </span>
    </div>

    <div class="legend-bar">
      <span class="legend-item">
        <span class="legend-dot type-cn"></span>中文
      </span>
      <span class="legend-item">
        <span class="legend-dot type-en"></span>英文
      </span>
      <span class="legend-item">
        <span class="legend-dot type-punct"></span>标点
      </span>
    </div>
  </div>
</template>

<style scoped>
.token-demo {
  margin: 24px 0;
  padding: 20px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
}

/* ---- 输入区 ---- */
.demo-section {
  margin-bottom: 16px;
}

.input-label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--vp-c-text-1);
}

.text-input {
  width: 100%;
  padding: 10px 14px;
  font-size: 15px;
  font-family: inherit;
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-border);
  border-radius: 8px;
  outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;
}

.text-input:focus {
  border-color: var(--vp-c-brand-2);
  box-shadow: 0 0 0 3px var(--vp-c-brand-soft, rgba(52, 81, 178, 0.14));
}

/* ---- 统计栏 ---- */
.stats-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
  padding: 12px 14px;
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
}

.stat-item {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.stat-label {
  font-size: 13px;
  color: var(--vp-c-text-2);
}

.stat-value {
  font-size: 16px;
  font-weight: 700;
  color: var(--vp-c-brand-1);
  font-variant-numeric: tabular-nums;
}

/* ---- Token 区 ---- */
.tokens-container {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  min-height: 48px;
  padding: 14px;
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
}

.token-block {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 15px;
  font-family: 'Noto Sans SC', sans-serif;
  cursor: default;
  transition: transform 0.15s;
  user-select: none;
}

.token-block:hover {
  transform: translateY(-2px);
}

/* token 序号（上标） */
.token-index {
  font-size: 10px;
  font-weight: 600;
  opacity: 0.7;
  font-variant-numeric: tabular-nums;
}

/* 各类型 token 配色：用 --vp-c-bg 做前景色，自动适配亮暗模式 */
.token-block.type-cn {
  background: var(--vp-c-brand-1);
  color: var(--vp-c-bg);
}

.token-block.type-en {
  background: var(--vp-c-brand-3);
  color: var(--vp-c-bg);
}

.token-block.type-punct {
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-2);
  border: 1px solid var(--vp-c-border);
}

/* ---- Tooltip ---- */
.token-tooltip {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 14px;
  min-width: 140px;
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-border);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  z-index: 20;
  white-space: nowrap;
  animation: tooltip-fade 0.15s ease-out;
}

@keyframes tooltip-fade {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

.tooltip-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.tooltip-label {
  font-size: 12px;
  color: var(--vp-c-text-2);
}

.tooltip-value {
  font-size: 13px;
  font-weight: 600;
  color: var(--vp-c-text-1);
  font-variant-numeric: tabular-nums;
}

/* ---- 空状态 ---- */
.empty-hint {
  color: var(--vp-c-text-3);
  font-size: 14px;
}

/* ---- 图例 ---- */
.legend-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-top: 12px;
  padding: 0 4px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--vp-c-text-2);
}

.legend-dot {
  display: inline-block;
  width: 14px;
  height: 14px;
  border-radius: 4px;
}

.legend-dot.type-cn {
  background: var(--vp-c-brand-1);
}

.legend-dot.type-en {
  background: var(--vp-c-brand-3);
}

.legend-dot.type-punct {
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-border);
}

/* ---- 移动端适配 ---- */
@media (max-width: 480px) {
  .token-demo {
    padding: 14px;
  }

  .stats-bar {
    gap: 8px;
    padding: 10px;
  }

  .stat-value {
    font-size: 14px;
  }

  .token-block {
    padding: 5px 10px;
    font-size: 14px;
  }

  .token-tooltip {
    min-width: 120px;
  }
}
</style>
