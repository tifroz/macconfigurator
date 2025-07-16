// 10 Lines by Claude Opus  
// Runtime configuration utilities for reading mount path

declare global {
  interface Window {
    __CONFIG_MANAGER__: {
      mountPath: string;
    };
  }
}

export const getMountPath = (): string => {
  const mountPath = window.__CONFIG_MANAGER__?.mountPath;
  // Handle case where mount path hasn't been injected yet (old server code)
  if (!mountPath || mountPath === '__MOUNT_PATH__') {
    return '/configurator';
  }
  return mountPath;
};

export const getApiBaseUrl = (): string => {
  return `${getMountPath()}/api`;
};

export const getAdminApiBaseUrl = (): string => {
  return `${getApiBaseUrl()}/admin`;
};