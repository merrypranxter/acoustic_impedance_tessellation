// =============================================================================
// web/viewer.js — A tiny WebGL2 harness for the acoustic_impedance_tessellation
// shaders. Loads a .frag, recursively resolves its #include directives against
// the repo, wraps it with a version header + a main() that calls mainImage(),
// and drives it with the project's uniforms. UI sliders map to uProbe*, uGain…
//
// Must be served over HTTP (fetch() won't read file://). See README "Running".
// =============================================================================

const SHADERS = [
  { label: "Mode · B-mode",            path: "../shaders/modes/b_mode.frag" },
  { label: "Mode · M-mode",            path: "../shaders/modes/m_mode.frag" },
  { label: "Mode · Color Doppler",     path: "../shaders/modes/color_doppler.frag" },
  { label: "Mode · Elastography",      path: "../shaders/modes/elastography.frag" },
  { label: "Artifact · Reverberation", path: "../shaders/artifacts/reverberation.frag" },
  { label: "Artifact · Shadowing",     path: "../shaders/artifacts/shadowing.frag" },
  { label: "Artifact · Enhancement",   path: "../shaders/artifacts/enhancement.frag" },
  { label: "Artifact · Speckle",       path: "../shaders/artifacts/speckle.frag" },
  { label: "Demo · Beating Heart",     path: "../shaders/demo/beating_heart.frag" },
  { label: "Demo · Fetal Scan",        path: "../shaders/demo/fetal_scan.frag" },
  { label: "Demo · Alien Anatomy",     path: "../shaders/demo/alien_anatomy.frag" },
];

const PRESETS = ["abdomen", "cardiac", "vascular", "musculoskeletal", "ocular"];

const canvas = document.getElementById("gl");
const gl = canvas.getContext("webgl2", { antialias: false });
if (!gl) {
  document.body.innerHTML = "<p style='color:#fff;padding:2rem'>WebGL2 not available in this browser.</p>";
  throw new Error("no webgl2");
}

// ---- #include resolver ------------------------------------------------------
// Resolves `#include "rel/path"` relative to the including file, once per file.
async function loadWithIncludes(path, seen = new Set()) {
  if (seen.has(path)) return ""; // include guards also protect us, but dedupe
  seen.add(path);
  const src = await (await fetch(path)).text();
  const baseDir = path.slice(0, path.lastIndexOf("/") + 1);
  const lines = src.split("\n");
  const out = [];
  for (const line of lines) {
    const m = line.match(/^\s*#include\s+"([^"]+)"/);
    if (m) {
      const inc = new URL(baseDir + m[1], location.href).pathname;
      out.push(await loadWithIncludes(inc, seen));
    } else {
      out.push(line);
    }
  }
  return out.join("\n");
}

const HEADER = `#version 300 es
precision highp float;
out vec4 fragColor;
`;

const FOOTER = `
void main() { mainImage(fragColor, gl_FragCoord.xy); }
`;

const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

function compile(type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    console.error(log, "\n---\n", src);
    throw new Error(log);
  }
  return sh;
}

function buildProgram(fragBody) {
  const fragSrc = HEADER + fragBody + FOOTER;
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fragSrc));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(prog));
  }
  return prog;
}

// Fullscreen triangle.
const vao = gl.createVertexArray();
gl.bindVertexArray(vao);
const buf = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buf);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

// ---- UI state ---------------------------------------------------------------
const state = {
  probeFrequency: 6.0,
  gain: 1.0,
  tgc: 0.6,
  focusDepth: 0.45,
  dynamicRange: 50.0,
  preset: 0,
  paused: false,
};
const mouse = { x: 0, y: 0, downX: 0, downY: 0, down: false };

let program = null;
let uniforms = {};

function cacheUniforms() {
  uniforms = {};
  for (const name of [
    "iResolution", "iTime", "iMouse",
    "uProbeFrequency", "uGain", "uTGC", "uFocusDepth", "uDynamicRange", "uTissuePreset",
  ]) {
    uniforms[name] = gl.getUniformLocation(program, name);
  }
}

