document.addEventListener("DOMContentLoaded", async () => {

    const input = document.getElementById("searchInput");
    const resultsBox = document.getElementById("searchResults");
    const countBox = document.getElementById("searchCount");

    if (!input || !resultsBox) return;

    let data = [];

    try {
        const response = await fetch("/index.json");
        data = await response.json();
    } catch (e) {
        console.error("Search index loading failed:", e);
        return;
    }

    function escapeHTML(str) {
        return String(str || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function escapeRegExp(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    function highlight(text, query) {
        if (!query) return escapeHTML(text);

        const safe = escapeHTML(text);
        const regex = new RegExp(
            "(" + escapeRegExp(query) + ")",
            "gi"
        );

        return safe.replace(regex, "<mark>$1</mark>");
    }

    function makeSnippet(content, query) {

        if (!content) return "";

        const clean = content
            .replace(/\s+/g, " ")
            .trim();

        const lower = clean.toLowerCase();
        const q = query.toLowerCase();

        const pos = lower.indexOf(q);

        const contextBefore = 80;
        const contextAfter = 140;

        if (pos === -1) {
            return clean.substring(0, 220);
        }

        const start = Math.max(0, pos - contextBefore);
        const end = Math.min(
            clean.length,
            pos + query.length + contextAfter
        );

        let snippet = clean.substring(start, end);

        if (start > 0) snippet = "…" + snippet;
        if (end < clean.length) snippet += "…";

        return snippet;
    }

    function search(query) {

        query = query.trim();

        if (!query) {
            resultsBox.innerHTML = "";
            countBox.innerHTML = "";
            return;
        }

        const q = query.toLowerCase();

        const results = data.filter(item => {

            const title = (item.title || "").toLowerCase();
            const content = (item.content || "").toLowerCase();
            const summary = (item.summary || "").toLowerCase();

            return (
                title.includes(q) ||
                content.includes(q) ||
                summary.includes(q)
            );

        });

        countBox.textContent =
            `Results Found: ${results.length}`;

        resultsBox.innerHTML = results
            .slice(0, 50)
            .map(item => {

                const snippet =
                    makeSnippet(item.content, query);

                return `
                    <a class="custom-search-result"
                       href="${item.permalink}">

                        <div class="custom-search-title">
                            ${highlight(item.title, query)}
                        </div>

                        <div class="custom-search-snippet">
                            ${highlight(snippet, query)}
                        </div>

                    </a>
                `;

            })
            .join("");
    }

    input.addEventListener("input", () => {
        search(input.value);
    });

});
