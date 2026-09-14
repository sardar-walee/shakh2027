import { create } from 'zustand';
import { Post, PostStory, PostComment } from '../types/post';
import { supabase } from '../lib/supabase';

interface SocialState {
  posts: Post[];
  stories: PostStory[];
  activePost: Post | null;
  activeStory: PostStory | null;
  shareModalPost: Post | null;
  activeCategory: string;
  searchQuery: string;
  loading: boolean;
  initialized: boolean;
  error: string | null;
  setSearchQuery: (q: string) => void;
  setActiveCategory: (cat: string) => void;
  toggleLikePost: (postId: string) => void;
  toggleLikeComment: (postId: string, commentId: string) => void;
  addComment: (postId: string, content: string, userName?: string) => void;
  incrementShareCount: (postId: string) => void;
  openPostDetail: (post: Post) => void;
  closePostDetail: () => void;
  openShareModal: (post: Post) => void;
  closeShareModal: () => void;
  openStory: (story: PostStory) => void;
  closeStory: () => void;
  nextPost: () => void;
  prevPost: () => void;
  createPost: (post: Partial<Post>) => Promise<Post | null>;
  deletePost: (postId: string) => Promise<boolean>;
  approvePost: (postId: string) => Promise<boolean>;
  rejectPost: (postId: string) => Promise<boolean>;
  suspendPost: (postId: string) => Promise<boolean>;
  restorePost: (postId: string) => Promise<boolean>;
  initializePosts: () => Promise<void>;
  syncRealtimePost: (payload: any) => void;
}

function mapDbPost(row: any, profile?: any): Post {
  const meta = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
  return {
    id: row.id,
    author: {
      id: row.user_id,
      name: profile?.full_name || meta.author_name || 'SHAKH',
      avatar: profile?.avatar || meta.author_avatar || '',
      verified: Boolean(meta.verified),
      type: meta.author_type || 'user',
      phone: profile?.phone || undefined,
      location: row.location_name || undefined,
      badge: meta.author_badge || undefined,
    },
    title: row.title || undefined,
    content: row.content || '',
    content_ku: row.content_ku || undefined,
    content_ar: row.content_ar || undefined,
    content_en: row.content_en || undefined,
    content_tr: row.content_tr || undefined,
    content_fa: row.content_fa || undefined,
    images: Array.isArray(row.images) ? row.images : [],
    tags: Array.isArray(row.tags) ? row.tags : [],
    category: row.category || 'all',
    likes_count: Number(row.likes_count || 0),
    comments_count: Number(row.comments_count || 0),
    shares_count: Number(row.shares_count || 0),
    views_count: Number(row.views_count || 0),
    created_at: row.created_at,
    location_name: row.location_name || undefined,
    status: row.status || 'pending',
    product: meta.product,
    deal: row.deal || meta.deal,
    fashion_details: meta.fashion_details,
    car_details: meta.car_details,
    tech_details: meta.tech_details,
    food_details: meta.food_details,
    supermarket_details: meta.supermarket_details,
    comments: [],
  };
}

