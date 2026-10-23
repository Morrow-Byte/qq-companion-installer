# Windows QQ 聊天机器人核心安装

此文件是安装执行规范，不是已经完成安装的证明。所有 `<...>` 都是占位符；执行 AI 应从本次用户输入取得实际值，禁止沿用示例作者的账号、密钥、人设和路径。通过命令行、官方 API、配置文件完成；用户未明确授权时，不读取或操作桌面、浏览器界面。

## 1. 来源、许可和版本记录

| 组件 | 官方来源 | 已核对的情况 |
| --- | --- | --- |
| DeepSeek Harness | https://github.com/deepseek-ai/deepseek-harness | 主体 MIT；npm 包 `@deepseek-ai/dsh` |
| qq-bridge | https://github.com/Derpyu520/qq-bridge | 主体 MIT；上游最初针对 SnowLuma，NapCat 需兼容验证 |
| NapCatQQ | https://github.com/NapNeko/NapCatQQ | 当前仓库 `LICENSE` 为 Limited Redistribution License for NapCat，有非商业及再分发限制；不能称为 OSI 开源 |
| NapCat 安装文档 | https://napneko.github.io/guide/napcat | 根据所选 release 确定 Shell 启动方式及匹配 QQ 版本 |
| OneBot 11 | https://11.onebot.dev/ | 标准协议；网关的扩展 API 不属于跨实现保证 |

执行时重新读取所选版本的 README、LICENSE、release notes、运行要求；固定明确版本或 commit，保存下载 URL、SHA256、安装时间和测试结果。不要盲目同时升级所有组件，也不要将本文编写日的组合说成永远兼容。

参考基线曾使用 DSH `0.2.1-rc.2`、qq-bridge `0.2.1-r1`（上游 commit `a49877f4e58d04e47532d44b803360d0f001160d`）。这是排障线索，新的安装必须重新验证。

qq-bridge 在此基线仍依赖 `@snowluma/sdk` 与 `@snowluma/mcp`。其仓库 LICENSE 单独提示这两个 npm 包的许可文本问题。不能把 SnowLuma 应用的 EULA 自动套给 SDK，也不能认为使用 NapCat 后依赖已经消失。检查实际安装版本、包内许可和适用条款；如果某个依赖不能在本次范围使用，替换为许可可核验的 OneBot 客户端适配层，只暂停受影响部分，继续其余独立安装。此 skill 不分发第三方程序、修改版网关、声库或模型。

## 2. 安装前输入与磁盘布局

必要输入：`<INSTALL_ROOT>`、`<BOT_QQ>`、`<OWNER_QQ>`、私聊/群聊范围、模型提供方及本机配置方式。默认只有管理员私聊，群列表为空。不要收集 QQ 密码；登录由用户手机扫码确认。

先只读检查 Windows 架构、空闲磁盘、CPU/RAM/GPU、现有 Node/Python/Git/FFmpeg、端口占用和已有机器人进程。复用健康运行环境，不批量终止 QQ、node、python。主程序、下载、模型、缓存和工作区统一放用户选定盘：

```text
<INSTALL_ROOT>/
  harness/              # DSH npm 项目
  harness-data/         # DSH_HOME
  qq-bridge/            # 上游桥接源码 + 本次适配
  NapCat/               # 官方发布的网关
  runtime/              # Python venv、PID、服务描述
  downloads/            # 原始安装包及校验清单
  cache/                # tmp、npm、pip、huggingface、torch 等
  logs/                 # 本机日志，不随 skill 分享
  workspace/            # QQ agent 可访问的独立工作目录
  media/                # 语音、图片、表情库
  models/               # 经许可下载的模型
  desktop/              # 本次新建的启动器
  backups/              # 配置改动前快照
```

