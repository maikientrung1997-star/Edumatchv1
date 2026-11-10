import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '@/contexts';
import { AccountNotificationProvider } from '@/contexts/AccountNotificationProvider';
import { ChatProvider } from '@/contexts/ChatContext.jsx';
import AppRoutes from '@/routes';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ChatProvider>
          <AccountNotificationProvider>
            <AppRoutes />
          </AccountNotificationProvider>
        </ChatProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
