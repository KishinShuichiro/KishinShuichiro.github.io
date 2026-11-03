const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const Fuse = require('../themes/PaperMod/assets/js/fuse.basic.min.js');

const source = fs.readFileSync(path.join(__dirname, '../assets/js/search-worker.js'), 'utf8');
const options = {
    iscasesensitive: false, shouldsort: true, location: 0, distance: 1000,
    threshold: 0.4, minmatchcharlength: 1,
    keys: ['title', 'permalink', 'summary', 'content']
};
const fixtures = [
    { title: '土耳其现代史', permalink: '/projects/turkey/', summary: '', content: '土耳其第一处。' + '长篇正文。'.repeat(100) + '土耳其第二处。' },
    { title: 'Democracy', permalink: '/posts/democracy/', summary: '政治', content: '民主是本文的主题。民主也出现在这里。' },
    { title: 'C++ & <history>', permalink: '/posts/special/', summary: '', content: 'C++ & <history>（历史）。' },
    { title: 'Empty', permalink: '/posts/empty/', summary: '', content: '' }
];

async function createWorker(data = fixtures, config = options, response = {}) {
    const messages = [];
    let receive;
    const context = vm.createContext({
        Fuse,
        fetch: async () => ({ ok: true, json: async () => data, ...response }),
        self: {
            postMessage: value => messages.push(JSON.parse(JSON.stringify(value))),
            addEventListener: (_, handler) => { receive = handler; }
        }
    });
    vm.runInContext(source, context);
    receive({ data: { type: 'init', indexURL: '/index.json', options: config } });
    await new Promise(resolve => setImmediate(resolve));
    return {
        messages,
        send: data => { receive({ data }); return messages.at(-1); }
    };
}

function originalSearch(data, query, limit = 50) {
    return new Fuse(data, {
        distance: 1000, threshold: 0.4, ignoreLocation: true,
        includeMatches: true, keys: options.keys
    }).search(query, { limit }).map(({ item }) => item.permalink);
}

test('keeps original Fuse ranking, fuzzy search, and empty results', async () => {
    const worker = await createWorker();
    assert.equal(worker.messages[0].type, 'ready');
    for (const query of ['土耳其', '民主', 'Democrasy', 'C++', '&', '<history>', 'notpresentxyz']) {
        const response = worker.send({ type: 'search', query, revision: 1 });
        assert.equal(response.type, 'results');
        assert.deepEqual(response.results.map(result => result.permalink), originalSearch(fixtures, query));
        assert.ok(response.results.every(result => !('content' in result) && !('offsets' in result)));
    }
});

test('keeps every match while sending only the selected excerpt', async () => {
    const content = Array.from({ length: 1250 }, (_, index) => `第${index + 1}处土耳其。`).join('');
    const worker = await createWorker([{ ...fixtures[0], content }]);
    const result = worker.send({ type: 'search', query: '土耳其', revision: 2 }).results[0];
    assert.equal(result.matchCount, 1250);
    assert.ok(result.snippet.length <= 255);
    const match = worker.send({ type: 'match', revision: 2, resultIndex: 0, matchIndex: 1249 });
    assert.equal(match.matchIndex, 1249);
    assert.ok(match.snippet.includes('第1250处土耳其。'));
    assert.ok(match.snippet.startsWith('…'));
    assert.ok(!match.snippet.endsWith('…'));
});

test('ignores obsolete or invalid match requests after a new query', async () => {
    const worker = await createWorker();
    worker.send({ type: 'search', query: '土耳其', revision: 1 });
    worker.send({ type: 'search', query: '民主', revision: 2 });
    const count = worker.messages.length;
    for (const request of [
        { revision: 1, resultIndex: 0, matchIndex: 0 },
        { revision: 2, resultIndex: 99, matchIndex: 0 },
        { revision: 2, resultIndex: 0, matchIndex: -1 },
        { revision: 2, resultIndex: 0, matchIndex: 9999 },
        { revision: 2, resultIndex: 0, matchIndex: 0.5 }
    ]) worker.send({ type: 'match', ...request });
    assert.equal(worker.messages.length, count);
});

test('preserves whitespace normalization and a summary for title-only matches', async () => {
    const worker = await createWorker([{ ...fixtures[0], content: '开头\n\t土耳其\n结尾' }]);
    const response = worker.send({ type: 'search', query: '土耳其', revision: 1 });
    assert.equal(response.results[0].snippet, '开头 土耳其 结尾');
    const titleOnly = worker.send({ type: 'search', query: '现代史', revision: 2 }).results[0];
    assert.equal(titleOnly.matchCount, 0);
    assert.equal(titleOnly.snippet, '开头 土耳其 结尾');
});

test('respects the configured result limit', async () => {
    const data = Array.from({ length: 70 }, (_, index) => ({ ...fixtures[0], permalink: `/posts/${index}/` }));
    const worker = await createWorker(data, { ...options, limit: 7 });
    assert.equal(worker.send({ type: 'search', query: '土耳其', revision: 1 }).results.length, 7);
});

test('reports index download and JSON failures', async () => {
    for (const response of [{ ok: false, status: 503 }, { json: async () => { throw new Error('invalid JSON'); } }]) {
        const worker = await createWorker(fixtures, options, response);
        assert.deepEqual(worker.messages, [{ type: 'error' }]);
    }
});

// Optional real-site regression: SEARCH_INDEX=/path/to/public/index.json node --test tests/search-worker.test.cjs
test('matches original ranking and exact hit counts on the built site', {
    skip: !process.env.SEARCH_INDEX
}, async () => {
    const data = JSON.parse(fs.readFileSync(process.env.SEARCH_INDEX, 'utf8'));
    const worker = await createWorker(data);
    for (const query of ['土耳其', '的', '民主', 'democrasy', '日本', '伊朗革命', '不存在的搜索内容abcdefgh']) {
        const result = worker.send({ type: 'search', query, revision: 1 });
        assert.deepEqual(result.results.map(item => item.permalink), originalSearch(data, query));
        for (const item of result.results) {
            const document = data.find(document => document.permalink === item.permalink);
            const clean = document.content.replace(/\s+/g, ' ').trim().toLowerCase();
            assert.equal(item.matchCount, clean.split(query.toLowerCase()).length - 1);
        }
    }
});
