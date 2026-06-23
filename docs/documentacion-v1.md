# Documentación v1 — App de gestión para panadería

> Primera versión de la documentación del proyecto. Cubre qué es la aplicación, su arquitectura, su alcance y la ruta de aprendizaje/certificación asociada. Documento vivo: se actualizará a medida que el proyecto avance.

---

## 1. Visión general

Aplicación para administrar la operación diaria de una panadería: producción de pan, consumo y costo de insumos, ventas y distribución a tiendas. Nace de una necesidad real (la panadería del padre del autor) y, al mismo tiempo, sirve como pieza central de portafolio para un perfil **full-stack con énfasis en nube y despliegue**.

### Problema que resuelve
Hoy las cuentas se llevan de forma manual o dispersa. La app permite, de forma sencilla desde el celular:
- Saber cuánto pan se produjo y a qué hora.
- Saber qué insumos se consumieron y cuánto costaron.
- Registrar a qué tiendas se distribuyó y en qué momento.
- Conocer ingresos, costos y **margen** de forma automática.

### Usuarios
- **Usuario principal:** el panadero (no técnico). Prioridad absoluta en simplicidad de uso.
- **Usuario secundario:** el autor, como desarrollador y administrador de la versión en la nube.

---

## 2. Arquitectura

El proyecto se basa en una idea central: **una sola base de código con una capa de almacenamiento intercambiable**. El frontend se escribe una vez; solo cambia el adaptador que decide dónde se guardan los datos.

### Dos versiones
| Aspecto | Versión práctica | Versión showcase |
|---------|------------------|------------------|
| Propósito | Uso real diario del panadero | Portafolio / demostrar nube |
| Dónde viven los datos | En el teléfono (SQLite/IndexedDB) | En la nube (PostgreSQL en RDS) |
| Conectividad | Offline | En línea |
| Costo | Gratis | Free tier; se destruye al no usarse |
| Empaque | App nativa Android (Capacitor/APK) | Web (S3 + CloudFront) |
| Despliegue | Ninguno (instalación directa del APK) | Terraform (IaC) + CI/CD |

### Componentes
- **`shared`**: tipos de dominio y lógica de cálculo (costos, márgenes, conversión de unidades). Fuente única de verdad para la lógica.
- **`frontend`**: React + Vite, configurado como PWA. Contiene los dos adaptadores de almacenamiento (`LocalRepository`, `ApiRepository`).
- **`backend`**: Express + TypeScript, API REST (solo versión nube).
- **`mobile`**: envoltorio Capacitor que produce el APK.
- **`infra/terraform`**: infraestructura como código de la versión nube.
- **`.github/workflows`**: pipelines de integración y despliegue continuo.

### Decisiones de diseño relevantes
- **Unidades:** cada insumo tiene su unidad base — peso (gramos; las libras son solo presentación, `1 lb = 453.59237 g`) o conteo (unidades enteras, p. ej. huevos).
- **Historial de precios:** cada compra de insumo guarda su propio costo y fecha, para calcular costos con el precio vigente.
- **Consumo derivado:** el consumo de insumos se calcula desde la receta y las unidades producidas, con ajuste por merma; el usuario no lo registra manualmente.
- **Datos primero:** antes de permitir borrar, la app ofrece respaldo en PDF (para leer) y en JSON (para restaurar).

---

## 3. Modelo de datos (resumen)

Entidades: `insumos`, `compras_insumo`, `productos`, `recetas`, `producciones`, `tiendas`, `entregas`, `entrega_items`.

Valores calculados (no almacenados crudos): consumo de insumos, costo de producción, ingresos y margen.

> El detalle de campos y relaciones está en `PLAN_DE_IMPLEMENTACION.md`, sección 4.

---

## 4. Funcionalidades

### MVP (versiones 1–2 del producto)
- CRUD de insumos y registro de compras con precio.
- CRUD de productos con su receta (lista de insumos y cantidades).
- Registro de producción diaria (producto, cantidad, hora, merma).
- Registro de entregas a tiendas (producto, cantidad, tienda, hora, precio).
- Dashboard del día y del mes: producción, consumo de insumos, ingresos y margen.
- Exportar reportes a PDF por rango de fechas.
- Respaldo/restauración en JSON y flujo "cerrar el mes" con borrado seguro.

### Futuro (no en el MVP)
- Inventario con stock que sube con compras y baja con producción.
- Gráficos de evolución de precios de insumos.
- Alertas de inventario bajo.
- Multiusuario y sincronización (solo tendría sentido en la versión nube).

---

## 5. Estado del proyecto

