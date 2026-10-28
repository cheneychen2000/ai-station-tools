/* AI 认知段位测试 V1 · 二元对错 + 即时解析 + 六维雷达 + 九段制（纯 CSR，零外部请求） */
(function () {
  var POSTER_URL = 'https://www.reflex-hub.com/quiz/?utm_source=poster';
  var DIMS = [
    { key: 'concept', label: '概念' },
    { key: 'price', label: '价格' },
    { key: 'boundary', label: '边界' },
    { key: 'industry', label: '格局' },
    { key: 'practice', label: '实操' },
    { key: 'safety', label: '安全' }
  ];
  var TIERS = [
    { min: 12, name: '职业九段', comment: '十二题全对——出题人看了都点头。' },
    { min: 11, name: '职业三段', comment: '这题库已经不太够你玩的了。' },
    { min: 10, name: '职业初段', comment: '认知超过九成读者，可以教同事了。' },
    { min: 9, name: '业余五段', comment: '工作流里已经有它的工位。' },
    { min: 8, name: '业余四段', comment: '价格、边界门儿清，AI 骗不到你。' },
    { min: 6, name: '业余三段', comment: 'Prompt 写得有模有样，基本盘稳了。' },
    { min: 4, name: '业余二段', comment: '知道它聪明在哪，也知道它哪不行。' },
    { min: 2, name: '业余初段', comment: '会用 AI 搜东西了，第一步已经迈出。' },
    { min: 0, name: '门外汉', comment: 'AI 门外的风有点大，进来坐坐。' }
  ];
  var WEAK_LINKS = {
    price: { href: '../cost/', text: '去成本计算器补补课 →' },
    industry: { href: '../models/', text: '去模型库补补课 →' },
    practice: { href: '../prompts/', text: '去 Prompt 库补补课 →' },
    concept: { href: '../about/', text: '阅读数据与方法说明 →' },
    boundary: { href: '../about/', text: '阅读数据与方法说明 →' },
    safety: { href: '../about/', text: '阅读数据与方法说明 →' }
  };

  function tierOf(score) {
    for (var i = 0; i < TIERS.length; i++) if (score >= TIERS[i].min) return TIERS[i];
    return TIERS[TIERS.length - 1];
  }

  /* 击败百分比：预置正态模型（均值 7 题、标准差 2.2），接入真实数据前页面须注明估算口径 */
  function percentile(score) {
    var z = (score - 7) / 2.2;
    var t = 1 / (1 + 0.2316419 * Math.abs(z));
    var d = 0.3989423 * Math.exp(-z * z / 2);
    var p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.3302744))));
    var cdf = z > 0 ? 1 - p : p;
    return Math.min(99, Math.max(1, Math.round(cdf * 100)));
  }

  var bank = [];
  var questions = [];
  var idx = 0, score = 0, locked = false;
  var dimScore = {};
  var $ = function (id) { return document.getElementById(id); };
  var VIEWS = ['viewIntro', 'viewQuiz', 'viewResult', 'viewPoster'];
  function show(id) {
    VIEWS.forEach(function (v) { $(v).style.display = v === id ? '' : 'none'; });
    window.scrollTo(0, 0);
  }
  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
  }
  /* 题目顺序随机，且同维度不相邻 */
  function orderQuestions() {
    var arr = bank.slice();
    for (var attempt = 0; attempt < 200; attempt++) {
      shuffle(arr);
      var ok = true;
      for (var i = 1; i < arr.length; i++) {
        if (arr[i].dim === arr[i - 1].dim) { ok = false; break; }
      }
      if (ok) return arr;
    }
    return arr;
  }

  /* ---------- 答题（即时反馈） ---------- */
  function renderQuestion() {
    locked = false;
    var q = questions[idx];
    $('qProg').textContent = '第 ' + (idx + 1) + ' / ' + questions.length + ' 题';
    $('qBar').style.width = (idx / questions.length * 100) + '%';
    $('qText').textContent = q.q;
    var box = $('qOpts');
    box.innerHTML = '';
    $('qFeedback').style.display = 'none';
    /* 判断题（2 选项）保持「真」在前不洗牌；4 选项题数据层已打散，这里再会话级洗牌 */
    var order = q.options.map(function (_, i) { return i; });
    if (order.length > 2) shuffle(order);
    order.forEach(function (optIdx) {
      var btn = document.createElement('button');
      btn.className = 'opt-btn';
      btn.type = 'button';
      btn.textContent = q.options[optIdx];
      btn.addEventListener('click', function () { pick(q, optIdx, btn); });
      box.appendChild(btn);
    });
  }

  function pick(q, optIdx, btn) {
    if (locked) return;
    locked = true;
    var correct = optIdx === q.answer;
    if (correct) {
      score++;
      dimScore[q.dim]++;
    }
    var btns = $('qOpts').children;
    for (var i = 0; i < btns.length; i++) {
      btns[i].disabled = true;
      if (questions[idx].options.indexOf(btns[i].textContent) === q.answer) btns[i].classList.add('opt-correct');
    }
    if (!correct) btn.classList.add('opt-wrong');
    $('qBar').style.width = ((idx + 1) / questions.length * 100) + '%';
    var fb = $('qFeedback');
    fb.className = 'quiz-fb ' + (correct ? 'ok' : 'no');
    fb.innerHTML =
      '<p class="fb-title">' + (correct ? '回答正确' : '回答错误') + '</p>' +
      '<p>' + q.explain + '</p>' +
      '<button class="btn btn-primary" type="button" id="btnNext">' +
      (idx + 1 < questions.length ? '下一题' : '查看结果') + '</button>';
    fb.style.display = '';
    $('btnNext').addEventListener('click', function () {
      idx++;
      if (idx < questions.length) renderQuestion();
      else finish();
    });
    window.track('quiz_answer', { no: idx + 1, dim: q.dim, correct: correct });
  }

  function start() {
    questions = orderQuestions();
    idx = 0;
    score = 0;
    DIMS.forEach(function (d) { dimScore[d.key] = 0; });
    window.track('quiz_start');
    show('viewQuiz');
    renderQuestion();
  }

  /* ---------- 六维雷达图 ---------- */
  function drawRadar(canvas) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = 300, H = 264;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    var c = canvas.getContext('2d');
    c.scale(dpr, dpr);
    var cx = W / 2, cy = H / 2 + 4, R = 84;
    function pt(i, r) {
      var a = -Math.PI / 2 + i * Math.PI / 3;
      return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
    }
    /* 网格：2 圈（=1/2 与 2/2）+ 轴线 */
    c.strokeStyle = '#E2E7F0';
    c.lineWidth = 1;
    [0.5, 1].forEach(function (k) {
      c.beginPath();
      for (var i = 0; i <= 6; i++) {
        var p = pt(i % 6, R * k);
        i === 0 ? c.moveTo(p[0], p[1]) : c.lineTo(p[0], p[1]);
      }
      c.stroke();
    });
    c.beginPath();
    for (var i = 0; i < 6; i++) {
      var p = pt(i, R);
      c.moveTo(cx, cy);
      c.lineTo(p[0], p[1]);
    }
    c.stroke();
    /* 得分多边形 */
    c.beginPath();
    for (var i = 0; i <= 6; i++) {
      var d = DIMS[i % 6];
      var p = pt(i % 6, R * dimScore[d.key] / 2);
      i === 0 ? c.moveTo(p[0], p[1]) : c.lineTo(p[0], p[1]);
    }
    c.fillStyle = 'rgba(31,58,138,0.16)';
    c.fill();
    c.strokeStyle = '#1F3A8A';
    c.lineWidth = 2;
    c.stroke();
    /* 顶点圆点 */
    for (var i = 0; i < 6; i++) {
      var d = DIMS[i];
      var p = pt(i, R * dimScore[d.key] / 2);
      c.beginPath();
      c.arc(p[0], p[1], 3, 0, Math.PI * 2);
      c.fillStyle = '#1F3A8A';
      c.fill();
    }
    /* 轴标签（带得分） */
    c.font = '13px "PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif';
    c.fillStyle = '#5C6575';
    c.textAlign = 'center';
    for (var i = 0; i < 6; i++) {
      var d = DIMS[i];
      var p = pt(i, R + 20);
      c.fillText(d.label + ' ' + dimScore[d.key] + '/2', p[0], p[1] + 4);
    }
  }

  function finish() {
    var tier = tierOf(score);
    var pct = percentile(score);
    $('rTier').textContent = tier.name;
    $('rComment').textContent = tier.comment;
    $('rScore').textContent = '答对 ' + score + ' / ' + questions.length + ' 题';
    $('rPercent').textContent = '超过 ' + pct + '% 的读者（基于预置统计模型估算）';
    drawRadar($('rRadar'));
    /* 最弱维度（并列时按维度顺序取先）只挂 1 个补课链接 */
    var weak = DIMS[0];
    DIMS.forEach(function (d) { if (dimScore[d.key] < dimScore[weak.key]) weak = d; });
    var link = WEAK_LINKS[weak.key];
    var wa = $('rWeak');
    wa.href = link.href;
    wa.textContent = link.text;
    wa.style.display = dimScore[weak.key] < 2 ? '' : 'none';
    window.track('quiz_complete', { score: score, tier: tier.name });
    show('viewResult');
  }

  function shareText() {
    return '我的 AI 认知是「' + tierOf(score).name + '」，超过 ' + percentile(score) +
      '% 的读者，不服来战 → reflex-hub.com/quiz';
  }
  function copyShare(btn) {
    var text = shareText();
    function done() {
      btn.textContent = '已复制，去粘贴吧';
      setTimeout(function () { btn.textContent = '复制战绩文案'; }, 1600);
    }
    function legacy() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { btn.textContent = '复制失败，请长按截图'; }
      document.body.removeChild(ta);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, legacy);
    } else legacy();
    window.track('quiz_copy', { tier: tierOf(score).name });
  }

  /* ---------- 海报 ---------- */
  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  /* 手绘五角星（替代 emoji，跨设备渲染一致） */
  function drawStar(c, cx, cy, r, color) {
    c.fillStyle = color;
    c.beginPath();
    for (var i = 0; i < 5; i++) {
      var a1 = -Math.PI / 2 + i * (Math.PI * 2 / 5);
      var a2 = a1 + Math.PI / 5;
      c.lineTo(cx + Math.cos(a1) * r, cy + Math.sin(a1) * r);
      c.lineTo(cx + Math.cos(a2) * r * 0.45, cy + Math.sin(a2) * r * 0.45);
    }
    c.closePath();
    c.fill();
  }

  /* 手绘奖章：双色绶带 + 金圆牌 + 星 */
  function drawMedal(c, cx, topY) {
    c.fillStyle = '#1F3A8A';
    c.beginPath();
    c.moveTo(cx - 26, topY); c.lineTo(cx - 6, topY); c.lineTo(cx + 2, topY + 62); c.lineTo(cx - 18, topY + 62);
    c.closePath(); c.fill();
    c.fillStyle = '#3D5BB5';
    c.beginPath();
    c.moveTo(cx + 26, topY); c.lineTo(cx + 6, topY); c.lineTo(cx - 2, topY + 62); c.lineTo(cx + 18, topY + 62);
    c.closePath(); c.fill();
    var cy = topY + 84;
    c.fillStyle = '#E8B93E';
    c.beginPath(); c.arc(cx, cy, 30, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#C89A1F';
    c.lineWidth = 4;
    c.beginPath(); c.arc(cx, cy, 30, 0, Math.PI * 2); c.stroke();
    drawStar(c, cx, cy, 13, '#FFFFFF');
  }

  function drawPoster(tier) {
    var cv = document.createElement('canvas');
    cv.width = 750;
    cv.height = 1334;
    var c = cv.getContext('2d');
    var FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif';

    c.fillStyle = '#F5F7FC';
    c.fillRect(0, 0, 750, 1334);
    c.fillStyle = '#1F3A8A';
    c.fillRect(0, 0, 750, 200);
    c.textAlign = 'center';
    c.fillStyle = '#FFFFFF';
    c.font = 'bold 44px ' + FONT;
    c.fillText('Reflex Hub', 375, 86);
    c.fillStyle = 'rgba(255,255,255,0.9)';
    c.font = '26px ' + FONT;
    c.fillText('AI 认知段位测试', 375, 132);
    c.fillStyle = 'rgba(255,255,255,0.65)';
    c.font = '18px ' + FONT;
    c.fillText('12 题 · 六维认知 · 每题即时解析', 375, 168);

    roundRect(c, 45, 240, 660, 1010, 20);
    c.fillStyle = '#FFFFFF';
    c.fill();

    drawMedal(c, 375, 272);
    c.fillStyle = '#1F3A8A';
    c.font = 'bold 54px ' + FONT;
    c.fillText(tier.name, 375, 470);
    c.fillStyle = '#1B2437';
    c.font = 'bold 32px ' + FONT;
    c.fillText('答对 ' + score + ' / ' + questions.length + ' 题', 375, 528);
    c.fillStyle = '#5C6575';
    c.font = '24px ' + FONT;
    c.fillText('超过 ' + percentile(score) + '% 的读者', 375, 576);
    c.font = '23px ' + FONT;
    c.fillText(tier.comment, 375, 622);
    var d = new Date();
    var dateStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    c.font = '20px ' + FONT;
    c.fillText(dateStr, 375, 658);

    var qr = window.QRMini.encode(POSTER_URL);
    var cell = 8, qs = qr.size * cell;
    var qx = (750 - qs) / 2, qy = 692;
    c.fillStyle = '#FFFFFF';
    c.fillRect(qx - 14, qy - 14, qs + 28, qs + 28);
    c.strokeStyle = '#E2E7F0';
    c.lineWidth = 2;
    c.strokeRect(qx - 14, qy - 14, qs + 28, qs + 28);
    c.fillStyle = '#000000';
    for (var y = 0; y < qr.size; y++) {
      for (var x = 0; x < qr.size; x++) {
        if (qr.get(x, y)) c.fillRect(qx + x * cell, qy + y * cell, cell, cell);
      }
    }

    c.fillStyle = '#1B2437';
    c.font = '22px ' + FONT;
    c.fillText('扫码测测你的段位', 375, 1012);
    /* 六维得分两行小结（卡片底 1250） */
    c.fillStyle = '#5C6575';
    c.font = '20px ' + FONT;
    var line1 = [], line2 = [];
    DIMS.forEach(function (dm, i) {
      (i < 3 ? line1 : line2).push(dm.label + ' ' + dimScore[dm.key] + '/2');
    });
    c.fillText(line1.join(' · '), 375, 1082);
    c.fillText(line2.join(' · '), 375, 1120);
    c.fillStyle = '#98A1AF';
    c.font = '18px ' + FONT;
    c.fillText('本测试仅供娱乐', 375, 1300);
    return cv.toDataURL('image/png');
  }

  /* ---------- 启动 ---------- */
  fetch('../assets/data/quiz.json').then(function (res) { return res.json(); }).then(function (data) {
    bank = data;
    var btn = $('btnStart');
    btn.disabled = false;
    btn.textContent = '开始测试';
    btn.addEventListener('click', start);
    $('btnRestart').addEventListener('click', start);
    $('btnPoster').addEventListener('click', function () {
      var tier = tierOf(score);
      $('posterImg').src = drawPoster(tier);
      window.track('quiz_poster', { tier: tier.name });
      show('viewPoster');
    });
    $('btnCopy').addEventListener('click', function () { copyShare($('btnCopy')); });
    $('btnBack').addEventListener('click', function () { show('viewResult'); });
  }).catch(function () {
    var btn = $('btnStart');
    btn.textContent = '题目加载失败，请刷新重试';
  });
})();
