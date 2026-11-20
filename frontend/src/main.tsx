import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
///import {QueryClient ,QueryClientProvider } from '@tanstack/react-query';

// const queryClient = new QueryClient({
//   defaultOptions : {
//     queries : {
//       staleTime : 1000 * 60 * 15, //  015 minits cashe
//       gcTime : 1000* 60 * 30, // garbage collection 
//       refetchOnWFocus : false,      // 
//  retry : 2      
//     }
//   }
// });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <NotificationProvider>
        <App />
      </NotificationProvider>
    </AuthProvider>
  </StrictMode>,
);
