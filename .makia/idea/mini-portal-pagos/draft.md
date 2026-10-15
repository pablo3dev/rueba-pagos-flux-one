# Mini portal de pagos (FluxOne Payment)

> Instrucciones para el LLM implementador: este documento contiene todo el contexto,
> las decisiones y las especificaciones necesarias para implementar esta funcionalidad
> de principio a fin. No asumas, no inventes ni deduzcas nada que no esté aquí. Si existe
> un archivo `db-design.dbml` junto a este documento, es el diseño de base de datos
> obligatorio a seguir. El archivo `learning.md` en la misma carpeta fija versiones exactas
> del stack y fragmentos de configuración (p. ej. ESLint/Prettier); consúltalo en IMPLEMENT
> sin reinterpretar. Sigue el stack y la arquitectura indicados exactamente como se
> describen.

## Resumen ejecutivo

Core de un portal de pagos en COP: tres microservicios Node.js hexagonales (Autenticación, Pagos, Auditoría), un riel bancario simulado como servicio Docker propio, y un frontend React. Transferencias internas y externas idempotentes (`Idempotency-Key`), consulta de estado, historial y saldo, reversos de transferencias completadas, y auditoría asíncrona sin pérdida (Transactional Outbox + RabbitMQ). Todo el entorno local se levanta con `docker compose up`.

## Contexto

Origen: prueba técnica SDD «Mini portal de pagos» (~3 h). Repositorio nuevo `fluxone-payment` sin código; MakIA v4.8.2; constitución del proyecto sin directrices en `## Global` (plantilla vacía).

Clasificación: **app nueva**, **app completa / multi-feature**, **capacidad multi-unidad**.

Test RN-01 / RN-01b / RN-02: producto de punta a punta (varios casos de uso, pantallas, ≥2 entidades) → cota dura N≥2. Se bajó de altitud a **N=6 features** con dominio compartido (actor Cliente, entidad Transferencia): `autenticacion-usuarios` (5 casos de uso; entidad Usuario con ciclo de vida; RefreshToken depende de Usuario), `riel-bancario-simulado` (3; actor técnico Pagos), `transferencias-internas` (4; Cuenta es semilla sin administración de ciclo de vida), `transferencias-externas` (3), `reversos-transferencias` (3; Reverso no existe sin Transferencia), `auditoria-transferencias` (3). Ninguna supera 5 casos de uso. Transferencia interna y externa son features distintas (criterios de aceptación propios; la externa depende del riel).

RN-04: **6 unidades de código**. El riel es unidad construida, definida una sola vez y **no se modifica después** para hacer pasar casos de otros specs (va primero entre lo que Pagos consume).

RN-01c: todas las filas de la tabla pasan; cambios de esquema viajan dentro del unit-spec de negocio que los consume; `entorno-local-infra` está exento como unidad transversal.

**Corrección de rutas de artefactos (RN-A1 / RN-A2):**

| Input crudo | Ruta corregida | Regla |
|---|---|---|
| `docs/spec.md` (Given/When/Then) | `.makia/docs/specs/<ruta-de-la-unidad>/<spec-slug>/requirements.md` (+ `design.md`, `tasks.md`, `summary.md`) | Eje por unidad; criterios Given/When/Then en cada `requirements.md` |
| `docs/openapi.yaml` | `services/<svc>/openapi.yaml` (OpenAPI 3.1; uno por servicio dueño: auth, payments, audit, bank-rail) | RN-A2; README raíz enlaza los cuatro |
| commit `spec: initial` | `makia(<slug>): <resumen>` en rama `makia/dev/mini-portal-pagos` | session.md RN-03 / RN-07 |
| reglas en `CLAUDE.md`/`AGENTS.md` | sección «Directrices del proyecto» de este draft; IMPLEMENT sincroniza a `.makia/config/constitution.md` | no editar `CLAUDE.md`/`AGENTS.md` |
| `domain-model.md` por BC | `.makia/docs/specs/services/<svc>/domain-model.md` | RN-07; segmento `specs/` obligatorio |

Unit-specs: `.makia/docs/specs/<path-unidad>/<slug>/` (infra: `.makia/docs/specs/infra/entorno-local-infra/`).

## Descomposición en specs

> Presente cuando esta idea se clasificó como "app completa / multi-feature" (eje por
> feature) y/o como "capacidad multi-unidad" (eje por unidad de código). Los dos ejes se
> combinan y la tabla es siempre el producto cartesiano real (feature × unidad) de los
> pares que existen: **1 fila = 1 spec = 1 feature dentro de 1 unidad**. Ningún spec de
> esta tabla puede abarcar una unidad de código completa ni más de una feature — eso es
> un fallo de altitud (RN-01b) y SPEC lo rechaza en su Paso 0. SPEC solo particiona este
> consolidado; no redescubre nada.

