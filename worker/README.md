# Cloudflare Worker — Bandar Financial Dashboard API

Secure proxy between the static GitHub Pages dashboard and the Notion API,
with KV caching to minimise Notion API calls.

## Endpoints

| Endpoint | Description | Cache TTL |
|---|---|---|
| `GET /health` | Status check | — |
| `GET /transactions` | All transactions (transformed) | 10 min |
| `GET /budgets` | Budget config per category | 1 hour |
| `GET /categories` | Category list + keywords | 1 hour |
| `POST /cache/invalidate` | Purge KV cache | — |

## Deploy

### Prerequisites
- [Node.js](https://nodejs.org/) ≥ 18
- Cloudflare account

### 1. Install Wrangler
```bash
npm install -g wrangler
wrangler login
```

### 2. Create KV Namespace
```bash
wrangler kv:namespace create "CACHE"
wrangler kv:namespace create "CACHE" --preview
```

Copy the returned `id` and `preview_id` into `wrangler.toml`:
```toml
[[kv_namespaces]]
binding = "CACHE"
id = "<your-id>"
preview_id = "<your-preview-id>"
```

### 3. Set Secrets
```bash
# Your Notion Integration Token
wrangler secret put NOTION_TOKEN

# Optional: secret for cache invalidation endpoint
wrangler secret put INVALIDATE_SECRET
```

### 4. Deploy
```bash
cd worker/
wrangler deploy
```

The worker URL will be:
`https://bandar-financial-dashboard.<your-subdomain>.workers.dev`

### 5. Update Dashboard (optional — only needed for live Notion data)

To switch the dashboard from static JSON files to the live Worker,
edit `budget-dashboard.html` and change the `loadData()` function:

```javascript
const WORKER_URL = 'https://bandar-financial-dashboard.<subdomain>.workers.dev';

async function loadData() {
  const [txData, budgetData, catData] = await Promise.all([
    fetch(`${WORKER_URL}/transactions`).then(r => r.json()),
    fetch(`${WORKER_URL}/budgets`).then(r => r.json()),
    fetch(`${WORKER_URL}/categories`).then(r => r.json()),
  ]);
  allTransactions = txData.transactions;
  budgets = budgetData.categories;
  categories = catData.categories.map(c => c.name);
  // ...
}
```

## Architecture

```
Browser (GitHub Pages)
      │
      │ fetch()
      ▼
Cloudflare Worker  ──── KV Cache
      │
      │ Notion API (authenticated)
      ▼
Notion Database (da9870a7-4b62-4248-af06-4fbf25a56289)
```

## Environment Variables

| Variable | Type | Description |
|---|---|---|
| `NOTION_TOKEN` | Secret | Notion Integration Token |
| `NOTION_DB_ID` | Var | Transactions DB ID (set in wrangler.toml) |
| `INVALIDATE_SECRET` | Secret | Auth token for cache invalidation endpoint |
| `CACHE` | KV Binding | Cloudflare KV namespace |
