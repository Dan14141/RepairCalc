SET ROLE repaircalc_owner;
SET search_path = repaircalc, pg_catalog;

-- Keep the supplied export intact, including conflicting duplicate SKUs.
CREATE TABLE maxidom_import (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 sha256 text NOT NULL UNIQUE CHECK (sha256 ~ '^[0-9a-f]{64}$'),
 source_name text NOT NULL, row_count integer NOT NULL CHECK (row_count > 0),
 report jsonb NOT NULL, imported_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE maxidom_raw_product (
 import_id bigint NOT NULL REFERENCES maxidom_import(id),
 row_number integer NOT NULL, payload jsonb NOT NULL,
 PRIMARY KEY (import_id, row_number)
);
CREATE TABLE products (
 id text PRIMARY KEY, name text NOT NULL, brand text NOT NULL,
 category text NOT NULL CHECK (category IN ('floor','walls','prep','electric','other')),
 price numeric(18,2) NOT NULL CHECK (price >= 0 AND price < 10000000000000000),
 unit text NOT NULL, coverage double precision NOT NULL CHECK (coverage >= 0 AND coverage < 1000000),
 color text NOT NULL, texture text NOT NULL, wet boolean NOT NULL, heavy boolean NOT NULL,
 rating text NOT NULL, description text NOT NULL,
 source_category text NOT NULL, url text NOT NULL,
 import_id bigint NOT NULL, source_row integer NOT NULL,
 FOREIGN KEY (import_id, source_row) REFERENCES maxidom_raw_product(import_id, row_number)
);
CREATE INDEX products_calculable ON products(category,id) WHERE coverage > 0;
CREATE INDEX products_price ON products(price,id);
CREATE TABLE app_workspace (
 id integer PRIMARY KEY CHECK (id = 1), payload jsonb NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT,INSERT ON maxidom_import,maxidom_raw_product TO repaircalc_app;
GRANT SELECT,INSERT,UPDATE ON products,app_workspace TO repaircalc_app;
GRANT SELECT ON maxidom_import,maxidom_raw_product,products,app_workspace TO repaircalc_reader;
GRANT USAGE,SELECT ON SEQUENCE maxidom_import_id_seq TO repaircalc_app;
RESET ROLE;
