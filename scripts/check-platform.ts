import { readFileSync } from 'node:fs';
import { isIP } from 'node:net';
import { pathToFileURL } from 'node:url';

export const platformFields = ['namespace', 'architecture', 'host', 'replicas', 'routeLabels', 'ingressPeers',
  'platformVersion', 'internalIngressController', 'contact', 'registryServer', 'imageRepository', 'baseImage'] as const;

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function requireValue(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
const dnsLabel = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const labelPart = /^[A-Za-z0-9](?:[A-Za-z0-9_.-]{0,61}[A-Za-z0-9])?$/;
const repoPart = /^[a-z0-9]+(?:(?:[._]|__|-+)[a-z0-9]+)*$/;
function dnsName(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 253 && value.split('.').every(part => dnsLabel.test(part));
}
function labelKey(value: string) {
  const parts = value.split('/');
  return parts.length <= 2 && labelPart.test(parts.at(-1)!) && (parts.length === 1 || dnsName(parts[0]));
}
function labels(value: unknown, field: string) {
  requireValue(object(value), `${field} 必须是标签键值对象，不能是数组或字符串`);
  for (const [key, item] of Object.entries(value)) {
    requireValue(labelKey(key) && typeof item === 'string' && (item === '' || labelPart.test(item)), `${field} 包含无效标签：${key}`);
  }
  return Object.keys(value).length;
}
function selector(value: unknown, field: string) {
  requireValue(object(value) && Object.keys(value).every(key => ['matchLabels', 'matchExpressions'].includes(key)), `${field} 必须是标签选择器`);
  let restrictions = value.matchLabels === undefined ? 0 : labels(value.matchLabels, `${field}.matchLabels`);
  if (value.matchExpressions !== undefined) {
    requireValue(Array.isArray(value.matchExpressions), `${field}.matchExpressions 必须是数组`);
    for (const expression of value.matchExpressions) {
      requireValue(object(expression) && Object.keys(expression).every(key => ['key', 'operator', 'values'].includes(key)), `${field} 包含无效表达式`);
      requireValue(typeof expression.key === 'string' && labelKey(expression.key), `${field} 表达式缺少有效 key`);
      const operator = expression.operator;
      requireValue(['In', 'NotIn', 'Exists', 'DoesNotExist'].includes(String(operator)), `${field} 表达式 operator 无效`);
      const values = expression.values;
      if (operator === 'In' || operator === 'NotIn') {
        requireValue(Array.isArray(values) && values.length > 0 && values.every(v => typeof v === 'string' && (v === '' || labelPart.test(v))), `${field} 的 In/NotIn 必须提供非空 values 数组`);
      } else {
        requireValue(values === undefined || (Array.isArray(values) && values.length === 0), `${field} 的 Exists/DoesNotExist 不能带 values`);
      }
      restrictions++;
    }
  }
  requireValue(restrictions > 0, `${field} 不能为空；空选择器会选择全部对象，本流程要求明确来源`);
}
function cidr(value: unknown, field: string) {
  requireValue(typeof value === 'string', `${field} 必须是 CIDR 字符串`);
  const [address, prefix, ...extra] = value.split('/');
  const family = isIP(address), bits = Number(prefix);
  requireValue(!extra.length && family && /^\d+$/.test(prefix || '') && bits > 0 && bits <= (family === 4 ? 32 : 128), `${field} 必须是明确的 IPv4/IPv6 网段，不能使用 /0 放行全部来源`);
}
function registry(value: unknown) {
  requireValue(typeof value === 'string', 'registryServer 必须是仓库主机名，可带端口');
  const [host, port, ...extra] = value.split(':');
  requireValue(!extra.length && dnsName(host) && (port === undefined || (/^\d+$/.test(port) && Number(port) > 0 && Number(port) <= 65535)), 'registryServer 只填写主机名[:端口]，不带协议、路径或凭据');
}
function pinnedImage(value: unknown) {
  requireValue(typeof value === 'string' && /@sha256:[a-f0-9]{64}$/.test(value) && value.indexOf('@') === value.lastIndexOf('@'), 'baseImage 必须使用完整镜像引用及 @sha256: 内容摘要');
  const reference = value.slice(0, value.indexOf('@'));
  const tagAt = reference.lastIndexOf(':');
  const hasTag = tagAt > reference.lastIndexOf('/');
  const repository = hasTag ? reference.slice(0, tagAt) : reference;
  if (hasTag) requireValue(/^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$/.test(reference.slice(tagAt + 1)), 'baseImage 标签格式无效');
  const parts = repository.split('/');
  if (parts.length > 1 && (/[.:]/.test(parts[0]) || parts[0] === 'localhost')) registry(parts.shift());
  requireValue(parts.length > 0 && parts.every(part => repoPart.test(part)), 'baseImage 镜像仓库路径格式无效，不填写协议、凭据或空路径');
}

/** Checks configuration shape and declared choices, not approval or live platform behavior. */
export function validatePlatformConfig(input: unknown, selected: Record<string, string | undefined> = {}) {
  requireValue(object(input), 'platform.json 必须是 JSON 对象');
  for (const key of Object.keys(input)) requireValue((platformFields as readonly string[]).includes(key), `未知配置项：${key}；releaseId 和 image 由发布步骤生成`);
  for (const key of platformFields) requireValue(input[key] !== undefined && input[key] !== null, `缺少必填配置：${key}`);
  requireValue(!/REPLACE_|待填/.test(JSON.stringify(input)), '配置包含未替换的占位值');
  requireValue(typeof input.namespace === 'string' && dnsLabel.test(input.namespace) && !/^(openshift|kube)-/.test(input.namespace), 'namespace 必须是实际应用项目名，不能使用系统项目前缀');
  requireValue(input.architecture === 'amd64' || input.architecture === 'arm64', 'architecture 必须是 amd64 或 arm64');
  requireValue(dnsName(input.host) && input.host.includes('.') && !isIP(input.host), 'host 必须是完整域名，不填写协议、端口、路径、IP 或 localhost');
  requireValue(Number.isInteger(input.replicas) && Number(input.replicas) >= 1 && Number(input.replicas) <= 20, 'replicas 必须是 1–20 的整数；首次试用使用 1');
  requireValue(labels(input.routeLabels, 'routeLabels') > 0, 'routeLabels 必须包含平台实际使用的标签');
  requireValue(Array.isArray(input.ingressPeers) && input.ingressPeers.length > 0, 'ingressPeers 必须是非空来源数组');
  input.ingressPeers.forEach((peer, index) => {
    const field = `ingressPeers[${index}]`;
    requireValue(object(peer) && Object.keys(peer).length > 0 && Object.keys(peer).every(key => ['namespaceSelector', 'podSelector', 'ipBlock'].includes(key)), `${field} 包含无效或空来源`);
    if (peer.ipBlock !== undefined) {
      requireValue(Object.keys(peer).length === 1 && object(peer.ipBlock) && Object.keys(peer.ipBlock).every(key => ['cidr', 'except'].includes(key)), `${field}.ipBlock 不能与标签选择器混用`);
      cidr(peer.ipBlock.cidr, `${field}.ipBlock.cidr`);
      if (peer.ipBlock.except !== undefined) {
        requireValue(Array.isArray(peer.ipBlock.except), `${field}.ipBlock.except 必须是数组`);
        peer.ipBlock.except.forEach((item, n) => cidr(item, `${field}.ipBlock.except[${n}]`));
      }
    } else {
      for (const key of ['namespaceSelector', 'podSelector']) if (peer[key] !== undefined) selector(peer[key], `${field}.${key}`);
    }
  });
  for (const key of ['platformVersion', 'contact']) requireValue(typeof input[key] === 'string' && input[key].trim().length > 0 && !/[\r\n\x00]/.test(input[key]), `${key} 必须填写实际的单行文本`);
  requireValue(dnsName(input.internalIngressController), 'internalIngressController 必须填写实际入口控制器名称');
  registry(input.registryServer);
  requireValue(typeof input.imageRepository === 'string' && input.imageRepository.startsWith(input.registryServer + '/'), 'imageRepository 必须位于 registryServer 下');
  requireValue(input.imageRepository.slice(String(input.registryServer).length + 1).split('/').every(part => repoPart.test(part)), 'imageRepository 填写仓库/项目/镜像名，不带标签、摘要或空路径');
  pinnedImage(input.baseImage);
  for (const [key, value] of Object.entries(selected)) {
    requireValue(typeof value === 'string' && value.length > 0, `缺少已确认的 ${key}，请先完成第 2 步对应的环境确认`);
    requireValue(input[key] === value, `${key} 与第 2 步确认值不一致，请核对配置及当前终端环境变量`);
  }
  return input;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    requireValue(process.argv.length === 3, '用法：node scripts/check-platform.ts <platform.json>（Node.js 24，无需先安装 pnpm 依赖）');
    validatePlatformConfig(JSON.parse(readFileSync(process.argv[2], 'utf8')), {
      namespace: process.env.POLICY_NAMESPACE, architecture: process.env.POLICY_ARCH,
      host: process.env.POLICY_HOST, internalIngressController: process.env.POLICY_INTERNAL_ROUTER,
    });
    console.log('12 项配置格式及已选环境一致性检查通过；实际权限、入口接收范围、网络、DNS/证书和仓库访问仍需按后续步骤验证。');
  } catch (error) {
    console.error((error as Error).message);
    process.exitCode = 1;
  }
}
