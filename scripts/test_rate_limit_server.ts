import express from 'express';
import rateLimit from 'express-rate-limit';

const app = express();

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
  handler: (req, res) => {
    res.status(429).json({ success: false, error: 'Rate limit exceeded' });
  }
});

app.use('/test', limiter);
app.get('/test', (req, res) => res.json({ success: true }));

const server = app.listen(0, async () => {
  const addr = server.address() as any;
  const port = addr.port;
  console.log('Testing rate limit on port', port);
  let got429 = false;
  for (let i = 0; i < 7; i++) {
    const res = await fetch(`http://127.0.0.1:${port}/test`);
    const data = await res.json();
    console.log(`Req ${i+1}: status=${res.status}, data=`, data);
    if (res.status === 429) got429 = true;
  }
  server.close();
  console.log('Result got429:', got429);
});

