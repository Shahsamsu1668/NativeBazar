const fs = require('fs');
const content = fs.readFileSync('src/data/store.ts', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
  if (line.includes('MarketRateStore') || line.includes('NotificationStore') || line.includes('MessageStore') || line.includes('ConnectionStore')) {
    console.log(`L${i+1}: ${line.trim().slice(0, 100)}`);
  }
});

