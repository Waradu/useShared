# useShared

Shared values between windows in tauri with nuxt.

Types:

```ts
interface Data {
  name: string;
  age: number;
}
```

Window 1:

```ts
const { data } = useShared<Data>({
  key: "test",
  initialData: {
    name: "Hello",
    age: 31,
  },
});
```

Window 2:

```ts
const { data } = useShared<Data>({
  key: "test",
});
```
