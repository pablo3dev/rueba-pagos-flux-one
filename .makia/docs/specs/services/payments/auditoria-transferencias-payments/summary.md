# auditoria-transferencias-payments

> Outbox de cada cambio de estado

## Estado

| Estado global | Última actualización |
|:---:|:---:|
| `Completado` | `2026-10-15` |

## Objetivo

Cada cambio de estado de transferencia escribe un evento en el outbox dentro de la misma transacción. Un relay lo publica en RabbitMQ con confirms y reintento.

## Avance

| Fase | Estado |
|:---|:---:|
| Spec | `Completado` |
| Implementación | `Completado` |

**Progreso global:** `100%`

## Qué puede hacer ya el usuario / Qué falta

- [x] Outbox de cada cambio de estado
