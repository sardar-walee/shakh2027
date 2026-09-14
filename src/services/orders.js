export async function createOrder(supabase,args){return supabase.rpc('create_order',args)}
