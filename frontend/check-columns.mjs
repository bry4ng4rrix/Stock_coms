import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
  const tables = ['products', 'stock_movements', 'categories', 'suppliers', 'users'];
  
  for (const table of tables) {
    const { data, error } = await supabase.rpc('get_table_columns', { table_name: table });
    // If RPC doesn't exist, I'll try to select 1 row
    const { data: row, error: selectError } = await supabase.from(table).select('*').limit(1);
    
    if (selectError) {
      console.log(`Error on table ${table}:`, selectError.message);
    } else {
      console.log(`Columns for ${table}:`, Object.keys(row[0] || {}));
    }
  }
}

checkColumns();
