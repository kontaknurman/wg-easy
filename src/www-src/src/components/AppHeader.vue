<script setup>
import { useRouter } from 'vue-router';
import Button from '@/components/ui/Button.vue';
import { HugeiconsIcon } from '@hugeicons/vue';
import { Logout03Icon, BookOpen01Icon, ShieldEnergyIcon, Moon02Icon, Sun03Icon } from '@hugeicons/core-free-icons';
import { ref, onMounted, watch } from 'vue';
import { api } from '@/api/client';
import { toastError } from '@/lib/toast';

const props = defineProps({ requiresPassword: { type: Boolean, default: false } });
const emit = defineEmits(['logged-out']);
const router = useRouter();

const dark = ref(false);
onMounted(() => {
  const saved = localStorage.getItem('theme');
  dark.value = saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.classList.toggle('dark', dark.value);
});
watch(dark, (v) => {
  document.documentElement.classList.toggle('dark', v);
  localStorage.setItem('theme', v ? 'dark' : 'light');
});

async function logout() {
  try {
    await api.deleteSession();
    emit('logged-out');
    router.push('/login');
  } catch (err) { toastError(err); }
}
</script>

<template>
  <header class="sticky top-0 z-30 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
    <div class="container mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
      <router-link to="/" class="flex items-center gap-2 font-semibold">
        <HugeiconsIcon :icon="ShieldEnergyIcon" :size="22" :stroke-width="2" class="text-primary" />
        <span>wg-easy</span>
      </router-link>

      <div class="flex items-center gap-1">
        <Button variant="ghost" size="sm" :as="'router-link'" to="/docs" class="hidden sm:inline-flex">
          <HugeiconsIcon :icon="BookOpen01Icon" :size="16" :stroke-width="2" />
          API docs
        </Button>
        <Button variant="ghost" size="icon" class="h-9 w-9" :title="dark ? 'Switch to light' : 'Switch to dark'" @click="dark = !dark">
          <HugeiconsIcon :icon="dark ? Sun03Icon : Moon02Icon" :size="18" :stroke-width="2" />
        </Button>
        <Button v-if="requiresPassword" variant="ghost" size="sm" @click="logout">
          <HugeiconsIcon :icon="Logout03Icon" :size="16" :stroke-width="2" />
          <span class="hidden sm:inline">Logout</span>
        </Button>
      </div>
    </div>
  </header>
</template>
