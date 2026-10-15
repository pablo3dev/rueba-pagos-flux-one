# reversos-transferencias-payments

> El cliente dueño de la cuenta origen reversa por completo, y una sola vez, una transferencia ya completada. Si es interna, el dinero vuelve en el acto. Si es externa, el banco simulado confirma el reverso y solo entonces se acredita el origen.

## Estado

| Estado global | Última actualización |
|:---:|:---:|
| `Completado` | `2026-10-15` |

## Objetivo

El cliente dueño de la cuenta origen reversa por completo, y una sola vez, una transferencia ya completada. Si es interna, el dinero vuelve en el acto. Si es externa, el banco simulado confirma el reverso y solo entonces se acredita el origen.

## Avance

| Fase | Estado |
|:---|:---:|
| Phase 1: Foundation, Schemas & Core Domain | `Completado` |
| Phase 2: Core Logic & Application Layer | `Completado` |
| Phase 3: Presentation, Endpoints & Integration | `Completado` |
| Phase 4: Verification, Testing & Polish | `Completado` |

**Progreso global:** `100%` (8 de 8 tareas completadas)

## Qué puede hacer ya el usuario / Qué falta

- [x] Reversar solo una transferencia COMPLETED y solo si el actor es dueño del origen.
- [x] Reverso interno atómico: el destino devuelve el monto total o no se registra el reverso.
- [x] Reverso externo en dos tiempos: se acepta la solicitud y se concilia con el riel.
- [x] Una sola vez por transferencia, con Idempotency-Key.
