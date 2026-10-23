// Three closed, linked tori. Each ring has an analytic normal and a sealed UV seam.
// The separation is physical: neighboring tubes pass through a ring's opening.
export function buildOrbitMesh({ segments = 96, sides = 16, radius = .72, tube = .105, spacing = .88 } = {}) {
  if (!Number.isInteger(segments) || segments < 32 || segments > 160 || !Number.isInteger(sides) || sides < 8 || sides > 32
    || !Number.isFinite(radius) || radius < .5 || radius > 1 || !Number.isFinite(tube) || tube < .04 || tube > .15
    || !Number.isFinite(spacing) || spacing < radius * 1.1 || spacing > radius * 1.4 || tube > radius * .21) {
    throw new RangeError('Unsupported orbit mesh dimensions');
  }
  const stride = sides + 1;
  const verticesPerRing = (segments + 1) * stride;
  const count = verticesPerRing * 3;
  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  const materials = new Float32Array(count);
  const indices = new Uint16Array(segments * sides * 6 * 3);
  let index = 0;
  for (let ring = 0; ring < 3; ring++) {
    const offset = ring * verticesPerRing;
    for (let u = 0; u <= segments; u++) {
      // Reuse zero at each closed seam rather than relying on sin(2π)'s residual.
      const a = (u === segments ? 0 : u / segments) * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      for (let v = 0; v <= sides; v++) {
        const b = (v === sides ? 0 : v / sides) * Math.PI * 2;
        const cb = Math.cos(b), sb = Math.sin(b);
        const radial = radius + tube * cb;
        const point = [radial * ca, radial * sa, tube * sb];
        const normal = [ca * cb, sa * cb, sb];
        if (ring === 1) {
          [point[0], point[2]] = [point[2], -point[0]];
          [normal[0], normal[2]] = [normal[2], -normal[0]];
        }
        point[1] += (ring - 1) * spacing;
        const vertex = offset + u * stride + v;
        positions.set(point, vertex * 3);
        normals.set(normal, vertex * 3);
        materials[vertex] = ring;
        if (u < segments && v < sides) {
          const next = vertex + stride;
          indices.set([vertex, next, vertex + 1, next, next + 1, vertex + 1], index);
          index += 6;
        }
      }
    }
  }
  return {
    positions, normals, materials, indices,
    topology: { rings: 3, segments, sides, stride, verticesPerRing },
    dimensions: { radius, tube, spacing, bound: radius + tube + spacing },
  };
}

export function getOrbitPose({ x = 0, y = 0, progress = 0, time = 0, reduced = false } = {}) {
  if (reduced) return { yaw: -.42, pitch: .17, roll: -.44 };
  const p = limit(progress, 0, 1);
  const t = limit(time / 2, 0, 1);
  const intro = 1 - (1 - t) ** 3;
  return {
    yaw: -.63 + intro * .21 + p * .42 + limit(x, -1, 1) * .64,
    pitch: .27 - intro * .10 + limit(y, -1, 1) * .35,
    roll: -.56 + intro * .12 + p * .13,
  };
}

// Exact critically damped response, independent of animation frame frequency.
export function advanceOrbitMotion(state, target, delta) {
  const dt = limit(delta, 0, .1);
  const next = {};
  for (const [key, speed, min, max] of [['x', 'vx', -1, 1], ['y', 'vy', -1, 1], ['progress', 'vp', 0, 1]]) {
    const goal = limit(target[key], min, max);
    const value = Number.isFinite(state[key]) ? limit(state[key], min, max) : goal;
    const velocity = Number.isFinite(state[speed]) ? state[speed] : 0;
    const omega = 7;
    const offset = value - goal;
    const impulse = (velocity + omega * offset) * dt;
    const decay = Math.exp(-omega * dt);
    const position = goal + (offset + impulse) * decay;
    next[key] = limit(position, min, max);
    next[speed] = position === next[key] ? (velocity - omega * impulse) * decay : 0;
    if (Math.abs(next[key] - goal) <= .0001 && Math.abs(next[speed]) <= .001) {
      next[key] = goal;
      next[speed] = 0;
    }
  }
  return next;
}

function limit(value, min, max) { return Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0)); }
