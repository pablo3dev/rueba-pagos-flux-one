# autenticacion-usuarios-web

> Aplicación web del portal de pagos: el cliente se registra, inicia y cierra sesión, y su sesión se mantiene de forma silenciosa y segura.

## Estado

| Estado global | Última actualización |
|:---:|:---:|
| `Pendiente` | `2026-10-15` |

## Objetivo

Dar al cliente una interfaz para identificarse en el portal sin que sus credenciales queden expuestas en el navegador, sin interrupciones cuando su acceso de corta vida vence y con mensajes comprensibles cuando algo falla.
Además deja la base de la aplicación web sobre la que se construyen las demás pantallas del portal, y el servidor web que la sirve y reenvía las llamadas al servicio de autenticación desde un único origen.
La aplicación se compila, verifica y ejecuta solo con Docker, sin instalar nada en el equipo del desarrollador.

## Avance

| Fase | Estado |
|:---|:---:|
| Phase 1: Foundation, Schemas & Core Domain | `Pendiente` |
| Phase 2: Core Logic & Application Layer | `Pendiente` |
| Phase 3: Presentation, Endpoints & Integration | `Pendiente` |
| Phase 4: Verification, Testing & Polish | `Pendiente` |

**Progreso global:** `0%` (0 de 12 tareas completadas)

## Qué puede hacer ya el usuario / Qué falta

- [ ] Registrarse con email y contraseña desde la aplicación
- [ ] Iniciar sesión
- [ ] Mantener la sesión al recargar la página o al vencer el acceso, sin reescribir la contraseña
- [ ] Cerrar sesión
- [ ] Ver con qué cuenta está operando en una pantalla protegida
- [ ] Ser llevado al inicio de sesión, con una explicación clara, si la sesión deja de ser válida
- [ ] Mensajes de error comprensibles y sin doble envío en los formularios
- [ ] Aplicación servida desde un único origen con un servidor web que reenvía las llamadas de identidad
- [ ] Entorno de desarrollo, pruebas y ejecución en contenedores, sin instalar nada en el equipo

## Coordinación multi-unidad

### (a) Specs hermanos

- [autenticacion-usuarios-auth](../../../services/auth/autenticacion-usuarios-auth/summary.md)
- [riel-bancario-simulado-bank-rail](../../../services/bank-rail/riel-bancario-simulado-bank-rail/summary.md)
- [transferencias-internas-payments](../../../services/payments/transferencias-internas-payments/summary.md)
- [transferencias-externas-payments](../../../services/payments/transferencias-externas-payments/summary.md)
- [transferencias-internas-web](../transferencias-internas-web/summary.md)
- [reversos-transferencias-payments](../../../services/payments/reversos-transferencias-payments/summary.md)
- [transferencias-externas-web](../transferencias-externas-web/summary.md)
- [auditoria-transferencias-payments](../../../services/payments/auditoria-transferencias-payments/summary.md)
- [reversos-transferencias-web](../reversos-transferencias-web/summary.md)
- [auditoria-transferencias-audit](../../../services/audit/auditoria-transferencias-audit/summary.md)
- [auditoria-transferencias-web](../auditoria-transferencias-web/summary.md)
- [entorno-local-infra](../../../infra/entorno-local-infra/summary.md)

### (b) Orden entre unidades

Este spec depende solo de `autenticacion-usuarios-auth` (consume su contrato HTTP de identidad). Las pantallas de los demás specs de la web se construyen encima de esta base.

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
