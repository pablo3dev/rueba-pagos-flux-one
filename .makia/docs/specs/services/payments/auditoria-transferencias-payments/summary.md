# auditoria-transferencias-payments

> Cada cambio de estado de una transferencia deja un evento en la misma transacción del dinero. Un relevo lo publica en RabbitMQ. Si el mensajero falla, la transferencia no se deshace y el evento se reintenta.

## Estado

| Estado global | Última actualización |
|:---:|:---:|
| `Completado` | `2026-10-15` |

## Objetivo

Cada cambio de estado de una transferencia deja un evento en la misma transacción del dinero. Un relevo lo publica en RabbitMQ. Si el mensajero falla, la transferencia no se deshace y el evento se reintenta.

## Avance

| Fase | Estado |
|:---|:---:|
| Phase 1: Foundation, Schemas & Core Domain | `Completado` |
| Phase 2: Core Logic & Application Layer | `Completado` |
| Phase 3: Presentation, Endpoints & Integration | `Completado` |
| Phase 4: Verification, Testing & Polish | `Completado` |

**Progreso global:** `100%` (8 de 8 tareas completadas)

## Qué puede hacer ya el usuario / Qué falta

- [x] Escribir el evento de auditoría en la misma transacción del cambio de estado.
- [x] Publicar transfer.created, transfer.completed, transfer.failed, transfer.unknown, transfer.reversal_requested, transfer.reversed y transfer.reversal_rejected.
- [x] Reintentar la publicación sin bloquear al cliente.
