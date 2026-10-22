/**
 * Builds what Azure App Service (Linux, Node 22) needs, into ./deploy (git-ignored):
 *   deploy/hisaab-api.zip          compiled server + production node_modules → upload as is
 *   deploy/appsettings.azure.json  your .env as App Service settings → Environment variables › Advanced edit
 *   npx tsx scripts/pack-azure.ts
 * Prints setting names only, never values.
 */
import { execFileSync, execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseEnv } from 'node:util';

const OUT = 'deploy';
const APP = join(OUT, 'app');
const ZIP = join(OUT, 'hisaab-api.zip');

rmSync(OUT, { recursive: true, force: true });
mkdirSync(APP, { recursive: true });

console.log('1/4 compiling TypeScript → dist/');
execSync('npx tsc -p tsconfig.json', { stdio: 'inherit' });
for (const f of ['dist', 'package.json', 'package-lock.json']) cpSync(f, join(APP, f), { recursive: true });

console.log('2/4 installing production dependencies (all pure JavaScript, so a Windows install runs on Linux)');
execSync('npm ci --omit=dev --ignore-scripts --no-audit --no-fund', { cwd: APP, stdio: 'inherit' });

console.log('3/4 zipping');
const entries = ['dist', 'node_modules', 'package.json', 'package-lock.json'];
if (process.platform === 'win32') {
  // Windows' own bsdtar writes "/" separators that Linux unzips correctly (Compress-Archive may not).
  execFileSync('C:\\Windows\\System32\\tar.exe', ['-a', '-c', '-f', join('..', 'hisaab-api.zip'), ...entries], { cwd: APP });
} else {
  execFileSync('zip', ['-qr', join('..', 'hisaab-api.zip'), ...entries], { cwd: APP });
}
console.log(`    ${ZIP} (${(statSync(ZIP).size / 1e6).toFixed(1)} MB)`);

console.log('4/4 app settings from .env');
if (!existsSync('.env')) throw new Error('No .env: copy .env.example to .env and fill it in first');
const env = parseEnv(readFileSync('.env', 'utf8'));
delete env.PORT; // Azure sets its own port
const settings: Record<string, string> = {
  ...env,
  NODE_ENV: 'production',
  // Photos outside the app folder, so a redeploy never deletes them
  UPLOAD_DIR: '/home/data/uploads',
  // Demo: let "See Hisaab Pro" switch Pro on without real payments
  ALLOW_MOCK_UPGRADE: 'true',
  // The zip already has node_modules and dist: don't rebuild on Azure
  SCM_DO_BUILD_DURING_DEPLOYMENT: 'false',
};
if (!settings.JWT_SECRET || /change-me/.test(settings.JWT_SECRET)) throw new Error('Set a real JWT_SECRET in .env first');
const json = Object.entries(settings)
  .filter(([, v]) => v !== undefined && v !== '')
  .map(([name, value]) => ({ name, value, slotSetting: false }));
writeFileSync(join(OUT, 'appsettings.azure.json'), JSON.stringify(json, null, 2));
console.log(`    ${join(OUT, 'appsettings.azure.json')}: ${json.map((s) => s.name).join(', ')}`);
console.log('\nDone. Contains your secrets: never commit or share deploy/.');
