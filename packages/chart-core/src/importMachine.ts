import { ChartErrorCode, type ChartError } from './errors'

/**
 * Lifecycle of a single chart import. The catalogue exposes a per-record
 * status derived from this machine; `READY` means the previously committed
 * file is valid.
 *
 *   IDLE
 *     | start
 *     v
 *   VALIDATING --(fail)--> VALIDATE_FAILED (temp cleaned)
 *     | ok
 *     v
 *   IMPORTING --(cancel/fail)--> IMPORT_FAILED (temp cleaned, old version intact)
 *     | write progress
 *     v
 *   COMMITTING --(fail)--> COMMIT_FAILED (temp cleaned, old version intact)
 *     | verify ok + atomic move
 *     v
 *   READY
 *
 * Recovery: an interrupted import (app killed mid-COMMITTING) leaves a temp
 * file on disk. On next launch the catalogue scans temp records and marks
 * them INTERRUPTED; the caller then chooses cleanup, which keeps the old
 * READY version untouched.
 */
export enum ImportPhase {
  IDLE = 'IDLE',
  VALIDATING = 'VALIDATING',
  IMPORTING = 'IMPORTING',
  COMMITTING = 'COMMITTING',
  READY = 'READY',
  VALIDATE_FAILED = 'VALIDATE_FAILED',
  IMPORT_FAILED = 'IMPORT_FAILED',
  COMMIT_FAILED = 'COMMIT_FAILED',
  CANCELLED = 'CANCELLED',
  INTERRUPTED = 'INTERRUPTED',
}

export interface ImportState {
  phase: ImportPhase
  /** 0..1 progress during IMPORTING. */
  progress: number
  /** Set when terminal failure. */
  error: ChartError | undefined
  /** Stable record id of the in-progress import. */
  recordId: string
  /** Temp path being written (valid until COMMITTING completes). */
  tempPath: string | undefined
  /** Final committed path (valid when READY). */
  committedPath: string | undefined
}

export function idleState(recordId: string): ImportState {
  return {
    phase: ImportPhase.IDLE,
    progress: 0,
    error: undefined,
    recordId,
    tempPath: undefined,
    committedPath: undefined,
  }
}

export type ImportEvent =
  | { type: 'START'; tempPath: string }
  | { type: 'VALIDATE_OK' }
  | { type: 'VALIDATE_FAIL'; error: ChartError }
  | { type: 'PROGRESS'; value: number }
  | { type: 'WRITE_OK' }
  | { type: 'VERIFY_OK' }
  | { type: 'VERIFY_FAIL'; error: ChartError }
  | { type: 'CANCEL' }
  | { type: 'INTERRUPT' }
  | { type: 'RESET' }

/**
 * Pure transition. The caller is responsible for side effects (deleting temp
 * files, flipping the catalogue pointer) and MUST only do so when the new
 * state is terminal failure/cancel/ready. This function never touches disk.
 */
export function transition(state: ImportState, event: ImportEvent): ImportState {
  switch (event.type) {
    case 'START':
      return { ...state, phase: ImportPhase.VALIDATING, progress: 0, error: undefined, tempPath: event.tempPath }
    case 'VALIDATE_OK':
      return state.phase === ImportPhase.VALIDATING
        ? { ...state, phase: ImportPhase.IMPORTING }
        : state
    case 'VALIDATE_FAIL':
      return state.phase === ImportPhase.VALIDATING
        ? { ...state, phase: ImportPhase.VALIDATE_FAILED, error: event.error, tempPath: undefined }
        : state
    case 'PROGRESS':
      return state.phase === ImportPhase.IMPORTING
        ? { ...state, progress: Math.min(1, Math.max(0, event.value)) }
        : state
    case 'WRITE_OK':
      return state.phase === ImportPhase.IMPORTING
        ? { ...state, phase: ImportPhase.COMMITTING, progress: 1 }
        : state
    case 'VERIFY_OK':
      return state.phase === ImportPhase.COMMITTING
        ? { ...state, phase: ImportPhase.READY, tempPath: undefined, committedPath: state.tempPath }
        : state
    case 'VERIFY_FAIL':
      return state.phase === ImportPhase.COMMITTING
        ? { ...state, phase: ImportPhase.COMMIT_FAILED, error: event.error, tempPath: undefined }
        : state
    case 'CANCEL':
      return state.phase === ImportPhase.IMPORTING || state.phase === ImportPhase.VALIDATING
        ? { ...state, phase: ImportPhase.CANCELLED, tempPath: undefined, error: { code: ChartErrorCode.CANCELLED } }
        : state
    case 'INTERRUPT':
      return state.phase === ImportPhase.IMPORTING || state.phase === ImportPhase.COMMITTING
        ? { ...state, phase: ImportPhase.INTERRUPTED }
        : state
    case 'RESET':
      return idleState(state.recordId)
    default:
      return state
  }
}

/** States after which the caller MUST delete the temp file (if present). */
export function needsTempCleanup(state: ImportState): boolean {
  return (
    state.phase === ImportPhase.VALIDATE_FAILED ||
    state.phase === ImportPhase.IMPORT_FAILED ||
    state.phase === ImportPhase.COMMIT_FAILED ||
    state.phase === ImportPhase.CANCELLED ||
    state.phase === ImportPhase.INTERRUPTED
  )
}

/**
 * The catalogue pointer flips to the new file ONLY when the machine reaches
 * READY. On any failure/cancel/interrupt the old committed path stays valid.
 */
export function isCommitted(state: ImportState): boolean {
  return state.phase === ImportPhase.READY
}
