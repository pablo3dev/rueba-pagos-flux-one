// port: out — esperar y leer el reloj del riel
export interface Delay {
  wait(ms: number): Promise<void>;
  now(): Date;
}
