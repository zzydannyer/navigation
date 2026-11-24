import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createPlan } from './run-platform.mjs';

test('all full commands have matching aliases and dispatch arguments', () => {
  const { scripts } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const expected = [];
  for (const [app, letter, targets] of [
    ['reactnative', 'r', ['android', 'ios', 'harmony']],
    ['tauri', 't', ['android', 'ios', 'windows', 'macos', 'linux', 'harmony']],
  ]) {
    for (const action of ['dev', 'build']) {
      for (const target of targets) {
        const full = `${action}:${app}:${target}`;
        const alias = `${action[0]}${letter}${target[0]}`;
        assert.equal(scripts[full], `node scripts/run-platform.mjs ${action} ${app} ${target}`);
        assert.equal(scripts[alias], `pnpm run ${full}`);
        expected.push(full, alias);
      }
    }
  }
  assert.deepEqual(Object.keys(scripts).sort(), expected.sort());
});

test('Windows Android preserves existing environment and device orchestration', () => {
  for (const app of ['reactnative', 'tauri']) {
    for (const action of ['dev', 'build']) {
      const plan = createPlan(action, app, 'android', 'win32');
      assert.equal(plan.length, 1);
      assert.equal(plan[0].program, 'powershell');
      assert.equal(plan[0].args.at(-1), `${action}${app === 'reactnative' ? 'rn' : 'tauri'}`);
      assert.ok(plan[0].args.includes('scripts/android.ps1'));
    }
  }
});

test('--rebuild only reaches Windows RN Android development', () => {
  assert.deepEqual(createPlan('dev', 'reactnative', 'android', 'win32', true)[0].args.slice(-2), ['devrn', '-Rebuild']);
  assert.throws(() => createPlan('build', 'reactnative', 'android', 'win32', true), /--rebuild/);
  assert.throws(() => createPlan('dev', 'tauri', 'android', 'win32', true), /--rebuild/);
  assert.throws(() => createPlan('dev', 'reactnative', 'android', 'darwin', true), /--rebuild/);
});

test('desktop dispatch never uses mobile initialization, adb or Expo', () => {
  for (const [target, host] of [['windows', 'win32'], ['macos', 'darwin'], ['linux', 'linux']]) {
    for (const action of ['dev', 'build']) {
      assert.deepEqual(createPlan(action, 'tauri', target, host), [
        { program: 'pnpm', args: ['--filter', '@navigation/desktop', 'tauri', action] },
      ]);
    }
  }
});

test('reject mismatched hosts, unsupported combinations and Harmony before execution', () => {
  for (const target of ['ios', 'macos', 'linux']) assert.throws(() => createPlan('dev', 'tauri', target, 'win32'), /主机/);
  assert.throws(() => createPlan('build', 'tauri', 'windows', 'darwin'), /主机/);
  for (const target of ['windows', 'macos', 'linux']) assert.throws(() => createPlan('dev', 'reactnative', target), /不支持/);
  for (const app of ['reactnative', 'tauri']) assert.throws(() => createPlan('build', app, 'harmony'), /鸿蒙原生尚未接入/);
  assert.throws(() => createPlan('dev', 'tauri'), /未指定/);
});

test('iOS release compiles generic device without installing; Tauri initializes generated project', () => {
  assert.deepEqual(createPlan('build', 'reactnative', 'ios', 'darwin')[0].args.slice(-5), ['--configuration', 'Release', '--device', 'generic', '--no-bundler']);
  assert.deepEqual(createPlan('dev', 'reactnative', 'ios', 'darwin')[0].args.slice(-2), ['run:ios', '--device']);
  const plan = createPlan('build', 'tauri', 'ios', 'darwin');
  assert.equal(plan[0].unlessExists, 'apps/tauri/src-tauri/gen/apple');
  assert.deepEqual(plan[1].args.slice(-2), ['ios', 'build']);
});

test('Unix Android release generates absent Expo project then uses Gradle', () => {
  for (const host of ['darwin', 'linux']) {
    const plan = createPlan('build', 'reactnative', 'android', host);
    assert.equal(plan[0].unlessExists, 'apps/react-native/android/gradlew');
    assert.deepEqual(plan[1], { program: './gradlew', args: ['assembleRelease'], cwd: 'apps/react-native/android' });
    const tauri = createPlan('build', 'tauri', 'android', host);
    assert.deepEqual(tauri[1].args.slice(-4), ['build', '--apk', '--target', 'aarch64']);
  }
});

test('CLI dry-run prints plan without executing; extra arguments cannot reach shell', () => {
  const entry = fileURLToPath(new URL('./run-platform.mjs', import.meta.url));
  const preview = spawnSync(process.execPath, [entry, 'dev', 'reactnative', 'android', '--dry-run'], { encoding: 'utf8' });
  assert.equal(preview.status, 0, preview.stderr);
  assert.match(preview.stdout, /reactnative\/android/);
  const invalid = spawnSync(process.execPath, [entry, 'dev', 'tauri', 'android', '--unknown'], { encoding: 'utf8' });
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /仅支持额外参数/);
});
