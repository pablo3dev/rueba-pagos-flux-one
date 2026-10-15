# reversos-transferencias-web

> En la pantalla de una transferencia completada el cliente puede reversarla una sola vez. El botón no aparece si no está completada y no se puede pulsar dos veces para la misma intención.

## Estado

| Estado global | Última actualización |
|:---:|:---:|
| `Completado` | `2026-10-15` |

## Objetivo

En la pantalla de una transferencia completada el cliente puede reversarla una sola vez. El botón no aparece si no está completada y no se puede pulsar dos veces para la misma intención.

## Avance

| Fase | Estado |
|:---|:---:|
| Phase 1: Foundation, Schemas & Core Domain | `Completado` |
| Phase 2: Core Logic & Application Layer | `Completado` |
| Phase 3: Presentation, Endpoints & Integration | `Completado` |
| Phase 4: Verification, Testing & Polish | `Completado` |

**Progreso global:** `100%` (8 de 8 tareas completadas)

## Qué puede hacer ya el usuario / Qué falta

- [x] Mostrar Reversar solo si el estado es COMPLETED.
- [x] Enviar el reverso con su propia clave de idempotencia.
- [x] Mostrar el estado del reverso.
