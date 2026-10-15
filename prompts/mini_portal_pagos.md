# Prueba técnica · Spec-Driven Development (SDD)

## Prueba práctica SDD: Mini portal de pagos

- **Duración:** 3 horas · asíncrona
- **Inicio:** 08:30 am
- **Entrega límite:** 11:30 am

## Objetivo

Evaluar tu capacidad de construir rápido y con calidad el core de un portal de pagos con microservicios, mensajería asíncrona y consistencia transaccional, siguiendo Spec-Driven Development (SDD).


## Alcance técnico y requerimientos

- **Arquitectura:** tres microservicios — Autenticación, Pagos y Auditoría — construidos con Node.js aplicando Arquitectura Hexagonal. El dominio no depende del framework; la base de datos, la cola y el riel bancario son adaptadores.
- **Base de datos (PostgreSQL):** división estricta por esquemas: `payment_schema` y `audit_schema`. Cada servicio accede solo a su esquema.
- **Mensajería:** RabbitMQ o Kafka para enviar los eventos de auditoría sin bloquear la transacción principal. Ningún evento se puede perder si el broker no está disponible (por ejemplo, con Transactional Outbox).
- **Autenticación:** crea el módulo de autenticación completo para la solución.
- **Frontend:** React.
- **Pruebas:** unitarias y de aceptación derivadas de los criterios de la spec, cubriendo el core transaccional. Cada test indica qué criterio cubre.
- **Ejecución:** todo el sistema se levanta con `docker compose up`.

## Módulos a desarrollar

### Core · Pagos y transferencias

Transferencias entre cuentas internas y hacia cuentas externas a través del riel bancario simulado (sección 4). Toda solicitud trae el header `Idempotency-Key`. Incluye: crear transferencia, consultar su estado e historial, reversar una transferencia completada y consultar saldo.

### Auditoría · Trazabilidad

Registro de cada acción y cambio de estado (creada, completada, fallida, reversada), recibido por la cola y almacenado de forma asíncrona en `audit_schema`.

### Frontend

Pantalla para iniciar una transferencia y ver su estado en tiempo casi real (polling o SSE) sin permitir doble envío, y una vista del historial de auditoría de cada transferencia.

### Opcional · Formularios de cobro (Payment Links)

Solo si terminas lo anterior. Un enlace que permita a un tercero pagar un monto definido. No lo hagas a costa del core.

### Reglas de negocio

- Un reintento con la misma `Idempotency-Key` nunca genera un segundo débito, incluso con solicitudes concurrentes.
- La misma `Idempotency-Key` con un payload distinto se rechaza.
- No se permite saldo negativo ni montos menores o iguales a cero. Origen y destino deben existir y ser distintos.
- Los montos son pesos colombianos (COP) con decimales.
- Solo se reversan transferencias completadas, y una sola vez.
- Si el riel no confirma, el dinero no puede quedar perdido: el sistema debe saber siempre en qué estado está cada transferencia.

### Datos iniciales · COP

| Cuenta | Saldo inicial |
|---|---:|
| `ACC-001` | $1.000.000 |
| `ACC-002` | $500.000 |
| `ACC-003` | $0 |

## Sección 04. Riel bancario simulado

Se debe construir un servicio en Docker que simula el banco para las transferencias externas. Inclúyelo en tu `docker-compose.yml` y no lo modifiques.

### Endpoints

| Endpoint | Uso |
|---|---|
| `POST /rail/transfers` | Envía una transferencia. Body: `reference`, `from`, `to`, `amount`. |
| `GET /rail/transfers/{reference}` | Consulta el estado de la transferencia en el banco. |
| `POST /rail/reversals` | Envía un reverso. Body: `reference`, `originalReference`, `amount`. |

### Respuesta del riel

| Respuesta | Significado |
|---|---|
| `200 · ACCEPTED` | El banco procesó la operación. |
| `422 · REJECTED` | El banco rechazó la operación. |
| `503` | El banco no está disponible; la operación no se procesó. |
| Sin respuesta en 10 s | Desconocido: puede haberse procesado o no. |

El riel responde de forma aleatoria con cualquiera de estos casos. Tu sistema debe comportarse correctamente en todos.

## Sección 05. Cronograma de ejecución · 3 horas

### 1. Especificación — No negociable (0:00–0:30)

Archivo de reglas (`CLAUDE.md`, `AGENTS.md` o equivalente) con idempotencia, manejo de dinero y arquitectura. Spec Given/When/Then en `docs/spec.md` para transferencias, reversos y auditoría, incluidos los casos de falla del riel. Contrato en `docs/openapi.yaml`. Commit obligatorio `spec: initial` antes de 0:30.

### 2. Core de pagos (0:30–1:45)

Esquemas de PostgreSQL, dominio, máquina de estados e idempotencia desde el diseño. Integración con el riel y reversos.

### 3. Autenticación, auditoría y mensajería (1:45–2:10)

Publicación confiable de eventos, consumidor de auditoría y almacenamiento en `audit_schema`.

### 4. Frontend (2:10–2:35)

Inicio de transferencias, estado en tiempo casi real sin doble clic e historial de auditoría.

### 5. Testing y verificación (2:35–2:55)

Tests derivados de la spec y verificación de la trazabilidad spec → test.

### 6. Cierre (2:55–3:00)

README y último push.

Las fases son una guía. El único hito obligatorio es el commit de la spec antes de 0:30.

## Sección 06. Entregables requeridos

### Código fuente

Repositorio con los microservicios, el frontend y el `docker-compose.yml` (PostgreSQL, RabbitMQ/Kafka y el riel simulado).

### Spec y contratos

los specs y `docs/openapi.yaml`, con su primer commit antes de 0:30.

### README

- Cómo levantar y probar el sistema en menos de 5 comandos.
- Decisiones de diseño y por qué.
- Qué quedó pendiente y qué harías con una hora más.
- Supuestos que asumiste.
- Qué delegaste al agente, qué escribiste a mano y al menos un caso en que el agente se equivocó.


