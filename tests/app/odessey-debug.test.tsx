import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import App, { OdesseyGame } from '../../src/App';

vi.mock('../../src/render/renderer', () => ({
  createRenderer: () => ({
    resize() {}, prepareFrame() {}, render() {}, destroy() {}, setWalkthroughFocus() {},
    getVisibleBounds: () => ({ x: -100, y: -100, width: 5000, height: 3000 }),
    getViewport: () => ({ center: { x: 900, y: 500 }, scale: 1, transitioning: false }),
    screenToWorld: (x: number, y: number) => ({ x, y }),
    worldToScreen: (point: unknown) => point,
  }),
}));

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
  localStorage.setItem('orbit.walkthrough.odessey.v1', 'complete');
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.history.replaceState({}, '', '/');
});

describe('Odessey URL debug navigation', () => {
  it('opens old Zen links as Odessey and keeps their query parameters', () => {
    window.history.replaceState({}, '', '/?mode=zen&seed=42&debug=1&level=15');
    render(<App />);
    expect(screen.getByLabelText('Checkpoint 14')).toBeTruthy();
    expect(new URLSearchParams(window.location.search).get('mode')).toBe('odessey');
    expect(new URLSearchParams(window.location.search).get('seed')).toBe('42');
  });
  it('opens Odessey directly when active debug has no explicit mode', () => {
    window.history.replaceState({}, '', '/?seed=42&debug=1&level=15');
    render(<App />);
    expect(screen.getByLabelText('Slingshot flight field')).toBeTruthy();
    expect(screen.getByLabelText('Checkpoint 14')).toBeTruthy();
    expect(new URLSearchParams(window.location.search).get('mode')).toBe('odessey');
  });

  it('starts at the requested level, skips first-time help and preserves the level with New seed', () => {
    localStorage.removeItem('orbit.walkthrough.odessey.v1');
    window.history.replaceState({}, '', '/?mode=odessey&seed=42&debug=1&level=15');
    render(<OdesseyGame />);
    expect(screen.getByLabelText('Checkpoint 14').textContent).toBe('14');
    expect(screen.getByText('Debug level 15')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    fireEvent.click(screen.getByRole('button', { name: 'New seed' }));
    expect(screen.getByLabelText('Checkpoint 14').textContent).toBe('14');
    expect(screen.getByText('Debug level 15')).toBeTruthy();
  });

  it('accepts debug=true and a positive level', () => {
    window.history.replaceState({}, '', '/?debug=true&level=5');
    render(<OdesseyGame />);
    expect(screen.getByLabelText('Checkpoint 4')).toBeTruthy();
  });

  it.each(['', '&debug=0', '&debug=false', '&debug=yes'])('ignores a level without enabled debug: %s', gate => {
    window.history.replaceState({}, '', `/?level=15${gate}`);
    render(<OdesseyGame />);
    expect(screen.getByLabelText('Checkpoint 0')).toBeTruthy();
    expect(screen.queryByText(/Debug level/)).toBeNull();
  });

  it.each(['', '0', '-2', '1.5', '1e2', '15suffix', 'Infinity', '9007199254740992'])('defaults invalid URL level "%s" to one', level => {
    window.history.replaceState({}, '', `/?debug=1&level=${level}`);
    render(<OdesseyGame />);
    expect(screen.getByLabelText('Checkpoint 0')).toBeTruthy();
    expect(screen.getByText('Debug level 1')).toBeTruthy();
  });
});
