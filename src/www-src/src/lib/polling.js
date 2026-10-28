import { onMounted, onUnmounted } from 'vue';

// Runs `task` on mount and then `intervalMs` after each run *finishes*, so a
// slow server never gets overlapping requests from the same page. Polling
// stops while the tab is hidden (no point refreshing what nobody sees, and
// every poll costs the server a `wg show`) and resumes immediately when the
// tab becomes visible again.
export function usePolling(task, intervalMs) {
  let timer = null;
  let running = false;
  let stopped = false;

  const hidden = () => typeof document !== 'undefined' && document.visibilityState === 'hidden';

  async function tick() {
    timer = null;
    if (stopped || running || hidden()) return;
    running = true;
    try {
      await task();
    } catch { /* the task reports its own errors */ } finally {
      running = false;
    }
    if (!stopped && !hidden() && !timer) timer = setTimeout(tick, intervalMs);
  }

  function onVisibilityChange() {
    if (!hidden() && !timer && !running) tick();
  }

  onMounted(() => {
    document.addEventListener('visibilitychange', onVisibilityChange);
    tick();
  });
  onUnmounted(() => {
    stopped = true;
    if (timer) clearTimeout(timer);
    timer = null;
    document.removeEventListener('visibilitychange', onVisibilityChange);
  });
}
