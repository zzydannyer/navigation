/**
 * 平台无关的异步持久化端口。各 app adapter 提供 localStorage、RN AsyncStorage 等实现；
 * 应用状态层不直接读取平台存储模块。
 */
export interface StoragePort {
  /** 读取原始文本；无数据时返回 null。 */
  load(): Promise<string | null>
  /** 写入完整快照文本。实现应保证写入落盘后再 resolve。 */
  save(value: string): Promise<void>
}
