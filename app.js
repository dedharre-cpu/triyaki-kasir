/* Lapisan login lokal. Catatan: ini bukan autentikasi server dan tidak mencegah pembongkaran kode HTML oleh pengguna teknis. */
const AUTH_KEY='tri_security_v1';
let currentRole=null, loginRole='owner';
const authGate=document.getElementById('authGate');
const setupForm=document.getElementById('setupForm'), loginForm=document.getElementById('loginForm');
function authConfig(){try{return JSON.parse(localStorage.getItem(AUTH_KEY)||'null')}catch(e){return null}}
function bytesToHex(bytes){return Array.from(new Uint8Array(bytes)).map(b=>b.toString(16).padStart(2,'0')).join('')}
async function deriveSecret(secret,salt){if(!window.crypto||!crypto.subtle)throw new Error('Browser tidak mendukung penyimpanan password aman. Gunakan Chrome atau Edge versi terbaru.');const enc=new TextEncoder();const key=await crypto.subtle.importKey('raw',enc.encode(secret),'PBKDF2',false,['deriveBits']);const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:enc.encode(salt),iterations:150000,hash:'SHA-256'},key,256);return bytesToHex(bits)}
async function createCredential(secret){const salt=bytesToHex(crypto.getRandomValues(new Uint8Array(16)));return {salt,hash:await deriveSecret(secret,salt)}}
function showAuthError(id,msg){const el=document.getElementById(id);el.textContent=msg;el.style.display='block'}
function clearAuthError(id){const el=document.getElementById(id);el.textContent='';el.style.display='none'}
function initAuth(){const cfg=authConfig();if(cfg){const savedRole=localStorage.getItem('tri_session_role');if(savedRole==='owner'||savedRole==='cashier'){enterApp(savedRole);return}}if(!cfg){document.getElementById('authTitle').textContent='Siapkan Keamanan';document.getElementById('authSubtitle').textContent='Langkah pertama · Triyakita Kasir';setupForm.classList.remove('hidden');loginForm.classList.add('hidden')}else{document.getElementById('authTitle').textContent='Masuk ke Triyakita Kasir';document.getElementById('authSubtitle').textContent='Ayam Triyaki Ala Indo';loginForm.classList.remove('hidden');setupForm.classList.add('hidden')}document.getElementById('logoutButton').style.display='none';document.getElementById('resetForm').classList.add('hidden')}
document.getElementById('saveSecuritySetup').addEventListener('click',async()=>{clearAuthError('setupError');const pass=document.getElementById('setupOwnerPass').value,confirmPass=document.getElementById('setupOwnerConfirm').value,pin=document.getElementById('setupCashierPin').value;if(pass.length<10){showAuthError('setupError','Password pemilik harus minimal 10 karakter.');return}if(pass!==confirmPass){showAuthError('setupError','Konfirmasi password tidak sama.');return}if(!/^\d{6}$/.test(pin)){showAuthError('setupError','PIN kasir harus tepat 6 angka.');return}try{const owner=await createCredential(pass),cashier=await createCredential(pin);const rc=genRecoveryCode(),recovery=await createCredential(normCode(rc));localStorage.setItem(AUTH_KEY,JSON.stringify({version:2,owner,cashier,recovery,createdAt:new Date().toISOString()}));document.getElementById('setupOwnerPass').value='';document.getElementById('setupOwnerConfirm').value='';document.getElementById('setupCashierPin').value='';showRecovery(rc,()=>enterApp('owner'))}catch(e){showAuthError('setupError',e.message||'Tidak dapat menyimpan pengaturan keamanan.')}});
document.getElementById('ownerTab').addEventListener('click',()=>setLoginRole('owner'));document.getElementById('cashierTab').addEventListener('click',()=>setLoginRole('cashier'));
function setLoginRole(role){loginRole=role;document.getElementById('ownerTab').classList.toggle('active',role==='owner');document.getElementById('cashierTab').classList.toggle('active',role==='cashier');document.getElementById('loginSecretLabel').textContent=role==='owner'?'Password pemilik':'PIN kasir (6 angka)';document.getElementById('loginSecret').placeholder=role==='owner'?'Masukkan password pemilik':'Masukkan PIN kasir';document.getElementById('loginSecret').value='';clearAuthError('loginError')}
document.getElementById('loginButton').addEventListener('click',async()=>{clearAuthError('loginError');const secret=document.getElementById('loginSecret').value,cfg=authConfig();if(!cfg){initAuth();return}if(!secret){showAuthError('loginError','Masukkan password atau PIN terlebih dahulu.');return}try{const cred=cfg[loginRole],candidate=await deriveSecret(secret,cred.salt);if(candidate!==cred.hash){showAuthError('loginError','Password atau PIN tidak sesuai. Silakan coba lagi.');return}document.getElementById('loginSecret').value='';enterApp(loginRole)}catch(e){showAuthError('loginError',e.message||'Gagal memeriksa akses.')}});
document.getElementById('loginSecret').addEventListener('keydown',e=>{if(e.key==='Enter')document.getElementById('loginButton').click()});
function enterApp(role){currentRole=role;try{localStorage.setItem('tri_session_role',role)}catch(e){}authGate.style.display='none';document.getElementById('sessionBadge').textContent=role==='owner'?'Masuk: Pemilik':'Masuk: Kasir';document.getElementById('logoutButton').style.display='inline-block';applyRoleAccess();if(role==='cashier')showView('cashier');else showView('dashboard')}
function logoutApp(){currentRole=null;try{localStorage.removeItem('tri_session_role')}catch(e){}cart={};try{renderCart()}catch(e){}authGate.style.display='flex';document.getElementById('sessionBadge').textContent='Belum masuk';document.getElementById('logoutButton').style.display='none';document.getElementById('ownerEnterBtn').style.display='none';document.getElementById('lockCashierBtn').style.display='none';document.getElementById('loginSecret').value='';setLoginRole('owner');initAuth()}
document.getElementById('logoutButton').addEventListener('click',()=>{if(confirm('Keluar dari Triyakita Kasir? Data transaksi tidak akan dihapus.'))logoutApp()});
/* ===== Keamanan: ganti password/PIN & kode pemulihan ===== */
function genRecoveryCode(){const A='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',b=crypto.getRandomValues(new Uint8Array(16));let c='';for(let i=0;i<16;i++){c+=A[b[i]%A.length];if(i%4===3&&i<15)c+='-'}return c}
function normCode(c){return String(c||'').toUpperCase().replace(/[^A-Z0-9]/g,'')}
function saveCfg(cfg){localStorage.setItem(AUTH_KEY,JSON.stringify(cfg))}
let recoveryAfter=null;
function showRecovery(code,after){recoveryAfter=after||null;document.getElementById('recoveryCodeText').textContent=code;document.getElementById('recoveryModal').style.display='flex'}
document.getElementById('recoveryCopy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(document.getElementById('recoveryCodeText').textContent);showToast('Kode disalin')}catch(e){showToast('Salin manual: blok lalu salin kodenya')}});
document.getElementById('recoveryDone').addEventListener('click',()=>{document.getElementById('recoveryModal').style.display='none';document.getElementById('recoveryCodeText').textContent='';const f=recoveryAfter;recoveryAfter=null;updateRecoveryStatus();if(f)f()});
function updateRecoveryStatus(){const cfg=authConfig(),el=document.getElementById('recoveryStatus');if(el)el.textContent=cfg&&cfg.recovery?'Kode pemulihan: sudah dibuat':'Kode pemulihan: BELUM dibuat'}
document.getElementById('forgotLink').addEventListener('click',()=>{loginForm.classList.add('hidden');document.getElementById('resetForm').classList.remove('hidden');document.getElementById('authTitle').textContent='Lupa Password / PIN';clearAuthError('resetError')});
document.getElementById('resetBack').addEventListener('click',()=>{document.getElementById('resetForm').classList.add('hidden');initAuth()});
document.getElementById('resetButton').addEventListener('click',async()=>{clearAuthError('resetError');const cfg=authConfig(),code=document.getElementById('resetCode').value,np=document.getElementById('resetOwnerPass').value,nc=document.getElementById('resetOwnerConfirm').value,pin=document.getElementById('resetPin').value;
if(!cfg||!cfg.recovery){showAuthError('resetError','Kode pemulihan belum pernah dibuat di perangkat ini, jadi reset tidak bisa dilakukan dari sini.');return}
if(!normCode(code)){showAuthError('resetError','Masukkan kode pemulihan.');return}
if(np.length<10){showAuthError('resetError','Password pemilik baru minimal 10 karakter.');return}
if(np!==nc){showAuthError('resetError','Konfirmasi password tidak sama.');return}
if(pin&&!/^\d{6}$/.test(pin)){showAuthError('resetError','PIN kasir harus tepat 6 angka (atau kosongkan).');return}
try{const cand=await deriveSecret(normCode(code),cfg.recovery.salt);if(cand!==cfg.recovery.hash){showAuthError('resetError','Kode pemulihan tidak sesuai.');return}
const owner=await createCredential(np),cashier=pin?await createCredential(pin):cfg.cashier,rc=genRecoveryCode(),recovery=await createCredential(normCode(rc));
saveCfg({...cfg,version:2,owner,cashier,recovery,updatedAt:new Date().toISOString()});
['resetCode','resetOwnerPass','resetOwnerConfirm','resetPin'].forEach(i=>document.getElementById(i).value='');
document.getElementById('resetForm').classList.add('hidden');
showRecovery(rc,()=>enterApp('owner'))}catch(e){showAuthError('resetError',e.message||'Gagal mengatur ulang.')}});
function secMsg(ok,msg){const el=document.getElementById('secError');el.textContent=msg;el.style.display='block';el.style.background=ok===true?'#e8f7ee':ok===null?'#eef2ff':'#fff0ef';el.style.color=ok===true?'#1b7a45':ok===null?'#3b4a8a':'#c62828';el.style.fontWeight='700';try{el.scrollIntoView({behavior:'smooth',block:'center'})}catch(e){}if(ok===true)showToast(msg)}
let secBusy=false;
async function busy(fn){if(secBusy)return;secBusy=true;const ids=['btnChangeOwner','btnChangePin','btnNewRecovery'],old={};ids.forEach(i=>{const b=document.getElementById(i);old[i]=b.textContent;b.disabled=true;b.textContent='Memproses…'});try{await fn()}catch(e){secMsg(false,'Terjadi kesalahan: '+(e&&e.message||e))}finally{ids.forEach(i=>{const b=document.getElementById(i);b.disabled=false;b.textContent=old[i]});secBusy=false}}
async function secVerify(){secMsg(null,'Memproses… mohon tunggu beberapa detik.');if(!requireOwner())return null;const cfg=authConfig(),cur=document.getElementById('secCurrent').value;if(!cur){secMsg(false,'Isi password pemilik saat ini terlebih dahulu.');return null}
try{const cand=await deriveSecret(cur,cfg.owner.salt);if(cand!==cfg.owner.hash){secMsg(false,'Password pemilik saat ini tidak sesuai.');return null}return cfg}catch(e){secMsg(false,e.message||'Gagal memeriksa password.');return null}}
document.getElementById('btnChangeOwner').addEventListener('click',()=>busy(async()=>{const cfg=await secVerify();if(!cfg)return;const np=document.getElementById('secNewOwner').value,nc=document.getElementById('secNewOwnerConfirm').value;
if(np.length<10){secMsg(false,'Password baru minimal 10 karakter.');return}if(np!==nc){secMsg(false,'Konfirmasi password baru tidak sama.');return}
saveCfg({...cfg,owner:await createCredential(np),updatedAt:new Date().toISOString()});['secCurrent','secNewOwner','secNewOwnerConfirm'].forEach(i=>document.getElementById(i).value='');secMsg(true,'✓ Password pemilik berhasil diganti. Gunakan password baru saat masuk berikutnya.')}));
document.getElementById('btnChangePin').addEventListener('click',()=>busy(async()=>{const cfg=await secVerify();if(!cfg)return;const pin=document.getElementById('secNewPin').value;
if(!/^\d{6}$/.test(pin)){secMsg(false,'PIN kasir harus tepat 6 angka.');return}
saveCfg({...cfg,cashier:await createCredential(pin),updatedAt:new Date().toISOString()});['secCurrent','secNewPin'].forEach(i=>document.getElementById(i).value='');secMsg(true,'✓ PIN kasir berhasil diganti. Kasir harus memakai PIN baru.')}));
document.getElementById('btnNewRecovery').addEventListener('click',()=>busy(async()=>{const cfg=await secVerify();if(!cfg)return;

const rc=genRecoveryCode();saveCfg({...cfg,version:2,recovery:await createCredential(normCode(rc)),updatedAt:new Date().toISOString()});document.getElementById('secCurrent').value='';secMsg(true,'✓ Kode pemulihan baru dibuat. Catat kode yang tampil.');showRecovery(rc,null)}));
(function storageCheck(){let ok=true;try{localStorage.setItem('__t','1');localStorage.removeItem('__t')}catch(e){ok=false}if(!ok){const d=document.createElement('div');d.style.cssText='position:fixed;left:0;right:0;top:0;z-index:99999;background:#c62828;color:#fff;padding:12px 16px;font-size:13px;font-weight:700;line-height:1.5;text-align:center';d.textContent='⚠ Penyimpanan browser diblokir, jadi password, PIN, dan data tidak bisa disimpan. Buka file Triyakita_Kasir_Aman.html langsung dari folder (klik dua kali / seret ke Vivaldi), bukan lewat pratinjau.';document.body.appendChild(d)}})();
const APP_NAME_KEY='tri_app_name';
const APP_TAGLINE_KEY='tri_app_tagline';
function getAppName(){return (localStorage.getItem(APP_NAME_KEY)||'TRIYAKITA KASIR').trim()||'TRIYAKITA KASIR'}
function getAppTagline(){return (localStorage.getItem(APP_TAGLINE_KEY)||'Gurih, Nikmat, Enak di Hati').trim()||'Gurih, Nikmat, Enak di Hati'}
function applyAppName(){const name=getAppName(),tagline=getAppTagline();const brand=document.getElementById('brandAppName');if(brand)brand.textContent=name;const sideTagline=document.querySelector('.brand small');if(sideTagline)sideTagline.textContent=tagline;const eyebrow=document.getElementById('appEyebrow');if(eyebrow)eyebrow.textContent=name+' • '+tagline.toLocaleUpperCase('id-ID');const subtitle=document.getElementById('authSubtitle');if(subtitle)subtitle.textContent=name+' · '+tagline;document.title=name+' — '+tagline;const input=document.getElementById('appNameInput');if(input&&document.activeElement!==input)input.value=name;const taglineInput=document.getElementById('appTaglineInput');if(taglineInput&&document.activeElement!==taglineInput)taglineInput.value=tagline}
const appNameSaveButton=document.getElementById('saveAppName');
if(appNameSaveButton)appNameSaveButton.addEventListener('click',()=>{if(!requireOwner('Nama aplikasi hanya dapat diubah pemilik.'))return;const input=document.getElementById('appNameInput');const name=(input.value||'').trim();if(!name){showToast('Nama aplikasi tidak boleh kosong');input.focus();return}if(name.length>50){showToast('Nama aplikasi maksimal 50 karakter');return}try{localStorage.setItem(APP_NAME_KEY,name);applyAppName();showToast('Nama aplikasi berhasil diubah')}catch(e){showToast('Nama aplikasi gagal disimpan di browser')}});
const appTaglineSaveButton=document.getElementById('saveAppTagline');
if(appTaglineSaveButton)appTaglineSaveButton.addEventListener('click',()=>{if(!requireOwner('Tagline hanya dapat diubah pemilik.'))return;const input=document.getElementById('appTaglineInput');const tagline=(input.value||'').trim();if(!tagline){showToast('Tagline tidak boleh kosong');input.focus();return}if(tagline.length>80){showToast('Tagline maksimal 80 karakter');return}try{localStorage.setItem(APP_TAGLINE_KEY,tagline);applyAppName();showToast('Tagline berhasil diubah')}catch(e){showToast('Tagline gagal disimpan di browser')}});
const MENU_KEY='tri_menu_hidden';
function applyMenuState(hidden){const app=document.querySelector('.app');app.classList.toggle('menu-hidden',hidden);document.getElementById('menuToggle').setAttribute('aria-expanded',String(!hidden))}
(function initMenuState(){let saved=null;try{saved=localStorage.getItem(MENU_KEY)}catch(e){}applyMenuState(saved===null?window.innerWidth<=700:saved==='1')})();
document.getElementById('menuToggle').addEventListener('click',()=>{const hidden=!document.querySelector('.app').classList.contains('menu-hidden');applyMenuState(hidden);try{localStorage.setItem(MENU_KEY,hidden?'1':'0')}catch(e){}});
function switchRole(role){currentRole=role;document.getElementById('sessionBadge').textContent=role==='owner'?'Masuk: Pemilik':'Masuk: Kasir';applyRoleAccess();showView(role==='owner'?'dashboard':'cashier')}
const ownerModal=document.getElementById('ownerModal'),ownerModalPass=document.getElementById('ownerModalPass');
function openOwnerModal(){ownerModalPass.value='';clearAuthError('ownerModalError');ownerModal.style.display='flex';setTimeout(()=>ownerModalPass.focus(),50)}
function closeOwnerModal(){ownerModal.style.display='none';ownerModalPass.value='';clearAuthError('ownerModalError')}
async function submitOwnerModal(){clearAuthError('ownerModalError');const secret=ownerModalPass.value,cfg=authConfig();if(!secret){showAuthError('ownerModalError','Masukkan password pemilik.');return}try{const cand=await deriveSecret(secret,cfg.owner.salt);if(cand!==cfg.owner.hash){showAuthError('ownerModalError','Password pemilik tidak sesuai.');ownerModalPass.value='';return}closeOwnerModal();switchRole('owner');showToast('Masuk sebagai Pemilik')}catch(e){showAuthError('ownerModalError',e.message||'Gagal memeriksa akses.')}}
document.getElementById('ownerEnterBtn').addEventListener('click',openOwnerModal);
document.getElementById('ownerModalCancel').addEventListener('click',closeOwnerModal);
document.getElementById('ownerModalOk').addEventListener('click',submitOwnerModal);
ownerModalPass.addEventListener('keydown',e=>{if(e.key==='Enter')submitOwnerModal();if(e.key==='Escape')closeOwnerModal()});
document.getElementById('lockCashierBtn').addEventListener('click',()=>{switchRole('cashier');showToast('Terkunci ke Mode Kasir')});
function isOwner(){return currentRole==='owner'}
function requireOwner(message='Bagian ini hanya dapat diakses pemilik.'){if(!isOwner()){showToast(message);return false}return true}
function applyRoleAccess(){try{updateRecoveryStatus()}catch(e){}document.querySelectorAll('.nav button').forEach(b=>{b.style.display=(currentRole==='cashier'&&b.dataset.view==='dashboard')?'none':''});document.querySelectorAll('.view').forEach(v=>{if(currentRole==='cashier'&&v.id==='dashboardView')v.classList.remove('active')});const editButton=document.querySelector('#cashierView button[onclick="editProducts()"]');if(editButton)editButton.style.display=isOwner()?'':'none';const priceNotice=document.getElementById('menuPriceNotice');if(priceNotice)priceNotice.style.display=isOwner()?'':'none';document.getElementById('ownerEnterBtn').style.display=currentRole==='cashier'?'inline-block':'none';document.getElementById('lockCashierBtn').style.display=isOwner()?'inline-block':'none';const ownerNotice=document.getElementById('roleNotice');if(ownerNotice)ownerNotice.style.display=currentRole==='cashier'?'block':'none'}
const DEFAULT_PRODUCTS=[{id:'ori',name:'Nasi Ayam Triyaki Original',price:18000,emoji:'🍱'},{id:'pedas',name:'Nasi Ayam Triyaki Pedas',price:20000,emoji:'🌶️'},{id:'telur',name:'Nasi Ayam Triyaki Telur',price:22000,emoji:'🍳'},{id:'spesial',name:'Nasi Ayam Triyaki Spesial',price:25000,emoji:'⭐'},{id:'goreng',name:'Ayam Goreng',price:15000,emoji:'🍗'},{id:'uduk',name:'Nasi Uduk Ayam',price:18000,emoji:'🍚'},{id:'teh',name:'Es Teh',price:5000,emoji:'🧋'},{id:'air',name:'Air Mineral',price:4000,emoji:'💧'}];
let products=load('tri_products',DEFAULT_PRODUCTS),sales=load('tri_sales',[]),purchases=load('tri_purchases',[]),cart={},monthlyArchives=load('tri_monthly_archives',[]);function load(k,d){try{let x=localStorage.getItem(k);return x?JSON.parse(x):JSON.parse(JSON.stringify(d))}catch(e){return d}}function persist(){localStorage.setItem('tri_products',JSON.stringify(products));localStorage.setItem('tri_sales',JSON.stringify(sales));localStorage.setItem('tri_purchases',JSON.stringify(purchases));localStorage.setItem('tri_monthly_archives',JSON.stringify(monthlyArchives))}function rupiah(n){return new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(n)||0)}function dateKey(d=new Date()){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}function niceDate(d=new Date()){return new Intl.DateTimeFormat('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(d)}function showToast(t){let e=document.getElementById('toast');e.textContent=t;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),2600)}
document.getElementById('todayLabel').textContent='📅 '+niceDate();document.getElementById('historyDate').value='';document.getElementById('purchaseDate').value=dateKey();function showView(v){if(currentRole==='cashier'&&v==='dashboard'){showToast('Dashboard hanya dapat dibuka pemilik');return}if(!currentRole){return}document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));document.getElementById(v+'View').classList.add('active');document.querySelectorAll('.nav button').forEach(x=>x.classList.toggle('active',x.dataset.view===v));document.getElementById('pageTitle').textContent=({dashboard:'Dashboard',cashier:'Kasir Penjualan',history:'Riwayat Transaksi',purchases:'Pembelian & Pengeluaran',reports:'Laporan Keuangan',sheets:'Google Sheets'})[v];if(v==='history')renderHistory();if(v==='purchases')renderPurchases();if(v==='reports')renderReports();if(v==='cashier')renderProducts();if(v==='sheets')loadSheetsUrl();window.scrollTo({top:0,behavior:'smooth'})}document.querySelectorAll('.nav button').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function productCard(p){return `<button class="product" onclick="addToCart('${esc(p.id)}')"><div class="emoji">${esc(p.emoji||'🍽️')}</div><b>${esc(p.name)}</b><small>${rupiah(p.price)} · ${esc(p.id)}</small><span class="add">+</span></button>`}function renderProducts(){document.getElementById('products').innerHTML=products.map(productCard).join('');document.getElementById('quickProducts').innerHTML=products.slice(0,4).map(productCard).join('')}function addToCart(id){cart[id]=(cart[id]||0)+1;renderCart();showToast('Menu ditambahkan ke keranjang')}function clearCart(){cart={};document.getElementById('discount').value=0;document.getElementById('cashReceived').value='';document.getElementById('customerName').value='';renderCart()}function subtotal(){return Object.entries(cart).reduce((s,[id,q])=>s+(products.find(p=>p.id===id)?.price||0)*q,0)}function total(){return Math.max(0,subtotal()-Math.max(0,Number(document.getElementById('discount').value)||0))}function renderCart(){let rows=Object.entries(cart).filter(([id,q])=>q>0&&products.some(p=>p.id===id));document.getElementById('cartCount').textContent=rows.reduce((s,[i,q])=>s+q,0)+' item';document.getElementById('cartItems').className=rows.length?'':'cart-empty';document.getElementById('cartItems').innerHTML=rows.length?rows.map(([id,q])=>{let p=products.find(x=>x.id===id);return `<div class="cart-row"><div class="name"><b>${esc(p.name)}</b><small>${rupiah(p.price)} / item</small></div><div class="qty"><button onclick="changeQty('${esc(id)}',-1)">−</button><span>${q}</span><button onclick="changeQty('${esc(id)}',1)">+</button></div><b>${rupiah(p.price*q)}</b></div>`}).join(''):'Pilih menu di sebelah kiri untuk memulai.';document.getElementById('subtotal').textContent=rupiah(subtotal());document.getElementById('grandTotal').textContent=rupiah(total());renderChange()}function changeQty(id,n){cart[id]=(cart[id]||0)+n;if(cart[id]<=0)delete cart[id];renderCart()}function renderChange(){let method=document.getElementById('paymentMethod').value;document.getElementById('cashField').classList.toggle('hidden',method!=='Tunai');let change=(Number(document.getElementById('cashReceived').value)||0)-total();document.getElementById('changeAmount').textContent=rupiah(Math.max(0,change))}document.getElementById('paymentMethod').addEventListener('change',renderChange);
function completeSale(){let items=Object.entries(cart).filter(([id,q])=>q>0&&products.some(p=>p.id===id)).map(([id,q])=>{let p=products.find(x=>x.id===id);return {id,name:p.name,price:p.price,qty:q}});if(!items.length){showToast('Keranjang masih kosong');return}let t=total(),method=document.getElementById('paymentMethod').value,received=method==='Tunai'?(Number(document.getElementById('cashReceived').value)||0):t;if(method==='Tunai'&&received<t){showToast('Uang diterima masih kurang');return}let now=new Date();sales.unshift({id:'TRI-'+now.getFullYear().toString().slice(-2)+String(now.getMonth()+1).padStart(2,'0')+String(now.getDate()).padStart(2,'0')+'-'+String(Date.now()).slice(-5),date:now.toISOString(),day:dateKey(now),customer:document.getElementById('customerName').value.trim()||'Pelanggan umum',method,items,subtotal:subtotal(),discount:Math.max(0,Number(document.getElementById('discount').value)||0),total:t,received,change:Math.max(0,received-t)});persist();clearCart();refreshAll();showToast('Transaksi tersimpan di perangkat');autoSyncAfterChange('transaksi penjualan');showView('cashier')}
function renderHistory(){let date=document.getElementById('historyDate').value;let list=sales.filter(s=>!date||s.day===date);document.getElementById('historyRows').innerHTML=list.length?list.map(s=>`<tr><td><b>${s.id}</b></td><td>${new Date(s.date).toLocaleString('id-ID',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</td><td>${esc(s.customer)}</td><td><span class="tag ${s.method==='Tunai'?'cash':''}">${s.method}</span></td><td><b>${rupiah(s.total)}</b></td><td><button class="delete-btn" onclick="viewReceipt('${s.id}')">Detail</button></td></tr>`).join(''):`<tr><td colspan="6" class="empty-row">Belum ada transaksi untuk pilihan ini.</td></tr>`}function viewReceipt(id){let s=sales.find(x=>x.id===id);if(!s)return;alert(`STRUK PENJUALAN\nAyam Triyaki Ala Indo\n${s.id}\n${new Date(s.date).toLocaleString('id-ID')}\nPelanggan: ${s.customer}\n\n${s.items.map(i=>`${i.name} x${i.qty}  ${rupiah(i.price*i.qty)}`).join('\n')}\n\nSubtotal: ${rupiah(s.subtotal)}\nDiskon: ${rupiah(s.discount)}\nTOTAL: ${rupiah(s.total)}\nPembayaran: ${s.method}\nDiterima: ${rupiah(s.received)}\nKembalian: ${rupiah(s.change)}\n\nTerima kasih!`)}function exportCSV(){if(!requireOwner('Ekspor riwayat hanya dapat dilakukan pemilik.'))return;if(!sales.length){showToast('Belum ada data untuk diekspor');return}let rows=[['ID Transaksi','Tanggal','Pelanggan','Metode','Item','Subtotal','Diskon','Total','Diterima','Kembalian'],...sales.map(s=>[s.id,new Date(s.date).toLocaleString('id-ID'),s.customer,s.method,s.items.map(i=>`${i.name} x${i.qty}`).join('; '),s.subtotal,s.discount,s.total,s.received,s.change])];let csv='\ufeff'+rows.map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\r\n');let a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));a.download='laporan-kasir-triyaki-'+dateKey()+'.csv';a.click();URL.revokeObjectURL(a.href);showToast('Laporan CSV berhasil diekspor')}
function paidPurchases(list){return list.filter(p=>p.method!=='Belum dibayar / utang')}function sumSales(list){return list.reduce((n,x)=>n+(Number(x.total)||0),0)}function sumPurchases(list){return paidPurchases(list).reduce((n,x)=>n+(Number(x.amount)||0),0)}
function renderPurchases(){let rows=[...purchases].sort((a,b)=>b.date.localeCompare(a.date));document.getElementById('purchaseRows').innerHTML=rows.length?rows.map(p=>`<tr><td>${p.day}</td><td><b>${esc(p.name)}</b><br><small>${esc(p.category)}${p.note?' · '+esc(p.note):''}</small></td><td><span class="tag ${p.method==='Tunai'?'cash':''}">${esc(p.method)}</span></td><td><b>${rupiah(p.amount)}</b></td></tr>`).join(''):'<tr><td colspan="4" class="empty-row">Belum ada pembelian atau pengeluaran.</td></tr>'}
document.getElementById('purchaseForm').addEventListener('submit',function(e){e.preventDefault();let amount=Number(document.getElementById('purchaseAmount').value);if(!Number.isFinite(amount)||amount<=0){showToast('Nominal harus lebih dari Rp0');return}let day=document.getElementById('purchaseDate').value;if(!day){showToast('Pilih tanggal transaksi');return}let now=new Date();purchases.unshift({id:'OUT-'+String(Date.now()).slice(-8),date:new Date(day+'T12:00:00').toISOString(),day,name:document.getElementById('purchaseName').value.trim(),category:document.getElementById('purchaseCategory').value,amount,method:document.getElementById('purchaseMethod').value,note:document.getElementById('purchaseNote').value.trim()});persist();this.reset();document.getElementById('purchaseDate').value=dateKey();refreshAll();renderPurchases();showToast('Pembelian/pengeluaran berhasil dicatat');autoSyncAfterChange('pembelian/pengeluaran')});
function exportPurchasesCSV(){if(!requireOwner('Ekspor pengeluaran hanya dapat dilakukan pemilik.'))return;if(!purchases.length){showToast('Belum ada catatan untuk diekspor');return}let rows=[['ID','Tanggal','Nama','Kategori','Nominal','Metode','Catatan'],...purchases.map(p=>[p.id,p.day,p.name,p.category,p.amount,p.method,p.note||''])];let csv='\ufeff'+rows.map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\r\n');let a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));a.download='pembelian-pengeluaran-triyaki-'+dateKey()+'.csv';a.click();URL.revokeObjectURL(a.href);showToast('Data pembelian berhasil diekspor')}
function renderReports(){let today=dateKey(),month=today.slice(0,7),tod=sales.filter(s=>s.day===today),mon=sales.filter(s=>s.day.startsWith(month)),outToday=purchases.filter(p=>p.day===today),outMonth=purchases.filter(p=>p.day.startsWith(month));let income=sumSales(mon),out=sumPurchases(outMonth);document.getElementById('reportToday').textContent=rupiah(sumSales(tod));document.getElementById('reportMonth').textContent=rupiah(income);document.getElementById('reportOutToday').textContent=rupiah(sumPurchases(outToday));document.getElementById('reportOutMonth').textContent=rupiah(out);document.getElementById('reportNetMonth').textContent=rupiah(income-out);document.getElementById('reportAverage').textContent=rupiah(sales.length?sumSales(sales)/sales.length:0);let methods=['Tunai','QRIS','Transfer bank','Kartu debit/kredit'];document.getElementById('paymentSummary').innerHTML=methods.map(m=>{let a=mon.filter(s=>s.method===m);return `<div class="total-line" style="padding:12px 0;border-bottom:1px solid var(--line)"><span>${m} <small>(${a.length} transaksi)</small></span><b>${rupiah(sumSales(a))}</b></div>`}).join('')}
function refreshAll(){let today=dateKey(),month=today.slice(0,7),tod=sales.filter(s=>s.day===today),mon=sales.filter(s=>s.day&&s.day.startsWith(month)),outToday=purchases.filter(p=>p.day===today),outMonth=purchases.filter(p=>p.day&&p.day.startsWith(month)),cash=tod.filter(s=>s.method==='Tunai'),digital=tod.filter(s=>s.method!=='Tunai'),inToday=sumSales(tod),out=sumPurchases(outToday);document.getElementById('currentMonthLabel').textContent='Ringkasan '+new Intl.DateTimeFormat('id-ID',{month:'long',year:'numeric'}).format(new Date());document.getElementById('dashMonthIncome').textContent=rupiah(sumSales(mon));document.getElementById('dashMonthOut').textContent=rupiah(sumPurchases(outMonth));document.getElementById('dashMonthNet').textContent=rupiah(sumSales(mon)-sumPurchases(outMonth));document.getElementById('todayRevenue').textContent=rupiah(inToday);document.getElementById('todayCount').textContent=tod.length+' transaksi hari ini';document.getElementById('totalCount').textContent=sales.length;document.getElementById('cashRevenue').textContent=rupiah(sumSales(cash));document.getElementById('digitalRevenue').textContent=rupiah(sumSales(digital));document.getElementById('todayOut').textContent=rupiah(out);document.getElementById('todayNet').textContent=rupiah(inToday-out);document.getElementById('todayPurchaseCount').textContent=outToday.length+' catatan';let recent=sales.slice(0,5);document.getElementById('recentTransactions').innerHTML=recent.length?recent.map(s=>`<div class="cart-row"><div class="name"><b>${esc(s.customer)}</b><small>${s.id} · ${new Date(s.date).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})} · ${s.method}</small></div><b>${rupiah(s.total)}</b></div>`).join(''):'<div class="cart-empty">Transaksi Anda akan muncul di sini.</div>';renderProducts();renderHistory();renderPurchases();renderReports()}

/* Manajemen Menu & Harga */
function createProductEditCard(id,name,price,emoji){
  return `<div class="product-edit-card" data-id="${esc(id)}"><div style="display:flex;gap:8px;align-items:center"><input class="input emoji-edit" type="text" value="${esc(emoji||'🍽️')}" style="width:46px;text-align:center;padding:8px 4px;font-size:18px" title="Emoji / Ikon" maxlength="4"><input class="input name-edit" type="text" value="${esc(name)}" placeholder="Nama menu..." style="flex:1;font-weight:600;padding:9px 12px"><button type="button" class="delete-btn" onclick="removeProductRow(this)" title="Hapus menu" style="padding:8px 10px;font-size:12px;border:0;cursor:pointer">✕</button></div><div style="display:flex;gap:8px;align-items:center"><span style="font-size:11px;font-weight:700;color:var(--muted);min-width:65px">Harga (Rp):</span><input class="input price-edit" type="number" min="0" step="500" value="${price}" placeholder="Harga jual" style="flex:1;padding:8px 12px"></div><div style="display:flex;gap:8px;align-items:center"><span style="font-size:11px;font-weight:700;color:var(--muted);min-width:65px">Kode menu:</span><input class="input code-edit" type="text" value="${esc(id)}" maxlength="20" placeholder="mis. M009" autocapitalize="characters" autocomplete="off" style="flex:1;padding:8px 12px;font-family:ui-monospace,Consolas,monospace;font-weight:700"></div></div>`;
}
function editProducts(){
  if(!requireOwner('Hanya pemilik yang dapat mengubah menu dan harga.'))return;
  const container=document.getElementById('productEditFields');
  container.innerHTML=products.map(p=>createProductEditCard(p.id,p.name,p.price,p.emoji)).join('');
  document.getElementById('productModal').classList.add('show');
}
function nextMenuCode(){const used=new Set();products.forEach(p=>used.add(String(p.id).toUpperCase()));document.querySelectorAll('#productEditFields .code-edit').forEach(i=>used.add(i.value.trim().toUpperCase()));let n=1,c;do{c='M'+String(n).padStart(3,'0');n++}while(used.has(c));return c}
function addProductRow(name='',price=15000,emoji='🍛'){
  const newId=nextMenuCode();
  const container=document.getElementById('productEditFields');
  const temp=document.createElement('div');
  temp.innerHTML=createProductEditCard(newId,name,price,emoji);
  const card=temp.firstElementChild;
  container.appendChild(card);
  card.scrollIntoView({behavior:'smooth',block:'nearest'});
  const nameInput=card.querySelector('.name-edit');
  if(nameInput)nameInput.focus();
}
function removeProductRow(btn){
  const cards=document.querySelectorAll('#productEditFields .product-edit-card');
  if(cards.length<=1){
    showToast('Minimal harus ada 1 menu');
    return;
  }
  const card=btn.closest('.product-edit-card');
  if(card)card.remove();
}
function resetDefaultProducts(){
  if(!confirm('Isi formulir dengan daftar menu bawaan awal?'))return;
  const container=document.getElementById('productEditFields');
  container.innerHTML=DEFAULT_PRODUCTS.map(p=>createProductEditCard(p.id,p.name,p.price,p.emoji)).join('');
  showToast('Formulir diisi dengan menu bawaan awal');
}
function closeProductModal(){
  document.getElementById('productModal').classList.remove('show');
}
function saveProductPrices(){
  const cards=document.querySelectorAll('#productEditFields .product-edit-card');
  const updated=[];
  const codeList=[];
  let hasEmptyName=false;
  cards.forEach(card=>{
    const origId=card.dataset.id;
    const codeInput=card.querySelector('.code-edit');
    let id=codeInput?codeInput.value.trim():origId;
    if(id!==origId)id=id.toUpperCase();
    codeList.push({origId,id,card});
    const nameInput=card.querySelector('.name-edit');
    const priceInput=card.querySelector('.price-edit');
    const emojiInput=card.querySelector('.emoji-edit');
    const name=nameInput?nameInput.value.trim():'';
    const price=priceInput?Math.max(0,Number(priceInput.value)||0):0;
    const emoji=emojiInput&&emojiInput.value.trim()?emojiInput.value.trim():'🍽️';
    if(!name){
      hasEmptyName=true;
    }else{
      updated.push({id,name,price,emoji});
    }
  });
  if(hasEmptyName){
    showToast('Nama menu tidak boleh ada yang kosong');
    return;
  }
  if(updated.length===0){
    showToast('Minimal harus ada 1 menu yang disimpan');
    return;
  }
  const seenCodes=new Set();
  for(const c of codeList){
    if(!/^[A-Za-z0-9_-]{1,20}$/.test(c.id)){showToast('Kode menu hanya boleh huruf, angka, - dan _ (tanpa spasi), maks. 20 karakter');const el=c.card.querySelector('.code-edit');if(el)el.focus();return}
    const k=c.id.toUpperCase();
    if(seenCodes.has(k)){showToast('Kode menu "'+c.id+'" dipakai dua kali. Setiap kode harus unik');const el=c.card.querySelector('.code-edit');if(el)el.focus();return}
    seenCodes.add(k);
  }
  const renamed={};codeList.forEach(c=>{if(c.origId!==c.id)renamed[c.origId]=c.id});
  const newCart={};for(const id in cart){const nid=renamed[id]||id;newCart[nid]=(newCart[nid]||0)+cart[id]}cart=newCart;
  products=updated;
  for(let id in cart){if(!products.some(p=>p.id===id))delete cart[id];}
  persist();
  closeProductModal();
  renderProducts();
  renderCart();
  refreshAll();
  showToast('Menu dan harga berhasil diperbarui!');
  autoSyncAfterChange('perubahan menu/harga');
}
document.getElementById('productModal').addEventListener('click',function(e){if(e.target===this)closeProductModal()});

/* Tutup buku, arsip bulanan, dan cadangan data. Tidak menghapus transaksi. */
function downloadBlob(filename,content,type){const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function createBackupObject(){return {app:'Triyakita Kasir',schemaVersion:2,createdAt:new Date().toISOString(),note:'Cadangan ini hanya untuk data lokal Triyakita Kasir. Memulihkan file tidak mengubah Google Sheets.',products,sales,purchases,monthlyArchives}}
function downloadBackup(){if(!requireOwner('Cadangan data hanya dapat diunduh pemilik.'))return;const backup=createBackupObject();downloadBlob('Triyakita-Kasir-Cadangan-'+dateKey()+'.json',JSON.stringify(backup,null,2),'application/json;charset=utf-8');showToast('Cadangan data berhasil diunduh')}
function exportExcelWorkbook(){
  if(!requireOwner('Ekspor Excel hanya dapat dilakukan pemilik.'))return;
  const escXml=v=>String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const sheet=(name,headers,rows)=>`<Worksheet ss:Name="${escXml(name)}"><Table><Row>${headers.map(h=>`<Cell><Data ss:Type="String">${escXml(h)}</Data></Cell>`).join('')}</Row>${rows.map(row=>`<Row>${row.map(v=>`<Cell><Data ss:Type="${typeof v==='number'&&Number.isFinite(v)?'Number':'String'}">${escXml(v)}</Data></Cell>`).join('')}</Row>`).join('')}</Table></Worksheet>`;
  const saleRows=sales.map(s=>[s.id,new Date(s.date).toLocaleString('id-ID'),s.customer,s.method,s.subtotal,s.discount,s.total,s.received,s.change]);
  const itemRows=sales.flatMap(s=>(s.items||[]).map(i=>[s.id,new Date(s.date).toLocaleDateString('id-ID'),i.name,i.qty,i.price,i.qty*i.price]));
  const purchaseRows=purchases.map(p=>[p.id,p.day,p.name,p.category,p.amount,p.method,p.note||'']);
  const productRows=products.map(p=>[p.id,p.name,p.price,p.emoji||'']);
  const archiveRows=monthlyArchives.map(a=>[a.month,a.label,a.salesCount,a.purchasesCount,a.income,a.out,a.net,a.closedAt]);
  const xml=`<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Penjualan"><Table>${sheet('Penjualan',['ID Transaksi','Waktu','Pelanggan','Metode','Subtotal','Diskon','Total','Diterima','Kembalian'],saleRows).split('<Table>')[1].split('</Table>')[0]}</Table></Worksheet>${sheet('Detail Item',['ID Transaksi','Tanggal','Nama Menu','Jumlah','Harga Satuan','Total Item'],itemRows)}${sheet('Pembelian',['ID','Tanggal','Nama','Kategori','Nominal','Metode','Catatan'],purchaseRows)}${sheet('Menu',['Kode Menu','Nama Menu','Harga','Ikon'],productRows)}${sheet('Arsip Bulanan',['Bulan','Label','Jumlah Transaksi','Jumlah Pengeluaran','Uang Masuk','Uang Keluar','Arus Kas Bersih','Waktu Tutup Buku'],archiveRows)}</Workbook>`;
  downloadBlob('Triyakita-Kasir-Excel-'+dateKey()+'.xls',xml,'application/vnd.ms-excel;charset=utf-8');showToast('File Excel berhasil dibuat');
}
function closeMonthlyBooks(){if(!requireOwner('Tutup buku hanya dapat dilakukan pemilik.'))return;const month=dateKey().slice(0,7);const label=new Intl.DateTimeFormat('id-ID',{month:'long',year:'numeric'}).format(new Date());const income=sumSales(sales),out=sumPurchases(purchases);if(!sales.length&&!purchases.length){showToast('Belum ada data untuk ditutup');return}if(!confirm('TUTUP BUKU '+label+'?\n\nPenjualan: '+sales.length+' transaksi ('+rupiah(income)+')\nPengeluaran: '+purchases.length+' catatan ('+rupiah(out)+')\nArus kas bersih: '+rupiah(income-out)+'\n\nYang akan terjadi:\n1. File cadangan diunduh otomatis.\n2. Ringkasan dan rincian disimpan di Riwayat Arsip.\n3. Dashboard, transaksi, pembelian, dan laporan kembali ke NOL.\n\nMenu & harga tidak berubah.\n4. Jika URL Google Sheets sudah disimpan: data terakhir dikirim, salinan arsip dibuat di Google Drive Anda, lalu tab data di Sheets dikosongkan.\n\nLanjutkan?'))return;downloadBackup();const archive={month,label,closedAt:new Date().toISOString(),salesCount:sales.length,purchasesCount:purchases.length,income,out,net:income-out,saleIds:sales.map(s=>s.id),purchaseIds:purchases.map(p=>p.id),salesData:sales,purchasesData:purchases};const existing=monthlyArchives.find(a=>a.month===month);if(existing){archive.salesCount+=existing.salesCount||0;archive.purchasesCount+=existing.purchasesCount||0;archive.income+=existing.income||0;archive.out+=existing.out||0;archive.net=archive.income-archive.out;archive.saleIds=(existing.saleIds||[]).concat(archive.saleIds);archive.purchaseIds=(existing.purchaseIds||[]).concat(archive.purchaseIds);archive.salesData=(existing.salesData||[]).concat(archive.salesData);archive.purchasesData=(existing.purchasesData||[]).concat(archive.purchasesData);monthlyArchives=monthlyArchives.map(a=>a.month===month?archive:a)}else monthlyArchives.unshift(archive);sales=[];purchases=[];cart={};persist();try{renderCart()}catch(e){}refreshAll();try{renderHistory();renderPurchases();renderReports()}catch(e){}showArchiveHistory();showToast('Tutup buku selesai. Semua data kembali nol.');clearSheetsAfterClose(month,label,{sales:archive.salesData,purchases:archive.purchasesData})}
async function clearSheetsAfterClose(month,label,src){const url=localStorage.getItem('tri_sheets_url');if(!url)return;const post=body=>fetch(url,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(body)});try{showToast('Mengirim data terakhir ke Google Sheets…');await post(buildSheetsPayload(src));await post({schema:2,action:'tutupBuku',month,label});showToast('Perintah kosongkan Google Sheets dikirim. Periksa Sheet Anda.')}catch(e){showToast('Google Sheets tidak terjangkau. Data aplikasi sudah nol, Sheets belum dikosongkan.')}}
function showArchiveHistory(){if(!requireOwner('Arsip bulanan hanya dapat dibuka pemilik.'))return;const box=document.getElementById('archiveHistory');box.style.display='block';if(!monthlyArchives.length){box.innerHTML='<b>Belum ada arsip tutup buku.</b><br>Gunakan tombol Tutup Buku Bulanan untuk menyimpan ringkasan bulan berjalan.';return}box.innerHTML='<b>Riwayat arsip bulanan</b>'+monthlyArchives.slice().sort((a,b)=>b.month.localeCompare(a.month)).map(a=>`<div style="padding:10px 0;border-top:1px solid #f0e5ca;margin-top:8px"><b>${esc(a.label)}</b><br>Uang masuk: ${rupiah(a.income)} · Uang keluar: ${rupiah(a.out)} · Arus kas bersih: <b>${rupiah(a.net)}</b><br><small>${a.salesCount} transaksi penjualan · ${a.purchasesCount} catatan pengeluaran</small></div>`).join('')+'<button class="small-btn" style="margin-top:8px" onclick="exportArchives()">Unduh arsip JSON</button>'}
function exportArchives(){downloadBlob('arsip-bulanan-triyak itak asir'.replaceAll(' ','')+'-'+dateKey()+'.json',JSON.stringify(monthlyArchives,null,2),'application/json;charset=utf-8');showToast('Arsip bulanan diunduh')}

/* Pulihkan / gabungkan file JSON. Tidak menyentuh Google Sheets atau URL integrasi. */
let selectedBackupData=null;
const backupFileInput=document.getElementById('backupFile');
const backupPreview=document.getElementById('backupPreview');
const restoreReplaceButton=document.getElementById('restoreReplace');
const restoreMergeButton=document.getElementById('restoreMerge');
function backupArraysAreValid(data){return data&&typeof data==='object'&&!Array.isArray(data)&&Array.isArray(data.products)&&Array.isArray(data.sales)&&Array.isArray(data.purchases)&&(data.monthlyArchives===undefined||Array.isArray(data.monthlyArchives));}
function validateBackupRecords(data){
  if(!backupArraysAreValid(data))return 'Format file tidak sesuai. Pilih file cadangan JSON dari Triyakita Kasir.';
  if(!data.products.every(x=>x&&typeof x==='object'&&x.id!==undefined&&typeof x.name==='string'&&Number.isFinite(Number(x.price))))return 'Daftar menu di dalam file tidak valid.';
  if(!data.sales.every(x=>x&&typeof x==='object'&&x.id!==undefined&&x.day!==undefined&&Number.isFinite(Number(x.total))))return 'Data penjualan di dalam file tidak valid.';
  if(!data.purchases.every(x=>x&&typeof x==='object'&&x.id!==undefined&&x.day!==undefined&&Number.isFinite(Number(x.amount))))return 'Data pembelian/pengeluaran di dalam file tidak valid.';
  if(data.monthlyArchives!==undefined&&!data.monthlyArchives.every(x=>x&&typeof x==='object'))return 'Data arsip bulanan di dalam file tidak valid.';
  return '';
}
backupFileInput.addEventListener('change',async function(){
  selectedBackupData=null;restoreReplaceButton.disabled=true;restoreMergeButton.disabled=true;backupPreview.style.display='block';
  const file=this.files&&this.files[0];if(!file){backupPreview.textContent='Belum ada file yang dipilih.';return;}
  if(file.size>25*1024*1024){backupPreview.textContent='Ukuran file terlalu besar (maksimal 25 MB).';return;}
  try{const parsed=JSON.parse(await file.text());const problem=validateBackupRecords(parsed);if(problem){backupPreview.textContent='❌ '+problem;return;}
    selectedBackupData=parsed;restoreReplaceButton.disabled=false;restoreMergeButton.disabled=false;
    const created=parsed.createdAt?new Date(parsed.createdAt):null;const when=created&&!Number.isNaN(created.getTime())?created.toLocaleString('id-ID'):'tanggal tidak dicantumkan';
    backupPreview.innerHTML='<b>✅ File cadangan terbaca</b><br>Nama file: '+esc(file.name)+'<br>Tanggal cadangan: '+esc(when)+'<br>Menu: '+parsed.products.length+' · Penjualan: '+parsed.sales.length+' transaksi · Pembelian/pengeluaran: '+parsed.purchases.length+' catatan · Arsip bulanan: '+(parsed.monthlyArchives||[]).length+'<br><br><b>Pilih salah satu:</b> “Pulihkan” mengganti data lokal saat ini dengan data dalam file; “Gabungkan” menambahkan data yang ID-nya belum ada.';
  }catch(e){backupPreview.textContent='❌ File tidak dapat dibaca sebagai JSON. Pastikan file tidak rusak dan berasal dari tombol Unduh Cadangan Data.';}
});
function mergeUniqueById(current,incoming){const map=new Map();(current||[]).forEach(x=>{if(x&&x.id!==undefined)map.set(String(x.id),x)});(incoming||[]).forEach(x=>{if(x&&x.id!==undefined&&!map.has(String(x.id)))map.set(String(x.id),x)});return Array.from(map.values())}
function mergeArchives(current,incoming){const map=new Map();(current||[]).forEach(x=>{if(x&&x.month)map.set(String(x.month),x)});(incoming||[]).forEach(x=>{if(x&&x.month&&!map.has(String(x.month)))map.set(String(x.month),x)});return Array.from(map.values()).sort((a,b)=>String(b.month).localeCompare(String(a.month)))}
function restoreBackup(mode){
  if(!requireOwner('Pemulihan data hanya dapat dilakukan pemilik.'))return;
  if(!selectedBackupData){showToast('Pilih dan periksa file JSON terlebih dahulu');return;}
  const data=selectedBackupData;const currentCount=sales.length+purchases.length;const incomingCount=data.sales.length+data.purchases.length;
  if(mode==='replace'){
    const msg='Anda akan MENGGANTI data lokal Triyakita Kasir dengan isi file cadangan.\n\nIsi file: '+data.sales.length+' transaksi dan '+data.purchases.length+' catatan pengeluaran.\nData lokal saat ini: '+sales.length+' transaksi dan '+purchases.length+' catatan pengeluaran.\n\nData Google Sheets tidak akan dihapus atau diubah. URL Google Sheets yang tersimpan juga tetap dipertahankan.\n\nLanjutkan hanya jika Anda yakin.';
    if(!confirm(msg))return;
    products=data.products;sales=data.sales;purchases=data.purchases;monthlyArchives=data.monthlyArchives||[];
  }else{
    if(!confirm('Gabungkan data dari file dengan data lokal saat ini? Data dengan ID yang sudah ada tidak akan ditambahkan ulang. Menu/arsip dengan ID/bulan yang sama akan mempertahankan versi lokal. Google Sheets tidak diubah.'))return;
    products=mergeUniqueById(products,data.products);sales=mergeUniqueById(sales,data.sales);purchases=mergeUniqueById(purchases,data.purchases);monthlyArchives=mergeArchives(monthlyArchives,data.monthlyArchives||[]);
  }
  try{persist();clearCart();refreshAll();renderCart();backupPreview.innerHTML='<b>✅ Pemulihan selesai.</b><br>Data lokal berhasil diperbarui. Google Sheets tidak disentuh. Periksa Dashboard, Transaksi, Pembelian, dan Menu sebelum melakukan sinkronisasi.';showToast(mode==='replace'?'Data lokal berhasil dipulihkan':'Data berhasil digabungkan');}
  catch(e){backupPreview.innerHTML='<b>⚠️ Pemulihan belum tersimpan sepenuhnya.</b><br>Penyimpanan browser mungkin penuh atau dibatasi. Jangan tutup aplikasi; unduh cadangan dan periksa penyimpanan browser.';showToast('Gagal menyimpan data hasil pemulihan');}
}
restoreReplaceButton.addEventListener('click',()=>restoreBackup('replace'));
restoreMergeButton.addEventListener('click',()=>restoreBackup('merge'));

/* Integrasi Google Sheets */
function loadSheetsUrl(){const saved=localStorage.getItem('tri_sheets_url')||'';const input=document.getElementById('sheetsUrl');if(input)input.value=saved;}
document.getElementById('saveSheetsUrl').addEventListener('click',()=>{if(!requireOwner('Pengaturan Google Sheets hanya dapat diubah pemilik.'))return;const url=document.getElementById('sheetsUrl').value.trim();if(url&&!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(url)){document.getElementById('sheetsStatus').textContent='URL belum sesuai. Gunakan URL Web App Google Apps Script yang berakhiran /exec.';return}if(!url){document.getElementById('sheetsStatus').textContent='Masukkan URL Web App terlebih dahulu.';return}localStorage.setItem('tri_sheets_url',url);document.getElementById('sheetsStatus').textContent='URL tersimpan di browser ini. Anda dapat mengirim data kapan saja.';showToast('URL Google Sheets tersimpan');});
let sheetsAutoSyncRunning=false;
async function autoSyncAfterChange(reason='perubahan data',silent=false){
  const url=localStorage.getItem('tri_sheets_url')||'';
  if(!url)return;
  if(!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(url)){
    localStorage.setItem('tri_sheets_pending','1');
    const status=document.getElementById('sheetsStatus');if(status)status.textContent='Data tersimpan di perangkat, tetapi URL Google Sheets perlu diperiksa.';
    if(!silent)showToast('Data tersimpan lokal; periksa URL Google Sheets');return;
  }
  if(!navigator.onLine){localStorage.setItem('tri_sheets_pending','1');
    const status=document.getElementById('sheetsStatus');if(status)status.textContent='Internet sedang offline. Perubahan disimpan di perangkat dan akan dikirim otomatis saat koneksi kembali.';
    if(!silent)showToast('Data tersimpan lokal; menunggu internet untuk sinkronisasi');return;
  }
  if(sheetsAutoSyncRunning){localStorage.setItem('tri_sheets_pending','1');return;}
  sheetsAutoSyncRunning=true;
  try{
    await fetch(url,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(buildSheetsPayload())});
    localStorage.removeItem('tri_sheets_pending');
    const status=document.getElementById('sheetsStatus');if(status)status.textContent='Pengiriman otomatis untuk '+reason+' sudah dimulai. Browser tidak dapat membaca konfirmasi akhir; periksa Google Sheets untuk memastikan data masuk.';
    if(!silent)showToast('Perubahan tersimpan · pengiriman otomatis ke Sheets dimulai');
  }catch(err){
    localStorage.setItem('tri_sheets_pending','1');
    const status=document.getElementById('sheetsStatus');if(status)status.textContent='Sinkronisasi otomatis gagal dimulai. Data tetap aman di perangkat dan akan dicoba lagi saat internet kembali.';
    if(!silent)showToast('Data aman tersimpan lokal; sinkronisasi akan dicoba lagi saat online');
  }finally{
    sheetsAutoSyncRunning=false;
    if(localStorage.getItem('tri_sheets_pending')==='1'&&navigator.onLine){setTimeout(()=>autoSyncAfterChange('perubahan data tertunda',true),1200);}
  }
}
window.addEventListener('online',()=>{if(localStorage.getItem('tri_sheets_url')){showToast('Internet kembali tersedia · mencoba sinkronisasi otomatis');autoSyncAfterChange('data tertunda',true);}});
function buildSheetsPayload(src){const S=(src&&src.sales)||sales,P=(src&&src.purchases)||purchases;
const pad=n=>String(n).padStart(2,'0');
const stamp=iso=>{const d=new Date(iso);return isNaN(d)?'':d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+' '+pad(d.getHours())+':'+pad(d.getMinutes())+':'+pad(d.getSeconds())};
const dayOnly=iso=>{const d=new Date(iso);return isNaN(d)?'':d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())};
const seen=new Set(),allSales=[],seenP=new Set(),allPur=[];
const addS=x=>{if(x&&x.id&&!seen.has(x.id)){seen.add(x.id);allSales.push(x)}},addP=x=>{if(x&&x.id&&!seenP.has(x.id)){seenP.add(x.id);allPur.push(x)}};
S.forEach(addS);P.forEach(addP);
allSales.sort((a,b)=>String(a.date).localeCompare(String(b.date)));allPur.sort((a,b)=>String(a.date).localeCompare(String(b.date)));
const num=v=>Number(v)||0;
const jual=allSales.map(x=>[String(x.id),stamp(x.date),String(x.customer||'Pelanggan umum'),String(x.method||''),(x.items||[]).map(i=>i.name+' x'+i.qty).join('; '),(x.items||[]).reduce((n,i)=>n+num(i.qty),0),num(x.subtotal),num(x.discount),num(x.total),num(x.received),num(x.change)]);
const detail=[];allSales.forEach(x=>(x.items||[]).forEach(i=>detail.push([String(x.id),stamp(x.date),String(i.id||''),String(i.name||''),num(i.price),num(i.qty),num(i.price)*num(i.qty)])));
const beli=allPur.map(x=>[String(x.id),dayOnly(x.date),String(x.name||''),String(x.category||''),num(x.amount),String(x.method||''),x.method==='Belum dibayar / utang'?'Belum lunas':'Lunas',String(x.note||'')]);
const menu=products.map((p,i)=>[i+1,String(p.id||''),String(p.emoji||''),String(p.name||''),num(p.price)]);
const months={};const mo=k=>months[k]||(months[k]={n:0,omzet:0,disc:0,out:0});
allSales.forEach(x=>{const k=(x.day||dayOnly(x.date)).slice(0,7),m=mo(k);m.n++;m.omzet+=num(x.total);m.disc+=num(x.discount)});
allPur.forEach(x=>{if(x.method==='Belum dibayar / utang')return;const k=(x.day||dayOnly(x.date)).slice(0,7);mo(k).out+=num(x.amount)});
const ringkas=Object.keys(months).sort().map(k=>{const m=months[k];return [k,m.n,m.omzet,m.disc,m.out,m.omzet-m.out]});
return {app:'Triyakita Kasir',schema:2,sentAt:new Date().toISOString(),tables:[
{name:'Penjualan',mode:'append',key:0,sort:{col:1,desc:true},headers:['ID Transaksi','Tanggal & Jam','Pelanggan','Metode Bayar','Rincian Item','Jumlah Item','Subtotal','Diskon','Total','Diterima','Kembalian'],formats:['text','datetime','text','text','text','int','rupiah','rupiah','rupiah','rupiah','rupiah'],widths:[150,150,150,120,320,90,110,100,120,110,110],rows:jual},
{name:'Detail Item',mode:'append',key:[0,2],sort:{col:1,desc:true},headers:['ID Transaksi','Tanggal & Jam','Kode Menu','Menu','Harga Satuan','Qty','Subtotal'],formats:['text','datetime','text','text','rupiah','int','rupiah'],widths:[150,150,100,260,120,70,120],rows:detail},
{name:'Pembelian',mode:'append',key:0,sort:{col:1,desc:true},headers:['ID Pembelian','Tanggal','Keperluan','Kategori','Jumlah','Metode Bayar','Status','Catatan'],formats:['text','date','text','text','rupiah','text','text','text'],widths:[130,110,240,140,120,170,110,260],rows:beli},
{name:'Ringkasan Bulanan',mode:'upsert',key:0,sort:{col:0,desc:true},headers:['Bulan','Jumlah Transaksi','Omzet','Total Diskon','Pengeluaran','Arus Kas Bersih'],formats:['text','int','rupiah','rupiah','rupiah','rupiah'],widths:[100,130,140,130,140,150],rows:ringkas},
{name:'Menu',mode:'replace',key:null,sort:null,headers:['No','Kode Menu','Ikon','Nama Menu','Harga'],formats:['int','text','text','text','rupiah'],widths:[50,100,60,300,120],rows:menu}
]}}
document.getElementById('syncSheets').addEventListener('click',async()=>{if(!requireOwner('Pengiriman ke Google Sheets hanya dapat dilakukan pemilik.'))return;const url=(localStorage.getItem('tri_sheets_url')||document.getElementById('sheetsUrl').value.trim());if(!url){document.getElementById('sheetsStatus').textContent='Simpan URL Web App terlebih dahulu.';return}if(!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(url)){document.getElementById('sheetsStatus').textContent='URL tidak valid. Pastikan URL berakhiran /exec.';return}const status=document.getElementById('sheetsStatus');status.textContent='Mengirim data… Jangan tutup aplikasi dulu.';const payload=buildSheetsPayload();try{await fetch(url,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload)});status.textContent='Permintaan pengiriman sudah dikirim. Karena pembatasan keamanan browser, aplikasi tidak dapat membaca konfirmasi dari Google. Buka spreadsheet dan periksa tab Penjualan, Detail Item, Pembelian, Ringkasan Bulanan, dan Menu untuk memastikan data masuk.';showToast('Permintaan sinkronisasi dikirim');}catch(err){status.textContent='Pengiriman gagal dimulai. Periksa koneksi internet, URL Web App, dan pengaturan deployment Apps Script.';showToast('Sinkronisasi gagal');}});

