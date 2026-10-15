# Transferencias internas (aplicación web)

> Este documento es el **artefacto de aprobación del USUARIO**. Es autosuficiente: todo lo necesario para aprobar el alcance, las reglas, los objetivos y los criterios de éxito del spec está aquí.

- **Spec:** `transferencias-internas-web`
- **Feature:** `transferencias-internas` — **Unidad de código:** `apps/web`
- **Contratos de los que depende (fuente de verdad de endpoints, códigos de error, montos e idempotencia):** [requirements.md de transferencias-internas-payments](../../../services/payments/transferencias-internas-payments/requirements.md), [design.md § 4](../../../services/payments/transferencias-internas-payments/design.md) y [domain-model.md de Pagos](../../../services/payments/domain-model.md).
- **Aplicación base que se amplía (sesión, renovación de token, cliente de API, servidor web):** [requirements.md de autenticacion-usuarios-web](../autenticacion-usuarios-web/requirements.md).

## Resumen
Amplía la aplicación web del portal para que el cliente autenticado vea sus cuentas y saldos, transfiera dinero en COP a otra cuenta del sistema sin riesgo de enviarlo dos veces, vea con claridad el resultado de cada transferencia y consulte su historial de transferencias enviadas y recibidas. Incluye que el servidor web reenvíe las llamadas de Pagos bajo `/api/payments/`, manteniendo intacto el comportamiento de autenticación existente.

## Problema
El cliente que ya puede iniciar sesión en el portal no tiene ninguna forma de ver cuánto dinero tiene, de moverlo ni de revisar lo que movió. Además, una pantalla de transferencia ingenua puede enviar dos veces el mismo pedido (doble clic, reintento tras un corte de red) y el cliente perdería dinero o confianza; y si no entiende por qué una transferencia falló (saldo insuficiente, cuenta inexistente, sesión vencida), no sabe qué hacer.

## Solución
- **En qué consiste:** Nuevas pantallas protegidas en la aplicación web: listado de cuentas con saldo, formulario de transferencia interna, pantalla de resultado de una transferencia e historial paginado de transferencias. Cada intento de transferir lleva una clave de idempotencia propia que se conserva al reintentar, el botón de envío se bloquea mientras se procesa, y todo rechazo se explica en lenguaje claro. El servidor web de la aplicación reenvía `/api/payments/` al servicio de Pagos, además de `/api/auth/` al servicio de identidad.
- **Cómo resuelve el problema:** El cliente ve sus saldos al entrar; transfiere con validación previa y confirmación del resultado (COMPLETED o FAILED por fondos insuficientes); un doble clic o un reintento tras un fallo de red no mueve el dinero dos veces; cada error del servicio se traduce en un mensaje comprensible; y el historial permite verificar cada movimiento. Cada usuario ve solo lo suyo porque la aplicación consulta siempre con su propia credencial.

## Objetivos y criterios de éxito
- **Objetivo 1:** El cliente autenticado ve la lista de sus cuentas con su saldo actual al entrar, con estados claros de carga, vacío y error.
- **Objetivo 2:** El cliente transfiere un monto válido desde una cuenta propia a otra cuenta del sistema y ve el resultado (COMPLETED o FAILED por fondos insuficientes) y los saldos actualizados.
- **Objetivo 3:** Ninguna combinación de doble clic, reintento manual o fallo de red produce más de un movimiento por intención del cliente (una sola clave de idempotencia por intención, reutilizada al reintentar).
- **Objetivo 4:** Todo rechazo (monto inválido, misma cuenta, cuenta destino inexistente, cuenta origen no válida, clave en curso, sesión vencida, red caída) se muestra con un mensaje en español claro y deja el formulario listo para corregir y reintentar.
- **Objetivo 5:** El historial lista las transferencias enviadas y recibidas del usuario, de la más reciente a la más antigua, con carga progresiva, sin mostrar nunca datos de terceros.
- **Objetivo 6:** El servidor web reenvía `/api/payments/` a Pagos y la autenticación existente (renovación de token ante 401, cierre de sesión, cabeceras de seguridad) sigue funcionando sin cambios.
- **Objetivo 7:** Todas las pantallas nuevas son operables con teclado, tienen etiquetas y anuncian estados y errores a tecnologías de asistencia.

---

## Actores de negocio y flujo de valor
- **Cliente autenticado (origen):** Consulta sus cuentas y saldos, transfiere dinero a otra cuenta del sistema y revisa el resultado y el historial. Valor: mover dinero con certeza del resultado.
- **Cliente autenticado (destino):** Ve en su historial las transferencias que recibió. Valor: confirmar lo recibido.
- **Servicio de Pagos:** Atiende las llamadas de cuentas, saldos, creación, consulta e historial de transferencias que la aplicación hace a través del servidor web.
- **Servicio de identidad:** Sigue atendiendo registro, inicio, renovación y cierre de sesión (sin cambios).
- **Desarrollador / evaluador:** Construye, verifica y ejecuta la aplicación solo con Docker.

---

## Delimitación del Alcance (Scope Boundaries)
- **Dentro del Alcance (In Scope - Fase Actual):**
  - Pantalla de cuentas con saldo de cada cuenta del usuario.
  - Formulario de transferencia interna (cuenta origen propia, cuenta destino, monto) con validación previa en el cliente.
  - Clave de idempotencia por intención de transferencia, conservada al reintentar y renovada al cambiar los datos o al concluir con efecto.
  - Bloqueo del envío mientras la solicitud está en curso (sin doble envío).
  - Pantalla de resultado de una transferencia (COMPLETED o FAILED por fondos insuficientes), consultable por su identificador.
  - Historial paginado por cursor de transferencias enviadas y recibidas.
  - Mensajes en español para cada error del contrato de Pagos, la sesión vencida y los fallos de red.
  - Estados de carga, vacío y error en cada pantalla; accesibilidad básica.
  - Reenvío de `/api/payments/` a Pagos en el servidor web, conservando el comportamiento de `/api/auth/` y las cabeceras de seguridad.
  - Verificación (lint, formato, tipos, pruebas y build) dentro de contenedores.
