<template>
  <header class="grace-hero">
    <h1 class="seagull-hero-wordmark" aria-label="Seagull"><span aria-hidden="true">S<span class="wordmark-e">E</span><span class="wordmark-a">A</span>GULL</span></h1>
    <nav aria-label="本页跳转">
      <a href="#grace-home-directory">栏目索引</a>
      <a href="#grace-journal-heading">每日调研</a>
    </nav>
  </header>
</template>

<style scoped>
.grace-hero { display:flex; align-items:center; gap:20px; justify-content:space-between; }
.grace-hero h1 { margin:0; font-size:clamp(34px,4vw,54px); }
.grace-hero nav { display:flex; gap:20px; align-items:center; color:var(--vp-c-text-2); font:15px/1.5 var(--grace-serif); }
.grace-hero a { display:inline-flex; align-items:center; min-height:44px; color:inherit; white-space:nowrap; }
.grace-hero a:is(:hover,:focus-visible) { color:var(--vp-c-brand-1); text-decoration:underline; text-underline-offset:4px; }
@media(max-width:639px) {
  .grace-hero nav { gap:12px; font-size:14px; }
}
@media(max-width:359px) {
  .grace-hero { gap:10px; }
  .grace-hero nav { gap:8px; font-size:12px; }
}
</style>
