import { buildRibbonMesh } from './ribbon-geometry.js';

// A rigid studio sculpture. Scroll directs the pose; no vertices deform during animation.
export function setupSculpture({ canvas, host, motion }) {
  const empty = { destroy() {} };
  if (!canvas || !host) return empty;
  const interactionSurface = host;

  const fallback = () => {
    canvas.hidden = true;
    host.classList.remove('is-webgl-ready');
    host.dataset.renderState = 'fallback';
  };

  let gl;
  try {
    gl = canvas.getContext('webgl', {
      alpha: true, antialias: true, depth: true, stencil: false,
      premultipliedAlpha: false, powerPreference: 'low-power',
    });
  } catch { /* The page keeps its CSS artwork when WebGL is unavailable. */ }
  if (!gl) { fallback(); return empty; }

  const precision = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT)?.precision ? 'highp' : 'mediump';
  const vertex = `
    attribute vec3 aPosition;
    attribute vec3 aNormal;
    attribute vec2 aUv;
    uniform mat4 uModel;
    uniform mat4 uViewProjection;
    varying vec3 vPosition;
    varying vec3 vNormal;
    varying vec2 vUv;
    void main() {
      vec4 world = uModel * vec4(aPosition, 1.0);
      vPosition = world.xyz;
      vNormal = mat3(uModel) * aNormal;
      vUv = aUv;
      gl_Position = uViewProjection * world;
    }
  `;
  const fragment = `
    precision ${precision} float;
    uniform vec3 uCamera;
    uniform vec3 uLight;
    uniform vec3 uAccent;
    varying vec3 vPosition;
    varying vec3 vNormal;
    varying vec2 vUv;
    vec3 tone(vec3 c) {
      return clamp((c * (2.51 * c + .03)) / (c * (2.43 * c + .59) + .14), 0.0, 1.0);
    }
    void main() {
      vec3 N = normalize(vNormal);
      vec3 V = normalize(uCamera - vPosition);
      vec3 L = normalize(vec3(-3.0, 4.5, 5.0));
      vec3 H = normalize(L + V);
      vec3 R = reflect(-V, N);
      float nv = clamp(dot(N, V), .001, 1.0);
      float nl = clamp(dot(N, L), 0.0, 1.0);
      float nh = clamp(dot(N, H), 0.0, 1.0);
      float rim = pow(1.0 - nv, 3.0);

      vec3 metal = mix(vec3(.17, .175, .19), vec3(.29, .31, .35), smoothstep(.1, .9, vUv.x));
      float fill = clamp(dot(N, normalize(vec3(3.0, -.3, 2.0))), 0.0, 1.0);
      vec3 color = metal * (.22 + nl * .65 + fill * .28);
      vec3 fresnel = vec3(.65, .68, .73) + vec3(.26) * pow(1.0 - nv, 5.0);

      // Silver softboxes keep the form readable; the selected palette colors the edge light.
      float keyDistance = (R.x + .31) / .28;
      float lineDistance = (R.x + .38) / .075;
      float topDistance = (R.y - .72) / .29;
      float sideDistance = (R.x - .76) / .16;
      float key = exp(-keyDistance * keyDistance) * smoothstep(-.65, .45, R.y);
      float line = exp(-lineDistance * lineDistance) * smoothstep(-.6, .1, R.y);
      float top = exp(-topDistance * topDistance) * (1.0 - smoothstep(.3, 1.0, abs(R.x)));
      float side = exp(-sideDistance * sideDistance) * (1.0 - smoothstep(-.3, .5, R.y));
      vec3 environment = vec3(.025) + uLight * .05 + vec3(.82, .89, 1.0) * (key * .92 + top * .72 + line * .48);
      environment += uLight * side * 1.15;
      float lightDistance = (R.x + .72) / .24;
      float lightStrip = exp(-lightDistance * lightDistance) * (.35 + .65 * smoothstep(-.8, .5, R.y));
      environment += uLight * lightStrip * .9;
      float accentDistance = (R.y + .62) / .09;
      float accentStrip = exp(-accentDistance * accentDistance) * smoothstep(.2, .8, R.x);
      environment += uAccent * accentStrip * .23;
      color += environment * fresnel;
      color += vec3(.94, .965, 1.0) * (pow(nh, 96.0) * 1.3 + pow(nh, 18.0) * .18);
      float edgeLight = pow(1.0 - nv, 2.2);
      color += uLight * edgeLight * (.68 + .28 * smoothstep(-1.5, 1.5, vPosition.y));
      color += vec3(.70, .80, 1.0) * rim * .12;
      gl_FragColor = vec4(pow(tone(color * 1.18), vec3(.454545)), 1.0);
    }
  `;

  let program;
  const shaders = [];
  const buffers = [];
  let destroyed = false;
  let failed = false;
  let frame = 0;
  let observer;
  let resizeObserver;

  function compile(type, source) {
    const shader = gl.createShader(type);
    if (!shader) throw new Error('WebGL shader unavailable');
    shaders.push(shader);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error('WebGL shader did not compile');
    return shader;
  }

  try {
    program = gl.createProgram();
    if (!program) throw new Error('WebGL program unavailable');
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vertex));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('WebGL program did not link');
    gl.useProgram(program);
  } catch {
    shaders.forEach(shader => gl.deleteShader(shader));
    if (program) gl.deleteProgram(program);
    fallback();
    return empty;
  }

  const connection = navigator.connection;
  const weak = Boolean(connection?.saveData || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) || (navigator.deviceMemory && navigator.deviceMemory <= 4));
  const coarse = matchMedia('(pointer: coarse)').matches;
  const idleFrameDuration = 1000 / (weak || coarse ? 30 : 45);
  const activeFrameDuration = 1000 / (weak || coarse ? 30 : 60);
  const pixelRatio = Math.min(window.devicePixelRatio || 1, weak ? 1.25 : 1.5);
  const mesh = buildRibbonMesh({ rows: weak ? 128 : 220 });
  const uniforms = Object.fromEntries(['uModel', 'uViewProjection', 'uCamera', 'uLight', 'uAccent'].map(name => [name, gl.getUniformLocation(program, name)]));

  try {
    for (const [name, size, data] of [
      ['aPosition', 3, mesh.positions], ['aNormal', 3, mesh.normals], ['aUv', 2, mesh.uv],
    ]) {
      const buffer = gl.createBuffer();
      buffers.push(buffer);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      const location = gl.getAttribLocation(program, name);
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
    }
    const indexBuffer = gl.createBuffer();
    buffers.push(indexBuffer);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.clearColor(0, 0, 0, 0);
  } catch {
    release();
    fallback();
    return empty;
  }

  let visible = inViewport();
  let sceneTime = 0;
  let previous = 0;
  let lastDraw = 0;
  let targetX = 0;
  let targetY = 0;
  let targetProgress = readProgress();
  let motionState = { x: 0, y: 0, progress: targetProgress, vx: 0, vy: 0, vp: 0 };
  let dirty = false;
  let poseDirty = true;
  let width = 0;
  let height = 0;
  let cameraDistance = 6.4;
  let viewProjection;
  let renderCount = 0;
  const paletteSurface = document.documentElement;
  let palette = readPalette();
  let paletteDirty = true;

  function readPalette() {
    const style = getComputedStyle(host);
    const read = (name, fallback) => {
      const channels = style.getPropertyValue(name).trim().split(/\s+/).map(Number);
      return channels.length === 3 && channels.every(Number.isFinite) ? channels.map(value => clamp(value, 0, 1)) : fallback;
    };
    return {
      light: read('--model-light-rgb', [.43, .14, 1]),
      accent: read('--model-accent-rgb', [.62, .93, .16]),
    };
  }

  function inViewport() {
    const rect = host.getBoundingClientRect();
    return rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth;
  }

  function sizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const nextWidth = Math.max(1, Math.round(rect.width * pixelRatio));
    const nextHeight = Math.max(1, Math.round(rect.height * pixelRatio));
    if (width === nextWidth && height === nextHeight) return;
    width = canvas.width = nextWidth;
    height = canvas.height = nextHeight;
    gl.viewport(0, 0, width, height);
    const aspect = width / height;
    cameraDistance = Math.max(6.4, 4.35 / aspect);
    const view = identity();
    view[14] = -cameraDistance;
    viewProjection = multiply(perspective(Math.PI * .245, aspect, .1, 30), view);
    gl.uniformMatrix4fv(uniforms.uViewProjection, false, viewProjection);
    gl.uniform3f(uniforms.uCamera, 0, 0, cameraDistance);
  }

  function draw() {
    if (destroyed || failed || gl.isContextLost()) return false;
    sizeCanvas();
    const pose = getSculpturePose({ progress: motionState.progress, time: sceneTime, x: motionState.x, y: motionState.y, reduced: Boolean(motion?.matches) });
    const scale = identity();
    scale[0] = scale[5] = scale[10] = pose.scale;
    const model = multiply(rotation(1, pose.yaw), multiply(rotation(0, pose.pitch), multiply(rotation(2, pose.roll), scale)));
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    if (paletteDirty) {
      gl.uniform3f(uniforms.uLight, ...palette.light);
      gl.uniform3f(uniforms.uAccent, ...palette.accent);
      paletteDirty = false;
    }
    gl.uniformMatrix4fv(uniforms.uModel, false, model);
    gl.drawElements(gl.TRIANGLES, mesh.indices.length, gl.UNSIGNED_SHORT, 0);
    if (!renderCount && gl.getError() !== gl.NO_ERROR) return false;
    renderCount++;
    if (renderCount === 1 || renderCount % 30 === 0 || !continuous()) canvas.dataset.frame = String(renderCount);
    if (poseDirty || renderCount === 1 || renderCount % 30 === 0 || (!continuous() && !settling())) {
      host.dataset.pose = JSON.stringify(Object.fromEntries(Object.entries(pose).map(([key, value]) => [key, Number(value.toFixed(3))])));
      poseDirty = false;
    }
    if (renderCount === 1) {
      canvas.hidden = false;
      host.classList.add('is-webgl-ready');
      host.dataset.renderState = 'webgl';
    }
    return true;
  }

  function active() {
    return !destroyed && !failed && visible && !document.hidden;
  }

  function continuous() {
    return active() && !motion?.matches && (!coarse || sceneTime < 3);
  }

  function settling() {
    return Math.abs(motionState.x - targetX) > .0001 || Math.abs(motionState.y - targetY) > .0001 || Math.abs(motionState.progress - targetProgress) > .0001
      || Math.abs(motionState.vx) > .001 || Math.abs(motionState.vy) > .001 || Math.abs(motionState.vp) > .001;
  }

  function tick(now) {
    frame = 0;
    if (!active() || motion?.matches) { previous = 0; return; }
    if (!previous) previous = now;
    const delta = Math.min((now - previous) / 1000, .1);
    previous = now;
    const wasSettling = settling();
    if (continuous() || wasSettling) {
      sceneTime = coarse ? Math.min(3, sceneTime + delta) : sceneTime + delta;
      motionState = advanceSculptureMotion(motionState, { x: targetX, y: targetY, progress: targetProgress }, delta);
      dirty = true;
    }
    const frameDuration = wasSettling || sceneTime < 3 ? activeFrameDuration : idleFrameDuration;
    if (dirty && now - lastDraw >= frameDuration - .5) {
      if (!draw()) { fail(); return; }
      lastDraw = Math.max(lastDraw + frameDuration, now - frameDuration);
      dirty = false;
    }
    if (continuous() || settling() || dirty) frame = requestAnimationFrame(tick);
  }

  function stop() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    previous = 0;
  }

  function sync() {
    if (!active()) { stop(); return; }
    if (motion?.matches) {
      stop();
      if (dirty) { if (!draw()) fail(); dirty = false; }
    } else if (continuous() || settling() || dirty) {
      if (!frame) frame = requestAnimationFrame(tick);
    } else stop();
  }

  function readProgress() {
    const value = Number(host.dataset.scrollProgress);
    return Number.isFinite(value) ? clamp(value, 0, 1) : 0;
  }

  function onProgress() {
    targetProgress = readProgress();
    if (destroyed || failed || motion?.matches) return;
    dirty = poseDirty = true;
    sync();
  }

  function onPointer(event) {
    if (coarse || motion?.matches || event.pointerType === 'touch') return;
    const rect = interactionSurface.getBoundingClientRect();
    targetX = clamp(((event.clientX - rect.left) / Math.max(1, rect.width) * 2 - 1) * 1.5, -1, 1);
    targetY = clamp(((event.clientY - rect.top) / Math.max(1, rect.height) * 2 - 1) * 1.2, -1, 1);
    poseDirty = true;
    sync();
  }

  function onLeave() { targetX = 0; targetY = 0; poseDirty = true; sync(); }
  function onPalette() {
    if (destroyed || failed) return;
    const next = readPalette();
    if (next.light.every((value, index) => value === palette.light[index]) && next.accent.every((value, index) => value === palette.accent[index])) return;
    palette = next;
    paletteDirty = dirty = true;
    sync();
  }
  function onVisibility() { if (!document.hidden) dirty = true; sync(); }
  function onMotion() {
    if (destroyed) return;
    targetX = targetY = 0;
    targetProgress = readProgress();
    motionState = { x: 0, y: 0, progress: targetProgress, vx: 0, vy: 0, vp: 0 };
    dirty = poseDirty = true;
    sync();
  }
  function onResize() {
    dirty = true;
    sync();
  }
  function fail() { failed = true; stop(); fallback(); }
  function onContextLost(event) { event.preventDefault(); fail(); }

  function release() {
    buffers.forEach(buffer => { if (buffer) gl.deleteBuffer(buffer); });
    shaders.forEach(shader => gl.deleteShader(shader));
    if (program) gl.deleteProgram(program);
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    stop();
    observer?.disconnect();
    resizeObserver?.disconnect();
    interactionSurface.removeEventListener('pointermove', onPointer);
    interactionSurface.removeEventListener('pointerleave', onLeave);
    host.removeEventListener('sculptureprogress', onProgress);
    paletteSurface.removeEventListener('palettechange', onPalette);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('resize', onResize);
    canvas.removeEventListener('webglcontextlost', onContextLost);
    motion?.removeEventListener?.('change', onMotion);
    release();
  }

  canvas.hidden = false;
  try {
    if (!draw()) throw new Error('WebGL first frame unavailable');
  } catch {
    destroy();
    fallback();
    return empty;
  }

  interactionSurface.addEventListener('pointermove', onPointer, { passive: true });
  interactionSurface.addEventListener('pointerleave', onLeave, { passive: true });
  host.addEventListener('sculptureprogress', onProgress);
  paletteSurface.addEventListener('palettechange', onPalette);
  document.addEventListener('visibilitychange', onVisibility);
  canvas.addEventListener('webglcontextlost', onContextLost);
  motion?.addEventListener('change', onMotion);
  if ('ResizeObserver' in window) {
    resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(host);
  } else window.addEventListener('resize', onResize, { passive: true });
  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      if (visible) dirty = true;
      sync();
    }, { rootMargin: '0px', threshold: 0 });
    observer.observe(host);
  }
  sync();
  return { destroy };
}

