# Autenticación de usuarios (servicio de identidad)

> Este documento es el **artefacto de aprobación del USUARIO**. Es autosuficiente: todo lo necesario para aprobar el alcance, las reglas, los objetivos y los criterios de éxito del spec está aquí.

- **Spec:** `autenticacion-usuarios-auth`
- **Feature:** `autenticacion-usuarios` — **Unidad de código:** `services/auth`

## Resumen
Servicio de identidad del portal de pagos: permite a un visitante registrarse, iniciar sesión, mantener su sesión renovándola de forma segura, cerrar sesión y consultar su perfil. Emite credenciales de corta vida que otros servicios verifican de forma autónoma con llaves públicas publicadas. Incluye tres usuarios demo, la base verificable del repositorio (calidad de código y formato automáticos), el contrato HTTP documentado, el empaquetado en contenedor y un entorno de desarrollo 100 % Docker (compilar, probar y ejecutar el servicio sin instalar nada en la máquina del desarrollador salvo Docker y Git).

## Problema
Para operar un portal de pagos cada cliente debe identificarse de forma segura: sin una identidad confiable cualquiera podría mover dinero ajeno o suplantar a otro cliente. Los demás servicios del portal necesitan confiar en quién hace cada solicitud sin guardar contraseñas ni sesiones propias. Además, el equipo necesita una base de repositorio verificable (calidad de código y formato automáticos) desde el primer servicio.

## Solución
- **En qué consiste:** Un servicio de identidad que permite registrarse, iniciar sesión, renovar la sesión, cerrar sesión y consultar el perfil propio; emite credenciales de acceso de corta vida verificables por otros servicios mediante llaves públicas publicadas; ofrece tres usuarios demo ya existentes para pruebas; e incluye la base del repositorio (herramientas de calidad y verificación previa a cada commit), su contrato HTTP documentado, su empaquetado en contenedor y un entorno de desarrollo en contenedores (Compose propio con Node 24.22.0 y PostgreSQL 18.6) donde se ejecuta todo comando de compilación, calidad y pruebas.
- **Cómo resuelve el problema:** La identidad es única por email; las contraseñas nunca son recuperables; las sesiones son revocables; la reutilización de una credencial de sesión robada se detecta y revoca la sesión completa; los servicios consumidores verifican credenciales sin guardar contraseñas ni sesiones; y el repositorio rechaza código que no cumple los estándares de calidad.

## Objetivos y criterios de éxito
- **Objetivo 1:** Un cliente se registra e inicia sesión y obtiene una credencial de acceso válida 15 minutos y una sesión renovable durante 7 días.
- **Objetivo 2:** Una credencial de sesión robada y reutilizada se detecta y se revoca toda la sesión.
- **Objetivo 3:** Ningún secreto (contraseña, token, cookie) aparece en respuestas de error ni en registros.
- **Objetivo 4:** Otros servicios verifican las credenciales de acceso sin consultar a este servicio por cada solicitud.
- **Objetivo 5:** El repositorio rechaza código que no pasa lint, formato o tipos antes de cada commit (con el hook activado, ejecutado en contenedor).
- **Objetivo 6:** Se puede compilar, probar y ejecutar el servicio con solo Docker, con su PostgreSQL 18.6 en la red de Compose.

---

## Actores de negocio y flujo de valor
- **Visitante / Cliente:** Se registra, inicia y cierra sesión y consulta su perfil; obtiene acceso seguro al portal sin que nadie pueda suplantarlo.
- **Servicios consumidores del portal:** Verifican las credenciales de acceso usando las llaves públicas publicadas; confían en la identidad de cada solicitud sin guardar contraseñas ni sesiones.
- **Desarrollador / evaluador:** Trabaja solo con Docker (sin Node ni herramientas en su máquina): instala dependencias, ejecuta las verificaciones de calidad y las pruebas dentro de contenedores, construye y levanta la imagen del servicio y prueba el portal con los usuarios demo.

---

