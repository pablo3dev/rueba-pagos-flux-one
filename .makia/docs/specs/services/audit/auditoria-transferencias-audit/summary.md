# auditoria-transferencias-audit

> El servicio de auditoría guarda cada evento de transferencia una sola vez y lo devuelve solo a quien puede ver esa transferencia.

## Estado

| Estado global | Última actualización |
|:---:|:---:|
| `Completado` | `2026-10-15` |

## Objetivo

El servicio de auditoría guarda cada evento de transferencia una sola vez y lo devuelve solo a quien puede ver esa transferencia.

## Avance

| Fase | Estado |
|:---|:---:|
| Phase 1: Foundation, Schemas & Core Domain | `Completado` |
| Phase 2: Core Logic & Application Layer | `Completado` |
| Phase 3: Presentation, Endpoints & Integration | `Completado` |
| Phase 4: Verification, Testing & Polish | `Completado` |

**Progreso global:** `100%` (8 de 8 tareas completadas)

## Qué puede hacer ya el usuario / Qué falta

- [x] Consumir la cola de eventos de forma idempotente.
- [x] Guardar el hecho en audit_schema.
- [x] Rechazar a la cola de fallos lo que no se puede interpretar.
- [x] Consultar el historial con el JWT del cliente.
