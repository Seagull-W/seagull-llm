<script setup lang="ts">
import { computed, ref } from 'vue'
import { withBase } from 'vitepress'
import { bilibiliSpaceUrl, scienceVideos } from '../data/videos'

const props = defineProps<{ preview?: boolean }>()
const failedCovers = ref<Record<string, boolean>>({})
const videos = computed(() => props.preview ? scienceVideos.slice(0, 3) : scienceVideos)
</script>

<template>
  <section class="video-gallery" :class="{ 'is-preview': preview }" aria-labelledby="video-gallery-title">
    <header class="gallery-header">
      <div>
        <p class="eyebrow">通过视频，一起学习</p>
        <component :is="preview ? 'h2' : 'h1'" id="video-gallery-title">科普视频</component>
        <p class="gallery-intro">用画面和讲解分享知识，让抽象的概念更容易理解。</p>
      </div>
      <a v-if="preview" class="gallery-link" :href="withBase('/videos/')">查看全部视频 <span aria-hidden="true">→</span></a>
      <a v-else class="gallery-link" :href="bilibiliSpaceUrl" target="_blank" rel="noopener noreferrer">Bilibili 主页 <span aria-hidden="true">↗</span></a>
    </header>

    <div v-if="videos.length" class="video-grid" :class="{ 'two-columns': videos.length === 2 }">
      <a
        v-for="video in videos"
        :key="video.bvid"
        class="video-card"
        :href="`https://www.bilibili.com/video/${video.bvid}/`"
        target="_blank"
        rel="noopener noreferrer"
        :aria-label="`${video.title}，在 Bilibili 观看（新窗口）`"
      >
        <div class="video-cover">
          <img
            v-if="!failedCovers[video.bvid]"
            :src="withBase(video.cover)"
            :alt="`${video.title}的视频封面`"
            width="640"
            height="360"
            loading="lazy"
            decoding="async"
            referrerpolicy="no-referrer"
            @error="failedCovers[video.bvid] = true"
          />
          <span v-else class="cover-fallback">{{ video.title }}</span>
          <span class="source-badge">{{ video.source }}</span>
          <span class="play-icon" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
          </span>
          <span v-if="video.duration" class="duration">{{ video.duration }}</span>
        </div>
        <div class="video-info">
          <time :datetime="video.publishedAt">{{ video.publishedAt }}</time>
          <h3>{{ video.title }}</h3>
          <p class="video-description">{{ video.description }}</p>
          <span class="watch-link">在 Bilibili 观看 <span aria-hidden="true">↗</span></span>
        </div>
      </a>
    </div>
    <div v-else class="space-entry">
      <span class="space-mark" aria-hidden="true">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="6" width="18" height="14" rx="3"/><path d="m7 2 3 4m7-4-3 4M10 10l5 3-5 3z"/></svg>
      </span>
      <div>
        <h3>在 Bilibili 看我的科普视频</h3>
        <p>视频卡片正在整理中，已发布的内容可以前往 Bilibili 主页查看。</p>
      </div>
      <a class="space-button" :href="bilibiliSpaceUrl" target="_blank" rel="noopener noreferrer">前往观看 <span aria-hidden="true">↗</span></a>
    </div>
  </section>
</template>

<style scoped>
.video-gallery { max-width: 1152px; margin: 0 auto; padding: 64px 24px 80px; }
.gallery-header { display: flex; align-items: end; justify-content: space-between; gap: 24px; margin-bottom: 28px; }
.eyebrow { color: var(--vp-c-brand-1); font-size: 13px; font-weight: 600; letter-spacing: .08em; margin-bottom: 8px; }
h1, h2 { color: var(--vp-c-text-1); font-size: 30px; line-height: 1.3; font-weight: 700; }
.gallery-intro { margin-top: 12px; color: var(--vp-c-text-2); line-height: 1.7; }
.gallery-link, .watch-link { color: var(--vp-c-brand-1); font-size: 14px; font-weight: 600; }
.gallery-link { flex-shrink: 0; padding: 8px 0; }
.gallery-link:hover { text-decoration: underline; }
.video-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 24px; }
.video-grid.two-columns { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.video-card { display: flex; flex-direction: column; overflow: hidden; border: 1px solid var(--vp-c-border); border-radius: 16px; background: var(--glass-bg); box-shadow: var(--glass-shadow); transition: border-color .2s, box-shadow .2s; }
.video-card:hover { border-color: var(--vp-c-brand-1); box-shadow: var(--glass-shadow-hover); }
a:focus-visible { outline: 3px solid var(--vp-c-brand-1); outline-offset: 4px; }
.video-cover { position: relative; aspect-ratio: 16 / 9; overflow: hidden; background: var(--vp-c-bg-soft); }
.video-cover img { width: 100%; height: 100%; object-fit: cover; }
.cover-fallback { display: flex; align-items: center; justify-content: center; height: 100%; padding: 32px; color: var(--vp-c-text-2); text-align: center; }
.source-badge, .duration { position: absolute; padding: 3px 8px; border-radius: 6px; color: #fff; background: rgba(0, 0, 0, .65); font-size: 12px; line-height: 1.6; }
.source-badge { top: 12px; left: 12px; }
.duration { bottom: 12px; right: 12px; font-variant-numeric: tabular-nums; }
.play-icon { position: absolute; display: grid; place-items: center; left: 16px; bottom: 12px; width: 38px; height: 38px; border-radius: 50%; background: rgba(0, 0, 0, .65); color: #fff; }
.video-info { display: flex; flex-direction: column; flex: 1; padding: 20px; }
time { color: var(--vp-c-text-2); font-size: 12px; }
.video-info h3 { margin-top: 8px; color: var(--vp-c-text-1); font-size: 17px; font-weight: 600; line-height: 1.6; }
.video-description { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden; margin: 10px 0 20px; color: var(--vp-c-text-2); font-size: 14px; line-height: 1.8; }
.watch-link { margin-top: auto; }
.space-entry { display: flex; align-items: center; gap: 20px; padding: 28px; border: 1px solid var(--vp-c-border); border-radius: 16px; background: var(--glass-bg); }
.space-mark { display: grid; place-items: center; flex-shrink: 0; width: 64px; height: 64px; border-radius: 16px; color: var(--vp-c-brand-1); background: var(--grad-accent-soft); }
.space-entry h3 { font-size: 18px; font-weight: 600; line-height: 1.5; }
.space-entry p { margin-top: 6px; font-size: 14px; line-height: 1.8; color: var(--vp-c-text-2); }
.space-button { flex-shrink: 0; margin-left: auto; padding: 10px 18px; border-radius: 24px; background: var(--vp-c-brand-1); color: var(--vp-c-bg); font-size: 14px; font-weight: 600; }
.space-button:hover { background: var(--vp-c-brand-2); }
@media (min-width: 640px) { .video-gallery { padding-left: 48px; padding-right: 48px; } }
@media (min-width: 960px) { .video-gallery { padding-left: 0; padding-right: 0; } }
@media (max-width: 959px) { .video-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 639px) {
  .video-gallery { padding-top: 40px; padding-bottom: 48px; }
  .gallery-header { align-items: start; flex-direction: column; gap: 12px; }
  .video-grid, .video-grid.two-columns { grid-template-columns: 1fr; }
  .space-entry { flex-wrap: wrap; padding: 24px; }
  .space-entry > div { flex: 1; min-width: 160px; }
  .space-button { margin-left: 0; }
  h1, h2 { font-size: 26px; }
}
@media (prefers-reduced-motion: reduce) { .video-card { transition: none; } }
</style>
