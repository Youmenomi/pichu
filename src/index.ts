import autoBind from 'auto-bind';
import { IndexType, report } from './helper';

export type Listener = (...args: any[]) => any;
export type Form<TForm> = { [key in keyof TForm]: Listener };
export type ReturnAny<TForm extends Form<TForm>> = {
  [key in keyof TForm]: (...args: Parameters<TForm[key]>) => any;
};

enum ListenMode {
  on,
  once,
  asyncOnce,
}

export const offMsg = '[pichu] Asynchronous listening is turned off.';

let __debug_listening_count = 0;
export function __debug_get_listening_count() {
  return __debug_listening_count;
}
export function __debug_clear_listening_count() {
  return (__debug_listening_count = 0);
}

class Listen {
  _listensByEvent?: Set<Listen>;
  get listensByEvent() {
    /* istanbul ignore next */
    if (!this._listensByEvent) throw report();
    return this._listensByEvent;
  }
  _listensByListener?: Set<Listen>;
  get listensByListener() {
    /* istanbul ignore next */
    if (!this._listensByListener) throw report();
    return this._listensByListener;
  }
  constructor(
    public event: IndexType,
    public listener: Listener,
    public mode: ListenMode,
    public resolve?: Function,
    public reject?: Function
  ) {
    __debug_listening_count++;
  }
  deploy(_listensByEvent: Set<Listen>, listensByListener: Set<Listen>) {
    this._listensByEvent = _listensByEvent;
    this._listensByEvent.add(this);
    this._listensByListener = listensByListener;
    this._listensByListener.add(this);
    return this;
  }
  same(event: IndexType, listener: Listener) {
    return event === this.event && listener === this.listener;
  }
  exec(...arg: any[]) {
    const listener = this.listener;
    if (this.mode !== ListenMode.on) this.dispose();
    listener(...arg);
  }
  dispose() {
    this.listensByEvent.delete(this);
    this._listensByEvent = undefined;
    this.listensByListener.delete(this);
    this._listensByListener = undefined;
    //@ts-expect-error
    this.listener = undefined;

    this.reject = undefined;
    this.resolve = undefined;

    __debug_listening_count--;
  }
}

export class Pichu<TForm extends Form<TForm> = Form<any>> {
  protected _eventMap = new Map<IndexType, Set<Listen>>();
  protected _listenerMap = new Map<Listener, Set<Listen>>();

  constructor() {
    autoBind(this);
  }

  protected add(
    event: IndexType,
    listener: Listener,
    mode: ListenMode.on | ListenMode.once
  ): null | Listen;
  protected add(
    event: IndexType,
    listener: Listener,
    mode: ListenMode.asyncOnce,
    resolve: Function,
    reject: Function
  ): Listen;
  protected add(
    event: IndexType,
    listener: Listener,
    mode: ListenMode,
    resolve?: Function,
    reject?: Function
  ) {
    let listensByEvent = this._eventMap.get(event);
    if (listensByEvent) {
      if (
        [...listensByEvent].some((listen) => {
          return listen.listener === listener;
        })
      ) {
        console.warn(
          `[pichu] Invalid operation, there is a duplicate listener.`
        );
        return null;
      }
      let listensByListener = this._listenerMap.get(listener);
      if (!listensByListener) {
        listensByListener = new Set<Listen>();
        this._listenerMap.set(listener, listensByListener);
      }
      return new Listen(event, listener, mode, resolve, reject).deploy(
        listensByEvent,
        listensByListener
      );
    }
    listensByEvent = new Set();
    this._eventMap.set(event, listensByEvent);
    const listensByListener = new Set<Listen>();
    this._listenerMap.set(listener, listensByListener);
    return new Listen(event, listener, mode, resolve, reject).deploy(
      listensByEvent,
      listensByListener
    );
  }

  emit<T extends keyof TForm>(event: T, ...args: Parameters<TForm[T]>) {
    const listensByEvent = this._eventMap.get(event);
    if (!listensByEvent || listensByEvent.size === 0) return false;
    listensByEvent.forEach((listen) => {
      listen.exec(...args);
    });
    return true;
  }

  on<T extends keyof TForm>(event: T, listener: ReturnAny<TForm>[T]) {
    return !!this.add(event, listener, ListenMode.on);
  }

  once<T extends keyof TForm>(event: T, listener: ReturnAny<TForm>[T]) {
    return !!this.add(event, listener, ListenMode.once);
  }

  asyncOnce<T extends keyof TForm>(event: T) {
    let listen: Listen;
    const promise = new Promise((resolve, reject) => {
      listen = this.add(
        event,
        (...args: any) => {
          resolve(args);
        },
        ListenMode.asyncOnce,
        resolve,
        reject
      );
    });
    (promise as any).off = () => {
      const reject = listen.reject;
      listen.dispose();
      /* istanbul ignore next */
      if (!reject) throw report();
      reject(offMsg);
    };
    return promise as Promise<Parameters<TForm[T]>> & { off: () => void };
  }

  off<T extends keyof TForm>(event: T, listener: ReturnAny<TForm>[T]) {
    const listensByEvent = this._eventMap.get(event);
    if (!listensByEvent) return;
    [...listensByEvent].some((liten) => {
      if (liten.same(event, listener)) {
        liten.dispose();
        return true;
      } else return false;
    });
  }

  offAll(): void;
  offAll(listener: ReturnAny<TForm>[keyof TForm]): void;
  offAll(event: keyof TForm): void;
  offAll(eventOrListener?: keyof TForm | Listener) {
    if (eventOrListener === undefined) {
      this._eventMap.forEach((listens) => {
        listens.forEach((listen) => {
          listen.dispose();
        });
      });
    } else if (typeof eventOrListener === 'function') {
      const listensByListener = this._listenerMap.get(eventOrListener);
      if (!listensByListener) return;
      listensByListener.forEach((listen) => {
        listen.dispose();
      });
    } else {
      const listensByEvent = this._eventMap.get(eventOrListener);
      if (!listensByEvent) return;
      listensByEvent.forEach((listen) => {
        listen.dispose();
      });
    }
  }

  listenerCount(): void;
  listenerCount(listener: ReturnAny<TForm>[keyof TForm]): void;
  listenerCount(event: keyof TForm): void;
  listenerCount(eventOrListener?: keyof TForm | Listener) {
    if (eventOrListener === undefined) {
      let count = 0;
      this._eventMap.forEach((listensByEvent) => {
        count += listensByEvent.size;
      });
      return count;
    } else if (typeof eventOrListener === 'function') {
      const listensByListener = this._listenerMap.get(eventOrListener);
      return listensByListener ? listensByListener.size : 0;
    } else {
      const listensByEvent = this._eventMap.get(eventOrListener);
      return listensByEvent ? listensByEvent.size : 0;
    }
  }

  dispose() {
    this.offAll();

    this._eventMap.clear();
    //@ts-expect-error
    this._eventMap = undefined;
    this._listenerMap.clear();
    //@ts-expect-error
    this._listenerMap = undefined;
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
