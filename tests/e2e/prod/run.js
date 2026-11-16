// Point d'entrée multiplateforme de la recette e2e prod.
//   node tests/e2e/prod/run.js setup     -> crée les comptes jetables
//   node tests/e2e/prod/run.js scenario  -> joue la recette puis nettoie toujours (même en cas d'échec) ; --keep garde les comptes
//   node tests/e2e/prod/run.js teardown  -> nettoie seulement
const { spawnSync } = require('child_process');
const path = require('path');

const mode = process.argv[2];
const keep = process.argv.includes('--keep') || process.env.E2E_KEEP === '1';
const extra = process.argv.slice(3).filter((a) => a !== '--keep');
const env = { ...process.env, E2E_PROD: '1', E2E_BASE_URL: process.env.E2E_BASE_URL || 'https://loveink.site' };
const root = path.resolve(__dirname, '../../..');

function run(cmd, args, shell = false) {
    const out = spawnSync(cmd, args, { cwd: root, env, stdio: 'inherit', shell });
    return out.status ?? 1;
}

const playwright = (spec) => run('npx', ['playwright', 'test', `tests/e2e/prod/${spec}`, '--workers=1', '--reporter=list', ...extra], process.platform === 'win32');
const teardown = () => run(process.execPath, [path.join(__dirname, 'teardown.js')]);

let status;
if (mode === 'setup') status = playwright('setup.spec.js');
else if (mode === 'scenario') {
    const tests = playwright('scenario.spec.js');
    const clean = keep ? 0 : teardown();
    status = tests || clean;
} else if (mode === 'teardown') status = teardown();
else {
    console.error('Usage : node tests/e2e/prod/run.js <setup|scenario|teardown>');
    status = 2;
}
process.exit(status);
