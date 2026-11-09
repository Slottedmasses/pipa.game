const fs = require('fs');
const path = require('path');
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const outDir = 'D:/AI/workspaces/pipa-panic/docs/screenshots';
  fs.mkdirSync(outDir, { recursive: true });
  const tabs = await fetch('http://127.0.0.1:9223/json').then(r => r.json());
  const tab = tabs.find(t => t.url.includes('8765'));
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  let seq = 0;
  const pending = new Map();
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
  const shot = async name => {
    const r = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
    fs.writeFileSync(path.join(outDir, name + '.png'), Buffer.from(r.data, 'base64'));
    console.log('shot', name);
  };
  const step = n => ev('for(let i=0;i<' + n + ';i++)__PIPA__.step(1/60)');

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.bringToFront');
  await send('Emulation.setFocusEmulationEnabled', { enabled: true });
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390, height: 844, deviceScaleFactor: 2, mobile: true,
    screenWidth: 390, screenHeight: 844
  });
  await send('Page.navigate', { url: 'http://127.0.0.1:8765/?demo=1' });
  await sleep(1000);
  const geo = await ev('({inner:[innerWidth,innerHeight], stage:__PIPA__.stage, scene:__PIPA__.game.scene})');
  console.log('GEO', JSON.stringify(geo));
  await ev('__PIPA__.game.demo=false; __PIPA__.game.save.coins=99999; __PIPA__.game.save.unlocked=["suit","niulai","feidudu","doubao"]; __PIPA__.game.save.skin="suit"; __PIPA__.game.save.best=0; __PIPA__.game.save.plays=0; __PIPA__.game.save.bestCombo=0; __PIPA__.game.save.bestButtRate=0;');
  await step(3);
  await shot('menu');

  await ev('__PIPA__.startRun(); __PIPA__.game.debugAutoAim=true; __PIPA__.game.pointer.down=true; __PIPA__.game.pointer.firing=true;');
  await step(190);
  await shot('gameplay');
  console.log('combat', JSON.stringify(await ev('({score:__PIPA__.game.run.score,combo:__PIPA__.game.run.combo,shots:__PIPA__.game.run.shots,time:+__PIPA__.game.run.time.toFixed(1)})')));

  await ev('__PIPA__.game.run.target.hp=1;');
  await step(190);
  await shot('shop');
  console.log('scene', await ev('__PIPA__.game.scene'));

  await ev('__PIPA__.buyCard(__PIPA__.game.run.shop.cards[0]);');
  await step(8);
  await ev('__PIPA__.endRun();');
  await step(30);
  await shot('result');

  // Skin showcase, one per frame.
  const skins = [['suit', 'skin-suit'], ['niulai', 'skin-niulai'], ['feidudu', 'skin-feidudu'], ['doubao', 'skin-doubao']];
  for (const [id, name] of skins) {
    await ev('__PIPA__.game.scene="menu"; __PIPA__.game.run=null; __PIPA__.game.result=null; __PIPA__.game.demo=false; __PIPA__.game.save.coins=99999; __PIPA__.game.save.unlocked=["suit","niulai","feidudu","doubao"]; __PIPA__.game.save.skin="' + id + '"; __PIPA__.game.save.best=0; __PIPA__.game.save.plays=0; __PIPA__.step(1/60);');
    await step(5);
    await shot(name);
  }

  await ev('__PIPA__.game.demo=false; __PIPA__.game.save.coins=1000; __PIPA__.game.save.unlocked=["suit"]; __PIPA__.game.save.skin="suit"; __PIPA__.game.modal={type:"skin",skinId:"niulai"}; __PIPA__.step(1/60);');
  await step(2);
  await shot('skin-modal');

  ws.close();
}
main().catch(e => { console.error('FAIL', e); process.exit(1); });
