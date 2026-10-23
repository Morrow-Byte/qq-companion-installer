#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

export const skillName = 'qq-companion-installer';
export const codexVersion = '0.164.0';
const packageRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

export function parseOptions(args) {
  const result = { root: 'D:\\QQCompanion', installOnly: false, launchCodex: false, help: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--root') {
      if (!args[i + 1] || args[i + 1].startsWith('--')) throw new Error('--root 需要绝对目录。');
      result.root = args[++i];
    } else if (args[i] === '--install-only') result.installOnly = true;
    else if (args[i] === '--launch-codex') result.launchCodex = true;
    else if (args[i] === '--help' || args[i] === '-h') result.help = true;
    else throw new Error(`未知参数：${args[i]}`);
  }
  if (result.installOnly && result.launchCodex) throw new Error('--install-only 与 --launch-codex 不能同时使用。');
  return result;
}

function statOrNull(target) {
  try { return fs.lstatSync(target); } catch (e) { if (e.code === 'ENOENT') return null; throw e; }
}

export function checkDirectory(target) {
  const resolved = path.resolve(target);
  let cursor = resolved;
  for (;;) {
    const stat = statOrNull(cursor);
    if (stat && (stat.isSymbolicLink() || !stat.isDirectory())) {
      throw new Error(`目录包含链接或非目录项，停止写入：${cursor}`);
    }
    const parent = path.dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
  return resolved;
}

export function validateRoot(root) {
  if (!path.isAbsolute(root)) throw new Error('--root 必须是绝对路径。');
  const resolved = checkDirectory(root);
  const volume = path.parse(resolved).root;
  if (volume === resolved || resolved.startsWith('\\\\')) throw new Error('请选择本机磁盘内的独立文件夹，不能使用盘符根目录或网络路径。');
  if (!fs.existsSync(volume)) throw new Error('目标磁盘不存在，请用 --root 指定已有磁盘内的文件夹。');
  const relative = path.relative(packageRoot, resolved);
  if (!relative || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative))) {
    throw new Error('部署目录不能放在安装器包目录内。');
  }
  return resolved;
}

function collectFiles(root, relative = '') {
  const files = [];
  for (const item of fs.readdirSync(path.join(root, relative), { withFileTypes: true })) {
    const name = path.join(relative, item.name);
    const stat = fs.lstatSync(path.join(root, name));
    if (stat.isSymbolicLink()) throw new Error(`skill 中不允许链接：${name}`);
    if (stat.isDirectory()) files.push(...collectFiles(root, name));
    else if (stat.isFile()) files.push(name);
    else throw new Error(`skill 包含不支持的文件：${name}`);
  }
  return files.sort();
}

export function installSkill(root, source = path.join(packageRoot, 'skills', skillName)) {
  const destination = path.join(root, '.agents', 'skills', skillName);
  checkDirectory(destination);
  const files = collectFiles(source);
  if (!files.includes('SKILL.md')) throw new Error('安装包缺少 SKILL.md。');
  if (fs.existsSync(destination)) {
    const oldFiles = collectFiles(destination);
    const same = JSON.stringify(files) === JSON.stringify(oldFiles) && files.every(name =>
      fs.readFileSync(path.join(source, name)).equals(fs.readFileSync(path.join(destination, name))));
    if (!same) throw new Error(`已有不同版本或本地修改，已保留。请备份并移走此目录后重试：${destination}`);
    return { destination, reused: true };
  }
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const stage = fs.mkdtempSync(path.join(path.dirname(destination), '.qq-install-'));
  try {
    for (const name of files) {
      const target = path.join(stage, name);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(path.join(source, name), target, fs.constants.COPYFILE_EXCL);
    }
    fs.renameSync(stage, destination);
  } finally {
    // Only remove the fresh staging directory created by this call.
    if (fs.existsSync(stage)) fs.rmSync(stage, { recursive: true });
  }
  return { destination, reused: false };
}

export function launchArguments(root, destination, cliScript) {
  const prompt = `使用 $${skillName}，先读取 ${path.join(destination, 'SKILL.md')}。请在当前工作目录部署 QQ 聊天机器人，完成文字、语音、画图、按内容使用表情和桌面入口。先检查硬件和已有安装，只收集缺失的账号及模型配置；歌声和桌宠按需选择。未经我明确允许，不使用 Computer Use。配置和数据保留在本机，不上传我的信息。继续执行到能验收，扫码和账号登录由我完成。`;
  return [cliScript, '--cd', root, prompt];
}

export function findNpmScript(env = process.env, executable = process.execPath) {
  const candidates = [];
  if (env.npm_execpath && /^(npm|npx)-cli\.js$/i.test(path.basename(env.npm_execpath))) {
    candidates.push(path.join(path.dirname(env.npm_execpath), 'npm-cli.js'));
  }
  candidates.push(path.join(path.dirname(executable), 'node_modules', 'npm', 'bin', 'npm-cli.js'));
  for (const entry of (env.PATH ?? env.Path ?? '').split(path.delimiter).filter(Boolean)) {
    candidates.push(path.join(entry, 'node_modules', 'npm', 'bin', 'npm-cli.js'));
  }
  for (const candidate of candidates) {
    const stat = statOrNull(candidate);
    if (stat?.isFile()) return path.resolve(candidate);
  }
  throw new Error('找不到 npm-cli.js。请安装包含 npm 的 Node.js 20+，或通过 npx.cmd 运行本安装器；默认 AI 模式不需要安装 Codex。');
}

