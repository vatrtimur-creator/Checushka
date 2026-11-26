import { RAID_TARGETS, DATA_META } from './data.js';
import { calculateRaid, validQuantity } from './engine.js';
import { init, t, el, fmt, setError, settings } from './common.js';
const $ = id => document.getElementById(id);
const labels = {
  'explosive.timed':['C4 / Взрывчатка с таймером','C4 / Timed explosive charge'],
  'ammo.rocket.basic':['Ракета','Rocket'],
  'ammo.rocket.hv':['Скоростная ракета / HV','High velocity rocket'],
  'explosive.satchel':['Сатчел','Satchel charge'],
  'grenade.beancan':['Бобовая граната','Beancan grenade'],
  'ammo.rifle.explosive':['Разрывные патроны 5.56','Explosive 5.56 rifle ammo']
};
function name(option) { return labels[option.id]?.[settings.language === 'en' ? 1 : 0] || option.name; }
function categories() {
  const previous = $('target-type').value;
  const values = [...new Set(RAID_TARGETS.map(target => target.category))];
  $('target-type').replaceChildren(...values.map(value => el('option',{value,text:t(value)})));
  $('target-type').value = values.includes(previous) ? previous : values[0];
  materials();
}
function materials() {
  const previous = $('target-material').value;
  const targets = RAID_TARGETS.filter(target => target.category === $('target-type').value);
  $('target-material').replaceChildren(...targets.map(target => el('option',{value:target.id,text:t(target.grade || (target.id === 'garage' ? 'garage' : target.id.split('.').at(-1)))})));
  $('target-material').value = targets.some(target => target.id === previous) ? previous : targets.find(target => target.grade === 'stone')?.id || targets[0].id;
  render();
}
function detailList(label, rows) {
  const list = el('dl',{class:'component-list'});
  for (const row of rows) list.append(el('dt',{text:row.name}),el('dd',{text:fmt(row.amount)}));
  return el('details',{},[el('summary',{text:label}),list]);
}
function render() {
  const quantity = Number($('target-qty').value);
  if (!validQuantity(quantity)) { setError('raid-error',t('invalidQuantity')); $('raid-results').replaceChildren(); $('target-hp').textContent = '—'; return; }
  setError('raid-error','');
  const calculation = calculateRaid($('target-material').value,quantity,{all:true});
  $('target-hp').textContent = fmt(calculation.totalHp,0);
  $('per-target-hp').textContent = t('perTarget',{hp:fmt(calculation.target.hp,0),qty:fmt(quantity,0)});
  const list = $('raid-results'); list.replaceChildren();
  $('raid-results-title').textContent = settings.language === 'ru' ? 'Модель прямого урона' : 'Direct-impact model';
  const warning = settings.language === 'ru' ? calculation.warning : 'Snapshot model, not verified in-game raid requirements. Stone wall: this model gives 13 satchels vs. 10 in the wiki, and 200 explosive rounds vs. 185 with SAR in the wiki. Weapon-specific damage and game behavior differ. Do not use these values as an exact shopping list.';
  list.append(el('div',{class:'notice'},[
    el('p',{text:warning}),
    el('a',{href:DATA_META.raidComparisonSource,target:'_blank',rel:'noopener noreferrer',text:settings.language === 'ru' ? 'Сравнение с Rust Wiki ↗' : 'Rust Wiki comparison ↗'})
  ]));
  const options = $('show-all').checked ? calculation.options : calculation.options.filter(option => ['explosive.timed','ammo.rocket.basic','explosive.satchel'].includes(option.id));
  for (const option of options) {
    const best = option.sulfur === calculation.minSulfur;
    const card = el('article',{class:`raid-card${best ? ' best' : ''}`});
    const heading = el('div',{class:'raid-head'},[el('h3',{text:name(option)}),el('span',{class:'raid-count',text:fmt(option.units,0)})]);
    card.append(heading);
    const summary = el('div',{class:'toolbar',style:'margin-top:10px'},[el('small',{class:'mono',text:t('perTargetCount',{n:fmt(option.unitsPerTarget,0)})})]);
    if (best) summary.append(el('span',{class:'badge accent',text:t('bestSulfur')}));
    card.append(summary);
    const metrics = el('div',{class:'raid-metrics'});
    for (const [label,value] of [['sulfur',option.sulfur],['gunpowder',option.gunpowder?.requested || 0],['damageEach',option.damage]]) metrics.append(el('div',{},[el('span',{text:t(label)}),el('strong',{text:fmt(value)})]));
    card.append(metrics);
    card.append(detailList(t('components'),option.components));
    card.append(detailList(settings.language === 'ru' ? 'Сырьё с учётом партий крафта' : 'Raw materials, whole crafting batches',option.rawResources));
    if (option.surplus) card.append(el('p',{class:'hint',text:settings.language === 'ru' ? `Крафт: ${fmt(option.craftedUnits,0)} шт.; остаток ${fmt(option.surplus,0)} шт.` : `Craft: ${fmt(option.craftedUnits,0)} units; surplus ${fmt(option.surplus,0)} units.`}));
    card.append(el('a',{class:'hint',href:option.source,target:'_blank',rel:'noopener noreferrer',text:settings.language === 'ru' ? 'Данные расчёта ↗' : 'Calculation data ↗'}));
    list.append(card);
  }
}
init(); categories();
$('target-type').addEventListener('change',materials);
for (const id of ['target-material','show-all']) $(id).addEventListener('change',render);
$('target-qty').addEventListener('input',render);
document.addEventListener('settingschange',categories);
