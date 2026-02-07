export type BackendMode = 'off' | 'shadow' | 'on';

const rawMode = (import.meta.env.VITE_BACKEND_MODE as string | undefined)?.toLowerCase();

export const backendMode: BackendMode = rawMode === 'on' || rawMode === 'shadow' ? rawMode : 'off';

export function isBackendOn(): boolean {
  return backendMode === 'on';
}

export function isBackendShadow(): boolean {
  return backendMode === 'shadow';
}

export function isBackendEnabled(): boolean {
  return backendMode !== 'off';
}
