import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';
import { DialogProvider } from './components/dialog';
import { RepoContext } from './storage/repo-context';
import { crearRepositorio } from './storage';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false } },
});

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('No se encontró el elemento #root');
const root = createRoot(rootElement);

// El repositorio se crea de forma asíncrona (SQLite nativo necesita abrir la BD).
crearRepositorio().then((repositorio) => {
  root.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RepoContext.Provider value={repositorio}>
          <DialogProvider>
            <App />
          </DialogProvider>
        </RepoContext.Provider>
      </QueryClientProvider>
    </StrictMode>,
  );
});