- **Fuera del Alcance (Out of Scope / Non-Goals):**
  - Alta, edición y baja de cuentas; un usuario sin cuentas no puede transferir.
  - Monedas distintas de COP y conversión de moneda.
  - Edición, cancelación o eliminación de transferencias ya creadas.
  - Actualización automática o en tiempo real de las pantallas (los datos se obtienen al abrir cada pantalla y tras una transferencia).
  - Búsqueda, filtros, ordenamiento alterno y exportación del historial.
  - Cambios en el servicio de Pagos o en el servicio de identidad.

---

## Reglas de Negocio y Políticas del Dominio
- **RN-01 Rutas protegidas:** Todas las pantallas de este spec exigen sesión; sin sesión se aplica el comportamiento existente (ir al inicio de sesión). Las rutas son: `/` (cuentas y saldos, conserva el correo del usuario y el botón "Cerrar sesión"), `/transfers/new` (nueva transferencia), `/transfers/:id` (resultado de una transferencia) y `/transfers` (historial). Una ruta desconocida lleva a `/`.
- **RN-02 Origen de los datos:** La aplicación obtiene cuentas, saldos, transferencias e historial exclusivamente del servicio de Pagos, con la credencial de acceso del usuario en la cabecera `Authorization: Bearer`. Nunca calcula ni conserva saldos por su cuenta: tras una transferencia vuelve a pedir cuentas e historial.
- **RN-03 Montos:** El monto es COP, un texto decimal que cumple `^(0|[1-9][0-9]{0,15})(\.[0-9]{1,2})?$`, estrictamente mayor que 0 y como máximo 9999999999999999.99. Se envía al servicio como string (nunca como número) y no se opera con coma flotante. Todo monto y saldo recibido es un string con 2 decimales y se muestra en COP con separadores de miles locales (es-CO) sin alterar su valor.
- **RN-04 Cuentas de la transferencia:** El origen se elige entre las cuentas del propio usuario. El destino es el identificador de una cuenta del sistema (texto de 1 a 64 caracteres, tras recortar espacios) y puede ser de otro usuario o una cuenta propia distinta del origen. Origen y destino deben ser distintos.
- **RN-05 Resultado de la transferencia:** Una transferencia creada queda COMPLETED (el dinero se movió) o FAILED con motivo `INSUFFICIENT_FUNDS` (no se movió nada). FAILED por fondos insuficientes es un resultado de negocio recibido con 201, no un error de solicitud, y se presenta como "no realizada" con su motivo.
- **RN-06 Clave de idempotencia:** Cada intención de transferencia usa una clave `Idempotency-Key` de 1 a 255 caracteres ASCII imprimibles (se genera un UUID v4). La clave se reutiliza al reintentar el mismo envío tras un fallo de red, un error de servidor (5xx) o `IDEMPOTENCY_KEY_IN_PROGRESS`. Se genera una clave nueva cuando el usuario modifica cualquier campo del formulario, y tras una transferencia que produjo efecto (201). Una respuesta repetida (`Idempotent-Replayed: true`) se trata como éxito y nunca se muestra como un segundo movimiento.
- **RN-07 Sin doble envío:** Mientras la solicitud de creación está en curso, el botón de envío permanece deshabilitado y el formulario no genera una segunda solicitud, aunque se haga doble clic o se pulse Enter varias veces.
- **RN-08 Aislamiento por usuario:** La aplicación solo muestra lo que Pagos devuelve para la credencial del usuario. Al cerrar sesión o perder la sesión se vacían los datos remotos en caché, de modo que otro usuario en el mismo navegador nunca ve datos del anterior. Una cuenta o transferencia ajena se trata como inexistente (404 de Pagos).
- **RN-09 Mensajes de error:** Se muestra el `message` en español del formato de error del servicio (`{error:{code,message}}`), según la regla de mensajes de la aplicación base: sin respuesta de red "No se pudo conectar con el servidor. Intenta de nuevo." y respuesta sin formato (p. ej. 502 del servidor web) "El servicio no está disponible. Intenta de nuevo más tarde.". Nunca se muestran tokens, trazas ni códigos internos como único mensaje.
- **RN-10 Sesión vencida:** Un 401 de Pagos sigue el comportamiento existente: una única renovación silenciosa compartida y un único reintento; si la sesión no se puede renovar, se cierra y se lleva al inicio de sesión. La aplicación no añade lógica propia de renovación.
- **RN-11 Historial:** Muestra las transferencias donde el usuario es dueño de la cuenta origen o destino, ordenadas de la más reciente a la más antigua tal como las entrega Pagos, con página por defecto de 20 elementos y carga de la página siguiente con el cursor opaco recibido. Una transferencia se rotula "Enviada" si su cuenta origen es una de las cuentas del usuario; en caso contrario, "Recibida".
- **RN-12 Único origen y upstreams:** El navegador solo habla con el origen que sirve la aplicación. El servidor web reenvía `/api/auth/` al servicio de identidad y `/api/payments/` al servicio de Pagos, recortando el prefijo (`/api/payments/transfers` llega a Pagos como `/transfers`). No existen otros upstreams.
- **RN-13 Todo en contenedores:** Instalar, compilar, verificar y ejecutar la aplicación ocurre dentro de contenedores; en el host solo hay Docker y Git.

---

## Requerimientos Funcionales y Criterios EARS

### REQ-01: Navegación y pantalla de cuentas
- **Historia de Usuario:**
  - **Como:** Cliente autenticado
  - **Quiero:** Ver mis cuentas y el saldo de cada una al entrar al portal
  - **Para:** Saber de cuánto dinero dispongo

