/** Weighted strictly monotone subset, stable ties, O(n log n). */
export function monotone<T>(items:T[],left:(x:T)=>number,right:(x:T)=>number,weight:(x:T)=>number):T[]{
  const sorted=items.map((item,index)=>({item,index,l:left(item),r:right(item)})).sort((a,b)=>a.l-b.l||a.r-b.r||a.index-b.index);
  const coords=[...new Set(sorted.map(x=>x.r))].sort((a,b)=>a-b),ranks=new Map(coords.map((x,i)=>[x,i+1]));
  const scores=new Float64Array(sorted.length),previous=new Int32Array(sorted.length).fill(-1),tree=new Int32Array(coords.length+1).fill(-1);
  const better=(a:number,b:number)=>a<0?b:b<0?a:scores[a]>=scores[b]?a:b;
  let best=-1;
  for(let i=0;i<sorted.length;){let j=i;while(j<sorted.length&&sorted[j].l===sorted[i].l)j++;
    for(let k=i;k<j;k++){const rank=ranks.get(sorted[k].r)!;let prev=-1;for(let p=rank-1;p>0;p-=p&-p)prev=better(prev,tree[p]);previous[k]=prev;scores[k]=(prev>=0?scores[prev]:0)+Math.max(1,weight(sorted[k].item));best=better(best,k);}
    for(let k=i;k<j;k++)for(let p=ranks.get(sorted[k].r)!;p<tree.length;p+=p&-p)tree[p]=better(tree[p],k);i=j;
  }
  const result:T[]=[];for(let p=best;p>=0;p=previous[p])result.push(sorted[p].item);return result.reverse();
}
/** Joint dynamic program for 1:1, 1:2, 2:1, additions and deletions. */
export function jointAlign<T>(a:T[],b:T[],score:(a:T[],b:T[])=>number|null,canJoin:(a:T,b:T)=>boolean):{a:T[];b:T[];score:number}[]{
  const width=b.length+1,cost=new Float64Array((a.length+1)*width).fill(Infinity),prev=new Int8Array(cost.length);
  cost[0]=0;const choices=[[1,1],[1,2],[2,1],[1,0],[0,1]];
  const values=new Map<number,number>();
  for(let i=0;i<=a.length;i++)for(let j=0;j<=b.length;j++){
    for(let c=0;c<choices.length;c++){const [di,dj]=choices[c];if(i+di>a.length||j+dj>b.length||di===2&&!canJoin(a[i],a[i+1])||dj===2&&!canJoin(b[j],b[j+1]))continue;
      const s=di&&dj?score(a.slice(i,i+di),b.slice(j,j+dj)):null;if(di&&dj&&s===null)continue;
      const next=(i+di)*width+j+dj,value=cost[i*width+j]+(di&&dj?1-s!+0.03*(di+dj-2):1);
      if(value<cost[next]-1e-12){cost[next]=value;prev[next]=c+1;if(s!==null)values.set(next,s);}
    }
  }
  const out:{a:T[];b:T[];score:number}[]=[];let i=a.length,j=b.length;
  while(i||j){const c=prev[i*width+j]-1;if(c<0)break;const [di,dj]=choices[c];if(di&&dj)out.push({a:a.slice(i-di,i),b:b.slice(j-dj,j),score:values.get(i*width+j)!});i-=di;j-=dj;}
  return out.reverse();
}