## Delimitación del Alcance (Scope Boundaries)
- **Dentro del Alcance (In Scope - Fase Actual):**
  - Registro con email y contraseña.
  - Inicio de sesión.
  - Renovación de sesión con rotación y detección de reutilización.
  - Cierre de sesión.
  - Consulta del perfil propio.
  - Publicación de llaves públicas de verificación (JWKS).
  - Tres usuarios demo sembrados al arrancar.
  - Salud del servicio (vivo / listo).
  - Formato uniforme de errores.
  - Registros de eventos de autenticación sin secretos.
  - Límites de intentos por IP en inicio de sesión y registro.
  - Contrato HTTP documentado (OpenAPI 3.1 en `services/auth/openapi.yaml`).
  - Imagen de contenedor del servicio y su ejecución en Compose junto a PostgreSQL 18.6.
  - Base del monorepo: npm workspaces, TypeScript estricto, ESLint, Prettier, saltos de línea LF y verificación previa a cada commit con lefthook (ejecutados dentro del contenedor Node).
  - Entorno de desarrollo en contenedores (Compose propio de `services/auth`: Node 24.22.0 y PostgreSQL 18.6; sin Node ni herramientas en el host).
- **Fuera del Alcance (Out of Scope / Non-Goals):**
  - Recuperación de contraseña.
  - Verificación de email.
  - Autenticación multifactor (MFA).
  - Roles o administrador.
  - Rotación de llaves de firma.
  - Modificación o eliminación de usuarios.
  - Listado o gestión de sesiones activas.
  - Depuración o expiración automática de tokens de sesión ya vencidos.
  - Límite de intentos en endpoints distintos de inicio de sesión y registro.
  - Orquestación del portal completo con todos los servicios.
  - Pruebas que lanzan contenedores desde el código de prueba (Testcontainers).

---

## Reglas de Negocio y Políticas del Dominio
- **RN-01 Email:** Se normaliza (recorte de espacios y minúsculas), tiene máximo 254 caracteres, forma `local@dominio` y es único en el sistema.
- **RN-02 Contraseña:** Tiene entre 12 y 128 caracteres (caracteres, no bytes). Solo se conserva su huella irreversible con Argon2id; nunca se almacena ni se devuelve en claro.
- **RN-03 Credenciales inválidas:** Un email inexistente y una contraseña errónea producen la misma respuesta; no se revela cuál falló.
- **RN-04 Credencial de acceso (access token):** Firmada con EdDSA (Ed25519), vigencia de 15 minutos, emisor `urn:fluxone:auth`, audiencia `urn:fluxone:api`, sujeto igual al id del usuario e incluye el email.
- **RN-05 Credencial de sesión (refresh token):** Opaca, 256 bits aleatorios, vigencia de 7 días. Se entrega solo en una cookie `refresh_token` httpOnly, SameSite=Strict, Secure según la configuración `COOKIE_SECURE`, ruta `/api/auth` y Max-Age 604800. Solo se conserva su huella SHA-256.
- **RN-06 Rotación de un solo uso:** Renovar la sesión invalida el token usado y emite uno nuevo dentro de la misma sesión.
- **RN-07 Reutilización:** Presentar un token de sesión ya invalidado revoca toda la sesión (todos sus tokens vigentes).
- **RN-08 Cierre de sesión:** Revoca la sesión y limpia la cookie; es idempotente.
- **RN-09 Límites por IP:** Máximo 5 inicios de sesión por minuto (el 6.º recibe 429) y 10 registros por minuto (el 11.º recibe 429).
- **RN-10 Usuarios demo:** `alice@fluxone.test` (`11111111-1111-4111-8111-111111111111`), `bob@fluxone.test` (`22222222-2222-4222-8222-222222222222`) y `carol@fluxone.test` (`33333333-3333-4333-8333-333333333333`). Su contraseña proviene de la configuración `DEMO_USERS_PASSWORD`. Se crean al arrancar solo si no existen.
- **RN-11 Errores:** Todo error devuelve `{error:{code,message}}` con mensaje claro en español y sin datos sensibles.
- **RN-12 Llaves de firma:** Se generan en el primer arranque y se conservan entre reinicios; la llave privada nunca se expone.

---

## Requerimientos Funcionales y Criterios EARS

### REQ-01: Registro de cuentas
- **Historia de Usuario:**
  - **Como:** Visitante
  - **Quiero:** Registrarme con email y contraseña
  - **Para:** Poder usar el portal

#### Criterios de Aceptación y Comportamiento del Sistema (Sintaxis EARS)
- **REQ-1.1 (Ubicuo) — AC-AUT-01:**
  - `EL SISTEMA DEBE` guardar el email normalizado como identificador único y la contraseña solo como huella irreversible, y no devolverla jamás.
- **REQ-1.2 (Evento) — AC-AUT-02:**
  - `CUANDO` el visitante envía `POST /auth/register` con un email válido no registrado y una contraseña de 12 a 128 caracteres
  - `EL SISTEMA DEBE` crear la cuenta y responder 201 con `id` y el email normalizado, sin iniciar sesión.
