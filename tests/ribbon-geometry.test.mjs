import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRibbonMesh, sampleRibbonPath } from '../src/ribbon-geometry.js';
import { getSculpturePose } from '../src/sculpture.js';

const mesh = buildRibbonMesh({ rows: 128 });
test('the ribbon has finite positions, unit normals and a safe curvature/width ratio', () => {
  assert.ok(mesh.positions.every(Number.isFinite));
  for (let i = 0; i < mesh.normals.length; i += 3) assert.ok(Math.abs(Math.hypot(...mesh.normals.subarray(i, i + 3)) - 1) < .00001);
  assert.ok(mesh.curvature.widthRatio < .7);
});
test('the analytically smooth waist has no joined-arc derivative jump', () => {
  const left = sampleRibbonPath(.5 - 1e-7);
  const right = sampleRibbonPath(.5 + 1e-7);
  const wideLeft = sampleRibbonPath(.5 - 1e-4);
  const wideRight = sampleRibbonPath(.5 + 1e-4);
  for (const key of ['position', 'first', 'second']) {
    for (let axis = 0; axis < 3; axis++) {
      const near = Math.abs(left[key][axis] - right[key][axis]);
      const wide = Math.abs(wideLeft[key][axis] - wideRight[key][axis]);
      assert.ok(near < .001);
      assert.ok(near < wide * .002 + 1e-8);
    }
  }
});
test('flat end caps match the side rim exactly', () => {
  for (const cap of mesh.topology.caps) {
    for (let i = 0; i < cap.count; i++) {
      assert.deepEqual(mesh.positions.subarray((cap.first + i) * 3, (cap.first + i) * 3 + 3), mesh.positions.subarray((cap.sideFirst + i) * 3, (cap.sideFirst + i) * 3 + 3));
    }
  }
});
test('all rendered triangles have area and agree with the surface normals', () => {
  const p = mesh.positions;
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const [a, b, c] = mesh.indices.subarray(i, i + 3);
    const u = [0, 1, 2].map(k => p[b * 3 + k] - p[a * 3 + k]);
    const v = [0, 1, 2].map(k => p[c * 3 + k] - p[a * 3 + k]);
    const cross = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    assert.ok(Math.hypot(...cross) > 1e-9);
    assert.ok(cross.reduce((sum, value, k) => sum + value * mesh.normals[a * 3 + k], 0) > 0);
  }
});
test('invalid subdivision counts are rejected before creating unsafe indices', () => {
  for (const rows of [0, 3, 999, NaN]) assert.throws(() => buildRibbonMesh({ rows }), RangeError);
});
test('the sculpture pose responds to scroll without unbounded spinning', () => {
  const start = getSculpturePose({ progress: 0, time: 0, x: 0, y: 0 });
  const end = getSculpturePose({ progress: 1, time: 50, x: 1, y: 1 });
  assert.notEqual(start.yaw, end.yaw);
  assert.notEqual(getSculpturePose({ x: -1 }).yaw, getSculpturePose({ x: 1 }).yaw);
  for (let time = 0; time <= 1000; time += 10) {
    const pose = getSculpturePose({ progress: .8, time, x: 1, y: -1 });
    assert.ok(Math.abs(pose.yaw) < 1);
    assert.ok(Math.abs(pose.pitch) < 1);
  }
});
test('reduced motion uses one finished pose regardless of scroll and pointer', () => {
  assert.deepEqual(getSculpturePose({ progress: 0, time: 0, reduced: true }), getSculpturePose({ progress: 1, time: 100, x: 1, y: 1, reduced: true }));
});
