<script setup>
import { computed } from 'vue';
import { Label as RekaLabel } from 'reka-ui';
import { cn } from '@/lib/utils';

const props = defineProps({ class: { type: String, default: '' }, for: { type: String, default: undefined } });
const classes = computed(() => cn('text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70', props.class));
</script>

<template>
  <RekaLabel :class="classes" :for="props.for"><slot /></RekaLabel>
</template>