- **REQ-1.3 (Excepción) — AC-AUT-03:**
  - `SI` el email normalizado ya está registrado `CUANDO` se intenta registrar
  - `EL SISTEMA DEBE` responder 409 con código `EMAIL_TAKEN` sin crear ni modificar nada.
- **REQ-1.4 (Excepción) — AC-AUT-04:**
  - `SI` el email es inválido, la contraseña tiene menos de 12 o más de 128 caracteres, faltan campos o sobran campos `CUANDO` se intenta registrar
  - `EL SISTEMA DEBE` responder 400 con código `VALIDATION_ERROR` sin crear la cuenta.
- **REQ-1.5 (Excepción) — AC-AUT-05:**
  - `SI` una misma IP supera 10 registros en un minuto `CUANDO` envía otro
  - `EL SISTEMA DEBE` responder 429 con código `RATE_LIMITED` sin procesarlo.

### REQ-02: Inicio de sesión
- **Historia de Usuario:**
  - **Como:** Cliente registrado
  - **Quiero:** Iniciar sesión
  - **Para:** Obtener acceso al portal

#### Criterios de Aceptación y Comportamiento del Sistema (Sintaxis EARS)
- **REQ-2.1 (Evento) — AC-AUT-06:**
  - `CUANDO` el cliente envía `POST /auth/login` con credenciales válidas
  - `EL SISTEMA DEBE` responder 200 con `accessToken`, `tokenType` "Bearer", `expiresIn` 900 y `user` (`id`, `email`), y entregar la cookie `refresh_token` según RN-05.
- **REQ-2.2 (Excepción) — AC-AUT-07:**
  - `SI` las credenciales son inválidas (email inexistente o contraseña errónea) `CUANDO` el cliente intenta iniciar sesión
  - `EL SISTEMA DEBE` responder 401 con código `INVALID_CREDENTIALS` y el mismo mensaje en ambos casos, sin entregar cookie.
- **REQ-2.3 (Excepción) — AC-AUT-08:**
  - `SI` una misma IP supera 5 inicios de sesión en un minuto `CUANDO` envía el 6.º
  - `EL SISTEMA DEBE` responder 429 con código `RATE_LIMITED`.
- **REQ-2.4 (Ubicuo) — AC-AUT-09:**
  - `EL SISTEMA DEBE` emitir cada credencial de acceso firmada con EdDSA (Ed25519), con vigencia de 15 minutos y con emisor, audiencia, sujeto y email según RN-04, verificable con las llaves públicas publicadas.
- **REQ-2.5 (Excepción) — AC-AUT-10:**
  - `SI` la solicitud de inicio de sesión no trae email y contraseña como texto, o trae campos adicionales `CUANDO` se intenta iniciar sesión
  - `EL SISTEMA DEBE` responder 400 con código `VALIDATION_ERROR`.

### REQ-03: Renovación de sesión
- **Historia de Usuario:**
  - **Como:** Cliente con sesión iniciada
  - **Quiero:** Que mi sesión se renueve sin volver a escribir mi contraseña
  - **Para:** Trabajar sin interrupciones y de forma segura

#### Criterios de Aceptación y Comportamiento del Sistema (Sintaxis EARS)
- **REQ-3.1 (Evento) — AC-AUT-11:**
  - `CUANDO` el cliente envía `POST /auth/refresh` con una cookie `refresh_token` válida, vigente y no usada
  - `EL SISTEMA DEBE` responder 200 con una nueva credencial de acceso (misma forma que en el inicio de sesión), entregar una nueva cookie y dejar inutilizable la anterior dentro de la misma sesión.
- **REQ-3.2 (Excepción) — AC-AUT-12:**
  - `SI` se presenta una cookie `refresh_token` ya invalidada (usada o revocada) `CUANDO` se solicita renovar
  - `EL SISTEMA DEBE` revocar toda la sesión, limpiar la cookie y responder 401 con código `REFRESH_TOKEN_REUSED`.
- **REQ-3.3 (Excepción) — AC-AUT-13:**
  - `SI` la cookie `refresh_token` está ausente, expirada, es desconocida o fue alterada `CUANDO` se solicita renovar
  - `EL SISTEMA DEBE` limpiar la cookie y responder 401 con código `REFRESH_TOKEN_INVALID`.
- **REQ-3.4 (Ubicuo) — AC-AUT-14:**
  - `EL SISTEMA DEBE` conservar de cada token de sesión solo su huella SHA-256 (nunca el valor entregado) y asignarle una vigencia de 7 días desde su emisión.

