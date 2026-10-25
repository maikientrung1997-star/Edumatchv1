/** Reference-count channels shared by independent features on one connection. */
export function createPusherChannelPool(getClient) {
  const references = new Map();
  return {
    acquire(name) {
      const pusher = getClient();
      if (!pusher) return null;
      let entry = references.get(name);
      if (!entry) {
        entry = { channel: pusher.subscribe(name), count: 0 };
        references.set(name, entry);
      }
      entry.count++;
      let released = false;
      return { pusher, channel: entry.channel, release: () => {
        if (released) return;
        released = true;
        if (references.get(name) !== entry) return;
        entry.count--;
        if (!entry.count) { pusher.unsubscribe(name); references.delete(name); }
      } };
    },
    clear: () => references.clear(),
  };
}