| # | Feature | Spec (slug) | Unidad de código | Responsabilidad | Resumen | Depende de | Grupo de paralelismo (provisional) |
|---|---|---|---|---|---|---|---|
| 1 | `autenticacion-usuarios` | `autenticacion-usuarios-auth` | `services/auth` | BC Identidad: usuarios, credenciales, sesiones, JWT/JWKS | Registro, login, refresh con rotación, logout, perfil, JWKS; semilla de usuarios demo. Incluye tooling raíz del monorepo (package.json workspaces, tsconfig.base.json, eslint.config.js, .prettierrc, .prettierignore, .gitattributes, lefthook.yml). | — | A |
| 2 | `riel-bancario-simulado` | `riel-bancario-simulado-bank-rail` | `services/bank-rail` | Banco simulado externo | POST/GET /rail/transfers y POST /rail/reversals con respuesta aleatoria entre los 4 casos, idempotente por `reference`, ledger persistente JSONL. | `autenticacion-usuarios-auth` | B |
| 3 | `transferencias-internas` | `transferencias-internas-payments` | `services/payments` | BC Pagos (dueño del dominio): cuentas, transferencias, idempotencia | Scaffold hexagonal de Pagos, verificación JWT vía JWKS, migraciones accounts/transfers/idempotency_keys + semilla, crear transferencia interna, estado, historial, saldo. | `autenticacion-usuarios-auth` | B |
| 4 | `autenticacion-usuarios` | `autenticacion-usuarios-web` | `apps/web` | SPA React + nginx (reverse proxy) | Scaffold Vite/React/Router/Query, cliente API con access token en memoria y refresh, pantallas registro/login/logout, nginx con `/api/auth/`. | `autenticacion-usuarios-auth` | B |
| 5 | `transferencias-externas` | `transferencias-externas-payments` | `services/payments` | BC Pagos | Crear externa con retención de fondos, adaptador HTTP del riel (10 s), despachador, conciliador de UNKNOWN, reembolsos. | `transferencias-internas-payments`, `riel-bancario-simulado-bank-rail` | C |
| 6 | `transferencias-internas` | `transferencias-internas-web` | `apps/web` | SPA | Cuentas y saldos, formulario de transferencia interna sin doble envío, pantalla de estado con polling, historial; nginx `/api/payments/`. | `transferencias-internas-payments`, `autenticacion-usuarios-web` | C |
| 7 | `reversos-transferencias` | `reversos-transferencias-payments` | `services/payments` | BC Pagos | Reverso total interno (atómico) y externo (vía riel), una sola vez, conciliación de reversos UNKNOWN. | `transferencias-externas-payments` | D |
| 8 | `transferencias-externas` | `transferencias-externas-web` | `apps/web` | SPA | Opción externa en el formulario, estados PENDING/UNKNOWN («confirmando con el banco»). | `transferencias-externas-payments`, `transferencias-internas-web` | D |
| 9 | `auditoria-transferencias` | `auditoria-transferencias-payments` | `services/payments` | BC Pagos (publicador) | Tabla outbox, emisión de evento en la misma transacción de cada cambio de estado, relay a RabbitMQ con confirms y backoff. | `reversos-transferencias-payments` | E |
| 10 | `reversos-transferencias` | `reversos-transferencias-web` | `apps/web` | SPA | Botón reversar (solo COMPLETED, sin doble envío) y estado del reverso. | `reversos-transferencias-payments`, `transferencias-externas-web` | E |
| 11 | `auditoria-transferencias` | `auditoria-transferencias-audit` | `services/audit` | BC Auditoría | Consumidor idempotente RabbitMQ → `audit_schema`, DLQ, API de historial por transferencia con autorización por visibilidad. | `auditoria-transferencias-payments` | F |
| 12 | `auditoria-transferencias` | `auditoria-transferencias-web` | `apps/web` | SPA | Línea de tiempo de auditoría en la pantalla de la transferencia (polling); nginx `/api/audit/`. | `auditoria-transferencias-audit`, `reversos-transferencias-web` | G |
| 13 | `entorno-local` | `entorno-local-infra` | `infra` | Unidad transversal de habilitación | `docker-compose.yml` raíz con los 7 servicios (postgres, rabbitmq, auth, payments, audit, bank-rail, web), `infra/postgres/init/01-roles-schemas.sql`, `.env.example`, `scripts/smoke.mjs` (E2E), `README.md`. | `autenticacion-usuarios-auth`, `riel-bancario-simulado-bank-rail`, `transferencias-internas-payments`, `autenticacion-usuarios-web`, `transferencias-externas-payments`, `transferencias-internas-web`, `reversos-transferencias-payments`, `transferencias-externas-web`, `auditoria-transferencias-payments`, `reversos-transferencias-web`, `auditoria-transferencias-audit`, `auditoria-transferencias-web` | H |

### Orden de creación (SPEC crea en este orden exacto, uno a la vez)

1. `autenticacion-usuarios-auth`
2. `riel-bancario-simulado-bank-rail`
3. `transferencias-internas-payments`
4. `autenticacion-usuarios-web`
5. `transferencias-externas-payments`
6. `transferencias-internas-web`
7. `reversos-transferencias-payments`
8. `transferencias-externas-web`
9. `auditoria-transferencias-payments`
10. `reversos-transferencias-web`
11. `auditoria-transferencias-audit`
12. `auditoria-transferencias-web`
13. `entorno-local-infra`

### Grupos de paralelismo (provisional, IDEA)

- **Grupo A** (`autenticacion-usuarios-auth`): base del monorepo, identidad y contrato JWKS que el resto consume.
- **Grupo B** (`riel-bancario-simulado-bank-rail`, `transferencias-internas-payments`, `autenticacion-usuarios-web`): dependen solo de A, unidades distintas sin overlap de archivos esperado.
- **Grupo C** (`transferencias-externas-payments`, `transferencias-internas-web`): requieren internas en Pagos y, respectivamente, riel + web auth ya especificados.
- **Grupo D** (`reversos-transferencias-payments`, `transferencias-externas-web`): externas en Pagos y flujo web interno cerrados.
- **Grupo E** (`auditoria-transferencias-payments`, `reversos-transferencias-web`): reversos en Pagos y UI externa listos para outbox y acción reversar.
- **Grupo F** (`auditoria-transferencias-audit`): consumidor y API de auditoría tras el publicador outbox.
- **Grupo G** (`auditoria-transferencias-web`): timeline en UI tras servicio audit.
- **Grupo H** (`entorno-local-infra`): orquesta compose, init SQL y smoke cuando existen los artefactos 1–12.

### Estrategia de desarrollo progresivo e independiente

> Esta es la declaración de IDEA del principio aditivo: cada spec se cierra por completo sin depender de uno futuro; el posterior lo actualiza. SPEC traslada cada entrada a la § 2.8 del `design.md` del spec previo.

