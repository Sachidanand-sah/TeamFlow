import { withTimeout } from './with-timeout';

describe('withTimeout', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('resolves with the value when the promise is fast enough', async () => {
    await expect(withTimeout(Promise.resolve(42), 1000, 'op')).resolves.toBe(
      42,
    );
  });

  it('passes through rejections', async () => {
    await expect(
      withTimeout(Promise.reject(new Error('boom')), 1000, 'op'),
    ).rejects.toThrow('boom');
  });

  it('rejects when the promise never settles', async () => {
    const result = withTimeout(
      new Promise<never>(() => undefined),
      1000,
      'queue.add',
    );
    jest.advanceTimersByTime(1000);

    await expect(result).rejects.toThrow('queue.add timed out after 1000 ms');
  });
});