// An exact critically damped response preserves angular momentum when a target changes.
// Unlike a per-frame lerp, its timing stays consistent at 30, 60 and 120 Hz.
export function advanceSculptureMotion(state, target, delta) {
  const dt = Number.isFinite(delta) ? clamp(delta, 0, .1) : 0;
  const next = {};
  for (const [key, velocityKey, duration, min, max] of [['x', 'vx', .28, -1, 1], ['y', 'vy', .28, -1, 1], ['progress', 'vp', .32, 0, 1]]) {
    const goal = clamp(Number.isFinite(target[key]) ? target[key] : 0, min, max);
    const value = Number.isFinite(state[key]) ? clamp(state[key], min, max) : goal;
    const velocity = Number.isFinite(state[velocityKey]) ? state[velocityKey] : 0;
    const omega = 2 / duration;
    const offset = value - goal;
    const impulse = (velocity + omega * offset) * dt;
    const decay = Math.exp(-omega * dt);
    const position = goal + (offset + impulse) * decay;
    next[key] = clamp(position, min, max);
    next[velocityKey] = position === next[key] ? (velocity - omega * impulse) * decay : 0;
    if (Math.abs(next[key] - goal) <= .0001 && Math.abs(next[velocityKey]) <= .001) {
      next[key] = goal;
      next[velocityKey] = 0;
    }
  }
  return next;
}

