const fs = require('fs');
const path = require('path');

const p = path.resolve(__dirname, '..', 'NativeBazar', 'src', 'components', 'UserProfilePage.tsx');
let c = fs.readFileSync(p, 'utf8');
c = c.replace(
  'const handleConnectToggle = () => {',
  'const handleConnectToggle = () => {\n    if (!currentUser) return;'
);
fs.writeFileSync(p, c, 'utf8');
console.log('✓ UserProfilePage.tsx handleConnectToggle fixed');

const m = path.resolve(__dirname, '..', 'NativeBazar', 'src', 'data', 'mockData.ts');
let mc = fs.readFileSync(m, 'utf8');

// Match admin entry in DEMO_CREDENTIALS
mc = mc.replace(
  /admin:\s*\{[\s\S]*?securityNoteBn:\s*'প্ল্যাটফর্মের কেন্দ্রীয় মনিটরিং ও কন্ট্রোল প্যানেল।',\s*\},/,
  `admin: {
    phone: 'NativeBazarSJS',
    email: 'NativeBazarSJS',
    password: '12345678',
    education: 'M.Sc in Computer Science & Cyber Security (DU)',
    roleLabelEn: 'Central Admin (প্ল্যাটফর্ম অ্যাডমিন)',
    roleLabelBn: 'অ্যাডমিন',
    securityNoteEn: 'Direct platform administrative governance control.',
    securityNoteBn: 'প্ল্যাটফর্মের কেন্দ্রীয় মনিটরিং ও কন্ট্রোল প্যানেল।',
  },
  wholesaler: {
    phone: '01711209934',
    email: 'nurul.alam@karwanbazar.com',
    password: 'AratTrade$2026@Alam',
    education: 'Bachelor of Business Administration (BBA) - Dhaka University',
    roleLabelEn: 'Wholesaler (পাইকার / আড়তদার)',
    roleLabelBn: 'পাইকার',
    securityNoteEn: 'Forward procurement contract lock & bulk arat order tracking.',
    securityNoteBn: 'পাইকারি ক্রয় চুক্তি ও আড়ত বাল্ক অর্ডার ট্র্যাকিং।',
  },
  retailer: {
    phone: '01715889900',
    email: 'meghna.depot@nativebazar.com',
    password: 'Fertilizer#9900!Depot',
    education: 'B.Sc in Chemistry & Agro-Chemical Science',
    roleLabelEn: 'Retailer (খুচরা বিক্রেতা)',
    roleLabelBn: 'খুচরা বিক্রেতা',
    securityNoteEn: 'Retail procurement from wholesaler and sales to consumer.',
    securityNoteBn: 'পাইকার থেকে ক্রয় ও ভোক্তাদের কাছে খুচরা বিক্রি।',
  },
  consumer: {
    phone: '01719998877',
    email: 'anika.chowdhury@gmail.com',
    password: 'Consumer#2026@Anika',
    education: 'Master of Science (M.Sc) - North South University',
    roleLabelEn: 'Consumer (ভোক্তা / ক্রেতা)',
    roleLabelBn: 'ভোক্তা',
    securityNoteEn: 'Fresh retail produce purchases directly from retailers.',
    securityNoteBn: 'খুচরা বিক্রেতাদের কাছ থেকে সরাসরি নিরাপদ খাদ্য ক্রয়।',
  },`
);
fs.writeFileSync(m, mc, 'utf8');
console.log('✓ mockData.ts DEMO_CREDENTIALS fixed');

