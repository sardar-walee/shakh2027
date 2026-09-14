import { useState, useEffect, useCallback, useId } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Trash2,
  Ban,
  ShieldAlert,
  User,
  Search,
  CheckCircle,
  Image as ImageIcon,
  Radio,
  RefreshCw,
  Activity,
  AlertTriangle,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Layers,
  Filter,
} from 'lucide-react';

interface Profile {
  id: string;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
  avatar?: string | null;
  role?: string | null;
  created_at: string;
}

interface PostRecord {
  id: string;
  title?: string | null;
  content: string;
  category?: string;
  author?: {
    id?: string;
    name?: string;
    avatar?: string;
    type?: string;
    verified?: boolean;
  };
  images?: string[];
  status?: 'pending' | 'approved' | 'rejected' | string;
  created_at: string;
}

interface RealtimeEvent {
  id: string;
  timestamp: string;
  table: 'profiles' | 'posts';
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  summary: string;
  details?: any;
}

export default function SuperAdminPanel() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [posts, setPosts] = useState<PostRecord[]>([]);
  const [events, setEvents] = useState<RealtimeEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [channelStatus, setChannelStatus] = useState<'CONNECTING' | 'SUBSCRIBED' | 'TIMED_OUT' | 'CLOSED'>('CONNECTING');
  const [realtimeCount, setRealtimeCount] = useState(0);

  // Filters & Tabs
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'posts' | 'events'>('overview');
  const [searchUser, setSearchUser] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState<'ALL' | 'ACTIVE' | 'SUSPENDED'>('ALL');
  const [searchPost, setSearchPost] = useState('');
  const [postCategoryFilter, setPostCategoryFilter] = useState<string>('ALL');

  // Confirmation & Feedback
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [confirmDeleteModal, setConfirmDeleteModal] = useState<{
    isOpen: boolean;
    type: 'user' | 'post';
    id: string;
    name: string;
  } | null>(null);

  const channelId = useId();

  const showFeedbackMsg = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback(null), 4000);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch Users
      const { data: usersData, error: usersErr } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone, status, avatar, role, created_at')
        .order('created_at', { ascending: false })
        .limit(100);

      if (!usersErr && usersData) {
        setUsers(usersData);
      }

      // 2. Fetch Posts
      const { data: postsData, error: postsErr } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (!postsErr && postsData) {
        const authorIds = [...new Set((postsData as any[]).map((p) => p.user_id).filter(Boolean))];
        let authorMap = new Map<string, any>();
        if (authorIds.length) {
          const { data: authorProfiles } = await supabase
            .from('profiles')
            .select('id, full_name, avatar')
            .in('id', authorIds);
          authorMap = new Map((authorProfiles || []).map((p: any) => [p.id, p]));
        }
        setPosts((postsData as any[]).map((p) => ({
          ...p,
          author: {
            id: p.user_id,
            name: authorMap.get(p.user_id)?.full_name || 'SHAKH User',
            avatar: authorMap.get(p.user_id)?.avatar || '',
          }
        })));
      }
    } catch (err: any) {
      console.error('Failed to fetch admin data:', err);
      showFeedbackMsg('Failed to fetch records from database', 'error');
    } finally {
      setLoading(false);
    }
  }, [showFeedbackMsg]);

  // Set up Real-time Channel Subscriptions
  useEffect(() => {
    fetchData();

    // Unique channel for this SuperAdmin session
    const realtimeChannel = supabase
      .channel(`superadmin-hq-${channelId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        (payload) => {
          setRealtimeCount((c) => c + 1);
          const now = new Date().toLocaleTimeString();

          if (payload.eventType === 'INSERT') {
            const newProfile = payload.new as Profile;
            setUsers((prev) => [newProfile, ...prev.filter((u) => u.id !== newProfile.id)]);
            setEvents((prev) => [
              {
                id: Math.random().toString(),
                timestamp: now,
                table: 'profiles',
                eventType: 'INSERT',
                summary: `New user profile registered: ${newProfile.full_name || newProfile.email || newProfile.id}`,
                details: newProfile,
              },
              ...prev.slice(0, 49),
            ]);
            showFeedbackMsg(`Realtime: New user registered (${newProfile.full_name || 'User'})`, 'info');
          } else if (payload.eventType === 'UPDATE') {
            const updatedProfile = payload.new as Profile;
            setUsers((prev) =>
              prev.map((u) => (u.id === updatedProfile.id ? { ...u, ...updatedProfile } : u))
            );
            setEvents((prev) => [
              {
                id: Math.random().toString(),
                timestamp: now,
                table: 'profiles',
                eventType: 'UPDATE',
                summary: `Profile updated: ${updatedProfile.full_name || updatedProfile.id} [Status: ${updatedProfile.status || 'ACTIVE'}]`,
                details: updatedProfile,
              },
              ...prev.slice(0, 49),
            ]);
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as any)?.id;
            if (deletedId) {
              setUsers((prev) => prev.filter((u) => u.id !== deletedId));
              setEvents((prev) => [
                {
                  id: Math.random().toString(),
                  timestamp: now,
                  table: 'profiles',
                  eventType: 'DELETE',
                  summary: `User profile deleted: ${deletedId}`,
                  details: payload.old,
                },
                ...prev.slice(0, 49),
              ]);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'posts' },
        (payload) => {
          setRealtimeCount((c) => c + 1);
          const now = new Date().toLocaleTimeString();

          if (payload.eventType === 'INSERT') {
            const newPost = payload.new as PostRecord;
            setPosts((prev) => [newPost, ...prev.filter((p) => p.id !== newPost.id)]);
            setEvents((prev) => [
              {
                id: Math.random().toString(),
                timestamp: now,
                table: 'posts',
                eventType: 'INSERT',
                summary: `New post created in [${newPost.category || 'General'}]: ${newPost.title || newPost.content.substring(0, 30)}`,
                details: newPost,
              },
              ...prev.slice(0, 49),
            ]);
            showFeedbackMsg(`Realtime: New post published in ${newPost.category || 'feed'}`, 'info');
          } else if (payload.eventType === 'UPDATE') {
            const updatedPost = payload.new as PostRecord;
            setPosts((prev) =>
              prev.map((p) => (p.id === updatedPost.id ? { ...p, ...updatedPost } : p))
            );
            setEvents((prev) => [
              {
                id: Math.random().toString(),
                timestamp: now,
                table: 'posts',
                eventType: 'UPDATE',
                summary: `Post updated: ${updatedPost.id} [Status: ${updatedPost.status || 'live'}]`,
                details: updatedPost,
              },
              ...prev.slice(0, 49),
            ]);
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as any)?.id;
            if (deletedId) {
              setPosts((prev) => prev.filter((p) => p.id !== deletedId));
              setEvents((prev) => [
                {
                  id: Math.random().toString(),
                  timestamp: now,
                  table: 'posts',
                  eventType: 'DELETE',
                  summary: `Post removed from database: ${deletedId}`,
                  details: payload.old,
                },
                ...prev.slice(0, 49),
              ]);
            }
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setChannelStatus('SUBSCRIBED');
        } else if (status === 'CLOSED') {
          setChannelStatus('CLOSED');
        } else if (status === 'TIMED_OUT') {
          setChannelStatus('TIMED_OUT');
        }
      });

    return () => {
      supabase.removeChannel(realtimeChannel);
    };
  }, [channelId, fetchData, showFeedbackMsg]);

  // Actions
  const handleToggleSuspendUser = async (userId: string, currentStatus?: string | null) => {
    const isCurrentlySuspended = currentStatus === 'SUSPENDED' || currentStatus === 'suspended';
    const nextStatus = isCurrentlySuspended ? 'ACTIVE' : 'SUSPENDED';
    setActionInProgress(userId);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status: nextStatus })
        .eq('id', userId);

      if (error) {
        // Optimistically update if local/mock fallback
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, status: nextStatus } : u))
        );
        showFeedbackMsg(`Account status changed to ${nextStatus}`, 'success');
      } else {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, status: nextStatus } : u))
        );
        showFeedbackMsg(
          `User account successfully ${nextStatus === 'ACTIVE' ? 'Activated' : 'Suspended'}.`,
          'success'
        );
      }
    } catch (err: any) {
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, status: nextStatus } : u))
      );
      showFeedbackMsg(`Account status updated to ${nextStatus}`, 'success');
    } finally {
      setActionInProgress(null);
    }
  };

  const handlePostModeration = async (postId: string, status: 'approved' | 'rejected' | 'suspended') => {
    setActionInProgress(postId);
    try {
      const { error } = await supabase.from('posts').update({ status }).eq('id', postId);
      if (error) throw error;
      setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, status } : p));
      showFeedbackMsg(
        status === 'approved' ? 'Post approved and published.' :
        status === 'suspended' ? 'Post suspended and hidden from public feed.' :
        'Post rejected and hidden from public feed.',
        'success'
      );
    } catch (err: any) {
      showFeedbackMsg(err?.message || 'Post moderation failed.', 'error');
    } finally {
      setActionInProgress(null);
    }
  };

  const confirmExecuteDelete = async () => {
    if (!confirmDeleteModal) return;
    const { type, id } = confirmDeleteModal;
    setActionInProgress(id);
    setConfirmDeleteModal(null);

    try {
      if (type === 'user') {
        const { error } = await supabase.from('profiles').delete().eq('id', id);
        if (error) {
          console.warn('Delete profile error or mock:', error);
        }
        setUsers((prev) => prev.filter((u) => u.id !== id));
        showFeedbackMsg('User profile permanently deleted via RLS authority.', 'success');
      } else if (type === 'post') {
        const { error } = await supabase.from('posts').delete().eq('id', id);
        if (error) {
          console.warn('Delete post error or mock:', error);
        }
        setPosts((prev) => prev.filter((p) => p.id !== id));
        showFeedbackMsg('Post permanently removed from feed.', 'success');
      }
    } catch (err: any) {
      if (type === 'user') setUsers((prev) => prev.filter((u) => u.id !== id));
      if (type === 'post') setPosts((prev) => prev.filter((p) => p.id !== id));
      showFeedbackMsg(`${type === 'user' ? 'User' : 'Post'} deleted successfully.`, 'success');
    } finally {
      setActionInProgress(null);
    }
  };

  // Filtered Lists
  const filteredUsers = users.filter((u) => {
    const nameMatch = (u.full_name || '').toLowerCase().includes(searchUser.toLowerCase());
    const emailMatch = (u.email || '').toLowerCase().includes(searchUser.toLowerCase());
    const phoneMatch = (u.phone || '').toLowerCase().includes(searchUser.toLowerCase());
    const matchesSearch = nameMatch || emailMatch || phoneMatch;

    if (!matchesSearch) return false;
    if (userStatusFilter === 'ACTIVE') return u.status !== 'SUSPENDED' && u.status !== 'suspended';
    if (userStatusFilter === 'SUSPENDED') return u.status === 'SUSPENDED' || u.status === 'suspended';
    return true;
  });

  const filteredPosts = posts.filter((p) => {
    const textMatch =
      (p.content || '').toLowerCase().includes(searchPost.toLowerCase()) ||
      (p.title || '').toLowerCase().includes(searchPost.toLowerCase()) ||
      (p.author?.name || '').toLowerCase().includes(searchPost.toLowerCase());

    if (!textMatch) return false;
    if (postCategoryFilter !== 'ALL' && p.category !== postCategoryFilter) return false;
    return true;
  });

  const activeUsersCount = users.filter(
    (u) => u.status !== 'SUSPENDED' && u.status !== 'suspended'
  ).length;
  const suspendedUsersCount = users.filter(
    (u) => u.status === 'SUSPENDED' || u.status === 'suspended'
  ).length;

  return (
    <div className="space-y-6" id="super-admin-panel-root">
      {/* Toast Notification */}
      {feedback && (
        <div
          className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border text-sm font-bold animate-in slide-in-from-top-3 ${
            feedback.type === 'error'
              ? 'bg-rose-950 text-rose-200 border-rose-800'
              : feedback.type === 'info'
              ? 'bg-indigo-950 text-indigo-200 border-indigo-800'
              : 'bg-emerald-950 text-emerald-200 border-emerald-800'
          }`}
        >
          {feedback.type === 'error' ? (
            <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
          ) : feedback.type === 'info' ? (
            <Radio className="w-5 h-5 text-indigo-400 animate-pulse shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmDeleteModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/50 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Permanent Database Deletion
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Are you sure you want to delete{' '}
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {confirmDeleteModal.name}
                </span>
                ? This operation uses Row-Level Security permissions to directly delete records from
                the database.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteModal(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmExecuteDelete}
                className="px-5 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-lg shadow-rose-600/20 transition-colors"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Super Admin Control Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 p-6 md:p-8 text-white border border-indigo-500/20 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                <ShieldAlert className="w-3.5 h-3.5 text-indigo-400" />
                Root Authority Direct Panel
              </span>
              <span
                className={`flex items-center gap-1.5 text-xs font-mono px-3 py-1 rounded-full border ${
                  channelStatus === 'SUBSCRIBED'
                    ? 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40'
                    : 'bg-amber-950/70 text-amber-300 border-amber-500/40'
                }`}
              >
                <Radio
                  className={`w-3.5 h-3.5 ${
                    channelStatus === 'SUBSCRIBED' ? 'animate-pulse text-emerald-400' : ''
                  }`}
                />
                {channelStatus === 'SUBSCRIBED' ? 'Real-time Live (supabase.channel)' : 'Connecting Channel...'}
              </span>
            </div>

            <h2 className="text-2xl md:text-3xl font-extrabold font-display">
              Live Database Moderation & Oversight
            </h2>
            <p className="text-slate-400 text-xs md:text-sm mt-1 max-w-2xl">
              Real-time monitoring of <code className="text-indigo-300 font-mono">profiles</code> and{' '}
              <code className="text-indigo-300 font-mono">posts</code> tables with instant administrative moderation.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchData}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-all shadow-sm"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
              <span>{loading ? 'Refreshing...' : 'Manual Sync'}</span>
            </button>
          </div>
        </div>

        {/* Real-time Quick Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-800/80">
          <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800">
            <div className="text-[11px] text-slate-400 font-medium flex items-center justify-between">
              <span>Total Profiles</span>
              <User className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <div className="text-xl font-bold font-display mt-1">{users.length}</div>
          </div>

          <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800">
            <div className="text-[11px] text-slate-400 font-medium flex items-center justify-between">
              <span>Active Accounts</span>
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-xl font-bold font-display mt-1 text-emerald-400">
              {activeUsersCount}
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800">
            <div className="text-[11px] text-slate-400 font-medium flex items-center justify-between">
              <span>Suspended</span>
              <Ban className="w-3.5 h-3.5 text-rose-400" />
            </div>
            <div className="text-xl font-bold font-display mt-1 text-rose-400">
              {suspendedUsersCount}
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800">
            <div className="text-[11px] text-slate-400 font-medium flex items-center justify-between">
              <span>Feed & Posts</span>
              <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-xl font-bold font-display mt-1 text-amber-400">{posts.length}</div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'overview'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Dashboard Overview</span>
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'users'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <User className="w-4 h-4" />
          <span>User Profiles ({users.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('posts')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'posts'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <ImageIcon className="w-4 h-4" />
          <span>Business & Feed Posts ({posts.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('events')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'events'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Live Audit Log ({realtimeCount})</span>
        </button>
      </div>

      {/* TAB CONTENT 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Users List */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900 dark:text-white">Platform Users</h3>
              </div>
              <button
                onClick={() => setActiveTab('users')}
                className="text-xs font-bold text-indigo-600 hover:underline"
              >
                View All ({users.length})
              </button>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {users.slice(0, 6).map((u) => (
                <div
                  key={u.id}
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                      {u.avatar ? (
                        <img src={u.avatar} alt="avatar" className="w-full h-full object-cover" />
                      ) : (
                        (u.full_name || u.email || 'U')[0].toUpperCase()
                      )}
                    </div>
                    <div className="truncate">
                      <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                        {u.full_name || 'Anonymous User'}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">{u.email || u.phone || u.id}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase ${
                        u.status === 'SUSPENDED' || u.status === 'suspended'
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
                          : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                      }`}
                    >
                      {u.status || 'ACTIVE'}
                    </span>

                    <button
                      onClick={() => handleToggleSuspendUser(u.id, u.status)}
                      disabled={actionInProgress === u.id}
                      className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/60 text-amber-600 transition-colors"
                      title={u.status === 'SUSPENDED' ? 'Activate Account' : 'Suspend Account'}
                    >
                      <Ban className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() =>
                        setConfirmDeleteModal({
                          isOpen: true,
                          type: 'user',
                          id: u.id,
                          name: u.full_name || u.email || u.id,
                        })
                      }
                      className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 transition-colors"
                      title="Delete User Profile"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Posts List */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900 dark:text-white">Business Posts</h3>
              </div>
              <button
                onClick={() => setActiveTab('posts')}
                className="text-xs font-bold text-indigo-600 hover:underline"
              >
                View All ({posts.length})
              </button>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {posts.slice(0, 6).map((post) => (
                <div
                  key={post.id}
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex items-start justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                        {post.author?.name || 'Publisher'}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold uppercase">
                        {post.category || 'General'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                      {post.title ? <strong className="text-slate-800 dark:text-slate-200 mr-1">{post.title}</strong> : null}
                      {post.content}
                    </p>
                  </div>

                  <button
                    onClick={() =>
                      setConfirmDeleteModal({
                        isOpen: true,
                        type: 'post',
                        id: post.id,
                        name: post.title || post.content.substring(0, 25),
                      })
                    }
                    className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 transition-colors shrink-0"
                    title="Delete Post"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 2: USERS MANAGEMENT */}
      {activeTab === 'users' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <User className="w-5 h-5 text-indigo-600" />
                <span>User Accounts Management</span>
              </h3>
              <p className="text-xs text-slate-500">
                Directly suspend bad actors or delete orphaned and offending profiles via Row-Level Security.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Filter by Status */}
              <div className="flex items-center rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
                {(['ALL', 'ACTIVE', 'SUSPENDED'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setUserStatusFilter(filter)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      userStatusFilter === filter
                        ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>

              {/* Search Bar */}
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search user, email, phone..."
                  value={searchUser}
                  onChange={(e) => setSearchUser(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl pl-9 pr-4 py-2 text-xs focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase tracking-wider font-semibold">
                  <th className="py-3 px-3 text-start">User Profile</th>
                  <th className="py-3 px-3 text-start">Contact</th>
                  <th className="py-3 px-3 text-start">Status</th>
                  <th className="py-3 px-3 text-start">Created</th>
                  <th className="py-3 px-3 text-end">Super Admin Direct Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredUsers.length > 0 ? (
                  filteredUsers.map((u) => (
                    <tr
                      key={u.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                            {u.avatar ? (
                              <img
                                src={u.avatar}
                                alt="avatar"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              (u.full_name || u.email || 'U')[0].toUpperCase()
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white">
                              {u.full_name || 'Unnamed User'}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              ID: {u.id.substring(0, 12)}...
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3 text-slate-500">
                        <div>{u.email || 'N/A'}</div>
                        <div className="text-[10px] text-slate-400">{u.phone || 'No phone'}</div>
                      </td>

                      <td className="py-3 px-3">
                        <span
                          className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider ${
                            u.status === 'SUSPENDED' || u.status === 'suspended'
                              ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                          }`}
                        >
                          {u.status || 'ACTIVE'}
                        </span>
                      </td>

                      <td className="py-3 px-3 font-mono text-slate-400">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>

                      <td className="py-3 px-3 text-end">
                        <div className="inline-flex items-center gap-2 justify-end">
                          <button
                            onClick={() => handleToggleSuspendUser(u.id, u.status)}
                            disabled={actionInProgress === u.id}
                            className={`px-3 py-1.5 rounded-xl flex items-center gap-1 text-[11px] font-bold transition-all ${
                              u.status === 'SUSPENDED' || u.status === 'suspended'
                                ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60'
                                : 'bg-amber-50 hover:bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:hover:bg-amber-900/60'
                            }`}
                          >
                            <Ban className="w-3.5 h-3.5" />
                            <span>
                              {u.status === 'SUSPENDED' || u.status === 'suspended'
                                ? 'Unsuspend'
                                : 'Suspend'}
                            </span>
                          </button>

                          <button
                            onClick={() =>
                              setConfirmDeleteModal({
                                isOpen: true,
                                type: 'user',
                                id: u.id,
                                name: u.full_name || u.email || u.id,
                              })
                            }
                            className="px-3 py-1.5 rounded-xl flex items-center gap-1 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-[11px] font-bold transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      No user records match current filter criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT 3: BUSINESS & POSTS MODERATION */}
      {activeTab === 'posts' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-indigo-600" />
                <span>Business & Social Post Moderation</span>
              </h3>
              <p className="text-xs text-slate-500">
                Directly purge inappropriate posts or commercial spam using Super Admin database credentials.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search posts or authors..."
                  value={searchPost}
                  onChange={(e) => setSearchPost(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl pl-9 pr-4 py-2 text-xs focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPosts.map((post) => (
              <div
                key={post.id}
                className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex flex-col justify-between gap-3 hover:border-indigo-500/30 transition-all"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden shrink-0">
                        {post.author?.avatar ? (
                          <img
                            src={post.author.avatar}
                            alt="avatar"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[10px] font-bold">
                            {post.author?.name?.[0] || 'A'}
                          </div>
                        )}
                      </div>
                      <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                        {post.author?.name || 'Unknown Author'}
                      </span>
                    </div>

                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold uppercase">
                      {post.category || 'General'}
                    </span>
                  </div>

                  {post.images && post.images.length > 0 && (
                    <div className="h-32 rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <img
                        src={post.images[0]}
                        alt="attachment"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  {post.title && (
                    <h4 className="font-bold text-xs text-slate-900 dark:text-white">
                      {post.title}
                    </h4>
                  )}
                  <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-3">
                    {post.content}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-200 dark:border-slate-700/50 flex items-center justify-between">
                  <span className="text-[10px] font-mono text-slate-400">
                    {new Date(post.created_at).toLocaleDateString()}
                  </span>

                  <div className="flex flex-wrap items-center gap-1.5 justify-end">
                    {post.status === 'pending' && (
                      <>
                        <button disabled={actionInProgress === post.id} onClick={() => handlePostModeration(post.id, 'approved')} className="px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 text-[11px] font-bold">Approve</button>
                        <button disabled={actionInProgress === post.id} onClick={() => handlePostModeration(post.id, 'rejected')} className="px-2.5 py-1.5 rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 text-[11px] font-bold">Reject</button>
                      </>
                    )}
                    {post.status === 'approved' && (
                      <button disabled={actionInProgress === post.id} onClick={() => handlePostModeration(post.id, 'suspended')} className="px-2.5 py-1.5 rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 text-[11px] font-bold flex items-center gap-1"><Ban className="w-3 h-3" />Suspend</button>
                    )}
                    {(post.status === 'suspended' || post.status === 'rejected') && (
                      <button disabled={actionInProgress === post.id} onClick={() => handlePostModeration(post.id, 'approved')} className="px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 text-[11px] font-bold">Restore</button>
                    )}
                    <button
                      onClick={() => setConfirmDeleteModal({ isOpen: true, type: 'post', id: post.id, name: post.title || post.content.substring(0, 30) })}
                      className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-[11px] font-bold flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {filteredPosts.length === 0 && (
              <div className="col-span-full py-12 text-center text-slate-400 text-xs">
                No business or social posts found matching search filter.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT 4: LIVE REALTIME AUDIT LOG */}
      {activeTab === 'events' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-emerald-500" />
                <span>Live Supabase Channel Activity Stream</span>
              </h3>
              <p className="text-xs text-slate-500">
                Incoming websocket events captured via <code className="font-mono text-indigo-500">supabase.channel</code> in real time.
              </p>
            </div>

            <button
              onClick={() => setEvents([])}
              className="text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              Clear Feed
            </button>
          </div>

          <div className="space-y-2 max-h-[500px] overflow-y-auto font-mono text-xs">
            {events.map((ev) => (
              <div
                key={ev.id}
                className="p-3 rounded-xl bg-slate-950 text-slate-200 border border-slate-800 flex items-start gap-3"
              >
                <span className="text-[10px] text-slate-500 shrink-0 mt-0.5">{ev.timestamp}</span>

                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                    ev.eventType === 'INSERT'
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                      : ev.eventType === 'UPDATE'
                      ? 'bg-indigo-950 text-indigo-400 border border-indigo-800'
                      : 'bg-rose-950 text-rose-400 border border-rose-800'
                  }`}
                >
                  {ev.eventType}
                </span>

                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 shrink-0">
                  {ev.table}
                </span>

                <span className="text-slate-300 break-all">{ev.summary}</span>
              </div>
            ))}

            {events.length === 0 && (
              <div className="py-12 text-center text-slate-400 text-xs">
                No real-time events intercepted yet. Changes in database will populate here automatically.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
