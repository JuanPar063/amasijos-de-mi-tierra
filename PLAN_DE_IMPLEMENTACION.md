# Plan de implementación — App de gestión para panadería

> **Para:** Claude Code
> **Autor del proyecto:** Pardo
> **Objetivo de este documento:** servir como brief de arranque. Léelo completo, crea un `CLAUDE.md` a partir de él y trabaja **fase por fase**, deteniéndote al final de cada fase para que el autor revise antes de continuar.

---

## 1. Resumen del proyecto

Aplicación para que un panadero lleve el control de su producción, insumos, costos, ventas y distribución a tiendas. Debe existir en **dos versiones que comparten el mismo código**:

- **Versión práctica (uso real, gratis, offline):** app que corre en el celular guardando los datos **localmente en el dispositivo**, sin servidores ni servicios pagos. Es la que usará el papá del autor a diario.
- **Versión showcase (portafolio, en la nube):** la misma app conectada a un backend en AWS, desplegada con Terraform (IaC) y CI/CD. Se levanta para demostrar arquitectura cloud y se destruye para no generar costos.

La clave técnica es una **interfaz de almacenamiento intercambiable**: el frontend se escribe una sola vez y solo cambia el "adaptador" que decide dónde viven los datos (local vs API).

### Principios de diseño (no negociables)
1. **UI extremadamente simple.** El usuario final no es técnico. Botones grandes, mínimo texto que escribir, flujos de 2–3 toques.
2. **Offline-first.** La app debe funcionar sin conexión en su versión práctica.
3. **Una sola fuente de lógica.** Cálculos (costos, márgenes, conversión de unidades) viven en un paquete compartido, no duplicados.
4. **Los datos importan.** Es información de negocio: incluir respaldo (PDF + JSON) antes de permitir borrar.

---

## 2. Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Lenguaje | TypeScript en todo el proyecto |
| Frontend | React + Vite, configurado como PWA |
| Estilos | Tailwind CSS |
| Estado | React Query (datos) + estado local con hooks |
| Almacenamiento local (web/MVP) | IndexedDB vía Dexie |
| Almacenamiento local (nativo) | SQLite vía `@capacitor-community/sqlite` |
| Empaquetado nativo | Capacitor (target Android / APK) |
| Backend (versión nube) | Node + Express + TypeScript |
| Base de datos (versión nube) | PostgreSQL |
| Generación de PDF | `pdfmake` (cliente, sin servidor) |
| Contenedores | Docker + Docker Compose |
| IaC | Terraform |
| CI/CD | GitHub Actions |

**Importante sobre unidades:** todo se almacena internamente en **gramos** (unidad base). La conversión a libras es solo de presentación. `1 libra = 453.59237 g`.

---

## 3. Estructura del repositorio (monorepo)

Usa workspaces (pnpm recomendado). Crea esta estructura en la Fase 0:

```
panaderia-app/
├── CLAUDE.md                 # lo creas tú (Claude Code) a partir de este plan
├── README.md
├── docs/
│   └── documentacion-v1.md   # ya provisto por el autor
├── pnpm-workspace.yaml
├── docker-compose.yml        # frontend + backend + postgres (Fase 3)
├── packages/
│   ├── shared/               # tipos de dominio, lógica de cálculo, conversión de unidades
│   │   └── src/
│   │       ├── domain/       # tipos: Insumo, Producto, Receta, Produccion, Entrega...
│   │       ├── calc/         # costos, márgenes, consumo derivado de recetas
│   │       └── storage/      # LA INTERFAZ Repository (contrato común)
│   ├── frontend/             # React + Vite + PWA
│   │   └── src/
│   │       ├── storage/      # adaptadores: LocalRepository, ApiRepository
│   │       ├── pages/
│   │       └── components/
│   ├── backend/              # Express + TS (versión nube)
│   │   └── src/
│   └── mobile/               # proyecto Capacitor (envuelve el build del frontend)
├── infra/
│   └── terraform/            # IaC (lo redactas tú, lo aplica el autor)
│       ├── modules/
│       └── environments/
│           ├── dev/
│           └── prod/
└── .github/
    └── workflows/            # pipelines CI/CD
```

---

## 4. Modelo de datos

El esquema debe ser **idéntico en concepto** para el adaptador local (SQLite/IndexedDB) y para PostgreSQL. Entidades:

- **insumos**: `id`, `nombre`, `unidad_base` (siempre `'g'`), `stock_actual_g`
- **compras_insumo**: `id`, `insumo_id`, `fecha`, `cantidad_g`, `costo_total`, `costo_por_g` (derivado), — registra precio histórico de cada compra
- **productos**: `id`, `nombre`, `precio_venta`
- **recetas**: `producto_id`, `insumo_id`, `cantidad_g` — lista de materiales por producto
- **producciones**: `id`, `fecha`, `hora`, `producto_id`, `cantidad_unidades`, `merma_g` (opcional)
- **tiendas**: `id`, `nombre`, `direccion`, `contacto`
- **entregas**: `id`, `fecha`, `hora`, `tienda_id`
- **entrega_items**: `id`, `entrega_id`, `producto_id`, `cantidad`, `precio_unitario`

