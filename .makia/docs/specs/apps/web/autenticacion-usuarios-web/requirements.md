# Autenticación de usuarios (aplicación web)

> Este documento es el **artefacto de aprobación del USUARIO**. Es autosuficiente: todo lo necesario para aprobar el alcance, las reglas, los objetivos y los criterios de éxito del spec está aquí.

- **Spec:** `autenticacion-usuarios-web`
- **Feature:** `autenticacion-usuarios` — **Unidad de código:** `apps/web`
- **Contrato del servicio de identidad (fuente de verdad de endpoints, códigos de error, cookie, límites y validaciones):** [requirements.md de autenticacion-usuarios-auth](../../../services/auth/autenticacion-usuarios-auth/requirements.md), [design.md § 4.2](../../../services/auth/autenticacion-usuarios-auth/design.md) y [domain-model.md del servicio de identidad](../../../services/auth/domain-model.md).

## Resumen
Aplicación web del portal de pagos, servida desde un único origen, que permite al visitante registrarse, iniciar sesión, mantener su sesión de forma silenciosa y segura, cerrar sesión y ver con qué cuenta está operando. Incluye la base de la aplicación (estructura del proyecto web, navegación y manejo de datos remotos), el servidor web que sirve la aplicación y reenvía las llamadas de identidad, y su empaquetado en una imagen de contenedor.

## Problema
El cliente necesita una interfaz para identificarse en el portal sin que sus credenciales de sesión queden expuestas en el navegador, sin interrupciones cuando su acceso de corta vida vence y con mensajes comprensibles cuando algo falla. Hoy no existe ninguna interfaz que consuma el servicio de identidad, ni una base de aplicación web sobre la cual construir el resto del portal.

## Solución
- **En qué consiste:** Una aplicación web de una sola página con pantallas de registro e inicio de sesión, cierre de sesión y una pantalla protegida mínima que muestra el correo del usuario autenticado. La credencial de acceso vive solo en la memoria de la página; la sesión se restaura y renueva de forma silenciosa usando la cookie de sesión que gestiona el navegador. Un servidor web sirve la aplicación en un único origen, reenvía `/api/auth/` al servicio de identidad y añade cabeceras de seguridad. Todo se empaqueta en una imagen de contenedor de varias etapas y se compila, verifica y ejecuta en contenedores.
- **Cómo resuelve el problema:** El usuario se identifica con formularios claros que impiden el doble envío; su credencial nunca se guarda en almacenamiento persistente del navegador; al recargar la página o vencer el acceso la sesión se restablece sin pedir contraseña; si la sesión se detecta comprometida o ya no es válida, se cierra y se lleva al usuario al inicio de sesión con una explicación; y la aplicación queda lista como base de navegación y de acceso a datos del portal.

## Objetivos y criterios de éxito
- **Objetivo 1:** Un visitante se registra, inicia sesión y ve su correo en la pantalla protegida, y puede cerrar sesión.
- **Objetivo 2:** Recargar la página o vencer la credencial de acceso (15 minutos) no obliga a escribir de nuevo la contraseña mientras la sesión (7 días) siga vigente.
- **Objetivo 3:** Ninguna credencial (acceso o sesión) se almacena en `localStorage`, `sessionStorage` ni en la URL.
- **Objetivo 4:** Una sesión revocada por reutilización o inválida lleva siempre al inicio de sesión, sin bucles de reintento.
- **Objetivo 5:** Toda respuesta de error del servicio se muestra al usuario en lenguaje claro; un doble clic produce una sola solicitud.
- **Objetivo 6:** La aplicación se compila, verifica y ejecuta solo con Docker (sin instalar nada en la máquina del desarrollador salvo Docker y Git).

---

## Actores de negocio y flujo de valor
- **Visitante / Cliente:** Se registra, inicia y cierra sesión, y confirma con qué cuenta opera; obtiene acceso seguro y continuo al portal.
- **Servicio de identidad:** Atiende las llamadas de registro, inicio, renovación, cierre de sesión y perfil que la aplicación hace a través del servidor web.
- **Desarrollador / evaluador:** Construye la imagen, ejecuta las verificaciones de calidad y prueba la aplicación solo con Docker.

---

