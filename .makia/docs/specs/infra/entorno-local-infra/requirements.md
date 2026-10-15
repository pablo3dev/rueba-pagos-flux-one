# Arranque local del portal

> Este documento es el **artefacto de aprobación del USUARIO**. Es autosuficiente: todo lo necesario para aprobar el alcance, las reglas, los objetivos y los criterios de éxito del spec está aquí.

- **Spec:** `entorno-local-infra`
- **Feature:** `entorno-local` — **Unidad de código:** `infra`

## Resumen
El operador levanta con un comando el portal completo: base de datos, mensajería, identidad, pagos, riel, auditoría y la web, y comprueba un envío interno.

## Problema
Sin esta capacidad el cliente no puede completar el flujo de valor del portal de pagos en COP: o pierde visibilidad del dinero, o no puede corregir una transferencia ya hecha, o el operador no puede levantar el producto para comprobarlo.

## Solución
- **En qué consiste:** El operador levanta con un comando el portal completo: base de datos, mensajería, identidad, pagos, riel, auditoría y la web, y comprueba un envío interno.
- **Cómo resuelve el problema:** La capacidad queda cerrada en esta unidad, con reglas explícitas, rechazo claro cuando no se cumplen y sin perder ni duplicar dinero.

## Objetivos y criterios de éxito
- **Objetivo 1:** El actor obtiene el resultado de negocio descrito en el resumen, en español claro.
- **Objetivo 2:** Un reintento o un fallo externo no duplica el efecto ni deja el dinero en un estado inexplicable.
- **Objetivo 3:** Lo que no corresponde al actor se responde como inexistente, sin filtrar datos ajenos.

---

## Actores de negocio y flujo de valor
- **Cliente autenticado:** Opera su dinero y consulta solo lo que le es visible.
- **Banco simulado:** Resuelve transferencias y reversos externos de forma no confiable.
- **Operador:** Levanta el portal y comprueba el flujo.

---

## Delimitación del Alcance (Scope Boundaries)
- **Dentro del Alcance (In Scope - Fase Actual):**
  - Levantar los siete servicios con salud comprobada.
  - Crear roles y esquemas de auth, pagos y auditoría.
  - Documentar el comando de arranque y los usuarios demo.
  - Comprobar login y una transferencia interna.
- **Fuera del Alcance (Out of Scope / Non-Goals):**
  - Reversos parciales.
  - Payment Links.
  - Multimoneda, alta de cuentas, recuperación de contraseña, MFA y roles de administrador.
  - SSE, WebSockets y despliegue en la nube.

---

## Reglas de Negocio y Políticas del Dominio
- **RN-01 Idempotencia:** Toda operación de dinero exige `Idempotency-Key`. La misma clave y el mismo pedido devuelven la misma respuesta. La misma clave con otro pedido se rechaza.
- **RN-02 Dinero:** COP, monto en texto decimal mayor que cero, persistido como numeric(18,2). Nunca un número de punto flotante.
- **RN-03 Visibilidad:** Solo ven la transferencia el dueño de la cuenta origen y, si es interna, el dueño de la cuenta destino. El resto recibe que no existe.
- **RN-04 Efecto único:** Un doble envío no mueve el dinero dos veces.

---

## Requerimientos Funcionales y Criterios EARS

### REQ-01: Un solo arranque
- **Historia de Usuario:**
  - **Como:** operador
  - **Quiero:** levantar el portal en su máquina
  - **Para:** probar el producto sin instalar lenguajes ni bases

#### Criterios de Aceptación y Comportamiento del Sistema (Sintaxis EARS)
- **REQ-1.1 (Comportamiento Siempre Activo / Ubicuo):**
  - `EL SISTEMA DEBE` definir postgres, rabbitmq, auth, payments, audit, bank-rail y web con comprobación de salud
- **REQ-1.2 (Flujo Principal / Basado en Eventos):**
  - `CUANDO` ejecuta el compose de infra
  - `EL SISTEMA DEBE` dejar el portal en el puerto 8080
- **REQ-1.3 (Comportamiento Condicional / Basado en Estado):**
  - `MIENTRAS` un servicio del que otro depende aún no está listo `CUANDO` ese otro arranca
  - `EL SISTEMA DEBE` esperar a que el anterior esté sano
- **REQ-1.4 (Excepción o Manejo de Invalidez):**
  - `SI` faltan las variables de entorno `CUANDO` se intenta arrancar
  - `EL SISTEMA DEBE` no adivinar secretos: leerlas del archivo de ejemplo


---

## Edge Cases & Boundary Conditions
| ID | Escenario / Condición Límite | Comportamiento Esperado del Sistema |
|:---|:---|:---|
| **EC-01** | La misma clave de idempotencia se reenvía con el mismo pedido | Se devuelve la respuesta guardada y no hay un segundo efecto. |
| **EC-02** | La misma clave llega con un pedido distinto | Se rechaza y el estado anterior se conserva. |
| **EC-03** | El actor no es dueño de la cuenta origen | La operación se responde como inexistente. |

---

## Restricciones Operativas y de Cumplimiento (Nivel Negocio)
- **Tiempo de Respuesta Operativo (SLA de Usuario):** Crear una transferencia o un reverso confirma de inmediato. El banco externo se concilia después, sin bloquear al cliente.
- **Privacidad y Cumplimiento Normativo:** No se muestran saldos, cuentas ni eventos de otro cliente.
- **Continuidad de Negocio:** Si el banco o el mensajero fallan, el dinero queda retenido o reembolsado según la regla, nunca perdido.
