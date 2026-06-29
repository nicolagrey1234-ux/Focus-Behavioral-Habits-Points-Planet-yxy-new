/* ============================================================
 *  积分星球 v3.3 — 低维护版本
 *
 *  核心设计：
 *    - 奖励用唯一 uid 定位，不再依赖数组下标
 *    - 所有操作按 id 查找，删除/添加不会串号
 * ============================================================ */

/* ========== 工具：唯一 ID ========== */
var _uidCount = 1;
function uid() { return 'rw_' + (_uidCount++); }

// 转义字符串，安全放入 HTML onclick="..." 中的单引号属性值
function escQ(s) {
  return String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'");
}

// HTML 转义：防止 XSS，把 < > & " ' 变成无害的占位符
function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
          .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

/* ========== A. 本地预览模拟器 ========== */
(function() {
  var isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if (!isLocal) return;
  if (!localStorage.getItem('kids_points_v3')) {
    localStorage.setItem('kids_points_v3', JSON.stringify({
      score: 85, baseGiven: true, pwd: '1234',
      wkCount: 8, wkReset: Date.now(), wkBonusGiven: false,
      wkGoalStreak: 0, wkGoalLastWeek: '', wkGoalBonuses: {},
      pend: [], logs: [],
      tasks: [
        { n:'番茄钟 20分钟', p:2, e:'🍅', cat:'focus' },
        { n:'语文阅读 20分钟', p:2, e:'📖', cat:'focus' },
        { n:'英语阅读 20分钟', p:2, e:'📘', cat:'focus' },
        { n:'运动20分钟', p:2, e:'⚽', cat:'focus' },
        { n:'整理床铺', p:1, e:'🛏️', cat:'hygiene' },
        { n:'回家洗手', p:1, e:'🧼', cat:'hygiene' },
        { n:'玩具收好', p:1, e:'🧸', cat:'hygiene' },
        { n:'整理书桌', p:1, e:'📝', cat:'hygiene' },
        { n:'书本保持整洁', p:1, e:'📚', cat:'hygiene' }
      ],
      rewards: [
        { id: uid(), n:'零食小奖励', c:15, e:'🍭' },
        { id: uid(), n:'多玩15分钟', c:15, e:'🎮' },
        { id: uid(), n:'小玩具', c:80, e:'🧸' },
        { id: uid(), n:'篮球/足球', c:80, e:'⚽' },
        { id: uid(), n:'周末郊游', c:300, e:'🏕️' }
      ],
      streaks: {
        '英语阅读 20分钟': { count:0, lastDate:'', doneToday:'', bonuses:{} },
        '运动20分钟': { count:0, lastDate:'', doneToday:'', bonuses:{} }
      }
    }));
  }
})();

/* ========== B. 数据迁移与修复 ========== */
(function(){
  try {
    var oldKeys = ['kids_points_v2', 'kids_points_v1', 'kids_points'];
    for (var oi = 0; oi < oldKeys.length; oi++) {
      var oldRaw = localStorage.getItem(oldKeys[oi]);
      if (oldRaw) {
        var oldD = JSON.parse(oldRaw);
        if (!oldD.tasks) oldD.tasks = [
          { n:'番茄钟 20分钟', p:2, e:'🍅', cat:'focus' },
          { n:'语文阅读 20分钟', p:2, e:'📖', cat:'focus' },
          { n:'英语阅读 20分钟', p:2, e:'📘', cat:'focus' },
          { n:'运动20分钟', p:2, e:'⚽', cat:'focus' },
          { n:'整理床铺', p:1, e:'🛏️', cat:'hygiene' },
          { n:'回家洗手', p:1, e:'🧼', cat:'hygiene' },
          { n:'玩具收好', p:1, e:'🧸', cat:'hygiene' },
          { n:'整理书桌', p:1, e:'📝', cat:'hygiene' },
          { n:'书本保持整洁', p:1, e:'📚', cat:'hygiene' },
        ];
        if (!oldD.baseGiven) oldD.baseGiven = true;
        oldD._migrated = true;
        localStorage.setItem('kids_points_v3', JSON.stringify(oldD));
        localStorage.removeItem(oldKeys[oi]);
        console.log('Migrated data from ' + oldKeys[oi] + ' to v3, score=' + oldD.score);
      }
    }
  } catch(e) { console.error('Migration error', e); }
  // 修复 v3 数据缺失字段（只补缺，不改已有值）
  try {
    var rawV3 = localStorage.getItem('kids_points_v3');
    if (rawV3) {
      var vd = JSON.parse(rawV3);
      var fixed = false;
      if (!vd.rewards || !Array.isArray(vd.rewards) || !vd.rewards.length) {
        vd.rewards = [
          { id: uid(), n:'零食小奖励', c:15, e:'🍭' },
          { id: uid(), n:'多玩15分钟', c:15, e:'🎮' },
          { id: uid(), n:'小玩具', c:80, e:'🧸' },
          { id: uid(), n:'篮球/足球', c:80, e:'⚽' },
          { id: uid(), n:'周末郊游', c:300, e:'🏕️' },
        ];
        fixed = true;
      }
      if (!vd.logs || !Array.isArray(vd.logs)) { vd.logs = []; fixed = true; }
      if (!vd.pend || !Array.isArray(vd.pend)) { vd.pend = []; fixed = true; }
      if (!vd.streaks) { vd.streaks = { '英语阅读 20分钟': { count:0, lastDate:'', doneToday:'', bonuses:{} }, '运动20分钟': { count:0, lastDate:'', doneToday:'', bonuses:{} } }; fixed = true; }
      if (!vd.tasks) { vd.tasks = []; fixed = true; }
      if (fixed) { localStorage.setItem('kids_points_v3', JSON.stringify(vd)); }
    }
  } catch(e) { console.error('v3 fix error', e); }
})();

