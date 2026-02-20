# ada-pter

## Test

- Unit tests (default):

```bash
bun test
```

Equivalent:

```bash
bun run test:unit
```

- Live API tests (real provider requests, optional):

```bash
cp .env.example .env
# fill OPENAI_API_KEY in .env
RUN_LIVE_TESTS=true bun run test:live
```

Notes:

- Live tests are skipped unless both `RUN_LIVE_TESTS=true` and `OPENAI_API_KEY` are set.
- Live tests may incur API cost.