# ER-<NNN> — <título corto del evento de fricción>

> Reporte de error de mejora continua de MakIA. Asíncrono: nunca bloqueó ningún flujo.
> Lo redacta EDITOR por orden del Orquestador. La única fuente de verdad de su estado
> es el campo "Estado" de este archivo y su fila en `INDEX.md`.

## Metadata
- **ER:** ER-<NNN>
- **Fecha de apertura:** <YYYY-MM-DD>
- **Versión de MakIA en el proyecto:** <contenido literal de `.makia/core/VERSION` al abrir el reporte, ej. `v3.9.2`; `desconocida` si el archivo falta o está corrupto. El Orquestador lo suministra en el prompt de delegación — EDITOR no lee ese archivo por su cuenta>
- **Etapa donde se disparó:** IDEA | SPEC | IMPLEMENT | TEST | AUDIT | DEPLOY | Orquestación
- **Spec / Idea:** <spec-slug> (o `sin-spec`)
- **Tarea:** <task-id de tasks.md, o `—`>
- **Rama:** makia/<tipo>/<slug>
- **Estado:** Abierto | Triage | Resuelto | Aceptado-como-deuda | Escalado-a-IDEA | Escalado-a-SPEC

## Evento disparador
- **Disparador primario:** D-<NN> — <nombre>
- **Disparadores secundarios:** <D-NN, ...> o `—`
- **Quién lo detectó:** <agente>
- **Quién reportó a quién:** <agente> -> Orquestador
- **Descripción:** qué ocurrió exactamente, en 2-4 líneas.

## Evidencia
- **Commits:** <hashes / iteraciones `fix:` involucradas>
- **Archivos:** <rutas>
- **Salida relevante:** <fragmento acotado de TEST/AUDIT/linter — no pegues logs completos ni secretos>

## Causa raíz (clasificada)
- **Categoría:** CR-<NN> — <nombre>
- **Análisis:** por qué IDEA o SPEC no cerró esto con precisión. 2-5 líneas.

## Corrección aplicada
Qué se hizo para resolver la fricción inmediata (en el código, en el spec o en `learning.md`), y en qué iteración. No incluye el cambio de plantilla/prompt.

## Cambio propuesto a IDEA o SPEC (mejora continua)
- **Artefacto objetivo:** `idea.md` § <sección> | plantilla `draft.md` § <sección> | `spec.md` § <sección> | plantilla `requirements.md`/`design.md`/`tasks.md` § <sección> | regla de cobertura de `learning.md`
- **Cambio concreto propuesto:** redacción específica o regla nueva que habría evitado esta fricción.
- **Aplicado:** Sí (commit <hash>) | No (motivo) | Diferido (el ER queda en estado Aceptado-como-deuda)

## Transiciones de estado
| Fecha | De | A | Quién | Nota |
|---|---|---|---|---|
| <YYYY-MM-DD> | — | Abierto | Orquestador (redacta EDITOR) | Creación tras el evento |
