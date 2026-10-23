# 给执行安装的 AI

本仓库提供 `qq-companion-installer` skill。用户要求部署 QQ 机器人时，从 [skills/qq-companion-installer/SKILL.md](skills/qq-companion-installer/SKILL.md) 开始执行。用户仅要求安装、审阅或修改 skill 时，完成对应请求，不额外部署机器人。

## 获取和调用

- 使用当前 AI 会话完成任务。需要读取文件、执行终端命令并联网；只有纯文字能力时，应说明缺少哪些工具，不声称已经安装。
- 若所在平台有 skill 安装器，按它支持的接口安装本仓库中的 `skills/qq-companion-installer` 整个目录，再直接读取安装后的 `SKILL.md`。不要编造平台命令。
- 通用方式是获取本仓库完整源码并先检查安装器，再运行 `node bin/install.mjs --root <INSTALL_ROOT>`；也可使用 README 的 npx 命令。安装器返回 JSON，其中 `entrypoint` 是已安装 skill 的绝对路径。读取它，并按需读取配套文件，在本会话继续执行用户已请求的部署。
- 默认模式仅复制 skill，不启动第二个 AI，也不下载 Codex CLI。`--launch-codex` 是给用户主动打开新 Codex 终端的可选入口；已有 AI 正在执行时不要使用它。
- 文件夹位于 `<INSTALL_ROOT>/.agents/skills/qq-companion-installer`。平台是否自动发现取决于其工作目录和规则；直接读取 `entrypoint` 即可按说明执行，不要求用户切换工具或重启。

## 执行约定

安装位置服从本次用户指令；未指定且 D 盘存在时使用 `D:\QQCompanion`。指定磁盘不存在时询问替代位置，不能静默改存系统盘。已有安装先检查并续装。若 skill 子目录有修改或不同版本，备份到本机并检查差异后再更新，不覆盖用户改动。

`SKILL_DIR` 指 `SKILL.md` 所在目录。配套路径都相对 `SKILL_DIR` 解析；部署数据、日志和密钥写入 `INSTALL_ROOT`，不要写进 skill 或 Git 仓库。不要安装整个仓库的依赖来“激活” Markdown skill。

用户要求安装并部署时，安装好 skill 只是起点。继续进行环境检测、账号与模型配置、OneBot 接入、媒体适配和验收；扫码、模型凭据等依赖用户的步骤单独提出，同时完成独立工作。真实 QQ 消息发送需有明确授权，可让用户自行发送测试消息。

不使用未经明确许可的 Computer Use。账号、登录状态、模型密钥、对话、人格、录音和私人素材不进入分享物；仓库中的示例值不代表当前使用者的信息。

## 仓库维护

如果任务是修改或检查本仓库，只执行维护任务。维护者检查为 `npm.cmd test`、`npm.cmd pack --dry-run` 和 skill 格式/隐私校验；不启动真实机器人或调用付费模型。测试数据与缓存放在仓库外的本机临时目录。
