import { defineConfig } from "vite";
import { resolve,dirname } from "node:path";
import {createRequire} from 'node:module';
import { cpSync, existsSync, mkdirSync } from "node:fs";
const engine = process.env.POLICY_ENGINE ?? "mupdf";
const require=createRequire(import.meta.url);
if (!["mupdf", "pdfjs"].includes(engine))
  throw new Error("POLICY_ENGINE must explicitly select pdfjs or mupdf");
export default defineConfig({
  root: "apps/web",
  resolve: {
    alias: {
      "@policy/pdf-engine": resolve(`engines/${engine}/adapter.ts`),
      "@policy/pdf-client": resolve(`engines/${engine}/client.ts`),
      "@policy/pdf-view": resolve(`engines/${engine}/view.ts`),
    },
  },
  build: {
    outDir: `../../dist/${engine}`,
    emptyOutDir: true,
    target: "es2022",
  },
  plugins: [
    {
      name: "self-host-selected-engine-resources",
      closeBundle() {
        if (engine === "pdfjs") {
          for (const name of ["cmaps", "standard_fonts", "wasm"])
            cpSync(
              resolve(`engines/pdfjs/node_modules/pdfjs-dist/${name}`),
              resolve(`dist/pdfjs/pdfjs/${name}`),
              { recursive: true },
            );
        }
        const pkg = resolve(
          `engines/${engine}/node_modules/${engine === "pdfjs" ? "pdfjs-dist" : "mupdf"}`,
        );
        mkdirSync(resolve(`dist/${engine}/licenses`), { recursive: true });
        for (const name of ["LICENSE", "NOTICE"])
          if (existsSync(pkg + "/" + name))
            cpSync(
              pkg + "/" + name,
              resolve(`dist/${engine}/licenses/${engine}-${name}`),
            );
        for(const name of ['react','react-dom','@noble/hashes','zod','scheduler']){
          const resolver=name==='scheduler'?createRequire(require.resolve('react-dom/package.json')):require;
          const source=name==='@noble/hashes'?resolve('node_modules/@noble/hashes'):dirname(resolver.resolve(name+'/package.json'));
          const target=resolve(`dist/${engine}/licenses/common/${name.replace('/','-')}`);mkdirSync(target,{recursive:true});
          for(const file of ['LICENSE','LICENSE.md','LICENSE.txt','NOTICE'])if(existsSync(source+'/'+file))cpSync(source+'/'+file,target+'/'+file);
        }
      },
    },
  ],
  worker: { format: "es" },
  server: { fs: { allow: ["../.."] } },
});
