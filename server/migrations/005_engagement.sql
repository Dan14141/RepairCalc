SET ROLE repaircalc_owner;
SET search_path = repaircalc, pg_catalog;

CREATE TABLE engagement_events (
    id uuid PRIMARY KEY,
    visitor_id uuid NOT NULL,
    kind text NOT NULL CHECK (kind IN ('share', 'rating')),
    project_id text,
    method text,
    rating smallint,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    CHECK (
        (kind = 'share' AND project_id IS NOT NULL AND length(trim(project_id)) BETWEEN 1 AND 200
            AND method IS NOT NULL AND method IN ('native', 'clipboard') AND rating IS NULL)
        OR (kind = 'rating' AND rating IS NOT NULL AND rating BETWEEN 1 AND 5
            AND project_id IS NULL AND method IS NULL)
    )
);
GRANT SELECT, INSERT ON engagement_events TO repaircalc_app;
GRANT SELECT ON engagement_events TO repaircalc_reader;
RESET ROLE;
