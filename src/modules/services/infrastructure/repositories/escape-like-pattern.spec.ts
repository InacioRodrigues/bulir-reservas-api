import { escapeLikePattern } from './prisma-service.repository';

describe('escapeLikePattern', () => {
  it('escapa os curingas do LIKE para pesquisa literal', () => {
    expect(escapeLikePattern('100%')).toBe('100\\%');
    expect(escapeLikePattern('a_b')).toBe('a\\_b');
    expect(escapeLikePattern('c:\\dir')).toBe('c:\\\\dir');
    expect(escapeLikePattern('cabelo')).toBe('cabelo');
  });
});
