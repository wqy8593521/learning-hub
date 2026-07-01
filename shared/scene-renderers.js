/**
 * 可视化课程场景数据 — Agent 生成时输出同结构 JSON/JS
 * 字段：short, captions[L0,L1,L2], frames, render(depth, frame) => SVG string
 */
window.CACHE_BREAKDOWN_SCENES = [
  {
    short: '热点过期',
    captions: [
      '热点 key 在缓存里，TTL 倒计时。',
      'key 被删除，GET 返回空，应用判定 miss。',
      'dict 条目消失 — 不是变旧，是不存在了。'
    ],
    frames: 2,
    render(d, f) {
      const keyOpacity = f >= 1 ? 0.15 : 1;
      return `<text x="380" y="28" text-anchor="middle" fill="#6b7280" font-size="11">Redis 内存</text>
        <rect x="200" y="40" width="360" height="110" rx="8" fill="#1a0a0a" stroke="#dc2626" stroke-width="1.5"/>
        ${d >= 2 ? `<text x="220" y="58" fill="#6b7280" font-size="9">dictEntry → redisObject { expiretime }</text>` : ''}
        <rect x="320" y="68" width="120" height="48" rx="6" fill="#2a1010" stroke="#dc2626" stroke-width="2" opacity="${keyOpacity}" class="${f >= 1 ? 'key-expired' : ''}"/>
        <text x="380" y="88" text-anchor="middle" fill="#fca5a5" font-size="12" font-weight="600">hotkey</text>
        <text x="380" y="106" text-anchor="middle" fill="#f87171" font-size="10">${f >= 1 ? 'EXPIRED' : 'TTL=3s'}</text>
        ${f >= 1 ? `<text x="380" y="140" text-anchor="middle" fill="#f87171" font-size="11" class="fade-in">GET → (nil)</text>` : ''}
        ${d >= 1 && f >= 1 ? `<text x="380" y="168" text-anchor="middle" fill="#fbbf24" font-size="10" class="fade-in">cache miss → 准备查 DB</text>` : ''}
        ${d >= 2 && f >= 1 ? `<rect x="180" y="195" width="400" height="48" rx="6" fill="#0a0a10" stroke="#a855f7"/><text x="380" y="215" text-anchor="middle" fill="#c4b5fd" font-size="9">惰性删除 → 释放内存 + dict 移除</text><text x="380" y="232" text-anchor="middle" fill="#a78bfa" font-size="9">后续 GET 全是冷启动</text>` : ''}`;
    }
  },
  {
    short: '并发击穿',
    captions: [
      '1000 请求同时到达。',
      '都 GET 到 nil，都判断 miss。',
      'check-then-act 竞态 → 1000 次 SELECT。'
    ],
    frames: 3,
    render(d, f) {
      const n = f === 0 ? 3 : f === 1 ? 8 : 12;
      let h = `<text x="80" y="28" fill="#6b7280" font-size="10">线程</text><text x="380" y="28" text-anchor="middle" fill="#6b7280" font-size="10">Redis</text><text x="660" y="28" text-anchor="end" fill="#6b7280" font-size="10">MySQL</text>
        <rect x="30" y="42" width="120" height="230" rx="6" fill="#0a1020" stroke="#3b82f6"/><rect x="310" y="42" width="140" height="230" rx="6" fill="#1a0808" stroke="#dc2626"/><text x="380" y="68" text-anchor="middle" fill="#f87171" font-size="11">hotkey → ∅</text><rect x="600" y="42" width="120" height="230" rx="6" fill="#1a1508" stroke="#d97706"/>`;
      for (let i = 0; i < Math.min(n, 6); i++) {
        const ty = 62 + i * 30;
        h += `<circle cx="90" cy="${ty}" r="7" fill="#3b82f6"/><text x="108" y="${ty + 3}" fill="#93c5fd" font-size="8">T${i + 1}</text>`;
        if (f >= 1) h += `<line x1="97" y1="${ty}" x2="310" y2="68" stroke="#3b82f6" stroke-width="1.2" opacity="0.6" class="draw-line"/><line x1="450" y1="68" x2="600" y2="${ty + 30}" stroke="#d97706" stroke-width="${f >= 2 ? 2.5 : 1}" class="draw-line"/>`;
      }
      if (f >= 1) h += `<text x="660" y="150" text-anchor="middle" fill="#fbbf24" font-size="13" font-weight="700" class="pulse">${f >= 2 ? '×1000' : '×?'}</text>`;
      if (d >= 1 && f >= 1) h += `<rect x="30" y="250" width="700" height="42" rx="4" fill="#0a0a12" stroke="#fbbf24"/><text x="380" y="268" text-anchor="middle" fill="#fde68a" font-size="9">if(cache.get()==null){db.query();} ← 非原子</text><text x="380" y="282" text-anchor="middle" fill="#fbbf24" font-size="8">check 和 act 之间线程切换</text>`;
      if (d >= 2 && f >= 2) h += `<text x="380" y="240" text-anchor="middle" fill="#a78bfa" font-size="9">连接池打满 → 慢查询 → 超时/OOM</text>`;
      return h;
    }
  },
  {
    short: '互斥锁',
    captions: [
      '多个线程竞争查库。',
      'SET NX 只有一个成功。',
      'Redis 单线程 → SET NX 天然原子。'
    ],
    frames: 3,
    render(d, f) {
      return `<rect x="30" y="42" width="120" height="210" rx="6" fill="#0a1020" stroke="#3b82f6"/><rect x="310" y="42" width="140" height="210" rx="6" fill="#1a0808" stroke="#dc2626"/><rect x="600" y="42" width="120" height="210" rx="6" fill="#1a1508" stroke="#d97706"/>
        <circle cx="90" cy="80" r="9" fill="${f >= 1 ? '#22c55e' : '#3b82f6'}"/><text x="108" y="84" fill="#93c5fd" font-size="8">T1 ${f >= 1 ? '✓锁' : ''}</text>
        ${[2, 3, 4].map((_, i) => `<circle cx="90" cy="${110 + i * 28}" r="7" fill="#3b82f6" opacity="0.45"/><text x="108" y="${113 + i * 28}" fill="#64748b" font-size="8">等待</text>`).join('')}
        ${f >= 1 ? `<rect x="340" y="88" width="80" height="28" rx="4" fill="#2a1a3a" stroke="#a855f7" stroke-width="2"/><text x="380" y="106" text-anchor="middle" fill="#e9d5ff" font-size="9">🔒</text><line x1="99" y1="80" x2="340" y2="102" stroke="#22c55e" stroke-width="2"/><line x1="99" y1="80" x2="600" y2="88" stroke="#d97706" stroke-width="2"/><text x="660" y="92" fill="#22c55e" font-size="9">DB×1</text>` : ''}
        ${f >= 2 ? `<rect x="320" y="145" width="120" height="36" rx="4" fill="#0a2010" stroke="#22c55e"/><text x="380" y="162" text-anchor="middle" fill="#86efac" font-size="9">已回填</text><text x="380" y="174" text-anchor="middle" fill="#4ade80" font-size="8">其余 GET 命中</text>` : ''}
        ${d >= 1 && f >= 1 ? `<text x="380" y="230" text-anchor="middle" fill="#fde68a" font-size="9">SET lock NX → 仅 1 个 client 成功</text>` : ''}
        ${d >= 2 && f >= 1 ? `<rect x="150" y="248" width="460" height="42" rx="4" fill="#0a0a12" stroke="#a855f7"/><text x="380" y="266" text-anchor="middle" fill="#c4b5fd" font-size="9">Redis 主线程串行执行命令</text><text x="380" y="280" text-anchor="middle" fill="#a78bfa" font-size="8">两个 SET NX 不可能同时成功</text>` : ''}`;
    }
  },
  {
    short: '逻辑过期',
    captions: [
      'key 永远不删。',
      'value 内时间戳过期，仍返回旧值。',
      'CAP：选可用性，接受最终一致。'
    ],
    frames: 2,
    render(d, f) {
      const stale = f >= 1;
      return `<rect x="250" y="48" width="260" height="95" rx="8" fill="#1a0808" stroke="#dc2626" stroke-width="1.5"/><text x="380" y="72" text-anchor="middle" fill="#fca5a5" font-size="11" font-weight="600">hotkey 永远在 Redis</text>
        <rect x="270" y="84" width="220" height="46" rx="4" fill="#0a0a14" stroke="#3b82f6"/><text x="380" y="102" text-anchor="middle" fill="#93c5fd" font-size="9">{ data, expireAt: ${stale ? '过期' : '未过期'} }</text>
        ${f >= 1 ? `<text x="380" y="168" text-anchor="middle" fill="#22c55e" font-size="11" class="fade-in">GET → 立刻返回旧值 ✓</text><path d="M500 120 Q580 120 580 200 Q580 240 500 240" fill="none" stroke="#a855f7" stroke-width="1.5" stroke-dasharray="4" class="draw-line"/><text x="600" y="210" fill="#c4b5fd" font-size="9">异步更新</text>` : ''}
        ${d >= 2 && f >= 1 ? `<rect x="150" y="260" width="460" height="38" rx="4" fill="#0a0a12" stroke="#fbbf24"/><text x="380" y="278" text-anchor="middle" fill="#fde68a" font-size="9">互斥锁=解决竞态 | 逻辑过期=消灭 miss</text><text x="380" y="290" text-anchor="middle" fill="#fbbf24" font-size="8">牺牲短暂一致性，换零等待</text>` : ''}`;
    }
  }
];

