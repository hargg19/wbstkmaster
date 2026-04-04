// --- INIT SUPABASE ---
const SUPABASE_URL = "https://vwgdrmyrutsjwnmzfrwv.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3Z2RybXlydXRzandubXpmcnd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3OTMyMjQsImV4cCI6MjA5MDM2OTIyNH0.8abwamRFE-hVpA4Xyy4zcZAbZt-Gm6tYaMDfpkh9-nI";
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let hasAlertedExpired = false; // Harus di luar objek UI/App agar nilainya tersimpan

const Draggable = {
    init: (elId, handleId) => {
        const el = document.getElementById(elId); const handle = document.getElementById(handleId); if (!el || !handle) return;
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0; handle.onmousedown = dragMouseDown;
        function dragMouseDown(e) { e = e || window.event; if(['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(e.target.tagName)) return; e.preventDefault(); pos3 = e.clientX; pos4 = e.clientY; document.onmouseup = closeDragElement; document.onmousemove = elementDrag; handle.style.cursor = 'grabbing'; if(window.getComputedStyle(el).transform !== 'none') { const rect = el.getBoundingClientRect(); el.style.transform = 'none'; el.style.left = rect.left + 'px'; el.style.top = rect.top + 'px'; } }
        function elementDrag(e) { e = e || window.event; e.preventDefault(); pos1 = pos3 - e.clientX; pos2 = pos4 - e.clientY; pos3 = e.clientX; pos4 = e.clientY; el.style.top = (el.offsetTop - pos2) + "px"; el.style.left = (el.offsetLeft - pos1) + "px"; el.style.right = 'auto'; el.style.bottom = 'auto'; el.style.margin = '0'; }
        function closeDragElement() { document.onmouseup = null; document.onmousemove = null; handle.style.cursor = 'grab'; }
    },
    reset: (elId) => { const el = document.getElementById(elId); if(el) { el.style.top = ''; el.style.left = ''; el.style.right = ''; el.style.bottom = ''; el.style.transform = ''; el.style.margin = ''; } }
};

const DB = {
    get: (k) => JSON.parse(localStorage.getItem(k)) || [],
    set: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
    clear: () => localStorage.clear(),
    load: async () => {
        try {
            const [resMaster, resTrx] = await Promise.all([
                // Urutkan master barang berdasarkan nama agar rapi di dropdown
                sb.from('master_barang').select('*').order('nama', { ascending: true }),
                
                // PENTING: Urutkan transaksi berdasarkan ID atau tanggal terbaru (Descending)
                // Ini memastikan ID 221 muncul di paling atas, bukan ID 171 yang terselip
                sb.from('transaksi_log').select('*').order('id', { ascending: false })
            ]);

            if (resMaster.error) throw resMaster.error;
            if (resTrx.error) throw resTrx.error;

            // Simpan ke Cache Lokal
            DB.set('m', resMaster.data || []);
            DB.set('l', resTrx.data || []);
            
            console.log("Data Berhasil di-load. Jumlah Transaksi:", resTrx.data.length);
            
        } catch (err) {
            console.error("Gagal load data Supabase:", err.message);
            UI.showToast("❌ Gagal sinkronisasi data server.");
        }
    },
    subscribe: () => {
        // Mendengarkan semua event (INSERT, UPDATE, DELETE) di kedua tabel
        sb.channel('realtime-db')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'master_barang' }, payload => {
                console.log("Update Master diterima:", payload);
                DB.load().then(() => UI.refresh());
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'transaksi_log' }, payload => {
                console.log("Update Transaksi diterima:", payload);
                DB.load().then(() => UI.refresh());
            })
            .subscribe();
    }
};
window.DB = DB;
const DateHelper = {
    toDB: (str) => { 
        if(!str) return ""; let p = str.split('-'); if(p.length !== 3) return "";
        let y = p[2]; if(y.length === 2) y = "20" + y; 
        return `${y}-${p[1]}-${p[0]}`;
    },
    toUI: (str) => { 
        if(!str) return ""; let p = str.split('-'); if(p.length !== 3) return str;
        return `${p[2]}-${p[1]}-${p[0]}`;
    }
};

const Auth = {
    login: async () => {
        const r = document.getElementById('loginRole').value;
        const p = document.getElementById('adminPass').value; 
        const btn = document.querySelector('#modalLogin .btn-primary'); 
        const originalText = btn.innerText;
        
        if (!p) { alert("Password tidak boleh kosong!"); return; }

        btn.innerText = "Memverifikasi..."; btn.disabled = true;

        try {
            // Terjemahkan role dari dropdown menjadi email Supabase
            const targetEmail = r === 'admin' ? 'admin@stockmaster.local' : 'staff@stockmaster.local';

            const { data, error } = await sb.auth.signInWithPassword({
                email: targetEmail, 
                password: p
            });

            if (error) throw error;

            if (data.session) {
                const role = data.user.user_metadata?.role || (r === 'admin' ? 'admin' : 'staff');
                DB.set('currentUser', { role: role });
                location.reload(); 
            }
        } catch (error) {
            alert("Akses Ditolak! Password Salah.");
            document.getElementById('adminPass').value = '';
            document.getElementById('adminPass').focus();
        }
        
        btn.innerText = originalText; btn.disabled = false;
    },
    applySession: (role) => {
        if(!role || role === 'guest') return; 
        
        const isAdmin = role === 'admin';
        // 1. Tentukan Class Body (Admin/Staff + Dark Mode)
        document.body.className = (isAdmin ? 'admin-mode' : 'staff-mode') + (localStorage.getItem('theme') === 'dark' ? ' dark-mode' : '');
        
        // 2. HAPUS BARIS forEach(.private) yang lama agar tidak memaksa tab muncul kembali.
        // Kita biarkan document.write di HTML yang menentukan tab mana yang tercipta.

        if (!isAdmin) { 
            // Logika khusus Staff
            const btnExport = document.getElementById('btnExportExcel'); 
            if (btnExport) btnExport.style.display = 'none'; 
        } else {
            // Logika khusus Admin
            const sidebar = document.getElementById('sidebar');
            if (sidebar) sidebar.classList.add('mini');
        }
        
        // 3. Kontrol Tombol Auth
        const btnAuth = document.getElementById('btnAuth');
        const btnLogout = document.getElementById('btnLogout');
        if (btnAuth) btnAuth.style.display = 'none'; 
        if (btnLogout) btnLogout.style.display = 'block';

        // 4. Picu Toast Expired
        setTimeout(() => {
            if (typeof UI.renderExpiry === 'function') {
                UI.renderExpiry();
            }
        }, 1000);
    },
    logout: async () => { 
        try {
            await sb.auth.signOut();
            localStorage.removeItem('currentUser'); 
            // Opsional: bersihkan cache log agar benar-benar fresh saat ganti akun
            localStorage.removeItem('l');
            location.reload(); 
        } catch (err) {
            console.error("Logout Error:", err);
            localStorage.clear();
            location.reload();
        }
    }
};

const Engine = {
    calculate: () => {
        const logs = DB.get('l') || []; let res = {};
        // --- Kode Sesudah (Perubahan di Baris 108) ---
    logs.forEach(x => {
            const k = `${x.kode}|${x.batch}`; if(!res[k]) res[k] = {...x, stok: 0};
            // Baris Kunci: Simpan tanggal expired jika tipe transaksi adalah IN
            if(x.tipe === 'IN' && x.exp) res[k].exp = x.exp; 
            x.tipe === 'IN' ? res[k].stok += x.qty : res[k].stok -= x.qty;
            });
        return Object.values(res).filter(x => x.stok > 0);
    }
};

const UI = {
    sortCol: 'kode', sortAsc: true, 
    sortMutasiCol: 'kode', sortMutasiAsc: true,
    sortDayCol: 'tgl', 
    sortDayAsc: false,
    sortDayCol: 'ref', 
    sortDayAsc: true,
    currentFocus: -1,
    
    initFilterDate: () => {
        const now = new Date();
        const y = now.getFullYear(), m = now.getMonth() + 1, d = now.getDate();

        ['f_in', 'f_out'].forEach(pf => {
            const selY = document.getElementById(`${pf}_y`);
            if (selY) {
                selY.innerHTML = Array.from({length: 6}, (_, i) => `<option value="${y-i}">${y-i}</option>`).join('');
                selY.value = y;
            }
            if (document.getElementById(`${pf}_m`)) document.getElementById(`${pf}_m`).value = m;
            if (document.getElementById(`${pf}_d`)) document.getElementById(`${pf}_d`).value = d;
        });

        UI.refresh(); // Render data hari ini segera
    },


    sortDay: (col) => {
        if (UI.sortDayCol === col) {
            UI.sortDayAsc = !UI.sortDayAsc;
        } else {
            UI.sortDayCol = col;
            UI.sortDayAsc = true;
        }
        UI.refresh();
    },
    
    toggleTheme: () => {
        const btn = document.getElementById('btnTheme');
        if (document.body.classList.contains('dark-mode')) {
            document.body.classList.remove('dark-mode');
            localStorage.setItem('theme', 'light');
            if (btn) btn.innerText = '🌙';
        } else {
            document.body.classList.add('dark-mode');
            localStorage.setItem('theme', 'dark');
            if (btn) btn.innerText = '☀️';
        }
    },

    openLogin: () => {
        document.getElementById('loginRole').value = 'staff'; document.getElementById('adminPass').value = '';
        UI.loginUX('staff'); UI.showModal('modalLogin');
    },
    loginUX: (r) => { document.getElementById('adminPassArea').style.display = 'block'; document.getElementById('adminPass').focus(); },

    formatDateInput: (el) => {
    let v = el.value.replace(/\D/g, '');
    if (v.length > 2) v = v.substring(0, 2) + '-' + v.substring(2);
    if (v.length > 5) v = v.substring(0, 5) + '-' + v.substring(5, 9);
    el.value = v;
},

expandDate: (el) => {
    let v = el.value;
    if (v.length === 8) {
        let p = v.split('-');
        if (p.length === 3) {
            const yearSuffix = parseInt(p[2]);
            const fullYear = yearSuffix > 50 ? `19${p[2]}` : `20${p[2]}`;
            el.value = `${p[0]}-${p[1]}-${fullYear}`;
        }
    }
    if (el.id.startsWith('f_')) UI.refresh();
},
    sortStok: (col) => { if (UI.sortCol === col) { UI.sortAsc = !UI.sortAsc; } else { UI.sortCol = col; UI.sortAsc = true; } UI.refresh(); },

  sortDayCol: 'tgl', // default sort
  sortDayAsc: true,

  sortDay: (col) => {
    if (UI.sortDayCol === col) {
        UI.sortDayAsc = !UI.sortDayAsc;
    } else {
        UI.sortDayCol = col;
        UI.sortDayAsc = true;
    }
    UI.refresh();
  },
    sortMutasi: (col) => {
        if (UI.sortMutasiCol === col) { UI.sortMutasiAsc = !UI.sortMutasiAsc; } 
        else { UI.sortMutasiCol = col; UI.sortMutasiAsc = true; }
        UI.refresh();
    },

    showModal: (id) => document.getElementById(id).style.display = 'block',
    closeModal: (id) => document.getElementById(id).style.display = 'none',
    toggleSidebar: () => document.getElementById('sidebar').classList.toggle('mini'),

    switchTab: (tabId, btn) => {
        const session = DB.get('currentUser') || {};
        const isAdmin = session.role === 'admin';

        if (tabId === 'log' && !isAdmin) {
            UI.showToast("⚠️ Akses Dibatasi: Hanya untuk Admin!");
            return;
        }

        // --- LOGIKA SEMBUNYIKAN HEADER GLOBAL ---
        const header = document.getElementById('global-header');
        if (header) {
            // Hanya tampil jika tabId adalah 'stok'
            header.style.display = (tabId === 'stok') ? 'block' : 'none';
        }

        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        
        const target = document.getElementById('tab-' + tabId);
        if (target) {
            target.classList.add('active');
            if (btn) btn.classList.add('active');
            UI.refresh();
        }
    },

    clearFilter: (target) => {
        if(target === 'batch') { document.getElementById('b_f_kode').value = ''; document.getElementById('b_f_nama').value = ''; } 
        else if (target === 'log') {
            document.getElementById('l_f_kode').value = ''; document.getElementById('l_f_nama').value = ''; document.getElementById('f_tipe').value = 'ALL';
            const today = new Date().toISOString().split('T')[0]; const pObj = new Date(); pObj.setDate(pObj.getDate() - 30);
            document.getElementById('f_tgl_1').value = DateHelper.toUI(pObj.toISOString().split('T')[0]); 
            document.getElementById('f_tgl_2').value = DateHelper.toUI(today);
        } UI.refresh();
    },

    // --- script.js ---

  clearFilter: (type) => {
    if (type === 'log') {
        const now = new Date();
        const past = new Date();
        past.setDate(now.getDate() - 30); // Kurangi 30 hari

        // Fungsi pembantu format DD-MM-YYYY
        const fmt = (d) => {
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = d.getFullYear();
            return `${day}-${month}-${year}`;
        };

        const elT1 = document.getElementById('f_tgl_1');
        const elT2 = document.getElementById('f_tgl_2');
        const elKode = document.getElementById('l_f_kode');
        const elTipe = document.getElementById('f_tipe');

        // Set Rentang Tanggal: 30 hari lalu s/d sekarang
        if (elT1) elT1.value = fmt(past);
        if (elT2) elT2.value = fmt(now);
        
        // Reset filter lainnya
        if (elKode) elKode.value = '';
        if (elTipe) elTipe.value = 'ALL';

    } else if (type === 'batch') {
        const ids = ['b_f_kode', 'b_f_nama', 'b_f_stok'];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
    }
    
    UI.refresh(); // Jalankan filter ulang dengan rentang tanggal baru
  },

    showAutoList: (type, formType = '') => {
        const inpId = type === 'k' ? 't_k' : (type === 'n' ? 't_n' : (type === 'b_f_k' ? 'b_f_kode' : (type === 'b_f_n' ? 'b_f_nama' : (type === 'l_f_k' ? 'l_f_kode' : 'l_f_nama'))));
        const listId = inpId === 't_k' ? 't_k_list' : (inpId === 't_n' ? 't_n_list' : type + '_list');
        const inp = document.getElementById(inpId); const listEl = document.getElementById(listId);
        if(!inp || !listEl) return;
        const ms = DB.get('m') || []; const val = inp.value.trim().toUpperCase(); UI.currentFocus = -1; 
        if(val === '') {
            if (['k', 'n'].includes(type)) {
                if (type === 'k') document.getElementById('t_n').value = ''; if (type === 'n') document.getElementById('t_k').value = '';
                if(document.getElementById('t_stk_tot')) document.getElementById('t_stk_tot').value = '';
                if(document.getElementById('t_b_sel')) document.getElementById('t_b_sel').innerHTML = '<option value="">--Pilih Kode--</option>';
            }
            listEl.style.display = 'none'; return;
        }
        const isKode = ['t_k', 'b_f_kode', 'l_f_kode'].includes(inpId);
        const filtered = ms.filter(x => (isKode ? (x.kode||'').toUpperCase() : (x.nama||'').toUpperCase()).includes(val));
        if(filtered.length === 0) { listEl.style.display = 'none'; return; }
        listEl.innerHTML = filtered.map(x => `<div onclick="UI.selectAuto('${x.kode}', '${type}', '${formType}')"><b>${x.kode}</b><br><span style="color:#64748b;">${x.nama}</span></div>`).join('');
        listEl.style.display = 'block';
    },

    handleAutoKey: (e, type, formType) => {
        const inpId = type === 'k' ? 't_k' : (type === 'n' ? 't_n' : (type === 'b_f_k' ? 'b_f_kode' : (type === 'b_f_n' ? 'b_f_nama' : (type === 'l_f_k' ? 'l_f_kode' : 'l_f_nama'))));
        const listId = inpId === 't_k' ? 't_k_list' : (inpId === 't_n' ? 't_n_list' : type + '_list');
        const listEl = document.getElementById(listId);
        if(!listEl || listEl.style.display === 'none') return;
        let items = listEl.getElementsByTagName('div'); if(!items || items.length === 0) return;
        if (e.key === 'ArrowDown') { e.preventDefault(); UI.currentFocus++; UI.addActive(items); } 
        else if (e.key === 'ArrowUp') { e.preventDefault(); UI.currentFocus--; UI.addActive(items); } 
        else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); if (UI.currentFocus > -1) { items[UI.currentFocus].click(); } else if (items.length > 0) { items[0].click(); } }
    },
    
    addActive: (items) => {
        if (!items) return;
        for (let i = 0; i < items.length; i++) { items[i].style.backgroundColor = ''; items[i].style.color = ''; }
        if (UI.currentFocus >= items.length) UI.currentFocus = 0; if (UI.currentFocus < 0) UI.currentFocus = (items.length - 1);
        items[UI.currentFocus].style.backgroundColor = '#eff6ff'; items[UI.currentFocus].style.color = '#2563eb';
        items[UI.currentFocus].scrollIntoView({ block: 'nearest' });
    },

    selectAuto: (kode, type, formType) => {
        const ms = DB.get('m') || []; const item = ms.find(x => x.kode === kode); if(!item) return;
        if (['k', 'n'].includes(type)) { 
            document.getElementById('t_k').value = item.kode; document.getElementById('t_n').value = item.nama;
            document.getElementById('t_k_list').style.display = 'none'; document.getElementById('t_n_list').style.display = 'none';
            UI.syncTrx('k', formType);
            setTimeout(() => {
                if(formType === 'IN') { document.getElementById('t_b').focus(); } 
                else if (['OUT', 'ADJ'].includes(formType)) { document.getElementById('t_b_sel').focus(); }
                else if (formType === 'RET') { document.getElementById('t_new_q').focus(); }
            }, 50);
        } else if (['b_f_k', 'b_f_n'].includes(type)) { 
            document.getElementById('b_f_kode').value = item.kode; document.getElementById('b_f_nama').value = item.nama;
            UI.refresh();
        } else { 
            document.getElementById('l_f_kode').value = item.kode; document.getElementById('l_f_nama').value = item.nama;
            UI.refresh();
        }
    },

