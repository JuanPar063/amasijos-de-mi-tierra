-- Esquema PostgreSQL de la panadería (versión nube).
-- Idéntico en concepto al adaptador local (Dexie). Cantidades en la unidad base
-- del insumo (gramos para peso, unidades para conteo). Fechas como texto ISO
-- 'YYYY-MM-DD' y horas 'HH:MM' para round-trip exacto con el dominio.

CREATE TABLE IF NOT EXISTS insumos (
  id           TEXT PRIMARY KEY,
  nombre       TEXT NOT NULL,
  unidad_base  TEXT NOT NULL CHECK (unidad_base IN ('g', 'u')),
  stock_actual DOUBLE PRECISION NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS compras_insumo (
  id          TEXT PRIMARY KEY,
  insumo_id   TEXT NOT NULL REFERENCES insumos(id) ON DELETE CASCADE,
  fecha       TEXT NOT NULL,
  cantidad    DOUBLE PRECISION NOT NULL,
  costo_total DOUBLE PRECISION NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_compras_insumo ON compras_insumo(insumo_id);
CREATE INDEX IF NOT EXISTS idx_compras_fecha ON compras_insumo(fecha);

CREATE TABLE IF NOT EXISTS productos (
  id               TEXT PRIMARY KEY,
  nombre           TEXT NOT NULL,
  precio_venta     DOUBLE PRECISION NOT NULL DEFAULT 0,
  precio_mostrador DOUBLE PRECISION,
  empaque_insumo_id TEXT
);
-- Migración para bases existentes:
ALTER TABLE productos ADD COLUMN IF NOT EXISTS precio_mostrador DOUBLE PRECISION;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS empaque_insumo_id TEXT;

CREATE TABLE IF NOT EXISTS recetas (
  id          TEXT PRIMARY KEY,
  producto_id TEXT NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  insumo_id   TEXT NOT NULL REFERENCES insumos(id) ON DELETE CASCADE,
  cantidad    DOUBLE PRECISION NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_recetas_producto ON recetas(producto_id);

CREATE TABLE IF NOT EXISTS producciones (
  id                TEXT PRIMARY KEY,
  fecha             TEXT NOT NULL,
  hora              TEXT NOT NULL,
  producto_id       TEXT NOT NULL,
  cantidad_unidades DOUBLE PRECISION NOT NULL,
  merma_g           DOUBLE PRECISION
);
CREATE INDEX IF NOT EXISTS idx_producciones_fecha ON producciones(fecha);

CREATE TABLE IF NOT EXISTS tiendas (
  id        TEXT PRIMARY KEY,
  nombre    TEXT NOT NULL,
  direccion TEXT,
  contacto  TEXT
);

CREATE TABLE IF NOT EXISTS entregas (
  id        TEXT PRIMARY KEY,
  fecha     TEXT NOT NULL,
  hora      TEXT NOT NULL,
  tienda_id TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_entregas_fecha ON entregas(fecha);

CREATE TABLE IF NOT EXISTS entrega_items (
  id              TEXT PRIMARY KEY,
  entrega_id      TEXT NOT NULL REFERENCES entregas(id) ON DELETE CASCADE,
  producto_id     TEXT NOT NULL,
  cantidad        DOUBLE PRECISION NOT NULL,
  precio_unitario DOUBLE PRECISION NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_entrega_items_entrega ON entrega_items(entrega_id);

-- Venta directa en el mostrador: acumulado por día y producto (una fila por par).
CREATE TABLE IF NOT EXISTS ventas_directas (
  id              TEXT PRIMARY KEY,
  fecha           TEXT NOT NULL,
  producto_id     TEXT NOT NULL,
  cantidad        DOUBLE PRECISION NOT NULL,
  precio_unitario DOUBLE PRECISION NOT NULL,
  UNIQUE (fecha, producto_id)
);
CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON ventas_directas(fecha);
