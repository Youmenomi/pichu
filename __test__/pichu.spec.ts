import { Pichu } from '../src';

enum Events {
  Login = 'login',
}
type Express = {
  [Events.Login]: typeof loginFunc;
  data: typeof dataFunc;
};
function loginFunc(user: string, password: string) {
  user;
  password;
}
function dataFunc(data: { message: string; length: number }) {
  data;
}

const user1 = ['user001', '1234'] as const;
const user2 = ['user002', '5678'] as const;

const env = process.env;

describe('pichu', () => {
  const warn = jest
    .spyOn(global.console, 'warn')
    .mockImplementation(() => true);

  let pichu: Pichu<Express>;
  const fn1 = jest.fn(loginFunc);
  const fn2 = jest.fn(dataFunc);

  let sortout: jest.SpyInstance;

  beforeEach(() => {
    process.env = { ...env };
    warn.mockClear();
    fn1.mockClear();
    fn2.mockClear();

    pichu = new Pichu();
    sortout = jest.spyOn(pichu as any, 'sortout');
  });

  afterAll(() => {
    process.env = env;
  });

  describe('method: emit', () => {
    it('should return false, when no event listening', () => {
      expect(pichu.emit(Events.Login, ...user1)).toBeFalsy();
      expect(sortout).toBeCalledTimes(0);
      expect((pichu as any)._directory.size).toBe(0);
    });
    it('should return true, when has on x 1 & once x 1', () => {
      pichu.once(Events.Login, fn1);
      pichu.on(Events.Login, fn1);
      expect(pichu.emit(Events.Login, ...user1)).toBeTruthy();
      expect(sortout).toBeCalledTimes(1);
      expect((pichu as any)._directory.size).toBe(1);
    });
  });

  describe('method: on', () => {
    it('should warn, when on the same listener', () => {
      process.env.NODE_ENV = 'development';
      pichu.on(Events.Login, fn1);
      expect(console.warn).toBeCalledTimes(0);
      pichu.on(Events.Login, fn1);
      expect(console.warn).toBeCalledTimes(1);
      expect(sortout).toBeCalledTimes(0);
      expect((pichu as any)._directory.size).toBe(1);
    });
    it('should be called twice, when emit x 2', () => {
      let i = 0;
      pichu.on(Events.Login, fn1);
      pichu.emit(Events.Login, ...user1);
      expect(fn1).nthCalledWith(++i, ...user1);
      expect(sortout).toBeCalledTimes(1);
      pichu.emit(Events.Login, ...user2);
      expect(fn1).nthCalledWith(++i, ...user2);
      expect(fn1).toBeCalledTimes(2);
      expect(pichu.listenerCount(Events.Login)).toBe(1);
      expect(sortout).toBeCalledTimes(2);
      expect((pichu as any)._directory.size).toBe(1);
    });
    it('should not be called, when listener off', () => {
      pichu.on(Events.Login, fn1);
      pichu.off(Events.Login, fn1);
      pichu.emit(Events.Login, ...user1);
      expect(fn1).not.toBeCalled();
      expect(pichu.listenerCount(Events.Login)).toBe(0);
      expect(sortout).toBeCalledTimes(1);
      expect((pichu as any)._directory.size).toBe(0);
    });
  });

  describe('method: once', () => {
    it('Should not be called, when the second event is emitted', () => {
      let i = 0;
      pichu.once(Events.Login, fn1);
      pichu.once(Events.Login, fn1);
      pichu.once(Events.Login, fn1);
      pichu.once(Events.Login, fn1);
      expect(pichu.listenerCount(Events.Login)).toBe(4);

      pichu.offOnce(Events.Login, fn1);
      pichu.offOnce(Events.Login, fn1);
      expect(pichu.listenerCount(Events.Login)).toBe(2);

      pichu.emit(Events.Login, ...user1);
      expect(fn1).nthCalledWith(++i, ...user1);
      expect(fn1).nthCalledWith(++i, ...user1);
      expect(fn1).toBeCalledTimes(2);
      expect(pichu.listenerCount(Events.Login)).toBe(0);
      expect(sortout).toBeCalledTimes(3);
      expect((pichu as any)._directory.size).toBe(0);

      pichu.emit(Events.Login, ...user1);
      expect(fn1).toBeCalledTimes(2);
      expect(sortout).toBeCalledTimes(3);
    });
  });

  describe('method: asyncOnce', () => {
    it('should receive different arguments, when this case', async () => {
      let i = 0;
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

      await pichu.asyncOnce(Events.Login, fn1);
      expect(fn1).nthCalledWith(++i, ...user1);
      expect(fn1).toBeCalledTimes(1);
      expect(pichu.listenerCount(Events.Login)).toBe(0);
      expect(sortout).toBeCalledTimes(1);
      expect((pichu as any)._directory.size).toBe(0);

      await pichu.asyncOnce(Events.Login, fn1);
      expect(fn1).nthCalledWith(++i, ...user2);
      expect(fn1).toBeCalledTimes(2);
      expect(pichu.listenerCount(Events.Login)).toBe(0);
      expect(sortout).toBeCalledTimes(2);
      expect((pichu as any)._directory.size).toBe(0);

      pichu.emit(Events.Login, ...user1);
      expect(fn1).toBeCalledTimes(2);
      expect(sortout).toBeCalledTimes(2);
    });
  });

  describe('method: off', () => {
    it('should only off on listener, when andOffAllOnce false', () => {
      let i = 0;
      pichu.on(Events.Login, fn1);
      pichu.on(Events.Login, fn1);
      pichu.once(Events.Login, fn1);
      pichu.once(Events.Login, fn1);
      expect(pichu.listenerCount(Events.Login)).toBe(3);

      pichu.off(Events.Login, fn1);
      expect(pichu.listenerCount(Events.Login)).toBe(2);
      expect(sortout).toBeCalledTimes(1);

      pichu.emit(Events.Login, ...user1);
      expect(fn1).nthCalledWith(++i, ...user1);
      expect(fn1).nthCalledWith(++i, ...user1);
      expect(fn1).toBeCalledTimes(2);
      expect(pichu.listenerCount(Events.Login)).toBe(0);
      expect(sortout).toBeCalledTimes(2);
      expect((pichu as any)._directory.size).toBe(0);
    });
    it('should off all listener, when andOffAllOnce true', () => {
      pichu.on(Events.Login, fn1);
      pichu.on(Events.Login, fn1);
      pichu.once(Events.Login, fn1);
      pichu.once(Events.Login, fn1);
      expect(pichu.listenerCount(Events.Login)).toBe(3);

      pichu.off(Events.Login, fn1, true);
      expect(pichu.listenerCount(Events.Login)).toBe(0);
      expect(sortout).toBeCalledTimes(1);
      expect((pichu as any)._directory.size).toBe(0);

      pichu.emit(Events.Login, ...user1);
      expect(fn1).not.toBeCalled();
      expect(sortout).toBeCalledTimes(1);
    });
    it('should off all listener, when andOffAllOnce true', () => {
      pichu.on(Events.Login, fn1);
      pichu.on(Events.Login, fn1);
      pichu.once(Events.Login, fn1);
      pichu.once(Events.Login, fn1);
      expect(pichu.listenerCount(Events.Login)).toBe(3);

      pichu.off(Events.Login, fn1, true);
      expect(pichu.listenerCount(Events.Login)).toBe(0);
      expect(sortout).toBeCalledTimes(1);
      expect((pichu as any)._directory.size).toBe(0);

      pichu.emit(Events.Login, ...user1);
      expect(fn1).not.toBeCalled();
      expect(sortout).toBeCalledTimes(1);
    });
    it("Should call invalid, when off a event name that doesn't exist", () => {
      const internalOff = jest.spyOn(pichu as any, 'internalOff');
      pichu.on(Events.Login, fn1);
      pichu.off('data', fn2);
      expect(internalOff).not.toBeCalled();
    });
    it('nest case', () => {
      const f1 = jest.fn(() => true);
      const f2 = jest.fn(() => {
        pichu.off(Events.Login, f6);
        expect(pichu.listenerCount(Events.Login)).toBe(3);
        expect(sortout).toBeCalledTimes(0);
        expect((pichu as any)._directory.size).toBe(1);

        pichu.emit(Events.Login, ...user2);
        expect(pichu.listenerCount(Events.Login)).toBe(0);
        expect(sortout).toBeCalledTimes(0);
        expect((pichu as any)._directory.size).toBe(1);
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
      expect(sortout).toBeCalledTimes(1);
    });
  });

  describe('method: offOnce', () => {
    it('should not be called, when offOnce all', () => {
      pichu.once(Events.Login, fn1);
      pichu.once(Events.Login, fn1);
      pichu.once(Events.Login, fn1);
      pichu.once(Events.Login, fn1);
      expect(pichu.listenerCount(Events.Login)).toBe(4);

      pichu.offOnce(Events.Login, fn1, true);
      expect(pichu.listenerCount(Events.Login)).toBe(0);
      expect(sortout).toBeCalledTimes(1);
      expect((pichu as any)._directory.size).toBe(0);

      pichu.emit(Events.Login, ...user1);
      expect(fn1).not.toBeCalled();
      expect(sortout).toBeCalledTimes(1);
    });
    it("Should call invalid, when offOnce a event name that doesn't exist", () => {
      const internalOffOnce = jest.spyOn(pichu as any, 'internalOffOnce');
      pichu.on(Events.Login, fn1);
      pichu.offOnce('data', fn2);
      expect(internalOffOnce).not.toBeCalled();
    });
    it('nest case', () => {
      const f1 = jest.fn(() => true);
      const f2 = jest.fn(() => {
        pichu.offOnce(Events.Login, f1);
        pichu.offOnce(Events.Login, f3);
        pichu.offOnce(Events.Login, f4);
        expect(pichu.listenerCount(Events.Login)).toBe(2);
        expect(sortout).toBeCalledTimes(0);
        expect((pichu as any)._directory.size).toBe(1);

        pichu.emit(Events.Login, ...user2);
        expect(pichu.listenerCount(Events.Login)).toBe(1);
        expect(sortout).toBeCalledTimes(0);
        expect((pichu as any)._directory.size).toBe(1);
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
      expect(f3).not.toBeCalled();
      expect(f4).not.toBeCalled();
      expect(f5).nthCalledWith(1, ...user2);
      expect(f6).nthCalledWith(1, ...user2);
      expect(f6).nthCalledWith(2, ...user1);
      expect(pichu.listenerCount(Events.Login)).toBe(1);
      expect(sortout).toBeCalledTimes(1);
    });
  });

  describe('method: offAll', () => {
    describe('by event name', () => {
      it('should not be called, when offAll onlyOnce=false', () => {
        pichu.on(Events.Login, fn1);
        pichu.on(Events.Login, fn1);
        pichu.once(Events.Login, fn1);
        pichu.once(Events.Login, fn1);
        expect(pichu.listenerCount(Events.Login)).toBe(3);

        pichu.offAll(Events.Login);
        expect(pichu.listenerCount(Events.Login)).toBe(0);
        expect(sortout).toBeCalledTimes(1);

        pichu.emit(Events.Login, ...user1);
        expect(fn1).not.toBeCalled();
        expect(sortout).toBeCalledTimes(1);
        expect((pichu as any)._directory.size).toBe(0);
      });
      it('should only off all once, when offAll onlyOnce=true', () => {
        let i = 0;
        pichu.on(Events.Login, fn1);
        pichu.on(Events.Login, fn1);
        pichu.once(Events.Login, fn1);
        pichu.once(Events.Login, fn1);
        expect(pichu.listenerCount(Events.Login)).toBe(3);

        pichu.offAll(Events.Login, true);
        expect(pichu.listenerCount(Events.Login)).toBe(1);
        expect(sortout).toBeCalledTimes(1);

        pichu.emit(Events.Login, ...user1);
        expect(fn1).nthCalledWith(++i, ...user1);
        expect(fn1).toBeCalledTimes(1);
        expect(sortout).toBeCalledTimes(2);
        expect((pichu as any)._directory.size).toBe(1);
      });
      it('nest case', () => {
        const f1 = jest.fn(() => true);
        const f2 = jest.fn(() => {
          pichu.offAll(Events.Login);
          expect(pichu.listenerCount(Events.Login)).toBe(0);
          expect(sortout).toBeCalledTimes(0);
          expect((pichu as any)._directory.size).toBe(1);

          pichu.emit(Events.Login, ...user2);
          expect(pichu.listenerCount(Events.Login)).toBe(0);
          expect(sortout).toBeCalledTimes(0);
          expect((pichu as any)._directory.size).toBe(1);
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
        expect(f3).not.toBeCalled();
        expect(f4).not.toBeCalled();
        expect(f5).not.toBeCalled();
        expect(f6).not.toBeCalled();
        expect(pichu.listenerCount(Events.Login)).toBe(0);
        expect(sortout).toBeCalledTimes(1);
      });
    });
    describe('by listener', () => {
      it('should not be called, when offAll onlyOnce=false', () => {
        pichu.on(Events.Login, fn1);
        pichu.on(Events.Login, fn1);
        pichu.once(Events.Login, fn1);
        pichu.once(Events.Login, fn1);
        expect(pichu.listenerCount(Events.Login)).toBe(3);

        pichu.offAll(fn1);
        expect(pichu.listenerCount(Events.Login)).toBe(0);
        expect(sortout).toBeCalledTimes(1);

        pichu.emit(Events.Login, ...user1);
        expect(fn1).not.toBeCalled();
        expect(sortout).toBeCalledTimes(1);
        expect((pichu as any)._directory.size).toBe(0);
      });
      it('should only off all once, when offAll onlyOnce=true', () => {
        let i = 0;
        pichu.on(Events.Login, fn1);
        pichu.on(Events.Login, fn1);
        pichu.once(Events.Login, fn1);
        pichu.once(Events.Login, fn1);
        expect(pichu.listenerCount(Events.Login)).toBe(3);

        pichu.offAll(fn1, true);
        expect(pichu.listenerCount(Events.Login)).toBe(1);
        expect(sortout).toBeCalledTimes(1);

        pichu.emit(Events.Login, ...user1);
        expect(fn1).nthCalledWith(++i, ...user1);
        expect(fn1).toBeCalledTimes(1);
        expect(sortout).toBeCalledTimes(2);
        expect((pichu as any)._directory.size).toBe(1);
      });
    });
  });

  it('method: listenerCount', () => {
    pichu.on(Events.Login, fn1);
    pichu.on(Events.Login, fn1);
    pichu.once(Events.Login, fn1);
    pichu.once(Events.Login, fn1);
    expect(pichu.listenerCount(Events.Login)).toBe(3);
  });

  it('method: maxListeners', () => {
    pichu.maxListeners = 1;
    pichu.on(Events.Login, fn1);
    expect(pichu.listenerCount(Events.Login)).toBe(1);
    expect(() => pichu.on(Events.Login, fn1)).not.toThrow(Error);
    expect(pichu.listenerCount(Events.Login)).toBe(1);
    expect(() => pichu.once(Events.Login, fn1)).toThrow(Error);
    expect(pichu.listenerCount(Events.Login)).toBe(1);
  });

  it('method: clear', () => {
    pichu.on(Events.Login, fn1);
    pichu.on(Events.Login, fn1);
    pichu.once(Events.Login, fn1);
    pichu.once(Events.Login, fn1);
    expect(pichu.listenerCount(Events.Login)).toBe(3);

    pichu.clear();
    expect(pichu.listenerCount(Events.Login)).toBe(0);

    pichu.emit(Events.Login, ...user1);
    expect(fn1).not.toBeCalled();
    expect(sortout).toBeCalledTimes(0);
    expect((pichu as any)._directory.size).toBe(0);
  });

  it('method: dispose', () => {
    pichu.on(Events.Login, fn1);
    pichu.on(Events.Login, fn1);
    pichu.once(Events.Login, fn1);
    pichu.once(Events.Login, fn1);
    expect(pichu.listenerCount(Events.Login)).toBe(3);

    pichu.dispose();
    expect(() => pichu.listenerCount(Events.Login)).toThrow(Error);
    expect(() => pichu.on(Events.Login, fn1)).toThrow(Error);
    expect(() => pichu.emit(Events.Login, ...user1)).toThrow(Error);
  });

  describe('method: sortout', () => {
    it("should not be sorted out, when off a listener that doesn't exist", () => {
      const f1 = jest.fn(() => true);
      const f2 = jest.fn(() => true);
      const f3 = jest.fn(() => true);
      pichu.once(Events.Login, f1);
      pichu.on(Events.Login, f2);

      pichu.off(Events.Login, f3);
      expect(sortout).toBeCalledTimes(0);
    });
    it("should not be sorted out, when offOnce a listener that doesn't exist", () => {
      const f1 = jest.fn(() => true);
      const f2 = jest.fn(() => true);
      const f3 = jest.fn(() => true);
      pichu.once(Events.Login, f1);
      pichu.on(Events.Login, f2);

      pichu.offOnce(Events.Login, f3);
      expect(sortout).toBeCalledTimes(0);
    });
    it("should not be sorted out, when offAll a event name that doesn't exist", () => {
      const f1 = jest.fn(() => true);
      const f2 = jest.fn(() => true);
      pichu.once(Events.Login, f1);
      pichu.on(Events.Login, f2);

      pichu.offAll('data');
      expect(sortout).toBeCalledTimes(0);
    });
    it("should not be sorted out, when offAll a listener that doesn't exist", () => {
      const f1 = jest.fn(() => true);
      const f2 = jest.fn(() => true);
      const f3 = jest.fn(() => true);
      pichu.once(Events.Login, f1);
      pichu.on(Events.Login, f2);

      pichu.offAll(f3);
      expect(sortout).toBeCalledTimes(0);
    });
  });

  it('method: moveset', () => {
    pichu.thunderPunch(Events.Login, ...user1);
    pichu.thunderShock(Events.Login, ...user1);
    pichu.thunderbolt(Events.Login, ...user1);
  });

  it('method: types', () => {
    pichu
      .on(Events.Login, fn1)
      .once(Events.Login, fn1)
      .off(Events.Login, fn1)
      .offOnce(Events.Login, fn1)
      .offAll(Events.Login)
      .clear();

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
    pichu.offOnce(Events.Login, fn2);
    //@ts-expect-error
    pichu.offOnce('data', fn1);
    //@ts-expect-error
    pichu.offOnce('other', fn1);
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
    anotherPichu.offOnce(Events.Login, fn2);
    anotherPichu.offOnce('data', fn1);
    anotherPichu.offOnce('other', fn1);
    anotherPichu.off(Events.Login, fn2);
    anotherPichu.off('data', fn1);
    anotherPichu.off('other', fn1);
    anotherPichu.offAll('other');
    anotherPichu.offAll((n: number) => n);
    anotherPichu.listenerCount('');
  });
});