### REQ-04: Cierre de sesión
- **Historia de Usuario:**
  - **Como:** Cliente
  - **Quiero:** Cerrar mi sesión
  - **Para:** Que nadie pueda reutilizarla

#### Criterios de Aceptación y Comportamiento del Sistema (Sintaxis EARS)
- **REQ-4.1 (Evento) — AC-AUT-15:**
  - `CUANDO` el cliente envía `POST /auth/logout` con una cookie `refresh_token` válida
  - `EL SISTEMA DEBE` revocar la sesión, limpiar la cookie y responder 204.
- **REQ-4.2 (Evento) — AC-AUT-16:**
  - `CUANDO` el cliente envía `POST /auth/logout` sin cookie o con una cookie desconocida, alterada o ya revocada
  - `EL SISTEMA DEBE` limpiar la cookie y responder 204 (cierre idempotente).

### REQ-05: Consulta de perfil
- **Historia de Usuario:**
  - **Como:** Cliente autenticado
  - **Quiero:** Consultar mi perfil
  - **Para:** Ver con qué cuenta estoy operando

#### Criterios de Aceptación y Comportamiento del Sistema (Sintaxis EARS)
- **REQ-5.1 (Evento) — AC-AUT-17:**
  - `CUANDO` el cliente envía `GET /auth/me` con una credencial de acceso válida (`Authorization: Bearer`)
  - `EL SISTEMA DEBE` responder 200 con `id` y `email` del usuario autenticado.
- **REQ-5.2 (Excepción) — AC-AUT-18:**
  - `SI` la credencial está ausente, expirada, con firma inválida o con emisor o audiencia incorrectos `CUANDO` se consulta el perfil
  - `EL SISTEMA DEBE` responder 401 con código `UNAUTHORIZED`.

### REQ-06: Publicación de llaves de verificación
- **Historia de Usuario:**
  - **Como:** Servicio consumidor
  - **Quiero:** Verificar las credenciales de acceso de forma autónoma
  - **Para:** Confiar en la identidad de cada solicitud

#### Criterios de Aceptación y Comportamiento del Sistema (Sintaxis EARS)
- **REQ-6.1 (Evento) — AC-AUT-19:**
  - `CUANDO` se consulta `GET /.well-known/jwks.json`
  - `EL SISTEMA DEBE` responder 200 con el conjunto de llaves públicas Ed25519 vigentes (con `kid`, `alg` EdDSA y `use` sig) y nunca incluir material privado.
- **REQ-6.2 (Ubicuo) — AC-AUT-20:**
  - `EL SISTEMA DEBE` generar y persistir el par de llaves en el primer arranque y reutilizar el mismo en arranques posteriores, de modo que las credenciales emitidas antes de un reinicio sigan siendo verificables.

### REQ-07: Usuarios demo
- **Historia de Usuario:**
  - **Como:** Evaluador
  - **Quiero:** Usuarios de prueba ya existentes
  - **Para:** Probar el portal sin registrarme

#### Criterios de Aceptación y Comportamiento del Sistema (Sintaxis EARS)
- **REQ-7.1 (Evento) — AC-AUT-21:**
  - `CUANDO` el servicio arranca
  - `EL SISTEMA DEBE` crear los tres usuarios demo de RN-10 si no existen, sin duplicar ni modificar a los ya existentes en arranques repetidos, de modo que puedan iniciar sesión con la contraseña configurada.

### REQ-08: Operación del servicio
- **Historia de Usuario:**
  - **Como:** Operador
  - **Quiero:** Conocer el estado del servicio y trazar su actividad
  - **Para:** Operarlo sin exponer secretos

#### Criterios de Aceptación y Comportamiento del Sistema (Sintaxis EARS)
- **REQ-8.1 (Evento) — AC-AUT-22:**
  - `CUANDO` se consulta `GET /health/live`, `EL SISTEMA DEBE` responder 200.
  - `CUANDO` se consulta `GET /health/ready`, `EL SISTEMA DEBE` responder 200 si puede usar su DB y 503 si no.
- **REQ-8.2 (Ubicuo) — AC-AUT-23:**
  - `EL SISTEMA DEBE` responder todo error con el formato `{error:{code,message}}`, mensaje claro en español y sin datos sensibles (rutas inexistentes: 404 `NOT_FOUND`; fallos inesperados: 500 `INTERNAL_ERROR`).
