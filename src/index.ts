type Listener = (...args: any[]) => any;
type Listeners = (Listener | undefined)[];
type Wrappers = { [event: string]: Listener[] };
type Form<TForm> = { [key in keyof TForm]: Listener };
type ReturnAny<TForm extends Form<TForm>> = {
  [key in keyof TForm]: (...args: Parameters<TForm[key]>) => any;
};

export class Pichu<TForm extends Form<TForm> = Form<any>> {
  protected _directory = new Map<string, Listeners>();
  protected _emittingNames: string[] = [];
  protected _wrappedListeners = new Map<Listener, Wrappers>();

  static defaultMaxListeners = 10;
  protected _max = NaN;
  get maxListeners() {
    return isNaN(this._max) ? Pichu.defaultMaxListeners : this._max;
  }
  set maxListeners(value: number) {
    this._max = value;
  }

  protected target(event: string, create?: false): Listeners | undefined;
  protected target(event: string, create: true): Listeners;
  protected target(event: string, create = false) {
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
          `[pichu] Invalid operation, because this "${event}" listener has been on.`
        );
    }
  }

  protected sortout(target: Listeners, event: string) {
    let i = target.indexOf(undefined);
    while (i >= 0) {
      target.splice(i, 1);
      i = target.indexOf(undefined);
    }
    if (target.length === 0) {
      this._directory.delete(event);
    }
  }

  protected isEmitting(event: string) {
    return this._emittingNames.indexOf(event) >= 0;
  }

  emit<T extends keyof TForm & string>(
    event: T,
    ...args: Parameters<TForm[T]>
  ) {
    const target = this.target(event);
    if (!target) return false;

    const isFirstShot = !this.isEmitting(event);
    if (isFirstShot) this._emittingNames.push(event);

    target.forEach((listener) => {
      if (listener) listener(...args);
    });

    if (isFirstShot) {
      this.sortout(target, event);
      this._emittingNames.splice(this._emittingNames.indexOf(event), 1);
    }

    return true;
  }

  on<T extends keyof TForm & string>(event: T, listener: ReturnAny<TForm>[T]) {
    this.internalOn(this.target(event, true), event, listener);
    return this;
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
    return this;
  }

  async asyncOnce<T extends keyof TForm & string>(
    event: T,
    listener: ReturnAny<TForm>[T]
  ) {
    return new Promise((resolve) => {
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
      const list = wrappers[event];
      if (list) list.push(wrapper);
    } else {
      this._wrappedListeners.set(listener, { [event]: [wrapper] });
    }
  }

  off<T extends keyof TForm & string>(
    event: T,
    listener: ReturnAny<TForm>[T],
    andOffAllOnce = false
  ) {
    const target = this.target(event);
    if (!target) return this;
    if (
      this.internalOff(target, event, listener, andOffAllOnce) &&
      !this.isEmitting(event)
    ) {
      this.sortout(target, event);
    }
    return this;
  }

  protected internalOff(
    target: Listeners,
    event: string,
    listener: Listener,
    andOffAllOnce = false
  ) {
    let a = false;
    target.forEach((func, i) => {
      if (listener === func) {
        target[i] = undefined;
        a = true;
      }
    });

    let b = false;
    if (andOffAllOnce) {
      b = this.internalOffOnce(target, event, listener, true);
    }

    return a || b;
  }

  offOnce<T extends keyof TForm & string>(
    event: T,
    listener: ReturnAny<TForm>[T],
    offAll = false
  ) {
    const target = this.target(event);
    if (!target) return this;
    if (
      this.internalOffOnce(target, event, listener, offAll) &&
      !this.isEmitting(event)
    ) {
      this.sortout(target, event);
    }
    return this;
  }

  protected internalOffOnce(
    target: Listeners,
    event: string,
    listener: Listener,
    offAll = false
  ) {
    const wrappers = this._wrappedListeners.get(listener);
    if (wrappers) {
      const list = wrappers[event];
      let warpper = list.shift();
      if (offAll) {
        while (warpper) {
          this.internalOff(target, event, warpper);
          warpper = list.shift();
        }
      } else {
        //This is the expected logical design. When wrappers exist, at least one warpper will exist.
        this.internalOff(target, event, warpper!);
      }
      if (list.length === 0) this._wrappedListeners.delete(listener);
      return true;
    } else {
      return false;
    }
  }

  offAll(event: keyof TForm & string, onlyOnce?: boolean): Pichu;
  offAll(listener: ReturnAny<TForm>[keyof TForm], onlyOnce?: boolean): Pichu;
  offAll(eventOrListener: string | Listener, onlyOnce = false) {
    if (typeof eventOrListener === 'string') {
      const event = eventOrListener;
      const target = this.target(event);
      if (!target) return this;
      this._wrappedListeners.forEach((_key, listener) => {
        this.internalOffOnce(target, event, listener, true);
      });
      if (!onlyOnce) {
        target.forEach((listener) => {
          if (listener) this.internalOff(target, event, listener, true);
        });
      }
      if (!this.isEmitting(event)) this.sortout(target, event);
    } else {
      this._directory.forEach((target, event) => {
        const a = this.internalOffOnce(target, event, eventOrListener, true);
        let b = false;
        if (!onlyOnce) {
          b = this.internalOff(target, event, eventOrListener, true);
        }
        if ((a || b) && !this.isEmitting(event)) this.sortout(target, event);
      });
    }
    return this;
  }

  listenerCount(event: keyof TForm & string) {
    const target = this.target(event);
    if (!target) return 0;
    if (this.isEmitting(event)) {
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
    this._emittingNames.length = 0;
    return this;
  }

  dispose() {
    this.clear();
    //@ts-expect-error
    this._directory = undefined;
    //@ts-expect-error
    this._emittingNames = undefined;
    //@ts-expect-error
    this._wrappedListeners = undefined;
  }

  thunderShock<T extends keyof TForm & string>(
    event: T,
    ...args: Parameters<TForm[T]>
  ) {
    return this.emit(event, ...args);
  }
  thunderPunch<T extends keyof TForm & string>(
    event: T,
    ...args: Parameters<TForm[T]>
  ) {
    return this.emit(event, ...args);
  }
  thunderbolt<T extends keyof TForm & string>(
    event: T,
    ...args: Parameters<TForm[T]>
  ) {
    return this.emit(event, ...args);
  }
}
