"""One-time local bootstrap. Requires: pip install -r requirements-tools.txt."""
import hashlib
import json
from pathlib import Path
import secrets

ROOT = Path(__file__).resolve().parents[1]

def main():
    directory = ROOT / '.secrets'
    if directory.exists():
        raise SystemExit('.secrets already exists; credentials were not overwritten')
    directory.mkdir(parents=True)
    passwords = {name: secrets.token_hex(24) for name in ['postgres_admin', 'postgres_app', 'postgres_reader', 'postgres_migrator', 'pgadmin', 'redis_app', 'redis_admin', 'redis_health']}
    for name, value in passwords.items():
        (directory / (name + '_password')).write_text(value, encoding='ascii')
    (directory / 'credentials.json').write_text(json.dumps(passwords, indent=2), encoding='ascii')
    bootstrap = """REVOKE CONNECT,TEMPORARY ON DATABASE repaircalc FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
CREATE ROLE repaircalc_owner NOLOGIN;
"""
    for role, key in [('repaircalc_app', 'postgres_app'), ('repaircalc_reader', 'postgres_reader'), ('repaircalc_migrator', 'postgres_migrator')]:
        bootstrap += f"CREATE ROLE {role} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD '{passwords[key]}';\n"
        bootstrap += f"GRANT CONNECT ON DATABASE repaircalc TO {role};\nALTER ROLE {role} SET search_path=repaircalc,pg_catalog;\n"
    bootstrap += 'GRANT repaircalc_owner TO repaircalc_migrator;\nGRANT CREATE ON DATABASE repaircalc TO repaircalc_owner;\n'
    (directory / 'bootstrap.sql').write_text(bootstrap, encoding='utf-8')
    digest = lambda k: '#' + hashlib.sha256(passwords[k].encode()).hexdigest()
    acl = 'user default off\n'
    acl += f"user admin on {digest('redis_admin')} ~* &* +@all\n"
    acl += f"user app on {digest('redis_app')} ~repaircalc:* &repaircalc:* +@read +@write +@connection +@transaction -@dangerous -keys -flushdb -flushall -config -acl -module -shutdown -migrate -restore -sort -sort_ro -copy -move -swapdb\n"
    acl += f"user health on {digest('redis_health')} -@all +ping\n"
    (directory / 'users.acl').write_text(acl, encoding='ascii')
    if not (ROOT / '.env').exists():
        (ROOT / '.env').write_bytes((ROOT / '.env.example').read_bytes())
    report = ['# RepairCalc — private connection details', '', 'Не публиковать этот файл. Для коллег передавать только нужную учётную запись.', '']
    for name, password in passwords.items():
        report.append(f'- {name}: `{password}`')
    report.extend(['', 'PostgreSQL: host 94.19.3.127, port 5433, database repaircalc, user repaircalc_app / repaircalc_reader, sslmode=disable.', 'Redis: host 94.19.3.127, port 6380, username app, TLS disabled, password required.', 'pgAdmin: http://94.19.3.127:5443, login admin@repaircalc.dev.', 'Доступ через интернет подтверждается отдельно после проброса портов.', ''])
    (ROOT / 'CONNECTIONS.private.md').write_text('\n'.join(report), encoding='utf-8')
    print('Created password credentials. Secrets were saved locally, not printed.')

if __name__ == '__main__':
    main()
