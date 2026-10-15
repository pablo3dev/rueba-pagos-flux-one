# Implementation Tasks: Transferencias internas (aplicación web `apps/web`)

## 1. Metadata & Traceability
- **Spec:** `transferencias-internas-web`
- **Requirements Ref:** `requirements.md` (spec: `transferencias-internas-web`)
- **Design Ref:** `design.md` (spec: `transferencias-internas-web`)

`[P]`: puede ejecutarse en paralelo (archivos distintos, sin dependencias).

---

## 2. Execution Guidelines
- **Sequential Ordering:** ejecutar las fases en orden estricto; dentro de cada fase, las subtareas atómicas se completan antes de pasar a la siguiente. Una tarea solo inicia cuando todas las tareas de su campo **Depende de** están marcadas `[x]`. El orden sigue datos/dominio → lógica → api → ui → infraestructura/integración. Ninguna tarea cumple la condición de `[P]` (todas dependen de la anterior), por lo que no se marca ninguna.
- **Test-Verified:** cada funcionalidad debe tener su prueba correspondiente antes de marcarse `[x]`. Las pruebas incluyen en su nombre el ID `[AC-TIW-NN]` del criterio que verifican (imports explícitos de `vitest`, sin globals). Las piezas de interfaz sin prueba propia (tareas 3.1, 3.3, 3.4, 3.5) se verifican por comportamiento en las pruebas de componente de las tareas 3.2 y 3.6 a 3.9; su criterio exige además que las pruebas existentes sigan pasando.
- **Traceability Tags:** cada tarea referencia su origen en `requirements.md` (ej. `[REQ-1.1]`) y su componente en `design.md` (ej. `[DESIGN §5]`).
- **Rutas:** todas las rutas son relativas a la raíz del repositorio. Este spec amplía `apps/web` (creado por `autenticacion-usuarios-web`) y no toca `services/auth/`, `services/payments/` ni ningún archivo de raíz del monorepo (incluidos `package-lock.json` y `lefthook.yml`: no hay dependencias ni hooks nuevos). `services/payments/Dockerfile` y `services/payments/docker/postgres-init/01-payments-role-schema.sh`, junto con los de `services/auth/`, existen y solo los consume el Compose de la tarea 4.1.
- **Entorno:** todo comando se ejecuta en contenedores (en el host solo `docker` y `git`). Prefijo: `docker compose -f apps/web/compose.dev.yaml`. Sin servicios auxiliares: `run --rm --no-deps dev <cmd>`; con `postgres`, `auth`, `payments` y `web` (solo integración, tareas 4.2 a 4.6): `run --rm dev <cmd>`.
- **Comando de pruebas `unit`:** `docker compose -f apps/web/compose.dev.yaml run --rm --no-deps dev npm run test:unit -w apps/web -- <ruta>`.
- **Comando de pruebas `component`:** `docker compose -f apps/web/compose.dev.yaml run --rm --no-deps dev npm run test:component -w apps/web -- <ruta>`.
- **Comando de pruebas existentes (`<existentes>`):** `docker compose -f apps/web/compose.dev.yaml run --rm --no-deps dev npm run test:unit -w apps/web` y `docker compose -f apps/web/compose.dev.yaml run --rm --no-deps dev npm run test:component -w apps/web`, ambos con código de salida 0 (la aplicación base no regresa).
- **Chequeos de calidad (`<calidad>`):** los tres comandos siguientes, todos con código de salida 0 y sin advertencias:
  - `docker compose -f apps/web/compose.dev.yaml run --rm --no-deps dev npm run typecheck -w apps/web`
  - `docker compose -f apps/web/compose.dev.yaml run --rm --no-deps dev npm run lint -w apps/web`
  - `docker compose -f apps/web/compose.dev.yaml run --rm --no-deps dev npm run format:check -w apps/web`
- **Limpieza:** `docker compose -f apps/web/compose.dev.yaml down -v`.
- **Evidencia:** una tarea con campo **Evidencia** solo se marca `[x]` cuando la evidencia descrita queda registrada (salida de comandos o aserciones de las pruebas indicadas).
- **Versiones:** las de la aplicación base; no se añade ni cambia ninguna dependencia. Si una verificación falla por versiones, se reporta; no se cambian versiones sin escalar.
- **Estilo:** ESM con imports relativos sin extensión, `import type` donde aplique, identificadores en inglés y textos de usuario en español (los textos de `design.md § 4.2` y `§ 4.3` son contrato de las pruebas), sin `console.*`, sin `dangerouslySetInnerHTML`, sin estilos ni scripts en línea, montos siempre `string` (sin `Number` ni `parseFloat`).

---

## 3. Phase Breakdown & Actionable Tasks

### Phase 1: Foundation, Schemas & Core Domain
- [ ] **Task 1.1: Tipos del dominio de pagos y formato de dinero y fecha** `[REQ-1.1, REQ-5.1, REQ-6.1]` `[DESIGN §3.1, §4.1]`
  - **Archivos:**
    - `apps/web/src/domain/types.ts` (modificar: añadir tipos; los existentes no cambian)
    - `apps/web/src/domain/format.ts` (crear)
    - `apps/web/tests/unit/format.test.ts` (crear)
  - **Depende de:** ninguna.
  - **Alcance:** añadir `Account`, `TransferStatus`, `FailureReason`, `Transfer`, `TransferPage`, `CreateTransferInput`, `TransferFormValues` y `TransferFieldErrors` con la forma exacta de `design.md § 3.1`; y `formatCop` (agrupa la parte entera de 3 en 3 con `.`, decimales con `,`, sufijo ` COP`, operando sobre el string, sin `Number`) y `formatDateTime` (`Intl.DateTimeFormat('es-CO', {dateStyle: 'medium', timeStyle: 'short'})`) según `design.md § 4.1` ("Formato"). Sin React ni `fetch`.
  - **Criterio de aceptación:** `docker compose -f apps/web/compose.dev.yaml run --rm --no-deps dev npm run test:unit -w apps/web -- tests/unit/format.test.ts` y luego `<calidad>`
  - **Evidencia (comportamiento crítico: el dinero no pierde precisión):** `[AC-TIW-01]` `formatCop('1000000.00')` es `1.000.000,00 COP` y `formatCop('0.01')` es `0,01 COP`; `[AC-TIW-25]` `formatCop('9999999999999999.99')` conserva todos los dígitos (sin notación científica ni redondeo) y `formatDateTime` devuelve un texto no vacío para un ISO 8601 válido.

