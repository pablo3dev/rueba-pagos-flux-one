# transferencias-externas-payments

> El cliente autenticado envía dinero en COP desde una cuenta propia hacia un banco externo, y el servicio retiene los fondos, los entrega y los devuelve si el banco no los paga, sin duplicar ni perder dinero.

## Estado

| Estado global | Última actualización |
|:---:|:---:|
| `Completado` | `2026-10-15` |

## Objetivo

Permitir que un cliente autenticado transfiera dinero a una cuenta de otro banco y consulte el resultado, con la certeza de que el dinero se debita una sola vez y, si el banco rechaza o no responde de forma definitiva, vuelve a su cuenta.
La creación responde de inmediato, sin esperar al banco. Las transferencias entre cuentas del propio sistema siguen funcionando igual que antes.

## Avance

| Fase | Estado |
|:---|:---:|
| Phase 1: Foundation, Schemas & Core Domain | `Completado` |
| Phase 2: Core Logic & Application Layer | `Completado` |
| Phase 3: Presentation, Endpoints & Integration | `Completado` |
| Phase 4: Verification, Testing & Polish | `Completado` |

**Progreso global:** `0%` (0 de 11 tareas completadas)

## Qué puede hacer ya el usuario / Qué falta

- [x] Crear una transferencia a un banco externo y recibir la confirmación de que el dinero quedó retenido
- [x] Recibir un rechazo claro por fondos insuficientes, sin que se mueva dinero ni se envíe al banco
- [x] Repetir la misma solicitud sin un segundo débito
- [x] Consultar el estado de la transferencia, incluido cuando el banco aún no ha respondido
- [x] Ver las transferencias externas en su historial, junto con las internas
- [x] Recuperar el dinero si el banco rechaza el pago o no está disponible de forma definitiva
- [x] Seguir usando las transferencias entre cuentas del sistema como hasta ahora

## Coordinación multi-unidad

### (a) Specs hermanos

- [autenticacion-usuarios-auth](../../auth/autenticacion-usuarios-auth/summary.md)
- [riel-bancario-simulado-bank-rail](../../bank-rail/riel-bancario-simulado-bank-rail/summary.md)
- [transferencias-internas-payments](../transferencias-internas-payments/summary.md)
- [autenticacion-usuarios-web](../../../apps/web/autenticacion-usuarios-web/summary.md)
- [transferencias-internas-web](../../../apps/web/transferencias-internas-web/summary.md)
- [reversos-transferencias-payments](../reversos-transferencias-payments/summary.md)
- [transferencias-externas-web](../../../apps/web/transferencias-externas-web/summary.md)
- [auditoria-transferencias-payments](../auditoria-transferencias-payments/summary.md)
- [reversos-transferencias-web](../../../apps/web/reversos-transferencias-web/summary.md)
- [auditoria-transferencias-audit](../../audit/auditoria-transferencias-audit/summary.md)
- [auditoria-transferencias-web](../../../apps/web/auditoria-transferencias-web/summary.md)
- [entorno-local-infra](../../../infra/entorno-local-infra/summary.md)

### (b) Orden entre unidades

Este spec depende de `transferencias-internas-payments` (cuentas, transferencias internas e idempotencia que amplía) y de `riel-bancario-simulado-bank-rail` (contrato HTTP del banco al que envía el dinero).

Orden completo de creación:

1. autenticacion-usuarios-auth
2. riel-bancario-simulado-bank-rail
3. transferencias-internas-payments
4. autenticacion-usuarios-web
5. transferencias-externas-payments
6. transferencias-internas-web
7. reversos-transferencias-payments
8. transferencias-externas-web
9. auditoria-transferencias-payments
10. reversos-transferencias-web
11. auditoria-transferencias-audit
12. auditoria-transferencias-web
13. entorno-local-infra

### (c) Condición de Done conjunto de la capacidad

- [x] Todas las tareas de los specs hermanos marcadas `[x]`
- [x] TEST y AUDIT aprobados por unidad
- [x] Prueba E2E cross-unidad aprobada
