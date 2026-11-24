import { useSyncExternalStore } from 'react';
import Storage from 'expo-sqlite/kv-store';
import { createNavigationStore, type NavigationState } from '@navigation/app';

let idSequence = 0;
const handle = createNavigationStore({
  storage: {
    load: () => Storage.getItem('navigation-state'),
    save: (value) => Storage.setItem('navigation-state', value),
  },
  createId: () => `mobile-${Date.now().toString(36)}-${(++idSequence).toString(36)}-${Math.random().toString(36).slice(2)}`,
});

export const navigationStore = handle.store;
export const hydrateNavigation = handle.hydrate;
export const resetCorruptData = handle.resetCorruptData;

/** 与 Tauri 同形的 selector 订阅；不支持 selector 时返回整份状态。 */
export function useNavigationStore(): NavigationState;
export function useNavigationStore<T>(selector: (state: NavigationState) => T): T;
export function useNavigationStore<T>(
  selector?: (state: NavigationState) => T,
): NavigationState | T {
  return useSyncExternalStore(
    navigationStore.subscribe,
    () => (selector ? selector(navigationStore.getState()) : navigationStore.getState()),
    () => (selector ? selector(navigationStore.getState()) : navigationStore.getState()),
  );
}
