import * as params from '@params';

let fuse;

let resList = document.getElementById('searchResults');
let sInput = document.getElementById('searchInput');
let countBox = document.getElementById('searchCount');

let first = null;
let last = null;
let current_elem = null;
let resultsAvailable = false;


/* -------------------------
   加载搜索索引
------------------------- */

window.onload = function () {

    let xhr = new XMLHttpRequest();

    xhr.onreadystatechange = function () {

        if (xhr.readyState === 4) {

            if (xhr.status === 200) {

                let data = JSON.parse(xhr.responseText);

                if (data) {

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

                            // 这里必须打开
                            includeMatches: true,

                            minMatchCharLength:
                                params.fuseOpts.minmatchcharlength ?? 1,

                            shouldSort:
                                params.fuseOpts.shouldsort ?? true,

                            findAllMatches:
                                params.fuseOpts.findallmatches ?? false,

                            keys:
                                params.fuseOpts.keys ??
                                ['title', 'permalink', 'summary', 'content'],

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

                    fuse = new Fuse(data, options);
                }

            } else {
                console.log(xhr.responseText);
            }
        }
    };

    xhr.open('GET', '../index.json');
    xhr.send();
};


/* -------------------------
   HTML 转义
------------------------- */

function escapeHTML(str) {

    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}


/* -------------------------
   正则转义
------------------------- */

function escapeRegExp(str) {

    return String(str)
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}


/* -------------------------
   高亮关键词
------------------------- */

function highlight(text, query) {

    let safe = escapeHTML(text);

    if (!query) {
        return safe;
    }

    let regex = new RegExp(
        '(' + escapeRegExp(query) + ')',
        'gi'
    );

    return safe.replace(
        regex,
        '<mark>$1</mark>'
    );
}


/* -------------------------
   从正文中截取命中附近片段
------------------------- */

function findSnippets(content, query) {

    if (!content || !query) {
        return [];
    }

    const clean = String(content)
        .replace(/\s+/g, ' ')
        .trim();

    const lower = clean.toLowerCase();
    const q = query.toLowerCase();

    const before = 90;
    const after = 160;

    let snippets = [];
    let pos = 0;

    while (true) {

        const found = lower.indexOf(q, pos);

        if (found === -1) {
            break;
        }

        const start = Math.max(
            0,
            found - before
        );

        const end = Math.min(
            clean.length,
            found + query.length + after
        );

        let snippet =
            clean.substring(start, end);

        if (start > 0) {
            snippet = '…' + snippet;
        }

        if (end < clean.length) {
            snippet += '…';
        }

        snippets.push(snippet);

        pos = found + q.length;

        // 防止极端情况下单篇文章产生几千个 DOM 数据
        if (snippets.length >= 500) {
            break;
        }
    }

    /*
    Fuse 模糊搜到了文章，
    但正文里没有精确字符串
    */
    if (snippets.length === 0) {

        let snippet = clean.substring(0, 250);

        if (clean.length > 250) {
            snippet += '…';
        }

        snippets.push(snippet);
    }

    return snippets;
}


/* -------------------------
   键盘焦点
------------------------- */

function activeToggle(ae) {

    document
        .querySelectorAll('.focus')
        .forEach(function (element) {
            element.classList.remove('focus');
        });

    if (ae) {

        ae.focus();

        current_elem = ae;

        ae.closest('.custom-search-result')
            ?.classList.add('focus');

    } else if (document.activeElement) {

        document.activeElement
            .closest('.custom-search-result')
            ?.classList.add('focus');
    }
}


/* -------------------------
   清空
------------------------- */

function reset() {

    resultsAvailable = false;

    resList.innerHTML = '';
    sInput.value = '';

    if (countBox) {
        countBox.innerHTML = '';
    }

    sInput.focus();
}


/* -------------------------
   实际搜索
------------------------- */

