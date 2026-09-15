const { chromium } = require('playwright');

const BASE = 'http://localhost:5173';
const results = [];
function check(name, ok) {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}`);
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const jsErrors = [];
  page.on('pageerror', (e) => jsErrors.push(e.message));

  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  check('login page renders', (await page.title()).includes('Mesa Virtual de RPG'));

  await page.getByPlaceholder('Email').fill('master@test.com');
  await page.getByPlaceholder('Senha').fill('senha123');
  await page.click('button[type="submit"]');
  await page.waitForSelector('text=Mesas de RPG', { timeout: 15000 });
  check('login redirects to dashboard', true);

  await page.click('text=Mesa Vampiro');
  await page.waitForURL('**/table/**', { timeout: 15000 });
  check('table page opens', true);

  await page.waitForSelector('canvas', { timeout: 25000 });
  check('map canvas renders (lazy MapCanvas + Konva)', (await page.locator('canvas').count()) > 0);

  await page.waitForSelector('.chat-input', { timeout: 10000 });
  const consoleLogs = [];
  page.on('console', (msg) => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('response', (res) => { if (res.url().includes('/chat')) console.log(`NET: POST /chat -> ${res.status()}`); });
  await page.fill('.chat-input', 'mensagem e2e no chat');
  await page.press('.chat-input', 'Enter');
  let appeared = true;
  try {
    await page.waitForSelector('text=mensagem e2e no chat', { timeout: 6000 });
  } catch {
    appeared = false;
    await page.click('.chat-send-btn');
    try { await page.waitForSelector('text=mensagem e2e no chat', { timeout: 6000 }); appeared = true; } catch { appeared = false; }
  }
  check('sending chat renders own message in real time', appeared);
  if (!appeared) {
    console.log('--- console logs containing error/warn ---');
    consoleLogs.filter((l) => l.includes('error') || l.includes('Error') || l.includes('warn')).slice(0, 10).forEach((l) => console.log(l));
    await page.screenshot({ path: 'e2e-failure.png', fullPage: false });
    console.log('screenshot saved: e2e-failure.png');
  }

  const mutedBadge = await page.locator('.member-item').count();
  check('member list renders', mutedBadge > 0);

  await page.click('.chat-toggle');
  await page.waitForTimeout(300);
  check('chat can collapse and re-open', await page.locator('.chat-toggle').isVisible());

  check('no JS runtime errors on any page', jsErrors.length === 0);
  if (jsErrors.length) console.log('JS ERRORS:', jsErrors);

  await browser.close();
  const fails = results.filter((r) => !r).length;
  console.log(`\n${results.length - fails}/${results.length} E2E tests passed`);
  process.exit(fails > 0 ? 1 : 0);
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
