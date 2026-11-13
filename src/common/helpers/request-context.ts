import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContextStore {
  requestId: string;
  correlationId: string;
  userId?: string;
  roles?: string[];
}

export class RequestContext {
  private static readonly storage =
    new AsyncLocalStorage<RequestContextStore>();

  static run<T>(store: RequestContextStore, callback: () => T): T {
    return this.storage.run(store, callback);
  }

  static getStore(): RequestContextStore | undefined {
    return this.storage.getStore();
  }

  static get requestId(): string | undefined {
    return this.getStore()?.requestId;
  }

  static get correlationId(): string | undefined {
    return this.getStore()?.correlationId;
  }

  static get userId(): string | undefined {
    return this.getStore()?.userId;
  }

  static get roles(): string[] | undefined {
    return this.getStore()?.roles;
  }

  static set userId(value: string | undefined) {
    const store = this.getStore();
    if (store) {
      store.userId = value;
    }
  }

  static set roles(value: string[] | undefined) {
    const store = this.getStore();
    if (store) {
      store.roles = value;
    }
  }
}
