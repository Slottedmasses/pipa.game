function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
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
  const click = async (x, y, buttons) => {
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: buttons === undefined ? 1 : buttons, clickCount: 1 });
    await sleep(30);
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 });
    await sleep(80);
  };

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.bringToFront');
  await send('Emulation.setFocusEmulationEnabled', { enabled: true });
  await send('Page.navigate', { url: 'http://127.0.0.1:8765/?demo=1' });
  await sleep(900);
  await ev('__PIPA__.step(1/60); __PIPA__.step(1/60);');
  const stage = await ev('({s:__PIPA__.stage.scale,x:__PIPA__.stage.x,y:__PIPA__.stage.y})');
  console.log('stage', JSON.stringify(stage));
  const sx = stage.x + 195 * stage.s;
  const sy = stage.y + 797 * stage.s;
  console.log('click start at', sx, sy);
  await click(sx, sy, 1);
  console.log('after CDP click scene:', await ev('__PIPA__.game.scene'));

  if (await ev('__PIPA__.game.scene') === 'menu') {
    const r = await ev(`(function(){
      const s=__PIPA__.stage, c=document.querySelector('canvas');
      const x=s.x+195*s.scale, y=s.y+797*s.scale;
      c.dispatchEvent(new PointerEvent('pointerdown',{clientX:x,clientY:y,bubbles:true,pointerId:1,pointerType:'mouse',button:0,buttons:1}));
      c.dispatchEvent(new PointerEvent('pointerup',{clientX:x,clientY:y,bubbles:true,pointerId:1,pointerType:'mouse',button:0}));
      return {x,y};
    })()`);
    console.log('synthetic', JSON.stringify(r));
    console.log('after synthetic scene:', await ev('__PIPA__.game.scene'));
  }

  // If started, go back to menu and test modal.
  await ev('__PIPA__.game.scene="menu"; __PIPA__.game.run=null; __PIPA__.game.demo=false; __PIPA__.game.save.coins=1000; __PIPA__.game.save.unlocked=["suit"]; __PIPA__.game.save.skin="suit"; __PIPA__.game.modal={type:"skin",skinId:"niulai"}; __PIPA__.step(1/60);');
  const ms = await ev('({s:__PIPA__.stage.scale,x:__PIPA__.stage.x,y:__PIPA__.stage.y, modal: __PIPA__.game.modal, buttons: __PIPA__.game.buttons.map(b=>({id:b.id,layer:b.layer,x:b.x,y:b.y,w:b.w,h:b.h}))})');
  console.log('modal stage', JSON.stringify(ms));
  const bx = ms.x + 195 * ms.s;
  const by = ms.y + 515 * ms.s;
  await click(bx, by, 1);
  console.log('after modal CDP click:', await ev('({modal:__PIPA__.game.modal, unlocked:__PIPA__.game.save.unlocked, coins:__PIPA__.game.save.coins})'));
  if (await ev('__PIPA__.game.modal')) {
    await ev(`(function(){
      const s=__PIPA__.stage, c=document.querySelector('canvas');
      const x=s.x+195*s.scale, y=s.y+515*s.scale;
      c.dispatchEvent(new PointerEvent('pointerdown',{clientX:x,clientY:y,bubbles:true,pointerId:2,pointerType:'mouse',button:0,buttons:1}));
      c.dispatchEvent(new PointerEvent('pointerup',{clientX:x,clientY:y,bubbles:true,pointerId:2,pointerType:'mouse',button:0}));
      return true;
    })()`);
    console.log('after modal synthetic:', await ev('({modal:__PIPA__.game.modal, unlocked:__PIPA__.game.save.unlocked, coins:__PIPA__.game.save.coins})'));
  }
  ws.close();
}
main().catch(e => { console.error('FAIL', e); process.exit(1); });
