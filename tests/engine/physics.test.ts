import { describe, expect, it } from 'vitest';
import { bodyStrength, CHECKPOINT_MAX_ACCELERATION, checkpointForceAt, distance, forceAt, launchSpeed, segmentCircleIntersection, stepParticle } from '../../src/game/physics';
import type { Body } from '../../src/game/types';

const body: Body = { id: 'a', kind: 'attractor', position: { x: 100, y: 0 }, radius: 20, strength: 1000000 };

describe('force and geometry', () => {
  it('pulls inward strongly near the goal, smoothly fades out and stays finite at its center', () => {
    const goal={position:{x:400,y:500},radius:45};
    const near=checkpointForceAt({x:300,y:500},goal),far=checkpointForceAt({x:150,y:500},goal);
    expect(near.x).toBeGreaterThan(100);expect(near.y).toBe(0);expect(near.x).toBeGreaterThan(far.x);
    expect(checkpointForceAt(goal.position,goal)).toEqual({x:0,y:0});
    expect(checkpointForceAt({x:-1000,y:500},goal)).toEqual({x:0,y:0});
    for(const offset of [0.000001,5,45,100,200,799,800,801]){
      const force=checkpointForceAt({x:400-offset,y:500},goal);
      expect(Number.isFinite(force.x)&&Number.isFinite(force.y)).toBe(true);expect(Math.hypot(force.x,force.y)).toBeLessThan(CHECKPOINT_MAX_ACCELERATION);
    }
    expect(checkpointForceAt({x:399.999999,y:500},goal).x).toBeLessThan(0.01);
    expect(checkpointForceAt({x:-399,y:500},goal).x).toBeLessThan(0.01);
    expect(checkpointForceAt({x:200,y:500},{...goal,radius:90})).toEqual(checkpointForceAt({x:200,y:500},goal));
    const combined=forceAt({x:300,y:500},[{...body,position:{x:400,y:500},radius:200}],goal);
    expect(Number.isFinite(combined.x)&&Number.isFinite(combined.y)).toBe(true);expect(Math.hypot(combined.x,combined.y)).toBeLessThanOrEqual(840+1e-10);
  });
  it('preserves legacy no-goal stepping and includes goal assistance when supplied',()=>{
    const goal={position:{x:100,y:50},radius:45};
    expect(forceAt({x:0,y:0},[],goal).y).toBeGreaterThan(0);
    expect(stepParticle({x:0,y:0},{x:10,y:0},[],0.1)).toEqual({position:{x:1,y:0},velocity:{x:10,y:0}});
    const assisted=stepParticle({x:0,y:0},{x:10,y:0},[],0.1,goal);expect(assisted.velocity.y).toBeGreaterThan(0);expect(assisted.position.y).toBeGreaterThan(0);
  });
  it('pulls toward attractors, pushes away from repellents and remains finite at their centers', () => {
    expect(forceAt({ x: 0, y: 0 }, [body]).x).toBeGreaterThan(0);
    expect(forceAt({ x: 0, y: 0 }, [{ ...body, kind: 'repellent' }]).x).toBeLessThan(0);
    expect(forceAt(body.position, [body])).toEqual({ x: 0, y: 0 });
    expect(Math.hypot(...Object.values(forceAt({ x: 99, y: 0 }, [body])))).toBeLessThanOrEqual(1000);
  });
  it('makes ordinary and strong shots turn visibly within the short prediction horizon', () => {
    for (const kind of ['attractor','repellent'] as const) for (const speed of [240,420]) {
      const well: Body = { id: 'well',kind,position: { x: 450,y: 240 },radius: 90,strength: 0 };
      let position = { x: 120,y: 500 },velocity = { x: speed,y: 0 };
      for (let step = 0; step < 180; step++) ({ position,velocity } = stepParticle(position,velocity,[well]));
      const heading = Math.atan2(velocity.y,velocity.x)*180/Math.PI;
      expect(Math.abs(heading),`${kind}, speed ${speed}`).toBeGreaterThan(speed===240 ? 20 : 12);
      expect(Math.abs(position.y-500)).toBeGreaterThan(50);
      expect(Math.sign(heading)).toBe(kind==='attractor' ? -1 : 1);
    }
  });
  it('derives strength from area and increases unsaturated force with radius for either kind', () => {
    expect(bodyStrength(80)).toBe(bodyStrength(40) * 4);
    for (const kind of ['attractor', 'repellent'] as const) {
      const small = { ...body, kind, position: { x: 700, y: 0 }, radius: 40, strength: 1e20 };
      const large = { ...small, radius: 80, strength: 0 };
      expect(Math.abs(forceAt({ x: 0, y: 0 }, [large]).x)).toBeGreaterThan(Math.abs(forceAt({ x: 0, y: 0 }, [small]).x));
      expect(forceAt({ x: 0, y: 0 }, [small])).toEqual(forceAt({ x: 0, y: 0 }, [{ ...small, strength: 0 }]));
    }
  });
  it('integrates inertial motion and bends a moving projectile', () => {
    expect(stepParticle({ x: 0, y: 0 }, { x: 20, y: 10 }, [], 0.5)).toEqual({ position: { x: 10, y: 5 }, velocity: { x: 20, y: 10 } });
    const bent = stepParticle({ x: 0, y: 0 }, { x: 0, y: 50 }, [body], 0.1);
    expect(bent.velocity.x).toBeGreaterThan(0);
    expect(bent.position.y).toBeCloseTo(5);
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });
  it('finds first swept-circle contact rather than tunneling', () => {
    expect(segmentCircleIntersection({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 0 }, 10)).toBeCloseTo(0.4);
    expect(segmentCircleIntersection({ x: 0, y: 20 }, { x: 100, y: 20 }, { x: 50, y: 0 }, 10)).toBeNull();
    expect(segmentCircleIntersection({ x: 50, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 0 }, 10)).toBe(0);
  });
  it('maps pull power continuously from zero to full speed', () => {
    expect(launchSpeed(0)).toBe(0);
    expect(launchSpeed(0.5)).toBe(210);
    expect(launchSpeed(1)).toBe(420);
    expect(launchSpeed(2)).toBe(420);
  });
});
