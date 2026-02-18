/**
 * Bandar Financial Dashboard — Cloudflare Worker
 * Secure proxy between GitHub Pages dashboard and Notion API
 * with KV caching to avoid rate limits.
 *
 * Endpoints:
 *   GET /transactions   → All transactions from Notion DB (cached 10 min)
 *   GET /budgets        → Budget config (cached 1 hour)
 *   GET /categories     → Category list with keywords (cached 1 hour)
 *   GET /health         → Status check
 *
 * Env vars (set as Worker secrets/vars):
 *   NOTION_TOKEN        → Notion Integration Secret
 *   NOTION_DB_ID        → Transactions database ID
 *   CACHE               → KV namespace binding
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Dashboard-Secret',
  'Content-Type': 'application/json',
};

// Card display name mapping
const CARD_MAP = {
  'Al Rajhi 1': 'alrajhi',
  'Al Rajhi 2': 'alrajhi',
  'Al Rajhi 3': 'alrajhi',
  'SAB': 'sab',
  'Other': 'other',
};

// Notion category → dashboard category name mapping
const CATEGORY_NAME_MAP = {
  'Health & Medical': 'Health',
  'Transport & Fuel': 'Transport',
  'Gifts & Charity': 'Gifts',
};

// Budget config (matches budgets.json exactly)
const BUDGETS_DATA = {
  currency: 'SAR',
  budget_period: {
    start_day: 25,
    description: 'Salary-aligned: 25th of current month to 24th of next month',
  },
  total_monthly_budget: 18400,
  categories: {
    'Food Delivery': 1700,
    'Groceries': 2200,
    'Dining Out': 1200,
    'Online Shopping': 1800,
    'Fashion': 800,
    'Kids & Family': 1000,
    'Health': 500,
    'Personal Care': 500,
    'Home & Furniture': 800,
    'Electronics': 500,
    'Subscriptions': 400,
    'Transport': 800,
    'Travel': 1500,
    'Bills & Utilities': 1500,
    'Education': 500,
    'Entertainment': 400,
    'Coffee': 500,
    'Gifts': 500,
    'Smart Home': 300,
    'Business': 500,
    'Other': 1000,
  },
};

// Categories config (matches categories.json exactly)
const CATEGORIES_DATA = {
  categories: [
    { name: 'Food Delivery', keywords: ['jahez','hungerstation','hunger station','chefz','careem food','mrsool','toyou','to you','wssel','keeta','marsool','the chefz','ananinja','ana ninja','founder of candy'] },
    { name: 'Groceries', keywords: ['danube','tamimi','panda','lulu','carrefour','farm superstores','othaim','bindawood','nova water','mawnah','supermarket','grocery','bin dawood','bustan alghalyah','saudi marketing co','themar aljathab','durrat al watan','zad al tamween','tamwnat','aljamal alraqy','national water','rawafed market','mujahid al harbi veg','wadi qurtbah market','alnabea alnaqi','aswaq','shmouk baladi','euromarche','hybrid euromarche','hybrid prince sult','market smsm','tamwinat rukn'] },
    { name: 'Dining Out', keywords: ['romansiah','herfy','kudu','mcdonalds','mcdonald','mc donald','burger king','burgerkingthum','burgerkingothman','burgerkingh','kfc','starbucks','dunkin','subway','dominos','domino','pizza hut','shawarma','restaurant','restaorant','restura','al baik','albaik','shahi lamma','mamanoura','al hodooj','alhodooj','bofia','samsm basta','zafyra','al harshwna','alharshwna','keef aloroba','wingstop','beika','asia road holding fo','mysr-fnb','dwar alsadah','frooj','sweet delicious','bread ahead','easy bakery','baba khabbaz','allo beirut','allobeirut','mashagheth','diwaan alakkil','habibah sweets','global potato corner','uptown donuts','movenpick ice cream','golden chimney','feroj al','al ahlia resturant','cravia arabia','meatcorner','meat corner','baja food','bajafood','paul park avenue','q-paul','paul','arwana artisan','lepain bakery','mtam','mtaam','mateam','nwadr','qalat alenayh','yourchoice','sixty five degrees','oxxo','lemon co','qaleah alhalwaa','sisi','eatry','thft alhdart','tahfat al hadara','tahfatalhadara','pinkberry','baskin robbins','krispy kreme','piatto','green dragon','asq international fo','swik taka','tarmoom','ssp arabia','ssparabia','wendys','wendy','nandos','sbarro','sbaroo','cold stone','coldstone','century burger','tikka way','marbleslab','marble slab','fire grill','hakra burger','texas road','texasroad','swiss butter','swissbutter','q-molo','chef falafel','cheffalafel','al mahawi sweets','hlweat saad','seven hundred restau','corner tut wurman','al diwaniyah','mansour faraj restau','zouq beirut','fish auction','fishauction','shawerma','shawermaji','food gate','express food','neyam','madghout baytna','madghut baytina','al liwan','alliwan','tulin palace bakery','tarfa bakeries','tarfabakeries','moroccan taste','kebab','ritazza','q-chica','chica','matam khareta','dawar alsaadah','breakfast club','ben s cookies','benscookies','home bakery'] },
    { name: 'Online Shopping', keywords: ['noon','amazon','alibaba','aliexpress','shein','namshi','iherb','noon.com','mini so','tabby','tamara','neweppplan','alsaifgallery','alsaif gallery','nana','keemart','jetstoreksa'] },
    { name: 'Fashion', keywords: ['zara','h&m','centrepoint','max fashion','max 60','splash','dior','zyros','golden drop','nike','adidas','mohamed s ajlan','ajlan sons','terranova','lefties','rare and basics','rareandbasics','al majed oud','apparel trading','semir park','azadea','azdeadal','kiabi','sun and sand spo','marks and','brands for less','pull  bear','under armour','skechers','parfois','red tag','claires','fahed alhokair','ricc','avenue  4087','bershka','zic style','pan emira','panemira','aalm brayft llabayat','taraf llmalbs','acto city','sahm al-tafseel','puma','lc waikiki','giordano','stradivarius','springfield','mango al hamra','nayomi','trendyol','punt roma','calliobe','blue age','brand bazar','la vie en rose','ikks','govyy','riva salam','decathlon'] },
    { name: 'Kids & Family', keywords: ['landmark','mothercare','babyshop','baby shop','toys','chuck e','sparky','bounce','trampoline','dar ehsas','mamas & papas','funtura','happy family','carters','centrl galaxy childr','billy beez','funky monkey','habby city'] },
    { name: 'Health', keywords: ['alnahdi','nahdi','nahdionline','whites','al dawaa','dawaa','pharmacy','shams pharmacy','asharq alawsat pharm','sehat al hamra','hospital','fakeeh hospital','dr. mohammed','dr sulaiman','drsulaiman','marakez medical','nmc stature','nmc4087','alsalman optics','nutrition world','hakeem oyoun','alsafa co for pharma','alsafa warehouse pha','nutrition corner','dr mohammad rashid','house of medicines'] },
    { name: 'Personal Care', keywords: ['dar alanayt','daralanayt','bath body','bath & body','sephora','faces','salon','barber','lubna obaid','alamah muzneh','ajmal perfumes','ajamal perfumes','perfumista','oud-bakhoor','al majed oud','almajed 4 oud','orange bed and bath','orangebedandbath','washering the clothe','burjalhamam','laundry','aljabr','dkhoun','asghar ali','asgharali','knoz cosmetics','fresha'] },
    { name: 'Home & Furniture', keywords: ['ikea','extra stores','classic home','home center','homecenter','saco','abyat','ikaf arabian','extrariyadh','extra rs','villeroy and boch','beata garden','makhazen alenaya','dar alamerat','lazboy','la-z-boy','alfares floor','alfaresfloor','alfares f','dream home','sleephigh','stars home','masdar hardware','ealam alsajaad','nternational lightin','united homeware','daiso'] },
    { name: 'Electronics', keywords: ['jarir','apple store','samsung store','al falak electronic','alfalak','applecare','nextjafz'] },
    { name: 'Subscriptions', keywords: ['apple.com/bill','apple.com','netflix','spotify','shahid','google play','youtube premium','adobe','openai','chatgpt','audible','itunes','mqhy ayhaa','mqhyayhaa','osn','eshtrakati','webook'] },
    { name: 'Transport', keywords: ['petromin','fuel','uber','careem','riyadh metro','metro','parking','black parking','drive','riyadh airports','best bautteres','best batteries','riaydhairports','bestbautterest','aldrees','thumama station','wafi energy','liter co','litertrading','well gas station','well  petroleum','sasco','et car hire','transit','octain gas','petroly','sahel station','nitaq car'] },
    { name: 'Travel', keywords: ['saudi airlines','saudia','flynas','fly nas','booking.com','agoda','hotel','airbnb','holafly','catrion flynas','takamol e-visa','hilton','causeway','cff gare','sbb','chemin de fer','mobchemin','lausanne','geneve','geneva'] },
    { name: 'Bills & Utilities', keywords: ['sadad','saudi electricity','stc','saudi telecom','sauditeleco','mobily','zain','stc prepaid','stc pay','vat on markup','annualfee','annual fee','cash/digital','tawaruq','tameeni','insurance'] },
    { name: 'Education', keywords: ['school','university','udemy','coursera','education','academy','bookstore'] },
    { name: 'Entertainment', keywords: ['cinema','vox','amc','muvi','playstation','steam','king abdulaziz cultura','kingabdulazizcultura','ithra','blvd world','al momayaz for enter','origo','arabian entertainmen','hala yalla','halayalla'] },
    { name: 'Coffee', keywords: ['barn','dose','specialty bean','ataad coffee','caribou','tim hortons','costa coffee','beehive cafe','beehivecafe','coffee address','coffeeaddress','cocafe','address coffee','addresscoffee','miraqe','brew 92','brew92','ghosn cafe','munirah kayf','jaafar beverage','osoalco','osoal co','4twins','signature','8oz coffee','joes cafe','drcafe','dr cafe','cat house beverage','traveler cafe','mawjat','belong','blue star cafe','latt liv','theroasterysa','roastery','different beans','beanery','coffee tools','coffeetools','coffee extract','core coffee','spirit cafe','haten cafe','line cafe','six ouonces','12 cups','das mond caffe','nara cafe'] },
    { name: 'Smart Home', keywords: ['shelly','zigbee','sonoff','tuya','grandstream','smart home','aomei','allterco'] },
    { name: 'Business', keywords: ['spl','al kaffar','office','print','fedex','aramex','postal services','masarat mecherga','almada for','sahl almanal','fatoora','absher','tasaneef'] },
    { name: 'Gifts', keywords: ['gift','flowers','chocolat','patchi','charity','donation','bashayer mashhour','bashayermashhour','safa al jamali','safaaljamali','ehsan','ehsanplatform','alaraies','woroud mahra'] },
    { name: 'Other', keywords: [] },
  ],
};

// ---------- Notion API helpers ----------

async function notionRequest(env, path, body = null) {
  const options = {
    method: body ? 'POST' : 'GET',
    headers: {
      'Authorization': `Bearer ${env.NOTION_TOKEN}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
  };
  if (body) options.body = JSON.stringify(body);
  const res = await fetch(`https://api.notion.com/v1${path}`, options);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Notion API error ${res.status}: ${err}`);
  }
  return res.json();
}

/**
 * Fetch ALL pages from a Notion DB, handling pagination automatically.
 * Returns array of raw Notion page objects.
 */
