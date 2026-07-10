const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rccvnnmhkxksmlccakjq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjY3Zubm1oa3hrc21sY2Nha2pxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1MTI5ODgsImV4cCI6MjA5OTA4ODk4OH0.xPbtrb3paV7_WybogcsV68U0WzAX14-ugLf9CnlcoJc';
const supabase = createClient(supabaseUrl, supabaseKey);

async function setup() {
  const { data, error } = await supabase.auth.signUp({
    email: 'demo@labh.com',
    password: 'demo@labh.com',
  });
  if (error) {
    console.error('Error creating user:', error.message);
  } else {
    console.log('User created successfully:', data);
  }
}

setup();