- [ ] **Task 1.2: Validación del formulario de transferencia** `[REQ-2.2, REQ-2.3, REQ-2.4]` `[DESIGN §4.1]`
  - **Archivos:**
    - `apps/web/src/domain/transfer-validation.ts` (crear)
    - `apps/web/tests/unit/transfer-validation.test.ts` (crear)
  - **Depende de:** 1.1
  - **Alcance:** `AMOUNT_PATTERN`, `AMOUNT_ERROR`, `DESTINATION_REQUIRED_ERROR`, `SAME_ACCOUNT_ERROR`, `validateTransfer` (reglas en el orden y con los mensajes de la tabla de `design.md § 4.1`; sin `trim` del monto) y `toCreateTransferInput` (`type: 'INTERNAL'`, destino con `trim()`).
  - **Criterio de aceptación:** `docker compose -f apps/web/compose.dev.yaml run --rm --no-deps dev npm run test:unit -w apps/web -- tests/unit/transfer-validation.test.ts` y luego `<calidad>`
  - **Evidencia (comportamiento crítico: límites del monto):** `[AC-TIW-07]` se aceptan `100`, `100.5`, `100.50`, `0.01` y `9999999999999999.99`; se rechazan `''`, `0`, `0.00`, `-1`, `1.234`, `abc` y `10000000000000000` con `AMOUNT_ERROR` en `amount`; `[AC-TIW-08]` destino vacío o solo espacios produce `DESTINATION_REQUIRED_ERROR`; `[AC-TIW-09]` destino igual al origen produce `SAME_ACCOUNT_ERROR`; `toCreateTransferInput` recorta el destino y conserva el monto como string.

- [ ] **Task 1.3: Intento de transferencia e `Idempotency-Key`** `[REQ-3.3, REQ-3.4, REQ-7.3]` `[DESIGN §4.1, §2.6, §7.2]`
  - **Archivos:**
    - `apps/web/src/domain/transfer-attempt.ts` (crear)
    - `apps/web/tests/unit/transfer-attempt.test.ts` (crear)
  - **Depende de:** 1.1
  - **Alcance:** `newIdempotencyKey` (UUID v4 de 36 caracteres ASCII imprimibles, generado con `crypto.getRandomValues`, nunca `crypto.randomUUID`), `TransferAttempt` y `createTransferAttempt(newKey?)` con `keyFor` (misma clave con el mismo cuerpo normalizado; clave nueva si no hay clave o difiere `fromAccountId`, `toAccountId` o `amount`) y `reset()`, según `design.md § 4.1` ("Intento de transferencia e `Idempotency-Key`"). Estado solo en memoria: sin almacenamiento del navegador.
  - **Criterio de aceptación:** `docker compose -f apps/web/compose.dev.yaml run --rm --no-deps dev npm run test:unit -w apps/web -- tests/unit/transfer-attempt.test.ts` y luego `<calidad>`
  - **Evidencia (comportamiento crítico: idempotencia sin doble movimiento):** `[AC-TIW-13]` dos llamadas a `keyFor` con el mismo cuerpo devuelven la misma clave; `[AC-TIW-14]` cambiar origen, destino o monto devuelve una clave distinta, y tras `reset()` la siguiente llamada devuelve una clave nueva; `newIdempotencyKey` cumple `^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`, tiene entre 1 y 255 caracteres ASCII imprimibles y con `crypto.randomUUID` no disponible (sustituido por `undefined` en la prueba) sigue generando claves; con `localStorage`/`sessionStorage` sustituidos por dobles que fallan ante cualquier escritura, ninguna operación escribe en ellos.

- [ ] **Task 1.4: Presentación de estado y sentido de la transferencia** `[REQ-5.1, REQ-6.1]` `[DESIGN §4.1]`
  - **Archivos:**
    - `apps/web/src/domain/transfer-presentation.ts` (crear)
    - `apps/web/tests/unit/transfer-presentation.test.ts` (crear)
  - **Depende de:** 1.1
  - **Alcance:** `transferStatusLabel` (`COMPLETED` → `Completada`; `FAILED` con `INSUFFICIENT_FUNDS` → `No realizada: fondos insuficientes`; exhaustivo sobre los estados del tipo, sin rama por defecto) y `transferDirectionLabel` (`Enviada` si `fromAccountId` está en `ownAccountIds`, incluido origen y destino propios; `Recibida` en otro caso).
  - **Criterio de aceptación:** `docker compose -f apps/web/compose.dev.yaml run --rm --no-deps dev npm run test:unit -w apps/web -- tests/unit/transfer-presentation.test.ts` y luego `<calidad>`
  - **Evidencia:** `[AC-TIW-25]` etiquetas de estado de una transferencia COMPLETED y de una FAILED; `[AC-TIW-30]` rótulo `Enviada` con origen propio y destino ajeno, `Recibida` con origen ajeno y destino propio, y `Enviada` con origen y destino propios.

### Phase 2: Core Logic & Application Layer
- [ ] **Task 2.1: Cliente HTTP con base y cabeceras adicionales y doble de red de Pagos** `[REQ-4.8, REQ-4.9, REQ-7.1]` `[DESIGN §4.1, §8]`
  - **Archivos:**
    - `apps/web/src/api/http-client.ts` (modificar)
    - `apps/web/tests/support/fake-payments-server.ts` (crear)
  - **Depende de:** 1.4
  - **Alcance:** ampliar `RequestOptions` con `base?: string` (URL final `(base ?? AUTH_API_BASE) + path`) y `headers?: Record<string, string>` (añadidas a `Accept`/`Content-Type` en `send`; `Authorization` se fija después y no puede sobreescribirse); el reintento tras la renovación vuelve a llamar a `send` con las mismas `options` (misma `Idempotency-Key` y mismo cuerpo). Conservar sin cambios Bearer, single-flight, un único reintento y mapeo de errores. `fake-payments-server.ts`: doble de `fetch` de Pagos a nivel de red con el mismo patrón que `fake-auth-server.ts` (registra llamadas con método, URL, cabeceras y cuerpo; respuestas por ruta y diferidas, incluida la cabecera `Idempotent-Replayed`; por defecto `GET /accounts` responde `[]`).
  - **Criterio de aceptación:** `docker compose -f apps/web/compose.dev.yaml run --rm --no-deps dev npm run test:unit -w apps/web -- tests/unit/http-client.test.ts` y luego `<calidad>`
  - **Evidencia (comportamiento crítico: la renovación de la aplicación base no regresa):** las pruebas existentes `[AC-WEB-02]`, `[AC-WEB-05]`, `[AC-WEB-06]`, `[AC-WEB-08]` y `[AC-WEB-09]` de `http-client.test.ts` pasan sin modificarlas; la verificación de `base`, `headers` y del reintento con la misma clave queda en la tarea 2.2.

