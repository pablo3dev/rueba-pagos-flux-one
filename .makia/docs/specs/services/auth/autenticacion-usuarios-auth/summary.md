# autenticacion-usuarios-auth

> Servicio de identidad del portal de pagos: registro, inicio y cierre de sesión, renovación segura de sesión y perfil, más la base de calidad del repositorio.

## Estado

| Estado global | Última actualización |
|:---:|:---:|
| `En progreso` | `2026-10-15` |

## Objetivo

Permitir que cada cliente se identifique de forma segura y que los demás servicios confíen en esa identidad.
Además deja lista la base del repositorio (calidad automática antes de cada commit), el contrato documentado del servicio y su empaquetado.
El servicio se compila, prueba y ejecuta solo con Docker, sin instalar nada en el equipo del desarrollador.

## Avance

| Fase | Estado |
|:---|:---:|
| Phase 1: Foundation, Schemas & Core Domain | `En progreso` |
| Phase 2: Core Logic & Application Layer | `Pendiente` |
| Phase 3: Presentation, Endpoints & Integration | `Pendiente` |
| Phase 4: Verification, Testing & Polish | `Pendiente` |

**Progreso global:** `25%` (4 de 16 tareas completadas)

## Qué puede hacer ya el usuario / Qué falta

- [ ] Registrarse con email y contraseña
- [ ] Iniciar sesión
- [ ] Renovar la sesión sin reescribir la contraseña (con detección de reutilización)
- [ ] Cerrar sesión
- [ ] Consultar su perfil
- [ ] Verificación de credenciales por otros servicios mediante llaves públicas publicadas
- [ ] Usuarios demo disponibles (alice, bob, carol)
- [ ] Estado de salud del servicio
- [ ] Contrato HTTP documentado (OpenAPI)
- [ ] Imagen de contenedor del servicio, ejecutable en Compose junto a su PostgreSQL
- [ ] Verificación automática de lint, formato y tipos antes de cada commit (ejecutada en un contenedor)
- [ ] Entorno de desarrollo en contenedores (Node 24.22.0 y PostgreSQL 18.6 con Docker Compose, sin instalar nada en el equipo)

## Coordinación multi-unidad

### (a) Specs hermanos

- [riel-bancario-simulado-bank-rail](../../bank-rail/riel-bancario-simulado-bank-rail/summary.md)
- [transferencias-internas-payments](../../payments/transferencias-internas-payments/summary.md)
- [autenticacion-usuarios-web](../../../apps/web/autenticacion-usuarios-web/summary.md)
- [transferencias-externas-payments](../../payments/transferencias-externas-payments/summary.md)
- [transferencias-internas-web](../../../apps/web/transferencias-internas-web/summary.md)
- [reversos-transferencias-payments](../../payments/reversos-transferencias-payments/summary.md)
- [transferencias-externas-web](../../../apps/web/transferencias-externas-web/summary.md)
- [auditoria-transferencias-payments](../../payments/auditoria-transferencias-payments/summary.md)
- [reversos-transferencias-web](../../../apps/web/reversos-transferencias-web/summary.md)
- [auditoria-transferencias-audit](../../audit/auditoria-transferencias-audit/summary.md)
- [auditoria-transferencias-web](../../../apps/web/auditoria-transferencias-web/summary.md)
- [entorno-local-infra](../../../infra/entorno-local-infra/summary.md)

### (b) Orden entre unidades

Este spec es el primero de la capacidad: los demás specs que verifican identidad dependen de él.

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
