CREATE SCHEMA repaircalc AUTHORIZATION repaircalc_owner;
SET ROLE repaircalc_owner;
SET search_path = repaircalc, pg_catalog;

CREATE DOMAIN money_amount AS numeric(18,2) CHECK (VALUE >= 0 AND VALUE < 10000000000000000);
CREATE DOMAIN quantity_amount AS numeric(20,6) CHECK (VALUE >= 0 AND VALUE < 100000000000000);
CREATE TABLE unit (code text PRIMARY KEY, name text NOT NULL);
CREATE TABLE city (code text PRIMARY KEY, name text NOT NULL, country_code text NOT NULL);
CREATE TABLE catalog_source (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, code text NOT NULL UNIQUE,
 base_url text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE catalog_region (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 source_id bigint NOT NULL REFERENCES catalog_source(id), external_id text NOT NULL,
 name text NOT NULL, city_code text REFERENCES city(code), raw_response jsonb NOT NULL,
 fetched_at timestamptz NOT NULL, UNIQUE(source_id,external_id), UNIQUE(id,source_id)
);
CREATE TABLE catalog_snapshot (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 source_id bigint NOT NULL REFERENCES catalog_source(id), version text NOT NULL,
 region_id bigint NOT NULL, region_semantics_verified boolean NOT NULL DEFAULT false,
 status text NOT NULL DEFAULT 'loading' CHECK(status IN ('loading','failed','published')),
 expected_cards bigint CHECK(expected_cards > 0), failed_pages bigint NOT NULL DEFAULT 0 CHECK(failed_pages >= 0),
 quality_report jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(), published_at timestamptz,
 FOREIGN KEY(region_id,source_id) REFERENCES catalog_region(id,source_id),
 UNIQUE(source_id,version), UNIQUE(id,source_id), UNIQUE(id,source_id,region_id),
 CHECK ((status='published') = (published_at IS NOT NULL))
);
CREATE INDEX catalog_snapshot_region ON catalog_snapshot(region_id,created_at DESC);
CREATE TABLE catalog_head (
 source_id bigint NOT NULL, region_id bigint NOT NULL, snapshot_id bigint NOT NULL,
 PRIMARY KEY(source_id,region_id),
 FOREIGN KEY(snapshot_id,source_id,region_id) REFERENCES catalog_snapshot(id,source_id,region_id)
);
CREATE INDEX catalog_head_snapshot ON catalog_head(snapshot_id);
CREATE TABLE product (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 source_id bigint NOT NULL REFERENCES catalog_source(id), product_id text NOT NULL CHECK(product_id<>''),
 UNIQUE(source_id,product_id), UNIQUE(id,source_id)
);
CREATE TABLE product_card (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 snapshot_id bigint NOT NULL, source_id bigint NOT NULL, product_key bigint NOT NULL,
 sku text, cod_good text, name text NOT NULL CHECK(name<>''), description text,
 result_price money_amount, currency text CHECK(currency ~ '^[A-Z]{3}$'),
 sale_unit text REFERENCES unit(code), package_quantity quantity_amount CHECK(package_quantity > 0),
 package_area quantity_amount CHECK(package_area > 0), in_stock boolean,
 full_card_received boolean NOT NULL DEFAULT false, attributes jsonb NOT NULL DEFAULT '{}',
 raw_list_response jsonb, raw_card_response jsonb, fetched_at timestamptz NOT NULL,
 FOREIGN KEY(snapshot_id,source_id) REFERENCES catalog_snapshot(id,source_id),
 FOREIGN KEY(product_key,source_id) REFERENCES product(id,source_id),
 UNIQUE(snapshot_id,product_key), UNIQUE(id,snapshot_id),
 CHECK(result_price IS NULL OR (currency IS NOT NULL AND sale_unit IS NOT NULL)),
 CHECK(NOT full_card_received OR raw_card_response IS NOT NULL)
);
CREATE INDEX product_card_product ON product_card(product_key,snapshot_id DESC);
CREATE INDEX product_card_source ON product_card(source_id);
CREATE TABLE catalog_category (
 snapshot_id bigint NOT NULL REFERENCES catalog_snapshot(id), category_id text NOT NULL,
 parent_id text, name text NOT NULL, raw_response jsonb NOT NULL,
 PRIMARY KEY(snapshot_id,category_id), CHECK(parent_id IS DISTINCT FROM category_id),
 FOREIGN KEY(snapshot_id,parent_id) REFERENCES catalog_category(snapshot_id,category_id) DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX catalog_category_parent ON catalog_category(snapshot_id,parent_id);
CREATE TABLE product_category (
 card_id bigint NOT NULL, snapshot_id bigint NOT NULL, category_id text NOT NULL,
 PRIMARY KEY(card_id,category_id),
 FOREIGN KEY(card_id,snapshot_id) REFERENCES product_card(id,snapshot_id),
 FOREIGN KEY(snapshot_id,category_id) REFERENCES catalog_category(snapshot_id,category_id)
);
CREATE INDEX product_category_category ON product_category(snapshot_id,category_id);
CREATE TABLE product_stock (
 card_id bigint NOT NULL REFERENCES product_card(id), region_id bigint NOT NULL REFERENCES catalog_region(id),
 warehouse_id text NOT NULL, quantity quantity_amount, raw_response jsonb NOT NULL,
 PRIMARY KEY(card_id,region_id,warehouse_id)
);
CREATE INDEX product_stock_region ON product_stock(region_id);
CREATE TABLE import_issue (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, snapshot_id bigint NOT NULL REFERENCES catalog_snapshot(id),
 severity text NOT NULL CHECK(severity IN ('warning','error')), code text NOT NULL,
 source_path text, details jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX import_issue_snapshot ON import_issue(snapshot_id,severity);

CREATE TABLE taxonomy_version (version text PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now(), description text NOT NULL);
CREATE TABLE work_type (
 taxonomy_version text NOT NULL REFERENCES taxonomy_version(version), code text NOT NULL,
 name text NOT NULL, unit_code text NOT NULL REFERENCES unit(code), PRIMARY KEY(taxonomy_version,code)
);
CREATE INDEX work_type_unit ON work_type(unit_code);
CREATE TABLE model_version (
 version text PRIMARY KEY, artifact_uri text NOT NULL, artifact_sha256 text NOT NULL CHECK(artifact_sha256 ~ '^[0-9a-f]{64}$'),
 manifest jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE mapping_proposal (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, product_key bigint NOT NULL REFERENCES product(id),
 card_id bigint NOT NULL REFERENCES product_card(id), taxonomy_version text NOT NULL, work_code text NOT NULL,
 model_version text NOT NULL REFERENCES model_version(version), confidence numeric(7,6) NOT NULL CHECK(confidence BETWEEN 0 AND 1),
 explanation jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(taxonomy_version,work_code) REFERENCES work_type(taxonomy_version,code),
 UNIQUE(card_id,taxonomy_version,work_code,model_version)
);
CREATE INDEX mapping_proposal_product ON mapping_proposal(product_key,taxonomy_version,work_code,id DESC);
CREATE INDEX mapping_proposal_work ON mapping_proposal(taxonomy_version,work_code);
CREATE INDEX mapping_proposal_model ON mapping_proposal(model_version);
CREATE TABLE manual_mapping_decision (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, product_key bigint NOT NULL REFERENCES product(id),
 taxonomy_version text NOT NULL, work_code text NOT NULL,
 decision text NOT NULL CHECK(decision IN ('approved','rejected')),
 actor text NOT NULL CHECK(actor<>''), reason text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(taxonomy_version,work_code) REFERENCES work_type(taxonomy_version,code)
);
CREATE INDEX manual_mapping_latest ON manual_mapping_decision(product_key,taxonomy_version,work_code,id DESC);
CREATE INDEX manual_mapping_work ON manual_mapping_decision(taxonomy_version,work_code);
CREATE VIEW effective_manual_mapping AS
 SELECT DISTINCT ON(product_key,taxonomy_version,work_code) id,product_key,taxonomy_version,work_code,decision,actor,reason,created_at
 FROM manual_mapping_decision ORDER BY product_key,taxonomy_version,work_code,id DESC;
CREATE TABLE formula_version (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, code text NOT NULL, version text NOT NULL,
 taxonomy_version text NOT NULL, work_code text NOT NULL, implementation_sha256 text NOT NULL CHECK(implementation_sha256 ~ '^[0-9a-f]{64}$'),
 input_contract jsonb NOT NULL, rounding_policy jsonb NOT NULL, description text NOT NULL,
 FOREIGN KEY(taxonomy_version,work_code) REFERENCES work_type(taxonomy_version,code), UNIQUE(code,version)
);
CREATE INDEX formula_version_work ON formula_version(taxonomy_version,work_code);
CREATE TABLE consumption_parameter (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, card_id bigint NOT NULL REFERENCES product_card(id),
 formula_id bigint NOT NULL REFERENCES formula_version(id), version text NOT NULL,
 parameters jsonb NOT NULL, evidence_uri text NOT NULL, approved_by text NOT NULL CHECK(approved_by<>''),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(card_id,formula_id,version)
);
CREATE INDEX consumption_parameter_formula ON consumption_parameter(formula_id);
CREATE TABLE labor_contractor (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, name text NOT NULL, independent_key text NOT NULL UNIQUE);
CREATE TABLE labor_source (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, contractor_id bigint NOT NULL REFERENCES labor_contractor(id),
 url text NOT NULL CHECK(url ~ '^https?://'), UNIQUE(contractor_id,url)
);
CREATE TABLE labor_observation (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, source_id bigint NOT NULL REFERENCES labor_source(id),
 city_code text NOT NULL REFERENCES city(code), taxonomy_version text NOT NULL, work_code text NOT NULL,
 unit_code text NOT NULL REFERENCES unit(code), scope text NOT NULL CHECK(scope<>''), conditions jsonb NOT NULL,
 price_kind text NOT NULL CHECK(price_kind IN ('fixed','from')), price money_amount NOT NULL,
 currency text NOT NULL DEFAULT 'RUB' CHECK(currency ~ '^[A-Z]{3}$'),
 materials_included boolean, observed_at timestamptz NOT NULL, fetched_at timestamptz NOT NULL,
 evidence_uri text NOT NULL, evidence_sha256 text NOT NULL CHECK(evidence_sha256 ~ '^[0-9a-f]{64}$'),
 review_status text NOT NULL DEFAULT 'pending' CHECK(review_status IN ('pending','approved','rejected')),
 reviewed_by text, reviewed_at timestamptz,
 FOREIGN KEY(taxonomy_version,work_code) REFERENCES work_type(taxonomy_version,code),
 UNIQUE(source_id,evidence_sha256,taxonomy_version,work_code,unit_code,scope),
 CHECK(review_status='pending' OR (reviewed_by IS NOT NULL AND reviewed_by<>'' AND reviewed_at IS NOT NULL)),
 CHECK(review_status<>'approved' OR materials_included=false)
);
CREATE INDEX labor_observation_lookup ON labor_observation(city_code,taxonomy_version,work_code,unit_code,review_status);
CREATE INDEX labor_observation_work ON labor_observation(taxonomy_version,work_code);
CREATE INDEX labor_observation_unit ON labor_observation(unit_code);
CREATE TABLE labor_rate_version (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, version text NOT NULL UNIQUE,
 city_code text NOT NULL REFERENCES city(code), status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published')),
 created_at timestamptz NOT NULL DEFAULT now(), published_at timestamptz,
 CHECK((status='published')=(published_at IS NOT NULL))
);
CREATE INDEX labor_rate_version_city ON labor_rate_version(city_code);
CREATE TABLE labor_rate_member (
 version_id bigint NOT NULL REFERENCES labor_rate_version(id), observation_id bigint NOT NULL REFERENCES labor_observation(id),
 PRIMARY KEY(version_id,observation_id)
);
CREATE INDEX labor_rate_member_observation ON labor_rate_member(observation_id);

CREATE TABLE estimate (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), contract_version text NOT NULL,
 scenario text NOT NULL CHECK(scenario IN ('general','room','product')),
 state text NOT NULL DEFAULT 'draft' CHECK(state IN ('draft','final')),
 calculation_status text NOT NULL CHECK(calculation_status IN ('complete','partial','needs_input')),
 catalog_snapshot_id bigint NOT NULL REFERENCES catalog_snapshot(id),
 taxonomy_version text NOT NULL REFERENCES taxonomy_version(version), model_version text REFERENCES model_version(version),
 labor_version_id bigint REFERENCES labor_rate_version(id), currency text NOT NULL DEFAULT 'RUB' CHECK(currency ~ '^[A-Z]{3}$'),
 input_snapshot jsonb NOT NULL, missing_data jsonb NOT NULL DEFAULT '[]', rounding_policy jsonb NOT NULL,
 materials_total money_amount, labor_lower money_amount, labor_upper money_amount,
 created_at timestamptz NOT NULL DEFAULT now(), finalized_at timestamptz,
 CHECK((state='final')=(finalized_at IS NOT NULL)),
 CHECK(labor_upper IS NULL OR labor_lower IS NULL OR labor_upper>=labor_lower)
);
CREATE INDEX estimate_created ON estimate(created_at DESC);
CREATE INDEX estimate_catalog ON estimate(catalog_snapshot_id);
CREATE INDEX estimate_taxonomy ON estimate(taxonomy_version);
CREATE INDEX estimate_model ON estimate(model_version);
CREATE INDEX estimate_labor ON estimate(labor_version_id);
CREATE TABLE estimate_room (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, estimate_id uuid NOT NULL REFERENCES estimate(id),
 label text NOT NULL, room_type text NOT NULL, humidity text CHECK(humidity IN ('normal','high','unknown')),
 floor_area quantity_amount, wall_area quantity_amount, geometry jsonb NOT NULL DEFAULT '{}',
 UNIQUE(id,estimate_id)
);
CREATE INDEX estimate_room_estimate ON estimate_room(estimate_id);
CREATE TABLE estimate_material_line (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, estimate_id uuid NOT NULL REFERENCES estimate(id),
 card_id bigint NOT NULL REFERENCES product_card(id), formula_id bigint NOT NULL REFERENCES formula_version(id),
 consumption_parameter_id bigint REFERENCES consumption_parameter(id),
 product_snapshot jsonb NOT NULL, parameter_snapshot jsonb NOT NULL, calculation_trace jsonb NOT NULL,
 need_quantity quantity_amount, need_unit text REFERENCES unit(code),
 purchase_quantity quantity_amount CHECK(purchase_quantity=trunc(purchase_quantity)), sale_unit text NOT NULL REFERENCES unit(code),
 unit_price money_amount, line_total money_amount GENERATED ALWAYS AS (round(purchase_quantity*unit_price,2)) STORED,
 UNIQUE(id,estimate_id)
);
CREATE INDEX estimate_material_estimate ON estimate_material_line(estimate_id);
CREATE INDEX estimate_material_card ON estimate_material_line(card_id);
CREATE INDEX estimate_material_formula ON estimate_material_line(formula_id);
CREATE INDEX estimate_material_parameter ON estimate_material_line(consumption_parameter_id);
CREATE TABLE estimate_material_allocation (
 line_id bigint NOT NULL, room_id bigint NOT NULL, estimate_id uuid NOT NULL, need_quantity quantity_amount NOT NULL,
 PRIMARY KEY(line_id,room_id),
 FOREIGN KEY(line_id,estimate_id) REFERENCES estimate_material_line(id,estimate_id),
 FOREIGN KEY(room_id,estimate_id) REFERENCES estimate_room(id,estimate_id)
);
CREATE INDEX estimate_material_allocation_room ON estimate_material_allocation(room_id,estimate_id);
CREATE INDEX estimate_material_allocation_estimate ON estimate_material_allocation(estimate_id);
CREATE TABLE estimate_labor_line (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, estimate_id uuid NOT NULL REFERENCES estimate(id),
 room_id bigint, taxonomy_version text NOT NULL, work_code text NOT NULL,
 quantity quantity_amount, unit_code text NOT NULL REFERENCES unit(code),
 price_kind text NOT NULL CHECK(price_kind IN ('fixed','from','unknown')),
 rate_lower money_amount, rate_upper money_amount,
 total_lower money_amount GENERATED ALWAYS AS (round(quantity*rate_lower,2)) STORED,
 total_upper money_amount GENERATED ALWAYS AS (round(quantity*rate_upper,2)) STORED,
 source_snapshot jsonb NOT NULL, calculation_trace jsonb NOT NULL,
 FOREIGN KEY(room_id,estimate_id) REFERENCES estimate_room(id,estimate_id),
 FOREIGN KEY(taxonomy_version,work_code) REFERENCES work_type(taxonomy_version,code),
 CHECK((price_kind='unknown' AND rate_lower IS NULL AND rate_upper IS NULL)
    OR (price_kind='from' AND rate_lower IS NOT NULL AND rate_upper IS NULL)
    OR (price_kind='fixed' AND rate_lower IS NOT NULL AND rate_upper IS NOT NULL AND rate_upper>=rate_lower))
);
CREATE INDEX estimate_labor_estimate ON estimate_labor_line(estimate_id);
CREATE INDEX estimate_labor_room ON estimate_labor_line(room_id,estimate_id);
CREATE INDEX estimate_labor_work ON estimate_labor_line(taxonomy_version,work_code);
CREATE INDEX estimate_labor_unit ON estimate_labor_line(unit_code);
CREATE TABLE estimate_labor_evidence (
 line_id bigint NOT NULL REFERENCES estimate_labor_line(id), observation_id bigint NOT NULL REFERENCES labor_observation(id),
 PRIMARY KEY(line_id,observation_id)
);
CREATE INDEX estimate_labor_evidence_observation ON estimate_labor_evidence(observation_id);
RESET ROLE;
