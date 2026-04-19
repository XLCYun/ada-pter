---
"@ada-pter/core": patch
---

Replace `deepMerge` with `mergeConfig`: top-level fields use shallow merge (later overrides earlier), while `extraBody` and `extraHeaders` internal fields are merged across config levels (one level deep, no recursion)
