import * as params from '@params';

let fuse;

const resList = document.getElementById('searchResults');
const sInput = document.getElementById('searchInput');
const countBox = document.getElementById('searchCount');

let resultsAvailable = false;


/* =========================================================
   加载搜索索引
   ========================================================= */

window.onload = function () {

    const xhr = new XMLHttpRequest();

    xhr.onreadystatechange = function () {

        if (xhr.readyState !== 4) {
            return;
        }

        if (xhr.status !== 200) {
            console.log(xhr.responseText);
            return;
        }

        const data = JSON.parse(xhr.responseText);

        if (!data) {
            return;
        }

        let options = {
            distance: 1000,
            threshold: 0.4,
            ignoreLocation: true,
            includeMatches: true,

            keys: [
                'title',
                'permalink',
                'summary',
                'content'
            ]
        };


        if (params.fuseOpts) {

            options = {

                isCaseSensitive:
                    params.fuseOpts.iscasesensitive ?? false,

                includeScore:
                    params.fuseOpts.includescore ?? false,

                /*
                 * 必须打开。
                 * 我们自己的结果显示会使用 Fuse，
                 * 但正文位置仍然另外精确计算。
                 */
                includeMatches: true,

                minMatchCharLength:
                    params.fuseOpts.minmatchcharlength ?? 1,

                shouldSort:
                    params.fuseOpts.shouldsort ?? true,

                findAllMatches:
                    params.fuseOpts.findallmatches ?? false,

                keys:
                    params.fuseOpts.keys ??
                    [
                        'title',
                        'permalink',
                        'summary',
                        'content'
                    ],

                location:
                    params.fuseOpts.location ?? 0,

                threshold:
                    params.fuseOpts.threshold ?? 0.4,

                distance:
                    params.fuseOpts.distance ?? 1000,

                ignoreLocation:
                    params.fuseOpts.ignorelocation ?? true
            };
        }


        fuse = new Fuse(
            data,
            options
        );
    };


    xhr.open(
        'GET',
        '../index.json'
    );

    xhr.send();
};


/* =========================================================
   HTML 转义
   ========================================================= */

function escapeHTML(str) {

    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}


/* =========================================================
   Regex 转义
   ========================================================= */

function escapeRegExp(str) {

    return String(str)
        .replace(
            /[.*+?^${}()|[\]\\]/g,
            '\\$&'
        );
}


/* =========================================================
   高亮
   ========================================================= */

function highlight(text, query) {

    const safe =
        escapeHTML(text);

    if (!query) {
        return safe;
    }

    const regex =
        new RegExp(
            '(' +
            escapeRegExp(query) +
            ')',
            'gi'
        );

    return safe.replace(
        regex,
        '<mark>$1</mark>'
    );
}


/* =========================================================
   找出一篇文章里的所有精确命中
   ========================================================= */

function findSnippets(
    content,
    query
) {

    if (
        !content ||
        !query
    ) {
        return [];
    }


    const clean =
        String(content)
            .replace(
                /\s+/g,
                ' '
            )
            .trim();


    const lower =
        clean.toLowerCase();

    const q =
        query.toLowerCase();


    const before = 90;
    const after = 160;

    const snippets = [];

    let pos = 0;


    while (true) {

        const found =
            lower.indexOf(
                q,
                pos
            );

        if (found === -1) {
            break;
        }


        const start =
            Math.max(
                0,
                found - before
            );


        const end =
            Math.min(
                clean.length,
                found +
                query.length +
                after
            );


        let snippet =
            clean.substring(
                start,
                end
            );


        if (start > 0) {
            snippet =
                '…' + snippet;
        }

        if (
            end <
            clean.length
        ) {
            snippet += '…';
        }


        snippets.push(
            snippet
        );


        /*
         * 不再限制 500。
         * 所以 1 / 732、1 / 1250 都可以。
         */
        pos =
            found +
            Math.max(
                q.length,
                1
            );
    }


    /*
     * Fuse 模糊搜到了，
     * 但正文没有完全相同字符串。
     */
    if (
        snippets.length === 0
    ) {

        let snippet =
            clean.substring(
                0,
                250
            );

        if (
            clean.length >
            250
        ) {
            snippet += '…';
        }

        snippets.push(
            snippet
        );
    }


    return snippets;
}


/* =========================================================
   给搜索结果标题生成“跳到具体命中”的 URL
   ========================================================= */

function makeMatchURL(
    permalink,
    query,
    matchNumber
) {

    const url =
        new URL(
            permalink,
            window.location.origin
        );


    url.searchParams.set(
        'search',
        query
    );


    url.searchParams.set(
        'match',
        String(matchNumber)
    );


    return url.toString();
}


/* =========================================================
   清空
   ========================================================= */

function reset() {

    resultsAvailable =
        false;

    resList.innerHTML =
        '';

    sInput.value =
        '';

    if (countBox) {
        countBox.innerHTML =
            '';
    }

    sInput.focus();
}


/* =========================================================
   搜索
   ========================================================= */

