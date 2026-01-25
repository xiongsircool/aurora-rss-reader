import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, cpSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const backendDir = path.join(repoRoot, 'backend-node');
const resourcesDir = path.join(repoRoot, 'rss-desktop', 'resources', 'backend-node');
const entryFile = path.join(backendDir, 'dist', 'main.js');

function run(command, cwd) {
  execSync(command, { cwd, stdio: 'inherit' });
}

if (!existsSync(backendDir)) {
  throw new Error(`backend-node not found at ${backendDir}`);
}

const hasNodeModules = existsSync(path.join(backendDir, 'node_modules'));
const hasDist = existsSync(entryFile);

if (!hasNodeModules) {
  run('npm install', backendDir);
}

if (!hasDist) {
  run('npm run build', backendDir);
}

if (!existsSync(entryFile)) {
  throw new Error(`backend-node build missing: ${entryFile}`);
}

rmSync(resourcesDir, { recursive: true, force: true });
mkdirSync(resourcesDir, { recursive: true });
cpSync(path.join(backendDir, 'dist'), path.join(resourcesDir, 'dist'), { recursive: true });
cpSync(path.join(backendDir, 'node_modules'), path.join(resourcesDir, 'node_modules'), {
  recursive: true,
  dereference: true
});
cpSync(path.join(backendDir, 'package.json'), path.join(resourcesDir, 'package.json'));

console.log(`✅ Backend resources staged at ${resourcesDir}`);
