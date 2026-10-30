import React, { useState, useEffect, useRef, useCallback } from 'react';
import { User, Language, UserRole, UserConnection, DirectMessage, CallLog } from '../types';
import { ConnectionStore, MessageStore, CallStore, AuthStore, NotificationStore, isDemoAccount } from '../data/store';
import { toBanglaNumber } from './Header';
import { apiService } from '../services/apiService';
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
  ChevronRight,
  User as UserIcon,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  RefreshCw,
  AlertCircle,
  Loader2,
  X,
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
  wholesaler: [
    { en: 'I am interested in procuring your wholesale stock.', bn: 'আপনার পাইকারি লট ক্রয়ে আগ্রহী।' },
    { en: 'Can we arrange escrow payment for harvest contract?', bn: 'এসক্রো পেমেন্টে ফসল চুক্তি করা যাবে কি?' },
    { en: 'What is your required delivery schedule?', bn: 'ডেলিভারির নির্ধারিত সময়সূচী কি?' },
  ],
  retailer: [
    { en: 'Do you have fresh stock currently available?', bn: 'তাজা পণ্য কি বর্তমানে স্টকে আছে?' },
    { en: 'What is the wholesale lot price?', bn: 'পাইকারি লট মূল্য কত?' },
    { en: 'Can you deliver to our local shop outlet?', bn: 'দোকান আউটলেটে ডেলিভারি সম্ভব কি?' },
  ],
  consumer: [
    { en: 'Is fresh delivery available today?', bn: 'আজকে কি সরাসরি ডেলিভারি পাওয়া যাবে?' },
    { en: 'What is the minimum order quantity?', bn: 'সর্বনিম্ন কত কেজি অর্ডার দেওয়া যাবে?' },
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

  // ── Directory state ──────────────────────────────────────────────────
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<UserRole | 'all'>('all');
  const [selectedDistrictFilter, setSelectedDistrictFilter] = useState<string>('all');
  const [directoryUsers, setDirectoryUsers] = useState<User[]>([]);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [directoryError, setDirectoryError] = useState<string | null>(null);
  const [directoryTotal, setDirectoryTotal] = useState(0);

  // ── Local fallback: connections & call logs (localStorage) ──────────
  const [connections, setConnections] = useState<UserConnection[]>([]);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);

  // ── Chat / Inbox state ───────────────────────────────────────────────
  const [activeChatUser, setActiveChatUser] = useState<User | null>(null);
  const [unreadCount, setUnreadCount] = useState<number>(() => MessageStore.getUnreadCount(currentUser.id));
  const [chatMessages, setChatMessages] = useState<DirectMessage[]>([]);
  const [chatPartners, setChatPartners] = useState<User[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── SSE real-time connection ──────────────────────────────────────────
  const sseRef = useRef<EventSource | null>(null);
  const activeChatUserRef = useRef<User | null>(null);
  activeChatUserRef.current = activeChatUser;

  const t = (en: string, bn: string) => (language === 'bn' ? bn : en);

  // Role-Based Directory Visibility:
  // - Farmer: Show ONLY Farmers and Wholesalers (hide Retailers and Consumers).
  // - Wholesaler: Show ONLY Farmers, Wholesalers, and Retailers (hide Consumers).
  // - Retailer: Show ONLY Wholesalers, Retailers, and Consumers (hide Farmers).
  // - Consumer: Show ONLY Retailers and connected Consumers (hide Farmers and Wholesalers).
  const isUserAuthorizedForViewer = useCallback((targetUser: User): boolean => {
    if (!targetUser || !targetUser.id) return false;
    if (targetUser.id === currentUser.id) return false;
    if (targetUser.role === 'admin') return false;
    if (isDemoAccount(targetUser)) return false;

    const viewerRole = currentUser.role;
    if (viewerRole === 'farmer') {
      return targetUser.role === 'farmer' || targetUser.role === 'wholesaler';
    }
    if (viewerRole === 'wholesaler') {
      return targetUser.role === 'farmer' || targetUser.role === 'wholesaler' || targetUser.role === 'retailer';
    }
    if (viewerRole === 'retailer') {
      return targetUser.role === 'wholesaler' || targetUser.role === 'retailer' || targetUser.role === 'consumer';
    }
    if (viewerRole === 'consumer') {
      if (targetUser.role === 'retailer') return true;
      if (targetUser.role === 'consumer') {
        const connStatus = ConnectionStore.getStatus(currentUser.id, targetUser.id);
        return connStatus === 'accepted';
      }
      return false;
    }
    return true;
  }, [currentUser.id, currentUser.role]);

  const roleOptionsForCurrentUser = React.useMemo(() => {
    const roleMap: Record<UserRole, UserRole[]> = {
      farmer: ['farmer', 'wholesaler'],
      wholesaler: ['farmer', 'wholesaler', 'retailer'],
      retailer: ['wholesaler', 'retailer', 'consumer'],
      consumer: ['retailer', 'consumer'],
      admin: ['farmer', 'wholesaler', 'retailer', 'consumer'],
    };
    const allowed = roleMap[currentUser.role] || ['farmer', 'wholesaler', 'retailer', 'consumer'];
    return (['all', ...allowed] as const);
  }, [currentUser.role]);

  // Ensure selected filter conforms to authorized roles
  useEffect(() => {
    if (selectedRoleFilter !== 'all' && !roleOptionsForCurrentUser.includes(selectedRoleFilter as any)) {
      setSelectedRoleFilter('all');
    }
  }, [roleOptionsForCurrentUser, selectedRoleFilter]);

  // ── Load directory (ONLY real registered users, NO mock/dummy users) ──
  const fetchDirectory = useCallback(async (search?: string) => {
    setDirectoryLoading(true);
    setDirectoryError(null);
    try {
      const result = await apiService.getUsers({
        excludeId: currentUser.id,
        viewerRole: currentUser.role,
        role: selectedRoleFilter !== 'all' ? selectedRoleFilter : undefined,
        district: selectedDistrictFilter !== 'all' ? selectedDistrictFilter : undefined,
        search: search ?? appliedSearch,
      });

      // Merge backend users with local AuthStore registered users
      const localUsers = AuthStore.getUsers();
      const userMap = new Map<string, User>();
      localUsers.forEach((u) => userMap.set(u.id, u));
      if (result.success && Array.isArray(result.users)) {
        result.users.forEach((u) => userMap.set(u.id, { ...userMap.get(u.id), ...u }));
      }

      // Strict filter: EXCLUDE ALL DEMO/MOCK/DUMMY USERS, ADMINS, AND CURRENT USER
      const query = (search ?? appliedSearch).trim().toLowerCase();
      const realUsers = Array.from(userMap.values()).filter((u) => {
        if (!isUserAuthorizedForViewer(u)) return false;

        // Role filter
        if (selectedRoleFilter !== 'all' && u.role !== selectedRoleFilter) return false;

        // District filter
        if (selectedDistrictFilter !== 'all' && u.district && u.district.toLowerCase() !== selectedDistrictFilter.toLowerCase()) {
          return false;
        }

        // Search query
        if (query) {
          const matchName = (u.name && u.name.toLowerCase().includes(query)) || (u.nameBn && u.nameBn.includes(query));
          const matchPhone = u.phone && u.phone.includes(query);
          const matchDistrict = u.district && u.district.toLowerCase().includes(query);
          const matchBiz = (u as any).businessName && (u as any).businessName.toLowerCase().includes(query);
          const matchShop = (u as any).shopName && (u as any).shopName.toLowerCase().includes(query);
          if (!matchName && !matchPhone && !matchDistrict && !matchBiz && !matchShop) return false;
        }

        return true;
      });

      setDirectoryUsers(realUsers);
      setDirectoryTotal(realUsers.length);
    } catch {
      const realUsers = AuthStore.getUsers().filter(
        (u) => isUserAuthorizedForViewer(u) && (selectedRoleFilter === 'all' || u.role === selectedRoleFilter)
      );
      setDirectoryUsers(realUsers);
      setDirectoryTotal(realUsers.length);
    } finally {
      setDirectoryLoading(false);
    }
  }, [currentUser.id, currentUser.role, selectedRoleFilter, selectedDistrictFilter, appliedSearch, isUserAuthorizedForViewer]);

  // Re-fetch on filter change
  useEffect(() => { fetchDirectory(appliedSearch); }, [selectedRoleFilter, selectedDistrictFilter]);

  // ── Local store data ──────────────────────────────────────────────────
  const refreshLocalData = useCallback(() => {
    setConnections(ConnectionStore.getByUser(currentUser.id));
    setCallLogs(CallStore.getByUser(currentUser.id));
  }, [currentUser.id]);

  // ── Chat partners from localStorage + backend ─────────────────────────
  const fetchChatPartners = useCallback(async () => {
    const localAll = MessageStore.getAll();
    const partnerIds = new Set<string>();
    localAll.forEach((m) => {
      if (m.senderId === currentUser.id) partnerIds.add(m.recipientId);
      if (m.recipientId === currentUser.id) partnerIds.add(m.senderId);
    });
    if (partnerIds.size > 0) {
      const partners: User[] = [];
      const allRegistered = AuthStore.getUsers();
      for (const pid of partnerIds) {
        const found = directoryUsers.find((u) => u.id === pid) || allRegistered.find((u) => u.id === pid);
        if (found) {
          if (!isDemoAccount(found)) partners.push(found);
          continue;
        }
        const res = await apiService.getUsers({});
        if (res.success) {
          const bu = res.users.find((u) => u.id === pid);
          if (bu && !isDemoAccount(bu)) partners.push(bu);
        }
      }
      setChatPartners(partners);
    }
  }, [currentUser.id, directoryUsers]);

  // ── Load conversation from backend ────────────────────────────────────
  const loadConversation = useCallback(async (otherUser: User) => {
    setChatLoading(true);
    try {
      const msgs = await apiService.getMessages(currentUser.id, otherUser.id);
      setChatMessages(msgs);
      await apiService.markMessagesRead(currentUser.id, otherUser.id);
    } catch {
      setChatMessages(MessageStore.getConversation(currentUser.id, otherUser.id));
    } finally {
      setChatLoading(false);
    }

    // Mark messages as seen in local MessageStore
    MessageStore.markRead(currentUser.id, otherUser.id);

    // Dismiss / mark read any notifications related to this conversation
    const notifs = NotificationStore.getAll();
    notifs.forEach((n) => {
      if (n.userId === currentUser.id && !n.read && n.actionUrl?.includes(otherUser.id)) {
        NotificationStore.markRead(n.id);
      }
    });

    // Reset unread count badge immediately
    setUnreadCount(MessageStore.getUnreadCount(currentUser.id));
  }, [currentUser.id]);

  // ── SSE: real-time message delivery ──────────────────────────────────
  useEffect(() => {
    if (!currentUser.id) return;
    if (sseRef.current) sseRef.current.close();
    const es = new EventSource(`/api/realtime?userId=${encodeURIComponent(currentUser.id)}`);
    sseRef.current = es;

    es.addEventListener('new_message', (e: MessageEvent) => {
      try {
        const { message } = JSON.parse(e.data) as { message: DirectMessage };
        if (activeChatUserRef.current &&
          (message.senderId === activeChatUserRef.current.id || message.recipientId === activeChatUserRef.current.id)) {
          setChatMessages((prev) => prev.some((m) => m.id === message.id) ? prev : [...prev, message]);
          apiService.markMessagesRead(currentUser.id, activeChatUserRef.current.id).catch(() => {});
          MessageStore.markRead(currentUser.id, activeChatUserRef.current.id);
          setUnreadCount(MessageStore.getUnreadCount(currentUser.id));
        } else {
          setUnreadCount(MessageStore.getUnreadCount(currentUser.id));
        }
        fetchChatPartners();
      } catch { /* ignore */ }
    });

    es.addEventListener('message_sent', (e: MessageEvent) => {
      try {
        const { message } = JSON.parse(e.data) as { message: DirectMessage };
        setChatMessages((prev) => prev.some((m) => m.id === message.id) ? prev : [...prev, message]);
      } catch { /* ignore */ }
    });

    es.onerror = () => {};
    return () => { es.close(); sseRef.current = null; };
  }, [currentUser.id]);

  // ── URL Navigation & Notification Redirection ───────────────────────
  const handleUrlNavigation = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    const targetUserId = params.get('userId');
    const action = params.get('action');
    const callerId = params.get('callerId');
    const callNotifId = params.get('callNotifId');

    if (tab === 'calls' || action === 'attend') {
      setActiveTab('calls');
      if (callNotifId) {
        NotificationStore.dismiss(callNotifId);
      }
      NotificationStore.dismissByUserAndType(currentUser.id, (n) =>
        n.title.includes('কল') || n.title.includes('Call') || (n.actionUrl?.includes('calls') ?? false)
      );
      if (action === 'attend' && callerId) {
        const allRegistered = AuthStore.getUsers();
        const caller = directoryUsers.find((u) => u.id === callerId) || allRegistered.find((u) => u.id === callerId);
        if (caller) {
          handleInitiateCall(caller);
        }
      }
    } else if (tab === 'connections') {
      setActiveTab('connections');
    } else if (tab === 'chat') {
      setActiveTab('chat');
      if (targetUserId) {
        const allRegistered = AuthStore.getUsers();
        const target = directoryUsers.find((u) => u.id === targetUserId) || allRegistered.find((u) => u.id === targetUserId);
        if (target) {
          handleSelectChat(target);
        }
      }
    }
  }, [directoryUsers, loadConversation, currentUser.id]);

  // Auto-dismiss call notifications when viewing Calls tab
  useEffect(() => {
    if (activeTab === 'calls') {
      NotificationStore.dismissByUserAndType(currentUser.id, (n) =>
        n.title.includes('কল') || n.title.includes('Call') || (n.actionUrl?.includes('calls') ?? false)
      );
    }
  }, [activeTab, currentUser.id]);

  useEffect(() => {
    handleUrlNavigation();
    window.addEventListener('popstate', handleUrlNavigation);
    return () => window.removeEventListener('popstate', handleUrlNavigation);
  }, [handleUrlNavigation]);

  // ── Initial load ──────────────────────────────────────────────────────
  useEffect(() => { fetchDirectory(''); refreshLocalData(); }, [currentUser.id]);
  useEffect(() => { fetchChatPartners(); }, [directoryUsers]);

  // Handle initial chat user from props
  useEffect(() => {
    if (initialChatUserId) {
      const allRegistered = AuthStore.getUsers();
      const target = directoryUsers.find((u) => u.id === initialChatUserId) || allRegistered.find((u) => u.id === initialChatUserId);
      if (target) { setActiveChatUser(target); setActiveTab('chat'); loadConversation(target); }
    }
  }, [initialChatUserId, directoryUsers, loadConversation]);

  // ── Real-time Cross-tab Sync & Fast Updates ──────────────────────────
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'nb_messages_v1') {
        if (activeChatUserRef.current) {
          const msgs = MessageStore.getConversation(currentUser.id, activeChatUserRef.current.id);
          setChatMessages(msgs);
        }
        fetchChatPartners();
        setUnreadCount(MessageStore.getUnreadCount(currentUser.id));
      }
      if (e.key === 'nb_connections_v1' || e.key === 'nb_notifications') {
        refreshLocalData();
      }
    };

    const handleMessagesUpdated = () => {
      setUnreadCount(MessageStore.getUnreadCount(currentUser.id));
      fetchChatPartners();
    };

    const handleUnreadUpdated = () => {
      setUnreadCount(MessageStore.getUnreadCount(currentUser.id));
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('nb_messages_updated', handleMessagesUpdated);
    window.addEventListener('nb_unread_updated', handleUnreadUpdated);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('nb_messages_updated', handleMessagesUpdated);
      window.removeEventListener('nb_unread_updated', handleUnreadUpdated);
    };
  }, [currentUser.id, fetchChatPartners, refreshLocalData]);

  // Live polling for conversation while chat window is active
  useEffect(() => {
    if (!activeChatUser) return;
    const interval = setInterval(() => {
      const msgs = MessageStore.getConversation(currentUser.id, activeChatUser.id);
      setChatMessages((prev) => {
        if (msgs.length !== prev.length || (msgs.length > 0 && prev.length > 0 && msgs[msgs.length - 1].id !== prev[prev.length - 1].id)) {
          return msgs;
        }
        return prev;
      });
      const hasUnread = msgs.some((m) => m.senderId === activeChatUser.id && !m.read);
      if (hasUnread) {
        MessageStore.markRead(currentUser.id, activeChatUser.id);
        setUnreadCount(MessageStore.getUnreadCount(currentUser.id));
      }
      refreshLocalData();
    }, 1500);
    return () => clearInterval(interval);
  }, [currentUser.id, activeChatUser?.id, refreshLocalData]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  // ── Search handlers ───────────────────────────────────────────────────
  const handleSearch = () => { setAppliedSearch(searchInput); fetchDirectory(searchInput); };
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') handleSearch(); };
  const handleResetFilters = () => {
    setSearchInput(''); setAppliedSearch('');
    setSelectedRoleFilter('all'); setSelectedDistrictFilter('all');
    fetchDirectory('');
  };

  // ── Call Handler with Real-time Notification ─────────────────────────
  const handleInitiateCall = (contact: User) => {
    // 1. Trigger call notification in store for target user
    CallStore.startCall(currentUser, contact);

    // 2. Dispatch real-time call signal to backend
    apiService.sendCallSignal({
      toUserId: contact.id,
      fromUserId: currentUser.id,
      fromUserName: currentUser.name,
      fromUserRole: currentUser.role,
      type: 'call_offer',
    }).catch(() => {});

    // 3. Open Interactive VoIP Call Modal
    onInitiateCall(contact);
  };

  // ── Chat handlers ─────────────────────────────────────────────────────
  const handleSelectChat = (contact: User) => {
    setActiveChatUser(contact);
    setActiveTab('chat');
    setSendError(null);
    MessageStore.markRead(currentUser.id, contact.id);
    setUnreadCount(MessageStore.getUnreadCount(currentUser.id));
    loadConversation(contact);
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeChatUser || !messageInput.trim() || sendingMessage) return;
    const content = messageInput.trim();
    setMessageInput('');
    setSendingMessage(true);
    setSendError(null);

    // Save locally and deliver persistent notification with chat link to recipient
    const localMsg = MessageStore.sendMessage({
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderRole: currentUser.role,
      recipientId: activeChatUser.id,
      recipientName: activeChatUser.name,
      recipientRole: activeChatUser.role,
      content,
    });
    setChatMessages((prev) => (prev.some((m) => m.id === localMsg.id) ? prev : [...prev, localMsg]));
    fetchChatPartners();

    // Also sync via backend API and dispatch SSE
    try {
      await apiService.sendMessage({
        senderId: currentUser.id,
        senderName: currentUser.name,
        senderRole: currentUser.role,
        recipientId: activeChatUser.id,
        recipientName: activeChatUser.name,
        recipientRole: activeChatUser.role,
        content,
      });
    } catch {
      // Offline / network fallback: already stored and notified locally
    } finally {
      setSendingMessage(false);
    }
  };

  const handleSendQuickMessage = async (text: string) => {
    if (!activeChatUser || sendingMessage) return;
    setSendingMessage(true);
    const localMsg = MessageStore.sendMessage({
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderRole: currentUser.role,
      recipientId: activeChatUser.id,
      recipientName: activeChatUser.name,
      recipientRole: activeChatUser.role,
      content: text,
    });
    setChatMessages((prev) => (prev.some((m) => m.id === localMsg.id) ? prev : [...prev, localMsg]));
    fetchChatPartners();

    try {
      await apiService.sendMessage({
        senderId: currentUser.id,
        senderName: currentUser.name,
        senderRole: currentUser.role,
        recipientId: activeChatUser.id,
        recipientName: activeChatUser.name,
        recipientRole: activeChatUser.role,
        content: text,
      });
    } catch {} finally {
      setSendingMessage(false);
    }
  };

  // ── Connection handlers ───────────────────────────────────────────────
  const handleConnectToggle = async (targetUser: User) => {
    const status = ConnectionStore.getStatus(currentUser.id, targetUser.id);
    if (status === 'none') {
      // Send connection request in store & notify target user
      ConnectionStore.sendRequest(currentUser, targetUser);
      try {
        await apiService.sendConnectionRequest(currentUser.id, targetUser.id);
      } catch {}
    } else if (status === 'pending_received') {
      // Accept incoming request directly
      const allConns = ConnectionStore.getAll();
      const existing = allConns.find(
        (c) => c.requesterId === targetUser.id && c.recipientId === currentUser.id
      );
      if (existing) {
        handleAcceptConnection(existing.id);
        return;
      }
    } else {
      const allConns = ConnectionStore.getAll();
      const existing = allConns.find((c) =>
        (c.requesterId === currentUser.id && c.recipientId === targetUser.id) ||
        (c.requesterId === targetUser.id && c.recipientId === currentUser.id)
      );
      if (existing) {
        await apiService.deleteConnection(existing.id).catch(() => {});
        ConnectionStore.remove(currentUser.id, targetUser.id);
      }
    }
    refreshLocalData();
  };

  const handleAcceptConnection = async (connId: string) => {
    await apiService.updateConnectionStatus(connId, 'accepted').catch(() => {});
    ConnectionStore.accept(connId); refreshLocalData();
  };

  const handleRejectConnection = async (connId: string) => {
    await apiService.updateConnectionStatus(connId, 'rejected').catch(() => {});
    ConnectionStore.reject(connId); refreshLocalData();
  };

  const pendingIncomingRequests = connections.filter((c) => c.recipientId === currentUser.id && c.status === 'pending');
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
              'Connect, Message & Call Farmers, Wholesalers, Retailers & Consumers',
              'কৃষক, পাইকার, খুচরা বিক্রেতা ও ভোক্তাদের সাথে সরাসরি সংযোগ, বার্তা ও কল'
            )}
          </h1>
          <p className="text-stone-300 text-xs md:text-sm leading-relaxed max-w-2xl">
            {t(
              'Interact securely with verified farmers, wholesalers, retailers, and consumers across Bangladesh.',
              'সারাদেশের যাচাইকৃত কৃষক, পাইকারি আড়তদার, খুচরা বিক্রেতা ও ভোক্তাদের সাথে ফোন বা সরাসরি চ্যাটের মাধ্যমে যোগাযোগ করুন।'
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
              {directoryTotal}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab('chat');
              if (!activeChatUser && chatPartners.length > 0) {
                handleSelectChat(chatPartners[0]);
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
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white px-1.5 py-0.5 rounded-full text-[10px] font-bold min-w-[18px] text-center animate-pulse">
                {language === 'bn' ? toBanglaNumber(unreadCount) : unreadCount}
              </span>
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
              {/* Search input with Bengali Search button */}
              <div className="flex-1 flex items-center gap-2">
                <div className="flex-1 relative">
                  <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="directory-search-input"
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    placeholder={t(
                      'Search by name, phone, crop (Potato, Tomato), business or specialty…',
                      'নাম, মোবাইল নম্বর, ফসল (আলু, টমেটো), ব্যবসা দিয়ে খুঁজুন…'
                    )}
                    className="w-full pl-10 pr-4 py-2.5 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-stone-800 transition-all"
                  />
                </div>
                <button
                  id="directory-search-btn"
                  onClick={handleSearch}
                  disabled={directoryLoading}
                  className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shrink-0 shadow-xs"
                >
                  {directoryLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Search className="w-3.5 h-3.5" />
                  )}
                  <span>খুঁজুন</span>
                </button>
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
              {roleOptionsForCurrentUser.map((r) => {
                const isSelected = selectedRoleFilter === r;
                return (
                  <button
                    key={r}
                    onClick={() => setSelectedRoleFilter(r)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
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
              {/* Always-visible Reset Filter button */}
              <button
                id="reset-filters-btn"
                onClick={handleResetFilters}
                className="ml-auto px-3 py-1 rounded-lg text-xs font-bold bg-stone-100 hover:bg-red-50 hover:text-red-700 text-stone-600 border border-stone-200 hover:border-red-200 transition-all whitespace-nowrap flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                <span>ফিল্টার রিসেট করুন</span>
              </button>
            </div>

            {/* Active search tag */}
            {appliedSearch && (
              <div className="flex items-center gap-2 text-xs text-stone-600">
                <span className="font-medium">{t('Results for:', 'খোঁজার ফলাফল:')}</span>
                <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                  "{appliedSearch}"
                </span>
                <button onClick={handleResetFilters} className="text-stone-400 hover:text-red-500 transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Loading state */}
          {directoryLoading && (
            <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center space-y-3">
              <Loader2 className="w-10 h-10 text-emerald-600 mx-auto animate-spin" />
              <p className="text-sm font-medium text-stone-600">
                {t('Loading registered users…', 'নিবন্ধিত ব্যবহারকারীদের তালিকা লোড হচ্ছে…')}
              </p>
            </div>
          )}

          {/* Error state */}
          {!directoryLoading && directoryError && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center space-y-3">
              <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
              <p className="text-sm font-bold text-red-700">{directoryError}</p>
              <button
                onClick={() => fetchDirectory(appliedSearch)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-colors inline-flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                {t('Retry', 'পুনরায় চেষ্টা করুন')}
              </button>
            </div>
          )}

          {/* Empty state */}
          {!directoryLoading && !directoryError && directoryUsers.length === 0 && (
            <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center space-y-3">
              <Users className="w-12 h-12 text-stone-300 mx-auto" />
              <h3 className="font-bold text-stone-700 text-sm">
                {appliedSearch || selectedRoleFilter !== 'all' || selectedDistrictFilter !== 'all'
                  ? t('No stakeholders found matching your filters', 'আপনার ফিল্টারের সাথে কোনো ব্যবহারকারী পাওয়া যায়নি')
                  : t('No registered users found', 'কোনো নিবন্ধিত ব্যবহারকারী পাওয়া যায়নি')}
              </h3>
              <p className="text-xs text-stone-400 max-w-sm mx-auto">
                {t('Try a different search term, or reset the role and district filters.', 'অন্য শব্দ দিয়ে অনুসন্ধান করুন অথবা ফিল্টার পরিবর্তন করুন।')}
              </p>
              {(appliedSearch || selectedRoleFilter !== 'all' || selectedDistrictFilter !== 'all') && (
                <button
                  onClick={handleResetFilters}
                  className="mt-2 px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold rounded-xl transition-colors"
                >
                  {t('Reset Filters', 'ফিল্টার রিসেট করুন')}
                </button>
              )}
            </div>
          )}

          {/* User Cards Grid */}
          {!directoryLoading && !directoryError && directoryUsers.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {directoryUsers.map((u) => {
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
                                <span title="Verified Member">
                                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-stone-500 font-medium">
                              {u.nameBn || u.email || ''}
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
                          <span>{(u as any).upazila ? `${(u as any).upazila}, ${u.district}` : u.district}</span>
                        </div>

                        {/* Role Extra Snippets */}
                        {u.role === 'farmer' && (u as any).primaryCrops && (
                          <div className="pt-1 text-[11px] text-emerald-700 font-medium">
                            🌱 {t('Crops:', 'ফসল:')} {(u as any).primaryCrops.join(', ')}
                          </div>
                        )}
                        {u.role === 'wholesaler' && (u as any).businessName && (
                          <div className="pt-1 text-[11px] text-blue-700 font-medium truncate">
                            🏢 {(u as any).businessName}
                          </div>
                        )}
                        {u.role === 'retailer' && (u as any).shopName && (
                          <div className="pt-1 text-[11px] text-amber-700 font-medium truncate">
                            🏪 {(u as any).shopName}
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
                          onClick={() => handleInitiateCall(u)}
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

                  const partnerUnread = MessageStore.getUnreadCount(currentUser.id, partner.id);

                  return (
                    <div
                      key={partner.id}
                      onClick={() => handleSelectChat(partner)}
                      className={`p-3.5 cursor-pointer transition-colors flex items-center gap-3 relative ${
                        isSelected ? 'bg-emerald-50/80 border-l-4 border-emerald-600' : 'hover:bg-stone-100/70'
                      }`}
                    >
                      <div className="relative shrink-0">
                        <div className="w-10 h-10 rounded-xl bg-stone-800 text-white flex items-center justify-center font-bold text-sm">
                          {partner.name.charAt(0)}
                        </div>
                        {partnerUnread > 0 && !isSelected && (
                          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center border-2 border-white animate-pulse">
                            {language === 'bn' ? toBanglaNumber(partnerUnread) : partnerUnread}
                          </span>
                        )}
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
                            {lastMsg.senderId === currentUser.id ? (language === 'bn' ? 'আপনি: ' : 'You: ') : ''}
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
                      onClick={() => handleInitiateCall(activeChatUser)}
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
                    'Direct communication allows instant negotiation between farmers, wholesalers, retailers, and consumers.',
                    'কৃষক, পাইকার, খুচরা বিক্রেতা ও ভোক্তাদের সাথে তাৎক্ষণিক যোগাযোগ ও চুক্তি সম্পাদনের সুযোগ।'
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
                  {t('Connect with farmers, wholesalers, and retailers to build your supply chain network.', 'আপনার সরবরাহ চেইনের সুবিধার্থে কৃষক, পাইকার ও খুচরা বিক্রেতাদের সাথে যুক্ত হোন।')}
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

                  const fullUser: User = directoryUsers.find((u) => u.id === partnerId) || chatPartners.find((u) => u.id === partnerId) || {
                    id: partnerId,
                    name: partnerName,
                    role: partnerRole,
                    phone: partnerPhone || '',
                    email: '',
                    password: '',
                    district: partnerDistrict || '',
                    verified: true,
                    createdAt: new Date().toISOString(),
                  };
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
                            if (fullUser) handleInitiateCall(fullUser);
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
                const otherId = isCaller ? log.receiverId : log.callerId;
                const otherUser: User = directoryUsers.find((u) => u.id === otherId) || chatPartners.find((u) => u.id === otherId) || {
                  id: otherId,
                  name: otherName,
                  role: otherRole,
                  phone: otherPhone || '',
                  email: '',
                  password: '',
                  district: '',
                  verified: true,
                  createdAt: new Date().toISOString(),
                };

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
                          onClick={() => handleInitiateCall(otherUser)}
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
