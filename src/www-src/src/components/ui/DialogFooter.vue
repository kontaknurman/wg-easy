<script setup>
import { computed } from 'vue';
import { cn } from '@/lib/utils';
const props = defineProps({ class: { type: String, default: '' } });
const classes = computed(() => cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 gap-2 sm:gap-0', props.class));
</script>
<template><div :class="classes"><slot /></div></template>
