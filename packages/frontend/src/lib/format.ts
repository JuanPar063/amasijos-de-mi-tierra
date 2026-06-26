// Utilidades de presentación (fechas, horas, dinero).
// La conversión de peso vive en @panaderia/shared (formatGramos/formatLibras).

const pad = (n: number): string => String(n).padStart(2, '0');

/** Fecha de hoy en ISO 'YYYY-MM-DD' (hora local). */
export function hoyISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Primer día del mes actual en ISO. */
export function inicioDeMesISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
}

/** Lunes de la semana actual en ISO. */
export function inicioDeSemanaISO(): string {
  const d = new Date();
  const desdeLunes = (d.getDay() + 6) % 7; // 0=lunes … 6=domingo
  d.setDate(d.getDate() - desdeLunes);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Hora actual 'HH:MM' (hora local). */
export function ahoraHHMM(): string {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 'YYYY-MM-DD' -> 'DD/MM/YYYY'. */
export function formatFecha(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/** Lista de días ISO (inclusive) entre desde y hasta. */
export function diasEntre(desde: string, hasta: string): string[] {
  const out: string[] = [];
  const d = new Date(`${desde}T00:00:00`);
  const fin = new Date(`${hasta}T00:00:00`);
  while (d <= fin) {
    out.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/** Formatea un valor como pesos colombianos sin decimales. */
export function formatDinero(valor: number): string {
  return valor.toLocaleString('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  });
}
