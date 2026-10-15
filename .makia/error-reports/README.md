# Error-reports de MakIA

Esta carpeta es el bucle de mejora continua de MakIA: cada `ER-<NNN>-<spec-slug>.md` registra un evento de fricción del ciclo de desarrollo (una iteración de IMPLEMENT, un rechazo de AUDIT, un gap de `learning.md`, un fallo de aislamiento del host, etc.) y su causa raíz clasificada, para refinar las plantillas y los prompts de IDEA y SPEC.

- **Plantilla:** `_TEMPLATE.md`.
- **Índice:** `INDEX.md` (una fila por reporte).
- **Fuente de verdad del mecanismo** (lista cerrada de disparadores, taxonomía de causa raíz, regla de de-duplicación, quién reporta a quién): `../core/agents/orchestrator/sub-orchestrator.md` § "Disparadores de error-report".
- **Ciclo de vida, autoría y asincronía:** `../core/agents/orchestrator/orchestrator.md` § "Mejora continua / reporte de error".

Reglas rápidas:
- El mecanismo es siempre asíncrono: un reporte nunca bloquea IMPLEMENT/TEST/AUDIT/DEPLOY.
- La mecánica (numeración, metadatos, fila de `INDEX.md`, cambio de estado y purga) la ejecuta `makia er open|triage|close`; el LLM solo redacta el cuerpo del análisis.
- Esta carpeta se versiona y su contenido llega a `main`.
- Estados: Abierto -> Triage -> { Resuelto | Aceptado-como-deuda | Escalado-a-IDEA | Escalado-a-SPEC }. Solo el Orquestador transiciona.
- Numeración: consecutivo global de 3 dígitos (`ER-001`, `ER-002`, ...), nunca reutilizado.
- Cada reporte registra la versión de MakIA instalada en el proyecto (`.makia/core/VERSION`) en el momento de apertura, para que el Triage identifique si una versión posterior ya resolvió la fricción o si sigue abierta.
