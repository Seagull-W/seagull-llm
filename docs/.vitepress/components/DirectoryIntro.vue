<script setup lang="ts">
import { computed } from 'vue'
import { useData } from 'vitepress'
import { sectionFor } from '../content-catalog'
import SectionIllustration from './SectionIllustration.vue'

const { page } = useData()
const section = computed(() => sectionFor('/' + page.value.relativePath)?.id || 'tags')
</script>

<template>
  <header class="document-intro illustrated-directory-intro">
    <SectionIllustration :section="section" />
    <slot />
  </header>
</template>
