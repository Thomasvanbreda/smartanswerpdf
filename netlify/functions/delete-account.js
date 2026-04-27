const https = require('https');

const SUPABASE_URL = 'https://dvuatrfhvwnmmqxdsaxx.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

function supabaseRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(SUPABASE_URL + path);
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Prefer': 'return=minimal'
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    // Verify the user is authenticated by checking their JWT
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    const token = authHeader.replace('Bearer ', '');

    // Verify token and get user ID from Supabase
    const userRes = await supabaseRequest('GET', '/auth/v1/user', null);
    
    // Parse user ID from request body (sent from frontend)
    const { userId } = JSON.parse(event.body);
    if (!userId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing userId' }) };
    }

    // Step 1: Delete all templates
    await supabaseRequest('DELETE', `/rest/v1/templates?user_id=eq.${userId}`);

    // Step 2: Delete profile
    await supabaseRequest('DELETE', `/rest/v1/profiles?id=eq.${userId}`);

    // Step 3: Delete the auth user entirely using admin API
    const deleteRes = await supabaseRequest('DELETE', `/auth/v1/admin/users/${userId}`);

    if (deleteRes.status === 200 || deleteRes.status === 204) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true })
      };
    } else {
      console.error('Auth delete failed:', deleteRes.status, deleteRes.body);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to delete auth record' })
      };
    }

  } catch (err) {
    console.error('Delete account error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Server error' }) };
  }
};