| Fase | Descripción | Estado |
|------|-------------|--------|
| 0 | Andamiaje del monorepo | Completa |
| 1 | Núcleo local (MVP funcional offline) | Completa |
| 2 | Reportes PDF y mantenimiento de datos | Completa |
| 3 | Backend + adaptador de nube | Pendiente |
| 4 | Empaquetado nativo (APK) | Pendiente |
| 5 | IaC (Terraform) + CI/CD | Pendiente |

---

## 6. Ruta de aprendizaje y certificación (Platzi)

Esta sección conecta el aprendizaje con el proyecto: cada curso o ruta no es teoría suelta, sino que aporta a una parte concreta de la solución. El orden sugerido va de fundamentos a despliegue.

> **Sobre el certificado oficial:** Platzi entrega un certificado de finalización descargable con suscripción activa. Además, en alianza con AWS, al completar ciertos cursos de certificación AWS se puede obtener un voucher gratuito para presentar el examen oficial de AWS (sujeto a disponibilidad y a tener suscripción Expert), publicando el certificado en LinkedIn con el hashtag #PlatziAWS. Un certificado oficial **AWS Cloud Practitioner** pesa mucho más en un CV que un certificado de finalización de curso.

### Orden sugerido y aporte al proyecto

**1. Fundamentos de AWS / Introducción a Cloud Computing**
- *Qué aporta:* las bases de qué es la nube y preparación hacia la certificación Cloud Practitioner. Es el punto de partida conceptual antes de tocar cualquier servicio.
- *Dónde se usa en el proyecto:* da el vocabulario y los conceptos para entender toda la versión showcase.

**2. Ruta de Fundamentos de AWS (servicios principales)**
- *Qué aporta:* manejo práctico de los servicios núcleo — cómputo (EC2), almacenamiento (S3), redes (VPC), bases de datos (RDS, DynamoDB) y seguridad (IAM).
- *Dónde se usa en el proyecto:* es exactamente el stack de la versión nube — S3 + CloudFront para el frontend, RDS para la base de datos, IAM para los permisos, VPC para la red.

**3. Curso de Docker: Fundamentos**
- *Qué aporta:* contenedores, imágenes, diferencias con máquinas virtuales, uso de CLI.
- *Dónde se usa en el proyecto:* contenerizar el backend y levantar el entorno local con Docker Compose (Fase 3).

**4. Curso de Docker Avanzado**
- *Qué aporta:* multi-stage builds, optimización, redes, balanceo y despliegue en la nube; automatización CI/CD.
- *Dónde se usa en el proyecto:* construir imágenes eficientes del backend para subir a ECR y desplegar en ECS.

**5. Ruta de DevOps y Cloud Computing (CI/CD e IaC)**
- *Qué aporta:* automatización del ciclo de vida con pipelines CI/CD (GitHub Actions, entre otros) e infraestructura como código con Terraform; orquestación con contenedores.
- *Dónde se usa en el proyecto:* es el núcleo de la Fase 5 — los workflows de GitHub Actions y los módulos de Terraform que despliegan toda la app.

**6. Curso de Preparación para la Certificación AWS Cloud Practitioner**
- *Qué aporta:* repaso integral con laboratorios y preguntas tipo examen sobre servicios clave, seguridad, costos y buenas prácticas; es el curso orientado a obtener la certificación.
- *Dónde se usa en el proyecto:* consolida todo lo anterior y habilita el voucher para el examen oficial. La certificación es el sello del esfuerzo de portafolio.

### Resumen visual del aporte

| Curso / Ruta | Aporta a | Fase del proyecto |
|--------------|----------|-------------------|
| Fundamentos / Intro AWS | Conceptos de nube | Base conceptual |
| Fundamentos de AWS (servicios) | S3, RDS, IAM, VPC | Fase 5 (showcase) |
| Docker: Fundamentos | Contenerizar el backend | Fase 3 |
| Docker Avanzado | Imágenes para ECR/ECS | Fases 3 y 5 |
| DevOps y Cloud (CI/CD + Terraform) | Pipelines e IaC | Fase 5 |
| Prep. AWS Cloud Practitioner | Certificación oficial | Cierre / portafolio |

---

## 7. Glosario rápido

- **IaC (Infraestructura como Código):** definir la infraestructura en archivos versionables (Terraform) en lugar de crearla a mano.
- **CI/CD:** integración y despliegue continuos; automatizar pruebas, construcción y despliegue con cada cambio.
- **PWA:** aplicación web instalable que funciona offline.
- **Capacitor:** herramienta que envuelve una app web en un contenedor nativo para generar un APK.
- **Adaptador de almacenamiento:** implementación concreta (local o API) de una interfaz común que decide dónde se guardan los datos.
- **Merma:** insumo que se pierde en el proceso de producción y no termina en producto vendible.

---

*Documentación v1 — sujeta a actualización conforme avancen las fases.*
