/* 零依赖微型 QR 生成器：byte mode + 容错 M + mask 0，固定 Version 4（ASCII 载荷 ≤62 字节）
   算法遵循 ISO/IEC 18004 编码流程（GF(256) Reed-Solomon + 标准矩阵布线） */
(function (g) {
  var EXP = new Uint8Array(512), LOG = new Uint8Array(256);
  (function () {
    var x = 1;
    for (var i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11D; }
    for (var j = 255; j < 512; j++) EXP[j] = EXP[j - 255];
  })();
  function mul(a, b) { return (a !== 0 && b !== 0) ? EXP[LOG[a] + LOG[b]] : 0; }

  /* 生成多项式：系数从高次到低次存储（省略首项 1），逐步乘上 (x - 2^i) */
  function rsDivisor(deg) {
    var res = [];
    for (var i = 0; i < deg - 1; i++) res.push(0);
    res.push(1);
    var root = 1;
    for (var k = 0; k < deg; k++) {
      for (var j = 0; j < res.length; j++) {
        res[j] = mul(res[j], root);
        if (j + 1 < res.length) res[j] ^= res[j + 1];
      }
      root = mul(root, 2);
    }
    return res;
  }
  function rsRemainder(data, div) {
    var res = div.map(function () { return 0; });
    data.forEach(function (b) {
      var factor = b ^ res.shift();
      res.push(0);
      div.forEach(function (c, i) { res[i] ^= mul(c, factor); });
    });
    return res;
  }

  /* Version 4-M 固定参数：33×33，总码字 100 = 2 块 ×（32 数据 + 18 纠错） */
  var SIZE = 33, DATA_CW = 64, ECC_LEN = 18, NUM_BLOCKS = 2, ALIGN = [6, 26];

  function encode(text) {
    var bytes = [];
    for (var i = 0; i < text.length; i++) {
      var ch = text.charCodeAt(i);
      if (ch > 0x7F) throw new Error('QRMini: only ASCII supported');
      bytes.push(ch);
    }

    /* 位流：模式 0100 + 长度(8bit) + 数据 + 终止符 + 填充 */
    var bits = [];
    function push(val, len) { for (var i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); }
    push(4, 4);
    push(bytes.length, 8);
    bytes.forEach(function (b) { push(b, 8); });
    var capBits = DATA_CW * 8;
    if (bits.length > capBits) throw new Error('QRMini: payload too long');
    push(0, Math.min(4, capBits - bits.length));
    while (bits.length % 8 !== 0) bits.push(0);
    var data = [];
    for (var k = 0; k < bits.length; k += 8) {
      var b = 0;
      for (var j = 0; j < 8; j++) b = (b << 1) | bits[k + j];
      data.push(b);
    }
    for (var pad = 0xEC; data.length < DATA_CW; pad ^= 0xEC ^ 0x11) data.push(pad);

    /* 分块纠错 + 交错 */
    var perBlock = DATA_CW / NUM_BLOCKS;
    var div = rsDivisor(ECC_LEN);
    var blocks = [];
    for (var blk = 0; blk < NUM_BLOCKS; blk++) {
      var d = data.slice(blk * perBlock, (blk + 1) * perBlock);
      blocks.push({ d: d, e: rsRemainder(d, div) });
    }
    var cw = [];
    for (var t = 0; t < perBlock; t++) for (var b1 = 0; b1 < NUM_BLOCKS; b1++) cw.push(blocks[b1].d[t]);
    for (var t2 = 0; t2 < ECC_LEN; t2++) for (var b2 = 0; b2 < NUM_BLOCKS; b2++) cw.push(blocks[b2].e[t2]);

    /* 功能图形 */
    var mod = [], fn = [];
    for (var y = 0; y < SIZE; y++) { mod.push(new Array(SIZE).fill(false)); fn.push(new Array(SIZE).fill(false)); }
    function setFn(x, y, dark) { if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return; mod[y][x] = dark; fn[y][x] = true; }
    function finder(cx, cy) {
      for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) {
        var d = Math.max(Math.abs(dx), Math.abs(dy));
        setFn(cx + dx, cy + dy, d !== 2 && d !== 4);
      }
    }
    finder(3, 3); finder(SIZE - 4, 3); finder(3, SIZE - 4);
    for (var t3 = 0; t3 < SIZE; t3++) { setFn(6, t3, t3 % 2 === 0); setFn(t3, 6, t3 % 2 === 0); }
    ALIGN.forEach(function (ax) {
      ALIGN.forEach(function (ay) {
        if (!fn[ay][ax]) {
          for (var dy2 = -2; dy2 <= 2; dy2++) for (var dx2 = -2; dx2 <= 2; dx2++)
            setFn(ax + dx2, ay + dy2, Math.max(Math.abs(dx2), Math.abs(dy2)) !== 1);
        }
      });
    });

    /* 格式信息：必须在数据布线前写入——这些格子要标记为功能区，布线才会跳过它们。
       mask 只翻非功能区，因此一次写入即为终值。ECC M(00) + mask 0，BCH(15,5) */
    var rem = 0;
    for (var i2 = 0; i2 < 10; i2++) rem = (rem << 1) ^ (((rem >>> 9) & 1) ? 0x537 : 0);
    var fbits = ((0 << 10) | (rem & 0x3FF)) ^ 0x5412;
    function fbit(i) { return ((fbits >>> i) & 1) !== 0; }
    for (var i3 = 0; i3 <= 5; i3++) setFn(8, i3, fbit(i3));
    setFn(8, 7, fbit(6)); setFn(8, 8, fbit(7)); setFn(7, 8, fbit(8));
    for (var i4 = 9; i4 < 15; i4++) setFn(14 - i4, 8, fbit(i4));
    for (var i5 = 0; i5 < 8; i5++) setFn(SIZE - 1 - i5, 8, fbit(i5));
    for (var i6 = 8; i6 < 15; i6++) setFn(8, SIZE - 15 + i6, fbit(i6));
    setFn(8, SIZE - 8, true);

    /* 数据位布线（之字形） */
    var bitIdx = 0, totalBits = cw.length * 8;
    for (var right = SIZE - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (var vert = 0; vert < SIZE; vert++) {
        for (var j2 = 0; j2 < 2; j2++) {
          var x2 = right - j2;
          var up = ((right + 1) & 2) === 0;
          var y2 = up ? SIZE - 1 - vert : vert;
          if (!fn[y2][x2] && bitIdx < totalBits) {
            mod[y2][x2] = ((cw[bitIdx >>> 3] >>> (7 - (bitIdx & 7))) & 1) !== 0;
            bitIdx++;
          }
        }
      }
    }

    /* mask 0：(r+c)%2==0 翻转非功能区 */
    for (var y3 = 0; y3 < SIZE; y3++) for (var x3 = 0; x3 < SIZE; x3++) {
      if (!fn[y3][x3] && (x3 + y3) % 2 === 0) mod[y3][x3] = !mod[y3][x3];
    }

    return {
      size: SIZE,
      get: function (x, y) { return mod[y][x]; },
      isFunction: function (x, y) { return fn[y][x]; }
    };
  }

  g.QRMini = { encode: encode, _rsDivisor: rsDivisor, _rsRemainder: rsRemainder };
})(typeof window !== 'undefined' ? window : globalThis);
