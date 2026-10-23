"""Integration checks against password-only endpoints. Fixtures are rolled back."""
import datetime as dt
from decimal import Decimal
import json
from pathlib import Path
import unittest
import urllib.request
import uuid
import psycopg
import redis

ROOT=Path(__file__).resolve().parents[1]
PASSWORDS=json.loads((ROOT/'.secrets/credentials.json').read_text())
RESULTS=[]

def connect(role='app',host='127.0.0.1',**overrides):
    parameters=dict(host=host,port=5433,dbname='repaircalc',user='repaircalc_'+role,password=PASSWORDS['postgres_'+role],sslmode='disable',connect_timeout=5)
    parameters.update(overrides)
    return psycopg.connect(**parameters)

class StorageTests(unittest.TestCase):
    def setUp(self):
        self.db=connect()
    def tearDown(self):
        self.db.rollback();self.db.close()
    def scalar(self,sql,values=()):return self.db.execute(sql,values).fetchone()[0]
    def rejected(self,sql,values=()):
        with self.assertRaises(psycopg.Error):
            with self.db.transaction():self.db.execute(sql,values)
    def fixture(self,publish=True):
        token=uuid.uuid4().hex
        source=self.scalar('INSERT INTO catalog_source(code) VALUES(%s) RETURNING id',('fixture-'+token,))
        region=self.scalar("INSERT INTO catalog_region(source_id,external_id,name,city_code,raw_response,fetched_at) VALUES(%s,'fixture-spb','Fixture SPb','ru-spb','{}',now()) RETURNING id",(source,))
        snapshot=self.scalar("INSERT INTO catalog_snapshot(source_id,version,region_id,expected_cards,region_semantics_verified) VALUES(%s,'fixture-v1',%s,1,true) RETURNING id",(source,region))
        product=self.scalar("INSERT INTO product(source_id,product_id) VALUES(%s,'000001') RETURNING id",(source,))
        card=self.scalar("INSERT INTO product_card(snapshot_id,source_id,product_key,sku,cod_good,name,result_price,currency,sale_unit,full_card_received,raw_card_response,fetched_at) VALUES(%s,%s,%s,'000123','000045','SYNTHETIC fixture',125.25,'RUB','pack',true,'{\"fixture\":true}',now()) RETURNING id",(snapshot,source,product))
        if publish:self.db.execute('SELECT publish_catalog(%s)',(snapshot,))
        self.db.execute("INSERT INTO taxonomy_version(version,description) VALUES(%s,'SYNTHETIC fixture')",(token,))
        self.db.execute("INSERT INTO work_type(taxonomy_version,code,name,unit_code) VALUES(%s,'paint','Fixture painting','m2')",(token,))
        formula=self.scalar("INSERT INTO formula_version(code,version,taxonomy_version,work_code,implementation_sha256,input_contract,rounding_policy,description) VALUES(%s,'fixture-v1',%s,'paint',%s,'{}','{}','SYNTHETIC formula metadata, not executable') RETURNING id",(token,token,'0'*64))
        return dict(source=source,region=region,snapshot=snapshot,product=product,card=card,taxonomy=token,formula=formula)

    def test_01_password_and_permissions(self):
        self.assertFalse(self.scalar('SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()'))
        self.rejected('CREATE TABLE repaircalc.forbidden(id bigint)')
        self.rejected("CREATE ROLE forbidden_role LOGIN")
        self.rejected("INSERT INTO catalog_head(source_id,region_id,snapshot_id) VALUES(1,1,1)")
        self.rejected("TRUNCATE unit")
        with connect('reader') as reader:
            self.assertEqual(reader.execute('SELECT count(*) FROM unit').fetchone()[0],7)
            with self.assertRaises(psycopg.Error):reader.execute("INSERT INTO city VALUES('forbidden','forbidden','RU')")
        for options in [dict(sslmode='require'),dict(password='incorrect'),dict(password=''),dict(user='repaircalc_admin',password=PASSWORDS['postgres_admin'])]:
            with self.assertRaises(psycopg.OperationalError):connect(**options)

    def test_02_publication_and_history(self):
        f=self.fixture(False)
        self.db.execute('UPDATE catalog_snapshot SET expected_cards=2 WHERE id=%s',(f['snapshot'],))
        self.rejected('SELECT publish_catalog(%s)',(f['snapshot'],))
        self.db.execute('UPDATE catalog_snapshot SET expected_cards=1,region_semantics_verified=false WHERE id=%s',(f['snapshot'],))
        self.rejected('SELECT publish_catalog(%s)',(f['snapshot'],))
        self.db.execute('UPDATE catalog_snapshot SET region_semantics_verified=true WHERE id=%s',(f['snapshot'],))
        self.db.execute('SELECT publish_catalog(%s)',(f['snapshot'],))
        self.assertEqual(self.scalar('SELECT snapshot_id FROM catalog_head WHERE source_id=%s AND region_id=%s',(f['source'],f['region'])),f['snapshot'])
        self.rejected('UPDATE product_card SET result_price=999 WHERE id=%s',(f['card'],))
        self.rejected('DELETE FROM catalog_snapshot WHERE id=%s',(f['snapshot'],))
        self.rejected("INSERT INTO product_card(snapshot_id,source_id,product_key,name,fetched_at) VALUES(%s,%s,%s,'late',now())",(f['snapshot'],f['source'],f['product']))

    def test_03_import_identity_and_money(self):
        f=self.fixture(False)
        self.rejected("INSERT INTO product(source_id,product_id) VALUES(%s,'000001')",(f['source'],))
        self.db.execute("INSERT INTO product(source_id,product_id) VALUES(%s,'000001') ON CONFLICT(source_id,product_id) DO NOTHING",(f['source'],))
        self.assertEqual(self.scalar('SELECT count(*) FROM product WHERE source_id=%s',(f['source'],)),1)
        self.assertEqual(self.db.execute('SELECT sku,cod_good FROM product_card WHERE id=%s',(f['card'],)).fetchone(),('000123','000045'))
        for value in ['-1','NaN','Infinity']:
            self.rejected('UPDATE product_card SET result_price=%s WHERE id=%s',(value,f['card']))
        self.rejected('INSERT INTO product_card(snapshot_id,source_id,product_key,name,fetched_at) VALUES(%s,%s,%s,\'duplicate\',now())',(f['snapshot'],f['source'],f['product']))

    def test_04_manual_decision_survives_model_versions(self):
        f=self.fixture()
        self.db.execute("INSERT INTO manual_mapping_decision(product_key,taxonomy_version,work_code,decision,actor,reason) VALUES(%s,%s,'paint','approved','fixture-reviewer','fixture')",(f['product'],f['taxonomy']))
        for version in ['fixture-model-'+uuid.uuid4().hex,'fixture-model-'+uuid.uuid4().hex]:
            self.db.execute("INSERT INTO model_version(version,artifact_uri,artifact_sha256,manifest) VALUES(%s,'fixture://model',%s,'{}')",(version,'1'*64))
            self.db.execute("INSERT INTO mapping_proposal(product_key,card_id,taxonomy_version,work_code,model_version,confidence) VALUES(%s,%s,%s,'paint',%s,0.1)",(f['product'],f['card'],f['taxonomy'],version))
        self.assertEqual(self.scalar('SELECT decision FROM effective_manual_mapping WHERE product_key=%s',(f['product'],)),'approved')
        self.rejected("UPDATE manual_mapping_decision SET decision='rejected' WHERE product_key=%s",(f['product'],))

    def estimate(self,f,status='complete'):
        estimate=self.scalar("INSERT INTO estimate(contract_version,scenario,calculation_status,catalog_snapshot_id,taxonomy_version,input_snapshot,rounding_policy) VALUES('fixture-v0.1','product',%s,%s,%s,'{\"fixture\":true}','{}') RETURNING id",(status,f['snapshot'],f['taxonomy']))
        line=self.scalar("INSERT INTO estimate_material_line(estimate_id,card_id,formula_id,product_snapshot,parameter_snapshot,calculation_trace,need_quantity,need_unit,purchase_quantity,sale_unit,unit_price) VALUES(%s,%s,%s,'{\"fixture\":true}','{}','{}',2.1,'pack',3,'pack',125.25) RETURNING id",(estimate,f['card'],f['formula']))
        return estimate,line

    def test_05_estimate_totals_and_immutability(self):
        f=self.fixture();estimate,line=self.estimate(f)
        self.rejected("UPDATE estimate SET state='final',finalized_at=now(),materials_total=1,labor_lower=0,labor_upper=0 WHERE id=%s",(estimate,))
        self.db.execute("UPDATE estimate SET state='final',finalized_at=now(),materials_total=375.75,labor_lower=0,labor_upper=0 WHERE id=%s",(estimate,))
        self.assertEqual(self.scalar('SELECT materials_total FROM estimate WHERE id=%s',(estimate,)),Decimal('375.75'))
        self.rejected('UPDATE estimate_material_line SET purchase_quantity=9 WHERE id=%s',(line,))
        self.rejected('DELETE FROM estimate WHERE id=%s',(estimate,))
        new=self.scalar("INSERT INTO catalog_snapshot(source_id,version,region_id,expected_cards,region_semantics_verified) VALUES(%s,'fixture-v2',%s,1,true) RETURNING id",(f['source'],f['region']))
        self.db.execute("INSERT INTO product_card(snapshot_id,source_id,product_key,name,result_price,currency,sale_unit,full_card_received,raw_card_response,fetched_at) VALUES(%s,%s,%s,'fixture-new-price',999,'RUB','pack',true,'{}',now())",(new,f['source'],f['product']))
        self.db.execute('SELECT publish_catalog(%s)',(new,))
        self.assertEqual(self.scalar('SELECT materials_total FROM estimate WHERE id=%s',(estimate,)),Decimal('375.75'))

    def test_06_labor_sources_and_lower_bound(self):
        f=self.fixture();estimate,_=self.estimate(f,'partial')
        contractor=self.scalar("INSERT INTO labor_contractor(name,independent_key) VALUES('SYNTHETIC contractor',%s) RETURNING id",(uuid.uuid4().hex,))
        source=self.scalar("INSERT INTO labor_source(contractor_id,url) VALUES(%s,'https://fixture.invalid/labor') RETURNING id",(contractor,))
        observation=self.scalar("INSERT INTO labor_observation(source_id,city_code,taxonomy_version,work_code,unit_code,scope,conditions,price_kind,price,materials_included,observed_at,fetched_at,evidence_uri,evidence_sha256) VALUES(%s,'ru-spb',%s,'paint','m2','fixture scope','{}','from',100,false,now(),now(),'fixture://evidence',%s) RETURNING id",(source,f['taxonomy'],'2'*64))
        version=self.scalar("INSERT INTO labor_rate_version(version,city_code) VALUES(%s,'ru-spb') RETURNING id",('fixture-'+uuid.uuid4().hex,))
        self.db.execute('INSERT INTO labor_rate_member VALUES(%s,%s)',(version,observation))
        self.rejected("UPDATE labor_rate_version SET status='published',published_at=now() WHERE id=%s",(version,))
        self.db.execute("UPDATE labor_observation SET review_status='approved',reviewed_by='fixture',reviewed_at=now() WHERE id=%s",(observation,))
        self.db.execute("UPDATE labor_rate_version SET status='published',published_at=now() WHERE id=%s",(version,))
        line=self.scalar("INSERT INTO estimate_labor_line(estimate_id,taxonomy_version,work_code,quantity,unit_code,price_kind,rate_lower,source_snapshot,calculation_trace) VALUES(%s,%s,'paint',10,'m2','from',100,'{\"fixture\":true}','{}') RETURNING id",(estimate,f['taxonomy']))
        self.db.execute('INSERT INTO estimate_labor_evidence VALUES(%s,%s)',(line,observation))
        self.db.execute("UPDATE estimate SET labor_version_id=%s,missing_data='[\"labor_upper\"]',state='final',finalized_at=now(),materials_total=375.75,labor_lower=1000,labor_upper=NULL WHERE id=%s",(version,estimate))
        self.assertEqual(self.db.execute('SELECT labor_lower,labor_upper FROM estimate WHERE id=%s',(estimate,)).fetchone(),(Decimal('1000.00'),None))
        self.rejected('DELETE FROM estimate_labor_evidence WHERE line_id=%s',(line,))
        self.rejected('UPDATE labor_observation SET price=1 WHERE id=%s',(observation,))

    def test_07_partial_unknown_is_not_zero(self):
        f=self.fixture();estimate,line=self.estimate(f,'partial')
        self.db.execute('UPDATE estimate_material_line SET unit_price=NULL WHERE id=%s',(line,))
        # Catalog says a price exists: replacing it with an unknown value is rejected.
        self.rejected("UPDATE estimate SET state='final',finalized_at=now(),materials_total=NULL,labor_lower=0,labor_upper=0 WHERE id=%s",(estimate,))

    def test_08_redis_password_acl_ttl(self):
        client=redis.Redis(host='127.0.0.1',port=6380,username='app',password=PASSWORDS['redis_app'],decode_responses=True,socket_timeout=5)
        key='repaircalc:test:'+uuid.uuid4().hex
        self.assertTrue(client.ping())
        self.assertTrue(client.set(key,'fixture',ex=30));self.assertEqual(client.get(key),'fixture');self.assertGreater(client.ttl(key),0)
        with self.assertRaises(redis.exceptions.ResponseError):client.set('other:test','forbidden')
        with self.assertRaises(redis.exceptions.ResponseError):client.flushall()
        with self.assertRaises(redis.exceptions.ResponseError):client.config_get('*')
        client.delete(key);client.close()
        anonymous=redis.Redis(host='127.0.0.1',port=6380,socket_timeout=5)
        with self.assertRaises(redis.exceptions.AuthenticationError):anonymous.ping()
        anonymous.close()

    def test_09_pgadmin_http(self):
        for host in ['localhost','127.0.0.1','192.168.3.100']:
            with urllib.request.urlopen('http://'+host+':5443/misc/ping',timeout=5) as response:self.assertEqual(response.read(),b'PING')
        with urllib.request.urlopen('http://localhost:5443/login',timeout=5) as response:self.assertIn(b'csrfToken',response.read())

    def test_10_region_cycles_and_missing_quantities(self):
        f=self.fixture(False)
        self.db.execute("INSERT INTO catalog_category(snapshot_id,category_id,parent_id,name,raw_response) VALUES(%s,'a','b','Fixture A','{}'),(%s,'b','a','Fixture B','{}')",(f['snapshot'],f['snapshot']))
        self.rejected('SELECT publish_catalog(%s)',(f['snapshot'],))
        self.db.execute("UPDATE catalog_category SET parent_id=NULL WHERE snapshot_id=%s AND category_id='a'",(f['snapshot'],))
        self.db.execute('SELECT publish_catalog(%s)',(f['snapshot'],))
        self.rejected("UPDATE catalog_region SET city_code=NULL WHERE id=%s",(f['region'],))
        estimate,line=self.estimate(f)
        self.db.execute('UPDATE estimate_material_line SET need_quantity=NULL WHERE id=%s',(line,))
        self.rejected("UPDATE estimate SET state='final',finalized_at=now(),materials_total=375.75,labor_lower=0,labor_upper=0 WHERE id=%s",(estimate,))

class RecordingResult(unittest.TextTestResult):
    def addSuccess(self,test):super().addSuccess(test);RESULTS.append({'test':test._testMethodName,'status':'passed'})
    def addFailure(self,test,err):super().addFailure(test,err);RESULTS.append({'test':test._testMethodName,'status':'failed','message':str(err[1])})
    def addError(self,test,err):super().addError(test,err);RESULTS.append({'test':test._testMethodName,'status':'error','message':str(err[1])})

if __name__=='__main__':
    runner=unittest.TextTestRunner(verbosity=2,resultclass=RecordingResult)
    result=runner.run(unittest.defaultTestLoader.loadTestsFromTestCase(StorageTests))
    (ROOT/'docs/test-results.json').write_text(json.dumps({'checked_at':dt.datetime.now(dt.timezone.utc).isoformat(),'results':RESULTS},indent=2),encoding='utf-8')
    raise SystemExit(not result.wasSuccessful())