window.HASHMAP_COLLISION_SCENES = [
  {
    short: 'hash 计算',
    captions: [
      'put("Aa")，算出 hashCode。',
      '扰动函数：高低位异或，减少碰撞。',
      'h ^ (h>>>16) 让低位也参与索引。'
    ],
    frames: 2,
    render(d, f) {
      const showHash = f >= 1;
      return `<text x="380" y="28" text-anchor="middle" fill="#6b7280" font-size="11">key → hash</text>
        <rect x="120" y="50" width="140" height="56" rx="8" fill="#0a1020" stroke="#3b82f6" stroke-width="1.5"/>
        <text x="190" y="76" text-anchor="middle" fill="#93c5fd" font-size="14" font-weight="600">"Aa"</text>
        <text x="190" y="94" text-anchor="middle" fill="#64748b" font-size="9">key</text>
        ${showHash ? `<line x1="260" y1="78" x2="310" y2="78" stroke="#3b82f6" stroke-width="2" class="draw-line"/><text x="285" y="68" text-anchor="middle" fill="#6b7280" font-size="8">hashCode()</text>` : ''}
        <rect x="310" y="50" width="120" height="56" rx="8" fill="#1a1508" stroke="#f59e0b" stroke-width="${showHash ? 2 : 1}" opacity="${showHash ? 1 : 0.4}"/>
        <text x="370" y="76" text-anchor="middle" fill="#fbbf24" font-size="13" font-weight="600">${showHash ? '2112' : '?'}</text>
        <text x="370" y="94" text-anchor="middle" fill="#d97706" font-size="9">hashCode</text>
        <rect x="120" y="130" width="140" height="56" rx="8" fill="#0a1020" stroke="#3b82f6" stroke-width="1.5" opacity="${showHash ? 1 : 0.35}"/>
        <text x="190" y="156" text-anchor="middle" fill="#93c5fd" font-size="14" font-weight="600">"BB"</text>
        <text x="190" y="174" text-anchor="middle" fill="#64748b" font-size="9">不同 key</text>
        ${showHash ? `<line x1="260" y1="158" x2="310" y2="158" stroke="#3b82f6" stroke-width="2" class="draw-line"/><text x="370" y="156" text-anchor="middle" fill="#f87171" font-size="13" font-weight="700" class="pulse">2112</text><text x="370" y="174" text-anchor="middle" fill="#f87171" font-size="9">相同!</text>` : ''}
        ${d >= 1 && showHash ? `<rect x="460" y="55" width="200" height="50" rx="6" fill="#1a1408" stroke="#f59e0b"/><text x="560" y="76" text-anchor="middle" fill="#fde68a" font-size="9">hash = h ^ (h>>>16)</text><text x="560" y="92" text-anchor="middle" fill="#fbbf24" font-size="8">扰动后 → 2112</text>` : ''}
        ${d >= 2 && showHash ? `<rect x="100" y="220" width="560" height="48" rx="6" fill="#0a0a12" stroke="#a855f7"/><text x="380" y="240" text-anchor="middle" fill="#c4b5fd" font-size="9">hashCode 只保证 equals 相同则相等，不保证唯一</text><text x="380" y="256" text-anchor="middle" fill="#a78bfa" font-size="8">31*h[0]+h[1]+… 易碰撞</text>` : ''}`;
    }
  },
  {
    short: '定位桶',
    captions: [
      'hash 要落到数组某一格。',
      'index = hash & (n-1)。',
      '容量 16 → 低 4 位决定位置。'
    ],
    frames: 2,
    render(d, f) {
      const idx = 0;
      const highlight = f >= 1 ? idx : -1;
      let buckets = '';
      for (let i = 0; i < 16; i++) {
        const x = 80 + (i % 8) * 78;
        const y = 130 + Math.floor(i / 8) * 70;
        const on = i === highlight;
        buckets += `<rect x="${x}" y="${y}" width="68" height="52" rx="4" fill="${on ? '#1a2a10' : '#0a0a10'}" stroke="${on ? '#22c55e' : '#252530'}" stroke-width="${on ? 2.5 : 1}"/>
          <text x="${x + 34}" y="${y + 22}" text-anchor="middle" fill="${on ? '#86efac' : '#4b5563'}" font-size="10">[${i}]</text>
          ${on ? `<text x="${x + 34}" y="${y + 40}" text-anchor="middle" fill="#22c55e" font-size="8" class="pulse">命中</text>` : ''}`;
      }
      return `<text x="380" y="28" text-anchor="middle" fill="#6b7280" font-size="11">table[] 桶数组 · length=16</text>
        <rect x="200" y="42" width="160" height="44" rx="6" fill="#1a1508" stroke="#f59e0b"/><text x="280" y="62" text-anchor="middle" fill="#fbbf24" font-size="12">hash = 2112</text>
        <text x="280" y="78" text-anchor="middle" fill="#d97706" font-size="9">二进制 …0000</text>
        ${f >= 1 ? `<text x="380" y="62" text-anchor="middle" fill="#22c55e" font-size="11" class="fade-in">2112 & 15 = 0</text><line x1="360" y1="86" x2="114" y2="130" stroke="#22c55e" stroke-width="2" class="draw-line"/>` : `<text x="380" y="62" text-anchor="middle" fill="#6b7280" font-size="10">& (n-1) → ?</text>`}
        ${buckets}
        ${d >= 1 && f >= 1 ? `<text x="380" y="290" text-anchor="middle" fill="#fde68a" font-size="9">n 为 2 的幂 → 位与等价于取模</text>` : ''}
        ${d >= 2 && f >= 1 ? `<rect x="120" y="305" width="520" height="30" rx="4" fill="#0a0a12" stroke="#a855f7"/><text x="380" y="324" text-anchor="middle" fill="#c4b5fd" font-size="9">(n-1) 掩码：…00001111 保留低 log₂(n) 位</text>` : ''}`;
    }
  },
  {
    short: '链表冲突',
    captions: [
      '同桶再 put，挂到链表上。',
      '头插法：新节点插到链表头。',
      'get 时 equals 逐节点比对。'
    ],
    frames: 3,
    render(d, f) {
      const entries = f === 0 ? 1 : f === 1 ? 2 : 3;
      const bucketX = 340, bucketY = 100;
      let chain = '';
      const keys = ['"Aa"', '"BB"', '"CC"'];
      const colors = ['#3b82f6', '#f59e0b', '#22c55e'];
      for (let i = 0; i < entries; i++) {
        const nx = bucketX + 120 + i * 90;
        const ny = bucketY + 40;
        chain += `<rect x="${nx}" y="${ny}" width="72" height="44" rx="6" fill="#0a1020" stroke="${colors[i]}" stroke-width="2"/>
          <text x="${nx + 36}" y="${ny + 20}" text-anchor="middle" fill="${colors[i]}" font-size="10">${keys[i]}</text>
          <text x="${nx + 36}" y="${ny + 36}" text-anchor="middle" fill="#64748b" font-size="8">Node</text>`;
        if (i < entries - 1) chain += `<line x1="${nx + 72}" y1="${ny + 22}" x2="${nx + 90}" y2="${ny + 22}" stroke="#6b7280" stroke-width="1.5"/><text x="${nx + 81}" y="${ny + 18}" fill="#6b7280" font-size="7">next</text>`;
        if (f >= 1 && i === 0 && entries >= 2) chain += `<text x="${nx + 36}" y="${ny + 58}" text-anchor="middle" fill="#fbbf24" font-size="8" class="fade-in">头插</text>`;
      }
      return `<text x="380" y="28" text-anchor="middle" fill="#6b7280" font-size="11">bucket[0] 冲突链</text>
        <rect x="${bucketX}" y="${bucketY}" width="90" height="80" rx="6" fill="#1a2a10" stroke="#22c55e" stroke-width="2"/>
        <text x="${bucketX + 45}" y="${bucketY + 30}" text-anchor="middle" fill="#86efac" font-size="11">[0]</text>
        <text x="${bucketX + 45}" y="${bucketY + 50}" text-anchor="middle" fill="#4ade80" font-size="9">bucket</text>
        ${entries >= 1 ? `<line x1="${bucketX + 90}" y1="${bucketY + 40}" x2="${bucketX + 120}" y2="${bucketY + 62}" stroke="#3b82f6" stroke-width="2" class="draw-line"/>` : ''}
        ${chain}
        ${f >= 2 ? `<text x="380" y="220" text-anchor="middle" fill="#f87171" font-size="11" class="pulse">3 个 key 挤在同一桶</text>` : ''}
        ${d >= 1 && f >= 1 ? `<rect x="80" y="240" width="600" height="40" rx="4" fill="#0a0a12" stroke="#f59e0b"/><text x="380" y="258" text-anchor="middle" fill="#fde68a" font-size="9">冲突 ≠ 错误，链表是 JDK8 默认解决方式</text><text x="380" y="272" text-anchor="middle" fill="#fbbf24" font-size="8">O(n) 最坏查找</text>` : ''}
        ${d >= 2 && f >= 2 ? `<rect x="80" y="290" width="600" height="38" rx="4" fill="#0a0a12" stroke="#a855f7"/><text x="380" y="308" text-anchor="middle" fill="#c4b5fd" font-size="9">get(k): hash 定位桶 → 遍历链表 equals(k)</text><text x="380" y="322" text-anchor="middle" fill="#a78bfa" font-size="8">hashCode 相等是 equals 必要非充分</text>` : ''}`;
    }
  },
  {
    short: '树化扩容',
    captions: [
      '链表过长，查找变慢。',
      '≥8 节点且容量≥64 → 红黑树。',
      '扩容 2× 后 rehash 分散冲突。'
    ],
    frames: 3,
    render(d, f) {
      const isTree = f >= 1;
      const isResize = f >= 2;
      return `<text x="380" y="28" text-anchor="middle" fill="#6b7280" font-size="11">${isResize ? 'resize → 32 桶' : isTree ? 'TREEIFY_THRESHOLD=8' : '链表 8 节点'}</text>
        ${!isTree ? `<rect x="280" y="55" width="200" height="120" rx="8" fill="#1a2a10" stroke="#22c55e" stroke-width="1.5"/>
          ${[0,1,2,3,4,5,6,7].map(i => `<circle cx="${310 + (i%4)*45}" cy="${85 + Math.floor(i/4)*45}" r="10" fill="#3b82f6" opacity="0.7"/><text x="${310 + (i%4)*45}" y="${88 + Math.floor(i/4)*45}" text-anchor="middle" fill="#fff" font-size="7">${i+1}</text>`).join('')}
          <text x="380" y="195" text-anchor="middle" fill="#f87171" font-size="10" class="pulse">8 节点 → 查找 O(n)</text>` : ''}
        ${isTree && !isResize ? `<rect x="250" y="50" width="260" height="140" rx="8" fill="#1a0f28" stroke="#a855f7" stroke-width="2"/>
          <circle cx="380" cy="90" r="14" fill="#7c3aed"/><text x="380" y="94" text-anchor="middle" fill="#fff" font-size="8">根</text>
          <circle cx="330" cy="130" r="11" fill="#a855f7" opacity="0.8"/><circle cx="430" cy="130" r="11" fill="#a855f7" opacity="0.8"/>
          <circle cx="300" cy="165" r="9" fill="#c4b5fd" opacity="0.7"/><circle cx="360" cy="165" r="9" fill="#c4b5fd" opacity="0.7"/><circle cx="410" cy="165" r="9" fill="#c4b5fd" opacity="0.7"/><circle cx="460" cy="165" r="9" fill="#c4b5fd" opacity="0.7"/>
          <line x1="380" y1="104" x2="330" y2="119" stroke="#6b7280"/><line x1="380" y1="104" x2="430" y2="119" stroke="#6b7280"/>
          <text x="380" y="210" text-anchor="middle" fill="#c4b5fd" font-size="10">红黑树 O(log n)</text>` : ''}
        ${isResize ? `<text x="200" y="70" fill="#6b7280" font-size="9">16 桶</text>
          ${[0,1,2,3].map(i => `<rect x="${60+i*55}" y="80" width="48" height="36" rx="3" fill="#0a0a10" stroke="#252530"/><text x="${84+i*55}" y="102" text-anchor="middle" fill="#4b5563" font-size="8">[${i}]</text>`).join('')}
          <text x="380" y="75" text-anchor="middle" fill="#22c55e" font-size="14" class="fade-in">×2</text>
          <text x="560" y="70" fill="#6b7280" font-size="9">32 桶</text>
          ${[0,1,2,3,4,5,6,7].map(i => `<rect x="${480+(i%4)*55}" y="${80+Math.floor(i/4)*44}" width="48" height="36" rx="3" fill="${i<4?'#1a2a10':'#0a0a10'}" stroke="${i<4?'#22c55e':'#252530'}"/><text x="${504+(i%4)*55}" y="${102+Math.floor(i/4)*44}" text-anchor="middle" fill="${i<4?'#86efac':'#4b5563'}" font-size="8">[${i}]</text>`).join('')}
          <line x1="300" y1="98" x2="470" y2="98" stroke="#22c55e" stroke-width="2" class="draw-line"/>
          <text x="380" y="200" text-anchor="middle" fill="#86efac" font-size="10">rehash：index 重算，冲突分散</text>` : ''}
        ${d >= 1 && isTree ? `<text x="380" y="250" text-anchor="middle" fill="#fde68a" font-size="9">条件：链表≥8 且 table.length≥64</text>` : ''}
        ${d >= 2 && isResize ? `<rect x="100" y="260" width="560" height="48" rx="4" fill="#0a0a12" stroke="#a855f7"/><text x="380" y="280" text-anchor="middle" fill="#c4b5fd" font-size="9">扩容阈值 loadFactor=0.75 → size>cap×0.75 触发</text><text x="380" y="296" text-anchor="middle" fill="#a78bfa" font-size="8">新 index = hash & (newCap-1)，位多一位</text>` : ''}`;
    }
  }
];
