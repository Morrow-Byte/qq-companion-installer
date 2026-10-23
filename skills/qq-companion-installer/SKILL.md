---
name: qq-companion-installer
description: 在 Windows 上部署、修复或迁移 QQ 聊天机器人，接通 DeepSeek Harness、qq-bridge 和 NapCat/OneBot，配置语音、画图、表情及桌面入口，可选歌声。用户请求安装并使用此 skill 部署机器人时，在当前 AI 会话执行完整流程。
---

# QQ 聊天伙伴安装

目标是交付用户能实际私聊使用、能重启恢复的机器人，而非只下载软件或写一份计划。本 skill 是安装工作流与辅助工具，不是预装环境；不包含第三方程序、模型、素材或任何人的账号配置。服务和版本须在目标电脑上验证。

## AI 调用约定

- 由当前 AI 会话执行，使用已有的终端、文件与网络工具；不要求安装或启动另一个 AI。平台没有自动注册此 skill 时，直接读取本文件及配套文件即可执行。缺少本机工具时说明限制，不声称操作已经完成。
- `SKILL_DIR` 是本 `SKILL.md` 所在目录。所有 `references/`、`assets/`、`scripts/` 路径均相对它解析，不以当前终端工作目录为准。`INSTALL_ROOT` 是用户指定的部署目录；两者不得混用。配套目录要完整获取，不能只下载本文件。
- 遵循用户本次请求：要求安装并部署时，装好 skill 后继续完成下面的流程；仅要求保存、安装、审阅或修改 skill 时，完成该范围即可，不额外部署机器人。
- 安装位置优先使用用户指定值；未指定且 D 盘存在时默认 `D:\QQCompanion`。续装读取已有状态，只收集缺少的账号、服务和偏好，不把模板空值填成上一个使用者的信息。

## 项目与下载地址

收到安装请求后，直接从下列公开来源获取所选模块，不要求用户逐项寻找项目地址。先检查现有安装、官方运行要求和兼容版本，再下载、校验和安装。仅安装用户需要的模块；软件仓库与模型/素材各自的许可分别核对。