- [ ] **Task 2.2: API de Pagos** `[REQ-1.1, REQ-3.1, REQ-3.3, REQ-3.5, REQ-4.8, REQ-4.9, REQ-5.1, REQ-6.2, REQ-7.1, REQ-7.3, REQ-7.4]` `[DESIGN §4.1, §4.2, §7.2]`
  - **Archivos:**
    - `apps/web/src/api/payments-api.ts` (crear)
    - `apps/web/tests/unit/payments-api.test.ts` (crear)
  - **Depende de:** 2.1
  - **Alcance:** `PAYMENTS_API_BASE = '/api/payments'`, `PaymentsApi` y `createPaymentsApi(client)` con `listAccounts` (`GET /accounts`), `createTransfer` (`POST /transfers`, cuerpo `{type, fromAccountId, toAccountId, amount}` con monto string y cabecera `Idempotency-Key`), `getTransfer` (`GET /transfers/${encodeURIComponent(id)}`, sin `Idempotency-Key`) y `listTransfers` (`GET /transfers` sin `limit`; con cursor `?cursor=` codificado con `URLSearchParams`), todas `authenticated: true` y `base: PAYMENTS_API_BASE`, según la tabla de `design.md § 4.1`. No lee `Idempotent-Replayed`.
  - **Criterio de aceptación:** `docker compose -f apps/web/compose.dev.yaml run --rm --no-deps dev npm run test:unit -w apps/web -- tests/unit/payments-api.test.ts` y luego `<calidad>`
  - **Evidencia (comportamiento crítico: idempotencia, renovación y mensajes):**
    - `[AC-TIW-11]` `createTransfer` envía a `/api/payments/transfers` el cuerpo `{type:"INTERNAL",fromAccountId,toAccountId,amount:"150000.50"}` (monto string), `Authorization: Bearer` e `Idempotency-Key` de 1 a 255 caracteres ASCII imprimibles; los `GET` no llevan `Idempotency-Key`.
    - `[AC-TIW-13]` un segundo `createTransfer` tras un fallo de red con la misma clave envía la misma cabecera y el mismo cuerpo.
    - `[AC-TIW-24]` 401 → una renovación y un único reintento con la misma `Idempotency-Key` y el mismo cuerpo; el llamador recibe el resultado del reintento.
    - `[AC-TIW-36]` tres solicitudes simultáneas a Pagos con 401 → una sola solicitud `POST /auth/refresh` y un reintento por solicitud.
    - `[AC-TIW-38]` ninguna URL de las llamadas registradas contiene credencial ni clave de idempotencia; la URL de la página siguiente es `/api/payments/transfers?cursor=<cursor codificado>`.
    - `[AC-TIW-39]` fallo de red → "No se pudo conectar con el servidor. Intenta de nuevo."; 502 con cuerpo HTML → "El servicio no está disponible. Intenta de nuevo más tarde."; `{error:{code,message}}` → el `message` recibido sin traducir.

- [ ] **Task 2.3: Composición de servicios y consultas de datos financieros** `[REQ-4.1, REQ-6.2, REQ-6.6, REQ-7.1, REQ-7.2]` `[DESIGN §4.1, §3.1, §2.1]`
  - **Archivos:**
    - `apps/web/src/app/create-app-services.ts` (modificar)
    - `apps/web/src/app/payments-queries.ts` (crear)
  - **Depende de:** 2.2
  - **Alcance:** `AppServices.payments: PaymentsApi`; `createAppServices` crea un único `client = createHttpClient(session)` y construye `createAuthApi(client, session)` y `createPaymentsApi(client)` con él (una sola renovación single-flight para ambos servicios); el `QueryClient` pasa a `defaultOptions: {queries: {retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false}}` y mantiene `onCleared: () => queryClient.clear()`. `payments-queries.ts`: `ACCOUNTS_KEY`, `TRANSFERS_KEY`, `transferKey`, `useAccounts`, `useTransfer`, `useTransferHistory` (`useInfiniteQuery`, `initialPageParam: null`, `getNextPageParam: (last) => last.nextCursor ?? undefined`) y `markMoneyDataStale` (`refetchType: 'none'`), todas las consultas con `gcTime: 0`, según `design.md § 4.1` ("Consultas").
  - **Criterio de aceptación:** `<calidad>` y `<existentes>`
  - **Evidencia:** salida de cada comando; el comportamiento de `gcTime: 0`, la invalidación y el vaciado de caché se verifica en las pruebas de las tareas 3.6 a 3.9.

### Phase 3: Presentation, Endpoints & Integration
- [ ] **Task 3.1: Componentes reutilizables de interfaz** `[REQ-1.3, REQ-1.4, REQ-5.5, REQ-8.1, REQ-8.2, REQ-8.3]` `[DESIGN §4.1, §4.3]`
  - **Archivos:**
    - `apps/web/src/ui/components/error-panel.tsx` (crear)
    - `apps/web/src/ui/components/select-field.tsx` (crear)
    - `apps/web/src/ui/components/transfer-nav.tsx` (crear)
    - `apps/web/src/ui/components/account-list.tsx` (crear)
  - **Depende de:** 2.3
  - **Alcance:** `ErrorPanel`, `SelectField`, `TransferNav` (con `hide` y `canTransfer`) y `AccountList` con las props, el marcado, los textos y los roles de la tabla "Componentes reutilizables nuevos" de `design.md § 4.1`. Clases CSS sin estilos en línea. Se verifican por comportamiento en las tareas 3.2 y 3.6 a 3.9.
  - **Criterio de aceptación:** `<calidad>` y `<existentes>`
  - **Evidencia:** salida de cada comando.

- [ ] **Task 3.2: Pantalla de cuentas (`/`) y helper de pruebas con doble de Pagos** `[REQ-1.1, REQ-1.2, REQ-1.3, REQ-1.4, REQ-7.4, REQ-8.3]` `[DESIGN §4.3, §8.2]`
  - **Archivos:**
    - `apps/web/tests/support/render-app.tsx` (modificar)
    - `apps/web/src/ui/pages/home-page.tsx` (modificar)
    - `apps/web/tests/component/accounts.test.tsx` (crear)
  - **Depende de:** 3.1
  - **Alcance:** `render-app.tsx` acepta el doble de Pagos y enruta `fetch` por prefijo (`/api/auth/` al de identidad, `/api/payments/` al de Pagos). `HomePage` conserva `<h1>FluxOne Payment</h1>`, el perfil y `Cerrar sesión` y añade la `<section>` `Mis cuentas` con los estados de `design.md § 4.3` (cargando → `LoadingScreen`; error → `ErrorPanel` con "Reintentar"; vacío → `No tienes cuentas.` y `TransferNav` con `canTransfer={false}`; con cuentas → `AccountList` y `TransferNav` con `hide="accounts"`).
  - **Criterio de aceptación:** `docker compose -f apps/web/compose.dev.yaml run --rm --no-deps dev npm run test:component -w apps/web -- tests/component/accounts.test.tsx` y luego `<calidad>` y `<existentes>`
  - **Evidencia:** `[AC-TIW-01]` `/` muestra ACC-001 con `1.000.000,00 COP`, el correo, `Cerrar sesión` y los enlaces `Nueva transferencia` e `Historial`; `[AC-TIW-02]` mientras la solicitud está pendiente solo se ve `Cargando…` (ni saldo parcial ni `No tienes cuentas.`); `[AC-TIW-03]` con lista vacía se ve `No tienes cuentas.` y no hay enlace a `/transfers/new`; `[AC-TIW-04]` un fallo muestra el mensaje y `Reintentar` vuelve a pedir las cuentas (segunda solicitud `GET /api/payments/accounts`).