#### Criterios de Aceptación y Comportamiento del Sistema (Sintaxis EARS)
- **REQ-1.1 (Evento) — AC-TIW-01:**
  - `CUANDO` el cliente con sesión abre `/`
  - `EL SISTEMA DEBE` obtener sus cuentas con `GET /api/payments/accounts` y mostrar, por cada cuenta, su identificador, la moneda COP y el saldo (RN-03), junto con el correo del usuario y el botón "Cerrar sesión" existentes, y enlaces a "Nueva transferencia" (`/transfers/new`) y "Historial" (`/transfers`).
  - *Given* un usuario con ACC-001 de 1000000.00; *When* abre `/`; *Then* ve ACC-001 con su saldo en COP.
- **REQ-1.2 (Estado de carga) — AC-TIW-02:**
  - `MIENTRAS` las cuentas se están obteniendo `CUANDO` se muestra `/`
  - `EL SISTEMA DEBE` mostrar un estado de carga accesible y no mostrar un saldo parcial ni un mensaje de lista vacía.
- **REQ-1.3 (Vacío) — AC-TIW-03:**
  - `SI` el servicio responde 200 con una lista vacía `CUANDO` se muestra `/`
  - `EL SISTEMA DEBE` mostrar "No tienes cuentas." y no ofrecer el formulario de transferencia (el enlace a nueva transferencia queda deshabilitado o se explica que no es posible transferir sin cuentas).
- **REQ-1.4 (Excepción) — AC-TIW-04:**
  - `SI` la obtención de cuentas falla por red, error de servidor o respuesta sin formato `CUANDO` se muestra `/`
  - `EL SISTEMA DEBE` mostrar el mensaje de error según RN-09 y un botón "Reintentar" que vuelve a pedir las cuentas.
- **REQ-1.5 (Ubicuo) — AC-TIW-05:**
  - `EL SISTEMA DEBE` exigir sesión en `/`, `/transfers`, `/transfers/new` y `/transfers/:id` (RN-01) y llevar a `/` cualquier ruta desconocida.
  - *Given* ninguna sesión; *When* se abre `/transfers/new`; *Then* se muestra el inicio de sesión sin contenido protegido.

### REQ-02: Formulario de transferencia y validación previa
- **Historia de Usuario:**
  - **Como:** Cliente autenticado con cuentas
  - **Quiero:** Un formulario claro para indicar desde qué cuenta, hacia qué cuenta y cuánto transferir
  - **Para:** Corregir errores antes de enviar

#### Criterios de Aceptación y Comportamiento del Sistema (Sintaxis EARS)
- **REQ-2.1 (Ubicuo) — AC-TIW-06:**
  - `EL SISTEMA DEBE` mostrar en `/transfers/new` un selector "Cuenta origen" con las cuentas del usuario (identificador y saldo), un campo "Cuenta destino" y un campo "Monto (COP)", y un botón "Transferir".
  - *Given* un usuario con ACC-001 y sin otras cuentas; *When* abre `/transfers/new`; *Then* el selector contiene ACC-001 y el botón "Transferir" está disponible.
- **REQ-2.2 (Excepción) — AC-TIW-07:**
  - `SI` el monto está vacío o no cumple RN-03 (por ejemplo "0", "-1", "1.234", "abc", mayor que 9999999999999999.99) `CUANDO` el cliente intenta enviar
  - `EL SISTEMA DEBE` mostrar junto al campo "El monto es inválido: debe ser un número mayor que 0, con hasta 2 decimales y un máximo de 9999999999999999.99.", no enviar ninguna solicitud y conservar lo escrito.
  - *Given* los montos "100", "100.5", "100.50" y "0.01"; *When* se envía; *Then* se aceptan. Con "0", "1.234", "-5" y "" se bloquean antes de enviar.
- **REQ-2.3 (Excepción) — AC-TIW-08:**
  - `SI` la cuenta destino está vacía tras recortar espacios `CUANDO` el cliente intenta enviar
  - `EL SISTEMA DEBE` indicar "Indica la cuenta destino." junto al campo y no enviar ninguna solicitud.
- **REQ-2.4 (Excepción) — AC-TIW-09:**
  - `SI` la cuenta destino es igual a la cuenta origen seleccionada `CUANDO` el cliente intenta enviar
  - `EL SISTEMA DEBE` indicar "La cuenta destino debe ser distinta de la cuenta origen." junto al campo y no enviar ninguna solicitud.
- **REQ-2.5 (Estado de carga y error) — AC-TIW-10:**
  - `MIENTRAS` las cuentas del usuario se están obteniendo en `/transfers/new` `CUANDO` se muestra el formulario
  - `EL SISTEMA DEBE` mostrar un estado de carga accesible; y `SI` la obtención falla, mostrar el mensaje de error de RN-09 con "Reintentar", sin ofrecer el envío.

### REQ-03: Envío de la transferencia sin doble envío e idempotente
- **Historia de Usuario:**
  - **Como:** Cliente autenticado
  - **Quiero:** Que mi transferencia se ejecute una sola vez aunque haga doble clic o reintente tras un corte
  - **Para:** No perder dinero por duplicados

#### Criterios de Aceptación y Comportamiento del Sistema (Sintaxis EARS)
- **REQ-3.1 (Evento) — AC-TIW-11:**
  - `CUANDO` el cliente envía el formulario válido
  - `EL SISTEMA DEBE` enviar `POST /api/payments/transfers` con el cuerpo `{type:"INTERNAL", fromAccountId, toAccountId, amount}` (monto como string, destino sin espacios sobrantes), la cabecera `Authorization: Bearer` y una cabecera `Idempotency-Key` válida según RN-06.
  - *Given* ACC-001 → ACC-002 por "150000.50"; *When* se envía; *Then* la solicitud lleva ese cuerpo y una clave de 1 a 255 caracteres ASCII imprimibles.
- **REQ-3.2 (Ubicuo) — AC-TIW-12:**
  - `EL SISTEMA DEBE` deshabilitar el botón "Transferir" mientras la solicitud está en curso (RN-07) y enviar una sola solicitud por intento aunque se haga doble clic o se pulse Enter repetidamente.
  - *Given* una respuesta lenta; *When* se hace doble clic en "Transferir"; *Then* el botón queda deshabilitado, muestra un estado "Procesando…" y el servicio recibe una sola solicitud.
