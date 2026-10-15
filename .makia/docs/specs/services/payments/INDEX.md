# Specs: Pagos (services/payments)

> Servicio de pagos del portal: cuentas, transferencias, idempotencia.

## Grafo de specs

```mermaid
graph LR
  DM[domain-model.md]
  TIP[transferencias-internas-payments]
  AUTH[autenticacion-usuarios-auth]

  DM --> TIP
  TIP -->|depende de| AUTH
```

## Tabla de specs

| Spec | Estado | Creación | Paralelizable con | Ruta | Depende de |
|---|:---:|:---:|:---:|---|---|
| transferencias-internas-payments | `Pendiente` | `Aprobado` | `—` | `transferencias-internas-payments/summary.md` | [autenticacion-usuarios-auth](../auth/autenticacion-usuarios-auth/summary.md) |

Nota: [domain-model.md](domain-model.md) de este árbol es el modelo de negocio único de toda la capacidad (apps/web lo referencia); el spec pertenece a la feature `transferencias-internas` (unidad `services/payments`); los demás specs de la capacidad viven en los INDEX.md de sus propias unidades. La columna `Paralelizable con` queda en `—` porque aún no hay footprint de design.md de al menos dos specs del grupo para confirmarla.
