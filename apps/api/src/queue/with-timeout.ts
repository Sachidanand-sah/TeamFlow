/** How long producers wait for Redis before giving up on enqueueing. */
export const QUEUE_CALL_TIMEOUT_MS = 3000;

/**
 * Rejects if `promise` has not settled within `ms`.
 *
 * WHY: BullMQ waits for the Redis connection to become ready before running any
 * command, so while Redis is down `queue.add()` does not settle. The timeout makes
 * the caller stop waiting and log the problem. Note it cannot cancel the original
 * call: if Redis comes back, that call may still complete (the job then runs late,
 * which is fine for notifications).
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms} ms`)),
      ms,
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