- **REQ-3.3 (Reintento) — AC-TIW-13:**
  - `SI` el envío falla por red, por error de servidor (5xx) o por 409 `IDEMPOTENCY_KEY_IN_PROGRESS` `CUANDO` el cliente reintenta sin modificar el formulario
  - `EL SISTEMA DEBE` reenviar la solicitud con la misma `Idempotency-Key` y el mismo cuerpo, y para fallos de red o de servidor informar "No pudimos confirmar si la transferencia se realizó. Si reintentas no se duplicará; también puedes revisar tu historial."
  - *Given* un primer envío sin respuesta; *When* se pulsa "Transferir" de nuevo; *Then* ambas solicitudes llevan la misma clave.
- **REQ-3.4 (Condicional) — AC-TIW-14:**
  - `CUANDO` el cliente modifica cualquier campo del formulario tras un envío que no produjo efecto, o inicia una nueva transferencia tras una que produjo efecto (201)
  - `EL SISTEMA DEBE` usar una `Idempotency-Key` nueva en el siguiente envío, de modo que nunca se reutilice una clave con un cuerpo distinto.
  - *Given* un envío rechazado por monto y luego corregido; *When* se reenvía; *Then* la clave es distinta de la anterior.
- **REQ-3.5 (Evento) — AC-TIW-15:**
  - `CUANDO` el servicio responde con el header `Idempotent-Replayed: true` y el mismo resultado original
  - `EL SISTEMA DEBE` tratarlo como éxito idéntico al original, llevando a la pantalla de resultado de esa misma transferencia, sin presentar un segundo movimiento.

### REQ-04: Resultado del envío y errores
- **Historia de Usuario:**
  - **Como:** Cliente autenticado
  - **Quiero:** Saber qué pasó con mi transferencia y, si falló, por qué y qué hacer
  - **Para:** Corregir y reintentar sin confusión

#### Criterios de Aceptación y Comportamiento del Sistema (Sintaxis EARS)
- **REQ-4.1 (Evento) — AC-TIW-16:**
  - `CUANDO` el servicio responde 201 con una transferencia COMPLETED o FAILED
  - `EL SISTEMA DEBE` llevar al cliente a `/transfers/:id` con el identificador recibido, y marcar como desactualizados los datos de cuentas e historial para que se vuelvan a obtener (RN-02).
  - *Given* una transferencia COMPLETED; *When* termina el envío; *Then* se muestra `/transfers/<id>` y al volver a `/` los saldos se piden de nuevo.
- **REQ-4.2 (Excepción) — AC-TIW-17:**
  - `SI` el servicio responde 400 `INVALID_AMOUNT`, 400 `VALIDATION_ERROR`, 400 `IDEMPOTENCY_KEY_REQUIRED` o 422 `IDEMPOTENCY_KEY_PAYLOAD_MISMATCH` `CUANDO` se envía
  - `EL SISTEMA DEBE` mostrar el `message` del servicio en un aviso de error del formulario, conservar lo escrito y permitir corregir y reenviar con una clave nueva.
- **REQ-4.3 (Excepción) — AC-TIW-18:**
  - `SI` el servicio responde 404 `ACCOUNT_NOT_FOUND` `CUANDO` se envía
  - `EL SISTEMA DEBE` mostrar el `message` del servicio ("Cuenta no encontrada."), volver a obtener las cuentas del usuario y permitir elegir de nuevo el origen.
- **REQ-4.4 (Excepción) — AC-TIW-19:**
  - `SI` el servicio responde 404 `DESTINATION_NOT_FOUND` `CUANDO` se envía
  - `EL SISTEMA DEBE` mostrar el `message` del servicio ("Cuenta destino no encontrada.") junto al campo "Cuenta destino", conservar lo escrito y permitir corregir.
- **REQ-4.5 (Excepción) — AC-TIW-20:**
  - `SI` el servicio responde 422 `SAME_ACCOUNT` `CUANDO` se envía
  - `EL SISTEMA DEBE` mostrar el `message` del servicio junto al campo "Cuenta destino" y conservar lo escrito.
- **REQ-4.6 (Excepción) — AC-TIW-21:**
  - `SI` el servicio responde 409 `IDEMPOTENCY_KEY_IN_PROGRESS` `CUANDO` se envía
  - `EL SISTEMA DEBE` mostrar el `message` del servicio, habilitar de nuevo el botón y conservar la misma clave para reintentar (REQ-3.3).
- **REQ-4.7 (Excepción) — AC-TIW-22:**
  - `SI` el envío falla por red, por 5xx `INTERNAL_ERROR` o por una respuesta sin el formato de error `CUANDO` se envía
  - `EL SISTEMA DEBE` mostrar el mensaje de RN-09 y el aviso de REQ-3.3, habilitar de nuevo el botón y conservar lo escrito.
- **REQ-4.8 (Excepción) — AC-TIW-23:**
  - `SI` el servicio responde 401 y la sesión no puede renovarse `CUANDO` se envía
  - `EL SISTEMA DEBE` cerrar la sesión y llevar al inicio de sesión según RN-10, sin mostrar el formulario ni dejar datos del usuario en pantalla.
  - *Given* un 401 y una renovación rechazada; *When* se envía; *Then* se muestra el inicio de sesión.
- **REQ-4.9 (Evento) — AC-TIW-24:**
  - `CUANDO` el servicio responde 401 por vencimiento del acceso y la renovación tiene éxito
  - `EL SISTEMA DEBE` reintentar la solicitud una sola vez con la nueva credencial y la misma `Idempotency-Key`, de modo que el movimiento se ejecute una sola vez.

### REQ-05: Pantalla de resultado de una transferencia
- **Historia de Usuario:**
  - **Como:** Cliente autenticado (origen o destino)
  - **Quiero:** Ver el detalle y el estado de una transferencia
  - **Para:** Confirmar su resultado

