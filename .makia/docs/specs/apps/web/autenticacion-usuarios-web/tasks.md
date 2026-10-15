# Implementation Tasks: Autenticación de usuarios (aplicación web `apps/web`)

## 1. Metadata & Traceability
- **Spec:** `autenticacion-usuarios-web`
- **Requirements Ref:** `requirements.md` (spec: `autenticacion-usuarios-web`)
- **Design Ref:** `design.md` (spec: `autenticacion-usuarios-web`)

`[P]`: puede ejecutarse en paralelo (archivos distintos, sin dependencias).

---

## 2. Execution Guidelines
- **Sequential Ordering:** ejecutar las fases en orden estricto; dentro de cada fase, las subtareas atómicas se completan antes de pasar a la siguiente. Una tarea solo inicia cuando todas las tareas de su campo **Depende de** están marcadas `[x]`. El orden sigue datos → reglas → interfaces e infraestructura. Ninguna tarea cumple la condición de `[P]` (todas dependen de la anterior), por lo que no se marca ninguna.
- **Test-Verified:** cada funcionalidad debe tener su prueba correspondiente antes de marcarse `[x]`. Las pruebas incluyen en su nombre el ID `[AC-WEB-NN]` del criterio que verifican (imports explícitos de `vitest`, sin globals).
- **Traceability Tags:** cada tarea referencia su origen en `requirements.md` (ej. `[REQ-1.1]`) y su componente en `design.md` (ej. `[DESIGN §5]`).
- **Rutas:** todas las rutas son relativas a la raíz del repositorio. Los archivos de raíz del monorepo creados por `autenticacion-usuarios-auth` (`package.json`, `tsconfig.base.json`, `eslint.config.js`, `.prettierrc`, `.prettierignore`, `.npmrc`, `.gitattributes`, `.dockerignore`, `lefthook.yml`, `.githooks/pre-commit`, `.gitignore`) ya existen y este spec no los toca; su único archivo de raíz tocado es `package-lock.json`. Existen también, de ese spec, `services/auth/Dockerfile` (etapa runtime) y `services/auth/docker/postgres-init/`, que la tarea 4.2 consume sin copiarlos ni modificarlos.
- **Entorno:** todo comando se ejecuta en contenedores (en el host solo `docker` y `git`). Prefijo: `docker compose -f apps/web/compose.dev.yaml`. Sin servicios auxiliares: `run --rm --no-deps dev <cmd>`; con `web`, `auth` y `postgres` (solo tareas 4.2 y 4.3): `run --rm dev <cmd>`.
- **Comando de pruebas `unit`:** `docker compose -f apps/web/compose.dev.yaml run --rm --no-deps dev npm run test:unit -w apps/web -- <ruta>`.
- **Comando de pruebas `component`:** `docker compose -f apps/web/compose.dev.yaml run --rm --no-deps dev npm run test:component -w apps/web -- <ruta>`.
- **Chequeos de calidad (`<calidad>`):** los tres comandos siguientes, todos con código de salida 0 y sin advertencias:
  - `docker compose -f apps/web/compose.dev.yaml run --rm --no-deps dev npm run typecheck -w apps/web`
  - `docker compose -f apps/web/compose.dev.yaml run --rm --no-deps dev npm run lint -w apps/web`
  - `docker compose -f apps/web/compose.dev.yaml run --rm --no-deps dev npm run format:check -w apps/web`
- **Limpieza:** `docker compose -f apps/web/compose.dev.yaml down -v`.
- **Evidencia:** una tarea con campo **Evidencia** solo se marca `[x]` cuando la evidencia descrita queda registrada (salida de comandos o aserciones de las pruebas indicadas).
- **Versiones:** exactas, sin `^` ni `~`. Si una verificación falla por versiones de dependencias, se reporta; no se cambian versiones sin escalar. Si `npm` falla con "Exit handler never called" en Alpine, aplicar la contingencia de `design.md § 2.3` (imagen `node:24.22.0-bookworm-slim` en la etapa `build`).
- **Estilo:** ESM con imports relativos sin extensión, `import type` donde aplique, textos de usuario en español, sin `console.*`, sin `dangerouslySetInnerHTML`, sin estilos ni scripts en línea.

---

## 3. Phase Breakdown & Actionable Tasks

