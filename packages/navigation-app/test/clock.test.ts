import { describe, expect, it } from 'vitest'
import { elapsedMonotonicSeconds } from '../src/clock'

describe('elapsedMonotonicSeconds', () => {
  it('computes elapsed time from the monotonic timestamp delta', () => {
    const result = elapsedMonotonicSeconds(1000, 3000)
    expect(result.elapsedSeconds).toBeCloseTo(2)
    expect(result.nextTick).toBe(3000)
  })

  it('treats a non-monotonic sample as zero instead of a negative elapsed time', () => {
    // 单调时钟不会回退；即使传入回退样本，推进量也不得为负，墙钟前后调整不影响差值口径。
    const result = elapsedMonotonicSeconds(3000, 2000)
    expect(result.elapsedSeconds).toBe(0)
  })

  it('reports zero elapsed on the first sample', () => {
    const result = elapsedMonotonicSeconds(null, 500)
    expect(result.elapsedSeconds).toBe(0)
    expect(result.nextTick).toBe(500)
  })
})
