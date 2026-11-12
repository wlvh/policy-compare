import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
const exec = promisify(execFile);
const engine = process.argv[2];
if (!engine) {
  const variants=[];
  for (const selected of ['pdfjs','mupdf']) {
    try {
      const output=await exec('pnpm',['test:container',selected],{timeout:1_200_000,maxBuffer:16*1024*1024}); console.log(output.stdout);
      variants.push(JSON.parse(readFileSync(`reports/container-${selected}.json`,'utf8')));
    } catch(error) { variants.push({engine:selected,status:'FAIL',error:String(error)}); }
  }
  const report={status:variants.every(x=>x.status==='PASS')?'PASS':variants.some(x=>x.status==='BLOCKED')?'BLOCKED':'FAIL',variants};
  writeFileSync('reports/container.json',JSON.stringify(report,null,2)+'\n');process.exit(report.status==='PASS'?0:1);
}
if (!['pdfjs','mupdf'].includes(engine)) throw new Error('Explicit engine required: pnpm test:container mupdf|pdfjs');
const revision = (await exec('git',['rev-parse','HEAD'])).stdout.trim();
const productChanges = (await exec('git',['status','--porcelain','--','apps','packages','engines','profiles','patches','deploy','scripts','vite.config.ts','package.json','pnpm-lock.yaml','crates','Cargo.toml','Cargo.lock','rust-toolchain.toml','.dockerignore'])).stdout.trim();
if (productChanges) throw new Error('Commit product sources before building a frozen candidate; working tree differs from revision');
const releaseId = process.env.POLICY_RELEASE_ID || `r${new Date().toISOString().slice(0,10).replaceAll('-','')}-${revision.slice(0,7)}`;
const platform = process.env.POLICY_PLATFORM || `linux/${process.arch === 'arm64'?'arm64':'amd64'}`;
const baseImage=process.env.POLICY_NODE_IMAGE || 'node:24.22.1-alpine@sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53';
if (!/@sha256:[a-f0-9]{64}$/.test(baseImage)) throw new Error('Pin POLICY_NODE_IMAGE by digest');
if (!['linux/arm64','linux/amd64'].includes(platform)) throw new Error('Unsupported target platform');
const dir = process.env.POLICY_REPORT_DIR || `reports/local-deploy/${releaseId}-${engine}`;
if (existsSync(`${dir}/container.json`)) throw new Error('Evidence directory already contains an attempt; choose a new release ID and report directory');
mkdirSync(dir,{recursive:true});
let id = '', report:Record<string,unknown> = {engine,revision,releaseId,platform,status:'NOT_EVALUATED'};
try {
  await exec('docker',['info','--format','{{.OSType}}'],{timeout:15_000});
} catch (error) {
  writeFileSync(`${dir}/container.json`,JSON.stringify({...report,status:'BLOCKED',reason:'Docker daemon unavailable',error:String(error)},null,2)+'\n');
  writeFileSync(`reports/container-${engine}.json`,JSON.stringify({status:'BLOCKED',reason:'Docker daemon unavailable',evidence:`${dir}/container.json`},null,2)+'\n');
  process.exit(1);
}
try {
  const image = `policy-compare:${releaseId}-${engine}`;
  const previous = await exec('docker',['image','inspect',image]).catch(()=>null);
  if (previous) throw new Error('Candidate tag already exists; choose a new release ID or verify the existing image without rebuilding it');
  const args = ['build','--platform',platform,'--build-arg',`ENGINE=${engine}`,'--build-arg',`RELEASE_ID=${releaseId}`,'--build-arg',`REVISION=${revision}`,'--build-arg',`CONTACT=${process.env.POLICY_CONTACT || ''}`,'-f','deploy/Dockerfile','-t',image,'.'];
  args.splice(1,0,'--build-arg',`NODE_IMAGE=${baseImage}`);
  console.log(`Building ${image} (${platform}); output in ${dir}/build.log`);
  const build = await exec('docker',args,{timeout:600_000,maxBuffer:16*1024*1024});
  writeFileSync(`${dir}/build.log`,build.stdout+build.stderr);
  const inspected = JSON.parse((await exec('docker',['image','inspect',image])).stdout)[0];
  if (`linux/${inspected.Architecture}` !== platform) throw new Error('Image architecture differs from requested platform');
  id = (await exec('docker',['run','-d','--rm','--read-only','--user','12345:12345','--cap-drop','ALL','--security-opt','no-new-privileges','--memory','256m','--cpus','1','-p','127.0.0.1::8080',image])).stdout.trim();
  const binding = (await exec('docker',['port',id,'8080/tcp'])).stdout.trim();
  const origin = `http://${binding}`;
  let healthy=false;
  for(let n=0;n<60;n++) {try {healthy=(await fetch(origin+'/healthz')).ok;if(healthy)break;}catch{}await new Promise(r=>setTimeout(r,250));}
  if (!healthy) throw new Error('Container did not become ready');
  const response = await fetch(`${origin}/releases/${releaseId}/build-info.json`);
  if (!response.ok) throw new Error('Release metadata unavailable');
  const bytes = Buffer.from(await response.arrayBuffer());
  const manifest = JSON.parse(bytes.toString());
  const manifestSha256 = createHash('sha256').update(bytes).digest('hex');
  writeFileSync(`${dir}/build-info.json`,bytes);
  const running = JSON.parse((await exec('docker',['inspect',id])).stdout)[0];
  report = {...report,imageId:inspected.Id,repoDigests:inspected.RepoDigests,baseImage,architecture:inspected.Architecture,manifestSha256,container:{image:running.Image,readOnly:running.HostConfig.ReadonlyRootfs,user:running.Config.User,memory:running.HostConfig.Memory,nanoCpus:running.HostConfig.NanoCpus,mounts:running.Mounts},origin,scope:'L2-A actual image and browser only; not OpenShift or performance acceptance'};
  if (manifest.revision !== revision || manifest.engine !== engine || running.Image !== inspected.Id || running.Mounts.length) throw new Error('Running artifact does not match expected image or uses mounts');
  console.log(`Browser target: ${origin}${manifest.base}`);
  const browser = await exec('pnpm',['verify:deployment','tests/browser/deployment.spec.ts','tests/browser/lifecycle.spec.ts','tests/browser/review.spec.ts','tests/browser/review-notices.spec.ts','tests/browser/review-flow.spec.ts','tests/browser/review-regressions.spec.ts','tests/browser/scroll.spec.ts','tests/browser/one-sided-navigation.spec.ts','tests/browser/repeat-display.spec.ts'],{timeout:600_000,maxBuffer:16*1024*1024,env:{...process.env,POLICY_BASE_URL:origin+manifest.base,POLICY_ENGINE:engine,POLICY_RELEASE_ID:releaseId,POLICY_MANIFEST_SHA256:manifestSha256,POLICY_REPORT_DIR:dir}});
  writeFileSync(`${dir}/browser.log`,browser.stdout+browser.stderr);
  report.status='PASS';
} catch(error) {
  const failure = error as Error & {stdout?:string;stderr?:string};
  writeFileSync(`${dir}/failure.log`,(failure.stdout || '')+(failure.stderr || '')+failure.message);
  report = {...report,status:'FAIL',reason:failure.message};
} finally {
  if (id) {
    const logs=await exec('docker',['logs',id]);writeFileSync(`${dir}/container.log`,logs.stdout+logs.stderr);
    await exec('docker',['stop',id]);
  }
}
writeFileSync(`${dir}/container.json`,JSON.stringify(report,null,2)+'\n');
writeFileSync(`reports/container-${engine}.json`,JSON.stringify({status:report.status,engine,revision,releaseId,evidence:`${dir}/container.json`},null,2)+'\n');
console.log(JSON.stringify(report,null,2));
process.exitCode=report.status==='PASS'?0:1;
