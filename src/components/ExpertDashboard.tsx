import React, { useState, useEffect, useRef } from 'react';
import { AgroAdvisory, Language, User, DirectMessage } from '../types';
import {
  MessageStore, NotificationStore, AuthStore, AdvisoryStore,
} from '../data/store';
import {
  Microscope,
  AlertTriangle,
  CheckCircle2,
  BellRing,
  Send,
  ShieldCheck,
  Stethoscope,
  MapPin,
  Sparkles,
  MessageSquare,
  X,
  RefreshCw,
  Clock,
  ChevronDown,
  ChevronUp,
  Calendar,
  Info,
  AlertCircle,
  Users,
  FileText,
  Eye,
  Filter,
} from 'lucide-react';

interface ExpertDashboardProps {
  advisories: AgroAdvisory[];
  onAddAdvisory: (newAdvisory: Partial<AgroAdvisory>) => void;
  language: Language;
  currentUser?: User | null;
}

interface PendingReview {
  id: string;
  farmerName: string;
  phone: string;
  location: string;
  crop: string;
  aiSuspectedDisease: string;
  confidence: number;
  symptoms: string;
  aiPrescription: string;
  status: 'Pending' | 'Verified';
}

const CATEGORY_COLORS: Record<string, string> = {
  'Weather Alert': 'bg-blue-100 text-blue-800 border-blue-200',
  'Pest Outbreak': 'bg-red-100 text-red-800 border-red-200',
  'Soil Advice': 'bg-amber-100 text-amber-800 border-amber-200',
  'Market Alert': 'bg-purple-100 text-purple-800 border-purple-200',
  'Price Warning': 'bg-orange-100 text-orange-800 border-orange-200',
};

const SEVERITY_COLORS: Record<string, string> = {
  Warning: 'bg-amber-100 text-amber-800',
  Urgent: 'bg-red-100 text-red-800',
  Information: 'bg-blue-100 text-blue-800',
};

