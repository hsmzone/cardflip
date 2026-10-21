const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const R=require('./battle-engine.js'),ctx={window:{}};vm.runInNewContext(fs.readFileSync('battle-data.js','utf8'),ctx);
const monsters=ctx.window.BATTLE_MONSTERS,heroes=ctx.window.BATTLE_CHARACTERS;
assert.equal(monsters.length,54);assert.equal(monsters.filter(c=>c.tier==='normal').length,41);assert.equal(monsters.filter(c=>c.tier==='midboss').length,10);assert.equal(monsters.filter(c=>c.tier==='boss').length,3);
assert.equal(new Set(monsters.map(c=>c.id)).size,54);
for(const c of monsters){assert(fs.existsSync(c.file));assert.equal(c.name,c.file.split('/').pop().replace(/\.[^.]+$/,''));assert.equal(c.solo,c.tier!=='normal');}
for(let sample=0;sample<100;sample++){
 const plan=R.createCampaign(monsters);assert.equal(plan.length,12);
 for(const [i,stage]of plan.entries()){assert.equal(stage.stage,i+1);assert(stage.enemies.length>=1&&stage.enemies.length<=4);assert.equal(stage.enemies.some(c=>c.solo),i===7||i===11);R.createBattle(heroes.slice(0,4),stage.enemies);}
 let threat=0;for(const stage of plan){const next=stage.enemies.reduce((sum,c)=>sum+c.hp+R.expected(c.attack)*3+R.expected(c.defense)*2,0);assert(next>threat);threat=next;}
 assert.equal(plan[7].enemies.length,1);assert.equal(plan[7].enemies[0].tier,'midboss');assert.equal(plan[11].enemies.length,1);assert.equal(plan[11].enemies[0].tier,'boss');
}
for(const boss of monsters.filter(c=>c.solo)){assert.throws(()=>R.createBattle([heroes[0]],[boss,monsters[0]]),/단독/);assert.throws(()=>R.createBattle([boss,heroes[0]],[monsters[0]]),/단독/);R.createBattle(heroes.slice(0,4),[boss]);}
const copy=JSON.stringify(monsters);R.createCampaign(monsters);assert.equal(JSON.stringify(monsters),copy);
console.log('PASS: 54 image-backed monsters, 41/10/3 tiers, solo boss rules, 100 twelve-stage campaigns, stage 8 midboss and stage 12 boss, immutable source stats.');
