import test from 'node:test';
import assert from 'node:assert/strict';
import { DATA_META, ITEMS, RECYCLERS, RAID_TARGETS, EXPLOSIVES } from '../assets/data.js';
import { validQuantity, calculateRaid, calculateRecycle, steamIdFromInput, extractSteamIds } from '../assets/engine.js';

const option = (target, explosive, quantity = 1) => calculateRaid(target, quantity).options.find(o => o.id === explosive);
const amount = (rows, shortname) => rows.find(r => r.shortname === shortname)?.amount ?? 0;
const steam = (universe = 1n, type = 1n, instance = 1n, account = 12345n) =>
  ((universe << 56n) | (type << 52n) | (instance << 32n) | account).toString();

test('snapshot metadata is pinned, build is independent from timestamps', () => {
  assert.match(DATA_META.commit, /^[a-f0-9]{40}$/);
  assert.equal(DATA_META.build, '25824447');
  assert.equal(DATA_META.buildId, DATA_META.build);
  assert.equal(DATA_META.commit, '1204329518584db8e7f242e0f5671edeebf9d18e');
  assert.equal(DATA_META.updated, '2026-10-10T00:04:54Z');
  assert.equal(DATA_META.checked, '2026-10-12T05:43:40Z');
  for (const [name, url] of Object.entries(DATA_META.sources)) {
    assert.ok(url.includes(`/${DATA_META.commit}/data/${name}.json`));
    assert.match(DATA_META.sha256[name], /^[a-f0-9]{64}$/);
  }
});

test('all recyclable items are retained, including hidden items and fractional yields', () => {
  assert.equal(ITEMS.length, 1001);
  assert.equal(DATA_META.recyclableItemCount, ITEMS.length);
  assert.equal(DATA_META.upstreamItemCount, 1307);
  assert.equal(new Set(ITEMS.map(i => i.id)).size, ITEMS.length);
  assert.ok(ITEMS.some(i => i.hidden));
  assert.ok(ITEMS.some(i => i.output.some(o => o.amount % 1)));
  for (const item of ITEMS) {
    assert.equal(item.id, item.shortname);
    assert.ok(Number.isInteger(item.itemId));
    assert.ok(item.name && item.category && item.source);
    assert.ok(item.output.length > 0);
    for (const output of item.output) assert.ok(output.amount > 0 && output.name && output.shortname);
  }
});

test('quantity validation is strict and inclusive 1..999', () => {
  for (const value of [1, 2, 999]) assert.equal(validQuantity(value), true);
  for (const value of [0, -1, 1000, 1.5, NaN, Infinity, '1', null, true, undefined, 1n]) {
    assert.equal(validQuantity(value), false);
    assert.throws(() => calculateRaid('wall.stone', value), RangeError);
    assert.throws(() => calculateRecycle([{ id: 'techparts', quantity: value }], 'green'), RangeError);
  }
});

test('unknown IDs, bad lines and tiers are rejected', () => {
  assert.throws(() => calculateRaid('unknown', 1), RangeError);
  assert.throws(() => calculateRecycle([], 'unknown'), RangeError);
  assert.throws(() => calculateRecycle({}, 'green'), TypeError);
  assert.throws(() => calculateRecycle([null], 'green'), TypeError);
  assert.throws(() => calculateRecycle([{ id: 'sulfur', quantity: 1 }], 'green'), RangeError);
  assert.throws(() => calculateRecycle([{ id: '__proto__', quantity: 1 }], 'green'), RangeError);
  assert.deepEqual(calculateRecycle([], 'green').outputs, []);
  assert.equal(calculateRecycle([], 'green').timeSeconds, 0);
});

test('recycler speeds, efficiencies and powergrid conditions come from snapshot', () => {
  assert.deepEqual(RECYCLERS.map(r => [r.id, r.efficiency, r.seconds]), [
    ['green', 0.5, 5], ['yellow', 0.4, 8], ['red', 0.75, 4],
  ]);
  assert.equal(RECYCLERS.find(r => r.id === 'red').powergrid.requiredStage, 4);
  assert.equal(RECYCLERS.find(r => r.id === 'green').powergrid.efficiency, 0.6);
  assert.equal(RECYCLERS.find(r => r.id === 'green').powergrid.seconds, 4.5);
});

test('recycler yields are expected values, not floor/ceil guarantees', () => {
  const result = calculateRecycle([{ id: 'techparts', quantity: 1 }], 'red');
  assert.equal(amount(result.outputs, 'metal.refined'), 1.5);
  assert.equal(amount(result.outputs, 'scrap'), 30);
  assert.equal(result.expected, true);
  assert.ok(result.outputs.every(o => o.expected === true));
  assert.equal(result.timeSeconds, 4);
  assert.ok(result.conditions.includes('full durability'));
  const fractional = calculateRecycle([{ id: 'ammo.grenadelauncher.buckshot', quantity: 1 }], 'yellow');
  assert.equal(amount(fractional.outputs, 'gunpowder'), 3);
  assert.equal(amount(fractional.outputs, 'metal.fragments'), 0.8);
});