- [ ] **Task 3.3: Pantalla de nueva transferencia (formulario, envío sin doble envío e idempotente)** `[REQ-2.1, REQ-2.2, REQ-2.3, REQ-2.4, REQ-2.5, REQ-3.1, REQ-3.2, REQ-3.3, REQ-3.4, REQ-3.5, REQ-4.1, REQ-4.2, REQ-4.3, REQ-4.4, REQ-4.5, REQ-4.6, REQ-4.7, REQ-4.8, REQ-4.9, REQ-8.1, REQ-8.2, REQ-8.3]` `[DESIGN §4.2, §4.3, §7.2]`
  - **Archivos:**
    - `apps/web/src/ui/pages/new-transfer-page.tsx` (crear)
  - **Depende de:** 3.2
  - **Alcance:** `NewTransferPage` con el contenido, los textos y el algoritmo de envío (pasos 1 a 6) de `design.md § 4.3`: `<h1>Nueva transferencia</h1>`; estados de cuentas (carga, error con "Reintentar" sin formulario, sin cuentas); `<form noValidate>` con `SelectField` "Cuenta origen" (opciones `{id} — {saldo formatCop}`), `FormField` "Cuenta destino" (`maxLength={64}`) y "Monto (COP)"; `validateTransfer` antes de enviar sin consumir clave; `attempt = useRef(createTransferAttempt())`; `useSingleSubmit` alrededor de `payments.createTransfer(input, attempt.keyFor(input))`; en éxito `attempt.reset()`, `markMoneyDataStale(queryClient)` y `navigate('/transfers/' + id)`; tratamiento de cada `ApiError` según la tabla de `design.md § 4.2` (401 sin mensaje; `ACCOUNT_NOT_FOUND` con refetch de cuentas; `DESTINATION_NOT_FOUND` y `SAME_ACCOUNT` junto al destino; `reset()` ante `IDEMPOTENCY_KEY_REQUIRED` y `IDEMPOTENCY_KEY_PAYLOAD_MISMATCH`; aviso de incertidumbre con enlace a `/transfers` ante red, `SERVICE_UNAVAILABLE` o status >= 500); botón `Transferir` (`Procesando…` y `disabled` mientras `pending`); `aria-invalid`, `aria-describedby`, `role="alert"` y `role="status"`. La clave nunca se escribe en almacenamiento ni en la URL. Se verifica en la tarea 3.7.
  - **Criterio de aceptación:** `<calidad>` y `<existentes>`
  - **Evidencia:** salida de cada comando.

- [ ] **Task 3.4: Pantalla de resultado de una transferencia** `[REQ-5.1, REQ-5.2, REQ-5.3, REQ-5.4, REQ-5.5, REQ-8.2, REQ-8.3]` `[DESIGN §4.2, §4.3]`
  - **Archivos:**
    - `apps/web/src/ui/pages/transfer-detail-page.tsx` (crear)
  - **Depende de:** 3.3
  - **Alcance:** `TransferDetailPage` con `<h1>Resultado de la transferencia</h1>`, `useTransfer(id)`, los estados de `design.md § 4.3` (cargando sin estado de resultado; 404 `TRANSFER_NOT_FOUND` con `<p role="alert">` y enlace `Historial`, sin "Reintentar"; otro error con `ErrorPanel` y "Reintentar"; éxito con `<dl>` de identificador, origen, destino, `Monto` con `formatCop`, `Fecha` con `<time>` y `Estado` con `transferStatusLabel`, siempre en texto) y `TransferNav` completo. Se verifica en la tarea 3.8.
  - **Criterio de aceptación:** `<calidad>` y `<existentes>`
  - **Evidencia:** salida de cada comando.

- [ ] **Task 3.5: Pantalla de historial de transferencias** `[REQ-6.1, REQ-6.2, REQ-6.3, REQ-6.4, REQ-6.5, REQ-6.6, REQ-8.2, REQ-8.3]` `[DESIGN §4.1, §4.2, §4.3]`
  - **Archivos:**
    - `apps/web/src/ui/pages/transfers-page.tsx` (crear)
  - **Depende de:** 3.4
  - **Alcance:** `TransfersPage` con `<h1>Historial de transferencias</h1>`, `useTransferHistory()` y `useAccounts()` (ids propios para `transferDirectionLabel`), los estados de `design.md § 4.3` (carga; error de primera página o de cuentas con "Reintentar"; vacío `Aún no tienes transferencias.` con enlace a `Nueva transferencia` si hay cuentas; `<ul>` en el orden recibido con `<time>`, `Enviada`/`Recibida`, `{origen} → {destino}`, monto, estado y enlace `Ver detalle`; botón `Cargar más` `disabled` mientras `isFetchingNextPage` y oculto sin `hasNextPage`; error de página siguiente con `ErrorPanel` que llama `fetchNextPage` bajo la lista ya cargada) y `TransferNav` con `hide="history"`. Se verifica en la tarea 3.8.
  - **Criterio de aceptación:** `<calidad>` y `<existentes>`
  - **Evidencia:** salida de cada comando.

- [ ] **Task 3.6: Rutas, estilos y verificación de rutas protegidas** `[REQ-1.5, REQ-8.3, REQ-9.3]` `[DESIGN §4.3, §5, §7.2]`
  - **Archivos:**
    - `apps/web/src/routes.tsx` (modificar)
    - `apps/web/src/styles.css` (modificar)
    - `apps/web/tests/component/transfer-routing.test.tsx` (crear)
  - **Depende de:** 3.5
  - **Alcance:** añadir a `appRoutes` `/transfers/new` (`NewTransferPage`), `/transfers/:id` (`TransferDetailPage`) y `/transfers` (`TransfersPage`), cada una dentro de `<RequireSession>`; `/login`, `/register` y `*` → `/` no cambian. `styles.css`: estilos por clase de las pantallas y componentes nuevos, sin recursos externos, sin `url()` a otros orígenes ni `data:`, sin estilos en línea.
  - **Criterio de aceptación:** `docker compose -f apps/web/compose.dev.yaml run --rm --no-deps dev npm run test:component -w apps/web -- tests/component/transfer-routing.test.tsx` y luego `<calidad>`, `<existentes>` y `docker compose -f apps/web/compose.dev.yaml run --rm --no-deps dev sh -c "npm run build -w apps/web && npm run check:csp -w apps/web"` (muestra `build compatible con default-src self`)
  - **Evidencia (comportamiento crítico: sesión y rutas protegidas):** `[AC-TIW-05]` sin sesión, `/transfers/new`, `/transfers` y `/transfers/<id>` muestran el inicio de sesión sin contenido protegido; una ruta desconocida con sesión lleva a `/`; `check:csp` sin hallazgos (sin `<script>` ni `<style>` en línea ni referencias a otros orígenes).

