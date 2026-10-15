// port: out — identificadores que el caso de uso necesita
export interface IdGenerator {
  newId(): string;
}
