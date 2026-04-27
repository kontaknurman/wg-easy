<script setup>
import Dialog from '@/components/ui/Dialog.vue';
import DialogContent from '@/components/ui/DialogContent.vue';
import DialogHeader from '@/components/ui/DialogHeader.vue';
import DialogTitle from '@/components/ui/DialogTitle.vue';
import DialogDescription from '@/components/ui/DialogDescription.vue';
import DialogFooter from '@/components/ui/DialogFooter.vue';
import Button from '@/components/ui/Button.vue';
import { HugeiconsIcon } from '@hugeicons/vue';
import { Delete02Icon } from '@hugeicons/core-free-icons';

const props = defineProps({
  open: { type: Boolean, default: false },
  client: { type: Object, default: null },
});
const emit = defineEmits(['update:open', 'confirm']);

function setOpen(v) { emit('update:open', v); }
</script>

<template>
  <Dialog :open="open" @update:open="setOpen">
    <DialogContent class="max-w-md">
      <DialogHeader>
        <div class="flex items-center gap-3">
          <div class="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/15 text-destructive">
            <HugeiconsIcon :icon="Delete02Icon" :size="20" :stroke-width="2" />
          </div>
          <div>
            <DialogTitle>Delete client</DialogTitle>
            <DialogDescription class="mt-1">
              <span v-if="client"><span class="font-medium text-foreground">{{ client.name }}</span> will lose access immediately. This action cannot be undone.</span>
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" @click="setOpen(false)">Cancel</Button>
        <Button variant="destructive" @click="emit('confirm')">Delete client</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
