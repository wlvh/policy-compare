import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

export const DEFAULT_BUDGET = Object.freeze({
  candidates: 20_000,
  tokenProducts: 100_000_000,
  diffProducts: 4_000_000,
});

/** No repository imports, PDF extraction, network calls, or CLI side effects. */
export async function loadWasm(path) {
  const bytes = await readFile(path);
  return {
    module: await WebAssembly.compile(bytes),
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

function session(module, hooks = {}) {
  const instance = new WebAssembly.Instance(module, {
    host: {
      phase: hooks.phase ?? (() => {}),
      check: hooks.check ?? (() => {}),
    },
  });
  const e = instance.exports;
  for (const key of ["input_ptr", "call", "output_ptr", "output_len", "clear_output"]) {
    if (typeof e[key] !== "function") throw new Error("Unsupported WASM ABI: missing " + key);
  }
  if (!(e.memory instanceof WebAssembly.Memory)) throw new Error("Unsupported WASM ABI: missing memory");
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  return (op, body = {}) => {
    const bytes = encoder.encode(JSON.stringify({ op, ...body }));
    const pointer = e.input_ptr(bytes.length);
    new Uint8Array(e.memory.buffer, pointer, bytes.length).set(bytes);
    e.call();
    // Decode before clear_output or another call can release/grow the buffer.
    const text = decoder.decode(new Uint8Array(e.memory.buffer, e.output_ptr(), e.output_len()));
    e.clear_output();
    const answer = JSON.parse(text);
    if (Object.hasOwn(answer, "error")) throw new Error(op + ": " + String(answer.error));
    if (!Object.hasOwn(answer, "ok")) throw new Error(op + ": invalid response envelope");
    return answer.ok;
  };
}

/**
 * Compare already-extracted DocInput values with policy-core-session/1.
 * moduleOrPath is a compiled WebAssembly.Module, a filesystem path, or a file URL.
 * hooks.check can throw to impose a caller-owned limit; default hooks do nothing.
 * Returns the complete core result, with no filtering or rewriting.
 */
export async function compareDocs(moduleOrPath, leftDoc, rightDoc, budget = DEFAULT_BUDGET, hooks = {}) {
  const module = moduleOrPath instanceof WebAssembly.Module
    ? moduleOrPath
    : (await loadWasm(moduleOrPath)).module;
  const invoke = session(module, hooks);
  let originalError;
  try {
    invoke("reset", { profile: { version: "english-generic/1", budget }, budget });
    for (const [side, doc] of [leftDoc, rightDoc].entries()) {
      const { pages, ...meta } = doc;
      invoke("meta", { side, meta });
      for (const page of pages) invoke("page", { side, page });
      invoke("done", { side });
    }
    return invoke("compare");
  } catch (error) {
    originalError = error;
    throw error;
  } finally {
    try {
      invoke("dispose");
    } catch (error) {
      if (!originalError) throw error;
    }
  }
}