## Delimitación del Alcance (Scope Boundaries)
- **Dentro del Alcance (In Scope - Fase Actual):**
  - Proyecto web de `apps/web`: Vite, React, enrutador y capa de datos remotos (React Query), TypeScript estricto.
  - Cliente de API con la credencial de acceso solo en memoria, renovación silenciosa al cargar y ante 401, un único refresco en vuelo y un único reintento.
  - Pantallas de registro, inicio de sesión y cierre de sesión.
  - Ruta protegida mínima que muestra el usuario autenticado (perfil obtenido del servicio de identidad).
  - Servidor web (nginx) como único origen: sirve la aplicación con fallback a `index.html`, reenvía únicamente `/api/auth/` al servicio de identidad y añade cabeceras de seguridad.
  - Imagen de contenedor de varias etapas.
  - Formularios sin doble envío y mensajes de error en lenguaje claro.
  - Verificación (lint, formato, tipos, pruebas y build) dentro de contenedores.
- **Fuera del Alcance (Out of Scope / Non-Goals):**
  - Cuentas, saldos, transferencias, historial, reversos y auditoría.
  - Recuperación de contraseña, verificación de email, MFA, roles.
  - Edición o eliminación del perfil.
  - Renovación proactiva por temporizador (la renovación ocurre al cargar y ante 401).
  - Persistencia de la sesión en almacenamiento del navegador accesible por código.
  - Orquestación del portal completo con todos los servicios.

---

## Reglas de Negocio y Políticas del Dominio
- **RN-01 Credencial de acceso solo en memoria:** El token de acceso existe únicamente en una variable en memoria de la página. Nunca se escribe en `localStorage`, `sessionStorage`, cookies legibles por código, IndexedDB ni en la URL. Recargar la página lo pierde y se recupera con la renovación silenciosa.
- **RN-02 Credencial de sesión gestionada por el navegador:** La cookie `refresh_token` es `httpOnly` y la gestiona el navegador; el código de la aplicación nunca la lee ni la escribe. Las llamadas a `/api/auth/` se hacen al mismo origen y el navegador la envía por sí mismo.
- **RN-03 Email:** En registro se valida forma `local@dominio`, máximo 254 caracteres. El servicio lo normaliza (recorte de espacios y minúsculas) y es único.
- **RN-04 Contraseña:** En registro tiene entre 12 y 128 caracteres (caracteres, no bytes). En inicio de sesión solo se exige que no esté vacía; el servicio decide si es válida.
- **RN-05 Renovación silenciosa:** Se intenta una renovación al cargar la aplicación y cuando una solicitud autenticada recibe 401. En cualquier momento hay a lo sumo una renovación en vuelo; todas las solicitudes que la necesitan esperan su resultado. Cada solicitud se reintenta como máximo una vez tras renovar.
- **RN-06 Sesión cerrada:** Se considera sesión cerrada cuando la renovación responde 401 (`REFRESH_TOKEN_INVALID` o `REFRESH_TOKEN_REUSED`) o cuando el reintento tras renovar vuelve a recibir 401. Se descarta la credencial en memoria, se vacían los datos remotos en caché y se lleva al usuario al inicio de sesión. Con `REFRESH_TOKEN_REUSED` se muestra el mensaje del servicio; con `REFRESH_TOKEN_INVALID` al cargar la aplicación no se muestra error (es un visitante sin sesión).
- **RN-07 Endpoints públicos de identidad:** Un 401 de `POST /auth/login`, `/auth/register`, `/auth/refresh` o `/auth/logout` nunca dispara una renovación (el 401 de login es `INVALID_CREDENTIALS`, no un vencimiento).
- **RN-08 Sin doble envío:** Todo botón de envío queda deshabilitado mientras su solicitud está en curso.
- **RN-09 Mensajes de error:** Se muestra el `message` en español del formato de error del servicio (`{error:{code,message}}`). Sin respuesta de red: "No se pudo conectar con el servidor. Intenta de nuevo." Respuesta que no cumple el formato (p. ej. 502 del servidor web): "El servicio no está disponible. Intenta de nuevo más tarde." Nunca se muestran tokens, trazas ni códigos internos como único mensaje.
- **RN-10 Único origen y único upstream:** El navegador solo habla con el origen que sirve la aplicación. El servidor web declara únicamente el upstream `/api/auth/` hacia el servicio de identidad (prefijo recortado: `/api/auth/auth/login` llega al servicio como `/auth/login`).
- **RN-11 Cabeceras de seguridad:** Toda respuesta del servidor web incluye `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer` y `Content-Security-Policy: default-src 'self'`. La aplicación funciona bajo esa política (sin scripts ni estilos en línea, sin recursos externos).
- **RN-12 Todo en contenedores:** Instalar, compilar, verificar y ejecutar la aplicación ocurre dentro de contenedores; en el host solo hay Docker y Git.

