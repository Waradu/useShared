# useShared

Shared values between windows in tauri and nuxt with tauri events.

### Example

```ts
// Type
interface User {
  name: string;
  age: number;
}

// Window 1
const { data } = useShared<User>({
  key: "user",
  data: {
    name: "Waradu",
    age: 31,
  },
});

// Window 2
const { data } = useShared<User>({
  key: "user",
});
```

### Store

Lets say we have this (no key = `root`):

```ts
const { data: isDarkmode } = useShared<boolean>({ data: true });
```

We can use it like:

```html
<button @click="isDarkmode = !isDarkmode">Toggle Darkmode</button>
```

Now add a store to save it to localStorage:

```ts
class LocalStorage<T> {
  set(key: string, data: T) {
    const json = JSON.stringify(data);
    localStorage.setItem(key, json);
  }

  get(key: string): T | undefined {
    const item = localStorage.getItem(key);
    if (!item) return undefined;
    return JSON.parse(item);
  }
}

// This LocalStorage can also be imported from "@waradu/useshared"
// import { LocalStorage } from "@waradu/useshared"

const { data: isDarkmode } = useShared({
  data: true,
  store: new LocalStorage(),
});
```

### Other stuff

```ts
const shared = useShared()

shared.destroy() // destroy the connection. it will still be rective but only on the current window.

shared.reset() // reset to the initial added data. Call this on unmount if needed.
```
