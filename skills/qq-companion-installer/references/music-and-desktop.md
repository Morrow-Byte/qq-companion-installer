# 可选：歌声、音乐工作台和桌面入口

仅在用户选择歌声或桌面功能时读取本文件。优先保障 QQ 基础功能可用，同时并行准备不依赖账号的音乐软件、模型与桌面入口；QQ 账号待填或等待扫码不应阻塞这些准备，缺少声库、显存或音色参考也不应阻塞基础机器人交付。本文中的 `<ROOT>` 是本次用户选定的安装目录，不能照搬其他机器的目录、音色、角色、作品或账号。

## 歌声的默认路线

采用“歌词与乐谱 → 专用歌声合成器 → 可选音色转换 → 伴奏混音 → 本地曲库”。说话模型的权重通常不能直接当歌声模型使用；不要以逐字 TTS、逐字变调与拉伸拼接冒充自然演唱，也不要承诺只输入歌名就能自动唱任意歌曲。

默认使用 [OpenUtau 官方发行包](https://github.com/openutau/OpenUtau/releases) 编辑乐谱，配合适用的 DiffSinger 声库合成连续人声；需要保留用户现有声音时，再使用 [Seed-VC 的歌声转换模型](https://github.com/Plachtaa/seed-vc#usage%EF%B8%8F) 与用户有权使用的干净参考音频。用户已明确要求复用自己的音色，就继续制作，不再重复询问是否允许；缺少素材时只索取本人提供或指定的参考文件。参考音频应无伴奏、无多人重叠，先用短样本验证音色和发音。不要把上一位用户的模型、参考音频或试听文件打包进 skill。

先确认用户需要哪一种交付：可手动编辑并导出歌曲的音乐工作台，或还需要机器人无人值守调用的渲染服务。安装编辑器并不等于完成无人值守渲染。

## 安装编辑器、声库和依赖

1. 将 Windows 对应架构的官方便携 ZIP 解压到 `<ROOT>/music/OpenUtau`，记录版本、原始下载 URL、大小和 SHA256。新安装使用便携包；不要修改用户已有安装以强行改变其存储位置。根据所选版本核对路径逻辑：当前 Windows 版本没有 `installed.txt` 时，程序目录也是数据目录，`Singers`、`Dependencies`、`Cache` 均位于其中。见 [官方 PathManager](https://github.com/openutau/OpenUtau/blob/master/OpenUtau.Core/Util/PathManager.cs)。
2. 下载完整的 OpenUtau 兼容 DiffSinger 声库，保留词典、音素表、配置、模型、许可和随附文件；按归档结构安装到 `OpenUtau/Singers/<声库目录>`。核对根目录有 `character.yaml` 或该版本支持的角色描述、`dsconfig.yaml`，避免多套一层目录。软件开源不代表声库、角色图片和模型权重都使用同一许可。
3. 从声库 `dsconfig.yaml` 读取 `vocoder`。下载声码器作者提供的对应 OpenUtau `.oudep` 包；它是 ZIP 格式，应按 `oudep.yaml` 的 `id` 安装到 `OpenUtau/Dependencies/<id>`，完整保留 `vocoder.yaml`、ONNX 和声明文件。验证采样率、hop size、mel 维度、mel 频率范围与缩放方式吻合，不能只凭“都是 HiFiGAN”混用。官方来源：[OpenVPI 声码器发行页](https://github.com/openvpi/vocoders/releases)。
4. 可复现的中文示例组合为 OpenUtau `0.1.576`、[Qixuan/绮萱 `v2.7.0`](https://github.com/yqzhishen/qixuan-diffsinger/releases/tag/v2.7.0) 与 `pc_nsf_hifigan_44.1k_hop512_128bin_2025.02` 声码器。它是可选起点，不是所有用户的固定音色；安装前核对当前兼容性与[声库条款](https://github.com/yqzhishen/qixuan-diffsinger/blob/main/terms_of_use/Terms_of_Use.zh-CN.md)。该声库允许将合成人声用作音色转换的输入源，但要求署名；禁止修改、转换或微调权重，禁止把产出用于人声模型训练。公开作品须注明 AI、声库和 DiffSinger，转换后的作品还要注明输入源归属。
5. 单独检查声码器、转换模型及音色参考的许可。上述 OpenVPI 声码器权重声明为 CC BY-NC-SA 4.0；不能用声库的商业产出许可推导整套服务可以任意商业部署。按用户的本地使用、公开作品或收费服务场景核对实际条款；交付下载链接与声明，不将大模型副本塞入 skill 分享包。

## 连续演唱与无人值守渲染

成熟的最短路径是创建可编辑 `.ustx` 工程，配置声库与音素器，让用户在 OpenUtau 中手动导出人声，再由命令行转换和混音。用户手动操作不需要 Computer Use；AI 不得借此自动读取或操作界面。

不要假造 `OpenUtau.exe --render`：上述官方版本没有可直接假定存在的完整无界面渲染命令。需要机器人全自动合成时，先寻找所选版本实际支持并维护的 CLI/API；若采用自建 ONNX 渲染器，应将实现和依赖随本次部署保存，不能假定目标电脑上存在本机实验脚本。实现至少包括：

- 按该声库的词典、音素表和语言 ID 处理歌词、连音与休止；用时长模型预测并对齐到乐谱，保留辅音起音，不把每个字平均切成相同长度。
- 对声库启用的语言编码、时长、音高、表现力/气声/发声、声学模型及声码器逐一实现对应输入输出。不要用恒定音高或全零曲线替代启用的学习模型后宣称完成同等合成。
- 从各模型配置和 ONNX 输入签名获取张量类型、维度、采样参数及开关。对每段验证总帧数、有限值、音高范围和声码器匹配；低内存环境逐模型释放会话。
- 统一乐谱、MIDI、伴奏与 WAV 的时间零点。正确移除内部前后填充，并处理分句起音、尾音和呼吸；检查多个乐句后没有累计漂移。

先用用户允许的原创短旋律或授权乐谱完成 15–25 秒试听，保存人声干轨、转换干轨、伴奏、混音和工程。数字指标只能证明文件可用；让用户听清音色、连贯性与情绪，不能将“未削波”当作“自然好听”的结论。

## 复用现有音色与伴奏

Seed-VC 官方仓库目前已归档。可固定到 `51383efd921027683c89e5348211d93ff12ac2a8`，使用独立 Python 虚拟环境，按该提交核对 PyTorch/torchaudio 兼容性，记录实际可运行的版本；不要为它升级或破坏已工作的聊天/TTS 环境。将 Torch、pip 等缓存设置在安装根目录内；此提交的 `inference.py` 会把 `HF_HUB_CACHE` 设为相对路径 `./checkpoints/hf_cache`，因此工作目录必须是安装根下的 Seed-VC 目录，不能只设置环境变量后假定缓存位置不再变化。模型下载完成后做一次离线运行，避免首次聊天时才下载大文件。

官方 V1 歌声转换使用 44.1 kHz 的 F0 条件模型。先以 `--f0-condition True --auto-f0-adjust False --length-adjust 1.0 --semi-tone-shift 0` 保留原旋律，`--diffusion-steps 30` 作为起点；参数以固定版本 `inference.py --help` 与 README 为准。输入为连续人声干轨，`--target` 为用户提供的参考音频，`--output` 是输出目录。禁止将当前聊天人格或角色名称硬编码为模型路径。GPU 任务串行，避开图像生成；显存不足时缩短测试片段、降低并发。

无 NVIDIA 显卡的 Windows 机器可先验证 CPU 路线：[此提交的 inference.py](https://github.com/Plachtaa/seed-vc/blob/51383efd921027683c89e5348211d93ff12ac2a8/inference.py) 按 CUDA → MPS → CPU 自动选择设备，没有 `--device` 参数。安装兼容的 CPU PyTorch/torchaudio，而不是 CUDA 工具包；在 Seed-VC 工作目录用独立环境的 Python 执行下列形式的真实 3–5 秒干轨推理。文件路径换为本次安装的实际文件：

```text
python inference.py --source smoke-source.wav --target reference.wav --output smoke-result --f0-condition True --auto-f0-adjust False --length-adjust 1.0 --semi-tone-shift 0 --diffusion-steps 30 --fp16 False
```

该命令会走 CPU 回退，但代码检查不能代替实测：此提交的 Whisper 编码器仍显式使用 float16，`--fp16 False` 并不使所有模块自动变为 float32。若当前 CPU/PyTorch 组合报半精度算子错误，可在独立部署副本中将 CPU 下的 Whisper 加载类型改为 float32、禁用 CPU autocast，保留原文件和补丁记录，再运行相同短片；不要修改模型权重。仅当得到有效音频、离线复测通过并记录实际耗时/峰值内存后，才把 CPU 歌声转换标为可用。CPU 速度和音质都不能预先保证。若资源不足或仍不兼容，保留已安装的编辑器与歌声干轨，将音色转换如实标为“待可用计算资源”，继续交付 QQ 基础功能，不暗中改装其他大体积 GPU 音乐软件。

轻量伴奏可用 [FluidSynth 官方 Windows 包](https://github.com/FluidSynth/fluidsynth/releases) 配合 [GeneralUser GS](https://github.com/mrbumpy409/GeneralUser-GS) SoundFont。保留音色库自身声明；确认选用的发行包包含 `fluidsynth.exe`，有些包只提供 DLL。包含 CLI 时可用以下离线渲染形式，实际路径由安装结果生成：

```text
fluidsynth.exe -ni -F accompaniment.wav -r 44100 soundfont.sf2 accompaniment.mid
```

仅有 DLL 时，需实现并测试受支持的 FluidSynth C API 文件渲染封装，或换用官方带 CLI 的发行包，不能假定命令存在。让伴奏 MIDI 与歌声使用同一速度图和起点；混音前校准采样率、声道和尾音，保留人声音量空间，避免用夸张变调、混响掩盖错误。

## 接入 QQ 曲库并验收

将渲染与发送分开。渲染服务只接受受限曲目 ID 和安装目录内的媒体路径，不能让聊天内容拼成任意 shell 命令。曲库记录标题、音频路径、来源/署名、时长和内容哈希；返回已有缓存，只有用户请求制作新歌时才进行长任务，并给出进度或失败原因。

本地验证音频格式、非空时长、峰值、音高与时间对齐，再调用已安装 QQ 组件支持的本地语音编码方式，检测编码输出；不要把改扩展名当格式转换。发送测试限本次用户授权的测试会话。用户确认试听后再将新成品替换为默认曲目，保留回退版本。

## 桌面入口和桌宠

- 桌面快捷方式指向 `<ROOT>/desktop` 内的启动器，工作目录指向相应安装目录。程序绝对路径由实际安装发现，不能硬编码某位用户的用户名或盘符。
- 控制台可以用浏览器应用窗口打开本机 WebUI；浏览器资料目录也放在 `<ROOT>`。快捷方式只存启动器路径与非敏感参数，不把 WebUI token、API key 或带 token 的 URL 写进 `.lnk`、`.url`、桌面文件名或分享资料。优先打开无 token 的本机页面让用户登录。
- 启动器先检查端口与进程归属，只启动缺少的本项目服务；使用锁避免双击后启动两套 QQ 实例。后台助手隐藏窗口，用户主动点击的工作台窗口可正常显示。制作快捷方式不代表 AI 可以读取或操作窗口。
- NapCat 扫码由用户在自己电脑上完成；通过本地 API 检查登录状态和预期账号是否一致。登录二维码、登录态与浏览器资料不进入分享包。
- 桌宠、动画包、主题、头像、QQ 气泡与背景属于可选外观模块。先识别用户实际使用的桌宠项目和版本，再从该项目官方发布页或明确授权的扩展仓库选择兼容包。不要机械安装某次对话提过的“六个包”，也不要混淆大肥鱼桌宠与其他平台的宠物格式。没有确认来源就保留可选清单，不下载网盘重打包合集。
- QQ 账号资料、气泡等只通过该版本实际支持的接口或用户手动设置完成；不要承诺所有装扮都能免费修改，更不能继承上一位用户的人格、头像、资料与好友信息。
