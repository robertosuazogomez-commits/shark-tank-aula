const fs = require('fs/promises');
const path = require('path');

const STATE_ID = process.env.SHARK_STATE_ID || 'shark-tank-aula-main';
const DATA_FILE = process.env.SHARK_DATA_FILE || path.join(__dirname, 'data', 'state.json');
const SUPABASE_URL = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const TABLE = process.env.SHARK_STATE_TABLE || 'app_state';

const hasSupabase = Boolean(SUPABASE_URL && SUPABASE_KEY);
let saveQueue = Promise.resolve();

async function loadState() {
  if (hasSupabase) {
    const url = `${SUPABASE_URL}/rest/v1/${TABLE}?id=eq.${encodeURIComponent(STATE_ID)}&select=data&limit=1`;
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    });
    if (!res.ok) throw new Error(`Supabase load failed: ${res.status} ${await res.text()}`);
    const rows = await res.json();
    return rows[0]?.data || null;
  }

  try {
    return JSON.parse(await fs.readFile(DATA_FILE, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

function persistState(state) {
  const snapshot = JSON.parse(JSON.stringify(state));
  saveQueue = saveQueue.then(async () => {
    if (hasSupabase) {
      const url = `${SUPABASE_URL}/rest/v1/${TABLE}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify({ id: STATE_ID, data: snapshot, updated_at: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error(`Supabase save failed: ${res.status} ${await res.text()}`);
      return;
    }

    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    const tmp = `${DATA_FILE}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(snapshot, null, 2), 'utf8');
    await fs.rename(tmp, DATA_FILE);
  }).catch(err => {
    console.error('[storage]', err.message);
  });
  return saveQueue;
}

module.exports = { loadState, persistState, hasSupabase, STATE_ID, DATA_FILE, TABLE };
