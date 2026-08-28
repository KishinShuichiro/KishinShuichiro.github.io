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

function makeSnippet(content, query) {

    if (!content) {
        return '';
    }

    let clean = String(content)
        .replace(/\s+/g, ' ')
        .trim();

    let lower = clean.toLowerCase();
    let q = query.toLowerCase();

    let pos = lower.indexOf(q);

    const before = 90;
    const after = 160;

    /*
     Fuse 模糊匹配成功，但找不到精确字符串时，
     暂时展示正文开头
    */
    if (pos === -1) {

        let text = clean.substring(0, 250);

        if (clean.length > 250) {
            text += '…';
        }

        return text;
    }

    let start = Math.max(
        0,
        pos - before
    );

    let end = Math.min(
        clean.length,
        pos + query.length + after
    );

    let snippet =
        clean.substring(start, end);

    if (start > 0) {
        snippet = '…' + snippet;
    }

    if (end < clean.length) {
        snippet += '…';
    }

    return snippet;
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


    for (let result of results) {

        let item = result.item;

        let snippet =
            makeSnippet(
                item.content,
                query
            );


        resultSet += `
            <article class="custom-search-result">

                <a
                    class="custom-search-link"
                    href="${escapeHTML(item.permalink)}"
                    aria-label="${escapeHTML(item.title)}"
                >

                    <div class="custom-search-title">
                        ${highlight(item.title, query)}
                    </div>

                    <div class="custom-search-snippet">
                        ${highlight(snippet, query)}
                    </div>

                </a>

            </article>
        `;
    }


    resList.innerHTML = resultSet;

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
