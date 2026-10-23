"""Migration and backup tools. Always scoped to the repaircalc-db Compose project."""
import argparse
import hashlib
from pathlib import Path
import subprocess
import datetime as dt

ROOT = Path(__file__).resolve().parents[1]
COMPOSE = ['docker', 'compose', '--project-directory', str(ROOT)]

def run(args, **kwargs):
    return subprocess.run(COMPOSE + args, check=True, **kwargs)

def sql(text, database='repaircalc'):
    return run(['exec', '-T', 'postgres', 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'repaircalc_admin', '-d', database], input=text.encode('utf-8'), stdout=subprocess.PIPE).stdout.decode('utf-8')

def migrate():
    statements = ["BEGIN; SET LOCAL statement_timeout='120s'; SELECT pg_advisory_xact_lock(90420261024); CREATE TABLE IF NOT EXISTS public.schema_migrations(version text PRIMARY KEY, sha256 text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now());"]
    for file in sorted((ROOT / 'migrations').glob('*.sql')):
        version = file.name
        digest = hashlib.sha256(file.read_bytes()).hexdigest()
        statements.append(f"SELECT EXISTS(SELECT 1 FROM public.schema_migrations WHERE version='{version}') AS applied \\gset\n\\if :applied\nDO $check$ BEGIN IF NOT EXISTS(SELECT 1 FROM public.schema_migrations WHERE version='{version}' AND sha256='{digest}') THEN RAISE EXCEPTION 'Applied migration checksum changed: {version}'; END IF; END $check$;\n\\else\n")
        statements.append(file.read_text(encoding='utf-8'))
        statements.append(f"INSERT INTO public.schema_migrations(version,sha256) VALUES('{version}','{digest}');\n\\endif\n")
    statements.append('COMMIT;')
    print(sql('\n'.join(statements)))

def backup():
    directory = ROOT / 'backups'
    directory.mkdir(exist_ok=True)
    name = 'repaircalc-' + dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '.dump'
    path = directory / name
    with path.open('wb') as output:
        run(['exec', '-T', 'postgres', 'pg_dump', '-U', 'repaircalc_admin', '-d', 'repaircalc', '-Fc'], stdout=output)
    print(path)
    return path

def restore_test(path):
    # Never restore into the application database. Random new database; no DROP.
    database = 'repaircalc_restore_' + dt.datetime.now(dt.timezone.utc).strftime('%Y%m%d_%H%M%S_%f')
    run(['exec', '-T', 'postgres', 'createdb', '-U', 'repaircalc_admin', database])
    with Path(path).open('rb') as source:
        run(['exec', '-T', 'postgres', 'pg_restore', '-U', 'repaircalc_admin', '-d', database, '--exit-on-error', '--single-transaction'], stdin=source)
    print(sql("SELECT version,sha256 FROM public.schema_migrations ORDER BY version; SELECT count(*) AS tables FROM information_schema.tables WHERE table_schema='repaircalc' AND table_type='BASE TABLE';", database))
    print('Restored into separate database: ' + database)
    return database

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=['migrate', 'backup', 'restore-test'])
    parser.add_argument('--file', type=Path)
    args = parser.parse_args()
    if args.action == 'migrate': migrate()
    elif args.action == 'backup': backup()
    elif args.file: restore_test(args.file)
    else: parser.error('restore-test requires --file')
