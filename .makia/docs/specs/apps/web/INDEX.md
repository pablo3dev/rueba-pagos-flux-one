# Specs: Web (apps/web)

> SPA React del portal de pagos: pantallas y cliente de la API.

## Grafo de specs

```mermaid
graph LR
  DM[domain-model.md]
  S1[autenticacion-usuarios-web]
  AUTH[autenticacion-usuarios-auth]

  DM --> S1
  S1 -->|depende de| AUTH
```

## Tabla de specs

| Spec | Estado | Creación | Paralelizable con | Ruta | Depende de |
|---|:---:|:---:|:---:|---|---|
| autenticacion-usuarios-web | `Pendiente` | `Aprobado` | `—` | `autenticacion-usuarios-web/summary.md` | [autenticacion-usuarios-auth](../../services/auth/autenticacion-usuarios-auth/summary.md) |
| transferencias-internas-web | `Completado` | `Aprobado` | `—` | `transferencias-internas-web/summary.md` | [transferencias-internas-payments](../../services/payments/transferencias-internas-payments/summary.md), [autenticacion-usuarios-web](autenticacion-usuarios-web/summary.md) |
| transferencias-externas-web | `Completado` | `Aprobado` | `—` | `transferencias-externas-web/summary.md` | [transferencias-externas-payments](../../services/payments/transferencias-externas-payments/summary.md), [transferencias-internas-web](transferencias-internas-web/summary.md) |
| reversos-transferencias-web | `Completado` | `Aprobado` | `—` | `reversos-transferencias-web/summary.md` | [reversos-transferencias-payments](../../services/payments/reversos-transferencias-payments/summary.md), [transferencias-externas-web](transferencias-externas-web/summary.md) |
| auditoria-transferencias-web | `Completado` | `Aprobado` | `—` | `auditoria-transferencias-web/summary.md` | [auditoria-transferencias-audit](../../services/audit/auditoria-transferencias-audit/summary.md), [reversos-transferencias-web](reversos-transferencias-web/summary.md) |

> `domain-model.md` es el de Pagos que usa apps/web (`../../services/payments/domain-model.md`). El spec pertenece a la feature `autenticacion-usuarios-web`; los demás specs de la capacidad viven en los `INDEX.md` de sus propias unidades. `Paralelizable con` es `—` porque comparte `package-lock.json` con los otros specs del Grupo B.
