document.addEventListener(
    'DOMContentLoaded',
    function () {

        /* =================================================
           读取 URL
           ================================================= */

        const params =
            new URLSearchParams(
                window.location.search
            );


        const query =
            params.get(
                'search'
            );


        const matchRaw =
            params.get(
                'match'
            );


        if (
            !query ||
            !matchRaw
        ) {
            return;
        }


        const wantedMatch =
            Math.max(
                1,
                parseInt(
                    matchRaw,
                    10
                ) || 1
            );


        /*
         * list.html 的正文分页也是
         * DOMContentLoaded 时构建。
         *
         * 我们稍微延迟一下，
         * 等它把 .project-content-page
         * 全部放进 DOM。
         */
        window.setTimeout(
            function () {

                openSearchResult(
                    query,
                    wantedMatch
                );

            },
            80
        );
    }
);


/* =========================================================
   打开搜索命中
   ========================================================= */

function openSearchResult(
    query,
    wantedMatch
) {

    const pages =
        Array.from(
            document.querySelectorAll(
                '#project-content-pages .project-content-page'
            )
        );


    if (
        pages.length === 0
    ) {
        return;
    }


    const q =
        query.toLowerCase();


    let currentMatch =
        0;


    /* =====================================================
       遍历每一页
       ===================================================== */

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
            document.createTreeWalker(
                page,
                NodeFilter.SHOW_TEXT
            );


        let textNode;


        while (
            (
                textNode =
                    walker.nextNode()
            )
        ) {

            /*
             * 不在 script/style 等节点里搜索。
             */
            const parent =
                textNode.parentElement;


            if (!parent) {
                continue;
            }


            if (
                parent.closest(
                    'script, style, noscript'
                )
            ) {
                continue;
            }


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

                    revealSearchMatch(
                        pages,
                        pageIndex,
                        textNode,
                        found,
                        query.length
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
     * 如果编号因为纯文本索引和 DOM
     * 出现轻微偏差，则退回第一处匹配。
     */
    if (
        wantedMatch !== 1
    ) {

        openSearchResult(
            query,
            1
        );
    }
}


/* =========================================================
   展示目标页 + 高亮命中
   ========================================================= */

function revealSearchMatch(
    pages,
    pageIndex,
    textNode,
    startOffset,
    length
) {

    /* =====================================================
       先切到正确正文页
       ===================================================== */

    pages.forEach(
        function (
            page,
            index
        ) {

            page.style.display =
                index === pageIndex
                    ? ''
                    : 'none';
        }
    );


    /*
     * 同时把页码 UI 尽量同步。
     *
     * 现有分页系统的页码按钮
     * 带有：
     *
     * .project-content-page-number
     */
    syncPagination(
        pageIndex
    );


    /* =====================================================
       创建高亮 mark
       ===================================================== */

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
        'project-search-hit';


    try {

        range.surroundContents(
            mark
        );

    } catch (error) {

        /*
         * 对普通文本节点通常不会失败。
         * 万一失败，只滚到该文本父元素。
         */
        const parent =
            textNode.parentElement;

        if (parent) {

            parent.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        }

        return;
    }


    /* =====================================================
       滚动到命中
       ===================================================== */

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
        40
    );
}


/* =========================================================
   尽量同步正文分页 UI
   ========================================================= */

function syncPagination(
    targetPage
) {

    /*
     * 先尝试当前已经渲染出来的页码按钮。
     */
    const pageButtons =
        Array.from(
            document.querySelectorAll(
                '.project-content-page-number'
            )
        );


    const wantedText =
        String(
            targetPage + 1
        );


    const directButton =
        pageButtons.find(
            function (button) {

                return (
                    button
                        .textContent
                        .trim() ===
                    wantedText
                );
            }
        );


    /*
     * 如果这个页码本身当前可见，
     * 直接点击它最完美：
     * list.html 内部 page 状态也会同步。
     */
    if (directButton) {

        directButton.click();

        return;
    }


    /*
     * 如果目标页不在当前页码窗口里，
     * 利用 First + Next 按钮。
     *
     * 这会调用 list.html 原来的
     * goToPage()，不会另造第二套分页状态。
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


    /*
     * 先回第一页。
     */
    first.click();


    /*
     * 再前进到目标页。
     *
     * click() 是同步执行现有 handler 的，
     * 所以不需要等待。
     */
    for (
        let i = 0;
        i < targetPage;
        i++
    ) {

        next.click();
    }
}
