const {play,smart,lazy}=require('./sim.js');
const N=+process.argv[3]||16, days=+process.argv[2]||1800;
const res=[]; for(let sd=1;sd<=N;sd++){ const r=play(smart,days,sd,true); res.push(r.rows); }
const at=mo=>res.map(r=>(r[mo-1]||{val:0}).val).sort((a,b)=>a-b);
const q=(a,p)=>a[Math.floor((a.length-1)*p)];
for(const mo of [1,2,3,6,12,18,24,36,48,60]) if(mo*30<=days){const a=at(mo); console.log(mo+'mo','min',q(a,0),'p25',q(a,.25),'med',q(a,.5),'p75',q(a,.75),'max',q(a,1));}
console.log('failed (val<0 at end):',res.filter(r=>r[r.length-1].val<0).length,'/',N);