async function fetchAllNotionPages(env) {
  const pages = [];
  let cursor = undefined;

  do {
    const body = {
      page_size: 100,
      sorts: [{ property: 'Date', direction: 'descending' }],
    };
    if (cursor) body.start_cursor = cursor;

    const data = await notionRequest(env, `/databases/${env.NOTION_DB_ID}/query`, body);
    pages.push(...data.results);
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);

  return pages;
}

/**
 * Transform a single Notion page object into the dashboard's transaction format:
 * { date, merchant, amount, source, category, type, verified, budgetPeriod }
 */
function transformPage(page) {
  const p = page.properties;

  // Date
  const dateVal = p['Date']?.date?.start ?? null;

  // Merchant (title property)
  const merchantArr = p['Merchant']?.title ?? [];
  const merchant = merchantArr.map(t => t.plain_text).join('').trim();

  // Amount
  const amount = p['Amount (SAR)']?.number ?? 0;

  // Source: map Card → source string
  const cardName = p['Card']?.select?.name ?? 'Other';
  const source = CARD_MAP[cardName] ?? 'other';

  // Category: reverse-map Notion category names to dashboard names
  let category = p['Category']?.select?.name ?? 'Other';
  category = CATEGORY_NAME_MAP[category] ?? category;

  // Type & Verified (extra metadata)
  const type = p['Type']?.select?.name ?? 'Debit';
  const verified = p['Verified']?.checkbox ?? false;
  const budgetPeriod = p['Budget Period']?.select?.name ?? '';

  return { date: dateVal, merchant, amount, source, category, type, verified, budgetPeriod };
}

