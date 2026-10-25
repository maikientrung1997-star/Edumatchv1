/**
 * Reference-count channels shared by independent features on one connection.
 *
 * `graceMs` (number or `(name) => number`) keeps an unreferenced channel subscribed for a short time,
 * so quickly re-opening it reuses the live subscription instead of paying another /broadcasting/auth round trip.
 */
export function createPusherChannelPool(getClient, { graceMs = 0 } = {}) {
  const references = new Map();
  const graceFor = (name) => (typeof graceMs === 'function' ? graceMs(name) : graceMs) || 0;
  const drop = (name, entry) => {
    clearTimeout(entry.timer);
    if (references.get(name) !== entry) return;
    entry.pusher.unsubscribe(name);
    references.delete(name);
  };
  return {
    acquire(name) {
      const pusher = getClient();
      if (!pusher) return null;
      let entry = references.get(name);
      if (entry && entry.pusher !== pusher) { clearTimeout(entry.timer); references.delete(name); entry = null; }
      if (!entry) {
        entry = { channel: pusher.subscribe(name), pusher, count: 0, timer: null };
        references.set(name, entry);
      }
      clearTimeout(entry.timer);
      entry.timer = null;
      entry.count++;
      let released = false;
      return { pusher, channel: entry.channel, release: () => {
        if (released) return;
        released = true;
        if (references.get(name) !== entry) return;
        entry.count--;
        if (entry.count) return;
        const wait = graceFor(name);
        if (!wait) { drop(name, entry); return; }
        entry.timer = setTimeout(() => { if (!entry.count) drop(name, entry); }, wait);
      } };
    },
    clear: () => { references.forEach((entry) => clearTimeout(entry.timer)); references.clear(); },
  };
}