- `transferencias-internas-payments` sujeto a actualización futura por `transferencias-externas-payments` en design.md §4 Interfaces — POST /transfers acepta `type: EXTERNAL` con `toExternalAccount` y los estados PENDING/UNKNOWN.
- `transferencias-internas-payments` sujeto a actualización futura por `reversos-transferencias-payments` en design.md §4 Interfaces — GET /transfers/{id} añade estado REVERSED y el objeto `reversal`.
- `transferencias-internas-payments` sujeto a actualización futura por `auditoria-transferencias-payments` en design.md §5 Implementation Target Structure — los casos de uso de creación insertan evento outbox en su misma transacción.
- `transferencias-externas-payments` sujeto a actualización futura por `auditoria-transferencias-payments` en design.md §5 Implementation Target Structure — despachador y conciliador insertan evento outbox en cada cambio de estado.
- `reversos-transferencias-payments` sujeto a actualización futura por `auditoria-transferencias-payments` en design.md §5 Implementation Target Structure — reversos insertan eventos outbox.
- `autenticacion-usuarios-web` sujeto a actualización futura por `transferencias-internas-web` en design.md §5 Implementation Target Structure — `nginx/default.conf` añade `location /api/payments/`.
- `autenticacion-usuarios-web` sujeto a actualización futura por `auditoria-transferencias-web` en design.md §5 Implementation Target Structure — `nginx/default.conf` añade `location /api/audit/`.
- `transferencias-internas-web` sujeto a actualización futura por `transferencias-externas-web` en design.md §4 Interfaces — el formulario añade el tipo externo.
- `transferencias-internas-web` sujeto a actualización futura por `reversos-transferencias-web` en design.md §4 Interfaces — la pantalla de estado añade la acción reversar.
- `transferencias-internas-web` sujeto a actualización futura por `auditoria-transferencias-web` en design.md §4 Interfaces — la pantalla de estado añade la línea de tiempo de auditoría.

**Nota nginx:** solo declara upstreams de servicios que existen en ese momento; nginx falla al arrancar si un host upstream no resuelve.

### Unidades de código de la capacidad (solo eje multi-unidad)

| Unidad | Id / path de código | Tipo de unidad (según el proyecto) | Responsabilidad (según la arquitectura del proyecto) | ¿Contexto Delimitado propio? |
|---|---|---|---|---|
| `auth` | `services/auth` | service | BC Identidad | Sí |
| `payments` | `services/payments` | service | BC Pagos, dueño del modelo de negocio | Sí (dueño) |
| `audit` | `services/audit` | service | BC Auditoría (registro inmutable) | Sí |
| `bank-rail` | `services/bank-rail` | service | BC Banco simulado | Sí |
| `web` | `apps/web` | app | Presentación | No (usa el domain-model.md de `payments`) |
| `infra` | `infra` (+ `docker-compose.yml`, `.env.example`, `README.md`, `scripts/` en raíz) | transversal de habilitación | Orquestación local | No |

### `domain-model.md` de la capacidad (solo eje multi-unidad)

- Unidad dueña del dominio: `payments` (BC Pagos).
- Ruta del modelo de negocio compartido por la capacidad: `.makia/docs/specs/services/payments/domain-model.md`.
- Contextos delimitados propios (cada uno con su `domain-model.md`): `.makia/docs/specs/services/auth/domain-model.md`, `.makia/docs/specs/services/audit/domain-model.md`, `.makia/docs/specs/services/bank-rail/domain-model.md`.
- `apps/web` referencia el domain-model de Pagos; no crea uno propio.

## Problema

Mover dinero entre cuentas y hacia un banco externo no confiable sin duplicar débitos, sin saldos negativos, sin perder dinero ni trazabilidad, manteniendo siempre un estado conocido para el cliente y para operación.

## Solución propuesta

Un monorepo npm con microservicios hexagonales en Node.js y una SPA React detrás de nginx como único origen. El cliente se autentica con JWT de corta vida y refresh rotativo; Pagos verifica tokens vía JWKS remoto. Las transferencias internas debitan y acreditan en una transacción atómica con bloqueo ordenado de cuentas; las externas retienen fondos al crear, despachan al riel simulado fuera de la transacción de BD y concilian estados UNKNOWN hasta resolución o reintento idempotente por `reference`. Toda mutación monetaria exige `Idempotency-Key` con respuesta almacenada en la misma transacción del efecto. Los reversos totales revierten internas en una transacción o coordinan con el riel en externas. Cada cambio de estado de transferencia escribe un evento en outbox en la misma transacción y un relay lo publica a RabbitMQ con confirms; Auditoría consume de forma idempotente y expone historial filtrado por visibilidad. El riel persiste un ledger JSONL y responde de forma aleatoria configurable para simular banco poco fiable. `docker compose up` (tras `cp .env.example .env`) levanta Postgres, RabbitMQ, los cuatro backends, web y ejecuta migraciones por servicio.

## Alcance

- **Dentro del alcance:** todo lo de la tabla de descomposición; auth completa (registro, login, refresh con rotación y detección de reutilización, logout, perfil, JWKS); transferencias internas y externas; estado; historial; saldo; reverso total; auditoría asíncrona de cada cambio de estado; frontend (login, transferir sin doble envío, estado casi en tiempo real por polling, historial, auditoría); riel simulado; `docker compose up`; tests unitarios y de aceptación trazados a criterios; OpenAPI por servicio en `services/<svc>/openapi.yaml`; README (levantar en &lt;5 comandos, decisiones, pendientes, supuestos, qué se delegó al agente y un caso en que se equivocó).
- **Fuera del alcance (non-goals):** Payment Links / formularios de cobro (sin puertos, flags, stubs ni tablas); reversos parciales; multimoneda; alta/edición/baja de cuentas (solo semilla; usuario registrado nuevo sin cuentas); recuperación de contraseña, verificación de email, MFA; roles de administrador; rotación de llaves JWKS; purga/TTL de claves de idempotencia; SSE/WebSockets; reprocesamiento/UI de DLQ; despliegue cloud/CI/Kubernetes; rate limit fuera de login/registro.

## Actores y flujo de valor

