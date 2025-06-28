/**
 * Chrome插件后台脚本
 * 处理跨页面通信、徽章更新、事件监听等
 */

// 当插件安装或启动时初始化
chrome.runtime.onInstalled.addListener(async () => {
    console.log('密码管理器插件已安装');
    
    // 初始化徽章
    updateBadge(0);
    
    // 清理过期的临时数据（超过24小时）
    cleanupExpiredTempData();
    
    // 设置上下文菜单
    setupContextMenus();
    
    // 设置键盘快捷键
    setupKeyboardShortcuts();
    
    // 初始化同步管理器
    try {
        // 注意：由于background script的限制，同步功能主要在popup中初始化
        console.log('同步功能将在用户打开插件时初始化');
    } catch (error) {
        console.error('同步初始化失败:', error);
    }
});

// 监听来自content script和popup的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('收到消息:', request);
    
    switch (request.type) {
        case 'TEMP_DATA_UPDATED':
            // 更新徽章显示临时数据数量
            updateBadge(request.count);
            sendResponse({ success: true });
            break;
            
        case 'GET_TEMP_COUNT':
            // 获取临时数据数量
            getTempDataCount().then(count => {
                sendResponse({ count });
            }).catch(error => {
                sendResponse({ error: error.message });
            });
            return true; // 保持消息通道开放
            
        case 'SHOW_LOGIN_DETECTED':
            // 显示登录检测通知
            showLoginDetectedNotification(request.data);
            sendResponse({ success: true });
            break;
            
        case 'COPY_TO_CLIPBOARD':
            // 复制到剪贴板
            copyToClipboard(request.text).then(() => {
                sendResponse({ success: true });
            }).catch(error => {
                sendResponse({ success: false, error: error.message });
            });
            return true;
            
        case 'GET_ACTIVE_TAB_INFO':
            // 获取当前活动标签页信息
            getActiveTabInfo().then(info => {
                sendResponse(info);
            }).catch(error => {
                sendResponse({ error: error.message });
            });
            return true;
            
        case 'FILL_FORM':
            // 向content script发送填充表单命令
            if (sender.tab && sender.tab.id) {
                fillFormInTab(sender.tab.id, request.data);
                sendResponse({ success: true });
            } else {
                // 如果没有tab信息，尝试向当前活动标签页发送
                getActiveTabInfo().then(tabInfo => {
                    if (tabInfo.tabId) {
                        fillFormInTab(tabInfo.tabId, request.data);
                        sendResponse({ success: true });
                    } else {
                        sendResponse({ success: false, error: '无法确定目标标签页' });
                    }
                }).catch(error => {
                    sendResponse({ success: false, error: error.message });
                });
                return true; // 保持消息通道开放
            }
            break;
            
        case 'SHOW_FILL_OPTIONS':
            // 显示填充选项
            if (sender.tab && sender.tab.id) {
                showFillOptionsInTab(sender.tab.id);
                sendResponse({ success: true });
            } else {
                // 如果没有tab信息，尝试向当前活动标签页发送
                getActiveTabInfo().then(tabInfo => {
                    if (tabInfo.tabId) {
                        showFillOptionsInTab(tabInfo.tabId);
                        sendResponse({ success: true });
                    } else {
                        sendResponse({ success: false, error: '无法确定目标标签页' });
                    }
                }).catch(error => {
                    sendResponse({ success: false, error: error.message });
                });
                return true; // 保持消息通道开放
            }
            break;
            
        case 'DEBUG_TEST':
            // 调试测试消息
            console.log('Debug test received:', request.data);
            sendResponse({ 
                status: 'ok', 
                message: 'Background script is working',
                timestamp: new Date().toISOString(),
                extensionId: chrome.runtime.id
            });
            break;
            
        default:
            console.warn('未知消息类型:', request.type);
            sendResponse({ success: false, error: '未知消息类型' });
    }
});

// 监听标签页更新事件
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // 当页面完成加载时，检查是否有临时数据需要显示徽章
    if (changeInfo.status === 'complete' && tab.url) {
        updateBadgeForCurrentTab();
    }
});

