import { Hydreigon } from 'hydreigon';
import { IndexType } from './helper';

export type Listener = (...args: any[]) => any;
export type Form<TForm> = { [key in keyof TForm]: Listener };
export type ReturnAny<TForm extends Form<TForm>> = {
  [key in keyof TForm]: (...args: Parameters<TForm[key]>) => any;
};

enum Mode {
  on,
  once,
  asyncOnce,
}

enum Search {
  event = 'event',
  listener = 'listener',
  group = 'group',
}

type Condition =
  | [Search.event, IndexType]
  | [Search.listener, Listener]
  | [Search.group, any];

export const offMsg = '[pichu] Asynchronous listening is turned off.';

let __debug_listening_count = 0;
export function __debug_get_listening_count() {
  return __debug_listening_count;
}
export function __debug_clear_listening_count() {
  return (__debug_listening_count = 0);
}

class Listen {
  _executed = false;

  _isOnce = false;
  get isOnce() {
    return this._isOnce;
  }

  constructor(
    public event: IndexType,
    public listener: Listener,
    public mode: Mode,
    public group: any,
    public priority: number,
    public resolve?: Function,
    public reject?: Function
  ) {
    this._isOnce = this.mode !== Mode.on;
    __debug_listening_count++;
  }
  same(event: IndexType, listener: Listener) {
    return event === this.event && listener === this.listener;
  }
  exec(...arg: any[]) {
    this._executed = true;
    this.listener(...arg);
  }
  dispose() {
    if (this.reject && !this._executed) {
      this.reject(offMsg);
    }
    //@ts-expect-error
    this.listener = undefined;
    this.group = undefined;
    this.reject = undefined;
    this.resolve = undefined;

    __debug_listening_count--;
  }
}

export class Pichu<TForm extends Form<TForm> = Form<any>> {
  protected _indexer = new Hydreigon<Listen, Condition>(
    { index: Search.event, branch: [Search.listener] },
    Search.listener,
    { index: Search.group, branch: [Search.event, Search.listener] }
  );
  protected _dispatcher = new Dispatcher<Listen>();

  constructor(priority = false) {
    if (priority) {
      this._indexer.sort = (a, b) => {
        return b.priority - a.priority;
      };
    }
  }

  protected add(
    event: IndexType,
    listener: Listener,
    mode: Mode.on | Mode.once,
    group: any,
    priority: number
  ): null | Listen;
  protected add(
    event: IndexType,
    listener: Listener,
    mode: Mode.asyncOnce,
    group: undefined,
    priority: number,
    resolve: Function,
    reject: Function
  ): Listen;
  protected add(
    event: IndexType,
    listener: Listener,
    mode: Mode,
    group: any,
    priority: number,
    resolve?: Function,
    reject?: Function
  ) {
    if (
      this._indexer.searchSize(
        [Search.event, event],
        [Search.listener, listener]
      )
    ) {
      if (process.env.NODE_ENV === 'development')
        console.warn(
          '[pichu] Invalid operation, there is a duplicate listener.'
        );
      return null;
    }
    const listen = new Listen(
      event,
      listener,
      mode,
      group,
      priority,
      resolve,
      reject
    );
    this._indexer.add(listen);
    return listen;
  }

  protected removeListen(listen: Listen) {
    this._indexer.delete(listen);
    this._dispatcher.remove(listen);
  }

  emit<T extends keyof TForm>(event: T, ...args: Parameters<TForm[T]>) {
    const listensByEvent = this._indexer.search(false, [Search.event, event]);
    if (!listensByEvent || listensByEvent.size === 0) return false;
    this._dispatcher.forEach(listensByEvent, (listen) => {
      if (listen.isOnce) {
        this.removeListen(listen);
        listen.exec(...args);
        listen.dispose();
      } else {
        listen.exec(...args);
      }
    });
    return true;
  }

  emitGroup<T extends keyof TForm>(
    group: any,
    event: T,
    ...args: Parameters<TForm[T]>
  ) {
    const listens = this._indexer.search(
      false,
      [Search.group, group],
      [Search.event, event]
    );
    if (!listens || listens.size === 0) return false;
    this._dispatcher.forEach(listens, (listen) => {
      if (listen.isOnce) {
        this.removeListen(listen);
        listen.exec(...args);
        listen.dispose();
      } else {
        listen.exec(...args);
      }
    });
    return true;
  }

  on<T extends keyof TForm>(
    event: T,
    listener: ReturnAny<TForm>[T],
    group?: any,
    priority = 0
  ) {
    return !!this.add(event, listener, Mode.on, group, priority);
  }

  once<T extends keyof TForm>(
    event: T,
    listener: ReturnAny<TForm>[T],
    group?: any,
    priority = 0
  ) {
    return !!this.add(event, listener, Mode.once, group, priority);
  }

