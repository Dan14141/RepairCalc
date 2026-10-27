"""Atomic, repeatable import of the supplied Maxidom export; never logs credentials."""
import argparse
from collections import Counter
from decimal import Decimal
import hashlib
import html
import json
import os
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
NUMBER = r"\d+(?:[.,]\d+)?"


def number(value):
    value = str(value or '').strip().replace(',', '.')
    return float(value) if re.fullmatch(r'\d+(?:\.\d+)?', value) else 0.0


def plain(value):
    return html.unescape(re.sub(r'<[^>]*>', ' ', value or '')).strip()


def normalize(p, duplicate=False):
    """Coverage is m2 per *sale unit*. Unknown or ambiguous coverage stays zero."""
    attrs = {}
    conflicts = set()
    for c in p['characteristics']:
        key, value = c['name'].lower().strip(), str(c['value']).strip()
        if key in attrs and attrs[key] != value:
            conflicts.add(key)
        attrs[key] = value
    slug = p['url_key'].split('/')[2] if p['url_key'] else ''
    name = p['name'].lower()
    category, texture, coverage, wet, heavy = 'other', 'plain', 0.0, False, False
    note = ''
    pack_area = number(attrs.get('площадь покрытия упаковкой'))
    unit = p['unit'] or ''
    floor = ((slug.startswith('laminat-') and name.startswith('ламинат')) or
             (slug == 'keramogranit-napolnyy' and name.startswith('керамогранит')) or
             (slug in ('plitka-spc', 'napolnaya-plitka', 'plitka-pvh') and name.startswith('плитка')))
    wall_tile = slug in ('plitka-nastennaya-dlya-vannoy','plitka-nastennaya-dlya-kuhni','nastennaya-plitka') and name.startswith('плитка')
    if floor or wall_tile:
        category = 'floor' if floor else 'walls'
        texture = 'wood' if slug.startswith('laminat-') else 'stone' if floor else 'tile'
        coverage = 1.0 if unit in ('кв.м', 'кв.м.') else pack_area if unit == 'уп.' else 0.0
        ceramic = slug in ('keramogranit-napolnyy','napolnaya-plitka') or wall_tile
        wet = ceramic or attrs.get('влагостойкость', '').lower() == 'да'
        wear = number(attrs.get('износостойкость'))
        heavy = wall_tile or (wear >= 33 if slug.startswith('laminat-') else wear >= 3)
        if 'площадь покрытия упаковкой' in conflicts:
            coverage = 0.0
    elif slug in ('oboi','oboi-pod-pokrasku') and name.startswith('обои'):
        category, texture = 'walls', 'linen'
        length, width = number(attrs.get('длина')), number(attrs.get('ширина'))
        # Export dimensions for wallpaper are metres; check against plausible roll dimensions.
        if unit == 'рул.' and 0 < width <= 2 and 0 < length <= 50 and not {'длина','ширина'} & conflicts:
            coverage = length * width
            note = 'Расчёт по площади рулона; подгонка рисунка и раскрой требуют дополнительного запаса.'
    elif slug == 'kraski-dlya-sten-i-potolkov' and name.startswith('краска'):
        category, texture = 'walls', 'paint'
        # A bare consumption number has no unit in this export: do not invent l/m2 or density.
    elif slug == 'gruntovka' and name.startswith(('грунт','праймер')):
        category, texture = 'prep', 'can'
        # Only explicit l/m2 evidence allows converting the can volume into coverage.
        match = re.search(r'(' + NUMBER + r')\s*л\s*/\s*(?:м[²2]|кв\.?\s*м)', plain(p['marketing_description']).lower())
        volume = number(attrs.get('литраж банки')) or number(attrs.get('объем'))
        if match and volume and unit == 'шт.':
            coverage = volume / number(match[1]) if number(match[1]) else 0.0
            note = 'Расход грунтовки взят из описания товара, один слой.'
        wet = 'наружн' in attrs.get('применение','').lower()
    elif slug in ('shtukaturka-gipsovaya','shtukaturka-tsementnaya') and name.startswith('штукатурка'):
        category, texture = 'prep', 'bag'
        wet = slug == 'shtukaturka-tsementnaya'
        desc = plain(p['marketing_description']).lower()
        match = re.search(r'расход[^.]{0,65}при слое 10 мм\s*:\s*(' + NUMBER + r')(?:\s*[-–]\s*(' + NUMBER + r'))?\s*кг', desc)
        weight = number(attrs.get('вес'))
        if match and weight and unit == 'шт.':
            rate = number(match[2] or match[1])
            coverage = weight / rate if rate else 0.0
            note = 'Штукатурка: слой 10 мм, верхняя граница расхода из описания товара.'
    elif slug in ('rozetki-nakladnye','rozetki-vstraivaemye') and name.startswith('розетка'):
        category, texture = 'electric', 'socket'
        coverage = 1.0 if unit == 'шт.' else 0.0
        protection = re.search(r'\bIP\s*(\d{2})\b', p['name'] + ' ' + p['description'], re.I)
        wet = bool(protection and int(protection[1][1]) >= 4)
        heavy = True
    if duplicate:
        coverage = 0.0
        note = 'В выгрузке несколько записей этого артикула. Данные требуют сверки.'
    if coverage == 0 and not note:
        note = 'Автоматический расчёт расхода недоступен: недостаточно согласованных данных в карточке.'
    brand = (p['brand'] or {}).get('name', '')
    description = plain(p['marketing_description'] or p['description'])
    description = description[:1800] + ('\n' + note if note else '')
    return dict(id=str(p['cod_good']), name=p['name'], brand=brand, category=category,
                price=Decimal(str(p['price'])), unit=unit or 'не указана', coverage=coverage,
                color='#c7c0b1', texture=texture, wet=wet, heavy=heavy, rating='—',
                description=description, source_category=', '.join(p['categories'].values()),
                url='https://www.maxidom.ru' + p['url_key'])


