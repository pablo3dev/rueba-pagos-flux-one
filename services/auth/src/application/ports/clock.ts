// port: out — reloj que los casos de uso consultan una sola vez por ejecución
export interface Clock {
  now(): Date;
}
