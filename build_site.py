"""Build the static Pages bundle and refresh the character list on each deploy."""
import json
import shutil
from pathlib import Path
from server import ROOT, characters
from sync_battle_data import generate


def build(output=None):
    generate()
    target = Path(output) if output else ROOT / '_site'
    target.mkdir(parents=True, exist_ok=True)
    for name in ['index.html', 'memory.html', 'battle.html', 'battle.css', 'battle.js',
                 'battle-engine.js', 'battle-data.js', 'battle-audio.js',
                 'style.css', 'game.js', 'card_back.png', 'name.png', 'mask.png']:
        shutil.copy2(ROOT / name, target / name)
    for image in ROOT.glob('battle-monster-*.png'):
        shutil.copy2(image, target / image.name)
    shutil.copytree(ROOT / 'dice', target / 'dice', dirs_exist_ok=True)
    entries = characters()
    (target / 'cha').mkdir(exist_ok=True)
    for entry in entries:
        shutil.copy2(ROOT / 'cha' / entry['file'], target / 'cha' / entry['file'])
    payload = json.dumps(entries, ensure_ascii=False)
    (target / 'characters.json').write_text(payload, encoding='utf-8')
    (target / 'characters.js').write_text('window.CARD_CHARACTERS = ' + payload + ';\n', encoding='utf-8')
    (target / '.nojekyll').touch()
    print(f'Built {len(entries)} characters: {target}')
    return target


if __name__ == '__main__':
    build()
