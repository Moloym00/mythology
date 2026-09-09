const M=MemoryGame,$=id=>document.getElementById(id),colors=['#e7b66f','#8fc2ca','#c8a1d1'];
let seed=1,g=M.create(seed),spectate=false,filter='',selected=null,timer;
const names={awaken:'呼名',skip:'守住记忆',power:'回想神明',legacy:'最后馈赠',burn:'燃忆',recall:'寻忆',watch:'守望',offer:'供奉',contest:'改写',rest:'安魂',trim:'放下',end:'交棒',yield:'让出',defend:'守住'};
function node(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
function apply(id){try{g=M.act(g,M.actor(g),id);M.check(g);selected=null;render();}catch(e){$('hint').textContent='火塘暂歇：'+e.message;clearTimeout(timer);}}
function render(){clearTimeout(timer);const ended=g.phase==='ended',who=M.actor(g),p=g.players[0];
 $('title').textContent=ended?'天将明，名字留下了什么':`第${g.round}更 · ${g.pending?'有人要改写供奉':who===0?'轮到你守夜':g.players[who].name+'正在守夜'}`;
 $('hint').textContent=ended?'火塘已落定，下面记录着这一夜真正发生的事。':g.pending?(who===0?'你的供奉正被争夺。付出一张相应记忆守住它，或带着余音让出。':'等待对方回应。'):'名字凑齐之后，仍待一声呼唤。迟疑之间，风还在吹。';
 $('players').replaceChildren(...g.players.map((p,i)=>{const n=node('div',`${p.name} · ${M.score(p)}分 · 手牌${p.hand.length}`, 'player');n.style.setProperty('--ink',colors[i]);n.title=`唤醒 ${p.awake.length}×5 + 安魂 ${p.rested.length}×2 + 余音 ${p.echo} − 伤痕 ${p.scars}`;return n;}));
 $('gods').replaceChildren(...g.seats.map((s,i)=>{const d=M.GODS[i],n=node('article',undefined,'god '+(s.state==='active'?'':s.state==='awake'?'awake':'retired'));n.style.setProperty('--fade',s.state==='ruin'?1:s.state==='awake'?0:s.weather/3);const img=node('img');img.src='../../online/public/art/'+d.image;img.alt=d.name;const body=node('div',undefined,'body');body.append(node('h2',s.state==='ruin'?'□□□':d.name),node('p',({active:`风化 ${s.weather}/3${s.offerings.length===3?' · 真名齐备，等待呼名':''}`,awake:'名字重新完整',rest:'已送别',ruin:'已被遗忘'})[s.state]));const slots=node('div',undefined,'slots');for(const e of d.elements){const o=s.offerings.find(o=>o.element===e),slot=node('div',e,'slot');slot.append(node('span',o?g.players[o.player].name:s.state==='active'?'空缺':'已归还'));if(o)slot.style.setProperty('--ink',colors[o.player]);slots.append(slot);}body.append(slots,node('p',d.effect));n.append(img,body);return n;}));
 if(!p.hand.some(c=>c.id===selected))selected=null;
 $('hand').replaceChildren(...p.hand.map(c=>{const n=node('button',c.god===undefined?c.element:M.GODS[c.god].name+'的记忆','card'+(c.god===undefined?'':' gift')+(selected===c.id?' lifted':''));n.setAttribute('aria-pressed',String(selected===c.id));n.disabled=ended||who!==0||spectate;n.onclick=()=>{selected=selected===c.id?null:c.id;render();};return n;}));
 $('memory').textContent=`未想起 ${p.deck.length} · 暂时放下 ${p.discard.length} · 真正遗忘 ${p.forgotten.length} ｜ 唤醒 ${p.awake.length}×5 + 安魂 ${p.rested.length}×2 + 余音 ${p.echo} − 伤痕 ${p.scars} = ${M.score(p)}分`;
 $('zones').textContent='暂时放下：'+(p.discard.map(M.cardName).join('、')||'无')+'；真正遗忘：'+(p.forgotten.map(M.cardName).join('、')||'无')+'；遗赠：'+(p.rested.map(r=>M.GODS[r.god].name+(r.used?'（已用尽）':'（尚在）')).join('、')||'无');
 $('actionTitle').textContent=ended?'火已渐息':who!==0?'听火声，等候片刻':g.pending?'守住，还是让出':g.step==='aux'?'你愿付出什么':g.step==='main'?'今夜，你如何回应':'哪些记忆留在心中';
 const actions=ended||who!==0||spectate?[]:M.legal(g),types=[...new Set(actions.map(a=>a.type))];if(!types.includes(filter))filter=types.includes('offer')?'offer':types.includes('skip')?'skip':types[0];
 $('filters').replaceChildren(...types.map(t=>{const b=node('button',names[t],t===filter?'selected':'');b.onclick=()=>{filter=t;render();};return b;}));
 $('selection').replaceChildren();if(selected){const b=node('button','放回手中');b.onclick=()=>{selected=null;render();};$('selection').append(b);}
 const visible=actions.filter(a=>a.type===filter&&(!selected||a.card===selected||a.extra===selected||a.cards?.includes(selected)||!['power','burn','offer','contest','rest','trim','defend'].includes(a.type)));
 $('actions').replaceChildren(...visible.map(a=>{const b=node('button',a.label);b.onclick=()=>{if(a.type==='burn'&&!confirm('这张记忆将永远离开，你留下1点伤痕（−1分）。仍要燃忆吗？'))return;apply(a.id);};return b;}));
 if(actions.length&&!visible.length)$('actions').append(node('p','这段记忆此刻无法这样使用。可以换一个行动，或把它放回手中。'));
 $('events').replaceChildren(...g.events.slice(-12).reverse().map(e=>node('li',`第${e.round}更 · ${e.text}`)));
 $('ending').replaceChildren();if(ended){const best=Math.max(...g.players.map(M.score));$('ending').append(node('p',g.failed?'四座神座俱毁，这一夜无人胜出。':g.players.filter(p=>M.score(p)===best).map(p=>p.name).join('、')+'留下最多余火，共'+best+'分。'));for(const e of M.epilogue(g))$('ending').append(node('div',e.text));}
 $('auto').textContent=spectate?'回到我的席位':'旁观一夜';if(!ended&&(who!==0||spectate))timer=setTimeout(()=>{const a=M.choose(g,M.actor(g));apply(a.id);},spectate?120:650);
}
$('auto').onclick=()=>{spectate=!spectate;render();};$('restart').onclick=()=>{if(!confirm('熄灭当前实验火塘，重新开始？'))return;g=M.create(++seed);filter='';selected=null;spectate=false;render();};render();
