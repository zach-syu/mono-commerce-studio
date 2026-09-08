import { createClient } from '@supabase/supabase-js';
import { createHandler } from '../_shared/handler.ts';
import { createSupabaseStore } from '../_shared/supabase-store.ts';

const env = Deno.env.toObject();
const url = env.SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error('Supabase runtime credentials are required.');
const client = createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
Deno.serve(createHandler({env,store:createSupabaseStore(client)}));
