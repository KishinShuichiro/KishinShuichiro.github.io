/* Fuse is bundled before this file by the search layout. */
let fuse;
let limit = 50;
let activeRevision;
let activeQuery = '';
let activeResults = [];
const textCache = new WeakMap();

async function initialize({ indexURL, options }) {
    const response = await fetch(indexURL);
    if (!response.ok) throw new Error(`Search index: ${response.status}`);
    const data = await response.json();
    const configuredLimit = Number(options.limit);
    if (Number.isFinite(configuredLimit) && configuredLimit >= 1) {
        limit = Math.floor(configuredLimit);
    }
    fuse = new Fuse(data, {
        isCaseSensitive: options.iscasesensitive ?? false,
        minMatchCharLength: options.minmatchcharlength ?? 1,
        shouldSort: options.shouldsort ?? true,
        findAllMatches: options.findallmatches ?? false,
        keys: options.keys ?? ['title', 'permalink', 'summary', 'content'],
        location: options.location ?? 0,
        threshold: options.threshold ?? 0.4,
        distance: options.distance ?? 1000,
        ignoreLocation: options.ignorelocation ?? true,
        // Excerpts use exact offsets below. Fuse's per-character match arrays
        // are expensive for book-length text and were never used by the UI.
        includeMatches: false,
        includeScore: false
    });
    self.postMessage({ type: 'ready' });
}

function textFor(item) {
    if (!textCache.has(item)) {
        const clean = String(item.content || '').replace(/\s+/g, ' ').trim();
        textCache.set(item, { clean, lower: clean.toLowerCase() });
    }
    return textCache.get(item);
}

function findOffsets(text, query) {
    const offsets = [];
    let position = 0;
    while (query) {
        const found = text.indexOf(query, position);
        if (found === -1) break;
        offsets.push(found);
        position = found + query.length;
    }
    return offsets;
}

function snippetFor(result, index) {
    const { clean, offsets } = result;
    if (!offsets.length) return clean.slice(0, 250) + (clean.length > 250 ? '…' : '');
    const found = offsets[index];
    const start = Math.max(0, found - 90);
    const end = Math.min(clean.length, found + activeQuery.length + 160);
    return (start > 0 ? '…' : '') + clean.slice(start, end) + (end < clean.length ? '…' : '');
}

function search({ revision, query }) {
    activeRevision = revision;
    activeQuery = query;
    const lowerQuery = query.toLowerCase();
    activeResults = fuse.search(query, { limit }).map(({ item }) => {
        const { clean, lower } = textFor(item);
        return { item, clean, offsets: findOffsets(lower, lowerQuery) };
    });
    self.postMessage({
        type: 'results', revision, query,
        results: activeResults.map(result => ({
            title: result.item.title,
            permalink: result.item.permalink,
            matchCount: result.offsets.length,
            snippet: snippetFor(result, 0)
        }))
    });
}

self.addEventListener('message', ({ data }) => {
    if (data.type === 'init') {
        initialize(data).catch(() => self.postMessage({ type: 'error' }));
        return;
    }
    try {
        if (data.type === 'search') {
            search(data);
        } else if (data.type === 'match' && data.revision === activeRevision) {
            const result = activeResults[data.resultIndex];
            if (!result || !Number.isInteger(data.matchIndex) ||
                data.matchIndex < 0 || data.matchIndex >= result.offsets.length) return;
            self.postMessage({
                type: 'match', revision: activeRevision, query: activeQuery,
                resultIndex: data.resultIndex, matchIndex: data.matchIndex,
                snippet: snippetFor(result, data.matchIndex)
            });
        }
    } catch {
        self.postMessage({ type: 'error' });
    }
});
