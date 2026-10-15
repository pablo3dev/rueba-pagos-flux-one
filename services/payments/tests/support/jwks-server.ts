import { createServer, type Server } from 'node:http';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';

export interface JwksFixture {
  server: Server;
  url: string;
  token(userId: string, overrides?: { exp?: number; iss?: string; aud?: string }): Promise<string>;
  close(): Promise<void>;
}

export async function startJwks(): Promise<JwksFixture> {
  const { publicKey, privateKey } = await generateKeyPair('EdDSA', { crv: 'Ed25519', extractable: true });
  const jwk = await exportJWK(publicKey);
  jwk.alg = 'EdDSA';
  jwk.kid = 'test-key';
  jwk.use = 'sig';
  const server = createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ keys: [jwk] }));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('jwks sin puerto');
  return {
    server,
    url: `http://127.0.0.1:${address.port}/.well-known/jwks.json`,
    token: (userId, overrides) => sign(privateKey, userId, overrides),
    close: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

async function sign(
  key: Awaited<ReturnType<typeof generateKeyPair>>['privateKey'],
  userId: string,
  overrides?: { exp?: number; iss?: string; aud?: string },
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: 'EdDSA', kid: 'test-key' })
    .setSubject(userId)
    .setIssuer(overrides?.iss ?? 'urn:fluxone:auth')
    .setAudience(overrides?.aud ?? 'urn:fluxone:api')
    .setIssuedAt(now)
    .setExpirationTime(overrides?.exp ?? now + 900)
    .sign(key);
}
