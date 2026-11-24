import type { StoragePort } from '@navigation/app'

const STORAGE_KEY = 'navigation-state'

/** WebView/浏览器侧异步持久化端口；localStorage 同步 API 在此包成异步接口。 */
export function createLocalStoragePort(): StoragePort {
  return {
    async load(): Promise<string | null> {
      return localStorage.getItem(STORAGE_KEY)
    },
    async save(value: string): Promise<void> {
      localStorage.setItem(STORAGE_KEY, value)
    },
  }
}
