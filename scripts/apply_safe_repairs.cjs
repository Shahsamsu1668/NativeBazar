const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const INNER = path.join(ROOT, 'NativeBazar');

console.log('Applying safe repairs...');

// 1. Copy AdminDbViewer.tsx
fs.copyFileSync(
  path.join(ROOT, 'src', 'components', 'AdminDbViewer.tsx'),
  path.join(INNER, 'src', 'components', 'AdminDbViewer.tsx')
);
console.log('✓ AdminDbViewer.tsx copied');

// 2. Copy AdminDashboard.tsx
fs.copyFileSync(
  path.join(ROOT, 'src', 'components', 'AdminDashboard.tsx'),
  path.join(INNER, 'src', 'components', 'AdminDashboard.tsx')
);
console.log('✓ AdminDashboard.tsx updated');

// 3. Copy CustomerMarketplace.tsx
fs.copyFileSync(
  path.join(ROOT, 'src', 'components', 'CustomerMarketplace.tsx'),
  path.join(INNER, 'src', 'components', 'CustomerMarketplace.tsx')
);
console.log('✓ CustomerMarketplace.tsx updated');

// 4. Copy OrdersView.tsx
fs.copyFileSync(
  path.join(ROOT, 'src', 'components', 'OrdersView.tsx'),
  path.join(INNER, 'src', 'components', 'OrdersView.tsx')
);
console.log('✓ OrdersView.tsx updated');

// 5. Breadcrumbs.tsx
let breadcrumbs = fs.readFileSync(path.join(INNER, 'src', 'components', 'Breadcrumbs.tsx'), 'utf8');
if (!breadcrumbs.includes('bulletins:')) {
  breadcrumbs = breadcrumbs.replace(
    /contacts:\s*\{\s*en:\s*'Contacts & Messaging',\s*bn:\s*'যোগাযোগ ও বার্তা'\s*\},/,
    `contacts: { en: 'Contacts & Messaging', bn: 'যোগাযোগ ও বার্তা' },\n  bulletins: { en: 'Weather & Bulletins', bn: 'বুলেটিন ও পূর্বাভাস' },`
  );
}
if (!breadcrumbs.includes('wholesaler:')) {
  breadcrumbs = breadcrumbs.replace(
    /admin:\s*\{\s*en:\s*'Central Admin Telemetry',\s*bn:\s*'প্রশাসন কন্ট্রোল সেন্টার'\s*\},/,
    `admin: { en: 'Central Admin Telemetry', bn: 'প্রশাসন কন্ট্রোল সেন্টার' },
  wholesaler: { en: 'Wholesale Buyer Hub', bn: 'পাইকারি ট্রেডার হাব' },
  retailer: { en: 'Agro Retailer Hub', bn: 'খুচরা বিক্রেতা হাব' },
  consumer: { en: 'Consumer Purchases', bn: 'ভোক্তার ক্রয়' },`
  );
}
fs.writeFileSync(path.join(INNER, 'src', 'components', 'Breadcrumbs.tsx'), breadcrumbs, 'utf8');
console.log('✓ Breadcrumbs.tsx updated');

// 6. CallModal.tsx
let callModal = fs.readFileSync(path.join(INNER, 'src', 'components', 'CallModal.tsx'), 'utf8');
if (!callModal.includes('wholesaler:')) {
  callModal = callModal.replace(
    /admin:\s*<ShieldCheck className="w-3\.5 h-3\.5" \/>,/,
    `admin: <ShieldCheck className="w-3.5 h-3.5" />,
  wholesaler: <Briefcase className="w-3.5 h-3.5" />,
  retailer: <Store className="w-3.5 h-3.5" />,
  consumer: <ShoppingCart className="w-3.5 h-3.5" />,`
  );
  callModal = callModal.replace(
    /admin:\s*\{\s*en:\s*'Platform Admin',\s*bn:\s*'অ্যাডমিন'\s*\},/,
    `admin: { en: 'Platform Admin', bn: 'অ্যাডমিন' },
  wholesaler: { en: 'Wholesaler', bn: 'পাইকার' },
  retailer: { en: 'Retailer', bn: 'খুচরা বিক্রেতা' },
  consumer: { en: 'Consumer', bn: 'ভোক্তা' },`
  );
  fs.writeFileSync(path.join(INNER, 'src', 'components', 'CallModal.tsx'), callModal, 'utf8');
}
console.log('✓ CallModal.tsx updated');