export function getSculpturePose({ progress = 0, time = 0, x = 0, y = 0, reduced = false } = {}) {
  if (reduced) return { progress: 0, yaw: -.32, pitch: .18, roll: -.34, scale: 1.02 };
  const p = clamp(progress, 0, 1);
  const eased = p * p * p * (p * (p * 6 - 15) + 10);
  const intro = 1 - (1 - clamp(time / 3, 0, 1)) ** 3;
  return {
    progress: p,
    yaw: clamp(-.40 + intro * .12 + eased * .50 + Math.sin(time * .25) * .045 + clamp(x, -1, 1) * .68, -.95, .95),
    pitch: clamp(.18 - eased * .22 + Math.sin(time * .29) * .025 + clamp(y, -1, 1) * .38, -.55, .62),
    roll: -.34 + eased * .52 + Math.sin(time * .20) * .02,
    scale: 1.02 - eased * .14,
  };
}

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function identity() { return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]); }
function rotation(axis, angle) {
  const m = identity(), c = Math.cos(angle), s = Math.sin(angle);
  const a = (axis + 1) % 3, b = (axis + 2) % 3;
  m[a * 4 + a] = c; m[b * 4 + b] = c;
  m[a * 4 + b] = s; m[b * 4 + a] = -s;
  return m;
}
function multiply(a, b) {
  const out = new Float32Array(16);
  for (let col = 0; col < 4; col++) for (let row = 0; row < 4; row++) {
    for (let k = 0; k < 4; k++) out[col * 4 + row] += a[k * 4 + row] * b[col * 4 + k];
  }
  return out;
}
function perspective(fov, aspect, near, far) {
  const f = 1 / Math.tan(fov * .5), range = 1 / (near - far);
  return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * range, -1, 0, 0, 2 * far * near * range, 0]);
}
