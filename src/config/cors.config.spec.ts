import { buildCorsOptions, parseCorsOrigins } from './cors.config';

type OriginFn = (
  origin: string | undefined,
  cb: (err: Error | null, allow?: boolean) => void,
) => void;

function decide(origins: string[], origin: string | undefined): boolean {
  const fn = buildCorsOptions(origins).origin as OriginFn;
  let result = false;
  fn(origin, (_err, allow) => (result = allow === true));
  return result;
}

describe('CORS', () => {
  it('normaliza a lista de origens', () => {
    expect(
      parseCorsOrigins(' http://localhost:5173/ , ,https://app.example.com'),
    ).toEqual(['http://localhost:5173', 'https://app.example.com']);
  });

  const origins = ['http://localhost:5173', 'http://localhost:8081'];

  it('aceita origens da lista (web e Expo web)', () => {
    expect(decide(origins, 'http://localhost:5173')).toBe(true);
    expect(decide(origins, 'http://localhost:8081')).toBe(true);
  });

  it('recusa origens fora da lista', () => {
    expect(decide(origins, 'https://evil.example.com')).toBe(false);
  });

  it('aceita pedidos sem Origin (app nativa, curl)', () => {
    expect(decide(origins, undefined)).toBe(true);
  });

  it('"*" aceita qualquer origem', () => {
    expect(decide(['*'], 'https://qualquer.example.com')).toBe(true);
  });

  it('nunca pede credenciais ao browser', () => {
    expect(buildCorsOptions(origins).credentials).toBe(false);
  });
});
