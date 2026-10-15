# auditoria-transferencias-audit

> Consumo y consulta de auditoría

## Estado

| Estado global | Última actualización |
|:---:|:---:|
| `Completado` | `2026-10-15` |

## Objetivo

El servicio consume audit.transfer-events de forma idempotente, persiste en audit_schema y manda a DLQ lo que no puede guardar. GET /audit/transfers/{id}/events exige JWT y filtra por visibilidad.

## Avance

| Fase | Estado |
|:---|:---:|
| Spec | `Completado` |
| Implementación | `Completado` |

**Progreso global:** `100%`

## Qué puede hacer ya el usuario / Qué falta

- [x] Consumo y consulta de auditoría
