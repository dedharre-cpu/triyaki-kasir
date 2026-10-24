/* Sinkronisasi Firebase Firestore (mode uji coba)
   - Data lokal (localStorage) tetap dipakai sebagai cadangan saat offline.
   - Setiap perubahan dikirim ke Firestore, perangkat lain menerima otomatis (real-time).
   - Dimuat setelah app.js dan memakai variabel/fungsi global milik app.js. */
(function () {
  'use strict';

  const FB_VERSION = '13.1.0';
  const firebaseConfig = {
    apiKey: "AIzaSyAiOVNJmOEqluwQ6MOPbKW3-IYLzF10Od4",
    authDomain: "triyakita-kasir.firebaseapp.com",
    projectId: "triyakita-kasir",
    storageBucket: "triyakita-kasir.firebasestorage.app",
    messagingSenderId: "772576922591",
    appId: "1:772576922591:web:8c9bbda2c6cf6d5ef1d26a"
  };

  const COLS = ['sales', 'purchases', 'products', 'archives'];
  const pill = document.getElementById('connectionStatus');
  const ready = {}, remote = {};
  COLS.forEach(c => { ready[c] = false; remote[c] = new Map(); });
  let db = null, fs = null, started = false, announced = false;

  const origPersist = window.persist;
  const loadModule = window.__fbImport || (u => import(u));

  /* ---------- akses data milik app.js ---------- */
  const getArr = c => c === 'sales' ? sales : c === 'purchases' ? purchases : c === 'products' ? products : monthlyArchives;
  function setArr(c, v) {
    if (c === 'sales') sales = v;
    else if (c === 'purchases') purchases = v;
    else if (c === 'products') products = v;
    else monthlyArchives = v;
  }
  const keyOf = (c, r) => c === 'archives' ? r.month : r.id;
  function docId(k) {
    let s = encodeURIComponent(String(k));
    if (/^\.+$/.test(s) || /^__.*__$/.test(s)) s = 'x' + s;
    return s.slice(0, 200);
  }

  /* ---------- status di pojok atas ---------- */
  function setState(text, bad) {
    if (!pill) return;
    pill.textContent = text;
    pill.classList.toggle('offline', !!bad);
  }
  function updateState() {
    if (!navigator.onLine) { setState('● Offline · tersimpan di perangkat', true); return; }
    const all = COLS.every(c => ready[c]);
    setState(all ? '● Online · Cloud tersinkron' : '● Online · Menyinkronkan...', false);
    if (all && !announced) {
      announced = true;
      try { showToast('Cloud tersambung'); } catch (e) {}
    }
  }
  function cloudError(e) {
    console.error('Firestore:', e);
    const code = (e && (e.code || e.message)) || 'error';
    setState('● Cloud error: ' + code, true);
    try { showToast('Cloud error: ' + code); } catch (x) {}
  }

  /* ---------- kirim perubahan lokal ke server ---------- */
  function pushDiff(c) {
    if (!db || !ready[c]) return;
    const local = getArr(c) || [];
    const next = new Map();
    local.forEach((r, i) => {
      const k = keyOf(c, r);
      if (k === undefined || k === null || k === '') return;
      next.set(docId(k), { k: String(k), json: JSON.stringify(r), o: i });
    });
    const old = remote[c];
    const ops = [];
    next.forEach((v, id) => {
      const o = old.get(id);
      if (!o || o.json !== v.json || (c === 'products' && o.o !== v.o)) ops.push({ t: 'set', id, v });
    });
    old.forEach((v, id) => { if (!next.has(id)) ops.push({ t: 'del', id }); });
    if (!ops.length) return;

    remote[c] = next; // anggap terkirim; dikembalikan bila gagal
    for (let i = 0; i < ops.length; i += 400) {
      const batch = fs.writeBatch(db);
      ops.slice(i, i + 400).forEach(op => {
        const ref = fs.doc(db, c, op.id);
        if (op.t === 'set') batch.set(ref, op.v); else batch.delete(ref);
      });
      batch.commit().catch(e => { remote[c] = old; cloudError(e); });
    }
  }
  function pushAll() { COLS.forEach(pushDiff); }

  /* ---------- terima data dari server ---------- */
  function applyRemote(c, snap) {
    const m = new Map(), arr = [];
    snap.forEach(d => {
      const v = d.data();
      try {
        arr.push({ rec: JSON.parse(v.json), o: v.o || 0 });
        m.set(d.id, { k: v.k, json: v.json, o: v.o || 0 });
      } catch (e) { /* lewati dokumen rusak */ }
    });
    remote[c] = m;
    if (c === 'products') arr.sort((a, b) => a.o - b.o);
    else if (c === 'archives') arr.sort((a, b) => String(b.rec.month).localeCompare(String(a.rec.month)));
    else arr.sort((a, b) => String(b.rec.date || '').localeCompare(String(a.rec.date || '')) || String(b.rec.id).localeCompare(String(a.rec.id)));
    const next = arr.map(x => x.rec);
    if (JSON.stringify(next) === JSON.stringify(getArr(c))) return false;
    setArr(c, next);
    return true;
  }
  function rerender() {
    try { if (origPersist) origPersist(); } catch (e) {}
    try { refreshAll(); } catch (e) { console.error(e); }
    try { renderCart(); } catch (e) {}
  }

  function listen(c) {
    fs.onSnapshot(fs.collection(db, c), snap => {
      if (snap.metadata.fromCache && !ready[c]) return; // abaikan cache kosong saat offline
      if (!ready[c]) {
        const flag = 'tri_fb_init_' + c;
        let migrated = false;
        try { migrated = !!localStorage.getItem(flag); } catch (e) {}
        try { localStorage.setItem(flag, '1'); } catch (e) {}
        if (snap.empty && !migrated) {
          // server masih kosong & perangkat ini belum pernah mengunggah: unggah data lokal
          ready[c] = true;
          remote[c] = new Map();
          pushDiff(c);
          updateState();
          return;
        }
        ready[c] = true;
      }
      if (applyRemote(c, snap)) rerender();
      updateState();
    }, cloudError);
  }

  /* ---------- inisialisasi ---------- */
  async function init() {
    if (started) return;
    started = true;
    try {
      setState('● Menghubungkan cloud...', false);
      const base = 'https://www.gstatic.com/firebasejs/' + FB_VERSION + '/';
      const [appMod, fsMod] = await Promise.all([
        loadModule(base + 'firebase-app.js'),
        loadModule(base + 'firebase-firestore.js')
      ]);
      fs = fsMod;
      db = fs.getFirestore(appMod.initializeApp(firebaseConfig));
      COLS.forEach(listen);
    } catch (e) {
      started = false;
      cloudError(e);
    }
  }

  // Dipanggil tombol Segarkan: ambil ulang data langsung dari server
  window.fbForceSync = async function () {
    if (!db) { await init(); return; }
    if (!COLS.every(c => ready[c])) return;
    let changed = false;
    for (const c of COLS) {
      const snap = await fs.getDocsFromServer(fs.collection(db, c));
      if (applyRemote(c, snap)) changed = true;
    }
    if (changed) rerender();
    updateState();
  };

  /* ---------- pasang kait ---------- */
  if (typeof origPersist === 'function') {
    window.persist = function () {
      const r = origPersist.apply(this, arguments);
      try { pushAll(); } catch (e) { console.error(e); }
      return r;
    };
  }
  window.addEventListener('online', () => { if (!db) init(); updateState(); });
  window.addEventListener('offline', updateState);
  init();
})();
