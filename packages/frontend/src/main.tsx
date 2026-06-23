import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';
import { RepoContext } from './storage/repo-context';
import { getRepository } from './storage';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false } },
});
const repositorio = getRepository();

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('No se encontró el elemento #root');

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RepoContext.Provider value={repositorio}>
        <App />
      </RepoContext.Provider>
    </QueryClientProvider>
  </StrictMode>,
);
