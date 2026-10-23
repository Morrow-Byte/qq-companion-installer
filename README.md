# QQ 聊天机器人安装 Skill · AI 直用版

把下面这一句话发给**能联网、读写文件和执行终端命令的 AI**：

```text
安装并使用这个 skill，在 D 盘帮我部署 QQ 聊天机器人：https://github.com/Morrow-Byte/qq-companion-installer
```

AI 会读取本仓库的 [执行入口](AGENTS.md) 和 [完整 SKILL.md](skills/qq-companion-installer/SKILL.md)，在当前会话完成环境检查、安装、配置和验收。使用者提供自己的模型服务配置并扫码登录 QQ；模型、声音与群聊范围按本次需求选择。

## 提供给 AI 的内容

这是标准的 `SKILL.md` 目录，带配套脚本、配置模板、排错指南和上游项目地址。核心流程为 DeepSeek Harness + qq-bridge + NapCat / OneBot，包含文字、语音、画图、按内容使用表情、人格及桌面入口；歌声与桌宠按需选择。

具备 skill 安装能力的平台可安装 `skills/qq-companion-installer` 整个目录。其他具备本机工具的 AI 可读取同样的 Markdown 和配套文件执行，无须再启动一个 AI。能否自动注册到技能列表取决于平台；直接读文件的方式不依赖自动注册。

只有纯文字对话能力的 AI 无法代替你操作电脑。此 skill 也不包含登录凭据、预装模型、参考音色或素材，下载它之后仍须按流程完成部署。

## 终端安装入口

在装有 [Node.js 20+](https://nodejs.org/) 和 [Git for Windows](https://gitforwindows.org/) 的 Windows PowerShell 运行：

```powershell
npx.cmd --yes --cache D:\QQCompanion\.npm-cache git+https://github.com/Morrow-Byte/qq-companion-installer.git
```

**2.0 版默认给当前 AI 使用：**命令只安装 skill 并输出 JSON，其中 `entrypoint` 指向可读取的 `SKILL.md`。AI 读取该文件后继续执行用户请求。终端命令本身不会启动另一个 AI，也不会把机器人部署自动标记为完成。安装目录默认为 `D:\QQCompanion`。

如果由你本人运行终端，并希望它自动打开 Codex 开始部署，在同一条命令末尾加 `--launch-codex`。这时才按需下载固定版本的官方 Codex CLI，并按其正常流程登录；保留原有的审批、模型和账号设置。

指定其他磁盘时，同时更换缓存和部署目录：

```powershell
npx.cmd --yes --cache E:\QQCompanion\.npm-cache git+https://github.com/Morrow-Byte/qq-companion-installer.git --root E:\QQCompanion
```

`--install-only` 可显式表示仅安装 skill，`--help` 查看选项。已有相同内容会复用；不同版本或本地修改会保留并提示处理。AI 应先备份并检查差异，再按本次更新请求更换 skill 子目录；聊天、人格和运行配置无需删除。

## 目录与隐私

skill 安装到 `<ROOT>\.agents\skills\qq-companion-installer`，部署文件与下载缓存位于选定磁盘。可选 Codex 的登录和全局设置由其正常配置目录管理；本项目不会复制这些配置。

仓库只包含通用工作流和模板，不含任何人的 QQ 账号、密钥、聊天记录、二维码、个人设定或参考录音。执行时优先使用命令行和 API；未经明确许可不使用 Computer Use。软件和模型从 skill 列出的官方来源下载，逐项验证后才记录为完成。

第三方软件、模型、声库和素材保留各自条款；本仓库的 MIT 许可不授予这些资源的使用权。服务费用由使用者选择的提供方收取，此项目与腾讯、DeepSeek、OpenAI 无隶属关系。

## 维护

```powershell
npm.cmd test
npm.cmd pack --dry-run
```

启动器验证涵盖安装、复用、保留修改、路径检查和 AI 模式；完整机器人还需在目标机器上推理，并由使用者确认 QQ 收到消息及媒体。维护任务不应触发机器人部署。
