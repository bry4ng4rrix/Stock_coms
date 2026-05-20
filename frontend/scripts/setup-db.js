import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function executeSQL(filePath) {
  try {
    const sql = fs.readFileSync(filePath, 'utf-8');
    
    // Split by statements (simple approach)
    const statements = sql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);

    for (const statement of statements) {
      const { error } = await supabase.rpc('exec', { statement });
      if (error) {
        console.error(`Error executing: ${statement.substring(0, 50)}...`);
        console.error(error);
      } else {
        console.log(`✓ Executed: ${statement.substring(0, 50)}...`);
      }
    }
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
  }
}

async function setupDatabase() {
  console.log('Starting database setup...');
  
  try {
    // Execute schema
    console.log('\n📋 Setting up schema...');
    await executeSQL(path.join(__dirname, '01_init_schema.sql'));
    
    // Execute seed data
    console.log('\n🌱 Seeding data...');
    await executeSQL(path.join(__dirname, '02_seed_data.sql'));
    
    console.log('\n✅ Database setup completed successfully!');
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  }
}

setupDatabase();
