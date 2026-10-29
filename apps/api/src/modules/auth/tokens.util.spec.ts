import { generarTokenOpaco, hashHmac, hashSha256 } from './tokens.util';

describe('tokens.util', () => {
  it('genera tokens únicos de 43 caracteres base64url', () => {
    const a = generarTokenOpaco();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(generarTokenOpaco()).not.toBe(a);
  });

  it('SHA-256 es determinista, hexadecimal de 64 caracteres y distinto del token', () => {
    const hash = hashSha256('token');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashSha256('token')).toBe(hash);
    expect(hash).not.toContain('token');
  });

  it('HMAC depende del secreto y del token', () => {
    const base = hashHmac('secreto', 'token');
    expect(base).toMatch(/^[0-9a-f]{64}$/);
    expect(hashHmac('otro', 'token')).not.toBe(base);
    expect(hashHmac('secreto', 'otro')).not.toBe(base);
    expect(base).not.toBe(hashSha256('token'));
  });
});
