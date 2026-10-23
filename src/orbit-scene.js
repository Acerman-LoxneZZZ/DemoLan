import { advanceOrbitMotion, buildOrbitMesh, getOrbitPose } from './orbit-geometry.js';

// Independent bottom sculpture: three linked rings. It never alters the hero scene.
export function setupOrbitScene({ canvas, host, motion } = {}) {
  const empty = { destroy() {} };
  if (!canvas || !host) return empty;
  const section = host.closest?.('.demo-playground') || host;
  const fallback = () => {
    canvas.hidden = true;
    host.classList.remove('is-orbit-ready', 'is-dragging');
    host.dataset.renderState = 'fallback';
  };
  let gl;
  try {
    gl = canvas.getContext('webgl', {
      alpha: true, antialias: true, depth: true, stencil: false,
      premultipliedAlpha: false, powerPreference: 'low-power',
    });
  } catch { /* Static SVG remains the scene when WebGL is unavailable. */ }
  if (!gl) { fallback(); return empty; }

  const shaders = [], buffers = [];
  let program;
  function release() {
    buffers.forEach(buffer => { if (buffer) gl.deleteBuffer(buffer); });
    shaders.forEach(shader => gl.deleteShader(shader));
    if (program) gl.deleteProgram(program);
  }
  function compile(type, source) {
    const shader = gl.createShader(type);
    if (!shader) throw new Error('Orbit shader unavailable');
    shaders.push(shader);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error('Orbit shader compilation failed');
    return shader;
  }
  const precision = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT)?.precision ? 'highp' : 'mediump';
  const vertex = `
    attribute vec3 aPosition;
    attribute vec3 aNormal;
    attribute float aMaterial;
    uniform mat4 uModel;
    uniform mat4 uViewProjection;
    varying vec3 vPosition;
    varying vec3 vNormal;
    varying float vMaterial;
    void main() {
      vec4 world = uModel * vec4(aPosition, 1.0);
      vPosition = world.xyz;
      vNormal = mat3(uModel) * aNormal;
      vMaterial = aMaterial;
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
    varying float vMaterial;
    vec3 tone(vec3 c) {
      return clamp((c * (2.51 * c + .03)) / (c * (2.43 * c + .59) + .14), 0.0, 1.0);
    }
    void main() {
      vec3 N = normalize(vNormal);
      vec3 V = normalize(uCamera - vPosition);
      vec3 R = reflect(-V, N);
      vec3 L = normalize(vec3(-2.0, 3.0, 4.0));
      float nv = clamp(dot(N, V), .001, 1.0);
      float nl = clamp(dot(N, L), 0.0, 1.0);
      float nh = clamp(dot(N, normalize(L + V)), 0.0, 1.0);
      float middle = 1.0 - clamp(abs(vMaterial - 1.0), 0.0, 1.0);
      vec3 pigment = mix(vec3(.32, .35, .4), mix(uLight, uAccent, .35), middle * .55);
      float keyDistance = (R.x + .28) / .24;
      float thinDistance = (R.x + .42) / .065;
      float topDistance = (R.y - .68) / .24;
      float sideDistance = (R.x - .7) / .16;
      float key = exp(-keyDistance * keyDistance) * smoothstep(-.7, .2, R.y);
      float thin = exp(-thinDistance * thinDistance);
      float top = exp(-topDistance * topDistance) * (1.0 - smoothstep(.25, 1.0, abs(R.x)));
      float side = exp(-sideDistance * sideDistance);
      vec3 color = pigment * (.22 + .42 * nl);
      color += vec3(.82, .9, 1.0) * (key * 1.2 + thin * .36 + top * .85);
      color += uLight * side * .9;
      color += uAccent * pow(1.0 - nv, 2.7) * .75;
      color += vec3(.94, .97, 1.0) * (pow(nh, 100.0) * .85 + pow(nh, 20.0) * .12);
      gl_FragColor = vec4(pow(tone(color), vec3(.454545)), 1.0);
    }
  `;
  try {
    program = gl.createProgram();
    if (!program) throw new Error('Orbit program unavailable');
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vertex));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Orbit link failed');
    gl.useProgram(program);
  } catch { release(); fallback(); return empty; }

  const weak = Boolean(navigator.connection?.saveData || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4)
    || (navigator.deviceMemory && navigator.deviceMemory <= 4));
  const coarse = matchMedia('(pointer: coarse)').matches;
  const pixelRatio = Math.min(window.devicePixelRatio || 1, weak ? 1.25 : 1.5);
  const frameDuration = 1000 / (weak || coarse ? 30 : 60);
  const mesh = buildOrbitMesh({ segments: weak ? 64 : 96, sides: weak ? 12 : 16 });
  const uniforms = Object.fromEntries(['uModel', 'uViewProjection', 'uCamera', 'uLight', 'uAccent'].map(name => [name, gl.getUniformLocation(program, name)]));
  try {
    for (const [name, size, data] of [['aPosition', 3, mesh.positions], ['aNormal', 3, mesh.normals], ['aMaterial', 1, mesh.materials]]) {
      const buffer = gl.createBuffer();
      if (!buffer) throw new Error('Orbit buffer unavailable');
      buffers.push(buffer);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      const location = gl.getAttribLocation(program, name);
      if (location >= 0) {
        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
      }
    }
    const indices = gl.createBuffer();
    if (!indices) throw new Error('Orbit indices unavailable');
    buffers.push(indices);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indices);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.clearColor(0, 0, 0, 0);
  } catch { release(); fallback(); return empty; }

  let destroyed = false, frame = 0, observer, resizeObserver;
  let visible = inViewport(), sceneTime = 0, previous = 0, lastDraw = 0;
  let dirty = false, paletteDirty = true, renderCount = 0, width = 0, height = 0;
  let target = { x: 0, y: 0, progress: readProgress() };
  let state = { ...target, vx: 0, vy: 0, vp: 0 };
  let palette = readPalette();
  let drag = null;

  function readPalette() {
    const style = getComputedStyle(host);
    const read = (name, fallbackValue) => {
      const values = style.getPropertyValue(name).trim().split(/\s+/).map(Number);
      return values.length === 3 && values.every(Number.isFinite) ? values.map(value => limit(value, 0, 1)) : fallbackValue;
    };
    return { light: read('--orbit-light-rgb', [.4, .1, 1]), accent: read('--orbit-accent-rgb', [.76, .5, 1]) };
  }
  function inViewport() {
    const rect = host.getBoundingClientRect();
    return rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth;
  }
  function readProgress() {
    const rect = host.getBoundingClientRect();
    return limit((innerHeight * .8 - rect.top) / Math.max(1, innerHeight + rect.height * .2), 0, 1);
  }
  function sizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const nextWidth = Math.max(1, Math.round(rect.width * pixelRatio));
    const nextHeight = Math.max(1, Math.round(rect.height * pixelRatio));
    if (nextWidth === width && nextHeight === height) return;
    width = canvas.width = nextWidth;
    height = canvas.height = nextHeight;
    gl.viewport(0, 0, width, height);
    const aspect = width / height;
    const distance = Math.max(5.8, 5.5 / aspect);
    const view = identity();
    view[14] = -distance;
    gl.uniformMatrix4fv(uniforms.uViewProjection, false, multiply(perspective(.7, aspect, .1, 30), view));
    gl.uniform3f(uniforms.uCamera, 0, 0, distance);
  }
  function draw() {
    if (destroyed || gl.isContextLost()) return false;
    sizeCanvas();
    const pose = getOrbitPose({ ...state, time: sceneTime, reduced: Boolean(motion?.matches) });
    const model = multiply(rotation(1, pose.yaw), multiply(rotation(0, pose.pitch), rotation(2, pose.roll)));
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
    canvas.dataset.frame = String(renderCount);
    host.dataset.pose = JSON.stringify(Object.fromEntries(Object.entries(pose).map(([key, value]) => [key, Number(value.toFixed(3))])));
    if (renderCount === 1) {
      canvas.hidden = false;
      host.classList.add('is-orbit-ready');
      host.dataset.renderState = 'webgl';
    }
    return true;
  }
  function active() { return !destroyed && visible && !document.hidden; }
  function settling() {
    return Math.abs(state.x - target.x) > .0001 || Math.abs(state.y - target.y) > .0001 || Math.abs(state.progress - target.progress) > .0001
      || Math.abs(state.vx) > .001 || Math.abs(state.vy) > .001 || Math.abs(state.vp) > .001;
  }
  function stop() { if (frame) cancelAnimationFrame(frame); frame = 0; previous = 0; }
  function fail() { destroy(); fallback(); }
  function tick(now) {
    frame = 0;
    if (!active() || motion?.matches) { previous = 0; return; }
    if (!previous) previous = now;
    const delta = Math.min((now - previous) / 1000, .1);
    previous = now;
    if (sceneTime < 2 || settling()) {
      sceneTime = Math.min(2, sceneTime + delta);
      state = advanceOrbitMotion(state, target, delta);
      dirty = true;
    }
    if (dirty && now - lastDraw >= frameDuration - .5) {
      if (!draw()) { fail(); return; }
      lastDraw = Math.max(lastDraw + frameDuration, now - frameDuration);
      dirty = false;
    }
    if (sceneTime < 2 || settling() || dirty) frame = requestAnimationFrame(tick);
  }
  function sync() {
    if (!active()) { stop(); return; }
    if (motion?.matches) {
      stop();
      if (dirty) { if (!draw()) { fail(); return; } dirty = false; }
    } else if (sceneTime < 2 || settling() || dirty) {
      if (!frame) frame = requestAnimationFrame(tick);
    } else stop();
  }
  function onScroll() {
    if (!active() || motion?.matches) return;
    const progress = readProgress();
    if (Math.abs(progress - target.progress) < .0001) return;
    target.progress = progress;
    sync();
  }
  function onPointerDown(event) {
    if (!active() || motion?.matches || (event.button !== undefined && event.button !== 0)) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, startX: target.x, startY: target.y };
    host.classList.add('is-dragging');
    if (event.pointerType !== 'touch') canvas.setPointerCapture?.(event.pointerId);
  }
  function onPointerMove(event) {
    if (!active() || motion?.matches) return;
    const rect = canvas.getBoundingClientRect();
    if (drag?.id === event.pointerId) {
      target.x = limit(drag.startX + (event.clientX - drag.x) / Math.max(1, rect.width) * 3, -1, 1);
      target.y = limit(drag.startY + (event.clientY - drag.y) / Math.max(1, rect.height) * 2, -1, 1);
    } else {
      if (coarse || event.pointerType === 'touch') return;
      target.x = limit((event.clientX - rect.left) / Math.max(1, rect.width) * 2 - 1, -1, 1);
      target.y = limit((event.clientY - rect.top) / Math.max(1, rect.height) * 2 - 1, -1, 1);
    }
    sync();
  }
  function endDrag(event) {
    if (!drag || (event?.pointerId !== undefined && event.pointerId !== drag.id)) return;
    const id = drag.id;
    drag = null;
    host.classList.remove('is-dragging');
    if (canvas.hasPointerCapture?.(id)) canvas.releasePointerCapture?.(id);
  }
  function onPointerLeave() {
    if (drag) return;
    target.x = target.y = 0;
    sync();
  }
  function onPointerCancel(event) { endDrag(event); target.x = target.y = 0; sync(); }
  function onMood() {
    if (destroyed) return;
    const next = readPalette();
    if (next.light.every((value, i) => value === palette.light[i]) && next.accent.every((value, i) => value === palette.accent[i])) return;
    palette = next;
    paletteDirty = dirty = true;
    sync();
  }
  function onVisibility() {
    if (document.hidden) endDrag();
    else { target.progress = readProgress(); dirty = true; }
    sync();
  }
  function onMotion() {
    endDrag();
    target = { x: 0, y: 0, progress: readProgress() };
    state = { ...target, vx: 0, vy: 0, vp: 0 };
    dirty = true;
    sync();
  }
  function onResize() { target.progress = readProgress(); dirty = true; sync(); }
  function onContextLost(event) { event.preventDefault(); fail(); }
  function destroy() {
    if (destroyed) return;
    destroyed = true;
    stop();
    endDrag();
    observer?.disconnect();
    resizeObserver?.disconnect();
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', endDrag);
    canvas.removeEventListener('pointercancel', onPointerCancel);
    canvas.removeEventListener('lostpointercapture', endDrag);
    canvas.removeEventListener('pointerleave', onPointerLeave);
    canvas.removeEventListener('webglcontextlost', onContextLost);
    window.removeEventListener('pointerup', endDrag);
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onResize);
    section.removeEventListener('moodchange', onMood);
    document.removeEventListener('visibilitychange', onVisibility);
    motion?.removeEventListener?.('change', onMotion);
    release();
  }

  canvas.hidden = false;
  try { if (!draw()) throw new Error('Orbit first frame unavailable'); }
  catch { destroy(); fallback(); return empty; }
  canvas.addEventListener('pointerdown', onPointerDown, { passive: true });
  canvas.addEventListener('pointermove', onPointerMove, { passive: true });
  canvas.addEventListener('pointerup', endDrag, { passive: true });
  canvas.addEventListener('pointercancel', onPointerCancel, { passive: true });
  canvas.addEventListener('lostpointercapture', endDrag, { passive: true });
  canvas.addEventListener('pointerleave', onPointerLeave, { passive: true });
  canvas.addEventListener('webglcontextlost', onContextLost);
  window.addEventListener('pointerup', endDrag, { passive: true });
  window.addEventListener('scroll', onScroll, { passive: true });
  section.addEventListener('moodchange', onMood);
  document.addEventListener('visibilitychange', onVisibility);
  motion?.addEventListener?.('change', onMotion);
  if ('ResizeObserver' in window) {
    resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(host);
  } else window.addEventListener('resize', onResize, { passive: true });
  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      if (visible) { target.progress = readProgress(); dirty = true; }
      else endDrag();
      sync();
    }, { threshold: 0 });
    observer.observe(host);
  }
  sync();
  return { destroy };
}

function limit(value, min, max) { return Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0)); }
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
