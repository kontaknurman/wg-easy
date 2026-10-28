<script setup>
import { ref, provide, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import Toaster from '@/components/ui/Toaster.vue';
import { api, onUnauthorized } from '@/api/client';
import { toastError } from '@/lib/toast';
import { loadSettings, settings } from '@/lib/settings';

const session = ref(null);
const ready = ref(false);
const router = useRouter();

// The first navigation guard and onMounted both ask for the session at
// startup; share one request instead of sending two.
let sessionRequest = null;
function refreshSession() {
  if (!sessionRequest) {
    sessionRequest = api.getSession()
      .then((s) => { session.value = s; })
      .catch((err) => { toastError(err); })
      .finally(() => {
        ready.value = true;
        sessionRequest = null;
      });
  }
  return sessionRequest;
}

provide('session', session);
provide('refreshSession', refreshSession);
provide('settings', settings);

onUnauthorized(() => {
  if (session.value) session.value = { ...session.value, authenticated: false };
  if (router.currentRoute.value.meta?.auth) router.push('/login');
});

onMounted(async () => {
  await Promise.all([refreshSession(), loadSettings()]);
});

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
