const fs = require('fs');

const serverFile = 'server.ts';
let code = fs.readFileSync(serverFile, 'utf8');

const marker1Start = '// ─── WHOLESALER BIDS & FARMER INTELLIGENCE (FARMER-ONLY) ─────────────────────';
const marker1End = '// Admin Metrics & System Overview';

const idx1Start = code.indexOf(marker1Start);
const idx1End = code.indexOf(marker1End);

console.log('Marker 1 Start:', idx1Start);
console.log('Marker 1 End:', idx1End);

const marker2Start = '// ─── DIRECT MESSAGING REST APIS ─────────────────────────────────────────────';
const marker2End = '// ─── AUTH LOGOUT REST API ───────────────────────────────────────────────────';

const idx2Start = code.indexOf(marker2Start);
const idx2End = code.indexOf(marker2End);

console.log('Marker 2 Start:', idx2Start);
console.log('Marker 2 End:', idx2End);