`DSH_HOME=<INSTALL_ROOT>/harness-data`；进程启动器统一设置 `TEMP`、`TMP`、`HF_HOME`、`TORCH_HOME`、`PIP_CACHE_DIR`、`npm_config_cache`、`NUMBA_CACHE_DIR`、`MPLCONFIGDIR`、`MODELSCOPE_CACHE` 到该根目录下。只影响本项目子进程，避免改全机环境变量；不要把 `$HOME` 或 `$CODEX_HOME` 改成安装目录。部分软件还需显式的输出、模型、用户目录参数，仅设置缓存变量不能保证全部数据已迁移。

NapCat/QQ 数据目录要以该版本的官方参数或配置为准。`DEEPSEEK_QQ_DATA_DIR` 不是本文确认的上游通用接口，不能凭变量名宣称迁移成功。若版本不支持重定向，应明确报告例外并寻找受支持的便携布局；不要把其他安装中的修改版 NapCat bundle 复制给新用户。

## 3. 安装 DSH 和桥接

1. 从官方源下载 Node 的兼容版本，或复用已满足运行条件的 Node。参考 qq-bridge 基线要求 Node `>=22.13.0`，仍以本次 `package.json` 为准。
2. 在 `<INSTALL_ROOT>/harness` 创建独立 npm 项目，安装选定的 `@deepseek-ai/dsh@<PINNED_DSH_VERSION>`；缓存指向项目盘。避免无版本的全局安装。
3. 通过所选版本的 CLI 帮助/官方配置机制设置模型提供方和凭据。密钥只保存在本机受限配置或环境变量中，不粘贴到说明书、测试输出或聊天日志。DSH Web 的 Cookie、初始登录链接和桥接 consoleToken 是不同凭据，不能混用。
4. 用 DSH 可执行入口运行 `web --host 127.0.0.1 --port <DSH_PORT> --no-open`，以 `--help` 核对当前参数。设置 `DSH_HOME`，工作目录为项目 workspace，记录 PID 和日志。首次授权需要用户操作时提供本机链接，由用户手动完成；AI 不自动打开或操控界面。
5. 克隆 qq-bridge 到新目录，checkout 已选 commit/tag。阅读 npm 生命周期脚本与许可后安装锁定依赖，保留 lockfile。将上游 `config.example.json` 复制为全新本机配置，再修改必要字段；不要拿另一个人的 `config.json` 作模板。
6. 执行桥接的 `scripts/setup-dsh.mjs <PROFILE>`（参考 profile 为 `web`），继承同一个 `DSH_HOME`。运行前备份将修改的配置；确认脚本会注册 `qq-mode-console`、`qq-agent-presets` bundle 和受限 MCP 服务。遇到版本差异按当前源码调整，不把旧版本目录结构生搬硬套。
7. 按先 DSH、后 NapCat、再 bridge 的顺序启动。服务都只绑定 `127.0.0.1`。先打通文本，再启用媒体。

## 4. NapCat 与 OneBot 连接契约

从官方 release 选择 Windows x64 Shell 包以及它要求的 QQ 运行组件；安装来源、包名、大小和 SHA256 写入本机 manifest。版本支持的启动命令以 release/文档为准，不下载来历不明的一键整合包。不要自动安装 SnowLuma 应用替代用户选择。

参考端口：DSH `3080`，bridge `3100`，NapCat WebUI `6099`，OneBot HTTP `3000`，OneBot 正向 WS `3001`。占用时先识别 PID/可执行文件；调整本项目相关配置，不能杀掉未知服务。

NapCat 配置结构与 SnowLuma 不同。以下仅展示需写入的网络部分，实际配置应合并该版本生成的默认配置：

```json
{
  "network": {
    "httpServers": [{
      "name": "local-http", "enable": true,
      "host": "127.0.0.1", "port": 3000,
      "enableCors": false, "enableWebsocket": false,
      "messagePostFormat": "array", "token": "<ONEBOT_TOKEN>", "debug": false
    }],
    "websocketServers": [{
      "name": "local-ws", "enable": true,
      "host": "127.0.0.1", "port": 3001,
      "messagePostFormat": "array", "token": "<ONEBOT_TOKEN>",
      "reportSelfMessage": false, "enableForcePushEvent": true,
      "heartInterval": 30000, "debug": false
    }],
    "httpClients": [], "websocketClients": []
  },
  "enableLocalFile2Url": false
}
```