| 用途 | 项目源码 | 获取方式 |
| --- | --- | --- |
| 聊天与智能体运行时 | [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) | [发行说明](https://github.com/deepseek-ai/deepseek-harness/releases)；按 README 在项目目录安装固定版本 npm 包 `@deepseek-ai/dsh` |
| QQ 与智能体桥接 | [qq-bridge](https://github.com/Derpyu520/qq-bridge) | 克隆仓库并固定 tag/commit，按 lockfile 安装依赖 |
| QQ 登录、OneBot 网关 | [NapCatQQ](https://github.com/NapNeko/NapCatQQ) | [官方发行包](https://github.com/NapNeko/NapCatQQ/releases)；按 [安装文档](https://napneko.github.io/guide/napcat) 选择匹配的 Windows/QQ 组件 |
| 说话与参考音色合成 | [GPT-SoVITS](https://github.com/RVC-Boss/GPT-SoVITS) | [发行说明与官方整合包入口](https://github.com/RVC-Boss/GPT-SoVITS/releases) 或固定源码；按 README 配套模型并启动 `api_v2.py` |
| 画图服务 | [ComfyUI](https://github.com/Comfy-Org/ComfyUI) | [官方发行页](https://github.com/Comfy-Org/ComfyUI/releases) 或固定源码版本；按硬件选择运行环境 |
| 可编辑歌声工作台 | [OpenUtau](https://github.com/openutau/OpenUtau) | [官方发行包](https://github.com/openutau/OpenUtau/releases)，Windows 优先使用便携包 |
| 专用歌声合成框架 | [DiffSinger](https://github.com/openvpi/DiffSinger) | 源码和推理说明；使用 OpenUtau 声库时无需同时安装训练环境 |
| 中文歌声库示例 | [Qixuan / 绮萱](https://github.com/yqzhishen/qixuan-diffsinger) | [完整声库发行包](https://github.com/yqzhishen/qixuan-diffsinger/releases)，核对声库独立条款 |
| DiffSinger 配套声码器 | [OpenVPI vocoders](https://github.com/openvpi/vocoders) | [发行页](https://github.com/openvpi/vocoders/releases)，下载声库配置指定的 `.oudep` / 模型版本 |
| 将演唱转成用户的参考音色 | [Seed-VC](https://github.com/Plachtaa/seed-vc) | 仓库已归档，固定兼容提交；使用独立环境与 [作者模型仓库](https://huggingface.co/Plachta/Seed-VC) |
| MIDI 伴奏渲染 | [FluidSynth](https://github.com/FluidSynth/fluidsynth) | [官方发行包](https://github.com/FluidSynth/fluidsynth/releases)，确认包含 Windows CLI |
| 钢琴及通用 MIDI 音源 | [GeneralUser GS](https://github.com/mrbumpy409/GeneralUser-GS) | [作者下载页](https://www.schristiancollins.com/generaluser) 或仓库固定提交的 SoundFont，保留作者许可 |

模型入口：[GPT-SoVITS 基础模型](https://huggingface.co/lj1995/GPT-SoVITS)、[Animagine XL 官方模型卡](https://huggingface.co/cagliostrolab/animagine-xl-4.0)、[SD 1.5 公开维护镜像](https://huggingface.co/stable-diffusion-v1-5/stable-diffusion-v1-5)。这些是按硬件和用户用途选择的候选，不能全部机械下载；先读模型卡与本 skill 对应模块说明。用户的人格、参考声音和表情素材由本次部署提供，不从其他人的安装复制。

这些来源包含开源软件及采用独立条款的配套资源。NapCat 当前采用限制性再分发许可证；声库、声码器和 SoundFont 也不继承软件仓库的许可。不要把整张表统一宣称为可任意再分发或商用。

本 skill 发布于 [qq-companion-installer](https://github.com/Morrow-Byte/qq-companion-installer)。装入后即可根据上述组件来源执行部署。表情、媒体与歌声工具的本地桥接适配仍须按后文实现和测试，不能仅下载仓库就宣布已接通。

## 范围与操作方式

默认完整基础功能为文字、语音、画图、按内容使用表情、控制台桌面入口。歌声和桌宠为可选扩展；用户要求“原流程全部功能”时包括歌声。不要顺带创建社交账号、发布内容、购买服务、启用群聊、替换个人资料或赋予机器人任意系统命令权限。

优先命令行、专用连接器和服务 API。安装请求不代表 Computer Use 授权；不得自动读取、截图或操作桌面/浏览器 UI。扫码、手机确认由用户完成。明确授权后也只在授权范围内操作 UI。

先读已有部署状态和相关源码，延续有效配置。不重装已正常运行的模块，不删除聊天记录，不覆盖用户人格。备份留在本机，绝不打包进分享物。

## 执行入口

1. **环境与需求。** 检查 Windows/架构、磁盘、内存、GPU/显存、Python/Node/Git/FFmpeg、端口和已有安装。用 [deployment.example.json](assets/deployment.example.json) 记录意图；它不是任何上游程序的配置格式。一次收集缺少的安装目录、机器人 QQ、管理员 QQ、私聊/群聊范围、模型服务、声音与扩展偏好。已明确的信息不重复问。密钥写入本机私密配置或使用已有凭据，不要求贴进对话。
2. **建目录。** 用 `scripts/prepare-workspace.ps1 -Root <INSTALL_ROOT>` 创建目录和缓存环境脚本。要求绝对路径，不默认写系统盘；指定盘不存在时继续只读检查，再询问替代目录。skill 源目录只读，配置、日志、密钥、模型与缓存都写到安装根目录。
3. **先通文字。** 读 [core-setup.md](references/core-setup.md)，核对来源与许可，安装 DSH、qq-bridge、NapCat；配置 OneBot 与访问限制，提供实时二维码，分层检查登录、OneBot、桥接、模型。包名含 SnowLuma 不代表实际传输就是 SnowLuma，按代码核对。
4. **接通媒体。** 读 [media-setup.md](references/media-setup.md)，安装兼容的 TTS/画图环境，实际实现缺少的本机工具适配。先本地生成音频和图片，再注册当前 DSH/bridge 支持的工具。不得把自写适配假定为上游原生功能。
5. **人格与表情。** 读 [persona-stickers.md](references/persona-stickers.md)，使用 [persona.example.md](assets/persona.example.md) 和 [stickers.example.json](assets/stickers.example.json)，按实际 schema 生成配置。不继承旧用户的称呼、家庭关系、故事、声音或素材。
6. **扩展与桌面。** 歌声或桌宠读 [music-and-desktop.md](references/music-and-desktop.md)；基础桌面入口见 core-setup。先做可播放试听再让用户选声线，不能用逐字 TTS 拉伸冒充歌声。正常聊天不依赖歌声模型常驻显存。
7. **验收交付。** 按下表记录结果，生成本机使用说明、启停入口、版本/来源/校验记录。故障读 [troubleshooting.md](references/troubleshooting.md)。真实 QQ 测试消息仅在用户明确授权时发送；优先让用户自己发测试语句并确认结果。

## 部署约束

- 账号、角色与会话范围每次重新输入。默认最小私聊白名单；先检查事件发送者，再调用模型；媒体工具还要校验发送目标，模型参数不能绕过访问限制。
- 服务优先绑定 loopback。各服务 token 随机生成并分别保存在本机私密配置。分享包和快捷方式不得含 token、带凭据的 URL、Cookie、二维码、`.env` 实值、登录数据库或聊天历史。日志只保留必要状态和耗时。
- 软件、模型、声码器与参考录音分别核对许可；“免费”“有源码”不等于可自由再分发/商用。条款实际阻止某一步时只处理该组件的授权或替代，不把某产品条款套到全部依赖上。
- 官方下载固定版本/提交，记录来源、大小、摘要。有官方摘要就核对；本地计算摘要不能冒称官方校验。解压前检查路径，禁止目录逃逸。不得直接执行未检查的远程安装脚本。
- Python/模型依赖按兼容组合隔离。CUDA provider 出现在列表中不代表能加载，必须真实小规模推理。低显存使用串行队列，按需释放空闲绘图模型。
- 启停只管理本安装进程；核对 PID、可执行路径和启动参数，不能按名字批量杀 QQ/Python/Node。后台隐藏启动；端口冲突先识别。重复执行不启动重复服务、不重置配置。
- 缺扫码、密钥、模型或硬件时，标明具体待办并继续独立部分。只把确实完成的模块标为成功，不用空文件冒充安装。

## 验收矩阵

| 模块 | 本地验证 | 用户侧完成依据 |
| --- | --- | --- |
| 账号/OneBot | 登录账号正确；事件与 API 可用；非白名单不触发处理 | 用户手机确认自己的账号登录 |
| 文字 | 模型真实返回；去重、超时、会话分离生效 | 私聊收到一次正常回复 |
| 语音 | 真实 WAV 非静音、无明显削波；通过安装版 NapCat 语音转换 | 收到且能播放；听感由用户试听判断 |
| 画图 | 本次 job 成功 history + 可解码图像，不拿旧缓存冒充 | 收到本次请求的图片 |
| 表情 | 标签选择、允许目录、路径越界拒绝、无图回退验证 | 合适情境出现表情，不过量发送 |
| 歌声（启用时） | 连续演唱→音色转换→混音跑通；长度、对齐、音高保留与语音格式通过 | 用户试听认可后设选定曲目，不承诺一次就像真人 |
| 重启 | 单实例启停、配置保留、端口与工具恢复 | 快捷方式能重新打开控制台 |

结果写入 `<INSTALL_ROOT>/runtime/deployment-state.json`，记录状态、版本、公开来源、非敏感检查结果和待办，不保存密钥实值。交付时区分“已安装”“本地已验证”“用户端已验证”。

## 再次分享

原始模板不写入部署者信息。对外提供本仓库链接与 README 中给 AI 的一句安装指令，不分享运行目录。修改 skill 后、提交仓库前运行：

```text
python scripts/scan-share.py --root <SKILL_DIRECTORY> --deny-file <LOCAL_PRIVATE_DENYLIST>
```

拒绝列表是仓库外的本地 UTF-8 文件，每行一个需要拦截的账号、姓名、路径或私密片段，本身不发布。扫描仅报告相对文件名和规则名，文件名含私密信息时也会脱敏，不回显匹配内容。脚本拒绝链接、二进制、运行状态和明显凭据；仍须逐文件人工复核。只发布通用 skill、安装器与说明，不发布运行配置。
