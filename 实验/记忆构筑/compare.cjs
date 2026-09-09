const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'engine.js'),'utf8');const reports=[];
for(const variant of ['baseline','rest_empty_only']){
 const box={module:{exports:{}},structuredClone};vm.runInNewContext(variant==='baseline'?source:source.replace('if(s.weather===2)for(let a=', 'if(s.weather===2&&s.offerings.length===0)for(let a='),box);const M=box.module.exports;
 const r={variant,games:0,awake:0,communal:0,rest:0,ruin:0,power:0,unusedMemories:0,fullSeatRest:0,commonFailures:0,policies:{}};
 for(let shift=0;shift<3;shift++)for(let seed=1;seed<=100;seed++){
 let g=M.create(seed),n=0;const lineup=['rest','balanced','peaceful'].map((_,i)=>['rest','balanced','peaceful'][(i+shift)%3]);
 while(g.phase!=='ended'&&n++<500){const who=M.actor(g),a=M.choose(g,who,lineup[who]);if(a.type==='rest'&&g.seats[a.seat].offerings.length===3)r.fullSeatRest++;g=M.act(g,who,a.id);M.check(g);}
 if(g.phase!=='ended')throw Error('未终止');r.games++;r.commonFailures+=g.failed;
 for(const e of g.events)if(['awake','communal','rest','ruin','power'].includes(e.type))r[e.type]++;
 for(const e of g.events.filter(e=>e.type==='awake'))if(!g.events.some(l=>l.seq>e.seq&&l.who===e.who&&l.god===e.god&&l.type==='power'))r.unusedMemories++;
 g.players.forEach((p,i)=>{const s=r.policies[lineup[i]]??={score:0,tiedWins:0};s.score+=M.score(p);s.tiedWins+=!g.failed&&M.score(p)===Math.max(...g.players.map(M.score));});
 }reports.push(r);
}
fs.writeFileSync(path.join(__dirname,'comparison.json'),JSON.stringify({scope:'每组300局，策略轮换座位；不是等强AI，不能作为平衡证明。unusedMemories仅指未发动专属能力，可能作为供奉使用。替代安魂限制只存在于内存试算，不修改可玩规则。',reports},null,2));console.log(JSON.stringify(reports,null,2));