### Phase 1: Foundation, Schemas & Core Domain
- [ ] **Task 1.1: Entorno de contenedores de desarrollo** `[REQ-9.1, REQ-9.2]` `[DESIGN §2.3, §5]`
  - **Archivos:**
    - `apps/web/compose.dev.yaml` (crear; solo el servicio `dev` y los volúmenes `node_modules_root`, `node_modules_web`, `npm_cache`)
    - `apps/web/Dockerfile` (crear; solo la etapa `dev`)
    - `apps/web/.gitignore` (crear)
  - **Depende de:** ninguna (primera tarea, antes de cualquier código de producto).
  - **Alcance:** crear el entorno 100 % Docker con el contenido exacto de `design.md § 2.3` ("Tarea 1.1" del Compose, proyecto `fluxone-web-dev`, YAML con comillas simples; etapa `dev` del Dockerfile con `node:24.22.0-alpine`, `git` y `safe.directory /app`). `.gitignore` con `node_modules/`, `dist/`, `coverage/`, `.env`, `*.log` (una por línea). No incluye `postgres`, `auth`, `web` ni las etapas `build` y nginx.
  - **Criterio de aceptación:** todos con código de salida 0, en este orden:
    - `docker compose -f apps/web/compose.dev.yaml config -q`
    - `docker compose -f apps/web/compose.dev.yaml run --rm --no-deps dev sh -c "node --version | grep -qx v24.22.0"`
    - `docker compose -f apps/web/compose.dev.yaml run --rm --no-deps dev git --version`
    - `docker compose -f apps/web/compose.dev.yaml run --rm --no-deps dev sh -c "git config --system --get-all safe.directory | grep -qx /app"`
    - `docker compose -f apps/web/compose.dev.yaml run --rm --no-deps dev sh -c "grep -qx 'node_modules/' apps/web/.gitignore && grep -qx 'dist/' apps/web/.gitignore && grep -qx 'coverage/' apps/web/.gitignore && grep -qx '.env' apps/web/.gitignore && grep -qx '*.log' apps/web/.gitignore"`
    - limpieza: `docker compose -f apps/web/compose.dev.yaml down -v`
  - **Evidencia:** salida de cada comando.

- [ ] **Task 1.2: Workspace `apps/web`, configuración e instalación reproducible** `[REQ-9.2, REQ-8.5]` `[DESIGN §1, §5]`
  - **Archivos:**
    - `apps/web/package.json`
    - `package-lock.json` (modificar: regenerado con `npm install`)
    - `apps/web/tsconfig.json`
    - `apps/web/vite.config.ts`
    - `apps/web/vitest.config.ts`
    - `apps/web/eslint.config.js`
    - `apps/web/tests/setup.ts`
  - **Depende de:** 1.1
  - **Alcance:** crear el workspace `@fluxone/web` con el contenido exacto de `design.md § 5` ("Contenido exacto de la configuración del workspace"): dependencias y scripts con versiones exactas, `tsconfig.json`, `vite.config.ts` (con `build.assetsInlineLimit: 0`), `vitest.config.ts` (proyectos `unit`, `component`, `integration`, sin `globals`), `eslint.config.js` (extiende la raíz, añade `react-hooks`, `react-refresh` y `no-console` en `src/`) y `tests/setup.ts`. Regenerar `package-lock.json` con `npm install` en el contenedor `dev`, limitado al workspace. Es la verificación de versiones: instalación reproducible y chequeos base antes de escribir código de producto.
  - **Criterio de aceptación:** todos con código de salida 0 y en este orden:
    - `docker compose -f apps/web/compose.dev.yaml run --rm --no-deps dev npm install --workspace=apps/web --include-workspace-root`
    - `docker compose -f apps/web/compose.dev.yaml run --rm --no-deps dev npm ci --workspace=apps/web --include-workspace-root`
    - `docker compose -f apps/web/compose.dev.yaml run --rm --no-deps dev node -e "const p=JSON.parse(require('node:fs').readFileSync('apps/web/package.json','utf8'));for(const d of [p.dependencies,p.devDependencies])for(const v of Object.values(d))if(/[\^~]/.test(v))process.exit(1);if(p.name!=='@fluxone/web')process.exit(1);const l=JSON.parse(require('node:fs').readFileSync('package-lock.json','utf8'));if(!l.packages['apps/web'])process.exit(1)"`
    - `<calidad>` (typecheck, lint y format:check de `apps/web`)
  - **Evidencia:** salida de cada comando. Si `npm ci` o `tsc` fallan por versiones, se reporta (no se cambian versiones sin escalar).

- [ ] **Task 1.3: Dominio puro con pruebas unitarias** `[REQ-3.1, REQ-4.4]` `[DESIGN §3.1, §4.1]`
  - **Archivos:**
    - `apps/web/src/domain/types.ts`
    - `apps/web/src/domain/validation.ts`
    - `apps/web/tests/unit/validation.test.ts`
  - **Depende de:** 1.2
  - **Alcance:** tipos `AuthUser`, `Credentials`, `SessionPayload` y `RegisterResult` (`design.md § 3.1`) y las funciones puras `validateRegistration` y `validateLogin` con las constantes, reglas, orden y mensajes exactos de `design.md § 4.1` ("Validación"). Sin React, sin `fetch`, sin importar otras capas.
  - **Criterio de aceptación:** `docker compose -f apps/web/compose.dev.yaml run --rm --no-deps dev npm run test:unit -w apps/web -- tests/unit/validation.test.ts` y luego `<calidad>`
  - **Evidencia (comportamiento crítico: límites de validación):**
    - `[AC-WEB-10]` contraseña de 11 y 129 caracteres produce error de `password`; 12 y 128 son válidas (conteo por caracteres, no bytes; sin `trim`); email vacío, sin forma `local@dominio` y de 255 caracteres producen error de `email` con el mensaje y el orden de reglas del diseño; email de 254 caracteres con forma válida es aceptado.
    - `[AC-WEB-18]` `validateLogin` con email vacío (o solo espacios) o contraseña vacía devuelve el error del campo faltante; con ambos presentes devuelve `{}` (no valida longitud ni forma).

