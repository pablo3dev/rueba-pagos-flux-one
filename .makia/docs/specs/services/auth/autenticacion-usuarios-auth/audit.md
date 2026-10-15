# Audit Report: Autenticación de usuarios (servicio de identidad)

## 1. Metadata
- **Spec Auditado:** `autenticacion-usuarios-auth`
- **Ruta:** `.makia/docs/specs/services/auth/autenticacion-usuarios-auth`
- **Fecha de Auditoría:** `2026-10-15`
- **Auditor:** `AUDIT`
- **Ciclo de Auditoría:** `1`

---

## 2. Alcance de la Verificación
- [x] El código implementado cumple con `requirements.md` (criterios EARS) y `design.md` (contratos, estructura de archivos).
- [x] El spec (`requirements.md`/`design.md`) está alineado con `domain-model.md` (lenguaje ubicuo, límites del Contexto Delimitado, entidades y reglas de negocio).

Contraste de dominio, spec y código de `services/auth/` y del tooling raíz declarado en `design.md` §5. No se reejecutaron pruebas (TEST ya cerró la tarea 4.3: 8/8 comandos, 154 pruebas). No hay unit-specs hermanos escritos; no se anticipan sus contratos. Constitución leída: `## Global` y `## Unidad: services/auth`.

---

## 3. Hallazgos y Desviaciones

Sin hallazgos. Ninguna desviación bloquea el negocio ni exige corrección de código.

Los tres contrastes pedidos quedan así:

1. **Argon2 y tipos de jose.** El hash cumple RN-02 y `design.md` §4.1: Argon2id, `m=19456`, `t=2`, `p=1`, prefijo PHC `$argon2id$v=19$m=19456,t=2,p=1$`. La emisión y verificación JWT siguen el contrato de `design.md` §4.1 (`importPKCS8`, `SignJWT`, `createLocalJWKSet`, `jwtVerify` con `algorithms: ['EdDSA']`, `generateKeyPair('EdDSA', { crv: 'Ed25519', extractable: true })`, `exportPKCS8`). El código de producción no importa `KeyLike` ni declara un tipo distinto del contrato. La forma literal `algorithm: 2` y el tipo `CryptoKey` en pruebas son huecos de documentación (sección 6), no un algoritmo ni un claim distintos.
2. **`app.ts` y `error-handler.ts`.** El conjunto de archivos coincide con la tabla de `design.md` §5. `app.ts` se modifica en la tarea 3.2, que sí está en la tabla. En la tarea 3.3 (`db70b1b`) se añadieron 3 líneas para cablear `refreshSession`, `logoutSession` y `getProfile`; esa edición no tiene fila en la tabla, aunque el estado final ya está descrito en `design.md` §4.3. `error-handler.ts` solo cambia en la tarea 3.2 (`b3c12fd`) para reparar la codificación UTF-8 de mensajes que ya existían desde la tarea 3.1; no cambia la tabla error → status/code. La tarea 3.4 no toca ninguno de los dos.
3. **Ajv.** `removeAdditional: false` y `coerceTypes: false` están en `services/auth/src/adapters/inbound/http/app.ts` y no están declaradas en `design.md` (el constructor de Fastify en §4.2 no las incluye). Hacen falta para AC-AUT-04 y AC-AUT-10: el compilador de esquemas por defecto de Fastify elimina propiedades extra (`removeAdditional: true`) y coacciona tipos, así que un campo adicional o un email numérico no responderían 400 `VALIDATION_ERROR`. `additionalProperties: false` en `schemas.ts` no basta con esos defaults. El código es el que cumple los criterios.

---

## 4. Supuestos Detectados

Sin supuestos detectados. El literal `algorithm: 2` queda respaldado por el prefijo PHC que `design.md` §4.1 exige y que las pruebas del hasher afirman.

---

## 5. Preguntas Abiertas

Sin preguntas abiertas.

---

## 6. Recomendaciones

Corregir spec y `learning.md`. No corregir código: cambiar estas piezas rompería el tipo, los criterios AC-AUT-04/10 o el cableado que `design.md` §4.3 ya describe. No aplica el disparador de corrección solo de código.

- **Ajv en `design.md` §4.2.** Declarar en el constructor de Fastify `ajv: { customOptions: { removeAdditional: false, coerceTypes: false } }`, con la razón de AC-AUT-04 y AC-AUT-10. Código: `services/auth/src/adapters/inbound/http/app.ts` (introducido en `b3c12fd`).
- **Tabla de archivos.** Añadir en `design.md` §5 y en la tarea 3.3 de `tasks.md` la modificación de `services/auth/src/adapters/inbound/http/app.ts` que pasa `refreshSession`, `logoutSession` y `getProfile` (`db70b1b`, 3 líneas). No hace falta una fila para `error-handler.ts`: su único diff posterior a la tarea 3.1 es la reparación UTF-8 en `b3c12fd`.
- **Argon2 en `design.md` §4.1 y `learning.md` §6.** `Algorithm` es un `const enum` del `.d.ts` de `@node-rs/argon2` 2.2.2 y `verbatimModuleSyntax` (`tsconfig.base.json`) impide importarlo (TS2748). Documentar `algorithm: 2` como el valor de `Algorithm.Argon2id`, con los mismos `memoryCost`, `timeCost` y `parallelism`. Código: `services/auth/src/adapters/outbound/crypto/argon2-password-hasher.ts` (`154e2d4`).
- **Tipos de jose en `learning.md` §5.** jose 6.2.12 no exporta `KeyLike`; `importPKCS8` / `generateKeyPair` resuelven a `CryptoKey`. El código de producción no anota ese tipo. Las pruebas sí: `services/auth/tests/acceptance/profile.test.ts`. El `as never` de `login.test.ts` estrecha el JSON del JWKS en la prueba; no cambia el contrato de `jose-token-issuer.ts`.
- **Constitución `## Global`.** Dos directrices no están en `domain-model.md` ni en `db-design.dbml`, y el código sigue esos documentos: no hay Transactional Outbox, y los logs JSON identifican la solicitud con el `reqId` de Fastify (`x-request-id` en `app.ts`), no con un campo llamado `correlationId`. `design.md` §2.7 copia ambas directrices y el resto del diseño no las implementa. Alinearlas es decisión de spec o de constitución. Crear una tabla de outbox en código violaría el principio de no alterar datos fuera de `domain-model.md` y `db-design.dbml`.

---

## 7. Veredicto Final

**Veredicto:** `PASA_CON_OBSERVACIONES`

- `PASA`: sin hallazgos, sin observaciones. El spec y su implementación están completamente alineados.
- `PASA_CON_OBSERVACIONES`: hay recomendaciones (sección 6) no bloqueantes; no requieren corrección para continuar.
- `RECHAZADA`: hay al menos un hallazgo bloqueante (sección 3). IMPLEMENT debe corregir según los hallazgos listados y AUDIT vuelve a evaluar en un nuevo ciclo.
