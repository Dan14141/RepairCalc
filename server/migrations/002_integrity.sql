SET ROLE repaircalc_owner;
SET search_path=repaircalc,pg_catalog;
CREATE FUNCTION reject_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION '% is append-only; create a new version',TG_TABLE_NAME; END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['product','taxonomy_version','work_type','model_version','mapping_proposal','manual_mapping_decision','formula_version','consumption_parameter','labor_contractor','labor_source'] LOOP
 EXECUTE format('CREATE TRIGGER immutable BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION reject_mutation()',t);
 END LOOP;
END $$;
CREATE FUNCTION guard_snapshot_child() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE sid bigint; state text;
BEGIN
 IF TG_OP='UPDATE' AND (to_jsonb(NEW)->>'snapshot_id') IS DISTINCT FROM (to_jsonb(OLD)->>'snapshot_id') THEN RAISE EXCEPTION 'Cannot move snapshot rows'; END IF;
 sid:=(CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END->>'snapshot_id')::bigint;
 SELECT status INTO state FROM catalog_snapshot WHERE id=sid FOR UPDATE;
 IF state<>'loading' THEN RAISE EXCEPTION 'Snapshot % is not writable',sid; END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['product_card','catalog_category','product_category','import_issue'] LOOP
 EXECUTE format('CREATE TRIGGER snapshot_guard BEFORE INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION guard_snapshot_child()',t);
 END LOOP;
END $$;
CREATE FUNCTION guard_stock() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE state text; src bigint; region_src bigint; cid bigint;
BEGIN
 IF TG_OP='UPDATE' AND NEW.card_id<>OLD.card_id THEN RAISE EXCEPTION 'Cannot move stock'; END IF;
 cid:=CASE WHEN TG_OP='DELETE' THEN OLD.card_id ELSE NEW.card_id END;
 SELECT s.status,s.source_id INTO state,src FROM catalog_snapshot s JOIN product_card c ON c.snapshot_id=s.id WHERE c.id=cid FOR UPDATE OF s;
 IF state<>'loading' THEN RAISE EXCEPTION 'Snapshot is not writable'; END IF;
 IF TG_OP<>'DELETE' THEN
 SELECT source_id INTO region_src FROM catalog_region WHERE id=NEW.region_id;
 IF src IS DISTINCT FROM region_src THEN RAISE EXCEPTION 'Stock region source mismatch'; END IF;
 END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER stock_guard BEFORE INSERT OR UPDATE OR DELETE ON product_stock FOR EACH ROW EXECUTE FUNCTION guard_stock();
CREATE FUNCTION guard_catalog_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE actual bigint; incomplete bigint;
BEGIN
 IF TG_OP<>'INSERT' AND OLD.status='published' THEN RAISE EXCEPTION 'Published catalog is immutable'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 IF NEW.status='published' THEN
 SELECT count(*),count(*) FILTER(WHERE NOT full_card_received) INTO actual,incomplete FROM product_card WHERE snapshot_id=NEW.id;
 IF NEW.expected_cards IS NULL OR actual<>NEW.expected_cards OR incomplete>0 OR NEW.failed_pages>0 OR NOT NEW.region_semantics_verified
 OR EXISTS(SELECT 1 FROM import_issue WHERE snapshot_id=NEW.id AND severity='error') THEN
 RAISE EXCEPTION 'Catalog incomplete or regional semantics unverified'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER catalog_guard BEFORE INSERT OR UPDATE OR DELETE ON catalog_snapshot FOR EACH ROW EXECUTE FUNCTION guard_catalog_snapshot();
CREATE FUNCTION publish_catalog(snapshot bigint) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=repaircalc,pg_catalog AS $$
DECLARE s catalog_snapshot;
BEGIN
 PERFORM pg_advisory_xact_lock(90420261023);
 SELECT * INTO STRICT s FROM catalog_snapshot WHERE id=snapshot FOR UPDATE;
 IF s.status<>'loading' THEN RAISE EXCEPTION 'Only loading snapshots can be published'; END IF;
 UPDATE catalog_snapshot SET status='published',published_at=now() WHERE id=snapshot;
 INSERT INTO catalog_head(source_id,region_id,snapshot_id) VALUES(s.source_id,s.region_id,s.id)
 ON CONFLICT(source_id,region_id) DO UPDATE SET snapshot_id=excluded.snapshot_id;