### Phase 2: Core Logic & Application Layer
- [ ] **Task 2.1: Estado de sesión en memoria y errores del cliente** `[REQ-1.1, REQ-2.5, REQ-2.6, REQ-3.3, REQ-3.4, REQ-3.5, REQ-7.2]` `[DESIGN §3.1, §4.1, §7.2]`
  - **Archivos:**
    - `apps/web/src/session/session-store.ts`
    - `apps/web/src/api/api-error.ts`
    - `apps/web/tests/unit/session-store.test.ts`
  - **Depende de:** 1.3
  - **Alcance:** `SessionStore` (`createSessionStore({onCleared})`) con la interfaz, el estado inicial y la semántica de `design.md § 4.1` ("Estado de sesión"): la credencial es una variable local de la clausura y el snapshot nunca la contiene; `clearSession` es idempotente, acepta `loginNotice`, invoca `onCleared` y luego notifica. `ApiError`, `NETWORK_ERROR_MESSAGE`, `SERVICE_UNAVAILABLE_MESSAGE` y `errorMessage` según `design.md § 4.1` ("Errores del cliente"). Sin React; sin escribir en almacenamiento del navegador.
  - **Criterio de aceptación:** `docker compose -f apps/web/compose.dev.yaml run --rm --no-deps dev npm run test:unit -w apps/web -- tests/unit/session-store.test.ts` y luego `<calidad>`
  - **Evidencia (comportamiento crítico: credencial solo en memoria):** `[AC-WEB-01]` el snapshot no contiene la credencial en ningún estado; `getAccessToken()` devuelve `null` tras `clearSession`; `setSession` fija `authenticated`; `clearSession` es idempotente, invoca `onCleared` y fija `loginNotice` solo cuando se le pasa; el estado inicial es `{status: 'loading', user: null, loginNotice: null}`; con `localStorage`/`sessionStorage` sustituidos por dobles que fallan ante cualquier escritura, ninguna operación escribe en ellos.

- [ ] **Task 2.2: Cliente HTTP con renovación single-flight y doble de red** `[REQ-1.1, REQ-1.2, REQ-2.3, REQ-2.4, REQ-2.5, REQ-2.6, REQ-2.7, REQ-7.2]` `[DESIGN §4.1, §4.2, §8.1]`
  - **Archivos:**
    - `apps/web/src/api/http-client.ts`
    - `apps/web/tests/support/fake-auth-server.ts`
    - `apps/web/tests/unit/http-client.test.ts`
  - **Depende de:** 2.1
  - **Alcance:** `createHttpClient(session)` con `AUTH_API_BASE`, `RequestOptions`, `send` (cabeceras, `credentials: 'same-origin'`, Bearer solo si `authenticated`, `Content-Type` solo con cuerpo), el algoritmo de `request` (pasos 1 a 4) y `refreshSession` single-flight con `performRefresh`, tal como en `design.md § 4.1` ("Cliente HTTP") y los mensajes de `design.md § 4.2`. Construcción de `ApiError` según la regla de `design.md § 4.1`. `fake-auth-server.ts`: doble de `fetch` a nivel de red para las pruebas (registra las llamadas, devuelve respuestas por ruta y admite respuestas diferidas), usable con `vi.stubGlobal('fetch', ...)`. Solo las solicitudes `authenticated` renuevan; un único reintento por solicitud.
  - **Criterio de aceptación:** `docker compose -f apps/web/compose.dev.yaml run --rm --no-deps dev npm run test:unit -w apps/web -- tests/unit/http-client.test.ts` y luego `<calidad>`
  - **Evidencia (comportamiento crítico: renovación, reintento y cierre de sesión):**
    - `[AC-WEB-01]` tras una sesión iniciada vía el cliente, la credencial no aparece en ningún almacén ni URL de las llamadas registradas.
    - `[AC-WEB-02]` `Authorization: Bearer <token>` solo en solicitudes `authenticated`; ausente en register, login, refresh y logout; refresh y logout van sin `Content-Type`.
    - `[AC-WEB-05]` 401 → una renovación y un reintento con el token nuevo; el llamador recibe el resultado del reintento.
    - `[AC-WEB-06]` tres solicitudes simultáneas con 401 → una sola solicitud `POST /auth/refresh` y tres reintentos.
    - `[AC-WEB-07]` renovación con 401 `REFRESH_TOKEN_REUSED` → sesión cerrada con `loginNotice` igual al mensaje del servicio.
    - `[AC-WEB-08]` `REFRESH_TOKEN_INVALID` → sesión cerrada sin aviso; reintento que vuelve a dar 401 → a lo sumo 1 renovación y 2 solicitudes, sesión cerrada, sin más reintentos.
    - `[AC-WEB-09]` 401 `INVALID_CREDENTIALS` de `/auth/login` (y 401 de register, refresh y logout) → ninguna solicitud de renovación.
    - `[AC-WEB-26]` fallo de red → `NETWORK_ERROR_MESSAGE`; 502 con cuerpo HTML → `SERVICE_UNAVAILABLE_MESSAGE`; `{error:{code,message}}` → el `message` recibido sin traducir.

