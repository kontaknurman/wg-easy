<script setup>
import { computed } from 'vue';
import { SwitchRoot, SwitchThumb, useForwardPropsEmits } from 'reka-ui';
import { cn } from '@/lib/utils';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  defaultValue: { type: Boolean, default: undefined },
  disabled: { type: Boolean, default: false },
  class: { type: String, default: '' },
  name: { type: String, default: undefined },
});
const emit = defineEmits(['update:modelValue']);
const forwarded = useForwardPropsEmits({ ...props, class: undefined }, emit);
const rootClass = computed(() => cn('peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input', props.class));
</script>

<template>
  <SwitchRoot v-bind="forwarded" :class="rootClass">
    <SwitchThumb class="pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0" />
  </SwitchRoot>
</template>