/* ========== C. 数据模型 ========== */
var K = 'kids_points_v3';
function sv() { localStorage.setItem(K, JSON.stringify(D)); }
function wkStart() {
  var d = new Date(), day = d.getDay();
  d.setDate(d.getDate() - day + (day===0?-6:1));
  d.setHours(0,0,0,0); return d.getTime();
}
function df() { return {
  score: 200, logs: [], pend: [],
  tasks: [
    { n:'番茄钟 20分钟', p:2, e:'🍅', cat:'focus' },
    { n:'语文阅读 20分钟', p:2, e:'📖', cat:'focus' },
    { n:'英语阅读 20分钟', p:2, e:'📘', cat:'focus' },
    { n:'运动20分钟', p:2, e:'⚽', cat:'focus' },
    { n:'整理床铺', p:1, e:'🛏️', cat:'hygiene' },
    { n:'回家洗手', p:1, e:'🧼', cat:'hygiene' },
    { n:'玩具收好', p:1, e:'🧸', cat:'hygiene' },
    { n:'整理书桌', p:1, e:'📝', cat:'hygiene' },
    { n:'书本保持整洁', p:1, e:'📚', cat:'hygiene' },
  ],
  rewards: [
    { id: uid(), n:'零食小奖励', c:15, e:'🍭' },
    { id: uid(), n:'多玩15分钟', c:15, e:'🎮' },
    { id: uid(), n:'小玩具', c:80, e:'🧸' },
    { id: uid(), n:'篮球/足球', c:80, e:'⚽' },
    { id: uid(), n:'周末郊游', c:300, e:'🏕️' },
  ],
  pwd: '1234',
  wkCount: 0, wkReset: wkStart(), wkBonusGiven: false,
  baseGiven: true,
  wkGoalStreak: 0, wkGoalLastWeek: '', wkGoalBonuses: {},
  streaks: {
    '英语阅读 20分钟': { count:0, lastDate:'', doneToday:'', bonuses:{} },
    '运动20分钟': { count:0, lastDate:'', doneToday:'', bonuses:{} },
  }
};}
function ld() {
  try {
    var raw = localStorage.getItem(K);
    if (raw) {
      var d = JSON.parse(raw);
      if (!d.tasks) {
        var nd = df();
        if (d.score && d.score > nd.score) nd.score = d.score;
        if (d.logs && d.logs.length) nd.logs = d.logs;
        if (d.pwd) nd.pwd = d.pwd;
        if (d.rewards && d.rewards.length) nd.rewards = d.rewards;
        return nd;
      }
      if (!d.streaks && (typeof d.engReadStreak !== 'undefined')) {
        d.streaks = {
          '英语阅读 20分钟': { count:d.engReadStreak||0, lastDate:d.engReadLastDate||'', doneToday:d.engReadDoneToday||'', bonuses:d.engStreakBonuses||{} },
          '运动20分钟': { count:0, lastDate:'', doneToday:'', bonuses:{} },
        };
        delete d.engReadStreak; delete d.engReadLastDate; delete d.engReadDoneToday; delete d.engStreakBonuses;
      }
      if (!d.streaks) d.streaks = df().streaks;
      // 给老数据中无 id 的奖励补 id
      if (d.rewards) for (var ri = 0; ri < d.rewards.length; ri++) {
        if (!d.rewards[ri].id) d.rewards[ri].id = uid();
      }
      return d;
    }
  } catch(e){ console.error('load error', e); }
  return df();
}
var D = ld();

/* ========== D. 周时间管理 ========== */
function chkWeek() {
  if (Date.now() > D.wkReset + 7*86400000) {
    if (D.wkCount > 0 && !D.wkBonusGiven) {
      D.wkGoalStreak = 0;
      D.wkGoalBonuses = {};
    }
    D.wkCount = 0; D.wkBonusGiven = false; D.wkReset = wkStart(); sv();
  }
}

/* ========== E. Tab切换 ========== */
var curTab = 'home';
function goTab(t) {
  curTab = t;
  document.querySelectorAll('.page').forEach(function(p){p.classList.remove('active');});
  document.querySelectorAll('.tab-btn').forEach(function(b){b.classList.remove('active');});
  document.getElementById('pg-'+t).classList.add('active');
  document.querySelectorAll('.tab-btn')[t==='pend'?3:['home','log','reward'].indexOf(t)].classList.add('active');
  if(t==='log') renderLog();
  if(t==='reward') renderRewards();
  if(t==='pend') renderPend();
  if(t==='home') updHome();
}

/* ========== F. 主页渲染 ========== */
function updHome() {
  renderTasks();
  chkWeek();
  document.getElementById('totalScore').textContent = D.score;
  document.getElementById('topScore').textContent = '⭐ ' + D.score;
  var pct = Math.min(100, D.wkCount/20*100);
  document.getElementById('wkBar').style.width = pct+'%';
  document.getElementById('wkDone').textContent = D.wkCount;
  var wgs = D.wkGoalStreak || 0;
  var wg4 = D.wkGoalBonuses && D.wkGoalBonuses['4'];
  document.getElementById('wkGoalStreakNum').textContent = wgs;
  document.getElementById('wkGoalBar').style.width = Math.min(100,wgs/4*100)+'%';
  document.getElementById('wkGoalDesc').innerHTML = '连续达标 <b>' + wgs + '</b> / 4 周' + (wg4 ? ' <span style="color:var(--green);">✅ 已获得</span>' : '，达成奖励 <span style="color:var(--purple);font-weight:700;">+120分</span>');
  renderStreaks();
  var b = document.getElementById('pendBadge');
  if (D.pend.length > 0) { b.classList.remove('hide'); b.textContent = D.pend.length; }
  else { b.classList.add('hide'); }
}

