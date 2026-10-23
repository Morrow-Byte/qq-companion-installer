import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { installSkill, validateRoot, launchArguments, findCodexScript, parseOptions } from '../bin/install.mjs';

function fixture(t) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'qq-installer-test-'));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
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

test('packaged official Codex runtime can start without a global CLI', () => {
  const child = spawnSync(process.execPath, [findCodexScript(), '--version'], { encoding: 'utf8', shell: false });
  assert.equal(child.status, 0, child.stderr);
  assert.match(child.stdout, /codex/i);
});
