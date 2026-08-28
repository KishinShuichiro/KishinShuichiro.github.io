document.addEventListener(
    'DOMContentLoaded',
    function () {

        const params =
            new URLSearchParams(
                window.location.search
            );

        const query =
            params.get('search');

        const matchRaw =
            params.get('match');

        if (!query) {
            return;
        }

        const wantedMatch =
            Math.max(
                1,
                parseInt(
                    matchRaw || '1',
                    10
                ) || 1
            );

        /*
         * 给其他页面脚本一点时间初始化。
         * 特别是 Project 会先执行自己的正文分页。
         */
        window.setTimeout(
            function () {

                openGlobalSearchMatch(
                    query,
                    wantedMatch
                );

            },
            100
        );
    }
);


/* =========================================================
   入口
   ========================================================= */

function openGlobalSearchMatch(
    query,
    wantedMatch
) {

    /*
     * Project 使用特殊分页系统。
     */
    const projectPages =
        Array.from(
            document.querySelectorAll(
                '#project-content-pages .project-content-page'
            )
        );

    if (
        projectPages.length > 0
    ) {

        openProjectSearchMatch(
            projectPages,
            query,
            wantedMatch
        );

        return;
    }


    /*
     * 其他所有页面统一处理。
     */
    const root =
        findSearchRoot();

    if (!root) {
        return;
    }

    openNormalSearchMatch(
        root,
        query,
        wantedMatch
    );
}


/* =========================================================
   自动寻找正文容器
   ========================================================= */

function findSearchRoot() {

    /*
     * 从最具体到最宽泛。
     *
     * 以后如果新页面仍然使用 .post-content，
     * 不需要改任何代码。
     */
    const selectors = [

        /*
         * PaperMod Post 正文
         */
        '.post-single .post-content',

        /*
         * 常规正文
         */
        'article .post-content',

        /*
         * 自定义页面常用
         */
        '.post-content',

        /*
         * 最后兜底
         */
        'main'
    ];


    for (
        const selector
        of selectors
    ) {

        const element =
            document.querySelector(
                selector
            );

        if (element) {
            return element;
        }
    }


    return null;
}


/* =========================================================
   普通页面定位
   ========================================================= */

function openNormalSearchMatch(
    root,
    query,
    wantedMatch
) {

    const result =
        findNthTextMatch(
            root,
            query,
            wantedMatch
        );


    if (!result) {

        /*
         * 搜索索引和实际 DOM 如果略有差异，
         * 至少跳到第一处。
         */
        if (
            wantedMatch !== 1
        ) {

            openNormalSearchMatch(
                root,
                query,
                1
            );
        }

        return;
    }


    highlightTextMatch(
        result.node,
        result.offset,
        query.length
    );
}


/* =========================================================
   Project 页面定位
   ========================================================= */

function openProjectSearchMatch(
    pages,
    query,
    wantedMatch
) {

    let currentMatch =
        0;


    for (
        let pageIndex = 0;
        pageIndex <
            pages.length;
        pageIndex++
    ) {

        const page =
            pages[
                pageIndex
            ];


        const walker =
            createTextWalker(
                page
            );


        let textNode;


        while (
            textNode =
                walker.nextNode()
        ) {

            const text =
                textNode.nodeValue ||
                '';

            const lower =
                text.toLowerCase();

            const q =
                query.toLowerCase();

            let position =
                0;


            while (true) {

                const found =
                    lower.indexOf(
                        q,
                        position
                    );


                if (
                    found === -1
                ) {
                    break;
                }


                currentMatch++;


                if (
                    currentMatch ===
                    wantedMatch
                ) {

                    /*
                     * 先让 Project 自己的分页 UI
                     * 切到正确页。
                     */
                    switchProjectPage(
                        pageIndex
                    );


                    /*
                     * 页面切完之后再高亮。
                     */
                    window.setTimeout(
                        function () {

                            highlightTextMatch(
                                textNode,
                                found,
                                query.length
                            );

                        },
                        30
                    );


                    return;
                }


                position =
                    found +
                    Math.max(
                        q.length,
                        1
                    );
            }
        }
    }


    /*
     * 编号对不上时退回第一处。
     */
    if (
        wantedMatch !== 1
    ) {

        openProjectSearchMatch(
            pages,
            query,
            1
        );
    }
}


/* =========================================================
   Project 切页
   ========================================================= */

