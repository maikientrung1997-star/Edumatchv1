import { useContext } from 'react';
import { ChatContext } from '@/contexts/ChatStateContext';

export function useChat() {
  const value = useContext(ChatContext);
  if (!value) throw new Error('ChatProvider is required');
  return value;
}