- [ ] **Task 2.3: API de identidad (registro, inicio, cierre, perfil y restauración)** `[REQ-1.2, REQ-2.1, REQ-2.2, REQ-2.7, REQ-4.1, REQ-5.1, REQ-5.2]` `[DESIGN §4.1, §4.2, §8.1]`
  - **Archivos:**
    - `apps/web/src/api/auth-api.ts`
    - `apps/web/tests/unit/auth-api.test.ts`
  - **Depende de:** 2.2
  - **Alcance:** `createAuthApi(client, session)` con `restoreSession` (memoizado, nunca rechaza), `register`, `login`, `logout` (nunca rechaza; siempre cierra la sesión local) y `getProfile`, con las operaciones, entradas (email con `trim()`), salidas y errores de la tabla de `design.md § 4.1` ("API de identidad") y los contratos de `design.md § 4.2`. Solo `getProfile` usa `authenticated: true`.
  - **Criterio de aceptación:** `docker compose -f apps/web/compose.dev.yaml run --rm --no-deps dev npm run test:unit -w apps/web -- tests/unit/auth-api.test.ts` y luego `<calidad>`
  - **Evidencia (comportamiento crítico: restauración y cierre de sesión):**
    - `[AC-WEB-03]` `restoreSession` envía una sola renovación aunque se llame dos veces y, con 200, guarda token y usuario (`authenticated`).
    - `[AC-WEB-04]` con 401 `REFRESH_TOKEN_INVALID` la sesión queda `anonymous` sin `loginNotice`; con fallo de red queda `anonymous` con `loginNotice` igual al mensaje de conexión.
    - `[AC-WEB-15]` `login` con 200 guarda `accessToken` y `user` en el `SessionStore`.
    - `[AC-WEB-19]` `logout` con 204 descarta token y usuario e invoca `onCleared`.
    - `[AC-WEB-20]` `logout` con fallo de red o 5xx no rechaza y cierra igualmente la sesión local.

### Phase 3: Presentation, Endpoints & Integration
- [ ] **Task 3.1: Composición de la aplicación, cerrojo de envío, campo de formulario y guardas** `[REQ-2.1, REQ-2.2, REQ-6.1, REQ-6.3, REQ-7.1]` `[DESIGN §4.1, §4.3]`
  - **Archivos:**
    - `apps/web/src/app/create-app-services.ts`
    - `apps/web/src/app/app-services-context.ts`
    - `apps/web/src/app/app-providers.tsx`
    - `apps/web/src/ui/use-single-submit.ts`
    - `apps/web/src/ui/components/form-field.tsx`
    - `apps/web/src/ui/components/loading-screen.tsx`
    - `apps/web/src/ui/components/require-session.tsx`
    - `apps/web/src/ui/components/public-only.tsx`
  - **Depende de:** 2.3
  - **Alcance:** `createAppServices` (`QueryClient` con `retry: false`; `SessionStore` con `onCleared: () => queryClient.clear()`; `AuthApi` sobre `HttpClient`), contexto con `useAppServices` (lanza `Error` si falta el proveedor) y `useSession` (`useSyncExternalStore`), `AppProviders` (contexto, `QueryClientProvider` y un `useEffect` que llama una vez `void services.api.restoreSession()`), `useSingleSubmit` (cerrojo síncrono con `useRef` y `pending` con `useState`, liberados en `finally`), `FormField`, `LoadingScreen` (`<p role="status">Cargando…</p>`), `RequireSession` y `PublicOnly`, con las firmas, textos y reglas de `design.md § 4.1` y `§ 4.3`. Estas piezas se verifican por comportamiento en las pruebas de componente de la tarea 3.3.
  - **Criterio de aceptación:** `<calidad>` (typecheck, lint y format:check de `apps/web`) y `docker compose -f apps/web/compose.dev.yaml run --rm --no-deps dev npm run test -w apps/web` (las pruebas existentes siguen pasando)
  - **Evidencia:** salida de cada comando.

