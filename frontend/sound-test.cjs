// Teste do relay de som via socket - requer backend rodando
// Uso: node sound-test.cjs
const { io } = require('socket.io-client');

const BASE = process.env.API_URL || 'http://localhost:3001/api';
const SOCK = 'http://localhost:3001';

let passed = 0, failed = 0;
function ok(name, cond, extra) {
  if (cond) { passed++; console.log('PASS: ' + name); }
  else { failed++; console.log('FAIL: ' + name + (extra ? ' -> ' + extra : '')); }
}

function connect(token) {
  return new Promise((resolve, reject) => {
    const s = io(SOCK, { auth: { token }, transports: ['websocket', 'polling'] });
    s.on('connect', () => resolve(s));
    s.on('connect_error', reject);
    setTimeout(() => reject(new Error('timeout connect')), 8000);
  });
}
const join = (s, tableId) => new Promise((r) => { s.emit('join:table', tableId); setTimeout(r, 700); });

async function main() {
  const lm = await (await fetch(BASE + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'master@test.com', password: 'senha123' }) })).json();
  const lp = await (await fetch(BASE + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'player@test.com', password: 'senha123' }) })).json();
  const mTok = lm.token, pTok = lp.token, pUser = lp.user;

  const tRes = await fetch(BASE + '/tables', { method: 'POST', headers: { Authorization: 'Bearer ' + mTok, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Mesa Som ' + Date.now() }) });
  const tid = tRes.data ? tRes.data.id : (await tRes.json()).id;
  await fetch(`${BASE}/tables/${tid}/members`, { method: 'POST', headers: { Authorization: 'Bearer ' + mTok, 'Content-Type': 'application/json' }, body: JSON.stringify({ username: pUser.username, role: 'PLAYER' }) });

  const ms = await connect(mTok);
  const ps = await connect(pTok);
  await join(ms, tid);
  await join(ps, tid);

  const received = [];
  ps.on('sound:play', (d) => received.push(d && d.name));

  ms.emit('sound:play', tid, 'dice');
  ms.emit('sound:play', tid, '../etc/passwd');
  ms.emit('sound:play', tid, 'sword');

  await new Promise((r) => setTimeout(r, 2500));
  ok('jogador recebeu dice', received.includes('dice'));
  ok('jogador recebeu sword', received.includes('sword'));
  ok('nome invalido bloqueado', !received.some((n) => n && n.includes('/')), JSON.stringify(received));

  ms.disconnect(); ps.disconnect();
  await fetch(BASE + '/tables/' + tid, { method: 'DELETE', headers: { Authorization: 'Bearer ' + mTok } });
  console.log('limpeza: mesa removida');
  console.log(`\n${passed}/${passed + failed} testes de som passaram`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error('ERRO FATAL:', e.message); process.exit(1); });