- [ ] **Task 3.7: Pruebas de componente del formulario y del envío** `[REQ-2.1, REQ-2.2, REQ-2.3, REQ-2.4, REQ-2.5, REQ-3.1, REQ-3.2, REQ-3.3, REQ-3.4, REQ-3.5, REQ-4.1, REQ-4.2, REQ-4.3, REQ-4.4, REQ-4.5, REQ-4.6, REQ-4.7, REQ-4.8, REQ-4.9]` `[DESIGN §8.2]`
  - **Archivos:**
    - `apps/web/tests/component/new-transfer-form.test.tsx` (crear)
    - `apps/web/tests/component/new-transfer-submit.test.tsx` (crear)
  - **Depende de:** 3.6
  - **Alcance:** pruebas Vitest + Testing Library + `user-event` con jsdom, usando `render-app.tsx` y los dobles de red (identidad y Pagos se simulan solo aquí), con los casos de `design.md § 8.2` para ambos archivos. Si una prueba revela un defecto en código de tareas anteriores, se corrige en el archivo de la tarea que lo creó.
  - **Criterio de aceptación:** `docker compose -f apps/web/compose.dev.yaml run --rm --no-deps dev npm run test:component -w apps/web -- tests/component/new-transfer-form.test.tsx tests/component/new-transfer-submit.test.tsx` y luego `<calidad>`
  - **Evidencia (comportamiento crítico: sin doble envío e idempotencia):**
    - `[AC-TIW-06]` el selector contiene ACC-001 y el botón `Transferir` está disponible; `[AC-TIW-07]`, `[AC-TIW-08]`, `[AC-TIW-09]` monto inválido, destino vacío y destino igual al origen muestran su mensaje junto al campo, no envían ninguna solicitud y conservan lo escrito; `[AC-TIW-10]` carga y error de cuentas sin formulario.
    - `[AC-TIW-11]` la solicitud lleva el cuerpo `{type:"INTERNAL",fromAccountId:"ACC-001",toAccountId:"ACC-002",amount:"150000.50"}`, Bearer e `Idempotency-Key` válida.
    - `[AC-TIW-12]` con respuesta diferida, doble clic y Enter repetido dejan el botón deshabilitado con `Procesando…` y el doble de Pagos registra exactamente una solicitud `POST /api/payments/transfers`.
    - `[AC-TIW-13]` tras red caída, 5xx y 409 el reintento sin editar lleva la misma `Idempotency-Key` y el mismo cuerpo, y se muestra el aviso "No pudimos confirmar si la transferencia se realizó. Si reintentas no se duplicará; también puedes revisar tu historial." en red y 5xx; `[AC-TIW-14]` editar un campo o iniciar una transferencia nueva tras un 201 usa una clave distinta.
    - `[AC-TIW-15]` una respuesta 201 con `Idempotent-Replayed: true` lleva a `/transfers/<mismo id>` sin segundo movimiento; `[AC-TIW-16]` el 201 (COMPLETED o FAILED) lleva a `/transfers/<id>` y al volver a `/` se piden de nuevo las cuentas.
    - `[AC-TIW-17]` `INVALID_AMOUNT`, `VALIDATION_ERROR`, `IDEMPOTENCY_KEY_REQUIRED` e `IDEMPOTENCY_KEY_PAYLOAD_MISMATCH` muestran el `message` en `role="alert"`, conservan lo escrito y el reenvío usa clave nueva; `[AC-TIW-18]` `ACCOUNT_NOT_FOUND` muestra "Cuenta no encontrada." y repite `GET /accounts`; `[AC-TIW-19]` `DESTINATION_NOT_FOUND` y `[AC-TIW-20]` `SAME_ACCOUNT` junto al campo destino; `[AC-TIW-21]` 409 con botón habilitado y misma clave; `[AC-TIW-22]` red, 5xx y respuesta sin formato con el mensaje de RN-09, el aviso y lo escrito conservado.
    - `[AC-TIW-23]` 401 con renovación rechazada → se muestra el inicio de sesión sin formulario; `[AC-TIW-24]` 401 con renovación exitosa → una sola renovación y un único reintento con la misma `Idempotency-Key`, un solo movimiento registrado.

- [ ] **Task 3.8: Pruebas de componente del resultado y del historial** `[REQ-5.1, REQ-5.2, REQ-5.3, REQ-5.4, REQ-5.5, REQ-6.1, REQ-6.2, REQ-6.3, REQ-6.4, REQ-6.5, REQ-6.6]` `[DESIGN §8.2]`
  - **Archivos:**
    - `apps/web/tests/component/transfer-detail-page.test.tsx` (crear)
    - `apps/web/tests/component/transfers-history-page.test.tsx` (crear)
  - **Depende de:** 3.7
  - **Alcance:** pruebas Vitest + Testing Library con jsdom, usando `render-app.tsx` y los dobles de red, con los casos de `design.md § 8.2` para ambos archivos. Los defectos que revelen se corrigen en el archivo de la tarea que los creó.
  - **Criterio de aceptación:** `docker compose -f apps/web/compose.dev.yaml run --rm --no-deps dev npm run test:component -w apps/web -- tests/component/transfer-detail-page.test.tsx tests/component/transfers-history-page.test.tsx` y luego `<calidad>`
  - **Evidencia (comportamiento crítico: aislamiento y paginación sin repetir ni omitir):**
    - `[AC-TIW-25]` COMPLETED de `150000.50` muestra `Completada` y el monto `150.000,50 COP`; FAILED con `INSUFFICIENT_FUNDS` muestra `No realizada: fondos insuficientes`; la solicitud es `GET /api/payments/transfers/<id>` sin `Idempotency-Key`.
    - `[AC-TIW-26]` durante la carga no se muestra estado de resultado; `[AC-TIW-27]` 404 `TRANSFER_NOT_FOUND` muestra "Transferencia no encontrada." con enlace `Historial`, idéntico para id inexistente, inválido y ajeno; `[AC-TIW-28]` error con `Reintentar`; `[AC-TIW-29]` enlaces `Nueva transferencia`, `Historial` y `Cuentas`.
    - `[AC-TIW-30]` una enviada y una recibida con rótulo, orden recibido, estado y enlace `Ver detalle`; `[AC-TIW-31]` con 25 transferencias (20 + 5) `Cargar más` pide `?cursor=<nextCursor>`, queda deshabilitado mientras carga, añade las 5 restantes sin repetir ni omitir y desaparece; `[AC-TIW-32]` vacío con enlace a `Nueva transferencia`; `[AC-TIW-33]` carga sin mensaje de vacío; `[AC-TIW-34]` error de primera página y de página siguiente con "Reintentar" y páginas ya cargadas conservadas; `[AC-TIW-35]` tras una transferencia, `/transfers` y `/` piden y muestran la transferencia nueva y los saldos actualizados.

- [ ] **Task 3.9: Pruebas de componente de aislamiento, mensajes de error y accesibilidad** `[REQ-7.2, REQ-7.3, REQ-7.4, REQ-8.1, REQ-8.2, REQ-8.3]` `[DESIGN §7.2, §8.2]`
  - **Archivos:**
    - `apps/web/tests/component/session-isolation.test.tsx` (crear)
    - `apps/web/tests/component/payments-errors.test.tsx` (crear)
    - `apps/web/tests/component/accessibility.test.tsx` (crear)
  - **Depende de:** 3.8
  - **Alcance:** pruebas Vitest + Testing Library + `user-event` con jsdom, usando `render-app.tsx` y los dobles de red, con los casos de `design.md § 8.2` para los tres archivos. Los defectos que revelen se corrigen en el archivo de la tarea que los creó.
  - **Criterio de aceptación:** `docker compose -f apps/web/compose.dev.yaml run --rm --no-deps dev npm run test:component -w apps/web -- tests/component/session-isolation.test.tsx tests/component/payments-errors.test.tsx tests/component/accessibility.test.tsx` y luego `<calidad>` y `<existentes>`
  - **Evidencia (comportamiento crítico: aislamiento entre usuarios y sin datos en almacenamiento):**
    - `[AC-TIW-37]` sesión de alice con saldos cargados → cierre de sesión (voluntario, renovación rechazada y sesión revocada) → `queryClient.getQueryCache().getAll()` vacío → entra bob y solo se ven los datos que el doble de Pagos devuelve para su credencial.
    - `[AC-TIW-38]` tras iniciar sesión, transferir y abrir el historial, `localStorage`, `sessionStorage`, `document.cookie` y la URL no contienen credencial, `Idempotency-Key` ni datos de transferencias (salvo el id en `/transfers/:id`).
    - `[AC-TIW-39]` en `/`, `/transfers/new`, `/transfers/:id` y `/transfers`, un fallo de red, una respuesta 502 HTML y un `{error:{code,message}}` muestran respectivamente el mensaje de conexión, el de servicio no disponible y el `message` recibido.
    - `[AC-TIW-40]` etiquetas visibles, `aria-invalid` y `aria-describedby` en campos con error y formulario completado y enviado solo con teclado; `[AC-TIW-41]` `role="status"` en cargas, `role="alert"` en errores y estado de la transferencia siempre en texto; `[AC-TIW-42]` un único `<h1>` por pantalla y cuentas e historial como lista semántica.

