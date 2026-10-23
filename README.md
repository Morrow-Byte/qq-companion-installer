# QQ 聊天伙伴：一条命令安装并调用 skill

在 **Windows PowerShell** 运行：

```powershell
npx.cmd --yes --cache D:\QQCompanion\.npm-cache git+https://github.com/zhubenxu03-star/qq-companion-installer.git
```

需要先装好 [Node.js 20+](https://nodejs.org/) 和 [Git for Windows](https://gitforwindows.org/)，并能访问 GitHub 与 npm。无需手动下载 ZIP、复制长提示词或预装 Codex CLI。

命令会下载固定版本的官方 Codex CLI，把 skill 安装到 `D:\QQCompanion\.agents\skills\qq-companion-installer`，然后在 `D:\QQCompanion` 打开 Codex，自动提交调用该 skill 的安装任务。首次使用按终端提示登录 Codex；使用者需要有可用的 Codex 账号或 API 配置。后续 AI 会按本机硬件配置机器人，并向你收集必要的 QQ、模型服务和声音偏好。

这是一条**启动完整部署流程**的命令。QQ 扫码、账号登录、模型密钥仍由你完成，模型与第三方服务的费用按各服务规则计算。下载了 skill 不代表机器人已经安装完成；AI 应继续执行并逐项验收。

## 功能

- DeepSeek Harness + qq-bridge + NapCat / OneBot，默认私聊白名单。
- 文字聊天、语音、画图、按内容使用表情、人格配置、桌面启停入口。
- 可选歌声工作台与参考音色转换；按机器能力选模型。
- 保留已有部署和人格，重复运行可继续处理未完成项目。

[完整 skill 与项目来源](skills/qq-companion-installer/SKILL.md)包含各组件的 GitHub、模型下载地址和实际接入、排错、验收步骤。

## 目录与重复运行

更换安装位置时，同时更换 npm 缓存路径和 `--root`：

```powershell
npx.cmd --yes --cache E:\QQCompanion\.npm-cache git+https://github.com/zhubenxu03-star/qq-companion-installer.git --root E:\QQCompanion
```

加上 `--install-only` 可以只安装 skill；不启动 AI，也不安装机器人组件。`--help` 查看参数。

相同内容会复用；检测到 skill 的本地修改或不同版本会停止，保留原文件。需要更新时先自行备份并移走该 skill 子目录，再运行命令。不会自动删除聊天、覆盖人格或重装正在工作的机器人。

部署文件和 npm 下载缓存位于选定磁盘。Codex 自己的登录和全局设置仍由其正常配置目录管理，安装器不会复制或公开这些信息。若没有 D 盘，用上面的参数选择其他磁盘。

## 操作与隐私

安装器只复制仓库里的通用 skill，并以普通参数启动 Codex，不改变其审批或沙箱设置。skill 要求优先 CLI / API，未经明确许可不使用 Computer Use；扫码由使用者完成。仓库不含任何 QQ 账号、密钥、聊天记录、登录二维码、个人设定、参考录音或私有素材。

只从仓库列出的官方来源下载组件；核对版本与许可后安装。第三方软件、模型、声库和素材保留各自条款；本仓库的 MIT 许可不授予这些资源的使用权。此项目与腾讯、DeepSeek、OpenAI 均无隶属关系。

## 维护者验证

```powershell
npm.cmd install
npm.cmd test
npm.cmd pack --dry-run
```

启动器测试覆盖安装、复用、保留本地修改、链接路径拒绝及参数传递；完整机器人功能还需在目标机器上实际推理，并由使用者确认 QQ 收到文字、语音、图片和表情。
