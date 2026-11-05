import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { platformFields, validatePlatformConfig } from '../scripts/check-platform.ts';
import { render } from '../scripts/render-openshift.ts';

const config = {
  namespace: 'policy-test', architecture: 'amd64', host: 'policy.apps.example.test', replicas: 1,
  routeLabels: { 'example.test/visibility': 'internal' },
  ingressPeers: [{ namespaceSelector: { matchLabels: { 'kubernetes.io/metadata.name': 'openshift-ingress' } },
    podSelector: { matchLabels: { 'example.test/router': 'internal' } } }],
  platformVersion: '4.20.1', internalIngressController: 'internal', contact: '工具维护组 support@example.test',
  registryServer: 'registry.example.test:5000', imageRepository: 'registry.example.test:5000/team/policy-compare',
  baseImage: 'node:24.22.1-alpine@sha256:' + 'a'.repeat(64),
};

describe('platform configuration before image build', () => {
  it('covers every template field, accepts both architectures and preserves exact approved selectors', () => {
    const template = JSON.parse(readFileSync('deploy/openshift/operator-settings.example.json', 'utf8'));
    expect(Object.keys(template).sort()).toEqual([...platformFields].sort());
    for (const architecture of ['amd64', 'arm64']) {
      const c = structuredClone({ ...config, architecture });
      expect(validatePlatformConfig(c, { architecture })).toEqual(c);
      const result = render({ ...c, releaseId: 'r20261106-config', image: c.imageRepository + '@sha256:' + 'b'.repeat(64) }) as any;
      expect(result.items[0].spec.replicas).toBe(c.replicas);
      expect(result.items[0].spec.template.spec.nodeSelector['kubernetes.io/arch']).toBe(architecture);
      expect(result.items[2].metadata.labels).toEqual(c.routeLabels);
      expect(result.items[3].spec.ingress[0].from).toEqual(c.ingressPeers);
    }
  });
  it('refuses omitted replicas and unresolved platform placeholders before any Docker operation', () => {
    const { replicas: _, ...missing } = config;
    expect(() => validatePlatformConfig(missing)).toThrow('replicas');
    const template = JSON.parse(readFileSync('deploy/openshift/operator-settings.example.json', 'utf8'));
    expect(() => validatePlatformConfig(template)).toThrow('占位');
  });
  it.each([
    ['replicas', '1'], ['replicas', 0], ['replicas', 21], ['replicas', 1.5],
    ['host', '127.0.0.1'], ['host', 'https://policy.apps.example.test'], ['host', 'policy.apps.example.test:443'],
    ['routeLabels', ['internal']], ['routeLabels', {}], ['ingressPeers', [{}]],
    ['ingressPeers', [{ namespaceSelector: {} }]], ['ingressPeers', [{ service: 'router' }]],
    ['ingressPeers', [{ ipBlock: { cidr: '0.0.0.0/0' } }]],
    ['ingressPeers', [{ ipBlock: { cidr: '10.0.0.0/16' }, podSelector: { matchLabels: { app: 'router' } } }]],
    ['platformVersion', ''], ['internalIngressController', 'https://internal'], ['contact', ''],
    ['registryServer', 'https://registry.example.test'], ['registryServer', 'registry.example.test/team'],
    ['imageRepository', 'other.example.test/team/policy'], ['imageRepository', config.imageRepository + ':latest'],
    ['baseImage', 'node:24'], ['baseImage', 'https://registry.example.test/node@sha256:' + 'a'.repeat(64)],
    ['baseImage', 'node@other@sha256:' + 'a'.repeat(64)],
  ])('refuses malformed %s configuration (%j)', (key, value) => {
    expect(() => validatePlatformConfig({ ...config, [key]: value })).toThrow();
  });
  it('refuses accidentally added generated fields and mismatches with selected platform values', () => {
    expect(() => validatePlatformConfig({ ...config, image: 'policy:latest' })).toThrow('未知配置项');
    for (const key of ['namespace', 'architecture', 'host', 'internalIngressController']) {
      expect(() => validatePlatformConfig(config, { [key]: 'another-value' })).toThrow('不一致');
    }
  });
  it('accepts platform-approved expression selectors and bounded IP peers without rewriting their meaning', () => {
    const ingressPeers = [{ namespaceSelector: { matchExpressions: [{ key: 'purpose', operator: 'In', values: ['router'] }] } },
      { ipBlock: { cidr: '10.10.0.0/16', except: ['10.10.1.0/24'] } }];
    expect(validatePlatformConfig({ ...config, ingressPeers }).ingressPeers).toEqual(ingressPeers);
    expect(() => validatePlatformConfig({ ...config, ingressPeers: [{ podSelector: { matchExpressions: [{ key: 'app', operator: 'In', values: [] }] } }] })).toThrow('values');
  });
  it('runs with Node 24 before dependencies are needed and returns a failure code for a wrong target', () => {
    const directory = mkdtempSync(join(tmpdir(), 'policy-platform-'));
    try {
      const path = join(directory, 'platform.json'); writeFileSync(path, JSON.stringify(config));
      const env = { ...process.env, POLICY_NAMESPACE: config.namespace, POLICY_ARCH: config.architecture,
        POLICY_HOST: config.host, POLICY_INTERNAL_ROUTER: config.internalIngressController };
      const script = resolve('scripts/check-platform.ts');
      expect(execFileSync(process.execPath, [script, path], { env, cwd: directory, encoding: 'utf8' })).toContain('12 项配置');
      const failure = spawnSync(process.execPath, [script, path], { env: { ...env, POLICY_HOST: 'wrong.example.test' }, cwd: directory, encoding: 'utf8' });
      expect(failure.status).toBe(1); expect(failure.stderr).toContain('host 与第 2 步确认值不一致');
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
  it('keeps the complete guide example aligned with all twelve template fields and checks every shell block', () => {
    const guide = readFileSync('docs/deployment.md', 'utf8');
    const blocks = [...guide.matchAll(/```json\n([\s\S]*?)```/g)].flatMap(match => {
      try { return [JSON.parse(match[1])]; } catch { return []; }
    });
    const complete = blocks.find(value => value.namespace && value.baseImage);
    expect(Object.keys(complete).sort()).toEqual([...platformFields].sort());
    expect(() => validatePlatformConfig(complete)).not.toThrow();
    expect(guide).toContain('node scripts/check-platform.ts tmp/openshift/platform.json');
    for (const [, block] of guide.matchAll(/```sh\n([\s\S]*?)```/g)) {
      const result = spawnSync('bash', ['-n'], { input: block, encoding: 'utf8' });
      expect(result.status, result.stderr).toBe(0);
    }
  });
  it('executes the documented release-parameter step and rejects another architecture, version or repository', () => {
    const guide = readFileSync('docs/deployment.md', 'utf8');
    const block = [...guide.matchAll(/```sh\n([\s\S]*?)```/g)].map(match => match[1]).find(value => value.includes('const verified =') && value.includes('c.releaseId ='))!;
    const directory = mkdtempSync(join(tmpdir(), 'policy-promotion-'));
    try {
      // The fixture represents expected metadata only; it is not a real image or a platform acceptance result.
      const report = { status: 'PASS', platform: 'linux/amd64', releaseId: 'r20261106-reviewed' };
      const configPath = join(directory, 'tmp/openshift');
      execFileSync('mkdir', ['-p', configPath]);
      writeFileSync(join(configPath, 'platform.json'), JSON.stringify(config));
      const env = { ...process.env, POLICY_REPORT_DIR: directory, POLICY_RELEASE_ID: report.releaseId,
        POLICY_IMAGE_DIGEST: config.imageRepository + '@sha256:' + 'c'.repeat(64) };
      function run(metadata = report, overrides = {}) {
        writeFileSync(join(directory, 'container.json'), JSON.stringify(metadata));
        return spawnSync('bash', ['-c', block], { cwd: directory, env: { ...env, ...overrides }, encoding: 'utf8' });
      }
      expect(run().status).toBe(0);
      const saved = readFileSync(join(directory, 'parameters.json'), 'utf8');
      expect(JSON.parse(saved).image).toBe(env.POLICY_IMAGE_DIGEST);
      for (const metadata of [{ ...report, status: 'FAIL' }, { ...report, platform: 'linux/arm64' }, { ...report, releaseId: 'r20261105-other' }]) {
        expect(run(metadata).status).toBe(1);
        expect(readFileSync(join(directory, 'parameters.json'), 'utf8')).toBe(saved);
      }
      expect(run(report, { POLICY_IMAGE_DIGEST: 'other.test/policy@sha256:' + 'c'.repeat(64) }).status).toBe(1);
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
});