- **Cliente (usuario autenticado):** transfiere entre cuentas propias o a cuenta externa, consulta saldo e historial, reversa transferencias completadas propias y consulta la línea de tiempo de auditoría visible.
- **Banco (riel simulado):** procesa transferencias y reversos externos con resultados no confiables (aceptación, rechazo, indisponibilidad, timeout).
- **Workers de Pagos (despachador, conciliador, relay outbox):** avanzan transferencias/reversos externos y publican eventos sin bloquear la operación de negocio ante fallos del broker.
- **Auditoría (consumidor):** persiste cada evento de cambio de estado de forma append-only e idempotente.
- **Evaluador/operador:** copia `.env.example` a `.env`, ejecuta `docker compose up` y valida con smoke y pruebas manuales.

## Reglas de negocio

- **RN-01 Idempotencia:** todo POST de dinero (`POST /transfers`, `POST /transfers/{id}/reversals`) exige header `Idempotency-Key` (1–255 caracteres ASCII imprimibles 0x21–0x7E). Ámbito = (usuario `sub`, operación, clave). Misma clave + mismo payload → misma respuesta almacenada (mismo status y body, header `Idempotent-Replayed: true`), nunca un segundo débito, incluso concurrente. Misma clave + payload distinto → 422 `IDEMPOTENCY_KEY_PAYLOAD_MISMATCH`. Falta o inválida → 400 `IDEMPOTENCY_KEY_REQUIRED`. Espera de lock &gt; 5 s → 409 `IDEMPOTENCY_KEY_IN_PROGRESS`. Hash = sha256 hex del JSON canónico (claves ordenadas) del body + operación. Solo se almacenan respuestas de solicitudes que produjeron efecto (201/202); errores 4xx sin efecto no se almacenan. GET no requiere la clave y la ignora si llega.
- **RN-02 Montos:** COP, string decimal `^(0|[1-9][0-9]{0,15})(\.[0-9]{1,2})?$`, estrictamente &gt; 0, máximo 9999999999999999.99; número JSON → 400 `INVALID_AMOUNT`. BD `numeric(18,2)`; dominio `bigint` centavos; nunca float. Respuestas devuelven montos como string con 2 decimales.
- **RN-03 Saldo nunca negativo:** débito condicional `balance >= amount` + `CHECK (balance >= 0)`; bloqueo de cuentas ordenado por id ascendente.
- **RN-04 Cuentas:** origen debe existir y pertenecer al usuario (404 `ACCOUNT_NOT_FOUND`); destino interno debe existir (404 `DESTINATION_NOT_FOUND`); origen ≠ destino (422 `SAME_ACCOUNT`). Destino externo: `^[A-Z0-9-]{6,34}$`; existencia la valida el banco (rechazo = REJECTED).
- **RN-05 Fondos insuficientes:** transferencia en estado FAILED con `failureReason: INSUFFICIENT_FUNDS`, sin mover saldos (interna 201, externa 201) y se audita.
- **RN-06 Estados de transferencia:** PENDING, COMPLETED, FAILED, UNKNOWN, REVERSED. Terminales: FAILED, REVERSED; COMPLETED es terminal salvo reverso. Transiciones válidas: INTERNAL → COMPLETED | FAILED (al crear); EXTERNAL: PENDING → COMPLETED | FAILED | UNKNOWN; UNKNOWN → COMPLETED | FAILED; COMPLETED → REVERSED. Cualquier otra transición es error de dominio.
- **RN-07 Retención externa:** al crear externa con saldo suficiente se debita origen en la misma transacción (fondos retenidos) y queda PENDING. 422 del banco → FAILED `RAIL_REJECTED` + reembolso en la misma transacción. 503 → reintento backoff `min(2^intentos, 30)` s, máximo 5; agotados → FAILED `RAIL_UNAVAILABLE` + reembolso. ECONNREFUSED/ENOTFOUND = como 503. Timeout 10 s o error tras enviar → UNKNOWN (fondos retenidos). 200 → COMPLETED.
- **RN-08 Conciliación:** UNKNOWN se concilia con `GET /rail/transfers/{reference}` backoff `min(2^intentos, 30)` s, sin límite: 200 ACCEPTED → COMPLETED; 422 REJECTED → FAILED `RAIL_REJECTED` + reembolso; 404 NOT_FOUND → reenviar `POST /rail/transfers` con la MISMA `reference` y aplicar RN-07; 503/timeout → sigue UNKNOWN. El dinero nunca queda perdido.
- **RN-09 Reverso:** solo COMPLETED, solo dueño de cuenta origen, una sola vez (índice único parcial), monto total. Interna: transacción con bloqueo ordenado; destino con saldo ≥ monto → reverso COMPLETED y transferencia REVERSED (201); si no → 422 `REVERSAL_INSUFFICIENT_FUNDS` sin registro. Externa: reverso PENDING (202); despachador `POST /rail/reversals`; 200 → COMPLETED + acredita origen + REVERSED; 422 → REJECTED `RAIL_REJECTED` (transferencia sigue COMPLETED, nuevo intento con otra clave); 503 → reintento RN-07 agotado → REJECTED `RAIL_UNAVAILABLE`; timeout → UNKNOWN y conciliación RN-08 con `GET /rail/transfers/{reversal.id}`. No COMPLETED → 409 `TRANSFER_NOT_REVERSIBLE`; ya reversada o reverso en curso → 409 `TRANSFER_ALREADY_REVERSED`.
- **RN-10 Auditoría:** cada cambio de estado emite exactamente un evento en la misma transacción (outbox): `transfer.created`, `transfer.completed`, `transfer.failed`, `transfer.unknown`, `transfer.reversal_requested`, `transfer.reversed`, `transfer.reversal_rejected`. Entrega at-least-once, deduplicada por `eventId`. Fallo del broker no bloquea ni revierte la operación.
- **RN-11 Visibilidad:** transferencia y auditoría visibles para dueño de cuenta origen y, si interna, dueño de cuenta destino; lo demás → 404.
- **RN-12 Semilla COP:** ACC-001 1000000.00 (alice), ACC-002 500000.00 (bob), ACC-003 0.00 (carol). Usuarios demo alice@fluxone.test `11111111-1111-4111-8111-111111111111`, bob@fluxone.test `22222222-2222-4222-8222-222222222222`, carol@fluxone.test `33333333-3333-4333-8333-333333333333`, contraseña `${DEMO_USERS_PASSWORD}` (`.env.example`: `Fluxone-Demo-2026!`).
- **RN-13 Contraseñas:** 12–128 caracteres; email normalizado trim+minúsculas, único.

