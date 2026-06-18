import type { PivotEventMap, PivotEventName } from './types';

type Handler<K extends PivotEventName> = (payload: PivotEventMap[K]) => void;

/**
 * Minimal, dependency-free typed event emitter used by the engine to notify
 * renderers and host apps about state changes.
 */
export class EventEmitter {
  private handlers = new Map<PivotEventName, Set<(payload: any) => void>>();

  on<K extends PivotEventName>(event: K, handler: Handler<K>): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler as (payload: any) => void);
    return () => this.off(event, handler);
  }

  once<K extends PivotEventName>(event: K, handler: Handler<K>): () => void {
    const wrapped: Handler<K> = (payload) => {
      this.off(event, wrapped);
      handler(payload);
    };
    return this.on(event, wrapped);
  }

  off<K extends PivotEventName>(event: K, handler: Handler<K>): void {
    this.handlers.get(event)?.delete(handler as (payload: any) => void);
  }

  emit<K extends PivotEventName>(event: K, payload: PivotEventMap[K]): void {
    const set = this.handlers.get(event);
    if (!set) return;
    // Copy so handlers can safely unsubscribe during dispatch.
    for (const handler of [...set]) {
      try {
        handler(payload);
      } catch (error) {
        if (event !== 'error') {
          this.emit('error', { message: 'Event handler threw', error });
        }
      }
    }
  }

  clear(): void {
    this.handlers.clear();
  }
}