- [ ] **Task 3.2: Páginas, rutas, punto de entrada, estilos y helper de pruebas** `[REQ-2.5, REQ-3.1, REQ-3.2, REQ-3.3, REQ-3.4, REQ-3.5, REQ-4.1, REQ-4.2, REQ-4.3, REQ-4.4, REQ-5.1, REQ-5.2, REQ-6.1, REQ-6.2, REQ-6.3, REQ-6.4, REQ-7.1, REQ-7.2, REQ-8.5]` `[DESIGN §4.3, §5, §7.2]`
  - **Archivos:**
    - `apps/web/src/ui/pages/login-page.tsx`
    - `apps/web/src/ui/pages/register-page.tsx`
    - `apps/web/src/ui/pages/home-page.tsx`
    - `apps/web/src/routes.tsx`
    - `apps/web/src/main.tsx`
    - `apps/web/src/styles.css`
    - `apps/web/index.html`
    - `apps/web/tests/support/render-app.tsx`
  - **Depende de:** 3.1
  - **Alcance:** `LoginPage`, `RegisterPage` y `HomePage` con los textos, etiquetas, roles y comportamiento de `design.md § 4.3` (formularios con `noValidate`, validación de `domain/validation`, `useSingleSubmit`, `formError` en `<p role="alert">`, `loginNotice` en `<p role="status">`, vaciado solo de la contraseña ante `INVALID_CREDENTIALS`, `Cerrar sesión` con `useQuery(['me'])`); `appRoutes` (`/`, `/login`, `/register`, `*`); `main.tsx` con `createBrowserRouter(appRoutes)` y `RouterProvider` de `react-router/dom`; `styles.css` por clases (sin recursos externos, sin `url()` a otros orígenes ni `data:`); `index.html` con el contenido exacto de `design.md § 5`; y `tests/support/render-app.tsx` (compone `createAppServices()` real, `AppProviders` y `createMemoryRouter(appRoutes, {initialEntries})` con el doble de red). Sin estilos en línea.
  - **Criterio de aceptación:** `<calidad>` y `docker compose -f apps/web/compose.dev.yaml run --rm --no-deps dev npm run build -w apps/web`
  - **Evidencia:** salida de cada comando (el build genera `apps/web/dist/index.html`).

- [ ] **Task 3.3: Pruebas de componente de los flujos de usuario** `[REQ-1.1, REQ-2.1, REQ-2.2, REQ-2.3, REQ-2.5, REQ-3.1, REQ-3.2, REQ-3.3, REQ-3.4, REQ-3.5, REQ-4.1, REQ-4.2, REQ-4.3, REQ-4.4, REQ-5.1, REQ-5.2, REQ-6.1, REQ-6.2, REQ-6.3, REQ-6.4, REQ-7.1, REQ-7.2]` `[DESIGN §8.2]`
  - **Archivos:**
    - `apps/web/tests/component/login-page.test.tsx`
    - `apps/web/tests/component/register-page.test.tsx`
    - `apps/web/tests/component/home-page.test.tsx`
    - `apps/web/tests/component/restore-session.test.tsx`
    - `apps/web/tests/component/routing.test.tsx`
  - **Depende de:** 3.2
  - **Alcance:** pruebas Vitest + Testing Library + `user-event` con jsdom, usando `render-app.tsx` y el doble de red (el servicio de identidad se simula solo aquí), con los casos de `design.md § 8.2`. Si una prueba revela un defecto en código de tareas anteriores, se corrige en el archivo de la tarea que lo creó.
  - **Criterio de aceptación:** `docker compose -f apps/web/compose.dev.yaml run --rm --no-deps dev npm run test:component -w apps/web` y luego `<calidad>`
  - **Evidencia (comportamiento crítico: sesión, formularios y rutas):**
    - `[AC-WEB-03]` mientras la renovación está pendiente solo se ve `Cargando…` (ni pantalla protegida ni inicio de sesión); recargar con cookie válida muestra `/` sin pasar por el inicio de sesión.
    - `[AC-WEB-04]` sin cookie (401 `REFRESH_TOKEN_INVALID`) se muestra el inicio de sesión sin mensajes de error.
    - `[AC-WEB-07]` 401 `REFRESH_TOKEN_REUSED` → inicio de sesión con "La sesión fue revocada por seguridad. Inicia sesión de nuevo.".
    - `[AC-WEB-10]` contraseña de 11 y 129 caracteres: error junto al campo, ninguna solicitud y lo escrito conservado; 12 y 128 sí se envían.
    - `[AC-WEB-11]` registro 201 → `/login` con "Cuenta creada. Inicia sesión." y sin sesión.
    - `[AC-WEB-12]`, `[AC-WEB-13]`, `[AC-WEB-14]` `EMAIL_TAKEN`, `VALIDATION_ERROR` y 429 mostrados, datos conservados y reenvío posible.
    - `[AC-WEB-15]` login 200 → pantalla protegida con el correo.
    - `[AC-WEB-16]` `INVALID_CREDENTIALS`: "Correo o contraseña incorrectos.", se vacía solo la contraseña y no hay renovación.
    - `[AC-WEB-17]` 429 en login: "Demasiados intentos. Intenta de nuevo en un minuto.".
    - `[AC-WEB-18]` campos vacíos: se indica el campo y no hay solicitud.
    - `[AC-WEB-01]` tras iniciar sesión, `localStorage`, `sessionStorage`, `document.cookie` y la URL no contienen credenciales.
    - `[AC-WEB-05]` perfil 401 y luego 200 → se muestra el perfil con 1 renovación y 2 solicitudes de perfil.
    - `[AC-WEB-19]`, `[AC-WEB-20]` cierre de sesión 204 y cierre fallido: ambos vacían la caché (`queryClient.getQueryCache()`) y llevan a `/login`.
    - `[AC-WEB-21]`, `[AC-WEB-22]`, `[AC-WEB-23]`, `[AC-WEB-24]` sin sesión `/` → `/login`; con sesión `/` muestra el correo de `alice@fluxone.test`; con sesión `/login` y `/register` → `/`; ruta desconocida → `/`.
    - `[AC-WEB-25]` doble clic en "Iniciar sesión", "Registrarse" y "Cerrar sesión": botón deshabilitado y una sola solicitud.
    - `[AC-WEB-26]` mensajes de red, 502 y `{error}` mostrados en formularios.

