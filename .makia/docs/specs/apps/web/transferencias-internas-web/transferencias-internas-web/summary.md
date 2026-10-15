# transferencias-internas-web

> El cliente autenticado ve cuentas y saldos, transfiere dinero en COP a otra cuenta del sistema sin duplicar el envío, ve el resultado y consulta su historial.

## Estado

| Estado global | Última actualización |
|:---:|:---:|
| `Pendiente` | `2026-10-15` |

## Objetivo

Dar al cliente autenticado pantallas para ver cuánto tiene, mover dinero en COP a otra cuenta del sistema con certeza del resultado (completada o no realizada por fondos insuficientes) y revisar enviadas y recibidas. Un doble clic o un reintento tras un corte no mueve el dinero dos veces; cada rechazo se explica en español claro. Amplía la aplicación web ya existente (sesión, cierre, renovación) y el servidor web reenvía las llamadas de Pagos desde el mismo origen. Todo se compila, verifica y ejecuta solo con Docker, sin instalar nada en el equipo del desarrollador.

## Avance

| Fase | Estado |
|:---|:---:|
| Phase 1: Foundation, Schemas & Core Domain | `Pendiente` |
| Phase 2: Core Logic & Application Layer | `Pendiente` |
| Phase 3: Presentation, Endpoints & Integration | `Pendiente` |
| Phase 4: Verification, Testing & Polish | `Pendiente` |

**Progreso global:** `0%` (0 de 22 tareas completadas)

## Qué puede hacer ya el usuario / Qué falta

- [ ] Ver sus cuentas y el saldo de cada una al entrar
- [ ] Transferir dinero en COP a otra cuenta del sistema
- [ ] No duplicar el movimiento con doble clic o reintento (una sola clave de idempotencia por intención)
- [ ] Ver el resultado: completada, o no realizada por fondos insuficientes
- [ ] Consultar el historial de enviadas y recibidas, de la más reciente a la más antigua, con carga progresiva
- [ ] Mensajes de error comprensibles (monto inválido, cuenta inexistente, sesión vencida, red caída) y formulario listo para corregir
- [ ] Que la autenticación existente (iniciar, renovar y cerrar sesión) siga funcionando sin cambios
- [ ] Pantallas operables con teclado y lector de pantalla
- [ ] Aplicación servida desde un único origen, con el servidor web reenviando las llamadas de Pagos
- [ ] Entorno de desarrollo, pruebas y ejecución en contenedores, sin instalar nada en el equipo

## Coordinación multi-unidad

`apps/web` no tiene `domain-model.md` propio. El modelo de negocio es el [domain-model.md de Pagos](../../../services/payments/domain-model.md).

### (a) Specs hermanos

- [autenticacion-usuarios-auth](../../../services/auth/autenticacion-usuarios-auth/summary.md)
- [riel-bancario-simulado-bank-rail](../../../services/bank-rail/riel-bancario-simulado-bank-rail/summary.md)
- [transferencias-internas-payments](../../../services/payments/transferencias-internas-payments/summary.md)
- [autenticacion-usuarios-web](../autenticacion-usuarios-web/summary.md)
- [transferencias-externas-payments](../../../services/payments/transferencias-externas-payments/summary.md)
- [reversos-transferencias-payments](../../../services/payments/reversos-transferencias-payments/summary.md)
- [transferencias-externas-web](../transferencias-externas-web/summary.md)
- [auditoria-transferencias-payments](../../../services/payments/auditoria-transferencias-payments/summary.md)
- [reversos-transferencias-web](../reversos-transferencias-web/summary.md)
- [auditoria-transferencias-audit](../../../services/audit/auditoria-transferencias-audit/summary.md)
- [auditoria-transferencias-web](../auditoria-transferencias-web/summary.md)
- [entorno-local-infra](../../../infra/entorno-local-infra/summary.md)

### (b) Orden entre unidades

Este spec depende de `transferencias-internas-payments` (consume su contrato HTTP de Pagos) y de `autenticacion-usuarios-web` (amplía la aplicación base de sesión y servidor web). Es paralelo en creación con `transferencias-externas-payments` (unidades distintas, sin archivos en común).

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
