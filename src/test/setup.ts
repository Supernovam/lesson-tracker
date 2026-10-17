import '@testing-library/react';

// Node 22+ ships its own `localStorage` global, which shadows jsdom's and does not work
// without `--localstorage-file`. Tests get a working in-memory Storage instead.
class MemoryStorage implements Storage {
  private items = new Map<string, string>();

  get length() {
    return this.items.size;
  }

  clear() {
    this.items.clear();
  }

  getItem(key: string) {
    return this.items.get(key) ?? null;
  }

  key(index: number) {
    return [...this.items.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.items.delete(key);
  }

  setItem(key: string, value: string) {
    this.items.set(key, String(value));
  }
}

Object.defineProperty(window, 'localStorage', { value: new MemoryStorage(), configurable: true });
