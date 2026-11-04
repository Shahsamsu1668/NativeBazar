const fs = require('fs');
const path = require('path');

const targetFile = path.resolve(__dirname, '..', 'src', 'components', 'FarmerDashboard.tsx');
let content = fs.readFileSync(targetFile, 'utf8');

// Replace the entire loadFarmerExpenses function
const oldFnRegex = /\/\/ Load Wholesale Orders received from Wholesalers\s*const loadFarmerExpenses = async \(\) => \{[\s\S]*?\n  \};\n\n  const loadReceivedOrders/;

const newFn = `// Load Farmer Expenses / Financial Ledger
  const loadFarmerExpenses = async () => {
    const localEntries = ExpenseStore.getAll().filter((e) => e.farmerId === currentUser.id);
    try {
      // 1. Authenticated, idempotent sync of unmigrated local expenses
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
    } catch (err) {
      console.warn('Failed to load farmer expenses from server; utilizing local offline ledger entries', err);
      // Bounded offline fallback: preserve existing local entries without repeating network requests
      setLedgerEntries(localEntries);
    }
  };

  const loadReceivedOrders`;

if (!oldFnRegex.test(content)) {
  console.error('Failed to match old loadFarmerExpenses regex');
  process.exit(1);
}

content = content.replace(oldFnRegex, newFn);

// Add loadFarmerExpenses() to useEffect
const oldEffectRegex = /(setLedgerEntries\(ExpenseStore\.getAll\(\)\.filter\(\(e\) => e\.farmerId === currentUser\.id\)\);)/;
if (oldEffectRegex.test(content) && !content.includes('loadFarmerExpenses();\r\n  }, [currentUser.id') && !content.includes('loadFarmerExpenses();\n  }, [currentUser.id')) {
  content = content.replace(oldEffectRegex, `$1\r\n    loadFarmerExpenses();`);
  console.log('Added loadFarmerExpenses() call to useEffect');
}

fs.writeFileSync(targetFile, content, 'utf8');
console.log('Successfully updated FarmerDashboard.tsx with scoped localEntries and bounded catch block!');
