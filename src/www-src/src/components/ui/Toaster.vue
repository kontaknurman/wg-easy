<script setup>
import { ref, watch } from 'vue';
import { TransitionGroup } from 'vue';
import { toasts, dismissToast } from '@/lib/toast';
import { HugeiconsIcon } from '@hugeicons/vue';
import { Cancel01Icon } from '@hugeicons/core-free-icons';

const list = ref(toasts);
watch(() => toasts.length, () => { list.value = toasts; });
</script>

<template>
  <div class="pointer-events-none fixed top-4 right-4 z-[100] flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-2">
    <TransitionGroup
      name="toast"
      tag="div"
      enter-active-class="transition transform ease-out duration-200"
      enter-from-class="translate-x-4 opacity-0"
      enter-to-class="translate-x-0 opacity-100"
      leave-active-class="transition transform ease-in duration-150"
      leave-from-class="translate-x-0 opacity-100"
      leave-to-class="translate-x-4 opacity-0"
      class="flex flex-col gap-2"
    >
      <div
        v-for="t in toasts" :key="t.id"
        :class="[
          'pointer-events-auto flex items-start gap-3 rounded-lg border p-4 shadow-lg backdrop-blur',
          t.variant === 'destructive'
            ? 'border-destructive/40 bg-destructive text-destructive-foreground'
            : 'border-border bg-card text-card-foreground'
        ]">
        <div class="flex-1 text-sm">
          <p v-if="t.title" class="font-medium leading-tight">{{ t.title }}</p>
          <p v-if="t.description" :class="['leading-snug', t.title ? 'mt-1 opacity-90' : '']">{{ t.description }}</p>
        </div>
        <button @click="dismissToast(t.id)" class="opacity-70 hover:opacity-100 transition-opacity">
          <HugeiconsIcon :icon="Cancel01Icon" :size="16" :stroke-width="2" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>
