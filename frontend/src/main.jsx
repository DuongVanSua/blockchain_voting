import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import App from './App';
import ErrorBoundary from './components/common/ErrorBoundary';
import './index.css';



const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30000,
    },
  },
});





const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}


if (import.meta.env.DEV) {
  // eslint-disable-next-line no-console
  console.log('Starting React app...');
}


window.addEventListener('error', (event) => {

  console.error('Unhandled error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {

  console.error('Unhandled promise rejection:', event.reason);
});

try {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <App />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#363636',
                color: '#fff',
              },
              success: {
                duration: 3000,
                iconTheme: {
                  primary: '#10B981',
                  secondary: '#fff',
                },
              },
              error: {
                duration: 5000,
                iconTheme: {
                  primary: '#EF4444',
                  secondary: '#fff',
                },
              },
            }}
          />
        </QueryClientProvider>
      </ErrorBoundary>
    </React.StrictMode>
  );
} catch (error) {
  console.error('Failed to render React app:', error);
  console.error('Error stack:', error.stack);
  rootElement.innerHTML = `
    <div style="padding: 20px; text-align: center; font-family: Arial, sans-serif;">
      <h1 style="color: #ef4444;">Lỗi khởi động ứng dụng</h1>
      <p style="color: #6b7280;">${error.message}</p>
      <pre style="text-align: left; background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
        ${error.stack || 'No stack trace'}
      </pre>
      <button onclick="window.location.reload()" style="padding: 10px 20px; background: #2563eb; color: white; border: none; border-radius: 5px; cursor: pointer;">
        Tải lại trang
      </button>
    </div>
  `;
}