function renderStreaks() {
  var area = document.getElementById('streakArea');
  if (!area) return;
  var html = '';
  function getEmo(name) {
    if (!D.tasks) return '⭐';
    for (var ei = 0; ei < D.tasks.length; ei++) {
      if (D.tasks[ei].n === name) return D.tasks[ei].e;
    }
    return '⭐';
  }
  var names = Object.keys(D.streaks||{});
  for (var si = 0; si < names.length; si++) {
    var name = names[si];
    var s = D.streaks[name];
    if (!s) continue;
    var cnt = s.count || 0;
    var b7 = s.bonuses && s.bonuses['7'];
    var b21 = s.bonuses && s.bonuses['21'];
    html +=
      '<div class="prog-box">' +
        '<div class="ptitle">' + esc(getEmo(name)) + ' ' + esc(name) + ' 连击</div>' +
        '<div class="prog-bar-bg"><div class="prog-bar-fill" style="width:'+Math.min(100,cnt/7*100)+'%;background:linear-gradient(90deg,#FFB347,#FF6B35);"></div></div>' +
        '<div class="pdesc">连续 <b>' + cnt + '</b> / 7 天' + (b7 ? ' <span style="color:var(--green);">✅ 已获得</span>' : '，达标奖励 <span style="color:var(--orange);font-weight:700;">+20分</span>') + '</div>' +
        '<div class="prog-bar-bg" style="margin-top:6px;"><div class="prog-bar-fill" style="width:'+Math.min(100,cnt/21*100)+'%;background:linear-gradient(90deg,#9B5DE5,#EF476F);"></div></div>' +
        '<div class="pdesc">连续 <b>' + cnt + '</b> / 21 天' + (b21 ? ' <span style="color:var(--green);">✅ 已获得</span>' : '，达标奖励 <span style="color:var(--pink);font-weight:700;">+60分</span>') + '</div>' +
      '</div>';
  }
  area.innerHTML = html || '<div class="empty"><div class="eicon">🔔</div>暂无连击任务，去家长面板开启吧！</div>';
}

/* ========== G. 任务渲染 ========== */
var taskQtys = {};
function getQty(n) { taskQtys[n] = taskQtys[n] || 1; return taskQtys[n]; }
function setQty(n, v) { taskQtys[n] = Math.max(1, Math.min(99, v)); }

function renderTasks() {
  var focusEl = document.getElementById('focusTasks');
  var hygEl = document.getElementById('hygieneTasks');
  if (!focusEl || !hygEl) return;
  var focusTasks = D.tasks.filter(function(t) { return t.cat === 'focus'; });
  var hygTasks = D.tasks.filter(function(t) { return t.cat === 'hygiene'; });
  function makeCard(t) {
    var card = document.createElement('div');
    card.className = 'task-card slide';
    var cls = t.cat === 'focus' ? 'b1' : 'b2';
    var n = t.n;
    card.innerHTML =
      '<div class="tc-top">' +
        '<span class="tc-emoji">' + esc(t.e) + '</span>' +
        '<div class="tc-info">' +
          '<div class="tc-name">' + esc(t.n) + '</div>' +
          '<div class="tc-pts">每次 +' + t.p + ' 分</div>' +
        '</div>' +
      '</div>' +
      '<div class="tc-qty">' +
        '<button onclick="event.stopPropagation();changeQty(\'' + escQ(n) + '\',-1);">-</button>' +
        '<span id="qty_' + n.replace(/\s/g,'_') + '">' + getQty(n) + '</span>' +
        '<button onclick="event.stopPropagation();changeQty(\'' + escQ(n) + '\',1);">+</button>' +
      '</div>' +
      '<button class="tc-submit ' + cls + '" onclick="reqPts(\'' + escQ(n) + '\',' + t.p + ',getQty(\'' + escQ(n) + '\'))">提交 +' + t.p + '分</button>';
    return card;
  }
  focusEl.innerHTML = '';
  for (var fi = 0; fi < focusTasks.length; fi++) {
    focusEl.appendChild(makeCard(focusTasks[fi]));
  }
  hygEl.innerHTML = '';
  for (var hi = 0; hi < hygTasks.length; hi++) {
    hygEl.appendChild(makeCard(hygTasks[hi]));
  }
}

function changeQty(name, delta) {
  var cur = getQty(name);
  setQty(name, cur + delta);
  var el = document.getElementById('qty_' + name.replace(/\s/g,'_'));
  if (el) el.textContent = getQty(name);
}

/* ========== H. 待确认流程 ========== */
function reqPts(name, pts, qty) {
  qty = qty || 1;
  D.pend.push({ id: Date.now(), n: name, p: pts, q: qty, t: new Date().toLocaleString('zh-CN') });
  sv(); renderPend(); goTab('pend');
  toast('已提交 ' + qty + '个，等爸爸妈妈确认 ✋');
}

function renderPend() {
  var el = document.getElementById('pendList');
  if (!D.pend.length) { el.innerHTML = '<div class="empty"><div class="eicon">🎉</div>太棒了，没有待确认的了！</div>'; return; }
  el.innerHTML = '';
  for (var i = 0; i < D.pend.length; i++) {
    (function(item) {
      var div = document.createElement('div');
      div.className = 'pend-item slide';
      var label = item.q && item.q>1 ? esc(item.n) + ' ×' + item.q : esc(item.n);
      div.innerHTML =
        '<div><div class="pn">' + label + '</div><div class="pt">' + item.t + '</div></div>' +
        '<div style="display:flex;align-items:center;gap:8px;">' +
        '<span class="pb">+' + (item.p * (item.q||1)) + '分</span>' +
        '<div class="pend-acts">' +
        '<button class="pa-ok" onclick="pwdForConfirm(\'' + item.id + '\')">✅</button>' +
        '<button class="pa-no" onclick="rejectPend(\'' + item.id + '\')">❌</button>' +
        '</div></div>';
      el.appendChild(div);
    })(D.pend[i]);
  }
}

