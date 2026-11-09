/* Run from Reality — онлайн для GitHub + Vercel
   Максимум 2 игрока. Комнат нет.
*/

const SUPABASE_URL = 'https://nrsuzmsqdfberlrgupvy.supabase.co';
const SUPABASE_KEY = 'sb_publishable_9uGquDRNU7uBfOEAuQdCOw_0-DysL65';
const RFR_CHANNEL = 'rfr-global-online-v1';

(async function () {
  'use strict';

  // Автоматически подключаем библиотеку Supabase
  if (!window.supabase) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  const css = document.createElement('style');
  css.textContent = `
    #rfr-online-panel{position:fixed;inset:0;z-index:10000;display:none;align-items:center;justify-content:center;background:#171717aa;padding:20px;font-family:Arial,sans-serif}
    #rfr-online-card{width:min(430px,100%);background:#fffdf6;color:#171717;border-radius:24px;padding:25px;box-shadow:0 20px 80px #0008}
    #rfr-online-card h2{margin:0 0 8px;font-size:30px}
    #rfr-online-card p{color:#706d62;margin:8px 0 14px}
    #rfr-online-name{width:100%;padding:14px;border:1px solid #eadfbd;border-radius:12px;font-size:16px;outline:none}
    #rfr-online-name:focus{border-color:#ffd43b;box-shadow:0 0 0 3px #ffd43b55}
    .rfr-ob{border:0;border-radius:12px;padding:13px 16px;margin:12px 5px 5px 0;background:#ffd43b;color:#171717;font-weight:800;cursor:pointer}
    .rfr-ob.dark{background:#171717;color:#fff}
    .rfr-ob:disabled{opacity:.55;cursor:not-allowed}
    #rfr-online-status{margin-top:14px;padding:12px;border-radius:12px;background:#fff4bd;font-size:14px}
    #rfr-online-list{margin:12px 0 0;padding-left:22px;min-height:20px}
    #rfr-online-badge{position:fixed;right:16px;top:16px;z-index:9999;display:none;background:#ffd43b;color:#171717;border-radius:99px;padding:8px 13px;font:bold 13px Arial;box-shadow:0 3px 15px #0002}
  `;
  document.head.appendChild(css);

  document.body.insertAdjacentHTML('beforeend', `
    <div id="rfr-online-badge">🟡 Онлайн: <b id="rfr-online-count">0/2</b></div>
    <div id="rfr-online-panel">
      <div id="rfr-online-card">
        <h2>Войти онлайн</h2>
        <p>В одной игре могут находиться только два человека.</p>
        <input id="rfr-online-name" maxlength="18" autocomplete="nickname" placeholder="Введи свой никнейм">
        <div>
          <button class="rfr-ob dark" id="rfr-online-connect">Войти в игру</button>
          <button class="rfr-ob" id="rfr-online-close">Отмена</button>
        </div>
        <div id="rfr-online-status">Введи никнейм и нажми «Войти в игру».</div>
        <ul id="rfr-online-list"></ul>
      </div>
    </div>
  `);

  const $ = id => document.getElementById(id);
  const panel = $('rfr-online-panel');
  const status = $('rfr-online-status');
  const list = $('rfr-online-list');
  const badge = $('rfr-online-badge');
  const count = $('rfr-online-count');
  const input = $('rfr-online-name');
  const connectButton = $('rfr-online-connect');

  let client;
  let channel;
  let nickname = '';
  let connected = false;
  let startedGame = false;
  const playerId = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

  function setStatus(text) { status.textContent = text; }

  function esc(value) {
    return String(value).replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
    })[c]);
  }

  function playersFromState(state) {
    return Object.values(state || {}).flat().filter(Boolean);
  }

  function drawPlayers(state) {
    const players = playersFromState(state);
    count.textContent = `${Math.min(players.length, 2)}/2`;
    list.innerHTML = players.slice(0, 2).map(p =>
      `<li>${esc(p.nickname)}${p.id === playerId ? ' — это ты' : ''}</li>`
    ).join('');

    window.dispatchEvent(new CustomEvent('rfr-online-players', { detail: players }));
  }

  function openPanel() {
    panel.style.display = 'flex';
    setTimeout(() => input.focus(), 50);
  }

  function closePanel() { panel.style.display = 'none'; }

  function launchOriginalGame() {
    // Запускает уже существующую красивую заставку и игру сайта
    if (typeof window.enter === 'function') {
      window.enter({
        preventDefault() {},
        clientX: innerWidth / 2,
        clientY: innerHeight / 2
      });
    } else {
      closePanel();
    }
  }

  async function connect() {
    nickname = input.value.trim().replace(/\s+/g, ' ');
    if (!nickname) return setStatus('Сначала введи никнейм.');
    if (nickname.length < 2) return setStatus('Никнейм должен быть не короче 2 символов.');

    connectButton.disabled = true;
    setStatus('Подключаемся к онлайн-игре…');

    try {
      client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      channel = client.channel(RFR_CHANNEL, {
        config: { presence: { key: playerId } }
      });

      channel.on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const players = playersFromState(state);
        drawPlayers(state);

        if (players.length > 2) {
          setStatus('Игра уже заполнена: сейчас играют два человека.');
          channel.untrack();
          connected = false;
          connectButton.disabled = false;
          return;
        }

        setStatus(players.length === 2
          ? 'Вы играете вдвоём! Запускаем игру…'
          : 'Ты онлайн. Ждём второго игрока…');

        // Запускаем игру сразу после успешного подключения первого игрока
        if (!startedGame) {
          startedGame = true;
          setTimeout(() => {
            closePanel();
            launchOriginalGame();
          }, 650);
        }
      });

      channel.on('broadcast', { event: 'game-event' }, ({ payload }) => {
        window.dispatchEvent(new CustomEvent('rfr-online-event', { detail: payload }));
      });

      const result = await channel.subscribe(async state => {
        if (state !== 'SUBSCRIBED') {
          setStatus('Не удалось подключиться. Проверь интернет и HTTPS.');
          connectButton.disabled = false;
          return;
        }

        await channel.track({
          id: playerId,
          nickname,
          joinedAt: Date.now()
        });

        connected = true;
        badge.style.display = 'block';
      });
    } catch (error) {
      console.error(error);
      setStatus('Ошибка подключения к Supabase. Открой консоль браузера для подробностей.');
      connectButton.disabled = false;
    }
  }

  window.RFROnline = {
    open: openPanel,
    close: closePanel,
    get nickname() { return nickname; },
    get playerId() { return playerId; },
    get connected() { return connected; },
    async send(event, data) {
      if (!channel || !connected) return;
      await channel.send({
        type: 'broadcast',
        event: 'game-event',
        payload: { event, data, from: playerId, nickname }
      });
    }
  };

  $('rfr-online-connect').onclick = connect;
  $('rfr-online-close').onclick = closePanel;
  input.addEventListener('keydown', e => { if (e.key === 'Enter') connect(); });

  // Перехватываем кнопку «Войти в игру» до старого обработчика сайта
  document.addEventListener('click', e => {
    const button = e.target.closest('.enter');
    if (!button) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    openPanel();
  }, true);
})();