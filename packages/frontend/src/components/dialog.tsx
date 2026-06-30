// Diálogos in-app (aviso y confirmación) con la estética del front, en vez de
// alert()/confirm() del navegador. API basada en promesas: useDialog().
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Boton } from './ui';

interface OpcionesConfirmar {
  titulo?: string;
  textoConfirmar?: string;
  peligro?: boolean;
}

interface DialogApi {
  alertar: (mensaje: string, opts?: { titulo?: string }) => Promise<void>;
  confirmar: (mensaje: string, opts?: OpcionesConfirmar) => Promise<boolean>;
}

interface EstadoDialog {
  titulo: string;
  mensaje: string;
  esConfirm: boolean;
  textoConfirmar: string;
  peligro: boolean;
  resolver: (v: boolean) => void;
}

const DialogContext = createContext<DialogApi | null>(null);

export function useDialog(): DialogApi {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialog debe usarse dentro de <DialogProvider>');
  return ctx;
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoDialog | null>(null);

  const alertar = useCallback(
    (mensaje: string, opts?: { titulo?: string }) =>
      new Promise<void>((resolve) => {
        setEstado({
          titulo: opts?.titulo ?? 'Aviso',
          mensaje,
          esConfirm: false,
          textoConfirmar: 'Entendido',
          peligro: false,
          resolver: () => resolve(),
        });
      }),
    [],
  );

  const confirmar = useCallback(
    (mensaje: string, opts?: OpcionesConfirmar) =>
      new Promise<boolean>((resolve) => {
        setEstado({
          titulo: opts?.titulo ?? 'Confirmar',
          mensaje,
          esConfirm: true,
          textoConfirmar: opts?.textoConfirmar ?? 'Confirmar',
          peligro: opts?.peligro ?? false,
          resolver: resolve,
        });
      }),
    [],
  );

  function responder(valor: boolean) {
    estado?.resolver(valor);
    setEstado(null);
  }

  return (
    <DialogContext.Provider value={{ alertar, confirmar }}>
      {children}
      {estado &&
        createPortal(
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-6"
            onClick={() => responder(false)}
          >
            <div
              className="w-full max-w-sm rounded-2xl bg-amber-50 p-5 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="mb-2 text-lg font-bold text-amber-950">{estado.titulo}</h2>
              <p className="mb-5 whitespace-pre-line text-sm text-amber-800">{estado.mensaje}</p>
              <div className="flex justify-end gap-2">
                {estado.esConfirm && (
                  <Boton variante="secundario" className="px-4 py-3" onClick={() => responder(false)}>
                    Cancelar
                  </Boton>
                )}
                <Boton
                  variante={estado.peligro ? 'peligro' : 'primario'}
                  className="px-4 py-3"
                  onClick={() => responder(true)}
                >
                  {estado.textoConfirmar}
                </Boton>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </DialogContext.Provider>
  );
}
