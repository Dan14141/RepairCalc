SET ROLE repaircalc_owner;
SET search_path=repaircalc,pg_catalog;
ALTER TABLE estimate ADD CONSTRAINT estimate_input_object CHECK(jsonb_typeof(input_snapshot)='object');
ALTER TABLE estimate ADD CONSTRAINT estimate_missing_array CHECK(jsonb_typeof(missing_data)='array');
CREATE FUNCTION guard_region_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM catalog_snapshot WHERE region_id=OLD.id AND status='published') THEN
 RAISE EXCEPTION 'Published catalog region is immutable'; END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER region_history_guard BEFORE UPDATE OR DELETE ON catalog_region FOR EACH ROW EXECUTE FUNCTION guard_region_history();
CREATE FUNCTION guard_final_quantities() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.state<>'final' THEN RETURN NEW; END IF;
 IF NEW.calculation_status='complete' AND (
 EXISTS(SELECT 1 FROM estimate_material_line WHERE estimate_id=NEW.id AND (need_quantity IS NULL OR need_unit IS NULL OR purchase_quantity IS NULL))
 OR EXISTS(SELECT 1 FROM estimate_labor_line WHERE estimate_id=NEW.id AND quantity IS NULL)) THEN
 RAISE EXCEPTION 'Complete estimate requires quantities and units'; END IF;
 IF EXISTS(SELECT 1 FROM estimate_material_line l WHERE l.estimate_id=NEW.id
 AND EXISTS(SELECT 1 FROM estimate_material_allocation WHERE line_id=l.id)
 AND l.need_quantity IS DISTINCT FROM (SELECT sum(need_quantity) FROM estimate_material_allocation WHERE line_id=l.id)) THEN
 RAISE EXCEPTION 'Room allocations must match material need'; END IF;
 IF EXISTS(SELECT l.id FROM estimate_labor_line l JOIN estimate_labor_evidence e ON e.line_id=l.id
 JOIN labor_observation o ON o.id=e.observation_id WHERE l.estimate_id=NEW.id
 GROUP BY l.id HAVING count(DISTINCT(o.scope,o.conditions))>1) THEN
 RAISE EXCEPTION 'Labor observations have incompatible scopes or conditions'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER final_quantity_guard BEFORE INSERT OR UPDATE ON estimate FOR EACH ROW EXECUTE FUNCTION guard_final_quantities();
CREATE FUNCTION guard_catalog_cycles() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.status='published' AND EXISTS(
 WITH RECURSIVE traversal(category_id,parent_id,path,cycle) AS (
 SELECT category_id,parent_id,ARRAY[category_id],false FROM catalog_category WHERE snapshot_id=NEW.id
 UNION ALL
 SELECT p.category_id,p.parent_id,t.path||p.category_id,p.category_id=ANY(t.path)
 FROM traversal t JOIN catalog_category p ON p.snapshot_id=NEW.id AND p.category_id=t.parent_id WHERE NOT t.cycle)
 SELECT 1 FROM traversal WHERE cycle) THEN RAISE EXCEPTION 'Catalog category cycle'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER catalog_cycles_guard BEFORE INSERT OR UPDATE ON catalog_snapshot FOR EACH ROW EXECUTE FUNCTION guard_catalog_cycles();
REVOKE ALL ON FUNCTION guard_region_history(),guard_final_quantities(),guard_catalog_cycles() FROM PUBLIC;
RESET ROLE;