async function selectShader(path) {
  const body = await loadWithIncludes(path);
  const next = buildProgram(body);
  if (program) gl.deleteProgram(program);
  program = next;
  gl.useProgram(program);
  const loc = gl.getAttribLocation(program, "aPos");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  cacheUniforms();
}

// ---- resize -----------------------------------------------------------------
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.floor(canvas.clientWidth * dpr);
  const h = Math.floor(canvas.clientHeight * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  gl.viewport(0, 0, canvas.width, canvas.height);
}
window.addEventListener("resize", resize);

// ---- mouse ------------------------------------------------------------------
canvas.addEventListener("mousemove", (e) => {
  const r = canvas.getBoundingClientRect();
  const dpr = canvas.width / r.width;
  mouse.x = (e.clientX - r.left) * dpr;
  mouse.y = canvas.height - (e.clientY - r.top) * dpr; // flip to GL origin
});
canvas.addEventListener("mousedown", () => {
  mouse.down = true; mouse.downX = mouse.x; mouse.downY = mouse.y;
});
canvas.addEventListener("mouseup", () => { mouse.down = false; });

// ---- render loop ------------------------------------------------------------
let startTime = performance.now();
let elapsed = 0;
let lastFrame = startTime;

function frame(now) {
  if (!state.paused) elapsed += (now - lastFrame) / 1000;
  lastFrame = now;
  resize();

  if (program) {
    gl.useProgram(program);
    gl.uniform2f(uniforms.iResolution, canvas.width, canvas.height);
    gl.uniform1f(uniforms.iTime, elapsed);
    gl.uniform4f(uniforms.iMouse, mouse.x, mouse.y, mouse.down ? mouse.downX : 0, mouse.down ? mouse.downY : 0);
    gl.uniform1f(uniforms.uProbeFrequency, state.probeFrequency);
    gl.uniform1f(uniforms.uGain, state.gain);
    gl.uniform1f(uniforms.uTGC, state.tgc);
    gl.uniform1f(uniforms.uFocusDepth, state.focusDepth);
    gl.uniform1f(uniforms.uDynamicRange, state.dynamicRange);
    gl.uniform1i(uniforms.uTissuePreset, state.preset);
    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  requestAnimationFrame(frame);
}

// ---- wire up controls -------------------------------------------------------
function buildUI() {
  const sel = document.getElementById("shader");
  SHADERS.forEach((s, i) => {
    const o = document.createElement("option");
    o.value = s.path; o.textContent = s.label; if (i === 0) o.selected = true;
    sel.appendChild(o);
  });
  sel.addEventListener("change", () => selectShader(sel.value).catch(showError));

  const presetSel = document.getElementById("preset");
  PRESETS.forEach((p, i) => {
    const o = document.createElement("option");
    o.value = String(i); o.textContent = p; presetSel.appendChild(o);
  });
  presetSel.addEventListener("input", () => { state.preset = +presetSel.value; });

  const bind = (id, key, fmt = (v) => v) => {
    const el = document.getElementById(id);
    const out = document.getElementById(id + "-val");
    const sync = () => { state[key] = +el.value; if (out) out.textContent = fmt(+el.value); };
    el.addEventListener("input", sync); sync();
  };
  bind("freq", "probeFrequency", (v) => v.toFixed(1) + " MHz");
  bind("gain", "gain", (v) => v.toFixed(2));
  bind("tgc", "tgc", (v) => v.toFixed(2));
  bind("focus", "focusDepth", (v) => v.toFixed(2));
  bind("dr", "dynamicRange", (v) => v.toFixed(0) + " dB");

  document.getElementById("pause").addEventListener("click", (e) => {
    state.paused = !state.paused;
    e.target.textContent = state.paused ? "▶ Play" : "⏸ Pause";
  });
}

function showError(err) {
  const banner = document.getElementById("error");
  banner.textContent = "Shader error: " + err.message;
  banner.style.display = "block";
}

buildUI();
selectShader(SHADERS[0].path).then(() => {
  document.getElementById("error").style.display = "none";
}).catch(showError);
requestAnimationFrame(frame);
