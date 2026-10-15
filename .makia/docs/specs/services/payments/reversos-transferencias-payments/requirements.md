# Reverso total de una transferencia completada

> Este documento es el **artefacto de aprobación del USUARIO**. Es autosuficiente: todo lo necesario para aprobar el alcance, las reglas, los objetivos y los criterios de éxito del spec está aquí.

- **Spec:** `reversos-transferencias-payments`
- **Feature:** `reversos-transferencias` — **Unidad de código:** `services/payments`

## Resumen
El cliente dueño de la cuenta origen reversa por completo, y una sola vez, una transferencia ya completada. Si es interna, el dinero vuelve en el acto. Si es externa, el banco simulado confirma el reverso y solo entonces se acredita el origen.

## Problema
Sin esta capacidad el cliente no puede completar el flujo de valor del portal de pagos en COP: o pierde visibilidad del dinero, o no puede corregir una transferencia ya hecha, o el operador no puede levantar el producto para comprobarlo.

## Solución
- **En qué consiste:** El cliente dueño de la cuenta origen reversa por completo, y una sola vez, una transferencia ya completada. Si es interna, el dinero vuelve en el acto. Si es externa, el banco simulado confirma el reverso y solo entonces se acredita el origen.
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
  - Reversar solo una transferencia COMPLETED y solo si el actor es dueño del origen.
  - Reverso interno atómico: el destino devuelve el monto total o no se registra el reverso.
  - Reverso externo en dos tiempos: se acepta la solicitud y se concilia con el riel.
  - Una sola vez por transferencia, con Idempotency-Key.
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

### REQ-01: Reverso interno
- **Historia de Usuario:**
  - **Como:** cliente
  - **Quiero:** recuperar un envío ya completado entre cuentas del portal
  - **Para:** corregir un pago sin dejar saldos inconsistentes

#### Criterios de Aceptación y Comportamiento del Sistema (Sintaxis EARS)
- **REQ-1.1 (Comportamiento Siempre Activo / Ubicuo):**
  - `EL SISTEMA DEBE` aceptar el reverso solo si la transferencia está COMPLETED y el actor es dueño del origen
- **REQ-1.2 (Flujo Principal / Basado en Eventos):**
  - `CUANDO` pide el reverso de una interna y el destino tiene saldo suficiente
  - `EL SISTEMA DEBE` debitar el destino, acreditar el origen, marcar la transferencia REVERSED y responder 201
- **REQ-1.3 (Comportamiento Condicional / Basado en Estado):**
  - `MIENTRAS` el destino no cubre el monto `CUANDO` se pide el reverso interno
  - `EL SISTEMA DEBE` rechazar con REVERSAL_INSUFFICIENT_FUNDS y no crear el reverso
- **REQ-1.4 (Excepción o Manejo de Invalidez):**
  - `SI` la transferencia no está COMPLETED o ya tiene un reverso `CUANDO` se insiste
  - `EL SISTEMA DEBE` responder 409 y no mover dinero


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
