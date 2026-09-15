const { io } = require('socket.io-client');

const API = 'http://localhost:3001/api';

async function login(email, password) {
  const r = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return (await r.json()).token;
}

async function rest(token, method, path, body) {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  return r.json();
}

const results = [];
function check(name, ok) {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}`);
}

(async () => {
  const mTok = await login('master@test.com', 'senha123');
  const pTok = await login('player@test.com', 'senha123');
  const tables = await rest(mTok, 'GET', '/tables');
  const tableId = tables[0].id;

  const seen = { m: {}, p: {} };

  const m = io('http://localhost:3001', { auth: { token: mTok } });
  const p = io('http://localhost:3001', { auth: { token: pTok } });
  ['user:joined', 'chat:message', 'member:muted', 'initiative:updated', 'token:created'].forEach((e) => {
    m.on(e, (d) => { seen.m[e] = d; });
    p.on(e, (d) => { seen.p[e] = d; });
  });

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  await wait(1500);
  m.emit('join:table', tableId);
  await wait(800);
  p.emit('join:table', tableId);
  await wait(1200);
  check('master sees player join (user:joined)', !!seen.m['user:joined'] && seen.m['user:joined'].username === 'jogador');

  await rest(pTok, 'POST', `/tables/${tableId}/chat`, { text: 'teste de socket' });
  await wait(800);
  check('chat broadcast reaches master (chat:message)', !!seen.m['chat:message'] && seen.m['chat:message'].message && seen.m['chat:message'].message.username === 'jogador');

  const members = await rest(mTok, 'GET', `/tables/${tableId}`);
  const player = members.members.find((mm) => mm.user.username === 'jogador');
  await rest(mTok, 'PUT', `/tables/${tableId}/members/${player.userId}/mute`, { muted: true });
  await wait(800);
  check('mute broadcast reaches player (member:muted)', !!seen.p['member:muted'] && seen.p['member:muted'].muted === true);

  m.emit('initiative:update', tableId, { list: [{ id: '1', name: 'Konrad', initiative: 18 }], currentIdx: 0 });
  await wait(800);
  check('initiative sync (initiative:updated)', !!seen.p['initiative:updated'] && seen.p['initiative:updated'].list && seen.p['initiative:updated'].list[0].name === 'Konrad');

  const maps = await rest(mTok, 'GET', `/tables/${tableId}/maps`);
  const mapId = maps[0].id;
  await rest(mTok, 'POST', `/tables/${tableId}/maps/${mapId}/tokens`, { name: 'Ghoul', x: 100, y: 100, width: 40, height: 40 });
  await wait(800);
  check('token broadcast reaches player (token:created)', !!seen.p['token:created'] && seen.p['token:created'].token && seen.p['token:created'].token.name === 'Ghoul');

  await rest(mTok, 'PUT', `/tables/${tableId}/members/${player.userId}/mute`, { muted: false });
  const fails = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - fails}/${results.length} socket tests passed`);
  m.disconnect(); p.disconnect();
  process.exit(fails > 0 ? 1 : 0);
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