/* Ambil data dari Google Sheets menggunakan JSONP agar tidak terhalang CORS. */
function readSheetsJsonp(url, timeoutMs=25000){return new Promise((resolve,reject)=>{const cb='triSheetsCb_'+Date.now()+'_'+Math.random().toString(36).slice(2);const script=document.createElement('script');let done=false;const timer=setTimeout(()=>finish(new Error('Waktu tunggu habis. Periksa URL/deployment Apps Script.')),timeoutMs);function finish(err,data){if(done)return;done=true;clearTimeout(timer);try{delete window[cb]}catch(e){window[cb]=undefined}script.remove();err?reject(err):resolve(data)}window[cb]=data=>finish(null,data);script.onerror=()=>finish(new Error('Gagal menghubungi Google Sheets. Periksa URL dan deployment.'));script.src=url+(url.includes('?')?'&':'?')+'action=read&callback='+encodeURIComponent(cb)+'&t='+Date.now();document.head.appendChild(script);});}
function parseServerDate(v, dateOnly=false){if(v instanceof Date)return v.toISOString();if(typeof v==='number'&&v>20000&&v<100000){return new Date(Date.UTC(1899,11,30)+v*86400000).toISOString()}const s=String(v||'').trim();if(!s)return new Date().toISOString();let d=new Date(s);if(!isNaN(d))return d.toISOString();const m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);if(m){d=new Date(+m[3],+m[2]-1,+m[1],+(m[4]||0),+(m[5]||0),+(m[6]||0));if(!isNaN(d))return d.toISOString()}return s}
function rowsOf(data,name){return data&&data.tables&&Array.isArray(data.tables[name])?data.tables[name]:null}
document.getElementById('refreshSheets').addEventListener('click',async()=>{if(!requireOwner('Ambil data server hanya dapat dilakukan pemilik.'))return;const url=localStorage.getItem('tri_sheets_url')||document.getElementById('sheetsUrl').value.trim();const status=document.getElementById('sheetsStatus');if(!url){status.textContent='Simpan URL Web App Google Apps Script terlebih dahulu.';return}const btn=document.getElementById('refreshSheets');btn.disabled=true;btn.textContent='⏳ Mengambil data…';status.textContent='Mengambil data terbaru dari Google Sheets. Jangan tutup aplikasi…';try{const result=await readSheetsJsonp(url);if(!result||!result.ok||!result.tables)throw new Error((result&&result.error)||'Respons server tidak sesuai. Pastikan Apps Script sudah diperbarui ke versi terbaru.');
 const saleRows=rowsOf(result,'Penjualan'),detailRows=rowsOf(result,'Detail Item'),purRows=rowsOf(result,'Pembelian'),menuRows=rowsOf(result,'Menu');
 if(saleRows){const details={};(detailRows||[]).forEach(r=>{const id=String(r[0]||'');(details[id]||(details[id]=[])).push({id:String(r[2]||''),name:String(r[3]||''),price:Number(r[4])||0,qty:Number(r[5])||0})});sales=saleRows.filter(r=>r&&r[0]).map(r=>{const id=String(r[0]),items=details[id]||[];return{id,date:parseServerDate(r[1]),customer:String(r[2]||'Pelanggan umum'),method:String(r[3]||''),items,subtotal:Number(r[6])||0,discount:Number(r[7])||0,total:Number(r[8])||0,received:Number(r[9])||0,change:Number(r[10])||0}}).sort((a,b)=>String(b.date).localeCompare(String(a.date)));}
 if(purRows){purchases=purRows.filter(r=>r&&r[0]).map(r=>({id:String(r[0]),date:parseServerDate(r[1],true),name:String(r[2]||''),category:String(r[3]||''),amount:Number(r[4])||0,method:String(r[5]||''),note:String(r[7]||'')})).sort((a,b)=>String(b.date).localeCompare(String(a.date)));}
 if(menuRows&&menuRows.length){products=menuRows.filter(r=>r&&r[1]).map(r=>({id:String(r[1]),emoji:String(r[2]||'🍽️'),name:String(r[3]||''),price:Number(r[4])||0}));}
 persist();refreshAll();renderCart();status.textContent='Berhasil mengambil data dari server pada '+new Date().toLocaleString('id-ID')+'. Penjualan: '+sales.length+'; pengeluaran: '+purchases.length+'; menu: '+products.length+'.';showToast('Data server berhasil diperbarui');
 }catch(e){status.textContent='Gagal mengambil data server: '+(e.message||e)+'. Data lokal tidak diubah jika pembacaan server gagal.';showToast('Gagal refresh dari server')}finally{btn.disabled=false;btn.textContent='🔄 Ambil data dari server'}});

