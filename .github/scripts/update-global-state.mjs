import { writeFile } from "node:fs/promises";
const key=process.env.HELIUS_API_KEY;if(!key)throw Error("HELIUS_API_KEY is required");
const program="CLAY4M7BDfzpaTeuizZgyVw16fE7qiQhPywQzSsGLV3z",epics={"Zombie Ghost Gang":171,"Dactyl Flight Squadron":101,"Captain Flea and the Cursed Hat":147},url=`https://mainnet.helius-rpc.com/?api-key=${key}`;
async function rpc(method,params){const r=await fetch(url,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method,params})}),x=await r.json();if(x.error)throw Error(`${method}: ${x.error.message}`);return x.result}
async function pooled(items,fn){const out=[];for(let i=0;i<items.length;i+=10)out.push(...await Promise.all(items.slice(i,i+10).map(fn)));return out}
// 250 recent program transactions is intentionally bounded for a dependable scheduled job.
const sigs=await rpc("getSignaturesForAddress",[program,{limit:250}]);
const txs=(await pooled(sigs,x=>rpc("getTransaction",[x.signature,{encoding:"jsonParsed",maxSupportedTransactionVersion:0}]))).filter(Boolean);
const reveals=txs.filter(t=>t.meta?.logMessages?.some(x=>x.includes("Instruction: Reveal")));
const assets=reveals.map(t=>t.transaction.message.accountKeys[2]?.pubkey).filter(Boolean),names=new Map();
for(let i=0;i<assets.length;i+=100){const a=await rpc("getMultipleAccounts",[assets.slice(i,i+100),{encoding:"base64"}]);a.value.forEach((x,j)=>names.set(assets[i+j],Buffer.from(x?.data?.[0]||"","base64").toString("utf8")))}
let count=0,last=null;for(const t of reveals){const text=names.get(t.transaction.message.accountKeys[2]?.pubkey)||"",name=Object.keys(epics).find(x=>text.includes(x));if(name){last={name,time:t.blockTime,signature:t.transaction.signatures[0]};break}count++}
if(!last)throw Error("No Epic found in the latest 250 program transactions; increase the scan window.");
const base=Object.values(epics).reduce((s,d)=>s+1/d,0),m=count+1;
await writeFile("public/global-state.json",JSON.stringify({updatedAt:new Date().toISOString(),lastEpic:last,packsSinceLastEpic:count,nextEpicProbability:Math.min(1,base*m),individual:Object.fromEntries(Object.entries(epics).map(([n,d])=>[n,Math.min(1,m/d)]))},null,2)+"\n");