### Phase 4: Verification, Testing & Polish
- [ ] **Task 4.1: Servidor web nginx, imagen multi-stage y verificación de CSP del build** `[REQ-8.1, REQ-8.2, REQ-8.3, REQ-8.4, REQ-8.5, REQ-9.1]` `[DESIGN §2.3, §4.4, §5, §7.2]`
  - **Archivos:**
    - `apps/web/nginx/default.conf` (crear)
    - `apps/web/Dockerfile` (modificar: añadir las etapas `build` y final `nginx:1.30.6-alpine` tras la etapa `dev` de 1.1)
    - `apps/web/scripts/check-build-csp.mjs` (crear)
  - **Depende de:** 3.3
  - **Alcance:** `default.conf`, etapas del Dockerfile y `check-build-csp.mjs` con el contenido exacto de `design.md § 5` y `§ 2.3`: único `location /api/auth/` con `proxy_pass http://auth:3001/` (prefijo recortado) y `proxy_set_header` de `Host`, `X-Real-IP` y `X-Request-Id`; fallback `try_files $uri $uri/ /index.html`; las cuatro cabeceras de seguridad con `always` a nivel `server` y ningún `add_header` en los `location`; imagen final con solo los estáticos y la configuración, y `EXPOSE 80`. Ningún upstream distinto de `auth`.
  - **Criterio de aceptación:** todos con código de salida 0, en este orden:
    - `docker compose -f apps/web/compose.dev.yaml run --rm --no-deps dev sh -c "npm run build -w apps/web && npm run check:csp -w apps/web"` (muestra `build compatible con default-src self`)
    - `docker compose -f apps/web/compose.dev.yaml run --rm --no-deps dev sh -c "grep -qE '^FROM node:24.22.0-alpine AS build$' apps/web/Dockerfile && grep -qE '^FROM nginx:1.30.6-alpine$' apps/web/Dockerfile"`
    - `docker build -f apps/web/Dockerfile -t fluxone-web-check .`
    - `docker run --rm --add-host auth:127.0.0.1 fluxone-web-check nginx -t`
    - `docker run --rm --entrypoint sh fluxone-web-check -c "test -f /usr/share/nginx/html/index.html && test ! -e /app && test ! -e /usr/share/nginx/html/node_modules && nginx -v 2>&1 | grep -q 1.30.6"`
    - `docker image inspect fluxone-web-check --format '{{json .Config.ExposedPorts}}' | grep -q '80/tcp'`
    - `<calidad>`
  - **Evidencia (comportamiento crítico: CSP e imagen):** `[AC-WEB-31]` salida de `check:csp` sin hallazgos (sin `<script>` ni `<style>` en línea, sin referencias a otros orígenes ni `data:`); `[AC-WEB-32]` salida de las etapas del Dockerfile, del contenido de la imagen (sin código fuente ni `node_modules`, nginx 1.30.6) y del puerto expuesto `80/tcp`. La verificación de respuestas HTTP del servidor (AC-WEB-27 a AC-WEB-30) se ejecuta en la tarea 4.2.

