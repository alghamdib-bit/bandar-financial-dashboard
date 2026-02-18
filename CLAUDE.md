# Monthly Budget Manager

## Project Overview
Personal finance dashboard that processes credit card statements, auto-categorizes transactions by merchant keywords, and displays spending via an interactive HTML dashboard.

## File Structure
```
Finance/
  budget-dashboard.html    # Single-page HTML dashboard (dark theme, 4 tabs)
  process_statements.py    # Statement parser (Al Rajhi XLS + SAB PDF)
  data/
    transactions.json      # Master transaction database (2,598 transactions)
    categories.json        # 21 categories with keyword arrays for matching
    budgets.json           # Monthly budget allocations (SAR 18,900 total)
    processed_files.json   # Tracks which statement files have been imported
```

## How It Works

### Statement Processing
- `process_statements.py` parses Al Rajhi bank XLS files and SAB credit card PDF statements
- Run: `python3 process_statements.py path/to/statement.xls` or `.pdf`
- Use `--force` to re-import (deduplicates by date+merchant+amount)
- Outputs to `data/transactions.json`

### Categorization
- **Keyword-based**: case-insensitive substring matching of merchant name against category keyword arrays in `categories.json`
- SAB PDF merchants often concatenate merchant+city without spaces (e.g., "BURGERKINGOTHMAN"), so keywords include both spaced and concatenated variants
- Each category has a `keywords` array; first match wins

### Re-categorization Script
When keywords are updated in `categories.json`, run this to re-apply categories in-place (since `process_statements.py --force` deduplicates and won't re-categorize existing entries):
```python
import json
with open('data/categories.json') as f:
    cats = json.load(f)['categories']
with open('data/transactions.json') as f:
    txns = json.load(f)
def categorize(merchant, categories):
    m = merchant.lower().strip()
    for cat in categories:
        for kw in cat['keywords']:
            if kw.lower() in m:
                return cat['name']
    return 'Other'
for t in txns:
    t['category'] = categorize(t['merchant'], cats)
with open('data/transactions.json', 'w') as f:
    json.dump(txns, f, indent=2, ensure_ascii=False)
```

### Budget Periods
- Salary-aligned: **25th of month to 24th of next month**
- Dashboard navigation uses this cycle

## Dashboard (`budget-dashboard.html`)
- **Served via**: `python3 -m http.server 8765` from the `Finance/` directory, then open `http://localhost:8765/budget-dashboard.html`
- Dark theme, single-file HTML with inline CSS/JS
- 4 tabs: **Overview** (summary cards, daily spending chart, category progress bars), **Transactions** (searchable/filterable/sortable table with pagination), **Monthly History** (collapsible month cards), **Export** (copies Notion-formatted markdown to clipboard)
- **Global search**: Search button in header (or press `/`) opens a modal that searches all transactions across all periods by merchant or category name. Clicking a result navigates to that period and filters the Transactions tab.

## Current Stats
- **2,598 transactions** spanning 2025-02-13 to 2026-02-13
- **88.1% categorized** (309 remain in "Other")
- **Sources**: Al Rajhi (debit) + SAB (credit card)
- **21 categories**: Food Delivery, Groceries, Dining Out, Online Shopping, Fashion, Kids & Family, Health, Personal Care, Home & Furniture, Electronics, Subscriptions, Transport, Travel, Bills & Utilities, Education, Entertainment, Coffee, Smart Home, Business, Gifts, Other
- **Monthly budget**: SAR 18,900 total across all categories

## Remaining "Other" Transactions
- 309 uncategorized (mostly one-time merchants, 86% appear only once)
- Top uncategorized are large one-off purchases (SHARIKAT BITSH LAYIN SAR 26K, MESHKATI TRADING SAR 25K, soft industry factor SAR 22K)
- To reduce further: analyze remaining Other merchants, add keywords to `categories.json`, then run the re-categorization script above

## Key Gotchas
- `process_statements.py --force` does NOT re-categorize existing transactions; use the inline Python script above
- SAB merchants need concatenated keyword variants (no spaces between merchant name and city)
- Budget period is 25th-to-24th, not calendar month
- The dashboard fetches JSON files via HTTP, so it must be served (not opened as file://)
