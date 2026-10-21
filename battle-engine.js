(function (root) {
  'use strict';
  const TACTICS = [
    { id: 'assault', title: '총공격', subtitle: '공격에 모든 힘을', attack: 6, defense: 0, icon: '⚔' },
    { id: 'balanced', title: '협공', subtitle: '공격과 방어의 균형', attack: 3, defense: 3, icon: '✦' },
    { id: 'guard', title: '철벽 수비', subtitle: '다음 기회를 준비', attack: 0, defense: 6, icon: '◇' }
  ];
  function rollStat(stat, random = Math.random) {
    if (stat.mode === 1) return { total: Math.max(0, stat.fixedValue), dice: [], fixed: true };
    const dice = Array.from({ length: Math.max(0, stat.diceCount) }, () => 1 + Math.floor(random() * stat.diceType));
    return { total: dice.reduce((sum, die) => sum + die, 0), dice, fixed: false };
  }
  function formatStat(stat) {
    return stat.mode === 1 ? String(stat.fixedValue) : `${stat.diceCount}D${stat.diceType}`;
  }
  function expected(stat) {
    return stat.mode === 1 ? stat.fixedValue : stat.diceCount * (stat.diceType + 1) / 2;
  }
  function rollTeam(team, random) {
    const members = team.map(character => ({ name: character.name,
      attack: rollStat(character.attack, random), defense: rollStat(character.defense, random) }));
    return { members, attack: members.reduce((sum, m) => sum + m.attack.total, 0),
      defense: members.reduce((sum, m) => sum + m.defense.total, 0) };
  }
  function resolveRound(party, enemies, tacticId, random = Math.random) {
    const tactic = TACTICS.find(t => t.id === tacticId);
    if (!tactic) throw new Error('Unknown tactic');
    const ally = rollTeam(party, random), enemy = rollTeam(enemies, random);
    ally.attack += tactic.attack;
    ally.defense += tactic.defense;
    // Minimum one damage keeps defensive formations from stalling forever.
    const dealt = Math.max(1, ally.attack - enemy.defense);
    const taken = Math.max(1, enemy.attack - ally.defense);
    return { ally, enemy, dealt, taken, tactic };
  }
  function outcome(allyHP, enemyHP) {
    if (allyHP <= 0 && enemyHP <= 0) return 'draw';
    if (enemyHP <= 0) return 'win';
    if (allyHP <= 0) return 'lose';
    return null;
  }
  const rules = { TACTICS, rollStat, formatStat, expected, resolveRound, outcome };
  if (typeof module !== 'undefined' && module.exports) module.exports = rules;
  else root.BattleRules = rules;
})(typeof window === 'undefined' ? globalThis : window);
