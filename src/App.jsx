import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '@/contexts';
import { ChatProvider } from '@/contexts/ChatContext.jsx';
import AppRoutes from '@/routes';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ChatProvider>
          {/* Centralized Route Tree */}
          <AppRoutes />
        </ChatProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
