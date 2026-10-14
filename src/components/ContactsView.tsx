import React, { useState, useEffect, useRef } from 'react';
import { User, Language, UserRole, UserConnection, DirectMessage, CallLog } from '../types';
import { AuthStore, ConnectionStore, MessageStore, CallStore } from '../data/store';
import { BANGLADESH_LOCATIONS } from '../data/mockData';
import {
  Users,
  MessageSquare,
  Phone,
  UserPlus,
  UserCheck,
  Clock,
  Search,
  Filter,
  MapPin,
  Send,
  PhoneCall,
  CheckCheck,
  Check,
  ArrowRight,
  ShieldCheck,
  Sprout,
  Briefcase,
  Store,
  ShoppingCart,
  Microscope,
  ExternalLink,
  ChevronRight,
  User as UserIcon,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
} from 'lucide-react';

interface ContactsViewProps {
  currentUser: User;
  language: Language;
  onViewUser: (user: User) => void;
  onInitiateCall: (contact: User) => void;
  initialChatUserId?: string | null;
}

const ROLE_META: Record<UserRole, { labelEn: string; labelBn: string; color: string; badge: string; icon: React.ReactNode }> = {
  farmer: {
    labelEn: 'Farmer',
    labelBn: 'কৃষক',
    color: 'text-emerald-700',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    icon: <Sprout className="w-3.5 h-3.5" />,
  },
  businessman: {
    labelEn: 'Trader / Buyer',
    labelBn: 'ব্যবসায়ী',
    color: 'text-blue-700',
    badge: 'bg-blue-100 text-blue-800 border-blue-200',
    icon: <Briefcase className="w-3.5 h-3.5" />,
  },
  supplier: {
    labelEn: 'Supplier',
    labelBn: 'সরবরাহকারী',
    color: 'text-amber-700',
    badge: 'bg-amber-100 text-amber-800 border-amber-200',
    icon: <Store className="w-3.5 h-3.5" />,
  },
  customer: {
    labelEn: 'Consumer',
    labelBn: 'ভোক্তা',
    color: 'text-purple-700',
    badge: 'bg-purple-100 text-purple-800 border-purple-200',
    icon: <ShoppingCart className="w-3.5 h-3.5" />,
  },
  expert: {
    labelEn: 'Agri Expert',
    labelBn: 'কৃষি বিশেষজ্ঞ',
    color: 'text-teal-700',
    badge: 'bg-teal-100 text-teal-800 border-teal-200',
    icon: <Microscope className="w-3.5 h-3.5" />,
  },
  admin: {
    labelEn: 'Admin',
    labelBn: 'অ্যাডমিন',
    color: 'text-slate-700',
    badge: 'bg-slate-100 text-slate-800 border-slate-300',
    icon: <ShieldCheck className="w-3.5 h-3.5" />,
  },
};

const SUGGESTED_MESSAGES: Record<UserRole, { en: string; bn: string }[]> = {
  farmer: [
    { en: 'What is the current harvest availability?', bn: 'বর্তমান ফসলের সরবরাহ কেমন আছে?' },
    { en: 'Can we negotiate bulk wholesale pricing?', bn: 'বাল্ক পাইকারি দাম নিয়ে কি আলোচনা করতে পারি?' },
    { en: 'Are organic certification documents available?', bn: 'অর্গানিক সার্টিফিকেশন কি আছে?' },
  ],
  businessman: [
    { en: 'I am interested in your seasonal demand.', bn: 'আপনার মৌসুমী ক্রয়ের চাহিদায় আগ্রহী।' },
    { en: 'Can we arrange escrow payment for harvest contract?', bn: 'এসক্রো পেমেন্টে ফসল চুক্তি করা যাবে কি?' },
    { en: 'What is your required delivery schedule?', bn: 'ডেলিভারির নির্ধারিত সময়সূচী কি?' },
  ],
  supplier: [
    { en: 'Do you have urea/DAP fertilizer currently in stock?', bn: 'ইউরিয়া/ডিএপি সার কি বর্তমানে স্টকে আছে?' },
    { en: 'What is the bulk price for seed varieties?', bn: 'উন্নত বীজের পাইকারি মূল্য কত?' },
    { en: 'Can you deliver to our local union hub?', bn: 'স্থানীয় ইউনিয়ন হাবে ডেলিভারি সম্ভব কি?' },
  ],
  customer: [
    { en: 'Is fresh farm delivery available today?', bn: 'আজকে কি সরাসরি ফার্ম থেকে ডেলিভারি পাওয়া যাবে?' },
    { en: 'What is the minimum order quantity?', bn: 'সর্বনিম্ন কত কেজি অর্ডার দেওয়া যাবে?' },
  ],
  expert: [
    { en: 'Need advice on pest attack in potato field.', bn: 'আলু ক্ষেতে পোকার আক্রমণের প্রতিকার কি?' },
    { en: 'Which fertilizer dose is ideal for this season?', bn: 'এই মৌসুমে সঠিক সারের মাত্রা জানতে চাই।' },
  ],
  admin: [
    { en: 'Inquiry regarding account verification.', bn: 'অ্যাকাউন্ট ভেরিফিকেশন সংক্রান্ত তথ্য জানতে চাই।' },
  ],
};

