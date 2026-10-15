# Implementation Tasks: Autenticación de usuarios (servicio auth)

## 1. Metadata & Traceability
- **Spec:** `autenticacion-usuarios-auth`
- **Requirements Ref:** `requirements.md` (spec: `autenticacion-usuarios-auth`)
- **Design Ref:** `design.md` (spec: `autenticacion-usuarios-auth`)

`[P]`: puede ejecutarse en paralelo (archivos distintos, sin dependencias).

---

## 2. Execution Guidelines
- **Sequential Ordering:** ejecutar las fases en orden estricto; dentro de cada fase, las subtareas atómicas se completan antes de pasar a la siguiente. Una tarea solo inicia cuando todas las tareas listadas en su campo **Depende de** están marcadas `[x]`.
- **Test-Verified:** cada funcionalidad debe tener su prueba correspondiente antes de marcarse `[x]`. Las pruebas incluyen en su nombre el ID `[AC-AUT-NN]` del criterio que verifican.
- **Traceability Tags:** cada tarea referencia su origen en `requirements.md` (ej. `[REQ-1.1]`) y su componente en `design.md` (ej. `[DESIGN §5]`).
- **Rutas:** todas las rutas son relativas a la raíz del repositorio.
- **Comando de prueba:** `npm run test -w services/auth -- --project <unit|db> <ruta>`.
- **Evidencia:** una tarea con campo **Evidencia** solo se marca `[x]` cuando la evidencia descrita queda registrada (salida de comandos o aserciones de las pruebas indicadas).
- **Versiones:** si una verificación falla por versiones de dependencias, se reporta; no se cambian versiones sin escalar.

---

## 3. Phase Breakdown & Actionable Tasks

### Phase 1: Foundation, Schemas & Core Domain
- [ ] **Task 1.1: Hook de pre-commit `lefthook.yml`** `[REQ-10.3]` `[DESIGN §5]`
  - **Archivos:** `lefthook.yml`
  - **Depende de:** ninguna (primera tarea, antes de cualquier código de producto).
  - **Alcance:** crear `lefthook.yml` en la raíz con el contenido exacto de `design.md § 5`.
  - **Criterio de aceptación:** `node -e "const f=require('node:fs').readFileSync('lefthook.yml','utf8');for(const k of ['parallel: true','eslint:','prettier:','typecheck:','stage_fixed: true','npm run typecheck --workspaces --if-present'])if(!f.includes(k))process.exit(1)"` termina con código 0 (la validación ejecutable `npx lefthook validate` ocurre en la Tarea 1.3).

- [ ] **Task 1.2: Tooling raíz del monorepo** `[REQ-10.1, REQ-10.2, REQ-10.4]` `[DESIGN §5]`
  - **Archivos:** `package.json`, `tsconfig.base.json`, `eslint.config.js`, `.prettierrc`, `.prettierignore`, `.gitattributes`, `.gitignore` (modificar: solo añadir el bloque `# Proyecto`), `.dockerignore`
  - **Depende de:** 1.1
  - **Alcance:** crear el tooling raíz del monorepo según `design.md § 5`.
  - **Criterio de aceptación:** `node -e "JSON.parse(require('node:fs').readFileSync('package.json','utf8'))"` termina con código 0 y `git check-attr eol -- services/auth/Dockerfile` muestra `eol: lf`.
  - **Evidencia:** salida de ambos comandos.

- [ ] **Task 1.3: Workspace `services/auth` e instalación reproducible** `[REQ-10.1, REQ-10.2, REQ-10.3]` `[DESIGN §1, §5]`
  - **Archivos:** `services/auth/package.json`, `services/auth/tsconfig.json`, `services/auth/tsconfig.build.json`, `services/auth/vitest.config.ts`, `package-lock.json` (generado con `npm install`)
  - **Depende de:** 1.2
  - **Alcance:** crear el workspace `services/auth` con las versiones exactas de `design.md § 1` y generar `package-lock.json` con `npm install`. Es la verificación de versiones: instalación reproducible y chequeos base antes de escribir código de producto.
  - **Criterio de aceptación:** todos con código de salida 0: `npm install`, luego `npm ci`, `npx tsc --noEmit -p services/auth/tsconfig.json`, `npx eslint . --max-warnings 0`, `npx prettier --check .`, `npx lefthook validate`.
  - **Evidencia:** salida de cada comando. Si `npm ci` o `tsc` fallan por versiones, se reporta (no se cambian versiones sin escalar).

