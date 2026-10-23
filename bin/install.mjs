#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';

export const skillName = 'qq-companion-installer';
const packageRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

export function parseOptions(args) {
  const result = { root: 'D:\\QQCompanion', installOnly: false, help: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--root') {
      if (!args[i + 1] || args[i + 1].startsWith('--')) throw new Error('--root 需要绝对目录。');
      result.root = args[++i];
    } else if (args[i] === '--install-only') result.installOnly = true;
    else if (args[i] === '--help' || args[i] === '-h') result.help = true;
    else throw new Error(`未知参数：${args[i]}`);
  }
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

export function findCodexScript() {
  const require = createRequire(import.meta.url);
  const manifest = require.resolve('@openai/codex/package.json');
  const cli = path.join(path.dirname(manifest), 'bin', 'codex.js');
  if (!fs.existsSync(cli)) throw new Error('Codex CLI 未完整下载，请重新运行同一条安装命令。');
  return cli;
}

export async function main(args = process.argv.slice(2)) {
  const options = parseOptions(args);
  if (options.help) {
    console.log('QQ 聊天伙伴安装器\n默认安装 skill 并启动 Codex；参数：\n  --root D:\\QQCompanion   指定部署目录\n  --install-only          仅安装 skill，不启动 AI\n  --help                  显示帮助');
    return 0;
  }
  if (process.platform !== 'win32') throw new Error('此部署流程面向 Windows，请在 Windows PowerShell 运行。');
  const root = validateRoot(options.root);
  const installed = installSkill(root);
  console.log(`${installed.reused ? '已复用' : '已安装'} skill：${installed.destination}`);
  if (options.installOnly) return 0;
  const cliScript = findCodexScript();
  console.log('正在启动 Codex。首次使用按终端提示登录，随后 AI 会执行安装；QQ 扫码由你完成。');
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