Token 用密码学随机数在本机生成，示例占位符不能直接上线。若桥接当前只有一个 `accessToken` 字段，HTTP 和 WS 在本部署使用同一 OneBot token；NapCat WebUI 管理令牌、bridge 管理令牌另行生成。

qq-bridge 对接字段在参考版本仍叫 `snowluma`，名称不会阻止标准 OneBot 通信。核心配置应为：

```json
{
  "dsh": {
    "baseUrl": "http://127.0.0.1:3080",
    "provider": "<PROVIDER_ID>", "model": "<MODEL_ID>", "allowRemote": false
  },
  "snowluma": {
    "wsUrl": "ws://127.0.0.1:3001",
    "httpUrl": "http://127.0.0.1:3000",
    "accessToken": "<ONEBOT_TOKEN>",
    "followDiscoveredEndpoint": false,
    "launcherPath": "", "homeDir": ""
  },
  "ownerQQ": "<OWNER_QQ>",
  "sessionCwd": "<INSTALL_ROOT>/workspace",
  "allow": { "private": ["<OWNER_QQ>"], "groups": [] },
  "deny": { "private": [], "groups": [] },
  "allowAllWhenEmpty": false,
  "consolePort": 3100,
  "consoleToken": "<BRIDGE_CONSOLE_TOKEN>"
}
```

必须保留上游其他必要默认配置。账号通常按字符串处理；若新版本 schema 要求数字，按其 schema 转换并测试。`allowAllWhenEmpty=false` 是关键：空群白名单应拒绝群消息，不能解释为允许所有群。

参考版自动发现逻辑读取 SnowLuma `networks/httpServers/wsServers/accessToken`，不是 NapCat `network/httpServers/websocketServers/token`。使用明确地址并关闭自动发现，不要靠不兼容的发现逻辑“自愈”。

QQ 对话 agent 默认使用受限聊天 preset。`closed-agent` 在此桥接中可给 owner 完整工具，不应作为普通聊天安装的默认模式。若用户选择二代仿真，按当前 API 设置 `reserved2`，确认 `qq-chat-v2` preset 已实际挂载；这不代表允许任意磁盘读写或命令执行。人格只能来自本次用户需求和公开可用模板，不能复制其他部署的角色文件。

## 5. 无 Computer Use 的扫码登录

WebUI 登录成功不等于 QQ 在线。优先通过该版本 NapCat 后端 API 取得登录状态和二维码，或者读取服务明确生成的二维码图片文件；不截屏、不调用网页 DOM。

参考版接口（执行前对照所选版本源码）：

1. 本机读取 NapCat WebUI 令牌到内存，计算 `SHA256(token + ".napcat")`；`POST /api/auth/login`，JSON `{ "hash": "<COMPUTED_HASH>" }`。取 `data.Credential` 作为后续 `Authorization: Bearer ...`；若启用第二因素，由用户完成，不绕过。
2. `POST /api/QQLogin/CheckLoginStatus` 取得 `isLogin`、`coreReady`、`loginPhase`、`qrcodeurl`。未登录时 `POST /api/QQLogin/GetQQLoginQrcode` 返回 `data.qrcode`；过期才调用 `/api/QQLogin/RefreshQRcode`。
3. 返回值可能是需编码的登录 URL，未必是图片 URL。使用本地 QR 编码库生成 PNG，或解码服务返回的图片数据；将图片放在 `<INSTALL_ROOT>/runtime/login/`，用当前 AI 的本地图片附件能力展示并提供本机文件入口。不要把登录 URL 交给在线二维码网站。
4. 请用户用机器人账号手机 QQ 扫描并允许登录。每次刷新都使用新文件名/更新时间，避免缓存旧图；附件不可见时提供用户可手动打开的本地 PNG。
5. 用户确认后，继续核验 `CheckLoginStatus`、OneBot `get_status`、`get_login_info`。在内存中比较账号是否 `<BOT_QQ>`，只输出“账号匹配/不匹配”，不把完整响应或账号写入可分享报告。