- [ ] **Task 1.4: [P] Esquema de datos: migración y soporte de pruebas con DB real** `[REQ-1.1, REQ-3.4, REQ-6.2]` `[DESIGN §3.2, §8.2]`
  - **Archivos:** `services/auth/migrations/1792022400000_create-auth-tables.sql` (DDL exacto de `design.md § 3.2`), `services/auth/tests/global-setup.ts`, `services/auth/tests/support/db.ts`, `services/auth/tests/integration/migrations.test.ts`
  - **Depende de:** 1.3
  - **Alcance:** migración SQL con el DDL de `design.md § 3.2`, setup global y utilidades de DB real para las pruebas de integración y aceptación.
  - **Criterio de aceptación:** `npm run test -w services/auth -- --project db tests/integration/migrations.test.ts`
  - **Evidencia:** la prueba verifica las tablas `users`, `refresh_tokens`, `signing_keys`, el CHECK `users_email_lower_chk`, el índice único parcial `signing_keys_one_active`, las FKs y la unicidad de `token_hash`.

- [ ] **Task 1.5: [P] Dominio puro con pruebas unitarias** `[REQ-1.1, REQ-1.4, REQ-3.1, REQ-3.2, REQ-3.3, REQ-3.4]` `[DESIGN §3.1]`
  - **Archivos:** `services/auth/src/domain/errors.ts`, `services/auth/src/domain/email.ts`, `services/auth/src/domain/password-policy.ts`, `services/auth/src/domain/user.ts`, `services/auth/src/domain/refresh-token.ts`, `services/auth/src/domain/signing-key.ts`, `services/auth/tests/unit/domain/email.test.ts`, `services/auth/tests/unit/domain/password-policy.test.ts`, `services/auth/tests/unit/domain/refresh-token.test.ts`
  - **Depende de:** 1.3
  - **Alcance:** errores de dominio, normalización de email, política de contraseña, entidades `User`, `RefreshToken`, `SigningKey` y la función `decideRotation`, según `design.md § 3.1`.
  - **Criterio de aceptación:** `npm run test -w services/auth -- --project unit tests/unit/domain`
  - **Evidencia:** pruebas de límites de contraseña (12 y 128 aceptan; 11 y 129 rechazan), normalización de email y `decideRotation` con las tres salidas `ROTATE`/`REUSED`/`EXPIRED` (incluido revocado y expirado → `REUSED`).

