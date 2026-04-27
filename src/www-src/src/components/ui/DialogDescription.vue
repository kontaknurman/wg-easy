<script setup>
import { computed } from 'vue';
import { DialogDescription as RekaDialogDescription } from 'reka-ui';
import { cn } from '@/lib/utils';
const props = defineProps({ class: { type: String, default: '' } });
const classes = computed(() => cn('text-sm text-muted-foreground', props.class));
</script>
<template><RekaDialogDescription :class="classes"><slot /></RekaDialogDescription></template>