END $$;
CREATE FUNCTION guard_proposal() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM product_card WHERE id=NEW.card_id AND product_key=NEW.product_key) THEN RAISE EXCEPTION 'Proposal product/card mismatch'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER proposal_guard BEFORE INSERT ON mapping_proposal FOR EACH ROW EXECUTE FUNCTION guard_proposal();
CREATE FUNCTION guard_observation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP<>'INSERT' AND OLD.review_status<>'pending' THEN RAISE EXCEPTION 'Reviewed observation is immutable'; END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER observation_guard BEFORE UPDATE OR DELETE ON labor_observation FOR EACH ROW EXECUTE FUNCTION guard_observation();
CREATE FUNCTION guard_rate_member() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE vid bigint; state text;
BEGIN
 IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'Delete and reinsert draft members'; END IF;
 vid:=CASE WHEN TG_OP='DELETE' THEN OLD.version_id ELSE NEW.version_id END;
 SELECT status INTO state FROM labor_rate_version WHERE id=vid FOR UPDATE;
 IF state<>'draft' THEN RAISE EXCEPTION 'Published rates are immutable'; END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER rate_member_guard BEFORE INSERT OR UPDATE OR DELETE ON labor_rate_member FOR EACH ROW EXECUTE FUNCTION guard_rate_member();
CREATE FUNCTION guard_rates() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP<>'INSERT' AND OLD.status='published' THEN RAISE EXCEPTION 'Published rates are immutable'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 IF NEW.status='published' AND (
 NOT EXISTS(SELECT 1 FROM labor_rate_member WHERE version_id=NEW.id)
 OR EXISTS(SELECT 1 FROM labor_rate_member m JOIN labor_observation o ON o.id=m.observation_id
 WHERE m.version_id=NEW.id AND (o.city_code<>NEW.city_code OR o.review_status<>'approved' OR o.materials_included IS DISTINCT FROM false)))
 THEN RAISE EXCEPTION 'Rates require approved, comparable city observations excluding materials'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER rate_guard BEFORE INSERT OR UPDATE OR DELETE ON labor_rate_version FOR EACH ROW EXECUTE FUNCTION guard_rates();
CREATE FUNCTION guard_estimate_child() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE eid uuid; state text;
BEGIN
 IF TG_OP='UPDATE' AND NEW.estimate_id<>OLD.estimate_id THEN RAISE EXCEPTION 'Cannot move estimate rows'; END IF;
 eid:=CASE WHEN TG_OP='DELETE' THEN OLD.estimate_id ELSE NEW.estimate_id END;
 SELECT e.state INTO state FROM estimate e WHERE id=eid FOR UPDATE;
 IF state<>'draft' THEN RAISE EXCEPTION 'Final estimate is immutable'; END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['estimate_room','estimate_material_line','estimate_material_allocation','estimate_labor_line'] LOOP
 EXECUTE format('CREATE TRIGGER estimate_guard BEFORE INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION guard_estimate_child()',t);
 END LOOP;
END $$;
CREATE FUNCTION guard_estimate_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE state text; lid bigint;
BEGIN
 IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'Delete and reinsert draft evidence'; END IF;
 lid:=CASE WHEN TG_OP='DELETE' THEN OLD.line_id ELSE NEW.line_id END;
 SELECT e.state INTO state FROM estimate e JOIN estimate_labor_line l ON l.estimate_id=e.id WHERE l.id=lid FOR UPDATE OF e;
 IF state<>'draft' THEN RAISE EXCEPTION 'Final estimate evidence is immutable'; END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER estimate_evidence_guard BEFORE INSERT OR UPDATE OR DELETE ON estimate_labor_evidence FOR EACH ROW EXECUTE FUNCTION guard_estimate_evidence();