## Requerimientos funcionales (EARS)

### REQ-01: autenticacion-usuarios

- **Como** visitante **quiero** registrarme e iniciar sesión **para** usar el portal de pagos de forma segura.
- `EL SISTEMA DEBE` exponer POST /auth/register → 201 {id,email}; 409 `EMAIL_TAKEN`; 400 validación; límite 10/min por IP en registro.
- `EL SISTEMA DEBE` exponer POST /auth/login → 200 {accessToken, tokenType:"Bearer", expiresIn:900, user{id,email}} + cookie `refresh_token` (httpOnly, SameSite=Strict, Secure=`COOKIE_SECURE`, Path=/api/auth, Max-Age 604800); credenciales inválidas → 401 `INVALID_CREDENTIALS`; 6.º intento/min por IP → 429.
- `CUANDO` el cliente envía POST /auth/refresh con cookie válida `EL SISTEMA DEBE` emitir nuevo access y rotar refresh (anterior revocado con `replaced_by_id`); reutilización de refresh revocado → revocar familia y 401 `REFRESH_TOKEN_REUSED`; expirado/ausente → 401.
- `EL SISTEMA DEBE` exponer POST /auth/logout → revoca y limpia cookie, 204 (idempotente); GET /auth/me (Bearer) → {id,email}; GET /.well-known/jwks.json → claves Ed25519.
- `EL SISTEMA DEBE` firmar access token EdDSA Ed25519, 15 min, iss=urn:fluxone:auth, aud=urn:fluxone:api, sub=user id, claim email; par de llaves generado en primer arranque y persistido en `auth_schema.signing_keys`.

### REQ-02: riel-bancario-simulado

- **Como** servicio Pagos **quiero** un banco simulado idempotente **para** probar externos y reversos sin integración real.
- `EL SISTEMA DEBE` escuchar en puerto 3004 (red interna compose; puerto host 3004 solo depuración), sin auth.
- `CUANDO` llega POST /rail/transfers {reference,from,to,amount} `EL SISTEMA DEBE` elegir al azar (pesos `RAIL_OUTCOME_WEIGHTS`, default 25,25,25,25) ACCEPTED, REJECTED, UNAVAILABLE o TIMEOUT; body inválido → 400; reference existente payload distinto → 409 `REFERENCE_CONFLICT`; reference nueva según outcome; reference existente devuelve resultado guardado; TIMEOUT con delay `RAIL_TIMEOUT_DELAY_MS` (default 15000).
- `EL SISTEMA DEBE` exponer GET /rail/transfers/{reference} para transferencias y reversos con respuestas 200/422/404/503 según ledger; POST /rail/reversals {reference,originalReference,amount} con reglas de rechazo ORIGINAL_NOT_FOUND, ORIGINAL_NOT_ACCEPTED, AMOUNT_MISMATCH, ALREADY_REVERSED; idempotente por reference.
- `EL SISTEMA DEBE` persistir ledger append JSONL en `/data/rail-ledger.jsonl` (volumen `rail_data`), cargado al arrancar; GET /health → 200; aleatoriedad y reloj como puertos inyectables (`OutcomePicker`, Delay).

### REQ-03: transferencias-internas

- **Como** cliente autenticado **quiero** transferir entre cuentas y consultar saldo e historial **para** mover dinero dentro del portal.
- `EL SISTEMA DEBE` verificar Bearer JWT vía `AUTH_JWKS_URL` en payments (:3002).
- `EL SISTEMA DEBE` exponer GET /accounts, GET /accounts/{id}/balance, POST /transfers {type:"INTERNAL",...} → 201 COMPLETED o FAILED INSUFFICIENT_FUNDS, GET /transfers/{id}, GET /transfers con cursor keyset; errores `{error:{code,message}}`; GET /health/live y /health/ready.

### REQ-04: transferencias-externas

- **Como** cliente **quiero** enviar dinero a una cuenta externa **para** pagar fuera del ledger interno con estado trazable.
- `EL SISTEMA DEBE` aceptar POST /transfers {type:"EXTERNAL",fromAccountId,toExternalAccount,amount} → 202 PENDING o 201 FAILED INSUFFICIENT_FUNDS.
- `EL SISTEMA DEBE` ejecutar despachador (loop 500 ms, FOR UPDATE SKIP LOCKED LIMIT 10, lease 30 s) y conciliador según RN-07/RN-08; llamadas al riel fuera de transacción BD, AbortSignal.timeout(10000), header X-Request-Id = correlationId; reference = transfer.id.

### REQ-05: reversos-transferencias

- **Como** cliente **quiero** reversar una transferencia completada **para** recuperar fondos cuando la operación original fue errónea.
- `EL SISTEMA DEBE` exponer POST /transfers/{id}/reversals (body {}, Idempotency-Key, operación CREATE_REVERSAL:&lt;transferId&gt;) → 201 interna / 202 externa según RN-09; GET /transfers/{id} incluye reversal; despachador/conciliador de reversos externos.

### REQ-06: auditoria-transferencias