// 7. ContactsView.tsx
let contactsView = fs.readFileSync(path.join(INNER, 'src', 'components', 'ContactsView.tsx'), 'utf8');
if (!contactsView.includes('wholesaler:')) {
  contactsView = contactsView.replace(
    /admin:\s*\{\s*labelEn:\s*'Admin',[\s\S]*?icon:\s*<ShieldCheck className="w-3\.5 h-3\.5" \/>,\s*\},/,
    `admin: {
    labelEn: 'Admin',
    labelBn: 'অ্যাডমিন',
    color: 'text-slate-700',
    badge: 'bg-slate-100 text-slate-800 border-slate-300',
    icon: <ShieldCheck className="w-3.5 h-3.5" />,
  },
  wholesaler: {
    labelEn: 'Wholesaler',
    labelBn: 'পাইকার',
    color: 'text-blue-700',
    badge: 'bg-blue-100 text-blue-800 border-blue-200',
    icon: <Briefcase className="w-3.5 h-3.5" />,
  },
  retailer: {
    labelEn: 'Retailer',
    labelBn: 'খুচরা বিক্রেতা',
    color: 'text-amber-700',
    badge: 'bg-amber-100 text-amber-800 border-amber-200',
    icon: <Store className="w-3.5 h-3.5" />,
  },
  consumer: {
    labelEn: 'Consumer',
    labelBn: 'ভোক্তা',
    color: 'text-purple-700',
    badge: 'bg-purple-100 text-purple-800 border-purple-200',
    icon: <ShoppingCart className="w-3.5 h-3.5" />,
  },`
  );

  contactsView = contactsView.replace(
    /admin:\s*\[[\s\S]*?bn:\s*'অ্যাকাউন্ট ভেরিফিকেশন সংক্রান্ত তথ্য জানতে চাই।'\s*\},?\s*\],/,
    `admin: [
    { en: 'Inquiry regarding account verification.', bn: 'অ্যাকাউন্ট ভেরিফিকেশন সংক্রান্ত তথ্য জানতে চাই।' },
  ],
  wholesaler: [
    { en: 'I am interested in your seasonal demand.', bn: 'আপনার মৌসুমী ক্রয়ের চাহিদায় আগ্রহী।' },
    { en: 'Can we arrange escrow payment for harvest contract?', bn: 'এসক্রো পেমেন্টে ফসল চুক্তি করা যাবে কি?' },
    { en: 'What is your required delivery schedule?', bn: 'ডেলিভারির নির্ধারিত সময়সূচী কি?' },
  ],
  retailer: [
    { en: 'What are the current retail products available?', bn: 'বর্তমানে কি কি পণ্য বিক্রির জন্য আছে?' },
    { en: 'What is the bulk price for retail stock?', bn: 'খুচরা চালানের জন্য দর কত?' },
  ],
  consumer: [
    { en: 'Is fresh farm delivery available today?', bn: 'আজকে কি সরাসরি ডেলিভারি পাওয়া যাবে?' },
    { en: 'What is the minimum order quantity?', bn: 'সর্বনিম্ন কত কেজি অর্ডার দেওয়া যাবে?' },
  ],`
  );
  fs.writeFileSync(path.join(INNER, 'src', 'components', 'ContactsView.tsx'), contactsView, 'utf8');
}
console.log('✓ ContactsView.tsx updated');