---

## Requerimientos Funcionales y Criterios EARS

### REQ-01: Credencial de acceso en memoria y cliente de API
- **Historia de Usuario:**
  - **Como:** Cliente
  - **Quiero:** Que mi credencial de acceso no quede guardada en el navegador
  - **Para:** Reducir el riesgo de que sea robada

#### Criterios de Aceptación y Comportamiento del Sistema (Sintaxis EARS)
- **REQ-1.1 (Ubicuo) — AC-WEB-01:**
  - `EL SISTEMA DEBE` mantener la credencial de acceso solo en memoria (RN-01) y no escribirla jamás en `localStorage`, `sessionStorage`, cookies legibles, IndexedDB ni en la URL.
  - *Given* una sesión iniciada; *When* se inspeccionan todos los almacenes del navegador; *Then* no contienen la credencial de acceso ni la de sesión.
- **REQ-1.2 (Evento) — AC-WEB-02:**
  - `CUANDO` la aplicación envía una solicitud que requiere autenticación (p. ej. `GET /api/auth/auth/me`)
  - `EL SISTEMA DEBE` incluir la cabecera `Authorization: Bearer <credencial de acceso>` y no incluirla en las solicitudes de registro, inicio de sesión, renovación y cierre de sesión.
  - *Given* una sesión con credencial en memoria; *When* se pide el perfil; *Then* la solicitud lleva la cabecera Bearer.

### REQ-02: Restauración y renovación silenciosa de la sesión
- **Historia de Usuario:**
  - **Como:** Cliente con sesión iniciada
  - **Quiero:** Que mi sesión se restablezca y renueve sin volver a escribir la contraseña
  - **Para:** Trabajar sin interrupciones

#### Criterios de Aceptación y Comportamiento del Sistema (Sintaxis EARS)
- **REQ-2.1 (Evento) — AC-WEB-03:**
  - `CUANDO` la aplicación carga
  - `EL SISTEMA DEBE` enviar una única solicitud `POST /api/auth/auth/refresh` (con la cookie gestionada por el navegador) y, si responde 200, guardar en memoria la nueva credencial de acceso y el usuario (`user.id`, `user.email`); mientras responde, mostrar un estado de carga sin mostrar ni la pantalla protegida ni el inicio de sesión.
  - *Given* una cookie de sesión válida; *When* se recarga la página en la ruta protegida; *Then* se muestra la pantalla protegida sin pasar por el inicio de sesión.
- **REQ-2.2 (Excepción) — AC-WEB-04:**
  - `SI` la renovación al cargar responde 401 `REFRESH_TOKEN_INVALID` (visitante sin sesión, cookie ausente o expirada) `CUANDO` la aplicación carga
  - `EL SISTEMA DEBE` dejar la aplicación sin sesión, sin mostrar mensaje de error, y llevar a una ruta pública (inicio de sesión) si se pidió una ruta protegida.
  - *Given* ninguna cookie de sesión; *When* se abre la ruta protegida; *Then* se muestra el inicio de sesión sin mensajes de error.
- **REQ-2.3 (Evento) — AC-WEB-05:**
  - `CUANDO` una solicitud autenticada recibe 401
  - `EL SISTEMA DEBE` renovar la sesión (RN-05) y reintentar la solicitud original exactamente una vez con la nueva credencial de acceso; si el reintento responde 2xx, entregar su resultado al llamador sin que el usuario perciba la renovación.
  - *Given* una credencial de acceso vencida; *When* se pide el perfil y el servicio responde 401 y luego 200 tras renovar; *Then* la pantalla muestra el perfil y hubo 1 renovación y 2 solicitudes de perfil.
- **REQ-2.4 (Ubicuo) — AC-WEB-06:**
  - `EL SISTEMA DEBE` mantener a lo sumo una renovación en vuelo: varias solicitudes que reciben 401 a la vez comparten esa renovación y cada una se reintenta una sola vez.
  - *Given* tres solicitudes autenticadas simultáneas que reciben 401; *When* se renueva; *Then* se envía una sola solicitud `POST /auth/refresh` y las tres se reintentan una vez.
