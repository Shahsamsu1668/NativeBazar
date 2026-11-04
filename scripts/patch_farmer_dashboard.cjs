const fs = require('fs');

const file = 'src/components/FarmerDashboard.tsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Add apiService import if not present
if (!code.includes("import { apiService }")) {
  code = code.replace(
    "import { ExpenseStore, NotificationStore } from '../data/store';",
    "import { apiService } from '../services/apiService';\nimport { ExpenseStore, NotificationStore } from '../data/store';"
  );
}

// 2. Add loadFarmerExpenses function and call it in useEffect
const targetLoad = `  const loadReceivedOrders = async () => {`;
const newFunction = `  const loadFarmerExpenses = async () => {
    try {
      // 1. Authenticated, idempotent sync of unmigrated local expenses
      const localEntries = ExpenseStore.getAll().filter((e) => e.farmerId === currentUser.id);
      if (localEntries.length > 0) {
        await apiService.syncFarmerExpenses(localEntries).catch(() => {});
      }
      // 2. Fetch authoritative state from Neon
      const res = await apiService.getFarmerExpenses();
      if (res && res.success && Array.isArray(res.expenses)) {
        setLedgerEntries(res.expenses);
        ExpenseStore.syncWithServer(res.expenses);
      } else {
        setLedgerEntries(localEntries);
      }
    } catch {
      setLedgerEntries(ExpenseStore.getAll().filter((e) => e.farmerId === currentUser.id));
    }
  };

  const loadReceivedOrders = async () => {`;

if (!code.includes('loadFarmerExpenses = async')) {
  code = code.replace(targetLoad, newFunction);
}

// 3. Update useEffect to call loadFarmerExpenses
code = code.replace(
  "setLedgerEntries(ExpenseStore.getAll().filter((e) => e.farmerId === currentUser.id));",
  "loadFarmerExpenses();"
);

// 4. Update handleAddLedgerEntry
const oldAdd = `  const handleAddLedgerEntry = (e: React.FormEvent) => {
    e.preventDefault();
    const entry: ExpenseLedgerEntry = {
      id: \`ledger-\${Date.now()}\`,
      farmerId: currentUser.id,
      ...ledgerForm,
    };
    ExpenseStore.add(entry);
    setShowLedgerModal(false);
    setLedgerForm({
      type: 'expense',
      category: 'Fertilizer',
      description: '',
      amountBDT: 0,
      date: new Date().toISOString().split('T')[0],
    });
    setLedgerEntries(ExpenseStore.getAll().filter((entry) => entry.farmerId === currentUser.id));
  };`;

const newAdd = `  const handleAddLedgerEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    const entryPayload = {
      ...ledgerForm,
      farmerId: currentUser.id,
    };
    try {
      const res = await apiService.addFarmerExpense(entryPayload);
      if (res && (res as any).success && (res as any).expense) {
        const newExp = (res as any).expense;
        setLedgerEntries((prev) => [newExp, ...prev]);
        ExpenseStore.add(newExp);
      } else {
        throw new Error('API creation failed');
      }
    } catch {
      const fallbackEntry: ExpenseLedgerEntry = {
        id: \`ledger-\${Date.now()}\`,
        farmerId: currentUser.id,
        ...ledgerForm,
      };
      ExpenseStore.add(fallbackEntry);
      setLedgerEntries((prev) => [fallbackEntry, ...prev]);
    }
    setShowLedgerModal(false);
    setLedgerForm({
      type: 'expense',
      category: 'Fertilizer',
      description: '',
      amountBDT: 0,
      date: new Date().toISOString().split('T')[0],
    });
  };`;

code = code.replace(oldAdd, newAdd);

fs.writeFileSync(file, code, 'utf8');
console.log('Successfully patched FarmerDashboard.tsx with Neon expense sync & add!');

