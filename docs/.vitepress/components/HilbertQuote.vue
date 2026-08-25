<script setup lang="ts">
// 希尔伯特墓志铭：「我们必须知道，我们必将知道。」
// 1930 年在柯尼斯堡（Königsberg）数学大会上发表的著名演讲结尾之语。
</script>

<template>
  <blockquote class="hilbert-quote">
    <div class="hilbert-quote__mark" aria-hidden="true">
      <svg width="36" height="28" viewBox="0 0 36 28" fill="none">
        <path
          d="M0 28V18.4C0 12.27 1.13 7.73 3.4 4.8C5.67 1.87 9.33 0.2 14.4 0L15.2 4C12 4.4 9.6 5.6 8 7.6C6.4 9.6 5.6 12.27 5.6 15.6H15.2V28H0ZM20.8 28V18.4C20.8 12.27 21.93 7.73 24.2 4.8C26.47 1.87 30.13 0.2 35.2 0L36 4C32.8 4.4 30.4 5.6 28.8 7.6C27.2 9.6 26.4 12.27 26.4 15.6H36V28H20.8Z"
          fill="currentColor"
        />
      </svg>
    </div>
    <p class="hilbert-quote__text">
      Wir müssen wissen, wir werden wissen.
    </p>
    <footer class="hilbert-quote__cite">
      <span class="hilbert-quote__rule"></span>
      <span class="hilbert-quote__author">David Hilbert</span>
    </footer>
  </blockquote>
</template>

<style scoped>
.hilbert-quote {
  position: relative;
  margin: 64px auto 24px;
  max-width: 760px;
  padding: 38px 56px 30px;
  text-align: center;

  /* 玻璃拟态 */
  background: linear-gradient(
      135deg,
      rgba(37, 99, 235, 0.07) 0%,
      rgba(6, 182, 212, 0.04) 100%
    ),
    var(--glass-bg, rgba(255, 255, 255, 0.65));
  backdrop-filter: blur(14px) saturate(150%);
  -webkit-backdrop-filter: blur(14px) saturate(150%);

  /* 渐变蓝边 */
  border: 1px solid rgba(37, 99, 235, 0.18);
  border-radius: 18px;
  box-shadow:
    0 12px 36px -16px rgba(37, 99, 235, 0.22),
    0 0 0 1px rgba(255, 255, 255, 0.45) inset;

  /* 进入动画 */
  animation: hilbert-in 0.6s cubic-bezier(0.22, 1, 0.36, 1) 0.2s both;
}

.hilbert-quote__mark {
  display: flex;
  justify-content: center;
  margin-bottom: 10px;
  color: var(--vp-c-brand-1);
  opacity: 0.5;
}

.hilbert-quote__text {
  margin: 0;
  font-family: 'Instrument Serif', 'Source Serif 4', 'Cactus Classical Serif',
    'Noto Serif', Georgia, serif;
  font-style: italic;
  font-weight: 400;
  font-size: clamp(20px, 2.4vw, 28px);
  line-height: 1.5;
  letter-spacing: 0.005em;
  color: var(--vp-c-text-1);
}

.hilbert-quote__cite {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: 18px;
  font-style: normal;
}

.hilbert-quote__rule {
  width: 36px;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent,
    var(--vp-c-brand-2),
    transparent
  );
}

.hilbert-quote__author {
  font-family: var(--vp-font-family-base);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--vp-c-brand-1);
}

@keyframes hilbert-in {
  from {
    opacity: 0;
    transform: translateY(14px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 640px) {
  .hilbert-quote {
    margin: 40px 16px 16px;
    padding: 28px 22px 22px;
  }
  .hilbert-quote__text {
    font-size: 18px;
  }
}

/* 暗色模式微调 */
.dark .hilbert-quote {
  background: linear-gradient(
      135deg,
      rgba(96, 165, 250, 0.08) 0%,
      rgba(6, 182, 212, 0.05) 100%
    ),
    var(--glass-bg, rgba(255, 255, 255, 0.05));
  border-color: rgba(96, 165, 250, 0.22);
  box-shadow:
    0 12px 36px -16px rgba(0, 0, 0, 0.5),
    0 0 0 1px rgba(255, 255, 255, 0.06) inset;
}

.dark .hilbert-quote__mark {
  color: var(--vp-c-brand-3);
}

.dark .hilbert-quote__author {
  color: var(--vp-c-brand-3);
}

@media (prefers-reduced-motion: reduce) {
  .hilbert-quote {
    animation: none;
  }
}
</style>