export const useSocialStore = create<SocialState>((set, get) => ({
  posts: [],
  stories: [],
  activePost: null,
  activeStory: null,
  shareModalPost: null,
  activeCategory: 'all',
  searchQuery: '',
  loading: false,
  initialized: false,
  error: null,

  setSearchQuery: (q) => set({ searchQuery: q }),
  setActiveCategory: (cat) => set({ activeCategory: cat }),

  initializePosts: async () => {
    if (get().loading) return;
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .in('status', ['approved', 'pending', 'suspended'])
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;

      const rows = data || [];
      const ids = [...new Set(rows.map((r: any) => r.user_id).filter(Boolean))];
      let profiles: any[] = [];
      if (ids.length) {
        const res = await supabase.from('profiles').select('id,full_name,avatar,phone').in('id', ids);
        profiles = res.data || [];
      }
      const byId = new Map(profiles.map((p) => [p.id, p]));
      const postIds = rows.map((r: any) => r.id);
      const { data: commentRows } = postIds.length
        ? await supabase.from('comments').select('id,post_id,user_id,content,likes_count,created_at').in('post_id', postIds).order('created_at', { ascending: false })
        : { data: [] as any[] };
      const commentUserIds = [...new Set((commentRows || []).map((c: any) => c.user_id).filter(Boolean))];
      if (commentUserIds.length) {
        const { data: commentProfiles } = await supabase.from('profiles').select('id,full_name,avatar').in('id', commentUserIds);
        (commentProfiles || []).forEach((p: any) => byId.set(p.id, p));
      }
      const { data: auth } = await supabase.auth.getUser();
      let likedPostIds = new Set<string>();
      if (auth.user && postIds.length) {
        const { data: likeRows } = await supabase.from('likes').select('post_id').eq('user_id', auth.user.id).in('post_id', postIds);
        likedPostIds = new Set((likeRows || []).map((l: any) => l.post_id));
      }
      const commentsByPost = new Map<string, PostComment[]>();
      (commentRows || []).forEach((c: any) => {
        const list = commentsByPost.get(c.post_id) || [];
        list.push({
          id: c.id,
          user_name: byId.get(c.user_id)?.full_name || 'SHAKH User',
          user_avatar: byId.get(c.user_id)?.avatar || '',
          content: c.content,
          created_at: c.created_at,
          likes_count: Number(c.likes_count || 0),
          is_liked: false,
        });
        commentsByPost.set(c.post_id, list);
      });
      const mapped = rows.map((r: any) => {
        const p = mapDbPost(r, byId.get(r.user_id));
        p.is_liked = likedPostIds.has(r.id);
        p.comments = commentsByPost.get(r.id) || [];
        return p;
      });
      set({ posts: mapped, initialized: true });
    } catch (e: any) {
      console.error('SHAKH posts fetch failed:', e);
      set({ error: e?.message || 'Unable to load live posts', initialized: true });
    } finally {
      set({ loading: false });
    }
  },

  toggleLikePost: async (postId) => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    const { data: existing } = await supabase.from('likes').select('id').eq('user_id', auth.user.id).eq('post_id', postId).maybeSingle();
    if (existing) {
      await supabase.from('likes').delete().eq('id', existing.id);
    } else {
      await supabase.from('likes').insert({ user_id: auth.user.id, post_id: postId });
    }
  },

  toggleLikeComment: async (_postId, commentId) => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    const { data: existing } = await supabase.from('likes').select('id').eq('user_id', auth.user.id).eq('comment_id', commentId).maybeSingle();
    if (existing) await supabase.from('likes').delete().eq('id', existing.id);
    else await supabase.from('likes').insert({ user_id: auth.user.id, comment_id: commentId });
  },

  addComment: async (postId, content) => {
    if (!content.trim()) return;
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    await supabase.from('comments').insert({ post_id: postId, user_id: auth.user.id, content: content.trim() });
  },

  incrementShareCount: async (postId) => {
    const p = get().posts.find((x) => x.id === postId);
    if (p) await supabase.from('posts').update({ shares_count: p.shares_count + 1 }).eq('id', postId);
  },

  openPostDetail: (post) => {
    set((state) => ({
      activePost: { ...post, views_count: post.views_count + 1 },
      posts: state.posts.map((p) => p.id === post.id ? { ...p, views_count: p.views_count + 1 } : p),
    }));
    void supabase.from('posts').update({ views_count: post.views_count + 1 }).eq('id', post.id);
  },
  closePostDetail: () => set({ activePost: null }),
  openShareModal: (post) => set({ shareModalPost: post }),
  closeShareModal: () => set({ shareModalPost: null }),
  openStory: (story) => set({ activeStory: story }),
  closeStory: () => set({ activeStory: null }),
  nextPost: () => {
    const { posts, activePost } = get(); if (!activePost) return;
    const i = posts.findIndex((p) => p.id === activePost.id);
    if (i >= 0 && i < posts.length - 1) set({ activePost: posts[i + 1] });
  },
  prevPost: () => {
    const { posts, activePost } = get(); if (!activePost) return;
    const i = posts.findIndex((p) => p.id === activePost.id);
    if (i > 0) set({ activePost: posts[i - 1] });
  },

  createPost: async (partial) => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return null;
    const category = partial.category || 'all';
    const metadata = {
      product: partial.product, fashion_details: partial.fashion_details, car_details: partial.car_details,
      tech_details: partial.tech_details, food_details: partial.food_details, supermarket_details: partial.supermarket_details,
      author_name: partial.author?.name, author_avatar: partial.author?.avatar, author_type: partial.author?.type,
      verified: partial.author?.verified, deal: partial.deal,
    };
    const { data, error } = await supabase.from('posts').insert({
      user_id: auth.user.id,
      title: partial.title || null,
      content: partial.content || '',
      content_ku: partial.content_ku || partial.content || '',
      content_ar: partial.content_ar || partial.content || '',
      content_en: partial.content_en || partial.content || '',
      content_tr: partial.content_tr || partial.content || '',
      content_fa: partial.content_fa || partial.content || '',
      images: partial.images || [],
      tags: partial.tags || [],
      category,
      location_name: partial.location_name || null,
      status: category === 'cars' ? 'pending' : 'approved',
      deal: partial.deal || {},
      metadata,
    }).select('*').single();
    if (error) { console.error('Create post failed:', error); return null; }
    const mapped = mapDbPost(data, { full_name: auth.user.user_metadata?.full_name, avatar: auth.user.user_metadata?.avatar_url });
    set((state) => ({ posts: [mapped, ...state.posts] }));
    return mapped;
  },

  deletePost: async (postId) => {
    const { error } = await supabase.from('posts').delete().eq('id', postId);
    if (error) return false;
    set((state) => ({ posts: state.posts.filter((p) => p.id !== postId), activePost: state.activePost?.id === postId ? null : state.activePost }));
    return true;
  },
  approvePost: async (postId) => {
    const { error } = await supabase.from('posts').update({ status: 'approved' }).eq('id', postId);
    return !error;
  },
  rejectPost: async (postId) => {
    const { error } = await supabase.from('posts').update({ status: 'rejected' }).eq('id', postId);
    return !error;
  },
  suspendPost: async (postId) => {
    const { error } = await supabase.from('posts').update({ status: 'suspended' }).eq('id', postId);
    return !error;
  },
  restorePost: async (postId) => {
    const { error } = await supabase.from('posts').update({ status: 'approved' }).eq('id', postId);
    return !error;
  },

  syncRealtimePost: (payload) => {
    set((state) => {
      if (payload.eventType === 'INSERT') {
        const p = mapDbPost(payload.new);
        if (!state.posts.some((x) => x.id === p.id)) return { posts: [p, ...state.posts] };
      }
      if (payload.eventType === 'UPDATE') {
        const p = mapDbPost(payload.new);
        return { posts: state.posts.map((x) => x.id === p.id ? { ...x, ...p } : x), activePost: state.activePost?.id === p.id ? { ...state.activePost, ...p } : state.activePost };
      }
      if (payload.eventType === 'DELETE') {
        const id = payload.old?.id;
        return { posts: state.posts.filter((x) => x.id !== id), activePost: state.activePost?.id === id ? null : state.activePost };
      }
      return state;
    });
  },
}));
