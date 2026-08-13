<script setup lang="ts">
import { ref, computed } from 'vue'

interface WordPoint {
  word: string
  x: number
  y: number
  category: string
}

interface CategoryMeta {
  name: string
  color: string
  label: string
}

// 语义类别定义（色调基于品牌色系做色相偏移）
const categories: CategoryMeta[] = [
  { name: 'animal', label: '动物', color: 'hsl(210, 65%, 52%)' },
  { name: 'food', label: '食物', color: 'hsl(28, 80%, 52%)' },
  { name: 'emotion', label: '情感', color: 'hsl(280, 55%, 58%)' },
  { name: 'action', label: '动作', color: 'hsl(175, 60%, 42%)' },
  { name: 'profession', label: '职业', color: 'hsl(140, 50%, 45%)' }
]

const categoryColorMap = computed<Record<string, string>>(() => {
  const map: Record<string, string> = {}
  for (const c of categories) {
    map[c.name] = c.color
  }
  return map
})

const categoryLabelMap = computed<Record<string, string>>(() => {
  const map: Record<string, string> = {}
  for (const c of categories) {
    map[c.name] = c.label
  }
  return map
})

// 预设 30 个词语的二维降维坐标
// 设计原则：同类聚集、相关类别（动物↔食物）距离适中、不相关类别（职业↔食物）距离较远
const wordPoints: WordPoint[] = [
  // 动物（左上区域）
  { word: '猫', x: 15, y: 20, category: 'animal' },
  { word: '狗', x: 24, y: 17, category: 'animal' },
  { word: '鸟', x: 19, y: 29, category: 'animal' },
  { word: '鱼', x: 12, y: 31, category: 'animal' },
  { word: '马', x: 27, y: 25, category: 'animal' },
  { word: '兔', x: 21, y: 23, category: 'animal' },

  // 食物（左中区域，与动物纵向相邻）
  { word: '米饭', x: 20, y: 52, category: 'food' },
  { word: '面条', x: 28, y: 49, category: 'food' },
  { word: '苹果', x: 15, y: 57, category: 'food' },
  { word: '牛奶', x: 31, y: 54, category: 'food' },
  { word: '面包', x: 23, y: 61, category: 'food' },
  { word: '蛋糕', x: 30, y: 63, category: 'food' },

  // 情感（中心区域）
  { word: '快乐', x: 50, y: 32, category: 'emotion' },
  { word: '悲伤', x: 45, y: 42, category: 'emotion' },
  { word: '愤怒', x: 56, y: 37, category: 'emotion' },
  { word: '恐惧', x: 48, y: 47, category: 'emotion' },
  { word: '惊讶', x: 58, y: 45, category: 'emotion' },
  { word: '信任', x: 52, y: 35, category: 'emotion' },

  // 动作（右中区域）
  { word: '奔跑', x: 70, y: 42, category: 'action' },
  { word: '跳跃', x: 78, y: 45, category: 'action' },
  { word: '行走', x: 72, y: 51, category: 'action' },
  { word: '攀爬', x: 82, y: 49, category: 'action' },
  { word: '游泳', x: 68, y: 56, category: 'action' },
  { word: '飞翔', x: 80, y: 39, category: 'action' },

  // 职业（右下区域，远离食物）
  { word: '医生', x: 75, y: 76, category: 'profession' },
  { word: '教师', x: 83, y: 73, category: 'profession' },
  { word: '工程师', x: 86, y: 80, category: 'profession' },
  { word: '律师', x: 78, y: 86, category: 'profession' },
  { word: '画家', x: 88, y: 77, category: 'profession' },
  { word: '厨师', x: 72, y: 83, category: 'profession' }
]

const hoveredPoint = ref<WordPoint | null>(null)

// SVG viewBox 尺寸
const viewSize = 100
const padding = 6
const axisRange = viewSize - padding * 2

/** 将数据坐标 (0-100) 映射到 SVG 坐标 */
function toSvgX(val: number): number {
  return padding + (val / 100) * axisRange
}

function toSvgY(val: number): number {
  // y 轴翻转：数据中 y 小 = 上方，SVG 中 y 小 = 上方
  return padding + (val / 100) * axisRange
}

function handleEnter(point: WordPoint): void {
  hoveredPoint.value = point
}

function handleLeave(): void {
  hoveredPoint.value = null
}
</script>

