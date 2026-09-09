const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const G=require('./engine.js');
const checks=[];function test(name,fn){fn();checks.push(name);console.log('PASS',name);}
function card(g,p,e){for(const z of ['hand','deck','discard']){const a=g.players[p][z],i=a.findIndex(c=>c.element===e);if(i>=0)return a.splice(i,1)[0];}throw Error('找不到牌');}
function hand(g,p,e){const c=card(g,p,e);g.players[p].hand.push(c);return c;}
function offer(g,p,s,e){const c=card(g,p,e);g.seats[s].offerings.push({player:p,card:c,element:e});return c;}
function fixture(){const g=G.create(9);g.step='main';return g;}
function play(g,p,predicate){const a=G.legal(g,p).find(predicate);assert.ok(a,'需要的行动合法');const n=G.act(g,p,a.id);G.check(n);return n;}
test('每人十张记忆；循环洗牌与供奉均不跨越个人归属',()=>{const g=G.create(1);G.check(g);assert.equal(g.players[0].hand.length,5);assert.equal(g.players[1].hand.length,4);});
test('改写先付两张，防守可拒绝；未完成回应时进攻者不能再行动',()=>{let g=fixture();hand(g,0,'骨');hand(g,0,'风');offer(g,1,0,'骨');hand(g,1,'骨');g=play(g,0,a=>a.type==='contest'&&a.seat===0);assert.equal(G.legal(g,0).length,0);g=play(g,1,a=>a.type==='defend');assert.equal(g.seats[0].offerings[0].player,1);assert.equal(g.step,'cleanup');assert.equal(g.pending,null);});
test('让出位置退回旧牌并补偿1余音，进攻牌真实转入神座',()=>{let g=fixture();hand(g,0,'骨');hand(g,0,'风');const old=offer(g,1,0,'骨');g=play(g,0,a=>a.type==='contest'&&a.seat===0);g=play(g,1,a=>a.type==='yield');assert.equal(g.players[1].echo,1);assert.ok(g.players[1].discard.some(c=>c.id===old.id));assert.equal(g.seats[0].offerings[0].player,0);});
test('真名填满不立即得分；本轮结束多数者获得持续记忆',()=>{let g=fixture();offer(g,0,0,'骨');offer(g,0,0,'潮');hand(g,1,'风');g.turn=1;g=play(g,1,a=>a.type==='offer'&&a.seat===0&&a.element==='风');assert.equal(g.players[0].awake.length,0);g.turn=2;g.acted=2;g.players[2].discard.push(...g.players[2].hand.splice(5));g=play(g,2,a=>a.type==='end');assert.deepEqual(g.players[0].awake,[0]);assert.equal(g.players[0].deck.at(-1).god,0);assert.equal(g.players[1].echo,1);assert.equal(G.score(g.players[0]),5);});
test('三人各一枚则公共觉醒：各1余音，不生成个人神记忆',()=>{let g=fixture();offer(g,0,0,'骨');offer(g,1,0,'潮');offer(g,2,0,'风');g.turn=2;g.acted=2;g.step='cleanup';g=play(g,2,a=>a.type==='end');assert.ok(g.players.every(p=>p.awake.length===0&&p.echo===1));});
test('安魂只支付两张并得2分与遗赠，不额外想起或恢复资源',()=>{let g=fixture();g.seats[2].weather=2;hand(g,0,'骨');hand(g,0,'星');const n=g.players[0].hand.length;g=play(g,0,a=>a.type==='rest'&&a.seat===2);assert.equal(g.players[0].hand.length,n-2);assert.equal(G.score(g.players[0]),2);assert.equal(g.players[0].rested[0].used,false);assert.equal(g.players[0].awake.length,0);});
test('永久燃忆记伤痕且不回洗；六张存续记忆时禁止再燃',()=>{let g=G.create(2);const burned=G.legal(g,0).find(a=>a.type==='burn'&&a.effect==='draw').card;g=play(g,0,a=>a.type==='burn'&&a.card===burned);assert.equal(g.players[0].forgotten[0].id,burned);assert.equal(G.score(g.players[0]),-1);g.step='aux';while(g.players[0].forgotten.length<4){g.players[0].forgotten.push(g.players[0].deck.pop()??g.players[0].hand.pop());g.players[0].scars++;}assert.ok(!G.legal(g,0).some(a=>a.type==='burn'));G.check(g);});
test('遗赠用后不再出现；火姥神取回指定记忆而不多造牌',()=>{let g=fixture();g.seats[2].weather=2;hand(g,0,'骨');hand(g,0,'星');g=play(g,0,a=>a.type==='rest'&&a.seat===2);g.step='aux';const a=G.legal(g,0).find(a=>a.type==='legacy');assert.ok(a);g=G.act(g,0,a.id);G.check(g);assert.ok(g.players[0].hand.some(c=>c.id===a.retrieve));g.step='aux';assert.ok(!G.legal(g,0).some(a=>a.type==='legacy'));assert.equal(G.score(g.players[0]),2);});
test('风暴毁座后归还记忆，不补神；所有座毁共同失败',()=>{let g=fixture();g.round=5;g.step='cleanup';g.turn=2;g.acted=2;g.seats.forEach(s=>s.weather=2);offer(g,0,0,'骨');g=play(g,2,a=>a.type==='end');assert.equal(g.phase,'ended');assert.equal(g.failed,true);assert.ok(g.seats.every(s=>s.state==='ruin'&&s.offerings.length===0));});
test('非法行动不改变原状态；回望只引用真实事件编号',()=>{const g=G.create(8),old=JSON.stringify(g);assert.throws(()=>G.act(g,0,'missing'));assert.equal(JSON.stringify(g),old);const n=play(g,0,a=>a.type==='burn');for(const e of G.epilogue(n))assert.equal(n.events[e.seq-1].text,e.text);});
test('四神回想均能产生指定效果，记忆仍保持归属',()=>{
 for(let god=0;god<4;god++){
  let g=fixture();g.step='aux';g.seats[god].state='awake';g.players[0].awake.push(god);g.players[0].hand.push({id:`god-${god}`,god,element:'真名',owner:0});
  if(god===0)offer(g,0,2,'星');
  if(god===1)g.seats[0].weather=1;
  if(god===2)g.players[0].discard.push(card(g,0,'骨'));
  const a=G.legal(g,0).find(a=>a.type==='power');assert.ok(a);const before=g.players[0].hand.length;g=G.act(g,0,a.id);G.check(g);
  assert.equal(g.step,'main');assert.ok(g.players[0].discard.some(c=>c.id===`god-${god}`));
  if(god===0){assert.ok(g.seats[a.seat].offerings.some(o=>o.card.id===a.offer));assert.equal(g.seats[a.from].offerings.length,0);}
  if(god===1)assert.equal(g.seats[a.seat].weather,0);
  if(god===2)assert.ok(g.players[0].hand.some(c=>c.id===a.retrieve));
  if(god===3){assert.equal(g.seats[a.seat].weather,1);assert.equal(g.players[0].hand.length,before);}
 }
});
const scenarios=[];for(const policies of [['balanced','balanced','balanced'],['rest','balanced','peaceful'],['contest','balanced','peaceful']]){let failures=0,turns=0;const totals={awake:0,rest:0,contest:0,displace:0,defend:0,burn:0};const points=[0,0,0],wins=[0,0,0];for(let seed=1;seed<=100;seed++){let g=G.create(seed),steps=0;while(g.phase!=='ended'&&steps++<500){const who=G.actor(g),a=G.choose(g,who,policies[who]);assert.ok(a);g=G.act(g,who,a.id);G.check(g);}assert.equal(g.phase,'ended');turns+=steps;if(g.failed)failures++;else{const scores=g.players.map(G.score),best=Math.max(...scores);scores.forEach((s,i)=>{points[i]+=s;if(s===best)wins[i]++;});}for(const e of g.events)if(e.type in totals)totals[e.type]++;}scenarios.push({policies,games:100,commonFailures:failures,averageSteps:turns/100,events:totals,totalScoresOnSurvival:points,tiedWinsIncluded:wins});}
const report={version:'M0.1',checks,scenarios,scope:'300局仅检查终止、守恒和固定策略下的事件分布。策略不是等强AI，不能把胜率当平衡结论；尚未证明好玩。'};
fs.writeFileSync(path.join(__dirname,'validation.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
