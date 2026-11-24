import type { PermissionOutcome } from '../src/adapters/location/permission';
import {
  createPermissionCoordinator,
  shouldOfferSettings,
  type PermissionView,
} from '../src/adapters/location/permissionCoordinator';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const denied: PermissionOutcome = { state: 'denied', error: null };
const granted: PermissionOutcome = { state: 'granted', error: null };

function setup(overrides: Partial<Parameters<typeof createPermissionCoordinator>[0]> = {}) {
  const views: PermissionView[] = [];
  const deps = {
    check: jest.fn<Promise<PermissionOutcome>, []>().mockResolvedValue(denied),
    request: jest.fn<Promise<PermissionOutcome>, []>().mockResolvedValue(granted),
    openSettings: jest.fn<Promise<string | null>, []>().mockResolvedValue(null),
    ...overrides,
  };
  const coordinator = createPermissionCoordinator(deps, (view) => views.push(view));
  return { views, deps, coordinator, latest: () => views[views.length - 1] };
}

const flush = () => new Promise<void>((resolve) => setTimeout(() => resolve(), 0));

describe('createPermissionCoordinator', () => {
  it('设置里授权后回到前台，检查结果自动切到 granted', async () => {
    const first = deferred<PermissionOutcome>();
    const check = jest
      .fn<Promise<PermissionOutcome>, []>()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce(granted);
    const { coordinator, latest } = setup({ check });

    coordinator.refresh();
    await flush();
    expect(latest().busy).toBe(true);

    first.resolve(denied);
    await flush();
    expect(latest().outcome).toEqual(denied);

    coordinator.refresh();
    await flush();
    expect(latest().outcome).toEqual(granted);
    expect(latest().busy).toBe(false);
  });

  it('设置里撤权后回到前台，检查结果同步回 denied', async () => {
    const check = jest
      .fn<Promise<PermissionOutcome>, []>()
      .mockResolvedValueOnce(granted)
      .mockResolvedValueOnce(denied);
    const { coordinator, latest } = setup({ check });

    coordinator.refresh();
    await flush();
    expect(latest().outcome).toEqual(granted);

    coordinator.refresh();
    await flush();
    expect(latest().outcome).toEqual(denied);
  });

  it('旧检查晚返回不会覆盖新的请求结果', async () => {
    const first = deferred<PermissionOutcome>();
    const check = jest.fn<Promise<PermissionOutcome>, []>().mockReturnValueOnce(first.promise);
    const { coordinator, latest } = setup({ check });

    coordinator.refresh();
    await flush();
    await coordinator.request();
    expect(latest().outcome).toEqual(granted);

    first.resolve({ state: 'denied', error: 'stale' });
    await flush();
    expect(latest().outcome).toEqual(granted);
  });

  it('请求进行中重复点击只调用一次原生请求', async () => {
    const pending = deferred<PermissionOutcome>();
    const request = jest.fn<Promise<PermissionOutcome>, []>().mockReturnValueOnce(pending.promise);
    const { coordinator, deps } = setup({ request });

    const first = coordinator.request();
    const second = coordinator.request();
    await flush();
    expect(deps.request).toHaveBeenCalledTimes(1);

    pending.resolve(granted);
    await Promise.all([first, second]);
  });

  it('检查进行中再次刷新会作废旧结果并自动重读', async () => {
    const first = deferred<PermissionOutcome>();
    const check = jest
      .fn<Promise<PermissionOutcome>, []>()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce(granted);
    const { coordinator, deps, views, latest } = setup({ check });

    coordinator.refresh();
    await flush();
    coordinator.refresh();
    await flush();
    expect(views.some((item) => item.outcome?.state === 'denied')).toBe(false);

    first.resolve(denied);
    await flush();
    expect(deps.check).toHaveBeenCalledTimes(2);
    expect(latest().outcome).toEqual(granted);
    expect(latest().busy).toBe(false);
    expect(views.some((item) => item.outcome?.state === 'denied')).toBe(false);
  });

  it('检查进行中调用设置入口被拒绝，且原操作完成后仍可刷新', async () => {
    const first = deferred<PermissionOutcome>();
    const check = jest
      .fn<Promise<PermissionOutcome>, []>()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce(granted);
    const { coordinator, deps, latest } = setup({ check });

    coordinator.refresh();
    await flush();
    await coordinator.openSettings();
    expect(deps.openSettings).not.toHaveBeenCalled();

    first.resolve(denied);
    await flush();
    expect(latest().outcome).toEqual(denied);

    coordinator.refresh();
    await flush();
    expect(deps.check).toHaveBeenCalledTimes(2);
    expect(latest().outcome).toEqual(granted);
  });

  it('请求进行中调用设置入口被拒绝，请求结果仍能发布', async () => {
    const pending = deferred<PermissionOutcome>();
    const request = jest.fn<Promise<PermissionOutcome>, []>().mockReturnValueOnce(pending.promise);
    const { coordinator, deps, latest } = setup({ request });

    const inFlight = coordinator.request();
    await flush();
    await coordinator.openSettings();
    expect(deps.openSettings).not.toHaveBeenCalled();

    pending.resolve(granted);
    await inFlight;
    expect(latest().outcome).toEqual(granted);

    coordinator.refresh();
    await flush();
    expect(deps.check).toHaveBeenCalledTimes(1);
  });

  it('卸载后到达的检查结果被忽略', async () => {
    const pending = deferred<PermissionOutcome>();
    const check = jest.fn<Promise<PermissionOutcome>, []>().mockReturnValueOnce(pending.promise);
    const { coordinator, views } = setup({ check });

    coordinator.refresh();
    await flush();
    const emitted = views.length;
    coordinator.dispose();

    pending.resolve(granted);
    await flush();
    expect(views.length).toBe(emitted);
  });

  it('请求进行中回到前台不会用检查覆盖请求', async () => {
    const pending = deferred<PermissionOutcome>();
    const request = jest.fn<Promise<PermissionOutcome>, []>().mockReturnValueOnce(pending.promise);
    const { coordinator, deps, latest } = setup({ request });

    void coordinator.request();
    await flush();
    coordinator.refresh();
    await flush();
    expect(deps.check).not.toHaveBeenCalled();

    pending.resolve(granted);
    await flush();
    expect(latest().outcome).toEqual(granted);
  });

  it('三类调用抛错都转成可重试错误', async () => {
    const { coordinator, latest } = setup({
      check: jest.fn().mockRejectedValue(new Error('check boom')),
      request: jest.fn().mockRejectedValue(new Error('request boom')),
      openSettings: jest.fn().mockRejectedValue(new Error('settings boom')),
    });

    coordinator.refresh();
    await flush();
    expect(latest().outcome).toEqual({ state: 'denied', error: 'check boom' });

    await coordinator.request();
    expect(latest().outcome).toEqual({ state: 'denied', error: 'request boom' });

    await coordinator.openSettings();
    expect(latest().settingsError).toBe('settings boom');
  });

  it('未授权（含 denied）始终保留系统设置入口', () => {
    expect(shouldOfferSettings(undefined)).toBe(true);
    expect(shouldOfferSettings('denied')).toBe(true);
    expect(shouldOfferSettings('blocked')).toBe(true);
    expect(shouldOfferSettings('granted')).toBe(false);
  });
});