// ---------- Cache helpers ----------

const CACHE_TTL = {
  transactions: 10 * 60,   // 10 minutes
  budgets: 60 * 60,        // 1 hour
  categories: 60 * 60,     // 1 hour
};

async function getCached(env, key) {
  if (!env.CACHE) return null;
  try {
    const val = await env.CACHE.get(key);
    return val ? JSON.parse(val) : null;
  } catch {
    return null;
  }
}

async function setCached(env, key, data, ttl) {
  if (!env.CACHE) return;
  try {
    await env.CACHE.put(key, JSON.stringify(data), { expirationTtl: ttl });
  } catch {
    // KV write failure is non-fatal
  }
}

// ---------- Response helpers ----------

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: CORS_HEADERS,
  });
}

function errorResponse(message, status = 500) {
  return jsonResponse({ error: message }, status);
}

// ---------- Route handlers ----------

async function handleTransactions(env) {
  const cacheKey = 'transactions_v1';

  // Try cache first
  const cached = await getCached(env, cacheKey);
  if (cached) {
    return jsonResponse({ transactions: cached, cached: true, count: cached.length });
  }

  // Fetch from Notion
  const pages = await fetchAllNotionPages(env);
  const transactions = pages.map(transformPage).filter(t => t.date !== null);

  // Sort by date descending
  transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

  // Cache the result
  await setCached(env, cacheKey, transactions, CACHE_TTL.transactions);

  return jsonResponse({ transactions, cached: false, count: transactions.length });
}