function rejectPend(id) {
  D.pend = D.pend.filter(function(i){return i.id!==id;});
  sv(); renderPend(); updHome();
  toast('已取消 ❌');
}

/* ========== I. 家长密码 ========== */
var pwdPurpose = '', pwdPayload = null;
function showPwd(purpose, payload) {
  pwdPurpose = purpose; pwdPayload = payload;
  document.getElementById('pwdInput').value = '';
  var titles = {'parent':'🔐 家长验证','chgPwd':'🔐 输入原密码','redeem':'🔐 家长确认兑换'};
  document.getElementById('pwdTitle').textContent = titles[purpose] || '🔐 家长验证';
  document.getElementById('pwdMo').classList.add('show');
  setTimeout(function(){document.getElementById('pwdInput').focus();}, 100);
}
function closePwdMo() { document.getElementById('pwdMo').classList.remove('show'); }
function checkPwd() {
  var v = document.getElementById('pwdInput').value;
  if (v !== D.pwd) { toast('密码错误 ❌'); return; }
  closePwdMo();
  if (pwdPurpose === 'parent') openParentPanel();
  else if (pwdPurpose === 'chgPwd') openChgPwd();
  else if (pwdPurpose === 'confirm') doConfirmPend(pwdPayload);
  else if (pwdPurpose === 'redeem') openRedeemMo(pwdPayload);
}

/* ========== J. 确认积分（核心逻辑） ========== */
function pwdForConfirm(id) { showPwd('confirm', id); }

function doConfirmPend(id) {
  var i = D.pend.find(function(x){return x.id===id;}); if (!i) return;
  var qty = i.q || 1;
  var totalPts = i.p * qty;
  D.score += totalPts;
  if(!Array.isArray(D.logs))D.logs=[];
  D.logs.unshift({ type:'earn', n:(qty>1?i.n+' ×'+qty:i.n), p:totalPts, t:i.t, q:qty });

  var task = D.tasks.find(function(t){return t.n===i.n;});

  // 番茄钟计数（仅名称含「番茄钟」的任务）
  if (task && task.n.indexOf('番茄钟') !== -1) {
    chkWeek();
    D.wkCount = (D.wkCount || 0) + qty;
    sv();
    if (D.wkCount >= 20 && !D.wkBonusGiven) {
      setTimeout(function(){ document.getElementById('weekBonusMo').classList.add('show'); }, 400);
    }
  }

  // 日连击追踪（所有任务自动创建条目）
  var streakMsg = '';
  if (task) {
    try {
      updateStreak(task.n);
      var cnt = (D.streaks[task.n] && D.streaks[task.n].count) || 0;
      streakMsg = ' | 🔥 连续' + cnt + '天';
    } catch(e) {}
  }

  D.pend = D.pend.filter(function(x){return x.id!==id;});
  sv();
  renderPend(); updHome(); fw();
  toast('积分入账 +' + totalPts + '分 ✅' + streakMsg);
}

/* ========== K. 日连击系统 ========== */
function updateStreak(name) {
  D.streaks = D.streaks || {};
  if (!D.streaks[name]) { D.streaks[name] = { count:0, lastDate:'', doneToday:'', bonuses:{} }; }
  var s = D.streaks[name];
  var today = new Date().toISOString().slice(0,10);
  if (s.doneToday === today) return;

  var lastDate = s.lastDate;
  if (lastDate) {
    var prev = new Date(lastDate + 'T00:00:00');
    var cur = new Date(today + 'T00:00:00');
    var diffDays = Math.round((cur - prev) / 86400000);
    if (diffDays === 1) { s.count = (s.count || 0) + 1; }
    else if (diffDays > 1) { s.count = 1; s.bonuses = {}; }
  } else { s.count = 1; }
  s.lastDate = today;
  s.doneToday = today;
  s.bonuses = s.bonuses || {};

  if (s.count >= 7 && !s.bonuses['7']) {
    s.bonuses['7'] = true;
    D.score += 20;
    if(!Array.isArray(D.logs))D.logs=[];
    D.logs.unshift({ type:'earn', n:'🏆 ' + name + ' 连击7天奖励', p:20, t:new Date().toLocaleString('zh-CN') });
    sv();
    setTimeout(function(){ alert('🎉 ' + name + ' 连击7天！+20分已自动发放！'); }, 300);
  }
  if (s.count >= 21 && !s.bonuses['21']) {
    s.bonuses['21'] = true;
    D.score += 60;
    if(!Array.isArray(D.logs))D.logs=[];
    D.logs.unshift({ type:'earn', n:'🌟 ' + name + ' 连击21天奖励', p:60, t:new Date().toLocaleString('zh-CN') });
    sv();
    setTimeout(function(){ alert('🌟 ' + name + ' 连击21天！+60分已自动发放！'); }, 300);
  }
}

