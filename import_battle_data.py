"""Export only attack/defense from Unity assets; never modifies the source project."""
import json
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SOURCE = Path(r'E:\Gameproduction\2026\DeliciousinDungeon\Assets\Data\Character')


def stat(text, key):
    match = re.search(r'^  ' + key + r':\n((?:    [^\n]*\n?)+)', text, re.M)
    if not match:
        raise ValueError(f'Missing {key}')
    fields = dict(re.findall(r'^    (\w+): (\d+)', match[1], re.M))
    return {k: int(fields.get(k, default)) for k, default in
            [('diceCount', '1'), ('diceType', '4'), ('mode', '0'), ('fixedValue', '1')]}


def export():
    images = {p.stem: p.name for p in (ROOT / 'cha').iterdir() if p.is_file()}
    records, seen, missing = [], set(), []
    for asset in sorted(SOURCE.rglob('*.asset')):
        text = asset.read_text(encoding='utf-8-sig')
        match = re.search(r'^  characterName: (.+)$', text, re.M)
        if not match:
            continue
        name = json.loads(match[1]) if match[1].startswith('"') else match[1]
        if name not in images:
            missing.append(name)
            continue
        if name in seen:
            continue
        seen.add(name)
        records.append({'id': asset.stem, 'name': name, 'file': images[name],
                        'party': asset.parent.name, 'attack': stat(text, 'attack'),
                        'defense': stat(text, 'defense')})
    monsters = []
    asset_root = SOURCE.parent.parent
    for asset_name, image_name in [('D/D_걷는버섯', '얕은층/걷는버섯(빨간색)'),
                                    ('B/B_스켈레톤', '깊은층/스켈레톤'),
                                    ('B/B_움직이는갑옷', '얕은층/움직이는갑옷')]:
        asset = SOURCE.parent / 'Monster' / (asset_name + '.asset')
        text = asset.read_text(encoding='utf-8-sig')
        raw_name = re.search(r'^  monsterName: (.+)$', text, re.M)[1]
        name = json.loads(raw_name) if raw_name.startswith('"') else raw_name
        file = 'battle-monster-' + name.replace(' ', '') + '.png'
        shutil.copy2(asset_root / 'Sprites' / 'Mon' / (image_name + '.png'), ROOT / file)
        monsters.append({'name': name, 'file': file, 'attack': stat(text, 'attackDice'),
                         'defense': stat(text, 'defenseDice')})
    (ROOT / 'battle-data.js').write_text('window.BATTLE_CHARACTERS = ' +
        json.dumps(records, ensure_ascii=False, indent=2) + ';\nwindow.BATTLE_MONSTERS = ' +
        json.dumps(monsters, ensure_ascii=False, indent=2) + ';\n', encoding='utf-8')
    print(f'Exported {len(records)} characters; {len(missing)} have no matching image.')
    for item in records[:6]:
        print(item['name'], item['attack'], item['defense'])


if __name__ == '__main__':
    export()
