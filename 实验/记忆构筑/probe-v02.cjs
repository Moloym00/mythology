const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const original=fs.readFileSync(path.join(__dirname,'engine.js'),'utf8');
function candidate(mode){let s=original;
 if(mode==='baseline')return s;
 s=s.replace('p.deck.push({id:`god-${id}`,god:id,element:', 'p.hand.push({id:`god-${id}`,god:id,element:').replace('祂的记忆进入牌堆顶。','祂的记忆来到手中。');
 if(mode==='hand')return s;
 s=s.replace("else event(g,'communal',null,id,`${GODS[id].name}众声觉醒，没有人独得祂的记忆。`);", "else {event(g,'communal',null,id,`${GODS[id].name}众声觉醒，三人各自记住祂。`);g.players.forEach((p,i)=>p.hand.push({id:`god-${id}-p${i}`,god:id,element:'真名',owner:i}));}");
 s=s.replace('const expected=30+g.players.reduce((n,p)=>n+p.awake.length,0);', "const expected=30+g.players.reduce((n,p)=>n+p.awake.length,0)+g.events.filter(e=>e.type==='communal').length*3;");
 if(mode==='shared_hand')return s;
 s=s.replace('function settle(g) {','function settle(g,only) {').replace("if(s.state!=='active'||s.offerings.length!==3)return;", "if(id!==only||s.state!=='active'||s.offerings.length!==3)return;");
 s=s.replace('g.acted===3){settle(g);','g.acted===3){');
 s=s.replace("if(s.weather===2)for(let a=", "if(s.offerings.length===3&&s.offerings.some(o=>o.player===who))add({type:'awaken',seat:id},`呼唤${GODS[id].name}的真名`);\n      if(s.weather===2)for(let a=");
 s=s.replace("if(a.type==='watch')event", "if(a.type==='awaken'){event(g,'invoke',who,a.seat,`${p.name}呼唤${GODS[a.seat].name}的真名。`);settle(g,a.seat);}if(a.type==='watch')event");
 s=s.replace("case 'defend':return", "case 'awaken':return policy==='rest'?55:65;case 'defend':return");
 return s;
}
function simulate(mode){const box={module:{exports:{}},structuredClone};vm.runInNewContext(candidate(mode),box);const M=box.module.exports;
 const r={mode,games:0,rounds:0,awake:0,communal:0,rest:0,ruin:0,power:0,contest:0,memoryOffers:0,failures:0,scores:{}};
 for(let shift=0;shift<3;shift++)for(let seed=1;seed<=100;seed++){let g=M.create(seed),steps=0;const policies=['rest','balanced','peaceful'].map((_,i)=>['rest','balanced','peaceful'][(i+shift)%3]);
 while(g.phase!=='ended'&&steps++<500){const who=M.actor(g),a=M.choose(g,who,policies[who]);if(['offer','contest'].includes(a.type)&&g.players[who].hand.find(c=>c.id===a.card)?.god!==undefined)r.memoryOffers++;g=M.act(g,who,a.id);M.check(g);}
 if(g.phase!=='ended')throw Error('termination');r.games++;r.rounds+=g.round;r.failures+=g.failed;
 for(const e of g.events)if(['awake','communal','rest','ruin','power','contest'].includes(e.type))r[e.type]++;
 g.players.forEach((p,i)=>r.scores[policies[i]]=(r.scores[policies[i]]||0)+M.score(p));
 }return r;
}
if(require.main===module){const results=['baseline','hand','shared_hand','explicit'].map(simulate);fs.writeFileSync(path.join(__dirname,'probe-v02.json'),JSON.stringify({scope:'固定策略，轮换座位，每组300局；新呼名动作赋予固定启发式权重，不能当作平衡或乐趣证明。',results},null,2));console.log(JSON.stringify(results,null,2));}
module.exports={candidate,simulate};
