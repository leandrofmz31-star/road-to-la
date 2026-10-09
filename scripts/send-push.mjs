#!/usr/bin/env node
// Road to LA: envía la notificación del día por Web Push. Lo ejecuta GitHub Actions.
// Prueba local sin enviar nada:  DRY_RUN=1 node scripts/send-push.mjs
// Probar otra fecha:             DRY_RUN=1 FORCE_DATE=2026-10-19 node scripts/send-push.mjs
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(here, '..', 'data.js'), 'utf8'), context, { filename: 'data.js' });
const D = context.ROAD_TO_LA;

const crToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: D.CONFIG.timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const today = process.env.FORCE_DATE || crToday();
const msg = D.notificationFor(today);
if (!msg) {
  console.log(`Sin notificación para ${today}: fuera del rango de la cuenta regresiva.`);
  process.exit(0);
}
const payload = JSON.stringify({ title: msg.title, body: msg.body, url: msg.url, tag: 'road-to-la-daily' });
if (process.env.DRY_RUN) {
  console.log(`[prueba] ${today}: ${payload}`);
  process.exit(0);
}

const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, PUSH_SUBSCRIPTIONS } = process.env;
if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !PUSH_SUBSCRIPTIONS) {
  console.log('Web Push no está configurado (faltan secretos). No se envió nada.');
  process.exit(0);
}

const { default: webpush } = await import('web-push');
webpush.setVapidDetails(VAPID_SUBJECT || 'mailto:road-to-la@example.com', VAPID_PUBLIC_KEY.trim(), VAPID_PRIVATE_KEY.trim());

let subs;
try {
  subs = JSON.parse(PUSH_SUBSCRIPTIONS);
} catch (e) {
  console.error('PUSH_SUBSCRIPTIONS no es JSON válido. Pega la suscripción tal como la copia la app.');
  process.exit(1);
}
if (!Array.isArray(subs)) subs = [subs];

let ok = 0;
let failed = 0;
for (const sub of subs) {
  try {
    await webpush.sendNotification(sub, payload, { TTL: 6 * 3600, urgency: 'normal' });
    ok += 1;
  } catch (err) {
    failed += 1;
    const gone = err.statusCode === 404 || err.statusCode === 410;
    console.error(`Falló un envío (${err.statusCode || 'sin código'})${gone ? ': la suscripción expiró; vuelve a activarla en la app.' : `: ${err.body || err.message}`}`);
  }
}
console.log(`${today}: ${ok} enviada(s), ${failed} fallida(s).`);
if (ok === 0 && failed > 0) process.exit(1);
