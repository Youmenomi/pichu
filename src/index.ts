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
  _eventMap?: Map<IndexType, Set<Listen>>;
  get eventMap() {
    /* istanbul ignore next */
    if (!this._eventMap) throw report();
    return this._eventMap;
  }

  _listenerMap?: Map<Listener, Set<Listen>>;
  get listenerMap() {
    /* istanbul ignore next */
    if (!this._listenerMap) throw report();
    return this._listenerMap;
  }

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
    public group?: any,
    public resolve?: Function,
    public reject?: Function
  ) {
    __debug_listening_count++;
  }
  deploy(
    eventMap: Map<IndexType, Set<Listen>>,
    listensByEvent: Set<Listen>,
    listenerMap: Map<Listener, Set<Listen>>,
    listensByListener: Set<Listen>
  ) {
    this._eventMap = eventMap;
    this._listensByEvent = listensByEvent;
    this._listensByEvent.add(this);
    this._listenerMap = listenerMap;
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
    if (this.listensByEvent.size === 0) {
      this.eventMap.delete(this.event);
    }
    this.listensByListener.delete(this);
    if (this.listensByListener.size === 0) {
      this.listenerMap.delete(this.listener);
    }

    this._eventMap = undefined;
    this._listensByEvent = undefined;
    this._listenerMap = undefined;
    this._listensByListener = undefined;
    //@ts-expect-error
    this.listener = undefined;
    this.group = undefined;
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
    mode: ListenMode.on | ListenMode.once,
    group?: any
  ): null | Listen;
  protected add(
    event: IndexType,
    listener: Listener,
    mode: ListenMode.asyncOnce,
    group: undefined,
    resolve: Function,
    reject: Function
  ): Listen;
  protected add(
    event: IndexType,
    listener: Listener,
    mode: ListenMode,
    group?: any,
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
        if (process.env.NODE_ENV === 'development')
          console.warn(
            `[pichu] Invalid operation, there is a duplicate listener.`
          );
        return null;
      }
      const listensByListener = new Set<Listen>();
      this._listenerMap.set(listener, listensByListener);
      return new Listen(event, listener, mode, group, resolve, reject).deploy(
        this._eventMap,
        listensByEvent,
        this._listenerMap,
        listensByListener
      );
    }
    listensByEvent = new Set();
    this._eventMap.set(event, listensByEvent);
    let listensByListener = this._listenerMap.get(listener);
    if (!listensByListener) {
      listensByListener = new Set<Listen>();
      this._listenerMap.set(listener, listensByListener);
    }
    return new Listen(event, listener, mode, group, resolve, reject).deploy(
      this._eventMap,
      listensByEvent,
      this._listenerMap,
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

  on<T extends keyof TForm>(
    event: T,
    listener: ReturnAny<TForm>[T],
    group?: any
  ) {
    return !!this.add(event, listener, ListenMode.on, group);
  }

  once<T extends keyof TForm>(
    event: T,
    listener: ReturnAny<TForm>[T],
    group?: any
  ) {
    return !!this.add(event, listener, ListenMode.once, group);
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
        undefined,
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

  offGroup(group: any): void;
  offGroup(group: any, listener: ReturnAny<TForm>[keyof TForm]): void;
  offGroup(group: any, event: keyof TForm): void;
  offGroup(group: any, eventOrListener?: keyof TForm | Listener) {
    if (group === undefined) return;
    if (eventOrListener === undefined) {
      this._eventMap.forEach((listens) => {
        listens.forEach((listen) => {
          if (group === listen.group) listen.dispose();
        });
      });
    } else if (typeof eventOrListener === 'function') {
      const listensByListener = this._listenerMap.get(eventOrListener);
      if (!listensByListener) return;
      listensByListener.forEach((listen) => {
        if (group === listen.group && eventOrListener === listen.listener)
          listen.dispose();
      });
    } else {
      const listensByEvent = this._eventMap.get(eventOrListener);
      if (!listensByEvent) return;
      listensByEvent.forEach((listen) => {
        if (group === listen.group && eventOrListener === listen.event)
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
