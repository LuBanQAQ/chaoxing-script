# chaoxing-script (超星考试助手)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)[![Tampermonkey](https://img.shields.io/badge/Tampermonkey-Script-green.svg)](https://www.tampermonkey.net/)

## 📖 简介 (Introduction)

**chaoxing-script** 是一个功能强大的 Tampermonkey (油猴) 脚本，专为超星/学习通在线考试设计。它利用先进的 AI 视觉识别技术（支持 GPT-5.1, Gemini 3 Pro等模型），能够自动识别题目内容（包括文字和图片），并智能选择正确答案。

本脚本不仅支持单题解答，还具备全自动挂机模式，支持自动翻页、自动交卷、断点续传等高级功能，配合现代化的可拖拽、可最小化 GUI 界面，助你轻松应对各种考试场景。

## ✨ 主要功能 (Features)

*   **🤖 AI 智能答题**：利用 AI 视觉模型分析题目截图，精准识别选择题（单选/多选）和填空题。
*   **🚀 全自动挂机**：一键开启全自动模式，自动答题 -> 自动翻页 -> 循环执行，直至考试结束。
*   **💾 断点续传**：自动保存运行状态，刷新页面或意外中断后可自动恢复答题进度。
*   **🖥️ 现代化 GUI**：
    *   **悬浮面板**：美观的控制面板，实时显示运行状态。
    *   **自由拖拽**：面板和最小化图标均支持随意拖拽，并自动记忆位置。
    *   **最小化模式**：支持一键最小化为悬浮球，避免遮挡题目，点击即可快速恢复。
*   **🏁 智能交卷**：支持到达最后一题自动交卷，或在试卷预览页面自动提交。
*   **🛡️ 隐私安全**：API Key 仅保存在本地浏览器（Tampermonkey 存储），不上传任何第三方服务器。
*   **🧹 辅助功能**：自动移除页面水印，提升阅读体验。

## 🛠️ 安装指南 (Installation)

1.  **安装浏览器扩展**：
    *   Chrome/Edge 用户请安装 [Tampermonkey](https://www.tampermonkey.net/)。
2.  **安装脚本**：
    *   点击 [此处安装脚本](https://github.com/LuBanQAQ/chaoxing-script/raw/main/exam_answer_selector.js) (或者手动复制 `exam_answer_selector.js` 代码到 Tampermonkey)。
3.  **准备 API**：
    *   你需要一个支持 OpenAI 格式的 API Key（推荐使用 GPT-4o-mini 模型，速度快且成本低）。

## ⚙️ 配置说明 (Configuration)

1.  进入考试页面，脚本会自动加载，屏幕右侧会出现悬浮面板。
2.  点击面板右上角的 **⚙️ 设置** 按钮。
3.  填写以下信息：
    *   **API URL**: 接口地址 (例如 `https://api.openai.com/v1/chat/completions` 或第三方中转地址)。
    *   **API Token**: 你的 API Key (`sk-xxxx...`)。
    *   **Model**: 模型名称 (例如 `gpt-4o-mini`)。
4.  点击 **保存配置**。

## 🎮 使用指南 (Usage)

### 手动模式
*   **单题解答**：点击面板上的 **🤖 单题解答** 按钮，AI 将分析当前题目并自动选择答案。
*   **手动导航**：使用面板上的 **< 上一题** 和 **下一题 >** 按钮进行切换。

### 全自动模式
1.  点击 **🚀 全自动开始** 按钮。
2.  脚本将自动执行：截图 -> AI 识别 -> 填涂答案 -> 等待 3 秒 -> 进入下一题。
3.  如需暂停，点击 **⏹ 停止** 按钮。

### 界面操作
*   **拖拽**：按住面板标题栏或最小化图标即可拖动位置。
*   **最小化**：点击标题栏右上角的 **➖** 按钮，面板将缩起为一个小机器人图标。
*   **恢复**：点击小机器人图标即可恢复完整面板。

## 📝 开源协议 (License)

本项目采用 [MIT License](LICENSE) 开源协议。

```text
MIT License

Copyright (c) 2025 LuBanQAQ

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## ⚠️ 免责声明 (Disclaimer)

*   本脚本仅供**技术研究和教育学习**使用。
*   请勿用于任何违反学校规定或法律法规的作弊行为。
*   开发者不对使用本脚本产生的任何后果负责。
