<script setup lang="ts">
import { computed, onMounted, ref, shallowRef } from 'vue'
import { withBase } from 'vitepress'
import RewardRunChart from './RewardRunChart.vue'

type Point = { step: number; value: number }
type Run = { id: string; label: 'bf16' | 'f32'; name: string; url: string; state: string; config: Record<string, unknown>; metrics: Record<string, Point[]> }
type Data = { version: number; exportedAt: string | null; processedAt?: string; source: string | null; metricFiles?: Record<string, string>; runs: Run[] }
type Gallery = { source: string; metrics: { key: string; asset: string; sourceFile: string }[]; runs: { id: string; label: string; name: string; url: string; color: string }[] }
const data = shallowRef<Data | null>(null)
const gallery = shallowRef<Gallery | null>(null)
const status = ref('正在读取实验记录…')
const metric = ref('val/loss')
const visible = ref<string[]>(['bf16', 'f32'])
const dataUrl = withBase('/experiments/reward-model-runs.json')
const definitions: Record<string, { title: string; description: string }> = {
  'val/loss': { title: '验证损失', description: '越低表示对验证集中的偏好排序越有把握。结合验证准确率观察泛化表现。' },
  'val/accuracy': { title: '验证偏好准确率', description: '验证集中 chosen 得分高于 rejected 的比例；0.5 表示 50%。' },
  'val/reward_margin': { title: '验证奖励分数差', description: 'chosen 与 rejected 的平均得分差。奖励分数没有统一绝对尺度，分数差增大不一定代表泛化改善。' },
  'train/loss': { title: '训练损失', description: '每个优化器更新步记录的 Bradley–Terry 损失，显示未经平滑的原始值。' },
  'train/accuracy': { title: '训练偏好准确率', description: '当前梯度累积窗口内 chosen 得分高于 rejected 的比例。' },
  'train/reward_margin': { title: '训练奖励分数差', description: '训练记录中 chosen 与 rejected 的平均得分差。' },
  'train/r_chosen_mean': { title: '训练 chosen 平均奖励', description: '被偏好回答的平均奖励分数。' },
  'train/r_rejected_mean': { title: '训练 rejected 平均奖励', description: '未被偏好回答的平均奖励分数。' },
  'val/r_chosen_mean': { title: '验证 chosen 平均奖励', description: '验证集中被偏好回答的平均奖励分数。' },
  'val/r_rejected_mean': { title: '验证 rejected 平均奖励', description: '验证集中未被偏好回答的平均奖励分数。' },
  'train/lr': { title: '学习率', description: '每个优化器更新步记录的学习率。' }
}
const metrics = computed(() => data.value ? Object.keys(definitions).filter(key => data.value?.runs.some(run => run.metrics[key]?.length)) : (gallery.value?.metrics.map(item => item.key) ?? []))
const exportedChart = computed(() => gallery.value?.metrics.find(item => item.key === metric.value))
const series = computed(() => (data.value?.runs ?? []).filter(run => visible.value.includes(run.label)).map(run => ({
  label: run.label, color: run.label === 'bf16' ? '#f0434f' : '#479a5f', points: run.metrics[metric.value] ?? []
})))
const configKeys = computed(() => [...new Set(data.value?.runs.flatMap(run => Object.keys(run.config)) ?? [])])
const display = (value: unknown) => value === undefined ? '未记录' : typeof value === 'string' ? value : JSON.stringify(value)
const differs = (key: string) => data.value?.runs.length === 2 && display(data.value.runs[0].config[key]) !== display(data.value.runs[1].config[key])
const format = (value: number) => Number(value.toPrecision(6)).toString()
const last = (run: Run) => run.metrics[metric.value]?.at(-1)

