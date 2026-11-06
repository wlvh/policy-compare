import { defineConfig } from "vite";
import { resolve,dirname } from "node:path";
import {createRequire} from 'node:module';
import { cpSync, existsSync, mkdirSync,readFileSync,writeFileSync } from "node:fs";
import { execFileSync } from 'node:child_process';
import coreArtifact from './packages/rust-core/generated/core-info.json' with {type:'json'};
import { releaseBase, resourceManifest } from './scripts/release-config.ts';
const engine = process.env.POLICY_ENGINE ?? "mupdf";
const require=createRequire(import.meta.url);
const releaseId = process.env.POLICY_RELEASE_ID || 'development';
const base = releaseId === 'development' ? '/' : releaseBase(releaseId);
const revision = process.env.POLICY_REVISION || (()=>{try{return execFileSync('git', ['rev-parse','HEAD'], {encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();}catch{return 'source-archive-unversioned';}})();
if (base !== '/' && revision === 'source-archive-unversioned') throw new Error('Release builds require POLICY_REVISION or a Git checkout');
const engineVersion = JSON.parse(readFileSync(resolve(`engines/${engine}/package.json`),'utf8')).dependencies[engine === 'pdfjs' ? 'pdfjs-dist' : 'mupdf'];
if (!["mupdf", "pdfjs"].includes(engine))
  throw new Error("POLICY_ENGINE must explicitly select pdfjs or mupdf");
export default defineConfig({
  base,
  define: {__POLICY_BUILD__: JSON.stringify({releaseId, revision, engine, engineVersion, coreArtifact, base, contact: process.env.POLICY_CONTACT || '请联系提供本工具的维护者'})},
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
        // Explicit allowlist: never ship validation answers, reports or user PDFs.
        for (const id of ['P01','P02','E03']) {
          const target = resolve(`dist/${engine}/samples/${id}`);
          mkdirSync(target, {recursive:true});
          for (const file of ['before.pdf','after.pdf']) cpSync(resolve(`apps/web/public/samples/${id}/${file}`), resolve(target,file));
        }
        if (engine === "pdfjs") {
          const resourceVersion=JSON.parse(readFileSync(resolve('engines/pdfjs/node_modules/pdfjs-dist/package.json'),'utf8')).version;
          for (const name of ["cmaps", "standard_fonts", "wasm"])
            cpSync(
              resolve(`engines/pdfjs/node_modules/pdfjs-dist/${name}`),
              resolve(`dist/pdfjs/pdfjs/${resourceVersion}/${name}`),
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
        cpSync(resolve('packages/rust-core/generated/licenses'),resolve(`dist/${engine}/licenses/rust`),{recursive:true});
        const root = resolve(`dist/${engine}`);
        writeFileSync(resolve(root,'build-info.json'), JSON.stringify({releaseId, revision, engine, engineVersion, coreArtifact, base, resources: resourceManifest(root)},null,2)+'\n');
      },
    },
  ],
  worker: { format: "es" },
  server: { fs: { allow: ["../.."] },headers:{'Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp'} },
  preview:{headers:{'Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp'}},
});
