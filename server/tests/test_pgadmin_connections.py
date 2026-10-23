"""Log in through pgAdmin HTTP and connect both registered PostgreSQL servers.

Passwords are read locally, never printed or saved by pgAdmin during this check.
"""
import datetime as dt
import http.cookiejar
import json
from pathlib import Path
import re
import subprocess
import urllib.error
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
BASE = 'http://127.0.0.1:5443'


def main():
    passwords = json.loads((ROOT / '.secrets/credentials.json').read_text())
    query = """import json,sqlite3
c=sqlite3.connect('/var/lib/pgadmin/pgadmin4.db')
c.row_factory=sqlite3.Row
rows=c.execute("SELECT id,servergroup_id,name,username,connection_params FROM server WHERE host='postgres' AND maintenance_db='repaircalc' AND username IN ('repaircalc_app','repaircalc_reader')").fetchall()
print(json.dumps([dict(r) for r in rows]))
"""
    output = subprocess.check_output(
        ['docker', 'compose', 'exec', '-T', 'pgadmin', '/venv/bin/python3', '-c', query],
        cwd=ROOT,
    )
    servers = json.loads(output)
    assert len(servers) == 2
    cookies = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(
        urllib.request.ProxyHandler({}), urllib.request.HTTPCookieProcessor(cookies),
    )

    def request(path, body=None, headers=None):
        req = urllib.request.Request(BASE + path, data=body, headers=headers or {})
        try:
            return opener.open(req, timeout=20)
        except urllib.error.HTTPError as error:
            text = error.read().decode('utf-8', errors='replace')
            for password in passwords.values():
                text = text.replace(password, '[REDACTED]')
            raise AssertionError(f'{path}: HTTP {error.code}: {text[:1200]}') from None

    def csrf(html):
        match = re.search(r'"csrfToken":\s*"([^"]+)"', html)
        assert match, 'No pgAdmin CSRF token'
        return match.group(1)

    with request('/login') as response:
        token = csrf(response.read().decode())
    form = urllib.parse.urlencode({
        'email': 'admin@repaircalc.dev', 'password': passwords['pgadmin'],
        'language': 'ru', 'csrf_token': token,
    }).encode()
    with request('/authenticate/login', form, {
        'Content-Type': 'application/x-www-form-urlencoded', 'Referer': BASE + '/login',
    }) as response:
        assert '/browser/' in response.url, 'Login did not reach the authorized browser'
        html = response.read().decode()
    # The browser shell loads its config through JS; the login session token
    # remains valid for CSRF-protected API calls after authentication.
    results = []
    for server in servers:
        params = json.loads(server['connection_params'])
        assert params['sslmode'] == 'disable'
        assert not any(params.get(k) for k in ['sslrootcert', 'sslcert', 'sslkey'])
        key = 'postgres_' + server['username'].removeprefix('repaircalc_')
        body = json.dumps({'password': passwords[key], 'save_password': False}).encode()
        path = f"/browser/server/connect/{server['servergroup_id']}/{server['id']}"
        with request(path, body, {
            'Content-Type': 'application/json', 'X-pgA-CSRFToken': token,
            'Referer': BASE + '/browser/',
        }) as response:
            payload = json.load(response)
        assert payload.get('success') == 1, f"Connection failed for {server['username']}"
        results.append({'username': server['username'], 'sslmode': 'disable', 'status': 'connected'})
    report = {
        'checked_at': dt.datetime.now(dt.timezone.utc).isoformat(),
        'pgadmin_http_login': 'passed', 'connections': results,
    }
    (ROOT / 'docs/pgadmin-connection-test.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('pgAdmin HTTP login and both registered PostgreSQL connections passed (sslmode=disable).')


if __name__ == '__main__':
    main()
