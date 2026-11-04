const fs = require('fs');
const path = require('path');

const jsonDb = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'server_data', 'db.json'), 'utf8'));

console.log('JSON DB keys:', Object.keys(jsonDb));
console.log('callLogs length:', jsonDb.callLogs ? jsonDb.callLogs.length : 'missing');

// Check call log schema in server/db.ts
const serverDbTs = fs.readFileSync(path.resolve(__dirname, '..', 'server', 'db.ts'), 'utf8');
const callLogMatch = serverDbTs.match(/export interface CallLogRecord \{[\s\S]*?\}/);
console.log('CallLogRecord interface:');
console.log(callLogMatch ? callLogMatch[0] : 'not found');

// Check calls API endpoints in server.ts
const serverTs = fs.readFileSync(path.resolve(__dirname, '..', 'NativeBazar', 'server.ts'), 'utf8');
const callEndpoints = serverTs.match(/app\.(get|post)\(['"`]\/api\/calls[\s\S]*?\}\);/g);
console.log('\nCall endpoints found in server.ts:', callEndpoints ? callEndpoints.length : 0);
if (callEndpoints) {
  for (const ep of callEndpoints) {
    console.log(ep.slice(0, 120) + '...\n');
  }
}

