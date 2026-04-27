<script setup>
import { computed } from 'vue';
import Dialog from '@/components/ui/Dialog.vue';
import DialogContent from '@/components/ui/DialogContent.vue';
import DialogHeader from '@/components/ui/DialogHeader.vue';
import DialogTitle from '@/components/ui/DialogTitle.vue';
import DialogDescription from '@/components/ui/DialogDescription.vue';
import { api } from '@/api/client';
import { HugeiconsIcon } from '@hugeicons/vue';
import { QrCode01Icon } from '@hugeicons/core-free-icons';

const props = defineProps({
  open: { type: Boolean, default: false },
  client: { type: Object, default: null },
});
const emit = defineEmits(['update:open']);
const url = computed(() => (props.client ? api.qrCodeUrl({ clientId: props.client.id }) : ''));
function setOpen(v) { emit('update:open', v); }
</script>

<template>
  <Dialog :open="open" @update:open="setOpen">
    <DialogContent class="max-w-sm">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <HugeiconsIcon :icon="QrCode01Icon" :size="20" :stroke-width="2" />
          Configuration QR
        </DialogTitle>
        <DialogDescription v-if="client">Scan with the WireGuard mobile app to import <span class="font-medium text-foreground">{{ client.name }}</span>.</DialogDescription>
      </DialogHeader>
      <div class="flex justify-center rounded-lg bg-white p-4">
        <img v-if="open" :src="url" alt="QR code" class="h-72 w-72" />
      </div>
    </DialogContent>
  </Dialog>
</template>
