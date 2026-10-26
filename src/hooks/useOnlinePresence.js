import { useChat } from '@/hooks/useChat';

export function useOnlinePresence() {
  const { online, presenceReady } = useChat();
  return { isOnline: (id) => presenceReady && online.has(String(id)) };
}
