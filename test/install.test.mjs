import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { installSkill, validateRoot, launchArguments, ensureCodex, findNpmScript, parseOptions } from '../bin/install.mjs';

const repositoryRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
// Keep fixtures on the same drive, outside the installer package (a forbidden deployment root).
const testRoot = path.join(path.dirname(repositoryRoot), 'work', 'installer-tests');

function fixture(t) {
  fs.mkdirSync(testRoot, { recursive: true });
  const base = fs.mkdtempSync(path.join(testRoot, 'case-'));
  t.after(() => {
    const relative = path.relative(testRoot, path.resolve(base));
    assert.ok(relative && relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative));
    fs.rmSync(base, { recursive: true, force: true });
  });
  const source = path.join(base, 'source');
  fs.mkdirSync(path.join(source, 'references'), { recursive: true });
  fs.writeFileSync(path.join(source, 'SKILL.md'), '---\nname: test\n---\n你好');
  fs.writeFileSync(path.join(source, 'references', 'guide.md'), 'test');
  return { base, source, root: path.join(base, '中文 & spaced folder') };
}

test('installs complete files, reuses identical files and preserves local changes', t => {
  const { source, root } = fixture(t);
  const first = installSkill(validateRoot(root), source);
  assert.equal(first.reused, false);
  assert.equal(fs.readFileSync(path.join(first.destination, 'references', 'guide.md'), 'utf8'), 'test');
  assert.equal(installSkill(root, source).reused, true);
  fs.writeFileSync(path.join(first.destination, 'SKILL.md'), 'local customization');
  assert.throws(() => installSkill(root, source), /已保留/);
  assert.equal(fs.readFileSync(path.join(first.destination, 'SKILL.md'), 'utf8'), 'local customization');
});

test('rejects root links and nested directory junctions without modifying the target', t => {
  const { base, source, root } = fixture(t);
  const outside = path.join(base, 'outside');
  fs.mkdirSync(outside);
  fs.symlinkSync(outside, root, 'junction');
  assert.throws(() => validateRoot(root), /链接/);
  fs.unlinkSync(root);
  fs.mkdirSync(root);
  fs.symlinkSync(outside, path.join(root, '.agents'), 'junction');
  assert.throws(() => installSkill(root, source), /链接/);
  assert.deepEqual(fs.readdirSync(outside), []);
});

test('rejects relative and drive-root paths and invalid arguments', () => {
  assert.throws(() => validateRoot('relative-folder'), /绝对路径/);
  assert.throws(() => validateRoot(path.parse(process.cwd()).root), /根目录/);
  assert.throws(() => parseOptions(['--root']), /绝对目录/);
  assert.throws(() => parseOptions(['--unknown']), /未知参数/);
  assert.throws(() => parseOptions(['--launch-codex', '--install-only']), /不能同时/);
  assert.equal(parseOptions([]).launchCodex, false);
  assert.equal(parseOptions(['--launch-codex']).launchCodex, true);
});

test('Codex subprocess receives literal skill, Chinese path and ordinary options', t => {
  const { base, root } = fixture(t);
  fs.mkdirSync(root);
  const mock = path.join(base, 'mock.mjs');
  fs.writeFileSync(mock, 'process.stdout.write(JSON.stringify({cwd:process.cwd(),args:process.argv.slice(2)}));');
  const args = launchArguments(root, path.join(root, '.agents', 'skills', 'qq-companion-installer'), mock);
  const child = spawnSync(process.execPath, args, { cwd: root, shell: false, encoding: 'utf8' });
  assert.equal(child.status, 0, child.stderr);
  const actual = JSON.parse(child.stdout);
  assert.equal(actual.cwd, root);
  assert.equal(actual.args[0], '--cd');
  assert.equal(actual.args[1], root);
  assert.match(actual.args[2], /\$qq-companion-installer/);
  assert.ok(actual.args[2].includes(root));
  assert.equal(actual.args.length, 3);
});

test('AI mode runs standalone without node_modules and returns a readable skill without downloading Codex', t => {
  const { base, source, root } = fixture(t);
  const isolatedPackage = path.join(base, 'isolated-package');
  fs.mkdirSync(path.join(isolatedPackage, 'bin'), { recursive: true });
  const isolatedScript = path.join(isolatedPackage, 'bin', 'install.mjs');
  fs.copyFileSync(path.join(repositoryRoot, 'bin', 'install.mjs'), isolatedScript);
  fs.cpSync(source, path.join(isolatedPackage, 'skills', 'qq-companion-installer'), { recursive: true });
  const env = { ...process.env, PATH: '', Path: '', npm_execpath: '', npm_config_registry: 'http://127.0.0.1:1' };
  for (const [flags, reused] of [[[], false], [[], true], [['--install-only'], true]]) {
    const child = spawnSync(process.execPath, [isolatedScript, '--root', root, ...flags], {
      cwd: base, encoding: 'utf8', shell: false, env, timeout: 10000
    });
    assert.equal(child.status, 0, child.stderr);
    assert.equal(child.stderr, '');
    const output = JSON.parse(child.stdout);
    assert.deepEqual(Object.keys(output).sort(), ['entrypoint', 'nextStep', 'reused', 'root', 'skill']);
    assert.equal(output.skill, 'qq-companion-installer');
    assert.equal(output.root, root);
    assert.equal(output.reused, reused);
    assert.ok(path.isAbsolute(output.entrypoint));
    assert.match(fs.readFileSync(output.entrypoint, 'utf8'), /你好/);
    assert.equal(fs.readFileSync(path.join(path.dirname(output.entrypoint), 'references', 'guide.md'), 'utf8'), 'test');
    assert.equal(fs.existsSync(path.join(root, 'runtime')), false);
    assert.equal(fs.existsSync(path.join(root, '.npm-cache')), false);
    assert.equal(fs.existsSync(path.join(isolatedPackage, 'node_modules')), false);
    if (flags.includes('--install-only')) assert.match(output.nextStep, /仅安装技能/);
    else assert.match(output.nextStep, /仅在用户已请求部署时，由当前 AI/);
  }
});

test('optional Codex rejects runtime junctions and unrelated files without altering them', async t => {
  const { base, root } = fixture(t);
  fs.mkdirSync(root);
  const outside = path.join(base, 'outside');
  fs.mkdirSync(outside);
  fs.symlinkSync(outside, path.join(root, 'runtime'), 'junction');
  await assert.rejects(ensureCodex(root), /链接/);
  assert.deepEqual(fs.readdirSync(outside), []);
  fs.unlinkSync(path.join(root, 'runtime'));
  const runtime = path.join(root, 'runtime', 'codex-cli');
  fs.mkdirSync(runtime, { recursive: true });
  fs.writeFileSync(path.join(runtime, 'keep.txt'), 'user file');
  await assert.rejects(ensureCodex(root), /已有其他文件/);
  assert.equal(fs.readFileSync(path.join(runtime, 'keep.txt'), 'utf8'), 'user file');
});

test('npm script resolution is explicit and gives a useful missing-npm error', t => {
  const { base } = fixture(t);
  const fakeNode = path.join(base, 'node.exe');
  assert.throws(() => findNpmScript({}, fakeNode), /找不到 npm-cli\.js/);
  const bin = path.join(base, 'npm', 'bin');
  fs.mkdirSync(bin, { recursive: true });
  const npmScript = path.join(bin, 'npm-cli.js');
  fs.writeFileSync(npmScript, '// fixture');
  assert.equal(findNpmScript({ npm_execpath: path.join(bin, 'npx-cli.js') }, fakeNode), npmScript);
});