export const ExpertDashboard: React.FC<ExpertDashboardProps> = ({
  advisories,
  onAddAdvisory,
  language,
  currentUser,
}) => {
  const [activeTab, setActiveTab] = useState<'queue' | 'messages' | 'bulletins'>('queue');
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [expandedBulletin, setExpandedBulletin] = useState<string | null>(null);

  // Advisory Form
  const [title, setTitle] = useState('');
  const [titleBn, setTitleBn] = useState('');
  const [category, setCategory] = useState<AgroAdvisory['category']>('Weather Alert');
  const [message, setMessage] = useState('');
  const [messageBn, setMessageBn] = useState('');
  const [severity, setSeverity] = useState<'Warning' | 'Urgent' | 'Information'>('Warning');
  const [affectedCrops, setAffectedCrops] = useState('');

  // Messaging
  const [conversations, setConversations] = useState<{ user: User; lastMsg: DirectMessage | null; unread: number }[]>([]);
  const [selectedConvUser, setSelectedConvUser] = useState<User | null>(null);
  const [msgs, setMsgs] = useState<DirectMessage[]>([]);
  const [replyText, setReplyText] = useState('');
  const msgEndRef = useRef<HTMLDivElement>(null);

  // Pending farmer AI diagnosis verifications
  const [pendingReviews, setPendingReviews] = useState<PendingReview[]>([
    {
      id: 'rev-1',
      farmerName: 'Md. Rafiqul Islam',
      phone: '+880 1712-458920',
      location: 'Shibganj, Bogura',
      crop: 'Hybrid Tomato',
      aiSuspectedDisease: 'Early Blight (Alternaria solani)',
      confidence: 93,
      symptoms: 'Concentric brown rings on lower leaves, mild yellow halo.',
      aiPrescription: 'Mancozeb 75 WP @ 2g/L water + proper root drainage.',
      status: 'Pending',
    },
    {
      id: 'rev-2',
      farmerName: 'Abul Kashem Mondol',
      phone: '+880 1823-991204',
      location: 'Sherpur, Bogura',
      crop: 'Diamond Potato',
      aiSuspectedDisease: 'Late Blight (Phytophthora infestans)',
      confidence: 89,
      symptoms: 'Water-soaked blackish lesions on leaf tips with white mildew underneath.',
      aiPrescription: 'Ridomil Gold MZ (Metalaxyl + Mancozeb) @ 2.5g/L water.',
      status: 'Pending',
    },
  ]);

  const t = (en: string, bn: string) => language === 'bn' ? bn : en;

  const loadConversations = () => {
    if (!currentUser) return;
    const allMessages = MessageStore.getAll();
    const expertId = currentUser.id;
    const relevant = allMessages.filter(
      m => m.senderId === expertId || m.recipientId === expertId
    );
    const partnerMap = new Map<string, DirectMessage[]>();
    relevant.forEach(msg => {
      const partnerId = msg.senderId === expertId ? msg.recipientId : msg.senderId;
      if (!partnerMap.has(partnerId)) partnerMap.set(partnerId, []);
      partnerMap.get(partnerId)!.push(msg);
    });
    const allUsers = AuthStore.getUsers();
    const convs: { user: User; lastMsg: DirectMessage | null; unread: number }[] = [];
    partnerMap.forEach((messages, partner) => {
      const user = allUsers.find(u => u.id === partner);
      if (!user) return;
      const sorted = [...messages].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const unread = messages.filter(m => m.recipientId === expertId && !m.read).length;
      convs.push({ user, lastMsg: sorted[0] || null, unread });
    });
    convs.sort((a, b) => {
      const ta = a.lastMsg ? new Date(a.lastMsg.createdAt).getTime() : 0;
      const tb = b.lastMsg ? new Date(b.lastMsg.createdAt).getTime() : 0;
      return tb - ta;
    });
    setConversations(convs);
  };

  const loadMessages = (partnerId: string) => {
    if (!currentUser) return;
    const loaded = MessageStore.getConversation(currentUser.id, partnerId);
    setMsgs(loaded);
    MessageStore.markRead(currentUser.id, partnerId);
    loadConversations();
    setTimeout(() => msgEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  useEffect(() => { loadConversations(); }, [currentUser?.id]);
  useEffect(() => { if (selectedConvUser) loadMessages(selectedConvUser.id); }, [selectedConvUser?.id]);
  useEffect(() => { msgEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  const handleSendReply = () => {
    if (!currentUser || !selectedConvUser || !replyText.trim()) return;
    MessageStore.sendMessage({
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderRole: currentUser.role,
      recipientId: selectedConvUser.id,
      recipientName: selectedConvUser.name,
      recipientRole: selectedConvUser.role,
      content: replyText.trim(),
      messageType: 'advisory',
    });
    setReplyText('');
    loadMessages(selectedConvUser.id);
  };

  const handleVerify = (id: string) => {
    setPendingReviews(prev => prev.map(r => r.id === id ? { ...r, status: 'Verified' } : r));
    if (currentUser) {
      NotificationStore.addSystemNotif(
        currentUser.id,
        t('Diagnosis Verified', 'রোগ নির্ণয় যাচাই সম্পন্ন'),
        t('AI crop diagnosis approved & prescription issued.', 'এআই রোগ নির্ণয় যাচাই ও প্রেসক্রিপশন জারি।'),
        'success'
      );
    }
  };

  const handleSubmitAdvisory = (e: React.FormEvent) => {
    e.preventDefault();
    onAddAdvisory({
      expertName: currentUser?.name || 'Agricultural Specialist',
      designation: currentUser?.designation || 'Agricultural Specialist',
      title,
      titleBn: titleBn || title,
      category,
      message,
      messageBn: messageBn || message,
      severity,
      district: currentUser?.district ? `${currentUser.district} Zone` : 'Bogura & Rajshahi Zone',
      date: new Date().toLocaleDateString(language === 'bn' ? 'bn-BD' : 'en-GB', { year: 'numeric', month: 'short', day: 'numeric' }),
      affectedCrops: affectedCrops ? affectedCrops.split(',').map(s => s.trim()).filter(Boolean) : undefined,
    });
    setShowBroadcastModal(false);
    setTitle(''); setTitleBn(''); setMessage(''); setMessageBn(''); setAffectedCrops('');
  };

  const pendingCount = pendingReviews.filter(r => r.status === 'Pending').length;
  const totalUnread = conversations.reduce((s, c) => s + c.unread, 0);

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-gradient-to-r from-teal-900 via-emerald-900 to-slate-900 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 w-64 h-full opacity-10 pointer-events-none">
          <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at right, teal, transparent 70%)' }} />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 bg-teal-800/60 border border-teal-400/30 px-3 py-1 rounded-full text-xs font-semibold text-teal-200 mb-2">
              <Microscope className="w-3.5 h-3.5 text-teal-300" />
              <span>{t('Agronomy Expert & Extension Portal (DAE / BARI)', 'কৃষি সম্প্রসারণ ও বিশেষজ্ঞ পোর্টাল (DAE / BARI)')}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {t('Agronomist Command Center', 'কৃষি বিশেষজ্ঞ ড্যাশবোর্ড')}
            </h1>
            <p className="text-teal-100/90 text-sm mt-1 max-w-2xl">
              {t(
                'Review AI diagnoses, reply to farmer queries, and broadcast regional advisories.',
                'এআই রোগ নির্ণয় যাচাই করুন, কৃষকদের প্রশ্নের উত্তর দিন এবং আঞ্চলিক বুলেটিন প্রচার করুন।'
              )}
            </p>
          </div>
          <button
            onClick={() => setShowBroadcastModal(true)}
            className="bg-white hover:bg-teal-50 text-teal-900 px-4 py-2.5 rounded-xl font-bold text-sm shadow-md flex items-center gap-2 transition-all hover:scale-105 flex-shrink-0"
          >
            <BellRing className="w-4 h-4 text-teal-600" />
            <span>{t('Broadcast Advisory', 'আঞ্চলিক বুলেটিন জারি')}</span>
          </button>
        </div>
        {/* KPI strip */}
        <div className="relative z-10 mt-5 grid grid-cols-3 gap-3">
          {[
            { label: t('Pending Reviews', 'পর্যালোচনা বাকি'), value: String(pendingCount) },
            { label: t('Unread Messages', 'অপঠিত বার্তা'), value: String(totalUnread) },
            { label: t('Bulletins Issued', 'বুলেটিন জারি'), value: String(advisories.length) },
          ].map((kpi, i) => (
            <div key={i} className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-3 text-center">
              <p className="text-[11px] text-teal-200/80 font-medium">{kpi.label}</p>
              <p className="text-xl font-extrabold text-white mt-0.5">{kpi.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-stone-100 p-1 rounded-xl w-fit">
        {([
          { id: 'queue', label: t('Diagnosis Queue', 'রোগ নির্ণয় কিউ'), badge: pendingCount },
          { id: 'messages', label: t('Farmer Messages', 'কৃষকের বার্তা'), badge: totalUnread },
          { id: 'bulletins', label: t('Published Bulletins', 'প্রকাশিত বুলেটিন'), badge: advisories.length },
        ] as Array<{ id: string; label: string; badge: number }>).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === tab.id ? 'bg-white text-teal-700 shadow-sm' : 'text-stone-600 hover:text-stone-800'
            }`}
          >
            {tab.label}
            {tab.badge > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${activeTab === tab.id ? 'bg-teal-100 text-teal-800' : 'bg-stone-200 text-stone-600'}`}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ─── TAB: DIAGNOSIS QUEUE ─── */}
      {activeTab === 'queue' && (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-stone-200">
            <div>
              <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
                <Stethoscope className="w-5 h-5 text-teal-600" />
                <span>{t('AI Crop Diagnosis Verification Queue', 'এআই রোগ নির্ণয় যাচাইকরণ কিউ')}</span>
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                {t('Expert oversight prevents crop damage from incorrect AI detections', 'কৃষকদের ভুল ওষুধ প্রতিরোধে বিশেষজ্ঞ অনুমোদন প্রয়োজন')}
              </p>
            </div>
            <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2 py-0.5 rounded-full">
              {pendingCount} {t('Pending', 'বাকি')}
            </span>
          </div>
          <div className="space-y-3.5">
            {pendingReviews.map(rev => (
              <div key={rev.id} className="p-4 rounded-xl border border-stone-200 bg-stone-50/50 hover:bg-white transition-all text-xs space-y-2.5 hover:shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-bold text-stone-900 text-sm">{rev.farmerName}</span>
                    <p className="text-[11px] text-stone-500 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3 text-stone-400" />
                      {rev.location} • {rev.crop}
                    </p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${rev.status === 'Verified' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                    {rev.status === 'Verified' ? '✓ Expert Verified' : t('Awaiting Review', 'যাচাই বাকি')}
                  </span>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-stone-200/80 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-stone-800">AI Suspected: {rev.aiSuspectedDisease}</span>
                    <span className="text-[10px] text-teal-700 font-semibold">{rev.confidence}% Confidence</span>
                  </div>
                  <p className="text-[11px] text-stone-600"><strong>Symptoms:</strong> {rev.symptoms}</p>
                  <p className="text-[11px] text-stone-600"><strong>AI Recommendation:</strong> {rev.aiPrescription}</p>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <a href={`tel:${rev.phone}`} className="text-teal-700 font-semibold text-[11px] hover:underline flex items-center gap-1">
                    📞 {rev.phone}
                  </a>
                  {rev.status === 'Pending' ? (
                    <button onClick={() => handleVerify(rev.id)} className="bg-teal-700 hover:bg-teal-800 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 shadow-sm transition-all hover:scale-105">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{t('Approve Prescription', 'যাচাই ও অনুমোদন')}</span>
                    </button>
                  ) : (
                    <span className="text-emerald-700 font-bold text-xs flex items-center gap-1">
                      <ShieldCheck className="w-4 h-4" />
                      {t('Official Prescription Issued', 'অনুমোদিত প্রেসক্রিপশন জারি')}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── TAB: FARMER MESSAGES ─── */}
      {activeTab === 'messages' && (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="flex" style={{ height: '520px' }}>
            {/* Conversation list */}
            <div className="w-64 border-r border-stone-200 flex flex-col flex-shrink-0">
              <div className="px-4 py-3 border-b border-stone-100 bg-stone-50">
                <h3 className="font-bold text-stone-900 text-sm flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-teal-600" />
                  {t('Farmer Queries', 'কৃষকদের প্রশ্ন')}
                </h3>
              </div>
              <div className="flex-1 overflow-y-auto divide-y divide-stone-100">
                {conversations.length === 0 ? (
                  <div className="p-4 text-center text-stone-400 text-xs mt-4">
                    <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p>{t('No messages yet', 'কোনো বার্তা নেই')}</p>
                    <p className="text-[11px] mt-1 text-stone-300">{t('Farmers will contact you here', 'কৃষকরা এখানে আপনার সাথে যোগাযোগ করবেন')}</p>
                  </div>
                ) : conversations.map(conv => (
                  <button
                    key={conv.user.id}
                    onClick={() => setSelectedConvUser(conv.user)}
                    className={`w-full px-4 py-3 text-left hover:bg-stone-50 transition-colors ${selectedConvUser?.id === conv.user.id ? 'bg-teal-50 border-l-2 border-teal-600' : ''}`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-sm font-bold text-emerald-700 shrink-0">
                        {conv.user.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-stone-900 truncate">{conv.user.name}</span>
                          {conv.unread > 0 && (
                            <span className="text-[10px] font-black bg-teal-600 text-white rounded-full w-4 h-4 flex items-center justify-center shrink-0 ml-1">{conv.unread}</span>
                          )}
                        </div>
                        <p className="text-[11px] text-stone-500 truncate">{conv.lastMsg?.content || '—'}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Chat area */}
            <div className="flex-1 flex flex-col min-w-0">
              {!selectedConvUser ? (
                <div className="flex-1 flex items-center justify-center text-stone-400 text-sm">
                  <div className="text-center">
                    <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="font-semibold">{t('Select a conversation', 'একটি কথোপকথন নির্বাচন করুন')}</p>
                    <p className="text-xs text-stone-400 mt-1">{t('Farmer messages appear here', 'কৃষকের বার্তা এখানে দেখাবে')}</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="px-4 py-3 border-b border-stone-200 bg-stone-50 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-sm font-bold text-emerald-700">
                      {selectedConvUser.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-stone-900 text-sm">{selectedConvUser.name}</p>
                      <p className="text-[11px] text-stone-500">{selectedConvUser.role} • {selectedConvUser.district}</p>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {msgs.length === 0 ? (
                      <div className="text-center text-stone-400 text-xs mt-8">
                        <p>{t('No messages yet', 'এখনো কোনো বার্তা নেই')}</p>
                      </div>
                    ) : msgs.map(msg => {
                      const isMe = msg.senderId === currentUser?.id;
                      return (
                        <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-xs px-3.5 py-2.5 rounded-2xl text-xs ${isMe ? 'bg-teal-700 text-white rounded-tr-sm' : 'bg-stone-100 text-stone-800 rounded-tl-sm'}`}>
                            <p className="leading-relaxed">{msg.content}</p>
                            <p className={`text-[10px] mt-1 ${isMe ? 'text-teal-200' : 'text-stone-400'}`}>
                              {new Date(msg.createdAt).toLocaleTimeString(language === 'bn' ? 'bn-BD' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                              {msg.messageType === 'advisory' && <span className="ml-1">• Expert Reply</span>}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={msgEndRef} />
                  </div>
                  <div className="p-3 border-t border-stone-200 bg-white">
                    <div className="flex gap-2">
                      <textarea
                        value={replyText}
                        onChange={e => setReplyText(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendReply(); } }}
                        rows={2}
                        placeholder={t('Write expert advisory reply… (Enter to send)', 'বিশেষজ্ঞ পরামর্শ লিখুন… (Enter চাপুন)')}
                        className="flex-1 text-xs border border-stone-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-teal-400 transition-all"
                      />
                      <button
                        onClick={handleSendReply}
                        disabled={!replyText.trim()}
                        className="px-4 bg-teal-700 hover:bg-teal-800 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 disabled:opacity-40 transition-all hover:scale-105 self-end py-2"
                      >
                        <Send className="w-3.5 h-3.5" />
                        {t('Send', 'পাঠান')}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB: PUBLISHED BULLETINS ─── */}
      {activeTab === 'bulletins' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-teal-600" />
                {t('Regional Agricultural Bulletins', 'আঞ্চলিক কৃষি বুলেটিন')}
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">{t('Published advisories visible to all farmers in the region', 'অঞ্চলের সকল কৃষকের কাছে প্রেরিত বুলেটিন')}</p>
            </div>
            <button
              onClick={() => setShowBroadcastModal(true)}
              className="text-xs font-semibold text-teal-700 hover:text-teal-800 bg-teal-50 px-3 py-1.5 rounded-lg border border-teal-200 flex items-center gap-1.5 transition-colors hover:bg-teal-100"
            >
              <BellRing className="w-3.5 h-3.5" />
              {t('+ Publish New Bulletin', '+ নতুন বুলেটিন প্রকাশ করুন')}
            </button>
          </div>

          {advisories.length === 0 ? (
            <div className="card empty-state">
              <div className="empty-state-icon"><FileText className="w-8 h-8" /></div>
              <h3 className="font-bold text-stone-700">{t('No bulletins published yet', 'এখনো কোনো বুলেটিন প্রকাশিত হয়নি')}</h3>
              <p className="text-sm text-stone-400">{t('Publish an advisory to inform farmers in your region', 'অঞ্চলের কৃষকদের জানাতে বুলেটিন প্রকাশ করুন')}</p>
              <button onClick={() => setShowBroadcastModal(true)} className="mt-4 px-5 py-2.5 bg-teal-700 text-white text-sm font-bold rounded-xl hover:bg-teal-800 transition-colors flex items-center gap-2 mx-auto">
                <BellRing className="w-4 h-4" />
                {t('Publish First Bulletin', 'প্রথম বুলেটিন প্রকাশ করুন')}
              </button>
            </div>
          ) : advisories.map(adv => {
            const isExpanded = expandedBulletin === adv.id;
            const categoryStyle = CATEGORY_COLORS[adv.category] || 'bg-stone-100 text-stone-700 border-stone-200';
            const severityStyle = SEVERITY_COLORS[adv.severity] || 'bg-stone-100 text-stone-700';
            return (
              <div key={adv.id} className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden hover:shadow-md transition-all">
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${categoryStyle}`}>{adv.category}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${severityStyle}`}>
                          {adv.severity === 'Urgent' ? '🔴' : adv.severity === 'Warning' ? '⚠️' : 'ℹ️'} {adv.severity}
                        </span>
                      </div>
                      <h3 className="font-bold text-stone-900 text-sm leading-snug">{language === 'bn' ? adv.titleBn : adv.title}</h3>
                      <div className="flex items-center gap-3 mt-1.5 text-[11px] text-stone-500">
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{adv.date}</span>
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{adv.district}</span>
                        <span>By: {adv.expertName}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => setExpandedBulletin(isExpanded ? null : adv.id)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-500 transition-colors flex-shrink-0"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                  {!isExpanded && (
                    <p className="text-xs text-stone-600 leading-relaxed mt-2 line-clamp-2">
                      {language === 'bn' ? adv.messageBn : adv.message}
                    </p>
                  )}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-stone-100 space-y-3 animate-slide-down">
                      <div>
                        <h4 className="text-xs font-bold text-stone-700 mb-1 flex items-center gap-1">
                          <Info className="w-3.5 h-3.5 text-teal-600" />
                          {t('Full Advisory Details', 'সম্পূর্ণ বিজ্ঞপ্তি')}
                        </h4>
                        <p className="text-xs text-stone-700 leading-relaxed bg-stone-50 p-3 rounded-xl border border-stone-100">
                          {language === 'bn' ? adv.messageBn : adv.message}
                        </p>
                      </div>
                      {adv.affectedCrops && adv.affectedCrops.length > 0 && (
                        <div>
                          <h4 className="text-xs font-bold text-stone-700 mb-1">{t('Affected Crops', 'প্রভাবিত ফসল')}</h4>
                          <div className="flex flex-wrap gap-1.5">
                            {adv.affectedCrops.map(crop => (
                              <span key={crop} className="text-[11px] bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full font-medium">
                                🌾 {crop}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="bg-teal-50 p-3 rounded-xl border border-teal-100 text-[11px] text-teal-800">
                        <strong>Published by:</strong> {adv.expertName} ({adv.designation || 'Agricultural Specialist'}) •{' '}
                        <strong>Region:</strong> {adv.district} • <strong>Date:</strong> {adv.date}
                      </div>
                      <div className={`p-3 rounded-xl border text-[11px] font-medium ${
                        adv.severity === 'Urgent' ? 'bg-red-50 border-red-200 text-red-800'
                        : adv.severity === 'Warning' ? 'bg-amber-50 border-amber-200 text-amber-800'
                        : 'bg-blue-50 border-blue-200 text-blue-800'
                      }`}>
                        {adv.severity === 'Urgent' && '🔴 '}
                        {adv.severity === 'Warning' && '⚠️ '}
                        {adv.severity === 'Information' && 'ℹ️ '}
                        <strong>Official Notice:</strong> This bulletin has been issued by a verified agricultural expert and broadcast to all registered farmers in {adv.district}. Please follow the recommended actions promptly.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── MODAL: Broadcast Advisory ─── */}
      {showBroadcastModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-stone-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <h3 className="font-bold text-stone-900 text-base flex items-center gap-2">
                <BellRing className="w-5 h-5 text-teal-600" />
                <span>{t('Publish Regional Agro Bulletin', 'আঞ্চলিক কৃষি বুলেটিন প্রকাশ করুন')}</span>
              </h3>
              <button onClick={() => setShowBroadcastModal(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-stone-100 text-stone-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmitAdvisory} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Bulletin Title (English) *</label>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Heavy Fog Advisory: Potato Late Blight Prevention"
                  className="w-full border border-stone-300 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-teal-400 text-sm" required />
              </div>
              <div>
                <label className="block font-semibold text-stone-700 mb-1">শিরোনাম (বাংলা)</label>
                <input type="text" value={titleBn} onChange={e => setTitleBn(e.target.value)}
                  placeholder="যেমন: কুয়াশা সতর্কতা: আলুর নাবি ধসা রোগ প্রতিরোধ"
                  className="w-full border border-stone-300 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-teal-400" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Category</label>
                  <select value={category} onChange={e => setCategory(e.target.value as AgroAdvisory['category'])}
                    className="w-full border border-stone-300 rounded-xl p-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-teal-400">
                    <option value="Weather Alert">Weather Alert / আবহাওয়া সতর্কতা</option>
                    <option value="Pest Outbreak">Pest Outbreak / পোকা বা রোগ সংক্রমণ</option>
                    <option value="Soil Advice">Soil & Fertilizer / সার ও মাটি</option>
                    <option value="Market Alert">Market Alert / বাজার সতর্কতা</option>
                    <option value="Price Warning">Price Warning / দর সতর্কতা</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Severity</label>
                  <select value={severity} onChange={e => setSeverity(e.target.value as any)}
                    className="w-full border border-stone-300 rounded-xl p-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-teal-400">
                    <option value="Warning">⚠️ Warning / সতর্কতা</option>
                    <option value="Urgent">🔴 Urgent / জরুরি</option>
                    <option value="Information">ℹ️ Information / তথ্য</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Advisory Details (English) *</label>
                <textarea rows={3} value={message} onChange={e => setMessage(e.target.value)}
                  placeholder="Provide precise preventive steps, medicine doses, and cultural practices..."
                  className="w-full border border-stone-300 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none" required />
              </div>
              <div>
                <label className="block font-semibold text-stone-700 mb-1">পরামর্শের বিস্তারিত (বাংলা)</label>
                <textarea rows={3} value={messageBn} onChange={e => setMessageBn(e.target.value)}
                  placeholder="সঠিক প্রতিরোধমূলক পদক্ষেপ, ওষুধের মাত্রা ও কৃষি পদ্ধতি লিখুন..."
                  className="w-full border border-stone-300 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none" />
              </div>
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Affected Crops (comma-separated)</label>
                <input type="text" value={affectedCrops} onChange={e => setAffectedCrops(e.target.value)}
                  placeholder="e.g. Potato, Tomato, Cauliflower"
                  className="w-full border border-stone-300 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-teal-400" />
              </div>
              <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 text-[11px] text-teal-800">
                <strong>Publication Note:</strong> This bulletin will be visible to all farmers in {currentUser?.district || 'Bogura'} district and stored in the regional advisory feed with a timestamp.
              </div>
              <div className="pt-2 flex items-center justify-end gap-2">
                <button type="button" onClick={() => setShowBroadcastModal(false)}
                  className="px-4 py-2.5 font-semibold text-stone-600 hover:bg-stone-100 rounded-xl transition-colors">
                  {t('Cancel', 'বাতিল')}
                </button>
                <button type="submit" className="bg-teal-700 hover:bg-teal-800 text-white font-bold px-4 py-2.5 rounded-xl shadow-sm flex items-center gap-1.5 transition-all hover:scale-105">
                  <Send className="w-3.5 h-3.5" />
                  <span>{t('Publish Bulletin', 'বুলেটিন প্রকাশ করুন')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
