export interface OdesseyDebugStart {
  enabled: boolean;
  level: number;
}

/** Level jumps are opt-in and one-based, with malformed values returning to one. */
export function odesseyDebugStart(search: string): OdesseyDebugStart {
  const params = new URLSearchParams(search);
  const debug = params.get('debug');
  const enabled = debug === '1' || debug === 'true';
  const value = params.get('level') ?? '';
  const level = /^[1-9]\d*$/.test(value) ? Number(value) : 1;
  return { enabled, level: enabled && Number.isSafeInteger(level) ? level : 1 };
}
