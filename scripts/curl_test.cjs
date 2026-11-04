const http = require('http');

http.get('http://localhost:5178/', (res) => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Headers:', res.headers);
    console.log('Body Length:', d.length);
    console.log('Body Preview:', d.slice(0, 300));
  });
});

