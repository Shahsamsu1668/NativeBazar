const fs = require('fs');
const path = require('path');

const serverFile = path.resolve(__dirname, '..', 'server.ts');
let content = fs.readFileSync(serverFile, 'utf8');

// 1. Add rateLimit import
if (!content.includes("import rateLimit from 'express-rate-limit';")) {
  content = content.replace(
    "import cookieParser from 'cookie-parser';",
    "import cookieParser from 'cookie-parser';\nimport rateLimit from 'express-rate-limit';"
  );
  console.log('Added rateLimit import to server.ts');
}

// 2. Add rate limiters configuration and app.use calls
const targetPlacement = "app.use(cookieParser());";
const rateLimitCode = `app.use(cookieParser());

// ─── EXPRESS RATE LIMITING MIDDLEWARES ─────────────────────────────────────────

// Strict limiter for authentication endpoints (prevents brute-force credential stuffing)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes window
  max: 20, // Max 20 authentication attempts per IP per 15 minutes
  standardHeaders: true, // Return standard RateLimit-* headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
  validate: { trustProxy: false },
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'Too many authentication attempts. Please try again after 15 minutes.',
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
    });
  },
});

// AI endpoints limiter (protects Gemini API quota and prevents denial-of-wallet)
export const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 30, // Max 30 AI queries per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'AI query rate limit reached. Please wait a moment before trying again.',
      code: 'AI_RATE_LIMIT_EXCEEDED',
    });
  },
});

// Product endpoints limiter (protects inventory queries, mutations, and scraping)
export const productsLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 120, // Max 120 product requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'Too many product requests. Please slow down.',
      code: 'PRODUCT_RATE_LIMIT_EXCEEDED',
    });
  },
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/ai', aiLimiter);
app.use('/api/products', productsLimiter);`;

if (!content.includes('authLimiter = rateLimit')) {
  content = content.replace(targetPlacement, rateLimitCode);
  console.log('Configured rate limiters in server.ts');
}

fs.writeFileSync(serverFile, content, 'utf8');
console.log('Successfully patched server.ts with express-rate-limit!');