def connect():
    import psycopg
    secrets = json.loads((ROOT / '.secrets/credentials.json').read_text())
    return psycopg.connect(host=os.getenv('PGHOST','127.0.0.1'), port=os.getenv('PGPORT','5433'),
                          dbname=os.getenv('PGDATABASE','repaircalc'), user='repaircalc_app',
                          password=secrets['postgres_app'], connect_timeout=10)


def run(path):
    from psycopg.types.json import Jsonb
    raw = path.read_bytes()
    digest = hashlib.sha256(raw).hexdigest()
    products = json.loads(raw)['products']
    del raw
    counts = Counter(str(p['cod_good']) for p in products)
    selected = {}
    for row, p in enumerate(products, 1):
        # Source order is deterministic. All alternatives remain in maxidom_raw_product.
        if str(p['cod_good']) not in selected:
            selected[str(p['cod_good'])] = (row, normalize(p, counts[str(p['cod_good'])] > 1))
    report = dict(source_rows=len(products), unique_products=len(selected),
                  duplicate_rows=len(products)-len(selected), duplicate_skus=sum(n>1 for n in counts.values()),
                  missing_units=sum(not p['unit'] for p in products),
                  calculable_products=sum(p['coverage']>0 for _,p in selected.values()),
                  categories=dict(Counter(p['category'] for _,p in selected.values())),
                  duplicate_policy='first source row; conflicting SKUs excluded from calculations')
    with connect() as db:
        db.execute('SELECT pg_advisory_xact_lock(90420261025)')
        existing = db.execute('SELECT id FROM maxidom_import WHERE sha256=%s',(digest,)).fetchone()
        if existing:
            print('Already imported; no data changed. SHA-256: ' + digest)
            return report
        batch = db.execute('INSERT INTO maxidom_import(sha256,source_name,row_count,report) VALUES(%s,%s,%s,%s) RETURNING id',
                           (digest,path.name,len(products),Jsonb(report))).fetchone()[0]
        with db.cursor().copy('COPY maxidom_raw_product(import_id,row_number,payload) FROM STDIN') as copy:
            for row,p in enumerate(products,1):
                copy.write_row((batch,row,Jsonb(p)))
        columns = list(next(iter(selected.values()))[1]) + ['import_id','source_row']
        updates=','.join(c+'=excluded.'+c for c in columns if c!='id')
        db.cursor().executemany('INSERT INTO products ('+','.join(columns)+') VALUES ('+','.join(['%s']*len(columns))+') ON CONFLICT(id) DO UPDATE SET '+updates,
                               (tuple(p.values())+(batch,row) for row,p in selected.values()))
        db.execute('ANALYZE products')
    report['sha256'] = digest
    (ROOT / 'docs/maxidom-import-report.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
    print(json.dumps(report,ensure_ascii=True))
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('file',nargs='?',type=Path,default=ROOT/'products_final.json')
    run(parser.parse_args().file)