// 监听标签页激活事件
chrome.tabs.onActivated.addListener((activeInfo) => {
    updateBadgeForCurrentTab();
});

/**
 * 更新插件徽章
 * @param {number} count - 显示的数字
 */
function updateBadge(count) {
    const text = count > 0 ? count.toString() : '';
    const color = count > 0 ? '#ff4444' : '#666666';
    
    chrome.action.setBadgeText({ text });
    chrome.action.setBadgeBackgroundColor({ color });
    
    // 更新图标标题
    const title = count > 0 
        ? `密码管理器 - ${count}个待保存账号` 
        : '密码管理器';
    chrome.action.setTitle({ title });
}

/**
 * 获取临时数据数量
 * @returns {Promise<number>} 临时数据数量
 */
async function getTempDataCount() {
    try {
        const data = await getStorageData('temp_accounts');
        return Array.isArray(data) ? data.length : 0;
    } catch (error) {
        console.error('获取临时数据数量失败:', error);
        return 0;
    }
}

/**
 * 为当前标签页更新徽章
 */
async function updateBadgeForCurrentTab() {
    try {
        const count = await getTempDataCount();
        updateBadge(count);
    } catch (error) {
        console.error('更新徽章失败:', error);
    }
}

/**
 * 显示登录检测通知
 * @param {object} data - 检测到的登录数据
 */
function showLoginDetectedNotification(data) {
    // 创建桌面通知（需要用户授权）
    if (Notification.permission === 'granted') {
        new Notification('检测到登录信息', {
            body: `在 ${data.domain} 检测到账号: ${data.username}`,
            icon: 'icons/icon48.png',
            tag: 'login-detected'
        });
    }
    
    // 更新徽章（即使通知权限未授权也显示）
    updateBadgeForCurrentTab();
}

/**
 * 复制文本到剪贴板
 * @param {string} text - 要复制的文本
 * @returns {Promise<void>}
 */
async function copyToClipboard(text) {
    try {
        // 在service worker中不能直接使用navigator.clipboard
        // 需要通过offscreen document或content script实现
        // 这里使用一个简单的实现
        
        // 向活动标签页发送复制命令
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs[0]) {
            await chrome.tabs.sendMessage(tabs[0].id, {
                type: 'COPY_TEXT',
                text: text
            });
        }
    } catch (error) {
        console.error('复制到剪贴板失败:', error);
        throw error;
    }
}

/**
 * 获取当前活动标签页信息
 * @returns {Promise<object>} 标签页信息
 */
async function getActiveTabInfo() {
    try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (tabs[0]) {
            const tab = tabs[0];
            const url = new URL(tab.url);
            
            return {
                tabId: tab.id,
                url: tab.url,
                hostname: url.hostname,
                title: tab.title,
                favIconUrl: tab.favIconUrl
            };
        }
        
        throw new Error('未找到活动标签页');
    } catch (error) {
        console.error('获取标签页信息失败:', error);
        throw error;
    }
}

/**
 * 向指定标签页发送填充表单命令
 * @param {number} tabId - 标签页ID
 * @param {object} data - 填充数据
 */
async function fillFormInTab(tabId, data) {
    try {
        await chrome.tabs.sendMessage(tabId, {
            type: 'FILL_FORM_DATA',
            data: data
        });
    } catch (error) {
        console.error('发送填充命令失败:', error);
    }
}

/**
 * 向指定标签页显示填充选项
 * @param {number} tabId - 标签页ID
 */
async function showFillOptionsInTab(tabId) {
    try {
        await chrome.tabs.sendMessage(tabId, {
            type: 'SHOW_FILL_OPTIONS'
        });
    } catch (error) {
        console.error('向标签页发送显示填充选项命令失败:', error);
    }
}

/**
 * 清理过期的临时数据
 */