<template>
  <div class="word-embed-viz">
    <div class="viz-header">
      <p class="viz-title">词向量二维降维分布</p>
      <p class="viz-hint">语义相近的词在空间中聚集，悬停查看词语</p>
    </div>

    <div class="chart-area">
      <!-- 散点图 SVG -->
      <svg
        class="scatter-svg"
        :viewBox="`0 0 ${viewSize} ${viewSize}`"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="词向量降维散点图"
      >
        <!-- 背景区域 -->
        <rect
          x="0"
          y="0"
          :width="viewSize"
          :height="viewSize"
          class="chart-bg"
          rx="2"
        />

        <!-- 网格线 -->
        <g class="grid-lines">
          <line
            v-for="i in 4"
            :key="`gh-${i}`"
            :x1="padding + (i / 5) * axisRange"
            :y1="padding"
            :x2="padding + (i / 5) * axisRange"
            :y2="padding + axisRange"
            class="grid-line"
          />
          <line
            v-for="i in 4"
            :key="`gv-${i}`"
            :x1="padding"
            :y1="padding + (i / 5) * axisRange"
            :x2="padding + axisRange"
            :y2="padding + (i / 5) * axisRange"
            class="grid-line"
          />
        </g>

        <!-- 坐标轴 -->
        <line
          :x1="padding"
          :y1="padding + axisRange"
          :x2="padding + axisRange"
          :y2="padding + axisRange"
          class="axis-line"
        />
        <line
          :x1="padding"
          :y1="padding"
          :x2="padding"
          :y2="padding + axisRange"
          class="axis-line"
        />

        <!-- 轴标签 -->
        <text :x="padding + axisRange / 2" :y="viewSize - 1" class="axis-label" text-anchor="middle">
          维度 1
        </text>
        <text
          :x="2"
          :y="padding + axisRange / 2"
          class="axis-label"
          text-anchor="middle"
          :transform="`rotate(-90, 2, ${padding + axisRange / 2})`"
        >
          维度 2
        </text>

        <!-- 散点 -->
        <g class="points-layer">
          <g
            v-for="point in wordPoints"
            :key="point.word"
            class="point-group"
            @mouseenter="handleEnter(point)"
            @mouseleave="handleLeave"
          >
            <!-- 悬停时光晕 -->
            <circle
              v-if="hoveredPoint?.word === point.word"
              :cx="toSvgX(point.x)"
              :cy="toSvgY(point.y)"
              r="4.5"
              :fill="categoryColorMap[point.category]"
              class="point-halo"
            />
            <!-- 主圆点 -->
            <circle
              :cx="toSvgX(point.x)"
              :cy="toSvgY(point.y)"
              :r="hoveredPoint?.word === point.word ? 2.2 : 1.8"
              :fill="categoryColorMap[point.category]"
              class="point-circle"
            />
            <!-- 悬停标签 -->
            <g v-if="hoveredPoint?.word === point.word">
              <rect
                :x="toSvgX(point.x) - point.word.length * 1.6 - 1.5"
                :y="toSvgY(point.y) - 8"
                :width="point.word.length * 3.2 + 3"
                :height="5.5"
                rx="1.5"
                class="label-bg"
              />
              <text
                :x="toSvgX(point.x)"
                :y="toSvgY(point.y) - 4.2"
                class="label-text"
                text-anchor="middle"
              >
                {{ point.word }}
              </text>
            </g>
          </g>
        </g>
      </svg>
    </div>

    <!-- 图例 -->
    <div class="legend-row">
      <div
        v-for="cat in categories"
        :key="cat.name"
        class="legend-item"
      >
        <span
          class="legend-dot"
          :style="{ backgroundColor: cat.color }"
        ></span>
        <span class="legend-text">{{ cat.label }}</span>
      </div>
    </div>

    <!-- 悬停信息 -->
    <div class="hover-info">
      <template v-if="hoveredPoint">
        <span class="info-word">{{ hoveredPoint.word }}</span>
        <span class="info-sep">·</span>
        <span class="info-cat">{{ categoryLabelMap[hoveredPoint.category] }}</span>
      </template>
      <span v-else class="info-placeholder">悬停散点查看词语详情</span>
    </div>
  </div>
</template>

<style scoped>
.word-embed-viz {
  margin: 24px 0;
  padding: 20px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
}

/* ---- 头部 ---- */
.viz-header {
  margin-bottom: 14px;
}

.viz-title {
  margin: 0 0 4px;
  font-size: 15px;
  font-weight: 600;
  color: var(--vp-c-text-1);
}

.viz-hint {
  margin: 0;
  font-size: 13px;
  color: var(--vp-c-text-2);
}

/* ---- 图表区域 ---- */
.chart-area {
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  padding: 12px;
  overflow: hidden;
}

.scatter-svg {
  width: 100%;
  height: auto;
  display: block;
  max-height: 420px;
}

.chart-bg {
  fill: var(--vp-c-bg);
}

/* ---- 网格线 ---- */
.grid-line {
  stroke: var(--vp-c-divider);
  stroke-width: 0.15;
  stroke-dasharray: 0.8, 0.8;
  opacity: 0.6;
}

/* ---- 坐标轴 ---- */
.axis-line {
  stroke: var(--vp-c-border);
  stroke-width: 0.3;
}

.axis-label {
  font-size: 2.5px;
  fill: var(--vp-c-text-2);
  font-family: 'Noto Sans SC', sans-serif;
}

/* ---- 散点 ---- */
.point-group {
  cursor: pointer;
}

.point-circle {
  stroke: var(--vp-c-bg);
  stroke-width: 0.4;
  transition: r 0.15s ease;
}

.point-halo {
  opacity: 0.25;
  pointer-events: none;
}

.label-bg {
  fill: var(--vp-c-bg);
  stroke: var(--vp-c-border);
  stroke-width: 0.2;
  opacity: 0.95;
}

.label-text {
  font-size: 3px;
  font-weight: 600;
  fill: var(--vp-c-text-1);
  font-family: 'Noto Sans SC', sans-serif;
  pointer-events: none;
}

/* ---- 图例 ---- */
.legend-row {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin-top: 14px;
  padding: 10px 14px;
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.legend-dot {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

.legend-text {
  font-size: 13px;
  color: var(--vp-c-text-2);
}

/* ---- 悬停信息 ---- */
.hover-info {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 12px;
  padding: 10px 14px;
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  min-height: 42px;
}

.info-word {
  font-size: 15px;
  font-weight: 700;
  color: var(--vp-c-brand-1);
}

.info-sep {
  color: var(--vp-c-text-3);
}

.info-cat {
  font-size: 14px;
  color: var(--vp-c-text-2);
}

.info-placeholder {
  font-size: 13px;
  color: var(--vp-c-text-3);
}

/* ---- 移动端适配 ---- */
@media (max-width: 480px) {
  .word-embed-viz {
    padding: 14px;
  }

  .legend-row {
    gap: 10px;
    padding: 8px 10px;
  }

  .legend-text {
    font-size: 12px;
  }

  .scatter-svg {
    max-height: 320px;
  }
}
</style>