  asyncOnce<T extends keyof TForm>(event: T, group?: any, priority = 0) {
    let listen: Listen;
    const promise = new Promise((resolve, reject) => {
      listen = this.add(
        event,
        (...args: any) => {
          resolve(args);
        },
        Mode.asyncOnce,
        group,
        priority,
        resolve,
        reject
      );
    });
    (promise as any).off = () => {
      this.removeListen(listen);
      listen.dispose();
    };
    return promise as Promise<Parameters<TForm[T]>> & { off: () => void };
  }

  off<T extends keyof TForm>(event: T, listener: ReturnAny<TForm>[T]) {
    this._indexer.search(true, [Search.event, event]).some((listen) => {
      if (listen.same(event, listener)) {
        this.removeListen(listen);
        listen.dispose();
        return true;
      } else return false;
    });
  }

  offAll(): void;
  offAll(listener: ReturnAny<TForm>[keyof TForm]): void;
  offAll(event: keyof TForm): void;
  offAll(eventOrListener?: keyof TForm | Listener) {
    if (eventOrListener === undefined) {
      this._indexer.items().forEach((listen) => {
        this.removeListen(listen);
        listen.dispose();
      });
    } else if (typeof eventOrListener === 'function') {
      this._indexer
        .search(false, [Search.listener, eventOrListener])
        .forEach((listen) => {
          this.removeListen(listen);
          listen.dispose();
        });
    } else {
      this._indexer
        .search(false, [Search.event, eventOrListener])
        .forEach((listen) => {
          this.removeListen(listen);
          listen.dispose();
        });
    }
  }

  offGroup(group: any): void;
  offGroup(group: any, listener: ReturnAny<TForm>[keyof TForm]): void;
  offGroup(group: any, event: keyof TForm): void;
  offGroup(group: any, eventOrListener?: keyof TForm | Listener) {
    if (group === undefined) {
      throw new Error(`[pichu] "undefined" is not a valid parameter.`);
    }
    if (eventOrListener === undefined) {
      this._indexer.search(false, [Search.group, group]).forEach((listen) => {
        this.removeListen(listen);
        listen.dispose();
      });
    } else if (typeof eventOrListener === 'function') {
      this._indexer
        .search(
          false,
          [Search.group, group],
          [Search.listener, eventOrListener]
        )
        .forEach((listen) => {
          this.removeListen(listen);
          listen.dispose();
        });
    } else {
      this._indexer
        .search(false, [Search.group, group], [Search.event, eventOrListener])
        .forEach((listen) => {
          this.removeListen(listen);
          listen.dispose();
        });
    }
  }

  listenerCount(): void;
  listenerCount(listener: ReturnAny<TForm>[keyof TForm]): void;
  listenerCount(event: keyof TForm): void;
  listenerCount(eventOrListener?: keyof TForm | Listener) {
    if (eventOrListener === undefined) {
      return this._indexer.size;
    } else if (typeof eventOrListener === 'function') {
      return this._indexer.searchSize([Search.listener, eventOrListener]);
    } else {
      return this._indexer.searchSize([Search.event, eventOrListener]);
    }
  }

  countGroup(group: any): void;
  countGroup(group: any, listener: ReturnAny<TForm>[keyof TForm]): void;
  countGroup(group: any, event: keyof TForm): void;
  countGroup(group: any, eventOrListener?: keyof TForm | Listener) {
    if (group === undefined) {
      throw new Error(`[pichu] "undefined" is not a valid parameter.`);
    }
    if (eventOrListener === undefined) {
      return this._indexer.searchSize([Search.group, group]);
    } else if (typeof eventOrListener === 'function') {
      return this._indexer.searchSize(
        [Search.group, group],
        [Search.listener, eventOrListener]
      );
    } else {
      return this._indexer.searchSize(
        [Search.group, group],
        [Search.event, eventOrListener]
      );
    }
  }

  dispose() {
    this.offAll();

    this._indexer.dispose();
    //@ts-expect-error
    this._indexer = undefined;
    this._dispatcher.dispose();
    //@ts-expect-error
    this._dispatcher = undefined;
  }

  thunderShock<T extends keyof TForm>(event: T, ...args: Parameters<TForm[T]>) {
    return this.emit(event, ...args);
  }
  thunderPunch<T extends keyof TForm>(event: T, ...args: Parameters<TForm[T]>) {
    return this.emit(event, ...args);
  }
  thunderbolt<T extends keyof TForm>(event: T, ...args: Parameters<TForm[T]>) {
    return this.emit(event, ...args);
  }
}

export class Dispatcher<T = any> {
  _trips = new Set<Set<T>>();
  forEach(items: Set<T>, cb: (item: T) => void) {
    this._trips.add(items);
    items.forEach((item) => {
      cb(item);
    });
    this._trips.delete(items);
  }
  // manage discharge
  remove(item: T) {
    this._trips.forEach((items) => {
      items.delete(item);
    });
  }
  dispose() {
    this._trips.clear();
    //@ts-expect-error
    this._trips = undefined;
  }
}
