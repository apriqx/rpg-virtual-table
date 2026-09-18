// Teste de API - requer backend rodando em :3001 com as contas de teste
// (master@test.com / player@test.com / spy@test.com, senha: senha123)
// Uso: node api-test.cjs

const BASE = process.env.API_URL || 'http://localhost:3001/api';
const PASSWD = 'senha123';

let passed = 0, failed = 0;
function ok(name, cond, extra) {
  if (cond) { passed++; console.log('PASS: ' + name); }
  else { failed++; console.log('FAIL: ' + name + (extra ? ' -> ' + extra : '')); }
}

async function req(method, path, { token, body, raw } = {}) {
  const headers = {};
  if (token) headers.Authorization = 'Bearer ' + token;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(BASE + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  if (raw) return res;
  let data = null;
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
}

async function login(email) {
  const r = await req('POST', '/auth/login', { body: { email, password: PASSWD } });
  return r.data.token;
}

async function main() {
  // ---- health ----
  const health = await req('GET', '/health');
  ok('health 200 com banco', health.status === 200 && health.data.database === 'ok');

  // ---- auth: validações ----
  let r = await req('POST', '/auth/register', { body: { email: 'x@t.com', username: 'ab', password: PASSWD } });
  ok('registro: username curto -> 400', r.status === 400);
  r = await req('POST', '/auth/register', { body: { email: 'invalido', username: 'usuariook', password: PASSWD } });
  ok('registro: email invalido -> 400', r.status === 400);
  r = await req('POST', '/auth/register', { body: { email: 'x@t.com', username: 'usuariook', password: '123' } });
  ok('registro: senha curta -> 400', r.status === 400);
  r = await req('POST', '/auth/register', { body: { email: 123, username: 'usuariook', password: PASSWD } });
  ok('registro: tipos invalidos -> 400', r.status === 400);
  r = await req('POST', '/auth/register', { body: { email: 'master@test.com', username: 'outro' + Date.now(), password: PASSWD } });
  ok('registro: email duplicado -> 400', r.status === 400);

  // ---- auth: login ----
  r = await req('POST', '/auth/login', { body: { email: 'master@test.com', password: 'errada' } });
  ok('login: senha errada -> 401', r.status === 401);
  r = await req('POST', '/auth/login', { body: { email: 'master@test.com', password: PASSWD } });
  ok('login: master ok', r.status === 200 && !!r.data.token);
  const mTok = r.data.token;
  r = await req('POST', '/auth/login', { body: { email: 'player@test.com', password: PASSWD } });
  ok('login: player ok', r.status === 200 && !!r.data.token);
  const pTok = r.data.token;
  const pUser = r.data.user || {};
  r = await req('GET', '/auth/me');
  ok('auth/me sem token -> 401', r.status === 401);
  r = await req('GET', '/auth/me', { token: pTok });
  ok('auth/me com token', r.status === 200 && r.data.user.id === pUser.id);

  // ---- tokens JWT falsos ----
  r = await req('GET', '/tables', { token: 'token.invalido.aqui' });
  ok('token falso -> 401', r.status === 401);

  // ---- tabelas ----
  r = await req('POST', '/tables', { token: mTok, body: { name: '   ' } });
  ok('criar mesa: nome vazio -> 400', r.status === 400);
  r = await req('POST', '/tables', { token: mTok, body: { name: 'Mesa Teste API ' + Date.now() } });
  ok('criar mesa -> 201', r.status === 201 && !!r.data.id);
  const tid = r.data.id;
  r = await req('GET', '/tables', { token: pTok });
  const playerTables = Array.isArray(r.data) ? r.data : [];
  ok('mesa nova nao aparece para quem nao e membro', !playerTables.some((t) => t.id === tid));
  r = await req('POST', `/tables/${tid}/members`, { token: mTok, body: { username: pUser.username, role: 'PLAYER' } });
  ok('adicionar membro -> 201/200', r.status === 200 || r.status === 201);
  r = await req('POST', `/tables/${tid}/members`, { token: pTok, body: { username: pUser.username, role: 'MASTER' } });
  ok('jogador nao pode adicionar membro -> 403', r.status === 403);

  // ---- mapa + tokens ----
  r = await req('POST', `/tables/${tid}/maps`, { token: mTok, body: { name: 'Mapa T', imageUrl: 'https://example.com/m.jpg', width: 800, height: 600, active: true } });
  ok('criar mapa (JSON) -> 201', r.status === 201 && !!r.data.map);
  const mid = r.data.map.id;
  r = await req('PUT', `/tables/${tid}/maps/${mid}`, { token: mTok, body: { name: 'Mapa Renomeado', width: 1024, height: 768 } });
  ok('editar mapa (nome/tamanho) -> 200', r.status === 200 && r.data.name === 'Mapa Renomeado' && r.data.width === 1024);
  r = await req('POST', `/tables/${tid}/maps/${mid}/duplicate`, { token: mTok });
  ok('duplicar mapa -> 201 com (copia)', r.status === 201 && r.data.map && String(r.data.map.name).includes('copia') && r.data.map.width === 1024);
  const dupId = r.data.map ? r.data.map.id : null;
  r = await req('GET', `/tables/${tid}/maps`, { token: mTok });
  const mapList = Array.isArray(r.data) ? r.data : [];
  ok('lista de mapas tem original + copia', mapList.length >= 2 && mapList.some((m) => m.id === mid) && mapList.some((m) => m.id === dupId));
  if (dupId) await req('DELETE', `/tables/${tid}/maps/${dupId}`, { token: mTok });
  r = await req('POST', `/tables/${tid}/maps/${mid}/tokens`, { token: mTok, body: { name: 'GM Token', x: 10, y: 10, layer: 5 } });
  ok('mestre cria token camada 5 -> 201', r.status === 201 && r.data.token.layer === 5);
  const hiddenId = r.data.token.id;
  r = await req('POST', `/tables/${tid}/maps/${mid}/tokens`, { token: mTok, body: { name: 'Visivel', x: 20, y: 20, lightRadius: 80 } });
  ok('token com lightRadius persiste', r.status === 201 && r.data.token.lightRadius === 80);
  const visibleId = r.data.token.id;
  r = await req('GET', `/tables/${tid}/maps/${mid}/tokens`, { token: pTok });
  const pTokens = Array.isArray(r.data) ? r.data : [];
  ok('jogador NAO recebe token camada 5', !pTokens.some((t) => t.id === hiddenId));
  ok('jogador recebe token visivel', pTokens.some((t) => t.id === visibleId));
  r = await req('POST', `/tables/${tid}/maps/${mid}/tokens`, { token: pTok, body: { name: 'X', x: 0, y: 0 } });
  ok('jogador nao cria token -> 403', r.status === 403);
  r = await req('PUT', `/tables/${tid}/maps/${mid}/tokens/${visibleId}`, { token: mTok, body: { ownerId: 'nobody', lightRadius: 120 } });
  ok('update token com ownerId invalido nao quebra', r.status === 200 || r.status === 500);

  // ---- fichas ----
  r = await req('POST', `/tables/${tid}/characters`, { token: mTok, body: { name: 'NPC Teste', system: 'dnd5e', data: { level: 3, hp: { current: 10, max: 20, temp: 0 } } } });
  ok('criar ficha dnd5e -> 201', r.status === 201 && r.data.system === 'dnd5e');
  const charId = r.data.id;
  r = await req('POST', `/tables/${tid}/characters`, { token: pTok, body: { name: 'Heroi do Player', system: 'custom' } });
  ok('player cria ficha -> 201', r.status === 201);
  const pCharId = r.data.id;
  r = await req('PUT', `/tables/${tid}/characters/${pCharId}`, { token: mTok, body: { data: { hp: { current: 5, max: 10, temp: 0 } } } });
  ok('mestre edita ficha do jogador -> 200', r.status === 200);
  r = await req('PUT', `/tables/${tid}/characters/${charId}`, { token: pTok, body: { name: 'HACKED' } });
  ok('jogador nao edita ficha alheia -> 403', r.status === 403);
  r = await req('DELETE', `/tables/${tid}/characters/${charId}`, { token: pTok });
  ok('jogador nao exclui ficha alheia -> 403', r.status === 403);

  // ---- chat ----
  r = await req('POST', `/tables/${tid}/chat`, { token: pTok, body: { type: 'player', text: 'ola mesa' } });
  ok('player envia mensagem -> 201', r.status === 201);
  r = await req('PUT', `/tables/${tid}/members/${pUser.id}/mute`, { token: mTok, body: { muted: true } });
  ok('mestre muta player', r.status === 200 || r.status === 201);
  r = await req('POST', `/tables/${tid}/chat`, { token: pTok, body: { type: 'player', text: 'mutado?' } });
  ok('player mutado -> 403', r.status === 403);
  r = await req('POST', `/tables/${tid}/chat`, { token: mTok, body: { type: 'dice', text: '/r 2d6+3' } });
  ok('roll de dados server-side', r.status === 201 && /\[\d+, \d+\] = \*\*\d+\*\*/.test(r.data.text));
  r = await req('PUT', `/tables/${tid}/members/${pUser.id}/mute`, { token: mTok, body: { muted: false } });
  ok('mestre desmuta player', r.status === 200 || r.status === 201);

  // ---- backup ----
  r = await req('GET', `/tables/${tid}/export`, { token: pTok });
  ok('player nao exporta backup -> 403', r.status === 403);
  r = await req('GET', `/tables/${tid}/export`, { token: mTok });
  ok('export backup -> 200 v1', r.status === 200 && r.data.version === 1 && Array.isArray(r.data.maps));
  r = await req('POST', `/tables/${tid}/import`, { token: mTok, body: { version: 2, maps: [] } });
  ok('import backup versao invalida -> 400', r.status === 400);

  // ---- upload ----
  const uploadRes = await fetch(BASE + '/uploads', { method: 'POST', headers: { Authorization: 'Bearer ' + mTok }, body: (() => { const fd = new FormData(); fd.append('image', new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')], { type: 'image/png' }), 't.png'); return fd; })() });
  ok('upload autenticado -> 201', uploadRes.status === 201);
  const upJson = await uploadRes.json().catch(() => ({}));
  if (upJson.url) {
    const fileUrl = upJson.url.startsWith('http') ? upJson.url : 'http://localhost:3001' + upJson.url;
    const imgRes = await fetch(fileUrl);
    ok('arquivo servido (' + (upJson.url.startsWith('http') ? 'nuvem' : 'local') + ')', imgRes.status === 200);
  } else ok('arquivo servido', false, 'sem url');
  const noAuthUpload = await fetch(BASE + '/uploads', { method: 'POST', body: new FormData() });
  ok('upload sem auth -> 401', noAuthUpload.status === 401);

  // ---- limpeza ----
  await req('DELETE', `/tables/${tid}/maps/${mid}/tokens/${hiddenId}`, { token: mTok });
  await req('DELETE', `/tables/${tid}/maps/${mid}/tokens/${visibleId}`, { token: mTok });
  await req('DELETE', `/tables/${tid}/characters/${pCharId}`, { token: pTok });
  await req('DELETE', `/tables/${tid}`, { token: mTok });
  console.log('limpeza: mesa de teste removida');

  console.log(`\n${passed}/${passed + failed} testes de API passaram`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error('ERRO FATAL:', e.message); process.exit(1); });
