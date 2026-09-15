const { io } = require('socket.io-client');
const API = 'http://localhost:3001/api';

async function rest(token, method, path, body) {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  return r.json();
}
async function login(email, password) {
  return (await rest(null, 'POST', '/auth/login', { email, password }).then ? null : null) || (await (async () => {
    const r = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    return (await r.json()).token;
  })());
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const mTok = await login('master@test.com', 'senha123');
  const pTok = await login('player@test.com', 'senha123');
  await rest(mTok, 'POST', '/auth/register', { email: 'spy@test.com', username: 'espiao', password: 'senha123' }).catch(() => {});
  const sTok = await login('spy@test.com', 'senha123');
  const tableId = (await rest(mTok, 'GET', '/tables'))[0].id;
  await rest(mTok, 'POST', `/tables/${tableId}/members`, { username: 'espiao', role: 'PLAYER' }).catch(() => {});

  const seen = { m: null, s: null };
  const m = io('http://localhost:3001', { auth: { token: mTok } });
  const s = io('http://localhost:3001', { auth: { token: sTok } });
  m.on('chat:whisper', (d) => { seen.m = d; });
  s.on('chat:whisper', (d) => { seen.s = d; });
  await wait(1500);
  m.emit('join:table', tableId);
  s.emit('join:table', tableId);
  await wait(1000);

  await rest(pTok, 'POST', `/tables/${tableId}/chat`, { text: '/w mestre psiu segredo' });
  await wait(1200);

  const spyMsgs = await rest(sTok, 'GET', `/tables/${tableId}/chat`);
  const spyHasWhisper = spyMsgs.some((msg) => msg.text && msg.text.includes('psiu'));
  console.log(`${spyHasWhisper ? 'FAIL' : 'PASS'}: REST whisper hidden from third user`);
  const masterMsgs = await rest(mTok, 'GET', `/tables/${tableId}/chat`);
  const masterHasWhisper = masterMsgs.some((msg) => msg.text && msg.text.includes('psiu'));
  console.log(`${masterHasWhisper ? 'PASS' : 'FAIL'}: REST whisper visible to target (master)`);
  console.log(`${seen.m && seen.m.message && seen.m.message.text.includes('psiu') ? 'PASS' : 'FAIL'}: socket whisper delivered to target only (spy got: ${seen.s ? 'YES - LEAK' : 'no'})`);

  m.disconnect(); s.disconnect();
  const fails = [spyHasWhisper, !masterHasWhisper, !seen.m].filter(Boolean).length;
  console.log(fails === 0 ? '\nAll whisper privacy tests passed' : `\n${fails} test(s) failed`);
  process.exit(fails > 0 ? 1 : 0);
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
