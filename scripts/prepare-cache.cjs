// Bootstrap dependencies from the pre-existing local npm cache in restricted environments.
const { createRequire } = require('node:module');
const requireNpm = createRequire('C:/Program Files/nodejs/node_modules/npm/package.json');
const cacache = requireNpm('cacache');
const semver = requireNpm('semver');
const path = require('node:path');
const source = path.join(process.env.LOCALAPPDATA, 'npm-cache/_cacache');
const target = path.resolve('.cache/npm/_cacache');
const prefix = 'make-fetch-happen:request-cache:https://registry.npmjs.org/';
const done = new Set();
async function main() {
  const entries = await cacache.ls(source);
  async function copy(key) {
    const result = await cacache.get(source, key);
    if (!key.endsWith('.tgz')) {
      const packument = JSON.parse(result.data);
      packument.versions = Object.fromEntries(
        Object.entries(packument.versions).filter(
          ([, pkg]) => entries['make-fetch-happen:request-cache:' + pkg.dist?.tarball],
        ),
      );
      const latest = semver.maxSatisfying(Object.keys(packument.versions), '*');
      if (latest) packument['dist-tags'] = { latest };
      result.data = Buffer.from(JSON.stringify(packument));
    }
    const metadata = {
      ...result.metadata,
      reqHeaders: {
        ...result.metadata?.reqHeaders,
        accept: key.endsWith('.tgz') ? '*/*' : 'application/json',
      },
      resHeaders: { ...result.metadata?.resHeaders, vary: '' },
    };
    await cacache.put(target, key, result.data, { metadata });
    return result.data;
  }
  async function visit(name, range) {
    const key = Object.keys(entries).find(
      (k) => k.toLowerCase() === (prefix + name.replace('/', '%2f')).toLowerCase(),
    );
    if (!key) throw new Error('Missing metadata: ' + name);
    const meta = JSON.parse(await copy(key));
    const versions = Object.keys(meta.versions).filter((v) => {
      const tar = meta.versions[v].dist?.tarball;
      return semver.satisfies(v, range) && entries['make-fetch-happen:request-cache:' + tar];
    });
    const version = semver.maxSatisfying(versions, range);
    if (!version) throw new Error('Missing cached version: ' + name + '@' + range);
    if (done.has(name + '@' + version)) return;
    done.add(name + '@' + version);
    const pkg = meta.versions[version];
    await copy('make-fetch-happen:request-cache:' + pkg.dist.tarball);
    for (const [dep, constraint] of Object.entries(pkg.dependencies || {})) await visit(dep, constraint);
    for (const [dep, constraint] of Object.entries(pkg.optionalDependencies || {})) {
      if (/linux|darwin|android|freebsd|openbsd|sunos|aix|arm|ia32/.test(dep)) continue;
      try {
        await visit(dep, constraint);
      } catch {
        /* Optional platform packages. */
      }
    }
  }
  const pkg = require('../package.json');
  for (const [name, range] of Object.entries({ ...pkg.dependencies, ...pkg.devDependencies }))
    await visit(name, range);
  console.log('Prepared ' + done.size + ' cached packages.');
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
