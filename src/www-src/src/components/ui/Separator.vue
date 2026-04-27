<script setup>
import { computed } from 'vue';
import { Separator as RekaSeparator } from 'reka-ui';
import { cn } from '@/lib/utils';

const props = defineProps({
  orientation: { type: String, default: 'horizontal' },
  decorative: { type: Boolean, default: true },
  class: { type: String, default: '' },
});
const classes = computed(() => cn('shrink-0 bg-border', props.orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px', props.class));
</script>
<template><RekaSeparator :orientation="orientation" :decorative="decorative" :class="classes" /></template>