- **Como** cliente y operador **quiero** historial inmutable de cambios de estado **para** auditar transferencias sin pérdida de eventos.
- `EL SISTEMA DEBE` implementar outbox + relay (500 ms, LIMIT 50, backoff min(2^attempts,60) s, publish persistente messageId=eventId, waitForConfirms) y topología AMQP: exchange audit.events (topic), cola audit.transfer-events (quorum, DLX, delivery-limit 5), binding transfer.#, DLX audit.dlx → audit.transfer-events.dlq.
- `EL SISTEMA DEBE` publicar envelope JSON con campos eventId, eventType, occurredAt, aggregateType TRANSFER, aggregateId, correlationId, actorUserId, visibleToUserIds, data (transferId, type, cuentas, amount, status, previousStatus, failureReason, reversalId, reversalStatus).
- `EL SISTEMA DEBE` consumir en audit (:3003) con prefetch 10, validación, INSERT ON CONFLICT (event_id) DO NOTHING, ack tras commit; GET /audit/transfers/{transferId}/events filtrado por sub ∈ visible_to_user_ids; sin eventos visibles → 404.

### REQ-07: frontend web

- **Como** cliente **quiero** una interfaz web **para** operar transferencias y ver resultados casi en tiempo real.
- `EL SISTEMA DEBE` servir SPA en :8080 vía nginx :80 con login/registro/logout, access token en memoria, refresh silencioso al cargar y ante 401, dashboard cuentas/saldos, formulario con Idempotency-Key = crypto.randomUUID() por apertura/edición del mismo payload, botón deshabilitado en isPending, navegación a /transfers/:id tras éxito, polling estado 1 s, historial /transfers, reversar con clave propia, auditoría polling 2 s, errores API en lenguaje claro.

### REQ-08: entorno-local

- **Como** evaluador **quiero** levantar todo el stack localmente **para** validar el producto sin pasos manuales complejos.
- `EL SISTEMA DEBE` documentar como primer paso `cp .env.example .env`; `docker compose up` referencia `.env` vía env_file.
- `EL SISTEMA DEBE` levantar postgres, rabbitmq, auth, payments, audit, bank-rail, web con healthchecks y depends_on service_healthy; migraciones por servicio al arrancar; `scripts/smoke.mjs` (Node 24) login → transferencia interna → polling terminal → auditoría ≥2 eventos.

## Edge cases y condiciones límite

| ID | Escenario | Comportamiento esperado |
|---|---|---|
| EC-01 | Dos POST concurrentes misma clave y payload | Un solo débito; ambas respuestas iguales con Idempotent-Replayed en replay |
| EC-02 | Misma clave, payload distinto | 422 IDEMPOTENCY_KEY_PAYLOAD_MISMATCH |
| EC-03 | Misma clave de otro usuario | Ámbitos independientes |
| EC-04 | POST sin clave | 400 IDEMPOTENCY_KEY_REQUIRED |
| EC-05 | Monto "0", "-1", "1.234", número JSON | 400 INVALID_AMOUNT |
| EC-06 | Origen = destino | 422 SAME_ACCOUNT |
| EC-07 | Origen ajeno al usuario | 404 ACCOUNT_NOT_FOUND |
| EC-08 | Saldo exacto igual al monto | COMPLETED con saldo 0 |
| EC-09 | Saldo insuficiente | FAILED INSUFFICIENT_FUNDS sin mover saldo |
| EC-10 | A→B y B→A concurrentes | Sin deadlock; saldos consistentes |
| EC-11 | Riel 503 ×5 | FAILED RAIL_UNAVAILABLE + reembolso |
| EC-12 | Riel timeout y banco procesó | UNKNOWN → conciliación ACCEPTED → COMPLETED sin doble débito |
| EC-13 | Timeout y banco no procesó | GET 404 → reenvío misma reference |
| EC-14 | Riel ECONNREFUSED | Como 503 |
| EC-15 | Broker caído | Operación OK; eventos en outbox; publicados al volver |
| EC-16 | Evento duplicado en audit | Un solo registro (ON CONFLICT DO NOTHING) |
| EC-17 | Audit caído | Mensajes en cola; consumo al volver |
| EC-18 | Reversar no COMPLETED | 409 TRANSFER_NOT_REVERSIBLE |
| EC-19 | Segundo reverso | 409 TRANSFER_ALREADY_REVERSED o replay idempotente |
| EC-20 | Reverso interno destino sin saldo | 422 REVERSAL_INSUFFICIENT_FUNDS |
| EC-21 | Reverso externo rechazado | Transferencia sigue COMPLETED; nuevo intento permitido |
| EC-22 | Refresh reutilizado | Familia revocada; 401 REFRESH_TOKEN_REUSED |
| EC-23 | Doble clic enviar | Una sola solicitud efectiva |
| EC-24 | Recarga pantalla estado | Retoma polling |
| EC-25 | ACC-003 saldo 0 como origen | FAILED INSUFFICIENT_FUNDS |
| EC-26 | JWT expirado/firma inválida/aud incorrecta | 401 |
| EC-27 | Rail reverso monto distinto | 422 AMOUNT_MISMATCH |

## Modelo de dominio

Contexto delimitado nuevo: SPEC debe formalizar `domain-model.md` a partir de esta propuesta antes de escribir `requirements.md`/`design.md` en auth, payments, audit y bank-rail.

**Pagos:** Account (id ACC-NNN, ownerUserId, currency COP, balance Money; invariante balance ≥ 0; debit/credit). Transfer (agregado: id, type, from, to/toExternal, amount, status, failureReason, rail tracking; máquina RN-06). Reversal (pertenece a Transfer; PENDING/COMPLETED/REJECTED/UNKNOWN). IdempotencyRecord. Value objects: Money (bigint centavos), AccountId, ExternalAccountNumber, IdempotencyKey. Eventos RN-10. Puertos: AccountRepository, TransferRepository, ReversalRepository, IdempotencyStore, UnitOfWork, BankRailPort, OutboxPort, Clock, IdGenerator. Lenguaje ubicuo: retención, reembolso, conciliación, reverso, referencia del riel.

**Identidad:** User, RefreshToken (familia, rotación), SigningKey. Puertos: UserRepository, RefreshTokenRepository, SigningKeyRepository, PasswordHasher, TokenIssuer.

**Auditoría:** AuditEntry (inmutable, eventId único, visibleToUserIds). Puertos: AuditEntryRepository, EventConsumer.

