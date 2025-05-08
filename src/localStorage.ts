import type { Storage } from ".";

/**
 * Save data to localStorage
 */
export class LocalStorage<T> implements Storage<T> {
  set(key: string, data: T) {
    const json = JSON.stringify(data);
    localStorage.setItem(key, json);
  }

  get(key: string): T | undefined {
    const item = localStorage.getItem(key);
    if (!item) return undefined;
    return JSON.parse(item);
  }

  delete(key: string) {
    localStorage.removeItem(key);
  }
}
