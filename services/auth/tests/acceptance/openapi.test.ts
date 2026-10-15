import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const spec = readFileSync(new URL('../../openapi.yaml', import.meta.url), 'utf8');

// Rutas y métodos de design.md §4.2 con los códigos de respuesta que el contrato debe describir.
const OPERATIONS = [
  { path: '/auth/register', method: 'post', statuses: ['201', '400', '409', '429'] },
  { path: '/auth/login', method: 'post', statuses: ['200', '400', '401', '429'] },
  { path: '/auth/refresh', method: 'post', statuses: ['200', '401'] },
  { path: '/auth/logout', method: 'post', statuses: ['204'] },
  { path: '/auth/me', method: 'get', statuses: ['200', '401'] },
  { path: '/.well-known/jwks.json', method: 'get', statuses: ['200'] },
  { path: '/health/live', method: 'get', statuses: ['200'] },
  { path: '/health/ready', method: 'get', statuses: ['200', '503'] },
];

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Devuelve el texto de un bloque YAML (hasta la siguiente clave de su mismo nivel o superior).
function block(source: string, indent: number, key: string): string {
  const pad = ' '.repeat(indent);
  const start = new RegExp(`^${pad}${escapeRegExp(key)}:.*$`, 'm').exec(source);
  if (start === null) return '';
  const rest = source.slice(start.index + start[0].length);
  const end = new RegExp(`^ {0,${indent}}\\S`, 'm').exec(rest);
  return rest.slice(0, end === null ? undefined : end.index);
}

describe('Contrato OpenAPI', () => {
  it('[AC-AUT-26] openapi.yaml declara OpenAPI 3.1 y describe cada ruta, método y respuesta de design.md §4.2', () => {
    expect(spec).toMatch(/^openapi: 3\.1\.\d+$/m);

    const paths = block(spec, 0, 'paths');
    for (const { path, method, statuses } of OPERATIONS) {
      const pathBlock = block(paths, 2, path);
      expect(pathBlock, `ruta ${path}`).not.toBe('');
      const operation = block(pathBlock, 4, method);
      expect(operation, `${method.toUpperCase()} ${path}`).not.toBe('');
      const responses = block(operation, 6, 'responses');
      for (const status of statuses) {
        expect(responses, `${method.toUpperCase()} ${path} → ${status}`).toMatch(
          new RegExp(`^ {8}'${status}':`, 'm'),
        );
      }
    }
  });

  it('[AC-AUT-26] openapi.yaml define el esquema de error, la cookie refresh_token y el esquema bearer', () => {
    const components = block(spec, 0, 'components');

    // Esquema de error {error:{code,message}}.
    const errorSchema = block(block(components, 2, 'schemas'), 4, 'Error');
    expect(errorSchema).toMatch(/required: \[error\]/);
    expect(errorSchema).toMatch(/required: \[code, message\]/);
    for (const code of [
      'VALIDATION_ERROR',
      'EMAIL_TAKEN',
      'INVALID_CREDENTIALS',
      'RATE_LIMITED',
      'REFRESH_TOKEN_INVALID',
      'REFRESH_TOKEN_REUSED',
      'UNAUTHORIZED',
      'NOT_FOUND',
      'INTERNAL_ERROR',
    ]) {
      expect(errorSchema).toContain(code);
    }

    // Cookie de refresco y esquema bearer.
    const schemes = block(components, 2, 'securitySchemes');
    const cookieScheme = block(schemes, 4, 'refreshCookie');
    expect(cookieScheme).toMatch(/type: apiKey/);
    expect(cookieScheme).toMatch(/in: cookie/);
    expect(cookieScheme).toMatch(/name: refresh_token/);
    const bearerScheme = block(schemes, 4, 'bearerAuth');
    expect(bearerScheme).toMatch(/type: http/);
    expect(bearerScheme).toMatch(/scheme: bearer/);
    expect(block(spec, 0, 'paths')).toMatch(/- bearerAuth: \[\]/);
    expect(block(spec, 0, 'paths')).toMatch(/- refreshCookie: \[\]/);
  });
});
