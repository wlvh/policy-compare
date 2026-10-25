#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const args=process.argv.slice(2).filter(x=>x!=='--');
if(args.includes('--help')){console.log('pnpm compare -- --left a.pdf --right b.pdf --out result.json\nExit: complete 0, partial 2, failed 3, cancelled 130. Passwords: POLICY_LEFT_PASSWORD / POLICY_RIGHT_PASSWORD environment variables (never logged).');process.exit(0);}
const child=spawn(process.execPath,['--import','tsx',fileURLToPath(new URL('./run.ts',import.meta.url)),...args],{stdio:'inherit'});
process.on('SIGINT',()=>{child.kill('SIGKILL');console.error('cancelled：已终止 PDF 与比较进程');process.exit(130);});
child.on('exit',(code)=>{process.exitCode=code??3;});
child.on('error',()=>{console.error('failed：无法启动本地比较进程');process.exitCode=3;});
