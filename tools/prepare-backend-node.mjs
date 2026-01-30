import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, cpSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const backendDir = path.join(repoRoot, 'backend-node');
const resourcesDir = path.join(repoRoot, 'rss-desktop', 'resources', 'backend-node');
const entryFile = path.join(backendDir, 'dist', 'main.js');

function run(command, cwd, env = process.env) {
  execSync(command, { cwd, stdio: 'inherit', env });
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
cpSync(path.join(backendDir, 'package.json'), path.join(resourcesDir, 'package.json'));

// Copy .npmrc if exists
const npmrcPath = path.join(backendDir, '.npmrc');
if (existsSync(npmrcPath)) {
  cpSync(npmrcPath, path.join(resourcesDir, '.npmrc'));
}

// Install production dependencies with Electron-compatible native modules
console.log('📦 Installing production dependencies for Electron...');
const frontendDir = path.join(repoRoot, 'rss-desktop');
const electronVersion = execSync('node -p "require(\'./package.json\').devDependencies.electron"', {
  cwd: frontendDir,
  encoding: 'utf-8'
}).trim();

console.log(`   Electron version: ${electronVersion}`);
console.log(`   Architecture: ${process.arch}`);

// Set environment variables for Electron-compatible builds
const env = {
  ...process.env,
  npm_config_target: electronVersion,
  npm_config_arch: process.arch,
  npm_config_target_arch: process.arch,
  npm_config_disturl: 'https://electronjs.org/headers',
  npm_config_runtime: 'electron',
  npm_config_build_from_source: 'true',
  CXXFLAGS: '-std=c++20'
};

run('npm install --omit=dev --production', resourcesDir, env);

console.log(`✅ Backend resources staged at ${resourcesDir}`);
