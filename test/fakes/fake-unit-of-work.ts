import { IUnitOfWork } from '@common/domain/unit-of-work';

/** Ações que desfazem as escritas de uma transação em memória. */
export type UndoLog = Array<() => void>;

/**
 * Unidade de trabalho em memória com rollback real: cada repositório ligado à
 * "transação" regista como desfazer o que escreveu; se `work` lançar um erro,
 * as escritas são desfeitas pela ordem inversa — tal como um ROLLBACK.
 *
 * O desfazer aplica o movimento inverso (ex.: `saldo - x`) em vez de repor um
 * valor antigo, para não apagar escritas de outras transações concorrentes.
 */
export class FakeUnitOfWork<TRepos> implements IUnitOfWork<TRepos> {
  commits = 0;
  rollbacks = 0;

  constructor(private readonly bind: (undo: UndoLog) => TRepos) {}

  async run<T>(work: (repos: TRepos) => Promise<T>): Promise<T> {
    const undo: UndoLog = [];
    try {
      const result = await work(this.bind(undo));
      this.commits += 1;
      return result;
    } catch (error) {
      this.rollbacks += 1;
      undo.reverse().forEach((revert) => revert());
      throw error;
    }
  }
}
