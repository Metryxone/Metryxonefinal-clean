type EventHandler<T = unknown> = (payload: T) => void;

class EventBus {
  private listeners: Map<string, Set<EventHandler<any>>> = new Map();

  on<T>(event: string, handler: EventHandler<T>): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(handler);
    return () => this.off(event, handler);
  }

  off<T>(event: string, handler: EventHandler<T>): void {
    this.listeners.get(event)?.delete(handler);
  }

  emit<T>(event: string, payload: T): void {
    this.listeners.get(event)?.forEach(h => {
      try { h(payload); } catch (e) { console.error(`[EventBus] Error in handler for "${event}":`, e); }
    });
  }

  once<T>(event: string, handler: EventHandler<T>): void {
    const wrapper: EventHandler<T> = (payload) => { handler(payload); this.off(event, wrapper); };
    this.on(event, wrapper);
  }

  clear(event?: string): void {
    if (event) this.listeners.delete(event);
    else this.listeners.clear();
  }
}

export const eventBus = new EventBus();