### Phase 4: Verification, Testing & Polish
- [ ] **Task 4.1: Compose con Pagos y proxy `/api/payments/` en nginx** `[REQ-9.1, REQ-9.2, REQ-9.3, REQ-9.4, REQ-10.2, REQ-10.3]` `[DESIGN §2.3, §4.4, §5]`
  - **Archivos:**
    - `apps/web/nginx/default.conf` (modificar: añade `location /api/payments/`)
    - `apps/web/compose.dev.yaml` (modificar: archivo final completo de `design.md § 2.3`)
  - **Depende de:** 3.9
  - **Alcance:** `default.conf` con el contenido exacto de `design.md § 5`: segundo `location /api/payments/` con `proxy_pass http://payments:3002/` (prefijo recortado) y `proxy_set_header` de `Host`, `X-Real-IP` y `X-Request-Id`; sin cambios en `location /`, `location /api/auth/` ni en las cuatro cabeceras de seguridad con `always` a nivel `server`; ningún `add_header` en los `location`; ningún upstream distinto de `auth` y `payments`. `compose.dev.yaml` con el contenido exacto de `design.md § 2.3`: servicio `payments` (etapa runtime de `services/payments/Dockerfile`, `PORT: '3002'`, `DATABASE_URL`, `AUTH_JWKS_URL`, healthcheck), `PAYMENT_DB_PASSWORD` y los dos scripts de inicialización montados por archivo en `postgres`, `web` dependiente de `auth` y `payments` saludables y `dev` con `DEMO_USERS_PASSWORD`. `apps/web/Dockerfile` no cambia.
  - **Criterio de aceptación:** todos con código de salida 0, en este orden:
    - `docker compose -f apps/web/compose.dev.yaml config -q`
    - `docker compose -f apps/web/compose.dev.yaml config --services | grep -qx payments`
    - `docker compose -f apps/web/compose.dev.yaml run --rm --no-deps dev sh -c "test \$(grep -c 'proxy_pass' apps/web/nginx/default.conf) -eq 2 && grep -q 'proxy_pass http://auth:3001/;' apps/web/nginx/default.conf && grep -q 'proxy_pass http://payments:3002/;' apps/web/nginx/default.conf && test \$(grep -c 'proxy_set_header X-Request-Id \$request_id;' apps/web/nginx/default.conf) -eq 2 && test \$(grep -c 'add_header' apps/web/nginx/default.conf) -eq 4"`
    - `docker build -f apps/web/Dockerfile -t fluxone-web-check .`
    - `docker run --rm --add-host auth:127.0.0.1 --add-host payments:127.0.0.1 fluxone-web-check nginx -t`
    - `docker compose -f apps/web/compose.dev.yaml build web payments`
    - `docker compose -f apps/web/compose.dev.yaml up -d --wait web`
    - `docker compose -f apps/web/compose.dev.yaml exec -T web wget -q -O - http://127.0.0.1:80/api/payments/health/live | grep -q ok`
    - limpieza: `docker compose -f apps/web/compose.dev.yaml down -v`
  - **Evidencia (comportamiento crítico: proxy y cabeceras):** salida de cada comando: `nginx -t` válido con ambos upstreams, `GET /api/payments/health/live` por el origen de `web` devuelve la respuesta de `GET /health/live` de Pagos (prefijo recortado), y exactamente 4 `add_header` (a nivel `server`, ninguno en `location`).

- [ ] **Task 4.2: Pruebas de integración contra nginx, identidad y Pagos reales** `[REQ-9.1, REQ-9.2, REQ-9.3, REQ-10.1, REQ-10.3]` `[DESIGN §8.3]`
  - **Archivos:**
    - `apps/web/tests/integration/web-server.test.ts` (modificar)
    - `apps/web/tests/integration/payments-proxy.test.ts` (crear)
    - `apps/web/tests/integration/transfer-flow.test.ts` (crear)
  - **Depende de:** 4.1
  - **Alcance:** pruebas del proyecto `integration` (en secuencia, contra `WEB_BASE_URL`; si falta, lanzan `WEB_BASE_URL no definida: ejecuta las pruebas con docker compose run dev`; sin cookie jar automático) con los casos de `design.md § 8.3`. `web-server.test.ts` actualiza, por este spec, las aserciones de la aplicación base: dos `proxy_pass` (`http://auth:3001/` y `http://payments:3002/`) con sus `proxy_set_header` y el servidor operando con `auth`, `payments` y `postgres`; los AC-WEB-27 a 30 siguen cubiertos. `transfer-flow.test.ts` inicia sesión una sola vez por ejecución (límite de 5 inicios por minuto por IP; si se repite en menos de un minuto, esperar o ejecutar `down -v`).
  - **Criterio de aceptación:** todos con código de salida 0, en este orden:
    - `docker compose -f apps/web/compose.dev.yaml run --rm dev npm run test:integration -w apps/web`
    - `docker compose -f apps/web/compose.dev.yaml logs payments | grep -Eq '"reqId":"[0-9a-f]{32}"'`
    - `docker compose -f apps/web/compose.dev.yaml logs auth | grep -Eq '"reqId":"[0-9a-f]{32}"'`
    - `<calidad>`
    - limpieza: `docker compose -f apps/web/compose.dev.yaml down -v`
  - **Evidencia (comportamiento crítico: único origen, idempotencia y flujo completo):**
    - `[AC-TIW-43]` `GET /api/payments/health/live` devuelve el `{"status":"ok"}` de `GET /health/live`; el `reqId` de 32 hex del `X-Request-Id` aparece en los logs de `payments`.
    - `[AC-TIW-44]` `/login` devuelve `index.html` y `/api/auth/health/live` la respuesta de identidad, como antes; `[AC-TIW-47]` las pruebas de la aplicación base pasan junto a las nuevas.
    - `[AC-TIW-45]` las cuatro cabeceras de seguridad presentes en `/`, `/ruta-inexistente` y `/api/payments/health/live`.
    - `[AC-TIW-49]` login de alice → `GET /api/payments/accounts` incluye `ACC-001` → `POST /api/payments/transfers` de `ACC-001` a `ACC-002` por `1.00` con `Idempotency-Key` → 201 COMPLETED → repetición con la misma clave → mismo id con `Idempotent-Replayed: true` (un solo movimiento) → transferencia por un monto mayor que el saldo → 201 FAILED `INSUFFICIENT_FUNDS` → `GET /api/payments/transfers/{id}` y `GET /api/payments/transfers` la incluyen → `POST /api/auth/auth/logout` 204, todo por el origen de nginx.

