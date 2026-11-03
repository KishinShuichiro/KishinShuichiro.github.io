import * as params from '@params';

const searchBox = document.getElementById('searchbox');
const resList = document.getElementById('searchResults');
const sInput = document.getElementById('searchInput');
const countBox = document.getElementById('searchCount');
const DEBOUNCE_MS = 150;

let worker;
let ready = false;
let busy = false;
let composing = false;
let revision = 0;
let sentRevision = -1;
let searchDue = false;
let debounceTimer;
let results = [];

function setStatus(message, loading = false) {
    countBox.textContent = message;
    resList.setAttribute('aria-busy', String(loading));
}

function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[character]));
}

// Match the original text before escaping so queries such as "&" cannot
// corrupt HTML entities or turn indexed text into markup.
function highlight(text, query) {
    text = String(text || '');
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedQuery, 'gi');
    let html = '';
    let position = 0;
    for (const match of text.matchAll(regex)) {
        html += escapeHTML(text.slice(position, match.index));
        html += `<mark>${escapeHTML(match[0])}</mark>`;
        position = match.index + match[0].length;
    }
    return html + escapeHTML(text.slice(position));
}

function makeMatchURL(permalink, query, matchNumber) {
    const url = new URL(permalink, window.location.origin);
    url.searchParams.set('search', query);
    url.searchParams.set('match', String(matchNumber));
    return url.toString();
}

function failSearch(activeWorker) {
    if (worker !== activeWorker) return;
    worker?.terminate();
    worker = null;
    ready = false;
    busy = false;
    sentRevision = -1;
    results = [];
    resList.replaceChildren();
    setStatus('搜索加载失败，请重新输入重试。');
}

function startWorker() {
    if (worker) return;
    try {
        const activeWorker = new Worker(searchBox.dataset.workerUrl);
        worker = activeWorker;
        activeWorker.addEventListener('error', () => failSearch(activeWorker));
        activeWorker.addEventListener('messageerror', () => failSearch(activeWorker));
        activeWorker.addEventListener('message', ({ data }) => {
            if (worker !== activeWorker) return;
            if (data.type === 'error') {
                failSearch(activeWorker);
            } else if (data.type === 'ready') {
                ready = true;
                if (!sInput.value.trim()) setStatus('');
                sendSearch();
            } else if (data.type === 'results') {
                busy = false;
                // A query can change while the worker is searching. Never let
                // its old response replace the current results or a reset.
                if (data.revision === revision && !composing) renderResults(data);
                sendSearch();
            } else if (data.type === 'match' && data.revision === revision) {
                const result = results[data.resultIndex];
                if (!result || result.matchIndex !== data.matchIndex) return;
                const card = resList.children[data.resultIndex];
                card.querySelector('.custom-search-snippet').innerHTML =
                    highlight(data.snippet, data.query);
                card.querySelector('.search-match-count').textContent =
                    `${data.matchIndex + 1} / ${result.matchCount}`;
                card.querySelector('.custom-search-link').href =
                    makeMatchURL(result.permalink, data.query, data.matchIndex + 1);
            }
        });
        activeWorker.postMessage({
            type: 'init',
            indexURL: new URL(searchBox.dataset.indexUrl, window.location.href).href,
            options: params.fuseOpts || {}
        });
    } catch {
        failSearch(worker);
    }
}

function sendSearch() {
    // Keep at most one search in flight. If typing outpaces the worker, send
    // only the newest query after it finishes, not a queue of obsolete work.
    if (!ready || busy || composing || !searchDue || sentRevision === revision) return;
    const query = sInput.value.trim();
    if (!query) return;
    busy = true;
    sentRevision = revision;
    worker.postMessage({ type: 'search', revision, query });
}

function scheduleSearch() {
    revision++;
    clearTimeout(debounceTimer);
    searchDue = false;
    results = [];
    resList.replaceChildren();
    if (!sInput.value.trim() || composing) {
        setStatus('');
        return;
    }
    setStatus('搜索中……', true);
    startWorker();
    debounceTimer = setTimeout(() => {
        searchDue = true;
        sendSearch();
    }, DEBOUNCE_MS);
}

function renderResults(data) {
    results = data.results.map(result => ({ ...result, matchIndex: 0 }));
    resList.innerHTML = results.map((result, index) => `
        <article class="custom-search-result" data-result-index="${index}">
            <div class="custom-search-top">
                <a class="custom-search-link"
                   href="${escapeHTML(makeMatchURL(result.permalink, data.query, 1))}"
                   aria-label="${escapeHTML(result.title)}">
                    <div class="custom-search-title">${highlight(result.title, data.query)}</div>
                </a>
                ${result.matchCount > 1 ? `
                    <div class="search-match-nav">
                        <span class="search-match-count">1 / ${result.matchCount}</span>
                        <button type="button" class="search-match-prev"
                                aria-label="上一个匹配" title="上一个匹配">‹</button>
                        <button type="button" class="search-match-next"
                                aria-label="下一个匹配" title="下一个匹配">›</button>
                    </div>` : ''}
            </div>
            <div class="custom-search-snippet">${highlight(result.snippet, data.query)}</div>
        </article>
    `).join('');
    setStatus(`Results Found: ${results.length}`);
}

// One delegated listener survives result updates. Full article text and all
// match offsets stay in the worker; only the selected excerpt crosses over.
resList.addEventListener('click', event => {
    const card = event.target.closest('.custom-search-result');
    if (!card) return;
    const resultIndex = Number(card.dataset.resultIndex);
    const result = results[resultIndex];
    if (!result) return;
    const button = event.target.closest('.search-match-prev, .search-match-next');
    if (button) {
        event.preventDefault();
        const direction = button.classList.contains('search-match-next') ? 1 : -1;
        result.matchIndex = (result.matchIndex + direction + result.matchCount) % result.matchCount;
        worker.postMessage({ type: 'match', revision, resultIndex, matchIndex: result.matchIndex });
        return;
    }
    if (event.target.closest('a') || window.getSelection()?.toString()) return;
    const href = card.querySelector('.custom-search-link').href;
    if (event.ctrlKey || event.metaKey) {
        window.open(href, '_blank', 'noopener');
    } else {
        window.location.href = href;
    }
});

sInput.addEventListener('input', scheduleSearch);
sInput.addEventListener('compositionstart', () => {
    composing = true;
    scheduleSearch();
});
sInput.addEventListener('compositionend', () => {
    composing = false;
    scheduleSearch();
});
sInput.addEventListener('search', () => {
    if (!sInput.value) scheduleSearch();
});
document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !event.isComposing && !composing) {
        sInput.value = '';
        scheduleSearch();
        sInput.focus();
    }
});

// Start before window.load and also honor text entered/restored before the
// index is ready. Parsing and indexing happen entirely inside the worker.
startWorker();
if (sInput.value.trim()) scheduleSearch();
