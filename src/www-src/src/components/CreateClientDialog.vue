<script setup>
import { ref, watch } from 'vue';
import Dialog from '@/components/ui/Dialog.vue';
import DialogContent from '@/components/ui/DialogContent.vue';
import DialogHeader from '@/components/ui/DialogHeader.vue';
import DialogTitle from '@/components/ui/DialogTitle.vue';
import DialogDescription from '@/components/ui/DialogDescription.vue';
import DialogFooter from '@/components/ui/DialogFooter.vue';
import Button from '@/components/ui/Button.vue';
import Input from '@/components/ui/Input.vue';
import Label from '@/components/ui/Label.vue';
import { HugeiconsIcon } from '@hugeicons/vue';
import { UserAdd01Icon } from '@hugeicons/core-free-icons';

const props = defineProps({ open: { type: Boolean, default: false } });
const emit = defineEmits(['update:open', 'create']);

const name = ref('');

watch(() => props.open, (v) => { if (v) name.value = ''; });

function setOpen(v) { emit('update:open', v); }

function submit() {
  const trimmed = name.value.trim();
  if (!trimmed) return;
  emit('create', trimmed);
}
</script>

<template>
  <Dialog :open="open" @update:open="setOpen">
    <DialogContent class="max-w-md">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <HugeiconsIcon :icon="UserAdd01Icon" :size="20" :stroke-width="2" />
          New client
        </DialogTitle>
        <DialogDescription>Add a new WireGuard peer. A keypair and IP will be generated automatically.</DialogDescription>
      </DialogHeader>
      <form class="grid gap-3" @submit.prevent="submit">
        <Label for="client-name">Name</Label>
        <Input id="client-name" v-model="name" placeholder="e.g. phone, laptop" autofocus />
      </form>
      <DialogFooter>
        <Button variant="outline" @click="setOpen(false)">Cancel</Button>
        <Button :disabled="!name.trim()" @click="submit">Create client</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