- [ ] **Task 4.3: Prueba de Pagos caído** `[REQ-9.4]` `[DESIGN §2.3, §7.1, §8.3]`
  - **Archivos:**
    - `apps/web/tests/integration/payments-down.test.ts` (crear)
  - **Depende de:** 4.2
  - **Alcance:** suite que solo se ejecuta con `PAYMENTS_STOPPED=1` (sin la variable se omite): `GET /` → 200; `GET /api/auth/health/live` → 200; `GET /api/payments/health/live` → 502 con las cuatro cabeceras de seguridad.
  - **Criterio de aceptación:** todos con código de salida 0, en este orden:
    - `docker compose -f apps/web/compose.dev.yaml up -d --wait web`
    - `docker compose -f apps/web/compose.dev.yaml stop payments`
    - `docker compose -f apps/web/compose.dev.yaml run --rm --no-deps -e PAYMENTS_STOPPED=1 dev npm run test:integration -w apps/web -- tests/integration/payments-down.test.ts`
    - `docker compose -f apps/web/compose.dev.yaml start payments`
    - `<calidad>`
    - limpieza: `docker compose -f apps/web/compose.dev.yaml down -v`
  - **Evidencia (comportamiento crítico: continuidad con Pagos caído):** `[AC-TIW-46]` salida de la suite con la aplicación y la identidad respondiendo 200 y Pagos respondiendo 502 con las cuatro cabeceras de seguridad.

- [ ] **Task 4.4: Actualización del `design.md` del spec previo `autenticacion-usuarios-web`** `[REQ-9.2, REQ-10.1]` `[DESIGN §5]`
  - **Archivos:**
    - `.makia/docs/specs/apps/web/autenticacion-usuarios-web/design.md` (modificar)
  - **Depende de:** 4.3
  - **Alcance:** actualización incremental del spec previo, citando `transferencias-internas-web` como disparador: §2.3 (Compose y comandos con `payments`, `PAYMENT_DB_PASSWORD` y los dos montajes de inicialización), §2.8 (retira la entrada de `transferencias-internas-web`), §4.4 y §5 (`nginx/default.conf` con dos upstreams, `auth` y `payments`; `compose.dev.yaml` con el contenido final), §8.2 (`web-server.test.ts` con los dos `proxy_pass` y el servidor operando con `auth`, `payments` y `postgres`) y el ítem del §9 sobre el único upstream. Solo lo necesario para que describa el código resultante; sin historial de modificaciones.
  - **Criterio de aceptación:** `docker compose -f apps/web/compose.dev.yaml run --rm --no-deps dev sh -c "f=.makia/docs/specs/apps/web/autenticacion-usuarios-web/design.md; grep -q 'http://payments:3002/' \$f && grep -q 'PAYMENT_DB_PASSWORD' \$f && grep -q 'transferencias-internas-web' \$f && ! grep -n 'transferencias-internas-web' \$f | grep -q '2.8'"`
  - **Evidencia:** salida del comando y lista de las secciones editadas (§2.3, §2.8, §4.4, §5, §8.2, §9).

- [ ] **Task 4.5: Registro de la actualización en el `summary.md` del spec previo** `[REQ-9.2, REQ-10.1]` `[DESIGN §5]`
  - **Archivos:**
    - `.makia/docs/specs/apps/web/autenticacion-usuarios-web/summary.md` (modificar)
  - **Depende de:** 4.4
  - **Alcance:** registrar en la sección "Actualizaciones incrementales recibidas" la actualización del spec previo, con `transferencias-internas-web` como disparador y el detalle: `apps/web/nginx/default.conf` (`location /api/payments/`), `apps/web/compose.dev.yaml` (servicio `payments`), `apps/web/tests/integration/web-server.test.ts` y las secciones actualizadas de su `design.md`.
  - **Criterio de aceptación:** `docker compose -f apps/web/compose.dev.yaml run --rm --no-deps dev sh -c "f=.makia/docs/specs/apps/web/autenticacion-usuarios-web/summary.md; grep -q 'Actualizaciones incrementales recibidas' \$f && grep -q 'transferencias-internas-web' \$f && grep -q 'default.conf' \$f"`
  - **Evidencia:** salida del comando.

- [ ] **Task 4.6: Verificación global del spec** `[REQ-10.1, REQ-10.2, REQ-10.3]` `[DESIGN §5, §8.3]`
  - **Archivos:** ninguno (solo verificación).
  - **Depende de:** 4.5
  - **Alcance:** ejecutar la verificación completa de `apps/web` en contenedores y confirmar la cobertura de los criterios AC-TIW-01..49 y que los archivos tocados coinciden con la tabla de `design.md § 5`.
  - **Criterio de aceptación:** todos con código de salida 0, en este orden:
    - `docker compose -f apps/web/compose.dev.yaml run --rm --no-deps dev npm ci --workspace=apps/web --include-workspace-root`
    - `docker compose -f apps/web/compose.dev.yaml run --rm --no-deps dev npm run lint -w apps/web`
    - `docker compose -f apps/web/compose.dev.yaml run --rm --no-deps dev npm run format:check -w apps/web`
    - `docker compose -f apps/web/compose.dev.yaml run --rm --no-deps dev npm run typecheck -w apps/web`
    - `docker compose -f apps/web/compose.dev.yaml run --rm --no-deps dev npm run test:unit -w apps/web`
    - `docker compose -f apps/web/compose.dev.yaml run --rm --no-deps dev npm run test:component -w apps/web`
    - `docker compose -f apps/web/compose.dev.yaml run --rm --no-deps dev npm run build -w apps/web`
    - `docker compose -f apps/web/compose.dev.yaml run --rm --no-deps dev sh -c "npm run build -w apps/web && npm run check:csp -w apps/web"`
    - `docker build -f apps/web/Dockerfile -t fluxone-web-check .`
    - `docker run --rm --entrypoint sh fluxone-web-check -c "test -f /usr/share/nginx/html/index.html && test ! -e /app && test ! -e /usr/share/nginx/html/node_modules && nginx -v 2>&1 | grep -q 1.30.6"`
    - `docker run --rm --add-host auth:127.0.0.1 --add-host payments:127.0.0.1 fluxone-web-check nginx -t`
    - `docker compose -f apps/web/compose.dev.yaml run --rm dev npm run test:integration -w apps/web`
    - `docker compose -f apps/web/compose.dev.yaml run --rm --no-deps dev sh -c 'test "$(grep -rhoE "\[AC-TIW-[0-9]{2}\]" apps/web/tests | sort -u | wc -l)" -eq 48'` (sale 0 solo si hay `48`)
    - `docker compose -f apps/web/compose.dev.yaml run --rm --no-deps dev sh -c 'test "$(git status --porcelain --untracked-files=all -- apps | wc -l)" -eq 41'` (sale 0 solo si hay `41`: los 31 archivos creados y los 10 modificados de `apps/web/`)
    - `docker compose -f apps/web/compose.dev.yaml run --rm --no-deps dev sh -c 'test -z "$(git status --porcelain -- package-lock.json lefthook.yml services)"'`
    - limpieza: `docker compose -f apps/web/compose.dev.yaml down -v`
  - **Evidencia (AC-TIW-48):** salida de cada comando: `npm ci`, lint, formato, tipos, pruebas, build, etapas del Dockerfile y contenido de la imagen terminan sin errores ni advertencias, sin instalar nada en el host. El recuento `48` corresponde a las pruebas con `[AC-TIW-` (AC-TIW-01 a AC-TIW-47 y AC-TIW-49); AC-TIW-48 se verifica con los comandos de esta tarea. La lista de `git status` coincide con la tabla de `design.md § 5` (los 41 archivos de `apps/web` más los dos documentos del spec previo, ya verificados en las tareas 4.4 y 4.5), sin cambios en `package-lock.json`, `lefthook.yml` ni `services/`.

