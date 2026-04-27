<script setup>
import { computed } from 'vue';
import { useVModel } from '@vueuse/core';
import { cn } from '@/lib/utils';

const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  type: { type: String, default: 'text' },
  class: { type: String, default: '' },
  defaultValue: { type: [String, Number], default: undefined },
});
const emit = defineEmits(['update:modelValue']);
const value = useVModel(props, 'modelValue', emit, { passive: true, defaultValue: props.defaultValue });

const classes = computed(() =>
  cn(
    'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
    props.class,
  ),
);
</script>

<template>
  <input v-model="value" :type="type" :class="classes" v-bind="$attrs" />
</template>