- **REQ-2.5 (Excepción) — AC-WEB-07:**
  - `SI` la renovación responde 401 `REFRESH_TOKEN_REUSED` `CUANDO` se renueva (al cargar o ante un 401)
  - `EL SISTEMA DEBE` cerrar la sesión según RN-06 y llevar al inicio de sesión mostrando el mensaje del servicio ("La sesión fue revocada por seguridad. Inicia sesión de nuevo.").
  - *Given* una cookie de sesión ya usada; *When* la aplicación intenta renovar; *Then* se descarta la credencial en memoria y se muestra el inicio de sesión con ese mensaje.
- **REQ-2.6 (Excepción) — AC-WEB-08:**
  - `SI` la renovación responde 401 `REFRESH_TOKEN_INVALID` ante un 401 de una solicitud autenticada, o el reintento tras renovar vuelve a responder 401 `CUANDO` la aplicación opera con sesión
  - `EL SISTEMA DEBE` cerrar la sesión según RN-06, llevar al inicio de sesión y no reintentar de nuevo (sin bucles).
  - *Given* un reintento que vuelve a dar 401; *When* termina la renovación; *Then* hay a lo sumo 1 renovación y 2 solicitudes, la sesión queda cerrada y se muestra el inicio de sesión.
- **REQ-2.7 (Ubicuo) — AC-WEB-09:**
  - `EL SISTEMA DEBE` no disparar una renovación cuando el 401 proviene de `POST /auth/login`, `/auth/register`, `/auth/refresh` o `/auth/logout` (RN-07).
  - *Given* un inicio de sesión con credenciales erróneas; *When* el servicio responde 401 `INVALID_CREDENTIALS`; *Then* no se envía ninguna solicitud de renovación.

### REQ-03: Registro
- **Historia de Usuario:**
  - **Como:** Visitante
  - **Quiero:** Registrarme con email y contraseña
  - **Para:** Poder usar el portal

#### Criterios de Aceptación y Comportamiento del Sistema (Sintaxis EARS)
- **REQ-3.1 (Excepción) — AC-WEB-10:**
  - `SI` el email no tiene forma `local@dominio` o supera 254 caracteres, o la contraseña tiene menos de 12 o más de 128 caracteres `CUANDO` el visitante intenta enviar el formulario de registro (`/register`)
  - `EL SISTEMA DEBE` mostrar el motivo junto al campo, no enviar ninguna solicitud y conservar lo escrito.
  - *Given* una contraseña de 11 caracteres; *When* se envía; *Then* se muestra el error y no hay solicitud. Con 12 y con 128 caracteres sí se envía; con 129 no.
- **REQ-3.2 (Evento) — AC-WEB-11:**
  - `CUANDO` el visitante envía el registro con datos válidos y el servicio responde 201
  - `EL SISTEMA DEBE` llevarlo a `/login` con el aviso "Cuenta creada. Inicia sesión." sin iniciar sesión automáticamente ni guardar credenciales.
  - *Given* datos válidos; *When* el servicio responde 201 `{id,email}`; *Then* se muestra el inicio de sesión con el aviso y no hay sesión.
- **REQ-3.3 (Excepción) — AC-WEB-12:**
  - `SI` el servicio responde 409 `EMAIL_TAKEN` `CUANDO` se registra
  - `EL SISTEMA DEBE` mostrar "El correo ya está registrado.", conservar el email escrito y permitir corregir y reenviar.
- **REQ-3.4 (Excepción) — AC-WEB-13:**
  - `SI` el servicio responde 400 `VALIDATION_ERROR` `CUANDO` se registra
  - `EL SISTEMA DEBE` mostrar el mensaje del servicio y conservar lo escrito.
- **REQ-3.5 (Excepción) — AC-WEB-14:**
  - `SI` el servicio responde 429 `RATE_LIMITED` `CUANDO` se registra
  - `EL SISTEMA DEBE` mostrar "Demasiados intentos. Intenta de nuevo en un minuto." y permitir reintentar.

### REQ-04: Inicio de sesión
- **Historia de Usuario:**
  - **Como:** Cliente registrado
  - **Quiero:** Iniciar sesión
  - **Para:** Acceder al portal

#### Criterios de Aceptación y Comportamiento del Sistema (Sintaxis EARS)
- **REQ-4.1 (Evento) — AC-WEB-15:**
  - `CUANDO` el cliente envía `/login` con credenciales válidas y el servicio responde 200
  - `EL SISTEMA DEBE` guardar en memoria `accessToken` y `user`, dejar que el navegador conserve la cookie `refresh_token` y llevar al cliente a la ruta protegida `/`.
  - *Given* credenciales válidas; *When* el servicio responde 200; *Then* se muestra la pantalla protegida con el correo del usuario.
