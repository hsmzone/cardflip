"""Generate stable job-based stats for the images currently in cha/."""
import hashlib
import json
import re
from pathlib import Path
from monster_stats import monsters_from_folder

ROOT = Path(__file__).resolve().parent
JOBS = [
    ('전사', '공격형', ['1D6','1D6+3','1D6',30,3], '해골 터그 멕시 턴 아린 더스'),
    ('전사', '방어형', ['1D6+2','1D6','1D6+4',50,2], '파란 판 랄프 테니'),
    ('마술사', '공격형', ['2D6','3D6','1D4',18,6], '루 아라'),
    ('마술사', '보조형', ['1D6','1D6','1D4',25,8], '소낙'),
    ('닌자', '공격형', ['1D4','2D6','1D4',18,2], '랑'),
    ('닌자', '술법형', ['1D6','1D6+3','1D4',18,4], '태호'),
    ('궁수', '공격형', ['2D4','3D6','0',15,2], '로린트 유니'),
    ('무도가', '공격형', ['1D4','2D6','1D6',40,4], '한별 호커'),
    ('열쇠공', '공격형', ['2D6','2D4','2',15,6], '펑펑 콜'),
    ('열쇠공', '보조형', ['1D6','1D4','2D4',15,8], '벨'),
]


def dice(expression, bonus=0):
    match = re.fullmatch(r'(\d+)D([46])(?:\+(\d+))?', expression)
    if not match:
        return dict(mode=1, fixedValue=max(0, int(expression)+bonus), diceCount=0, diceType=4, bonus=0)
    return dict(mode=0, diceCount=int(match[1]), diceType=int(match[2]),
                bonus=int(match[3] or 0)+bonus, fixedValue=0)


def generate():
    images = {p.stem:p.name for p in (ROOT/'cha').iterdir() if p.suffix.lower() in {'.png','.jpg','.jpeg','.webp','.gif','.avif'}}
    records=[]
    for job, subtype, base, names in JOBS:
        for name in names.split():
            if name not in images:
                continue
            seed = hashlib.sha256(('battle-jobs-v1:'+name).encode()).digest()
            # Small, deterministic personal modifiers; a zero defense stays zero.
            agility_bonus=seed[0]%3-1
            attack_bonus=seed[1]%3-1
            defense_bonus=0 if base[2]=='0' else seed[2]%3-1
            health_bonus=seed[3]%7-3
            mana_bonus=seed[4]%3-1
            records.append(dict(id=name,name=name,file=images[name],job=job,subtype=subtype,
                agility=dice(base[0],agility_bonus),attack=dice(base[1],attack_bonus),
                defense=dice(base[2],defense_bonus),hp=base[3]+health_bonus,mp=max(0,base[4]+mana_bonus),
                base=dict(agility=dice(base[0]),attack=dice(base[1]),defense=dice(base[2]),hp=base[3],mp=base[4])))
    monsters=monsters_from_folder(ROOT, dice)
    (ROOT/'monster-data.json').write_text(json.dumps(monsters,ensure_ascii=False,indent=2),encoding='utf-8')
    def expression(stat):
        if stat['mode']==1: return str(stat['fixedValue'])
        bonus=stat.get('bonus',0)
        return f"{stat['diceCount']}D{stat['diceType']}"+(f'+{bonus}' if bonus>0 else str(bonus) if bonus<0 else '')
    lines=['# 몬스터 기본 스탯 목록', '', '스테이지에서는 단계별 강화가 추가 적용됩니다. 보스와 중간 보스는 단독으로만 전투합니다.', '',
           '| 이름 | 등급 | 민첩 | 공격 | 방어 | 체력 | 마력 |', '|---|---|---|---|---|---:|---:|']
    lines += ['| '+' | '.join([c['name'],c['subtype'],expression(c['agility']),expression(c['attack']),expression(c['defense']),str(c['hp']),str(c['mp'])])+' |' for c in monsters]
    (ROOT/'monster-catalog.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
    payload='window.BATTLE_CHARACTERS = '+json.dumps(records,ensure_ascii=False,indent=2)+';\n'
    payload+='window.BATTLE_MONSTERS = '+json.dumps(monsters,ensure_ascii=False,indent=2)+';\n'
    (ROOT/'battle-data.js').write_text(payload,encoding='utf-8')
    print(f'Synced {len(records)} character images and {len(monsters)} folder monsters.')
    unknown=set(images)-{c['name'] for c in records}
    if unknown: print('Images without a job: '+', '.join(sorted(unknown)))


if __name__=='__main__': generate()
