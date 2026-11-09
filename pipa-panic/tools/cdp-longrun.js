function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function main() {
  const tabs = await fetch('http://127.0.0.1:9223/json').then(r => r.json());
  const tab = tabs.find(t => t.url.includes('8765'));
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  let seq = 0; const pending = new Map();
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id); pending.delete(m.id);
      m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
    }
  };
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  const send = (method, params) => new Promise((resolve, reject) => {
    const id = ++seq; pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params: params || {} }));
  });
  const ev = async expr => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
    return r.result.value;
  };
  await send('Runtime.enable');
  await send('Page.bringToFront');
  await send('Emulation.setFocusEmulationEnabled', { enabled: true });
  await send('Page.navigate', { url: 'http://127.0.0.1:8765/?demo=1' });
  await sleep(800);
  const out = await ev(`(function(){
    __PIPA__.startRun();
    __PIPA__.game.debugAutoAim=true;
    __PIPA__.game.pointer.down=true;
    __PIPA__.game.pointer.firing=true;
    var shops=0, kos=0, maxWave=1, error=null;
    try {
      for(var i=0;i<6500;i++){
        __PIPA__.tick(1/60);
        if(__PIPA__.game.scene==='shop'){
          shops++;
          __PIPA__.closeShop();
          __PIPA__.game.pointer.down=true;
          __PIPA__.game.pointer.firing=true;
        }
        if(__PIPA__.game.run){
          if(__PIPA__.game.run.ko) kos++;
          if(__PIPA__.game.run.wave>maxWave) maxWave=__PIPA__.game.run.wave;
        }
        if(__PIPA__.game.scene==='result') break;
      }
    } catch(e){ error = String(e && e.stack || e); }
    var r=__PIPA__.game.run;
    return {
      error:error, scene:__PIPA__.game.scene, shops:shops, maxWave:maxWave, kos:kos,
      elapsed:r?+r.elapsed.toFixed(1):null, time:r?+r.time.toFixed(1):null,
      score:r?r.score:null, shots:r?r.shots:null, hits:r?r.hits:null,
      butt:r?r.buttHits:null, maxCombo:r?r.maxCombo:null,
      result:__PIPA__.game.result ? {score:__PIPA__.game.result.score, rank:__PIPA__.game.result.rank.rank, wave:__PIPA__.game.result.wave} : null,
      coins:__PIPA__.game.save.coins
    };
  })()`);
  console.log('LONGRUN', JSON.stringify(out));
  const replay = await ev(`(function(){
    __PIPA__.game.scene='menu'; __PIPA__.game.run=null; __PIPA__.game.result=null;
    __PIPA__.startRun();
    var r=__PIPA__.game.run;
    return {up:r.up, damage:r.stats.damage, mag:r.stats.mag, time:r.time, scene:__PIPA__.game.scene, mode:r.stats.buttMult};
  })()`);
  console.log('REPLAY_RESET', JSON.stringify(replay));
  ws.close();
}
main().catch(e => { console.error('FAIL', e); process.exit(1); });
