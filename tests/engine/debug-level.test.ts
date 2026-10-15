import { describe, expect, it } from 'vitest';
import { OrbitEngine } from '../../src/game/engine';
import { generateSector } from '../../src/game/generator';
import { describeComposition, RECENT_LAYOUT_LIMIT } from '../../src/game/composition';
import type { CompositionDescriptor } from '../../src/game/composition';

describe('Zen debug level start', () => {
  it('reconstructs the normal seed history at level fifteen and advances from its ring', () => {
    const recent: CompositionDescriptor[] = [];
    let field = generateSector(42);
    for (let index = 1; index < 15; index++) {
      recent.push(describeComposition(field));
      if (recent.length > RECENT_LAYOUT_LIMIT) recent.shift();
      field = generateSector(42, index, field.checkpoint.position, recent);
    }
    const engine = new OrbitEngine(42, 15);
    expect(engine.getSnapshot().sector).toEqual(field);
    expect(engine.getSnapshot().checkpointCount).toBe(14);
    engine.setAim(field.solution.angle, field.solution.power);
    engine.launch();
    for (let frame = 0; frame < 2000 && engine.getSnapshot().status === 'flying'; frame++) engine.update(1 / 60);
    expect(engine.getSnapshot().status).toBe('docked');
    expect(engine.getSnapshot().checkpointCount).toBe(15);
    engine.advance();
    expect(engine.getSnapshot().sector.index).toBe(15);
    expect(engine.getSnapshot().sector.launch).toEqual(field.checkpoint.position);
  });

  it('jumps directly to a very large level and deterministically retries its field', () => {
    const engine = new OrbitEngine(7, 1_000_001);
    const snapshot = engine.getSnapshot();
    expect(snapshot.sector.index).toBe(1_000_000);
    expect(snapshot.checkpointCount).toBe(1_000_000);
    engine.launch();
    engine.update(1 / 60);
    engine.retry();
    expect(engine.getSnapshot().sector).toBe(snapshot.sector);
    expect(engine.getSnapshot().checkpointCount).toBe(1_000_000);
    engine.restart(7, 1_000_001);
    expect(engine.getSnapshot().sector).toEqual(snapshot.sector);
    engine.restart(7);
    expect(engine.getSnapshot().sector.index).toBe(0);
    expect(engine.getSnapshot().checkpointCount).toBe(0);
  });

  it.each([0, -1, 2.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1])('defaults invalid start %s to level one', level => {
    expect(new OrbitEngine(7, level).getSnapshot().sector.index).toBe(0);
  });
});
