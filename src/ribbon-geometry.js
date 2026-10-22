const TAU = Math.PI * 2;
const HALF_WIDTH = .43;
const HALF_DEPTH = .065;
const BEVEL = .047;

// One analytic C-infinity path: position, tangent and curvature have no join at the waist.
export function sampleRibbonPath(t) {
  const a = TAU * t;
  const b = 2 * a;
  const phase = a + .35;
  return {
    position: [-1.08 * Math.sin(a), 3.25 * (.5 - t) + 3.25 / (2 * TAU) * Math.sin(b), .36 * Math.cos(phase)],
    first: [-1.08 * TAU * Math.cos(a), -3.25 + 3.25 * Math.cos(b), -.36 * TAU * Math.sin(phase)],
    second: [1.08 * TAU * TAU * Math.sin(a), -6.5 * TAU * Math.sin(b), -.36 * TAU * TAU * Math.cos(phase)],
  };
}

export function buildRibbonMesh({ rows = 220, bevelSegments = 5, faceSegments = 8 } = {}) {
  if (!Number.isInteger(rows) || rows < 16 || rows > 600 || !Number.isInteger(bevelSegments) || bevelSegments < 2 || bevelSegments > 8 || !Number.isInteger(faceSegments) || faceSegments < 2 || faceSegments > 12) {
    throw new RangeError('Ribbon subdivisions are outside the supported range');
  }
  const profile = roundedProfile(bevelSegments, faceSegments);
  const columns = profile.length;
  const sideVertexCount = (rows + 1) * columns;
  if (sideVertexCount + 2 * (columns + 1) > 65535) throw new RangeError('Ribbon needs 16-bit indices');
  const positions = [];
  const normals = [];
  const uv = [];
  const indices = [];

  for (let row = 0; row <= rows; row++) {
    const t = row / rows;
    const frame = pathFrame(t);
    for (let col = 0; col < columns; col++) {
      const p = profile[col];
      const position = add(frame.position, add(scale(frame.width, p.x), scale(frame.depth, p.y)));
      const along = add(frame.first, add(scale(frame.widthDerivative, p.x), scale(frame.depthDerivative, p.y)));
      const across = add(scale(frame.width, -p.ny), scale(frame.depth, p.nx));
      positions.push(...position);
      normals.push(...unit(cross(across, along)));
      uv.push(t, col / columns);
      if (row < rows) {
        const a = row * columns + col;
        const next = row * columns + (col + 1) % columns;
        indices.push(a, next, a + columns, next, next + columns, a + columns);
      }
    }
  }

  // Duplicated cap rims are intentional: their positions match the sides exactly,
  // while their normals describe the flat cut, rather than the rounded bevel.
  const caps = [];
  for (const end of [0, 1]) {
    const frame = pathFrame(end);
    const center = positions.length / 3;
    const normal = scale(frame.tangent, end === 0 ? -1 : 1);
    positions.push(...frame.position); normals.push(...normal); uv.push(end, .5);
    for (let col = 0; col < columns; col++) {
      const offset = (end * rows * columns + col) * 3;
      positions.push(...positions.slice(offset, offset + 3));
      normals.push(...normal); uv.push(end, col / columns);
      const a = center + 1 + col;
      const b = center + 1 + (col + 1) % columns;
      indices.push(...(end === 0 ? [center, b, a] : [center, a, b]));
    }
    caps.push({ center, first: center + 1, count: columns, sideFirst: end * rows * columns });
  }

  let maxCurvature = 0;
  for (let sample = 0; sample <= 1000; sample++) {
    const { first, second } = sampleRibbonPath(sample / 1000);
    maxCurvature = Math.max(maxCurvature, length(cross(first, second)) / length(first) ** 3);
  }
  return {
    positions: new Float32Array(positions), normals: new Float32Array(normals),
    uv: new Float32Array(uv), indices: new Uint16Array(indices),
    topology: { rows, columns, sideVertexCount, caps },
    curvature: { max: maxCurvature, minRadius: 1 / maxCurvature, halfDiagonal: Math.hypot(HALF_WIDTH, HALF_DEPTH), widthRatio: maxCurvature * Math.hypot(HALF_WIDTH, HALF_DEPTH) },
  };
}

function pathFrame(t) {
  const { position, first, second } = sampleRibbonPath(t);
  const speed = length(first);
  const tangent = scale(first, 1 / speed);
  const tangentDerivative = scale(sub(second, scale(tangent, dot(tangent, second))), 1 / speed);
  // A fixed reference axis avoids the Frenet-frame flip at the S inflection.
  const planar = [tangent[1], -tangent[0], 0];
  const planarDerivative = [tangentDerivative[1], -tangentDerivative[0], 0];
  const planarLength = length(planar);
  const n = scale(planar, 1 / planarLength);
  const nd = scale(sub(planarDerivative, scale(n, dot(n, planarDerivative))), 1 / planarLength);
  const b = cross(tangent, n);
  const bd = add(cross(tangentDerivative, n), cross(tangent, nd));
  const angle = .18 + .59 * Math.sin(TAU * t + .12);
  const angleDerivative = .59 * TAU * Math.cos(TAU * t + .12);
  const c = Math.cos(angle), s = Math.sin(angle);
  const width = add(scale(n, c), scale(b, s));
  const depth = sub(scale(b, c), scale(n, s));
  return {
    position, first, tangent, width, depth,
    widthDerivative: add(add(scale(nd, c), scale(bd, s)), scale(depth, angleDerivative)),
    depthDerivative: sub(sub(scale(bd, c), scale(nd, s)), scale(width, angleDerivative)),
  };
}

function roundedProfile(bevelSegments, faceSegments) {
  const profile = [];
  for (let corner = 0; corner < 4; corner++) {
    const sx = corner === 0 || corner === 3 ? 1 : -1;
    const sy = corner < 2 ? 1 : -1;
    for (let i = 0; i <= bevelSegments; i++) {
      const angle = (corner + i / bevelSegments) * Math.PI * .5;
      const nx = Math.cos(angle), ny = Math.sin(angle);
      profile.push({ x: sx * (HALF_WIDTH - BEVEL) + nx * BEVEL, y: sy * (HALF_DEPTH - BEVEL) + ny * BEVEL, nx, ny });
    }
    // Subdivide the broad faces so twisting never turns a full face into one non-planar quad.
    if (corner === 0 || corner === 2) {
      const direction = corner === 0 ? -1 : 1;
      for (let i = 1; i < faceSegments; i++) {
        profile.push({ x: direction * (HALF_WIDTH - BEVEL) * (2 * i / faceSegments - 1), y: corner === 0 ? HALF_DEPTH : -HALF_DEPTH, nx: 0, ny: corner === 0 ? 1 : -1 });
      }
    }
  }
  return profile;
}

function add(a, b) { return a.map((v, i) => v + b[i]); }
function sub(a, b) { return a.map((v, i) => v - b[i]); }
function scale(a, n) { return a.map(v => v * n); }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function length(a) { return Math.hypot(...a); }
function unit(a) { return scale(a, 1 / length(a)); }
