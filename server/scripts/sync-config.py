"""Populate Docker named config volumes without Windows bind mounts."""
from pathlib import Path
import shutil
import stat
import subprocess
import uuid

ROOT = Path(__file__).resolve().parents[1]

def docker(*args):
    subprocess.run(['docker', *args], check=True, stdout=subprocess.PIPE)

def main():
    staging = ROOT / '.secrets' / 'staging'
    specifications = {
        'postgres': [('config/postgresql.conf','postgresql.conf'), ('config/pg_hba.conf','pg_hba.conf'), ('.secrets/bootstrap.sql','bootstrap.sql'), ('.secrets/postgres_admin_password','postgres_admin_password')],
        'redis': [('config/redis.conf','redis.conf'), ('.secrets/users.acl','users.acl'), ('.secrets/redis_health_password','redis_health_password')],
        'pgadmin': [('config/servers.json','servers.json'), ('.secrets/pgadmin_password','pgadmin_password')]
    }
    for service, files in specifications.items():
        directory = staging / service
        directory.mkdir(parents=True, exist_ok=True)
        for source, destination in files:
            shutil.copyfile(ROOT / source, directory / destination)
        # Remove legacy TLS files from the managed staging folder.
        for legacy in ['ca.crt', 'server.crt', 'server.cert', 'server.key', 'trust/ca.crt']:
            (directory / legacy).unlink(missing_ok=True)
        if (directory / 'trust').is_dir():
            (directory / 'trust').chmod(stat.S_IRWXU)
            (directory / 'trust').rmdir()
        volume = 'repaircalc-db_' + service + '_config'
        docker('volume','create',volume)
        helper = 'repaircalc-config-' + uuid.uuid4().hex[:10]
        owner = {'pgadmin': '5050:5050', 'redis': '999:1000', 'postgres': '70:70'}[service]
        permissions = ('rm -f /target/ca.crt /target/server.crt /target/server.cert /target/server.key /target/trust/ca.crt\n'
                       'if [ -d /target/trust ]; then rmdir /target/trust; fi\n'
                       f'chown -R {owner} /target && chmod -R u=rwX,go= /target')
        docker('create','--name',helper,'--mount',f'type=volume,src={volume},dst=/target','--entrypoint','sh','postgres:17.11-alpine','-ec',permissions)
        try:
            docker('cp',str(directory) + '/.',helper + ':/target/')
            docker('start','-a',helper)
        finally:
            docker('rm',helper)
    print('Configuration copied into project-specific Docker volumes.')

if __name__=='__main__': main()
