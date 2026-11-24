import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import {
  checkLocationPermission,
  openAppSettings,
  requestLocationPermission,
} from '../adapters/location/permission';
import {
  createPermissionCoordinator,
  type PermissionCoordinator,
  type PermissionView,
} from '../adapters/location/permissionCoordinator';

/** 定位授权生命周期：首次进入与回到前台都重新检查，卸载使在途结果失效。 */
export function useLocationPermission() {
  const [view, setView] = useState<PermissionView>({ outcome: null, busy: true, settingsError: null });
  const coordinatorRef = useRef<PermissionCoordinator | null>(null);

  useEffect(() => {
    const coordinator = createPermissionCoordinator(
      {
        check: checkLocationPermission,
        request: requestLocationPermission,
        openSettings: openAppSettings,
      },
      setView,
    );
    coordinatorRef.current = coordinator;
    coordinator.refresh();

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        coordinator.refresh();
      }
    });

    return () => {
      subscription.remove();
      coordinator.dispose();
      coordinatorRef.current = null;
    };
  }, []);

  return {
    view,
    request: () => coordinatorRef.current?.request(),
    openSettings: () => coordinatorRef.current?.openSettings(),
    retry: () => coordinatorRef.current?.refresh(),
  };
}