### Phase 2: Core Logic & Application Layer
- [ ] **Task 2.1: Puertos y casos de uso con fakes** `[REQ-1.2, REQ-1.3, REQ-2.1, REQ-2.2, REQ-3.1, REQ-3.2, REQ-3.3, REQ-4.1, REQ-4.2, REQ-5.1, REQ-5.2, REQ-6.1, REQ-6.2, REQ-7.1]` `[DESIGN §4.1]`
  - **Archivos:**
    - `services/auth/src/application/ports/clock.ts`
    - `services/auth/src/application/ports/password-hasher.ts`
    - `services/auth/src/application/ports/opaque-token-generator.ts`
    - `services/auth/src/application/ports/signing-key-generator.ts`
    - `services/auth/src/application/ports/token-issuer.ts`
    - `services/auth/src/application/ports/user-repository.ts`
    - `services/auth/src/application/ports/refresh-token-repository.ts`
    - `services/auth/src/application/ports/signing-key-repository.ts`
    - `services/auth/src/application/use-cases/register-user.ts`
    - `services/auth/src/application/use-cases/login-user.ts`
    - `services/auth/src/application/use-cases/refresh-session.ts`
    - `services/auth/src/application/use-cases/logout-session.ts`
    - `services/auth/src/application/use-cases/get-profile.ts`
    - `services/auth/src/application/use-cases/get-jwks.ts`
    - `services/auth/src/application/use-cases/ensure-signing-key.ts`
    - `services/auth/src/application/use-cases/seed-demo-users.ts`
    - `services/auth/tests/support/fakes.ts`
    - `services/auth/tests/unit/application/register-user.test.ts`
    - `services/auth/tests/unit/application/login-user.test.ts`
    - `services/auth/tests/unit/application/refresh-session.test.ts`
    - `services/auth/tests/unit/application/logout-session.test.ts`
    - `services/auth/tests/unit/application/ensure-signing-key.test.ts`
    - `services/auth/tests/unit/application/seed-demo-users.test.ts`
  - **Depende de:** 1.5
  - **Alcance:** definir los puertos y los ocho casos de uso de `design.md § 4.1`, con fakes en memoria para probarlos sin infraestructura.
  - **Criterio de aceptación:** `npm run test -w services/auth -- --project unit tests/unit/application`
  - **Evidencia:** login con email inexistente invoca `verify` con `dummyPasswordHash` y lanza `InvalidCredentialsError`; refresh con salida `REUSED` lanza `RefreshTokenReusedError`; logout con token desconocido no falla.

- [ ] **Task 2.2: [P] Adaptadores de salida crypto** `[REQ-1.1, REQ-2.4, REQ-3.4, REQ-5.2, REQ-6.2]` `[DESIGN §4.1]`
  - **Archivos:**
    - `services/auth/src/adapters/outbound/crypto/argon2-password-hasher.ts`
    - `services/auth/src/adapters/outbound/crypto/jose-token-issuer.ts`
    - `services/auth/src/adapters/outbound/crypto/jose-signing-key-generator.ts`
    - `services/auth/src/adapters/outbound/crypto/node-opaque-token-generator.ts`
    - `services/auth/src/adapters/outbound/crypto/system-clock.ts`
    - `services/auth/tests/unit/adapters/argon2-password-hasher.test.ts`
    - `services/auth/tests/unit/adapters/jose-token-issuer.test.ts`
    - `services/auth/tests/unit/adapters/jose-signing-key-generator.test.ts`
    - `services/auth/tests/unit/adapters/node-opaque-token-generator.test.ts`
  - **Depende de:** 2.1
  - **Alcance:** implementar los puertos de hashing, emisión y verificación de JWT, generación de llaves, tokens opacos y reloj.
  - **Criterio de aceptación:** `npm run test -w services/auth -- --project unit tests/unit/adapters`
  - **Evidencia:** el hash comienza con `$argon2id$v=19$m=19456,t=2,p=1$`; el JWT tiene header `alg EdDSA` y `kid`, claims `iss`, `aud`, `sub`, `email`, `exp - iat = 900`; se rechazan token expirado, `iss`/`aud` incorrectos y `alg` distinto; el token opaco decodifica a 32 bytes y su hash es SHA-256 hex de 64 caracteres.

- [ ] **Task 2.3: [P] Adaptadores de salida Postgres** `[REQ-1.1, REQ-1.3, REQ-3.1, REQ-3.2, REQ-4.1, REQ-6.2, REQ-7.1]` `[DESIGN §3.2, §4.1]`
  - **Archivos:**
    - `services/auth/src/adapters/outbound/postgres/pool.ts`
    - `services/auth/src/adapters/outbound/postgres/migrate.ts`
    - `services/auth/src/adapters/outbound/postgres/pg-user-repository.ts`
    - `services/auth/src/adapters/outbound/postgres/pg-refresh-token-repository.ts`
    - `services/auth/src/adapters/outbound/postgres/pg-signing-key-repository.ts`
    - `services/auth/tests/integration/pg-user-repository.test.ts`
    - `services/auth/tests/integration/pg-refresh-token-repository.test.ts`
    - `services/auth/tests/integration/pg-signing-key-repository.test.ts`
  - **Depende de:** 2.1, 1.4
  - **Alcance:** pool de conexiones, ejecución de migraciones y repositorios Postgres de usuarios, refresh tokens y llaves de firma.
  - **Criterio de aceptación:** `npm run test -w services/auth -- --project db tests/integration`
  - **Evidencia:** `rotate` concurrente con `Promise.all` sobre el mismo token produce exactamente un `ROTATED` y un `REUSED` y deja revocada toda la familia; `insertIfNoActive` concurrente deja una sola llave activa; `insert` de email duplicado lanza `EmailAlreadyRegisteredError`.