- **REQ-4.2 (Excepción) — AC-WEB-16:**
  - `SI` el servicio responde 401 `INVALID_CREDENTIALS` `CUANDO` se inicia sesión
  - `EL SISTEMA DEBE` mostrar "Correo o contraseña incorrectos.", vaciar solo el campo de contraseña y conservar el email.
- **REQ-4.3 (Excepción) — AC-WEB-17:**
  - `SI` el servicio responde 429 `RATE_LIMITED` `CUANDO` se inicia sesión
  - `EL SISTEMA DEBE` mostrar "Demasiados intentos. Intenta de nuevo en un minuto." y permitir reintentar.
- **REQ-4.4 (Excepción) — AC-WEB-18:**
  - `SI` el email o la contraseña están vacíos `CUANDO` el cliente intenta enviar el inicio de sesión
  - `EL SISTEMA DEBE` indicar qué campo falta y no enviar solicitud.

### REQ-05: Cierre de sesión
- **Historia de Usuario:**
  - **Como:** Cliente
  - **Quiero:** Cerrar mi sesión
  - **Para:** Que nadie más pueda usarla desde este navegador

#### Criterios de Aceptación y Comportamiento del Sistema (Sintaxis EARS)
- **REQ-5.1 (Evento) — AC-WEB-19:**
  - `CUANDO` el cliente activa "Cerrar sesión"
  - `EL SISTEMA DEBE` enviar `POST /api/auth/auth/logout`, y al responder (204) descartar la credencial y el usuario en memoria, vaciar los datos remotos en caché y llevar al inicio de sesión.
  - *Given* una sesión iniciada; *When* se cierra sesión; *Then* la pantalla protegida ya no es accesible y recargar `/` lleva al inicio de sesión.
- **REQ-5.2 (Excepción) — AC-WEB-20:**
  - `SI` la solicitud de cierre de sesión falla por red o por error del servidor `CUANDO` el cliente cierra sesión
  - `EL SISTEMA DEBE` cerrar igualmente la sesión local (memoria y caché) y llevar al inicio de sesión.

### REQ-06: Ruta protegida mínima
- **Historia de Usuario:**
  - **Como:** Cliente autenticado
  - **Quiero:** Ver con qué cuenta estoy operando
  - **Para:** Confirmar que inicié sesión con el usuario correcto

#### Criterios de Aceptación y Comportamiento del Sistema (Sintaxis EARS)
- **REQ-6.1 (Excepción) — AC-WEB-21:**
  - `SI` no hay sesión `CUANDO` se solicita la ruta protegida `/`
  - `EL SISTEMA DEBE` llevar al inicio de sesión sin mostrar contenido protegido.
- **REQ-6.2 (Evento) — AC-WEB-22:**
  - `CUANDO` hay sesión y se muestra la ruta protegida
  - `EL SISTEMA DEBE` obtener el perfil con `GET /api/auth/auth/me` y mostrar el correo del usuario autenticado junto al botón "Cerrar sesión".
  - *Given* una sesión de `alice@fluxone.test`; *When* se abre `/`; *Then* se muestra ese correo.
- **REQ-6.3 (Estado) — AC-WEB-23:**
  - `MIENTRAS` hay sesión `CUANDO` se solicita `/login` o `/register`
  - `EL SISTEMA DEBE` llevar a `/`.
- **REQ-6.4 (Evento) — AC-WEB-24:**
  - `CUANDO` se solicita una ruta de la aplicación que no existe
  - `EL SISTEMA DEBE` llevar a `/` (que a su vez aplica REQ-6.1 si no hay sesión).

### REQ-07: Formularios sin doble envío y mensajes claros
- **Historia de Usuario:**
  - **Como:** Cliente
  - **Quiero:** Formularios que no se envíen dos veces y errores que pueda entender
  - **Para:** No generar acciones duplicadas ni quedarme sin saber qué pasó

#### Criterios de Aceptación y Comportamiento del Sistema (Sintaxis EARS)
- **REQ-7.1 (Ubicuo) — AC-WEB-25:**
  - `EL SISTEMA DEBE` deshabilitar el botón de envío de registro, inicio de sesión y cierre de sesión mientras su solicitud esté en curso (RN-08) y enviar una sola solicitud por intento aunque se haga doble clic.
  - *Given* una solicitud lenta; *When* se hace doble clic en "Iniciar sesión"; *Then* el botón está deshabilitado y el servicio recibe una sola solicitud.