#### Criterios de Aceptación y Comportamiento del Sistema (Sintaxis EARS)
- **REQ-5.1 (Evento) — AC-TIW-25:**
  - `CUANDO` el cliente abre `/transfers/:id`
  - `EL SISTEMA DEBE` obtener la transferencia con `GET /api/payments/transfers/{id}` (sin `Idempotency-Key`) y mostrar su identificador, cuenta origen, cuenta destino, monto en COP, fecha de creación y su estado: "Completada" si es COMPLETED, o "No realizada: fondos insuficientes" si es FAILED con `INSUFFICIENT_FUNDS`.
  - *Given* una transferencia COMPLETED de 150000.50; *When* se abre su pantalla; *Then* se ve "Completada" y el monto.
- **REQ-5.2 (Estado de carga) — AC-TIW-26:**
  - `MIENTRAS` la transferencia se está obteniendo `CUANDO` se muestra `/transfers/:id`
  - `EL SISTEMA DEBE` mostrar un estado de carga accesible y no mostrar un estado de resultado.
- **REQ-5.3 (Excepción) — AC-TIW-27:**
  - `SI` el servicio responde 404 `TRANSFER_NOT_FOUND` (inexistente, id inválido o transferencia de terceros) `CUANDO` se abre `/transfers/:id`
  - `EL SISTEMA DEBE` mostrar "Transferencia no encontrada." con un enlace a "Historial" y sin revelar si el recurso existe para otro usuario.
- **REQ-5.4 (Excepción) — AC-TIW-28:**
  - `SI` la obtención falla por red, error de servidor o respuesta sin formato `CUANDO` se abre `/transfers/:id`
  - `EL SISTEMA DEBE` mostrar el mensaje de error de RN-09 y un botón "Reintentar".
- **REQ-5.5 (Evento) — AC-TIW-29:**
  - `CUANDO` el cliente está en `/transfers/:id`
  - `EL SISTEMA DEBE` ofrecer enlaces a "Nueva transferencia", "Historial" y "Cuentas" (`/`).

### REQ-06: Historial de transferencias
- **Historia de Usuario:**
  - **Como:** Cliente autenticado
  - **Quiero:** Ver mis transferencias enviadas y recibidas
  - **Para:** Revisar mis movimientos

#### Criterios de Aceptación y Comportamiento del Sistema (Sintaxis EARS)
- **REQ-6.1 (Evento) — AC-TIW-30:**
  - `CUANDO` el cliente abre `/transfers`
  - `EL SISTEMA DEBE` obtener `GET /api/payments/transfers` y listar, en el orden entregado por el servicio, cada transferencia con su fecha, "Enviada" o "Recibida" (RN-11), cuentas origen y destino, monto en COP y estado (Completada o No realizada: fondos insuficientes), con un enlace a su pantalla de resultado.
  - *Given* una transferencia enviada y otra recibida; *When* se abre el historial; *Then* se ven ambas con su rótulo y la más reciente primero.
- **REQ-6.2 (Condicional) — AC-TIW-31:**
  - `MIENTRAS` el servicio informe un cursor de siguiente página `CUANDO` el cliente activa "Cargar más"
  - `EL SISTEMA DEBE` pedir la página siguiente con ese cursor, añadirla a la lista sin repetir ni omitir elementos, deshabilitar el botón mientras carga y ocultarlo cuando no haya más resultados.
  - *Given* 25 transferencias y página de 20; *When* se pulsa "Cargar más"; *Then* aparecen las 5 restantes y el botón desaparece.
- **REQ-6.3 (Vacío) — AC-TIW-32:**
  - `SI` el servicio responde 200 con lista vacía `CUANDO` se abre `/transfers`
  - `EL SISTEMA DEBE` mostrar "Aún no tienes transferencias." con un enlace a "Nueva transferencia" cuando el usuario tiene cuentas.
- **REQ-6.4 (Estado de carga) — AC-TIW-33:**
  - `MIENTRAS` la primera página se está obteniendo `CUANDO` se muestra `/transfers`
  - `EL SISTEMA DEBE` mostrar un estado de carga accesible y no mostrar el mensaje de lista vacía.
- **REQ-6.5 (Excepción) — AC-TIW-34:**
  - `SI` la obtención de la primera página o de una página siguiente falla `CUANDO` se muestra `/transfers`
  - `EL SISTEMA DEBE` mostrar el mensaje de error de RN-09 con "Reintentar", conservando las páginas ya cargadas.
- **REQ-6.6 (Evento) — AC-TIW-35:**
  - `CUANDO` el cliente completa una transferencia y abre luego `/transfers` o `/`
  - `EL SISTEMA DEBE` mostrar la nueva transferencia y los saldos actualizados obtenidos del servicio (RN-02).

### REQ-07: Sesión, aislamiento y mensajes transversales
- **Historia de Usuario:**
  - **Como:** Cliente autenticado
  - **Quiero:** Que mi sesión se mantenga sin interrupciones y que nadie más vea mis datos
  - **Para:** Operar con confianza

#### Criterios de Aceptación y Comportamiento del Sistema (Sintaxis EARS)
- **REQ-7.1 (Ubicuo) — AC-TIW-36:**
  - `EL SISTEMA DEBE` incluir `Authorization: Bearer <credencial de acceso>` en todas las solicitudes a `/api/payments/` y aplicar a su 401 el mecanismo existente de una renovación compartida y un único reintento (RN-10).
  - *Given* tres solicitudes simultáneas a Pagos que reciben 401; *When* se renueva; *Then* se envía una sola solicitud de renovación y cada solicitud se reintenta una vez.
- **REQ-7.2 (Evento) — AC-TIW-37:**
  - `CUANDO` la sesión se cierra (cierre voluntario, renovación rechazada o sesión revocada)
  - `EL SISTEMA DEBE` vaciar los datos remotos de cuentas, transferencias e historial en caché (RN-08), de modo que un nuevo inicio de sesión no muestre datos del usuario anterior.
  - *Given* sesión de alice con saldos cargados; *When* cierra sesión y entra bob; *Then* bob solo ve los datos obtenidos con su credencial.