/* ========== L. 周奖励系统 ========== */
function giveWeekBonus() {
  document.getElementById('weekBonusMo').classList.remove('show');
  D.score += 20;
  D.wkBonusGiven = true;
  if(!Array.isArray(D.logs))D.logs=[];
  D.logs.unshift({ type:'earn', n:'🏆 一周20个番茄钟奖励', p:20, t:new Date().toLocaleString('zh-CN') });

  var thisWeek = String(D.wkReset);
  var lastWeek = String(D.wkGoalLastWeek || '');
  if (lastWeek !== thisWeek) {
    D.wkGoalStreak = (D.wkGoalStreak || 0) + 1;
    D.wkGoalLastWeek = thisWeek;
    D.wkGoalBonuses = D.wkGoalBonuses || {};
    if (D.wkGoalStreak >= 4 && !D.wkGoalBonuses['4']) {
      D.wkGoalBonuses['4'] = true;
      D.score += 120;
      if(!Array.isArray(D.logs))D.logs=[];
      D.logs.unshift({ type:'earn', n:'🌟 连续4周完成20个番茄钟！', p:120, t:new Date().toLocaleString('zh-CN') });
      setTimeout(function(){ alert('🌟 太棒了！连续4周完成20个番茄钟！+120分！'); }, 300);
    }
  }
  sv(); updHome(); fw();
  toast('🏆 周奖励+20分！已连续 ' + D.wkGoalStreak + ' 周达标');
}

/* ========== M. 积分设置 ========== */
function addBasePoints() {
  if (D.baseGiven) { alert('基础积分已发放过，不再重复发放。'); return; }
  D.score += 200;
  if(!Array.isArray(D.logs))D.logs=[];
  D.logs.unshift({ type:'earn', n:'⭐ 基础积分', p:200, t:new Date().toLocaleString('zh-CN') });
  D.baseGiven = true;
  sv(); updHome(); fw();
  toast('基础积分+200已发放 ⭐');
  renderPP();
}

function setManualScore() {
  var v = parseInt(document.getElementById('setScoreInput').value);
  if (isNaN(v) || v < 0) { toast('请输入有效的积分值 ❌'); return; }
  var old = D.score;
  D.score = v;
  D.baseGiven = true;
  document.getElementById('setScoreInput').value = '';
  sv(); updHome(); fw(); renderPP();
  toast('✅ 积分已从 ' + old + ' 调整为 ' + v + ' 分');
}

/* ========== N. 家长面板 ========== */
function openParentPanel() {
  document.getElementById('normalUI').style.display = 'none';
  document.getElementById('parentPanel').classList.add('show');
  renderPP();
}
function closeParentPanel() {
  document.getElementById('parentPanel').classList.remove('show');
  document.getElementById('normalUI').style.display = '';
  updHome(); renderPend(); renderLog();
}
function renderPP() {
  chkWeek();
  document.getElementById('ppPendCount').textContent = D.pend.length;
  var el = document.getElementById('ppPendList');
  var em = document.getElementById('ppPendEmpty');
  if (!D.pend.length) { el.innerHTML=''; em.style.display='block'; }
  else {
    em.style.display='none';
    el.innerHTML = '';
    for (var pi = 0; pi < D.pend.length; pi++) {
      (function(i){
        var div = document.createElement('div');
        div.className = 'pend-item';
        div.style.marginBottom = '8px';
        var label = i.q && i.q>1 ? esc(i.n) + ' ×' + i.q : esc(i.n);
        div.innerHTML =
          '<div><div class="pn">' + label + '</div><div class="pt">' + i.t + '</div></div>' +
          '<div style="display:flex;align-items:center;gap:8px;">' +
          '<span class="pb">+' + (i.p * (i.q||1)) + '分</span>' +
          '<button class="pa-ok" onclick="ppConfirm(\'' + i.id + '\')">✅ 确认</button>' +
          '<button class="pa-no" onclick="ppReject(\'' + i.id + '\')">❌</button>' +
          '</div>';
        el.appendChild(div);
      })(D.pend[pi]);
    }
  }
  document.getElementById('ppWkCount').textContent = D.wkCount;

  var rl = document.getElementById('ppRewardList');
  rl.innerHTML = '';
  if (!D.rewards.length) {
    rl.innerHTML = '<div style="font-size:13px;color:#999;">暂无自定义奖励</div>';
  } else {
    for (var ri = 0; ri < D.rewards.length; ri++) {
      (function(r, idx) {
        var div = document.createElement('div');
        div.className = 'pp-reward-item';
        div.innerHTML =
          '<div><span style="font-size:16px;">' + esc(r.e) + '</span> ' +
          '<span class="pp-rn">' + esc(r.n) + '</span> ' +
          '<span class="pp-rc">' + r.c + '分</span></div>' +
          '<button onclick="ppDelReward(\'' + r.id + '\')">删除</button>';
        rl.appendChild(div);
      })(D.rewards[ri], ri);
    }
  }
  renderPPTasks();
  renderPPStreaks();
}

function renderPPTasks() {
  var el = document.getElementById('ppTaskList');
  if (!el) return;
  el.innerHTML = '';
  if (!D.tasks.length) { el.innerHTML = '<div style="font-size:13px;color:#999;">暂无任务</div>'; return; }
  for (var ti = 0; ti < D.tasks.length; ti++) {
    (function(t, idx) {
      var div = document.createElement('div');
      div.className = 'pp-task-item';
      var catLabel = t.cat === 'focus' ? '专注力' : '卫生习惯';
      div.innerHTML =
        '<div>' +
        '<span style="font-size:16px;">' + esc(t.e) + '</span> ' +
        '<span class="pp-tn">' + esc(t.n) + '</span> ' +
        '<span class="pp-tc">+' + t.p + '分</span> ' +
        '<span class="pp-tcat">（：' + catLabel + '）</span>' +
        '</div>' +
        '<button onclick="delTask(' + idx + ')">删除</button>';
      el.appendChild(div);
    })(D.tasks[ti], ti);
  }
}

