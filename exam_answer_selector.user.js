// ==UserScript==
// @name         超星考试选项选择器 (混淆修复版)
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  自动选择考试选项的油猴脚本，支持混淆选项识别，自动识别选项数量，支持题目截图复制
// @author       LuBanQAQ
// @match        https://*.chaoxing.com/*
// @require      https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @updateURL    https://raw.githubusercontent.com/LuBanQAQ/chaoxing-script/main/exam_answer_selector.user.js
// @downloadURL  https://raw.githubusercontent.com/LuBanQAQ/chaoxing-script/main/exam_answer_selector.user.js
// ==/UserScript==

(function() {
    'use strict';

    // 状态变量
    let currentOptionsList = [];
    let isAutoRunning = GM_getValue('isAutoRunning', false);
    let autoLoopTimer = null;

    // 默认配置
    const DEFAULT_CONFIG = {
        apiUrl: 'https://api.openai.com/v1/chat/completions',
        apiToken: '',
        model: 'gpt-4o-mini',
        customBody: '{}'
    };

    // 获取配置
    function getConfig() {
        return {
            apiUrl: GM_getValue('apiUrl', DEFAULT_CONFIG.apiUrl),
            apiToken: GM_getValue('apiToken', DEFAULT_CONFIG.apiToken),
            model: GM_getValue('model', DEFAULT_CONFIG.model),
            customBody: GM_getValue('customBody', DEFAULT_CONFIG.customBody)
        };
    }

    // 保存配置
    function saveConfig() {
        const apiUrl = document.getElementById('cfg-url').value.trim();
        const apiToken = document.getElementById('cfg-token').value.trim();
        const model = document.getElementById('cfg-model').value.trim();
        const customBody = document.getElementById('cfg-custom').value.trim();

        if (!apiUrl || !apiToken) {
            showStatus('❌ 请填写完整的 API URL 和 Token');
            return;
        }

        try {
            if (customBody) JSON.parse(customBody);
        } catch (e) {
            showStatus('❌ 自定义参数必须是合法的 JSON');
            return;
        }

        GM_setValue('apiUrl', apiUrl);
        GM_setValue('apiToken', apiToken);
        GM_setValue('model', model);
        GM_setValue('customBody', customBody);
        showStatus('✅ 配置已保存');
        
        // 隐藏配置面板
        document.getElementById('settings-panel').style.display = 'none';
    }

    // 创建UI面板
    function createControlPanel() {
        // 注入样式
        const style = document.createElement('style');
        style.textContent = `
            #exam-selector-panel {
                position: fixed;
                top: 100px;
                right: 20px;
                width: 320px;
                background: #fff;
                border-radius: 12px;
                box-shadow: 0 8px 24px rgba(0,0,0,0.15);
                z-index: 10000;
                font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                font-size: 14px;
                color: #333;
                overflow: hidden;
                transition: opacity 0.3s;
            }
            #panel-header {
                padding: 12px 16px;
                background: linear-gradient(135deg, #2196F3, #1976D2);
                color: white;
                display: flex;
                justify-content: space-between;
                align-items: center;
                cursor: move;
                user-select: none;
            }
            #panel-header h3 {
                margin: 0;
                font-size: 16px;
                font-weight: 600;
            }
            .header-controls button {
                background: rgba(255,255,255,0.2);
                border: none;
                color: white;
                width: 24px;
                height: 24px;
                border-radius: 4px;
                cursor: pointer;
                margin-left: 8px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                font-size: 12px;
                transition: background 0.2s;
            }
            .header-controls button:hover {
                background: rgba(255,255,255,0.3);
            }
            #panel-content {
                padding: 16px;
                max-height: 80vh;
                overflow-y: auto;
            }
            .panel-section {
                margin-bottom: 16px;
            }
            .panel-btn {
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-weight: 500;
                transition: filter 0.2s;
            }
            .panel-btn:hover {
                filter: brightness(0.95);
            }
            .panel-input {
                width: 100%;
                padding: 8px;
                border: 1px solid #e0e0e0;
                border-radius: 6px;
                box-sizing: border-box;
                margin-top: 4px;
            }
            #exam-minimized-icon {
                position: fixed;
                top: 100px;
                right: 20px;
                width: 48px;
                height: 48px;
                background: linear-gradient(135deg, #2196F3, #1976D2);
                border-radius: 50%;
                box-shadow: 0 4px 12px rgba(33, 150, 243, 0.4);
                z-index: 10000;
                display: none;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                color: white;
                font-size: 24px;
                /* transition: transform 0.2s;  Removed to prevent drag lag */
            }
            #exam-minimized-icon:hover {
                /* transform: scale(1.1); Removed to prevent conflict with drag translate */
                filter: brightness(1.1);
            }
        `;
        document.head.appendChild(style);

        const config = getConfig();

        // 主面板
        const panel = document.createElement('div');
        panel.id = 'exam-selector-panel';
        panel.innerHTML = `
            <div id="panel-header">
                <h3>🎓 考试助手 AI Pro</h3>
                <div class="header-controls">
                    <button id="toggle-settings" title="设置">⚙️</button>
                    <button id="minimize-btn" title="最小化">➖</button>
                </div>
            </div>
            <div id="panel-content">
                <div id="question-info" class="panel-section" style="color: #666; font-size: 13px; background: #f5f7fa; padding: 8px; border-radius: 6px;">
                    正在检测题目...
                </div>

                <!-- 配置面板 -->
                <div id="settings-panel" class="panel-section" style="display: none; background: #f8f9fa; padding: 12px; border-radius: 8px; border: 1px solid #eee;">
                    <div style="margin-bottom: 8px;">
                        <label style="font-size: 12px; color: #666;">API URL</label>
                        <input type="text" id="cfg-url" value="${config.apiUrl}" class="panel-input">
                    </div>
                    <div style="margin-bottom: 8px;">
                        <label style="font-size: 12px; color: #666;">API Token</label>
                        <input type="password" id="cfg-token" value="${config.apiToken}" class="panel-input">
                    </div>
                    <div style="margin-bottom: 8px;">
                        <label style="font-size: 12px; color: #666;">Model</label>
                        <input type="text" id="cfg-model" value="${config.model}" class="panel-input">
                    </div>
                    <div style="margin-bottom: 12px;">
                        <label style="font-size: 12px; color: #666;">自定义参数 (JSON)</label>
                        <textarea id="cfg-custom" class="panel-input" style="height: 60px; font-family: monospace;">${config.customBody}</textarea>
                    </div>
                    <button id="save-cfg-btn" class="panel-btn" style="width: 100%; padding: 8px; background: #2196F3; color: white;">保存配置</button>
                </div>

                <!-- 动态选项按钮 -->
                <div class="panel-section">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; font-size: 13px;">手动选择</label>
                    <div id="dynamic-buttons" style="display: flex; gap: 6px; flex-wrap: wrap;">
                        <span style="color: #999; font-size: 12px;">未检测到选项</span>
                    </div>
                </div>

                <!-- 导航 -->
                <div class="panel-section" style="display: flex; gap: 8px;">
                    <button id="prev-btn" class="panel-btn" style="flex: 1; padding: 8px; background: #607D8B; color: white;">&lt; 上一题</button>
                    <button id="next-btn" class="panel-btn" style="flex: 1; padding: 8px; background: #2196F3; color: white;">下一题 &gt;</button>
                </div>

                <!-- AI 操作 -->
                <div style="border-top: 1px solid #eee; padding-top: 16px;">
                    <h4 style="margin: 0 0 12px 0; color: #333; font-size: 14px;">AI 自动答题</h4>
                    
                    <div style="margin-bottom: 10px;">
                        <button id="ai-solve-one" class="panel-btn" style="width: 100%; padding: 10px; background: #673AB7; color: white; display: flex; align-items: center; justify-content: center; gap: 6px;">
                            <span>🤖</span> 单题解答
                        </button>
                    </div>
                    
                    <div style="display: flex; gap: 8px; margin-bottom: 12px;">
                        <button id="ai-auto-start" class="panel-btn" style="flex: 1; padding: 10px; background: #E91E63; color: white; display: flex; align-items: center; justify-content: center; gap: 6px;">
                            <span>🚀</span> 全自动开始
                        </button>
                        <button id="ai-auto-stop" class="panel-btn" style="flex: 1; padding: 10px; background: #9E9E9E; color: white; display: none; align-items: center; justify-content: center; gap: 6px;">
                            <span>⏹</span> 停止
                        </button>
                    </div>
                    
                    <div style="display: flex; gap: 8px; align-items: center; background: #f5f7fa; padding: 8px; border-radius: 6px;">
                        <button id="ai-do-submit" class="panel-btn" style="flex: 1; padding: 6px; background: #FF5722; color: white; font-size: 12px;">
                            🏁 交卷
                        </button>
                        <label style="flex: 1; font-size: 12px; display: flex; align-items: center; justify-content: center; cursor: pointer; user-select: none;">
                            <input type="checkbox" id="auto-submit-check" style="margin-right: 6px;"> 自动交卷
                        </label>
                    </div>
                </div>

                <div id="status-msg" style="margin-top: 12px; padding: 10px; background: #fff3cd; border-radius: 6px; font-size: 12px; color: #856404; min-height: 20px; word-break: break-all; line-height: 1.4;">
                    准备就绪
                </div>
            </div>
        `;
        document.body.appendChild(panel);

        // 最小化图标
        const minIcon = document.createElement('div');
        minIcon.id = 'exam-minimized-icon';
        minIcon.innerHTML = '🤖';
        minIcon.title = '点击恢复面板';
        document.body.appendChild(minIcon);

        // 拖拽逻辑
        let isDragging = false;
        let hasMoved = false;
        let currentX;
        let currentY;
        let initialX;
        let initialY;
        // 读取保存的位置
        let xOffset = GM_getValue('panel_x', 0);
        let yOffset = GM_getValue('panel_y', 0);
        let isMinimized = GM_getValue('isMinimized', false);

        const header = document.getElementById('panel-header');
        
        // 初始化位置
        setTranslate(xOffset, yOffset, panel);
        setTranslate(xOffset, yOffset, minIcon);

        // 初始化最小化状态
        if (isMinimized) {
            panel.style.display = 'none';
            minIcon.style.display = 'flex';
        } else {
            panel.style.display = 'block';
            minIcon.style.display = 'none';
        }

        header.addEventListener("mousedown", dragStart);
        minIcon.addEventListener("mousedown", dragStart);
        document.addEventListener("mouseup", dragEnd);
        document.addEventListener("mousemove", drag);

        function dragStart(e) {
            if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
            initialX = e.clientX - xOffset;
            initialY = e.clientY - yOffset;

            if (header.contains(e.target) || e.target === minIcon || minIcon.contains(e.target)) {
                isDragging = true;
                hasMoved = false;
            }
        }

        function dragEnd(e) {
            initialX = currentX;
            initialY = currentY;
            isDragging = false;
            // 保存位置
            GM_setValue('panel_x', xOffset);
            GM_setValue('panel_y', yOffset);
        }

        function drag(e) {
            if (isDragging) {
                e.preventDefault();
                currentX = e.clientX - initialX;
                currentY = e.clientY - initialY;

                if (Math.abs(currentX - xOffset) > 2 || Math.abs(currentY - yOffset) > 2) {
                    hasMoved = true;
                }

                xOffset = currentX;
                yOffset = currentY;

                setTranslate(currentX, currentY, panel);
                setTranslate(currentX, currentY, minIcon);
            }
        }

        function setTranslate(xPos, yPos, el) {
            el.style.transform = "translate3d(" + xPos + "px, " + yPos + "px, 0)";
        }

        // 最小化/恢复逻辑
        document.getElementById('minimize-btn').addEventListener('click', () => {
            panel.style.display = 'none';
            minIcon.style.display = 'flex';
            GM_setValue('isMinimized', true);
        });

        minIcon.addEventListener('click', () => {
            if (hasMoved) {
                hasMoved = false;
                return;
            }
            minIcon.style.display = 'none';
            panel.style.display = 'block';
            GM_setValue('isMinimized', false);
        });

        // 事件绑定
        document.getElementById('prev-btn').addEventListener('click', prevQuestion);
        document.getElementById('next-btn').addEventListener('click', nextQuestion);
        
        document.getElementById('toggle-settings').addEventListener('click', () => {
            const p = document.getElementById('settings-panel');
            p.style.display = p.style.display === 'none' ? 'block' : 'none';
        });
        
        document.getElementById('save-cfg-btn').addEventListener('click', saveConfig);
        
        document.getElementById('ai-solve-one').addEventListener('click', () => runAI(false));
        document.getElementById('ai-auto-start').addEventListener('click', startAutoLoop);
        document.getElementById('ai-auto-stop').addEventListener('click', stopAutoLoop);
        
        document.getElementById('ai-do-submit').addEventListener('click', submitExam);
        const autoSubmitCheck = document.getElementById('auto-submit-check');
        autoSubmitCheck.checked = GM_getValue('autoSubmit', false);
        autoSubmitCheck.addEventListener('change', (e) => {
            GM_setValue('autoSubmit', e.target.checked);
        });
    }

    // 导航功能
    function prevQuestion() {
        const btn = Array.from(document.querySelectorAll('.nextDiv a')).find(el => el.innerText.includes('上一题'));
        if (btn) {
            btn.click();
        } else if (typeof unsafeWindow !== 'undefined' && unsafeWindow.getTheNextQuestion) {
            unsafeWindow.getTheNextQuestion(-1);
        } else {
            showStatus('无法执行上一题');
        }
    }

    function nextQuestion() {
        const btn = Array.from(document.querySelectorAll('.nextDiv a')).find(el => el.innerText.includes('下一题') || el.innerText.includes('下一步'));
        if (btn) {
            btn.click();
            return true;
        } else if (typeof unsafeWindow !== 'undefined' && unsafeWindow.getTheNextQuestion) {
            unsafeWindow.getTheNextQuestion(1);
            return true;
        } else {
            return false;
        }
    }

    // 交卷功能
    function submitExam() {
        // 尝试查找交卷按钮
        const btn = document.querySelector('.completeBtn') || 
                    Array.from(document.querySelectorAll('a')).find(el => el.innerText.includes('交卷'));
        
        if (btn) {
            btn.click();
            showStatus('📜 已点击交卷，等待确认...');
            
            // 等待弹窗
            let checkCount = 0;
            const timer = setInterval(() => {
                checkCount++;
                const confirmPop = document.getElementById('submitConfirmPop');
                if (confirmPop && confirmPop.style.display !== 'none') {
                    const confirmBtn = confirmPop.querySelector('.confirm');
                    if (confirmBtn) {
                        confirmBtn.click();
                        showStatus('✅ 已确认交卷');
                        clearInterval(timer);
                        stopAutoLoop();
                    }
                }
                
                if (checkCount > 20) { // 10秒超时
                    clearInterval(timer);
                    showStatus('❌ 未检测到交卷确认弹窗，请手动确认');
                }
            }, 500);
        } else if (typeof unsafeWindow !== 'undefined' && unsafeWindow.finalSubmit) {
             unsafeWindow.finalSubmit();
             showStatus('📜 已调用交卷函数，请手动确认');
        } else {
            showStatus('❌ 未找到交卷按钮');
        }
    }

    // 获取当前题目容器
    function getCurrentQuestionContainer() {
        // 优先获取当前显示的题目（单题模式）
        let container = document.querySelector('.singleQuesId.ans-cc.mainhet');
        // 如果没有，尝试获取第一个题目容器（可能是整卷模式或刚加载）
        if (!container) {
            container = document.querySelector('.singleQuesId');
        }
        return container;
    }

    // 核心：根据显示的文本选择选项
    function selectCurrentQuestion(choiceText) {
        if (!choiceText) {
            showStatus('请输入或选择选项');
            return;
        }
        
        const currentQuestion = getCurrentQuestionContainer();
        if (!currentQuestion) {
            showStatus('未找到题目容器');
            return;
        }

        // 1. 处理填空题 (Fill-in-the-blank)
        const textareas = currentQuestion.querySelectorAll('textarea[name^="answerEditor"]');
        if (textareas.length > 0) {
            const answers = choiceText.split(/\||#|；/); // 支持分隔符
            let filledCount = 0;
            
            textareas.forEach((textarea, index) => {
                const val = answers[index] !== undefined ? answers[index] : (answers.length === 1 ? answers[0] : '');
                if (val) {
                    const id = textarea.id;
                    if (id && typeof unsafeWindow !== 'undefined' && unsafeWindow.UE) {
                        try {
                            const editor = unsafeWindow.UE.getEditor(id);
                            editor.setContent(val);
                            filledCount++;
                        } catch (e) {
                            console.error("UE setContent error:", e);
                        }
                    } else {
                        textarea.value = val;
                        filledCount++;
                    }
                }
            });
            
            if (filledCount > 0) {
                showStatus(`已填充 ${filledCount} 个空`);
                return;
            }
        }

        // 2. 处理选择题 (Single/Multi)
        const choice = choiceText.toUpperCase().trim();
        const optionSpans = currentQuestion.querySelectorAll('.num_option, .num_option_dx');
        let foundCount = 0;

        // 策略：先尝试完全匹配（针对单选或单个输入），如果没找到且输入长度>1，尝试拆分匹配
        let targets = [choice];
        
        // 检查是否存在完全匹配的选项
        let hasExactMatch = false;
        optionSpans.forEach(span => {
            if (span.innerText.trim().toUpperCase() === choice) hasExactMatch = true;
        });

        if (!hasExactMatch && choice.length > 1) {
             // 尝试拆分为字符数组，例如 "AB" -> ["A", "B"]
             targets = choice.split('');
        }

        targets.forEach(target => {
            optionSpans.forEach(span => {
                const visibleText = span.innerText.trim().toUpperCase();
                if (visibleText === target.trim()) {
                    span.click();
                    foundCount++;
                }
            });
        });

        if (foundCount > 0) {
            showStatus(`已选择 ${foundCount} 个选项`);
        } else {
            showStatus(`未找到选项: ${choice}`);
        }
    }

    // 自动检测当前题目的选项
    function detectOptions() {
        const currentQuestion = getCurrentQuestionContainer();
        const infoDiv = document.getElementById('question-info');
        const btnContainer = document.getElementById('dynamic-buttons');
        
        if (!currentQuestion) {
            if (infoDiv) infoDiv.textContent = "未检测到题目";
            return;
        }

        // 检测填空题
        const textareas = currentQuestion.querySelectorAll('textarea[name^="answerEditor"]');
        if (textareas.length > 0) {
            if (infoDiv) infoDiv.textContent = `检测到填空题 (${textareas.length} 个空)`;
            if (btnContainer) {
                // 避免重复刷新
                if (btnContainer.getAttribute('data-type') !== 'blank') {
                    btnContainer.innerHTML = '<span style="color: #2196F3; font-size: 12px;">请在输入框填写答案，多空用 | 分隔</span>';
                    btnContainer.setAttribute('data-type', 'blank');
                }
            }
            return;
        }

        // 检测选择题
        const optionSpans = currentQuestion.querySelectorAll('.num_option, .num_option_dx');
        const options = [];
        optionSpans.forEach(span => {
            const text = span.innerText.trim();
            if (text) options.push(text);
        });

        // 如果选项列表发生变化，更新 UI
        if (options.join(',') !== currentOptionsList.join(',')) {
            currentOptionsList = options;
            
            if (infoDiv) infoDiv.textContent = `检测到 ${options.length} 个选项`;
            
            if (btnContainer) {
                btnContainer.setAttribute('data-type', 'choice');
                btnContainer.innerHTML = '';
                if (options.length === 0) {
                    btnContainer.innerHTML = '<span style="color: #999; font-size: 12px;">无选项</span>';
                } else {
                    options.forEach(opt => {
                        const btn = document.createElement('button');
                        btn.textContent = opt;
                        btn.style.cssText = `
                            flex: 1;
                            min-width: 30px;
                            padding: 8px 0;
                            background: #fff;
                            border: 1px solid #2196F3;
                            color: #2196F3;
                            border-radius: 4px;
                            cursor: pointer;
                            font-weight: bold;
                        `;
                        btn.onmouseover = () => btn.style.background = '#e3f2fd';
                        btn.onmouseout = () => btn.style.background = '#fff';
                        btn.onclick = () => selectCurrentQuestion(opt);
                        btnContainer.appendChild(btn);
                    });
                }
            }
        }
    }

    // 辅助：Blob 转 Base64
    function blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result.split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    // 调用 AI API
    function callAIAPI(base64Image) {
        return new Promise((resolve, reject) => {
            const config = getConfig();
            if (!config.apiUrl || !config.apiToken) {
                reject(new Error('请先在设置中配置 API URL 和 Token'));
                return;
            }

            const prompt = `请分析这张图片中的题目。请直接给出答案，并严格按照 JSON 格式返回，格式为：{"answer": "你的答案"}。规则：1.如果是选择题，answer的值为选项字母（如"A"或"AB"）。2.如果是填空题，answer的值为填空内容，如果有多个空，用"|"分隔（如"答案1|答案2"）。不要输出任何 Markdown 标记或额外解释，只输出 JSON 字符串。`;

            // 基础 Payload
            let payload = {
                model: config.model,
                messages: [
                    {
                        role: "user",
                        content: [
                            { type: "text", text: prompt },
                            { type: "image_url", image_url: { url: `data:image/png;base64,${base64Image}` } }
                        ]
                    }
                ],
                stream: false
            };

            // 合并自定义参数
            if (config.customBody) {
                try {
                    const customParams = JSON.parse(config.customBody);
                    payload = { ...payload, ...customParams };
                } catch (e) {
                    console.warn('自定义参数解析失败，已忽略');
                }
            }

            GM_xmlhttpRequest({
                method: "POST",
                url: config.apiUrl,
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${config.apiToken}`
                },
                data: JSON.stringify(payload),
                onload: function(response) {
                    if (response.status === 200) {
                        try {
                            const res = JSON.parse(response.responseText);
                            const content = res.choices[0].message.content;
                            resolve(content);
                        } catch (e) {
                            reject(new Error('解析响应失败: ' + e.message));
                        }
                    } else {
                        // 尝试解析错误信息
                        let errorMsg = `API 请求失败: ${response.status}`;
                        try {
                            const errBody = JSON.parse(response.responseText);
                            if (errBody.error && errBody.error.message) {
                                errorMsg += ` - ${errBody.error.message}`;
                            } else {
                                errorMsg += ` - ${response.responseText.substring(0, 100)}`;
                            }
                        } catch (e) {
                            errorMsg += ` ${response.statusText}`;
                        }
                        reject(new Error(errorMsg));
                    }
                },
                onerror: function(err) {
                    reject(new Error('网络请求错误'));
                }
            });
        });
    }

    // 判断是否为试卷预览/总览页面
    function isOverviewPage() {
        const subNav = document.querySelector('.subNav');
        if (subNav && (subNav.innerText.includes('考试预览') || subNav.getAttribute('aria-label')?.includes('考试预览'))) {
            return true;
        }
        return false;
    }

    // 运行 AI 答题
    async function runAI(isAuto) {
        if (isAuto && !isAutoRunning) return;

        // 优先检测是否到达预览/交卷页面
        if (isOverviewPage()) {
            if (isAuto) {
                if (GM_getValue('autoSubmit', false)) {
                    showStatus('🏁 检测到试卷预览页面，正在自动交卷...');
                    submitExam();
                } else {
                    showStatus('🏁 已到达试卷预览页面，请手动交卷');
                    stopAutoLoop();
                }
            }
            return;
        }

        const currentQuestion = getCurrentQuestionContainer();
        if (!currentQuestion) {
            // 如果是自动模式且未找到题目，尝试检测是否在交卷页面
            if (isAuto && GM_getValue('autoSubmit', false)) {
                 const submitBtn = document.querySelector('.completeBtn') || Array.from(document.querySelectorAll('a')).find(el => el.innerText.includes('交卷'));
                 if (submitBtn) {
                     showStatus('🏁 检测到交卷按钮，正在自动交卷...');
                     submitExam();
                     return;
                 }
            }

            showStatus('未找到题目');
            if (isAuto) stopAutoLoop();
            return;
        }

        showStatus('📷 正在截图...');
        
        try {
            const canvas = await html2canvas(currentQuestion, {
                useCORS: true,
                scale: 1.0, // 降低分辨率以加快速度和减少token
                logging: false,
                backgroundColor: '#ffffff'
            });

            canvas.toBlob(async (blob) => {
                if (!blob) {
                    showStatus('❌ 截图失败');
                    if (isAuto) stopAutoLoop();
                    return;
                }

                showStatus('🤖 正在请求 AI...');
                try {
                    const base64 = await blobToBase64(blob);
                    const resultText = await callAIAPI(base64);
                    
                    // 解析 JSON
                    const cleanJson = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
                    const data = JSON.parse(cleanJson);

                    if (data && data.answer) {
                        showStatus(`✅ AI 答案: ${data.answer}`);
                        selectCurrentQuestion(data.answer);

                        if (isAuto) {
                            showStatus('⏳ 3秒后进入下一题...');
                            autoLoopTimer = setTimeout(() => {
                                if (nextQuestion()) {
                                    // 等待页面加载后再次运行
                                    setTimeout(() => runAI(true), 3000); 
                                } else {
                                    // 无法进入下一题，检查是否需要自动交卷
                                    if (GM_getValue('autoSubmit', false)) {
                                        showStatus('🏁 已到达最后，正在自动交卷...');
                                        submitExam();
                                    } else {
                                        showStatus('🏁 已到达最后，请手动交卷');
                                        stopAutoLoop();
                                    }
                                }
                            }, 3000);
                        }
                    } else {
                        throw new Error('未找到 answer 字段');
                    }
                } catch (e) {
                    showStatus(`❌ AI 错误: ${e.message}`);
                    if (isAuto) stopAutoLoop();
                }
            }, 'image/png');

        } catch (e) {
            showStatus(`❌ 截图错误: ${e.message}`);
            if (isAuto) stopAutoLoop();
        }
    }

    function startAutoLoop() {
        isAutoRunning = true;
        GM_setValue('isAutoRunning', true);
        document.getElementById('ai-auto-start').style.display = 'none';
        document.getElementById('ai-auto-stop').style.display = 'inline-block';
        showStatus('🚀 全自动模式已启动');
        runAI(true);
    }

    function stopAutoLoop() {
        isAutoRunning = false;
        GM_setValue('isAutoRunning', false);
        if (autoLoopTimer) clearTimeout(autoLoopTimer);
        document.getElementById('ai-auto-start').style.display = 'inline-block';
        document.getElementById('ai-auto-stop').style.display = 'none';
        showStatus('⏹ 全自动模式已停止');
    }

    // 显示状态信息
    function showStatus(msg) {
        const statusDiv = document.getElementById('status-msg');
        if (statusDiv) {
            statusDiv.textContent = msg;
            // 闪烁效果
            statusDiv.style.background = '#fff3cd';
            setTimeout(() => {
                statusDiv.style.background = '#f0f0f0';
            }, 500);
        }
    }

    // 移除水印
    function removeWatermark() {
        const masks = document.querySelectorAll('.mask_div');
        masks.forEach(el => el.remove());
        
        // 针对 ID 匹配
        const allDivs = document.querySelectorAll('div[id^="mask_div"]');
        allDivs.forEach(el => el.remove());
    }

    // 初始化
    function init() {
        createControlPanel();
        // 定时检测题目选项变化（适应动态加载或切题）
        setInterval(detectOptions, 1000);
        // 定时移除水印
        setInterval(removeWatermark, 2000);
        
        // 恢复全自动状态
        if (isAutoRunning) {
            // 检测是否在预览页面
            if (isOverviewPage()) {
                if (GM_getValue('autoSubmit', false)) {
                    showStatus('🏁 检测到试卷预览页面，正在自动交卷...');
                    submitExam();
                } else {
                    showStatus('🏁 已到达试卷预览页面，请手动交卷');
                    stopAutoLoop();
                }
                return;
            }

            const startBtn = document.getElementById('ai-auto-start');
            const stopBtn = document.getElementById('ai-auto-stop');
            if (startBtn && stopBtn) {
                startBtn.style.display = 'none';
                stopBtn.style.display = 'inline-block';
            }
            showStatus('🚀 检测到自动答题状态，3秒后继续...');
            setTimeout(() => runAI(true), 3000);
        } else {
            showStatus('脚本已加载，混淆修复开启');
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    console.log('超星考试选项选择器 Pro 已加载');
})();
