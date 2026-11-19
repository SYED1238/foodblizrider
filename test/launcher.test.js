import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { normalizeCode, isValidHttpsBaseUrl, buildDeliveryUrl, resolveRestaurant } from '../public/app.js';

test('Foodbliz Rider Launcher verification suite', async (t) => {
  const restaurantsJson = JSON.parse(fs.readFileSync(path.resolve('public/restaurants.json'), 'utf8'));
  const appJs = fs.readFileSync(path.resolve('public/app.js'), 'utf8');
  const headersTxt = fs.readFileSync(path.resolve('public/_headers'), 'utf8');

  await t.test('1. restaurants.json includes active SAVERA entry with valid HTTPS URL', () => {
    assert.ok(restaurantsJson.SAVERA, 'SAVERA entry must exist');
    assert.strictEqual(restaurantsJson.SAVERA.active, true);
    assert.strictEqual(isValidHttpsBaseUrl(restaurantsJson.SAVERA.baseUrl), true);
  });

  await t.test('2. normalizeCode handles lowercase, whitespace, and punctuation safely', () => {
    assert.strictEqual(normalizeCode('  savera '), 'SAVERA');
    assert.strictEqual(normalizeCode('royal-1!@#'), 'ROYAL-1');
    assert.strictEqual(normalizeCode(''), '');
  });

  await t.test('3. resolveRestaurant matches valid active entries and rejects inactive/HTTP entries', () => {
    const match = resolveRestaurant(restaurantsJson, 'savera');
    assert.strictEqual(match.code, 'SAVERA');
    assert.strictEqual(buildDeliveryUrl(match), 'https://saveraparadise.foodbliz.in/delivery');

    const badDir = {
      OFF: { name: 'Off', baseUrl: 'https://off.foodbliz.in', active: false },
      INSECURE: { name: 'Bad', baseUrl: 'http://bad.foodbliz.in', active: true }
    };
    assert.strictEqual(resolveRestaurant(badDir, 'OFF'), null);
    assert.strictEqual(resolveRestaurant(badDir, 'INSECURE'), null);
  });

  await t.test('4. app.js calls AndroidNative bridge hooks and _headers disables cache on restaurants.json', () => {
    assert.match(appJs, /AndroidNative\.setRestaurantBaseUrl/);
    assert.match(appJs, /AndroidNative\.clearRestaurantBaseUrl/);
    assert.match(headersTxt, /\/restaurants\.json[\s\S]*no-cache/);
  });
});