function renderPPStreaks() {
  var el = document.getElementById('ppStreakList');
  if (!el || !D.tasks.length) { if(el) el.innerHTML = '<div style="font-size:13px;color:#999;">暂无可管理任务</div>'; return; }
  el.innerHTML = '';
  D.streaks = D.streaks || {};
  for (var si = 0; si < D.tasks.length; si++) {
    (function(t, idx) {
      var active = !!D.streaks[t.n];
      var div = document.createElement('div');
      div.className = 'pp-task-item';
      div.innerHTML =
        '<div>' +
        '<span style="font-size:16px;">' + esc(t.e) + '</span> ' +
        '<span class="pp-tn">' + esc(t.n) + '</span>' +
        '</div>' +
        '<button data-task-idx="' + idx + '" class="js-toggle-streak" style="background:' + (active ? '#06D6A0' : '#CCC') + ';color:' + (active ? '#FFF' : '#666') + ';border:none;border-radius:8px;padding:4px 12px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;">' + (active ? 'ON' : 'OFF') + '</button>';
      el.appendChild(div);
    })(D.tasks[si], si);
  }
}

function toggleStreakByIndex(idx, btn) {
  var t = D.tasks[idx];
  if (!t) return;
  D.streaks = D.streaks || {};
  if (D.streaks[t.n]) {
    delete D.streaks[t.n];
    if (btn) { btn.textContent = 'OFF'; btn.style.background = '#CCC'; btn.style.color = '#666'; }
  } else {
    D.streaks[t.n] = { count:0, lastDate:'', doneToday:'', bonuses:{} };
    if (btn) { btn.textContent = 'ON'; btn.style.background = '#06D6A0'; btn.style.color = '#FFF'; }
  }
  sv(); renderStreaks();
  toast('连击设置已更新');
}

function ppConfirm(id) { doConfirmPend(id); renderPP(); }
function ppReject(id) { D.pend = D.pend.filter(function(x){return x.id!==id;}); sv(); renderPP(); updHome(); }

function resetWeek() {
  D.wkCount = 0; D.wkBonusGiven = false; D.wkReset = wkStart();
  D.wkGoalLastWeek = '';
  sv(); renderPP(); updHome();
  toast('本周计数已重置 🔄');
}

function resetStreak(name) {
  if (!confirm('确定重置「' + name + '」连击吗？连续天数将归零。')) return;
  if (D.streaks && D.streaks[name]) {
    D.streaks[name] = { count:0, lastDate:'', doneToday:'', bonuses:{} };
  }
  sv(); renderPP(); updHome();
  toast(name + ' 连击已重置');
}

function setWkCount() {
  var v = parseInt(document.getElementById('ppWkInput').value);
  if (isNaN(v) || v < 0) { toast('请输入有效的数字 ❌'); return; }
  var old = D.wkCount;
  D.wkCount = v;
  document.getElementById('ppWkInput').value = '';
  sv(); renderPP(); updHome();
  toast('✅ 番茄钟已从 ' + old + ' 调整为 ' + v + ' 个');
}

function undoWeekBonus() {
  if (!D.wkBonusGiven) { toast('本周还没有发放过周奖励'); return; }
  D.score -= 20;
  D.wkBonusGiven = false;
  if (D.wkGoalStreak > 0) D.wkGoalStreak--;
  D.wkGoalLastWeek = '';
  sv(); renderPP(); updHome();
  toast('🔄 已撤销周奖励，-20分，可重新达标触发');
}

function ppDelReward(id) {
  for (var ri = 0; ri < D.rewards.length; ri++) {
    if (D.rewards[ri].id === id) { D.rewards.splice(ri, 1); break; }
  }
  sv(); renderPP(); renderRewards(); toast('奖励已删除');
}

/* ========== O. 任务管理 ========== */
function addTask() {
  var n = document.getElementById('newTName').value.trim();
  var p = parseInt(document.getElementById('newTPts').value);
  var cat = document.getElementById('newTCat').value;
  if (!n || !p || p <= 0) { toast('请填写任务名称和积分 ❌'); return; }
  var emFocus = ['🍅','📖','📘','⚽','🏀','🎯','🧠','✏️','🎸','🎨'];
  var emHyg  = ['🏋️','🫶','📨','📝','📚','🫗','🫑','🫋','🚿','🌱'];
  var emPool = cat === 'focus' ? emFocus : emHyg;
  var usedEm = [];
  for (var ui = 0; ui < D.tasks.length; ui++) usedEm.push(D.tasks[ui].e);
  var avail = emPool.filter(function(e){return usedEm.indexOf(e)<0;});
  var e = avail.length ? avail[Math.floor(Math.random()*avail.length)] : emPool[Math.floor(Math.random()*emPool.length)];
  D.tasks.push({ n:n, p:p, e:e, cat:cat });
  sv();
  document.getElementById('newTName').value = '';
  document.getElementById('newTPts').value = '';
  renderPPTasks(); renderTasks(); renderPPStreaks(); renderStreaks();
  toast('任务已添加 ✅');
}

function delTask(i) {
  var t = D.tasks[i]; if (!t) return;
  if (!confirm('确定删除任务「' + t.n + '」吗？')) return;
  if (D.streaks && D.streaks[t.n]) delete D.streaks[t.n];
  D.tasks.splice(i, 1);
  sv();
  renderPPTasks(); renderTasks(); renderPPStreaks(); renderStreaks();
  toast('任务已删除');
}

function resetAll() {
  if (!confirm('确定要重置所有数据吗？此操作不可恢复！')) return;
  D = df(); sv(); renderPP(); updHome(); toast('所有数据已重置');
}

/* ========== P. 密码修改 ========== */
function openChgPwd() {
  var old = prompt('请输入新密码（4位数字）：');
  if (old && /^\d{4}$/.test(old)) { D.pwd = old; sv(); alert('密码已修改！'); }
  else if (old !== null) alert('请输入4位数字密码！');
}

