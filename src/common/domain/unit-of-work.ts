/**
 * Porta de "unidade de trabalho": executa `work` numa transação — ou tudo
 * fica gravado, ou nada fica.
 *
 * O use case recebe os repositórios **já ligados à transação** como argumento
 * do callback (`repos`), em vez de os ir buscar a um contexto implícito: fica
 * explícito no código quais as escritas que pertencem à mesma transação, e os
 * testes unitários podem trocar a implementação por uma em memória.
 *
 * Se `work` lançar um erro, a transação é revertida (rollback) e o erro
 * propaga-se ao chamador.
 */
export interface IUnitOfWork<TRepos> {
  run<T>(work: (repos: TRepos) => Promise<T>): Promise<T>;
}