sInput.onkeyup = function () {

    if (!fuse) {
        return;
    }

    let query = this.value.trim();

    if (!query) {

        resList.innerHTML = '';

        if (countBox) {
            countBox.innerHTML = '';
        }

        resultsAvailable = false;

        return;
    }


    let results;

    if (params.fuseOpts && params.fuseOpts.limit) {

        results = fuse.search(
            query,
            {
                limit: params.fuseOpts.limit
            }
        );

    } else {

        results = fuse.search(
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


    if (results.length === 0) {

        resultsAvailable = false;
        resList.innerHTML = '';

        return;
    }


    let resultSet = '';


    for (let resultIndex = 0; resultIndex < results.length; resultIndex++) {

    let result = results[resultIndex];
    let item = result.item;

    let snippets =
        findSnippets(
            item.content,
            query
        );

    let snippetsEncoded =
        encodeURIComponent(
            JSON.stringify(snippets)
        );

    resultSet += `
        <article
            class="custom-search-result"
            data-result-index="${resultIndex}"
            data-snippets="${snippetsEncoded}"
            data-current-match="0"
        >

            <div class="custom-search-top">

                <a
                    class="custom-search-link"
                    href="${escapeHTML(item.permalink)}"
                    aria-label="${escapeHTML(item.title)}"
                >
                    <div class="custom-search-title">
                        ${highlight(item.title, query)}
                    </div>
                </a>

                ${
                    snippets.length > 1
                    ? `
                    <div class="search-match-nav">

                        <span class="search-match-count">
                            1 / ${snippets.length}
                        </span>

                        <button
                            type="button"
                            class="search-match-prev"
                            aria-label="上一个匹配"
                        >
                            ‹
                        </button>

                        <button
                            type="button"
                            class="search-match-next"
                            aria-label="下一个匹配"
                        >
                            ›
                        </button>

                    </div>
                    `
                    : ''
                }

            </div>

            <div class="custom-search-snippet">
                ${highlight(snippets[0], query)}
            </div>

        </article>
    `;
}


    resList.innerHTML = resultSet;

    resList.querySelectorAll('.custom-search-result')
    .forEach(card => {

        const encoded =
            card.dataset.snippets;

        const snippets =
            JSON.parse(
                decodeURIComponent(encoded)
            );

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

        if (!prev || !next) {
            return;
        }

        function showMatch(index) {

            if (index < 0) {
                index = snippets.length - 1;
            }

            if (index >= snippets.length) {
                index = 0;
            }

            card.dataset.currentMatch =
                String(index);

            snippetBox.innerHTML =
                highlight(
                    snippets[index],
                    query
                );

            count.textContent =
                `${index + 1} / ${snippets.length}`;
        }

        prev.addEventListener(
            'click',
            function (e) {

                e.preventDefault();
                e.stopPropagation();

                let current =
                    Number(
                        card.dataset.currentMatch
                    );

                showMatch(current - 1);
            }
        );

        next.addEventListener(
            'click',
            function (e) {

                e.preventDefault();
                e.stopPropagation();

                let current =
                    Number(
                        card.dataset.currentMatch
                    );

                showMatch(current + 1);
            }
        );

    });

    resultsAvailable = true;

    first =
        resList.firstElementChild;

    last =
        resList.lastElementChild;
};


/* -------------------------
   搜索框 X
------------------------- */

sInput.addEventListener(
    'search',
    function () {

        if (!this.value) {
            reset();
        }
    }
);


/* -------------------------
   键盘操作
------------------------- */

document.onkeydown = function (e) {

    let key = e.key;
    let ae = document.activeElement;

    let inbox =
        document
            .getElementById('searchbox')
            .contains(ae);


    if (key === 'Escape') {

        reset();
        return;
    }


    if (!resultsAvailable || !inbox) {
        return;
    }


    let links =
        Array.from(
            resList.querySelectorAll(
                '.custom-search-link'
            )
        );


    if (!links.length) {
        return;
    }


    let currentIndex =
        links.indexOf(ae);


    if (key === 'ArrowDown') {

        e.preventDefault();

        if (ae === sInput) {
            activeToggle(links[0]);

        } else if (
            currentIndex >= 0 &&
            currentIndex < links.length - 1
        ) {
            activeToggle(
                links[currentIndex + 1]
            );
        }

    } else if (key === 'ArrowUp') {

        e.preventDefault();

        if (currentIndex === 0) {

            sInput.focus();

        } else if (currentIndex > 0) {

            activeToggle(
                links[currentIndex - 1]
            );
        }

    } else if (
        key === 'ArrowRight' ||
        key === 'Enter'
    ) {

        if (ae.classList.contains(
            'custom-search-link'
        )) {
            ae.click();
        }
    }
};
