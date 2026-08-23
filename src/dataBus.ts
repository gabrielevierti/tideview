import { DEFAULT_CONDITIONS, type Conditions } from "./models";

type Listener = (data: Conditions) => void;

/**
 * A minimal observable store. Every mutation replaces the top-level object so
 * consumers can cheaply compare identity, and stamps `timestamp` so staleness is
 * always answerable.
 */
class DataBus {
  private data: Conditions = structuredClone(DEFAULT_CONDITIONS);
  private readonly listeners = new Set<Listener>();

  get(): Conditions {
    return this.data;
  }

  update(patch: Partial<Conditions>): void {
    this.data = { ...this.data, ...patch, timestamp: Date.now() };
    this.emit();
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.data);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit(): void {
    for (const fn of [...this.listeners]) {
      try {
        fn(this.data);
      } catch (err) {
        console.error("[dataBus] listener threw", err);
      }
    }
  }
}

export const dataBus = new DataBus();
