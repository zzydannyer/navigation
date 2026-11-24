import type { PermissionOutcome, LocationPermissionState } from './permission';

/** 界面可见的授权视图。outcome 为 null 表示首次检查尚未返回。 */
export interface PermissionView {
  outcome: PermissionOutcome | null;
  busy: boolean;
  settingsError: string | null;
}

export interface PermissionDeps {
  check: () => Promise<PermissionOutcome>;
  request: () => Promise<PermissionOutcome>;
  openSettings: () => Promise<string | null>;
}

export interface PermissionCoordinator {
  /** 重新读取权限；忙碌时忽略，避免弹窗返回前台时覆盖请求结果。 */
  refresh: () => void;
  /** 请求权限；已有检查或请求在途时复用同一次，不重复调用。 */
  request: () => Promise<void>;
  openSettings: () => Promise<void>;
  /** 卸载时使所有在途结果失效。 */
  dispose: () => void;
}

const initialState = (busy: boolean): PermissionView => ({
  outcome: null,
  busy,
  settingsError: null,
});

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function failure(error: unknown): PermissionOutcome {
  return { state: 'denied', error: describe(error) };
}

/**
 * 授权生命周期协调器：每次异步操作分配递增代际，只有最新代际且未销毁的结果可以写回视图。
 */
export function createPermissionCoordinator(
  deps: PermissionDeps,
  emit: (view: PermissionView) => void,
): PermissionCoordinator {
  let generation = 0;
  let checkSeq = 0;
  let pendingRecheck = false;
  let disposed = false;
  let inFlight: 'check' | 'request' | null = null;
  let view: PermissionView = initialState(true);

  const publish = (patch: Partial<PermissionView>) => {
    view = { ...view, ...patch };
    if (!disposed) {
      emit(view);
    }
  };

  const isCurrent = (gen: number) => !disposed && gen === generation;

  const runCheck = () => {
    const seq = ++checkSeq;
    const gen = ++generation;
    pendingRecheck = false;
    inFlight = 'check';
    publish({ busy: true });
    void deps
      .check()
      .catch(failure)
      .then((outcome) => {
        if (disposed) {
          return;
        }
        if (seq !== checkSeq) {
          // 本轮检查已被更新的刷新取代：按最新权限再读一次。
          if (pendingRecheck && inFlight === 'check') {
            runCheck();
          }
          return;
        }
        if (!isCurrent(gen)) {
          return;
        }
        inFlight = null;
        publish({ outcome, busy: false });
      });
  };

  const refresh = () => {
    if (disposed || inFlight === 'request') {
      return;
    }
    if (inFlight === 'check') {
      // 作废在途检查并合并一次后续读取，旧结果不再发布。
      checkSeq += 1;
      pendingRecheck = true;
      publish({ busy: true });
      return;
    }
    runCheck();
  };

  const request = async () => {
    if (disposed) {
      return;
    }
    if (inFlight === 'request') {
      return;
    }
    const gen = ++generation;
    pendingRecheck = false;
    inFlight = 'request';
    publish({ busy: true, settingsError: null });
    const outcome = await deps.request().catch(failure);
    if (!isCurrent(gen)) {
      return;
    }
    inFlight = null;
    publish({ outcome, busy: false });
  };

  const openSettings = async () => {
    // 检查或请求进行中不打开设置，也不改代际，避免把在途操作卡死。
    if (disposed || inFlight !== null) {
      return;
    }
    publish({ settingsError: null });
    let error: string | null = null;
    try {
      error = await deps.openSettings();
    } catch (thrown) {
      error = describe(thrown);
    }
    publish({ settingsError: error });
  };

  const dispose = () => {
    disposed = true;
    generation += 1;
  };

  return { refresh, request, openSettings, dispose };
}

/** 未授权时是否展示系统设置入口：denied 也可能已被永久拒绝，入口不能消失。 */
export function shouldOfferSettings(state: LocationPermissionState | undefined): boolean {
  return state !== 'granted';
}
