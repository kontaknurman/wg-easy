<script setup>
import { ref, watch, computed } from 'vue';
import { HugeiconsIcon } from '@hugeicons/vue';
import {
  BlockedIcon, Add01Icon, Cancel01Icon, AlertCircleIcon, CheckmarkCircle02Icon,
} from '@hugeicons/core-free-icons';
import Dialog from '@/components/ui/Dialog.vue';
import DialogContent from '@/components/ui/DialogContent.vue';
import DialogHeader from '@/components/ui/DialogHeader.vue';
import DialogTitle from '@/components/ui/DialogTitle.vue';
import DialogDescription from '@/components/ui/DialogDescription.vue';
import DialogFooter from '@/components/ui/DialogFooter.vue';
import Button from '@/components/ui/Button.vue';
import Input from '@/components/ui/Input.vue';
import Label from '@/components/ui/Label.vue';

const props = defineProps({
  open: { type: Boolean, default: false },
  client: { type: Object, default: null },
});
const emit = defineEmits(['update:open', 'save']);

const list = ref([]);
const draft = ref('');

// Mirror of the backend domainPatternToSubstring sanity check.
function looksUseful(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim().replace(/\*/g, '');
  return /[a-z0-9]/i.test(trimmed);
}

const draftValid = computed(() => looksUseful(draft.value));
const draftDup = computed(() => {
  const v = draft.value.trim().toLowerCase();
  return v && list.value.some(e => e.toLowerCase() === v);
});

watch(
  [() => props.open, () => props.client?.id],
  () => {
    if (!props.open || !props.client) return;
    list.value = Array.isArray(props.client.blockedDomains) ? props.client.blockedDomains.slice() : [];
    draft.value = '';
  },
  { immediate: true },
);

function setOpen(v) { emit('update:open', v); }

function add() {
  const v = draft.value.trim().toLowerCase();
  if (!v || !looksUseful(v) || list.value.length >= 50) return;
  if (list.value.some(e => e.toLowerCase() === v)) {
    draft.value = '';
    return;
  }
  list.value.push(v);
  draft.value = '';
}

function remove(i) {
  list.value.splice(i, 1);
}

function save() {
  emit('save', list.value.slice());
}
</script>

<template>
  <Dialog :open="open" @update:open="setOpen">
    <DialogContent class="max-w-md">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <HugeiconsIcon :icon="BlockedIcon" :size="20" :stroke-width="2" />
          Blocked websites
        </DialogTitle>
        <DialogDescription v-if="client">
          Drop traffic for <span class="font-medium text-foreground">{{ client.name }}</span> that targets the listed
          domains. Enforced via iptables string match on TLS SNI / HTTP Host / DNS payload.
        </DialogDescription>
      </DialogHeader>

      <div class="grid gap-3 py-2">
        <div class="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
          <p class="font-medium text-foreground">Pattern syntax</p>
          <p><code class="rounded bg-background/60 px-1">youtube.com</code> — bare domain <em>plus</em> every subdomain (substring match).</p>
          <p><code class="rounded bg-background/60 px-1">*.facebook.com</code> — subdomains only, not <code>facebook.com</code> itself.</p>
          <p><code class="rounded bg-background/60 px-1">*ads*</code> — match <code>ads</code> anywhere in the SNI / Host / DNS payload.</p>
        </div>

        <div class="grid gap-2">
          <Label for="blockd">Add a pattern</Label>
          <div class="flex items-center gap-2">
            <Input id="blockd" v-model="draft" placeholder="e.g. youtube.com, *.facebook.com, *ads*"
                   class="font-mono text-sm h-8" @keyup.enter.prevent="add" />
            <Button type="button" variant="outline" size="sm" :disabled="!draftValid || draftDup || list.length >= 50" @click="add">
              <HugeiconsIcon :icon="Add01Icon" :size="14" :stroke-width="2" />
              Add
            </Button>
          </div>
          <p v-if="draft && !draftValid" class="text-xs text-destructive">Pattern needs at least one alphanumeric character.</p>
          <p v-else-if="draftDup" class="text-xs text-amber-700 dark:text-amber-400">Already in the list.</p>

          <ul v-if="list.length" class="rounded-md border divide-y bg-muted/20 max-h-48 overflow-y-auto">
            <li v-for="(entry, i) in list" :key="entry"
                class="flex items-center justify-between px-3 py-1.5 text-sm">
              <code class="font-mono">{{ entry }}</code>
              <button type="button" class="text-muted-foreground hover:text-destructive" :title="`Remove ${entry}`" @click="remove(i)">
                <HugeiconsIcon :icon="Cancel01Icon" :size="14" :stroke-width="2" />
              </button>
            </li>
          </ul>
          <p v-else class="text-xs text-muted-foreground">Empty list = nothing blocked.</p>
        </div>

        <div class="flex items-start gap-3 rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
          <HugeiconsIcon :icon="AlertCircleIcon" :size="16" :stroke-width="2" class="mt-0.5 shrink-0" />
          <p>
            <strong>Limitations:</strong> DoH / DoT (encrypted DNS), TLS Encrypted ClientHello, and direct-to-IP
            traffic bypass this filter. Substring matching can also produce false positives — e.g. blocking
            <code>example</code> would also catch <code>noexample.com</code>.
          </p>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="setOpen(false)">Cancel</Button>
        <Button @click="save">
          <HugeiconsIcon :icon="CheckmarkCircle02Icon" :size="16" :stroke-width="2" />
          Save
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
