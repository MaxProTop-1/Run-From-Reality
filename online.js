/* RFR ONLINE — максимум 2 игрока, без комнат
   Перед использованием вставь SUPABASE_URL и SUPABASE_KEY.
*/

const SUPABASE_URL = 'ВСТАВЬ_SUPABASE_URL';
const SUPABASE_KEY = 'ВСТАВЬ_SUPABASE_ANON_KEY';
const RFR_CHANNEL = 'run-from-reality-online';

(function () {
  const style = document.createElement('style');
  style.textContent = `
    #rfr-online-panel{position:fixed;z-index:300;inset:0;display:none;align-items:center;justify-content:center;background:#171717aa;padding:20px;font-family:Arial,sans-serif}
    #rfr-online-card{width:min(420px,100%);background:#fffdf6;color:#171717;border-radius:22px;padding:25px;box-shadow:0 20px 70px #0008}
    #rfr-online-card h2{margin:0 0 8px;font-size:30px}
    #rfr-online-card p{color:#706d62}
    #rfr-online-name{width:100%;padding:13px;border:1px solid #eadfbd;border-radius:11px;font-size:16px;margin:10px 0}
    .rfr-online-btn{border:0;border-radius:11px;padding:12px 16px;background:#ffd43b;color:#171717;font-weight:800;cursor:pointer;margin:5px 4px 5px 0}
    .rfr-online-dark{background:#171717;color:white}
    #rfr-online-status{margin-top:14px;padding:12px;border-radius:12px;background:#fff4bd;font-size:14px}
    #rfr-online-list{margin:10px 0;padding-left:20px}
    #rfr-online-badge{position:fixed;z-index:250;right:16px;top:16px;background:#ffd43b;color:#171717;border-radius:99px;padding:8px 13px;font:bold 13px Arial;display:none}
  `;
  document.head.appendChild(style);

  document.body.insertAdjacentHTML('beforeend', `
    <div id="rfr-online-badge">🟡 Онлайн: <b id="rfr-online-count">0/2</b></div>
    <div id="rfr-online-panel">
      <div id="rfr-online-card">
        <h2>Онлайн-игра</h2>
        <p>В игре могут находиться одновременно только два человека.</p>
        <input id="rfr-online-name" maxlength="18" placeholder="Введи свой никнейм">
        <div>
          <button class="rfr-online-btn rfr-online-dark" id="rfr-online-connect">Войти онлайн</button>
          <button class="rfr-online-btn" id="rfr-online-close">Закрыть</button>
        </div>
        <div id="rfr-online-status">Не подключено</div>
        <ul id="rfr-online-list"></ul>
      </div>
    </div>
  `);

  const panel = document.getElementById('rfr-online-panel');
  const badge = document.getElementById('rfr-online-badge');
  const count = document.getElementById('rfr-online-count');
  const status = document.getElementById('rfr-online-status');
  const list = document.getElementById('rfr-online-list');
  const nameInput = document.getElementById('rfr-online-name');
  let client = null;
  let channel = null;
  let nickname = '';
  let playerId = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
  let connected = false;

  function setStatus(text) { status.textContent = text; }

  function renderPlayers(state) {
    const players = Object.values(state || {});
    count.textContent = `${players.length}/2`;
    list.innerHTML = players.map(p => `<li>${escapeHtml(p.nickname)}${p.id === playerId ? ' — это ты' : ''}</li>`).join('');
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  }

  async function connect() {
    nickname = nameInput.value.trim();
    if (!nickname) return setStatus('Сначала введи никнейм.');
    if (SUPABASE_URL.includes('ВСТАВЬ') || SUPABASE_KEY.includes('ВСТАВЬ')) {
      return setStatus('Нужно указать SUPABASE_URL и SUPABASE_ANON_KEY в файле online.js.');
    }

    if (!client) {
      const { createClient } = supabase;
      client = createClient(SUPABASE_URL, SUPABASE_KEY);
    }

    channel = client.channel(RFR_CHANNEL, {
      config: { presence: { key: playerId } }
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        renderPlayers(state);
        const players = Object.values(state).flat();
        if (players.length > 2) {
          setStatus('Место занято: сейчас уже играют два человека.');
          channel.untrack();
          return;
        }
        setStatus(players.length === 2 ? 'Онлайн: вы играете вдвоём!' : 'Ты онлайн. Ждём второго игрока…');
        window.postMessage({ type: 'rfr-online-players', players }, '*');
      })
      .on('broadcast', { event: 'game-event' }, ({ payload }) => {
        window.postMessage({ type: 'rfr-online-event', payload }, '*');
      });

    const result = await channel.subscribe(async (state) => {
      if (state !== 'SUBSCRIBED') {
        setStatus('Не удалось подключиться к онлайн-режиму.');
        return;
      }
      await channel.track({ id: playerId, nickname, joinedAt: Date.now() });
      connected = true;
      badge.style.display = 'block';
      panel.style.display = 'none';
    });
  }

  window.RFROnline = {
    open() { panel.style.display = 'flex'; nameInput.focus(); },
    close() { panel.style.display = 'none'; },
    async send(event, data) {
      if (!channel || !connected) return;
      await channel.send({ type: 'broadcast', event: 'game-event', payload: { event, data, from: playerId, nickname } });
    },
    get nickname() { return nickname; }
  };

  document.getElementById('rfr-online-connect').onclick = connect;
  document.getElementById('rfr-online-close').onclick = () => panel.style.display = 'none';

  document.querySelectorAll('.enter').forEach(button => {
    button.addEventListener('click', () => setTimeout(() => window.RFROnline.open(), 900));
  });
})();