import { DATA_META, ITEMS, RECYCLERS, RAID_TARGETS, EXPLOSIVES } from './data.js';

const items = new Map(ITEMS.map(item => [item.id, item]));
const recyclers = new Map(RECYCLERS.map(tier => [tier.id, tier]));
const targets = new Map(RAID_TARGETS.map(target => [target.id, target]));
const craftingItems = DATA_META.craftingItems;

export function validQuantity(value) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 999;
}

function requireQuantity(value) {
  if (!validQuantity(value)) throw new RangeError('Количество должно быть целым числом от 1 до 999.');
}

function rows(totals) {
  return [...totals.entries()].map(([shortname, amount]) => ({
    shortname, name: craftingItems[shortname]?.name ?? shortname, amount,
  })).sort((a, b) => a.shortname.localeCompare(b.shortname, 'en'));
}

function craftingCost(shortname, quantity) {
  const order = [];
  const seen = new Set();
  const active = new Set();
  function visit(id) {
    if (active.has(id)) throw new Error(`Циклический рецепт: ${id}`);
    if (seen.has(id)) return;
    const item = craftingItems[id];
    if (!item) throw new Error(`Нет данных крафта: ${id}`);
    active.add(id);
    const recipe = item.crafting;
    if (recipe?.craftable) recipe.ingredients.forEach(i => visit(i.shortname));
    active.delete(id);
    seen.add(id);
    order.push(id);
  }
  visit(shortname);
  const needs = new Map([[shortname, quantity]]);
  const raw = new Map();
  const crafted = [];
  // Объединяем потребность до округления партий каждого промежуточного материала.
  for (const id of order.reverse()) {
    const requested = needs.get(id) ?? 0;
    const item = craftingItems[id];
    const recipe = item.crafting;
    if (!recipe?.craftable || !recipe.ingredients.length) {
      raw.set(id, requested);
      continue;
    }
    const batches = Math.ceil(requested / recipe.batch);
    const produced = batches * recipe.batch;
    crafted.push({ shortname: id, name: item.name, requested, batches, produced,
      surplus: produced - requested, batch: recipe.batch,
      ingredients: recipe.ingredients.map(i => ({ ...i, amount: i.amount * batches })),
    });
    for (const ingredient of recipe.ingredients) {
      needs.set(ingredient.shortname, (needs.get(ingredient.shortname) ?? 0) + ingredient.amount * batches);
    }
  }
  const rawResources = rows(raw);
  const top = crafted.find(row => row.shortname === shortname);
  return {
    rawResources,
    components: top?.ingredients ?? [],
    crafted,
    gunpowder: crafted.find(row => row.shortname === 'gunpowder') ?? null,
    sulfur: raw.get('sulfur') ?? 0,
    craftedUnits: top?.produced ?? quantity,
    surplus: top?.surplus ?? 0,
  };
}

export function calculateRaid(targetId, quantity, { all = true } = {}) {
  requireQuantity(quantity);
  const target = targets.get(targetId);
  if (!target) throw new RangeError('Неизвестная цель рейда.');
  const options = EXPLOSIVES.flatMap(explosive => {
    const damage = target.damage[explosive.id];
    if (!Number.isFinite(damage) || damage <= 0) return [];
    const unitsPerTarget = Math.ceil(target.hp / damage);
    const units = unitsPerTarget * quantity;
    return [{ id: explosive.id, shortname: explosive.shortname, name: explosive.name,
      damage, unitsPerTarget, units, ...craftingCost(explosive.shortname, units),
      source: target.source,
    }];
  }).sort((a, b) => a.sulfur - b.sulfur || a.units - b.units || a.id.localeCompare(b.id, 'en'));
  const minSulfur = options.length ? options[0].sulfur : null;
  return {
    target, quantity, totalHp: target.hp * quantity,
    options: all ? options : options.filter(option => option.sulfur === minSulfur),
    minSulfur, conditions: DATA_META.conditions.raid,
    model: DATA_META.raidModel, warning: DATA_META.raidWarning,
    craftingAssumptions: DATA_META.conditions.crafting,
  };
}

export function calculateRecycle(lines, tierId) {
  if (!Array.isArray(lines)) throw new TypeError('Ожидается массив предметов.');
  const tier = recyclers.get(tierId);
  if (!tier) throw new RangeError('Неизвестный переработчик.');
  const totals = new Map();
  let totalQuantity = 0;
  const inputs = lines.map(line => {
    if (!line || typeof line !== 'object') throw new TypeError('Некорректная строка предмета.');
    requireQuantity(line.quantity);
    const item = items.get(line.id);
    if (!item) throw new RangeError('Предмет отсутствует в каталоге переработки.');
    totalQuantity += line.quantity;
    for (const output of item.output) {
      const previous = totals.get(output.shortname) ?? { shortname: output.shortname, name: output.name, amount: 0, expected: true };
      previous.amount += output.amount * tier.efficiency * line.quantity;
      totals.set(output.shortname, previous);
    }
    return { id: item.id, name: item.name, quantity: line.quantity };
  });
  return { tier, inputs, totalQuantity,
    outputs: [...totals.values()].sort((a, b) => a.shortname.localeCompare(b.shortname, 'en')),
    expected: true, timeSeconds: totalQuantity * tier.seconds,
    timeModel: 'Sequential item estimate; not measured inventory-stack cycles.',
    conditions: DATA_META.conditions.recycle,
  };
}

function individualSteamId(value) {
  if (!/^\d{17}$/.test(value)) return null;
  const id = BigInt(value);
  const universe = (id >> 56n) & 255n;
  const type = (id >> 52n) & 15n;
  const instance = (id >> 32n) & 1048575n;
  const accountId = id & 4294967295n;
  return universe === 1n && type === 1n && instance === 1n && accountId > 0n ? value : null;
}

export function steamIdFromInput(input) {
  if (typeof input !== 'string') return null;
  const value = input.trim();
  const direct = individualSteamId(value);
  if (direct) return direct;
  // Строгая форма не позволяет извлечь ID из чужого URL, query или credentials.
  const match = /^https?:\/\/steamcommunity\.com\/profiles\/(\d{17})\/?$/i.exec(value);
  return match ? individualSteamId(match[1]) : null;
}

export function extractSteamIds(text) {
  if (typeof text !== 'string') return [];
  const result = [];
  const seen = new Set();
  const add = value => {
    const id = steamIdFromInput(value);
    if (id && !seen.has(id)) {
      seen.add(id);
      result.push(id);
    }
  };
  for (const token of text.split(/[\s,;]+/)) add(token);
  // OCR can attach punctuation, split digits with spaces, or add one digit
  // at the edge of an otherwise correct run. Validate every 17-digit window;
  // the SteamID bit-field check remains mandatory and rejects arbitrary runs.
  const nonUrlText = text.replace(/\S*[:/]\S*/g, ' ');
  for (const run of nonUrlText.match(/[0-9][0-9\s.,:;|()[\]{}\-]{15,}[0-9]/g) ?? []) {
    const digits = run.replace(/\D/g, '');
    for (let start = 0; start + 17 <= digits.length; start++) add(digits.slice(start, start + 17));
  }
  return result;
}