sInput.onkeyup =
function () {

    if (!fuse) {
        return;
    }


    const query =
        this.value.trim();


    if (!query) {

        resList.innerHTML =
            '';

        if (countBox) {
            countBox.innerHTML =
                '';
        }

        resultsAvailable =
            false;

        return;
    }


    let results;


    if (
        params.fuseOpts &&
        params.fuseOpts.limit
    ) {

        results =
            fuse.search(
                query,
                {
                    limit:
                        params
                            .fuseOpts
                            .limit
                }
            );

    } else {

        results =
            fuse.search(
                query,
                {
                    limit: 50
                }
            );
    }


    if (countBox) {

        countBox.textContent =
            `Results Found: ${results.length}`;
    }


    if (
        results.length === 0
    ) {

        resultsAvailable =
            false;

        resList.innerHTML =
            '';

        return;
    }


    let resultSet =
        '';


    for (
        let resultIndex = 0;
        resultIndex <
            results.length;
        resultIndex++
    ) {

        const result =
            results[
                resultIndex
            ];

        const item =
            result.item;


        const snippets =
            findSnippets(
                item.content,
                query
            );


        const snippetsEncoded =
            encodeURIComponent(
                JSON.stringify(
                    snippets
                )
            );


        const firstURL =
            makeMatchURL(
                item.permalink,
                query,
                1
            );


        resultSet += `
            <article
                class="custom-search-result"
                data-result-index="${resultIndex}"
                data-snippets="${snippetsEncoded}"
                data-current-match="0"
                data-permalink="${escapeHTML(item.permalink)}"
            >

                <div class="custom-search-top">

                    <a
                        class="custom-search-link"
                        href="${escapeHTML(firstURL)}"
                        aria-label="${escapeHTML(item.title)}"
                    >

                        <div class="custom-search-title">
                            ${highlight(item.title, query)}
                        </div>

                    </a>


                    ${
                        snippets.length > 1
                        ?
                        `
                        <div class="search-match-nav">

                            <span class="search-match-count">
                                1 / ${snippets.length}
                            </span>

                            <button
                                type="button"
                                class="search-match-prev"
                                aria-label="上一个匹配"
                                title="上一个匹配"
                            >
                                ‹
                            </button>

                            <button
                                type="button"
                                class="search-match-next"
                                aria-label="下一个匹配"
                                title="下一个匹配"
                            >
                                ›
                            </button>

                        </div>
                        `
                        :
                        ''
                    }

                </div>


                <div class="custom-search-snippet">
                    ${highlight(snippets[0], query)}
                </div>

            </article>
        `;
    }


    resList.innerHTML =
        resultSet;


    /* =====================================================
       给每个结果绑定上一处 / 下一处
       ===================================================== */

    resList
        .querySelectorAll(
            '.custom-search-result'
        )
        .forEach(
            function (card) {

                const encoded =
                    card.dataset.snippets;


                const snippets =
                    JSON.parse(
                        decodeURIComponent(
                            encoded
                        )
                    );


                const permalink =
                    card.dataset.permalink;


                const snippetBox =
                    card.querySelector(
                        '.custom-search-snippet'
                    );


                const count =
                    card.querySelector(
                        '.search-match-count'
                    );


                const prev =
                    card.querySelector(
                        '.search-match-prev'
                    );


                const next =
                    card.querySelector(
                        '.search-match-next'
                    );


                const link =
                    card.querySelector(
                        '.custom-search-link'
                    );


                function showMatch(
                    index
                ) {

                    if (
                        index < 0
                    ) {

                        index =
                            snippets.length -
                            1;
                    }


                    if (
                        index >=
                        snippets.length
                    ) {

                        index = 0;
                    }


                    card.dataset.currentMatch =
                        String(index);


                    snippetBox.innerHTML =
                        highlight(
                            snippets[
                                index
                            ],
                            query
                        );


                    if (count) {

                        count.textContent =
                            `${index + 1} / ${snippets.length}`;
                    }


                    /*
                     * 很重要：
                     *
                     * 用户翻到 487 / 732 后，
                     * 标题链接自动变成：
                     *
                     * ?search=土耳其&match=487
                     */
                    if (link) {

                        link.href =
                            makeMatchURL(
                                permalink,
                                query,
                                index + 1
                            );
                    }
                }


                /*
                 * 即使只有一个精确命中，
                 * 标题也已经带：
                 *
                 * ?search=xxx&match=1
                 */
                showMatch(0);


                if (
                    !prev ||
                    !next
                ) {
                    return;
                }


                prev.addEventListener(
                    'click',
                    function (event) {

                        event.preventDefault();
                        event.stopPropagation();


                        const current =
                            Number(
                                card
                                    .dataset
                                    .currentMatch
                            );


                        showMatch(
                            current - 1
                        );
                    }
                );


                next.addEventListener(
                    'click',
                    function (event) {

                        event.preventDefault();
                        event.stopPropagation();


                        const current =
                            Number(
                                card
                                    .dataset
                                    .currentMatch
                            );


                        showMatch(
                            current + 1
                        );
                    }
                );
            }
        );


    resultsAvailable =
        true;
};


/* =========================================================
   搜索框 ×
   ========================================================= */

sInput.addEventListener(
    'search',
    function () {

        if (!this.value) {
            reset();
        }
    }
);


/* =========================================================
   Escape
   ========================================================= */

document.addEventListener(
    'keydown',
    function (event) {

        if (
            event.key ===
            'Escape'
        ) {

            reset();
        }
    }
);
