'use strict';
const $ = selector => document.querySelector(selector);
const R = BattleRules, roster = window.BATTLE_CHARACTERS, monsters = window.BATTLE_MONSTERS;
const encounters = [
  { title: '버섯의 숲', label: '걷는버섯 파티', enemies: [monsters[0], monsters[0]], hp: 18 },
  { title: '고요한 납골당', label: '스켈레톤', enemies: [monsters[1]], hp: 20 },
  { title: '갑옷의 방', label: '움직이는 갑옷', enemies: [monsters[2]], hp: 24 }
];
const maxHP = 80;
let selected = new Set(), party = [], stage = 0, round = 1, allyHP = maxHP, enemyHP = 18;
let playing = false, busy = false, campaignTurns = 0, lastOutcome = null, autoTimer = null;
let generation = 0, pendingWaits = new Map();
function wait(ms) {
  return new Promise(resolve => { const timer = setTimeout(() => { pendingWaits.delete(timer); resolve(true); }, ms); pendingWaits.set(timer, resolve); });
}
function cancelTimers() {
  generation++; clearTimeout(autoTimer);
  pendingWaits.forEach((resolve, timer) => { clearTimeout(timer); resolve(false); }); pendingWaits.clear();
}
function element(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}
function image(character, enemy = false) {
  const img = element('img'); img.src = `${enemy ? '' : 'cha/'}${encodeURIComponent(character.file)}`;
  img.alt = character.name; img.draggable = false; return img;
}
function statLabel(character) { return `⚔ ${R.formatStat(character.attack)}　◇ ${R.formatStat(character.defense)}`; }
function updateSelection() {
  $('#selected-count').textContent = `${selected.size} / 4`; $('#begin-battle').disabled = selected.size !== 4;
  for (const button of document.querySelectorAll('.roster-card')) {
    const checked = selected.has(button.dataset.id);
    button.classList.toggle('selected', checked); button.setAttribute('aria-pressed', String(checked));
    button.querySelector('.selection-tick').textContent = checked ? '✓' : '+';
  }
  $('#setup-feedback').textContent = selected.size === 4 ? '파티가 준비됐습니다. 던전에 입장하세요.' : `모험가 ${4 - selected.size}명을 더 선택해주세요.`;
}
function renderRoster() {
  const filter = $('#party-filter').value, visible = roster.filter(c => filter === 'all' || c.party === filter);
  $('#roster-count').textContent = `모험가 ${visible.length}명`;
  $('#roster').replaceChildren(...visible.map(character => {
    const card = element('button', 'roster-card'); card.type = 'button'; card.dataset.id = character.id;
    card.setAttribute('aria-label', `${character.name}, 공격 ${R.formatStat(character.attack)}, 방어 ${R.formatStat(character.defense)}`);
    card.append(element('span', 'selection-tick'), image(character), element('strong', 'roster-name', character.name), element('span', 'roster-stats', statLabel(character)));
    card.addEventListener('click', () => {
      if (selected.has(character.id)) selected.delete(character.id);
      else if (selected.size < 4) selected.add(character.id);
      else { $('#setup-feedback').textContent = '이미 네 명을 골랐어요. 교체할 모험가를 먼저 해제해주세요.'; return; }
      sound.unlock(); sound.play('click'); updateSelection();
    }); return card;
  })); updateSelection();
}
function defaultParty() {
  selected = new Set(['라이오스', '마르실', '칠책', '센시'].map(name => roster.find(c => c.name === name)?.id).filter(Boolean));
  for (const character of roster) { if (selected.size === 4) break; selected.add(character.id); } updateSelection();
}
function renderLineup(team, target, enemy) {
  target.replaceChildren(...team.map((character, index) => {
    const unit = element('article', 'fighter'); unit.dataset.unit = index;
    unit.append(element('span', 'roll-float'), image(character, enemy), element('strong', 'fighter-name', character.name), element('span', 'fighter-stats', statLabel(character))); return unit;
  }));
}
function updateHealth() {
  $('#ally-hp-label').textContent = `${allyHP} / ${maxHP}`; $('#enemy-hp-label').textContent = `${enemyHP} / ${encounters[stage].hp}`;
  $('#ally-hp-bar').style.width = `${allyHP / maxHP * 100}%`; $('#enemy-hp-bar').style.width = `${enemyHP / encounters[stage].hp * 100}%`;
}
function setTacticsDisabled(disabled) { document.querySelectorAll('.tactic-card').forEach(button => button.disabled = disabled); }
function resetScores() { ['ally-attack', 'ally-defense', 'enemy-attack', 'enemy-defense'].forEach(id => $('#' + id).textContent = '—'); }
function startEncounter() {
  $('#arena').classList.remove('rolling');
  const encounter = encounters[stage]; round = 1; busy = false; lastOutcome = null; enemyHP = encounter.hp;
  $('#round-label').textContent = 'ROUND 01'; $('#encounter-title').textContent = encounter.title; $('#enemy-name').textContent = encounter.label;
  document.querySelectorAll('[data-stage]').forEach((node, index) => { node.classList.toggle('current', index === stage); node.classList.toggle('passed', index < stage); });
  renderLineup(party, $('#ally-lineup'), false); renderLineup(encounter.enemies, $('#enemy-lineup'), true);
  updateHealth(); resetScores(); setTacticsDisabled(false);
  $('#phase-label').textContent = '전술을 선택하세요'; $('#round-message').textContent = '전술 카드를 고르면 주사위가 굴러갑니다.'; queueAuto();
}
function startCampaign() {
  if (selected.size !== 4) return;
  cancelTimers(); sound.unlock(); sound.play('flip'); party = roster.filter(c => selected.has(c.id));
  allyHP = maxHP; stage = 0; campaignTurns = 0; playing = true;
  $('#log-list').replaceChildren(); $('#log-last').textContent = '모험을 시작합니다.';
  $('#party-setup').hidden = true; $('#arena').hidden = false; document.body.classList.add('in-battle');
  history.pushState({ battlePlay: true }, ''); startEncounter(); $('#back-to-party').focus({ preventScroll: true });
}
function returnToSetup() {
  cancelTimers(); sound.stop(); playing = false; busy = false;
  $('#arena').classList.remove('rolling');
  if ($('#battle-result').open) $('#battle-result').close();
  $('#arena').hidden = true; $('#party-setup').hidden = false; $('#auto-battle').checked = false;
  document.body.classList.remove('in-battle'); $('#begin-battle').focus({ preventScroll: true });
}
function leaveBattle() { if (!playing) return; returnToSetup(); if (history.state?.battlePlay) history.back(); }
function logRound(result) {
  const text = `${stage + 1}전 ${round}턴 · ${result.tactic.title} · 아군 ⚔${result.ally.attack} / ◇${result.ally.defense}, 적 ⚔${result.enemy.attack} / ◇${result.enemy.defense} → 준 피해 ${result.dealt}, 받은 피해 ${result.taken}`;
  $('#log-list').prepend(element('li', '', text)); $('#log-last').textContent = text;
}
function showDice(teamRoll, selector) {
  const fighters = document.querySelectorAll(selector + ' .fighter');
  teamRoll.members.forEach((member, index) => {
    const unit = fighters[index]; unit.querySelector('.roll-float').textContent = `⚔ ${member.attack.total}　◇ ${member.defense.total}`; unit.classList.add('has-roll');
    unit.querySelector('.fighter-stats').textContent = `⚔ ${member.attack.dice.length ? member.attack.dice.join(' + ') : member.attack.total + ' 고정'} / ◇ ${member.defense.dice.length ? member.defense.dice.join(' + ') : member.defense.total + ' 고정'}`;
  });
}
async function takeTurn(tacticId) {
  if (!playing || busy || lastOutcome) return;
  clearTimeout(autoTimer); busy = true; setTacticsDisabled(true); const token = generation;
  sound.unlock(); sound.play('click'); sound.play('flip', 0.05);
  document.querySelectorAll('.fighter').forEach(unit => unit.classList.remove('has-roll'));
  $('#arena').classList.add('rolling'); resetScores(); $('#phase-label').textContent = '주사위를 굴립니다'; $('#round-message').textContent = '모험가와 적의 공격·방어 판정 중…';
  const result = R.resolveRound(party, encounters[stage].enemies, tacticId);
  if (!await wait(550) || token !== generation) return;
  $('#arena').classList.remove('rolling'); showDice(result.ally, '#ally-lineup'); showDice(result.enemy, '#enemy-lineup');
  $('#ally-attack').textContent = result.ally.attack; $('#ally-defense').textContent = result.ally.defense; $('#enemy-attack').textContent = result.enemy.attack; $('#enemy-defense').textContent = result.enemy.defense;
  allyHP = Math.max(0, allyHP - result.taken); enemyHP = Math.max(0, enemyHP - result.dealt); campaignTurns++; updateHealth(); logRound(result);
  $('#phase-label').textContent = result.tactic.title + ' · 판정 완료'; $('#round-message').textContent = `적에게 ${result.dealt} 피해 · 아군이 ${result.taken} 피해를 받았습니다.`;
  sound.play(result.dealt >= result.taken ? 'match' : 'miss'); lastOutcome = R.outcome(allyHP, enemyHP);
  if (!await wait(700) || token !== generation) return;
  if (lastOutcome) { showBattleResult(); return; }
  round++; $('#round-label').textContent = `ROUND ${String(round).padStart(2, '0')}`; busy = false; setTacticsDisabled(false); queueAuto();
}
function showBattleResult() {
  const win = lastOutcome === 'win', cleared = win && stage === encounters.length - 1;
  $('#result-kicker').textContent = cleared ? 'DUNGEON CLEARED' : win ? 'VICTORY' : lastOutcome === 'draw' ? 'DRAW' : 'DEFEAT';
  $('#battle-result-title').textContent = cleared ? '던전을 정복했어요!' : win ? '승리! 다음 방으로.' : lastOutcome === 'draw' ? '마지막 일격, 무승부.' : '모험은 여기까지…';
  $('#battle-result-description').textContent = win && !cleared ? `남은 체력 ${allyHP}. 잠시 쉬어 체력을 12 회복한 뒤 다음 전투로 갑니다.` : `총 ${campaignTurns}턴을 함께했습니다. ${cleared ? '네 모험가의 멋진 승리입니다.' : '다른 파티와 전술로 다시 도전해보세요.'}`;
  $('#continue-battle').textContent = win && !cleared ? '다음 전투 →' : '같은 파티로 다시 도전'; $('#battle-result').showModal(); sound.play(win ? 'clear' : 'miss');
}
function queueAuto() {
  clearTimeout(autoTimer); if (!playing || busy || lastOutcome || !$('#auto-battle').checked) return;
  autoTimer = setTimeout(() => takeTurn('assault'), 900);
}
$('#continue-battle').addEventListener('click', () => {
  $('#battle-result').close();
  if (lastOutcome === 'win' && stage < encounters.length - 1) { stage++; allyHP = Math.min(maxHP, allyHP + 12); startEncounter(); }
  else { cancelTimers(); stage = 0; allyHP = maxHP; campaignTurns = 0; $('#log-list').replaceChildren(); $('#log-last').textContent = '다시 모험을 시작합니다.'; startEncounter(); }
});
$('#result-party').addEventListener('click', leaveBattle);
$('#battle-result').addEventListener('cancel', event => { event.preventDefault(); leaveBattle(); });
$('#begin-battle').addEventListener('click', startCampaign); $('#back-to-party').addEventListener('click', leaveBattle); $('#default-party').addEventListener('click', defaultParty);
$('#random-party').addEventListener('click', () => {
  const shuffled = [...roster]; for (let i = shuffled.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; }
  selected = new Set(shuffled.slice(0, 4).map(c => c.id)); updateSelection();
});
$('#party-filter').addEventListener('change', renderRoster); $('#auto-battle').addEventListener('change', queueAuto);
$('#battle-sound').checked = sound.enabled; $('#battle-sound').addEventListener('change', event => sound.setEnabled(event.target.checked));
window.addEventListener('popstate', () => { if (playing) returnToSetup(); });
window.addEventListener('keydown', event => { if (event.key === 'Escape' && playing) { event.preventDefault(); leaveBattle(); } });
for (const name of new Set(roster.map(c => c.party))) { const option = element('option', '', name); option.value = name; $('#party-filter').append(option); }
for (const tactic of R.TACTICS) {
  const button = element('button', 'tactic-card tactic-' + tactic.id); button.type = 'button'; button.setAttribute('aria-label', `${tactic.title}, 공격 +${tactic.attack}, 방어 +${tactic.defense}`);
  button.append(element('span', 'tactic-icon', tactic.icon), element('strong', '', tactic.title), element('small', '', tactic.subtitle), element('span', 'tactic-bonus', `⚔ +${tactic.attack}　◇ +${tactic.defense}`));
  button.addEventListener('click', () => takeTurn(tactic.id)); $('#tactics').append(button);
}
renderRoster(); defaultParty();
