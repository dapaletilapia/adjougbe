// Parcours de bout en bout dans un vrai Chrome (lancé par run.sh).
import { authenticator } from 'otplib'
import puppeteer from 'puppeteer-core'

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:5181'
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const results = []
let browser
let lastPage = null

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function check(cond, msg) { if (!cond) throw new Error(msg) }

/** Clique sur le premier élément visible correspondant au sélecteur et contenant le texte. */
async function clickText(page, selector, text) {
  const ok = await page.evaluate((sel, txt) => {
    const el = [...document.querySelectorAll(sel)].find((e) => e.textContent.trim().includes(txt) && e.getClientRects().length)
    if (el) el.click()
    return !!el
  }, selector, text)
  check(ok, `Élément introuvable : ${selector} « ${text} »`)
}
const waitText = (page, text, timeout = 8000) =>
  page.waitForFunction((t) => document.body.innerText.includes(t), { timeout }, text).catch(() => { throw new Error(`Texte absent : « ${text} »`) })

async function newPage(width = 1280, { skipPopup = true } = {}) {
  const ctx = await browser.createBrowserContext()
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  if (skipPopup) await page.evaluateOnNewDocument(() => { try { localStorage.setItem('adj-punchline-vue', new Date().toISOString().slice(0, 10)) } catch { /* */ } })
  await page.setViewport({ width, height: width < 700 ? 844 : 900 })
  page.errors = errors
  lastPage = page
  return page
}
const go = (page, path) => page.goto(BASE + path, { waitUntil: 'networkidle0' })

async function login(page, email, password) {
  await go(page, '/connexion')
  await page.type('input[type=email]', email)
  await page.type('input[autocomplete="current-password"]', password)
  await clickText(page, 'button', 'Se connecter')
}

async function test(name, fn) {
  const t0 = Date.now()
  try { await fn(); results.push([true, name, Date.now() - t0]) } catch (e) {
    // Capture de l'écran au moment de l'échec, pour comprendre sans relancer.
    const shot = new URL(`./.echec-${results.length + 1}.png`, import.meta.url).pathname
    await lastPage?.screenshot({ path: shot, fullPage: true }).catch(() => {})
    results.push([false, name, `${e.message}\n    (adresse : ${lastPage?.url()} · capture : ${shot})`])
  }
}

browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] })

await test("Accueil : la punchline du jour s'ouvre une fois, se ferme avec Échap", async () => {
  const page = await newPage(1280, { skipPopup: false })
  await go(page, '/')
  await page.waitForSelector('[role=dialog]', { timeout: 5000 })
  await page.keyboard.press('Escape')
  await sleep(200)
  check(!(await page.$('[role=dialog]')), 'La popup ne se ferme pas')
  await page.reload({ waitUntil: 'networkidle0' })
  await sleep(1500)
  check(!(await page.$('[role=dialog]')), 'La popup revient le même jour')
  check(!page.errors.length, page.errors.join(' | '))
})

await test("Menu « À propos » → Domaines d'intervention (ordinateur)", async () => {
  const page = await newPage()
  await go(page, '/')
  await page.hover('button[aria-controls="sous-menu-apropos"]')
  await page.waitForSelector('#sous-menu-apropos')
  await clickText(page, '#sous-menu-apropos a', "Domaines d'intervention")
  await page.waitForFunction(() => location.pathname === '/a-propos' && location.hash === '#domaines')
  await page.waitForSelector('#domaines li', { timeout: 6000 })
  await sleep(900)
  const n = await page.$$eval('#domaines li', (l) => l.length)
  check(n >= 6, `Domaines affichés : ${n}`)
  const top = await page.$eval('#domaines', (el) => el.getBoundingClientRect().top)
  check(top < 300, `La page n'a pas défilé jusqu'aux domaines (top=${top})`)
})

await test('Domaines → « Inviter Adjougbe » pré-remplit le sujet du contact', async () => {
  const page = await newPage()
  await go(page, '/a-propos#domaines')
  await page.waitForSelector('#domaines a[href^="/contact"]')
  await clickText(page, '#domaines a', 'Inviter Adjougbe')
  await page.waitForSelector('select')
  const v = await page.$eval('select', (s) => s.value)
  check(v === 'Formation en entreprise', `Sujet : « ${v} »`)
})

await test("Formations : bandeau « À l'affiche », filtre partenaires, lien vers l'organisateur", async () => {
  const page = await newPage()
  await go(page, '/formations')
  await waitText(page, "À l'affiche")
  const rail = await page.$$eval('#affiche-titre ~ ol li, section[aria-labelledby=affiche-titre] li', (l) => l.length)
  check(rail >= 2, `Affiches dans le bandeau : ${rail}`)
  await clickText(page, 'button', 'Chez nos partenaires')
  const titles = await page.$$eval('article h2', (h) => h.map((x) => x.textContent))
  check(titles.length === 1 && titles[0].includes('Forum du leadership'), `Cartes filtrées : ${titles}`)
  await clickText(page, 'article h2 a', 'Forum du leadership')
  await page.waitForFunction(() => location.pathname === '/formations/forum-leadership-e2e')
  await waitText(page, 'Institut Partenaire')
  const a = await page.$eval('a[href="https://exemple.org/inscription-forum"]', (x) => ({ target: x.target, rel: x.rel, text: x.textContent }))
  check(a.target === '_blank' && a.rel.includes('noopener'), 'Le lien externe doit s’ouvrir dans un nouvel onglet, sans opener')
  check(!(await page.evaluate(() => document.body.innerText.includes('Places restantes'))), 'Jauge de places affichée pour une formation externe')
})