- **REQ-7.2 (Ubicuo) — AC-WEB-26:**
  - `EL SISTEMA DEBE` mostrar los errores según RN-09: el mensaje del servicio cuando existe, el mensaje de conexión cuando no hay respuesta y el mensaje de servicio no disponible cuando la respuesta no tiene el formato de error.
  - *Given* un fallo de red, una respuesta 502 HTML y un `{error:{code,message}}`; *When* se envía un formulario; *Then* se muestra respectivamente el mensaje de conexión, el de servicio no disponible y el `message` recibido.

### REQ-08: Servidor web, único origen y seguridad
- **Historia de Usuario:**
  - **Como:** Cliente
  - **Quiero:** Acceder a la aplicación y a la identidad desde un único origen seguro
  - **Para:** Que mi sesión viaje solo por canales controlados

#### Criterios de Aceptación y Comportamiento del Sistema (Sintaxis EARS)
- **REQ-8.1 (Evento) — AC-WEB-27:**
  - `CUANDO` el navegador solicita `/`, un recurso estático existente o cualquier ruta de la aplicación que no corresponde a un archivo (p. ej. `/login`)
  - `EL SISTEMA DEBE` responder 200 con el recurso o con `index.html` (fallback de SPA) respectivamente.
  - *Given* el contenedor en ejecución; *When* se pide `/login`; *Then* se recibe 200 con el contenido de `index.html`.
- **REQ-8.2 (Evento) — AC-WEB-28:**
  - `CUANDO` llega una solicitud a `/api/auth/<ruta>`
  - `EL SISTEMA DEBE` reenviarla al servicio de identidad como `/<ruta>` (prefijo recortado, RN-10), conservando método, cuerpo, `Authorization`, `Cookie`, código de estado y `Set-Cookie` de la respuesta, y añadir `Host`, `X-Real-IP` y `X-Request-Id`.
  - *Given* el servicio de identidad en la misma red; *When* se pide `GET /api/auth/.well-known/jwks.json`; *Then* se recibe la respuesta de `GET /.well-known/jwks.json` del servicio.
- **REQ-8.3 (Ubicuo) — AC-WEB-29:**
  - `EL SISTEMA DEBE` declarar como único upstream `/api/auth/` (RN-10), de modo que el servidor web arranca y funciona con solo el servicio de identidad disponible.
  - *Given* una red con solo el servicio de identidad; *When* arranca el contenedor web; *Then* queda activo y responde 200 en `/`.
- **REQ-8.4 (Ubicuo) — AC-WEB-30:**
  - `EL SISTEMA DEBE` incluir las cabeceras de seguridad de RN-11 en todas las respuestas del servidor web, incluidas las respuestas de error y las reenviadas al servicio de identidad.
  - *Given* una solicitud a `/`, a una ruta inexistente de la aplicación y a `/api/auth/health/live`; *When* se leen las cabeceras; *Then* las cuatro cabeceras están presentes en las tres.
- **REQ-8.5 (Ubicuo) — AC-WEB-31:**
  - `EL SISTEMA DEBE` entregar una aplicación compilada que cumple la política `default-src 'self'`: sin scripts ni estilos en línea y sin recursos de otros orígenes.
  - *Given* `index.html` y los recursos del build; *When* se inspeccionan; *Then* no contienen `<script>` ni `<style>` en línea, ni referencias a URL de otros orígenes.

### REQ-09: Empaquetado y verificación en contenedores
- **Historia de Usuario:**
  - **Como:** Desarrollador
  - **Quiero:** Construir, verificar y ejecutar la aplicación solo con Docker
  - **Para:** Trabajar sin instalar nada en mi máquina

#### Criterios de Aceptación y Comportamiento del Sistema (Sintaxis EARS)
- **REQ-9.1 (Evento) — AC-WEB-32:**
  - `CUANDO` el desarrollador construye la imagen de `apps/web`
  - `EL SISTEMA DEBE` producir una imagen de varias etapas: etapa de compilación con Node 24.22.0 y etapa final `nginx:1.30.6-alpine` que contiene solo los archivos estáticos compilados y la configuración del servidor web (sin código fuente ni `node_modules`) y expone el puerto 80.
