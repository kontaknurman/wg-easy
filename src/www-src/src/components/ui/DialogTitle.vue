<script setup>
import { computed } from 'vue';
import { DialogTitle as RekaDialogTitle } from 'reka-ui';
import { cn } from '@/lib/utils';
const props = defineProps({ class: { type: String, default: '' } });
const classes = computed(() => cn('text-lg font-semibold leading-none tracking-tight', props.class));
</script>
<template><RekaDialogTitle :class="classes"><slot /></RekaDialogTitle></template>