### Valores derivados (en `packages/shared/src/calc/`, no se guardan crudos)
- **Consumo de insumos** = receta × unidades producidas (con ajuste por merma).
- **Costo de producción** = consumo × `costo_por_g` del insumo vigente en esa fecha.
- **Ingresos** = suma de `entrega_items` (cantidad × precio_unitario).
- **Margen** = ingresos − costo de producción.

---

## 5. El contrato de almacenamiento (corazón de la arquitectura)

Define en `packages/shared/src/storage/Repository.ts` una interfaz que ambos adaptadores implementan. Esquema orientativo (ajústalo según convenga):

```typescript
export interface Repository {
  insumos: {
    list(): Promise<Insumo[]>;
    get(id: string): Promise<Insumo | null>;
    create(data: NuevoInsumo): Promise<Insumo>;
    update(id: string, data: Partial<Insumo>): Promise<Insumo>;
    delete(id: string): Promise<void>;
  };
  compras: CrudRepo<CompraInsumo>;
  productos: CrudRepo<Producto>;
  recetas: RecetaRepo;
  producciones: CrudRepo<Produccion>;
  tiendas: CrudRepo<Tienda>;
  entregas: EntregaRepo;

  // Operaciones de mantenimiento de datos
  exportarBackup(): Promise<BackupJSON>;
  importarBackup(data: BackupJSON): Promise<void>;
  borrarRegistros(filtro: FiltroBorrado): Promise<void>;
}
```

- `LocalRepository` (en `frontend/src/storage/`): implementa contra Dexie/SQLite.
- `ApiRepository` (en `frontend/src/storage/`): implementa con `fetch` contra el backend REST.
- La app selecciona el adaptador con una variable de entorno (`VITE_STORAGE_MODE = 'local' | 'api'`). El resto del frontend nunca sabe cuál está activo.

---

## 6. Fases de implementación (orden de trabajo)

> Detente al final de cada fase. Cada fase tiene un "resultado esperado" verificable.

### Fase 0 — Andamiaje
- Inicializa el monorepo con la estructura de la sección 3.
- Configura TypeScript, ESLint, Prettier, Vite, Tailwind.
- Crea el `CLAUDE.md` con convenciones del proyecto (stack, estructura, comandos, reglas de estilo).
- **Resultado esperado:** `pnpm install` y `pnpm dev` levantan un frontend vacío que compila.

### Fase 1 — Núcleo local (MVP funcional)
- Implementa los tipos de dominio en `shared/domain`.
- Implementa la conversión de unidades y los cálculos en `shared/calc` con pruebas unitarias.
- Define la interfaz `Repository` e implementa `LocalRepository` con **Dexie (IndexedDB)**.
- Construye las pantallas CRUD: insumos, compras de insumo, productos con su receta, registro de producción, tiendas, entregas.
- Construye un dashboard básico: "pan hecho hoy", "insumos consumidos hoy", "entregas del día".
- Configura el frontend como **PWA instalable** (manifest + service worker).
- **Resultado esperado:** app web instalable en el celular, totalmente funcional y offline, guardando datos en el dispositivo. El papá ya podría empezar a usarla.

### Fase 2 — Reportes y mantenimiento de datos
- Genera PDF de producción, ventas y costos por rango de fechas con `pdfmake` (todo en cliente).
- Implementa `exportarBackup()` / `importarBackup()` en formato JSON.
- Implementa el flujo "cerrar el mes": genera el PDF del periodo y luego ofrece borrar esos registros (`borrarRegistros`).
- **Resultado esperado:** el usuario puede descargar reportes y mantener la app liviana sin perder datos (gracias al respaldo).

### Fase 3 — Backend y adaptador de nube
- Crea el backend Express con la API REST que cubre las mismas entidades.
- Crea el esquema PostgreSQL (migraciones) equivalente al modelo de datos.
- Implementa `ApiRepository` en el frontend.
- Crea `docker-compose.yml` que levante frontend + backend + postgres localmente.
- **Resultado esperado:** `docker compose up` corre la versión "nube" completa en local. La misma UI funciona con `VITE_STORAGE_MODE=api`.

### Fase 4 — Empaquetado nativo (APK)
- Integra Capacitor en `packages/mobile`, apuntando al build del frontend.
- Sustituye el almacenamiento local por **SQLite nativo** (`@capacitor-community/sqlite`) **detrás de la misma interfaz `Repository`** — el resto del frontend no cambia.
- Integra los plugins Filesystem y Share para guardar/compartir el PDF desde el teléfono.
- Documenta en el README los pasos para generar el APK.
- **Resultado esperado:** proyecto listo para compilar un APK de Android (la compilación final la hace el autor, ver sección 7).

