export async function claimCaptain(supabase,code){return supabase.rpc('claim_captain_invite',{p_code:code})}
