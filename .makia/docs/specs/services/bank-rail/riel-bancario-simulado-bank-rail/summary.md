# riel-bancario-simulado-bank-rail

> Banco externo simulado del portal de pagos: recibe transferencias y reversos y responde de forma aleatoria entre los cuatro resultados posibles, para que Pagos pueda probar cómo reacciona ante un banco poco confiable.

## Estado

| Estado global | Última actualización |
|:---:|:---:|
| `En progreso` | `2026-10-15` |

## Objetivo

Ofrecer un banco simulado que se comporta como un proveedor externo real: acepta o rechaza operaciones, a veces responde tarde o no responde, y nunca duplica una operación repetida con la misma referencia.
Su historial de operaciones persiste entre reinicios, de modo que una misma referencia siempre obtiene el mismo resultado.
El servicio se compila, prueba y ejecuta solo con Docker, sin instalar nada en el equipo del desarrollador.

## Avance

| Fase | Estado |
|:---|:---:|
| Phase 1: Foundation & Domain | `En progreso` |
| Phase 2: Core Logic & Application | `Pendiente` |
| Phase 3: Presentation & Endpoints | `Pendiente` |
| Phase 4: Verification & Polish | `Pendiente` |

**Progreso global:** `17%` (2 de 12 tareas completadas)

## Qué puede hacer ya el usuario / Qué falta

- [ ] Enviar una transferencia al banco y recibir uno de los cuatro resultados posibles
- [ ] Repetir la misma referencia y obtener siempre la misma respuesta, sin operación duplicada
- [ ] Consultar el estado de una transferencia por su referencia
- [ ] Solicitar el reverso de una transferencia, con reglas deterministas de aceptación y rechazo
- [ ] Conservar el historial de operaciones al reiniciar el servicio
- [ ] Rechazo claro de solicitudes mal formadas
- [ ] Estado de salud del servicio
- [ ] Contrato HTTP documentado (OpenAPI)
- [ ] Imagen de contenedor del servicio, ejecutable en Compose con volumen persistente
- [ ] Entorno de desarrollo y pruebas en contenedores, sin instalar nada en el equipo

## Coordinación multi-unidad

### (a) Specs hermanos

- [autenticacion-usuarios-auth](../../auth/autenticacion-usuarios-auth/summary.md)
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

Este spec depende solo de `autenticacion-usuarios-auth`. El riel se construye una sola vez y no se modifica después para hacer pasar casos de otros specs: Pagos lo consume más adelante.

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
