const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.resolve(__dirname, 'nativebazar.db');
const jsonPath = path.resolve(__dirname, 'server_data', 'db.json');
const outputPath = path.resolve(__dirname, 'database_viewer.html');

if (!fs.existsSync(dbPath)) {
  console.error('Database file not found at:', dbPath);
  process.exit(1);
}

const db = new Database(dbPath);
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();

const dbData = {
  sqlite: {},
  json: {}
};

for (const t of tables) {
  try {
    const rows = db.prepare(`SELECT * FROM "${t.name}"`).all();
    dbData.sqlite[t.name] = rows;
  } catch (err) {
    dbData.sqlite[t.name] = [];
  }
}

if (fs.existsSync(jsonPath)) {
  try {
    const jsonContent = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    dbData.json = jsonContent;
  } catch (err) {
    dbData.json = {};
  }
}

const html = `<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>আমার হাট - ডেটাবেজ ভিউয়ার ও সম্পূর্ণ CRUD কন্ট্রোল প্যানেল (Amar Haat Full CRUD DB Explorer)</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background-color: #0f172a; color: #f8fafc; }
    .table-scroll::-webkit-scrollbar { height: 8px; width: 8px; }
    .table-scroll::-webkit-scrollbar-track { background: #1e293b; }
    .table-scroll::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
    .table-scroll::-webkit-scrollbar-thumb:hover { background: #475569; }
  </style>
</head>
<body class="p-4 md:p-8">
  <div class="max-w-7xl mx-auto space-y-6">
    <!-- Header -->
    <div class="bg-gradient-to-r from-emerald-950 via-slate-900 to-stone-900 border border-emerald-800/40 rounded-2xl p-6 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <div class="flex flex-wrap items-center gap-2 mb-2">
          <span class="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-xs font-semibold">
            <i class="fa-solid fa-layer-group"></i> সম্পূর্ণ CRUD কন্ট্রোল সক্রিয় (Create • Read • Update • Delete)
          </span>
          <span id="server-status-pill" class="inline-flex items-center gap-2 px-3 py-1 bg-slate-800 text-slate-400 border border-slate-700 rounded-full text-xs font-semibold">
            <span class="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span> সার্ভার চেক করা হচ্ছে...
          </span>
        </div>
        <h1 class="text-2xl md:text-3xl font-black text-white tracking-tight">আমার হাট - ডাটাবেজ কন্ট্রোল প্যানেল</h1>
        <p class="text-slate-400 text-sm mt-1">
          Persistent Storage Explorer • SQLite (<code class="text-emerald-400">nativebazar.db</code>) & JSON (<code class="text-amber-400">server_data/db.json</code>)
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <button onclick="openInsertModal()" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold flex items-center gap-2 shadow-lg shadow-emerald-950/40 transition-all cursor-pointer">
          <i class="fa-solid fa-plus"></i> নতুন রেকর্ড যোগ করুন
        </button>
        <button onclick="syncLiveFromBackend()" class="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all cursor-pointer" title="সার্ভার থেকে লাইভ ডাটা আনুন">
          <i class="fa-solid fa-cloud-arrow-down"></i> লাইভ সিঙ্ক
        </button>
        <button onclick="location.reload()" class="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all cursor-pointer">
          <i class="fa-solid fa-rotate"></i> রিফ্রেশ
        </button>
      </div>
    </div>

    <!-- Feedback Message Box -->
    <div id="feedback-alert" class="hidden rounded-xl p-4 text-sm font-semibold border flex items-center gap-3 transition-all"></div>

    <!-- Quick Stats Cards (Dynamic Counters) -->
    <div id="stats-container" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3"></div>

    <!-- Main Workspace: Sidebar & Table Content -->
    <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <!-- Tables List Sidebar -->
      <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-4">
        <div>
          <h2 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            <i class="fa-solid fa-table mr-1 text-emerald-400"></i> SQLite টেবিলসমূহ
          </h2>
          <div id="sqlite-table-nav" class="space-y-1"></div>
        </div>

        <div class="pt-3 border-t border-slate-800">
          <h2 class="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">
            <i class="fa-solid fa-file-code mr-1"></i> JSON কালেকশন
          </h2>
          <div id="json-table-nav" class="space-y-1"></div>
        </div>
      </div>

      <!-- Table View -->
      <div class="lg:col-span-3 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col space-y-4">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div class="flex items-center gap-3">
            <span id="active-table-badge" class="px-3 py-1 bg-emerald-500/20 text-emerald-400 font-mono font-bold text-sm rounded-lg border border-emerald-500/30">
              users
            </span>
            <span id="active-table-count" class="text-xs text-slate-400">0 records</span>
            <span class="text-[11px] text-emerald-400 bg-emerald-950/60 border border-emerald-700/50 px-2 py-0.5 rounded-full">
              <i class="fa-solid fa-bolt mr-1"></i> লাইভ সেভ ও ডিলিট
            </span>
          </div>
          <div class="flex items-center gap-2 w-full sm:w-auto">
            <div class="relative w-full sm:w-64">
              <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs"></i>
              <input id="search-input" type="text" placeholder="এই টেবিলে খুঁজুন..." oninput="filterCurrentTable()" class="w-full bg-slate-800 border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500" />
            </div>
            <button onclick="openInsertModal()" class="sm:hidden px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-xl cursor-pointer">
              <i class="fa-solid fa-plus"></i> যোগ
            </button>
          </div>
        </div>

        <div class="table-scroll overflow-x-auto flex-1 min-h-[420px] rounded-xl border border-slate-800/80 bg-slate-950/60">
          <table id="records-table" class="min-w-full text-xs text-left">
            <thead id="table-head" class="bg-slate-800/80 text-slate-300 font-bold sticky top-0 uppercase tracking-wider"></thead>
            <tbody id="table-body" class="divide-y divide-slate-800 text-slate-300"></tbody>
          </table>
        </div>
      </div>
    </div>
  </div>

  <!-- Insert Record Modal (CREATE) -->
  <div id="insert-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
    <div class="bg-slate-900 border border-emerald-700/60 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
      <div class="p-5 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
        <div>
          <h3 class="text-base font-bold text-white flex items-center gap-2">
            <i class="fa-solid fa-circle-plus text-emerald-400"></i>
            <span>নতুন রেকর্ড যোগ করুন</span>
          </h3>
          <p id="insert-modal-subtitle" class="text-xs text-slate-400 mt-0.5">টার্গেট: users</p>
        </div>
        <button onclick="closeInsertModal()" class="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer">
          <i class="fa-solid fa-xmark text-lg"></i>
        </button>
      </div>

      <div id="insert-form-container" class="p-5 overflow-y-auto space-y-4 flex-1">
        <!-- Dynamic fields -->
      </div>

      <div class="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-end gap-3">
        <button onclick="closeInsertModal()" class="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer">
          বাতিল (Cancel)
        </button>
        <button id="insert-submit-btn" onclick="submitInsertRecord()" class="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg transition-all flex items-center gap-2 cursor-pointer">
          <i class="fa-solid fa-check"></i> রেকর্ড সংরক্ষণ করুন (Save Record)
        </button>
      </div>
    </div>
  </div>

  <script>
    const data = ${JSON.stringify(dbData)};
    let activeSource = 'sqlite';
    let activeTableName = 'users';
    let editingRowId = null;
    let editFormData = {};
    let deletingRowId = null;
    let newRecordData = {};

    // Dynamic API origin detection
    const API_BASE = (window.location.origin && window.location.origin.startsWith('http') && !window.location.origin.includes('5173'))
      ? window.location.origin
      : 'http://localhost:3000';

    const AUTH_HEADERS = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': 'Bearer NativeBazarSJS'
    };

    function init() {
      renderStats();
      renderNav();
      showTable('sqlite', 'users');
      pingServerHealth();
      setInterval(pingServerHealth, 10000);
      fetchLiveDatabase();
    }

    // Live full database loader — guarantees data NEVER reverts on browser refresh (F5)
    async function fetchLiveDatabase() {
      try {
        const res = await fetch(\`\${API_BASE}/api/admin/db/all\`, { headers: AUTH_HEADERS });
        if (res.ok) {
          const resData = await res.json();
          if (resData.success && resData.data) {
            if (resData.data.sqlite) data.sqlite = resData.data.sqlite;
            if (resData.data.json) data.json = resData.data.json;
            renderStats();
            renderNav();
            renderTableRows(document.getElementById('search-input')?.value || '');
          }
        }
      } catch (e) {
        // Fall back gracefully to embedded data if server is offline
        console.log('Backend offline on initial load; using embedded offline cache');
      }
    }

    async function pingServerHealth() {
      const pill = document.getElementById('server-status-pill');
      try {
        const res = await fetch(\`\${API_BASE}/api/admin/db/stats\`, {
          method: 'GET',
          headers: AUTH_HEADERS
        });
        if (res.ok) {
          pill.className = "inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-xs font-semibold";
          pill.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> ব্যাকএন্ড: অনলাইন (' + API_BASE + ')';
        } else {
          throw new Error('Status ' + res.status);
        }
      } catch (e) {
        pill.className = "inline-flex items-center gap-2 px-3 py-1 bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-full text-xs font-semibold cursor-pointer";
        pill.title = "সার্ভার চালু করতে টার্মিনালে চালান: npm start";
        pill.innerHTML = '<span class="w-2 h-2 rounded-full bg-rose-400"></span> ব্যাকএন্ড: অফলাইন (চালান: npm start)';
      }
    }

    async function syncLiveFromBackend() {
      showFeedback('লাইভ ডাটাবেজ থেকে সম্পূর্ণ ডাটা রিফ্রেশ হচ্ছে...', 'info');
      try {
        const res = await fetch(\`\${API_BASE}/api/admin/db/all\`, { headers: AUTH_HEADERS });
        const resData = await res.json();
        if (!res.ok || !resData.success) {
          throw new Error(resData.error || 'লাইভ ডাটা রিফ্রেশ ব্যর্থ');
        }

        if (resData.data?.sqlite) data.sqlite = resData.data.sqlite;
        if (resData.data?.json) data.json = resData.data.json;

        renderStats();
        renderNav();
        renderTableRows(document.getElementById('search-input')?.value || '');
        showFeedback('লাইভ সার্ভার থেকে সর্বশেষ সম্পূর্ণ ডাটাবেজ সফলভাবে সিঙ্ক হয়েছে!', 'success');
      } catch (err) {
        const msg = err.message.includes('Failed to fetch')
          ? 'সার্ভার সংযোগ বিচ্ছিন্ন (Failed to fetch)। নিশ্চিত করুন ব্যাকএন্ড সার্ভার চালু আছে: টার্মিনালে npm start চালান এবং ' + API_BASE + ' সচল আছে।'
          : 'সিঙ্ক ত্রুটি: ' + err.message;
        showFeedback(msg, 'error');
      }
    }

    /* ========================================================
     * DYNAMIC COUNTERS: Top Dashboard Stats Cards
     * ======================================================== */
    function renderStats() {
      const container = document.getElementById('stats-container');
      if (!container) return;
      container.innerHTML = '';
      
      const statsList = [
        { label: 'ব্যবহারকারী (Users)', count: (data.sqlite.users || data.json.users || []).length, icon: 'fa-users', color: 'emerald' },
        { label: 'পণ্য (Products)', count: (data.sqlite.products || data.json.crops || []).length, icon: 'fa-seedling', color: 'teal' },
        { label: 'অর্ডার (Orders)', count: (data.sqlite.orders || data.json.orders || []).length, icon: 'fa-cart-shopping', color: 'blue' },
        { label: 'বাজার দর (Prices)', count: (data.sqlite.market_prices || []).length, icon: 'fa-chart-line', color: 'indigo' },
        { label: 'বার্তা (Messages)', count: (data.json.messages || []).length, icon: 'fa-envelope', color: 'amber' },
        { label: 'নোটিফিকেশন', count: (data.json.notifications || []).length, icon: 'fa-bell', color: 'rose' }
      ];

      statsList.forEach(s => {
        const card = document.createElement('div');
        card.className = "bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between";
        card.innerHTML = \`
          <div class="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span class="truncate">\${s.label}</span>
            <i class="fa-solid \${s.icon}"></i>
          </div>
          <div class="text-2xl font-black text-white">\${s.count.toLocaleString()}</div>
        \`;
        container.appendChild(card);
      });
    }

    /* ========================================================
     * SIDEBAR NAVIGATION & DYNAMIC BADGE COUNTERS
     * ======================================================== */
    function renderNav() {
      const sqliteNav = document.getElementById('sqlite-table-nav');
      sqliteNav.innerHTML = '';
      Object.keys(data.sqlite).forEach(name => {
        const btn = document.createElement('button');
        btn.id = \`btn-sqlite-\${name}\`;
        btn.onclick = () => showTable('sqlite', name);
        btn.className = "w-full text-left px-3 py-2 rounded-xl text-xs font-medium flex items-center justify-between transition-all hover:bg-slate-800 text-slate-400 cursor-pointer";
        btn.innerHTML = \`
          <span class="truncate">\${name}</span>
          <span class="nav-badge px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-slate-400">\${(data.sqlite[name] || []).length}</span>
        \`;
        sqliteNav.appendChild(btn);
      });

      const jsonNav = document.getElementById('json-table-nav');
      jsonNav.innerHTML = '';
      const jsonKeys = ['messages', 'connections', 'notifications', 'callLogs', 'catalog', 'users', 'crops', 'orders'];
      jsonKeys.forEach(name => {
        if (!data.json[name]) return;
        const btn = document.createElement('button');
        btn.id = \`btn-json-\${name}\`;
        btn.onclick = () => showTable('json', name);
        btn.className = "w-full text-left px-3 py-2 rounded-xl text-xs font-medium flex items-center justify-between transition-all hover:bg-slate-800 text-slate-400 cursor-pointer";
        btn.innerHTML = \`
          <span class="truncate">\${name}</span>
          <span class="nav-badge px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-amber-400">\${(data.json[name] || []).length}</span>
        \`;
        jsonNav.appendChild(btn);
      });

      // Highlight only the currently active table button and reset all others
      highlightActiveNavButton();
    }

    /* ========================================================
     * SIDEBAR ACTIVE STATE CONTROLLER
     * Guarantees only the clicked table stays active and removes
     * active classes from all siblings across both lists.
     * ======================================================== */
    function highlightActiveNavButton() {
      // 1. Remove active styles from ALL buttons and badges in both SQLite and JSON navs
      document.querySelectorAll('#sqlite-table-nav button, #json-table-nav button').forEach(b => {
        b.className = "w-full text-left px-3 py-2 rounded-xl text-xs font-medium flex items-center justify-between transition-all hover:bg-slate-800 text-slate-400 cursor-pointer";
        const badge = b.querySelector('.nav-badge');
        if (badge) {
          badge.className = "nav-badge px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-mono " +
            (b.id.startsWith('btn-sqlite') ? 'text-slate-400' : 'text-amber-400');
        }
      });

      // 2. Apply active styling ONLY to the currently selected table button
      const activeBtn = document.getElementById(\`btn-\${activeSource}-\${activeTableName}\`);
      if (activeBtn) {
        activeBtn.className = activeSource === 'sqlite'
          ? "w-full text-left px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between transition-all bg-emerald-600 text-white shadow-md cursor-pointer"
          : "w-full text-left px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between transition-all bg-amber-600 text-white shadow-md cursor-pointer";
        const activeBadge = activeBtn.querySelector('.nav-badge');
        if (activeBadge) {
          activeBadge.className = "nav-badge px-1.5 py-0.5 rounded bg-white/20 text-[10px] font-mono text-white";
        }
      }
    }

    function showTable(source, name) {
      activeSource = source;
      activeTableName = name;
      editingRowId = null;
      editFormData = {};
      deletingRowId = null;

      // Update active state cleanly
      highlightActiveNavButton();

      document.getElementById('active-table-badge').innerText = \`\${source === 'sqlite' ? 'SQLite' : 'JSON'}: \${name}\`;
      document.getElementById('search-input').value = '';
      renderTableRows();
    }

    /* ========================================================
     * CREATE: Insert Record Modal Logic
     * ======================================================== */
    function openInsertModal() {
      const records = (activeSource === 'sqlite' ? data.sqlite[activeTableName] : data.json[activeTableName]) || [];
      const subtitle = document.getElementById('insert-modal-subtitle');
      subtitle.innerText = \`টার্গেট স্টোরেজ: \${activeSource.toUpperCase()} • কালেকশন / টেবিল: \${activeTableName}\`;

      const container = document.getElementById('insert-form-container');
      container.innerHTML = '';
      newRecordData = {};

      const lockedCols = new Set(['id', 'created_at', 'createdAt', 'updated_at', 'updatedAt', 'password_hash', 'passwordHash', 'sessionToken']);
      
      let columns = [];
      if (records.length > 0) {
        columns = Object.keys(records[0]).filter(c => !lockedCols.has(c));
      } else {
        if (activeTableName.includes('user')) columns = ['name', 'phone', 'role', 'division', 'district', 'upazila', 'status', 'is_verified'];
        else if (activeTableName.includes('product') || activeTableName.includes('crop')) columns = ['name', 'category', 'price_per_kg', 'stock_kg', 'min_order_kg', 'location', 'farmer_name', 'farmer_phone'];
        else columns = ['name', 'title', 'value', 'status'];
      }

      const grid = document.createElement('div');
      grid.className = "grid grid-cols-1 sm:grid-cols-2 gap-4";

      columns.forEach(col => {
        const fieldWrapper = document.createElement('div');
        fieldWrapper.className = "space-y-1.5";

        let inputHtml = '';
        if (col === 'role') {
          newRecordData[col] = 'farmer';
          inputHtml = \`
            <select onchange="handleNewFieldChange('\${col}', this.value)" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500">
              <option value="farmer">কৃষক (Farmer)</option>
              <option value="buyer">ক্রেতা / পাইকার (Buyer)</option>
              <option value="wholesaler">আড়তদার (Wholesaler)</option>
              <option value="retailer">খুচরা বিক্রেতা (Retailer)</option>
              <option value="admin">অ্যাডমিন (Admin)</option>
            </select>\`;
        } else if (col === 'status' || col === 'delivery_status' || col === 'payment_status') {
          newRecordData[col] = col === 'payment_status' ? 'Paid' : 'active';
          inputHtml = \`
            <select onchange="handleNewFieldChange('\${col}', this.value)" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500">
              <option value="active">সক্রিয় (Active)</option>
              <option value="pending">অপেক্ষমান (Pending)</option>
              <option value="completed">সম্পন্ন (Completed)</option>
              <option value="suspended">স্থগিত (Suspended)</option>
              <option value="Paid">পরিশোধিত (Paid)</option>
            </select>\`;
        } else if (col === 'is_verified' || col === 'verified' || col === 'organic_certified') {
          newRecordData[col] = 1;
          inputHtml = \`
            <select onchange="handleNewFieldChange('\${col}', Number(this.value))" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500">
              <option value="1">হ্যাঁ / ভেরিফাইড (1 / True)</option>
              <option value="0">না / আনভেরিফাইড (0 / False)</option>
            </select>\`;
        } else {
          const sampleVal = records[0] ? records[0][col] : null;
          const isNum = typeof sampleVal === 'number' || col.includes('price') || col.includes('stock') || col.includes('kg') || col.includes('rate') || col.includes('amount') || col.includes('total');
          newRecordData[col] = isNum ? 0 : '';
          inputHtml = \`
            <input
              type="\${isNum ? 'number' : 'text'}"
              placeholder="\${col} লিখুন..."
              oninput="handleNewFieldChange('\${col}', this.type === 'number' ? Number(this.value) : this.value)"
              class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />\`;
        }

        fieldWrapper.innerHTML = \`
          <label class="block text-xs font-semibold text-slate-300 capitalize">\${col.replace(/_/g, ' ')}</label>
          \${inputHtml}
        \`;
        grid.appendChild(fieldWrapper);
      });

      container.appendChild(grid);
      document.getElementById('insert-modal').classList.remove('hidden');
    }

    function closeInsertModal() {
      document.getElementById('insert-modal').classList.add('hidden');
      newRecordData = {};
    }

    function handleNewFieldChange(col, val) {
      newRecordData[col] = val;
    }

    async function submitInsertRecord() {
      const tableKey = activeSource === 'sqlite' ? activeTableName : 'json:' + activeTableName;
      const submitBtn = document.getElementById('insert-submit-btn');
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> যুক্ত হচ্ছে...';

      try {
        const res = await fetch(\`\${API_BASE}/api/admin/db/record/\${tableKey}\`, {
          method: 'POST',
          headers: AUTH_HEADERS,
          body: JSON.stringify({ record: newRecordData })
        });

        const resData = await res.json();
        // Server returns HTTP 201 Created — accept 200 or 201
        if ((res.status < 200 || res.status >= 300) || !resData.success) {
          throw new Error(resData.error || 'নতুন রেকর্ড তৈরি ব্যর্থ হয়েছে');
        }

        const insertedRecord = resData.record || { ...newRecordData, id: resData.id || 'id_' + Date.now() };

        // Append to local dataset ONLY after confirmed 200/201 response from backend
        if (activeSource === 'sqlite') {
          data.sqlite[activeTableName] = data.sqlite[activeTableName] || [];
          data.sqlite[activeTableName].unshift(insertedRecord);
          // Bi-directional memory sync
          if (activeTableName === 'users') {
            data.json.users = data.json.users || [];
            data.json.users.unshift(insertedRecord);
          } else if (activeTableName === 'products') {
            data.json.crops = data.json.crops || [];
            data.json.crops.unshift(insertedRecord);
          } else if (activeTableName === 'orders') {
            data.json.orders = data.json.orders || [];
            data.json.orders.unshift(insertedRecord);
          }
        } else {
          data.json[activeTableName] = data.json[activeTableName] || [];
          data.json[activeTableName].unshift(insertedRecord);
          // Bi-directional memory sync
          if (activeTableName === 'users') {
            data.sqlite.users = data.sqlite.users || [];
            data.sqlite.users.unshift(insertedRecord);
          } else if (activeTableName === 'crops') {
            data.sqlite.products = data.sqlite.products || [];
            data.sqlite.products.unshift(insertedRecord);
          } else if (activeTableName === 'orders') {
            data.sqlite.orders = data.sqlite.orders || [];
            data.sqlite.orders.unshift(insertedRecord);
          }
        }

        closeInsertModal();

        // DYNAMIC COUNTERS: Update sidebar counts and dashboard stats immediately in the DOM
        renderNav();
        renderStats();
        renderTableRows(document.getElementById('search-input')?.value || '');
        showFeedback('নতুন রেকর্ড সফলভাবে তৈরি ও সংরক্ষণ করা হয়েছে! (SQLite ও db.json উভয় স্টোরেজ আপডেট সম্পন্ন)', 'success');
      } catch (err) {
        console.error('Insert error:', err);
        const msg = err.message.includes('Failed to fetch')
          ? 'সার্ভারে সংযোগ ব্যর্থ (Failed to fetch)। নিশ্চিত করুন ব্যাকএন্ড সার্ভার চালু রয়েছে (npm start) এবং ' + API_BASE + ' সচল আছে।'
          : 'রেকর্ড তৈরিতে ত্রুটি: ' + err.message;
        showFeedback(msg, 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-check"></i> রেকর্ড সংরক্ষণ করুন (Save Record)';
      }
    }

    /* ========================================================
     * UPDATE: Inline Row Editing Logic
     * ======================================================== */
    function startEdit(rowId) {
      editingRowId = rowId;
      deletingRowId = null;
      const records = (activeSource === 'sqlite' ? data.sqlite[activeTableName] : data.json[activeTableName]) || [];
      const row = records.find(r => r.id === rowId);
      editFormData = row ? { ...row } : {};
      renderTableRows(document.getElementById('search-input')?.value || '');
    }

    function cancelEdit() {
      editingRowId = null;
      editFormData = {};
      renderTableRows(document.getElementById('search-input')?.value || '');
    }

    function handleFieldChange(col, val) {
      editFormData[col] = val;
    }

    async function saveRow(rowId) {
      const tableKey = activeSource === 'sqlite' ? activeTableName : 'json:' + activeTableName;
      showFeedback('সংরক্ষণ হচ্ছে...', 'info');

      try {
        const res = await fetch(\`\${API_BASE}/api/admin/db/record/\${tableKey}/\${encodeURIComponent(rowId)}\`, {
          method: 'PUT',
          headers: AUTH_HEADERS,
          body: JSON.stringify({ updates: editFormData })
        });

        const resData = await res.json();
        if (!res.ok || !resData.success) {
          throw new Error(resData.error || 'সংরক্ষণ ব্যর্থ হয়েছে');
        }

        // Update in-memory data ONLY after confirmed backend response
        const records = (activeSource === 'sqlite' ? data.sqlite[activeTableName] : data.json[activeTableName]) || [];
        const idx = records.findIndex(r => r.id === rowId);
        if (idx !== -1) {
          records[idx] = resData.record || { ...records[idx], ...editFormData };
        }

        editingRowId = null;
        editFormData = {};
        showFeedback('সফলভাবে সংরক্ষিত হয়েছে! backend storage ও db.json-এ ডাটা আপডেট নিশ্চিত।', 'success');
        renderTableRows(document.getElementById('search-input')?.value || '');
        renderStats();
      } catch (err) {
        console.error('Save error:', err);
        const msg = err.message.includes('Failed to fetch')
          ? 'সার্ভারে সংযোগ ব্যর্থ (Failed to fetch)। নিশ্চিত করুন ব্যাকএন্ড সার্ভার চালু রয়েছে (npm start) এবং ' + API_BASE + ' সচল আছে।'
          : 'সংরক্ষণ ত্রুটি: ' + err.message;
        showFeedback(msg, 'error');
      }
    }

    /* ========================================================
     * DELETE: Row Deletion Logic with Dynamic Counter Updates
     * ======================================================== */
    function confirmDeleteRow(rowId) {
      deletingRowId = rowId;
      editingRowId = null;
      renderTableRows(document.getElementById('search-input')?.value || '');
    }

    function cancelDeleteRow() {
      deletingRowId = null;
      renderTableRows(document.getElementById('search-input')?.value || '');
    }

    async function executeDeleteRow(rowId) {
      const tableKey = activeSource === 'sqlite' ? activeTableName : 'json:' + activeTableName;
      showFeedback('মুছে ফেলা হচ্ছে...', 'info');

      try {
        const res = await fetch(\`\${API_BASE}/api/admin/db/record/\${tableKey}/\${encodeURIComponent(rowId)}\`, {
          method: 'DELETE',
          headers: AUTH_HEADERS
        });

        const resData = await res.json();
        if (!res.ok || !resData.success) {
          throw new Error(resData.error || 'মুছে ফেলা ব্যর্থ হয়েছে');
        }

        // Remove from in-memory cache ONLY after confirmed 200 response from backend
        if (activeSource === 'sqlite') {
          data.sqlite[activeTableName] = (data.sqlite[activeTableName] || []).filter(r => r.id !== rowId);
          if (activeTableName === 'users' && data.json.users) {
            data.json.users = data.json.users.filter(r => r.id !== rowId);
          } else if (activeTableName === 'products' && data.json.crops) {
            data.json.crops = data.json.crops.filter(r => r.id !== rowId);
          } else if (activeTableName === 'orders' && data.json.orders) {
            data.json.orders = data.json.orders.filter(r => r.id !== rowId);
          }
        } else {
          data.json[activeTableName] = (data.json[activeTableName] || []).filter(r => r.id !== rowId);
          if (activeTableName === 'users' && data.sqlite.users) {
            data.sqlite.users = data.sqlite.users.filter(r => r.id !== rowId);
          } else if (activeTableName === 'crops' && data.sqlite.products) {
            data.sqlite.products = data.sqlite.products.filter(r => r.id !== rowId);
          } else if (activeTableName === 'orders' && data.sqlite.orders) {
            data.sqlite.orders = data.sqlite.orders.filter(r => r.id !== rowId);
          }
        }

        deletingRowId = null;

        // DYNAMIC COUNTERS: Update sidebar counts and dashboard stats immediately in the DOM
        renderNav();
        renderStats();
        renderTableRows(document.getElementById('search-input')?.value || '');
        showFeedback('রেকর্ড সফলভাবে মুছে ফেলা হয়েছে (SQLite ও JSON উভয় স্টোরেজে স্থায়ীভাবে আপডেট সম্পন্ন)', 'success');
      } catch (err) {
        console.error('Delete error:', err);
        const msg = err.message.includes('Failed to fetch')
          ? 'সার্ভারে সংযোগ ব্যর্থ (Failed to fetch)। নিশ্চিত করুন ব্যাকএন্ড সার্ভার চালু রয়েছে (npm start) এবং ' + API_BASE + ' সচল আছে।'
          : 'মুছে ফেলতে ত্রুটি: ' + err.message;
        showFeedback(msg, 'error');
      }
    }

    function showFeedback(msg, type) {
      const el = document.getElementById('feedback-alert');
      el.className = "rounded-xl p-3.5 text-xs font-semibold border flex items-center gap-2.5 transition-all " +
        (type === 'success' ? 'bg-emerald-950/80 text-emerald-300 border-emerald-600' :
         type === 'error' ? 'bg-rose-950/80 text-rose-300 border-rose-600' :
         'bg-blue-950/80 text-blue-300 border-blue-600');
      el.innerHTML = \`<i class="fa-solid \${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-triangle-exclamation' : 'fa-circle-info'}"></i> <span>\${msg}</span>\`;
      el.classList.remove('hidden');
      if (type === 'success') {
        setTimeout(() => el.classList.add('hidden'), 5000);
      }
    }

    function renderTableRows(filterQuery = '') {
      const records = (activeSource === 'sqlite' ? data.sqlite[activeTableName] : data.json[activeTableName]) || [];
      const thead = document.getElementById('table-head');
      const tbody = document.getElementById('table-body');
      const countSpan = document.getElementById('active-table-count');

      thead.innerHTML = '';
      tbody.innerHTML = '';

      if (!records || records.length === 0) {
        countSpan.innerText = '0 records';
        tbody.innerHTML = '<tr><td colspan="10" class="text-center py-12 text-slate-500">কোনো তথ্য নেই (No records found)</td></tr>';
        return;
      }

      const q = filterQuery.toLowerCase().trim();
      const filtered = q ? records.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(q))) : records;
      countSpan.innerText = \`\${filtered.length} of \${records.length} records\`;

      const columns = Object.keys(records[0] || {});
      const headRow = document.createElement('tr');
      headRow.innerHTML = '<th class="p-3 text-slate-400 w-32 text-center">অ্যাকশন (Actions)</th><th class="p-3 text-slate-500 w-10">#</th>';
      columns.forEach(col => {
        headRow.innerHTML += \`<th class="p-3 whitespace-nowrap">\${col}</th>\`;
      });
      thead.appendChild(headRow);

      if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="' + (columns.length + 2) + '" class="text-center py-12 text-slate-500">খোঁজ অনুযায়ী কোনো রেকর্ড পাওয়া যায়নি</td></tr>';
        return;
      }

      const lockedCols = new Set(['id', 'created_at', 'createdAt', 'password_hash', 'passwordHash', 'sessionToken']);

      filtered.forEach((row, idx) => {
        const tr = document.createElement('tr');
        const isEditing = editingRowId === row.id;
        const isDeleting = deletingRowId === row.id;

        tr.className = isEditing 
          ? "bg-emerald-950/40 border border-emerald-600/50" 
          : isDeleting 
            ? "bg-rose-950/40 border border-rose-600/50" 
            : "hover:bg-slate-800/40 transition-colors";

        let actionsHtml = '';
        if (isEditing) {
          actionsHtml = \`<td class="p-2 whitespace-nowrap text-center">
            <button onclick="saveRow('\${row.id}')" class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-bold mr-1 shadow cursor-pointer">
              <i class="fa-solid fa-floppy-disk mr-1"></i> সেভ
            </button>
            <button onclick="cancelEdit()" class="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded text-[11px] cursor-pointer">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </td>\`;
        } else if (isDeleting) {
          actionsHtml = \`<td class="p-2 whitespace-nowrap text-center">
            <button onclick="executeDeleteRow('\${row.id}')" class="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-[11px] font-bold mr-1 shadow animate-pulse cursor-pointer">
              নিশ্চিত?
            </button>
            <button onclick="cancelDeleteRow()" class="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded text-[11px] cursor-pointer">
              না
            </button>
          </td>\`;
        } else {
          actionsHtml = \`<td class="p-2 whitespace-nowrap text-center space-x-1">
            <button onclick="startEdit('\${row.id}')" class="px-2.5 py-1 bg-slate-800 hover:bg-emerald-600/80 text-slate-300 hover:text-white rounded text-[11px] font-medium border border-slate-700 hover:border-emerald-500 transition-colors cursor-pointer" title="রেকর্ড এডিট করুন">
              <i class="fa-solid fa-pen mr-1"></i> এডিট
            </button>
            <button onclick="confirmDeleteRow('\${row.id}')" class="px-2 py-1 bg-slate-800 hover:bg-rose-950 hover:text-rose-400 text-slate-400 rounded text-[11px] border border-slate-700 hover:border-rose-700 transition-colors cursor-pointer" title="মুছে ফেলুন">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </td>\`;
        }

        let rowHtml = actionsHtml + \`<td class="p-3 text-slate-500 font-mono">\${idx + 1}</td>\`;

        columns.forEach(col => {
          const isLocked = lockedCols.has(col);
          let currentVal = isEditing ? editFormData[col] : row[col];

          if (isEditing && !isLocked) {
            const isNumeric = typeof row[col] === 'number' || col.includes('price') || col.includes('kg') || col.includes('acres') || col.includes('amount') || col.includes('rate') || col.includes('total');
            rowHtml += \`<td class="p-1.5">
              <input
                type="\${isNumeric ? 'number' : 'text'}"
                value="\${currentVal !== undefined && currentVal !== null ? currentVal : ''}"
                onchange="handleFieldChange('\${col}', this.type === 'number' ? Number(this.value) : this.value)"
                class="bg-slate-800 border border-emerald-500 rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-400 w-full min-w-[90px]"
              />
            </td>\`;
          } else {
            let val = row[col];
            if (col === 'password_hash' || col === 'passwordHash') {
              val = '<span class="text-slate-600">[PROTECTED HASH]</span>';
            } else if (val === null || val === undefined) {
              val = '<span class="text-slate-600">—</span>';
            } else if (typeof val === 'boolean') {
              val = val ? '<span class="text-emerald-400 font-bold">✓ True</span>' : '<span class="text-rose-400">✗ False</span>';
            } else if (typeof val === 'object') {
              val = \`<span class="font-mono text-[10px] text-slate-400">\${JSON.stringify(val).slice(0, 50)}...</span>\`;
            } else {
              val = String(val);
              if (col === 'role') {
                val = \`<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-emerald-400 border border-slate-700">\${val}</span>\`;
              }
            }
            rowHtml += \`<td class="p-3 max-w-xs truncate" title="\${String(row[col] ?? '')}">\${val}</td>\`;
          }
        });

        tr.innerHTML = rowHtml;
        tbody.appendChild(tr);
      });
    }

    function filterCurrentTable() {
      const q = document.getElementById('search-input')?.value || '';
      renderTableRows(q);
    }

    init();
  </script>
</body>
</html>`;

fs.writeFileSync(outputPath, html, 'utf8');
console.log('✓ Successfully generated database_viewer.html with CORS, dynamic counters, and live API sync at:', outputPath);