`qrLoginAccepted`、二维码消失、WebUI 认证成功或 HTTP 端口存活，都不足以单独证明上线。最终要求 QQ 核心 ready、OneBot online、账号匹配和 bridge 连接成功。

## 6. 必须新增或验证的适配层

上游仓库存在并不代表以下私人扩展已公开提供。执行 AI 应先检测当前上游能力，再在新用户目录实现缺失部分，写成独立模块和最小补丁，记录源文件 hash 和回滚方式：

- 本地 TTS/ComfyUI/歌声服务的 MCP 工具、HTTP 客户端及工具白名单；不能只把服务启动就宣称机器人会调用。
- 机器人本地表情库：受限目录、索引/标签、图片读取、搜索与发送；上游 QQ 收藏表情列表并不等于磁盘目录导入。
- NapCat 的语音编码/扩展动作兼容性；仅标准 `send_private_msg` 可复用不意味着 SnowLuma 私有动作全部支持。
- 启停脚本、PID/端口检查、桌面启动器、模型/缓存目录、无界面二维码附件辅助脚本。
- 性能/人格优化：先确认控制台状态、preset、role 的实际注入位置，再修改生效源，避免给同一会话重复叠加角色。

任何本地媒体发送工具都应验证会话身份和白名单，限定根目录及大小/格式/时长，拒绝路径穿越与软链接越界，不能向模型暴露控制台管理 token、任意 shell、任意 URL 抓取或任意文件发送能力。不要为解决媒体失败直接关闭鉴权或 SSRF 防护。

## 7. 桌面入口、启停与验收

编写幂等的 `Start-Assistant.ps1` / `Stop-Assistant.ps1`：PID 文件只是线索，操作前比对可执行文件、命令行和本次安装根目录；端口属于未知进程则停止并报告。后台服务用隐藏窗口启动，日志分别写文件。首阶段可提供 `-SkipMedia`，但“QQ 完整启动”入口应启动本次用户已启用的媒体服务。

可创建 DSH、NapCat 管理、QQ 机器人控制台三个快捷方式。Web 控制台可使用用户已有浏览器的 app 模式，并将独立 profile 放安装根目录；这只是本地管理页面的桌面入口，不能称作官方原生桌面客户端。AI 只创建入口，用户手动点击；令牌从本机配置动态读取，避免在可分享 `.url` 或 README 写死认证 URL。

验收按依赖顺序，输出脱敏结果：

1. DSH 启动成功、实际 API 可用、桥接 preset 可发现，模型凭据配置完成。
2. NapCat QQ 在线且账号匹配；经鉴权的 OneBot HTTP `get_status`、`get_version_info`、`get_login_info` 成功。
3. WS 连到正确端口，发送只读 `get_version_info` action，收到相同 `echo` 且 `retcode=0`；心跳/事件处理正常。
4. bridge `GET /api/status` 用 `x-console-token` 鉴权，检查 `dshReady`、网关连接、预期 mode/role。该 API 可能包含活动片段和白名单，必须只抽取所需布尔状态，不能打印完整 JSON。
5. 本地 dry-run 测试允许管理员私聊、拒绝其他私聊/群聊，以及媒体路径边界；不得为了测试把账号加入公开群。
6. 请用户向机器人发送普通文字，再按已启用模块测试语音、画图、表情、歌曲。未经用户授权，AI 不主动发测试消息给任何人。
7. 重启本项目服务再检查状态，确认 PID/锁/快捷入口幂等、模型不会每次重下载；最后交付安装清单、启动/停止方式、备份位置和仍需人工完成的项目。

不得将“包已解压”“端口已监听”写成“完整可用”。本地生成成功与 QQ 实际收到，分别记录。
