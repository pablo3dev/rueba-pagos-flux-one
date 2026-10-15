export interface PublicJwk {
  kty: 'OKP';
  crv: 'Ed25519';
  x: string;
  kid: string;
  alg: 'EdDSA';
  use: 'sig';
}

export interface SigningKey {
  kid: string; // uuid
  alg: 'EdDSA';
  publicJwk: PublicJwk;
  privateKeyPkcs8: string; // PEM PKCS#8; nunca sale del servicio
  active: boolean;
  createdAt: Date;
}
