'use strict';
const $=s=>document.querySelector(s),R=BattleRules;
const heroes=window.BATTLE_CHARACTERS,monsters=window.BATTLE_MONSTERS;
const library=[...heroes,...monsters],byId=new Map(library.map(c=>[c.id,c]));
let selections={ally:new Set(),enemy:new Set()},editing='ally',state=null,playing=false,busy=false,chosen=null;
let generation=0,timer=null,waiters=new Map(),actions=0;
let combatPanels=new Map();
function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
function photo(c){const img=el('img');img.src=(c.monster?'':'cha/')+encodeURIComponent(c.file);img.alt=c.name;img.draggable=false;return img;}
function diceImage(type,face){const img=el('img','stat-die');img.src=`dice/${type===4?'T':''}${face}.png`;img.alt=`D${type} ${face}`;img.draggable=false;return img;}
function statVisual(stat,roll=null){
  const n=el('span','dice-stat');n.setAttribute('aria-label',roll?`${R.formatStat(stat)} 결과 ${roll.total}`:R.formatStat(stat));n.title=R.formatStat(stat);
  if(stat.mode===1){n.append(el('b','fixed-stat',String(roll?roll.total:stat.fixedValue)));return n;}
  const faces=roll?roll.dice:Array(stat.diceCount).fill(stat.diceType);
  for(const face of faces)n.append(diceImage(stat.diceType,face));
  const bonus=stat.bonus||0;if(bonus)n.append(el('b','dice-bonus',bonus>0?'+'+bonus:String(bonus)));
  if(roll)n.append(el('b','dice-total','= '+roll.total));return n;
}
function stats(c){return [['민첩',c.agility],['공격',c.attack],['방어',c.defense],['체력',c.hp],['마력',c.mp]];}
function cardArt(c){const art=el('span','battle-card-art'),mask=el('span','battle-card-mask');mask.append(photo(c));const ribbon=el('img','battle-card-ribbon');ribbon.src='name.png';ribbon.alt='';art.append(mask,ribbon,el('strong','battle-card-name',c.name));return art;}
function cancel(){generation++;clearTimeout(timer);waiters.forEach((resolve,id)=>{clearTimeout(id);resolve(false)});waiters.clear();}
function wait(ms){return new Promise(resolve=>{const id=setTimeout(()=>{waiters.delete(id);resolve(true)},ms);waiters.set(id,resolve)});}
function updateSelection(){
  for(const side of ['ally','enemy']){
    $('#'+side+'-count').textContent=`${selections[side].size} / 4`;
    $('#'+side+'-selected').textContent=[...selections[side]].map(id=>byId.get(id).name).join(' · ')||'캐릭터를 선택하세요';
    $('#edit-'+side).classList.toggle('active',editing===side);$('#edit-'+side).setAttribute('aria-pressed',String(editing===side));
  }
  document.querySelectorAll('.roster-card').forEach(n=>{const selected=selections[editing].has(n.dataset.id);n.classList.toggle('selected',selected);n.setAttribute('aria-pressed',String(selected));n.querySelector('.selection-tick').textContent=selected?'✓':'+'});
  $('#begin-battle').disabled=selections.ally.size<1||selections.enemy.size<1;
  $('#setup-feedback').textContent=`${editing==='ally'?'아군':'적군'} 편성 중 · 아군 ${selections.ally.size}명 vs 적군 ${selections.enemy.size}명`;
}
function renderRoster(){
  const filter=$('#party-filter').value;
  const candidates=(editing==='ally'?heroes:library).filter(c=>filter==='all'||c.job===filter);
  $('#roster-count').textContent=`선택 가능 ${candidates.length}명`;
  $('#roster').replaceChildren(...candidates.map(c=>{
    const n=el('button','roster-card job-card');n.type='button';n.dataset.id=c.id;n.setAttribute('aria-label',`${c.name}, ${c.job} ${c.subtype}`);
    const info=el('span','roster-info');info.append(el('strong','',c.name),el('small','job-label',`${c.job} · ${c.subtype}`));
    const values=el('span','unit-stats');for(const [label,value]of stats(c)){const s=el('span');s.append(el('small','',label),typeof value==='object'?statVisual(value):el('b','',String(value)));values.append(s)}info.append(values);
    n.append(el('span','selection-tick'),cardArt(c),info);
    n.addEventListener('click',()=>{
      const set=selections[editing];if(set.has(c.id))set.delete(c.id);else if(set.size<4)set.add(c.id);else{$('#setup-feedback').textContent='팀은 최대 4명입니다. 교체할 캐릭터를 먼저 해제해주세요.';return}
      sound.unlock();sound.play('click');updateSelection();
    });return n;
  }));updateSelection();
}
function defaultTeams(){selections.ally=new Set(['더스','파란','한별','소낙'].filter(id=>byId.has(id)));selections.enemy=new Set(monsters.slice(0,2).map(c=>c.id));updateSelection()}
function edit(side){editing=side;$('#party-filter').value='all';renderRoster()}
function actor(){return state&&R.actor(state)}
function renderOrder(){
  $('#turn-order').replaceChildren(...state.order.map(id=>{
    const unit=state.units.find(u=>u.uid===id),n=el('span','order-chip '+unit.side);
    n.classList.toggle('current',actor()?.uid===id);n.classList.toggle('done',unit.acted||unit.hp<=0);
    n.textContent=`${unit.initiative.total} · ${unit.name}${unit.hp<=0?' †':''}`;return n;
  }));
}
function renderUnits(side){
  const current=actor(),targetable=!busy&&current?.side==='ally'&&chosen===current.uid;
  const units=state.units.filter(u=>u.side===side);
  $('#'+side+'-lineup').classList.toggle('single',units.length===1);
  $('#'+side+'-hp-label').textContent=`생존 ${units.filter(u=>u.hp>0).length} / ${units.length}`;
  $('#'+side+'-lineup').replaceChildren(...units.map(u=>{
    const n=el('button','fighter duel-fighter');n.type='button';n.dataset.uid=u.uid;
    n.classList.toggle('dead',u.hp<=0);n.classList.toggle('acting',current?.uid===u.uid);n.classList.toggle('chosen',chosen===u.uid);n.classList.toggle('targetable',side==='enemy'&&targetable&&u.hp>0);
    n.disabled=u.hp<=0||busy;n.setAttribute('aria-label',`${side==='ally'?'아군':'적군'} ${u.name}, 체력 ${u.hp}/${u.maxHP}`);
    n.setAttribute('aria-pressed',String(chosen===u.uid));
    const initiative=el('span','unit-initiative',u.hp>0?`민첩 ${u.initiative.total}`:'사망');
    const name=el('strong','fighter-name',u.name),label=el('span','fighter-job',`${u.job} · ${u.subtype}`);
    const health=el('span','unit-health'),fill=el('i');fill.style.width=`${u.hp/u.maxHP*100}%`;health.append(fill);
    const hp=el('span','unit-hp',`${u.hp} / ${u.maxHP}`);
    const value=el('span','fighter-stats');value.append(el('small','','⚔'),statVisual(u.attack),el('small','','◇'),statVisual(u.defense));
    const mana=el('span','unit-mana',`마력 ${u.mp} · 스킬 준비중`);
    n.append(initiative,cardArt(u),label,health,hp,value,mana);
    if(combatPanels.has(u.uid))n.append(combatPanels.get(u.uid));
    n.addEventListener('click',()=>{
      if(side==='ally')selectActor(u.uid);
      else if(targetable)perform(u.uid);
      else $('#round-message').textContent='먼저 이번 차례의 아군 캐릭터를 선택하세요.';
    });return n;
  }));
}
function render(){
  renderOrder();renderUnits('ally');renderUnits('enemy');$('#round-label').textContent=`ROUND ${String(state.round).padStart(2,'0')}`;
  const unit=actor();$('#select-actor').disabled=busy||!unit||unit.side!=='ally';
  $('#select-actor').textContent=!unit?'대결 종료':chosen===unit.uid?'공격할 적을 선택하세요':unit.side==='ally'?`${unit.name} 선택`:'적이 행동 중입니다';
  $('#turn-prompt').textContent=unit?`${unit.name}의 차례 · 민첩 ${unit.initiative.total} (낮을수록 선행)`:'대결 종료';
}
function selectActor(id){
  const current=actor();if(!playing||busy||current?.side!=='ally')return;
  if(id!==current.uid){$('#round-message').textContent=`이번에는 민첩 순서상 ${current.name}의 차례입니다.`;return}
  chosen=id;sound.unlock();sound.play('click');$('#phase-label').textContent=`${current.name} → 대상 선택`;
  $('#round-message').textContent='공격할 적 캐릭터를 누르세요. 민첩이 3 이상 낮으면 연속공격!';render();
}
function startBattle(push=true){
  if(!selections.ally.size||!selections.enemy.size)return;
  cancel();combatPanels.clear();sound.unlock();sound.stop();chosen=null;actions=0;busy=false;playing=true;
  state=R.createBattle([...selections.ally].map(id=>byId.get(id)),[...selections.enemy].map(id=>byId.get(id)));
  $('#party-setup').hidden=true;$('#arena').hidden=false;document.body.classList.add('in-battle');
  if(push)history.pushState({battlePlay:true},'');
  $('#log-list').replaceChildren();$('#log-last').textContent='라운드 1 · 전원 민첩 판정 완료';
  nextTurn();$('#back-to-party').focus({preventScroll:true});
}
function nextTurn(){
  if(!playing||state.finished)return;
  chosen=null;render();const unit=actor();
  $('#phase-label').textContent=unit.side==='ally'?'아군 차례':'적군 차례';
  $('#round-message').textContent=unit.side==='ally'?`${unit.name} 캐릭터를 선택한 뒤 공격 대상을 지정하세요.`:`${unit.name} 캐릭터가 공격 대상을 고릅니다.`;
  schedule();
}
function schedule(){
  clearTimeout(timer);const unit=actor();if(!playing||busy||state.finished||!unit)return;
  if(unit.side==='enemy'||$('#auto-battle').checked){timer=setTimeout(()=>{
    const targets=R.living(state,unit.side==='ally'?'enemy':'ally');
    if(targets.length)perform(targets[Math.floor(Math.random()*targets.length)].uid);
  },850)}
}
function addLog(result){
  const lines=result.hits.map((h,i)=>`${i+1}타 공격 ${h.attack.total} − 방어 ${h.shieldBefore} → 피해 ${h.damage}, 남은 방어 ${h.shieldAfter}`).join(' / ');
  const text=`R${result.round} ${result.attackerName}(민첩 ${result.attackerInitiative}) → ${result.defenderName}(민첩 ${result.defenderInitiative}) ${result.combo?'[연속공격] ':''}${lines}`;
  $('#log-list').prepend(el('li','',text));$('#log-last').textContent=text;
}
function unitCard(uid){return [...document.querySelectorAll('.duel-fighter')].find(n=>n.dataset.uid===uid);}
function combatPanel(uid,label){
  let box=combatPanels.get(uid);
  if(!box){box=el('span','card-combat-result');box.setAttribute('role','status');box.append(el('small','combat-role'),el('span','card-result-dice'),el('strong','combat-remaining'),el('span','combat-impact'));combatPanels.set(uid,box);unitCard(uid).append(box);}
  box.classList.toggle('attack-result',label.startsWith('공격'));box.classList.toggle('defense-result',!label.startsWith('공격'));
  box.querySelector('.combat-role').textContent=label;return box;
}
async function showRolls(entries,token){
  const cells=entries.map(([uid,label,stat,roll])=>{const box=combatPanel(uid,label);box.querySelector('.combat-impact').textContent='';box.querySelector('.combat-remaining').textContent='';return {stat,roll,value:box.querySelector('.card-result-dice')};});
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  for(let frame=1;frame<=(reduced?1:30);frame++){
    if(token!==generation)return false;
    for(const {stat,value}of cells){value.replaceChildren();if(stat.mode===1){value.append(statVisual(stat));continue;}
      for(let i=0;i<stat.diceCount;i++){const img=el('img','rolling-die');img.alt='주사위 굴리는 중';img.src=stat.diceType===4?`dice/TDiceMv/TD_01 (${frame}).png`:`dice/DiceMv/${String(frame).padStart(4,'0')}.png`;value.append(img);}}
    if(!await wait(reduced?1:25))return false;
  }
  if(token!==generation)return false;for(const {stat,roll,value}of cells)value.replaceChildren(statVisual(stat,roll));return true;
}
function showHP(uid,hp,maxHP){
  const card=unitCard(uid);card.querySelector('.unit-health i').style.width=`${hp/maxHP*100}%`;
  card.querySelector('.unit-hp').textContent=`${hp} / ${maxHP}`;
  card.setAttribute('aria-label',`${card.closest('.ally-team')?'아군':'적군'} ${state.units.find(u=>u.uid===uid).name}, 체력 ${hp}/${maxHP}`);
  card.classList.toggle('taking-damage',hp>0);card.classList.toggle('dead',hp<=0);
}
async function perform(targetId){
  if(!playing||busy||state.finished)return;
  clearTimeout(timer);busy=true;const token=generation;
  combatPanels.clear();render();
  sound.unlock();sound.play('click');sound.play('flip',.04);
  const attacker=actor(),defender=state.units.find(u=>u.uid===targetId);
  const result=R.attack(state,targetId);actions++;
  $('#phase-label').textContent=result.combo?'연속공격!':'공격 판정';
  for(let i=0;i<result.hits.length;i++){
    const hit=result.hits[i],attackBox=combatPanel(attacker.uid,`공격${result.combo?' · '+(i+1)+'타':''}`),defenseBox=combatPanel(defender.uid,'방어');
    const rolls=[[attacker.uid,`공격${result.combo?' · '+(i+1)+'타':''}`,attacker.attack,hit.attack]];
    if(i===0)rolls.push([defender.uid,'방어',defender.defense,result.defense]);
    else {defenseBox.querySelector('.combat-role').textContent='남은 방어 · 재굴림 없음';defenseBox.querySelector('.card-result-dice').replaceChildren(el('b','dice-total',String(hit.shieldBefore)));defenseBox.querySelector('.combat-impact').textContent='';}
    $('#round-message').textContent=`${result.attackerName} → ${result.defenderName} · ${i+1}타`;
    if(!await showRolls(rolls,token))return;
    if(!await wait(650)||token!==generation)return;
    attackBox.querySelector('.combat-remaining').textContent=`${hit.attack.total} → ${hit.damage}`;
    defenseBox.querySelector('.combat-remaining').textContent=`${hit.shieldBefore} → ${hit.shieldAfter}`;
    defenseBox.querySelector('.combat-impact').textContent=`${hit.blocked} 상쇄`;
    defenseBox.classList.add('blocking');
    if(!await wait(650)||token!==generation)return;
    defenseBox.classList.remove('blocking');
    attackBox.querySelector('.combat-remaining').textContent=`${hit.damage} → 0`;
    const impact=defenseBox.querySelector('.combat-impact');
    impact.replaceChildren(el('small','',hit.damage?'체력':'방어'),el('b','',hit.damage?'−'+hit.damage:'성공'));
    showHP(defender.uid,hit.hpAfter,defender.maxHP);
    $('#round-message').textContent=`${result.attackerName} → ${result.defenderName} · 방어 ${hit.blocked} 상쇄, 체력 피해 ${hit.damage}`;
    sound.play(hit.damage>0?'match':'miss');
    if(!await wait(850)||token!==generation)return;
    unitCard(defender.uid).classList.remove('taking-damage');
  }
  addLog(result);busy=false;render();
  if(state.finished){showResult();return}nextTurn();
}
function showResult(){
  const win=state.finished==='win';$('#result-kicker').textContent=win?'VICTORY':state.finished==='draw'?'DRAW':'DEFEAT';
  $('#battle-result-title').textContent=win?'모든 적을 섬멸했어요!':state.finished==='draw'?'무승부입니다.':'아군이 전멸했습니다.';
  $('#battle-result-description').textContent=`${state.round}라운드 · ${actions}번의 공격 · 아군 생존 ${R.living(state,'ally').length}명`;
  $('#battle-result').showModal();sound.play(win?'clear':'miss');
}
function returnToSetup(){
  cancel();sound.stop();playing=false;busy=false;$('#arena').classList.remove('rolling');
  if($('#battle-result').open)$('#battle-result').close();$('#arena').hidden=true;$('#party-setup').hidden=false;
  $('#auto-battle').checked=false;document.body.classList.remove('in-battle');$('#begin-battle').focus({preventScroll:true});
}
function leave(){if(!playing)return;returnToSetup();if(history.state?.battlePlay)history.back()}
$('#edit-ally').addEventListener('click',()=>edit('ally'));$('#edit-enemy').addEventListener('click',()=>edit('enemy'));
$('#default-party').addEventListener('click',defaultTeams);
$('#random-party').addEventListener('click',()=>{
  function choose(pool){const p=[...pool];for(let i=p.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[p[i],p[j]]=[p[j],p[i]]}return new Set(p.slice(0,1+Math.floor(Math.random()*4)).map(c=>c.id))}
  selections.ally=choose(heroes);selections.enemy=choose(library);updateSelection();
});
$('#party-filter').addEventListener('change',renderRoster);
$('#begin-battle').addEventListener('click',()=>startBattle());$('#back-to-party').addEventListener('click',leave);
$('#select-actor').addEventListener('click',()=>selectActor(actor()?.uid));
$('#auto-battle').addEventListener('change',schedule);
$('#continue-battle').addEventListener('click',()=>{$('#battle-result').close();startBattle(false)});
$('#result-party').addEventListener('click',leave);$('#battle-result').addEventListener('cancel',e=>{e.preventDefault();leave()});
$('#battle-sound').checked=sound.enabled;$('#battle-sound').addEventListener('change',e=>sound.setEnabled(e.target.checked));
window.addEventListener('popstate',()=>{if(playing)returnToSetup()});window.addEventListener('keydown',e=>{if(e.key==='Escape'&&playing){e.preventDefault();leave()}});
for(const job of new Set(library.map(c=>c.job))){const option=el('option','',job);option.value=job;$('#party-filter').append(option)}
renderRoster();defaultTeams();
