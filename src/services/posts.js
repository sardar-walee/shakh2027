export async function fetchPublicPosts(supabase){return supabase.from('posts').select('*').eq('status','published').order('created_at',{ascending:false}).limit(100)}