toggleVerify: async (id) => {
    // Cari data di local cache 'l' berdasarkan ID asli
    const logs = DB.get('l') || [];
    const logToToggle = logs.find(log => log.id.toString() === id.toString());

    if (!logToToggle) {
        UI.showToast("❌ Log tidak ditemukan.");
        return;
    }

    const newValue = !logToToggle.v;
    try {
        const { error } = await sb.from('transaksi_log')
            .update({ v: newValue })
            .eq('id', id);
        
        if (error) throw error;

        await DB.load();
        UI.refresh();
        UI.showToast(newValue ? "✅ Terverifikasi" : "🔓 Verifikasi Dibatalkan");
    } catch (err) {
        console.error("Gagal toggle verifikasi:", err);
        UI.showToast("❌ Gagal memperbarui verifikasi.");
    }
},

  refresh: () => {
    // 1. Ambil data & hitung stok
    const ms = DB.get('m') || []; 
    const l = DB.get('l') || []; 
    const act = Engine.calculate(); // Menghitung stok real-time

    const searchEl = document.getElementById('searchInput'); 
    const qG = searchEl ? searchEl.value.toUpperCase() : '';
    const session = DB.get('currentUser') || {}; 
    const isAdmin = session.role === 'admin';
    
    // Kontrol tampilan kolom aksi untuk Admin
    const thAksi = document.getElementById('th_aksi'); 
    if(thAksi) thAksi.style.display = isAdmin ? 'table-cell' : 'none';

    // Fungsi pembantu mengecek tab mana yang sedang dibuka
    const isTabActive = (id) => {
        const el = document.getElementById('tab-' + id);
        return el && el.classList.contains('active');
    };

    // --- LOGIKA TAB STOK ---
    if(isTabActive('stok')) {
        let stokData = ms.filter(m => (m.kode||'').toUpperCase().includes(qG) || (m.nama||'').toUpperCase().includes(qG)).map(m => {
            const bts = act.filter(b => b.kode === m.kode);
            const ttl = bts.reduce((a, b) => a + b.stok, 0); 
            return { kode: m.kode || '-', nama: m.nama || '-', stok: ttl };
        });

        // Sorting Data Stok
        stokData.sort((a, b) => {
            let vA = a[UI.sortCol]; let vB = b[UI.sortCol];
            if(typeof vA === 'string') { vA = vA.toUpperCase(); vB = vB.toUpperCase(); }
            if(UI.sortAsc) return vA < vB ? -1 : (vA > vB ? 1 : 0);
            return vA > vB ? -1 : (vA < vB ? 1 : 0);
        });

        const invBody = document.getElementById('inventoryBody');
        if(invBody) {
            invBody.innerHTML = stokData.map(m => {
                let statusTag = "";
                if (m.stok <= 0) statusTag = '<span class="badge badge-danger">🚫 HABIS</span>';
                else if (m.stok <= 15) statusTag = '<span class="badge badge-error">🚨 KRITIS</span>';
                else if (m.stok <= 25) statusTag = '<span class="badge badge-warning">⚠️ MENIPIS</span>';
                else statusTag = '<span class="badge badge-success">✅ AMAN</span>';

                let actionBtn = isAdmin ? `<td style="text-align:center;"><button class="btn-outline" style="padding:2px 8px; font-size:11px; margin:0;" onclick="App.editMaster('${m.kode}')">✏️ Edit</button></td>` : '';
                
                return `<tr>
                    <td><b>${m.kode}</b></td>
                    <td>${m.nama}</td>
                    <td align="right"><b>${m.stok}</b></td>
                    <td align="center">${statusTag}</td>
                    ${actionBtn}
                </tr>`;
            }).join('');
        }
        ['kode', 'nama', 'stok'].forEach(c => { 
            const el = document.getElementById(`sort_${c}`); 
            if(el) el.innerHTML = UI.sortCol === c ? (UI.sortAsc ? '▲' : '▼') : ''; 
        });
    }

    // --- LOGIKA TAB MASUK & KELUAR (Filter Tanggal) ---
    if(isTabActive('day-in')) UI.renderDaily('day-in', 'IN', ms, l);
    if(isTabActive('day-out')) UI.renderDaily('day-out', 'OUT', ms, l);

    // --- LOGIKA TAB LAINNYA ---
    if(isTabActive('mutasi')) UI.renderMutasiPivot(ms, l);
    if(isTabActive('batch')) UI.renderBatch(ms, act);
    if(isTabActive('log')) UI.renderLog(ms, l);
    if(isTabActive('expiry')) UI.renderExpiry();
    if (isTabActive('summary')) UI.renderSummary(ms, l);
  },

   renderMutasiPivot: (ms, l) => {
        const selM = document.getElementById('f_mutasi_m'); 
        const selY = document.getElementById('f_mutasi_y');
        if (!selM || !selY) return;

        const m = parseInt(selM.value);
        const y = parseInt(selY.value);
        const days = new Date(y, m, 0).getDate();
        const q = (document.getElementById('f_mutasi_q')?.value || "").toUpperCase();

        const getArrow = (col) => UI.sortMutasiCol === col ? (UI.sortMutasiAsc ? ' ▲' : ' ▼') : '';

        // 1. RENDER HEADER (Hanya IN/OUT per hari)
        let h1 = `<tr><th rowspan="2" class="sticky-col k-kode sortable" onclick="UI.sortMutasi('kode')">Kode${getArrow('kode')}</th><th rowspan="2" class="sticky-col k-nama sortable" onclick="UI.sortMutasi('nama')">Nama Barang${getArrow('nama')}</th><th rowspan="2" class="sticky-col k-awal" style="background-color: var(--bg-awal);">Awal</th>`;
        let h2 = `<tr>`;
        for (let i = 1; i <= days; i++) {
            h1 += `<th colspan="2" class="day-header">${i}</th>`;
            h2 += `<th class="sub-col" style="background-color: var(--bg-in);">M</th><th class="sub-col" style="background-color: var(--bg-out);">K</th>`;
        }
        h1 += `<th rowspan="2">IN</th><th rowspan="2">OUT</th><th rowspan="2" class="sortable" onclick="UI.sortMutasi('akhir')" style="background-color: var(--bg-akhir);">Akhir${getArrow('akhir')}</th></tr>`;
        document.getElementById('mutasiHeader').innerHTML = h1 + h2 + `</tr>`;

        // 2. OLAH DATA PIVOT (Hapus logika ADJ & RET)
        let pivotData = ms.filter(m_ => (m_.kode || '').includes(q) || (m_.nama || '').toUpperCase().includes(q)).map(it => {
            let aw = 0, ti = 0, to = 0;
            let dM = Array(days + 1).fill(0), dK = Array(days + 1).fill(0);

            l.filter(x => x.kode === it.kode).forEach(log => {
                const ld = new Date(log.tgl);
                const ly = ld.getFullYear();
                const lm = ld.getMonth() + 1;
                const day = ld.getDate();

                // --- SALDO AWAL (Bulan Lalu) ---
                if (ly < y || (ly === y && lm < m)) {
                    if (log.tipe === 'IN') aw += log.qty;
                    else if (log.tipe === 'OUT') aw -= log.qty;
                } 
                // --- LOGIKA HARIAN (Hanya IN & OUT) ---
                else if (ly === y && lm === m) {
                    if (log.tipe === 'IN') {
                        dM[day] += log.qty;
                        ti += log.qty;
                    } else if (log.tipe === 'OUT') {
                        dK[day] += log.qty;
                        to += log.qty;
                    }
                }
            });

            return {
                kode: it.kode, nama: it.nama, awal: aw, masuk: ti, keluar: to,
                akhir: (aw + ti - to), harianM: dM, harianK: dK
            };
        });

        // 3. LOGIKA SORTING
        if (UI.sortMutasiCol) {
            pivotData.sort((a, b) => {
                let vA = a[UI.sortMutasiCol], vB = b[UI.sortMutasiCol];
                if (typeof vA === 'string') { vA = vA.toUpperCase(); vB = vB.toUpperCase(); }
                return UI.sortMutasiAsc ? (vA < vB ? -1 : 1) : (vA > vB ? -1 : 1);
            });
        }

        // 4. RENDER BODY
        document.getElementById('mutasiTableBody').innerHTML = pivotData.map(row => {
            let htmlRow = `<tr>
                <td class="sticky-col k-kode"><b>${row.kode}</b></td>
                <td class="sticky-col k-nama">${row.nama}</td>
                <td class="sticky-col k-awal" style="background-color: var(--bg-awal); text-align:center;">${row.awal}</td>`;
            
            for (let i = 1; i <= days; i++) {
                htmlRow += `
                    <td class="sub-col txt-m" style="background-color: var(--bg-in);">${row.harianM[i] || ''}</td>
                    <td class="sub-col txt-k" style="background-color: var(--bg-out);">${row.harianK[i] || ''}</td>`;
            }
            
            return htmlRow + `
                <td style="text-align:center; font-weight:bold; color:#16a34a">${row.masuk}</td>
                <td style="text-align:center; font-weight:bold; color:#dc2626">${row.keluar}</td>
                <td style="background-color: var(--bg-akhir); font-weight:bold; text-align:center;">${row.akhir}</td>
            </tr>`;
        }).join('');
    },