onMounted(async () => {
  try {
    const response = await fetch(dataUrl)
    if (!response.ok) throw new Error('无法加载实验数据，请刷新重试。')
    const payload = await response.json() as Data
    if (payload.version !== 1 || !Array.isArray(payload.runs)) throw new Error('实验数据格式不正确。')
    if (!payload.runs.length) {
      const exported = await fetch(withBase('/experiments/reward-model-svg/index.json'))
      if (!exported.ok) throw new Error('尚未导入运行记录或图表。')
      const manifest = await exported.json() as Gallery
      if (!Array.isArray(manifest.metrics) || !manifest.metrics.length || !Array.isArray(manifest.runs) || manifest.runs.length !== 2) throw new Error('导出图表记录不完整。')
      gallery.value = manifest
      metric.value = manifest.metrics[0].key
      return
    }
    if (payload.runs.length !== 2 || new Set(payload.runs.map(run => run.label)).size !== 2) throw new Error('需要 bf16 和 f32 两次不同的运行记录。')
    for (const run of payload.runs) {
      if (!['bf16', 'f32'].includes(run.label) || !run.metrics || !run.config) throw new Error('运行记录不完整。')
      for (const points of Object.values(run.metrics)) {
        if (!Array.isArray(points) || points.some(p => !Number.isFinite(p.step) || !Number.isFinite(p.value))) throw new Error('指标包含无效数值。')
        points.sort((a, b) => a.step - b.step)
      }
    }
    data.value = payload
    if (!metrics.value.length) throw new Error('运行中没有可展示的指标。')
    metric.value = metrics.value[0]
  } catch (error) {
    data.value = null
    status.value = error instanceof Error ? error.message : '无法读取实验记录。'
  }
})
</script>

<template>
  <section class="rm-results" aria-label="奖励模型训练实验对比">
    <template v-if="gallery && !data">
      <div class="controls">
        <label class="metric">查看指标
          <select v-model="metric"><option v-for="key in metrics" :key="key" :value="key">{{ definitions[key].title }}</option></select>
        </label>
        <span class="export-badge">W&B 原图对比 · 11 项指标</span>
      </div>
      <p class="description">{{ definitions[metric].description.replace('，显示未经平滑的原始值', '') }}</p>
      <div class="export-legend"><span v-for="run in gallery.runs" :key="run.id"><i :style="{ background: run.color }" />{{ run.label }}</span></div>
      <figure v-if="exportedChart" class="exported-chart">
        <img :src="withBase(exportedChart.asset)" :alt="`${definitions[metric].title}：绿色 f32 与红色 bf16 的 W&B 导出对比曲线`" width="1200" height="462" />
        <figcaption>{{ metric }} · 横轴 Step · 保留 W&B 导出的曲线与坐标轴</figcaption>
      </figure>
      <p class="note">此图为静态曲线，无法查看逐点数值。</p>
      <footer><a v-if="exportedChart" :href="withBase(exportedChart.asset)" :download="exportedChart.sourceFile">下载当前图表 SVG ↓</a></footer>
    </template>
    <p v-else-if="!data" class="pending" role="status">{{ status }}</p>
    <template v-else>
      <div class="controls">
        <label class="metric">查看指标
          <select v-model="metric"><option v-for="key in metrics" :key="key" :value="key">{{ definitions[key].title }}</option></select>
        </label>
        <fieldset><legend>对比运行</legend>
          <label v-for="run in data.runs" :key="run.id"><input v-model="visible" type="checkbox" :value="run.label" /><i :class="run.label" />{{ run.label }}</label>
        </fieldset>
      </div>
      <p class="description">{{ definitions[metric].description }}</p>
      <RewardRunChart v-if="visible.length" :series="series" :metric="metric" />
      <p v-else class="pending">请勾选至少一次运行。</p>
      <p class="note">悬停显示最近的记录点，曲线未平滑。</p>
      <div class="summaries">
        <div v-for="run in data.runs" :key="run.id" class="summary">
          <strong><i :class="run.label" />{{ run.label }}</strong>
          <b>{{ last(run) ? format(last(run)!.value) : '无记录' }}</b>
          <small>{{ last(run) ? `最后记录 · Step ${last(run)!.step}` : '此运行没有所选指标' }} · {{ run.metrics[metric]?.length ?? 0 }} 个点</small>
        </div>
      </div>
      <details v-if="configKeys.length">
        <summary>运行配置对照（来自实际运行记录）</summary>
        <p class="note">bf16 / f32 是所选运行的标签；精度设置以已记录的配置为准。高亮项表示两次运行记录不同，不能仅凭曲线把差异归因于精度。</p>
        <div class="table-wrap"><table>
          <thead><tr><th>参数</th><th v-for="run in data.runs" :key="run.id">{{ run.label }}</th></tr></thead>
          <tbody><tr v-for="key in configKeys" :key="key" :class="{ different: differs(key) }"><th>{{ key }}</th><td v-for="run in data.runs" :key="run.id">{{ display(run.config[key]) }}</td></tr></tbody>
        </table></div>
      </details>
      <footer><a v-if="data.metricFiles?.[metric]" :href="withBase(data.metricFiles[metric])" :download="`${metric.replace('/', '-')}.csv`">下载当前指标 CSV ↓</a><a :href="dataUrl" download="reward-model-runs.json">下载全部数值 JSON ↓</a></footer>
    </template>
  </section>
