# Europa Desk

An interactive map of Europe that shows what matters in each country today. Hover a country to see its top stories, click it for the full briefing, and read the AI-ranked front page for the whole continent.

## How it works

```
Google News RSS ──► scraper ──► clustering ──► ranking ──► snapshot.json ──► /api/news ──► map UI
 (per country)                  (dedupe)      (OpenAI or
                                               heuristic)
```

1. **Scraper** (`server/sources.ts`). For each of 45 countries it pulls English-language coverage from a Google News search, plus the country's own Google News edition (local-language top stories) when AI is enabled to translate them.
2. **Clustering** (`server/cluster.ts`). Near-duplicate headlines from different outlets are grouped into one story. The number of distinct outlets becomes a coverage signal.
3. **Ranking** (`server/rank/`).
   - **With `OPENAI_API_KEY`**: one call per country merges duplicates, drops off-topic items, writes a neutral English headline and summary, and scores importance from 0 to 100 using an editorial rubric. A second call picks the 12-story European front page and says why each one matters.
   - **Without a key**: a heuristic based on keywords, coverage and recency. It works offline but is noticeably rougher.
4. **Snapshot**. The result is cached in `server/data/snapshot.json` and refreshed every `REFRESH_MINUTES`. The UI polls `/api/news`.

Country shading on the map is relative (a percentile of each country's "heat"), so the map stays readable whether scores bunch up or spread out.

## Running it

Requires Node 20.11 or newer.

```bash
npm install
cp .env.example .env   # then add your OPENAI_API_KEY
npm run dev            # API on :8787, web on http://localhost:5173
```

The first run takes a little while to build the snapshot. After that the cached snapshot loads instantly on restart.

Other scripts:

| Command | What it does |
| --- | --- |
| `npm run refresh` | Runs the pipeline once and prints the front page. |
| `npm run build && npm start` | Production build; the API server also serves the built site on `PORT` (default 8787). |
| `npm run typecheck` | Type-checks the client and the server. |

## Configuration

| Variable | Default | Notes |
| --- | --- | --- |
| `OPENAI_API_KEY` | (none) | Enables AI ranking and summaries. |
| `OPENAI_MODEL` | `gpt-5-mini` | Any chat model with JSON-schema output. |
| `REFRESH_MINUTES` | `30` | Pipeline interval (minimum 5). |
| `API_PORT` | `8787` | API port in development. |
| `PORT` | `8787` | Port for `npm start`. |

A full AI refresh makes 46 model calls (45 countries plus the front page). Country results are memoised while their candidate headlines are unchanged.

## API

- `GET /api/news`: the latest snapshot (`503` while the first one is being built).
- `GET /api/status`: pipeline state.
- `POST /api/refresh`: triggers a refresh, at most once every 5 minutes.

## Stack

React 19, Vite, Tailwind CSS v4, Motion, d3-geo, d3-zoom and world-atlas on the client. Express, fast-xml-parser and the OpenAI SDK on the server. Shared types live in `shared/`.

## License

[MIT](LICENSE)
