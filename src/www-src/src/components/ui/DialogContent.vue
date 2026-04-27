<script setup>
import { computed } from 'vue';
import {
  DialogContent as RekaDialogContent,
  DialogClose,
  DialogOverlay,
  DialogPortal,
} from 'reka-ui';
import { HugeiconsIcon } from '@hugeicons/vue';
import { Cancel01Icon } from '@hugeicons/core-free-icons';
import { cn } from '@/lib/utils';

const props = defineProps({
  class: { type: String, default: '' },
  hideClose: { type: Boolean, default: false },
});
const classes = computed(() =>
  cn(
    'fixed left-1/2 top-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg',
    props.class,
  ),
);
</script>

<template>
  <DialogPortal>
    <DialogOverlay class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
    <RekaDialogContent :class="classes" v-bind="$attrs">
      <slot />
      <DialogClose v-if="!hideClose" class="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
        <HugeiconsIcon :icon="Cancel01Icon" :size="18" :stroke-width="2" />
        <span class="sr-only">Close</span>
      </DialogClose>
    </RekaDialogContent>
  </DialogPortal>
</template>
