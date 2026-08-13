<script setup lang="ts">
import { ref, computed } from 'vue'

interface HoveredCell {
  row: number
  col: number
}

const tokens: string[] = ['猫', '坐', '在', '垫子', '上']

// 预设 5×5 注意力权重矩阵，每行和为 1，对角线值通常较大
const weights: number[][] = [
  // 猫 →  [猫,   坐,   在,   垫子, 上  ]
  [0.45, 0.30, 0.05, 0.10, 0.10], // 猫：主语关注自身和动词
  [0.35, 0.20, 0.15, 0.20, 0.10], // 坐：动词关注主语和宾语
  [0.05, 0.30, 0.25, 0.30, 0.10], // 在：介词关注动词和宾语
  [0.05, 0.10, 0.25, 0.45, 0.15], // 垫子：宾语关注自身和介词
  [0.05, 0.05, 0.30, 0.25, 0.35]  // 上：方位词关注介词和宾语
]

const hoveredCell = ref<HoveredCell | null>(null)

/** 根据权重值计算单元格颜色（蓝 → 红 渐变） */
function cellColor(weight: number): string {
  // 色相从 210°（蓝）线性过渡到 0°（红）
  const hue = 210 * (1 - weight)
  const saturation = 55 + weight * 35 // 55% → 90%
  const lightness = 82 - weight * 37  // 82% → 45%
  return `hsl(${hue.toFixed(0)}, ${saturation.toFixed(0)}%, ${lightness.toFixed(0)}%)`
}

/** 权重较高时使用白色文字，较低时继承主题文字色 */
function cellTextColor(weight: number): string {
  return weight > 0.5 ? 'rgba(255, 255, 255, 0.95)' : 'inherit'
}

function isHighlighted(row: number, col: number): boolean {
  if (!hoveredCell.value) return false
  return hoveredCell.value.row === row || hoveredCell.value.col === col
}

function isCurrentCell(row: number, col: number): boolean {
  if (!hoveredCell.value) return false
  return hoveredCell.value.row === row && hoveredCell.value.col === col
}

const hoveredWeight = computed<string | null>(() => {
  if (!hoveredCell.value) return null
  const { row, col } = hoveredCell.value
  return weights[row][col].toFixed(2)
})

const hoveredInfo = computed<string | null>(() => {
  if (!hoveredCell.value) return null
  const { row, col } = hoveredCell.value
  return `${tokens[row]} → ${tokens[col]}`
})
</script>

<template>
  <div class="attention-viz">
    <div class="viz-header">
      <p class="viz-sentence">
        原句：<strong>"猫坐在垫子上"</strong>
      </p>
      <p class="viz-hint">悬停单元格查看注意力权重，高亮显示对应的行与列</p>
    </div>

    <div class="heatmap-wrapper">
      <div class="heatmap-grid">
        <!-- 左上角空白 -->
        <div class="corner-cell"></div>

        <!-- 列标签（顶部） -->
        <div
          v-for="(token, col) in tokens"
          :key="`col-${col}`"
          class="label-cell label-col"
          :class="{ 'label-active': hoveredCell?.col === col }"
        >
          {{ token }}
        </div>

        <!-- 数据行 -->
        <template v-for="(token, row) in tokens" :key="`row-${row}`">
          <!-- 行标签 -->
          <div
            class="label-cell label-row"
            :class="{ 'label-active': hoveredCell?.row === row }"
          >
            {{ token }}
          </div>

          <!-- 数据单元格 -->
          <div
            v-for="(weight, col) in weights[row]"
            :key="`cell-${row}-${col}`"
            class="data-cell"
            :class="{
              highlighted: isHighlighted(row, col),
              current: isCurrentCell(row, col)
            }"
            :style="{
              backgroundColor: cellColor(weight),
              color: cellTextColor(weight)
            }"
            @mouseenter="hoveredCell = { row, col }"
            @mouseleave="hoveredCell = null"
          >
            {{ weight.toFixed(2) }}
          </div>
        </template>
      </div>
    </div>

    <!-- 信息面板 -->
    <div class="info-panel">
      <template v-if="hoveredCell">
        <span class="info-item">
          <span class="info-label">关注关系</span>
          <span class="info-value">{{ hoveredInfo }}</span>
        </span>
        <span class="info-item">
          <span class="info-label">注意力权重</span>
          <span class="info-value weight-value">{{ hoveredWeight }}</span>
        </span>
      </template>
      <span v-else class="info-placeholder">将鼠标移至热力图单元格上查看详情</span>
    </div>

    <!-- 色阶图例 -->
    <div class="color-scale">
      <span class="scale-label">权重</span>
      <span class="scale-label-end">0.0</span>
      <div class="scale-bar"></div>
      <span class="scale-label-start">1.0</span>
    </div>
  </div>