### Fase 5 — Redacción de IaC y CI/CD (autoría del agente, ejecución del autor)
- Redacta los módulos de Terraform en `infra/terraform/` para: VPC con subred pública, ECR, ECS Fargate (en subred pública para evitar el costo de NAT Gateway), RDS PostgreSQL (free tier), S3 + CloudFront para el frontend, roles IAM mínimos, y Secrets Manager/SSM para credenciales de BD.
- Separa `environments/dev` y `environments/prod` con variables.
- Redacta los workflows de GitHub Actions: test → build de imagen Docker → push a ECR → update de ECS; y build del frontend → sync a S3 → invalidación de CloudFront.
- **NO ejecutes** `terraform apply` ni manejes credenciales de AWS. Deja TODO listo para que el autor lo revise y aplique (ver sección 7).
- **Resultado esperado:** archivos `.tf` y workflows completos, documentados y listos para aplicar.

---

## 7. Pasos manuales del autor (Pardo) — despliegue y nube

> Estas tareas las hace **Pardo**, no Claude Code, porque involucran credenciales, facturación y acciones irreversibles en la nube. Claude Code puede explicar cada paso, pero no debe ejecutar autenticación ni manejar llaves de AWS.

### A. Preparación de cuenta y herramientas
1. Crear una cuenta de AWS y activar el **Free Tier**.
2. Crear un usuario IAM con permisos administrativos para desarrollo (no usar la cuenta raíz).
3. Instalar y configurar **AWS CLI** (`aws configure`) con las llaves del usuario IAM.
4. Instalar localmente: **Terraform**, **Docker**, **Node.js + pnpm**, y **Android Studio** (para el APK).
5. **Nunca** subir llaves de AWS al repositorio. Mantenerlas solo en `~/.aws/credentials` o en secrets de GitHub.

### B. Estado remoto de Terraform (opcional al inicio)
6. Al principio puedes usar estado local. Cuando quieras hacerlo bien: crear un bucket S3 para el `tfstate` y una tabla DynamoDB para el lock, y configurar el backend remoto.

### C. Provisionar la infraestructura
7. Revisar los archivos `.tf` que generó Claude Code (entender qué se va a crear).
8. En `infra/terraform/environments/dev`: ejecutar `terraform init`, luego `terraform plan` (leerlo con calma) y `terraform apply`.
9. Verificar que los recursos se crearon en la consola de AWS.

### D. Configurar CI/CD
10. Crear el repositorio en GitHub.
11. Cargar los secrets necesarios en *Settings → Secrets* (idealmente configurar **OIDC** entre GitHub y AWS para no usar llaves de larga duración; alternativamente, access keys).
12. Hacer push a la rama principal y verificar que el pipeline construye y despliega.

### E. Operación y costos
13. Hacer un despliegue manual de validación, luego dejar que el pipeline tome el control.
14. **`terraform destroy`** cuando termines de usar el entorno showcase, para no generar cobros.
15. Recordar los puntos de costo: NAT Gateway (evitado por diseño), RDS (gratis 12 meses), Fargate (cobra por tiempo de ejecución).

### F. Generar el APK para el papá
16. Tras la Fase 4: `pnpm --filter frontend build`, luego `npx cap sync`.
17. Abrir el proyecto Android en Android Studio y generar el APK (o `./gradlew assembleRelease`).
18. Habilitar "instalar de fuentes desconocidas" en el teléfono del papá e instalar el APK. **Sin Play Store, sin la cuota de $25 USD de desarrollador.**

### G. Publicar la demo viva gratuita (portafolio)
19. Desplegar el frontend con `VITE_STORAGE_MODE=local` en **Cloudflare Pages** o **GitHub Pages** (gratis, siempre encendido). Es una demo funcional cuyos datos quedan en el navegador del visitante, e independiente del entorno AWS.

---

## 8. Cómo usar este plan con Claude Code

1. Crea el repositorio vacío y coloca este archivo y `docs/documentacion-v1.md` dentro.
2. Abre Claude Code en la carpeta del proyecto.
3. Pídele: *"Lee `PLAN_DE_IMPLEMENTACION.md`, crea un `CLAUDE.md` con las convenciones, y empieza por la Fase 0."*
4. Revisa el resultado de cada fase antes de pedir la siguiente.
5. Las fases 0–4 las construye Claude Code. La Fase 5 la **redacta** Claude Code pero la **aplicas tú** siguiendo la sección 7.

---

## 9. Definición de "terminado" para el MVP usable

El papá puede, desde su celular y sin conexión:
- Registrar insumos y sus compras (con precio).
- Definir productos y sus recetas.
- Registrar la producción diaria (cuánto pan, a qué hora).
- Registrar entregas a tiendas (qué, cuánto, a qué tienda, a qué hora).
- Ver un resumen del día y del mes (producción, consumo, ingresos, margen).
- Descargar un PDF del periodo y luego borrar registros conservando el respaldo.

Eso es la Fase 1 + Fase 2 empaquetadas con Fase 4. La versión nube (Fase 3 + Fase 5) es para tu portafolio y se construye en paralelo o después.
