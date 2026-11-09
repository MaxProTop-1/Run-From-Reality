/* RFR ONLINE — до 10 игроков, Supabase Realtime
   Подключить перед закрывающим </body> основного index.html.
*/

const RFR_SUPABASE_URL = 'https://nrsuzmsqdfberlrgupvy.supabase.co';
const RFR_SUPABASE_KEY = 'sb_publishable_9uGquDRNU7uBfOEAuQdCOw_0-DysL65';
const RFR_MAX_PLAYERS = 10;
const RFR_CHANNEL_NAME = 'rfr-global-online-v10';

(async function () {
  'use strict';

  if (!window.supabase) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  const playerId = crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;
  let supabaseClient;
  let channel;
  let nickname = '';
  let connected = false;

  const style = document.createElement('style');
  style.textContent = `
    #rfr-online-counter{position:fixed;right:16px;top:16px;z-index:9999;display:none;background:#ffd43b;color:#171717;padding:9px 14px;border-radius:99px;font:700 14px Arial;box-shadow:0 4px 18px #0003}
    #rfr-online-modal{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:#171717aa;z-index:10000;padding:20px;font-family:Arial,sans-serif}
    #rfr-online-box{width:min(430px,100%);background:#fffdf6;color:#171717;border-radius:24px;padding:25px;box-shadow:0 20px 80px #0008}
    #rfr-online-box h2{margin:0 0 8px;font-size:30px}
    #rfr-online-box p{color:#706d62}
    #rfr-online-name{width:100%;padding:14px;border:1px solid #eadfbd;border-radius:12px;font-size:16px;outline:none}
    .rfr-online-btn{border:0;border-radius:12px;padding:13px 16px;margin:12px 5px 5px 0;background:#ffd43b;color:#171717;font-weight:800;cursor:pointer}
    .rfr-online-btn.dark{background:#171717;color:white}
    .rfr-online-btn:disabled{opacity:.5;cursor:not-allowed}
    #rfr-online-status{background:#fff4bd;border-radius:12px;padding:12px;margin-top:14px;font-size:14px}
    #rfr-online-players{padding-left:22px;min-height:20px}
  `;
  document.head.appendChild(style);

  document.body.insertAdjacentHTML('beforeend', `
    <div id="rfr-online-counter">🟡 Онлайн: <b>0/${RFR_MAX_PLAYERS}</b></div>
    <div id="rfr-online-modal">
      <div id="rfr-online-box">
        <h2>Войти в игру</h2>
        <p>Одновременно могут играть максимум ${RFR_MAX_PLAYERS} человек.</p>
        <input id="rfr-online-name" maxlength="18" autocomplete="nickname" placeholder="Введи никнейм">
        <div>
          <button class="rfr-online-btn dark" id="rfr-online-enter">Войти онлайн</button>
          <button class="rfr-online-btn" id="rfr-online-cancel">Отмена</button>
        </div>
        <div id="rfr-online-status">Введи никнейм.</div>
        <ul id="rfr-online-players"></ul>
      </div>
    </div>
  `);

  const $ = id => document.getElementById(id);
  const modal = $('rfr-online-modal');
  const nameInput = $('rfr-online-name');
  const enterButton = $('rfr-online-enter');
  const status = $('rfr-online-status');
  const playerList = $('rfr-online-players');
  const counter = document.querySelector('#rfr-online-counter b');
  const counterBox = $('rfr-online-counter');

  const setStatus = text => status.textContent = text;
  const escapeHtml = text => String(text).replace(/[&<>"']/g, c => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;'
  })[c]);

  function playersFromState(state) {
    return Object.values(state || {}).flat().filter(Boolean);
  }

  function renderPlayers(state) {
    const players = playersFromState(state).slice(0, RFR_MAX_PLAYERS);
    counter.textContent = `${players.length}/${RFR_MAX_PLAYERS}`;
    playerList.innerHTML = players.map(p =>
      `<li>${escapeHtml(p.nickname)}${p.id === playerId ? ' — это ты' : ''}</li>`
    ).join('');
    window.dispatchEvent(new CustomEvent('rfr-online-players', { detail: players }));
  }

  function openLogin() {
    modal.style.display = 'flex';
    setTimeout(() => nameInput.focus(), 50);
  }

  function closeLogin() { modal.style.display = 'none'; }

  async function connect() {
    nickname = nameInput.value.trim().replace(/\s+/g, ' ');
    if (nickname.length < 2) return setStatus('Никнейм должен содержать минимум 2 символа.');

    enterButton.disabled = true;
    setStatus('Подключение к онлайн-игре…');

    try {
      supabaseClient = window.supabase.createClient(RFR_SUPABASE_URL, RFR_SUPABASE_KEY);
      channel = supabaseClient.channel(RFR_CHANNEL_NAME, {
        config: { presence: { key: playerId } }
      });

      channel.on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const players = playersFromState(state);
        renderPlayers(state);
        counterBox.style.display = 'block';

        if (players.length > RFR_MAX_PLAYERS) {
          channel.untrack();
          connected = false;
          setStatus(`Игра заполнена: максимум ${RFR_MAX_PLAYERS} игроков.`);
          enterButton.disabled = false;
          return;
        }

        connected = true;
        setStatus(players.length === RFR_MAX_PLAYERS
          ? 'Игра заполнена — 10 игроков онлайн.'
          : `Ты онлайн. Игроков: ${players.length}/${RFR_MAX_PLAYERS}.`);

        if (!window.__rfrGameOpened && typeof window.enter === 'function') {
          window.__rfrGameOpened = true;
          setTimeout(() => {
            closeLogin();
            window.enter({ preventDefault(){}, clientX: innerWidth / 2, clientY: innerHeight / 2 });
          }, 500);
        }
      });

      channel.on('broadcast', { event: 'rfr-state' }, ({ payload }) => {
        window.dispatchEvent(new CustomEvent('rfr-online-state', { detail: payload }));
      });

      channel.on('broadcast', { event: 'rfr-action' }, ({ payload }) => {
        window.dispatchEvent(new CustomEvent('rfr-online-action', { detail: payload }));
      });

      const subscribeState = await channel.subscribe();
      if (subscribeState !== 'SUBSCRIBED') throw new Error('Supabase subscription failed');

      await channel.track({ id: playerId, nickname, joinedAt: Date.now() });
    } catch (error) {
      console.error('[RFR ONLINE]', error);
      setStatus('Ошибка подключения. Проверь HTTPS и настройки Supabase.');
      enterButton.disabled = false;
    }
  }

  window.RFROnline = {
    open: openLogin,
    close: closeLogin,
    get id() { return playerId; },
    get nickname() { return nickname; },
    get connected() { return connected; },
    async sendState(game, state) {
      if (!channel || !connected) return;
      await channel.send({
        type: 'broadcast',
        event: 'rfr-state',
        payload: { from: playerId, nickname, game, state, time: Date.now() }
      });
    },
    async sendAction(game, action) {
      if (!channel || !connected) return;
      await channel.send({
        type: 'broadcast',
        event: 'rfr-action',
        payload: { from: playerId, nickname, game, action, time: Date.now() }
      });
    }
  };

  enterButton.onclick = connect;
  nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') connect(); });
  $('rfr-online-cancel').onclick = closeLogin;

  document.addEventListener('click', e => {
    const button = e.target.closest('.enter');
    if (!button) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    openLogin();
  }, true);

  window.addEventListener('beforeunload', () => {
    try { channel?.untrack(); } catch (_) {}
  });
})();