- **REQ-9.2 (Evento) — AC-WEB-33:**
  - `CUANDO` el desarrollador ejecuta dentro del contenedor Node 24.22.0 la instalación (`npm ci`), el lint, la verificación de formato, la verificación de tipos, las pruebas y el build de `apps/web`
  - `EL SISTEMA DEBE` completarlos sin errores ni advertencias, sin instalar nada en el host (RN-12).
- **REQ-9.3 (Evento) — AC-WEB-34:**
  - `CUANDO` se levanta el contenedor web junto al servicio de identidad en la misma red de Compose
  - `EL SISTEMA DEBE` permitir completar el flujo registro → inicio de sesión → perfil → cierre de sesión contra el origen del servidor web, con la cookie `refresh_token` en la ruta `/api/auth`.

---

## Edge Cases & Boundary Conditions
| ID | Escenario / Condición Límite | Comportamiento Esperado del Sistema |
|:---|:---|:---|
| **EC-01** | Doble clic en "Iniciar sesión", "Registrarse" o "Cerrar sesión" | El botón se deshabilita en la primera pulsación; una sola solicitud efectiva (AC-WEB-25). |
| **EC-02** | Cookie de sesión ya usada (refresh reutilizado) | Sesión cerrada, mensaje del servicio y redirección al inicio de sesión (AC-WEB-07). |
| **EC-03** | Varias solicitudes reciben 401 a la vez | Una sola renovación compartida; cada solicitud se reintenta una vez (AC-WEB-06). |
| **EC-04** | El reintento tras renovar vuelve a dar 401 | Sesión cerrada, sin más reintentos (AC-WEB-08). |
| **EC-05** | Recarga de la página con sesión vigente | La renovación silenciosa restaura la sesión sin pedir contraseña (AC-WEB-03). |
| **EC-06** | Visitante sin cookie abre la ruta protegida | Inicio de sesión sin mensaje de error (AC-WEB-04). |
| **EC-07** | Contraseña de 11, 12, 128 y 129 caracteres en registro | 11 y 129 se bloquean antes de enviar; 12 y 128 se envían (AC-WEB-10). |
| **EC-08** | Dos pestañas renuevan a la vez con la misma cookie | El servicio detecta reutilización en una de ellas; esa pestaña cierra sesión con el mensaje del servicio (AC-WEB-07). |
| **EC-09** | Credenciales de inicio de sesión erróneas | 401 `INVALID_CREDENTIALS` no dispara renovación; mensaje claro (AC-WEB-09, AC-WEB-16). |
| **EC-10** | Servicio de identidad caído o red cortada | Mensaje de conexión o de servicio no disponible; el formulario conserva lo escrito y se puede reintentar (AC-WEB-26). |
| **EC-11** | Límite de intentos superado en registro o inicio de sesión (429) | Mensaje de espera de un minuto; el botón vuelve a habilitarse (AC-WEB-14, AC-WEB-17). |
| **EC-12** | Fallo del cierre de sesión en el servidor | La sesión local se cierra igualmente (AC-WEB-20). |
| **EC-13** | Ruta inexistente o enlace directo a `/login` | El servidor entrega `index.html`; la aplicación resuelve la ruta (AC-WEB-27, AC-WEB-24). |
| **EC-14** | Cliente autenticado abre `/login` o `/register` | Se le lleva a `/` (AC-WEB-23). |

---

## Restricciones Operativas y de Cumplimiento (Nivel Negocio)
- **Tiempo de Respuesta Operativo (SLA de Usuario):** La restauración de sesión al cargar y la renovación ante 401 deben ser imperceptibles salvo por un estado de carga breve; el usuario nunca debe ver parpadeo del inicio de sesión cuando su sesión es válida.
- **Privacidad y Cumplimiento Normativo:** El único dato personal que maneja la aplicación es el email. Ninguna credencial se persiste en el navegador fuera de la cookie `httpOnly` gestionada por el navegador, ni se escribe en consola ni en registros del cliente.
- **Continuidad de Negocio:** Si el servicio de identidad no está disponible, la aplicación sigue sirviéndose y explica el problema en lenguaje claro sin perder lo escrito en los formularios.
- **Plataforma:** Node.js 24.22.0, TypeScript estricto, React 19.3.1, react-router 8.4.0, @tanstack/react-query 5.104.3, Vite 8.3.4 y nginx 1.30.6-alpine; todo se compila y ejecuta en contenedores, sin instalar nada en el host (RN-12).

---

