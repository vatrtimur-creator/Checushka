/* Тема применяется до отрисовки; ошибки хранилища покажет основной модуль. */
try {
  const settings = JSON.parse(localStorage.getItem('rust-util:settings:v1') || '{}');
  document.documentElement.dataset.theme = settings.theme === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.font = ['small', 'medium', 'large'].includes(settings.font) ? settings.font : 'medium';
} catch { /* Браузер может запретить localStorage. */ }