applyAppName();loadSheetsUrl();refreshAll();renderCart();initAuth();

/* Tombol Segarkan + status koneksi */
(function(){
  const pill=document.getElementById('connectionStatus');
  function updateConnection(){
    if(!pill)return;
    const on=navigator.onLine;
    pill.textContent=on?'● Online':'● Offline';
    pill.classList.toggle('offline',!on);
  }
  window.addEventListener('online',updateConnection);
  window.addEventListener('offline',updateConnection);
  updateConnection();
  const btn=document.getElementById('refreshAppButton');
  if(btn){
    btn.addEventListener('click',async function(){
      btn.disabled=true;
      const old=btn.textContent;
      btn.textContent='Menyegarkan...';
      try{
        products=load('tri_products',DEFAULT_PRODUCTS);
        sales=load('tri_sales',[]);
        purchases=load('tri_purchases',[]);
        monthlyArchives=load('tri_monthly_archives',[]);
        refreshAll();
        renderCart();
        if(window.fbForceSync)await window.fbForceSync();
        updateConnection();
        showToast('Data dan tampilan disegarkan');
      }catch(e){
        showToast('Gagal menyegarkan: '+(e.message||e));
      }finally{
        btn.disabled=false;
        btn.textContent=old;
      }
    });
  }
})();
