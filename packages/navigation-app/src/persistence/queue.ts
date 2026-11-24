import type { StoragePort } from '@navigation/platform-contracts'

export type PersistState = 'idle' | 'saving' | 'saved' | 'failed'

export interface PersistStatus {
  state: PersistState
  message: string | null
}

/**
 * 顺序写队列：revision 标记快照版本，savedRevision 标记最后成功保存的版本。
 * 保存期间提交的新快照不会丢失；前一轮成功后若有更新版本，继续保存最新快照。
 * 失败后进入 paused，保留最新快照，等待明确 retry，不自动重放过时快照。
 */
export class PersistenceQueue {
  private latest: string | null = null
  private revision = 0
  private savedRevision = 0
  private running = false
  private paused = false

  constructor(
    private readonly storage: StoragePort,
    private readonly onStatus: (status: PersistStatus) => void,
  ) {}

  /** 把已加载到内存的快照设为基线；revision 与 savedRevision 对齐，不触发保存。 */
  setBaseline(serialized: string): void {
    this.latest = serialized
    this.savedRevision = this.revision
  }

  save(serialized: string): void {
    // 相同内容直接返回，避免持久化状态回写订阅再次触发保存形成循环。
    if (serialized === this.latest) {
      return
    }
    this.latest = serialized
    this.revision += 1
    if (!this.paused) {
      this.start()
    }
  }

  /** 清除暂停并保存当前最新快照；不重放已经过时的失败快照。 */
  retry(): void {
    if (this.latest === null) {
      return
    }
    this.paused = false
    this.start()
  }

  private start(): void {
    if (this.running) {
      return
    }
    this.running = true
    void this.loop()
  }

  private async loop(): Promise<void> {
    try {
      for (;;) {
        if (this.latest === null) {
          break
        }
        const value = this.latest
        const targetRevision = this.revision
        this.onStatus({ state: 'saving', message: null })
        try {
          await this.storage.save(value)
          this.savedRevision = targetRevision
          if (this.revision > this.savedRevision) {
            // 等待期间又提交了更新版本，继续保存最新快照，不能把旧版本标为已保存。
            continue
          }
          this.onStatus({ state: 'saved', message: null })
          break
        } catch (error) {
          this.paused = true
          this.onStatus({
            state: 'failed',
            message: error instanceof Error ? error.message : String(error),
          })
          break
        }
      }
    } finally {
      this.running = false
    }
  }
}