function switchProjectPage(
    targetPage
) {

    /*
     * 目标页如果已经出现在页码栏里，
     * 直接点击。
     */
    const pageButtons =
        Array.from(
            document.querySelectorAll(
                '.project-content-page-number'
            )
        );


    const targetText =
        String(
            targetPage + 1
        );


    const targetButton =
        pageButtons.find(
            function (button) {

                return (
                    button
                        .textContent
                        .trim() ===
                    targetText
                );
            }
        );


    if (targetButton) {

        targetButton.click();

        return;
    }


    /*
     * 页码窗口里没有目标页：
     * 回第一页，再点击 Next。
     *
     * 这样使用的是 Project 原本自己的
     * goToPage() 状态，不会出现两套分页。
     */
    const first =
        document.getElementById(
            'project-content-first'
        );


    const next =
        document.getElementById(
            'project-content-next'
        );


    if (
        !first ||
        !next
    ) {
        return;
    }


    first.click();


    for (
        let i = 0;
        i < targetPage;
        i++
    ) {

        next.click();
    }
}


/* =========================================================
   找第 N 个匹配
   ========================================================= */

function findNthTextMatch(
    root,
    query,
    wantedMatch
) {

    const walker =
        createTextWalker(
            root
        );


    const q =
        query.toLowerCase();


    let currentMatch =
        0;


    let textNode;


    while (
        textNode =
            walker.nextNode()
    ) {

        const text =
            textNode.nodeValue ||
            '';

        const lower =
            text.toLowerCase();


        let position =
            0;


        while (true) {

            const found =
                lower.indexOf(
                    q,
                    position
                );


            if (
                found === -1
            ) {
                break;
            }


            currentMatch++;


            if (
                currentMatch ===
                wantedMatch
            ) {

                return {
                    node:
                        textNode,

                    offset:
                        found
                };
            }


            position =
                found +
                Math.max(
                    q.length,
                    1
                );
        }
    }


    return null;
}


/* =========================================================
   TreeWalker
   ========================================================= */

function createTextWalker(
    root
) {

    return document.createTreeWalker(

        root,

        NodeFilter.SHOW_TEXT,

        {
            acceptNode:
                function (node) {

                    const parent =
                        node.parentElement;


                    if (!parent) {

                        return NodeFilter
                            .FILTER_REJECT;
                    }


                    /*
                     * 不搜索代码、脚本、样式、按钮等 UI。
                     */
                    if (
                        parent.closest(
                            [
                                'script',
                                'style',
                                'noscript',
                                'button',
                                'input',
                                'textarea',
                                'select',
                                'option'
                            ].join(',')
                        )
                    ) {

                        return NodeFilter
                            .FILTER_REJECT;
                    }


                    /*
                     * 已经生成的搜索高亮不要再次进入。
                     */
                    if (
                        parent.closest(
                            '.global-search-hit'
                        )
                    ) {

                        return NodeFilter
                            .FILTER_REJECT;
                    }


                    if (
                        !node.nodeValue ||
                        !node.nodeValue.trim()
                    ) {

                        return NodeFilter
                            .FILTER_REJECT;
                    }


                    return NodeFilter
                        .FILTER_ACCEPT;
                }
        }
    );
}


/* =========================================================
   创建高亮 + 滚动
   ========================================================= */

function highlightTextMatch(
    textNode,
    startOffset,
    length
) {

    /*
     * 移除旧的搜索高亮。
     */
    document
        .querySelectorAll(
            '.global-search-hit'
        )
        .forEach(
            function (mark) {

                unwrapElement(
                    mark
                );
            }
        );


    const range =
        document.createRange();


    range.setStart(
        textNode,
        startOffset
    );


    range.setEnd(
        textNode,
        startOffset +
        length
    );


    const mark =
        document.createElement(
            'mark'
        );


    mark.className =
        'global-search-hit';


    try {

        range.surroundContents(
            mark
        );

    } catch (error) {

        const parent =
            textNode.parentElement;

        if (parent) {

            parent.scrollIntoView({
                behavior:
                    'smooth',

                block:
                    'center'
            });
        }

        return;
    }


    /*
     * 目标有时位于 sticky header 下方，
     * CSS 的 scroll-margin 会留出空间。
     */
    window.setTimeout(
        function () {

            mark.scrollIntoView({

                behavior:
                    'smooth',

                block:
                    'center',

                inline:
                    'nearest'
            });

        },
        20
    );
}


/* =========================================================
   去掉旧 mark，但保留文字
   ========================================================= */

function unwrapElement(
    element
) {

    const parent =
        element.parentNode;


    if (!parent) {
        return;
    }


    while (
        element.firstChild
    ) {

        parent.insertBefore(
            element.firstChild,
            element
        );
    }


    parent.removeChild(
        element
    );


    parent.normalize();
}
