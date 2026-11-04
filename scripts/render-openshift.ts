import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { releaseBase } from './release-config.ts';
export function render(config: Record<string, any>, entry = false) {
  const c = config;
  const namePattern = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
  if (!namePattern.test(c.namespace || '') || !/^[a-z0-9.-]+$/.test(c.host || '') || !c.host.includes('.')) throw new Error('A concrete namespace and host are required');
  const path = releaseBase(c.releaseId || '');
  if (!/^[a-zA-Z0-9./:_-]+@sha256:[a-f0-9]{64}$/.test(c.image || '')) throw new Error('Use an immutable image digest');
  if (!['arm64','amd64'].includes(c.architecture) || !Number.isInteger(c.replicas) || c.replicas < 1 || c.replicas > 20) throw new Error('Explicit architecture and 1–20 replicas required');
  if (!c.routeLabels || !Object.keys(c.routeLabels).length || !Array.isArray(c.ingressPeers) || !c.ingressPeers.length || c.ingressPeers.some((p:any)=>!p || !Object.keys(p).length)) throw new Error('Platform-reviewed Route labels and NetworkPolicy ingress peers are required');
  if (!c.platformVersion || !c.internalIngressController) throw new Error('Record actual OpenShift version and internal ingress controller');
  const name = `policy-${c.releaseId}`;
  const labels = {app:'policy-compare',release:c.releaseId};
  const metadata = (name:string, labels?:Record<string,string>)=>({name,namespace:c.namespace,...(labels?{labels}:{})});
  const route = (root:boolean)=>({apiVersion:'route.openshift.io/v1',kind:'Route',metadata:metadata(root?'policy-entry':name,c.routeLabels),spec:{host:c.host,path:root?'/':path,to:{kind:'Service',name},port:{targetPort:'http'},tls:{termination:'edge',insecureEdgeTerminationPolicy:'Redirect'}}});
  if (entry) return route(true);
  const deployment = JSON.parse(readFileSync(new URL('../deploy/openshift/base/deployment.json',import.meta.url),'utf8'));
  deployment.metadata = metadata(name,labels);
  deployment.spec.replicas = c.replicas;
  deployment.spec.selector.matchLabels = labels;
  deployment.spec.template.metadata.labels = labels;
  deployment.spec.template.spec.nodeSelector = {'kubernetes.io/arch':c.architecture};
  deployment.spec.template.spec.containers[0].image = c.image;
  return {apiVersion:'v1',kind:'List',items:[deployment,
    {apiVersion:'v1',kind:'Service',metadata:metadata(name,labels),spec:{selector:labels,ports:[{name:'http',port:8080,targetPort:'http'}]}},
    route(false),
    {apiVersion:'networking.k8s.io/v1',kind:'NetworkPolicy',metadata:metadata(name,labels),spec:{podSelector:{matchLabels:labels},policyTypes:['Ingress','Egress'],ingress:[{from:c.ingressPeers,ports:[{protocol:'TCP',port:8080}]}],egress:[]}}
  ]};
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.argv[2]) throw new Error('Usage: pnpm deploy:render parameters.json [--entry]');
  console.log(JSON.stringify(render(JSON.parse(readFileSync(process.argv[2],'utf8')),process.argv.includes('--entry')),null,2));
}
