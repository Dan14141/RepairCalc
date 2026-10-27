"""Validate the supplied export against PostgreSQL without changing application data."""
from collections import Counter
from decimal import Decimal
import hashlib
import json
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from import_maxidom import connect, normalize, run


class MaxidomImportTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        raw = (ROOT / 'products_final.json').read_bytes()
        cls.digest = hashlib.sha256(raw).hexdigest()
        cls.source = json.loads(raw)['products']
        cls.counts = Counter(str(p['cod_good']) for p in cls.source)

    def test_all_source_rows_preserved_including_duplicates(self):
        with connect() as db:
            batch, count = db.execute('SELECT id,row_count FROM maxidom_import WHERE sha256=%s', (self.digest,)).fetchone()
            self.assertEqual(count, len(self.source))
            # Stream the raw payloads to avoid loading a second full export into memory.
            with db.cursor(name='maxidom_source_check') as cursor:
                cursor.execute('SELECT row_number,payload FROM maxidom_raw_product WHERE import_id=%s ORDER BY row_number', (batch,))
                seen = 0
                for row, payload in cursor:
                    self.assertEqual(payload, self.source[row - 1], f'Source row {row} differs')
                    seen += 1
                self.assertEqual(seen, count)

    def test_all_skus_names_prices_and_sale_units_match_first_source_record(self):
        selected = {}
        for p in self.source:
            selected.setdefault(str(p['cod_good']), p)
        with connect() as db:
            rows = db.execute('SELECT id,name,price,unit,coverage FROM products').fetchall()
        self.assertEqual(len(rows), len(selected))
        for sku, name, price, unit, coverage in rows:
            source = selected[sku]
            self.assertEqual(name, source['name'], sku)
            self.assertEqual(price, Decimal(str(source['price'])), sku)
            self.assertEqual(unit, source['unit'] or 'не указана', sku)
            if self.counts[sku] > 1:
                self.assertEqual(coverage, 0, f'Ambiguous SKU {sku} must not be calculated')

    def test_repeat_import_changes_neither_rows_nor_workspace(self):
        def snapshot():
            with connect() as db:
                return db.execute('SELECT (SELECT count(*) FROM maxidom_import), (SELECT count(*) FROM maxidom_raw_product), (SELECT count(*) FROM products), (SELECT md5(payload::text) FROM app_workspace WHERE id=1)').fetchone()
        before = snapshot()
        run(ROOT / 'products_final.json')
        self.assertEqual(snapshot(), before)

    def test_sale_unit_and_conflicting_dimensions_are_not_guessed(self):
        floor = {**next(p for p in self.source if normalize(p)['category'] == 'floor'), 'unit': 'кв.м'}
        self.assertEqual(normalize(floor)['coverage'], 1)
        self.assertEqual(normalize({**floor, 'unit': None})['coverage'], 0)
        self.assertEqual(normalize(floor, duplicate=True)['coverage'], 0)
        wallpaper = next(p for p in self.source if normalize(p)['texture'] == 'linen' and normalize(p)['coverage'] > 0)
        ambiguous = {**wallpaper, 'characteristics': [*wallpaper['characteristics'], {'name': 'Ширина', 'value': '999'}]}
        self.assertEqual(normalize(ambiguous)['coverage'], 0)


if __name__ == '__main__':
    unittest.main(verbosity=2)
