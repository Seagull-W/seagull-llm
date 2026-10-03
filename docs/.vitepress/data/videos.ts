export interface ScienceVideo {
  bvid: string
  title: string
  description: string
  cover: string
  publishedAt: string
  duration: string
  source: 'Bilibili'
}

export const bilibiliSpaceUrl = 'https://space.bilibili.com/1210982145/upload/video'

// Verified against the account's upload page and video detail API on 2026-10-03.
// Keep newest uploads first; covers live in docs/public/videos.
export const scienceVideos: ScienceVideo[] = [
  {
    bvid: 'BV1VTaZ6iE6Q',
    title: 'RLHF中的广义优势估计(GAE)',
    description: '用可视化介绍 RLHF 中的广义优势估计（GAE），从 TD 残差到优势估计，梳理反向递推的过程。',
    cover: '/videos/BV1VTaZ6iE6Q.webp',
    publishedAt: '2026-09-30',
    duration: '03:34',
    source: 'Bilibili'
  },
  {
    bvid: 'BV1Meap6cEfd',
    title: '尺度变换下的梯度下降',
    description: '通过可视化演绎，观察尺度变换下不同梯度方法的表现。',
    cover: '/videos/BV1Meap6cEfd.webp',
    publishedAt: '2026-09-30',
    duration: '03:18',
    source: 'Bilibili'
  }
]
