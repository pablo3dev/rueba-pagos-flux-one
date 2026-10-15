import type { Writable } from 'node:stream';
import type { FastifyInstance } from 'fastify';
import { JsonlFileLedger } from './adapters/outbound/ledger/jsonl-file-ledger.js';
import { RandomOutcomePicker } from './adapters/outbound/random/random-outcome-picker.js';
import { SystemDelay } from './adapters/outbound/time/system-delay.js';
import { buildApp, type RailUseCases } from './adapters/inbound/http/app.js';
import { OperationFlow } from './application/operation-flow.js';
import type { Delay } from './application/ports/delay.js';
import type { Ledger } from './application/ports/ledger.js';
import type { OutcomePicker } from './application/ports/outcome-picker.js';
import { SerialExecutor } from './application/serial-executor.js';
import { GetOperation } from './application/use-cases/get-operation.js';
import { SubmitReversal } from './application/use-cases/submit-reversal.js';
import { SubmitTransfer } from './application/use-cases/submit-transfer.js';
import type { Config } from './config.js';

export async function composeApp(options: {
  config: Config;
  outcomePicker?: OutcomePicker;
  delay?: Delay;
  ledger?: Ledger;
  logStream?: Writable;
}): Promise<FastifyInstance> {
  const fileLedger =
    options.ledger === undefined
      ? await JsonlFileLedger.open(options.config.ledgerPath)
      : undefined;
  const ledger = options.ledger ?? fileLedger;
  if (ledger === undefined) {
    throw new Error('No hay ledger para componer el riel.');
  }
  const outcomePicker =
    options.outcomePicker ?? new RandomOutcomePicker(options.config.outcomeWeights);
  const delay = options.delay ?? new SystemDelay();
  const flow = new OperationFlow({
    ledger,
    picker: outcomePicker,
    delay,
    executor: new SerialExecutor(),
    timeoutDelayMs: options.config.timeoutDelayMs,
  });
  const useCases: RailUseCases = {
    submitTransfer: new SubmitTransfer({ flow }),
    submitReversal: new SubmitReversal({ flow, ledger }),
    getOperation: new GetOperation({ ledger }),
  };
  const app = buildApp({ config: options.config, useCases, logStream: options.logStream });
  if (fileLedger !== undefined) {
    for (const warning of fileLedger.loadWarnings) {
      app.log.warn(
        { event: warning.event, line: warning.line, bytes: warning.bytes },
        warning.event,
      );
    }
  }
  return app;
}
