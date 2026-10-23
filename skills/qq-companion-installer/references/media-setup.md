# 语音与画图：从本机生成到 QQ 工具

本模块面向执行安装的 AI。`INSTALL_ROOT` 是本次用户指定的安装目录，示例为 `D:\QQCompanion`；它不是作者机器路径。端口是建议值，安装前检查占用。所有账号、密钥、声音参考及人设都由新用户重新设置。

## 边界与交付物

GPT-SoVITS、ComfyUI 负责媒体生成；把它们接到 QQ 的 `qq-media`、MCP 工具、权限验证和队列是**需要在新安装中实现的本地扩展**，不是 NapCat、DSH 或这些媒体软件自带功能。不要下载上游后就宣布已经接通。

必须实际生成以下文件并运行本地验收：

- `media/config/tts.yaml`、`media/config/voice-profiles.json`、`media/config/image-workflow.json`。
- 隔离的语音/画图环境与隐藏启动脚本；模型来源、版本、哈希和许可证清单。
- `extensions/qq-media/`：独立的生成函数、发送函数、工具注册、超时与单任务队列。
- `media/audio/` 与 `media/images/` 中的测试输出，以及不含账号/凭据/参考音频的验收摘要。

默认用 CLI、源码、HTTP API。未得到明确允许时不读取、截图、点击或操作桌面及浏览器界面。不要发送 QQ 消息来冒充本地测试；完整收发验收由用户主动发起，或按本次用户明确授权的目标和内容执行。

## 1. 选型、隔离与下载

