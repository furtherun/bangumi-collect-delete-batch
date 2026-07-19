// ==UserScript==
// @name         Bangumi 收藏条目批量删除
// @namespace    https://github.com/furtherun/bangumi-collect-delete-batch
// @version      0.0.3
// @author       furtherun
// @description  选择条目加入“待删除列表”后批量删除，无需每个条目进行确认。
// @icon         https://bgm.tv/pic/user/m/icon.jpg
// @match        http*://bgm.tv/*
// @match        http*://chii.in/*
// @match        http*://bangumi.tv/*
// @grant        none
// ==/UserScript==

(function () {
    const STORAGE_KEY = 'bgm_collect_delete_list';
    const SETTINGS_PATH_RE = /^\/settings(?:\/|$)/;
    const UI_TEXT = Object.freeze({
        customizePanelTitle: '待删除收藏条目',
        settingsEntryLabel: '待删除收藏条目',
        customizeToggleLabel: '个性化',
        introLine1: '以下是你标记的待删除收藏条目。每行以条目编号开头，后面的条目注释仅供参考。',
        introLine2: '自行编写只需要按行填写条目编号即可，填写后及时保存，并<strong>手动刷新</strong>页面。',
        warningLine: '“执行删除”后<strong>不可撤销</strong>，慎重操作。',
        saveButton: '保存修改',
        deleteButton: '执行删除',
        saveSuccess: '保存成功！请<strong>手动刷新</strong>页面。',
        emptyList: '当前没有待删除条目。',
        deletingProgress: '正在执行删除：<strong>{current}/{total}</strong>',
        deletingItem: '正在处理 <strong>{current}/{total}</strong>：{label}',
        deleteFinished: '删除执行已完成。请<strong>手动刷新</strong>页面。',
        noName: '（暂无名称）',
        addNoCommentButton: '评论',
        addNoRatingButton: '评分',
        addAllButton: '所有',
        addNoCommentTitle: '将本页“无评论”条目加入/移出删除列表',
        addNoRatingTitle: '将本页“无评分”条目加入/移出删除列表',
        addAllTitle: '将本页“所有条目”加入/移出删除列表',
        panelSectionTitle: '待删除收藏条目'
    });

    function addStyles() {
        if (document.getElementById('bgm-collect-delete-batch-style')) {
            return;
        }

        const style = document.createElement('style');
        style.id = 'bgm-collect-delete-batch-style';
        style.textContent = `
            .collect_delete_checkbox {
                margin-right: 5px;
                border: 1px solid #ccc;
                border-radius: 3px;
                background-color: #f9f8f7;
            }
            .collect_delete_button {
                font-size: 10px;
                padding: 1px;
                cursor: pointer;
                margin: 0 2px;
            }
            .collect-delete-batch-settings {
                max-width: 1000px;
                font-size: 13px;
                color: #444;
            }
            .collect-delete-batch-settings .text {
                display: block;
                margin-bottom: 8px;
                line-height: 1.6;
            }
            .collect-delete-batch-settings .text strong {
                font-weight: 600;
                color: #333;
            }
            .collect-delete-batch-settings textarea {
                width: 100%;
                max-width: 1000px;
                min-height: 220px;
                padding: 8px;
                border: 1px solid #ccc;
                background: #fff;
                box-sizing: border-box;
                font-family: Consolas, Monaco, monospace;
                font-size: 13px;
                line-height: 1.5;
                resize: vertical;
            }
            .collect-delete-batch-settings .inputBtn {
                margin-top: 10px;
                padding: 2px 10px;
                border: 1px solid #ccc;
                background: #f6f6f6;
                color: #333;
                cursor: pointer;
            }
            .collect-delete-batch-settings .inputBtn:hover {
                background: #ececec;
            }
            .collect-delete-batch-settings-panel {
                margin-top: 12px;
            }
            .collect-delete-batch-settings-panel textarea {
                min-height: 180px;
            }
            .collect-delete-batch-panel-section {
                margin-top: 16px;
                padding-top: 16px;
                border-top: 1px solid #e5e5e5;
            }
            .collect-delete-batch-panel-section .title {
                margin-bottom: 8px;
                font-weight: 600;
                color: #333;
            }
            .collect-delete-batch-tab-link {
                cursor: pointer;
            }
            .collect-delete-batch-tab-link.focus {
                font-weight: 600;
            }
            .collect-delete-batch-customize-panel {
                position: fixed;
                z-index: 2147483647;
                width: 560px;
                max-width: calc(100vw - 24px);
                max-height: calc(100vh - 24px);
                overflow: auto;
                background: #fff;
                border: 1px solid #ddd;
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
                border-radius: 8px;
                resize: both;
            }
            .collect-delete-batch-customize-panel .header {
                cursor: move;
                user-select: none;
                padding: 12px 16px;
                border-bottom: 1px solid #eee;
                background: #f7f7f7;
            }
            .collect-delete-batch-customize-panel .content {
                padding: 16px;
            }
        `;
        document.head.appendChild(style);
    }

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function extractNumericId(value) {
        if (value == null) {
            return '';
        }

        const match = String(value).match(/(\d+)/);
        return match ? match[1] : '';
    }

    function parseDeleteEntry(value) {
        if (value && typeof value === 'object') {
            const id = extractNumericId(value.id || value.subjectId || value.entryId || '');
            if (!id) {
                return null;
            }
            return {
                id,
                userId: String(value.userId || value.user || '').trim(),
                title: String(value.title || value.name || '').trim(),
            };
        }

        if (typeof value !== 'string') {
            return null;
        }

        const trimmed = value.trim();
        if (!trimmed) {
            return null;
        }

        const commandMatch = trimmed.match(/eraseSubjectCollect\(\s*(\d+)\s*,\s*'([^']*)'/i);
        if (commandMatch) {
            return {
                id: commandMatch[1],
                userId: commandMatch[2] || '',
                title: '',
            };
        }

        const simpleMatch = trimmed.match(/eraseSubjectCollect\(\s*(\d+)/i);
        if (simpleMatch) {
            return {
                id: simpleMatch[1],
                userId: '',
                title: '',
            };
        }

        const id = extractNumericId(trimmed);
        if (!id) {
            return null;
        }

        return {
            id,
            userId: '',
            title: trimmed.replace(/^\d+\s*(?:\/|—|-|:)?\s*/, '').trim(),
        };
    }

    function normalizeDeleteList(list) {
        const result = [];
        const seen = new Set();

        (Array.isArray(list) ? list : []).forEach((item) => {
            const entry = parseDeleteEntry(item);
            if (!entry || seen.has(entry.id)) {
                return;
            }
            seen.add(entry.id);
            result.push(entry);
        });

        return result;
    }

    function getDeleteList() {
        try {
            const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
            return normalizeDeleteList(stored);
        } catch (error) {
            console.error('[bgm collect delete batch] 读取待删除列表失败', error);
            return [];
        }
    }

    function saveDeleteList(list) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeDeleteList(list)));
    }

    function buildDeleteCommand(entry) {
        if (!entry || !entry.id) {
            return '';
        }
        const userId = entry.userId ? `'${entry.userId}'` : "''";
        return `eraseSubjectCollect(${entry.id}, ${userId})`;
    }

    function getSubjectInfo(item) {
        const collectModify = item.querySelector('.collectModify');
        if (!collectModify) {
            return null;
        }

        const del = collectModify.querySelectorAll('.l')[1];
        if (!del) {
            return null;
        }

        const onclickValue = del.getAttribute('onclick') || '';
        const userIdMatch = onclickValue.match(/eraseSubjectCollect\(\s*\d+\s*,\s*'([^']*)'/i);
        const subjectId = item.getAttribute('data-subject-id') || (onclickValue.match(/eraseSubjectCollect\(\s*(\d+)/i) || [])[1] || '';

        const titleLink = item.querySelector('h3 a.l, h3 a');
        const titleText = titleLink ? titleLink.textContent.trim() : '';
        const subTitleText = item.querySelector('h3 small.grey') ? item.querySelector('h3 small.grey').textContent.trim() : '';
        const title = [titleText, subTitleText].filter(Boolean).join(' / ');

        return {
            id: subjectId,
            userId: userIdMatch ? userIdMatch[1] : '',
            title,
        };
    }

    function upsertDeleteEntry(list, entry) {
        if (!entry || !entry.id) {
            return list;
        }

        const nextList = list.filter((item) => item.id !== entry.id);
        nextList.push(entry);
        return nextList;
    }

    function removeDeleteEntry(list, id) {
        return list.filter((item) => item.id !== id);
    }

    function initListPage() {
        const collectModifys = document.querySelectorAll('.collectModify');
        const collectList = getDeleteList();

        collectModifys.forEach((collectModify) => {
            if (collectModify.querySelector('.collect_delete_checkbox[data-bgm-delete-batch-checkbox]')) {
                return;
            }

            const listItem = collectModify.closest('li');
            if (!listItem) {
                return;
            }

            const info = getSubjectInfo(listItem);
            const del = collectModify.querySelectorAll('.l')[1];
            if (!del || !info || !info.id) {
                return;
            }

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'collect_delete_checkbox';
            checkbox.setAttribute('data-bgm-delete-batch-checkbox', 'true');
            checkbox.checked = collectList.some((entry) => entry.id === info.id);

            checkbox.addEventListener('click', function () {
                const currentList = getDeleteList();
                if (this.checked) {
                    saveDeleteList(upsertDeleteEntry(currentList, info));
                } else {
                    saveDeleteList(removeDeleteEntry(currentList, info.id));
                }
            });

            collectModify.insertBefore(checkbox, del);
        });

        function createButton(text, title, conditionFunc) {
            const button = document.createElement('button');
            button.textContent = text;
            button.classList.add('collect_delete_button');
            button.setAttribute('data-bgm-delete-batch-bulk-button', 'true');
            button.title = title;

            button.addEventListener('click', function () {
                const items = document.querySelectorAll('#browserItemList>li');
                const currentList = getDeleteList();
                const nextList = currentList.slice();

                items.forEach((item) => {
                    if (!conditionFunc(item)) {
                        return;
                    }

                    const info = getSubjectInfo(item);
                    if (!info || !info.id) {
                        return;
                    }

                    const index = nextList.findIndex((entry) => entry.id === info.id);
                    if (index !== -1) {
                        nextList.splice(index, 1);
                    } else {
                        nextList.push(info);
                    }

                    const checkbox = item.querySelector('.collect_delete_checkbox[data-bgm-delete-batch-checkbox]');
                    if (checkbox) {
                        checkbox.checked = nextList.some((entry) => entry.id === info.id);
                    }
                });

                saveDeleteList(nextList);
            });

            return button;
        }

        const browserTools = document.querySelector('#browserTools #browserTypeSelector');
        if (!browserTools) {
            return;
        }

        if (!browserTools.querySelector('.collect_delete_button[data-bgm-delete-batch-bulk-button]')) {
            const addNoCommentButton = createButton('评论', '将本页“无评论”条目加入/移出删除列表', (item) => !item.querySelector('#comment_box'));
            browserTools.appendChild(addNoCommentButton);

            const addNoRatingButton = createButton('评分', '将本页“无评分”条目加入/移出删除列表', (item) => !item.querySelector('.collectInfo .starstop-s'));
            browserTools.appendChild(addNoRatingButton);

            const addAllButton = createButton('所有', '将本页“所有条目”加入/移出删除列表', () => true);
            browserTools.appendChild(addAllButton);
        }
    }

    function getSettingsContentContainer() {
        return document.getElementById('columnA')
            || document.getElementById('columnB')
            || document.querySelector('.column:not(#columnSearchA)')
            || document.getElementById('main')
            || document.body;
    }

    function renderDeleteListView(container, isPanel) {
        if (!container) {
            return;
        }

        const list = getDeleteList();
        const data = list.map((entry) => `${entry.id}${entry.title ? ` ${entry.title}` : ''}`).join('\n');
        const panelClass = isPanel ? ' collect-delete-batch-settings-panel' : '';

        const html = `
            <form class="collect-delete-batch-settings${panelClass}">
                <span class="text">${UI_TEXT.introLine1}</span>
                <span class="text">${UI_TEXT.introLine2}</span>
                <span class="text">${UI_TEXT.warningLine}</span>
                <textarea id="bgmDataContent" name="content" cols="45" rows="15" class="quick">${escapeHtml(data)}</textarea>
                <div>
                    <button type="button" id="bgmSubmitBtn" class="inputBtn">${UI_TEXT.saveButton}</button>
                    <button type="button" id="bgmClearBtn" class="inputBtn" style="margin-left: 10px;">${UI_TEXT.deleteButton}</button>
                    <span id="bgmAlert" style="color: #F09199; font-size: 14px; padding-left: 12px;"></span>
                </div>
            </form>`;

        container.innerHTML = html;

        const submitButton = document.getElementById('bgmSubmitBtn');
        const clearButton = document.getElementById('bgmClearBtn');
        const alertBox = document.getElementById('bgmAlert');
        const dataInput = document.getElementById('bgmDataContent');

        if (submitButton) {
            submitButton.addEventListener('click', function () {
                if (!dataInput) {
                    return;
                }

                const nextList = dataInput.value
                    .split(/\r?\n/)
                    .map((line) => line.trim())
                    .filter(Boolean)
                    .map((line) => {
                        const id = extractNumericId(line);
                        if (!id) {
                            return null;
                        }
                        const previous = list.find((entry) => entry.id === id);
                        return {
                            id,
                            userId: previous ? previous.userId : '',
                            title: previous ? previous.title : line.replace(/^\d+\s*/, '').trim(),
                        };
                    })
                    .filter(Boolean);

                saveDeleteList(nextList);
                if (alertBox) {
                    alertBox.innerHTML = UI_TEXT.saveSuccess;
                }
            });
        }

        if (clearButton) {
            clearButton.addEventListener('click', function () {
                const pending = getDeleteList();
                if (!pending.length) {
                    if (alertBox) {
                        alertBox.innerHTML = UI_TEXT.emptyList;
                    }
                    return;
                }

                const iframe = document.createElement('iframe');
                iframe.style.display = 'none';
                document.body.appendChild(iframe);

                let index = 0;
                let remaining = pending.slice();

                const renderProgress = (current, entry) => {
                    if (!alertBox) {
                        return;
                    }

                    const label = entry && (entry.title || entry.id);
                    alertBox.innerHTML = label
                        ? UI_TEXT.deletingItem
                            .replace('{current}', String(current))
                            .replace('{total}', String(pending.length))
                            .replace('{label}', escapeHtml(label))
                        : UI_TEXT.deletingProgress
                            .replace('{current}', String(current))
                            .replace('{total}', String(pending.length));
                };

                const runNext = () => {
                    if (index >= pending.length) {
                        saveDeleteList([]);
                        if (dataInput) {
                            dataInput.value = '';
                        }
                        if (alertBox) {
                            alertBox.innerHTML = UI_TEXT.deleteFinished;
                        }
                        iframe.remove();
                        return;
                    }

                    const entry = pending[index++];
                    renderProgress(index, entry);
                    iframe.src = window.location.href;
                    iframe.onload = function () {
                        if (iframe.contentWindow) {
                            iframe.contentWindow.confirm = function () {
                                return true;
                            };
                            try {
                                iframe.contentWindow.eval(buildDeleteCommand(entry));
                            } catch (error) {
                                console.error('[bgm collect delete batch] 执行删除脚本失败', error);
                            }
                        }

                        remaining = remaining.filter((item) => item.id !== entry.id);
                        saveDeleteList(remaining);
                        setTimeout(runNext, 2000);
                    };
                };

                runNext();
            });
        }
    }

    function injectSettingsEntry() {
        const navList = document.querySelector('#columnSearchA ul');
        if (!navList || navList.querySelector('[data-bgm-delete-list-link]')) {
            return;
        }

        const item = document.createElement('li');
        const link = document.createElement('a');
        link.href = 'javascript:void(0);';
        link.setAttribute('data-bgm-delete-list-link', 'true');
        link.addEventListener('click', function (event) {
            event.preventDefault();
            document.querySelectorAll('#columnSearchA a').forEach((anchor) => {
                anchor.classList.toggle('selected', anchor === link);
            });
            renderDeleteListView(getSettingsContentContainer(), false);
        });

        const span = document.createElement('span');
        span.textContent = UI_TEXT.settingsEntryLabel;
        link.appendChild(span);
        item.appendChild(link);
        navList.appendChild(item);
    }

    function injectCustomizePanel() {
        const panel = document.getElementById('customize-panel');
        if (!panel) {
            return;
        }

        if (!panel.classList.contains('collect-delete-batch-customize-panel')) {
            panel.classList.add('collect-delete-batch-customize-panel');
        }

        if (!panel.dataset.bgmDeleteBatchHeaderBound) {
            const header = panel.querySelector('.header');
            if (header) {
                header.addEventListener('mousedown', function (event) {
                    if (event.target.closest('span.close')) {
                        return;
                    }

                    const rect = panel.getBoundingClientRect();
                    const offsetX = event.clientX - rect.left;
                    const offsetY = event.clientY - rect.top;
                    const startLeft = rect.left;
                    const startTop = rect.top;

                    const moveHandler = (moveEvent) => {
                        const nextLeft = moveEvent.clientX - offsetX;
                        const nextTop = moveEvent.clientY - offsetY;
                        panel.style.left = `${Math.max(8, nextLeft)}px`;
                        panel.style.top = `${Math.max(8, nextTop)}px`;
                        panel.dataset.dragStartLeft = String(startLeft);
                        panel.dataset.dragStartTop = String(startTop);
                    };

                    const upHandler = () => {
                        document.removeEventListener('mousemove', moveHandler);
                        document.removeEventListener('mouseup', upHandler);
                    };

                    document.addEventListener('mousemove', moveHandler);
                    document.addEventListener('mouseup', upHandler);
                });
                panel.dataset.bgmDeleteBatchHeaderBound = 'true';
            }
        }

        let customTabLink = panel.querySelector('.collect-delete-batch-tab-link');
        if (!customTabLink) {
            const tabList = panel.querySelector('.panel-tabs ul');
            if (tabList) {
                const item = document.createElement('li');
                customTabLink = document.createElement('a');
                customTabLink.href = 'javascript:void(0);';
                customTabLink.className = 'tab-item collect-delete-batch-tab-link';
                customTabLink.setAttribute('data-tab', 'delete-batch');
                customTabLink.textContent = UI_TEXT.panelSectionTitle;
                customTabLink.addEventListener('click', function (event) {
                    event.preventDefault();
                    panel.querySelectorAll('.tab-item').forEach((tab) => {
                        tab.classList.toggle('focus', tab === customTabLink);
                    });
                    panel.querySelectorAll('.tab-content').forEach((tabContent) => {
                        tabContent.classList.toggle('active', tabContent.id === 'delete-batch-tab');
                    });

                    let deleteTab = panel.querySelector('#delete-batch-tab');
                    if (!deleteTab) {
                        const content = panel.querySelector('.content');
                        if (!content) {
                            return;
                        }
                        deleteTab = document.createElement('div');
                        deleteTab.id = 'delete-batch-tab';
                        deleteTab.className = 'tab-content';
                        deleteTab.setAttribute('data-bgm-delete-list-panel', 'true');
                        content.appendChild(deleteTab);
                        const section = document.createElement('div');
                        section.className = 'section collect-delete-batch-panel-section';
                        section.innerHTML = `<div class="title">${UI_TEXT.panelSectionTitle}</div>`;
                        const wrapper = document.createElement('div');
                        deleteTab.appendChild(section);
                        section.appendChild(wrapper);
                        renderDeleteListView(wrapper, true);
                    }

                    deleteTab = panel.querySelector('#delete-batch-tab');
                    if (deleteTab) {
                        deleteTab.classList.add('active');
                        deleteTab.style.display = '';
                    }
                });
                item.appendChild(customTabLink);
                tabList.appendChild(item);
            }
        }

        const panelContent = panel.querySelector('.content');
        if (!panelContent) {
            return;
        }

        const deleteTab = panel.querySelector('#delete-batch-tab');
        if (deleteTab && customTabLink && customTabLink.classList.contains('focus')) {
            deleteTab.classList.add('active');
            deleteTab.style.display = '';
        }
    }

    function initSettingsPage() {
        if (!SETTINGS_PATH_RE.test(window.location.pathname)) {
            return;
        }
        injectSettingsEntry();
    }

    function initCustomizePanel() {
        const toggleLink = document.querySelector('.toggle-customize');
        if (!toggleLink) {
            return;
        }

        if (!toggleLink.dataset.bgmDeleteBatchBound) {
            toggleLink.setAttribute('title', UI_TEXT.customizeToggleLabel);
            toggleLink.addEventListener('click', function () {
                setTimeout(injectCustomizePanel, 0);
            });
            toggleLink.dataset.bgmDeleteBatchBound = 'true';
        }

        if (document.getElementById('customize-panel')) {
            injectCustomizePanel();
        }
    }

    function init() {
        addStyles();
        if (window.location.href.match(/list/)) {
            initListPage();
        }
        initSettingsPage();
        initCustomizePanel();

        const body = document.body;
        if (body && !body.dataset.bgmDeleteBatchObserver) {
            const observer = new MutationObserver(function () {
                if (document.getElementById('customize-panel')) {
                    injectCustomizePanel();
                }
            });
            observer.observe(body, { childList: true, subtree: true });
            body.dataset.bgmDeleteBatchObserver = 'true';
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