- [ ] **Task 4.2: Compose de integración y pruebas contra nginx y el servicio de identidad reales** `[REQ-8.1, REQ-8.2, REQ-8.3, REQ-8.4, REQ-9.1, REQ-9.3]` `[DESIGN §2.3, §4.4, §8.2, §8.3]`
  - **Archivos:**
    - `apps/web/compose.dev.yaml` (modificar: archivo final completo de `design.md § 2.3` "Tarea 4.2", que añade `postgres`, `auth`, `web` y, en `dev`, `environment` y `depends_on`)
    - `apps/web/tests/integration/web-server.test.ts`
    - `apps/web/tests/integration/auth-flow.test.ts`
  - **Depende de:** 4.1
  - **Alcance:** Compose con los servicios `postgres` (`postgres:18.6-alpine`, `tmpfs`, `postgres-init` de solo lectura), `auth` (etapa runtime de `services/auth/Dockerfile`) y `web` (etapa final de `apps/web/Dockerfile`, `8080:80`), y `dev` con `WEB_BASE_URL: http://web` dependiendo de `web` saludable. Pruebas de integración (proyecto `integration`, archivos en secuencia) contra `WEB_BASE_URL`; si falta, lanzan `WEB_BASE_URL no definida: ejecuta las pruebas con docker compose run dev`. `web-server.test.ts` y `auth-flow.test.ts` con los casos de `design.md § 8.2` y `§ 8.3` (un solo inicio de sesión por ejecución por el límite de 5/min por IP del servicio; si se repite en menos de un minuto, esperar o ejecutar `down -v`).
  - **Criterio de aceptación:** todos con código de salida 0, en este orden:
    - `docker compose -f apps/web/compose.dev.yaml config -q`
    - `docker compose -f apps/web/compose.dev.yaml build web`
    - `docker compose -f apps/web/compose.dev.yaml run --rm dev npm run test:integration -w apps/web`
    - `docker compose -f apps/web/compose.dev.yaml logs auth | grep -Eq '"reqId":"[0-9a-f]{32}"'`
    - `docker compose -f apps/web/compose.dev.yaml run --rm --no-deps --entrypoint sh web -c "test -f /usr/share/nginx/html/index.html && test ! -e /app && test ! -e /usr/share/nginx/html/node_modules && nginx -v 2>&1 | grep -q 1.30.6"`
    - `docker image inspect fluxone-web-dev-web --format '{{json .Config.ExposedPorts}}' | grep -q '80/tcp'`
    - `<calidad>`
    - limpieza: `docker compose -f apps/web/compose.dev.yaml down -v`
  - **Evidencia (comportamiento crítico: único origen, proxy, cabeceras y flujo completo):**
    - `[AC-WEB-27]` `GET /` y un recurso de `/assets/` responden 200; `GET /login` responde 200 con el contenido de `index.html`.
    - `[AC-WEB-28]` `GET /api/auth/.well-known/jwks.json` responde 200 con `keys` del servicio; `default.conf` declara un único `proxy_pass` y los `proxy_set_header` de `Host`, `X-Real-IP` y `X-Request-Id`; el `reqId` de 32 hex aparece en los logs de `auth`.
    - `[AC-WEB-29]` el servidor responde 200 en `/` con solo `auth` y `postgres` disponibles.
    - `[AC-WEB-30]` las cuatro cabeceras de seguridad presentes en `/`, `/ruta-inexistente` y `/api/auth/health/live`.
    - `[AC-WEB-34]` registro 201 → inicio de sesión 200 con `Set-Cookie` `refresh_token` con `Path=/api/auth` y `HttpOnly` → perfil 200 con el email → renovación 200 → cierre de sesión 204, todo por el origen de nginx.

- [ ] **Task 4.3: Verificación global del spec** `[REQ-9.1, REQ-9.2, REQ-9.3]` `[DESIGN §5, §8.3]`
  - **Archivos:** ninguno (solo verificación).
  - **Depende de:** 4.2
  - **Alcance:** ejecutar la verificación completa de `apps/web` en contenedores y confirmar la cobertura de los criterios AC-WEB-01..34 y que los archivos tocados coinciden con la tabla de `design.md § 5`.
  - **Criterio de aceptación:** todos con código de salida 0, en este orden:
    - `docker compose -f apps/web/compose.dev.yaml run --rm --no-deps dev npm ci --workspace=apps/web --include-workspace-root`
    - `docker compose -f apps/web/compose.dev.yaml run --rm --no-deps dev npm run lint -w apps/web`
    - `docker compose -f apps/web/compose.dev.yaml run --rm --no-deps dev npm run format:check -w apps/web`
    - `docker compose -f apps/web/compose.dev.yaml run --rm --no-deps dev npm run typecheck -w apps/web`
    - `docker compose -f apps/web/compose.dev.yaml run --rm --no-deps dev npm run test -w apps/web`
    - `docker compose -f apps/web/compose.dev.yaml run --rm --no-deps dev npm run build -w apps/web`
    - `docker compose -f apps/web/compose.dev.yaml run --rm --no-deps dev sh -c "npm run build -w apps/web && npm run check:csp -w apps/web"`
    - `docker compose -f apps/web/compose.dev.yaml run --rm dev npm run test:integration -w apps/web`
    - `docker compose -f apps/web/compose.dev.yaml run --rm --no-deps dev sh -c 'test "$(grep -rhoE "\[AC-WEB-[0-9]{2}\]" apps/web/tests | sort -u | wc -l)" -eq 31'` (sale 0 solo si hay `31`)
    - `test "$(git status --porcelain --untracked-files=all -- apps package-lock.json | wc -l)" -eq 46` (sale 0 solo si hay `46`: los 45 archivos propios de `apps/web/` y `package-lock.json`)
    - `docker compose -f apps/web/compose.dev.yaml down -v`
  - **Evidencia (AC-WEB-33):** salida de cada comando: `npm ci`, lint, formato, tipos, pruebas y build terminan sin errores ni advertencias. El recuento `31` corresponde a las pruebas que incluyen `[AC-WEB-` (AC-WEB-01 a AC-WEB-30 y AC-WEB-34); AC-WEB-31 y AC-WEB-32 se verifican con los comandos de la tarea 4.1, y AC-WEB-33 con los comandos de esta tarea. La lista de `git status` coincide con la tabla de `design.md § 5`.