test('recycler combines duplicate lines and distinct inputs before displaying outputs', () => {
  const result = calculateRecycle([
    { id: 'techparts', quantity: 1 }, { id: 'techparts', quantity: 2 },
    { id: 'riflebody', quantity: 1 },
  ], 'yellow');
  assert.ok(Math.abs(amount(result.outputs, 'metal.refined') - 3.6) < 1e-10);
  assert.equal(amount(result.outputs, 'scrap'), 68);
  assert.equal(result.timeSeconds, 32);
  assert.equal(result.totalQuantity, 4);
  assert.equal(new Set(result.outputs.map(o => o.shortname)).size, result.outputs.length);
});

test('every item/tier combination follows the same expected-output formula', () => {
  for (const item of ITEMS) for (const tier of RECYCLERS) {
    const result = calculateRecycle([{ id: item.id, quantity: 3 }], tier.id);
    for (const output of item.output) {
      const expected = item.output.filter(o => o.shortname === output.shortname)
        .reduce((sum, o) => sum + o.amount * tier.efficiency * 3, 0);
      assert.equal(amount(result.outputs, output.shortname), expected);
    }
    assert.equal(result.timeSeconds, 3 * tier.seconds);
  }
});

test('required raid targets and genuine explosive shortnames exist', () => {
  assert.deepEqual(RAID_TARGETS.map(t => t.id), [
    'wall.wood', 'wall.stone', 'wall.metal', 'wall.armored',
    'floor.wood', 'floor.stone', 'floor.metal', 'floor.armored',
    'door.wood', 'door.metal', 'door.armored', 'garage', 'external.wood', 'external.stone',
  ]);
  assert.equal(EXPLOSIVES.length, 6);
  assert.ok(EXPLOSIVES.some(e => e.id === 'ammo.rocket.basic'));
  assert.ok(EXPLOSIVES.some(e => e.id === 'ammo.rocket.hv'));
  assert.equal(RAID_TARGETS.find(t => t.id === 'door.armored').hp, 1000);
  assert.equal(RAID_TARGETS.find(t => t.id === 'garage').hp, 600);
  assert.equal(RAID_TARGETS.find(t => t.id === 'wall.armored').hp, 2000);
});

test('raid counts preserve actual hard-side damage and ceil separately per target', () => {
  for (const target of RAID_TARGETS) for (const quantity of [1, 3, 999]) {
    const result = calculateRaid(target.id, quantity);
    assert.equal(result.totalHp, target.hp * quantity);
    for (const o of result.options) {
      assert.equal(o.damage, target.damage[o.id]);
      assert.equal(o.unitsPerTarget, Math.ceil(target.hp / o.damage));
      assert.equal(o.unitsPerTarget, target.upstreamHits[o.id]);
      assert.equal(o.units, o.unitsPerTarget * quantity);
    }
  }
  assert.equal(option('door.wood', 'explosive.timed', 2).units, 2);
  assert.equal(option('door.metal', 'ammo.rocket.basic').units, 2);
  assert.equal(option('door.metal', 'ammo.rocket.hv').units, 11);
  assert.equal(option('door.metal', 'explosive.satchel').units, 5);
});

test('raid sorts by sulfur rather than explosive unit count', () => {
  const result = calculateRaid('door.metal', 1);
  assert.equal(result.minSulfur, 1600);
  assert.equal(result.options[0].id, 'ammo.rifle.explosive');
  assert.equal(result.options[0].units, 63);
  for (let i = 1; i < result.options.length; i++) {
    assert.ok(result.options[i - 1].sulfur <= result.options[i].sulfur);
  }
  const minimal = calculateRaid('door.metal', 1, { all: false });
  assert.ok(minimal.options.every(o => o.sulfur === minimal.minSulfur));
  assert.equal(minimal.options.length, 1);
});

test('raid is explicitly labeled as a snapshot model with known gameplay discrepancy', () => {
  const result = calculateRaid('wall.stone', 1);
  assert.equal(result.model, 'snapshot-direct-impact');
  assert.ok(result.warning.includes('13 satchel'));
  assert.ok(result.warning.includes('10 satchel'));
  assert.equal(option('wall.stone', 'explosive.satchel').units, 13);
  assert.equal(option('wall.stone', 'ammo.rifle.explosive').units, 200);
});

test('crafting respects ammo batches and gunpowder batches', () => {
  const ammo = option('door.metal', 'ammo.rifle.explosive');
  assert.equal(ammo.units, 63);
  assert.equal(ammo.craftedUnits, 64);
  assert.equal(ammo.surplus, 1);
  assert.equal(ammo.gunpowder.requested, 640);
  assert.equal(ammo.gunpowder.produced, 640);
  assert.equal(ammo.gunpowder.batches, 64);
  assert.equal(ammo.sulfur, 1600);
  assert.equal(amount(ammo.rawResources, 'metal.fragments'), 320);
  assert.equal(amount(ammo.rawResources, 'charcoal'), 1920);
  assert.equal(amount(ammo.components, 'gunpowder'), 640);
});

