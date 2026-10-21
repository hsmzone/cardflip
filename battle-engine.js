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
  for(const team of [allies,enemies])if(team.length>1&&team.some(c=>c.solo))throw Error('보스와 중간 보스는 단독으로만 전투합니다.');
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
function createCampaign(monsters,random=Math.random){
  const regular=monsters.filter(c=>c.tier==='normal').sort((a,b)=>expected(a.attack)+expected(a.defense)+a.hp/5-expected(b.attack)-expected(b.defense)-b.hp/5);
  const mids=monsters.filter(c=>c.tier==='midboss'),bosses=monsters.filter(c=>c.tier==='boss');
  if(!regular.length||!mids.length||!bosses.length)throw Error('일반 몬스터, 중간 보스, 보스 이미지가 각각 필요합니다.');
  const counts=[1,1,2,2,2,3,3,1,2,3,4,1];
  const plan=Array.from({length:12},(_,index)=>{
    const stage=index+1;
    if(stage===8||stage===12){const pool=stage===8?mids:bosses;return {stage,kind:stage===8?'중간 보스':'최종 보스',enemies:[{...pool[Math.floor(random()*pool.length)]}]};}
    const progress=stage<=7?(stage-1)/8:.8+(stage-9)*.1;
    const end=Math.max(counts[index],Math.ceil(regular.length*Math.min(1,progress+.25))),start=Math.max(0,end-Math.max(counts[index],6));
    const pool=regular.slice(start,end);
    for(let i=pool.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
    const level=stage<=7?stage-1:stage+1;
    const enemies=pool.slice(0,counts[index]).map(c=>({...c,hp:c.hp+level*4,attack:{...c.attack,bonus:(c.attack.bonus||0)+Math.floor(level/2)},defense:c.defense.mode===1?{...c.defense,fixedValue:c.defense.fixedValue+Math.floor(level/3)}:{...c.defense,bonus:(c.defense.bonus||0)+Math.floor(level/3)}}));
    return {stage,kind:stage>=9?'심층 전투':'던전 전투',enemies};
  });
  // Keep encounter threat increasing, including solo encounters.
  let previous=0;
  for(const stage of plan){
    const threat=stage.enemies.reduce((sum,c)=>sum+c.hp+expected(c.attack)*3+expected(c.defense)*2,0);
    const extra=Math.max(0,Math.ceil(previous*1.1-threat));
    stage.enemies=stage.enemies.map((c,i)=>({...c,hp:c.hp+Math.floor(extra/stage.enemies.length)+(i<extra%stage.enemies.length?1:0)}));
    previous=stage.enemies.reduce((sum,c)=>sum+c.hp+expected(c.attack)*3+expected(c.defense)*2,0);
  }
  return plan;
}
const rules={createCampaign,rollStat,formatStat,expected,living,outcome,startRound,createBattle,actor,resolveDuel,attack};
if(typeof module!=='undefined'&&module.exports)module.exports=rules;else root.BattleRules=rules;
})(typeof window==='undefined'?globalThis:window);
