<script setup>
import { computed } from 'vue';
import { cn } from '@/lib/utils';
const props = defineProps({ class: { type: String, default: '' } });
const classes = computed(() => cn('flex flex-col space-y-1.5 text-center sm:text-left', props.class));
</script>
<template><div :class="classes"><slot /></div></template>