renderDaily: (id, tipe, ms, l) => {
    const pane = document.getElementById('tab-' + id); 
    if (!pane || !pane.classList.contains('active')) return;
    
    const pf = id === 'day-in' ? 'f_in' : 'f_out';
    
    // Ambil nilai filter
    const dVal = document.getElementById(`${pf}_d`)?.value;
    const mVal = document.getElementById(`${pf}_m`)?.value;
    const yVal = document.getElementById(`${pf}_y`)?.value;
    const qVal = (document.getElementById(`${pf}_q`)?.value || '').toUpperCase();

    // 1. FILTER DATA
    let filtered = l.filter(x => {
        if (x.tipe !== tipe) return false;
        const [y, m, d] = (x.tgl || '').split('-'); 
        const matchD = dVal ? parseInt(d) === parseInt(dVal) : true;
        const matchM = mVal ? parseInt(m) === parseInt(mVal) : true;
        const matchY = yVal ? parseInt(y) === parseInt(yVal) : true;
        const mData = ms.find(item => item.kode === x.kode) || {};
        const matchQ = (x.kode + (mData.nama || '')).toUpperCase().includes(qVal);
        return matchD && matchM && matchY && matchQ;
    });

    // 2. LOGIKA SORTING BERTINGKAT
    filtered.sort((a, b) => {
        const isVA = (a.v === true || a.v === 'true');
        const isVB = (b.v === true || b.v === 'true');

        // PRIORITAS 1: Verifikasi (Yang sudah verif/true selalu di bawah)
        if (isVA !== isVB) return isVA ? 1 : -1;

        // PRIORITAS 2: Berdasarkan Kolom yang diklik (User Sort)
        let vA = a[UI.sortDayCol] || '';
        let vB = b[UI.sortDayCol] || '';

        if (UI.sortDayCol === 'nama') {
            vA = (ms.find(m => m.kode === a.kode)?.nama || '').toUpperCase();
            vB = (ms.find(m => m.kode === b.kode)?.nama || '').toUpperCase();
        } else if (typeof vA === 'string') {
            vA = vA.toUpperCase(); 
            vB = vB.toUpperCase();
        }

        if (vA < vB) return UI.sortDayAsc ? -1 : 1;
        if (vA > vB) return UI.sortDayAsc ? 1 : -1;

        // PRIORITAS 3: Default Batch Ascending (Jika status verif & kolom sort sama)
        const batchA = (a.batch || '').toUpperCase();
        const batchB = (b.batch || '').toUpperCase();
        if (batchA < batchB) return -1;
        if (batchA > batchB) return 1;

        return 0;
    });

    // 3. RENDER KE HTML
    const isAdmin = (DB.get('currentUser') || {}).role === 'admin';
    const tbodyId = id === 'day-in' ? 'dayInBody' : 'dayOutBody';
    const targetBody = document.getElementById(tbodyId);
    
    if (targetBody) {
        targetBody.innerHTML = filtered.map(x => {
            const m = ms.find(i => i.kode === x.kode);
            const isV = (x.v === true || x.v === 'true');
            
            return `
                <tr class="${isV ? 'is-verified' : ''}" style="${isV ? 'background-color: #f0fdf4;' : ''}">
                    <td>${x.ref || '-'}</td>
                    <td><b>${x.kode}</b></td>
                    <td style="font-size:11px;">${m ? m.nama : '-'}</td>
                    <td align="center">${x.batch || '-'}</td>
                    <td align="right"><b>${x.qty}</b></td>
                    <td style="font-size:10px;">${x.ket || '-'}</td>
                    <td align="center">
                        ${isAdmin ? `<input type="checkbox" ${isV ? 'checked' : ''} onchange="UI.toggleVerify('${x.id}')">` : (isV ? '✅' : '-')}
                    </td>
                    <td align="center">
                        ${isAdmin ? `
                            <button class="btn-icon" onclick="App.editLog('${x.id}')">📝</button>
                            <button class="btn-icon" onclick="App.deleteLog('${x.id}')" style="color:red">🗑️</button>
                        ` : '-'}
                    </td>
                </tr>`;
        }).join('') || '<tr><td colspan="8" align="center">Data tidak ditemukan...</td></tr>';
    }
  },