function assertNoLinks(directory) {
  for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, item.name);
    const stat = fs.lstatSync(target);
    if (stat.isSymbolicLink()) throw new Error(`Codex 运行目录包含链接，已保留并停止：${target}`);
    if (stat.isDirectory()) assertNoLinks(target);
  }
}

function runNode(args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { ...options, stdio: 'inherit', shell: false, windowsHide: true });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve() : reject(new Error(`命令退出，状态码 ${code ?? 'unknown'}。`)));
  });
}

export async function ensureCodex(root) {
  const runtime = checkDirectory(path.join(validateRoot(root), 'runtime', 'codex-cli'));
  const manifestPath = path.join(runtime, 'package.json');
  const runtimeManifest = {
    name: 'qq-companion-codex-runtime', version: '1.0.0', private: true,
    qqCompanionRuntime: true, dependencies: { '@openai/codex': codexVersion }
  };
  if (fs.existsSync(runtime)) {
    assertNoLinks(runtime);
    if (fs.existsSync(manifestPath)) {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      if (manifest.qqCompanionRuntime !== true || manifest.private !== true ||
          manifest.name !== runtimeManifest.name ||
          JSON.stringify(manifest.dependencies) !== JSON.stringify(runtimeManifest.dependencies)) {
        throw new Error(`Codex 运行目录已有其他配置，已保留：${runtime}`);
      }
    } else if (fs.readdirSync(runtime).length) {
      throw new Error(`Codex 运行目录已有其他文件，已保留：${runtime}`);
    }
  }
  const cli = path.join(runtime, 'node_modules', '@openai', 'codex', 'bin', 'codex.js');
  const codexManifest = path.join(runtime, 'node_modules', '@openai', 'codex', 'package.json');
  if (fs.existsSync(cli) && fs.existsSync(codexManifest) &&
      JSON.parse(fs.readFileSync(codexManifest, 'utf8')).version === codexVersion) return cli;

  // Resolve npm before creating runtime files; never run shell command text.
  const npmScript = findNpmScript();
  const cache = checkDirectory(path.join(root, '.npm-cache'));
  fs.mkdirSync(runtime, { recursive: true });
  if (!fs.existsSync(manifestPath)) {
    fs.writeFileSync(manifestPath, JSON.stringify(runtimeManifest, null, 2) + '\n', { flag: 'wx' });
  }
  console.error(`正在下载官方 Codex CLI ${codexVersion} 到 ${runtime}。`);
  await runNode([npmScript, 'install', '--prefix', runtime, '--cache', cache,
    '--no-audit', '--no-fund', '--ignore-scripts'], { cwd: runtime });
  checkDirectory(path.dirname(cli));
  if (!fs.existsSync(cli) || !fs.existsSync(codexManifest) ||
      JSON.parse(fs.readFileSync(codexManifest, 'utf8')).version !== codexVersion) {
    throw new Error(`Codex CLI ${codexVersion} 未完整安装，请重试 --launch-codex。`);
  }
  return cli;
}

export async function main(args = process.argv.slice(2)) {
  const options = parseOptions(args);
  if (options.help) {
    console.log('QQ 聊天伙伴安装器\n默认安装 skill 并输出 JSON，供当前 AI 读取后继续；参数：\n  --root D:\\QQCompanion   指定部署目录\n  --install-only          仅安装 skill（兼容参数）\n  --launch-codex          按需下载并启动独立 Codex 会话\n  --help                  显示帮助');
    return 0;
  }
  if (process.platform !== 'win32') throw new Error('此部署流程面向 Windows，请在 Windows PowerShell 运行。');
  const root = validateRoot(options.root);
  const installed = installSkill(root);
  console.log(JSON.stringify({
    skill: skillName,
    entrypoint: path.join(installed.destination, 'SKILL.md'),
    root,
    reused: installed.reused,
    nextStep: options.installOnly
      ? 'Skill 已安装；本次仅安装技能。用户要求部署时，再读取 entrypoint 并继续。'
      : options.launchCodex
        ? '用户显式选择独立 Codex 会话，启动后读取 entrypoint 并按本次授权继续。'
        : '仅在用户已请求部署时，由当前 AI 读取 entrypoint 并按本次授权继续。相对引用以该文件所在目录解析；无需启动第二个 AI。'
  }));
  if (!options.launchCodex) return 0;
  const cliScript = await ensureCodex(root);
  console.error('正在启动独立 Codex 会话。首次使用按终端提示登录；QQ 扫码由你完成。');
  return await new Promise((resolve, reject) => {
    // No shell interpolation or changes to Codex approval/sandbox settings.
    const child = spawn(process.execPath, launchArguments(root, installed.destination, cliScript), {
      cwd: root, stdio: 'inherit', shell: false
    });
    child.once('error', reject);
    child.once('exit', code => resolve(code ?? 1));
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then(code => { process.exitCode = code; }).catch(error => {
    console.error(`安装器：${error.message}`);
    process.exitCode = 1;
  });
}
