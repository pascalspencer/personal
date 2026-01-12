const fs = require('fs');
const path = require('path');

const STORE_PATH = path.join(__dirname, 'device_sessions.json');
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

function load() {
  try {
    if (!fs.existsSync(STORE_PATH)) return {};
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    return JSON.parse(raw || '{}');
  } catch (err) {
    console.error('Failed to load device sessions:', err);
    return {};
  }
}

function save(data) {
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save device sessions:', err);
  }
}

function cleanup(data) {
  const now = Date.now();
  let changed = false;
  Object.keys(data).forEach(username => {
    const list = data[username].filter(s => (now - s.loginTime) <= MAX_AGE_MS);
    if (list.length !== data[username].length) {
      data[username] = list;
      changed = true;
    }
    if (data[username].length === 0) {
      delete data[username];
      changed = true;
    }
  });
  return changed;
}

module.exports = {
  getSessions(username) {
    const data = load();
    cleanup(data);
    return data[username] || [];
  },
  addSession(username, sessionId, meta = {}) {
    const data = load();
    cleanup(data);
    if (!data[username]) data[username] = [];
    // Avoid duplicates
    data[username] = data[username].filter(s => s.sessionId !== sessionId);
    data[username].push(Object.assign({ sessionId, loginTime: Date.now() }, meta));
    save(data);
  },
  removeSession(sessionId) {
    const data = load();
    let changed = false;
    Object.keys(data).forEach(username => {
      const before = data[username].length;
      data[username] = data[username].filter(s => s.sessionId !== sessionId);
      if (data[username].length !== before) changed = true;
      if (data[username].length === 0) delete data[username];
    });
    if (changed) save(data);
  },
  count(username) {
    return this.getSessions(username).length;
  }
};
