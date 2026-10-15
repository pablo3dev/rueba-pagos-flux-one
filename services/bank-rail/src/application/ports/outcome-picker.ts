// port: out — sortear el resultado y si un timeout fue procesado
import type { RailOutcome } from '../../domain/outcome.js';

export interface OutcomePicker {
  // Sortea según los pesos.
  pick(): RailOutcome;
  // Segunda consulta tras TIMEOUT: ¿el banco procesó la operación? (50/50 por defecto)
  pickTimeoutProcessed(): boolean;
}