</template>

<style scoped>
.rm-results { margin: 24px 0; border: 1px solid var(--vp-c-divider); border-radius: 16px; padding: 24px; background: var(--vp-c-bg-soft); }
.controls { display: flex; align-items: end; flex-wrap: wrap; gap: 20px; }
.metric { display: grid; gap: 6px; font-size: 13px; color: var(--vp-c-text-2); flex: 1; min-width: 180px; }
select { border: 1px solid var(--vp-c-divider); border-radius: 8px; padding: 8px 12px; background: var(--vp-c-bg); color: var(--vp-c-text-1); font-size: 14px; }
fieldset { border: 0; padding: 0; margin: 0; display: flex; gap: 16px; }
legend { font-size: 13px; color: var(--vp-c-text-2); margin-bottom: 8px; }
fieldset label { display: flex; align-items: center; gap: 6px; font-size: 14px; cursor: pointer; }
i { display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-right: 4px; }
.bf16 { background: #f0434f; }.f32 { background: #479a5f; }
.description { font-size: 14px; color: var(--vp-c-text-2); }
.note, footer { font-size: 12px; line-height: 1.7; color: var(--vp-c-text-2); }
.pending { font-size: 14px; color: var(--vp-c-text-2); }
.export-badge { font-size: 12px; color: var(--vp-c-text-2); padding: 6px 10px; border: 1px solid var(--vp-c-divider); border-radius: 20px; }
.export-legend { display: flex; gap: 20px; font-size: 13px; margin-bottom: 12px; }.export-legend a { color: var(--vp-c-text-1); }
.exported-chart { margin: 0; }.exported-chart img { width: 100%; height: auto; background: white; border-radius: 8px; }
figcaption { font-size: 12px; margin-top: 8px; color: var(--vp-c-text-2); }
.summaries { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin: 20px 0; }
.summary { display: grid; gap: 6px; padding: 16px; background: var(--vp-c-bg); border: 1px solid var(--vp-c-divider); border-radius: 12px; }
.summary span { font-size: 12px; overflow-wrap: anywhere; color: var(--vp-c-text-2); }
.summary b { font-size: 25px; font-variant-numeric: tabular-nums; }.summary small, .summary a { font-size: 12px; }
details { border-top: 1px solid var(--vp-c-divider); padding-top: 16px; }summary { cursor: pointer; font-size: 14px; }
.table-wrap { overflow-x: auto; }table { width: 100%; font-size: 12px; }td { overflow-wrap: anywhere; min-width: 130px; }th { text-align: left; }.different { background: var(--vp-c-brand-soft); }
footer { display: flex; flex-wrap: wrap; gap: 8px 20px; justify-content: space-between; margin-top: 20px; }
@media(max-width: 600px) { .rm-results { padding: 16px; }.summaries { grid-template-columns: 1fr; } }
</style>