// 8. CreateRoleModal.tsx
let createRole = fs.readFileSync(path.join(INNER, 'src', 'components', 'CreateRoleModal.tsx'), 'utf8');
if (!createRole.includes('wholesaler:')) {
  createRole = createRole.replace(
    /admin:\s*\{\s*en:\s*'Admin',\s*bn:\s*'অ্যাডমিন',\s*icon:\s*<ShieldCheck className="w-5 h-5 text-slate-700" \/>\s*\},/,
    `admin: { en: 'Admin', bn: 'অ্যাডমিন', icon: <ShieldCheck className="w-5 h-5 text-slate-700" /> },
  wholesaler: { en: 'Wholesaler', bn: 'পাইকার / আড়তদার', icon: <Briefcase className="w-5 h-5 text-blue-600" /> },
  retailer: { en: 'Retailer', bn: 'খুচরা বিক্রেতা', icon: <Store className="w-5 h-5 text-amber-600" /> },
  consumer: { en: 'Consumer', bn: 'ভোক্তা / ক্রেতা', icon: <ShoppingCart className="w-5 h-5 text-purple-600" /> },`
  );
  fs.writeFileSync(path.join(INNER, 'src', 'components', 'CreateRoleModal.tsx'), createRole, 'utf8');
}
console.log('✓ CreateRoleModal.tsx updated');

// 9. NoRoleAccountModal.tsx
let noRole = fs.readFileSync(path.join(INNER, 'src', 'components', 'NoRoleAccountModal.tsx'), 'utf8');
if (!noRole.includes('wholesaler:')) {
  noRole = noRole.replace(
    /admin:\s*\{\s*en:\s*'Platform Administrator',[\s\S]*?color:\s*'slate'\s*\},/,
    `admin: { en: 'Platform Administrator', bn: 'প্ল্যাটফর্ম অ্যাডমিন', icon: <ShieldCheck className="w-5 h-5 text-slate-700" />, color: 'slate' },
  wholesaler: { en: 'Wholesaler / Trader', bn: 'পাইকার', icon: <Briefcase className="w-5 h-5 text-blue-600" />, color: 'blue' },
  retailer: { en: 'Retailer', bn: 'খুচরা বিক্রেতা', icon: <Store className="w-5 h-5 text-amber-600" />, color: 'amber' },
  consumer: { en: 'Consumer', bn: 'ভোক্তা / ক্রেতা', icon: <ShoppingCart className="w-5 h-5 text-purple-600" />, color: 'purple' },`
  );
  fs.writeFileSync(path.join(INNER, 'src', 'components', 'NoRoleAccountModal.tsx'), noRole, 'utf8');
}
console.log('✓ NoRoleAccountModal.tsx updated');

