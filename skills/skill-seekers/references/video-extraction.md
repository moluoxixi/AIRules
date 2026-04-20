# 视频提取指南

## 快速开始

三步将视频转换为 AI 技能：

```bash
# 1. 安装视频依赖
pip install skill-seekers[video-full]
skill-seekers video --setup

# 2. 提取视频内容
skill-seekers video --url https://youtube.com/watch?v=xxx --name tutorial --visual

# 3. AI 增强（可选）
skill-seekers enhance output/tutorial --level 2
```

## 来源类型

### YouTube 视频
```bash
skill-seekers video --url https://youtube.com/watch?v=dQw4w9WgXcQ --name tutorial
```

### YouTube 播放列表
```bash
skill-seekers video --playlist https://youtube.com/playlist?list=PLxxx --name course
```

### 本地视频文件
```bash
skill-seekers video --video-file recording.mp4 --name demo
```

### 预提取 JSON
```bash
skill-seekers video --from-json extracted_data.json --name tutorial
```

## CLI 参数完整表格

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--url <url>` | YouTube 视频或播放列表 URL | - |
| `--video-file <path>` | 本地视频文件路径 | - |
| `--playlist <url>` | YouTube 播放列表 URL | - |
| `--name <name>` | 输出技能名称 | - |
| `--visual` | 启用视觉帧提取 | False |
| `--vision-ocr` | 使用 Vision API 进行 OCR 回退 | False |
| `--whisper-model <model>` | Whisper 模型: tiny/base/small/medium/large | base |
| `--from-json <path>` | 从预提取的 JSON 文件加载 | - |
| `--start-time <time>` | 开始时间（格式: HH:MM:SS 或 MM:SS） | - |
| `--end-time <time>` | 结束时间（格式: HH:MM:SS 或 MM:SS） | - |
| `--setup` | 自动检测和配置 GPU | False |
| `--visual-interval <seconds>` | 视觉帧提取间隔（秒） | 0.7 |
| `--visual-min-gap <seconds>` | 提取帧之间的最小间隔（秒） | 0.5 |
| `--visual-similarity <float>` | 像素差异阈值（值越低保留帧越多） | 3.0 |
| `--languages <lang1,lang2>` | 指定语言代码（如: en,zh） | auto |
| `--output <path>` | 输出目录 | output/ |
| `--enhance-level <0-3>` | AI 增强级别 | 0 |

## 视觉提取管道详解

视频提取使用三条并行流（Three-Stream Analysis）：

### Stream 1: 元数据提取（yt-dlp）
- 提取视频标题、描述、标签
- 获取视频时长、上传时间
- 提取章节信息（如果有）
- 下载视频文件（用于后续处理）

### Stream 2: 转录提取（三级回退）
1. **YouTube Transcript API** - 优先使用官方字幕（手动字幕优先于自动生成，自动生成字幕置信度降低 20%）
2. **字幕文件** - 解析本地视频旁的 .srt/.vtt 字幕文件
3. **Whisper 回退** - 使用 `faster-whisper` 对音频轨道进行语音转文字（需 `video-full` extras）

### Stream 3: 视觉提取
完整视觉处理管道：

1. **场景检测** - 使用 PySceneChange 检测场景变化
2. **关键帧分类** - 将关键帧分类为以下类型：
   - `CODE_EDITOR` - 代码编辑器界面
   - `TERMINAL` - 终端/命令行界面
   - `SLIDE` - 演示文稿幻灯片
   - `DIAGRAM` - 架构图/流程图
   - `BROWSER` - 浏览器界面
   - `WEBCAM` - 摄像头画面
   - `SCREENCAST` - 屏幕录制
   - `OTHER` - 其他类型
3. **OCR 提取** - 使用 Tesseract 提取帧中的文字
4. **代码过滤** - 识别并提取代码片段
5. **语言检测** - 检测文本语言
6. **音视频对齐** - 将转录文本与视觉帧对齐

## AI 增强级别

视频命令的增强默认禁用（`--enhance-level` 默认为 0）。启用后自动应用 `video-tutorial` 工作流。

| 级别 | 说明 | 耗时 |
|------|------|------|
| 0 | 禁用，仅原始提取输出 | - |
| 1 | 仅增强 SKILL.md（概述、结构、可读性） | 10-20秒 |
| 2 | **推荐**。两遍增强：先清理参考文件（Code Timeline 重建），再运行 `video-tutorial` 工作流四阶段（OCR 代码清理→语言检测→教程合成→技能打磨）并增强 SKILL.md | 20-40秒 |
| 3 | 完整增强。所有 level-2 工作 + 架构、配置和全面文档分析 | 40-90秒 |

## 时间裁剪

提取视频的特定片段：

```bash
# 提取 1:30 到 5:00 的片段
skill-seekers video --url <url> --start-time 1:30 --end-time 5:00