- **REQ-8.3 (Ubicuo) — AC-AUT-24:**
  - `EL SISTEMA DEBE` registrar en logs JSON, con el identificador de la solicitud, los eventos `auth.login_succeeded` (con id de usuario), `auth.login_failed` (con huella SHA-256 del email normalizado, nunca el email ni la contraseña) y `auth.refresh_reuse_detected`, y nunca registrar contraseñas, tokens, cookies ni la cabecera `Authorization`.
- **REQ-8.4 (Evento) — AC-AUT-25:**
  - `CUANDO` un desarrollador construye la imagen del servicio y lo levanta en Compose junto a PostgreSQL
  - `EL SISTEMA DEBE` producir una imagen con el servicio compilado y sus migraciones, que ejecuta como usuario no administrador, y el servicio debe quedar sano (aplica las migraciones y responde `/health/ready` 200).

### REQ-09: Contrato HTTP documentado
- **Historia de Usuario:**
  - **Como:** Integrador
  - **Quiero:** Un contrato documentado del servicio
  - **Para:** Consumirlo sin leer su código

#### Criterios de Aceptación y Comportamiento del Sistema (Sintaxis EARS)
- **REQ-9.1 (Ubicuo) — AC-AUT-26:**
  - `EL SISTEMA DEBE` mantener `services/auth/openapi.yaml` (OpenAPI 3.1) describiendo todos los endpoints de REQ-01 a REQ-08 con sus respuestas de éxito y de error.

### REQ-10: Base del monorepo
- **Historia de Usuario:**
  - **Como:** Desarrollador
  - **Quiero:** Herramientas de calidad desde el primer servicio
  - **Para:** Evitar regresiones

#### Criterios de Aceptación y Comportamiento del Sistema (Sintaxis EARS)
- **REQ-10.1 (Evento) — AC-AUT-27:**
  - `CUANDO` el desarrollador, con el directorio de trabajo en `services/auth/`, ejecuta `npm ci` dentro del contenedor Node
  - `EL SISTEMA DEBE` instalar de forma reproducible las dependencias del paquete `@fluxone/auth` con Node.js 24.22.0 (imagen `node:24.22.0-alpine`), sin instalar nada en el host. `services/auth/.npmrc` contiene `ignore-scripts=true`.
- **REQ-10.2 (Evento) — AC-AUT-28:**
  - `CUANDO` el desarrollador, desde `services/auth/`, ejecuta dentro del contenedor Node `npm run lint`, `npm run typecheck` y `npm run test` (este último con la base de datos disponible)
  - `EL SISTEMA DEBE` completarlos sin errores ni advertencias.
- **REQ-10.3 (Evento) — AC-AUT-29:**
  - `CUANDO` el desarrollador crea un commit con el hook activado (`git config core.hooksPath services/auth/.githooks`, una vez por clon)
  - `EL SISTEMA DEBE` ejecutar lefthook dentro del contenedor Node y verificar, solo sobre los archivos preparados, lint, formato y tipos, y rechazar el commit si fallan. El hook de git del host es el script versionado `services/auth/.githooks/pre-commit`. Git lo ejecuta con el directorio de trabajo en la raíz del repositorio; el script entra en `services/auth/` y ejecuta `docker compose -f compose.dev.yaml run --rm -T --no-deps -w /repo dev npx lefthook run pre-commit --config services/auth/lefthook.yml --no-auto-install`. En un git worktree (donde `.git` es un archivo) el hook se omite con un aviso. Sin activar el hook no hay verificación al commit.
- **REQ-10.4 (Ubicuo) — AC-AUT-30:**
  - `EL SISTEMA DEBE` versionar todo archivo de texto con saltos de línea LF (incluidos scripts `.sh` y Dockerfiles) para que funcionen en contenedores.

### REQ-11: Entorno de desarrollo en contenedores
- **Historia de Usuario:**
  - **Como:** Desarrollador
  - **Quiero:** Compilar, probar y ejecutar el servicio solo con Docker
  - **Para:** Trabajar sin instalar nada en mi máquina

#### Criterios de Aceptación y Comportamiento del Sistema (Sintaxis EARS)
- **REQ-11.1 (Evento) — AC-AUT-31:**
  - `CUANDO` el desarrollador, con el directorio de trabajo en `services/auth/`, ejecuta cualquier comando de compilación, lint, tipos, pruebas o ejecución del servicio mediante `docker compose -f compose.dev.yaml run --rm dev ...`
  - `EL SISTEMA DEBE` ejecutarlo dentro de un contenedor Node 24.22.0 con la unidad montada en `/app`, sin requerir Node, npm ni otras herramientas en el host (solo Docker y Git). `git` sigue siendo la herramienta de control de versiones en el host; los commits son del host.
