import { ITEMS, RECYCLERS } from './data.js';
import { calculateRecycle, validQuantity } from './engine.js';
import { init, t, el, fmt, copy, setError, settings } from './common.js';
const $ = id => document.getElementById(id);
const catalog = ITEMS.filter(item => !item.hidden).sort((a,b) => a.name.localeCompare(b.name,'en'));
let basket = [];
let calculation;
function search() {
  const previous = $('item-select').value;
  const query = $('item-search').value.trim().toLowerCase();
  const matching = catalog.filter(item => `${item.name} ${item.shortname} ${item.name === 'Assault Rifle' ? 'ak ak-47 калаш автомат' : ''}`.toLowerCase().includes(query));
  $('item-select').replaceChildren(...matching.map(item => el('option',{value:item.id,text:`${item.name} / ${item.category}`})));
  if (matching.some(item => item.id === previous)) $('item-select').value = previous;
  else if (!query && matching.some(item => item.id === 'rifle.ak')) $('item-select').value = 'rifle.ak';
  if (!matching.length) $('item-select').append(el('option',{value:'',text:t('noItems')}));
  $('basket-add').disabled = !matching.length;
  $('catalog-count').textContent = t('catalogCount',{n:catalog.length});
}
function tiers() {
  const previous = $('recycler-tier').value;
  const names = {green:['Зелёный','Green'],yellow:['Жёлтый','Yellow'],red:['Красный','Red']};
  $('recycler-tier').replaceChildren(...RECYCLERS.map(tier => el('option',{value:tier.id,text:`${names[tier.id]?.[settings.language === 'en' ? 1 : 0] || tier.name} / ${fmt(tier.efficiency*100,0)}%`})));
  $('recycler-tier').value = RECYCLERS.some(tier => tier.id === previous) ? previous : 'green';
}
function render() {
  const tier = RECYCLERS.find(item => item.id === $('recycler-tier').value);
  $('tier-info').textContent = `${t('efficiency',{n:fmt(tier.efficiency*100,0),s:fmt(tier.seconds)})}. ${t('cycleTime')}`;
  if (tier.powergrid.requiredStage) $('tier-info').textContent += settings.language === 'ru' ? ` Требуется powergrid stage ${tier.powergrid.requiredStage}.` : ` Requires powergrid stage ${tier.powergrid.requiredStage}.`;
  const list = $('basket'); list.replaceChildren();
  if (!basket.length) list.append(el('p',{class:'hint',text:t('emptyBasket')}));
  for (const line of basket) {
    const item = catalog.find(entry => entry.id === line.id);
    const quantity = el('input',{type:'number',value:line.quantity,min:1,max:999,step:1,'aria-label':`${t('quantity')} ${item.name}`});
    quantity.addEventListener('change',() => {
      const value = Number(quantity.value);
      if (!validQuantity(value)) { setError('recycler-error',t('invalidQuantity')); quantity.value = line.quantity; return; }
      line.quantity = value; setError('recycler-error',''); render();
    });
    const remove = el('button',{type:'button',text:'×','aria-label':`${t('remove')} ${item.name}`});
    remove.addEventListener('click',() => { basket = basket.filter(row => row.id !== line.id); render(); });
    list.append(el('div',{class:'basket-row'},[el('span',{text:item.name}),quantity,remove]));
  }
  calculation = calculateRecycle(basket,tier.id);
  const results = $('recycle-results'); results.replaceChildren();
  for (const resource of calculation.outputs) results.append(el('tr',{},[el('td',{text:resource.name}),el('td',{text:fmt(resource.amount,3)})]));
  if (!calculation.outputs.length) results.append(el('tr',{},[el('td',{colspan:2,class:'muted',text:'—'})]));
  $('recycle-time').textContent = `${fmt(calculation.timeSeconds,1)} ${t('seconds')}`;
  $('copy-recycle').disabled = basket.length === 0;
}
init(); tiers(); search(); render();
$('item-search').addEventListener('input',search);
$('recycler-tier').addEventListener('change',render);
$('recycle-form').addEventListener('submit',event => {
  event.preventDefault();
  const quantity = Number($('item-qty').value);
  if (!validQuantity(quantity)) { setError('recycler-error',t('invalidQuantity')); return; }
  const id = $('item-select').value; if (!catalog.some(item => item.id === id)) return;
  const existing = basket.find(line => line.id === id);
  if (existing && existing.quantity + quantity > 999) { setError('recycler-error',t('invalidQuantity')); return; }
  if (existing) existing.quantity += quantity; else basket.push({id,quantity});
  setError('recycler-error',''); render();
});
$('copy-recycle').addEventListener('click',() => {
  const inputText = calculation.inputs.map(line => `${line.name}: ${line.quantity}`).join('\n');
  const outputText = calculation.outputs.map(row => `${row.name}: ${fmt(row.amount,3)}`).join('\n');
  copy(`RUST / UTIL\n${t('inventory')}\n${inputText}\n\n${t('expected')} / ${calculation.tier.name} ${calculation.tier.efficiency*100}%\n${outputText}\n${t('estimatedTime')}: ${fmt(calculation.timeSeconds)} ${t('seconds')}\n${t('recycleCaveat')}`);
});
document.addEventListener('settingschange',() => { tiers(); search(); render(); });
