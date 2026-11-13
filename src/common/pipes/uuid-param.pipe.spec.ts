import { UuidParamPipe } from './uuid-param.pipe';

describe('UuidParamPipe', () => {
  const pipe = new UuidParamPipe();
  const metadata = { type: 'param' as const, data: 'id' };

  it('aceita um UUID', () => {
    const id = '3f1c2a9e-5b7d-4c8e-9f0a-1b2c3d4e5f60';
    expect(pipe.transform(id, metadata)).toBe(id);
  });

  it.each(['abc', '1', "1' OR '1'='1", ''])(
    'rejeita "%s" com 400 VALIDATION_ERROR',
    (value) => {
      let thrown: unknown;
      try {
        pipe.transform(value, metadata);
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toMatchObject({
        code: 'VALIDATION_ERROR',
        errors: [{ field: 'id', message: 'id deve ser um UUID válido' }],
      });
    },
  );
});
