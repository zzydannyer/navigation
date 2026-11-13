import { createNavigationStore } from '@navigation/core'
import { isNull } from 'lodash-es'

const STORAGE_KEY = 'navigation-state'

export const useNavigationStore = createNavigationStore(
  {
    read: () => {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (isNull(raw)) {
        return ''
      }
      return raw
    },
    write: (value) => {
      localStorage.setItem(STORAGE_KEY, value)
    },
  },
  () => crypto.randomUUID(),
)
