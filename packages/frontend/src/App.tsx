import { createHashRouter, RouterProvider } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { InsumosPage } from './pages/InsumosPage';
import { ComprasPage } from './pages/ComprasPage';
import { ProductosPage } from './pages/ProductosPage';
import { ProduccionPage } from './pages/ProduccionPage';
import { TiendasPage } from './pages/TiendasPage';
import { EntregasPage } from './pages/EntregasPage';
import { ReportesPage } from './pages/ReportesPage';

// HashRouter: funciona en hosting estático (GitHub/Cloudflare Pages) y offline
// sin necesidad de reescrituras del servidor.
const router = createHashRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Dashboard /> },
      { path: '/insumos', element: <InsumosPage /> },
      { path: '/compras', element: <ComprasPage /> },
      { path: '/productos', element: <ProductosPage /> },
      { path: '/produccion', element: <ProduccionPage /> },
      { path: '/tiendas', element: <TiendasPage /> },
      { path: '/entregas', element: <EntregasPage /> },
      { path: '/reportes', element: <ReportesPage /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
