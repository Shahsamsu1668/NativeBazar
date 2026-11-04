const fs = require('fs');
const path = require('path');

// 1. Update Header.tsx
function updateHeader() {
  let content = fs.readFileSync('src/components/Header.tsx', 'utf8');
  
  const legacyConfig = `  admin:       { icon: <ShieldCheck className="w-3.5 h-3.5" />,  color: 'text-slate-800',   labelEn: 'Admin',       labelBn: 'অ্যাডমিন',      badgeBg: 'bg-slate-200 text-slate-800 border-slate-300' },
  businessman: { icon: <Briefcase className="w-3.5 h-3.5" />,    color: 'text-blue-700',    labelEn: 'Wholesaler',   labelBn: 'পাইকার',        badgeBg: 'bg-blue-100 text-blue-800 border-blue-200' },
  supplier:    { icon: <Store className="w-3.5 h-3.5" />,        color: 'text-amber-700',   labelEn: 'Retailer',     labelBn: 'খুচরা বিক্রেতা', badgeBg: 'bg-amber-100 text-amber-800 border-amber-200' },
  customer:    { icon: <ShoppingCart className="w-3.5 h-3.5" />, color: 'text-purple-700',  labelEn: 'Consumer',     labelBn: 'ভোক্তা',        badgeBg: 'bg-purple-100 text-purple-800 border-purple-200' },
  expert:      { icon: <Microscope className="w-3.5 h-3.5" />,   color: 'text-teal-700',    labelEn: 'Agri Expert', labelBn: 'কৃষি বিশেষজ্ঞ', badgeBg: 'bg-teal-100 text-teal-800 border-teal-200' },
};`;

  content = content.replace(/admin:\s+\{[^\}]+\},\s*\};/, legacyConfig);
  fs.writeFileSync('NativeBazar/src/components/Header.tsx', content, 'utf8');
  console.log('✓ NativeBazar/src/components/Header.tsx updated');
}

updateHeader();