**Banco simulado:** BankOperation (reference, kind TRANSFER|REVERSAL, payload, status ACCEPTED|REJECTED, reason). Puertos: Ledger, OutcomePicker, Delay.

## Diseño de datos

Diseño obligatorio en `db-design.dbml` (misma carpeta que este draft). Resumen: `auth_schema` (users, refresh_tokens, signing_keys), `payment_schema` (accounts, transfers, reversals, idempotency_keys, outbox_events), `audit_schema` (audit_entries). Un rol por servicio (`auth_svc`, `payment_svc`, `audit_svc`) solo con su esquema; sin FK entre esquemas. `auth_schema` existe porque Autenticación necesita persistencia propia. Migraciones node-pg-migrate 9 SQL por servicio al arrancar (`pgmigrations` por esquema); cada unit-spec de payments crea tablas/columnas de su feature convergiendo al dbml. Riel: sin BD (ledger JSONL). Excepción: `infra/postgres/init/01-roles-schemas.sql` como superusuario crea roles y esquemas; `audit_svc` solo SELECT, INSERT en `audit_entries`. Tests: globalSetup Testcontainers con mismo SQL de esquema por servicio.

## Arquitectura y stack técnico

- **Arquitectura:** hexagonal por servicio — `src/domain` (sin imports framework/pg/amqplib), `src/application`, `src/adapters/inbound/http` (Fastify), `src/adapters/outbound/{postgres,rail,amqp}`, `src/main.ts`. Carpetas `inbound`/`outbound` (no `in`).
- **Monorepo:** npm workspaces `apps/*`, `services/*`; TypeScript ESM estricto.
- **Versiones exactas** (learning.md §0): Node 24.22.0 (`node:24.22.0-alpine`), TypeScript 6.0.3, Fastify 5.12.7, pg 8.23.1, node-pg-migrate 9.0.0, jose 6.2.12, @node-rs/argon2 2.2.2, @fastify/rate-limit 11.2.1, @fastify/cookie 11.1.3, amqplib 2.2.0, React 19.3.1, react-router 8.4.0, @tanstack/react-query 5.104.3, Vite 8.3.4, @vitejs/plugin-react 6.1.2, Vitest 5.0.5, Testing Library (react 16.3.3, dom 10.4.1, user-event 14.6.8, jest-dom 6.9.1), jsdom 30.1.3, testcontainers 12.2.1 + @testcontainers/postgresql 12.2.1, ESLint 10.12.0 + @eslint/js 10.0.1 + typescript-eslint 8.71.2 + eslint-config-prettier 10.1.8 + globals 17.13.0 + eslint-plugin-react-hooks 7.1.1 + eslint-plugin-react-refresh 0.5.7, Prettier 3.9.10, lefthook 2.1.12; imágenes postgres:18.6-alpine, rabbitmq:4.3.6-management-alpine, nginx:1.30.6-alpine.
- **Justificaciones:** Node 24 LTS; TS 6.0.3 por typescript-eslint &lt;6.1.0; Fastify por JSON schema e inject; pg sin ORM para transacciones/locks; @node-rs/argon2 musl; jose EdDSA/JWKS; **RabbitMQ** (única recomendación) sobre Kafka por imagen ligera, confirms, quorum, DLX — Kafka desproporcionado; outbox por polling SKIP LOCKED; polling frontend vs SSE; nginx único origen; bigint centavos en dominio.
- **Puertos:** web 8080, auth 3001, payments 3002, audit 3003, bank-rail 3004, postgres 5432, rabbitmq 5672/15672.
- **Variables** (`.env.example`): POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB=fluxone, AUTH_DB_PASSWORD, PAYMENT_DB_PASSWORD, AUDIT_DB_PASSWORD, RABBITMQ_USER, RABBITMQ_PASSWORD, AMQP_URL, AUTH_JWKS_URL=http://auth:3001/.well-known/jwks.json, JWT_ISSUER=urn:fluxone:auth, JWT_AUDIENCE=urn:fluxone:api, COOKIE_SECRET, COOKIE_SECURE=false, DEMO_USERS_PASSWORD, RAIL_BASE_URL=http://bank-rail:3004, RAIL_OUTCOME_WEIGHTS=25,25,25,25, RAIL_TIMEOUT_DELAY_MS=15000, LOG_LEVEL=info.

### Configuración de verificación local (lefthook)

Creado por `autenticacion-usuarios-auth` (app nueva):

```yaml
pre-commit:
  parallel: true
  commands:
    eslint:
      glob: "*.{ts,tsx,js,mjs}"
      run: npx eslint --max-warnings 0 --fix {staged_files}
      stage_fixed: true
    prettier:
      glob: "*.{ts,tsx,js,mjs,json,yml,yaml,md,css}"
      run: npx prettier --write {staged_files}
      stage_fixed: true
    typecheck:
      glob: "*.{ts,tsx}"
      run: npm run typecheck --workspaces --if-present
```

Cada workspace: `"typecheck": "tsc --noEmit -p tsconfig.json"`. ESLint flat config y `.prettierrc`/`.gitattributes` exactos en learning.md §19.

## Estrategia de seguridad

- **AuthN:** argon2id (m=19456,t=2,p=1); JWT EdDSA 15 min verificado en payments/audit (iss, aud, clockTolerance 5s); refresh opaco 256 bits (sha256 almacenado) 7 días, rotación y detección reutilización; rate limit login 5/min y registro 10/min por IP; mensajes genéricos.
- **AuthZ:** propiedad cuenta por sub; visibilidad RN-11; reverso solo dueño origen; 404 recursos ajenos.
- **Aislamiento:** rol por esquema, REVOKE public, sin FK cruzadas; riel sin BD.
- **Inyección:** consultas parametrizadas; JSON schema additionalProperties false; montos string validados.
- **Secretos:** `.env` fuera de git; llave privada JWT solo auth_schema.
- **Logs:** redact authorization, cookie, set-cookie; nunca contraseñas ni tokens; PII: solo email.
- **nginx:** X-Content-Type-Options nosniff, X-Frame-Options DENY, Referrer-Policy no-referrer, CSP default-src 'self'; proxy_set_header X-Request-Id.
- **Idempotencia / efectos:** POST /transfers y POST reversals (Idempotency-Key, RN-01); índice único parcial reversos; riel por reference; relay messageId=eventId; audit event_id PK; register email único; refresh un uso; logout idempotente; semillas ON CONFLICT DO NOTHING; migraciones pgmigrations; GET/JWKS/health naturalmente idempotentes.