## Trazabilidad de criterios de aceptación
Cada prueba automatizada incluye su ID `[AC-WEB-NN]` en el nombre. Tipos: **Unitaria** (Vitest, lógica del cliente de API y de la sesión, sin DOM), **Componente** (Vitest + Testing Library con jsdom, con el servicio de identidad simulado a nivel de red solo en la prueba), **Integración** (contenedor nginx real con el servicio de identidad en la misma red de Compose), **Comando** (comando ejecutado dentro de contenedores con salida verificable).

| AC | Criterio | Tipo de test |
|:---|:---|:---|
| AC-WEB-01 | REQ-1.1: credencial solo en memoria, nunca en almacenes del navegador ni URL | Unitaria + Componente |
| AC-WEB-02 | REQ-1.2: Bearer en solicitudes autenticadas y no en las públicas de auth | Unitaria |
| AC-WEB-03 | REQ-2.1: refresco al cargar restaura la sesión con estado de carga | Componente |
| AC-WEB-04 | REQ-2.2: sin sesión al cargar, sin mensaje, a inicio de sesión | Componente |
| AC-WEB-05 | REQ-2.3: ante 401 se renueva y se reintenta una vez | Unitaria + Componente |
| AC-WEB-06 | REQ-2.4: un único refresco en vuelo compartido | Unitaria |
| AC-WEB-07 | REQ-2.5: `REFRESH_TOKEN_REUSED` cierra sesión con mensaje | Unitaria + Componente |
| AC-WEB-08 | REQ-2.6: renovación inválida o reintento con 401 cierra sesión sin bucle | Unitaria |
| AC-WEB-09 | REQ-2.7: 401 de endpoints públicos de auth no dispara renovación | Unitaria |
| AC-WEB-10 | REQ-3.1: validación de registro en cliente (email, contraseña 12–128) | Componente |
| AC-WEB-11 | REQ-3.2: registro 201 lleva a `/login` con aviso, sin sesión | Componente |
| AC-WEB-12 | REQ-3.3: `EMAIL_TAKEN` mostrado y datos conservados | Componente |
| AC-WEB-13 | REQ-3.4: `VALIDATION_ERROR` del servidor mostrado | Componente |
| AC-WEB-14 | REQ-3.5: 429 en registro mostrado | Componente |
| AC-WEB-15 | REQ-4.1: login 200 guarda sesión en memoria y va a `/` | Componente |
| AC-WEB-16 | REQ-4.2: `INVALID_CREDENTIALS` mostrado, contraseña vaciada | Componente |
| AC-WEB-17 | REQ-4.3: 429 en login mostrado | Componente |
| AC-WEB-18 | REQ-4.4: campos vacíos bloqueados antes de enviar | Componente |
| AC-WEB-19 | REQ-5.1: logout 204 limpia memoria y caché y va a login | Componente |
| AC-WEB-20 | REQ-5.2: logout fallido cierra sesión local igualmente | Componente |
| AC-WEB-21 | REQ-6.1: sin sesión `/` redirige a login | Componente |
| AC-WEB-22 | REQ-6.2: con sesión `/` muestra el correo del perfil | Componente |
| AC-WEB-23 | REQ-6.3: con sesión `/login` y `/register` redirigen a `/` | Componente |
| AC-WEB-24 | REQ-6.4: ruta desconocida redirige a `/` | Componente |
| AC-WEB-25 | REQ-7.1: botón deshabilitado en curso y una sola solicitud por doble clic | Componente |
| AC-WEB-26 | REQ-7.2: mensajes de error según RN-09 | Unitaria + Componente |
| AC-WEB-27 | REQ-8.1: servir estáticos y fallback a `index.html` | Integración |
| AC-WEB-28 | REQ-8.2: proxy `/api/auth/` con prefijo recortado, cookie y cabeceras | Integración |
| AC-WEB-29 | REQ-8.3: único upstream `/api/auth/`; arranca solo con auth disponible | Integración |
| AC-WEB-30 | REQ-8.4: cabeceras de seguridad en toda respuesta | Integración |
| AC-WEB-31 | REQ-8.5: build compatible con `default-src 'self'` | Comando |
| AC-WEB-32 | REQ-9.1: imagen multi-stage (Node 24.22.0 → nginx 1.30.6-alpine) solo con estáticos y configuración | Comando |
| AC-WEB-33 | REQ-9.2: `npm ci`, lint, formato, tipos, pruebas y build en contenedor sin errores ni advertencias | Comando |
| AC-WEB-34 | REQ-9.3: flujo registro → login → perfil → logout contra el origen del servidor web | Integración |
