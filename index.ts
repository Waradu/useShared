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
}

interface Config<T> {
  /**
   * Initial value for the shared data.
   * It's recommended to set this to avoid `undefined` errors.
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

  if (config?.initialData) dataRef.value = config.initialData;

  const log = (text: string) => {
    if (config?.debug) console.log(`SHARED (${id}) ${text}`);
  };

  const unlistenFns: UnlistenFn[] = [];
  const destroy = () => {
    unlistenFns.forEach((unlistenFn) => unlistenFn());
  };

  listen<IntData>(`shared:update:${key}`, (event) => {
    if (!event.payload || event.payload.id == id) return;

    updating.value = true;
    dataRef.value = event.payload.data;
    lastUpdated.value = new Date();

    log(`Update completed`);

    if (config?.on?.updateReceived) config.on.updateReceived(event);
  }).then((unlistenFn) => unlistenFns.push(unlistenFn));

  listen<IntData>(`shared:get:${key}`, (event) => {
    if (!event.payload || event.payload.id == id || !dataRef.value) return;

    log(`Sync request recieved from '${event.payload.id}'`);

    emit<IntData>(`shared:set:${key}:${event.payload.id}`, {
      id: id,
      data: dataRef.value,
    });

    if (config?.on?.syncSent) config.on.syncSent();
  }).then((unlistenFn) => unlistenFns.push(unlistenFn));

  once<IntData>(`shared:set:${key}:${id}`, (event) => {
    if (!event.payload || event.payload.id == id) return;
    if (dataRef.value == event.payload.data) return;

    dataRef.value = event.payload.data;
    lastUpdated.value = new Date();
    isSynced.value = true;

    log(`Sync completed from '${event.payload.id}'`);

    if (config?.on?.syncReceived) config.on.syncReceived(event);
  }).then((unlistenFn) => unlistenFns.push(unlistenFn));

  emit<IntData>(`shared:get:${key}`, { id: id });

  log(`Requested sync`);

  const sync = () => {
    if (!dataRef.value) return;

    log(`Broadcasting update`);

    emit<IntData>(`shared:update:${key}`, {
      id: id,
      data: dataRef.value,
    });

    lastUpdated.value = new Date();

    if (config?.on?.updateSent) config.on.updateSent();
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
     * The timestamp of the last update (either sent or received).
     */
    lastUpdated,
  };
};