initFilterDate: () => {
    const now = new Date();
    const curY = now.getFullYear();
    const curM = now.getMonth() + 1;
    const curD = now.getDate();

    ['f_in', 'f_out', 'f_sum'].forEach(pf => {
        // Isi Dropdown Tahun (5 tahun terakhir)
        const selY = document.getElementById(`${pf}_y`);
        if (selY) {
            selY.innerHTML = '';
            for(let i = curY; i >= curY-5; i--) {
                selY.innerHTML += `<option value="${i}">${i}</option>`;
            }
            selY.value = curY;
        }
        // Set Default Bulan & Tanggal
        if(document.getElementById(`${pf}_m`)) document.getElementById(`${pf}_m`).value = curM;
        if(document.getElementById(`${pf}_d`)) document.getElementById(`${pf}_d`).value = curD;
    });
},

        renderSummary: (ms, l) => {
    const dVal = document.getElementById('f_sum_d')?.value;
    const mVal = document.getElementById('f_sum_m')?.value;
    const yVal = document.getElementById('f_sum_y')?.value;
    const tVal = document.getElementById('f_sum_type')?.value; // IN, OUT, atau ALL

    // 1. FILTER
    let filtered = l.filter(x => {
        const [y, m, d] = (x.tgl || '').split('-');
        const matchD = dVal ? parseInt(d) === parseInt(dVal) : true;
        const matchM = mVal ? parseInt(m) === parseInt(mVal) : true;
        const matchY = yVal ? parseInt(y) === parseInt(yVal) : true;
        const matchT = (tVal === 'ALL' || !tVal) ? true : x.tipe === tVal;
        return matchD && matchM && matchY && matchT;
    });

    // 2. SORTING (Tanpa Verified Sort)
    filtered.sort((a, b) => {
        // Prioritas 1: Kolom yang diklik (Default: No. Ref)
        // Jika UI.sortDayCol bernilai default 'tgl', kita arahkan ke 'ref'
        let col = (UI.sortDayCol === 'tgl' || !UI.sortDayCol) ? 'ref' : UI.sortDayCol; 
        
        let vA = a[col] || '';
        let vB = b[col] || '';

        if (col === 'nama') {
            vA = (ms.find(m => m.kode === a.kode)?.nama || '').toUpperCase();
            vB = (ms.find(m => m.kode === b.kode)?.nama || '').toUpperCase();
        } else if (typeof vA === 'string') {
            vA = vA.toUpperCase(); 
            vB = vB.toUpperCase();
        }

        if (vA < vB) return UI.sortDayAsc ? -1 : 1;
        if (vA > vB) return UI.sortDayAsc ? 1 : -1;
        
        // Prioritas 2: Secondary sort selalu Batch Ascending
        const batchA = (a.batch || '').toUpperCase();
        const batchB = (b.batch || '').toUpperCase();
        if (batchA < batchB) return -1;
        if (batchA > batchB) return 1;

        return 0;
    });

    // 3. RENDER
    const target = document.getElementById('summaryBody');
    if (target) {
        target.innerHTML = filtered.map(x => {
            const m = ms.find(i => i.kode === x.kode);
            const tipeClass = x.tipe === 'IN' ? 'badge-success' : 'badge-danger';
            const tipeText = x.tipe === 'IN' ? 'MASUK' : 'KELUAR';
            
            return `
                <tr>
                    <td>${x.ref || '-'}</td>
                    <td><span class="badge ${tipeClass}">${tipeText}</span></td>
                    <td><b>${x.kode}</b></td>
                    <td style="font-size:11px;">${m ? m.nama : '-'}</td>
                    <td align="right"><b>${x.qty}</b></td>
                </tr>`;
        }).join('') || '<tr><td colspan="5" align="center">Data tidak ditemukan...</td></tr>';
    }
},

  // --- script.js ---

  resetFilterDay: (prefix) => {
    const d = new Date();
    const elD = document.getElementById(prefix + '_d');
    const elM = document.getElementById(prefix + '_m');
    const elY = document.getElementById(prefix + '_y');
    const elT = document.getElementById(prefix + '_type'); // Khusus untuk Summary

    // Set Tanggal ke Hari Ini
    if (elD) elD.value = d.getDate();
    if (elM) elM.value = d.getMonth() + 1;
    if (elY) elY.value = d.getFullYear();

    // Reset Jenis Transaksi (Jika di tab Summary)
    if (elT) elT.value = 'ALL';

    // Jika ini tab Log, gunakan logika 30 hari (opsional jika prefix === 'f_log')
    if (prefix === 'f_log') {
        const past = new Date();
        past.setDate(d.getDate() - 30);
        const fmt = (date) => {
            const dd = String(date.getDate()).padStart(2, '0');
            const mm = String(date.getMonth() + 1).padStart(2, '0');
            const yyyy = date.getFullYear();
            return `${dd}-${mm}-${yyyy}`;
        };
        if(document.getElementById('f_tgl_1')) document.getElementById('f_tgl_1').value = fmt(past);
        if(document.getElementById('f_tgl_2')) document.getElementById('f_tgl_2').value = fmt(d);
    }

    UI.refresh();
  },
    renderBatch: (ms, act) => {
        const qK = document.getElementById('b_f_kode').value.toUpperCase(), qN = document.getElementById('b_f_nama').value.toUpperCase();
        let ttlS = 0, htmlContent = '';
        ms.filter(m => (qK ? m.kode === qK : true) && (qN ? m.nama === qN : true)).forEach(m => {
            act.filter(b => b.kode === m.kode).forEach(b => {
                htmlContent += `<tr><td><b>${m.kode}</b></td><td>${m.nama}</td><td>📦 ${b.batch}</td><td>${b.exp ? DateHelper.toUI(b.exp) : '-'}</td><td class="txt-m">${b.stok}</td></tr>`;
                ttlS += b.stok;
            });
        });
        document.getElementById('batchContainer').innerHTML = htmlContent;
        document.getElementById('b_f_stok').value = ttlS;
    },

   renderLog: (ms, l) => {
    // 1. Ambil kriteria filter dari input UI
    const t1 = DateHelper.toDB(document.getElementById('f_tgl_1')?.value);
    const t2 = DateHelper.toDB(document.getElementById('f_tgl_2')?.value);
    const qK = document.getElementById('l_f_kode')?.value.toUpperCase() || "";
    const tipe = document.getElementById('f_tipe')?.value || 'ALL';

    // 2. Filter Data berdasarkan Tanggal, Kode, dan Tipe (IN/OUT)
    const filtered = l.filter(x => {
        const matchTgl = (x.tgl >= t1 && x.tgl <= t2);
        const matchKode = qK ? (x.kode || "").toUpperCase().includes(qK) : true;
        const matchTipe = (tipe === 'ALL' || x.tipe === tipe);
        return matchTgl && matchKode && matchTipe;
    });

    const session = DB.get('currentUser') || {};
    const isAdmin = session.role === 'admin';

    
    const html = filtered.slice().reverse().map(x => {
        const m = ms.find(i => i.kode === x.kode);
        const tColor = x.tipe === 'IN' ? 'txt-m' : 'txt-k'; // Hijau/Merah
        const isV = (x.v === true || x.v === 'true');

        // --- LOGIKA KOLOM VERIFIKASI ---
        let verifCol = '';
        if (isAdmin) {
            verifCol = `<td align="center">
                <input type="checkbox" ${isV ? 'checked' : ''} onchange="UI.toggleVerify('${x.id}')" style="cursor:pointer; width:15px; height:15px;">
            </td>`;
        } else {
            verifCol = `<td align="center" style="font-size:14px;">
                ${isV ? '✅' : '<span style="color:#94a3b8">-</span>'}
            </td>`;
        }

        // --- LOGIKA KOLOM AKSI (SISIPKAN EDIT) ---
        let actionCol = '';
        if (isAdmin) {
            actionCol = `
                <td align="center">
                    <div style="display:flex; gap:3px; justify-content:center;">
                        <button class="btn-outline" style="padding: 2px 5px; font-size: 10px; cursor:pointer; color:#f59e0b; border-color:#f59e0b;" 
                                onclick="App.editLog('${x.id}')">📝</button>
                        <button class="btn-outline" style="padding: 2px 5px; font-size: 10px; cursor:pointer; color:#dc2626; border-color:#dc2626;" 
                                onclick="App.deleteLog('${x.id}')">🗑️</button>
                    </div>
                </td>`;
        } else {
            actionCol = '<td align="center" style="color:#94a3b8">-</td>';
        }

        return `
            <tr class="${isV ? 'is-verified' : ''}">
                <td>${DateHelper.toUI(x.tgl)}</td>
                <td>${x.ref || '-'}</td>
                <td><b>${x.kode}</b></td>
                <td style="font-size:10px;">${m ? m.nama : ''}</td>
                <td>${x.batch || '-'}</td>
                <td class="${tColor}" align="right"><b>${x.qty}</b></td>
                <td align="center"><small>${x.tipe}</small></td>
                <td style="font-size:10px;">${x.ket || '-'}</td>
                ${verifCol} 
                ${actionCol}
            </tr>`;
    }).join('');

    const target = document.getElementById('logTableBody');
    if (target) {
        target.innerHTML = html || '<tr><td colspan="10" align="center">Data Kosong</td></tr>';
    }
},