### Phase 3: Presentation, Endpoints & Integration
- [ ] **Task 3.1: Configuración, raíz de composición y base HTTP con JWKS y health** `[REQ-6.1, REQ-6.2, REQ-7.1, REQ-8.1, REQ-8.2]` `[DESIGN §4.2, §4.3]`
  - **Archivos:**
    - `services/auth/src/config.ts`
    - `services/auth/src/compose.ts`
    - `services/auth/src/main.ts`
    - `services/auth/src/adapters/inbound/http/app.ts`
    - `services/auth/src/adapters/inbound/http/error-handler.ts`
    - `services/auth/src/adapters/inbound/http/schemas.ts`
    - `services/auth/src/adapters/inbound/http/rate-limit.ts`
    - `services/auth/src/adapters/inbound/http/refresh-cookie.ts`
    - `services/auth/src/adapters/inbound/http/routes/jwks-routes.ts`
    - `services/auth/src/adapters/inbound/http/routes/health-routes.ts`
    - `services/auth/tests/support/build-test-app.ts`
    - `services/auth/tests/acceptance/jwks.test.ts`
  - **Depende de:** 2.2, 2.3
  - **Alcance:** carga y validación de configuración, composición de dependencias, arranque (migraciones, llave de firma activa y usuarios demo), aplicación HTTP base con manejo de errores, rate limiting, cookie de refresh y rutas JWKS y health. La verificación de la semilla (AC-AUT-21) se hace en la Tarea 3.2, cuando existe la ruta de inicio de sesión.
  - **Criterio de aceptación:** `npm run test -w services/auth -- --project db tests/acceptance/jwks.test.ts` y `npm run typecheck -w services/auth`.
  - **Evidencia (comportamiento crítico):**
    - `[AC-AUT-20]` compone la app dos veces sobre la misma DB y verifica mismo `kid` y que un token emitido antes del segundo arranque verifica contra el JWKS del segundo.

- [ ] **Task 3.2: Registro e inicio de sesión** `[REQ-1.1, REQ-1.2, REQ-1.3, REQ-1.4, REQ-1.5, REQ-2.1, REQ-2.2, REQ-2.3, REQ-2.4, REQ-2.5, REQ-7.1, REQ-8.3]` `[DESIGN §4.2, §7.2]`
  - **Archivos:** `services/auth/src/adapters/inbound/http/routes/auth-routes.ts` (rutas `POST /auth/register` y `POST /auth/login`), `services/auth/src/adapters/inbound/http/app.ts` (modificar para registrarlas), `services/auth/tests/acceptance/register.test.ts`, `services/auth/tests/acceptance/login.test.ts`, `services/auth/tests/acceptance/seed.test.ts`
  - **Depende de:** 3.1
  - **Alcance:** exponer `POST /auth/register` y `POST /auth/login` con validación, límites de tasa por IP y cookie de refresh, y verificar la semilla de usuarios demo.
  - **Criterio de aceptación:** `npm run test -w services/auth -- --project db tests/acceptance/register.test.ts tests/acceptance/login.test.ts tests/acceptance/seed.test.ts`
  - **Evidencia (seguridad/límites):**
    - `[AC-AUT-05]` el 11.º registro por IP recibe 429.
    - `[AC-AUT-08]` el 6.º login por IP recibe 429 e IP distintas tienen límites independientes.
    - `[AC-AUT-06]` la cookie incluye `HttpOnly`, `SameSite=Strict`, `Path=/api/auth`, `Max-Age=604800`.
    - `[AC-AUT-07]` 401 sin cookie y mismo mensaje para email inexistente y contraseña errónea.
    - `[AC-AUT-09]` el token verifica con el JWKS publicado.
    - `[AC-AUT-21]` arrancar la app dos veces sobre la misma DB deja exactamente 3 usuarios demo con los ids fijos (sin duplicar ni modificar a los existentes) y alice, bob y carol inician sesión con `DEMO_USERS_PASSWORD`.

