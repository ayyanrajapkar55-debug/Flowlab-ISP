'use strict';
/* Deterministic slotted packet queue simulation. 1ms tick. Each workload produces traffic stochastically.
   Capacity is modeled through serialization time. "TCP" is a fluid AIMD source control approximation,
   not a full socket / ACK or congestion window implementation. */
window.FlowSimulator = (()=>{
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 const rngFor=(seed)=>{let s=(seed>>>0)||1;return ()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return (s>>>0)/4294967296;};};
 function simulate(cfg,flows){
  const rand=rngFor(cfg.seed),dur=Math.round(cfg.duration),tickMs=5,T=Math.ceil(dur*1000/tickMs),maxQueue=cfg.buffer;
  const stats=flows.map(f=>({name:f.name,sent:0,delivered:0,lost:0,delays:[],bytes:0}));
  const q=[],throughput=Array(dur).fill(0),queue=Array(dur).fill(0),queueMax=Array(dur).fill(0),queueSamples=Array(dur).fill(0),events=[];
  const nextReady=flows.map(()=>0),aimd=flows.map(()=>1),seq=flows.map(()=>0),serviceRate=cfg.capacity*1e6/8/1000;
  let linkFree=0,totalPackets=0;
  const log=(t,s)=>{if(events.length<100)events.push({t:Math.round(t),msg:s});};
  function drop(p,t,reason){stats[p.fi].lost++;if(events.length<100)log(t,`${p.name}: ${reason}`);}
  for(let ti=0;ti<T;ti++){
   const now=ti*tickMs,sec=Math.min(dur-1,Math.floor(now/1000));
   for(let fi=0;fi<flows.length;fi++){
    const f=flows[fi],targetPps=clamp(f.users*f.pps,0,50000),isBulk=f.name.toLowerCase().includes('file')||f.name.toLowerCase().includes('download');
    const factor=(cfg.control==='tcp'&&isBulk)?aimd[fi]:1;
    const avg=targetPps*factor*tickMs/1000;
    let arrivals=Math.floor(avg),frac=avg-arrivals;if(rand()<frac)arrivals++;
    for(let k=0;k<arrivals;k++){
     if(++totalPackets>350000)throw Error('Traffic too high for browser demonstration. Reduce users, rate or duration.');
     const p={fi,name:f.name,size:f.size,priority:f.priority,arrival:now,id:++seq[fi]};stats[fi].sent++;
     let rejected=q.length>=maxQueue;
     if(!rejected&&cfg.discipline==='red'&&q.length>maxQueue*.45){let prob=clamp((q.length/maxQueue-.45)*.85,0,.55);if(rand()<prob)rejected=true;}
     if(rejected){drop(p,now,'router queue overflow / early drop');if(cfg.control==='tcp'&&isBulk)aimd[fi]=Math.max(.08,aimd[fi]*.65);continue;}
     q.push(p);
    }
   }
   // Advance to next service completion, permit multiple packets per tick on high capacity links.
   let limit=0;
   while(q.length&&linkFree<=now+tickMs&&limit++<1500){
    let index=0;
    if(cfg.discipline==='priority'){
     for(let j=1;j<q.length;j++)if(q[j].priority<q[index].priority)index=j;
    }
    const [p]=q.splice(index,1),finish=Math.max(linkFree,now)+Math.max(.001,p.size/serviceRate);
    linkFree=finish;
    if(rand()<cfg.wireless/100){drop(p,finish,'radio link random loss');continue;}
    const delay=finish-p.arrival+cfg.latency;
    const st=stats[p.fi];st.delivered++;st.bytes+=p.size;st.delays.push(delay);throughput[Math.min(dur-1,Math.floor(finish/1000))]+=p.size;
   }
   queue[sec]+=q.length;queueMax[sec]=Math.max(queueMax[sec],q.length);queueSamples[sec]++;
   if(ti%Math.max(1,Math.round(1000/tickMs))===0){
    for(let fi=0;fi<flows.length;fi++){
     if(cfg.control==='tcp'&&/file|download/i.test(flows[fi].name))aimd[fi]=Math.min(1,aimd[fi]+.07);
    }
   }
  }
  // Packets remaining in a queue after the observation window were not delivered.
  for(const p of q)drop(p,dur*1000,'unfinished by observation deadline');
  const percentile=(a,p)=>{if(!a.length)return 0;const s=[...a].sort((x,y)=>x-y);return s[Math.floor((s.length-1)*p)];};
  const rows=stats.map((s,i)=>({...s,mean:s.delays.reduce((a,b)=>a+b,0)/Math.max(1,s.delays.length),p95:percentile(s.delays,.95),mbps:s.bytes*8/dur/1e6,lossPct:s.sent?100*s.lost/s.sent:0}));
  const sent=rows.reduce((a,r)=>a+r.sent,0),delivered=rows.reduce((a,r)=>a+r.delivered,0),lost=rows.reduce((a,r)=>a+r.lost,0);
  const allDelays=stats.flatMap(s=>s.delays);
  return {rows,overall:{sent,delivered,lost,delivery:sent?100*delivered/sent:0,util:100*rows.reduce((a,r)=>a+r.mbps,0)/cfg.capacity,p95:percentile(allDelays,.95)},throughput:throughput.map(b=>b*8/1e6),queue:queue.map((n,i)=>n/Math.max(1,queueSamples[i])),queueMax,events,config:cfg};
 }
 return {simulate};
})();
