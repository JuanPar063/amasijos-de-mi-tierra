import { NavLink, Outlet } from 'react-router-dom';

const items = [
  { to: '/', icono: '🏠', texto: 'Inicio' },
  { to: '/insumos', icono: '🌾', texto: 'Insumos' },
  { to: '/productos', icono: '🍞', texto: 'Productos' },
  { to: '/produccion', icono: '👨‍🍳', texto: 'Producir' },
  { to: '/entregas', icono: '🚲', texto: 'Entregas' },
];

export function Layout() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-amber-50">
      <main className="flex-1 px-4 pb-28 pt-6">
        <Outlet />
      </main>
      <nav className="fixed bottom-0 left-1/2 w-full max-w-md -translate-x-1/2 border-t border-amber-200 bg-white">
        <div className="grid grid-cols-5">
          {items.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-2 text-xs ${
                  isActive ? 'font-semibold text-amber-700' : 'text-amber-400'
                }`
              }
            >
              <span className="text-xl">{it.icono}</span>
              {it.texto}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
