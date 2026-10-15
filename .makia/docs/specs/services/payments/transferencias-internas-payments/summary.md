# transferencias-internas-payments

> Servicio de Pagos del portal: el cliente consulta sus cuentas y saldos, transfiere dinero en COP entre cuentas del sistema y revisa sus transferencias, sin duplicar débitos ni dejar saldos negativos.

## Estado

| Estado global | Última actualización |
|:---:|:---:|
| `Pendiente` | `2026-10-15` |

## Objetivo

Permitir que un cliente autenticado mueva dinero entre cuentas del sistema y sepa cuánto tiene, con la garantía de que reintentos, doble clic o solicitudes simultáneas nunca duplican un débito ni dejan un saldo negativo.
Cada usuario ve únicamente sus propias cuentas y las transferencias en las que participa.
El servicio se compila, prueba y ejecuta solo con Docker, sin instalar nada en el equipo del desarrollador.

## Avance

| Fase | Estado |
|:---|:---:|
| Phase 1: Foundation, Schemas & Core Domain | `Pendiente` |
| Phase 2: Core Logic & Application Layer | `Pendiente` |
| Phase 3: Presentation, Endpoints & Integration | `Pendiente` |
| Phase 4: Verification, Testing & Polish | `Pendiente` |

**Progreso global:** `0%` (0 de 16 tareas completadas)

## Qué puede hacer ya el usuario / Qué falta

- [ ] Listar sus cuentas y consultar el saldo de cada una
- [ ] Transferir dinero en COP a otra cuenta del sistema
- [ ] Repetir una solicitud sin duplicar el movimiento (clave de idempotencia)
- [ ] Recibir un rechazo claro por fondos insuficientes, sin que se mueva dinero
- [ ] Consultar una transferencia concreta
- [ ] Ver su historial de transferencias, paginado
- [ ] Acceso solo con credenciales válidas emitidas por el servicio de autenticación
- [ ] Cuentas y saldos iniciales de demostración disponibles al arrancar
- [ ] Estado de salud del servicio
- [ ] Contrato HTTP documentado (OpenAPI)
- [ ] Imagen de contenedor del servicio, ejecutable en Compose
- [ ] Entorno de desarrollo y pruebas en contenedores, sin instalar nada en el equipo

## Coordinación multi-unidad

### (a) Specs hermanos

- [autenticacion-usuarios-auth](../../auth/autenticacion-usuarios-auth/summary.md)
- [riel-bancario-simulado-bank-rail](../../bank-rail/riel-bancario-simulado-bank-rail/summary.md)
- [autenticacion-usuarios-web](../../../apps/web/autenticacion-usuarios-web/summary.md)
- [transferencias-externas-payments](../transferencias-externas-payments/summary.md)
- [transferencias-internas-web](../../../apps/web/transferencias-internas-web/summary.md)
- [reversos-transferencias-payments](../reversos-transferencias-payments/summary.md)
- [transferencias-externas-web](../../../apps/web/transferencias-externas-web/summary.md)
- [auditoria-transferencias-payments](../auditoria-transferencias-payments/summary.md)
- [reversos-transferencias-web](../../../apps/web/reversos-transferencias-web/summary.md)
- [auditoria-transferencias-audit](../../audit/auditoria-transferencias-audit/summary.md)
- [auditoria-transferencias-web](../../../apps/web/auditoria-transferencias-web/summary.md)
- [entorno-local-infra](../../../infra/entorno-local-infra/summary.md)

### (b) Orden entre unidades

Este spec depende solo de `autenticacion-usuarios-auth` (verifica las credenciales que ese servicio emite). Es la unidad dueña del modelo de negocio de la capacidad: los demás specs de Pagos y de la web lo amplían o lo consumen.

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

- [ ] Todas las tareas de los specs hermanos marcadas `[x]`
- [ ] TEST y AUDIT aprobados por unidad
- [ ] Prueba E2E cross-unidad aprobada