- **REQ-7.3 (Ubicuo) — AC-TIW-38:**
  - `EL SISTEMA DEBE` no guardar la credencial de acceso, la clave de idempotencia ni datos de transferencias en `localStorage`, `sessionStorage`, cookies legibles, IndexedDB ni en la URL (más allá del identificador de transferencia de la ruta `/transfers/:id`).
- **REQ-7.4 (Ubicuo) — AC-TIW-39:**
  - `EL SISTEMA DEBE` mostrar los errores de Pagos según RN-09: el mensaje del servicio cuando existe, el de conexión cuando no hay respuesta y el de servicio no disponible cuando la respuesta no tiene el formato de error.
  - *Given* un fallo de red, una respuesta 502 HTML y un `{error:{code,message}}`; *When* se consulta cualquier pantalla de este spec; *Then* se muestran respectivamente el mensaje de conexión, el de servicio no disponible y el `message` recibido.

### REQ-08: Accesibilidad básica
- **Historia de Usuario:**
  - **Como:** Cliente que usa teclado o lector de pantalla
  - **Quiero:** Pantallas operables y comprensibles sin ratón
  - **Para:** Transferir y consultar con autonomía

#### Criterios de Aceptación y Comportamiento del Sistema (Sintaxis EARS)
- **REQ-8.1 (Ubicuo) — AC-TIW-40:**
  - `EL SISTEMA DEBE` asociar una etiqueta visible a cada campo del formulario, marcar los campos con error con `aria-invalid` y vincular su mensaje con `aria-describedby`, y permitir completar y enviar el formulario solo con teclado.
- **REQ-8.2 (Ubicuo) — AC-TIW-41:**
  - `EL SISTEMA DEBE` anunciar los estados de carga con `role="status"` y los errores (de campo y de formulario) con `role="alert"`, y no transmitir el estado de una transferencia únicamente por color (siempre con texto).
- **REQ-8.3 (Ubicuo) — AC-TIW-42:**
  - `EL SISTEMA DEBE` presentar cada pantalla con un encabezado `<h1>` único y presentar cuentas e historial como una lista o tabla con estructura semántica accesible.

### REQ-09: Servidor web y proxy de Pagos
- **Historia de Usuario:**
  - **Como:** Cliente
  - **Quiero:** Acceder a Pagos desde el mismo origen seguro de la aplicación
  - **Para:** Que mi credencial viaje solo por canales controlados

#### Criterios de Aceptación y Comportamiento del Sistema (Sintaxis EARS)
- **REQ-9.1 (Evento) — AC-TIW-43:**
  - `CUANDO` llega una solicitud a `/api/payments/<ruta>`
  - `EL SISTEMA DEBE` reenviarla al servicio de Pagos como `/<ruta>` (prefijo recortado, RN-12), conservando método, cuerpo, `Authorization`, `Idempotency-Key`, código de estado y la cabecera `Idempotent-Replayed` de la respuesta, y añadir `Host`, `X-Real-IP` y `X-Request-Id`.
  - *Given* el servicio de Pagos en la misma red; *When* se pide `GET /api/payments/health/live`; *Then* se recibe la respuesta de `GET /health/live` del servicio.
- **REQ-9.2 (Ubicuo) — AC-TIW-44:**
  - `EL SISTEMA DEBE` conservar el reenvío de `/api/auth/` al servicio de identidad y el servido de la aplicación con fallback a `index.html` exactamente como están definidos en la aplicación base, sin que el nuevo reenvío altere su comportamiento.
  - *Given* los servicios de identidad y de Pagos; *When* se piden `/login` y `/api/auth/health/live`; *Then* se obtienen `index.html` y la respuesta del servicio de identidad, como antes.
