const fs = require('fs');
const content = fs.readFileSync('src/components/Header.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
  if (line.includes('NotificationStore') || line.includes('Notification') || line.includes('apiService') || line.includes('/api/notifications')) {
    if (i < 80 || line.includes('get') || line.includes('fetch') || line.includes('read') || line.includes('mark')) {
      console.log(`L${i+1}: ${line.trim().slice(0, 100)}`);
    }
  }
});

