import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { resourceManifest, releaseBase } from '../scripts/release-config.ts';
import { render } from '../scripts/render-openshift.ts';

describe('OpenShift publication contract',()=>{
 const config={namespace:'review',host:'review.apps.test',releaseId:'r20261104-abc1234',image:'registry.test/policy@sha256:'+'a'.repeat(64),architecture:'arm64',replicas:1,routeLabels:{visibility:'internal'},ingressPeers:[{namespaceSelector:{matchLabels:{purpose:'internal-router'}}}],platformVersion:'4.x-test',internalIngressController:'internal'};
 it('separates version Service, version Route and root switch; constrains UID, filesystem, architecture, token and egress',()=>{
   const release = render(config) as any;
   const [deployment,service,route,network] = release.items;
   expect(deployment.spec.template.spec.nodeSelector).toEqual({'kubernetes.io/arch':'arm64'});
   expect(deployment.spec.template.spec.automountServiceAccountToken).toBe(false);
   const pod=deployment.spec.template.spec;
   expect(pod.securityContext.runAsUser).toBeUndefined();
   expect(pod.containers[0].securityContext.readOnlyRootFilesystem).toBe(true);
   expect(pod.containers[0].image).toBe(config.image);
   expect(service.spec.selector).toEqual(deployment.spec.template.metadata.labels);
   expect(route.spec.path).toBe(releaseBase(config.releaseId));
   expect(route.spec.tls).toEqual({termination:'edge',insecureEdgeTerminationPolicy:'Redirect'});
   expect(network.spec.egress).toEqual([]);
   expect(network.spec.ingress[0].from).toEqual(config.ingressPeers);
   const entry=render(config,true) as any;
   expect(entry.spec.path).toBe('/');expect(entry.spec.to.name).toBe(service.metadata.name);
   expect(release.items.some((x:any)=>x.metadata.name==='policy-entry')).toBe(false);
   const old=render({...config,releaseId:'r20261103-previous'}) as any;
   expect(old.items[1].spec.selector).not.toEqual(service.spec.selector);
 });
 it('refuses incomplete environment, floating image and invalid release paths',()=>{
   for(const change of [{image:'policy:latest'},{architecture:null},{ingressPeers:[]},{routeLabels:null},{namespace:null},{platformVersion:null},{releaseId:'../wrong'},{releaseId:'invalid-'}]) expect(()=>render({...config,...change})).toThrow();
 });
});

it('release server redirects root, serves the exact manifest bytes and refuses foreign/missing paths and writes',async()=>{
 const root=mkdtempSync(join(tmpdir(),'policy-release-'));
 mkdirSync(join(root,'assets'));writeFileSync(join(root,'index.html'),'<html>release</html>');writeFileSync(join(root,'assets','runtime.wasm'),'wasm');
 const info={releaseId:'r20261104-test',base:releaseBase('r20261104-test'),engine:'mupdf',resources:resourceManifest(root)};
 writeFileSync(join(root,'build-info.json'),JSON.stringify(info));
 const probe=createServer();await new Promise<void>(r=>probe.listen(0,'127.0.0.1',r));const port=(probe.address() as {port:number}).port;await new Promise<void>(r=>probe.close(()=>r()));
 const child=spawn(process.execPath,[resolve('deploy/server.mjs')],{env:{...process.env,STATIC_ROOT:root,PORT:String(port),HOST:'127.0.0.1'},stdio:'ignore'});
 const origin=`http://127.0.0.1:${port}`;
 try {
   let ready=false;for(let n=0;n<100;n++){try{if((await fetch(origin+'/healthz')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,20));}expect(ready).toBe(true);
   const redirect=await fetch(origin,{redirect:'manual'});expect(redirect.status).toBe(302);expect(redirect.headers.get('location')).toBe(info.base);expect(redirect.headers.get('cache-control')).toBe('no-store');
   const wasm=await fetch(origin+info.base+'assets/runtime.wasm');expect(wasm.headers.get('content-type')).toBe('application/wasm');expect(wasm.headers.get('cache-control')).toContain('immutable');expect(wasm.headers.get('cross-origin-embedder-policy')).toBe('require-corp');
   expect((await fetch(origin+info.base+'build-info.json')).status).toBe(200);
   for(const path of ['/releases/old/','/assets/runtime.wasm',info.base+'missing',info.base+'absent.js']) expect((await fetch(origin+path)).status).toBe(404);
   expect((await fetch(origin+info.base,{method:'HEAD'})).headers.get('content-type')).toContain('text/html');
   expect((await fetch(origin+info.base,{method:'POST',body:'private pdf'})).status).toBe(405);
 } finally {const stopped=new Promise(r=>child.once('exit',r));child.kill();await stopped;rmSync(root,{recursive:true,force:true});}
});

it('corrupted release never becomes healthy',async()=>{
 const root=mkdtempSync(join(tmpdir(),'policy-integrity-'));writeFileSync(join(root,'index.html'),'original');
 writeFileSync(join(root,'build-info.json'),JSON.stringify({engine:'mupdf',base:'/',resources:resourceManifest(root)}));writeFileSync(join(root,'index.html'),'modified');
 const child=spawn(process.execPath,[resolve('deploy/server.mjs')],{env:{...process.env,STATIC_ROOT:root,PORT:'0'},stdio:'ignore'});
 try {expect(await new Promise(r=>child.once('exit',r))).not.toBe(0);}finally{rmSync(root,{recursive:true,force:true});}
});