- [ ] **Task 3.3: Renovación, cierre de sesión y perfil** `[REQ-3.1, REQ-3.2, REQ-3.3, REQ-3.4, REQ-4.1, REQ-4.2, REQ-5.1, REQ-5.2, REQ-8.3]` `[DESIGN §4.1, §4.2]`
  - **Archivos:** `services/auth/src/adapters/inbound/http/routes/auth-routes.ts` (modificar: rutas `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`), `services/auth/tests/acceptance/refresh.test.ts`, `services/auth/tests/acceptance/logout.test.ts`, `services/auth/tests/acceptance/profile.test.ts`
  - **Depende de:** 3.2
  - **Alcance:** exponer `POST /auth/refresh` (rotación con detección de reutilización), `POST /auth/logout` y `GET /auth/me` (verificación del token de acceso).
  - **Criterio de aceptación:** `npm run test -w services/auth -- --project db tests/acceptance/refresh.test.ts tests/acceptance/logout.test.ts tests/acceptance/profile.test.ts`
  - **Evidencia (seguridad/expiración):**
    - `[AC-AUT-12]` la reutilización revoca toda la familia (el token sucesor deja de servir) y responde 401 `REFRESH_TOKEN_REUSED`.
    - `[AC-AUT-11]` dos renovaciones simultáneas con el mismo token: una 200 y otra 401 `REFRESH_TOKEN_REUSED`.
    - `[AC-AUT-13]` cookie con firma alterada, expirada (fila con `expires_at` pasado) y ausente → 401 `REFRESH_TOKEN_INVALID`.
    - `[AC-AUT-14]` la DB guarda solo SHA-256 (el valor de la cookie no aparece en `refresh_tokens`) y `expires_at` = emisión + 7 días.
    - `[AC-AUT-18]` token expirado, firma inválida, `iss` y `aud` incorrectos → 401 `UNAUTHORIZED`.

- [ ] **Task 3.4: Operación: health, formato de errores y logs sin secretos** `[REQ-8.1, REQ-8.2, REQ-8.3]` `[DESIGN §4.2, §7.1]`
  - **Archivos:** `services/auth/tests/acceptance/operability.test.ts`; ajustes a los archivos de producción de 3.1–3.3 que la prueba requiera para pasar.
  - **Depende de:** 3.3
  - **Alcance:** verificar de extremo a extremo health, formato uniforme de errores y contenido de los logs.
  - **Criterio de aceptación:** `npm run test -w services/auth -- --project db tests/acceptance/operability.test.ts`
  - **Evidencia:**
    - `[AC-AUT-22]` `/health/ready` devuelve 503 con el pool cerrado y `/health/live` 200.
    - `[AC-AUT-23]` ruta inexistente 404 `NOT_FOUND` y error inesperado 500 `INTERNAL_ERROR` con cuerpo genérico.
    - `[AC-AUT-24]` los logs capturados contienen `auth.login_succeeded`, `auth.login_failed` (con hash SHA-256 del email) y `auth.refresh_reuse_detected`, y NO contienen la contraseña, el token de acceso, el valor de la cookie ni el email en el evento de login fallido.