CREATE FUNCTION guard_estimate() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE mt numeric; ll numeric; lu numeric;
BEGIN
 IF TG_OP<>'INSERT' AND OLD.state='final' THEN RAISE EXCEPTION 'Final estimate is immutable'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 IF NEW.state='final' THEN
 IF NOT EXISTS(SELECT 1 FROM catalog_snapshot WHERE id=NEW.catalog_snapshot_id AND status='published') THEN RAISE EXCEPTION 'Estimate needs published catalog'; END IF;
 IF NEW.labor_version_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM labor_rate_version WHERE id=NEW.labor_version_id AND status='published') THEN RAISE EXCEPTION 'Estimate needs published rates'; END IF;
 IF EXISTS(SELECT 1 FROM estimate_material_line l JOIN product_card c ON c.id=l.card_id JOIN formula_version f ON f.id=l.formula_id
 WHERE l.estimate_id=NEW.id AND (c.snapshot_id<>NEW.catalog_snapshot_id OR f.taxonomy_version<>NEW.taxonomy_version
 OR c.result_price IS DISTINCT FROM l.unit_price OR c.sale_unit<>l.sale_unit OR c.currency<>NEW.currency)) THEN RAISE EXCEPTION 'Material provenance mismatch'; END IF;
 IF EXISTS(SELECT 1 FROM estimate_material_line l JOIN consumption_parameter p ON p.id=l.consumption_parameter_id
 WHERE l.estimate_id=NEW.id AND (p.card_id<>l.card_id OR p.formula_id<>l.formula_id)) THEN RAISE EXCEPTION 'Consumption parameter mismatch'; END IF;
 IF EXISTS(SELECT 1 FROM estimate_labor_line l WHERE l.estimate_id=NEW.id AND (l.taxonomy_version<>NEW.taxonomy_version
 OR (l.price_kind<>'unknown' AND NOT EXISTS(SELECT 1 FROM estimate_labor_evidence WHERE line_id=l.id)))) THEN RAISE EXCEPTION 'Labor provenance missing'; END IF;
 IF EXISTS(SELECT 1 FROM estimate_labor_line l JOIN estimate_labor_evidence e ON e.line_id=l.id JOIN labor_observation o ON o.id=e.observation_id
 JOIN catalog_snapshot cs ON cs.id=NEW.catalog_snapshot_id JOIN catalog_region cr ON cr.id=cs.region_id
 WHERE l.estimate_id=NEW.id AND (NOT EXISTS(SELECT 1 FROM labor_rate_member WHERE version_id=NEW.labor_version_id AND observation_id=o.id)
 OR o.taxonomy_version<>l.taxonomy_version OR o.work_code<>l.work_code OR o.unit_code<>l.unit_code OR o.price_kind<>l.price_kind
 OR o.currency<>NEW.currency OR o.city_code IS DISTINCT FROM cr.city_code)) THEN RAISE EXCEPTION 'Labor evidence/version/unit/city mismatch'; END IF;
 SELECT CASE WHEN count(*) FILTER(WHERE line_total IS NULL)>0 THEN NULL ELSE coalesce(sum(line_total),0) END INTO mt FROM estimate_material_line WHERE estimate_id=NEW.id;
 SELECT CASE WHEN count(*) FILTER(WHERE total_lower IS NULL)>0 THEN NULL ELSE coalesce(sum(total_lower),0) END,
 CASE WHEN count(*) FILTER(WHERE total_upper IS NULL)>0 THEN NULL ELSE coalesce(sum(total_upper),0) END INTO ll,lu FROM estimate_labor_line WHERE estimate_id=NEW.id;
 IF NEW.materials_total IS DISTINCT FROM mt OR NEW.labor_lower IS DISTINCT FROM ll OR NEW.labor_upper IS DISTINCT FROM lu THEN RAISE EXCEPTION 'Estimate totals do not match lines'; END IF;
 IF NEW.calculation_status='complete' AND (mt IS NULL OR ll IS NULL OR lu IS NULL OR NEW.missing_data<>'[]'::jsonb
 OR NOT EXISTS(SELECT 1 FROM estimate_material_line WHERE estimate_id=NEW.id)) THEN RAISE EXCEPTION 'Complete estimate has missing data'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER estimate_guard BEFORE INSERT OR UPDATE OR DELETE ON estimate FOR EACH ROW EXECUTE FUNCTION guard_estimate();

INSERT INTO unit(code,name) VALUES ('m2','квадратный метр'),('m','метр'),('l','литр'),('kg','килограмм'),('piece','штука'),('pack','упаковка'),('roll','рулон');
INSERT INTO city(code,name,country_code) VALUES ('ru-spb','Санкт-Петербург','RU');
REVOKE ALL ON SCHEMA repaircalc FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA repaircalc FROM PUBLIC;
GRANT USAGE ON SCHEMA repaircalc TO repaircalc_app,repaircalc_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA repaircalc TO repaircalc_app,repaircalc_reader;
GRANT INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA repaircalc TO repaircalc_app;
REVOKE INSERT,UPDATE,DELETE ON catalog_head,unit,city FROM repaircalc_app;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA repaircalc TO repaircalc_app;
GRANT EXECUTE ON FUNCTION publish_catalog(bigint) TO repaircalc_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA repaircalc GRANT SELECT ON TABLES TO repaircalc_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA repaircalc GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO repaircalc_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA repaircalc GRANT USAGE,SELECT ON SEQUENCES TO repaircalc_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA repaircalc REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
RESET ROLE;