</template>

<style scoped>
.attention-viz {
  margin: 24px 0;
  padding: 20px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
}

/* ---- 头部 ---- */
.viz-header {
  margin-bottom: 16px;
}

.viz-sentence {
  margin: 0 0 4px;
  font-size: 15px;
  color: var(--vp-c-text-1);
}

.viz-hint {
  margin: 0;
  font-size: 13px;
  color: var(--vp-c-text-2);
}

/* ---- 热力图 ---- */
.heatmap-wrapper {
  overflow-x: auto;
  padding: 4px;
}

.heatmap-grid {
  display: grid;
  grid-template-columns: 48px repeat(5, minmax(52px, 1fr));
  gap: 3px;
  min-width: 320px;
}

.corner-cell {
  background: transparent;
}

.label-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
  color: var(--vp-c-text-2);
  padding: 6px 4px;
  border-radius: 6px;
  transition: color 0.15s, background-color 0.15s;
}

.label-active {
  color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft, rgba(52, 81, 178, 0.1));
}

.data-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 48px;
  font-size: 13px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  border-radius: 6px;
  border: 1px solid var(--vp-c-divider);
  cursor: default;
  transition: transform 0.12s, box-shadow 0.12s, opacity 0.12s;
  user-select: none;
}

.data-cell.highlighted {
  opacity: 0.65;
}

.data-cell.current {
  opacity: 1;
  transform: scale(1.08);
  box-shadow: 0 0 0 2px var(--vp-c-brand-2);
  z-index: 2;
}

/* ---- 信息面板 ---- */
.info-panel {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  align-items: center;
  margin-top: 16px;
  padding: 12px 14px;
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  min-height: 48px;
}

.info-item {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.info-label {
  font-size: 13px;
  color: var(--vp-c-text-2);
}

.info-value {
  font-size: 15px;
  font-weight: 600;
  color: var(--vp-c-text-1);
}

.weight-value {
  color: var(--vp-c-brand-1);
  font-variant-numeric: tabular-nums;
}

.info-placeholder {
  font-size: 13px;
  color: var(--vp-c-text-3);
}

/* ---- 色阶图例 ---- */
.color-scale {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 14px;
  padding: 0 4px;
}

.scale-label {
  font-size: 12px;
  color: var(--vp-c-text-2);
  margin-right: 4px;
}

.scale-bar {
  flex: 1;
  max-width: 200px;
  height: 12px;
  border-radius: 6px;
  background: linear-gradient(
    to right,
    hsl(210, 55%, 82%),
    hsl(158, 65%, 64%),
    hsl(105, 75%, 55%),
    hsl(52, 80%, 55%),
    hsl(0, 90%, 45%)
  );
  border: 1px solid var(--vp-c-divider);
}

.scale-label-end,
.scale-label-start {
  font-size: 11px;
  color: var(--vp-c-text-3);
  font-variant-numeric: tabular-nums;
}

/* ---- 移动端适配 ---- */
@media (max-width: 480px) {
  .attention-viz {
    padding: 14px;
  }

  .heatmap-grid {
    grid-template-columns: 40px repeat(5, minmax(44px, 1fr));
    gap: 2px;
  }

  .data-cell {
    height: 40px;
    font-size: 11px;
  }

  .label-cell {
    font-size: 12px;
  }

  .info-panel {
    gap: 12px;
  }
}
</style>