async function handleBudgets(env) {
  const cacheKey = 'budgets_v1';
  const cached = await getCached(env, cacheKey);
  if (cached) return jsonResponse(cached);

  await setCached(env, cacheKey, BUDGETS_DATA, CACHE_TTL.budgets);
  return jsonResponse(BUDGETS_DATA);
}

async function handleCategories(env) {
  const cacheKey = 'categories_v1';
  const cached = await getCached(env, cacheKey);
  if (cached) return jsonResponse(cached);

  await setCached(env, cacheKey, CATEGORIES_DATA, CACHE_TTL.categories);
  return jsonResponse(CATEGORIES_DATA);
}

async function handleCacheInvalidate(env, request) {
  // Simple auth: require a secret header to invalidate cache
  const authHeader = request.headers.get('X-Invalidate-Secret');
  if (!env.INVALIDATE_SECRET || authHeader !== env.INVALIDATE_SECRET) {
    return errorResponse('Unauthorized', 401);
  }

  const keysToDelete = ['transactions_v1', 'budgets_v1', 'categories_v1'];
  if (env.CACHE) {
    await Promise.all(keysToDelete.map(k => env.CACHE.delete(k)));
  }

  return jsonResponse({ message: 'Cache invalidated', keys: keysToDelete });
}

// ---------- Main fetch handler ----------

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, '') || '/';

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // --- Secret token auth (skip for /health) ---
    if (path !== '/health') {
      const secret = env.DASHBOARD_SECRET;
      const provided = request.headers.get('X-Dashboard-Secret') || url.searchParams.get('secret');
      if (!secret || provided !== secret) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }
    }

    // Only allow GET (and POST for cache invalidation)
    if (request.method !== 'GET' && !(request.method === 'POST' && path === '/cache/invalidate')) {
      return errorResponse('Method not allowed', 405);
    }

    try {
      switch (path) {
        case '/health':
          return jsonResponse({
            status: 'ok',
            timestamp: new Date().toISOString(),
            notion_db: env.NOTION_DB_ID ?? 'not set',
          });

        case '/transactions':
          return await handleTransactions(env);

        case '/budgets':
          return await handleBudgets(env);

        case '/categories':
          return await handleCategories(env);

        case '/cache/invalidate':
          return await handleCacheInvalidate(env, request);

        default:
          return jsonResponse({
            message: 'Bandar Financial Dashboard API',
            endpoints: ['/health', '/transactions', '/budgets', '/categories'],
          }, 200);
      }
    } catch (err) {
      console.error('Worker error:', err.message);
      return errorResponse(`Internal error: ${err.message}`, 500);
    }
  },
};