renderExpiry: () => {
        const act = Engine.calculate(); 
        const tbody = document.getElementById('expiryTableBody');
        if(!tbody) return;

        const today = new Date();
        const alertLimit = new Date();
        alertLimit.setDate(today.getDate() + 90); // Batas 90 hari sesuai kode Anda

        const data = act.filter(b => {
            if(!b.exp) return false;
            const eDate = new Date(b.exp);
            return eDate <= alertLimit && b.stok > 0;
        }).sort((a, b) => new Date(a.exp) - new Date(b.exp));

        // PEMICU TOAST: Jika ada data hasil filter, munculkan alert
        if (data.length > 0) {
            UI.showExpiredAlert(data.length);
        }

        tbody.innerHTML = data.map(b => {
            const m = DB.get('m').find(x => x.kode === b.kode);
            const eDate = new Date(b.exp);
            const diff = Math.ceil((eDate - today) / (1000 * 60 * 60 * 24));
            const statusClass = diff <= 30 ? 'txt-k' : 'txt-m'; 

            return `<tr>
                <td>${b.kode}</td>
                <td>${m ? m.nama : '-'}</td>
                <td>${b.batch}</td>
                <td>${b.stok}</td>
                <td class="${statusClass}"><b>${DateHelper.toUI(b.exp)}</b></td>
                <td>${diff} Hari lagi</td>
                <td><span class="badge-${diff <= 30 ? 'danger' : 'warning'}">⚠️ ${diff <= 0 ? 'KADALUWARSA' : 'DEKAT EXP'}</span></td>
            </tr>`;
        }).join('');
    },
    syncTrx: (src, t) => {
        if(src === 'k') {
            const k = document.getElementById('t_k').value;
            const item = DB.get('m').find(x => x.kode === k); document.getElementById('t_n').value = item ? item.nama : '';
            if(t === 'IN') { 
                 document.getElementById('t_exp').value = '';  
            } else {
                const bSelect = document.getElementById('t_b_sel'); const act = Engine.calculate().filter(x => x.kode === k);
                bSelect.innerHTML = act.length === 0 ? '<option value="">--Kosong--</option>' : '<option value="">--Pilih Batch--</option>' + act.map(x => `<option value="${x.batch}">📦 ${x.batch} (Stok: ${x.stok}) ${x.exp ? ' ⏳ Exp: '+DateHelper.toUI(x.exp) : ''}</option>`).join('');
                document.getElementById('t_stk_tot').value = act.reduce((a, b) => a + b.stok, 0); document.getElementById('t_q').value = '';
            }
        } else if (src === 'b') {
            const k = document.getElementById('t_k').value, b = document.getElementById('t_b_sel').value;
            if(!k || !b) { document.getElementById('t_stk_b').value = ''; return; }
            const st = Engine.calculate().find(x => x.kode === k && x.batch === b);
            document.getElementById('t_stk_b').value = st ? st.stok : 0; document.getElementById('t_q').value = ''; document.getElementById('t_q').focus();
        }
    },

    checkBatchIn: () => {
        const kode = document.getElementById('t_k')?.value.toUpperCase();
        const batch = document.getElementById('t_b')?.value.trim();
        
        if (!kode || !batch) return;

        const logs = DB.get('l') || [];
        const duplicate = logs.find(x => 
            String(x.kode).toUpperCase() === kode && 
            String(x.batch).toUpperCase() === batch.toUpperCase() && 
            x.tipe === 'IN' && x.id !== window.editingId 
        );

        if (duplicate) {
            const tglUI = DateHelper.toUI(duplicate.tgl);
            const expUI = duplicate.exp ? DateHelper.toUI(duplicate.exp) : '-';
            

            const alertBox = document.createElement('div');
            alertBox.id = 'batchAlertModal';
            alertBox.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); display:flex; align-items:center; justify-content:center; z-index:9999; animation: fadeIn 0.2s;";
            
            alertBox.innerHTML = `
                <div class="modal-content sz-mini" style="border-top: 5px solid #f59e0b; padding: 20px;">
                    <div style="font-size:35px; margin-bottom:10px; text-align:center;">⚠️</div>
                    <h3 style="color:#f59e0b; text-align:center; margin-bottom:15px; letter-spacing:1px;">BATCH GANDA TERDETEKSI!</h3>
                    
                    <div style="background:#f1f5f9; padding:15px; border-radius:8px; font-size:12px; line-height:1.6; border:1px solid #cbd5e0; margin-bottom:20px;">
                        <p>Barang <b>[${kode}]</b> dengan Batch <b>[${batch}]</b> sudah pernah diinput sebelumnya:</p>
                        <hr style="margin:10px 0; border:0; border-top:1px dashed #94a3b8;">
                        <p>📅 <b>Input Terakhir</b> : ${tglUI}</p>
                        <p>⌛ <b>Expired Date</b> : <span style="color:#2563eb; font-weight:bold;">${expUI}</span></p>
                        <p>📦 <b>Jml Terakhir</b> : ${duplicate.qty}</p>
                    </div>

                    <p style="font-size:12px; text-align:center; margin-bottom:20px; color:#475569;">Gunakan data Expired Date yang lama?</p>
                    
                    <div style="display:flex; gap:10px;">
                        <button id="btnAlertNo" class="btn-outline" style="flex:1; margin:0; padding:10px;">❌ Batal</button>
                        <button id="btnAlertYes" class="btn-primary" style="flex:1; background:#f59e0b; border-color:#f59e0b; padding:10px;">✅ Ya</button>
                    </div>
                </div>
            `;

            document.body.appendChild(alertBox);

    
            document.getElementById('btnAlertYes').onclick = () => {
                const elExp = document.getElementById('t_exp');
                if (elExp && duplicate.exp) {
                    elExp.value = DateHelper.toUI(duplicate.exp);
                }
                alertBox.remove();
               
                setTimeout(() => document.getElementById('t_q')?.focus(), 150);
            };

       
            document.getElementById('btnAlertNo').onclick = () => {
                const elBatch = document.getElementById('t_b');
                if(elBatch) { 
                    elBatch.value = ''; 
                    elBatch.focus(); 
                }
                alertBox.remove();
            };
        }
    },
    openTrx: (t) => {
    window.currentTrxType = t;
    
    const todayUI = DateHelper.toUI(new Date().toISOString().split('T')[0]);
    const mContent = document.getElementById('trxBody');
    if(!mContent) return;

    mContent.style.padding = '0';
    mContent.className = 'modal-content sz-medium';
    
    let h = `<div id="trxHeader" style="cursor:grab; background:#f1f5f9; padding:12px 15px; border-radius:8px 8px 0 0; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center; font-weight:bold; color:var(--s);">
                <span>Form ${t === 'IN' ? 'Barang Masuk' : 'Barang Keluar'}</span>
                <span style="font-size:14px; color:#64748b;">✥</span>
             </div>
             <div style="padding: 15px; display:flex; flex-direction:column; gap:8px;">`;

   
    h += `<div class="form-row-compact">
            <div class="f-item"><label>Tanggal:</label><input type="text" id="t_tgl" value="${todayUI}" maxlength="10" oninput="UI.formatDateInput(this)" onblur="UI.expandDate(this)"></div>
            <div class="f-item"><label>No. Ref:</label><input id="t_ref" placeholder="..."></div>
          </div>`;

  
    h += `<div style="position:relative;">
            <div class="form-row-compact">
                <div class="f-item" style="flex:2"><label>Kode:</label><input id="t_k" placeholder="Kode" onkeyup="UI.showAutoList('k', '${t}')" onkeydown="UI.handleAutoKey(event, 'k', '${t}')" autocomplete="off"><div id="t_k_list" class="autocomplete-items"></div></div>
                <div class="f-item" style="flex:3"><label>Nama Barang:</label><input id="t_n" placeholder="Cari Nama..." onkeyup="UI.showAutoList('n', '${t}')" onkeydown="UI.handleAutoKey(event, 'n', '${t}')" autocomplete="off"><div id="t_n_list" class="autocomplete-items"></div></div>
            </div>
          </div>`;

    if(t === 'IN') {
      
        h += `<div class="form-row-compact">
                <div class="f-item"><label>No. Batch:</label><input id="t_b" onblur="UI.checkBatchIn()" placeholder="Nomor Batch"></div>
              </div>`;
        h += `<div class="form-row-compact">
                <div class="f-item"><label>Qty Masuk:</label><input id="t_q" type="number" placeholder="0" onkeydown="if(event.key==='Enter') App.prepareSave('IN')"></div>
                <div class="f-item"><label>Expired Date:</label><input id="t_exp" placeholder="DD-MM-YYYY" oninput="UI.formatDateInput(this)" onblur="UI.expandDate(this)"></div>
              </div>`;
        
    } else {
        h += `<div class="form-row-compact">
                <div class="f-item" style="flex:1"><label>Stok Total:</label><input id="t_stk_tot" readonly class="read-only" style="background:#f0f9ff; font-weight:bold; color:#0369a1;"></div>
                <div class="f-item" style="flex:3"><label>Pilih Batch:</label><select id="t_b_sel" onchange="UI.syncTrx('b', '${t}')" style="width:100%; padding:5px; border-radius:4px;"><option value="">-- Pilih --</option></select></div>
              </div>`;
        h += `<div class="form-row-compact">
                <div class="f-item"><label>Stok Batch:</label><input id="t_stk_b" readonly class="read-only" style="background:#fef2f2; font-weight:bold; color:#b91c1c;"></div>
                <div class="f-item"><label>Qty Keluar:</label><input id="t_q" type="number" placeholder="0" onkeydown="if(event.key==='Enter') App.prepareSave('OUT')"></div>
              </div>`;
        h += `<label>Keterangan:</label><input id="t_ket" placeholder="Tujuan / Catatan">`;
    }

    h += `<div style="display:flex; gap:5px; margin-top:10px;">
            <button id="btnPrepare" class="btn-primary" style="flex:1;" onclick="App.prepareSave('${t}')">💾 Lanjut</button>
            <button class="btn-outline" style="flex:1;" onclick="UI.closeModal('modalTrx')">Batal</button>
          </div></div>`;

    mContent.innerHTML = h; 
    UI.showModal('modalTrx'); 
    Draggable.init('trxBody', 'trxHeader');

    setTimeout(() => {
        const k = document.getElementById('t_k');
        if(k) k.focus();
    }, 150);
},

    showToast: (msg) => {
        const t = document.createElement('div');
        t.className = 'toast-container';
        t.innerText = msg;
        document.body.appendChild(t);
        setTimeout(() => t.remove(), 2000); 
    },

  

    // --- Di dalam objek UI ---