// 10. ProfileModal.tsx
let profileModal = fs.readFileSync(path.join(INNER, 'src', 'components', 'ProfileModal.tsx'), 'utf8');
if (!profileModal.includes('wholesaler:')) {
  // Update roleBadgeInfo
  profileModal = profileModal.replace(
    /admin:\s*\{\s*labelEn:\s*'Central Platform Administrator',[\s\S]*?icon:\s*<ShieldCheck className="w-3\.5 h-3\.5 text-slate-700" \/>,\s*\},/,
    `admin: {
      labelEn: 'Central Platform Administrator',
      labelBn: 'সিস্টেম অ্যাডমিনিস্ট্রেটর',
      color: 'bg-slate-200 text-slate-800 border-slate-300',
      icon: <ShieldCheck className="w-3.5 h-3.5 text-slate-700" />,
    },
    wholesaler: {
      labelEn: 'Wholesale Trader / Buyer',
      labelBn: 'ব্যবসায়ী ও পাইকার',
      color: 'bg-blue-100 text-blue-800 border-blue-300',
      icon: <Briefcase className="w-3.5 h-3.5 text-blue-700" />,
    },
    retailer: {
      labelEn: 'Retailer',
      labelBn: 'খুচরা বিক্রেতা',
      color: 'bg-amber-100 text-amber-800 border-amber-300',
      icon: <Store className="w-3.5 h-3.5 text-amber-700" />,
    },
    consumer: {
      labelEn: 'Household Consumer',
      labelBn: 'ভোক্তা',
      color: 'bg-purple-100 text-purple-800 border-purple-300',
      icon: <ShoppingCart className="w-3.5 h-3.5 text-purple-700" />,
    },`
  );

  // Update roleStats switch statement
  const roleStatsCases = `      case 'wholesaler':
      case 'businessman': {`;
  profileModal = profileModal.replace(/case 'businessman':\s*\{/, roleStatsCases);

  const retailerCase = `      case 'retailer':
      case 'supplier': {`;
  profileModal = profileModal.replace(/case 'supplier':\s*\{/, retailerCase);

  const consumerCase = `      case 'consumer':
      case 'customer': {`;
  profileModal = profileModal.replace(/case 'customer':\s*\{/, consumerCase);

  const defaultCase = `      case 'admin': {
        return {
          metric1: 'Clearance Level 4 Root',
          metric1Bn: 'সর্বোচ্চ প্রশাসনিক সিকিউরিটি লেভেল-৪',
          metric2: 'Dual-Factor 2FA Active',
          metric2Bn: 'টু-ফ্যাক্টর নিরাপত্তা সক্রিয়',
          metric3: 'Encrypted Telemetry Node',
          metric3Bn: 'এনক্রিপ্টেড ডাটা সেন্টার নোড',
        };
      }
      default: {
        return {
          metric1: 'Active Member',
          metric1Bn: 'সক্রিয় সদস্য',
          metric2: 'Verified Profile',
          metric2Bn: 'যাচাইকৃত প্রোফাইল',
          metric3: 'Standard Access',
          metric3Bn: 'স্ট্যান্ডার্ড এক্সেস',
        };
      }`;
  profileModal = profileModal.replace(/case 'admin':\s*\{[\s\S]*?metric3Bn:\s*'এনক্রিপ্টেড ডাটা সেন্টার নোড',\s*\};\s*\}/, defaultCase);

  fs.writeFileSync(path.join(INNER, 'src', 'components', 'ProfileModal.tsx'), profileModal, 'utf8');
}
console.log('✓ ProfileModal.tsx updated');

// 11. UserProfilePage.tsx
let userProfile = fs.readFileSync(path.join(INNER, 'src', 'components', 'UserProfilePage.tsx'), 'utf8');
// Change currentUser in interface to User | null
userProfile = userProfile.replace(/currentUser:\s*User;/, 'currentUser: User | null;');

// Add canonical roles to roleConfig
if (!userProfile.includes('wholesaler:')) {
  userProfile = userProfile.replace(
    /admin:\s*\{[\s\S]*?labelBn:\s*'অ্যাডমিন',\s*\},/,
    `admin: {
    color: 'text-slate-700',
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    icon: <ShieldCheck className="w-5 h-5" />,
    label: 'Admin',
    labelBn: 'অ্যাডমিন',
  },
  wholesaler: {
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    icon: <Briefcase className="w-5 h-5" />,
    label: 'Wholesaler',
    labelBn: 'পাইকার',
  },
  retailer: {
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    icon: <Store className="w-5 h-5" />,
    label: 'Retailer',
    labelBn: 'খুচরা বিক্রেতা',
  },
  consumer: {
    color: 'text-purple-700',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    icon: <ShoppingCart className="w-5 h-5" />,
    label: 'Consumer',
    labelBn: 'ভোক্তা',
  },`
  );
}

// Guard currentUser usages in UserProfilePage
userProfile = userProfile.replace(
  /const isOwnProfile = currentUser\.id === user\.id;/,
  'const isOwnProfile = currentUser ? currentUser.id === user.id : false;'
);
userProfile = userProfile.replace(
  /const isAdmin = currentUser\.role === 'admin';/,
  "const isAdmin = currentUser ? currentUser.role === 'admin' : false;"
);
userProfile = userProfile.replace(
  /ConnectionStore\.getStatus\(currentUser\.id, user\.id\)/,
  "currentUser ? ConnectionStore.getStatus(currentUser.id, user.id) : 'none'"
);
userProfile = userProfile.replace(
  /const handleSendRequest = \(\) => \{/,
  'const handleSendRequest = () => {\n    if (!currentUser) return;'
);
userProfile = userProfile.replace(
  /const handleCancelRequest = \(\) => \{/,
  'const handleCancelRequest = () => {\n    if (!currentUser) return;'
);
userProfile = userProfile.replace(
  /const handleRemoveConnection = \(\) => \{/,
  'const handleRemoveConnection = () => {\n    if (!currentUser) return;'
);
fs.writeFileSync(path.join(INNER, 'src', 'components', 'UserProfilePage.tsx'), userProfile, 'utf8');
console.log('✓ UserProfilePage.tsx updated');

// 12. mockData.ts
let mockData = fs.readFileSync(path.join(INNER, 'src', 'data', 'mockData.ts'), 'utf8');
if (!mockData.includes('wholesaler:')) {
  mockData = mockData.replace(
    /admin:\s*\{[\s\S]*?securityNoteBn:\s*'এনক্রিপ্টেড ডাটাবেজ ব্যাকআপ ও রুট টেলিম্যাট্রি কনসোল এক্সেস।',\s*\},/,
    `admin: {
    phone: '01819283746',
    email: 'admin.telemetry@nativebazar.com',
    password: 'AdminRoot#2026@Pass',
    education: 'M.Sc in Computer Science (Cyber Security)',
    pin: '260492',
    roleLabelEn: 'System Administrator (সিস্টেম অ্যাডমিন)',
    roleLabelBn: 'অ্যাডমিন',
    securityNoteEn: 'Encrypted telemetry console access & root auditing.',
    securityNoteBn: 'এনক্রিপ্টেড ডাটাবেজ ব্যাকআপ ও রুট টেলিম্যাট্রি কনসোল এক্সেস।',
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
  fs.writeFileSync(path.join(INNER, 'src', 'data', 'mockData.ts'), mockData, 'utf8');
}
console.log('✓ mockData.ts updated');

// 13. AuthPage.tsx
let authPage = fs.readFileSync(path.join(INNER, 'src', 'components', 'AuthPage.tsx'), 'utf8');

// Update AuthPageProps
authPage = authPage.replace(
  /interface AuthPageProps \{[\s\S]*?\}/,
  `interface AuthPageProps {
  language: Language;
  onLanguageToggle: () => void;
  onAuthSuccess: (user: User) => void;
  onBack?: () => void;
  initialMode?: 'login' | 'register';
  initialRole?: 'farmer' | 'wholesaler' | 'retailer' | 'consumer';
}`
);

// Update component signature & state
authPage = authPage.replace(
  /export const AuthPage: React\.FC<AuthPageProps> = \(\{[\s\S]*?\}\) => \{[\s\S]*?const \[mode, setMode\] = useState<'login' \| 'register'>\('login'\);[\s\S]*?const \[selectedRole, setSelectedRole\] = useState<UserRole>\('farmer'\);/,
  `export const AuthPage: React.FC<AuthPageProps> = ({
  language,
  onLanguageToggle,
  onAuthSuccess,
  onBack,
  initialMode = 'login',
  initialRole = 'farmer',
}) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [selectedRole, setSelectedRole] = useState<UserRole>(initialRole);

  useEffect(() => {
    if (initialMode) setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    if (initialRole) setSelectedRole(initialRole);
  }, [initialRole]);`
);

// Add onBack button in header
if (!authPage.includes('{onBack && (')) {
  authPage = authPage.replace(
    /(<button\s+type="button"\s+onClick=\{onLanguageToggle\})/,
    `{onBack && (
              <button
                type="button"
                onClick={onBack}
                className="px-3 py-1.5 bg-white text-stone-700 text-xs font-bold rounded-xl border border-stone-200 shadow-2xs hover:bg-stone-50 flex items-center gap-1.5 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{language === 'bn' ? 'মার্কেটপ্লেসে ফিরুন' : 'Back to Marketplace'}</span>
              </button>
            )}
            $1`
  );
}

// Add canonical roles to roleNavItems if not present
if (!authPage.includes("role: 'wholesaler'")) {
  authPage = authPage.replace(
    /role: 'businessman',[\s\S]*?descBn: '[\s\S]*?',\s*\},/,
    `role: 'wholesaler',
      icon: <Briefcase className="w-4 h-4" />,
      labelEn: 'Wholesaler',
      labelBn: 'পাইকার',
      badgeBg: 'text-blue-700 bg-blue-50 border-blue-300',
      descEn: 'B2B agricultural trading, bulk harvest procurement, escrow contracts and logistics tracking.',
      descBn: 'পাইকারি কৃষি ব্যবসা, বাল্ক ফসল সংগ্রহ, এসক্রো চুক্তি ও পরিবহন ব্যবস্থা।',
    },
    {
      role: 'retailer',
      icon: <Store className="w-4 h-4" />,
      labelEn: 'Retailer',
      labelBn: 'খুচরা বিক্রেতা',
      badgeBg: 'text-amber-700 bg-amber-50 border-amber-300',
      descEn: 'Certified seeds, bio-fertilizers, pesticides & produce distribution to consumers.',
      descBn: 'অনুমোদিত বীজ, সার ও ভোক্তাদের নিকট তাজা ফসল খুচরা বিক্রয়।',
    },
    {
      role: 'consumer',
      icon: <ShoppingCart className="w-4 h-4" />,
      labelEn: 'Consumer',
      labelBn: 'ভোক্তা',
      badgeBg: 'text-purple-700 bg-purple-50 border-purple-300',
      descEn: 'Farm-fresh chemical-free produce delivered directly to your household with transparent pricing.',
      descBn: 'ন্যায্য মূল্যে সরাসরি সতেজ ও বিষমুক্ত কৃষিপণ্য হোম ডেলিভারি গ্রহণ।',
    },
    {
      role: 'businessman',
      icon: <Briefcase className="w-4 h-4" />,
      labelEn: 'Businessman (Legacy)',
      labelBn: 'ব্যবসায়ী',
      badgeBg: 'text-blue-700 bg-blue-50 border-blue-300',
      descEn: 'B2B agricultural trading, bulk harvest procurement, escrow contracts and logistics tracking.',
      descBn: 'ব্যবসায়িক কৃষি ক্রয়, পাইকারি আড়ত চুক্তি ও পরিবহন ব্যবস্থা।',
    },`
  );
}

// Update displayedRoles to show only the 4 canonical roles in register mode
authPage = authPage.replace(
  /const displayedRoles =\s*mode === 'register' \? roleNavItems\.filter\(\(r\) => r\.role !== 'admin'\) : roleNavItems;/,
  `const displayedRoles =
    mode === 'register'
      ? roleNavItems.filter((r) => ['farmer', 'wholesaler', 'retailer', 'consumer'].includes(r.role))
      : roleNavItems;`
);

// Support both canonical and legacy roles in registration fields
authPage = authPage.replace(
  /selectedRole === 'businessman'/g,
  "(selectedRole === 'businessman' || selectedRole === 'wholesaler')"
);
authPage = authPage.replace(
  /selectedRole === 'supplier'/g,
  "(selectedRole === 'supplier' || selectedRole === 'retailer')"
);
authPage = authPage.replace(
  /selectedRole === 'customer'/g,
  "(selectedRole === 'customer' || selectedRole === 'consumer')"
);

fs.writeFileSync(path.join(INNER, 'src', 'components', 'AuthPage.tsx'), authPage, 'utf8');
console.log('✓ AuthPage.tsx updated');

console.log('All safe repairs successfully written.');

