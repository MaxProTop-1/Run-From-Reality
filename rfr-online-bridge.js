/* Вставь этот код внутрь каждой игры WORLD/GM,
   перед закрывающим тегом </script>.
   Он синхронизирует состояние через родительский iframe.
*/
(function(){
  const GAME_ID = document.title.includes('race') ? 'race' : document.title.includes('fps') ? 'fps' : 'mest';
  const remote = new Map();
  const send = (state) => parent.postMessage({type:'rfr-state',game:GAME_ID,state},'*');
  const action = (data) => parent.postMessage({type:'rfr-action',game:GAME_ID,action:data},'*');

  addEventListener('message', e => {
    const m=e.data;
    if(m?.type==='rfr-remote-state' && m.payload?.game===GAME_ID && m.payload.id!==window.RFR_LOCAL_ID){
      remote.set(m.payload.id,m.payload);
      if(typeof window.RFR_APPLY_REMOTE==='function')window.RFR_APPLY_REMOTE(m.payload);
    }
    if(m?.type==='rfr-remote-action' && m.payload?.game===GAME_ID && m.payload.id!==window.RFR_LOCAL_ID){
      if(typeof window.RFR_APPLY_ACTION==='function')window.RFR_APPLY_ACTION(m.payload.action,m.payload);
    }
  });

  // ID игрока передаётся родительской страницей
  parent.postMessage({type:'rfr-request-id'},'*');
  addEventListener('message',e=>{if(e.data?.type==='rfr-player-id')window.RFR_LOCAL_ID=e.data.id});

  window.RFR_ONLINE_SEND=send;
  window.RFR_ONLINE_ACTION=action;
  window.RFR_REMOTE_PLAYERS=remote;
})();