- **REQ-11.2 (Ubicuo) — AC-AUT-32:**
  - `EL SISTEMA DEBE` ofrecer a las pruebas con base de datos una PostgreSQL 18.6 alcanzable por el nombre de servicio `postgres` en el puerto interno 5432, con el rol `auth_svc` sin permiso para crear esquemas, sin puertos publicados al host y con estado efímero (sin volumen persistente).

### Entorno de Compose (referencia para REQ-8.4 y REQ-10 a REQ-11)
Archivo `services/auth/compose.dev.yaml` (proyecto Compose `fluxone-auth-dev`) con tres servicios: `postgres` (`postgres:18.6-alpine`; crea el rol `auth_svc` y el esquema `auth_schema` con un script de inicialización), `dev` (imagen basada en `node:24.22.0-alpine`; el contexto de build es `services/auth/`; monta la unidad en `/app`; ejecuta npm, lint, tipos, pruebas y lefthook; alcanza la base de datos en `postgres:5432`) y `auth` (el servicio empaquetado, con el puerto 3001 publicado para depuración y chequeo de salud). Prefijo de todo comando, con directorio de trabajo `services/auth/`: `docker compose -f compose.dev.yaml`. Los comandos sin base de datos usan `run --rm --no-deps dev <cmd>`; los que la necesitan usan `run --rm dev <cmd>` (Compose levanta `postgres` y espera su healthcheck). Limpieza: `down -v`.

---

## Edge Cases & Boundary Conditions
| ID | Escenario / Condición Límite | Comportamiento Esperado del Sistema |
|:---|:---|:---|
| **EC-01** | Dos renovaciones simultáneas con el mismo token de sesión | Solo una rota; la otra se trata como reutilización y revoca la sesión (401 `REFRESH_TOKEN_REUSED`). |
| **EC-02** | Dos registros simultáneos con el mismo email | Se crea una cuenta; el otro registro recibe 409 `EMAIL_TAKEN`. |
| **EC-03** | Email con mayúsculas o espacios en registro o inicio de sesión | Se trata como su forma normalizada. |
| **EC-04** | Renovar con el token de una sesión ya cerrada | 401 `REFRESH_TOKEN_REUSED`. |
| **EC-05** | Credencial de acceso expirada, con firma inválida o con emisor o audiencia incorrectos | 401 `UNAUTHORIZED`. |
| **EC-06** | Cookie de sesión con firma alterada | 401 `REFRESH_TOKEN_INVALID`. |
| **EC-07** | Reinicio del servicio | Las credenciales previas siguen siendo verificables, no se generan llaves nuevas y los usuarios demo no se duplican. |
| **EC-08** | DB inaccesible | `/health/ready` responde 503 y `/health/live` responde 200. |
| **EC-09** | Dos instancias arrancan a la vez sin llave activa | Queda una sola llave activa. |
| **EC-10** | Contraseña de exactamente 12 o 128 caracteres; de 11 o 129 | Las de 12 y 128 se aceptan; las de 11 y 129 reciben 400 `VALIDATION_ERROR`. |
| **EC-11** | Inicio de sesión con email inexistente | Misma respuesta que con contraseña errónea (401 `INVALID_CREDENTIALS`). |
| **EC-12** | Intentos desde IP distintas | Cada IP tiene su propio límite. |
| **EC-13** | Se ejecutan las pruebas de base de datos varias veces seguidas sobre el mismo contenedor de PostgreSQL | Las migraciones ya aplicadas no se repiten y cada prueba parte de tablas vacías. |
| **EC-14** | El hook de commit se activa dentro de un git worktree | Se omite con un aviso y no bloquea el commit. |

---

## Restricciones Operativas y de Cumplimiento (Nivel Negocio)
- **Tiempo de Respuesta Operativo (SLA de Usuario):** El registro y el inicio de sesión deben ser perceptibles como inmediatos (menos de 1 segundo en condiciones normales; el costo del cálculo de la huella de la contraseña es el límite).
- **Privacidad y Cumplimiento Normativo:** El único dato personal almacenado es el email. Las contraseñas se conservan solo como huella Argon2id. Ningún secreto aparece en registros ni en errores.
- **Continuidad de Negocio:** Un reinicio del servicio no invalida las sesiones ni las credenciales vigentes.
- **Credenciales de desarrollo:** El entorno de Compose de desarrollo usa credenciales desechables solo para desarrollo (sin puertos de base de datos publicados, sin datos persistentes); no son secretos del proyecto.

