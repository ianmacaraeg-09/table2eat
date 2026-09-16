/* Table2Eat — shared Supabase client */
const SUPABASE_URL = 'https://bwxdobtcakpqnistfrri.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_-ES6SKLbHDf6SLjXJ8SLow_Txvy-s3Z';
const EDGE_FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