# 使用绝对时间（HH:MM:SS）
skill-seekers video --url <url> --start-time 00:01:30 --end-time 00:05:00
```

## Vision API 回退

当本地 OCR 质量不佳时，可以使用 Vision API：

```bash
skill-seekers video --url <url> --visual --vision-ocr
```

**成本说明：** Vision API 约为 $0.004/帧，处理 10 分钟视频（约 120 帧）成本约 $0.48。

## 输出目录结构

```
output/<name>/
├── SKILL.md                          # 主技能文件（增强后的版本，如果 --enhance-level > 0）
├── references/
│   └── video_<sanitized-title>.md    # 完整转录 + OCR + Code Timeline（每个视频一个文件）
├── frames/                           # 仅 --visual 模式
│   └── frame_NNN_Ns.jpg             # 提取的关键帧（N=帧号, Ns=时间戳）
└── video_data/
    └── metadata.json                 # 完整提取元数据（VideoScraperResult）

output/<name>_video_extracted.json    # 原始提取数据（可用 --from-json 重用）
```

### 参考文件内容

每个 `references/video_<title>.md` 包含：
- **元数据块** - 来源频道、时长、发布日期、URL、播放/点赞数、标签
- **目录** - 来自 YouTube 章节或自动生成的分段
- **分段** - 按时间段组织的转录文本，内嵌关键帧图片和 OCR 文本
- **Code Timeline** - （视觉模式）跟踪的代码组，显示文本随时间的演变和编辑差异
- **音视频对齐** - （视觉模式）屏幕代码与旁白解释的配对
- **转录来源** - 使用的转录层级和置信度分数

## 故障排查

### 缺少依赖
```bash
# 重新安装视频依赖
pip install --upgrade skill-seekers[video-full]
```

### GPU 未检测
```bash
# 手动运行 GPU 设置
skill-seekers video --setup

# 检查 CUDA（NVIDIA）
nvidia-smi

# 检查 ROCm（AMD）
rocminfo

# 检查 MPS（Apple Silicon）
python -c "import torch; print(torch.backends.mps.is_available())"
```

### OCR 质量差
- 检查视频分辨率（建议 720p 或更高）
- 使用 `--vision-ocr` 启用 Vision API 回退
- 调整 `--visual-interval` 增加帧密度

### 转录为空
- 检查视频是否有字幕
- 尝试不同的 Whisper 模型：`--whisper-model medium`
- 确保音频清晰，无背景噪音

### 下载失败
- 检查网络连接
- 更新 yt-dlp：`pip install --upgrade yt-dlp`
- 使用代理（如需要）

## 完整使用示例

### 示例 1: 基础 YouTube 提取
```bash
skill-seekers video --url https://youtube.com/watch?v=dQw4w9WgXcQ --name tutorial
```

### 示例 2: 带视觉提取的 YouTube 视频
```bash
skill-seekers video --url https://youtube.com/watch?v=xxx --name python-tutorial --visual
```

### 示例 3: 提取播放列表
```bash
skill-seekers video --playlist https://youtube.com/playlist?list=PLxxx --name ml-course
```

### 示例 4: 本地视频文件
```bash
skill-seekers video --video-file "$HOME/Videos/recording.mp4" --name demo
```

### 示例 5: 时间裁剪 + 高质量转录
```bash
skill-seekers video --url <url> --name segment --start-time 5:00 --end-time 10:00 --whisper-model medium
```

### 示例 6: Vision API 增强的视觉提取
```bash
skill-seekers video --url <url> --name enhanced --visual --vision-ocr --visual-interval 3
```

### 示例 7: 完整处理 + AI 增强
```bash
# 提取
skill-seekers video --url <url> --name complete --visual --whisper-model medium

# 增强
skill-seekers enhance output/complete --level 2

# 打包
skill-seekers package output/complete --target claude
```

### 示例 8: 从预提取 JSON 处理
```bash
# 首次提取并保存 JSON
skill-seekers video --url <url> --name tutorial --visual --output-json extracted.json

# 后续处理
skill-seekers video --from-json extracted.json --name tutorial
```

## 性能优化建议

1. **使用 GPU** - 显著加速 Whisper 转录
2. **调整视觉间隔** - 减少 `--visual-interval` 可提高精度但增加处理时间
3. **选择合适的 Whisper 模型** - `tiny` 最快但精度低，`large` 最慢但精度高
4. **时间裁剪** - 只提取需要的片段可节省大量时间
5. **并行处理** - 使用 `--workers` 参数（如果支持）

## 更多信息

- [安装指南](installation.md) - 安装视频依赖
- [故障排查](troubleshooting.md) - 解决常见问题
- [Three-Stream Analysis](three-stream-analysis.md) - 深入了解分析管道
