import {execFileSync} from 'node:child_process';

// Run this exact reader in the same immutable image and working directory as
// the CLI, or against the host files for a host CLI. Build-cache logs and the
// browser's manifest cannot establish the CLI file's actual contents.
const reader=String.raw`
const fs=require('node:fs'),crypto=require('node:crypto'),path=require('node:path');
const root=process.argv[1]||'.';
const wasmPath=path.resolve(root,'packages/rust-core/generated/core.wasm');
const infoPath=path.resolve(root,'packages/rust-core/generated/core-info.json');
const bytes=fs.readFileSync(wasmPath),info=JSON.parse(fs.readFileSync(infoPath,'utf8'));
const sha256=crypto.createHash('sha256').update(bytes).digest('hex');
if(sha256!==info.sha256)throw new Error('CLI WASM bytes do not match its own core-info.json');
process.stdout.write(JSON.stringify({sha256,declaredSha256:info.sha256,coreVersion:info.coreVersion,bytes:bytes.length,wasmPath,infoPath}));
`;
export type CliCoreArtifact={sha256:string;declaredSha256:string;coreVersion:string;bytes:number;wasmPath:string;infoPath:string};
export function inspectCliCoreArtifact(imageId?:string,root='.') : CliCoreArtifact {
 const output=imageId
  ?execFileSync('docker',['run','--rm','--network','none',imageId,'node','-e',reader,root],{encoding:'utf8',stdio:['ignore','pipe','pipe']})
  :execFileSync(process.execPath,['-e',reader,root],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
 return JSON.parse(output);
}
export function assertSameCoreArtifact(browserCoreSha256:string,cli:CliCoreArtifact){
 if(cli.sha256!==cli.declaredSha256)throw new Error('CLI WASM bytes do not match its own core-info.json');
 if(browserCoreSha256!==cli.sha256)throw new Error(`Browser/CLI WASM hashes differ: browser=${browserCoreSha256}, CLI=${cli.sha256}`);
}
