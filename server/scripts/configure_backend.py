"""Prepare the ignored Spring configuration using existing local credentials."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main():
    directory = ROOT / '.secrets'
    password = json.loads((directory / 'credentials.json').read_text())['postgres_app']
    # Escape Java properties metacharacters, including passwords supplied by the owner.
    escaped = ''.join('\\u%04x' % ord(c) if ord(c) > 126 or c in '\\ \t\r\n:=#!' else c for c in password)
    target = directory / 'backend.properties'
    existing = target.read_text(encoding='ascii').splitlines() if target.exists() else []
    kept = [line for line in existing if not line.lstrip().startswith('DB_PASSWORD=')]
    target.write_text('\n'.join([*kept, 'DB_PASSWORD=' + escaped, '']), encoding='ascii')
    print('Backend credentials configured locally; no secrets printed.')


if __name__ == '__main__':
    main()
