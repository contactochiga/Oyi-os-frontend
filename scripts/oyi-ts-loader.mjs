// Minimal TypeScript module loader for surface smokes: transpiles a surface
// source file (and its "@/..." / relative imports) to CommonJS on demand so
// the REAL adapter code runs under node without a bundler. Package imports
// (e.g. "oyi-interaction/core") resolve through the surface's node_modules.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

export function createTsLoader(root, aliasRoot) {
  const nodeRequire = createRequire(path.join(root, "package.json"));
  const ts = nodeRequire("typescript");
  const cache = new Map();
  function resolveFile(spec, fromDir) {
    const base = spec.startsWith("@/") ? path.join(aliasRoot, spec.slice(2)) : path.resolve(fromDir, spec);
    for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")]) {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
    }
    throw new Error(`cannot resolve ${spec} from ${fromDir}`);
  }
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const source = fs.readFileSync(file, "utf8");
    const out = ts.transpileModule(source, { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
    const loaded = { exports: {} };
    cache.set(file, loaded);
    const localRequire = (spec) => (spec.startsWith("@/") || spec.startsWith(".") ? load(resolveFile(spec, path.dirname(file))) : nodeRequire(spec));
    new Function("require", "module", "exports", "__filename", "__dirname", out)(localRequire, loaded, loaded.exports, file, path.dirname(file));
    return loaded.exports;
  }
  return (relativeFile) => load(path.join(root, relativeFile));
}