export const ContactsView: React.FC<ContactsViewProps> = ({
  currentUser,
  language,
  onViewUser,
  onInitiateCall,
  initialChatUserId,
}) => {
  const [activeTab, setActiveTab] = useState<'directory' | 'chat' | 'connections' | 'calls'>(
    initialChatUserId ? 'chat' : 'directory'
  );

  // Directory filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<UserRole | 'all'>('all');
  const [selectedDistrictFilter, setSelectedDistrictFilter] = useState<string>('all');

  // Real-time stores data state
  const [users, setUsers] = useState<User[]>([]);
  const [connections, setConnections] = useState<UserConnection[]>([]);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);

  // Active chat state
  const [activeChatUser, setActiveChatUser] = useState<User | null>(null);
  const [chatMessages, setChatMessages] = useState<DirectMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const t = (en: string, bn: string) => (language === 'bn' ? bn : en);

  // Refresh data from persistent store
  const refreshData = () => {
    const allUsers = AuthStore.getUsers();
    setUsers(allUsers);
    setConnections(ConnectionStore.getByUser(currentUser.id));
    setCallLogs(CallStore.getByUser(currentUser.id));

    if (activeChatUser) {
      setChatMessages(MessageStore.getConversation(currentUser.id, activeChatUser.id));
      MessageStore.markRead(currentUser.id, activeChatUser.id);
    }
  };

  useEffect(() => {
    refreshData();
  }, [currentUser.id]);

  // Handle initial chat user if passed via props
  useEffect(() => {
    if (initialChatUserId) {
      const target = AuthStore.getUsers().find((u) => u.id === initialChatUserId);
      if (target) {
        setActiveChatUser(target);
        setActiveTab('chat');
        setChatMessages(MessageStore.getConversation(currentUser.id, target.id));
        MessageStore.markRead(currentUser.id, target.id);
      }
    }
  }, [initialChatUserId, currentUser.id]);

  // Scroll to bottom when new message arrives
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Filtered users (excluding current user)
  const filteredUsers = users.filter((u) => {
    if (u.id === currentUser.id) return false;
    if (selectedRoleFilter !== 'all' && u.role !== selectedRoleFilter) return false;
    if (selectedDistrictFilter !== 'all' && u.district.toLowerCase() !== selectedDistrictFilter.toLowerCase()) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = u.name.toLowerCase().includes(q) || (u.nameBn && u.nameBn.includes(q));
      const matchPhone = u.phone.includes(q);
      const matchDistrict = u.district.toLowerCase().includes(q);
      const matchExtra =
        (u.businessName && u.businessName.toLowerCase().includes(q)) ||
        (u.shopName && u.shopName.toLowerCase().includes(q)) ||
        (u.designation && u.designation.toLowerCase().includes(q)) ||
        (u.primaryCrops && u.primaryCrops.some((c) => c.toLowerCase().includes(q)));
      return matchName || matchPhone || matchDistrict || matchExtra;
    }
    return true;
  });

  // Recent chat partners
  const chatPartners = users.filter((u) => {
    if (u.id === currentUser.id) return false;
    const conversation = MessageStore.getConversation(currentUser.id, u.id);
    return conversation.length > 0;
  });

  const handleSelectChat = (contact: User) => {
    setActiveChatUser(contact);
    setActiveTab('chat');
    setChatMessages(MessageStore.getConversation(currentUser.id, contact.id));
    MessageStore.markRead(currentUser.id, contact.id);
  };

  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeChatUser || !messageInput.trim()) return;

    MessageStore.sendMessage({
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderRole: currentUser.role,
      recipientId: activeChatUser.id,
      recipientName: activeChatUser.name,
      recipientRole: activeChatUser.role,
      content: messageInput.trim(),
    });

    setMessageInput('');
    setChatMessages(MessageStore.getConversation(currentUser.id, activeChatUser.id));
  };

  const handleSendQuickMessage = (text: string) => {
    if (!activeChatUser) return;
    MessageStore.sendMessage({
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderRole: currentUser.role,
      recipientId: activeChatUser.id,
      recipientName: activeChatUser.name,
      recipientRole: activeChatUser.role,
      content: text,
    });
    setChatMessages(MessageStore.getConversation(currentUser.id, activeChatUser.id));
  };

  const handleConnectToggle = (targetUser: User) => {
    const status = ConnectionStore.getStatus(currentUser.id, targetUser.id);
    if (status === 'none') {
      ConnectionStore.sendRequest(currentUser, targetUser);
    } else if (status === 'accepted' || status === 'pending_sent') {
      ConnectionStore.remove(currentUser.id, targetUser.id);
    }
    refreshData();
  };

  const handleAcceptConnection = (connId: string) => {
    ConnectionStore.accept(connId);
    refreshData();
  };

  const handleRejectConnection = (connId: string) => {
    ConnectionStore.reject(connId);
    refreshData();
  };

  const pendingIncomingRequests = connections.filter(
    (c) => c.recipientId === currentUser.id && c.status === 'pending'
  );

  const acceptedConnections = connections.filter((c) => c.status === 'accepted');

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Banner / Header */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-stone-900 text-white rounded-3xl p-6 md:p-8 shadow-xl relative overflow-hidden">
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 bg-emerald-500/20 border border-emerald-400/30 px-3 py-1 rounded-full text-emerald-300 text-xs font-bold">
            <Users className="w-3.5 h-3.5" />
            <span>{t('Cross-Role Agri Communication Hub', 'কৃষি ও ব্যবসায় আন্তঃযোগাযোগ কেন্দ্র')}</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight leading-snug">
            {t(
              'Connect, Message & Call Any Agricultural Stakeholder',
              'কৃষক, ব্যবসায়ী ও বিশেষজ্ঞদের সাথে সরাসরি সংযোগ, বার্তা ও কল'
            )}
          </h1>
          <p className="text-stone-300 text-xs md:text-sm leading-relaxed max-w-2xl">
            {t(
              'Interact securely with verified farmers, arat wholesalers, fertilizer suppliers, and agricultural extension officers across Bangladesh.',
              'সারাদেশের যাচাইকৃত কৃষক, পাইকারি আড়তদার, সার বিক্রেতা এবং কৃষি কর্মকর্তাদের সাথে ফোন বা সরাসরি চ্যাটের মাধ্যমে যোগাযোগ করুন।'
            )}
          </p>
        </div>

        {/* Decorative background shapes */}
        <div className="absolute right-0 top-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Main Tabs Navigation */}
      <div className="bg-white rounded-2xl border border-stone-200 p-1.5 shadow-xs flex items-center justify-between gap-1 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('directory')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'directory'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>{t('All Community & Directory', 'সকল ব্যবহারকারী ও ডিরেক্টরি')}</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
              activeTab === 'directory' ? 'bg-emerald-800 text-white' : 'bg-stone-200 text-stone-700'
            }`}>
              {filteredUsers.length}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab('chat');
              if (!activeChatUser && chatPartners.length > 0) {
                setActiveChatUser(chatPartners[0]);
                setChatMessages(MessageStore.getConversation(currentUser.id, chatPartners[0].id));
              }
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'chat'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>{t('Direct Chat & Messages', 'সরাসরি বার্তা ও চ্যাট')}</span>
            {MessageStore.getUnreadCount(currentUser.id) > 0 && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('connections')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'connections'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>{t('My Network & Connections', 'আমার নেটওয়ার্ক ও সংযোগ')}</span>
            {pendingIncomingRequests.length > 0 && (
              <span className="bg-amber-500 text-white px-1.5 py-0.2 rounded-full text-[10px] font-bold">
                {pendingIncomingRequests.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('calls')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'calls'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
            }`}
          >
            <PhoneCall className="w-4 h-4" />
            <span>{t('Call Logs', 'কল হিস্ট্রি')}</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
              activeTab === 'calls' ? 'bg-emerald-800 text-white' : 'bg-stone-200 text-stone-700'
            }`}>
              {callLogs.length}
            </span>
          </button>
        </div>
      </div>

      {/* ─── TAB 1: DIRECTORY & ALL STAKEHOLDERS ───────────────────────── */}
      {activeTab === 'directory' && (
        <div className="space-y-6">
          {/* Search & Filters Card */}
          <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row gap-3">
              {/* Search input */}
              <div className="flex-1 relative">
                <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t(
                    'Search by name, phone, crop (Potato, Tomato), business or specialty…',
                    'নাম, মোবাইল নম্বর, ফসল (আলু, টমেটো), ব্যবসা দিয়ে খুঁজুন…'
                  )}
                  className="w-full pl-10 pr-4 py-2.5 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-stone-800 transition-all"
                />
              </div>

              {/* District Filter */}
              <div className="flex items-center gap-2 bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs">
                <MapPin className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                <select
                  value={selectedDistrictFilter}
                  onChange={(e) => setSelectedDistrictFilter(e.target.value)}
                  className="bg-transparent font-semibold text-stone-700 focus:outline-none cursor-pointer"
                >
                  <option value="all">{t('All Districts (সকল জেলা)', 'সকল জেলা')}</option>
                  {BANGLADESH_LOCATIONS.map((loc) => (
                    <option key={loc.district} value={loc.district}>
                      {loc.district} ({loc.districtBn})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Role Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1 border-t border-stone-100">
              <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider shrink-0 mr-1">
                {t('Role:', 'ভূমিকা:')}
              </span>
              {(['all', 'farmer', 'businessman', 'supplier', 'customer', 'expert'] as const).map((r) => {
                const isSelected = selectedRoleFilter === r;
                return (
                  <button
                    key={r}
                    onClick={() => setSelectedRoleFilter(r)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                      isSelected
                        ? 'bg-stone-900 text-white shadow-2xs'
                        : 'bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-200'
                    }`}
                  >
                    {r === 'all'
                      ? t('All Roles', 'সকল ভূমিকা')
                      : t(ROLE_META[r].labelEn, ROLE_META[r].labelBn)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* User Cards Grid */}
          {filteredUsers.length === 0 ? (
            <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center space-y-3">
              <Users className="w-12 h-12 text-stone-300 mx-auto" />
              <h3 className="font-bold text-stone-700 text-sm">
                {t('No stakeholders found matching your filters', 'আপনার ফিল্টারের সাথে কোনো ব্যবহারকারী পাওয়া যায়নি')}
              </h3>
              <p className="text-xs text-stone-400 max-w-sm mx-auto">
                {t('Try searching with a different term, or reset the role and district filters.', 'অন্য শব্দ দিয়ে অনুসন্ধান করুন অথবা ফিল্টার পরিবর্তন করুন।')}
              </p>
              <button
                onClick={() => { setSearchQuery(''); setSelectedRoleFilter('all'); setSelectedDistrictFilter('all'); }}
                className="mt-2 px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold rounded-xl transition-colors"
              >
                {t('Reset Filters', 'ফিল্টার রিসেট করুন')}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredUsers.map((u) => {
                const meta = ROLE_META[u.role] || ROLE_META.farmer;
                const connStatus = ConnectionStore.getStatus(currentUser.id, u.id);

                return (
                  <div
                    key={u.id}
                    className="bg-white rounded-2xl border border-stone-200 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group space-y-4"
                  >
                    <div>
                      {/* Top Row: Avatar & Badges */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-stone-800 to-stone-700 text-white flex items-center justify-center text-lg font-bold shadow-xs shrink-0">
                            {u.name.charAt(0)}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <h3 className="font-bold text-stone-900 text-sm group-hover:text-emerald-700 transition-colors">
                                {u.name}
                              </h3>
                              {u.verified && (
                                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" title="Verified Member" />
                              )}
                            </div>
                            <p className="text-[11px] text-stone-500 font-medium">
                              {u.nameBn || u.email}
                            </p>
                          </div>
                        </div>

                        {/* Role Badge */}
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border shrink-0 ${meta.badge}`}>
                          {meta.icon}
                          <span>{t(meta.labelEn, meta.labelBn)}</span>
                        </span>
                      </div>

                      {/* Location & Details */}
                      <div className="mt-3.5 pt-3 border-t border-stone-100 space-y-1.5 text-xs text-stone-600">
                        <div className="flex items-center gap-1.5 font-medium">
                          <MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                          <span>{u.upazila ? `${u.upazila}, ${u.district}` : u.district}</span>
                        </div>

                        <div className="flex items-center gap-1.5 text-stone-500 font-mono text-[11px]">
                          <Phone className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                          <span>{u.phone}</span>
                        </div>

                        {/* Role Extra Snippets */}
                        {u.role === 'farmer' && u.primaryCrops && (
                          <div className="pt-1 text-[11px] text-emerald-700 font-medium">
                            🌱 {t('Crops:', 'ফসল:')} {u.primaryCrops.join(', ')}
                          </div>
                        )}
                        {u.role === 'businessman' && u.businessName && (
                          <div className="pt-1 text-[11px] text-blue-700 font-medium truncate">
                            🏢 {u.businessName}
                          </div>
                        )}
                        {u.role === 'supplier' && u.shopName && (
                          <div className="pt-1 text-[11px] text-amber-700 font-medium truncate">
                            🏪 {u.shopName}
                          </div>
                        )}
                        {u.role === 'expert' && u.designation && (
                          <div className="pt-1 text-[11px] text-teal-700 font-medium truncate">
                            🔬 {u.designation}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons: Message, Call, Connect */}
                    <div className="pt-3 border-t border-stone-100 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        {/* Send Message Button */}
                        <button
                          onClick={() => handleSelectChat(u)}
                          className="flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition-colors"
                        >
                          <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{t('Message', 'বার্তা')}</span>
                        </button>

                        {/* Call Now Button */}
                        <button
                          onClick={() => onInitiateCall(u)}
                          className="flex items-center justify-center gap-1.5 px-3 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold transition-colors shadow-2xs"
                        >
                          <Phone className="w-3.5 h-3.5 text-emerald-400" />
                          <span>{t('Call Now', 'কল করুন')}</span>
                        </button>
                      </div>

                      {/* Connection and Profile row */}
                      <div className="flex items-center justify-between gap-2 pt-1 text-[11px]">
                        <button
                          onClick={() => handleConnectToggle(u)}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold transition-all ${
                            connStatus === 'accepted'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : connStatus === 'pending_sent'
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-200'
                          }`}
                        >
                          {connStatus === 'accepted' ? (
                            <>
                              <UserCheck className="w-3 h-3 text-emerald-600" />
                              <span>{t('Connected ✓', 'সংযুক্ত ✓')}</span>
                            </>
                          ) : connStatus === 'pending_sent' ? (
                            <>
                              <Clock className="w-3 h-3 text-amber-600" />
                              <span>{t('Pending', 'অনুরোধাধীন')}</span>
                            </>
                          ) : (
                            <>
                              <UserPlus className="w-3 h-3 text-stone-500" />
                              <span>{t('+ Connect', '+ যুক্ত হোন')}</span>
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => onViewUser(u)}
                          className="text-stone-500 hover:text-stone-800 hover:underline font-semibold flex items-center gap-0.5"
                        >
                          <span>{t('View Profile', 'প্রোফাইল')}</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 2: DIRECT MESSAGING & CHAT ────────────────────────────── */}
      {activeTab === 'chat' && (
        <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[580px]">
          {/* Chat Left Sidebar (Conversations List) */}
          <div className="md:col-span-4 border-r border-stone-200 flex flex-col bg-stone-50/50">
            <div className="p-4 border-b border-stone-200 bg-white">
              <h2 className="font-extrabold text-stone-900 text-sm">
                {t('Conversations', 'কথোপকথন তালিকা')}
              </h2>
              <p className="text-[11px] text-stone-500 mt-0.5">
                {t('Direct encrypted peer messages', 'ব্যক্তিগত সরাসরি বার্তা')}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-stone-100">
              {chatPartners.length === 0 ? (
                <div className="p-8 text-center space-y-2">
                  <MessageSquare className="w-8 h-8 text-stone-300 mx-auto" />
                  <p className="text-xs text-stone-500 font-medium">
                    {t('No ongoing conversations yet', 'এখনো কোনো বার্তা আদান-প্রদান হয়নি')}
                  </p>
                  <p className="text-[11px] text-stone-400">
                    {t('Select any user from the Directory tab to begin chatting.', 'ডিরেক্টরি থেকে যেকোনো ব্যবহারকারী নির্বাচন করে বার্তা পাঠান।')}
                  </p>
                  <button
                    onClick={() => setActiveTab('directory')}
                    className="mt-2 px-3 py-1.5 bg-emerald-700 text-white text-xs font-bold rounded-lg"
                  >
                    {t('Browse Directory', 'ডিরেক্টরি দেখুন')}
                  </button>
                </div>
              ) : (
                chatPartners.map((partner) => {
                  const isSelected = activeChatUser?.id === partner.id;
                  const msgs = MessageStore.getConversation(currentUser.id, partner.id);
                  const lastMsg = msgs[msgs.length - 1];
                  const meta = ROLE_META[partner.role] || ROLE_META.farmer;

                  return (
                    <div
                      key={partner.id}
                      onClick={() => handleSelectChat(partner)}
                      className={`p-3.5 cursor-pointer transition-colors flex items-center gap-3 ${
                        isSelected ? 'bg-emerald-50/80 border-l-4 border-emerald-600' : 'hover:bg-stone-100/70'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-xl bg-stone-800 text-white flex items-center justify-center font-bold text-sm shrink-0">
                        {partner.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <h4 className="font-bold text-xs text-stone-900 truncate">
                            {partner.name}
                          </h4>
                          <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${meta.badge}`}>
                            {t(meta.labelEn, meta.labelBn)}
                          </span>
                        </div>
                        {lastMsg && (
                          <p className="text-[11px] text-stone-500 truncate mt-0.5">
                            {lastMsg.senderId === currentUser.id ? 'You: ' : ''}
                            {lastMsg.content}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Chat Right Pane (Active Messages Thread) */}
          <div className="md:col-span-8 flex flex-col bg-white">
            {activeChatUser ? (
              <>
                {/* Active Chat Header */}
                <div className="p-4 border-b border-stone-200 flex items-center justify-between gap-3 bg-stone-50/70">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-700 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-2xs">
                      {activeChatUser.name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-extrabold text-sm text-stone-900">
                          {activeChatUser.name}
                        </h3>
                        <span className="w-2 h-2 rounded-full bg-emerald-500" title="Online" />
                      </div>
                      <p className="text-[11px] text-stone-500 font-medium">
                        {t(ROLE_META[activeChatUser.role].labelEn, ROLE_META[activeChatUser.role].labelBn)} • {activeChatUser.district}
                      </p>
                    </div>
                  </div>

                  {/* Actions in Chat Header */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onInitiateCall(activeChatUser)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-colors shadow-2xs"
                      title={t('Voice Call Contact', 'সরাসরি কল করুন')}
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>{t('Voice Call', 'কল করুন')}</span>
                    </button>

                    <button
                      onClick={() => onViewUser(activeChatUser)}
                      className="p-1.5 text-stone-500 hover:text-stone-800 hover:bg-stone-200 rounded-lg transition-colors"
                      title={t('View Full Profile', 'প্রোফাইল দেখুন')}
                    >
                      <UserIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Messages Body */}
                <div className="flex-1 p-4 md:p-6 overflow-y-auto space-y-3.5 bg-stone-50/40 max-h-[420px]">
                  {chatMessages.length === 0 ? (
                    <div className="py-12 text-center space-y-2">
                      <p className="text-xs text-stone-400 font-medium">
                        {t('Start a conversation with', 'কথোপকথন শুরু করুন')} {activeChatUser.name}
                      </p>
                      <p className="text-[11px] text-stone-400">
                        {t('Ask about crop availability, price negotiation, or inputs.', 'ফসল, দরদাম বা সার-কীটনাশক সম্পর্কে কথা বলুন।')}
                      </p>
                    </div>
                  ) : (
                    chatMessages.map((m) => {
                      const isMe = m.senderId === currentUser.id;
                      return (
                        <div
                          key={m.id}
                          className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                        >
                          <div
                            className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-xs shadow-2xs ${
                              isMe
                                ? 'bg-emerald-700 text-white rounded-br-xs'
                                : 'bg-white text-stone-800 border border-stone-200 rounded-bl-xs'
                            }`}
                          >
                            <p className="leading-relaxed whitespace-pre-wrap">{m.content}</p>
                          </div>
                          <span className="text-[9px] text-stone-400 mt-1 px-1">
                            {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Quick Suggestion Chips */}
                {SUGGESTED_MESSAGES[activeChatUser.role] && (
                  <div className="px-4 py-2 bg-stone-100/70 border-t border-stone-200 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider shrink-0">
                      {t('Quick:', 'দ্রুত:')}
                    </span>
                    {SUGGESTED_MESSAGES[activeChatUser.role].map((s, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSendQuickMessage(language === 'bn' ? s.bn : s.en)}
                        className="px-2.5 py-1 bg-white hover:bg-emerald-50 text-stone-700 hover:text-emerald-800 border border-stone-200 hover:border-emerald-300 rounded-full text-[11px] font-medium transition-all shrink-0 shadow-2xs"
                      >
                        {t(s.en, s.bn)}
                      </button>
                    ))}
                  </div>
                )}

                {/* Input Bar */}
                <form
                  onSubmit={handleSendMessage}
                  className="p-3 border-t border-stone-200 bg-white flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    placeholder={t('Type a message or price offer…', 'বার্তা বা দরদাম লিখুন…')}
                    className="flex-1 px-4 py-2.5 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-stone-800 transition-all"
                  />
                  <button
                    type="submit"
                    disabled={!messageInput.trim()}
                    className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors shrink-0"
                  >
                    <span>{t('Send', 'পাঠান')}</span>
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-stone-100 flex items-center justify-center text-stone-400">
                  <MessageSquare className="w-8 h-8" />
                </div>
                <h3 className="font-extrabold text-stone-800 text-sm">
                  {t('Select a contact to start messaging', 'বার্তা পাঠাতে একটি যোগাযোগ নির্বাচন করুন')}
                </h3>
                <p className="text-xs text-stone-400 max-w-sm">
                  {t(
                    'Direct communication allows instant negotiation with farmers, businesses, and certified agronomists.',
                    'কৃষক, ব্যবসায়ী এবং কৃষিবিদদের সাথে তাৎক্ষণিক যোগাযোগ ও চুক্তি সম্পাদনের সুযোগ।'
                  )}
                </p>
                <button
                  onClick={() => setActiveTab('directory')}
                  className="px-4 py-2 bg-emerald-700 text-white text-xs font-bold rounded-xl"
                >
                  {t('Browse Community Directory', 'ডিরেক্টরি ব্রাউজ করুন')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 3: CONNECTIONS & NETWORKING ───────────────────────────── */}
      {activeTab === 'connections' && (
        <div className="space-y-6">
          {/* Pending Incoming Connection Requests */}
          {pendingIncomingRequests.length > 0 && (
            <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2 text-amber-800 font-bold text-xs">
                <UserPlus className="w-4 h-4 text-amber-600" />
                <span>
                  {t('Pending Incoming Connection Requests', 'আগত সংযোগের অনুরোধ')} ({pendingIncomingRequests.length})
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {pendingIncomingRequests.map((req) => (
                  <div
                    key={req.id}
                    className="bg-white rounded-xl p-4 border border-amber-200 shadow-2xs flex items-center justify-between gap-3"
                  >
                    <div>
                      <h4 className="font-bold text-xs text-stone-900">{req.requesterName}</h4>
                      <p className="text-[11px] text-stone-500">
                        {t(ROLE_META[req.requesterRole]?.labelEn || 'User', ROLE_META[req.requesterRole]?.labelBn || 'ব্যবহারকারী')} • {req.requesterDistrict}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleAcceptConnection(req.id)}
                        className="px-3 py-1.5 bg-emerald-700 text-white rounded-lg text-xs font-bold hover:bg-emerald-800 transition-colors shadow-2xs"
                      >
                        {t('Accept', 'গ্রহণ')}
                      </button>
                      <button
                        onClick={() => handleRejectConnection(req.id)}
                        className="px-2.5 py-1.5 bg-stone-100 text-stone-600 hover:bg-stone-200 rounded-lg text-xs font-bold transition-colors"
                      >
                        {t('Decline', 'প্রত্যাখ্যান')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Connected Network Members */}
          <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-stone-900 text-sm">
                  {t('My Connected Network', 'আমার সংযুক্ত নেটওয়ার্ক')} ({acceptedConnections.length})
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  {t('Stakeholders you are mutually connected with', 'আপনার সাথে সংযুক্ত কৃষি ও বাণিজ্যিক অংশীজন')}
                </p>
              </div>

              <button
                onClick={() => setActiveTab('directory')}
                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold rounded-xl transition-colors"
              >
                {t('+ Find More Stakeholders', '+ নতুন সংযোগ খুঁজুন')}
              </button>
            </div>

            {acceptedConnections.length === 0 ? (
              <div className="py-12 text-center text-stone-400 space-y-2">
                <UserCheck className="w-10 h-10 mx-auto text-stone-300" />
                <p className="text-xs font-medium text-stone-600">
                  {t('No connected partners yet', 'এখনো কোনো সংযুক্ত অংশীজন নেই')}
                </p>
                <p className="text-[11px] text-stone-400 max-w-sm mx-auto">
                  {t('Connect with farmers, wholesale merchants, and agricultural specialists to build your supply chain network.', 'আপনার সরবরাহ চেইনের সুবিধার্থে কৃষক ও ব্যবসায়ীদের সাথে যুক্ত হোন।')}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {acceptedConnections.map((conn) => {
                  const isRequester = conn.requesterId === currentUser.id;
                  const partnerId = isRequester ? conn.recipientId : conn.requesterId;
                  const partnerName = isRequester ? conn.recipientName : conn.requesterName;
                  const partnerRole = isRequester ? conn.recipientRole : conn.requesterRole;
                  const partnerDistrict = isRequester ? conn.recipientDistrict : conn.requesterDistrict;
                  const partnerPhone = isRequester ? conn.recipientPhone : conn.requesterPhone;

                  const fullUser = users.find((u) => u.id === partnerId);
                  const meta = ROLE_META[partnerRole] || ROLE_META.farmer;

                  return (
                    <div
                      key={conn.id}
                      className="p-4 bg-stone-50 border border-stone-200 rounded-xl flex items-center justify-between gap-3 hover:bg-stone-100 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-bold text-xs text-stone-900 truncate">{partnerName}</h4>
                          <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${meta.badge}`}>
                            {t(meta.labelEn, meta.labelBn)}
                          </span>
                        </div>
                        <p className="text-[11px] text-stone-500 mt-0.5">{partnerDistrict}</p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => {
                            if (fullUser) handleSelectChat(fullUser);
                          }}
                          className="p-2 bg-white hover:bg-emerald-50 text-emerald-700 border border-stone-200 hover:border-emerald-300 rounded-lg transition-colors shadow-2xs"
                          title="Message"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (fullUser) onInitiateCall(fullUser);
                          }}
                          className="p-2 bg-stone-900 hover:bg-stone-800 text-white rounded-lg transition-colors shadow-2xs"
                          title="Call"
                        >
                          <Phone className="w-3.5 h-3.5 text-emerald-400" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 4: CALL LOGS ──────────────────────────────────────────── */}
      {activeTab === 'calls' && (
        <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-stone-900 text-sm">
                {t('Agri-VoIP & Phone Call History', 'এগ্রি-ভয়েস ও ফোন কল হিস্ট্রি')}
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                {t('Record of voice interactions, consultations, and trading negotiations', 'পরামর্শ ও লেনদেন সংক্রান্ত সমস্ত কলের বিবরণ')}
              </p>
            </div>
          </div>

          {callLogs.length === 0 ? (
            <div className="py-12 text-center text-stone-400 space-y-2">
              <PhoneCall className="w-10 h-10 mx-auto text-stone-300" />
              <p className="text-xs font-medium text-stone-600">
                {t('No call history recorded yet', 'এখনো কোনো কল হিস্ট্রি নেই')}
              </p>
              <p className="text-[11px] text-stone-400">
                {t('Click "Call Now" on any contact to initiate a voice call.', 'যেকোনো ব্যবহারকারীর প্রোফাইলে "কল করুন" বাটনে ক্লিক করুন।')}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-stone-100">
              {callLogs.map((log) => {
                const isCaller = log.callerId === currentUser.id;
                const otherName = isCaller ? log.receiverName : log.callerName;
                const otherRole = isCaller ? log.receiverRole : log.callerRole;
                const otherPhone = isCaller ? log.receiverPhone : '';
                const otherUser = users.find((u) => u.id === (isCaller ? log.receiverId : log.callerId));

                return (
                  <div
                    key={log.id}
                    className="py-3 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        log.status === 'completed'
                          ? isCaller ? 'bg-emerald-100 text-emerald-700' : 'bg-teal-100 text-teal-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {log.status === 'missed' ? (
                          <PhoneMissed className="w-4 h-4" />
                        ) : isCaller ? (
                          <PhoneOutgoing className="w-4 h-4" />
                        ) : (
                          <PhoneIncoming className="w-4 h-4" />
                        )}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-stone-900">{otherName}</h4>
                          <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${ROLE_META[otherRole]?.badge || ''}`}>
                            {t(ROLE_META[otherRole]?.labelEn || otherRole, ROLE_META[otherRole]?.labelBn || otherRole)}
                          </span>
                        </div>
                        <p className="text-[11px] text-stone-500 font-mono mt-0.5">
                          {new Date(log.timestamp).toLocaleString(language === 'bn' ? 'bn-BD' : 'en-US')}
                          {log.durationSeconds > 0 && ` • ${Math.floor(log.durationSeconds / 60)}m ${log.durationSeconds % 60}s`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {otherUser && (
                        <button
                          onClick={() => onInitiateCall(otherUser)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-lg text-xs font-bold transition-colors"
                        >
                          <Phone className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{t('Call Again', 'পুনরায় কল')}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