---

## 4. Cobertura de criterios EARS

| REQ | Tareas | Verificación (AC-TIW) |
|:---|:---|:---|
| REQ-1.1 | 1.1, 2.2, 3.2 | AC-TIW-01 |
| REQ-1.2 | 3.2 | AC-TIW-02 |
| REQ-1.3 | 3.1, 3.2 | AC-TIW-03 |
| REQ-1.4 | 3.1, 3.2 | AC-TIW-04 |
| REQ-1.5 | 3.6 | AC-TIW-05 |
| REQ-2.1 | 3.3, 3.7 | AC-TIW-06 |
| REQ-2.2 | 1.2, 3.3, 3.7 | AC-TIW-07 |
| REQ-2.3 | 1.2, 3.3, 3.7 | AC-TIW-08 |
| REQ-2.4 | 1.2, 3.3, 3.7 | AC-TIW-09 |
| REQ-2.5 | 3.3, 3.7 | AC-TIW-10 |
| REQ-3.1 | 2.2, 3.3, 3.7 | AC-TIW-11 |
| REQ-3.2 | 3.3, 3.7 | AC-TIW-12 |
| REQ-3.3 | 1.3, 2.2, 3.3, 3.7 | AC-TIW-13 |
| REQ-3.4 | 1.3, 3.3, 3.7 | AC-TIW-14 |
| REQ-3.5 | 2.2, 3.3, 3.7 | AC-TIW-15 |
| REQ-4.1 | 2.3, 3.3, 3.7 | AC-TIW-16 |
| REQ-4.2 | 3.3, 3.7 | AC-TIW-17 |
| REQ-4.3 | 3.3, 3.7 | AC-TIW-18 |
| REQ-4.4 | 3.3, 3.7 | AC-TIW-19 |
| REQ-4.5 | 3.3, 3.7 | AC-TIW-20 |
| REQ-4.6 | 3.3, 3.7 | AC-TIW-21 |
| REQ-4.7 | 3.3, 3.7 | AC-TIW-22 |
| REQ-4.8 | 2.1, 2.2, 3.3, 3.7 | AC-TIW-23 |
| REQ-4.9 | 2.1, 2.2, 3.3, 3.7 | AC-TIW-24 |
| REQ-5.1 | 1.1, 1.4, 2.2, 3.4, 3.8 | AC-TIW-25 |
| REQ-5.2 | 3.4, 3.8 | AC-TIW-26 |
| REQ-5.3 | 3.4, 3.8 | AC-TIW-27 |
| REQ-5.4 | 3.4, 3.8 | AC-TIW-28 |
| REQ-5.5 | 3.1, 3.4, 3.8 | AC-TIW-29 |
| REQ-6.1 | 1.1, 1.4, 3.5, 3.8 | AC-TIW-30 |
| REQ-6.2 | 2.2, 2.3, 3.5, 3.8 | AC-TIW-31 |
| REQ-6.3 | 3.5, 3.8 | AC-TIW-32 |
| REQ-6.4 | 3.5, 3.8 | AC-TIW-33 |
| REQ-6.5 | 3.5, 3.8 | AC-TIW-34 |
| REQ-6.6 | 2.3, 3.5, 3.8 | AC-TIW-35 |
| REQ-7.1 | 2.1, 2.2, 2.3 | AC-TIW-36 |
| REQ-7.2 | 2.3, 3.9 | AC-TIW-37 |
| REQ-7.3 | 1.3, 2.2, 3.9 | AC-TIW-38 |
| REQ-7.4 | 2.2, 3.2, 3.9 | AC-TIW-39 |
| REQ-8.1 | 3.1, 3.3, 3.9 | AC-TIW-40 |
| REQ-8.2 | 3.1, 3.3, 3.4, 3.5, 3.9 | AC-TIW-41 |
| REQ-8.3 | 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.9 | AC-TIW-42 |
| REQ-9.1 | 4.1, 4.2 | AC-TIW-43 |
| REQ-9.2 | 4.1, 4.2, 4.4, 4.5 | AC-TIW-44 |
| REQ-9.3 | 3.6, 4.1, 4.2 | AC-TIW-45 |
| REQ-9.4 | 4.1, 4.3 | AC-TIW-46 |
| REQ-10.1 | 4.2, 4.4, 4.5, 4.6 | AC-TIW-47 |
| REQ-10.2 | 4.1, 4.6 | AC-TIW-48 |
| REQ-10.3 | 4.1, 4.2, 4.6 | AC-TIW-49 |

---

## 5. Execution Progress Tracker
| Fase | Total Tareas | Completadas | Estado |
|:---|:---:|:---:|:---|
| **Phase 1: Foundation, Schemas & Core Domain** | 4 | 0 | `Pending` |
| **Phase 2: Core Logic & Application Layer** | 3 | 0 | `Pending` |
| **Phase 3: Presentation, Endpoints & Integration** | 9 | 0 | `Pending` |
| **Phase 4: Verification, Testing & Polish** | 6 | 0 | `Pending` |
| **Total Global** | **22** | **0** | **0%** |

---

## 6. Definition of Done (DoD) Gate
- [ ] Todas las tareas están marcadas como completadas (`[x]`).
- [ ] Todos los criterios EARS de `requirements.md` pasan las pruebas asociadas.
- [ ] Los 49 criterios AC-TIW-01..49 pasan su verificación (ver la tabla de trazabilidad de `requirements.md`).
- [ ] La estructura de archivos coincide con el mapeo de `design.md § 5`.
- [ ] Todos los tests unitarios, de componente y de integración, y los comandos de contenedor, pasan sin advertencias críticas.
- [ ] La fila del spec en el `INDEX.md` de specs (`.makia/docs/specs/apps/web/INDEX.md`) está sincronizada con el `Estado global` de `summary.md`.

---

> IMPLEMENT ejecuta este documento tarea por tarea. Cada tarea se valida con un TEST acotado a sus propios archivos (no la suite completa) antes de marcarse `[x]`. Máximo 2 iteraciones de corrección por tarea antes de cancelar y escalar (ver sub-orchestrator.md del Orquestador).
