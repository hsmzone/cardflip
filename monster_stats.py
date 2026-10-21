"""Monster stats come from mon/; folder names define boss tiers."""
import hashlib

# agility / attack / defense / HP / MP; unique species roles.
ROWS = """
가고일|2D6|2D6+2|2D6|38|0
거대개구리|1D6|2D4|1D4|26|0
거대거미|1D4|2D6|1D4|22|0
거대걷는버섯|2D6|2D6+1|1D6+2|42|0
거대박쥐|1D4|2D4|1D4|18|0
거대전갈|1D6|2D6+2|2D4|30|0
걷는버섯|2D4|1D4+1|1D4|16|0
걷는버섯_2|2D4|2D4|1D4|20|0
걷는버섯_3|1D6|2D4+1|1D6|24|0
골렘|2D6+2|3D6|2D6+3|65|0
그리핀|1D4|3D6|1D6+2|46|0
늑대인간|1D4|2D6+3|1D6|36|0
도플갱어|1D6|2D6|1D6|32|6
둘라한|1D6|3D6+2|2D6|52|6
드라이어드|1D6|2D6+2|1D6|34|10
맨드레이크|2D4|1D6|1D4|18|3
미궁토끼|1D4|3D6+3|0|16|0
미믹|1D6|2D6+2|2D4+2|34|0
바로그|1D6|3D6+2|2D4|48|8
바실리스크|1D6|2D6+3|1D6+2|38|3
바이콘|1D6|3D6|1D6+1|40|2
보석벌레|2D4|1D4|1D6+2|12|0
살아있는그림|2D6|2D4|1D4|22|8
서큐버스|1D4|3D6|1D4|28|16
스켈레톤|1D6|2D4+1|1D4+1|22|0
슬라임|2D4|1D4|1D4|14|0
식인식물|2D6|2D6|1D6|32|0
어인|1D6|2D4+2|1D4+1|26|0
오크(리드)|1D6|2D6+3|1D6+2|42|0
와이번|1D4|3D6+2|2D4|46|0
운디네|1D6|3D6|1D4|30|18
움직이는갑옷|2D6|2D6+2|2D6+3|44|0
유니콘|1D4|2D6+3|1D6|38|12
유령|1D6|2D6|1D4+2|24|10
켈피|1D4|2D6+2|1D6|32|4
코카트리스|1D4|2D6+3|1D4|28|4
텐터클스|2D4|2D6|1D6|34|0
피닉스|1D4|3D6+3|1D6|44|20
하피|1D4|2D4+2|1D4|24|0
해골바로그|1D6|3D6|2D4+2|44|6
히포그리프|1D4|3D6|1D6|40|0
걷는버섯군단|1D6|4D6+6|2D6+2|200|0
그린드래곤|1D6|4D6+8|2D6+3|220|16
나이트메어|1D4|4D6+7|2D6+2|180|24
동양용|1D4|4D6+9|2D6+3|240|32
레드드래곤|1D6|5D6+8|2D6+4|260|20
시서펜트|1D6|4D6+8|2D6+3|240|16
웜|2D4|5D6+6|2D6+4|250|0
자이언트크라켄|1D6|5D6+7|2D6+2|260|12
키메라파린|1D4|4D6+10|2D6+3|230|24
화이트드래곤|1D6|4D6+8|2D6+4|240|24
광란의마술사시슬|1D4|6D6+18|2D6+5|600|100
날개사자|1D4|6D6+24|3D6+4|800|150
최강의마물|1D4|6D6+30|3D6+6|1000|100
"""

def monsters_from_folder(root, dice):
    profiles={r.split('|')[0]:r.split('|')[1:] for r in ROWS.strip().splitlines()}
    result=[]
    for path in sorted((root/'mon').rglob('*'),key=lambda p:p.as_posix().casefold()):
        if not path.is_file() or path.suffix.lower() not in {'.png','.jpg','.jpeg','.webp','.gif','.avif'}:continue
        folders={part.casefold() for part in path.relative_to(root/'mon').parts[:-1]}
        tier='boss' if 'boss' in folders else 'midboss' if 'midboss' in folders else 'normal'
        seed=hashlib.sha256(path.relative_to(root/'mon').as_posix().encode()).digest()
        defaults={'normal':['1D6','2D4','1D4',str(22+seed[0]%15),'0'],
                  'midboss':['1D4','4D6+8','2D6+3',str(200+seed[0]%61),'20'],
                  'boss':['1D4','6D6+24','3D6+5',str(750+seed[0]%251),'100']}
        values=profiles.get(path.stem,defaults[tier])
        # Folder tier always wins, even when an existing species is moved.
        profile_tier='boss' if path.stem in ['광란의마술사시슬','날개사자','최강의마물'] else 'midboss' if path.stem in ['걷는버섯군단','그린드래곤','나이트메어','동양용','레드드래곤','시서펜트','웜','자이언트크라켄','키메라파린','화이트드래곤'] else 'normal'
        if profile_tier!=tier:values=defaults[tier]
        ag,atk,defense,hp,mp=values
        relative=path.relative_to(root).as_posix()
        result.append(dict(id='monster:'+relative,name=path.stem,file=relative,job='몬스터',
            subtype={'normal':'일반','midboss':'중간 보스 · 단독','boss':'보스 · 단독'}[tier],
            monster=True,tier=tier,solo=tier!='normal',agility=dice(ag),attack=dice(atk),defense=dice(defense),hp=int(hp),mp=int(mp)))
    return sorted(result,key=lambda c:({'normal':0,'midboss':1,'boss':2}[c['tier']],c['name']))
