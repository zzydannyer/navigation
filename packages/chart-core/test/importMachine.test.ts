import { describe, expect, it } from 'vitest'
import {
  ChartErrorCode,
  idleState,
  ImportPhase,
  isCommitted,
  needsTempCleanup,
  transition,
} from '../src'

describe('importMachine', () => {
  it('happy path: idle -> validating -> importing -> committing -> ready flips committed path', () => {
    let s = idleState('rec-1')
    s = transition(s, { type: 'START', tempPath: '/tmp/rec-1.pmtiles' })
    expect(s.phase).toBe(ImportPhase.VALIDATING)
    s = transition(s, { type: 'VALIDATE_OK' })
    expect(s.phase).toBe(ImportPhase.IMPORTING)
    s = transition(s, { type: 'PROGRESS', value: 0.5 })
    expect(s.progress).toBe(0.5)
    s = transition(s, { type: 'WRITE_OK' })
    expect(s.phase).toBe(ImportPhase.COMMITTING)
    s = transition(s, { type: 'VERIFY_OK' })
    expect(s.phase).toBe(ImportPhase.READY)
    expect(isCommitted(s)).toBe(true)
    expect(s.committedPath).toBe('/tmp/rec-1.pmtiles')
    expect(s.tempPath).toBeUndefined()
  })

  it('cancel during IMPORTING marks CANCELLED and temp must be cleaned', () => {
    let s = idleState('rec-2')
    s = transition(s, { type: 'START', tempPath: '/tmp/rec-2.pmtiles' })
    s = transition(s, { type: 'VALIDATE_OK' })
    s = transition(s, { type: 'PROGRESS', value: 0.3 })
    s = transition(s, { type: 'CANCEL' })
    expect(s.phase).toBe(ImportPhase.CANCELLED)
    expect(s.error?.code).toBe(ChartErrorCode.CANCELLED)
    expect(needsTempCleanup(s)).toBe(true)
    expect(isCommitted(s)).toBe(false)
  })

  it('validation failure does NOT promote to IMPORTING and requires temp cleanup', () => {
    let s = idleState('rec-3')
    s = transition(s, { type: 'START', tempPath: '/tmp/rec-3.pmtiles' })
    s = transition(s, { type: 'VALIDATE_FAIL', error: { code: ChartErrorCode.CORRUPTED, detail: 'bad magic' } })
    expect(s.phase).toBe(ImportPhase.VALIDATE_FAILED)
    expect(s.error?.code).toBe(ChartErrorCode.CORRUPTED)
    expect(needsTempCleanup(s)).toBe(true)
    expect(isCommitted(s)).toBe(false)
  })

  it('verify failure during COMMITTING rolls back to COMMIT_FAILED, old version stays valid', () => {
    let s = idleState('rec-4')
    s = transition(s, { type: 'START', tempPath: '/tmp/rec-4.pmtiles' })
    s = transition(s, { type: 'VALIDATE_OK' })
    s = transition(s, { type: 'WRITE_OK' })
    s = transition(s, { type: 'VERIFY_FAIL', error: { code: ChartErrorCode.RUNTIME, detail: 'checksum mismatch' } })
    expect(s.phase).toBe(ImportPhase.COMMIT_FAILED)
    expect(needsTempCleanup(s)).toBe(true)
    expect(isCommitted(s)).toBe(false)
    // The catalogue is expected to keep the previously committed path; the
    // machine itself never overwrites committedPath on failure.
    expect(s.committedPath).toBeUndefined()
  })

  it('power-loss INTERRUPT during IMPORTING/COMMITTING marks INTERRUPTED for cleanup', () => {
    let s = idleState('rec-5')
    s = transition(s, { type: 'START', tempPath: '/tmp/rec-5.pmtiles' })
    s = transition(s, { type: 'VALIDATE_OK' })
    s = transition(s, { type: 'PROGRESS', value: 0.8 })
    s = transition(s, { type: 'INTERRUPT' })
    expect(s.phase).toBe(ImportPhase.INTERRUPTED)
    expect(needsTempCleanup(s)).toBe(true)
    expect(isCommitted(s)).toBe(false)
  })

  it('events out of phase are ignored (e.g. VERIFY_OK before COMMITTING)', () => {
    let s = idleState('rec-6')
    s = transition(s, { type: 'VERIFY_OK' })
    expect(s.phase).toBe(ImportPhase.IDLE)
    s = transition(s, { type: 'START', tempPath: '/tmp/rec-6.pmtiles' })
    s = transition(s, { type: 'PROGRESS', value: 0.5 })
    expect(s.phase).toBe(ImportPhase.VALIDATING)
    s = transition(s, { type: 'VERIFY_OK' })
    expect(s.phase).toBe(ImportPhase.VALIDATING)
  })

  it('RESET returns to idle state', () => {
    let s = idleState('rec-7')
    s = transition(s, { type: 'START', tempPath: '/tmp/rec-7.pmtiles' })
    s = transition(s, { type: 'VALIDATE_FAIL', error: { code: ChartErrorCode.CORRUPTED } })
    s = transition(s, { type: 'RESET' })
    expect(s.phase).toBe(ImportPhase.IDLE)
    expect(s.error).toBeUndefined()
    expect(s.progress).toBe(0)
  })
})
