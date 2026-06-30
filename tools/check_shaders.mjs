#!/usr/bin/env node
// =============================================================================
// tools/check_shaders.mjs — Lightweight static checks for the shader suite.
// We can't spin up a GL context in CI without a GPU, so this validates the
// things that actually break the harness: every #include resolves, every .frag
// defines mainImage(), braces/parens balance, and include guards are present.
// Run:  node tools/check_shaders.mjs
// =============================================================================
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { globSync } from "node:fs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function resolveIncludes(path, seen = new Set(), trail = []) {
  if (seen.has(path)) return "";
  seen.add(path);
  if (!existsSync(path)) {
    throw new Error(`missing include "${path}" (via ${trail.join(" -> ") || "entry"})`);
  }
  const src = readFileSync(path, "utf8");
  const base = dirname(path);
  return src.split("\n").map((line) => {
    const m = line.match(/^\s*#include\s+"([^"]+)"/);
    if (m) return resolveIncludes(resolve(base, m[1]), seen, [...trail, path]);
    return line;
  }).join("\n");
}

function balanced(src, open, close) {
  let depth = 0;
  for (const ch of src) {
    if (ch === open) depth++;
    else if (ch === close) depth--;
    if (depth < 0) return false;
  }
  return depth === 0;
}

const fragFiles = globSync("shaders/**/*.frag", { cwd: ROOT }).sort();
const glslFiles = globSync("shaders/**/*.glsl", { cwd: ROOT }).sort();

let failures = 0;
const fail = (file, msg) => { console.error(`  ✗ ${file}: ${msg}`); failures++; };

console.log(`checking ${fragFiles.length} .frag and ${glslFiles.length} .glsl files\n`);

// Every core/common include should carry an include guard so dedupe is safe.
for (const f of glslFiles) {
  const src = readFileSync(resolve(ROOT, f), "utf8");
  if (!/#ifndef\s+\w+_GLSL/.test(src)) fail(f, "missing #ifndef include guard");
  if (!balanced(src, "{", "}")) fail(f, "unbalanced braces");
}

// Every fragment shader must resolve and expose mainImage().
for (const f of fragFiles) {
  try {
    const flat = resolveIncludes(resolve(ROOT, f));
    if (!/void\s+mainImage\s*\(/.test(flat)) fail(f, "no mainImage() entry point");
    if (!balanced(flat, "{", "}")) fail(f, "unbalanced braces after include");
    if (!balanced(flat, "(", ")")) fail(f, "unbalanced parens after include");
    if (/#include/.test(flat)) fail(f, "unresolved #include remained");
  } catch (e) {
    fail(f, e.message);
  }
}

if (failures === 0) {
  console.log("✓ all shaders pass structural checks");
  process.exit(0);
} else {
  console.error(`\n${failures} problem(s) found`);
  process.exit(1);
}