showExpiredAlert: (count) => {
    // 1. Cek apakah sudah pernah muncul di sesi ini
    if (hasAlertedExpired) return;

    // 2. Cegah duplikasi elemen di DOM
    if (document.querySelector('.toast-expired-alert')) return;

    const toast = document.createElement('div');
    toast.className = 'toast-expired-alert';
    toast.innerHTML = `
        <div style="font-size: 24px;">⚠️</div>
        <div style="flex:1">
            <strong style="display:block; font-size:14px; margin-bottom:2px;">PENGINGAT KADALUWARSA</strong>
            <span style="font-size:12px; opacity:0.9;">Ada ${count} item mendekati expired (Cek Tab Expired untuk detail).</span>
        </div>
        <div class="close-toast" style="font-size:22px; opacity:0.5; padding: 0 5px; cursor:pointer;">&times;</div>
    `;

    // Tandai sudah muncul
    hasAlertedExpired = true;

    // Logika Klik
    toast.onclick = (e) => {
        // Jika yang diklik adalah tombol silang (×), cukup tutup toast
        if (e.target.classList.contains('close-toast')) {
            toast.remove();
            return;
        }
        
        // Jika klik area lain, pindah ke tab expiry
        const btnExpiry = document.querySelector('[data-tab="expiry"]');
        UI.switchTab('expiry', btnExpiry); 
        toast.remove();
    };

    document.body.appendChild(toast);
    
    // Auto remove setelah 60 detik
    setTimeout(() => { 
        if (document.body.contains(toast)) toast.remove(); 
    }, 60000);
}
};

