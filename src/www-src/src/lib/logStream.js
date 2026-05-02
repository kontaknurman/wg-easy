// Shared EventSource manager for the connection log streams.
//
// Multiple components on the same page (the inline preview on the client
// detail page and the "Open full log" dialog) used to open their own
// `EventSource` to `/api/wireguard/client/<id>/log/stream`. In practice the
// dialog's stream sometimes stopped delivering events while the inline one
// kept going — most likely because two simultaneous SSE requests to the same
// path got coalesced or one was killed by an intermediary proxy.
//
// This module keeps exactly one EventSource per peer id and ref-counts how
// many components want it open. The shared `events` ref is read directly by
// every consumer so they can never diverge: if the inline preview is
// receiving events, so is the dialog.

import { ref } from 'vue';
import { api } from '@/api/client';

const LIVE_CAP = 1000;
const stores = new Map(); // clientId -> store

function makeStore(clientId) {
  const events = ref([]);
  const streamState = ref('idle'); // 'idle' | 'connecting' | 'open' | 'reconnecting' | 'failed'
  let evtSource = null;
  let refCount = 0;

  function open() {
    close();
    if (typeof window === 'undefined' || !window.EventSource) return;
    streamState.value = 'connecting';
    // Cache-buster so any intermediate proxy can't coalesce with another open
    // EventSource to the same path.
    const url = `${api.logStreamUrl({ clientId })}?_t=${Date.now()}`;
    evtSource = new EventSource(url);
    evtSource.onopen = () => { streamState.value = 'open'; };
    evtSource.onmessage = (e) => {
      streamState.value = 'open';
      try {
        const ev = JSON.parse(e.data);
        events.value.push(ev);
        if (events.value.length > LIVE_CAP) {
          events.value.splice(0, events.value.length - LIVE_CAP);
        }
      } catch { /* ignore malformed line */ }
    };
    evtSource.onerror = () => {
      if (evtSource && evtSource.readyState === 2) streamState.value = 'failed';
      else streamState.value = 'reconnecting';
    };
  }

  function close() {
    if (evtSource) {
      try { evtSource.close(); } catch { /* ignore */ }
      evtSource = null;
    }
    streamState.value = 'idle';
  }

  function reconnect() {
    events.value = [];
    open();
  }

  function clear() {
    events.value = [];
  }

  return {
    events,
    streamState,
    inc() { refCount++; if (refCount === 1) open(); },
    dec() { refCount--; if (refCount <= 0) { close(); stores.delete(clientId); } },
    reconnect,
    clear,
  };
}

export function attachLogStream(clientId) {
  if (!clientId) return null;
  let store = stores.get(clientId);
  if (!store) {
    store = makeStore(clientId);
    stores.set(clientId, store);
  }
  store.inc();
  return store;
}

export function detachLogStream(clientId) {
  if (!clientId) return;
  const store = stores.get(clientId);
  if (!store) return;
  store.dec();
}
