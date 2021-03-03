import autoBind from 'auto-bind';
import { IndexType, report } from './helper';

type Listener = (...args: any[]) => any;
type Listeners = (Listener | undefined)[];
type Wrappers = Map<IndexType, Listener[]>;
type Form<TForm> = { [key in keyof TForm]: Listener };
type ReturnAny<TForm extends Form<TForm>> = {
  [key in keyof TForm]: (...args: Parameters<TForm[key]>) => any;
};

export class Pichu<TForm extends Form<TForm> = Form<any>> {
  protected _directory = new Map<IndexType, Listeners>();
  protected _wrappedListeners = new Map<Listener, Wrappers>();

  static defaultMaxListeners = 10;
  protected _max = NaN;
  get maxListeners() {
    return isNaN(this._max) ? Pichu.defaultMaxListeners : this._max;
  }
  set maxListeners(value: number) {
    this._max = value;
  }

  protected _count = 0;
  get isEmitting() {
    return this._count !== 0;
  }

  protected eventGaps = new Map<IndexType, number>();

  constructor() {
    autoBind(this);
  }

  protected target(event: IndexType, create?: false): Listeners | undefined;
  protected target(event: IndexType, create: true): Listeners;
  protected target(event: IndexType, create = false) {
    let target = this._directory.get(event);
    if (target) {
      return target;
    } else if (create) {
      target = [];
      this._directory.set(event, target);
      return target;
    } else {
      return undefined;
    }
  }

  protected add(event: string, list: Listeners, listener: Listener) {
    if (!list.includes(listener)) {
      if (list.length > this.maxListeners - 1)
        throw new Error(
          `[pichu] The "${event}" listeners exceed the maximum limit of "${this.maxListeners}".`
        );
      else list.push(listener);
    } else {
      if (process.env.NODE_ENV === 'development')
        console.warn(
          `[pichu] Invalid operation, there is a duplicate listener.`
        );
    }
  }

  protected sortout() {
    this.eventGaps.forEach((_gaps, event) => {
      const target = this.target(event);
      /* istanbul ignore next */
      if (!target) throw report();
      let i = target.indexOf(undefined);
      while (i >= 0) {
        target.splice(i, 1);
        i = target.indexOf(undefined);
      }
      this.eventGaps.delete(event);
      if (target.length === 0) {
        this._directory.delete(event);
      }
    });
  }

  emit<T extends keyof TForm>(event: T, ...args: Parameters<TForm[T]>) {
    const target = this.target(event);
    if (!target) return false;
    let empty = true;
    target.forEach((listener) => {
      if (listener) {
        empty = false;
        this._count++;
        listener(...args);
        this._count--;
      }
    });
    if (this._count === 0) this.sortout();
    return !empty;
  }

  on<T extends keyof TForm & string>(event: T, listener: ReturnAny<TForm>[T]) {
    this.internalOn(this.target(event, true), event, listener);
  }

  protected internalOn(target: Listeners, event: string, listener: Listener) {
    this.add(event, target, listener);
  }

  once<T extends keyof TForm & string>(
    event: T,
    listener: ReturnAny<TForm>[T]
  ) {
    const target = this.target(event, true);
    const onceWrapper = (...args: Parameters<TForm[T]>) => {
      this.internalOffOnce(target, event, listener);
      listener(...args);
    };
    this.toWrappedListeners(listener, event, onceWrapper);
    this.internalOn(target, event, onceWrapper);
  }

  async asyncOnce<T extends keyof TForm & string>(
    event: T,
    listener: ReturnAny<TForm>[T]
  ) {
    return new Promise<void>((resolve) => {
      const target = this.target(event, true);
      const asyncOnceWrapper = async (...args: Parameters<TForm[T]>) => {
        this.internalOffOnce(target, event, listener);
        await listener(...args);
        resolve();
      };
      this.toWrappedListeners(listener, event, asyncOnceWrapper);
      this.internalOn(target, event, asyncOnceWrapper);
    });
  }

