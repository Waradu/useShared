import {
  emit,
  listen,
  once,
  type UnlistenFn,
  type Event,
} from "@tauri-apps/api/event";
import { ref, watch } from "vue";

interface Data<T> {
  /**
   * A unique identifier for this window's instance.
   */
  id: string;

  /**
   * The reactive shared data.
   */
  data?: T;

  /**
   * Initial value for the shared data.
   */
  initialData?: T;
}

interface Storage<T> {
  set: (key: string, data: T) => void;
  get: (key: string) => T;
  delete?: (key: string) => void;
}

interface Config<T> {
  /**
   * Initial value for the shared data.
   */
  initialData?: T;

  /**
   * If true, logs debug messages to the console.
   * Defaults to false.
   */
  debug?: boolean;

  /**
   * Key to identify the shared data group.
   * Use different keys if you want to sync multiple separate values.
   */
  key?: string;

  /**
   * Optional event listeners to hook into update and sync actions.
   */
  on?: {
    /**
     * Called when this window broadcasts an update.
     */
    updateSent?: () => void;

    /**
     * Called when this window receives an update from another window.
     */
    updateReceived?: (event: Event<Data<T>>) => void;

    /**
     * Called when this window responds to a sync request.
     */
    syncSent?: () => void;

    /**
     * Called when this window receives a sync response.
     */
    syncReceived?: (event: Event<Data<T>>) => void;
  };

  /**
   * Custom store
   */
  store?: Storage<T>;
}

/**
 * Share reactive data across Tauri windows using Vue's reactivity system.
 *
 * This composable helps keep data in sync between multiple windows of a Tauri app.
 * It uses Tauri's `@tauri-apps/api/event` module for communication and Vue refs for reactivity.
 *
 * @template T - The shape of the data you want to sync.
 * @param config - Optional settings to configure how the shared data behaves.
 *
 * @returns An object with the shared data ref, metadata, and utility functions.
 *
 * @example
 * ```ts
 * const { data, isSynced } = useShared<string>({
 *   key: "sharedText",
 *   initialData: "Hello",
 *   debug: true,
 *   on: {
 *     updateReceived: (event) => {
 *       console.log("Data updated from another window", event.payload);
 *     },
 *   },
 * });
 * ```
 */
export const useShared = <T>(config?: Config<T>) => {
  type IntData = Data<T>;

  const id = Math.random().toString(36).slice(2, 7);
  const key = config?.key || "root";
  const dataRef = ref<T>();
  const updating = ref(false);
  const isSynced = ref(false);
  const lastUpdated = ref<Date>(new Date());
  const initialData = ref<T>();

  if (config?.initialData) {
    dataRef.value = config.initialData;
    initialData.value = config.initialData;
    if (config?.store && dataRef.value) dataRef.value = config.store.get(key);
  }

  const log = (text: string) => {
    if (config?.debug) console.log(`SHARED (${id}) ${text}`);
  };

  const unlistenFns: UnlistenFn[] = [];
  const destroy = () => {
    unlistenFns.forEach((unlistenFn) => unlistenFn());
  };

  listen<IntData>(`shared:update:${key}`, (event) => {
    if (event.payload == undefined || event.payload.id == id) return;

    updating.value = true;
    dataRef.value = event.payload.data;
    lastUpdated.value = new Date();

    log(`Update completed`);

    if (config?.on?.updateReceived) config.on.updateReceived(event);
  }).then((unlistenFn) => unlistenFns.push(unlistenFn));

  listen<IntData>(`shared:get:${key}`, (event) => {
    if (
      event.payload == undefined ||
      event.payload.id == id ||
      dataRef.value == undefined
    )
      return;

    log(`Sync request recieved from '${event.payload.id}'`);

    emit<IntData>(`shared:set:${key}:${event.payload.id}`, {
      id: id,
      data: dataRef.value,
      initialData: initialData.value,
    });

    if (config?.on?.syncSent) config.on.syncSent();
  }).then((unlistenFn) => unlistenFns.push(unlistenFn));

  once<IntData>(`shared:set:${key}:${id}`, (event) => {
    if (event.payload == undefined || event.payload.id == id) return;
    if (dataRef.value == event.payload.data) return;

    dataRef.value = event.payload.data;
    initialData.value = event.payload.initialData;
    try {
      if (config?.store && dataRef.value) config.store.set(key, dataRef.value);
    } catch (e) {
      log(`${e}`);
    }
    lastUpdated.value = new Date();
    isSynced.value = true;

    log(`Sync completed from '${event.payload.id}'`);

    if (config?.on?.syncReceived) config.on.syncReceived(event);
  }).then((unlistenFn) => unlistenFns.push(unlistenFn));

  emit<IntData>(`shared:get:${key}`, { id: id });

  log(`Requested sync`);

  const sync = () => {
    if (dataRef.value == undefined) return;

    log(`Broadcasting update`);

    emit<IntData>(`shared:update:${key}`, {
      id: id,
      data: dataRef.value,
    });

    try {
      if (config?.store && dataRef.value) config.store.set(key, dataRef.value);
    } catch (e) {
      log(`${e}`);
    }

    lastUpdated.value = new Date();

    if (config?.on?.updateSent) config.on.updateSent();
  };

  const reset = () => {
    if (!config || initialData.value == undefined) return;

    dataRef.value = initialData.value;
  };

  unlistenFns.push(
    watch(
      dataRef,
      () => {
        if (updating.value) {
          updating.value = false;
          return;
        }

        sync();
      },
      { deep: true }
    )
  );

  log(`Initialized`);

  return {
    /**
     * The reactive shared data.
     */
    data: dataRef,

    /**
     * A unique identifier for this window's instance.
     */
    id,

    /**
     * The key used to separate different shared data sets.
     */
    key,

    /**
     * Becomes true after an initial sync is completed with another window.
     */
    isSynced,

    /**
     * Unsubscribes all event listeners.
     * Call this when the component or app using this is destroyed.
     */
    destroy,

    /**
     * Resets the data to config.initalData.
     */
    reset,

    /**
     * The timestamp of the last update (either sent or received).
     */
    lastUpdated,

    /**
     * Initial value for the shared data.
     */
    initialData,
  };
};
