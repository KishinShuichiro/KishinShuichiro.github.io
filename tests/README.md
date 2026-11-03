# Search regression checks

Initialize the PaperMod submodule, then run the worker tests with Node.js 18+:

```sh
git submodule update --init --recursive
node --test tests/search-worker.test.cjs
```

To also compare result ordering and exact hit counts against the previous Fuse
configuration using the complete site index:

```sh
hugo --minify
SEARCH_INDEX="$PWD/public/index.json" node --test tests/search-worker.test.cjs
```

For browser checks, open `/search/` through `hugo server`. Check Chinese IME
composition, rapid query changes, clearing during an active search, typing
before the index loads, and retrying after a failed index request. Match buttons
must wrap through all occurrences and update both the excerpt and the title's
`search`/`match` parameters. In DevTools, use CPU throttling and verify that a
long query does not produce a long task on the main thread.
