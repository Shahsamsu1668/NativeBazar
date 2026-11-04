const http = require('http');

http.get('http://localhost:5178/NativeBazar/', (res) => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    console.log('Status /NativeBazar/:', res.statusCode);
    console.log('Body Length:', d.length);
  });
});

http.get('http://localhost:5178/NativeBazar/@vite/client', (res) => {
  console.log('Status /NativeBazar/@vite/client:', res.statusCode);
});