const App = {
    syncLoad: async () => {
        
        let hasAlertedExpired = false;

        const btn = document.querySelector('button[onclick="App.syncLoad()"]');
        if (btn) {
            btn.disabled = true;
            btn.innerText = "Sync...";
        }

        try {
            console.log("Memulai Sync Data...");
          
            await DB.load(); 
            
            
            UI.refresh();
            
            UI.showToast("🔄 Data Berhasil Disinkronkan");
        } catch (err) {
            console.error("Sync Error:", err);
            UI.showToast("❌ Gagal Sync: " + err.message);
        } finally {
          
            if (btn) {
                btn.disabled = false;
                btn.innerText = "Sync";
            }
        }
    },
    
    // Baris sebelum:
    init: async () => {
        UI.initFilterDate(); // Memicu rantai proses di atas
        await App.syncLoad();    
    },
    // Baris sesudah (fungsi selanjutnya)
    exportDB: () => {
        const b = new Blob([JSON.stringify({ m: DB.get('m'), l: DB.get('l') })], { type: 'application/json' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `Backup_${new Date().getTime()}.json`; a.click();
    },

    // Lokasi: script.js -> di dalam const App = { ... }

    exportToExcel: () => {
        const activeTab = document.querySelector('.tab-pane.active');
        if (!activeTab) return;

        const id = activeTab.id;
        const ms = DB.get('m') || [];
        const l = DB.get('l') || [];
        let wb = XLSX.utils.book_new();
        let sheetName = "";

        if (id === 'tab-mutasi') {
            // --- LOGIKA KHUSUS PIVOT MUTASI ---
            const table = document.getElementById('tableMutasi');
            if (!table || table.rows.length <= 2) return alert("Data Mutasi Kosong!");
            
            sheetName = "Mutasi_Pivot";
            // Ambil data langsung dari elemen tabel HTML agar akurat dengan yang tampil
            const ws = XLSX.utils.table_to_sheet(table);
            
            // Atur lebar kolom agar tidak berantakan
            ws['!cols'] = [{wch: 15}, {wch: 30}, {wch: 10}]; // Kode, Nama, Awal
            XLSX.utils.book_append_sheet(wb, ws, sheetName);
        } 
        else {
            // --- LOGIKA TAB STANDAR (STOK / LOG / DAY) ---
            let dataExport = [];
            if (id === 'tab-stok') {
                sheetName = "Stok_Barang";
                dataExport = ms.map(m => {
                    const history = l.filter(x => x.kode === m.kode);
                    const inQ = history.filter(x => x.tipe === 'IN').reduce((a, b) => a + (parseFloat(b.qty) || 0), 0);
                    const outQ = history.filter(x => x.tipe === 'OUT').reduce((a, b) => a + (parseFloat(b.qty) || 0), 0);
                    return { "Kode": m.kode, "Nama": m.nama, "Masuk": inQ, "Keluar": outQ, "Saldo": inQ - outQ };
                });
            } else if (id === 'tab-day-in' || id === 'tab-day-out') {
                const tipe = id === 'tab-day-in' ? 'IN' : 'OUT';
                sheetName = `Log_${tipe}`;
                dataExport = l.filter(x => x.tipe === tipe).map(x => ({
                    "Tgl": x.tgl, "Ref": x.ref, "Kode": x.kode, "Qty": x.qty, "Ket": x.ket
                }));
            }

            if (dataExport.length === 0) return alert("Data Kosong!");
            const ws = XLSX.utils.json_to_sheet(dataExport);
            
            // Auto-width standar
            ws['!cols'] = Object.keys(dataExport[0]).map(k => ({ wch: k.length + 10 }));
            XLSX.utils.book_append_sheet(wb, ws, sheetName);
        }

        // DOWNLOAD FILE
        const fileName = `${sheetName}_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, fileName);
    },

    openMasterAdd: () => {
        document.getElementById('m_k_old').value = ''; document.getElementById('m_k').value = ''; document.getElementById('m_n').value = ''; document.getElementById('m_m').value = '';
        document.getElementById('masterTitle').innerText = 'Tambah Barang Baru'; document.getElementById('btnHapusMaster').style.display = 'none';
        UI.showModal('modalMaster');
    },

    editMaster: (k) => {
        const d = DB.get('m').find(x => x.kode === k); if(!d) return;
        document.getElementById('m_k_old').value = d.kode; document.getElementById('m_k').value = d.kode; document.getElementById('m_n').value = d.nama; document.getElementById('m_m').value = d.masa || 0;
        document.getElementById('masterTitle').innerText = 'Edit Barang'; document.getElementById('btnHapusMaster').style.display = 'block';
        UI.showModal('modalMaster');
    },

    saveMaster: async () => {
        const k = document.getElementById('m_k').value.trim().toUpperCase();
        const n = document.getElementById('m_n').value.trim();
        const m = document.getElementById('m_m').value;
        const old_k = document.getElementById('m_k_old').value;
        if (!k || !n) return alert("Kode dan Nama Barang wajib diisi!");
        try {
            if (old_k && old_k !== k) { await sb.from('master_barang').delete().eq('kode', old_k); }
            const { error } = await sb.from('master_barang').upsert({ kode: k, nama: n, masa: m ? parseInt(m) : 0 });
            if (error) throw error;
            UI.closeModal('modalMaster');
            await DB.load(); UI.refresh();
            alert("Data barang berhasil disimpan!");
        } catch (err) { alert("Gagal menyimpan: " + err.message); }
    },

    deleteMaster: async () => {
        const k = document.getElementById('m_k_old').value;
        if(confirm("Yakin hapus barang ini? Pastikan tidak ada transaksi terkait!")) {
            try {
                const { error } = await sb.from('master_barang').delete().eq('kode', k);
                if (error) throw error;
                UI.closeModal('modalMaster');
                await DB.load(); UI.refresh();
            } catch(err) { alert("Gagal menghapus data dari Supabase."); }
        }
    },

    saveImport: async () => {
        const area = document.getElementById('importArea');
        const val = area.value.trim();
        if (!val) return alert("Data kosong! Silakan copy-paste dari Excel.");
        
        const lines = val.split('\n');
        let dataToPush = [];
        lines.forEach(line => {
            const p = line.split('\t');
            if (p.length >= 2) {
                dataToPush.push({
                    kode: p[0].trim().toUpperCase(),
                    nama: p[1].trim(),
                    masa: p[2] ? parseInt(p[2].trim()) : 0
                });
            }
        });

        if (dataToPush.length === 0) return alert("Format data tidak valid!");
        const btn = document.querySelector('#modalImport .btn-primary');
        const originalText = btn.innerText;
        btn.innerText = '⏳ Mengirim...'; btn.disabled = true;

        try {
            const { error } = await sb.from('master_barang').upsert(dataToPush, { onConflict: 'kode' });
            if (error) throw error;
            alert(`Berhasil! ${dataToPush.length} barang masuk ke database.`);
            UI.closeModal('modalImport');
            area.value = ''; 
            await DB.load(); UI.refresh();
        } catch (err) { alert("Gagal Import: " + err.message); } 
        finally { btn.innerText = originalText; btn.disabled = false; }
    },

prepareSave: (t) => {
      
        const tglRaw = document.getElementById('t_tgl')?.value || "";
        const tglDB = DateHelper.toDB ? DateHelper.toDB(tglRaw) : tglRaw;
        const ref = document.getElementById('t_ref')?.value.trim() || "-";
        const ket = document.getElementById('t_ket')?.value.trim() || "-";
        const kode = document.getElementById('t_k')?.value.toUpperCase() || "";
        
   
        const qInput = document.getElementById('t_q')?.value || document.getElementById('t_new_q')?.value;
        let q = parseInt(qInput);

        // Validasi Dasar
        if (!tglDB) return UI.showToast("⚠️ Tanggal wajib diisi!");
        if (!kode) return UI.showToast("⚠️ Kode Barang wajib diisi!");
        if (isNaN(q) || q <= 0) return UI.showToast("⚠️ Qty tidak valid!");

        
        const batch = (t === 'IN') ? document.getElementById('t_b')?.value : document.getElementById('t_b_sel')?.value;
        if (!batch) return UI.showToast("⚠️ Nomor Batch wajib diisi!");

        const expRaw = document.getElementById('t_exp')?.value.trim() || "";
        
        const existingId = window.editingId || null; 

      
        window.pendingData = { 
            tgl: tglDB, 
            ref: ref, 
            kode: kode, 
            batch: batch, 
            exp: expRaw ? DateHelper.toDB(expRaw) : null, 
            qty: q, 
            tipe: t, 
            ket: ket 
        };

   
        if (existingId) {
            window.pendingData.id = existingId;
        }

    
        let labelHeader = existingId ? "KONFIRMASI EDIT DATA" : "KONFIRMASI INPUT BARU";
        let colorHeader = existingId ? "#f59e0b" : "#6366f1"; 

        let previewHTML = `
            <div style="background: ${colorHeader}22; padding:10px; border-radius:5px; margin-bottom:10px; border: 1px solid ${colorHeader}">
                <b style="color:${colorHeader};">${labelHeader}</b>
            </div>
            <table style="width:100%; font-size:14px; border-collapse: collapse;">
                <tr style="border-bottom: 1px solid #eee;"><td width="40%" style="padding:5px 0;"><b>Tipe</b></td><td>: ${t === 'IN' ? '📥 MASUK' : '📤 KELUAR'}</td></tr>
                <tr style="border-bottom: 1px solid #eee;"><td style="padding:5px 0;"><b>Barang</b></td><td>: ${kode}</td></tr>
                <tr style="border-bottom: 1px solid #eee;"><td style="padding:5px 0;"><b>Batch</b></td><td>: ${batch}</td></tr>
                <tr><td style="padding:5px 0;"><b>Qty</b></td><td>: <b style="font-size:1.2em; color:#16a34a">${q}</b></td></tr>
            </table>`;

        document.getElementById('previewContent').innerHTML = previewHTML;
        UI.showModal('modalPreview');
        
       
        const btnS = document.getElementById('btnConfirmSave');
        if (btnS) {
            btnS.disabled = true; 
            btnS.innerText = "Tunggu...";
            window.setTimeout(() => { 
                btnS.disabled = false; 
                btnS.innerText = "💾 Simpan"; 
                btnS.focus(); 
            }, 500); 
        }
    },
    editLog: (id) => {
    const logs = DB.get('l') || [];
    const data = logs.find(x => String(x.id) === String(id));

    if (!data) return UI.showToast("⚠️ Data tidak ditemukan!");

    window.editingId = id;
    UI.openTrx(data.tipe);

    setTimeout(() => {
        // Isi field dasar
        if(document.getElementById('t_tgl')) document.getElementById('t_tgl').value = DateHelper.toUI(data.tgl);
        if(document.getElementById('t_ref')) document.getElementById('t_ref').value = data.ref || '';
        
        
        const elK = document.getElementById('t_k');
        if(elK) {
            elK.value = data.kode;
     
            UI.syncTrx('k', data.tipe); 
        }

        if(document.getElementById('t_q')) document.getElementById('t_q').value = data.qty;
        if(document.getElementById('t_ket')) document.getElementById('t_ket').value = data.ket || '';
        if(document.getElementById('t_exp')) document.getElementById('t_exp').value = data.exp || '';

        // Logika Batch
        if (data.tipe === 'IN') {
            if(document.getElementById('t_b')) document.getElementById('t_b').value = data.batch;
        } else {
  
            setTimeout(() => {
                const bSel = document.getElementById('t_b_sel');
                if(bSel) bSel.value = data.batch;
            }, 150);
        }
        UI.showToast("📝 Mode Edit Aktif");
    }, 250);
},

        deleteLog: async (id) => {

    if (id === undefined || id === null || id === "" || id === "undefined") {
        console.error("ID Transaksi tidak valid:", id);
        UI.showToast("❌ Error: ID Transaksi tidak terbaca.");
        return;
    }


    if (!confirm(`Hapus transaksi ID: ${id}?`)) return;
    
    try {
        
        const { data, error } = await sb
            .from('transaksi_log')
            .delete()
            .eq('id', id.toString())
            .select();

        if (error) throw error;

        
        if (!data || data.length === 0) {
            UI.showToast("⚠️ Gagal: Data sudah dihapus sebelumnya atau ID salah.");
        } else {
            UI.showToast("✅ Berhasil dihapus!");
        }

        
        await DB.load();
        UI.refresh();

    } catch (err) {
        console.error("Gagal hapus:", err);
        UI.showToast("❌ Gagal: " + err.message);
    }
},

    executeSave: async () => {
        if (!window.pendingData) return;
        const btn = document.getElementById('btnConfirmSave');
        if (btn) { btn.innerText = 'Menyimpan...'; btn.disabled = true; }
        
        try {
            const payload = {
                tgl: window.pendingData.tgl, 
                ref: window.pendingData.ref || "-", 
                kode: window.pendingData.kode,
                batch: window.pendingData.batch || "-", 
                qty: parseInt(window.pendingData.qty) || 0, 
                tipe: window.pendingData.tipe,
                ket: window.pendingData.ket || "-",
                exp: window.pendingData.exp || null,
                v: window.pendingData.v || false
            };

           
            if (window.pendingData.id) {
                payload.id = window.pendingData.id;
            }

     
            const { error } = await sb.from('transaksi_log').upsert([payload]);
            if (error) throw error;

            UI.closeModal('modalPreview'); 
            UI.closeModal('modalTrx');
            await DB.load(); 
            UI.refresh();
            UI.showToast("✅ Data Berhasil Disimpan!");

            window.editingId = null;

        } catch (err) { 
            console.error("Detail Error:", err);
            UI.showToast("❌ Gagal: " + err.message); 
        } finally { 
            if (btn) { btn.innerText = 'Simpan'; btn.disabled = false; } 
            window.pendingData = null; 
        }
    }
};


window.onload = async () => {
    const t = new Date();
    const today = t.toISOString().split('T')[0];
    const past30 = new Date(t.setDate(t.getDate() - 30)).toISOString().split('T')[0];

    // 1. Theme & Date Init
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-mode');
        const btn = document.getElementById('btnTheme'); if (btn) btn.innerText = '☀️';
    }
    const dateFields = { 'f_day_in_tgl': today, 'f_day_out_tgl': today, 'f_tgl_1': past30, 'f_tgl_2': today };
    Object.entries(dateFields).forEach(([id, val]) => {
        const el = document.getElementById(id); if (el) el.value = DateHelper.toUI(val);
    });
    
    // --- TAMBAHKAN KODE INI DI SINI ---
    const selY = document.getElementById('f_mutasi_y');
    if (selY) {
        const currentYear = new Date().getFullYear();
        for (let y = currentYear; y >= currentYear - 5; y--) {
            const opt = document.createElement('option');
            opt.value = y; opt.innerText = y;
            selY.appendChild(opt);
        }
    }
    
const selM = document.getElementById('f_mutasi_m');


if (selM && selY) {
    const now = new Date();
    const currentMonth = now.getMonth() + 1; 
    const currentYear = now.getFullYear();

    selM.value = currentMonth;
    selY.value = currentYear;
}

    try {
        const { data: { session }, error } = await sb.auth.getSession();

        if (session?.user && !error) {
           
            const email = session.user.email;
            let role = session.user.user_metadata?.role || (email === 'admin@stockmaster.local' ? 'admin' : 'staff');
            DB.set('currentUser', { role, email });

            document.body.classList.remove('is-public');
            document.body.classList.add(role + '-mode');
            Auth.applySession(role);

            
            const tabMenu = document.querySelector('.tab-menu'); if (tabMenu) tabMenu.style.removeProperty('display');
            const sidebar = document.querySelector('.sidebar'); if (sidebar) sidebar.style.removeProperty('display');
            document.querySelectorAll('.private').forEach(el => el.style.removeProperty('display'));
            
            await DB.load();
            DB.subscribe(); 

        } else {
 
            document.body.classList.remove('admin-mode', 'staff-mode');
            document.body.classList.add('is-public');
            DB.set('currentUser', { role: 'guest' });

         
            const tabMenu = document.querySelector('.tab-menu');
            if (tabMenu) tabMenu.style.setProperty('display', 'none', 'important');
            
            const sidebar = document.querySelector('.sidebar');
            if (sidebar) sidebar.style.setProperty('display', 'none', 'important');

            document.querySelectorAll('.private').forEach(el => {
                if (!el.classList.contains('auth-group') && !el.closest('.auth-group')) {
                    el.style.setProperty('display', 'none', 'important');
                }
            });

       
            const authGroup = document.querySelector('.auth-group');
            if (authGroup) authGroup.style.setProperty('margin-left', 'auto', 'important');

        
            await DB.load();
        }
    } catch (err) {
        console.error("Auth Error:", err);
    }

    
    const main = document.getElementById('main-content');
    if (main) main.classList.add('content-animate-in', 'visible');
    UI.refresh();


    document.addEventListener('click', (e) => {
        const ids = ['t_k', 't_n', 'b_f_kode', 'b_f_nama', 'l_f_kode', 'l_f_nama'];
        if (!ids.includes(e.target.id)) document.querySelectorAll('.autocomplete-items').forEach(el => { if (el) el.style.display = 'none'; });
    });
};

document.addEventListener('DOMContentLoaded', () => App.init());
document.addEventListener('keydown', (e) => {
    const modalP = document.getElementById('modalPreview');
    const modalT = document.getElementById('modalTrx');

    if (e.key === 'Enter') {
        // CASE 1: Jika Preview sudah muncul, tekan Enter untuk Simpan Permanen
        if (modalP && (modalP.style.display === 'flex' || modalP.style.display === 'block')) {
            const btnS = document.getElementById('btnConfirmSave');
            
            // Abaikan jika tombol masih 'Tunggu' (cooldown)
            if (btnS && btnS.disabled) {
                e.preventDefault();
                return;
            }

            if (btnS && !btnS.disabled) {
                e.preventDefault();
                e.stopPropagation(); 
                App.executeSave(); 
            }
            return;
        }

        if (modalT && (modalT.style.display === 'flex' || modalT.style.display === 'block')) {
   
            if (e.target.tagName === 'TEXTAREA') return;

            e.preventDefault();
            const currentType = window.currentTrxType || 'IN';
            App.prepareSave(currentType); 
        }
    }

    if (e.key === 'Escape') {
        UI.closeModal('modalPreview');
    }
}, true);