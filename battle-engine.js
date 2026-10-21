(function(root){
'use strict';
function rollStat(stat,random=Math.random){
  if(stat.mode===1)return {total:Math.max(0,stat.fixedValue),dice:[],bonus:0,fixed:true};
  const dice=Array.from({length:stat.diceCount},()=>1+Math.floor(random()*stat.diceType));
  const bonus=stat.bonus||0;
  return {total:Math.max(0,dice.reduce((s,n)=>s+n,0)+bonus),dice,bonus,fixed:false};
}
function formatStat(stat){
  if(stat.mode===1)return String(stat.fixedValue);
  const bonus=stat.bonus||0;
  return `${stat.diceCount}D${stat.diceType}${bonus>0?'+'+bonus:bonus<0?bonus:''}`;
}
function expected(stat){return stat.mode===1?stat.fixedValue:stat.diceCount*(stat.diceType+1)/2+(stat.bonus||0);}
function living(state,side){return state.units.filter(u=>u.side===side&&u.hp>0);}
function outcome(state){
  const allies=living(state,'ally').length,enemies=living(state,'enemy').length;
  return !allies&&!enemies?'draw':!enemies?'win':!allies?'lose':null;
}
function startRound(state,random=Math.random){
  state.round++;
  const units=state.units.filter(u=>u.hp>0);
  for(const unit of units){unit.initiative=rollStat(unit.agility,random);unit.tie=random();unit.acted=false;}
  units.sort((a,b)=>a.initiative.total-b.initiative.total||a.tie-b.tie||a.uid.localeCompare(b.uid));
  state.order=units.map(u=>u.uid);state.cursor=0;
}
function createBattle(allies,enemies,random=Math.random){
  if(allies.length<1||allies.length>4||enemies.length<1||enemies.length>4)throw Error('각 팀은 1~4명이어야 합니다.');
  const units=[...allies.map((c,i)=>({...c,uid:'ally-'+i,side:'ally',maxHP:c.hp,hp:c.hp})),...enemies.map((c,i)=>({...c,uid:'enemy-'+i,side:'enemy',maxHP:c.hp,hp:c.hp}))];
  const state={units,round:0,order:[],cursor:0,finished:null};startRound(state,random);return state;
}
function actor(state){return state.finished?null:state.units.find(u=>u.uid===state.order[state.cursor]&&u.hp>0)||null;}
// One defender roll per action. A combo reuses only the remaining shield.
function resolveDuel(attacker,defender,random=Math.random){
  const defense=rollStat(defender.defense,random);
  let shield=defense.total;
  const difference=defender.initiative.total-attacker.initiative.total;
  const combo=difference>=3;
  const hits=[];
  for(let hit=0;hit<(combo?2:1)&&defender.hp>0;hit++){
    const attack=rollStat(attacker.attack,random),before=shield;
    const blocked=Math.min(shield,attack.total),damage=Math.max(0,attack.total-shield);
    shield=Math.max(0,shield-attack.total);
    defender.hp=Math.max(0,defender.hp-damage);
    hits.push({attack,shieldBefore:before,blocked,damage,shieldAfter:shield,hpAfter:defender.hp});
  }
  return {attacker:attacker.uid,defender:defender.uid,attackerName:attacker.name,defenderName:defender.name,
    attackerInitiative:attacker.initiative.total,defenderInitiative:defender.initiative.total,difference,combo,defense,hits};
}
function attack(state,targetId,random=Math.random){
  const attacker=actor(state),target=state.units.find(u=>u.uid===targetId);
  if(!attacker||!target||target.side===attacker.side||target.hp<=0)throw Error('공격할 수 없는 대상입니다.');
  const result=resolveDuel(attacker,target,random);result.round=state.round;
  attacker.acted=true;
  state.finished=outcome(state);
  if(!state.finished){
    do{state.cursor++;}while(state.cursor<state.order.length&&!state.units.some(u=>u.uid===state.order[state.cursor]&&u.hp>0));
    if(state.cursor>=state.order.length)startRound(state,random);
  }
  return result;
}
const rules={rollStat,formatStat,expected,living,outcome,startRound,createBattle,actor,resolveDuel,attack};
if(typeof module!=='undefined'&&module.exports)module.exports=rules;else root.BattleRules=rules;
})(typeof window==='undefined'?globalThis:window);