test('recursive costs aggregate gunpowder and expand actual craftable components', () => {
  const rocket = option('door.wood', 'ammo.rocket.basic');
  assert.equal(rocket.units, 1);
  assert.equal(rocket.gunpowder.requested, 650);
  assert.equal(rocket.sulfur, 1400);
  assert.equal(amount(rocket.components, 'gunpowder'), 150);
  assert.equal(amount(rocket.components, 'explosives'), 10);
  assert.equal(amount(rocket.rawResources, 'metal.refined'), 4);
  assert.equal(amount(rocket.rawResources, 'scrap'), 40);
  const fuel = rocket.crafted.find(r => r.shortname === 'lowgradefuel');
  assert.equal(fuel.requested, 30);
  assert.equal(fuel.produced, 32);
  assert.equal(fuel.surplus, 2);
  assert.equal(amount(rocket.rawResources, 'fat.animal'), 24);
});

test('noncraftable serialized component recipes remain acquisition leaves', () => {
  const c4 = option('door.wood', 'explosive.timed');
  assert.equal(amount(c4.rawResources, 'techparts'), 2);
  assert.equal(c4.sulfur, 2200);
  assert.ok(!c4.crafted.some(r => r.shortname === 'techparts'));
  const satchel = option('door.wood', 'explosive.satchel');
  assert.equal(amount(satchel.rawResources, 'rope'), 2);
  assert.equal(amount(satchel.rawResources, 'cloth'), 20);
  assert.ok(!satchel.crafted.some(r => r.shortname === 'rope'));
});

test('SteamID64 validates bit fields via BigInt, not a numeric prefix', () => {
  for (const id of [steam(), steam(1n, 1n, 1n, 1n), steam(1n, 1n, 1n, 4294967295n)]) {
    assert.equal(steamIdFromInput(id), id);
    assert.equal(steamIdFromInput(` https://steamcommunity.com/profiles/${id}/ `), id);
    assert.equal(steamIdFromInput(`http://steamcommunity.com/profiles/${id}`), id);
  }
  for (const id of [steam(0n), steam(2n), steam(1n, 7n), steam(1n, 1n, 0n),
    steam(1n, 1n, 2n), steam(1n, 1n, 1n, 0n), '76561190000000000', '12345678901234567']) {
    assert.equal(steamIdFromInput(id), null);
  }
  assert.equal(steamIdFromInput(Number(steam())), null);
  assert.equal(steamIdFromInput(null), null);
  assert.equal(steamIdFromInput(undefined), null);
  assert.equal(steamIdFromInput({}), null);
});

test('Steam URL parsing rejects arbitrary URLs, query strings and credentials', () => {
  const id = steam();
  for (const value of [
    `https://evil.test/profiles/${id}`, `https://steamcommunity.com.evil.test/profiles/${id}`,
    `https://steamcommunity.com@evil.test/profiles/${id}`, `https://user@steamcommunity.com/profiles/${id}`,
    `https://steamcommunity.com:443/profiles/${id}`, `https://steamcommunity.com/profiles/${id}?x=1`,
    `https://steamcommunity.com/profiles/${id}#x`, `javascript:${id}`, `https://steamcommunity.com/id/name`,
    `https://evil.test/?steam=${id}`, `https://steamcommunity.com/profiles/${id}/extra`,
    `https://evil.test/${id}/${id}`, `steamcommunity.com/profiles/${id}`,
  ]) {
    assert.equal(steamIdFromInput(value), null);
    assert.deepEqual(extractSteamIds(value), []);
  }
});

test('Steam extractor deduplicates in first-seen order and ignores invalid tokens', () => {
  const first = steam();
  const second = steam(1n, 1n, 1n, 22n);
  assert.deepEqual(extractSteamIds(`${first}, https://steamcommunity.com/profiles/${second}/\n${first};bad;${steam(1n, 1n, 1n, 0n)}`), [first, second]);
  assert.deepEqual(extractSteamIds(''), []);
  assert.deepEqual(extractSteamIds(null), []);
});

test('calculations do not mutate the dataset or input rows', () => {
  const before = JSON.stringify([ITEMS, RAID_TARGETS, DATA_META.craftingItems]);
  const lines = [{ id: 'techparts', quantity: 1 }];
  calculateRecycle(lines, 'green');
  calculateRaid('wall.stone', 2);
  assert.deepEqual(lines, [{ id: 'techparts', quantity: 1 }]);
  assert.equal(JSON.stringify([ITEMS, RAID_TARGETS, DATA_META.craftingItems]), before);
});
