// ==UserScript==
// @name         Bangumi 收藏条目批量删除
// @namespace    https://github.com/furtherun/bangumi-collect-delete-batch
// @version      0.0.1
// @author       furtherun
// @description  选择条目加入“待删除列表”后批量删除，无需每个条目进行确认。
// @description  设置页面参考代码，bangumi过滤搜索结果，原始脚本作者：Liaune，代码地址，
// @description  https://github.com/bangumi/scripts/blob/master/liaune/bangumi_result_blacklist.user.js
// @match        http*://bgm.tv/*
// @match        http*://chii.in/*
// @match        http*://bangumi.tv/*
// @grant        none
// ==/UserScript==

// 创建一个<style>元素
let style = document.createElement('style');
// 设置CSS代码
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
    `;
// 将<style>元素添加到<head>元素中
document.head.appendChild(style);

(function () {

    if (document.location.href.match(/list/)) {
        let collectModifys = document.querySelectorAll(".collectModify");
        let collect_list = JSON.parse(localStorage.getItem('bgm_collect_delete_list')) || [];

        collectModifys.forEach((collectModify) => {
            let del = collectModify.querySelectorAll(".l")[1];
            let del_id = del.attributes["onclick"].value;

            let checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'collect_delete_checkbox';
            checkbox.checked = collect_list.includes(del_id);

            checkbox.addEventListener('click', function () {
                if (this.checked) {
                    collect_list.push(del_id);
                } else {
                    let index = collect_list.indexOf(del_id);
                    if (index !== -1) {
                        collect_list.splice(index, 1);
                    }
                }
                localStorage.setItem('bgm_collect_delete_list', JSON.stringify(collect_list));
            });

            collectModify.insertBefore(checkbox, del);
        });

        function createButton(text, title, conditionFunc) {
            let button = document.createElement('button');
            button.textContent = text;
            button.classList.add('collect_delete_button');
            button.title = title;

            button.addEventListener('click', function () {
                let items = document.querySelectorAll('#browserItemList>li');
                items.forEach((item) => {
                    let del = item.querySelector(".collectModify").querySelectorAll(".l")[1];
                    let del_id = del.attributes["onclick"].value;
                    if (conditionFunc(item)) {
                        let index = collect_list.indexOf(del_id);
                        if (index !== -1) {
                            collect_list.splice(index, 1);
                        } else {
                            collect_list.push(del_id);
                        }
                        let checkbox = item.querySelector('.collectModify .collect_delete_checkbox');
                        if (checkbox) {
                            checkbox.checked = !checkbox.checked;
                        }
                    }
                });
                localStorage.setItem('bgm_collect_delete_list', JSON.stringify(collect_list));
            });

            return button;
        }

        let browserTools = document.querySelector("#browserTools #browserTypeSelector");

        let addNoCommentButton = createButton('评论',
            '将本页“无评论”条目加入/移出删除列表',
            (item) => !item.querySelector('#comment_box'));
        browserTools.appendChild(addNoCommentButton);

        let addNoRatingButton = createButton('评分',
            '将本页“无评分”条目加入/移出删除列表',
            (item) => !item.querySelector('.collectInfo .starstop-s'));
        browserTools.appendChild(addNoRatingButton);

        let addAllButton = createButton('所有', '将本页“所有条目”加入/移出删除列表', () => true);
        browserTools.appendChild(addAllButton);

    }

    // 设置页面
    if (document.location.href.match(/settings/)) {

        $("#header > ul").append('<li><a id="deletelist" href="javascript:void(0);"><span>待删除收藏条目</span></a></li>');
        $("#deletelist").on("click", function () {
            $("#header").find("[class='selected']").removeClass("selected");
            $("#deletelist").addClass("selected");
            let collect_list = JSON.parse(localStorage.getItem('bgm_collect_delete_list')) || [];
            let data = collect_list.join('\n');
            let html = '<form>' +
                '<span class="text">以下是你所保存的待删除收藏条目，你可以<strong>按行</strong>编辑和替换，确认无误后点击“保存修改”。</span>' +
                '<span class="text">“执行删除”后<strong>不可撤销</strong>，慎重操作。</span>' +
                '<textarea id="data_content" name="content" cols="45" rows="15" style="width: 1000px;" class="quick">' + data + '</textarea>' +
                '<input id="submitBtn" class="inputBtn" value="保存修改" readonly unselectable="on" style="width:52px">' +
                '<input id="clearBtn" class="inputBtn" value="执行删除" readonly unselectable="on" style="width:52px; margin-left: 10px">' +
                '<a id="alert_submit" style="color: #F09199; font-size: 14px; padding: 20px"></a>' +
                '</form>';
            $("#columnA").html(html);
            $("#submitBtn").on("click", function () {
                data = $("#data_content").attr("value");
                collect_list = data.split('\n');
                localStorage.setItem('bgm_collect_delete_list', JSON.stringify(collect_list));
                alert('保存成功！');
            });
            $("#clearBtn").on("click", function () {
                let collect_list = JSON.parse(localStorage.getItem('bgm_collect_delete_list')) || [];
                let delay = 0; // 延迟时间，单位为毫秒

                // 创建一个隐藏的 iframe
                let iframe = document.createElement('iframe');
                iframe.style.display = 'none';
                document.body.appendChild(iframe);

                for (let item of collect_list) {
                    setTimeout(function () {
                        // 在 iframe 中加载新页面
                        iframe.src = window.location.href;

                        // 等待 iframe 加载完成
                        iframe.onload = function () {
                            // 跳过 iframe 中的确认对话框
                            iframe.contentWindow.confirm = function () {
                                return true;
                            };

                            // 在 iframe 中执行命令
                            iframe.contentWindow.eval(item);

                            // 执行完 item 后，从 collect_list 中删除它
                            collect_list = collect_list.filter(i => i !== item);

                            // 更新本地存储
                            localStorage.setItem('bgm_collect_delete_list', JSON.stringify(collect_list));

                            // 更新表单中的显示
                            $("#data_content").attr("value", collect_list.join('\n'));
                        };
                    }, delay);

                    delay += 2000; // 增加延迟时间
                }

                $("#data_content").attr("value", "");
                localStorage.removeItem('bgm_collect_delete_list');
            });
        });

    }
})();