## Observabilidad

Logs JSON pino con reqId = X-Request-Id (nginx → servicios → riel y correlationId en envelope). Eventos: transfer.created/status_changed, idempotency.replayed/mismatch, rail.request/response/timeout, reconcile.result, reversal.*, outbox.published/publish_failed, audit.consumed/duplicate/dead_lettered, auth.login_succeeded/failed (userId o hash email), auth.refresh_reuse_detected, rail.outcome_chosen. Niveles: info flujo, warn reintentos/UNKNOWN, error inesperados. Triangulación transferId + correlationId; outbox pendiente vía count published_at IS NULL. Health: live/ready auth/payments/audit; /health bank-rail; RabbitMQ UI 15672.

## Estrategia de pruebas

- **Unitarias (Vitest, sin I/O):** Money, máquina estados, reversos, hash idempotencia, backoff, mapeo riel, OutcomePicker/ledger riel, componentes React (RTL + jsdom).
- **Aceptación por criterio:** Vitest + Fastify inject + PostgreSQL Testcontainers; nombre test con ID criterio p. ej. `[AC-TRI-03]`; tabla criterio → archivo en requirements.md; Pagos dobla HTTP riel; riel real con OutcomePicker determinista; outbox con doble publicador; audit handler con BD real.
- **Concurrencia:** Promise.all misma clave; A→B/B→A paralelo.
- **E2E:** scripts/smoke.mjs contra compose (spec infra).
- **Comandos:** npm run test --workspaces --if-present, npm run lint, npm run typecheck --workspaces --if-present.

## Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Plazo ~3 h | Specs incompletos | Specs pequeños, orden cerrado, descomposición 13 filas |
| Aleatoriedad riel | Tests no deterministas | OutcomePicker inyectable; doble riel en tests Pagos |
| Doble débito por reintento | Pérdida financiera | Idempotency-Key + reference idempotente + UNKNOWN |
| Pérdida eventos | Auditoría incompleta | Outbox + confirms + quorum + dedupe eventId |
| Deadlocks transferencias | Bloqueo BD | Bloqueo ordenado por account id |
| CRLF scripts Windows | Fallos en contenedor | .gitattributes LF |
| nginx upstream inexistente | Web no arranca | Proxies solo cuando servicio existe |
| Versiones no verificadas localmente | Build roto | Primera tarea npm ci + tsc --noEmit |
| PG18 volumen datos | Datos perdidos | Montar /var/lib/postgresql |

## Directrices del proyecto

- **Global:** arquitectura hexagonal en todo servicio; dominio sin dependencias de framework, BD, broker ni HTTP.
- **Global:** stack Node 24.22.0 + TypeScript 6.0.3 ESM, npm workspaces; versiones learning.md §0.
- **Global:** dinero COP numeric(18,2) BD, bigint centavos dominio, string JSON; nunca float.
- **Global:** operación monetaria con efecto exige Idempotency-Key ámbito (usuario, operación) en misma transacción.
- **Global:** cada servicio solo su esquema y rol; sin FK entre esquemas.
- **Global:** cambio de estado publica evento vía Transactional Outbox; consumidores idempotentes por eventId.
- **Global:** logs JSON con correlationId; nunca secretos, tokens ni contraseñas.
- **Unidad: services/payments:** llamadas riel fuera de transacción BD, timeout 10 s; desconocido = UNKNOWN conciliado, nunca asumir.
- **Unidad: services/bank-rail:** tras entregar su spec, no modificarse para hacer pasar casos de otros specs.

## Decisiones tomadas

1. RabbitMQ (no Kafka). 2. Outbox polling (no Debezium/LISTEN). 3. Polling frontend (no SSE/WS). 4. auth_schema añadido. 5. Cuentas demo sembradas; usuario nuevo sin cuentas. 6. Destino externo validado por banco. 7. Insuficiencia = FAILED registrado. 8. Reverso total. 9. Reverso interno exige saldo en destino. 10. Reversos REJECTED permiten reintento. 11. Riel idempotente por reference, ledger JSONL, GET 404 NOT_FOUND. 12. 503/ECONNREFUSED reintento 5 veces. 13. UNKNOWN conciliado sin límite. 14. Idempotency-Key en misma transacción (409 solo lock &gt;5 s). 15. nginx único origen. 16. Llaves JWT generadas y persistidas por auth. 17. Rutas artefactos corregidas (Contexto). 18. OpenAPI por servicio en services/&lt;svc&gt;/openapi.yaml.

## Recomendaciones de implementación

Seguir orden de creación 1–13. Primera tarea `autenticacion-usuarios-auth`: tooling raíz y verificar npm ci, npx tsc --noEmit, npx eslint. En payments: dominio Money/Transfer con tests primero; SET LOCAL statement_timeout = '5s' en transacción idempotencia; workers en mismo proceso (SKIP LOCKED/lease); topología AMQP idéntica publicador y consumidor.

## Criterios de aceptación / Definition of Done

`docker compose up` (tras `cp .env.example .env`) deja servicios healthy; `scripts/smoke.mjs` pasa; todos los tests pasan referenciando criterio; lefthook pasa; RN-01..RN-13 verificadas en aceptación; invariante suma saldos + retenidos (PENDING/UNKNOWN) + externas COMPLETED − reversos externos COMPLETED = 1500000.00 COP semilla; README completo; OpenAPI por servicio; Payment Links ausente.