async function cleanupExpiredTempData() {
    try {
        const data = await getStorageData('temp_accounts');
        if (!Array.isArray(data)) return;
        
        const now = Date.now();
        const expireTime = 24 * 60 * 60 * 1000; // 24小时
        
        const validData = data.filter(item => {
            return (now - item.timestamp) < expireTime;
        });
        
        if (validData.length !== data.length) {
            await setStorageData('temp_accounts', validData);
            updateBadge(validData.length);
            console.log(`清理了 ${data.length - validData.length} 条过期临时数据`);
        }
    } catch (error) {
        console.error('清理临时数据失败:', error);
    }
}

/**
 * 定期清理过期数据
 */
setInterval(() => {
    cleanupExpiredTempData();
}, 60 * 60 * 1000); // 每小时清理一次

/**
 * 存储数据的辅助方法
 * @param {string} key - 存储键
 * @param {any} data - 数据
 */
function setStorageData(key, data) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.set({ [key]: data }, () => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve();
            }
        });
    });
}

/**
 * 获取存储数据的辅助方法
 * @param {string} key - 存储键
 * @returns {Promise<any>} 数据
 */
function getStorageData(key) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get([key], (result) => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve(result[key]);
            }
        });
    });
}

/**
 * 监听存储变化
 */
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.temp_accounts) {
        const newValue = changes.temp_accounts.newValue;
        const count = Array.isArray(newValue) ? newValue.length : 0;
        updateBadge(count);
    }
});

/**
 * 处理插件上下文菜单（如果需要）
 */
function setupContextMenus() {
    // 检查contextMenus API是否可用
    if (chrome.contextMenus) {
        try {
            // 创建上下文菜单项
            chrome.contextMenus.create({
                id: 'fill-password',
                title: '填充密码',
                contexts: ['editable'],
                documentUrlPatterns: ['http://*/*', 'https://*/*']
            });

            // 监听上下文菜单点击
            chrome.contextMenus.onClicked.addListener((info, tab) => {
                if (info.menuItemId === 'fill-password' && tab && tab.id) {
                    // 向content script发送填充命令
                    chrome.tabs.sendMessage(tab.id, {
                        type: 'SHOW_FILL_OPTIONS',
                        targetElement: info.targetElementId
                    }).catch(error => {
                        console.error('发送上下文菜单命令失败:', error);
                    });
                }
            });
        } catch (error) {
            console.warn('创建上下文菜单失败:', error);
        }
    }
}

/**
 * 处理键盘快捷键
 */
function setupKeyboardShortcuts() {
    if (chrome.commands) {
        try {
            chrome.commands.onCommand.addListener((command) => {
                switch (command) {
                    case 'toggle-popup':
                        // 打开/关闭popup
                        if (chrome.action && chrome.action.openPopup) {
                            chrome.action.openPopup();
                        }
                        break;
                    case 'quick-fill':
                        // 快速填充最近使用的账号
                        quickFillLastUsed();
                        break;
                }
            });
        } catch (error) {
            console.warn('设置键盘快捷键失败:', error);
        }
    }
}

/**
 * 快速填充最近使用的账号
 */
async function quickFillLastUsed() {
    try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tabs[0]) return;
        
        const tab = tabs[0];
        const url = new URL(tab.url);
        const hostname = url.hostname;
        
        // 获取该域名下的账号
        const allAccounts = await getStorageData('password_accounts');
        if (!allAccounts) return;
        
        // 查找匹配的域名
        for (const [domain, domainData] of Object.entries(allAccounts)) {
            if (hostname.includes(domain) && domainData.accounts?.length > 0) {
                // 使用第一个账号进行填充
                const account = domainData.accounts[0];
                
                chrome.tabs.sendMessage(tab.id, {
                    type: 'QUICK_FILL',
                    account: account
                }).catch(error => {
                    console.error('快速填充消息发送失败:', error);
                });
                break;
            }
        }
    } catch (error) {
        console.error('快速填充失败:', error);
    }
}

// 错误处理
chrome.runtime.onStartup.addListener(() => {
    console.log('密码管理器插件启动');
    updateBadgeForCurrentTab();
});

// 当插件被禁用或卸载时的清理工作
chrome.runtime.onSuspend.addListener(() => {
    console.log('密码管理器插件暂停');
});

console.log('Background script loaded successfully'); 