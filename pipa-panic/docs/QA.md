# QA 记录

测试日期：2026-11-09  
测试环境：Windows / Edge Headless `--headless=new` / Node 24 / 390×844 与 470×1017 截图（最终统一为 390×844）  
状态：原型通过浏览器自动化与微信 API mock；尚未在微信开发者工具和真机运行。

---

## 1. 浏览器渲染与交互

使用 Chrome DevTools Protocol 在 390×844、DPR 2 下加载 `http://127.0.0.1:8765/?demo=1`。

验证项：

- 主菜单、战斗、军火商、结算、皮肤购买弹窗全部绘制正常。
- 四套皮肤（西装暴徒 / 牛来 / 肥嘟嘟 / 豆包）均能在菜单和战斗内切换。
- 顶部 HUD、血条、Combo、金币、弹匣、装填进度、准星均可见。
- 按钮点击、弹窗解锁、暂停/继续、重开可用。

最终截图：`docs/screenshots/`。

### 1.1 3D 背景、受击动作与失败反杀

验证项：

- 视频房间景深帧正确加载（`assets/images/bg-video-main.jpg`），中央幕布和前景地板遮住原片角色，保留视频的红色房间、吊灯和木地板。
- 角色新增球面光照、高光、环境遮蔽、接触阴影、左右边缘光；命中时会侧倾、手臂甩动、头部偏转、臀部晃动。
- KO 时角色向前扑倒，不再直接淡出。
- 倒计时归零进入 `losing`，播放 15 帧视频反杀过场 + `lose-sting.mp3`，字幕「你被屁股拿枪毙了」，2.95 秒后进入结算；点击可跳过。
- 最终截图：`menu.png`、`gameplay.png`、`defeat.png`、`shop.png`、`result.png`、`skins-lineup.png`。

微信 API mock 也验证了状态链路：

```json
WX_MOCK_OK {"scene":"result","shots":14,"hits":14,"butt":14,"coins":220,"combatResult":10015,"lostResult":true,"storageKeys":["pipa-panic-save-v1"]}
```

其中 `combatResult` 是正常射击局的分数，`lostResult:true` 表示第二段测试在倒计时归零后确实经过了失败过场并标记为失败局。

## 2. 战斗逻辑长局测试

脚本：`tools/cdp-longrun.js`  
方式：自动瞄准屁股，逐帧 `tick(1/60)`，遇到商店自动跳过。

结果：

```json
{
  "error": null,
  "scene": "result",
  "shops": 4,
  "maxWave": 5,
  "elapsed": 90,
  "time": 0,
  "score": 279629,
  "shots": 261,
  "hits": 261,
  "butt": 261,
  "maxCombo": 261,
  "result": {"score": 279629, "rank": "SSS", "wave": 5},
  "coins": 103443
}
```

说明：

- 261 发全部命中屁股，伤害、金币、Combo、KO、商店、换人、结算链路正常。
- 4 次商店、5 个波次，最终 SSS 评级，无 JS 异常。
- 商店和 KO 暂停计时，所以 `elapsed` 大于 75；时间归零后正常进入结算。

## 3. 商店购买

```json
BUY_BEFORE {"coins":100182,"up":{}}
BUY_AFTER  {"scene":"playing","coins":100072,"up":{"buttRadar":1},"wave":2,"hp":2370,"ammo":8}
```

验证：

- 扣款正确（100182 → 100072，价格 110）。
- 强化写入 `run.up`。
- 商店关闭，波次 +1，血量按公式变为 2370，弹匣补满。
- 屏幕 toast 显示「臀部雷达 已装备」。

## 4. 装填

将弹匣设为 0、装填剩余时间 0.01 秒，逐帧推进：

```json
{"ammo":7,"reloading":false,"mag":8}
```

说明：装填完成补满 8 发，随后因为仍按住开火，立刻打出 1 发变为 7 发。

## 5. 皮肤购买弹窗（真实点击）

- 金币 1000，仅解锁西装暴徒。
- 打开牛来购买弹窗，点击「解锁并换上」按钮中心。
- 结果：

```json
{"modal":null,"unlocked":["suit","niulai"],"coins":400}
```

验证：

- 弹窗按钮命中区正确。
- 金币 1000 → 400（牛来 600）。
- 皮肤写入解锁列表并自动选中。

## 6. 重开状态重置

结束一局后直接 `startRun()`：

```json
{"up":{},"damage":26,"mag":8,"time":75,"scene":"playing","buttMult":2}
```

验证：

- 上一局的肉鸽强化没有污染新一局。
- 伤害回到 Lv.1 的 26，弹匣 8，打臀倍率回到 2.0。

## 7. 微信 API mock

脚本：`tools/wx-mock-test.js`

- 使用 Node + 假 `wx` / Canvas / storage / audio。
- 覆盖：启动、开始、连续射击、KO、结算、存档、触摸开始/结束、切后台。
- 输出：

```json
WX_MOCK_OK {"scene":"result","shots":14,"hits":14,"butt":14,"coins":220,"combatResult":10015,"lostResult":true,"storageKeys":["pipa-panic-save-v1"]}
```

验证：

- 微信路径没有误用 `window`、`document`、`localStorage`、`Audio`。
- 存档 key 正常写入。
- 安全区参数能正常读取（mock 中 `safeArea.top=47`，舞台缩进不报错）。
- 倒计时归零进入 `losing`，过场结束后 `result.lost === true`。
- 完整 75 秒自动长局：5 波、SSS、失败结算，无运行时异常。

长局输出：

```json
{"longRun":{"score":273459,"rank":"SSS","wave":5,"lost":true}}
```

## 8. 尚未覆盖

- 微信开发者工具模拟器编译 / 真机预览。
- iOS / Android 上的 BGM 自动播放策略、静音键、震动强度。
- 刘海屏实际视觉（安全区已按 `safeArea` 缩进，但未真机确认）。
- 低端机 30fps / 发热。
- 真实玩家命中率下的经济产出。
- 审核风险预演。

## 9. 复测

启动本地服务器：

```powershell
cd D:\AI\workspaces\pipa-panic
& 'C:\Users\DELL\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe' `
  -m http.server 8765 --directory 'D:\AI\workspaces\pipa-panic'
```

启动带调试端口的 Edge：

```powershell
& 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe' `
  --headless=new --disable-gpu --hide-scrollbars `
  --window-size=470,1017 --force-device-scale-factor=1 `
  --remote-debugging-port=9223 `
  --user-data-dir='C:\Users\DELL\AppData\Local\Temp\edge-pipa-cdp' `
  'http://127.0.0.1:8765/?demo=1'
```

运行测试：

```powershell
node tools/cdp-longrun.js
node tools/cdp-input-test.js
node tools/wx-mock-test.js
```

重新生成失败反杀截图（静态）：

```powershell
& 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe' `
  --headless=new --disable-gpu --hide-scrollbars `
  --window-size=470,1017 --force-device-scale-factor=1 `
  --virtual-time-budget=2600 `
  --screenshot='D:\AI\workspaces\pipa-panic\docs\screenshots\defeat.png' `
  'http://127.0.0.1:8765/?unlockall=1&lose=1'
```

`tools/capture-final.js` 是早期 CDP 截图脚本，只覆盖菜单/战斗/商店/结算；最终截图由 Edge 静态截图后缩放到 390×844。