/* ========== Q. 日志与图表 ========== */
function renderLog() {
  try {
    var el = document.getElementById('logList');
    if (!el) return;
    var logs = D.logs;
    if (!Array.isArray(logs)) logs = [];
    if (!logs.length) {
      el.innerHTML = '<div class="empty"><div class="eico">📜</div>还没有积分记录哦<br><span style="font-size:12px;color:#bbb;">完成任务并经家长确认后，记录会显示在这里</span></div>';
      return;
    }
    try { renderChart(); } catch(e) { console.error('Chart error:', e); }
    el.innerHTML = '';
    for (var li = 0; li < logs.length; li++) {
      (function(l) {
        var div = document.createElement('div');
        div.className = 'log-item slide';
        var dotColor = l.type === 'earn' ? 'var(--green)' : 'var(--pink)';
        var cls = l.type === 'redeem' ? 'minus' : 'plus';
        var sign = l.type === 'earn' ? '+' : '-';
        div.innerHTML =
          '<div class="log-dot" style="background:' + dotColor + ';"></div>' +
          '<div style="flex:1;"><div class="log-name">' + esc(l.n) + '</div><div class="log-time">' + l.t + '</div></div>' +
          '<div class="log-pts ' + cls + '">' + sign + l.p + '分</div>';
        el.appendChild(div);
      })(logs[li]);
    }
  } catch(e) {
    var el2 = document.getElementById('logList');
    if (el2) el2.innerHTML = '<div class="empty"><div class="eico">⚠️</div>记录加载出错：' + e.message + '</div>';
  }
}

function renderChart() {
  var canvas = document.getElementById('scoreChart');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  if (typeof Chart === 'undefined') { showChartEmpty(canvas, '📊 图表加载中...'); return; }

  var logsCopy = (D.logs || []).slice().reverse();
  var netFromLogs = 0;
  for (var ci = 0; ci < logsCopy.length; ci++) {
    var l = logsCopy[ci];
    netFromLogs += (l.type === 'earn' ? l.p : -l.p);
  }
  var baseScore = (parseInt(D.score) || 0) - netFromLogs;

  var daily = {};
  for (var ci = 0; ci < logsCopy.length; ci++) {
    var l = logsCopy[ci];
    var dKey = l.t.split(' ')[0];
    if (!daily[dKey]) daily[dKey] = { e:0, r:0 };
    if (l.type==='earn') daily[dKey].e += l.p; else daily[dKey].r += l.p;
  }

  var lbs = [], dts = [];
  lbs.push('起始'); dts.push(baseScore);
  var tot = baseScore;
  var keys = Object.keys(daily).sort();
  for (var ki = 0; ki < keys.length; ki++) {
    var k = keys[ki];
    tot += daily[k].e - daily[k].r;
    lbs.push(k.slice(5)); dts.push(tot);
  }

  var oldEmpty = canvas.parentNode.querySelector('.chart-empty');
  if (oldEmpty) oldEmpty.remove();
  canvas.style.display = '';
  if (window._sc) window._sc.destroy();
  window._sc = new Chart(ctx, {
    type:'line',
    data:{ labels: lbs, datasets:[{ data: dts,
      borderColor:'#FF6B35', backgroundColor:'rgba(255,107,53,0.08)',
      fill:true, tension:0.35, pointBackgroundColor:'#FF6B35',
      pointRadius:3, borderWidth:2.5 }]
    },
    options:{ responsive:true, plugins:{ legend:{ display:false } },
      scales:{ y:{ beginAtZero:false, grid:{color:'#F2F2F2'} }, x:{ grid:{display:false} } }
    }
  });
}

function showChartEmpty(canvas, msgHtml) {
  canvas.style.display = 'none';
  var box = canvas.parentNode;
  var oldEmpty = box.querySelector('.chart-empty');
  if (oldEmpty) oldEmpty.remove();
  var msg = document.createElement('div');
  msg.className = 'chart-empty';
  msg.style.cssText = 'text-align:center;padding:50px 20px;color:#999;font-size:13px;line-height:1.8;';
  msg.innerHTML = msgHtml;
  box.appendChild(msg);
}

/* ========== R. 奖励系统 ========== */
function renderRewards() {
  try { updHome(); } catch(e) {}
  var el = document.getElementById('rewardGrid');
  if (!el) return;
  el.innerHTML = '';
  if (!D.rewards || !D.rewards.length) {
    el.innerHTML = '<div class="empty"><div class="eicon">🎁</div>暂无奖励，去家长面板添加吧！</div>';
    return;
  }
  var currentScore = parseInt(D.score) || 0;
  for (var ri = 0; ri < D.rewards.length; ri++) {
    (function(r) {
      var cost = parseInt(r.c) || 0;
      var ok = currentScore >= cost;
      var card = document.createElement('div');
      card.className = 'rw-card slide' + (ok ? ' ok' : '');
      card.innerHTML =
        '<div class="rico">' + esc(r.e) + '</div>' +
        '<div class="rnm">' + esc(r.n) + '</div>' +
        '<div class="rcost">' + cost + ' 积分</div>' +
        '<button class="rb-ok" ' + (ok?'':'disabled') + ' onclick="startRedeem(\'' + r.id + '\')">' +
        (ok?'兑换 🎉':'积分不足') + '</button>';
      el.appendChild(card);
    })(D.rewards[ri]);
  }
}

function addReward() {
  var n = document.getElementById('newRName').value.trim();
  var c = parseInt(document.getElementById('newRCost').value);
  if (!n||!c||c<=0) { toast('请填写完整 ❌'); return; }
  var em = ['🎁','🎈','🍦','🦁','🎯','🏇','⭐','🪪','🅅','🦄'];
  D.rewards.push({ id: uid(), n:n, c:c, e: em[Math.floor(Math.random()*em.length)] });
  sv();
  document.getElementById('newRName').value='';
  document.getElementById('newRCost').value='';
  renderRewards();
  toast('奖励已添加 ✅');
}

