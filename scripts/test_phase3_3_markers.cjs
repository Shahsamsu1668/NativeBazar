const fs = require('fs');

const serverFile = 'server.ts';
const code = fs.readFileSync(serverFile, 'utf8');

// Marker 1: Reviews and Catalog
const m1Start = '// Verified Buyer Review Submission (Allowed ONLY on Delivered Orders)';
const m1End = '// ─── REAL-TIME SSE (SERVER-SENT EVENTS) ENGINE ──────────────────────────────';

const idx1Start = code.indexOf(m1Start);
const idx1End = code.indexOf(m1End);

console.log('Marker 1 Start:', idx1Start);
console.log('Marker 1 End:', idx1End);

// Marker 2: Call Logs
const m2Start = 'app.get(\'/api/calls/logs\'';
const m2End = '// ─── ALL 64 BANGLADESH DISTRICTS REAL WEATHER ENGINE ────────────────────────';

const idx2Start = code.indexOf(m2Start);
const idx2End = code.indexOf(m2End);

console.log('Marker 2 Start:', idx2Start);
console.log('Marker 2 End:', idx2End);