await test('Lecteur : inscription à une formation gratuite, jusqu’au billet', async () => {
  const page = await newPage()
  await login(page, 'lecteur@adjougbe.local', 'Lecteur-Demo-2026!')
  await page.waitForFunction(() => location.pathname === '/bibliotheque', { timeout: 8000 })
  // L'inscription sur le site est refusée pour une formation externe : retour à la fiche.
  await go(page, '/formations/forum-leadership-e2e/inscription/999')
  await page.waitForFunction(() => location.pathname === '/formations/forum-leadership-e2e', { timeout: 5000 })
  await go(page, '/formations/atelier-lecture-publique')
  await clickText(page, 'a', 'Réserver ma place')
  await page.waitForFunction(() => location.pathname.includes('/inscription/'))
  await sleep(800)
  // Formulaire d'inscription éventuel : on remplit les champs obligatoires.
  if (await page.$('main form [aria-required="true"], main form [required], main form [role=radiogroup]')) {
    await page.evaluate(() => {
      const set = (el, v) => { const p = Object.getPrototypeOf(el); Object.getOwnPropertyDescriptor(p, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })) }
      for (const el of document.querySelectorAll('main form input:not([type=checkbox]):not([type=hidden]):not([name=_website]), main form textarea'))
        if (!el.readOnly && !el.value) set(el, el.type === 'email' ? 'awa@example.com' : el.type === 'number' ? '3' : el.type === 'tel' ? '0700000000' : 'Réponse de test')
      for (const g of document.querySelectorAll('main form [role=radiogroup]')) if (!g.querySelector('[aria-checked=true]')) g.querySelector('[role=radio]')?.click()
      for (const s of document.querySelectorAll('main form select')) if (!s.value && s.options.length > 1) set(s, s.options[1].value)
      for (const c of document.querySelectorAll('main form input[type=checkbox]')) if (!c.checked && c.closest('label')?.textContent.match(/accepte|consens/i)) c.click()
    })
    await clickText(page, 'main form button', 'Continuer')
    await sleep(800)
  }
  await clickText(page, 'button', "Confirmer l'inscription")
  await page.waitForFunction(() => location.pathname.startsWith('/compte/formations/'), { timeout: 8000 })
  await waitText(page, 'Votre place est réservée')
  check(!page.errors.length, page.errors.join(' | '))
})

await test('Studio : formation chez un organisateur (lien obligatoire) et domaine ajouté', async () => {
  const page = await newPage()
  await login(page, 'admin@adjougbe.local', 'Adjougbe-Demo-2026!')
  await page.waitForFunction(() => location.pathname === '/admin/verification', { timeout: 8000 })
  await page.waitForSelector('input[inputmode=numeric]')
  await page.click('input[inputmode=numeric]')
  await page.keyboard.type(authenticator.generate(process.env.E2E_OTP_SECRET))
  await clickText(page, 'button', 'Vérifier')
  await page.waitForFunction(() => location.pathname === '/admin', { timeout: 8000 })

  await go(page, '/admin/formations/nouvelle')
  await page.waitForSelector('input.input')
  await page.type('input.input', 'Atelier chez un partenaire')
  await clickText(page, 'label', "Chez l'organisateur")
  await clickText(page, 'button', 'Enregistrer')
  await waitText(page, "Indiquez le lien du formulaire de l'organisateur.")
  await page.type('input[type=url]', 'https://partenaire.example/inscription')
  await clickText(page, 'button', 'Enregistrer')
  await waitText(page, 'Formation enregistrée.')

  await go(page, '/admin/parametres?onglet=pages&page=domaines')
  await clickText(page, 'button', '+ Nouveau domaine')
  await page.waitForSelector('input[placeholder^="Ex. Prise"]')
  await page.type('input[placeholder^="Ex. Prise"]', 'Gouvernance associative')
  await clickText(page, 'button', 'Enregistrer')
  await waitText(page, 'Domaine enregistré.')
  await go(page, '/a-propos')
  await waitText(page, 'Gouvernance associative')
  check(!page.errors.length, page.errors.join(' | '))
})

await test('Mobile : sous-menu « À propos », aucune page ne déborde', async () => {
  const page = await newPage(390)
  await go(page, '/formations')
  await page.click('button[aria-controls="menu-mobile"]')
  await page.waitForSelector('#menu-mobile')
  await clickText(page, '#menu-mobile a', "Domaines d'intervention")
  await page.waitForFunction(() => location.hash === '#domaines' && !document.getElementById('menu-mobile'), { timeout: 5000 })
  for (const p of ['/', '/formations', '/formations/forum-leadership-e2e', '/a-propos', '/boutique', '/blog', '/contact', '/connexion', '/panier']) {
    await go(page, p)
    const [sw, cw] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth])
    check(sw <= cw, `${p} déborde : ${sw}px > ${cw}px`)
  }
  check(!page.errors.length, page.errors.join(' | '))
})

await browser.close()
let failed = 0
for (const [ok, name, info] of results) {
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? ` (${info} ms)` : `\n    → ${info}`}`)
  if (!ok) failed++
}
console.log(`\n${results.length - failed}/${results.length} parcours réussis`)
process.exit(failed ? 1 : 0)
