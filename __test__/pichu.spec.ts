import {
  Pichu,
  __debug_get_listening_count,
  __debug_clear_listening_count,
  offMsg,
} from '../src';

enum Events {
  Login = 'login',
}
type Form = {
  [Events.Login]: typeof loginFunc;
  data: typeof dataFunc;
};
function loginFunc(user: string, password: string) {
  user;
  password;
  return ['Do not check the return type.'];
}
const user1 = ['user001', '1234'] as const;
const user2 = ['user002', '5678'] as const;

function dataFunc(data: { message: string; length: number }) {
  data;
  return ['Do not check the return type.'];
}
const data1 = {
  message: 'test',
  length: 99,
};

const env = process.env;

describe('pichu', () => {
  const warn = jest
    .spyOn(global.console, 'warn')
    .mockImplementation(() => true);

  let pichu: Pichu<Form>;
  const fn1 = jest.fn(loginFunc);
  const fn2 = jest.fn(dataFunc);

  beforeEach(() => {
    process.env = { ...env };
    warn.mockClear();
    fn1.mockClear();
    fn2.mockClear();

    __debug_clear_listening_count();
    pichu = new Pichu();
  });

  afterAll(() => {
    process.env = env;
  });

  describe('method: emit', () => {
    it('should return false, when no event listening', () => {
      expect(pichu.listenerCount()).toBe(0);
      expect(pichu.emit(Events.Login, ...user1)).toBeFalsy();
    });
    it('should return true, when more than one event listener', async () => {
      pichu.once(Events.Login, fn1);
      expect(__debug_get_listening_count()).toBe(1);
      expect(pichu.emit(Events.Login, ...user1)).toBeTruthy();
      expect(__debug_get_listening_count()).toBe(0);

      pichu.on('data', fn2);
      expect(pichu.emit('data', data1)).toBeTruthy();
      expect(__debug_get_listening_count()).toBe(1);

      setTimeout(() => {
        expect(pichu.emit('data', data1)).toBeTruthy();
      }, 100);
      const promise = pichu.asyncOnce('data');
      expect(__debug_get_listening_count()).toBe(2);
      expect(await promise).toEqual([data1]);

      expect(__debug_get_listening_count()).toBe(1);
    });
    it('should return false, when the length of the listener array becomes zero', () => {
      pichu.on(Events.Login, function func(user: string, password: string) {
        user;
        password;
        pichu.off(Events.Login, func);
        expect(pichu.emit(Events.Login, ...user1)).toBeFalsy();
      });
      expect(__debug_get_listening_count()).toBe(1);
      expect(pichu.emit(Events.Login, ...user1)).toBeTruthy();
      expect(pichu.listenerCount()).toBe(0);
      expect(__debug_get_listening_count()).toBe(0);
    });
  });

  describe('method: on', () => {
    it('should warn, when on the same listener', () => {
      expect(pichu.on(Events.Login, fn1)).toBe(true);
      expect(console.warn).toBeCalledTimes(0);
      expect(pichu.on(Events.Login, fn1)).toBe(false);
      expect(console.warn).toBeCalledTimes(0);

      process.env.NODE_ENV = 'development';
      expect(pichu.on(Events.Login, fn1)).toBe(false);
      expect(console.warn).toBeCalledTimes(1);
      expect(console.warn).nthCalledWith(
        1,
        '[pichu] Invalid operation, there is a duplicate listener.'
      );

      expect(pichu.once(Events.Login, fn1)).toBe(false);
      expect(console.warn).toBeCalledTimes(2);
      expect(console.warn).nthCalledWith(
        2,
        '[pichu] Invalid operation, there is a duplicate listener.'
      );
      expect(pichu.listenerCount()).toBe(1);
      expect(__debug_get_listening_count()).toBe(1);
    });
    it('should be called twice, when emit x 2', () => {
      let i = 0;
      pichu.on(Events.Login, fn1);
      expect(__debug_get_listening_count()).toBe(1);
      pichu.emit(Events.Login, ...user1);
      expect(fn1).nthCalledWith(++i, ...user1);
      pichu.emit(Events.Login, ...user2);
      expect(fn1).nthCalledWith(++i, ...user2);
      expect(fn1).toBeCalledTimes(2);
      expect(pichu.listenerCount(Events.Login)).toBe(1);
      expect(pichu.listenerCount()).toBe(1);
      expect(__debug_get_listening_count()).toBe(1);
    });
  });

  describe('method: once', () => {
    it('should warn, when on the same listener', () => {
      expect(pichu.once(Events.Login, fn1)).toBe(true);
      expect(console.warn).toBeCalledTimes(0);
      expect(pichu.once(Events.Login, fn1)).toBe(false);
      expect(console.warn).toBeCalledTimes(0);

      process.env.NODE_ENV = 'development';
      expect(pichu.once(Events.Login, fn1)).toBe(false);
      expect(console.warn).toBeCalledTimes(1);
      expect(console.warn).nthCalledWith(
        1,
        '[pichu] Invalid operation, there is a duplicate listener.'
      );

      expect(pichu.on(Events.Login, fn1)).toBe(false);
      expect(console.warn).toBeCalledTimes(2);
      expect(console.warn).nthCalledWith(
        2,
        '[pichu] Invalid operation, there is a duplicate listener.'
      );
      expect(pichu.listenerCount()).toBe(1);
      expect(__debug_get_listening_count()).toBe(1);
    });
    it('Should be called once, when emit x 2', () => {
      pichu.once(Events.Login, fn1);
      pichu.once(Events.Login, fn1);
      expect(pichu.listenerCount(Events.Login)).toBe(1);
      expect(__debug_get_listening_count()).toBe(1);

      pichu.emit(Events.Login, ...user1);
      expect(fn1).toBeCalledTimes(1);
      expect(pichu.listenerCount(Events.Login)).toBe(0);
      expect(pichu.listenerCount()).toBe(0);
      expect(__debug_get_listening_count()).toBe(0);

      pichu.emit(Events.Login, ...user1);
      expect(fn1).toBeCalledTimes(1);
    });
  });

  describe('method: asyncOnce', () => {
    it('should wait to receive a new event once, when asynchronous', async () => {
      setTimeout(() => {
        pichu.emit(Events.Login, ...user1);
        pichu.emit(Events.Login, ...user1);
        pichu.emit(Events.Login, ...user1);
      }, 100);
      setTimeout(() => {
        pichu.emit(Events.Login, ...user2);
        pichu.emit(Events.Login, ...user2);
        pichu.emit(Events.Login, ...user2);
      }, 200);

      expect(await pichu.asyncOnce(Events.Login)).toEqual(user1);
      expect(pichu.listenerCount(Events.Login)).toBe(0);
      expect(pichu.listenerCount()).toBe(0);
      expect(__debug_get_listening_count()).toBe(0);

      expect(await pichu.asyncOnce(Events.Login)).toEqual(user2);
      expect(pichu.listenerCount(Events.Login)).toBe(0);
      expect(pichu.listenerCount()).toBe(0);
      expect(__debug_get_listening_count()).toBe(0);
    });

    it('should throw an error, when promise off', async () => {
      setTimeout(() => {
        pichu.emit(Events.Login, ...user1);
      }, 100);
      const promise = pichu.asyncOnce(Events.Login);
      expect(pichu.listenerCount(Events.Login)).toBe(1);
      expect(__debug_get_listening_count()).toBe(1);
      promise.off();
      try {
        await promise;
      } catch (error) {
        expect(error).toBe(offMsg);
      }
      expect(pichu.listenerCount(Events.Login)).toBe(0);
      expect(pichu.listenerCount()).toBe(0);
      expect(__debug_get_listening_count()).toBe(0);
    });

    it('should throw an error, when the group parameter is provided and then call offGroup', async () => {
      setTimeout(() => {
        pichu.emit(Events.Login, ...user1);
      }, 100);
      const promise = pichu.asyncOnce(Events.Login, 'group1');
      expect(pichu.listenerCount(Events.Login)).toBe(1);
      expect(__debug_get_listening_count()).toBe(1);
      pichu.offGroup('group1');
      try {
        await promise;
      } catch (error) {
        expect(error).toBe(offMsg);
      }
      expect(pichu.listenerCount(Events.Login)).toBe(0);
      expect(pichu.listenerCount()).toBe(0);
      expect(__debug_get_listening_count()).toBe(0);
    });
  });

  describe('method: off', () => {
    it('should not be called, when listener off', async () => {
      pichu.on(Events.Login, fn1);
      pichu.off(Events.Login, fn1);
      pichu.emit(Events.Login, ...user1);
      expect(fn1).not.toBeCalled();
      expect(__debug_get_listening_count()).toBe(0);

      pichu.once(Events.Login, fn1);
      pichu.off(Events.Login, fn1);
      pichu.emit(Events.Login, ...user1);
      expect(fn1).not.toBeCalled();
      expect(__debug_get_listening_count()).toBe(0);
    });
    it("Should call invalid, when off a event name that doesn't exist", () => {
      pichu.on(Events.Login, fn1);
      pichu.off('data', fn2);
      expect(pichu.listenerCount(Events.Login)).toBe(1);
      expect(__debug_get_listening_count()).toBe(1);
    });
    it('nest case1', () => {
      const func = jest.fn((e: any) => e);
      const pichu = new Pichu();
      pichu.once('test', (e) => {
        func(e);
        pichu.on('test', (e) => {
          func(e);
        });
        pichu.emit('test', 'data2');
      });
      pichu.emit('test', 'data1');

      expect(func).nthCalledWith(1, 'data1');
      expect(func).nthCalledWith(2, 'data2');
      expect(func).toBeCalledTimes(2);
      expect(pichu.listenerCount('test')).toBe(1);
      expect(__debug_get_listening_count()).toBe(1);
    });
    it('nest case2', () => {
      const f1 = jest.fn(() => true);
      const f2 = jest.fn(() => {
        pichu.off(Events.Login, f6);
        expect(pichu.listenerCount(Events.Login)).toBe(3);
        expect(pichu.listenerCount()).toBe(3);
        expect(__debug_get_listening_count()).toBe(4);

        pichu.emit(Events.Login, ...user2);
        expect(pichu.listenerCount(Events.Login)).toBe(0);
        expect(pichu.listenerCount()).toBe(0);
        expect(__debug_get_listening_count()).toBe(1);
      });
      const f3 = jest.fn(() => true);
      const f4 = jest.fn(() => true);
      const f5 = jest.fn(() => true);
      const f6 = jest.fn(() => true);

      pichu.once(Events.Login, f1);
      pichu.once(Events.Login, f2);
      pichu.once(Events.Login, f3);
      pichu.once(Events.Login, f4);
      pichu.once(Events.Login, f5);
      pichu.on(Events.Login, f6);

      pichu.emit(Events.Login, ...user1);
      expect(f1).nthCalledWith(1, ...user1);
      expect(f2).nthCalledWith(1, ...user1);
      expect(f3).nthCalledWith(1, ...user2);
      expect(f4).nthCalledWith(1, ...user2);
      expect(f5).nthCalledWith(1, ...user2);
      expect(f6).not.toBeCalled();
      expect(pichu.listenerCount(Events.Login)).toBe(0);
      expect(pichu.listenerCount()).toBe(0);
      expect(__debug_get_listening_count()).toBe(0);
    });
  });

  describe('method: offAll', () => {
    it('by undefined', () => {
      pichu.on(Events.Login, fn1);
      pichu.on(Events.Login, fn1);
      pichu.once(Events.Login, fn1);
      pichu.once(Events.Login, fn1);
      expect(pichu.listenerCount(Events.Login)).toBe(1);
      expect(__debug_get_listening_count()).toBe(1);

      pichu.offAll();
      expect(pichu.listenerCount(Events.Login)).toBe(0);
      expect(__debug_get_listening_count()).toBe(0);

      pichu.emit(Events.Login, ...user1);
      expect(fn1).not.toBeCalled();
      expect(pichu.listenerCount()).toBe(0);
      expect(__debug_get_listening_count()).toBe(0);
    });
    it('by event name', () => {
      pichu.on(Events.Login, fn1);
      pichu.on(Events.Login, fn1);
      pichu.once(Events.Login, fn1);
      pichu.once(Events.Login, fn1);
      expect(pichu.listenerCount(Events.Login)).toBe(1);
      expect(__debug_get_listening_count()).toBe(1);

      pichu.offAll(Events.Login);
      expect(pichu.listenerCount(Events.Login)).toBe(0);
      expect(pichu.listenerCount()).toBe(0);
      expect(__debug_get_listening_count()).toBe(0);

      pichu.emit(Events.Login, ...user1);
      expect(fn1).not.toBeCalled();
      expect(pichu.listenerCount()).toBe(0);
      expect(__debug_get_listening_count()).toBe(0);
    });
    it('by listener', () => {
      pichu.on(Events.Login, fn1);
      pichu.on(Events.Login, fn1);
      pichu.once(Events.Login, fn1);
      pichu.once(Events.Login, fn1);
      expect(pichu.listenerCount(Events.Login)).toBe(1);
      expect(__debug_get_listening_count()).toBe(1);

      pichu.offAll(fn1);
      expect(pichu.listenerCount(Events.Login)).toBe(0);
      expect(pichu.listenerCount()).toBe(0);
      expect(__debug_get_listening_count()).toBe(0);

      pichu.emit(Events.Login, ...user1);
      expect(fn1).not.toBeCalled();
      expect(pichu.listenerCount()).toBe(0);
      expect(__debug_get_listening_count()).toBe(0);
    });
    it("Should call invalid, when off a event name that doesn't exist", () => {
      pichu.on(Events.Login, fn1);
      pichu.offAll('data');
      expect(pichu.listenerCount(Events.Login)).toBe(1);
      expect(__debug_get_listening_count()).toBe(1);
    });
  });

  describe('method: offGroup', () => {
    it('by undefined', () => {
      const f1 = jest.fn();
      pichu.on(Events.Login, () => f1(), 'group1');
      pichu.once(Events.Login, () => f1(), 'group1');
      pichu.once(Events.Login, () => f1(), 'group3');
      pichu.on(Events.Login, () => f1(), 'group4');
      expect(pichu.listenerCount(Events.Login)).toBe(4);
      expect(__debug_get_listening_count()).toBe(4);

      expect(() => {
        //@ts-expect-error
        pichu.offGroup();
      }).toThrowError('[pichu] "undefined" is not a valid parameter.');
      pichu.emit(Events.Login, ...user1);
      expect(f1).toBeCalledTimes(4);
      expect(pichu.listenerCount(Events.Login)).toBe(2);
      expect(__debug_get_listening_count()).toBe(2);
    });
    it('by group', () => {
      const f1 = jest.fn();
      pichu.on(Events.Login, () => f1(), 'group1');
      pichu.once(Events.Login, () => f1(), 'group1');
      pichu.once(Events.Login, () => f1(), 'group3');
      pichu.on(Events.Login, () => f1(), 'group4');
      expect(pichu.listenerCount(Events.Login)).toBe(4);
      expect(__debug_get_listening_count()).toBe(4);

      pichu.offGroup('group1');
      expect(pichu.listenerCount(Events.Login)).toBe(2);

      pichu.emit(Events.Login, ...user1);
      expect(f1).toBeCalledTimes(2);

      expect(pichu.listenerCount(Events.Login)).toBe(1);
      expect(__debug_get_listening_count()).toBe(1);
    });
    it('by group & event', () => {
      const f1 = jest.fn();
      const f2 = jest.fn();
      pichu.on(Events.Login, () => f1(), 'group1');
      pichu.once(Events.Login, () => f1(), 'group1');
      pichu.once(Events.Login, () => f1(), 'group2');
      pichu.once('data', () => f2(), 'group1');
      pichu.on('data', () => f2(), 'group1');

      //@ts-expect-error
      pichu.offGroup('group0', 'test');
      expect(pichu.listenerCount()).toBe(5);
      expect(__debug_get_listening_count()).toBe(5);

      pichu.offGroup('group1', Events.Login);
      expect(pichu.listenerCount(Events.Login)).toBe(1);
      expect(pichu.listenerCount('data')).toBe(2);

      pichu.emit(Events.Login, ...user1);
      expect(f1).toBeCalledTimes(1);
      pichu.emit('data', data1);
      expect(f2).toBeCalledTimes(2);

      expect(pichu.listenerCount()).toBe(1);
      expect(__debug_get_listening_count()).toBe(1);
    });
    it('by group & listener', () => {
      const pichu = new Pichu();
      const f1 = jest.fn();
      const f2 = jest.fn();
      pichu.on('test1', f1, 'group1');
      pichu.once('test2', f1, 'group1');
      pichu.once('test3', f1, 'group2');
      pichu.once('test4', f2, 'group1');
      pichu.on('test5', f2, 'group1');

      pichu.offGroup('group0', () => undefined);
      expect(pichu.listenerCount()).toBe(5);
      expect(__debug_get_listening_count()).toBe(5);

      pichu.offGroup('group1', f1);
      expect(pichu.listenerCount(f1)).toBe(1);
      expect(pichu.listenerCount(f2)).toBe(2);

      pichu.emit('test1', {});
      pichu.emit('test2', {});
      pichu.emit('test3', {});
      pichu.emit('test4', {});
      pichu.emit('test5', {});
      expect(f1).toBeCalledTimes(1);
      expect(f2).toBeCalledTimes(2);

      expect(pichu.listenerCount()).toBe(1);
      expect(__debug_get_listening_count()).toBe(1);
    });
  });

  it('method: emitGroup', async () => {
    const pichu = new Pichu();
    expect(pichu.emitGroup('group1', 'test1', {})).toBeFalsy();

    const f1 = jest.fn();
    const f2 = jest.fn();
    pichu.on('test1', f1, 'group1');
    pichu.on('test1', f2);
    expect(__debug_get_listening_count()).toBe(2);

    expect(pichu.emitGroup('group1', 'test1', {})).toBeTruthy();
    expect(f1).toBeCalledTimes(1);

    f1.mockClear();
    expect(pichu.emit('test1', {})).toBeTruthy();
    expect(f1).toBeCalledTimes(1);
    expect(f2).toBeCalledTimes(1);

    setTimeout(() => {
      expect(pichu.emitGroup('group1', 'data', data1)).toBeTruthy();
    }, 100);
    const promise = pichu.asyncOnce('data', 'group1');
    expect(__debug_get_listening_count()).toBe(3);
    expect(await promise).toEqual([data1]);
    expect(__debug_get_listening_count()).toBe(2);
  });

  it('method: listenerCount', () => {
    expect(pichu.listenerCount(Events.Login)).toBe(0);
    expect(pichu.listenerCount('data')).toBe(0);
    expect(pichu.listenerCount(fn2)).toBe(0);
    expect(__debug_get_listening_count()).toBe(0);

    pichu.on(Events.Login, fn1);
    pichu.on(Events.Login, fn1);
    pichu.once(Events.Login, fn1);
    pichu.once(Events.Login, fn1);
    expect(pichu.listenerCount(Events.Login)).toBe(1);
    expect(pichu.listenerCount(fn1)).toBe(1);
    expect(__debug_get_listening_count()).toBe(1);

    pichu.on('data', fn2);
    pichu.on('data', fn2);
    pichu.once('data', fn2);
    pichu.once('data', fn2);
    expect(pichu.listenerCount('data')).toBe(1);
    expect(pichu.listenerCount(fn2)).toBe(1);

    expect(pichu.listenerCount()).toBe(2);
    expect(__debug_get_listening_count()).toBe(2);
  });

  it('method: countGroup', () => {
    const pichu = new Pichu();
    expect(() => {
      //@ts-expect-error
      pichu.countGroup();
    }).toThrowError('[pichu] "undefined" is not a valid parameter.');

    pichu.on(Events.Login, fn1, 'group1');
    pichu.on(Events.Login, fn1, 'group1');
    pichu.once(Events.Login, fn1, 'group1');
    pichu.once(Events.Login, fn1, 'group1');
    expect(pichu.countGroup('group1')).toBe(1);
    expect(__debug_get_listening_count()).toBe(1);

    pichu.on('data', fn1, 'group2');
    pichu.on('data', fn1, 'group2');
    pichu.once('data2', fn1, 'group2');
    pichu.once('data2', fn1, 'group2');
    expect(pichu.countGroup('group2')).toBe(2);
    expect(pichu.listenerCount()).toBe(3);
    expect(__debug_get_listening_count()).toBe(3);

    expect(pichu.countGroup('group1', Events.Login)).toBe(1);
    expect(pichu.countGroup('group1', fn1)).toBe(1);
    expect(pichu.countGroup('group2', fn1)).toBe(2);
    expect(pichu.countGroup('group2', 'data')).toBe(1);
    expect(pichu.countGroup('group2', 'data2')).toBe(1);
    expect(pichu.countGroup('group2', fn2)).toBe(0);
  });

  it('method: dispose', () => {
    pichu.on(Events.Login, fn1);
    pichu.on(Events.Login, fn1);
    pichu.once(Events.Login, fn1);
    pichu.once(Events.Login, fn1);
    expect(pichu.listenerCount(Events.Login)).toBe(1);
    expect(__debug_get_listening_count()).toBe(1);

    pichu.dispose();
    expect(__debug_get_listening_count()).toBe(0);

    expect(() => pichu.listenerCount(Events.Login)).toThrow(Error);
    expect(() => pichu.on(Events.Login, fn1)).toThrow(Error);
    expect(() => pichu.emit(Events.Login, ...user1)).toThrow(Error);
  });

  it('method: moveset', () => {
    const emit = jest.spyOn(pichu, 'emit');
    pichu.thunderPunch(Events.Login, ...user1);
    pichu.thunderShock(Events.Login, ...user1);
    pichu.thunderbolt(Events.Login, ...user1);
    expect(emit).toBeCalledTimes(3);
  });

  it('priority', async () => {
    {
      const func = jest.fn();
      const pichu = new Pichu(true);
      pichu.on('test', () => {
        func('on');
      });
      pichu.once(
        'test',
        () => {
          func('once');
        },
        undefined,
        1
      );
      pichu.asyncOnce('test', undefined, 2).then(() => {
        func('asyncOnce1');
      });
      pichu.asyncOnce('test', undefined, 3).then(() => {
        func('asyncOnce2');
      });
      pichu.emit('test', {});
      await Promise.resolve();
      expect(func).nthCalledWith(2, 'on');
      expect(func).nthCalledWith(1, 'once');
      expect(func).nthCalledWith(4, 'asyncOnce1');
      expect(func).nthCalledWith(3, 'asyncOnce2');
      expect(func).toBeCalledTimes(4);
    }
    {
      const func = jest.fn();
      const pichu = new Pichu(true);
      pichu.on('test', () => {
        func('on');
      });
      pichu.once(
        'test',
        () => {
          func('once');
        },
        undefined,
        -1
      );
      pichu.asyncOnce('test', undefined, -2).then(() => {
        func('asyncOnce1');
      });
      pichu.asyncOnce('test', undefined, -3).then(() => {
        func('asyncOnce2');
      });
      pichu.emit('test', {});
      await Promise.resolve();
      expect(func).nthCalledWith(1, 'on');
      expect(func).nthCalledWith(2, 'once');
      expect(func).nthCalledWith(3, 'asyncOnce1');
      expect(func).nthCalledWith(4, 'asyncOnce2');
      expect(func).toBeCalledTimes(4);
    }
    {
      const func = jest.fn();
      const pichu = new Pichu(true);
      pichu.on(
        'test',
        () => {
          func('on');
        },
        undefined,
        -100
      );
      pichu.once(
        'test',
        () => {
          func('once');
        },
        undefined,
        20
      );
      pichu.asyncOnce('test', undefined, -999).then(() => {
        func('asyncOnce1');
      });
      pichu.asyncOnce('test').then(() => {
        func('asyncOnce2');
      });
      pichu.emit('test', {});
      await Promise.resolve();
      expect(func).nthCalledWith(2, 'on');
      expect(func).nthCalledWith(1, 'once');
      expect(func).nthCalledWith(4, 'asyncOnce1');
      expect(func).nthCalledWith(3, 'asyncOnce2');
      expect(func).toBeCalledTimes(4);
    }
  });

  it('types', () => {
    //@ts-expect-error
    pichu.emit('data', '');
    //@ts-expect-error
    pichu.on(Events.Login, fn2);
    //@ts-expect-error
    pichu.on('data', fn1);
    //@ts-expect-error
    pichu.on('other', fn1);
    //@ts-expect-error
    pichu.once(Events.Login, fn2);
    //@ts-expect-error
    pichu.once('data', fn1);
    //@ts-expect-error
    pichu.once('other', fn1);
    //@ts-expect-error
    pichu.off(Events.Login, fn2);
    //@ts-expect-error
    pichu.off('data', fn1);
    //@ts-expect-error
    pichu.off('other', fn1);
    //@ts-expect-error
    pichu.offAll('other');
    //@ts-expect-error
    pichu.offAll((n: number) => n);
    //@ts-expect-error
    pichu.listenerCount('');

    const anotherPichu = new Pichu();
    anotherPichu.emit('data', '');
    anotherPichu.on(Events.Login, fn2);
    anotherPichu.on('data', fn1);
    anotherPichu.on('other', fn1);
    anotherPichu.once(Events.Login, fn2);
    anotherPichu.once('data', fn1);
    anotherPichu.once('other', fn1);
    anotherPichu.off(Events.Login, fn2);
    anotherPichu.off('data', fn1);
    anotherPichu.off('other', fn1);
    anotherPichu.off(Events.Login, fn2);
    anotherPichu.off('data', fn1);
    anotherPichu.off('other', fn1);
    anotherPichu.offAll('other');
    anotherPichu.offAll((n: number) => n);
    anotherPichu.listenerCount('');
  });
});