- **REQ-9.3 (Ubicuo) — AC-TIW-45:**
  - `EL SISTEMA DEBE` incluir las cabeceras de seguridad (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Content-Security-Policy: default-src 'self'`) en todas las respuestas, incluidas las reenviadas a Pagos y las respuestas de error, y entregar una aplicación compilada sin scripts ni estilos en línea y sin recursos de otros orígenes.
  - *Given* solicitudes a `/`, a una ruta inexistente y a `/api/payments/health/live`; *When* se leen las cabeceras; *Then* las cuatro están presentes en las tres.
- **REQ-9.4 (Excepción) — AC-TIW-46:**
  - `SI` el servicio de Pagos no responde `CUANDO` el navegador solicita la aplicación, `/api/auth/<ruta>` o `/api/payments/<ruta>`
  - `EL SISTEMA DEBE` seguir sirviendo la aplicación y el reenvío de identidad, y responder a las llamadas de Pagos con un error de pasarela (502) que la aplicación presenta como "El servicio no está disponible. Intenta de nuevo más tarde."

### REQ-10: No regresión y verificación en contenedores
- **Historia de Usuario:**
  - **Como:** Desarrollador
  - **Quiero:** Verificar que la ampliación no rompe la autenticación y que todo corre solo con Docker
  - **Para:** Entregar con confianza sin instalar nada en mi máquina

#### Criterios de Aceptación y Comportamiento del Sistema (Sintaxis EARS)
- **REQ-10.1 (Ubicuo) — AC-TIW-47:**
  - `EL SISTEMA DEBE` mantener sin cambios el comportamiento de registro, inicio y cierre de sesión, restauración silenciosa de la sesión al cargar, renovación ante 401 con una sola renovación en vuelo y un único reintento, cierre de sesión por `REFRESH_TOKEN_REUSED` o `REFRESH_TOKEN_INVALID`, y no renovación ante 401 de los endpoints públicos de identidad.
  - *Given* las pruebas de la aplicación base; *When* se ejecutan junto a las nuevas; *Then* todas pasan.
- **REQ-10.2 (Evento) — AC-TIW-48:**
  - `CUANDO` el desarrollador ejecuta dentro del contenedor Node 24.22.0 la instalación (`npm ci`), el lint, la verificación de formato, la verificación de tipos, las pruebas y el build de `apps/web`
  - `EL SISTEMA DEBE` completarlos sin errores ni advertencias, sin instalar nada en el host (RN-13), y mantener la imagen de varias etapas con `nginx:1.30.6-alpine` que contiene solo los archivos estáticos y la configuración.
- **REQ-10.3 (Evento) — AC-TIW-49:**
  - `CUANDO` se levanta el contenedor web junto a los servicios de identidad y de Pagos en la misma red de Compose
  - `EL SISTEMA DEBE` permitir completar contra el origen del servidor web el flujo iniciar sesión → ver cuentas → transferir entre cuentas semilla → ver el resultado → ver el historial → cerrar sesión.

---

## Edge Cases & Boundary Conditions
| ID | Escenario / Condición Límite | Comportamiento Esperado del Sistema |
|:---|:---|:---|
| **EC-01** | Doble clic o Enter repetido en "Transferir" | Botón deshabilitado en la primera pulsación; una sola solicitud (AC-TIW-12). |
| **EC-02** | Corte de red sin respuesta y reintento | Misma `Idempotency-Key` y mismo cuerpo; el servicio no duplica el débito; aviso para verificar el historial (AC-TIW-13). |
| **EC-03** | Respuesta repetida con `Idempotent-Replayed: true` | Se trata como el resultado original; un solo movimiento (AC-TIW-15). |
| **EC-04** | Monto "0", "-1", "1.234", "abc", vacío o mayor al máximo | Bloqueado antes de enviar con mensaje junto al campo (AC-TIW-07); si llega a Pagos, `INVALID_AMOUNT` se muestra (AC-TIW-17). |
| **EC-05** | Monto "0.01", "100", "100.5" y el máximo 9999999999999999.99 | Se envían como string sin pérdida de precisión (AC-TIW-07, AC-TIW-11). |
| **EC-06** | Cuenta destino igual a la origen | Bloqueado antes de enviar (AC-TIW-09); `SAME_ACCOUNT` del servicio se muestra (AC-TIW-20). |
| **EC-07** | Cuenta destino inexistente | `DESTINATION_NOT_FOUND` junto al campo; lo escrito se conserva (AC-TIW-19). |
| **EC-08** | Saldo insuficiente (p. ej. ACC-003 con 0.00 como origen) | 201 con transferencia FAILED: pantalla de resultado "No realizada: fondos insuficientes"; saldos sin cambios (AC-TIW-16, AC-TIW-25). |
| **EC-09** | Saldo exactamente igual al monto | Transferencia COMPLETED y el origen queda en 0.00 al refrescar (AC-TIW-16, AC-TIW-35). |
| **EC-10** | Otra solicitud con la misma clave sigue en curso (409) | Mensaje del servicio, botón habilitado y misma clave para reintentar (AC-TIW-21). |
| **EC-11** | Cuenta origen ajena o ya no disponible (404 `ACCOUNT_NOT_FOUND`) | Mensaje del servicio y recarga de las cuentas (AC-TIW-18). |
| **EC-12** | Acceso vencido durante el envío (401) | Una renovación, un único reintento con la misma clave; un solo movimiento (AC-TIW-24); si la renovación falla, inicio de sesión (AC-TIW-23). |
| **EC-13** | Abrir `/transfers/:id` de una transferencia ajena, inexistente o con id inválido | "Transferencia no encontrada." idéntico en todos los casos (AC-TIW-27). |
| **EC-14** | Usuario registrado sin cuentas | `/` muestra "No tienes cuentas."; no puede transferir; el historial muestra su estado vacío (AC-TIW-03, AC-TIW-32). |
| **EC-15** | Historial con más de una página | "Cargar más" añade la siguiente sin repetir ni omitir; el botón desaparece al terminar (AC-TIW-31). |
| **EC-16** | Falla la carga de una página siguiente del historial | Error con "Reintentar"; las páginas ya cargadas se conservan (AC-TIW-34). |
| **EC-17** | Cambio de usuario en el mismo navegador | La caché de datos remotos se vació al cerrar sesión; no hay datos del usuario anterior (AC-TIW-37). |
| **EC-18** | Servicio de Pagos caído | La aplicación y la identidad siguen operativas; las pantallas de Pagos muestran "El servicio no está disponible. Intenta de nuevo más tarde." (AC-TIW-46). |
| **EC-19** | Recarga de la página en `/transfers/new`, `/transfers` o `/transfers/:id` | La sesión se restaura de forma silenciosa y se muestra la pantalla pedida; el servidor entrega `index.html` (AC-TIW-44, AC-TIW-47). |
| **EC-20** | Transferencia entre dos cuentas propias | Permitida si origen y destino son distintos; se rotula "Enviada" (AC-TIW-30). |

---

## Restricciones Operativas y de Cumplimiento (Nivel Negocio)
- **Tiempo de Respuesta Operativo (SLA de Usuario):** Cada pantalla muestra su estado de carga de inmediato y el resultado de una transferencia debe ser perceptible como inmediato (Pagos responde en menos de 1 segundo en condiciones normales); el usuario nunca ve un saldo desactualizado tras transferir.
- **Privacidad y Cumplimiento Normativo:** Los datos financieros viven solo en memoria de la página mientras dura la sesión; la credencial de acceso, la clave de idempotencia y los datos de transferencias no se escriben en almacenamiento persistente del navegador ni en la consola. Los mensajes de error no exponen tokens, trazas ni datos de terceros.
- **Continuidad de Negocio:** Si Pagos no está disponible, la aplicación sigue sirviéndose y la autenticación sigue funcionando; el formulario conserva lo escrito ante cualquier error y el reintento nunca duplica el movimiento.
- **Plataforma:** Node.js 24.22.0, TypeScript estricto, React 19.3.1, react-router 8.4.0, @tanstack/react-query 5.104.3, Vite 8.3.4 y nginx 1.30.6-alpine (las del spec base); todo se compila, verifica y ejecuta en contenedores sin instalar nada en el host (RN-13).

---

## Trazabilidad de criterios de aceptación
Cada prueba automatizada incluye su ID `[AC-TIW-NN]` en el nombre. Tipos: **Unitaria** (Vitest, lógica de validación, claves de idempotencia y cliente de API, sin DOM), **Componente** (Vitest + Testing Library con jsdom, con Pagos y el servicio de identidad simulados a nivel de red solo en la prueba), **Integración** (contenedor nginx real con los servicios de identidad y de Pagos en la misma red de Compose), **Comando** (comando ejecutado dentro de contenedores con salida verificable).

| AC | Criterio | Tipo de test |
|:---|:---|:---|
| AC-TIW-01 | REQ-1.1: `/` lista cuentas con saldo, correo, cierre de sesión y enlaces | Componente |
| AC-TIW-02 | REQ-1.2: estado de carga de cuentas | Componente |
| AC-TIW-03 | REQ-1.3: sin cuentas, "No tienes cuentas." y sin transferir | Componente |
| AC-TIW-04 | REQ-1.4: error de cuentas con "Reintentar" | Componente |
| AC-TIW-05 | REQ-1.5: rutas protegidas y ruta desconocida a `/` | Componente |
| AC-TIW-06 | REQ-2.1: campos y botón del formulario | Componente |
| AC-TIW-07 | REQ-2.2: validación de monto antes de enviar | Unitaria + Componente |
| AC-TIW-08 | REQ-2.3: destino vacío bloqueado | Componente |
| AC-TIW-09 | REQ-2.4: destino igual al origen bloqueado | Componente |
| AC-TIW-10 | REQ-2.5: carga y error de cuentas en el formulario | Componente |
| AC-TIW-11 | REQ-3.1: solicitud con cuerpo, Bearer e `Idempotency-Key` válidos | Unitaria + Componente |
| AC-TIW-12 | REQ-3.2: botón deshabilitado y una sola solicitud por doble clic | Componente |
| AC-TIW-13 | REQ-3.3: reintento con la misma clave y aviso | Unitaria + Componente |
| AC-TIW-14 | REQ-3.4: clave nueva al modificar el formulario o tras 201 | Unitaria + Componente |
| AC-TIW-15 | REQ-3.5: `Idempotent-Replayed` tratado como éxito único | Componente |
| AC-TIW-16 | REQ-4.1: 201 lleva a `/transfers/:id` y refresca datos | Componente |
| AC-TIW-17 | REQ-4.2: `INVALID_AMOUNT`, `VALIDATION_ERROR`, `IDEMPOTENCY_KEY_REQUIRED`, `IDEMPOTENCY_KEY_PAYLOAD_MISMATCH` mostrados | Componente |
| AC-TIW-18 | REQ-4.3: `ACCOUNT_NOT_FOUND` y recarga de cuentas | Componente |
| AC-TIW-19 | REQ-4.4: `DESTINATION_NOT_FOUND` junto al campo | Componente |
| AC-TIW-20 | REQ-4.5: `SAME_ACCOUNT` junto al campo | Componente |
| AC-TIW-21 | REQ-4.6: `IDEMPOTENCY_KEY_IN_PROGRESS` con misma clave | Componente |
| AC-TIW-22 | REQ-4.7: red, 5xx y respuesta sin formato | Componente |
| AC-TIW-23 | REQ-4.8: 401 sin renovación posible cierra sesión | Componente |
| AC-TIW-24 | REQ-4.9: renovación y reintento único con la misma clave | Unitaria + Componente |
| AC-TIW-25 | REQ-5.1: detalle y estado COMPLETED o FAILED | Componente |
| AC-TIW-26 | REQ-5.2: carga de la transferencia | Componente |
| AC-TIW-27 | REQ-5.3: `TRANSFER_NOT_FOUND` | Componente |
| AC-TIW-28 | REQ-5.4: error de consulta con "Reintentar" | Componente |
| AC-TIW-29 | REQ-5.5: enlaces de navegación | Componente |
| AC-TIW-30 | REQ-6.1: historial con rótulo, orden, estado y enlace | Componente |
| AC-TIW-31 | REQ-6.2: "Cargar más" con cursor sin repetir ni omitir | Componente |
| AC-TIW-32 | REQ-6.3: historial vacío | Componente |
| AC-TIW-33 | REQ-6.4: carga del historial | Componente |
| AC-TIW-34 | REQ-6.5: error con páginas conservadas | Componente |
| AC-TIW-35 | REQ-6.6: nueva transferencia y saldos actualizados | Componente |
| AC-TIW-36 | REQ-7.1: Bearer y renovación única compartida para Pagos | Unitaria |
| AC-TIW-37 | REQ-7.2: caché vaciada al cerrar sesión | Componente |
| AC-TIW-38 | REQ-7.3: nada sensible en almacenes del navegador ni URL | Unitaria + Componente |
| AC-TIW-39 | REQ-7.4: mensajes de error según RN-09 | Unitaria + Componente |
| AC-TIW-40 | REQ-8.1: etiquetas, `aria-invalid`, `aria-describedby` y teclado | Componente |
| AC-TIW-41 | REQ-8.2: `role="status"`, `role="alert"` y estado con texto | Componente |
| AC-TIW-42 | REQ-8.3: `<h1>` único y estructura semántica | Componente |
| AC-TIW-43 | REQ-9.1: proxy `/api/payments/` con prefijo recortado y cabeceras | Integración |
| AC-TIW-44 | REQ-9.2: `/api/auth/` y fallback SPA sin cambios | Integración |
| AC-TIW-45 | REQ-9.3: cabeceras de seguridad y build compatible con CSP | Integración + Comando |
| AC-TIW-46 | REQ-9.4: Pagos caído no afecta a la aplicación ni a identidad | Integración |
| AC-TIW-47 | REQ-10.1: no regresión de la autenticación | Unitaria + Componente + Integración |
| AC-TIW-48 | REQ-10.2: `npm ci`, lint, formato, tipos, pruebas, build e imagen en contenedor | Comando |
| AC-TIW-49 | REQ-10.3: flujo completo contra el origen del servidor web | Integración |
