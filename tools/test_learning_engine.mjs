import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatePhysics, evaluateExpression } from '../learning-engine.mjs';

test('expression parser evaluates precedence, powers, variables, and constants', () => {
  assert.equal(evaluateExpression('2 + 3 * 4'), 14);
  assert.equal(evaluateExpression('-2^2'), -4);
  assert.equal(evaluateExpression('2^3^2'), 512);
  assert.equal(evaluateExpression('mass * acceleration', { mass: 3, acceleration: 4 }), 12);
  assert.ok(Math.abs(evaluateExpression('pi * 2') - Math.PI * 2) < 1e-12);
});

test('expression parser rejects executable syntax, unknown names, and zero division', () => {
  assert.throws(() => evaluateExpression('alert(1)'), /Unknown variable/);
  assert.throws(() => evaluateExpression('unknown + 1'), /Unknown variable/);
  assert.throws(() => evaluateExpression('4 / 0'), /Division by zero/);
});

test('physics calculators return dimensioned speed, force, energy, and density results', () => {
  assert.deepEqual(calculatePhysics('speed', { distance: 120, time: 4 }), {
    label: 'Average speed', formula: 'distance / time', value: 30, unit: 'm/s'
  });
  assert.equal(calculatePhysics('force', { mass: 2, acceleration: 3 }).value, 6);
  assert.equal(calculatePhysics('kinetic-energy', { mass: 2, velocity: 5 }).value, 25);
  assert.equal(calculatePhysics('density', { mass: 10, volume: 2 }).value, 5);
});

test('physics calculators reject invalid formula inputs', () => {
  assert.throws(() => calculatePhysics('speed', { distance: 20, time: 0 }), /Division by zero/);
  assert.throws(() => calculatePhysics('unknown', {}), /supported physics/);
});