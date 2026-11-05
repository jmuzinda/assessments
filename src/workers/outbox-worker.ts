import type { OutboxDispatcher } from '../modules/notifications/infrastructure/dispatcher';

export function startOutboxWorker(dispatcher: OutboxDispatcher, intervalMs: number): { stop(): void } {
  const timer = setInterval(() => {
    dispatcher.publishPending();
  }, intervalMs);
  timer.unref();
  return {
    stop(): void {
      clearInterval(timer);
    },
  };
}
