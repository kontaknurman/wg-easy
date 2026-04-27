<script setup>
import {
  SelectRoot,
  SelectTrigger,
  SelectValue,
  SelectIcon,
  SelectPortal,
  SelectContent,
  SelectViewport,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  useForwardPropsEmits,
} from 'reka-ui';
import { HugeiconsIcon } from '@hugeicons/vue';
import { ArrowDown01Icon, Tick02Icon } from '@hugeicons/core-free-icons';
import { computed } from 'vue';
import { cn } from '@/lib/utils';

const props = defineProps({
  modelValue: { type: [String, Number, Boolean], default: undefined },
  defaultValue: { type: [String, Number, Boolean], default: undefined },
  placeholder: { type: String, default: 'Select…' },
  options: { type: Array, default: () => [] },
  class: { type: String, default: '' },
  triggerClass: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
});
const emit = defineEmits(['update:modelValue']);
const forwarded = useForwardPropsEmits(
  { modelValue: props.modelValue, defaultValue: props.defaultValue, disabled: props.disabled },
  emit,
);
const triggerClasses = computed(() => cn(
  'flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1',
  props.triggerClass,
));

const normalized = computed(() => props.options.map(o => (typeof o === 'string' ? { value: o, label: o } : o)));
</script>

<template>
  <SelectRoot v-bind="forwarded">
    <SelectTrigger :class="triggerClasses">
      <SelectValue :placeholder="placeholder" />
      <SelectIcon class="ml-2 opacity-60">
        <HugeiconsIcon :icon="ArrowDown01Icon" :size="16" :stroke-width="2" />
      </SelectIcon>
    </SelectTrigger>
    <SelectPortal>
      <SelectContent
        :class="cn('relative z-50 max-h-72 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95', props.class)"
        position="popper"
        :side-offset="4">
        <SelectViewport class="p-1">
          <SelectItem
            v-for="opt in normalized" :key="opt.value" :value="opt.value"
            class="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50">
            <span class="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
              <SelectItemIndicator>
                <HugeiconsIcon :icon="Tick02Icon" :size="14" :stroke-width="2.5" />
              </SelectItemIndicator>
            </span>
            <SelectItemText>{{ opt.label }}</SelectItemText>
          </SelectItem>
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>