---

## 4. Cobertura de criterios EARS

| REQ | Tareas | Verificación (AC-WEB) |
|:---|:---|:---|
| REQ-1.1 | 2.1, 2.2, 3.3 | AC-WEB-01 |
| REQ-1.2 | 2.2, 2.3 | AC-WEB-02 |
| REQ-2.1 | 2.3, 3.1, 3.3 | AC-WEB-03 |
| REQ-2.2 | 2.3, 3.1, 3.3 | AC-WEB-04 |
| REQ-2.3 | 2.2, 3.3 | AC-WEB-05 |
| REQ-2.4 | 2.2 | AC-WEB-06 |
| REQ-2.5 | 2.1, 2.2, 3.2, 3.3 | AC-WEB-07 |
| REQ-2.6 | 2.1, 2.2 | AC-WEB-08 |
| REQ-2.7 | 2.2, 2.3 | AC-WEB-09 |
| REQ-3.1 | 1.3, 3.2, 3.3 | AC-WEB-10 |
| REQ-3.2 | 3.2, 3.3 | AC-WEB-11 |
| REQ-3.3 | 2.1, 3.2, 3.3 | AC-WEB-12 |
| REQ-3.4 | 2.1, 3.2, 3.3 | AC-WEB-13 |
| REQ-3.5 | 2.1, 3.2, 3.3 | AC-WEB-14 |
| REQ-4.1 | 2.3, 3.2, 3.3 | AC-WEB-15 |
| REQ-4.2 | 3.2, 3.3 | AC-WEB-16 |
| REQ-4.3 | 3.2, 3.3 | AC-WEB-17 |
| REQ-4.4 | 1.3, 3.2, 3.3 | AC-WEB-18 |
| REQ-5.1 | 2.3, 3.2, 3.3 | AC-WEB-19 |
| REQ-5.2 | 2.3, 3.2, 3.3 | AC-WEB-20 |
| REQ-6.1 | 3.1, 3.2, 3.3 | AC-WEB-21 |
| REQ-6.2 | 3.2, 3.3 | AC-WEB-22 |
| REQ-6.3 | 3.1, 3.2, 3.3 | AC-WEB-23 |
| REQ-6.4 | 3.2, 3.3 | AC-WEB-24 |
| REQ-7.1 | 3.1, 3.2, 3.3 | AC-WEB-25 |
| REQ-7.2 | 2.1, 2.2, 3.2, 3.3 | AC-WEB-26 |
| REQ-8.1 | 4.1, 4.2 | AC-WEB-27 |
| REQ-8.2 | 4.1, 4.2 | AC-WEB-28 |
| REQ-8.3 | 4.1, 4.2 | AC-WEB-29 |
| REQ-8.4 | 4.1, 4.2 | AC-WEB-30 |
| REQ-8.5 | 1.2, 3.2, 4.1 | AC-WEB-31 |
| REQ-9.1 | 1.1, 4.1, 4.2, 4.3 | AC-WEB-32 |
| REQ-9.2 | 1.1, 1.2, 4.3 | AC-WEB-33 |
| REQ-9.3 | 4.2, 4.3 | AC-WEB-34 |

---

## 5. Execution Progress Tracker
| Fase | Total Tareas | Completadas | Estado |
|:---|:---:|:---:|:---|
| **Phase 1: Foundation, Schemas & Core Domain** | 3 | 0 | `Pending` |
| **Phase 2: Core Logic & Application Layer** | 3 | 0 | `Pending` |
| **Phase 3: Presentation, Endpoints & Integration** | 3 | 0 | `Pending` |
| **Phase 4: Verification, Testing & Polish** | 3 | 0 | `Pending` |
| **Total Global** | **12** | **0** | **0%** |

---

## 6. Definition of Done (DoD) Gate
- [ ] Todas las tareas están marcadas como completadas (`[x]`).
- [ ] Todos los criterios EARS de `requirements.md` pasan las pruebas asociadas.
- [ ] Los 34 criterios AC-WEB-01..34 pasan su verificación (ver la tabla de trazabilidad de `requirements.md`).
- [ ] La estructura de archivos coincide con el mapeo de `design.md § 5`.
- [ ] Todos los tests unitarios, de componente y de integración, y los comandos de contenedor, pasan sin advertencias críticas.
- [ ] La fila del spec en el `INDEX.md` de specs (`.makia/docs/specs/apps/web/INDEX.md`) está sincronizada con el `Estado global` de `summary.md`.

---

> IMPLEMENT ejecuta este documento tarea por tarea. Cada tarea se valida con un TEST acotado a sus propios archivos (no la suite completa) antes de marcarse `[x]`. Máximo 2 iteraciones de corrección por tarea antes de cancelar y escalar (ver sub-orchestrator.md del Orquestador).