var redeemId = null;
function startRedeem(id) { redeemId = id; showPwd('redeem'); }
function openRedeemMo() {
  var r = findReward(redeemId);
  if (!r) return;
  document.getElementById('redeemHint').innerHTML =
    '确定用 <b style="color:var(--pink)">' + r.c + '积分</b> 兑换「<b>' + r.n + '</b>」吗？<br><span style="font-size:12px;color:#999;">需要家长确认</span>';
  document.getElementById('redeemMo').classList.add('show');
}
function closeRedeemMo() { document.getElementById('redeemMo').classList.remove('show'); }
function doRedeem() {
  var r = findReward(redeemId);
  if (!r) return;
  if (D.score < r.c) { toast('积分不足 ❌'); closeRedeemMo(); return; }
  D.score -= r.c;
  if(!Array.isArray(D.logs))D.logs=[];
  D.logs.unshift({ type:'redeem', n:'🎁 ' + r.n, p:r.c, t:new Date().toLocaleString('zh-CN') });
  sv(); closeRedeemMo(); renderRewards(); updHome(); fw();
  toast('兑换成功 🎉');
}
function findReward(id) {
  for (var ri = 0; ri < D.rewards.length; ri++) {
    if (D.rewards[ri].id === id) return D.rewards[ri];
  }
  return null;
}

/* ========== S. 导出/导入 ========== */
function exportData() {
  var blob = new Blob([JSON.stringify(D, null, 2)], {type:'application/json'});
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  var now = new Date();
  a.download = '积分星球_备份_' + now.getFullYear() + ('0'+(now.getMonth()+1)).slice(-2) + ('0'+now.getDate()).slice(-2) + '_' + ('0'+now.getHours()).slice(-2) + ('0'+now.getMinutes()).slice(-2) + '.json';
  a.click();
  URL.revokeObjectURL(a.href);
  toast('📤 数据已导出，发送文件到另一台设备即可导入');
}

function importData(input) {
  var file = input.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var nd = JSON.parse(e.target.result);
      if (typeof nd.score !== 'number' || !nd.tasks) { toast('❌ 文件格式不正确'); return; }
      D.score = nd.score;
      D.logs = nd.logs || [];
      D.pend = nd.pend || [];
      D.tasks = nd.tasks || df().tasks;
      D.rewards = nd.rewards || df().rewards;
      // 给导入的奖励补 id
      for (var ri = 0; ri < D.rewards.length; ri++) {
        if (!D.rewards[ri].id) D.rewards[ri].id = uid();
      }
      D.wkCount = nd.wkCount || 0;
      D.wkBonusGiven = nd.wkBonusGiven || false;
      D.baseGiven = typeof nd.baseGiven !== 'undefined' ? nd.baseGiven : D.baseGiven;
      if (nd.pwd) D.pwd = nd.pwd;
      sv();
      updHome(); renderPend(); renderPP();
      toast('✅ 数据导入成功！当前积分：' + D.score + '分');
    } catch(err) { toast('❌ 文件解析失败'); console.error(err); }
  };
  reader.readAsText(file);
  input.value = '';
}

/* ========== T. 烟花与Toast ========== */
function fw() {
  var c = document.createElement('canvas');
  c.className = 'fw-canvas'; c.width = innerWidth; c.height = innerHeight;
  document.body.appendChild(c);
  var X = c.getContext('2d'), pts = [], cols = ['#FF6B35','#FFD166','#06D6A0','#EF476F','#9B5DE5','#118AB2'];
  for(var i=0;i<35;i++) pts.push({
    x: innerWidth/2+(Math.random()-.5)*80, y: innerHeight/2+(Math.random()-.5)*80,
    vx:(Math.random()-.5)*7, vy:(Math.random()-.5)*7-1.5,
    col: cols[Math.floor(Math.random()*cols.length)], life:55, sz: Math.random()*3.5+1.5,
  });
  var f=0; (function ani(){
    X.clearRect(0,0,c.width,c.height); var a=0;
    for(var pi=0;pi<pts.length;pi++){
      var p=pts[pi]; if(p.life--<=0) continue; a=1; p.x+=p.vx; p.y+=p.vy; p.vy+=0.09;
      X.beginPath(); X.arc(p.x,p.y,p.sz*(p.life/55),0,Math.PI*2);
      X.fillStyle=p.col; X.globalAlpha=p.life/55; X.fill();
    } X.globalAlpha=1;
    if(a&&f<100) { f++; requestAnimationFrame(ani); } else c.remove();
  })();
}

function toast(msg) {
  var t = document.createElement('div'); t.className='toast'; t.textContent=msg;
  document.body.appendChild(t);
  setTimeout(function(){ t.style.opacity='0'; t.style.transition='opacity 0.3s'; }, 1800);
  setTimeout(function(){ t.remove(); }, 2200);
}

// 事件委托：连击开关按钮（绕过 onclick 拼接，直接用 data 属性传索引）
document.addEventListener('click', function(e) {
  var btn = e.target;
  if (!btn.classList.contains('js-toggle-streak')) return;
  var idx = parseInt(btn.getAttribute('data-task-idx'));
  if (isNaN(idx)) return;
  toggleStreakByIndex(idx, btn);
});

/* ========== U. 初始化（各模块独立 try-catch） ========== */
(function init() {
  try { updHome(); } catch(e) { console.error('updHome error:', e); }
  try { renderPend(); } catch(e) { console.error('renderPend error:', e); }
  try { renderRewards(); } catch(e) { console.error('renderRewards error:', e); }
  try { renderLog(); } catch(e) { console.error('renderLog error:', e); }
})();
