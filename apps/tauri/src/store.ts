import { useStore } from 'zustand'
import { createNavigationStore, type NavigationState } from '@navigation/app'
import { createLocalStoragePort } from './adapters/storage'

const handle = createNavigationStore({
  storage: createLocalStoragePort(),
  createId: () => crypto.randomUUID(),
})

/** 原生 StoreApi：供 adapter、订阅等非 React 入口使用。 */
export const navigationStore = handle.store
/** 启动时加载本地快照；重复调用复用同一个加载 Promise。 */
export const hydrateNavigation = handle.hydrate
/** 损坏数据清空恢复：写入空快照成功后才进入可编辑状态。 */
export const resetCorruptData = handle.resetCorruptData

export function useNavigationStore(): NavigationState
export function useNavigationStore<T>(selector: (state: NavigationState) => T): T
export function useNavigationStore<T>(selector?: (state: NavigationState) => T): NavigationState | T {
  return selector ? useStore(navigationStore, selector) : useStore(navigationStore)
}
