// adapter: in — bucle de trabajo (despacho, conciliación y relay)
import type { Logger } from '../../../application/ports/logger.js';

export const POLL_INTERVAL_MS = 500;

export interface WorkUnit {
  execute(): Promise<number>;
}

export class PollingWorker {
  private timer: NodeJS.Timeout | null = null;
  private running: Promise<void> | null = null;
  private stopped = true;

  constructor(
    private readonly options: { name: string; useCase: WorkUnit; logger: Logger },
  ) {}

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    const loop = async (): Promise<void> => {
      while (!this.stopped) {
        const tick = this.runOnce()
          .then(() => undefined)
          .catch((error: unknown) => {
            this.options.logger.error(
              { event: 'worker.tick_failed', worker: this.options.name, err: error },
              'tick fallido',
            );
          });
        this.running = tick;
        await tick;
        if (this.stopped) break;
        await new Promise<void>((resolve) => {
          this.timer = setTimeout(resolve, POLL_INTERVAL_MS);
        });
      }
    };
    void loop();
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    if (this.running) await this.running;
  }

  runOnce(): Promise<number> {
    return this.options.useCase.execute();
  }
}
