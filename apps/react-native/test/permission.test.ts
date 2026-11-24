import {
  checkLocationPermission,
  openAppSettings,
  requestLocationPermission,
} from '../src/adapters/location/permission';

jest.mock('react-native', () => {
  const RESULTS = {
    GRANTED: 'granted',
    DENIED: 'denied',
    NEVER_ASK_AGAIN: 'never_ask_again',
  };
  return {
    Platform: { OS: 'android' },
    PermissionsAndroid: {
      PERMISSIONS: {
        ACCESS_FINE_LOCATION: 'FINE',
        ACCESS_COARSE_LOCATION: 'COARSE',
      },
      RESULTS,
      check: jest.fn(),
      requestMultiple: jest.fn(),
    },
    Linking: { openSettings: jest.fn() },
  };
});

const { PermissionsAndroid, Linking } = jest.requireMock('react-native');
const check = PermissionsAndroid.check as jest.Mock;
const requestMultiple = PermissionsAndroid.requestMultiple as jest.Mock;
const openSettings = Linking.openSettings as jest.Mock;

beforeEach(() => {
  check.mockReset();
  requestMultiple.mockReset();
  openSettings.mockReset();
});

describe('checkLocationPermission', () => {
  it('粗略定位获准即可用', async () => {
    check.mockImplementation(async (permission: string) => permission === 'COARSE');

    await expect(checkLocationPermission()).resolves.toEqual({ state: 'granted', error: null });
  });

  it('仅精确定位获准也可用', async () => {
    check.mockImplementation(async (permission: string) => permission === 'FINE');

    await expect(checkLocationPermission()).resolves.toEqual({ state: 'granted', error: null });
  });

  it('两项都未获准时返回 denied', async () => {
    check.mockResolvedValue(false);

    await expect(checkLocationPermission()).resolves.toEqual({ state: 'denied', error: null });
  });

  it('check 抛错时返回可重试错误', async () => {
    check.mockRejectedValue(new Error('binder died'));

    await expect(checkLocationPermission()).resolves.toEqual({
      state: 'denied',
      error: 'binder died',
    });
  });
});

describe('requestLocationPermission', () => {
  it('粗略授权即可通过，不要求精确定位', async () => {
    requestMultiple.mockResolvedValue({
      FINE: 'denied',
      COARSE: 'granted',
    });

    await expect(requestLocationPermission()).resolves.toEqual({ state: 'granted', error: null });
  });

  it('never_ask_again 归为 blocked', async () => {
    requestMultiple.mockResolvedValue({
      FINE: 'never_ask_again',
      COARSE: 'never_ask_again',
    });

    await expect(requestLocationPermission()).resolves.toEqual({ state: 'blocked', error: null });
  });

  it('普通拒绝返回 denied', async () => {
    requestMultiple.mockResolvedValue({
      FINE: 'denied',
      COARSE: 'denied',
    });

    await expect(requestLocationPermission()).resolves.toEqual({ state: 'denied', error: null });
  });

  it('请求抛错时返回可重试错误且不产生未处理 rejection', async () => {
    requestMultiple.mockRejectedValue(new Error('activity gone'));

    await expect(requestLocationPermission()).resolves.toEqual({
      state: 'denied',
      error: 'activity gone',
    });
  });
});

describe('openAppSettings', () => {
  it('成功时返回 null', async () => {
    openSettings.mockResolvedValue(undefined);

    await expect(openAppSettings()).resolves.toBeNull();
  });

  it('失败时返回错误文案', async () => {
    openSettings.mockRejectedValue(new Error('no settings activity'));

    await expect(openAppSettings()).resolves.toBe('no settings activity');
  });
});