### Phase 4: Verification, Testing & Polish
- [ ] **Task 4.1: [P] Contrato OpenAPI 3.1** `[REQ-9.1]` `[DESIGN §4.2, §8.3]`
  - **Archivos:** `services/auth/openapi.yaml`, `services/auth/tests/acceptance/openapi.test.ts`
  - **Depende de:** 3.3
  - **Alcance:** documentar el contrato HTTP del servicio en OpenAPI 3.1 y verificarlo con una prueba.
  - **Criterio de aceptación:** `npm run test -w services/auth -- --project db tests/acceptance/openapi.test.ts`
  - **Evidencia:** `[AC-AUT-26]` el archivo declara `openapi: 3.1.x` y describe cada ruta y método de `design.md § 4.2` con sus respuestas de éxito y error, el esquema de error `{error:{code,message}}`, la cookie `refresh_token` y el esquema bearer.

- [ ] **Task 4.2: [P] Imagen de contenedor del servicio** `[REQ-8.4]` `[DESIGN §5]`
  - **Archivos:** `services/auth/Dockerfile` (según `design.md § 5`; el `.dockerignore` raíz ya existe desde 1.2)
  - **Depende de:** 3.4
  - **Alcance:** Dockerfile del servicio según `design.md § 5`.
  - **Criterio de aceptación:** `docker build -f services/auth/Dockerfile -t fluxone-auth:local .` termina con código 0 y `docker run --rm --entrypoint sh fluxone-auth:local -c "ls services/auth/dist/main.js services/auth/migrations && id -un"` lista ambos y muestra `node`.
  - **Evidencia:** salida de ambos comandos.

- [ ] **Task 4.3: Verificación global del spec** `[REQ-10.1, REQ-10.2, REQ-10.3, REQ-10.4]` `[DESIGN §5, §8.3]`
  - **Archivos:** ninguno nuevo.
  - **Depende de:** 4.1, 4.2
  - **Alcance:** ejecutar la verificación completa del monorepo y confirmar la cobertura de los criterios de aceptación.
  - **Criterio de aceptación:** todos con código de salida 0: `npm ci`, `npm run lint`, `npm run format:check`, `npm run typecheck --workspaces --if-present`, `npm run test --workspaces --if-present`, `npx lefthook validate`, `git check-attr eol -- services/auth/Dockerfile` (muestra `eol: lf`).
  - **Evidencia:** salida de cada comando y recuento de pruebas que incluyen `[AC-AUT-` (deben aparecer los AC-AUT-01 a AC-AUT-24 y AC-AUT-26).

---

## 4. Execution Progress Tracker
| Fase | Total Tareas | Completadas | Estado |
|:---|:---:|:---:|:---|
| **Phase 1: Foundation & Domain** | 5 | 0 | `Pending` |
| **Phase 2: Core Logic & Application** | 3 | 0 | `Pending` |
| **Phase 3: Presentation & Endpoints** | 4 | 0 | `Pending` |
| **Phase 4: Verification & Polish** | 3 | 0 | `Pending` |
| **Total Global** | **15** | **0** | **0%** |

---

## 5. Definition of Done (DoD) Gate
- [ ] Todas las tareas están marcadas como completadas (`[x]`).
- [ ] Todos los criterios EARS de `requirements.md` pasan las pruebas asociadas.
- [ ] Los 30 criterios AC-AUT-01..30 pasan su verificación (ver la tabla de trazabilidad de `requirements.md`).
- [ ] La estructura de archivos coincide con el mapeo de `design.md`.
- [ ] Todos los tests unitarios, de integración y E2E pasan sin advertencias críticas.
- [ ] La fila del spec en `.makia/docs/specs/services/auth/INDEX.md` está sincronizada con el `Estado global` de `summary.md`.

---

> IMPLEMENT ejecuta este documento tarea por tarea. Cada tarea se valida con un TEST acotado a sus propios archivos (no la suite completa) antes de marcarse `[x]`. Máximo 2 iteraciones de corrección por tarea antes de cancelar y escalar (ver sub-orchestrator.md del Orquestador).
