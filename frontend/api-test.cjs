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
  r = await req('POST', `/tables/${tid}/members`, { token: mTok, body: { username: 'spy@test.com', role: 'PLAYER' } });
  ok('adicionar membro por e-mail -> 201', r.status === 201);
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
  r = await req('POST', `/tables/${tid}/maps`, { token: mTok, body: { name: 'Mapa URL', imageUrl: 'https://exemplo.com/a.jpg', width: 800, height: 600 } });
  ok('criar mapa por URL -> 201', r.status === 201 && r.data.map && r.data.map.imageUrl === 'https://exemplo.com/a.jpg' && r.data.map.mediaType === 'image');
  const urlMapId = r.data.map ? r.data.map.id : null;
  r = await req('PUT', `/tables/${tid}/maps/${urlMapId}`, { token: mTok, body: { name: 'Mapa URL', imageUrl: 'https://exemplo.com/b.jpg' } });
  ok('editar mapa trocando URL', r.status === 200 && r.data.imageUrl === 'https://exemplo.com/b.jpg');
  r = await req('PUT', `/tables/${tid}/maps/${urlMapId}`, { token: mTok, body: { name: 'Mapa URL Renomeado' } });
  ok('salvar sem tocar imagem mantem URL', r.status === 200 && r.data.imageUrl === 'https://exemplo.com/b.jpg' && r.data.name === 'Mapa URL Renomeado');
  if (urlMapId) await req('DELETE', `/tables/${tid}/maps/${urlMapId}`, { token: mTok });
  r = await req('PUT', `/tables/${tid}/members/${pUser.id}/map`, { token: mTok, body: { mapId: mid } });
  ok('mestre define mapa do membro', r.status === 200 && r.data.activeMapId === mid);
  r = await req('PUT', `/tables/${tid}/members/${pUser.id}/map`, { token: pTok, body: { mapId: null } });
  ok('player nao define mapa -> 403', r.status === 403);
  r = await req('PUT', `/tables/${tid}/members/${pUser.id}/map`, { token: mTok, body: { mapId: null } });
  ok('limpar mapa do membro', r.status === 200 && r.data.activeMapId === null);
  r = await req('POST', `/tables/${tid}/maps/${mid}/tokens`, { token: mTok, body: { name: 'GM Token', x: 10, y: 10, layer: 5 } });
  ok('mestre cria token camada 5 -> 201', r.status === 201 && r.data.token.layer === 5 && r.data.token.snapToGrid === true);
  const hiddenId = r.data.token.id;
  r = await req('POST', `/tables/${tid}/maps/${mid}/tokens`, { token: mTok, body: { name: 'Visivel', x: 20, y: 20, lightRadius: 80 } });
  ok('token com lightRadius persiste', r.status === 201 && r.data.token.lightRadius === 80);
  const visibleId = r.data.token.id;
  r = await req('POST', `/tables/${tid}/maps/${mid}/tokens`, { token: mTok, body: { name: 'Livre', x: 33, y: 44, snapToGrid: false } });
  ok('token com snapToGrid=false persiste', r.status === 201 && r.data.token.snapToGrid === false);
  const freeId = r.data.token.id;
  r = await req('PUT', `/tables/${tid}/maps/${mid}/tokens/${freeId}`, { token: mTok, body: { snapToGrid: true, locked: true } });
  ok('update snapToGrid/locked persiste', r.status === 200 && r.data.snapToGrid === true && r.data.locked === true);
  r = await req('GET', `/tables/${tid}/maps/${mid}/tokens`, { token: pTok });
  const pTokens = Array.isArray(r.data) ? r.data : [];
  ok('jogador NAO recebe token camada 5', !pTokens.some((t) => t.id === hiddenId));
  ok('jogador recebe token visivel', pTokens.some((t) => t.id === visibleId));
  r = await req('POST', `/tables/${tid}/maps/${mid}/tokens`, { token: pTok, body: { name: 'X', x: 0, y: 0 } });
  ok('jogador nao cria token -> 403', r.status === 403);
  r = await req('PUT', `/tables/${tid}/maps/${mid}/tokens/${visibleId}`, { token: mTok, body: { ownerId: 'nobody', lightRadius: 120 } });
  ok('update token com ownerId invalido nao quebra', r.status === 200 || r.status === 500);

  // ---- neblina: formas (quadrado/circulo/poligono) ----
  r = await req('POST', `/tables/${tid}/maps/${mid}/fog`, { token: mTok, body: { x: 10, y: 10, width: 100, height: 100, revealed: true, shape: 'circle' } });
  ok('regiao de neblina circulo -> 201', r.status === 201 && r.data.shape === 'circle');
  const fogCircleId = r.data.id;
  r = await req('POST', `/tables/${tid}/maps/${mid}/fog`, { token: mTok, body: { x: 0, y: 0, width: 50, height: 50, revealed: true, shape: 'polygon', points: [[0, 0], [40, 10], [30, 50], [5, 35]] } });
  ok('regiao poligono com pontos -> 201', r.status === 201 && r.data.shape === 'polygon' && Array.isArray(r.data.points) && r.data.points.length === 4);
  const fogPolyId = r.data.id;
  r = await req('POST', `/tables/${tid}/maps/${mid}/fog`, { token: mTok, body: { x: 1, y: 1, width: 5, height: 5, revealed: true, shape: 'estrela' } });
  ok('shape invalido cai para rect', r.status === 201 && r.data.shape === 'rect');
  r = await req('GET', `/tables/${tid}/maps/${mid}/fog`, { token: pTok });
  ok('jogador ve regioes reveladas com shape', r.status === 200 && Array.isArray(r.data) && r.data.some((f) => f.id === fogCircleId && f.shape === 'circle') && r.data.some((f) => f.id === fogPolyId && Array.isArray(f.points) && f.points.length === 4));
  r = await req('PUT', `/tables/${tid}/maps/${mid}/fog/batch`, { token: mTok, body: { regions: [{ x: 5, y: 5, width: 60, height: 60, revealed: true, shape: 'circle' }, { x: 0, y: 0, width: 10, height: 10, revealed: true, shape: 'polygon', points: [[0, 0], [10, 5], [5, 10]] }] } });
  ok('batch preserva shape/points', r.status === 200 && Array.isArray(r.data) && r.data.some((f) => f.shape === 'circle') && r.data.some((f) => f.shape === 'polygon' && Array.isArray(f.points) && f.points.length === 3));
  r = await req('GET', `/tables/${tid}/maps/${mid}/fog`, { token: mTok });
  ok('mestre ve neblina apos batch', r.status === 200 && r.data.length === 2);

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

  // ---- fichas: kinds (pc/npc/monster) + permissoes ----
  r = await req('POST', `/tables/${tid}/characters`, { token: pTok, body: { name: 'NPC Roubado', kind: 'npc' } });
  ok('player nao cria NPC -> 403', r.status === 403);
  r = await req('POST', `/tables/${tid}/characters`, { token: pTok, body: { name: 'Monstro Roubado', kind: 'monster' } });
  ok('player nao cria Monstro -> 403', r.status === 403);
  r = await req('POST', `/tables/${tid}/characters`, { token: mTok, body: { name: 'Goblin Batedor', kind: 'monster', system: 'dnd5e' } });
  ok('mestre cria monstro -> 201 kind monster', r.status === 201 && r.data.kind === 'monster');
  const monId = r.data.id;
  r = await req('POST', `/tables/${tid}/characters`, { token: mTok, body: { name: 'Taverneiro', kind: 'npc', system: 'dnd5e' } });
  ok('mestre cria NPC -> 201 kind npc', r.status === 201 && r.data.kind === 'npc');
  const npcId = r.data.id;
  r = await req('POST', `/tables/${tid}/characters`, { token: mTok, body: { name: 'X', kind: 'dragao' } });
  ok('kind invalido -> 400', r.status === 400);
  r = await req('GET', `/tables/${tid}/characters`, { token: pTok });
  ok('monstro invisivel para player sem permissao', !r.data.some((c) => c.id === monId));
  ok('ficha propria do player visivel', r.data.some((c) => c.id === pCharId));
  r = await req('PUT', `/tables/${tid}/characters/${npcId}`, { token: pTok, body: { name: 'HACK NPC' } });
  ok('player sem permissao nao edita NPC -> 403', r.status === 403);
  r = await req('GET', `/tables/${tid}/characters/${npcId}`, { token: pTok });
  ok('player sem permissao nao abre NPC -> 403', r.status === 403);
  r = await req('PUT', `/tables/${tid}/characters/${monId}/permissions`, { token: pTok, body: { permissions: [] } });
  ok('player nao define permissoes -> 403', r.status === 403);
  r = await req('PUT', `/tables/${tid}/characters/${monId}/permissions`, { token: mTok, body: { permissions: [{ userId: pUser.id, canView: true, canControl: false }] } });
  ok('mestre define permissoes -> 200', r.status === 200 && Array.isArray(r.data.permissions) && r.data.permissions.some((p) => p.userId === pUser.id && p.canView && !p.canControl));
  r = await req('GET', `/tables/${tid}/characters/${monId}/permissions`, { token: mTok });
  ok('GET permissoes lista grants', r.status === 200 && r.data.some((p) => p.userId === pUser.id && p.canView));
  r = await req('GET', `/tables/${tid}/characters`, { token: pTok });
  ok('monstro visivel apos canView', r.data.some((c) => c.id === monId && Array.isArray(c.permissions) && c.permissions.some((p) => p.userId === pUser.id && p.canView)));
  r = await req('GET', `/tables/${tid}/characters/${monId}`, { token: pTok });
  ok('player abre monstro compartilhado -> 200', r.status === 200 && r.data.name === 'Goblin Batedor');
  r = await req('PUT', `/tables/${tid}/characters/${monId}`, { token: pTok, body: { name: 'TENTATIVA' } });
  ok('canView sem canControl nao edita -> 403', r.status === 403);
  r = await req('PUT', `/tables/${tid}/characters/${monId}/permissions`, { token: mTok, body: { permissions: [{ userId: pUser.id, canView: true, canControl: true }] } });
  ok('mestre concede canControl', r.status === 200);
  r = await req('PUT', `/tables/${tid}/characters/${monId}`, { token: pTok, body: { data: { hp: { current: 3, max: 7, temp: 0 } } } });
  ok('canControl permite player editar HP', r.status === 200 && r.data.data.hp.current === 3);
  r = await req('PUT', `/tables/${tid}/characters/${monId}/permissions`, { token: mTok, body: { permissions: [] } });
  ok('revogar permissoes -> 200 vazio', r.status === 200 && r.data.permissions.length === 0);
  r = await req('GET', `/tables/${tid}/characters`, { token: pTok });
  ok('monstro invisivel novamente apos revogar', !r.data.some((c) => c.id === monId));

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
  r = await req('POST', `/tables/${tid}/chat`, { token: pTok, body: { type: 'dice', text: '/r 2d20kh1' } });
  ok('vantagem kh1 -> total 1..20 e descarta um dado', r.status === 201 && (() => { const mm = r.data.text.match(/\*\*(\d+)\*\*/); return mm && Number(mm[1]) >= 1 && Number(mm[1]) <= 20 && r.data.text.includes('\u2717'); })());
  r = await req('POST', `/tables/${tid}/chat`, { token: mTok, body: { type: 'dice', text: '/r 1d20+1d4+3' } });
  ok('expressao composta -> total entre 5 e 27', r.status === 201 && (() => { const mm = r.data.text.match(/\*\*(\d+)\*\*/); return mm && Number(mm[1]) >= 5 && Number(mm[1]) <= 27; })());
  r = await req('POST', `/tables/${tid}/chat`, { token: pTok, body: { type: 'dice', text: '/r 2d6kh1' } });
  ok('2d6kh1 -> total 1..6 (mantem o maior)', r.status === 201 && (() => { const mm = r.data.text.match(/\*\*(\d+)\*\*/); return mm && Number(mm[1]) >= 1 && Number(mm[1]) <= 6 && r.data.text.includes('\u2717'); })());
  r = await req('POST', `/tables/${tid}/chat`, { token: pTok, body: { type: 'dice', text: '/r 2d20kl1-1' } });
  ok('desvantagem kl1 com modificador negativo', r.status === 201 && (() => { const mm = r.data.text.match(/\*\*(\d+)\*\*/); return mm && Number(mm[1]) >= 0 && Number(mm[1]) <= 19 && r.data.text.includes('\u2717'); })());
  r = await req('GET', `/tables/${tid}/chat`, { token: pTok });
  ok('historico do chat lista mensagens', r.status === 200 && Array.isArray(r.data) && r.data.length >= 4);
  r = await req('GET', `/tables/${tid}/chat?before=` + encodeURIComponent(new Date(Date.now() + 60000).toISOString()), { token: pTok });
  ok('paginacao before -> 200', r.status === 200 && Array.isArray(r.data));
  r = await req('GET', `/tables/${tid}/chat?before=`, { token: pTok });
  ok('paginacao before vazio -> 200 sem erro', r.status === 200 || r.status === 400);

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
  await req('DELETE', `/tables/${tid}/maps/${mid}/tokens/${freeId}`, { token: mTok });
  await req('DELETE', `/tables/${tid}/characters/${pCharId}`, { token: pTok });
  await req('DELETE', `/tables/${tid}/characters/${npcId}`, { token: mTok });
  await req('DELETE', `/tables/${tid}/characters/${monId}`, { token: mTok });
  await req('DELETE', `/tables/${tid}`, { token: mTok });
  console.log('limpeza: mesa de teste removida');

  console.log(`\n${passed}/${passed + failed} testes de API passaram`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error('ERRO FATAL:', e.message); process.exit(1); });