  protected toWrappedListeners(
    listener: Listener,
    event: string,
    wrapper: Listener
  ) {
    const wrappers = this._wrappedListeners.get(listener);
    if (wrappers) {
      const list = wrappers.get(event);
      if (list) list.push(wrapper);
      else wrappers.set(event, [wrapper]);
    } else {
      this._wrappedListeners.set(listener, new Map([[event, [wrapper]]]));
    }
  }

  off<T extends keyof TForm>(
    event: T,
    listener: ReturnAny<TForm>[T],
    andOffAllOnce = false
  ) {
    const target = this.target(event);
    if (!target) return;
    if (
      this.internalOff(target, event, listener, andOffAllOnce) &&
      !this.isEmitting
    ) {
      this.sortout();
    }
  }

  protected internalOff(
    target: Listeners,
    event: IndexType,
    listener: Listener,
    andOffAllOnce = false
  ) {
    let a = false;
    target.forEach((func, i) => {
      if (listener === func) {
        target[i] = undefined;
        let gaps = this.eventGaps.get(event);
        if (gaps) gaps++;
        else gaps = 1;
        this.eventGaps.set(event, gaps);
        a = true;
      }
    });

    let b = false;
    if (andOffAllOnce) {
      b = this.internalOffOnce(target, event, listener, true);
    }

    return a || b;
  }

  offOnce<T extends keyof TForm>(
    event: T,
    listener: ReturnAny<TForm>[T],
    offAll = false
  ) {
    const target = this.target(event);
    if (!target) return;
    if (
      this.internalOffOnce(target, event, listener, offAll) &&
      !this.isEmitting
    ) {
      this.sortout();
    }
  }

  protected internalOffOnce(
    target: Listeners,
    event: IndexType,
    listener: Listener,
    offAll = false
  ) {
    const wrappers = this._wrappedListeners.get(listener);
    if (wrappers) {
      const list = wrappers.get(event);
      /* istanbul ignore next */
      if (!list) throw report();
      let warpper = list.shift();
      if (offAll) {
        while (warpper) {
          this.internalOff(target, event, warpper);
          warpper = list.shift();
        }
      } else {
        /* istanbul ignore next */
        if (!warpper) throw report();
        this.internalOff(target, event, warpper);
      }
      if (list.length === 0) {
        wrappers.delete(event);
        if (wrappers.size === 0) this._wrappedListeners.delete(listener);
      }
      return true;
    } else {
      return false;
    }
  }

  offAll(event: keyof TForm, onlyOnce?: boolean): void;
  offAll(listener: ReturnAny<TForm>[keyof TForm], onlyOnce?: boolean): void;
  offAll(eventOrListener: keyof TForm | Listener, onlyOnce = false) {
    if (typeof eventOrListener === 'function') {
      this._directory.forEach((target, event) => {
        const a = this.internalOffOnce(target, event, eventOrListener, true);
        let b = false;
        if (!onlyOnce) {
          b = this.internalOff(target, event, eventOrListener, true);
        }
        if ((a || b) && !this.isEmitting) this.sortout();
      });
    } else {
      const event = eventOrListener;
      const target = this.target(event);
      if (!target) return;
      this._wrappedListeners.forEach((_key, listener) => {
        this.internalOffOnce(target, event, listener, true);
      });
      if (!onlyOnce) {
        target.forEach((listener) => {
          if (listener) this.internalOff(target, event, listener, true);
        });
      }
      if (!this.isEmitting) this.sortout();
    }
  }

  listenerCount(event: keyof TForm) {
    const target = this.target(event);
    if (!target) return 0;
    if (this.isEmitting) {
      let count = 0;
      target.forEach((listener) => {
        if (listener) count++;
      });
      return count;
    } else {
      return target.length;
    }
  }

  clear() {
    this._directory.forEach((target) => {
      target.length = 0;
    });
    this._directory.clear();
    this._wrappedListeners.clear();
    this.eventGaps.clear();
  }

  dispose() {
    this.clear();
    //@ts-expect-error
    this._directory = undefined;
    //@ts-expect-error
    this._wrappedListeners = undefined;
    //@ts-expect-error
    this.eventGaps = undefined;
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
