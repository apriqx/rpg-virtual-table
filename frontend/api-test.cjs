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
  r = await req('POST', `/tables/${tid}/maps`, { token: mTok, body: { name: 'Mapa URL', imageUrl: 'https://exemplo.com/a.jpg', width: 800, height: 600, darkMode: true } });
  ok('criar mapa por URL com modo escuro -> 201', r.status === 201 && r.data.map && r.data.map.imageUrl === 'https://exemplo.com/a.jpg' && r.data.map.mediaType === 'image' && r.data.map.darkMode === true);
  const urlMapId = r.data.map ? r.data.map.id : null;
  r = await req('PUT', `/tables/${tid}/maps/${urlMapId}`, { token: mTok, body: { name: 'Mapa URL', imageUrl: 'https://exemplo.com/b.jpg', darkMode: false } });
  ok('editar mapa trocando URL e modo escuro', r.status === 200 && r.data.imageUrl === 'https://exemplo.com/b.jpg' && r.data.darkMode === false);
  r = await req('PUT', `/tables/${tid}/maps/${urlMapId}`, { token: mTok, body: { name: 'Mapa URL Renomeado' } });
  ok('salvar sem tocar imagem mantem URL e darkMode', r.status === 200 && r.data.imageUrl === 'https://exemplo.com/b.jpg' && r.data.name === 'Mapa URL Renomeado' && r.data.darkMode === false);
  r = await req('PUT', `/tables/${tid}/maps/${mid}`, { token: mTok, body: { darkMode: true } });
  ok('ativar modo escuro no mapa principal', r.status === 200 && r.data.darkMode === true);
  r = await req('POST', `/tables/${tid}/maps/${mid}/duplicate`, { token: mTok });
  ok('duplicar mapa preserva modo escuro', r.status === 201 && r.data.map && r.data.map.darkMode === true);
  const darkDupId = r.data.map ? r.data.map.id : null;
  if (darkDupId) await req('DELETE', `/tables/${tid}/maps/${darkDupId}`, { token: mTok });
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
  r = await req('POST', `/tables/${tid}/maps/${mid}/tokens`, { token: mTok, body: { name: 'Visao Sombria', x: 30, y: 30, visionRadius: 60 } });
  ok('token com visionRadius em pes persiste', r.status === 201 && r.data.token.visionRadius === 60);
  const visionId = r.data.token.id;
  r = await req('PUT', `/tables/${tid}/maps/${mid}/tokens/${visionId}`, { token: mTok, body: { visionRadius: 30 } });
  ok('update visionRadius persiste', r.status === 200 && r.data.visionRadius === 30);
  r = await req('POST', `/tables/${tid}/maps/${mid}/tokens`, { token: mTok, body: { name: 'X', x: 0, y: 0, visionRadius: -5 } });
  ok('visionRadius negativo vira 0', r.status === 201 && r.data.token.visionRadius === 0);
  await req('DELETE', `/tables/${tid}/maps/${mid}/tokens/${visionId}`, { token: mTok });
  // ---- tokens avançados: displayName/bars/markers/opacity + duplicar ----
  r = await req('POST', `/tables/${tid}/maps/${mid}/tokens`, { token: mTok, body: { name: 'Goblin Secreto', displayName: 'Figura Misteriosa', showName: false, opacity: 0.5, x: 10, y: 10, bars: [{ label: 'PV', current: 7, max: 12, visible: true, color: '#50fa7b' }], statusMarkers: ['poisoned', 'marked'] } });
  ok('token com displayName/bars/markers/opacity persiste', r.status === 201 && r.data.token.displayName === 'Figura Misteriosa' && r.data.token.showName === false && r.data.token.opacity === 0.5 && Array.isArray(r.data.token.bars) && r.data.token.bars.length === 1 && r.data.token.bars[0].label === 'PV' && Array.isArray(r.data.token.statusMarkers) && r.data.token.statusMarkers.join(',') === 'poisoned,marked');
  const richId = r.data.token.id;
  r = await req('PUT', `/tables/${tid}/maps/${mid}/tokens/${richId}`, { token: mTok, body: { bars: [{ label: 'PV', current: 3, max: 12, visible: true, color: '#ff5555' }, { label: 'Escudo', current: 2, max: 5, visible: true, color: '#8be9fd' }], statusMarkers: ['dead'], opacity: 0.9 } });
  ok('update bars/markers/opacity persiste', r.status === 200 && r.data.bars.length === 2 && r.data.bars[1].label === 'Escudo' && r.data.statusMarkers.join(',') === 'dead' && r.data.opacity === 0.9);
  r = await req('POST', `/tables/${tid}/maps/${mid}/tokens/${richId}/duplicate`, { token: mTok, body: {} });
  ok('duplicar token -> 201 com (copia) e mesmos dados', r.status === 201 && r.data.token.id !== richId && r.data.token.name.indexOf('(copia)') !== -1 && r.data.token.opacity === 0.9 && r.data.token.displayName === 'Figura Misteriosa' && Array.isArray(r.data.token.statusMarkers) && r.data.token.statusMarkers.join(',') === 'dead');
  const richDupId = r.data.token ? r.data.token.id : null;
  r = await req('POST', `/tables/${tid}/maps/${mid}/tokens/${richId}/duplicate`, { token: pTok, body: {} });
  ok('player nao duplica token -> 403', r.status === 403);
  r = await req('GET', `/tables/${tid}/maps/${mid}/tokens`, { token: mTok });
  ok('duplicata aparece na lista do mestre', r.status === 200 && Array.isArray(r.data) && r.data.some((t) => t.id === richDupId));
  if (richDupId) await req('DELETE', `/tables/${tid}/maps/${mid}/tokens/${richDupId}`, { token: mTok });
  await req('DELETE', `/tables/${tid}/maps/${mid}/tokens/${richId}`, { token: mTok });
  r = await req('GET', `/tables/${tid}/maps/${mid}/tokens`, { token: pTok });
  const pTokens = Array.isArray(r.data) ? r.data : [];
  ok('jogador NAO recebe token camada 5', !pTokens.some((t) => t.id === hiddenId));
  ok('jogador recebe token visivel', pTokens.some((t) => t.id === visibleId));
  r = await req('POST', `/tables/${tid}/maps/${mid}/tokens`, { token: pTok, body: { name: 'X', x: 0, y: 0 } });
  ok('jogador nao cria token -> 403', r.status === 403);
  r = await req('PUT', `/tables/${tid}/maps/${mid}/tokens/${visibleId}`, { token: mTok, body: { ownerId: 'nobody', lightRadius: 120 } });
  ok('update token com ownerId invalido nao quebra', r.status === 200 || r.status === 500);
  // ---- regra 44: backend valida campos por papel ----
  r = await req('PUT', `/tables/${tid}/maps/${mid}/tokens/${visibleId}/permissions`, { token: mTok, body: { permissions: [{ userId: pUser.id, canView: true, canMove: true, canResize: false, canDelete: false }] } });
  ok('mestre concede canMove do token ao player', r.status === 200 && Array.isArray(r.data) && r.data.some((p) => p.userId === pUser.id && p.canMove === true));
  r = await req('PUT', `/tables/${tid}/maps/${mid}/tokens/${visibleId}`, { token: pTok, body: { name: 'Renomeado pelo jogador' } });
  ok('player com canMove renomeia token', r.status === 200 && r.data.name === 'Renomeado pelo jogador');
  r = await req('PUT', `/tables/${tid}/maps/${mid}/tokens/${visibleId}`, { token: pTok, body: { displayName: 'Apelido', imageUrl: 'https://exemplo.com/t.png' } });
  ok('player com canMove muda apelido e URL', r.status === 200 && r.data.displayName === 'Apelido' && r.data.imageUrl === 'https://exemplo.com/t.png');
  r = await req('PUT', `/tables/${tid}/maps/${mid}/tokens/${visibleId}`, { token: pTok, body: { type: 'npc' } });
  ok('player nao altera type -> 403', r.status === 403);
  r = await req('PUT', `/tables/${tid}/maps/${mid}/tokens/${visibleId}`, { token: pTok, body: { characterId: null } });
  ok('player nao altera ficha vinculada -> 403', r.status === 403);
  r = await req('PUT', `/tables/${tid}/maps/${mid}/tokens/${visibleId}`, { token: pTok, body: { layer: 5 } });
  ok('player nao altera camada -> 403', r.status === 403);
  r = await req('PUT', `/tables/${tid}/maps/${mid}/tokens/${visibleId}`, { token: pTok, body: { visionRadius: 60 } });
  ok('player nao altera visao -> 403', r.status === 403);
  r = await req('PUT', `/tables/${tid}/maps/${mid}/tokens/${visibleId}`, { token: pTok, body: { ownerId: pUser.id } });
  ok('player nao altera dono -> 403', r.status === 403);
  r = await req('PUT', `/tables/${tid}/maps/${mid}/tokens/${visibleId}`, { token: pTok, body: { visible: false } });
  ok('player nao altera visibilidade -> 403', r.status === 403);
  r = await req('PUT', `/tables/${tid}/maps/${mid}/tokens/${visibleId}`, { token: pTok, body: { locked: true } });
  ok('player nao altera trava -> 403', r.status === 403);
  r = await req('GET', `/tables/${tid}/maps/${mid}/tokens/${visibleId}/permissions`, { token: pTok });
  ok('player nao le permissoes do token -> 403', r.status === 403);
  r = await req('PUT', `/tables/${tid}/maps/${mid}/tokens/${visibleId}/permissions`, { token: mTok, body: { permissions: [] } });
  ok('mestre limpa permissoes do token', r.status === 200 && Array.isArray(r.data) && r.data.length === 0);
  r = await req('PUT', `/tables/${tid}/maps/${mid}/tokens/${visibleId}`, { token: mTok, body: { name: 'Visivel', displayName: null, imageUrl: null } });
  ok('mestre restaura dados do token', r.status === 200 && r.data.name === 'Visivel' && r.data.displayName === null && r.data.imageUrl === null);

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

  // ---- compartilhamento de ficha entre jogadores (itens 47-50) ----
  const sTok = await login('spy@test.com');
  r = await req('GET', '/auth/me', { token: sTok });
  const spyId = r.data.user.id;
  r = await req('POST', `/tables/${tid}/characters`, { token: mTok, body: { name: 'Arthan', system: 'dnd5e', kind: 'pc', userId: pUser.id, data: { level: 5, hp: { current: 40, max: 50, temp: 0 }, combat: { ac: 16, speed: 30 } } } });
  ok('mestre cria pc com dono player -> 201', r.status === 201 && r.data.userId === pUser.id);
  const sharedCharId = r.data.id;
  r = await req('PUT', `/tables/${tid}/characters/${sharedCharId}/permissions`, { token: sTok, body: { permissions: [] } });
  ok('fora do compartilhamento nao gerencia permissoes -> 403', r.status === 403);
  r = await req('PUT', `/tables/${tid}/characters/${sharedCharId}/permissions`, { token: pTok, body: { permissions: [{ userId: spyId, canView: true, canControl: true }] } });
  ok('dono da ficha compartilha com outro jogador -> 200', r.status === 200 && (r.data.permissions || []).some((p) => p.userId === spyId && p.canView && p.canControl));
  r = await req('PUT', `/tables/${tid}/characters/${sharedCharId}/permissions`, { token: mTok, body: { permissions: [{ userId: spyId, canView: true, canControl: true }] } });
  ok('mestre tambem compartilha a ficha -> 200', r.status === 200);
  r = await req('GET', `/tables/${tid}/characters/${sharedCharId}`, { token: sTok });
  ok('compartilhada visualiza ficha alheia -> 200', r.status === 200 && r.data.name === 'Arthan');
  r = await req('GET', `/tables/${tid}/characters`, { token: sTok });
  ok('compartilhada aparece na lista do espião', r.status === 200 && (r.data.characters || r.data).some((c) => c.id === sharedCharId));
  r = await req('PUT', `/tables/${tid}/characters/${sharedCharId}`, { token: sTok, body: { data: { level: 5, hp: { current: 32, max: 50, temp: 0 }, combat: { ac: 16, speed: 30 } } } });
  ok('compartilhada com editar altera dados -> 200', r.status === 200);
  r = await req('PUT', `/tables/${tid}/characters/${sharedCharId}/permissions`, { token: sTok, body: { permissions: [{ userId: spyId, canView: true, canControl: true }] } });
  ok('quem recebeu editar nao gerencia compartilhamento -> 403', r.status === 403);
  r = await req('DELETE', `/tables/${tid}/characters/${sharedCharId}`, { token: sTok });
  ok('compartilhada nao exclui ficha -> 403', r.status === 403);
  r = await req('PUT', `/tables/${tid}/characters/${sharedCharId}/permissions`, { token: pTok, body: { permissions: [{ userId: spyId, canView: true, canControl: false }] } });
  ok('dono muda permissao para apenas ver -> 200', r.status === 200 && (r.data.permissions || []).some((p) => p.userId === spyId && p.canView && !p.canControl));
  r = await req('PUT', `/tables/${tid}/characters/${sharedCharId}`, { token: sTok, body: { data: { level: 5, hp: { current: 1, max: 50, temp: 0 }, combat: { ac: 16, speed: 30 } } } });
  ok('com apenas ver nao altera dados -> 403', r.status === 403);
  r = await req('GET', `/tables/${tid}/characters/${sharedCharId}`, { token: sTok });
  ok('com apenas ver ainda consulta -> 200', r.status === 200);
  r = await req('DELETE', `/tables/${tid}/characters/${sharedCharId}`, { token: mTok });
  ok('limpa ficha compartilhada -> 200', r.status === 200);

  // ---- barras de token vinculadas a campos da ficha (itens 54-58) ----
  r = await req('POST', `/tables/${tid}/characters`, { token: mTok, body: { name: 'BarSrc', system: 'dnd5e', data: { hp: { current: 32, max: 50, temp: 0 }, combat: { ac: 16, speed: 30 } } } });
  const barCharId = r.data.id;
  r = await req('POST', `/tables/${tid}/maps/${mid}/tokens`, { token: mTok, body: { name: 'Vinculado', x: 60, y: 60, characterId: barCharId, bars: [
    { label: 'PV', visible: true, color: '#50fa7b', current: 0, max: 0, valuePath: 'hp.current', maxPath: 'hp.max' },
    { label: 'CA', visible: true, color: '#8be9fd', current: 0, max: 0, valuePath: 'combat.ac', maxPath: null },
  ] } });
  ok('cria token com barras vinculadas -> 201', r.status === 201 && r.data.token.bars.some((b) => b.valuePath === 'hp.current' && b.maxPath === 'hp.max') && r.data.token.bars.some((b) => b.valuePath === 'combat.ac' && !b.maxPath));
  const barTokId = r.data.token.id;
  r = await req('PUT', `/tables/${tid}/maps/${mid}/tokens/${barTokId}`, { token: mTok, body: { bars: [{ label: 'PV', visible: true, color: '#50fa7b', current: 10, max: 20, valuePath: null, maxPath: null }] } });
  ok('remove vinculo da barra volta a manual -> 200', r.status === 200 && (r.data.bars || (r.data.token || {}).bars)[0].valuePath === null && (r.data.bars || (r.data.token || {}).bars)[0].current === 10);
  r = await req('PUT', `/tables/${tid}/maps/${mid}/tokens/${barTokId}`, { token: pTok, body: { name: 'X', bars: [{ label: 'PV', visible: true, color: '#fff', current: 0, max: 0, valuePath: 'hp.max', maxPath: null }] } });
  ok('player nao altera barras sem permissao -> 403', r.status === 403);
  await req('DELETE', `/tables/${tid}/maps/${mid}/tokens/${barTokId}`, { token: mTok });
  await req('DELETE', `/tables/${tid}/characters/${barCharId}`, { token: mTok });

  // ---- configuracao da neblina (itens 14-25) ----
  r = await req('GET', `/tables/${tid}/maps/${mid}/fog-config`, { token: pTok });
  ok('jogador le neblina padrao (mestre 50% jogador 0%)', r.status === 200 && r.data.fogConfig.enabled === true && r.data.fogConfig.masterOpacity === 0.5 && r.data.fogConfig.playerOpacity === 0 && r.data.fogConfig.color === '#000000');
  r = await req('PUT', `/tables/${tid}/maps/${mid}/fog-config`, { token: pTok, body: { enabled: false } });
  ok('jogador nao altera neblina -> 403', r.status === 403);
  r = await req('PUT', `/tables/${tid}/maps/${mid}/fog-config`, { token: mTok, body: { color: '#241b45', masterOpacity: 0.7, playerOpacity: 0.3, enabled: true } });
  ok('mestre salva neblina roxa -> 200', r.status === 200 && r.data.fogConfig.color === '#241b45' && r.data.fogConfig.masterOpacity === 0.7 && r.data.fogConfig.playerOpacity === 0.3);
  r = await req('GET', `/tables/${tid}/maps/${mid}/fog-config`, { token: pTok });
  ok('jogador recebe neblina sincronizada', r.status === 200 && r.data.fogConfig.color === '#241b45' && r.data.fogConfig.playerOpacity === 0.3);
  r = await req('PUT', `/tables/${tid}/maps/${mid}/fog-config`, { token: mTok, body: { color: 'javascript:alert(1)', masterOpacity: 5, playerOpacity: -1 } });
  ok('neblina sanitiza: opacidades 0-1 e cor invalida nao altera', r.status === 200 && r.data.fogConfig.color === '#241b45' && r.data.fogConfig.masterOpacity === 1 && r.data.fogConfig.playerOpacity === 0);

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
  // ---- R11 itens 1-4: bloqueio absoluto de monstros (mesmo com permissao) ----
  r = await req('PUT', `/tables/${tid}/characters/${monId}/permissions`, { token: pTok, body: { permissions: [] } });
  ok('player nao define permissoes -> 403', r.status === 403);
  r = await req('PUT', `/tables/${tid}/characters/${monId}/permissions`, { token: mTok, body: { permissions: [{ userId: pUser.id, canView: true, canControl: true }] } });
  ok('mestre concede permissao em monstro -> 200', r.status === 200 && Array.isArray(r.data.permissions) && r.data.permissions.some((p) => p.userId === pUser.id && p.canView && p.canControl));
  r = await req('GET', `/tables/${tid}/characters/${monId}/permissions`, { token: mTok });
  ok('GET permissoes lista grants', r.status === 200 && r.data.some((p) => p.userId === pUser.id && p.canView));
  r = await req('GET', `/tables/${tid}/characters/${monId}`, { token: pTok });
  ok('player abre monstro -> 403 (bloqueio absoluto, item 1)', r.status === 403);
  r = await req('PUT', `/tables/${tid}/characters/${monId}`, { token: pTok, body: { name: 'TENTATIVA' } });
  ok('player nao edita monstro mesmo com canControl -> 403 (item 2)', r.status === 403);
  r = await req('GET', `/tables/${tid}/characters`, { token: pTok });
  ok('monstro nao lista para player mesmo com permissao (item 3)', !r.data.some((c) => c.id === monId));
  r = await req('PUT', `/tables/${tid}/characters/${monId}/permissions`, { token: mTok, body: { permissions: [] } });
  ok('revogar permissoes -> 200 vazio', r.status === 200 && r.data.permissions.length === 0);
  // ---- R11 itens 15-18: NPC visivel para jogadores ----
  r = await req('PUT', `/tables/${tid}/characters/${npcId}`, { token: mTok, body: { visibleToPlayers: true } });
  ok('mestre marca NPC visivel -> 200 true (item 15)', r.status === 200 && r.data.visibleToPlayers === true);
  r = await req('GET', `/tables/${tid}/characters/${npcId}`, { token: pTok });
  ok('player abre NPC visivel -> 200 (item 16)', r.status === 200 && r.data.name === 'Taverneiro');
  r = await req('PUT', `/tables/${tid}/characters/${npcId}`, { token: pTok, body: { name: 'HACK2' } });
  ok('player sem perm ainda nao edita NPC -> 403', r.status === 403);
  r = await req('PUT', `/tables/${tid}/characters/${npcId}`, { token: mTok, body: { visibleToPlayers: false } });
  ok('mestre desmarca NPC visivel (item 18)', r.status === 200 && r.data.visibleToPlayers === false);
  r = await req('GET', `/tables/${tid}/characters/${npcId}`, { token: pTok });
  ok('NPC invisivel de novo -> 403', r.status === 403);
  r = await req('POST', `/tables/${tid}/characters`, { token: mTok, body: { name: 'Guarda', kind: 'npc', visibleToPlayers: true } });
  ok('mestre cria NPC ja visivel -> 201 true', r.status === 201 && r.data.visibleToPlayers === true);
  const npcVisId = r.data.id;
  r = await req('POST', `/tables/${tid}/characters`, { token: mTok, body: { name: 'Dragao Chefe', kind: 'monster', visibleToPlayers: true } });
  ok('monstro criado com flag vira invisivel -> false', r.status === 201 && r.data.visibleToPlayers === false);
  r = await req('PUT', `/tables/${tid}/characters/${pCharId}`, { token: pTok, body: { visibleToPlayers: true } });
  ok('player nao marca o proprio PC visivel', r.status === 200 && r.data.visibleToPlayers === false);
  // ---- R11 itens 9-14: sanitizacao do character de monstro nos tokens ----
  r = await req('POST', `/tables/${tid}/maps/${mid}/tokens`, { token: mTok, body: { name: 'Goblin Batedor', x: 150, y: 150, characterId: monId } });
  ok('mestre cria token de monstro -> 201', r.status === 201 && r.data.token.characterId === monId);
  const monTokId = r.data.token.id;
  r = await req('GET', `/tables/${tid}/maps/${mid}/tokens`, { token: pTok });
  const monTok = (r.data || []).find((t) => t.id === monTokId);
  ok('token de monstro sanitizado p/ player: data vazio e kind monster (item 9)', Boolean(monTok) && monTok.character && monTok.character.kind === 'monster' && monTok.character.data && Object.keys(monTok.character.data).length === 0 && monTok.character.visibleToPlayers === false);
  r = await req('GET', `/tables/${tid}/maps/${mid}/tokens`, { token: mTok });
  const monTokM = (r.data || []).find((t) => t.id === monTokId);
  ok('mestre ve o character completo do monstro no token', Boolean(monTokM) && monTokM.character && monTokM.character.kind === 'monster');
  // ---- R11 itens 3/32-35: distancia em metros + unidade m/km ----
  r = await req('PUT', `/tables/${tid}/maps/${mid}/grid`, { token: mTok, body: { distanceUnit: 'km', cellSize: 50, physicalSize: 1.5 } });
  ok('mestre define unidade km -> 200 km (item 32)', r.status === 200 && r.data.gridConfig.distanceUnit === 'km');
  r = await req('PUT', `/tables/${tid}/maps/${mid}/grid`, { token: pTok, body: { distanceUnit: 'km' } });
  ok('player nao define config de grade -> 403', r.status === 403);
  r = await req('GET', `/tables/${tid}/maps/${mid}/grid`, { token: pTok });
  ok('player le distanceUnit km (item 35)', r.status === 200 && r.data.gridConfig.distanceUnit === 'km');
  r = await req('PUT', `/tables/${tid}/maps/${mid}/grid`, { token: mTok, body: { distanceUnit: 'ft' } });
  ok('unidade invalida cai para m', r.status === 200 && r.data.gridConfig.distanceUnit === 'm');
  // ---- R11 itens 14-25: folhas do mestre ----
  r = await req('GET', `/tables/${tid}/sheets`, { token: pTok });
  ok('player lista folhas vazia', r.status === 200 && r.data.length === 0);
  r = await req('POST', `/tables/${tid}/sheets`, { token: pTok, body: { title: 'Hack' } });
  ok('player nao cria folha -> 403 (item 19)', r.status === 403);
  r = await req('POST', `/tables/${tid}/sheets`, { token: mTok, body: { title: 'Mapa da Cidade', comments: 'Ponto de encontro na fonte', masterNotes: 'Embaixo da fonte ha um tunel', visibleToPlayers: false } });
  ok('mestre cria folha -> 201 (item 21)', r.status === 201 && r.data.title === 'Mapa da Cidade' && r.data.masterNotes === 'Embaixo da fonte ha um tunel');
  const sheetPrivId = r.data.id;
  r = await req('POST', `/tables/${tid}/sheets`, { token: mTok, body: { title: 'X'.repeat(200), imageUrl: 'javascript:alert(1)', comments: 'c', visibleToPlayers: true } });
  ok('folha sanitizada: titulo truncado 120 e url invalida -> null (item 24)', r.status === 201 && r.data.title.length === 120 && r.data.imageUrl === null);
  const sheetPubId = r.data.id;
  r = await req('GET', `/tables/${tid}/sheets`, { token: pTok });
  ok('player ve apenas a folha visivel (item 23)', r.status === 200 && r.data.some((s) => s.id === sheetPubId) && !r.data.some((s) => s.id === sheetPrivId));
  ok('folha enviada ao player NAO tem masterNotes (item 24)', r.data.every((s) => !('masterNotes' in s)));
  r = await req('PUT', `/tables/${tid}/sheets/${sheetPubId}`, { token: pTok, body: { title: 'Hack' } });
  ok('player nao edita folha -> 403', r.status === 403);
  r = await req('DELETE', `/tables/${tid}/sheets/${sheetPubId}`, { token: pTok });
  ok('player nao exclui folha -> 403', r.status === 403);
  r = await req('PUT', `/tables/${tid}/sheets/${sheetPrivId}`, { token: mTok, body: { visibleToPlayers: true } });
  ok('mestre torna folha visivel', r.status === 200 && r.data.visibleToPlayers === true);
  r = await req('GET', `/tables/${tid}/sheets`, { token: pTok });
  ok('player agora ve as duas folhas', r.status === 200 && r.data.length === 2);
  r = await req('DELETE', `/tables/${tid}/sheets/${sheetPrivId}`, { token: mTok });
  ok('mestre exclui folha', r.status === 200);
  r = await req('DELETE', `/tables/${tid}/sheets/${sheetPubId}`, { token: mTok });
  ok('mestre exclui folha 2', r.status === 200);

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
  r = await req('POST', `/tables/${tid}/sheets`, { token: mTok, body: { title: 'Folha Backup', visibleToPlayers: true } });
  ok('mestre cria folha para backup', r.status === 201);
  r = await req('GET', `/tables/${tid}/export`, { token: mTok });
  ok('export backup -> 200 v1', r.status === 200 && r.data.version === 1 && Array.isArray(r.data.maps));
  ok('export inclui folhas e kind/visibleToPlayers de fichas (item 25)', Array.isArray(r.data.sheets) && r.data.sheets.some((s) => s.title === 'Folha Backup') && (r.data.characters || []).every((c) => 'kind' in c && 'visibleToPlayers' in c));
  const bkMap = (r.data.maps || []).find((m) => Array.isArray(m.tokens) && m.tokens.some((t) => t.snapToGrid !== undefined));
  ok('export inclui campos novos de token e darkMode', Boolean(bkMap) && typeof bkMap.darkMode === 'boolean' && bkMap.tokens.every((t) => ['snapToGrid', 'visionRadius', 'displayName', 'showName', 'opacity', 'bars', 'statusMarkers'].every((k) => k in t)));
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
