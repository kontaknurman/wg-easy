<script setup>
import { ref, provide, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import Toaster from '@/components/ui/Toaster.vue';
import { api } from '@/api/client';
import { toastError } from '@/lib/toast';

const session = ref(null);
const ready = ref(false);
const router = useRouter();

async function refreshSession() {
  try {
    session.value = await api.getSession();
  } catch (err) {
    toastError(err);
  } finally {
    ready.value = true;
  }
}

provide('session', session);
provide('refreshSession', refreshSession);

onMounted(refreshSession);

router.beforeEach(async (to) => {
  if (!ready.value) await refreshSession();
  const sess = session.value;
  if (to.meta?.auth && sess?.requiresPassword && !sess.authenticated) {
    return { path: '/login' };
  }
  if (to.path === '/login' && sess?.authenticated) {
    return { path: '/' };
  }
  return true;
});
</script>

<template>
  <template v-if="ready">
    <router-view />
  </template>
  <template v-else>
    <div class="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading…</div>
  </template>
  <Toaster />
</template>
