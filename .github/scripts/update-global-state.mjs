import { readFile, writeFile } from "node:fs/promises";
const key=process.env.HELIUS_API_KEY;if(!key)throw Error("HELIUS_API_KEY is required");
const program="CLAY4M7BDfzpaTeuizZgyVw16fE7qiQhPywQzSsGLV3z",epics={"Zombie Ghost Gang":171,"Dactyl Flight Squadron":101,"Captain Flea and the Cursed Hat":147},url=`https://mainnet.helius-rpc.com/?api-key=${key}`,sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function rpc(method,params){for(let n=0;n<6;n++){const r=await fetch(url,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method,params})}),x=await r.json();if(!x.error)return x.result;if(!/rate limit/i.test(x.error.message))throw Error(`${method}: ${x.error.message}`);await sleep(1000*(n+1))}throw Error(`${method}: rate limited after retries`)}
const prior=JSON.parse(await readFile("public/global-state.json","utf8"));
const recent=await rpc("getSignaturesForAddress",[program,{limit:150}]);
// Deliberately overlap recent history and compare the cursor locally. Some RPC
// providers handle `until` inconsistently for very active program addresses.
const cursorIndex=prior.lastCheckedSignature?recent.findIndex(x=>x.signature===prior.lastCheckedSignature):-1;
const signatures=prior.lastCheckedSignature&&cursorIndex>=0?recent.slice(0,cursorIndex):recent;
if(!signatures.length){console.log("No new program transactions");process.exit(0)}
async function transaction(signature){const t=await rpc("getTransaction",[signature,{encoding:"jsonParsed",maxSupportedTransactionVersion:0}]);await sleep(140);return t}
// Initialisation searches newest-to-oldest for the nearest Epic. Later updates
// process oldest-to-newest so every new reveal advances or resets the counter.
const initial=!prior.lastCheckedSignature,ordered=initial?signatures:[...signatures].reverse();
let state={...prior,lastCheckedSignature:signatures[0].signature};
let revealCount=0;
for(const entry of ordered){const t=await transaction(entry.signature);if(!t?.meta?.logMessages?.some(x=>x.includes("Instruction: Reveal")))continue;const asset=t.transaction.message.accountKeys[2]?.pubkey,a=(await rpc("getAccountInfo",[asset,{encoding:"base64"}]))?.value?.data?.[0]||"",text=Buffer.from(a,"base64").toString("utf8"),name=Object.keys(epics).find(x=>text.includes(x));if(name){state.lastEpic={name,time:t.blockTime,signature:entry.signature};state.packsSinceLastEpic=0;if(initial)break}else if(initial){revealCount++}else state.packsSinceLastEpic=(state.packsSinceLastEpic||0)+1;}
if(initial){if(!state.lastEpic)throw Error("No Epic found in the initial 150 program transactions");state.packsSinceLastEpic=revealCount}
const baseProbability=Object.values(epics).reduce((s,d)=>s+1/d,0),multiplier=(state.packsSinceLastEpic||0)+1;
// Linear odds growth: odds, not probability, scale with the global drought.
const baseOdds=baseProbability/(1-baseProbability),nextEpicProbability=(multiplier*baseOdds)/(1+multiplier*baseOdds);
const individual=Object.fromEntries(Object.entries(epics).map(([name,denominator])=>[name,nextEpicProbability*((1/denominator)/baseProbability)]));
state={...state,updatedAt:new Date().toISOString(),nextEpicProbability,individual};
await writeFile("public/global-state.json",JSON.stringify(state,null,2)+"\n");
