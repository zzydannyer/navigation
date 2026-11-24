export {
  createNavigationStore,
  type HydrationState,
  type LoadError,
  type LoadErrorKind,
  type NavigationState,
  type NavigationSession,
  type NavigationSessionStatus,
  type NavigationMode,
  type NavigationStoreHandle,
  type NavigationStoreOptions,
} from './store/createNavigationStore'
export { selectActiveLeg, type ActiveLegSelection } from './store/selectActiveLeg'
export {
  selectNavigationGuidance,
  type NavigationGuidance,
} from './store/selectNavigationGuidance'
export {
  FIX_FUTURE_TOLERANCE_MS,
  FIX_STALE_MS,
  hasFreshRealFix,
  isFreshFix,
} from './store/fixFreshness'
export {
  projectChartLayers,
  type ChartProjectionOptions,
} from './chart/projectChartLayers'
export type { ChartLayers } from './chart/chartLayers'
export { elapsedMonotonicSeconds } from './clock'
export { PersistenceQueue, type PersistStatus, type PersistState } from './persistence/queue'
export {
  SCHEMA_VERSION,
  emptySnapshot,
  parsePersist,
  serializeSnapshot,
  type ParseResult,
  type PersistSnapshot,
} from './persistence/persistDTO'
export type { LocationPosition, LocationErrorCode, StoragePort } from '@navigation/platform-contracts'
export { LocationPermissionStatus, LocationError } from '@navigation/platform-contracts'
