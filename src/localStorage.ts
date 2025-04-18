export class LocalStorage<T> {
  set(key: string, data: T) {
    const json = JSON.stringify(data);
    localStorage.setItem(key, json);
  }

  get(key: string): T {
    const item = localStorage.getItem(key);
    if (!item) throw new Error(`No data found for key: ${key}`);
    return JSON.parse(item);
  }

  delete(key: string) {
    localStorage.removeItem(key);
  }
}
