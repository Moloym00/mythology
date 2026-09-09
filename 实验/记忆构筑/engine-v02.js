/* 独立记忆构筑实验 M0.2，不读写线上V1.2。 */
const MemoryGame = (() => {
  const E = ['骨','风','潮','炎','星'];
  const GODS = [
    {name:'毛伊', elements:['骨','潮','风'], image:'god01.webp', effect:'将自己一枚供奉移到另一尊神的同语素空槽。'},
    {name:'贝雅薇', elements:['炎','星','风'], image:'god03.webp', effect:'为一尊在场神移除一点风化。'},
    {name:'火姥神', elements:['骨','炎','星'], image:'god05.webp', effect:'取回自己弃牌中的一张记忆，不能取本次发动的专属记忆。'},
    {name:'雨神', elements:['潮','风','星'], image:'god10.webp', effect:'令一尊零或一点风化的神增加一点风化，然后想起一张。'},
  ];
  const STORMS = [[2],[0,3],[1,2],[0,3],[1,2],[0,1,2,3]];
  function random(g) { g.rng = (Math.imul(1664525,g.rng)+1013904223)>>>0; return g.rng/4294967296; }
  function shuffle(g,a) { for(let i=a.length-1;i>0;i--) { const j=Math.floor(random(g)*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
  function event(g,type,who,god,text,extra={}) { g.events.push({seq:g.events.length+1,round:g.round,type,who,god,text,...extra}); }
  function draw(g,i,n) { const p=g.players[i]; let got=0; while(got<n) { if(!p.deck.length) { if(!p.discard.length) break; p.deck=shuffle(g,p.discard.splice(0)); } p.hand.push(p.deck.pop());got++; } return got; }
  function take(p,id) { const k=p.hand.findIndex(c=>c.id===id); if(k<0) throw Error('记忆不在手中'); return p.hand.splice(k,1)[0]; }
  const match=(c,e)=>c.element===e || c.god!==undefined;
  const slot=(g,s,e)=>g.seats[s].offerings.find(o=>o.element===e);
  const placed=(g,p)=>g.seats.flatMap(s=>s.offerings).filter(o=>o.player===p).length;
  const score=p=>p.awake.length*5+p.rested.length*2+p.echo-p.scars;
  function end(g) { g.phase='ended'; g.failed=g.seats.every(s=>s.state==='ruin'); event(g,'end',null,null,g.failed?'四座神座全毁，这一夜无人胜出。':'这一夜已经落定。'); }
  function release(g,s) { for(const o of s.offerings) g.players[o.player].discard.push(o.card); s.offerings=[]; }
  function storm(g) { for(const id of STORMS[g.round-1]) { const s=g.seats[id]; if(s.state!=='active')continue; s.weather++; event(g,'weather',null,id,`${GODS[id].name}的风化升至${s.weather}。`); if(s.weather>=3) { release(g,s);s.state='ruin';event(g,'ruin',null,id,`${GODS[id].name}被世界遗忘，这座神座不再开放。`); } } if(!g.seats.some(s=>s.state==='active'))end(g); }
  function create(seed=1) { const g={version:'M0.2',rng:seed>>>0,round:1,starter:0,turn:0,acted:0,phase:'turn',step:'aux',pending:null,failed:false,events:[],players:[],seats:GODS.map(()=>({state:'active',weather:0,offerings:[]}))};
    for(let i=0;i<3;i++) { const deck=E.flatMap((element,j)=>[0,1].map(n=>({id:`p${i}-${j}-${n}`,element,owner:i})));g.players.push({name:['你','听冬','渡魂'][i],deck:shuffle(g,deck),hand:[],discard:[],forgotten:[],awake:[],rested:[],echo:0,scars:0});draw(g,i,4); }
    storm(g);draw(g,0,1);return g;
  }
  function settle(g,only) { g.seats.forEach((s,id)=> { if(id!==only||s.state!=='active'||s.offerings.length!==3)return; const counts=g.players.map((_,i)=>s.offerings.filter(o=>o.player===i).length);const winner=counts.findIndex(n=>n>=2);if(winner>=0){const p=g.players[winner];p.awake.push(id);p.hand.push({id:`god-${id}`,god:id,element:'真名',owner:winner});event(g,'awake',winner,id,`${p.name}唤醒${GODS[id].name}，祂的记忆来到手中。`);}else {event(g,'communal',null,id,`${GODS[id].name}众声觉醒，三人各自记住祂。`);g.players.forEach((p,i)=>p.hand.push({id:`god-${id}-p${i}`,god:id,element:'真名',owner:i}));}counts.forEach((n,i)=>{if(i!==winner)g.players[i].echo+=n;});release(g,s);s.state='awake'; }); }
  function finishTurn(g) { g.acted++;if(g.acted===3){if(g.round===6||!g.seats.some(s=>s.state==='active')){end(g);return;}g.round++;g.starter=(g.starter+1)%3;g.turn=g.starter;g.acted=0;storm(g);if(g.phase==='ended')return;}else g.turn=(g.turn+1)%3;g.step='aux';draw(g,g.turn,1); }
  const actor=g=>g.pending?g.pending.defender:g.turn;
  function legal(g,who=actor(g)) { if(g.phase==='ended'||who!==actor(g))return [];const p=g.players[who],out=[];const add=(a,label)=>out.push({...a,label,id:String(out.length)});
    if(g.pending){const q=g.pending;add({type:'yield'},'让出位置 · 原记忆入弃牌，获得1余音');p.hand.filter(c=>match(c,q.element)).forEach(c=>add({type:'defend',card:c.id},`弃${cardName(c)}，守住${GODS[q.seat].name}的「${q.element}」`));return out;}
    if(g.step==='cleanup'){if(p.hand.length>5)p.hand.forEach(c=>add({type:'trim',card:c.id},`暂时放下${cardName(c)}`));else add({type:'end'},'交棒守夜');return out;}
    if(g.step==='aux'){
      add({type:'skip'},'保留记忆，进入主行动');
      p.hand.filter(c=>c.god!==undefined).forEach(c=>effects(g,who,c.god).forEach(effect=>add({type:'power',card:c.id,god:c.god,...effect},`回想${GODS[c.god].name} · ${effect.text}`)));
      p.rested.filter(r=>!r.used).forEach(r=>effects(g,who,r.god).forEach(effect=>add({type:'legacy',god:r.god,...effect},`${GODS[r.god].name}的最后馈赠 · ${effect.text}`)));
      const living=p.deck.length+p.hand.length+p.discard.length+placed(g,who);
      if(living>6)p.hand.forEach(c=>{add({type:'burn',card:c.id,effect:'draw'},`永久燃掉${cardName(c)} · 想起2张，伤痕＋1`);g.seats.forEach((s,id)=>{if(s.state==='active'&&s.weather>0)add({type:'burn',card:c.id,effect:'cool',seat:id},`永久燃掉${cardName(c)} · 为${GODS[id].name}抵挡1风化，伤痕＋1`);});});return out;
    }
    add({type:'recall'},'寻忆 · 想起2张');add({type:'watch'},'守望 · 保留手中的记忆');
    g.seats.forEach((s,id)=>{if(s.state!=='active')return;
      if(placed(g,who)<4)for(const element of GODS[id].elements)for(const c of p.hand){if(!match(c,element))continue;const held=slot(g,id,element);if(!held)add({type:'offer',seat:id,element,card:c.id},`向${GODS[id].name}献上${cardName(c)}，记作「${element}」`);else if(held.player!==who)for(const extra of p.hand){if(extra.id!==c.id)add({type:'contest',seat:id,element,card:c.id,extra:extra.id},`改写${GODS[id].name}的「${element}」：献${cardName(c)}，另弃${cardName(extra)}`);}}
      if(s.offerings.length===3&&s.offerings.some(o=>o.player===who))add({type:'awaken',seat:id},`呼唤${GODS[id].name}的真名`);
      if(s.weather===2)for(let a=0;a<p.hand.length;a++)for(let b=a+1;b<p.hand.length;b++){const cards=[p.hand[a],p.hand[b]];if(cards.some(c=>c.element==='骨'))add({type:'rest',seat:id,cards:cards.map(c=>c.id)},`安魂${GODS[id].name} · 弃${cards.map(cardName).join('、')}，得2分与一次遗赠`);}
    });return out;
  }
  function cardName(c){return c.god===undefined?`「${c.element}」`:`「${GODS[c.god].name}的记忆」`;}
  function effects(g,who,god){const out=[],p=g.players[who];g.seats.forEach((s,id)=>{if(s.state!=='active')return;if(god===1&&s.weather>0)out.push({effect:'cool',seat:id,text:`为${GODS[id].name}减1风化`});if(god===3&&s.weather<2)out.push({effect:'rain',seat:id,text:`令${GODS[id].name}加1风化，再想起1张`});if(god===0)s.offerings.filter(o=>o.player===who).forEach(o=>{g.seats.forEach((t,j)=>{if(j!==id&&t.state==='active'&&GODS[j].elements.includes(o.element)&&!slot(g,j,o.element))out.push({effect:'move',from:id,seat:j,offer:o.card.id,text:`把「${o.element}」从${GODS[id].name}移至${GODS[j].name}`});});});});if(god===2)p.discard.forEach(c=>out.push({effect:'retrieve',retrieve:c.id,text:`取回${cardName(c)}`}));return out;}
  function runEffect(g,p,a){if(a.effect==='cool')g.seats[a.seat].weather--;if(a.effect==='rain'){g.seats[a.seat].weather++;draw(g,g.turn,1);}if(a.effect==='retrieve'){const k=p.discard.findIndex(c=>c.id===a.retrieve);if(k<0)throw Error('遗失的记忆');p.hand.push(p.discard.splice(k,1)[0]);}if(a.effect==='move'){const s=g.seats[a.from];const k=s.offerings.findIndex(o=>o.card.id===a.offer);g.seats[a.seat].offerings.push(s.offerings.splice(k,1)[0]);}}
  function act(old,who,id){const a=legal(old,who).find(a=>a.id===String(id));if(!a)throw Error('当前没有这个合法行动');const g=structuredClone(old),p=g.players[who];
    if(g.pending){const q=g.pending,attacker=g.players[q.attacker],s=g.seats[q.seat];if(a.type==='defend'){p.discard.push(take(p,a.card));attacker.discard.push(q.card);event(g,'defend',who,q.seat,`${p.name}付出记忆，守住${GODS[q.seat].name}的「${q.element}」。`,{attacker:q.attacker});}else{const k=s.offerings.findIndex(o=>o.element===q.element);const displaced=s.offerings.splice(k,1)[0];p.discard.push(displaced.card);p.echo++;s.offerings.push({player:q.attacker,card:q.card,element:q.element});event(g,'displace',q.attacker,q.seat,`${attacker.name}改写了${p.name}的供奉；${p.name}留下1余音。`,{defender:who});}g.pending=null;g.step='cleanup';return g;}
    if(a.type==='skip')g.step='main';
    else if(a.type==='end')finishTurn(g);
    else if(a.type==='trim'){p.discard.push(take(p,a.card));}
    else if(a.type==='power'||a.type==='legacy'){if(a.type==='power')p.discard.push(take(p,a.card));else p.rested.find(r=>r.god===a.god).used=true;runEffect(g,p,a);event(g,a.type,who,a.god,`${p.name}${a.type==='power'?'回想起':'用尽了'}${GODS[a.god].name}：${a.text}。`);g.step='main';}
    else if(a.type==='burn'){const c=take(p,a.card);p.forgotten.push(c);p.scars++;if(a.effect==='draw')draw(g,who,2);else g.seats[a.seat].weather--;event(g,'burn',who,a.seat??null,`${p.name}永久失去${cardName(c)}，${a.effect==='draw'?'换来两次回想':`替${GODS[a.seat].name}挡下风化`}。`,{memoryGod:c.god??null,card:c.id});g.step='main';}
    else {g.step='cleanup';if(a.type==='recall'){const n=draw(g,who,2);event(g,'recall',who,null,`${p.name}想起${n}张记忆。`);}if(a.type==='awaken'){event(g,'invoke',who,a.seat,`${p.name}呼唤${GODS[a.seat].name}的真名。`);settle(g,a.seat);}if(a.type==='watch')event(g,'watch',who,null,`${p.name}选择保留手中的记忆。`);if(a.type==='offer'){g.seats[a.seat].offerings.push({player:who,card:take(p,a.card),element:a.element});event(g,'offer',who,a.seat,`${p.name}为${GODS[a.seat].name}留下「${a.element}」。`);}if(a.type==='contest'){p.discard.push(take(p,a.extra));const c=take(p,a.card),defender=slot(g,a.seat,a.element).player;g.pending={attacker:who,defender,seat:a.seat,element:a.element,card:c};event(g,'contest',who,a.seat,`${p.name}要改写${g.players[defender].name}留下的「${a.element}」，等待回应。`);}if(a.type==='rest'){const s=g.seats[a.seat];a.cards.forEach(id=>p.discard.push(take(p,id)));release(g,s);s.state='rest';p.rested.push({god:a.seat,used:false});event(g,'rest',who,a.seat,`${p.name}为${GODS[a.seat].name}安魂，得到2分与最后馈赠。`);}}
    return g;
  }
  function choose(g,who,policy='balanced'){const p=g.players[who];function value(a){const s=g.seats[a.seat];const own=s?.offerings.filter(o=>o.player===who).length??0;switch(a.type){case 'awaken':return policy==='rest'?55:65;case 'defend':return policy==='peaceful'?0:35;case 'yield':return 10;case 'offer':return 25+own*9+(s.offerings.length===2?12:0);case 'rest':return (policy==='rest'?65:25)+(g.round>=5?12:0)-(own>=2?25:0);case 'contest':return policy==='peaceful'?-5:(policy==='contest'?42:18)+own*12+(s.offerings.length===3?10:0);case 'recall':return p.hand.length<3?40:5;case 'watch':return 0;case 'power':return 20;case 'legacy':return g.round>=3?18:5;case 'burn':return a.effect==='cool'&&s.weather===2&&own>=1?18:-10;case 'skip':return 0;case 'trim':return p.hand.find(c=>c.id===a.card).god===undefined?10:0;default:return 1;}}
    return legal(g,who).sort((a,b)=>value(b)-value(a)||Number(a.id)-Number(b.id))[0];}
  function check(g){const all=[];g.players.forEach((p,i)=>{for(const zone of ['hand','deck','discard','forgotten'])for(const c of p[zone]){if(c.owner!==i)throw Error('个人记忆归属改变');all.push(c);}if(placed(g,i)>4)throw Error('印记超额');});g.seats.forEach((s,id)=>{if(new Set(s.offerings.map(o=>o.element)).size!==s.offerings.length)throw Error('槽位重复');for(const o of s.offerings){if(o.card.owner!==o.player||!GODS[id].elements.includes(o.element))throw Error('非法供奉');all.push(o.card);}if(s.state!=='active'&&s.offerings.length)throw Error('退场未返还供奉');});if(g.pending)all.push(g.pending.card);const expected=30+g.players.reduce((n,p)=>n+p.awake.length,0)+g.events.filter(e=>e.type==='communal').length*3;if(all.length!==expected||new Set(all.map(c=>c.id)).size!==expected)throw Error('卡牌不守恒');return true;}
  function epilogue(g){return g.events.filter(e=>['burn','displace','defend','awake','rest','ruin','communal'].includes(e.type)).slice(-6).map(e=>({seq:e.seq,text:e.text}));}
  return {E,GODS,STORMS,create,legal,act,actor,score,choose,check,epilogue,cardName};
})();
if(typeof module!=='undefined')module.exports=MemoryGame;