---

## Trazabilidad de criterios de aceptación
Cada prueba automatizada incluye su ID `[AC-AUT-NN]` en el nombre. Las rutas de pruebas son relativas a `services/auth/`. Los comandos se ejecutan con el directorio de trabajo en `services/auth/` y usan el prefijo `docker compose -f compose.dev.yaml`. En las celdas de la tabla el carácter `|` de un comando se escribe `\|` por sintaxis de tabla. Las pruebas de integración y aceptación (proyecto `db` de Vitest) usan la PostgreSQL 18.6 del servicio `postgres` (rol `auth_svc`; `DATABASE_URL` con host `postgres` y puerto 5432) y ejecutan sus archivos de forma secuencial porque comparten una DB.

| AC | Criterio | Verificación |
|:---|:---|:---|
| AC-AUT-01 | REQ-1.1: email normalizado único y contraseña solo como huella irreversible, nunca devuelta | `tests/acceptance/register.test.ts` |
| AC-AUT-02 | REQ-1.2: registro válido responde 201 con `id` y email normalizado | `tests/acceptance/register.test.ts` |
| AC-AUT-03 | REQ-1.3: email ya registrado responde 409 `EMAIL_TAKEN` | `tests/acceptance/register.test.ts` |
| AC-AUT-04 | REQ-1.4: datos de registro inválidos responden 400 `VALIDATION_ERROR` | `tests/acceptance/register.test.ts` |
| AC-AUT-05 | REQ-1.5: más de 10 registros por minuto desde una IP responden 429 `RATE_LIMITED` | `tests/acceptance/register.test.ts` |
| AC-AUT-06 | REQ-2.1: inicio de sesión válido responde 200 con credencial de acceso y cookie `refresh_token` | `tests/acceptance/login.test.ts` |
| AC-AUT-07 | REQ-2.2: credenciales inválidas responden 401 `INVALID_CREDENTIALS` idéntico en ambos casos, sin cookie | `tests/acceptance/login.test.ts` |
| AC-AUT-08 | REQ-2.3: el 6.º inicio de sesión por minuto desde una IP responde 429 `RATE_LIMITED` | `tests/acceptance/login.test.ts` |
| AC-AUT-09 | REQ-2.4: credencial de acceso EdDSA de 15 minutos con emisor, audiencia, sujeto y email, verificable con las llaves públicas | `tests/acceptance/login.test.ts` |
| AC-AUT-10 | REQ-2.5: solicitud de inicio de sesión malformada o con campos adicionales responde 400 `VALIDATION_ERROR` | `tests/acceptance/login.test.ts` |
| AC-AUT-11 | REQ-3.1: renovación válida responde 200, rota la cookie e inutiliza la anterior | `tests/acceptance/refresh.test.ts` |
| AC-AUT-12 | REQ-3.2: token de sesión ya invalidado revoca la sesión y responde 401 `REFRESH_TOKEN_REUSED` | `tests/acceptance/refresh.test.ts` |
| AC-AUT-13 | REQ-3.3: cookie ausente, expirada, desconocida o alterada responde 401 `REFRESH_TOKEN_INVALID` | `tests/acceptance/refresh.test.ts` |
| AC-AUT-14 | REQ-3.4: solo se conserva la huella SHA-256 del token de sesión, con vigencia de 7 días | `tests/acceptance/refresh.test.ts` |
| AC-AUT-15 | REQ-4.1: cierre de sesión con cookie válida revoca la sesión, limpia la cookie y responde 204 | `tests/acceptance/logout.test.ts` |
| AC-AUT-16 | REQ-4.2: cierre de sesión sin cookie o con cookie inválida limpia la cookie y responde 204 | `tests/acceptance/logout.test.ts` |
| AC-AUT-17 | REQ-5.1: perfil con credencial válida responde 200 con `id` y `email` | `tests/acceptance/profile.test.ts` |
| AC-AUT-18 | REQ-5.2: credencial ausente o inválida responde 401 `UNAUTHORIZED` | `tests/acceptance/profile.test.ts` |
| AC-AUT-19 | REQ-6.1: JWKS publica solo llaves públicas Ed25519 vigentes | `tests/acceptance/jwks.test.ts` |
| AC-AUT-20 | REQ-6.2: el par de llaves se genera una vez y se reutiliza tras reinicios | `tests/acceptance/jwks.test.ts` |
| AC-AUT-21 | REQ-7.1: los tres usuarios demo se crean al arrancar sin duplicarse | `tests/acceptance/seed.test.ts` |
| AC-AUT-22 | REQ-8.1: `/health/live` responde 200; `/health/ready` responde 200 o 503 según la DB | `tests/acceptance/operability.test.ts` |
| AC-AUT-23 | REQ-8.2: todo error usa `{error:{code,message}}` en español sin datos sensibles | `tests/acceptance/operability.test.ts` |
| AC-AUT-24 | REQ-8.3: eventos de autenticación en logs JSON sin secretos | `tests/acceptance/operability.test.ts` |
| AC-AUT-25 | REQ-8.4: imagen con el servicio compilado y migraciones, como usuario no administrador, y servicio sano en Compose junto a PostgreSQL | en orden: (1) `docker compose -f compose.dev.yaml build auth` (exit 0); (2) `docker compose -f compose.dev.yaml run --rm --no-deps --entrypoint sh auth -c "ls dist/main.js migrations && id -un"` (lista ambos y muestra `node`); (3) `docker compose -f compose.dev.yaml up -d --wait auth` (exit 0; el healthcheck consulta `/health/ready`); (4) `docker compose -f compose.dev.yaml run --rm --no-deps dev node -e "fetch('http://auth:3001/.well-known/jwks.json').then((r) => process.exit(r.ok ? 0 : 1))"` (exit 0; alcanza el servicio por su nombre en la red de Compose); (5) `docker compose -f compose.dev.yaml down -v` (limpieza) |
| AC-AUT-26 | REQ-9.1: `services/auth/openapi.yaml` (OpenAPI 3.1) describe todos los endpoints | `tests/acceptance/openapi.test.ts` |
| AC-AUT-27 | REQ-10.1: `npm ci` dentro del contenedor Node instala de forma reproducible con Node.js 24.22.0, sin instalar nada en el host | comando `docker compose -f compose.dev.yaml run --rm --no-deps dev npm ci` (exit 0) |
| AC-AUT-28 | REQ-10.2: lint, typecheck y tests dentro del contenedor sin errores ni advertencias | comandos `docker compose -f compose.dev.yaml run --rm --no-deps dev npm run lint`, `docker compose -f compose.dev.yaml run --rm --no-deps dev npm run typecheck` y `docker compose -f compose.dev.yaml run --rm dev npm run test` (este con base de datos) |
| AC-AUT-29 | REQ-10.3: lefthook en el contenedor verifica lint, formato y tipos sobre archivos preparados en cada commit con el hook activado | (a) `docker compose -f compose.dev.yaml run --rm --no-deps dev sh -c "git init -q /tmp/lh && cp lefthook.yml /tmp/lh/ && cd /tmp/lh && /app/node_modules/.bin/lefthook validate \| grep -q 'All good'"` (exit 0); (b) `docker compose -f compose.dev.yaml run --rm --no-deps dev node -e "const f=require('node:fs').readFileSync('.githooks/pre-commit','utf8');if(!f.includes('lefthook run pre-commit'))process.exit(1)"` (exit 0) |
| AC-AUT-30 | REQ-10.4: archivos de texto versionados con saltos de línea LF | comando `docker compose -f compose.dev.yaml run --rm --no-deps dev node -e "const fs=require('node:fs');if(!fs.readFileSync('.gitattributes','utf8').includes('Dockerfile* text eol=lf')\|\|fs.readFileSync('docker/postgres-init/01-auth-role-schema.sh','utf8').includes('\r'))process.exit(1)"` (exit 0) |
| AC-AUT-31 | REQ-11.1: los comandos corren en un contenedor Node 24.22.0 con el repositorio montado, sin herramientas en el host | comandos `docker compose -f compose.dev.yaml config -q` (exit 0) y `docker compose -f compose.dev.yaml run --rm --no-deps dev node --version` (muestra `v24.22.0`) |
| AC-AUT-32 | REQ-11.2: PostgreSQL 18.6 en `postgres:5432`, rol `auth_svc` sin permiso de crear esquemas, sin puertos publicados y efímera | `tests/integration/environment.test.ts` (afirma versión 18.6, `current_user` = `auth_svc`, que `CREATE SCHEMA` es rechazado con código 42501 y que `DATABASE_URL` apunta a host `postgres` y puerto 5432), con `docker compose -f compose.dev.yaml run --rm dev npm run test -- --project db tests/integration/environment.test.ts` |
