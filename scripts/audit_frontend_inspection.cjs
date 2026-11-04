const fs = require('fs');

console.log('=== AUDIT: Frontend API & Fallback Inspection ===');

// Check ContactsView.tsx
const cv = fs.readFileSync('src/components/ContactsView.tsx', 'utf8');
console.log('ContactsView uses apiService.getMessages:', cv.includes('apiService.getMessages'));
console.log('ContactsView uses apiService.sendMessage:', cv.includes('apiService.sendMessage'));
console.log('ContactsView uses apiService.markMessagesRead:', cv.includes('apiService.markMessagesRead'));
console.log('ContactsView uses apiService.sendConnectionRequest:', cv.includes('apiService.sendConnectionRequest'));
console.log('ContactsView uses apiService.updateConnectionStatus:', cv.includes('apiService.updateConnectionStatus'));
console.log('ContactsView uses apiService.deleteConnection:', cv.includes('apiService.deleteConnection'));

// Check how fallback is handled when apiService fails in ContactsView
const fallbackCheck = cv.match(/catch\s*\{[\s\S]*?MessageStore[\s\S]*?\}/g);
console.log('ContactsView Message fallback catch blocks:', fallbackCheck ? fallbackCheck.length : 0);

// Check WholesalerDashboard.tsx
const wd = fs.readFileSync('src/components/WholesalerDashboard.tsx', 'utf8');
console.log('WholesalerDashboard uses intelligenceApi.createWholesalerOffer:', wd.includes('intelligenceApi.createWholesalerOffer'));

// Check MarketRatesView.tsx
const mrv = fs.readFileSync('src/components/MarketRatesView.tsx', 'utf8');
console.log('MarketRatesView uses MarketRateStore:', mrv.includes('MarketRateStore'));
console.log('MarketRatesView uses INITIAL_MARKET_RATES:', mrv.includes('INITIAL_MARKET_RATES'));

// Check Header.tsx
const hd = fs.readFileSync('src/components/Header.tsx', 'utf8');
console.log('Header uses NotificationStore:', hd.includes('NotificationStore'));