1. 使用系统接口读取 CPU、内存、GPU/显存、驱动、剩余磁盘、Python 版本；NVIDIA 可用 `nvidia-smi`。只输出能力摘要，不收集机器名、序列号和账号信息。
2. 建立独立环境，例如 `runtime/tts-venv`、`runtime/image-venv`；唱歌另用环境。不要把多个项目的 requirements 强行安装到同一环境，也不要为了一个模型全局升级 torch、numpy、transformers。
3. 先看所选上游版本支持的 Python 和 torch 组合，再依据 [PyTorch 官方安装说明](https://pytorch.org/get-started/locally/) 选择对应 wheel。显卡驱动支持的 CUDA、wheel 自带运行库、系统 CUDA Toolkit 不是同一个概念。执行 `python -m pip check` 和最小 import；GPU 环境再做一次小张量计算。把实际成功的版本写入锁定清单。
4. 每个启动器设置自己的 `HF_HOME`、`TORCH_HOME`、`PIP_CACHE_DIR`、`TEMP`、`TMP` 到安装目录内的缓存子目录；不要永久覆盖用户全局环境变量。不需要覆盖 `HOME` 或 `CODEX_HOME`。
5. 从 [GPT-SoVITS 官方仓库](https://github.com/RVC-Boss/GPT-SoVITS) 与 [ComfyUI 官方仓库](https://github.com/Comfy-Org/ComfyUI) 固定 release 或 commit 下载。只记录稳定的公开来源 URL、revision、文件大小、SHA256、许可证；重定向后的临时签名 URL、token/ticket 查询串和下载鉴权头不得写入 manifest、日志或分享包。断点下载到 `.partial`，校验后再改正式文件名。解压拒绝绝对路径、`..`、盘符穿越及逃逸链接。
6. 模型单独下载到本次安装目录。GPT-SoVITS 使用其所选版本文档链接的基础模型，例如[官方预训练模型仓库](https://huggingface.co/lj1995/GPT-SoVITS)。需要哪些 BERT/HuBERT/GPT/SoVITS 文件以该版本配置为准，不能混用 v2/v3/v4 权重。

### 没有可用 NVIDIA 显卡的 Windows 分支

`nvidia-smi` 不存在不代表没有任何 GPU。检查系统设备；AMD/Intel 只有在所选 ComfyUI 与 PyTorch 官方文档明确支持当前硬件、驱动和 Windows 组合时才走相应后端。否则按以下 CPU 路线实施，不安装 CUDA-only 包，也不把“torch 已安装”当作 GPU 可用。

1. 在画图专用 venv 中按已选 ComfyUI revision 的要求确定兼容的 `torch`/`torchvision` 版本。若其依赖需要 `torchaudio`，同时确定配套版本；从 `https://download.pytorch.org/whl/cpu` 安装这些**明确版本**，不要照搬 CUDA index。示意：`<venv-python> -m pip install torch==<版本> torchvision==<配套版本> --index-url https://download.pytorch.org/whl/cpu`。
2. 把成功安装的完整版本（含可能的 `+cpu` 后缀）写入 `constraints-cpu.txt`，安装该 revision 的 requirements 时用 `-c constraints-cpu.txt`，随后 `pip check`。如果约束冲突，重新选择兼容组合，不去掉约束任其替换成 CUDA 版。基础图像推理不要安装 xformers、Flash Attention 或其他仅供 GPU 的可选加速组件。
3. 执行小张量测试，记录 `torch.version.cuda`、`torch.cuda.is_available()` 与张量实际设备。CPU wheel 预期无 CUDA 运行库且测试张量在 CPU；此处 CUDA 不可用是正常结果。
4. 语音环境也独立选择 CPU wheel，TTS 配置 `device: cpu` 与 `is_half: false`。CPU TTS 和 CPU 画图共用内存与处理器，同样限制并发；先测语音，再测图片，不同时启动全部模型来判断机器是否能用。

资源策略：显存较小的机器可先用 CPU TTS（`device: cpu`、`is_half: false`），GPU 留给图片；这是资源分配选择，实际延迟仍需测量。若 TTS 也占 GPU，使用跨进程互斥队列与画图/歌声串行；不要仅在单个 MCP 实例里加 `busy` 就认为整个系统已经串行。无合适 GPU 时可以完成文本与 CPU 语音，再明确报告画图速度或模型限制，不悄悄改用收费云服务。

**验收**：环境互不污染；缓存和下载在指定盘；import、`pip check`、一次设备运算通过。**回退**：保留原环境，修复或重建失败模块自己的环境；文本聊天保持可用。

## 2. 设置自然的说话音色

使用新用户提供或允许使用的声音参考和与之匹配的模型。不能携带原安装实例的声音文件、参考台词、角色模型或提示词。软件开源不等于每一个角色声线素材都可重新分发；仅下载来源与使用条件明确的素材。

1. 把参考 WAV 放入 `media/reference/`。使用干净单人说话，避免配乐和重混响；参考长度及采样要求以所选版本源码为准。保存准确对应的文字，不把一句台词填到另一段音频上。
2. 新建 `voice-profiles.json`：每个风格含相对文件名、准确转写、语言代码。可设 `chat`、`happy`、`gentle` 三项，也可只有一个稳定参考；这些是桥接层枚举，不是 GPT-SoVITS 自带的 `emotion` 参数。
3. 复制上游对应版本 `tts_infer.yaml` 的结构，再填写本机路径、设备与精度。检查所选配置节确实被加载，不只修改一个未生效的版本节。
4. 按安装版本的 `api_v2.py --help` 启动，典型参数为 `api_v2.py -a 127.0.0.1 -p 9880 -c <配置路径>`。隐藏子进程，日志写安装目录；不依赖开启 WebUI。
5. 从 `/openapi.json` 或安装版本 [api_v2.py](https://github.com/RVC-Boss/GPT-SoVITS/blob/main/api_v2.py) 核实请求字段、语言枚举、切分方法和响应格式。下面是字段示意，必须把占位符替换为本次有效数据：

```json
{
  "text": "今天的风很舒服，我们慢慢聊。",
  "text_lang": "all_zh",
  "ref_audio_path": "<INSTALL_ROOT>/media/reference/chat.wav",
  "prompt_text": "<该参考音频的准确转写>",
  "prompt_lang": "all_zh",
  "text_split_method": "cut2",
  "fragment_interval": 0.18,
  "speed_factor": 1.0,
  "batch_size": 1,
  "media_type": "wav",
  "streaming_mode": false,
  "parallel_infer": true
}
```

向 `POST http://127.0.0.1:9880/tts` 发本地请求，把二进制响应保存为新文件；不要把音频当 JSON，也不要把 HTTP 200 的错误文本当 WAV。API 的语言枚举可能因版本不同而变化，`all_zh` 无效时检查已安装版本，不盲目重试。

调音先调整参考的情绪、文本停顿和口语表达，再少量调整语速。不要用单纯升调、加速或不断添加“嘿嘿”宣称实现自然、可爱或有情绪。保留同一文本的少量 A/B 试听，由用户听感选择；不能把语音质量主观偏好当技术测试已通过。参考风格选择属于本地映射，不让聊天模型传入任意音频路径。

**验收**：本地生成普通句、疑问句、轻快句；ffprobe 确认有音轨、有限且非零的时长、正确编码/声道/采样率；检查非空、非全静音、无明显截断和严重削波。保存采用 PCM 的有效 WAV。之后用本机 NapCat 所支持的语音转换接口或其原生转换库作离线转换验证；不假设 ffmpeg 能编码 QQ SILK，也不把改扩展名当转换。发送端用 OneBot `record` 段，具体 WAV/MP3/SILK 支持以当前 NapCat 能力为准。

**回退**：保留可用音色与配置备份；新音色失败就继续用原声。若尚无可用音色，关闭语音工具并报告原因，保留文字回复；不能朗读模型错误日志或向 QQ 发损坏文件。

## 3. 图片生成服务

1. 从当前机器能运行的公开模型开始。动漫风可考虑 [Animagine XL 4.0 官方模型卡](https://huggingface.co/cagliostrolab/animagine-xl-4.0)，它有独立的 Open RAIL++ 使用条款；也可根据用户用途选其他来源清楚、条件允许的 checkpoint。不是所有模型都支持同一工作流。不要复制旧安装的角色 LoRA、头像或私有图。
2. 模型保存到配置的 checkpoint 目录，使用实际文件名，不硬编码未知文件。优先从零个第三方自定义节点开始，减少额外依赖。
3. 启动参数以本版本 `main.py --help` 为准。显式 `--listen 127.0.0.1 --port 8188 --disable-auto-launch --output-directory <INSTALL_ROOT>/media/images`，避免自动打开浏览器。小显存时按当前版本语义选择低显存/CPU VAE 等选项；不要把旧版本参数含义照抄为性能保证。
4. 调用 `GET /object_info` 确认节点及输入存在；创建最小 API 工作流：`CheckpointLoaderSimple → CLIPTextEncode(正/负) → EmptyLatentImage → KSampler → VAEDecode → SaveImage`。固定种子和 batch=1 验证；分辨率、采样器、CFG、步数按模型卡和显存确定。将这个**实际可运行的 JSON**保存到 `media/config/image-workflow.json`。
5. `POST /prompt` 请求体为 `{ "prompt": <节点字典>, "client_id": <新UUID> }`。检查 HTTP 状态、节点错误和 `prompt_id`；按间隔轮询 `/history/{prompt_id}`，识别执行错误和超时。API 定义参考[官方 server.py](https://github.com/Comfy-Org/ComfyUI/blob/master/server.py)。
6. 只取本次指定 `SaveImage` 输出节点的 `images`，要求 `type=output`。输出目录、子目录和文件名经 realpath 检查必须仍在配置根目录内，拒绝路径穿越和逃逸链接。读取真实 PNG/JPEG 字节并验证格式，不把任意本地文件路径交给模型。
7. 如需释放 GPU，先确认 `/queue` 没有其他正在执行/排队的工作，再调用当前版本支持的 `/free`，请求 `{ "unload_models": true, "free_memory": true }`。没有权限中断别人的任务时等待，不清空整个队列。

CPU 机器必须显式加 `--cpu`，完整启动形态为 `<venv-python> main.py --cpu --listen 127.0.0.1 --port 8188 --disable-auto-launch --output-directory <输出目录>`；实际启动器用参数数组传递含空格路径，并以隐藏子进程运行。[官方 main.py](https://github.com/Comfy-Org/ComfyUI/blob/master/main.py) 读取 [comfy/cli_args.py](https://github.com/Comfy-Org/ComfyUI/blob/master/comfy/cli_args.py) 中的 `--cpu` 选项；`--cpu-vae` 只把 VAE 放到 CPU，不能代替全 CPU 模式。不要在此分支设置 `--cuda-device`、GPU-only 或半精度强制参数。

CPU 首轮选较小的 SD 1.x 单 checkpoint 和 batch=1，例如公开维护的 [SD 1.5 模型镜像](https://huggingface.co/stable-diffusion-v1-5/stable-diffusion-v1-5) 中用于推理的 ema-only safetensors（这是镜像，不冒充原作者仓库）；核实文件来源、哈希与许可后，先以 512×512、12–20 步作本机基准。不要在 CPU 分支默认下载 SDXL 或更大的模型。总 RAM 不等于可用 RAM，运行峰值也高于 checkpoint 文件大小；安装前比较空闲内存、模型载入需求和其他服务占用，预留系统余量。没有足够内存就不强跑，不通过长期交换内存伪装成功。记录实测耗时，设置有限且可配置的 CPU 超时；用户不能接受速度或本机资源不足时，将画图标为“已配置但未通过运行验收/未启用”，继续完成其他模块，而不是宣称全功能已完成。

**验收**：本机生成一张新图，尺寸/格式正确，结果来自本次任务，故意使用不存在模型能返回受控错误；记录耗时和显存摘要。**回退**：降分辨率、减 batch、使用当前支持的显存选项或更小模型；只重试受影响任务。仍失败就禁用画图工具，保持文字与语音可用。

## 4. 实现与注册 QQ 媒体扩展

AI 必须在新安装的源码中完成以下接口，并按桥接框架实际 API 接线。若复用公开桥接仓库，先检查这些功能是否存在、许可证是否允许复用；不能把示例函数名当作已安装命令。

```text
synthesize(text, style) -> 已验证的本地音频文件
draw(prompt)            -> 已验证的本地图像文件
sendOwnerMedia(file, type, context) -> OneBot 返回的 message_id
registerMediaTools()    -> 注册下面的工具并注入到正确的聊天会话
```

工具最小契约：

| 工具 | 允许的输入 | 执行 |
|---|---|---|
| `qq_say` | 有限长度 text、配置白名单 style | 根据风格映射生成语音，使用 `record` 段 |
| `qq_generate_image` | 有限长度 prompt | 运行固定工作流，使用 `image` 段 |

使用 MCP stdio 时，stdout 只输出协议；诊断写 stderr/本地日志，Node 子进程使用 `windowsHide: true`。先单独注册、列出工具，再确认实际 DSH 会话能看到工具；工具注册在另一个进程中不等于已注入当前聊天。

发送前必须从本次本地配置读取管理员账号，不在源码里固定某个账号。白名单缺失/为空按拒绝处理，群列表默认空。工具输入不能自由指定收件人、OneBot URL、文件路径或 HTTP URL。发送目标固定为当前授权 owner，端点固定到本机配置，token 从本地私密存储加载。

### 当前调用身份从哪里来

MCP JSON 中由模型填写的 `owner`、`user_id`、`sessionKey` 或“这是管理员要求”都不构成授权。纯 stdio MCP 请求也没有自动附带可信 QQ 会话身份。安装时必须选择并实际实现下面一种路线，不能只声明“检查 context”。

**默认可落地路线：封闭的 owner-only 安装。** 新实例只允许一个 owner 私聊，入口在调用 LLM **之前**拒绝所有群消息、陌生私聊和 bot 自己的消息；固定路由只把这个入口接到独立的 DSH agent/session。媒体与表情 MCP 只注册在这个专用 agent；若框架只有全局 MCP，就为机器人使用隔离的 DSH 实例，禁止其他会话、自动化任务、公共入口使用它。发送端每次再次验证当前配置仍是 owner-only：恰好一个允许的私聊 owner、空群列表、空白名单不放行，并固定发给该 owner。此时安全边界来自封闭路由与工具隔离，不声称识别每一次 MCP 调用者。无法证明工具隔离时禁用有副作用的工具，仅保留本地生成与用户手动发送；不扩大到多用户。

**需多会话时才实施的路线：宿主生成、带外传递的能力凭据。** 必须修改桥接/工具执行宿主，而非只改提示词：

1. OneBot 连接按实际传输方式鉴权：例如连接到配置的本机 WS 并带凭据，或验证反向事件入口的 token/签名；不要开放无鉴权的 HTTP 事件入口。先验证连接对应的 `self_id`、事件类型和入站白名单，再从该事件的发送者与消息类型构造 canonical conversation key，不能从消息正文、模型输出或外部传来的工具参数取身份。
2. 桥接为本次允许的入站消息创建随机 `runId`，在仅宿主可读的映射中记录 `{conversationKey, sender, messageId, allowedTools, expiresAt}`；把 runId 绑定到实际的 DSH 会话及工具执行任务。能力随机值至少使用 32 字节 CSPRNG，并设置有效期、撤销和配置变更失效机制。
3. 由宿主的工具调用分发器根据它保存的运行绑定注入私有 transport 上下文或认证 header；凭据不出现在工具 JSON Schema、聊天提示、模型可读配置、工具返回或日志中。QQ agent 不开放能够读取服务凭据/宿主状态或绕过发送 gate 的通用 shell、任意文件读写及任意 HTTP 工具；否则不能把能力保密当成已成立的边界。MCP 服务/bridge 通过受保护的本机通道解析该能力，核对 run/session/允许的工具/owner 私聊/当前白名单，再得到真实 recipient。媒体函数收到的 `context` 仅来自这个校验结果。不要把当前会话放在一个全局可变变量中供并发请求共享。
4. 特权发送端拒绝缺失、过期、错会话、撤销的凭据；缺失时不能降级到“控制台管理员”通道。模型提供同名字段必须被拒绝或忽略，不得覆盖宿主绑定。回复去重同时绑定入站 messageId 与工具调用 ID。若现有框架无法提供可信工具分发 hook，就使用上面的封闭 owner-only 路线，不能用模型代传 token 冒充带外上下文。

部分桥接实现已有 `key + agentToken` 或 `x-agent-token` 检查；要核对 token 如何产生、发送权限如何验证和缺省路径是否放行。把令牌放进模型提示再要求它回传，属于模型持有的能力，不等于上述宿主带外绑定；不能未经额外隔离就宣称完成多用户安全边界。本 skill 不附实现这些宿主 hook 的补丁，执行 AI 必须根据目标框架完成实现与测试，或明确采用封闭路线。

采用结构化消息数组，例如 `[{"type":"record","data":{"file":"<服务端构造的file URL>"}}]`，按当前 [OneBot v11 消息段规范](https://github.com/botuniverse/onebot-11/blob/master/message/segment.md) 与 NapCat 实际能力适配。检查 HTTP 状态及 OneBot `status`/`retcode`，成功时记录 message_id。超时造成是否送达不确定时不要自动重复发送；本地生成完成也不等于 QQ 已收到。

同一用户请求只触发一次媒体任务；生成和发送分离便于 `dryRun` 测试。每步有超时、输出大小上限、并发限制及最终释放锁。对用户返回短错误信息，不返回绝对路径、token、完整上游响应或原始堆栈。

**本地验收**：注入假的 sender。封闭路线测试入口拒绝群/陌生人/自身消息，专用 agent 不接受其他入口，放宽白名单或注册到公共 agent 时拒绝启用发送。带外路线另测合法 owner 上下文、缺失/过期/跨会话/已撤销能力、模型伪造 owner/session 字段、并发请求混淆，要求只有合法绑定到 owner 的请求能走到发送函数。两条路线均测试任意路径输入被拒绝，且测试不调用真实 OneBot 发送 API。模拟 TTS/画图失败、重复请求、转换失败、OneBot 非零 retcode，确保不会谎报成功或卡死队列。

**端到端验收**：用户主动私聊“请用语音说一句问候”“请画一张风景”。记录文字、语音、图像三个独立结果；失败逐层定位，不反复让用户扫码重装。只有用户确认收到并能播放/查看后，报告 QQ 媒体已接通。

**回退**：撤回本次工具注册与配置变更，重启桥接层自己的进程；保留已经验收通过的文本功能和媒体文件，不删除用户数据。歌声是独立模块，不能用朗读歌词充当唱歌。
