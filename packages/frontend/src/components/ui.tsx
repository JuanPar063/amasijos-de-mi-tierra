// Componentes de UI reutilizables. Diseño simple: botones grandes, alto
// contraste, pensado para un usuario no técnico en el celular.
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from 'react';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  formatGramos,
  formatLibras,
  GRAMOS_POR_LIBRA,
  type UnidadBase,
} from '@panaderia/shared';

type Variante = 'primario' | 'secundario' | 'peligro';

const estilosBoton: Record<Variante, string> = {
  primario: 'bg-amber-600 text-white shadow-sm',
  secundario: 'bg-white text-amber-900 border border-amber-200',
  peligro: 'bg-red-600 text-white',
};

export function Boton({
  variante = 'primario',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-4 text-lg font-semibold transition active:scale-95 disabled:opacity-50 ${estilosBoton[variante]} ${className}`}
      {...props}
    />
  );
}

export function BotonFlotante({ onClick, texto = '+ Agregar' }: { onClick: () => void; texto?: string }) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-20 left-1/2 z-40 -translate-x-1/2 rounded-full bg-amber-600 px-7 py-4 text-lg font-bold text-white shadow-lg active:scale-95"
    >
      {texto}
    </button>
  );
}

export function Campo({
  etiqueta,
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { etiqueta: string }) {
  // `className` se aplica al contenedor (p. ej. flex-1); el input siempre ocupa
  // todo el ancho disponible. `min-w-0` permite que encoja dentro de filas flex.
  return (
    <label className={`flex min-w-0 flex-col gap-1 text-sm font-medium text-amber-900 ${className}`}>
      <span>{etiqueta}</span>
      <input
        className="w-full rounded-xl border border-amber-200 bg-white px-4 py-3 text-base text-amber-950 outline-none focus:border-amber-500"
        {...props}
      />
    </label>
  );
}

export function CampoSelector({
  etiqueta,
  opciones,
  placeholder,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  etiqueta: string;
  opciones: { valor: string; texto: string }[];
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-amber-900">
      <span>{etiqueta}</span>
      <select
        className="rounded-xl border border-amber-200 bg-white px-4 py-3 text-base text-amber-950 outline-none focus:border-amber-500"
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {opciones.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.texto}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Campo de peso con selector de unidad (lb/kg/g). Devuelve siempre gramos. */
export function CampoPeso({
  etiqueta,
  gramos,
  onGramos,
}: {
  etiqueta: string;
  gramos: number;
  onGramos: (g: number) => void;
}) {
  const [unidad, setUnidad] = useState<'g' | 'kg' | 'lb'>('lb');
  const factor = unidad === 'g' ? 1 : unidad === 'kg' ? 1000 : GRAMOS_POR_LIBRA;
  const texto = gramos ? String(Number((gramos / factor).toFixed(3))) : '';
  return (
    <div className="flex flex-col gap-1 text-sm font-medium text-amber-900">
      <span>{etiqueta}</span>
      <div className="flex gap-2">
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="any"
          value={texto}
          onChange={(e) => onGramos(e.target.value === '' ? 0 : Number(e.target.value) * factor)}
          className="min-w-0 flex-1 rounded-xl border border-amber-200 bg-white px-4 py-3 text-base outline-none focus:border-amber-500"
        />
        <select
          value={unidad}
          onChange={(e) => setUnidad(e.target.value as 'g' | 'kg' | 'lb')}
          className="rounded-xl border border-amber-200 bg-white px-3 text-base"
        >
          <option value="lb">lb</option>
          <option value="kg">kg</option>
          <option value="g">g</option>
        </select>
      </div>
      {gramos > 0 && (
        <span className="text-xs font-normal text-amber-600">
          {formatGramos(gramos)} · {formatLibras(gramos)}
        </span>
      )}
    </div>
  );
}

/** Campo de cantidad que se adapta a la unidad base del insumo. */
export function CampoCantidad({
  etiqueta,
  unidadBase,
  cantidad,
  onCantidad,
}: {
  etiqueta: string;
  unidadBase: UnidadBase;
  cantidad: number;
  onCantidad: (n: number) => void;
}) {
  if (unidadBase === 'u') {
    return (
      <label className="flex flex-col gap-1 text-sm font-medium text-amber-900">
        <span>
          {etiqueta} <span className="font-normal text-amber-500">(unidades)</span>
        </span>
        <input
          type="number"
          inputMode="numeric"
          min="0"
          step="1"
          value={cantidad ? String(cantidad) : ''}
          onChange={(e) => onCantidad(e.target.value === '' ? 0 : Number(e.target.value))}
          className="rounded-xl border border-amber-200 bg-white px-4 py-3 text-base text-amber-950 outline-none focus:border-amber-500"
        />
      </label>
    );
  }
  return <CampoPeso etiqueta={etiqueta} gramos={cantidad} onGramos={onCantidad} />;
}

export function Tarjeta({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-white p-4 shadow-sm ${className}`}>{children}</div>;
}

export function EncabezadoPagina({ titulo, accion }: { titulo: string; accion?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h1 className="text-2xl font-bold text-amber-950">{titulo}</h1>
      {accion}
    </div>
  );
}

export function PantallaVacia({
  icono,
  titulo,
  descripcion,
}: {
  icono: string;
  titulo: string;
  descripcion?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center text-amber-700">
      <span className="text-5xl">{icono}</span>
      <p className="text-lg font-semibold">{titulo}</p>
      {descripcion && <p className="text-sm">{descripcion}</p>}
    </div>
  );
}

export function Sheet({
  abierto,
  titulo,
  onClose,
  children,
}: {
  abierto: boolean;
  titulo: string;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!abierto) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-amber-50 p-5 pb-8 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-amber-950">{titulo}</h2>
          <button onClick={onClose} className="rounded-full p-2 text-2xl leading-none text-amber-700">
            ×
          </button>
        </div>
        <div className="flex flex-col gap-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
