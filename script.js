// --- INIT SUPABASE ---
const SUPABASE_URL = "https://vwgdrmyrutsjwnmzfrwv.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3Z2RybXlydXRzandubXpmcnd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3OTMyMjQsImV4cCI6MjA5MDM2OTIyNH0.8abwamRFE-hVpA4Xyy4zcZAbZt-Gm6tYaMDfpkh9-nI";
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentFocus = -1;

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
                sb.from('master_barang').select('*'),
                sb.from('transaksi_log').select('*')
            ]);

            if (resMaster.error) throw resMaster.error;
            if (resTrx.error) throw resTrx.error;

            // Tambahkan ini: Pastikan memori lokal dibersihkan sebelum diisi ulang
            localStorage.removeItem('m');
            localStorage.removeItem('l');

            DB.set('m', resMaster.data || []);
            DB.set('l', resTrx.data || []);
            
            console.log("✅ Data sinkron dengan database terbaru.");
        } catch (err) {
            console.error("Gagal load data Supabase:", err.message);
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
        if(!role) return;
        document.body.className = (role === 'admin' ? 'admin-mode' : 'staff-mode') + (localStorage.getItem('theme') === 'dark' ? ' dark-mode' : '');
        document.querySelectorAll('.private').forEach(el => el.style.display = 'block');
        
        if (role !== 'admin') { 
            const btnPush = document.getElementById('btnPushDrive'); if (btnPush) btnPush.style.display = 'none'; 
            const btnExport = document.getElementById('btnExportExcel'); if (btnExport) btnExport.style.display = 'none'; 
        } else {
            document.getElementById('sidebar').classList.add('mini');
        }
        document.getElementById('btnAuth').style.display = 'none'; document.getElementById('btnLogout').style.display = 'block';
    },
    logout: async () => { 
        await sb.auth.signOut();
        localStorage.removeItem('currentUser'); 
        location.reload(); 
    }
};

const Engine = {
    calculate: () => {
        const logs = DB.get('l') || []; let res = {};
        logs.forEach(x => {
            const k = `${x.kode}|${x.batch}`; 
            if(!res[k]) res[k] = {...x, stok: 0};
            
            if(x.tipe === 'IN' && x.exp) res[k].exp = x.exp; 

            // --- PERBAIKAN DI SINI (Baris 111-113) ---
            if (x.tipe === 'IN') {
                res[k].stok += Number(x.qty);
            } else if (x.tipe === 'OUT') {
                res[k].stok -= Number(x.qty);
            } else if (x.tipe === 'ADJ') {
                // ADJ langsung ditambah karena qty sudah menyimpan +/- dari form
                res[k].stok += Number(x.qty); 
            }
            // -----------------------------------------
        });
        return Object.values(res).filter(x => x.stok > 0);
    }
};

const UI = {
    sortCol: 'kode', sortAsc: true, 
    sortMutasiCol: 'kode', sortMutasiAsc: true, 
    currentFocus: -1,
	sortDailyCol: 'ref',
    sortDailyAsc: true,


    // Tambahkan/Update di dalam objek UI: { ... }
    toggleVerify: async (id) => {
        // 1. Cari data di cache lokal (variabel l)
        const allLogs = DB.get('l');
        const logIndex = allLogs.findIndex(x => x.id == id);
        if (logIndex === -1) return;

        const newStatus = !allLogs[logIndex].v;

        try {
            // 2. Update ke Supabase
            const { error } = await sb.from('transaksi_log')
                .update({ v: newStatus })
                .eq('id', id);

            if (error) throw error;

            // 3. Update cache lokal agar saat pindah tab tidak hilang
            allLogs[logIndex].v = newStatus;
            
            // 4. Toast notifikasi singkat (1 detik)
            UI.showToast(newStatus ? "✅ Terverifikasi" : "🔄 Verifikasi Dibatalkan");

        } catch (err) {
            alert("Gagal update verifikasi: " + err.message);
            UI.refresh(); // Reset tampilan jika gagal
        }
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
        if (v.length === 8) { let p = v.split('-'); if (p.length === 3) el.value = `${p[0]}-${p[1]}-20${p[2]}`; }
        if (el.id.startsWith('f_')) UI.refresh(); 
    },

    sortStok: (col) => { if (UI.sortCol === col) { UI.sortAsc = !UI.sortAsc; } else { UI.sortCol = col; UI.sortAsc = true; } UI.refresh(); },
    
    sortMutasi: (col) => {
        if (UI.sortMutasiCol === col) { UI.sortMutasiAsc = !UI.sortMutasiAsc; } 
        else { UI.sortMutasiCol = col; UI.sortMutasiAsc = true; }
        UI.refresh();
    },

    showModal: (id) => document.getElementById(id).style.display = 'block',
    closeModal: (id) => document.getElementById(id).style.display = 'none',
    toggleSidebar: () => document.getElementById('sidebar').classList.toggle('mini'),

    switchTab: (id, btn) => {
        const targetPane = document.getElementById('tab-' + id);
        if (!targetPane) {
            console.error("Tab pane tidak ditemukan: tab-" + id);
            return;
        }

        // 1. Nonaktifkan semua tab & button yang ada
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        
        // 2. Aktifkan tab yang dipilih
        targetPane.classList.add('active');
        if (btn) btn.classList.add('active');
        
        // 3. Jalankan refresh agar data langsung muncul
        UI.refresh();
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


   showAutoList: (type, formType = '', e) => {
        if (e && [38, 40, 13, 9].includes(e.keyCode)) return;

        const inpId = type === 'k' ? 't_k' : (type === 'n' ? 't_n' : (type === 'b_f_k' ? 'b_f_kode' : (type === 'b_f_n' ? 'b_f_nama' : (type === 'l_f_k' ? 'l_f_kode' : 'l_f_nama'))));
        const listId = (inpId === 't_k' ? 't_k_list' : (inpId === 't_n' ? 't_n_list' : type + '_list'));
        const inp = document.getElementById(inpId); const listEl = document.getElementById(listId);
        if(!inp || !listEl) return;

        // Reset fokus agar TAB/ENTER selalu ambil baris pertama jika tidak ada navigasi panah
        UI.currentFocus = -1; 

        if (['k', 'n'].includes(type)) {
            const targetId = type === 'k' ? 't_n' : 't_k';
            const targetEl = document.getElementById(targetId);
            if (targetEl) targetEl.value = ''; 
            const elStk = document.getElementById('t_stk_tot') || document.getElementById('t_stk_b');
            if (elStk) elStk.value = '';
            const bSelect = document.getElementById('t_b_sel');
            if (bSelect) bSelect.innerHTML = '<option value="">--Pilih Kode Dulu--</option>';
        }

        const ms = DB.get('m') || []; 
        const val = inp.value.trim().toUpperCase(); 

        if(val === '') {
            listEl.style.display = 'none'; return;
        }

        const isKode = ['t_k', 'b_f_kode', 'l_f_kode'].includes(inpId);
        const filtered = ms.filter(x => (isKode ? (x.kode||'').toUpperCase() : (x.nama||'').toUpperCase()).includes(val));
        
        if(filtered.length === 0) { listEl.style.display = 'none'; return; }

        listEl.innerHTML = filtered.map(x => `<div onclick="UI.selectAuto('${x.kode}', '${type}', '${formType}')"><b>${x.kode}</b><br><span style="color:#64748b;">${x.nama}</span></div>`).join('');
        listEl.style.display = 'block';
    },

    // --- Perbaikan handleAutoKey ---
handleAutoKey: (e, type, formType) => {
        const inpId = type === 'k' ? 't_k' : (type === 'n' ? 't_n' : (type === 'b_f_k' ? 'b_f_kode' : (type === 'b_f_n' ? 'b_f_nama' : (type === 'l_f_k' ? 'l_f_kode' : 'l_f_nama'))));
        const listId = (inpId === 't_k' ? 't_k_list' : (inpId === 't_n' ? 't_n_list' : type + '_list'));
        
        let x = document.getElementById(listId);
        if (x) x = x.getElementsByTagName("div");
        if (!x || x.length === 0) return;

        if (e.keyCode == 40) { // BAWAH
            UI.currentFocus++;
            UI.addActive(x);
        } else if (e.keyCode == 38) { // ATAS
            UI.currentFocus--;
            UI.addActive(x);
        } else if (e.keyCode == 13 || e.keyCode == 9) { // ENTER atau TAB
            // Ambil index 0 jika user belum sempat menekan panah bawah
            let targetIndex = UI.currentFocus > -1 ? UI.currentFocus : 0;
            
            if (x[targetIndex]) {
                // Cegah kursor pindah input sebelum fungsi click() selesai memproses data
                if (e.keyCode == 9) e.preventDefault(); 
                x[targetIndex].click(); 
            }
        }
    },

    addActive: (x) => {
        if (!x) return false;
        // Bersihkan class active dari semua item
        for (let i = 0; i < x.length; i++) {
            x[i].classList.remove("autocomplete-active");
        }

        // --- REVISI: Gunakan UI.currentFocus agar sinkron ---
        if (UI.currentFocus >= x.length) UI.currentFocus = 0;
        if (UI.currentFocus < 0) UI.currentFocus = (x.length - 1);
        
        x[UI.currentFocus].classList.add("autocomplete-active");
        x[UI.currentFocus].scrollIntoView({ block: "nearest" });
    },

removeActive: (x) => {
    for (let i = 0; i < x.length; i++) {
        x[i].classList.remove("autocomplete-active");
    }
},

    // --- Perbaikan Fungsi selectAuto ---
    selectAuto: (kode, type, formType) => {
        const ms = DB.get('m') || []; 
        const item = ms.find(x => x.kode === kode); 
        if(!item) return;

        if (['k', 'n'].includes(type)) { 
            // 1. Set Value Utama
            const elK = document.getElementById('t_k');
            const elN = document.getElementById('t_n');
            if(elK) elK.value = item.kode; 
            if(elN) elN.value = item.nama;

            // 2. Sembunyikan List Dropdown
            document.querySelectorAll('.autocomplete-items').forEach(el => el.style.display = 'none');

            // 3. Jalankan Sinkronisasi (Data Batch/Stok)
            UI.syncTrx('k', formType);

            // 4. Pindahkan Fokus Kursor secara otomatis
            setTimeout(() => {
                if(formType === 'IN') { 
                    const elB = document.getElementById('t_b');
                    if(elB) elB.focus(); 
                } 
                else if (['OUT', 'ADJ'].includes(formType)) { 
                    const elBSel = document.getElementById('t_b_sel');
                    if(elBSel) elBSel.focus(); 
                }
                else if (formType === 'RET') { 
                    const elNewQ = document.getElementById('t_new_q');
                    if(elNewQ) elNewQ.focus(); 
                }
            }, 50);

        } else if (['b_f_k', 'b_f_n'].includes(type)) { 
            document.getElementById('b_f_kode').value = item.kode; 
            document.getElementById('b_f_nama').value = item.nama;
            UI.refresh();
        } else { 
            document.getElementById('l_f_kode').value = item.kode; 
            document.getElementById('l_f_nama').value = item.nama;
            UI.refresh();
        }
    },

    refresh: () => {
        const ms = DB.get('m') || []; 
        const l = DB.get('l') || []; 
        const act = Engine.calculate() || []; 
        
        const qG = document.getElementById('searchInput')?.value.toUpperCase() || '';
        const session = DB.get('currentUser') || {}; 
        const isAdmin = session.role === 'admin';
        
        // FIX ERROR STYLE: Gunakan ID yang sesuai dengan HTML (th_aksi_stok)
        const thAksi = document.getElementById('th_aksi_stok'); 
        if(thAksi) thAksi.style.display = isAdmin ? 'table-cell' : 'none';

        // 1. Tab Stok (Inventory) - Proteksi classList
        const tStok = document.getElementById('tab-stok');
        if(tStok?.classList.contains('active')) {
            let stokData = ms.filter(m => (m.kode||'').toUpperCase().includes(qG) || (m.nama||'').toUpperCase().includes(qG)).map(m => {
                const bts = act.filter(b => b.kode === m.kode), ttl = bts.reduce((a,b)=>a+b.stok, 0); 
                return { kode: m.kode || '-', nama: m.nama || '-', stok: ttl };
            });
            
            stokData.sort((a, b) => {
                let vA = a[UI.sortCol]; let vB = b[UI.sortCol];
                if(typeof vA === 'string') { vA = vA.toUpperCase(); vB = vB.toUpperCase(); }
                if(vA < vB) return UI.sortAsc ? -1 : 1; if(vA > vB) return UI.sortAsc ? 1 : -1; return 0;
            });

            const invBody = document.getElementById('inventoryBody');
            if(invBody) {
                invBody.innerHTML = stokData.map(m => {
                    let actionBtn = isAdmin ? `<td style="text-align:center;"><button class="btn-outline" style="padding:2px 8px; font-size:11px; margin:0;" onclick="App.editMaster('${m.kode}')">✏️ edit</button></td>` : '';
                    return `<tr><td><b>${m.kode}</b></td><td>${m.nama}</td><td>${m.stok}</td><td>${m.stok > 0 ? '<span class="txt-m" style="color:#16a34a">Aktif</span>' : '<span style="color:#94a3b8">-</span>'}</td>${actionBtn}</tr>`;
                }).join('');
            }
            
            ['kode', 'nama', 'stok'].forEach(c => { 
                const el = document.getElementById(`sort_${c}`); 
                if(el) el.innerHTML = UI.sortCol === c ? (UI.sortAsc ? '▲' : '▼') : ''; 
            });
        }

        // 2. Render Tab Harian (IN & OUT)
        UI.renderDaily('day-in', 'IN', ms, l); 
        UI.renderDaily('day-out', 'OUT', ms, l);

        // 3. FIX ERROR classList: Tambahkan pengecekan eksistensi elemen sebelum cek .active
        const checkActive = (id) => document.getElementById(id)?.classList.contains('active');

        if (checkActive('tab-mutasi')) UI.renderMutasiPivot(ms, l);
        if (checkActive('tab-batch')) UI.renderBatch(ms, act);
        if (checkActive('tab-log')) UI.renderLog(ms, l);
        if (checkActive('tab-expiry')) UI.renderExpiry();
    },

    renderMutasiPivot: (ms, l) => {
    const selM = document.getElementById('f_mutasi_m'); 
    const selY = document.getElementById('f_mutasi_y');
    if(!selM || !selY) return;

    const now = new Date();
    const m = selM.value ? parseInt(selM.value) : now.getMonth() + 1;
    const y = selY.value ? parseInt(selY.value) : now.getFullYear();
    
    const days = new Date(y, m, 0).getDate(); 
    const q = (document.getElementById('f_mutasi_q').value || "").toUpperCase();

    const getArrow = (col) => UI.sortMutasiCol === col ? (UI.sortMutasiAsc ? ' ▲' : ' ▼') : '';
    
    // Render Header Tabel
    let h1 = `<tr><th rowspan="2" class="sticky-col k-kode sortable" onclick="UI.sortMutasi('kode')">Kode${getArrow('kode')}</th><th rowspan="2" class="sticky-col k-nama sortable" onclick="UI.sortMutasi('nama')">Nama Barang${getArrow('nama')}</th><th rowspan="2" class="sticky-col k-awal" style="background-color: var(--bg-awal);">Awal</th>`; 
    let h2 = `<tr>`;
    for(let i=1; i<=days; i++) { 
        h1 += `<th colspan="2" class="day-header">${i}</th>`; 
        h2 += `<th class="sub-col" style="background-color: var(--bg-in);">M</th><th class="sub-col" style="background-color: var(--bg-out);">K</th>`; 
    }
    h1 += `<th rowspan="2">IN</th><th rowspan="2">OUT</th><th rowspan="2" class="sortable" onclick="UI.sortMutasi('akhir')" style="background-color: var(--bg-akhir);">Akhir${getArrow('akhir')}</th></tr>`; 
    document.getElementById('mutasiHeader').innerHTML = h1 + h2 + `</tr>`;
    
    // Olah Data Pivot
    let pivotData = ms.filter(m_ => (m_.kode||'').includes(q) || (m_.nama||'').toUpperCase().includes(q)).map(it => {
        let aw = 0, ti = 0, to = 0;
        let dM = Array(days+1).fill(0), dK = Array(days+1).fill(0);
        
        l.filter(x => x.kode === it.kode).forEach(log => {
            // FIX: Gunakan split agar tidak terpengaruh zona waktu browser
            const parts = log.tgl.split('-'); // Asumsi format YYYY-MM-DD
            const ly = parseInt(parts[0]);
            const lm = parseInt(parts[1]);
            const ld = parseInt(parts[2]);
            
            // 1. Saldo Awal (Bulan-bulan sebelumnya)
            if (ly < y || (ly === y && lm < m)) {
                if (log.tipe === 'IN') aw += log.qty;
                else if (log.tipe === 'OUT') aw -= log.qty;
                else if (log.tipe === 'ADJ') aw += log.qty; 
            } 
            
            // 2. Harian (Bulan Berjalan)
            else if (ly === y && lm === m) { 
                const day = ld; // Ambil tanggal dari split tadi
                
                // KOREKSI/ADJ
                if (log.tipe === 'ADJ') {
                    dM[day] += log.qty;
                    ti += log.qty;
                }
                // RETURN
                else if (log.ref && String(log.ref).endsWith('-RET')) {
                    dK[day] -= log.qty; 
                    to -= log.qty;
                } 
                // MASUK (IN)
                else if (log.tipe === 'IN') { 
                    dM[day] += log.qty; 
                    ti += log.qty; 
                } 
                // KELUAR (OUT)
                else if (log.tipe === 'OUT') { 
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

    // Sortir
    pivotData.sort((a, b) => {
        let vA = a[UI.sortMutasiCol]; let vB = b[UI.sortMutasiCol];
        if(typeof vA === 'string') { vA = vA.toUpperCase(); vB = vB.toUpperCase(); }
        if(vA < vB) return UI.sortMutasiAsc ? -1 : 1; if(vA > vB) return UI.sortMutasiAsc ? 1 : -1; return 0;
    });

    // Render Body
    document.getElementById('mutasiTableBody').innerHTML = pivotData.map(row => {
        let htmlRow = `<tr><td class="sticky-col k-kode"><b>${row.kode}</b></td><td class="sticky-col k-nama">${row.nama}</td><td class="sticky-col k-awal" style="background-color: var(--bg-awal);">${row.awal}</td>`;
        for(let i=1; i<=days; i++) { 
            const valM = row.harianM[i] || '';
            const valK = row.harianK[i] || '';
            htmlRow += `<td class="sub-col txt-m" style="background-color: var(--bg-in);">${valM}</td><td class="sub-col txt-k" style="background-color: var(--bg-out);">${valK}</td>`; 
        }
        return htmlRow + `<td>${row.masuk}</td><td>${row.keluar}</td><td style="background-color: var(--bg-akhir); font-weight:bold;">${row.akhir}</td></tr>`;
    }).join('');
},

    sortDaily: (col, tabId) => {
        if (UI.sortDailyCol === col) {
            UI.sortDailyAsc = !UI.sortDailyAsc;
        } else {
            UI.sortDailyCol = col;
            UI.sortDailyAsc = true;
        }
        UI.refresh();
    },

    renderDaily: (id, tipe, ms, l) => {
        const pane = document.getElementById('tab-' + id);
        if (!pane) return; 
        
        // --- TIPS: Jangan kunci dengan .active agar render tetap jalan saat switch tab ---

        const baseID = id.replace(/-/g, '_'); 
        const altID = id.replace(/-/g, '');   
        
        const tglInput = document.getElementById(`f_${baseID}_tgl`) || document.getElementById(`f_${altID}_tgl`);
        const qInput = document.getElementById(`f_${baseID}_q`) || document.getElementById(`f_${altID}_q`);
        
        if (!tglInput) return;

        const tglFilter = DateHelper.toDB(tglInput.value);
        const searchVal = qInput ? qInput.value.toUpperCase() : "";

        // 1. FILTER DATA
        let filtered = l.filter(x => {
            const isMatch = x.tgl === tglFilter && x.tipe === tipe;
            const m = ms.find(it => it.kode === x.kode) || {};
            const isSearch = (x.kode || '').toUpperCase().includes(searchVal) || 
                             (m.nama || '').toUpperCase().includes(searchVal) ||
                             (x.ref || '').toUpperCase().includes(searchVal);
            
            const isNotAdj = x.tipe !== 'ADJ';
            const isNotReturn = !(tipe === 'IN' && x.ref && String(x.ref).endsWith('-RET'));
            return isMatch && isSearch && isNotAdj && isNotReturn;
        });

        // 2. SORTING (Tetap Utuh)
        filtered.sort((a, b) => {
            if (a.v !== b.v) return a.v ? 1 : -1;
            let col = UI.sortDailyCol || 'ref';
            let vA, vB;
            if (col === 'nama') {
                vA = (ms.find(m => m.kode === a.kode)?.nama || "").toUpperCase();
                vB = (ms.find(m => m.kode === b.kode)?.nama || "").toUpperCase();
            } else {
                vA = (a[col] || "").toString().toUpperCase();
                vB = (b[col] || "").toString().toUpperCase();
            }
            if (vA < vB) return UI.sortDailyAsc ? -1 : 1;
            if (vA > vB) return UI.sortDailyAsc ? 1 : -1;
            return 0;
        });

        // 3. UPDATE PANAH SORTING
        const cols = ['ref', 'kode', 'nama', 'batch'];
        cols.forEach(c => {
            const sortEl = document.getElementById(`sort_${baseID}_${c}`) || document.getElementById(`sort_${altID}_${c}`);
            if (sortEl) sortEl.innerHTML = (UI.sortDailyCol === c) ? (UI.sortDailyAsc ? ' ▲' : ' ▼') : '';
        });

        const bodyId = `${altID}TableBody`; 
        const bodyEl = document.getElementById(bodyId);
        if (!bodyEl) return;

        const isAdmin = (DB.get('currentUser')?.role === 'admin');

        // 4. RENDER HTML
        if (filtered.length === 0) {
            bodyEl.innerHTML = `<tr><td colspan="7" align="center" style="padding:20px; color:#94a3b8;">Tidak ada data untuk tanggal ini</td></tr>`;
            return;
        }

        bodyEl.innerHTML = filtered.map(x => {
            const m = ms.find(i => i.kode === x.kode);
            let dQty = x.qty;
            if (tipe === 'OUT') {
                const totalRet = l.filter(r => r.ref === x.ref + "-RET").reduce((a, b) => a + b.qty, 0);
                dQty = x.qty - totalRet;
            }

            const actionArea = isAdmin ? `
                <div style="display:flex; gap:10px; justify-content:center; align-items:center;">
                    <input type="checkbox" ${x.v ? 'checked' : ''} style="cursor:pointer" onchange="UI.toggleVerify('${x.id}')">
                    <button type="button" onclick="App.deleteLog('${x.id}')" style="background:none; border:none; cursor:pointer; color:#dc2626;" title="Hapus Data">🗑️</button>
                </div>
            ` : (x.v ? `<span style="color:#16a34a; font-weight:bold;">✅ Verif</span>` : `<span style="color:#94a3b8; font-weight:bold;">-</span>`);

            return `
                <tr class="${x.v ? 'is-verified' : ''}">
                    <td>${x.ref}</td>
                    <td><b>${x.kode}</b></td>
                    <td>${m ? m.nama : '<i>Master Hilang</i>'}</td>
                    <td>${x.batch || '-'}</td>
                    <td align="right"><b>${Math.abs(dQty)}</b></td>
                    <td>${x.ket || '-'}</td>
                    <td align="center">${actionArea}</td>
                </tr>`;
        }).join('');
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
        const body = document.getElementById('logTableBody');
        if (!body) return;

        // 1. CEK ROLE USER (Mendukung dari DB lokal maupun localStorage)
        const currentUser = DB.get('currentUser') || JSON.parse(localStorage.getItem('currentUser') || '{}');
        const isAdmin = currentUser.role === 'admin';

        // 2. Ambil Nilai Filter dari Inputan di Layar
        const t1 = DateHelper.toDB(document.getElementById('f_tgl_1')?.value || '');
        const t2 = DateHelper.toDB(document.getElementById('f_tgl_2')?.value || '');
        const qK = document.getElementById('l_f_kode')?.value.toUpperCase() || '';
        const tipe = document.getElementById('f_tipe')?.value || 'ALL';

        // 3. Proses Menyaring Data
        const filtered = l.filter(x => {
            const isDate = (t1 && t2) ? (x.tgl >= t1 && x.tgl <= t2) : true;
            const isKode = qK ? x.kode.toUpperCase().includes(qK) : true;
            const isTipe = (tipe === 'ALL' || x.tipe === tipe);
            return isDate && isKode && isTipe;
        });

        // 4. Masukkan Data ke Dalam Tabel
        body.innerHTML = filtered.reverse().map(x => {
            const m = ms.find(i => i.kode === x.kode);
            let tColor = x.tipe === 'IN' ? 'txt-m' : (x.tipe === 'OUT' ? 'txt-k' : '');
            
            // 5. KONDISI TOMBOL: Jika Admin render tombol, jika bukan beri tanda strip
            const actionBtns = isAdmin ? `
                <div style="display:flex; gap:15px; justify-content:center; align-items:center;">
                    <button type="button" onclick="App.editLog('${x.id}')" style="background:none; border:none; cursor:pointer; font-size:16px; color:#2563eb;" title="Edit Data">✏️</button>
                    <button type="button" onclick="App.deleteLog('${x.id}')" style="background:none; border:none; cursor:pointer; font-size:16px; color:#dc2626;" title="Hapus Data">🗑️</button>
                </div>
            ` : `<span style="color:#94a3b8; font-weight:bold;">-</span>`;

            return `
                <tr>
                    <td>${DateHelper.toUI(x.tgl)}</td>
                    <td>${x.ref}</td>
                    <td><b>${x.kode}</b></td>
                    <td>${m ? m.nama : '<i style="color:red">Barang Tidak Ada di Master</i>'}</td>
                    <td>${x.batch || '-'}</td>
                    <td class="${tColor}"><b>${x.qty}</b></td>
                    <td align="center"><span class="badge-${x.tipe.toLowerCase()}">${x.tipe}</span></td>
                    <td>${x.ket || '-'}</td>
                    <td align="center">${actionBtns}</td>
                </tr>`;
        }).join('');
    },
		// Tambahkan di dalam objek UI: { ... }
renderExpiry: () => {
    const act = Engine.calculate(); 
    const tbody = document.getElementById('expiryTableBody');
    if(!tbody) return;

    const today = new Date();
    const alertLimit = new Date();
    alertLimit.setDate(today.getDate() + 90); // Munculkan yang expired dalam 90 hari ke depan

    const data = act.filter(b => {
        if(!b.exp) return false;
        const eDate = new Date(b.exp);
        return eDate <= alertLimit && b.stok > 0;
    }).sort((a, b) => new Date(a.exp) - new Date(b.exp));

    tbody.innerHTML = data.map(b => {
        const m = DB.get('m').find(x => x.kode === b.kode);
        const eDate = new Date(b.exp);
        const diff = Math.ceil((eDate - today) / (1000 * 60 * 60 * 24));
        const statusClass = diff <= 30 ? 'txt-k' : 'txt-m'; // Merah jika < 30 hari

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
    // --- Perbaikan Fungsi syncTrx ---
    syncTrx: (src, t) => {
        if(src === 'k') {
            const k = document.getElementById('t_k').value;
            const item = DB.get('m').find(x => x.kode === k); 
            
            const elNama = document.getElementById('t_n');
            if(elNama) elNama.value = item ? item.nama : '';

            if(t === 'IN') { 
                 const elExp = document.getElementById('t_exp');
                 if(elExp) elExp.value = '';  
            } else {
                const bSelect = document.getElementById('t_b_sel'); 
                const act = Engine.calculate().filter(x => x.kode === k);
                
                if(bSelect) {
                    bSelect.innerHTML = act.length === 0 ? '<option value="">--Kosong--</option>' : 
                    '<option value="">--Pilih Batch--</option>' + 
                    act.map(x => `<option value="${x.batch}">📦 ${x.batch} (Stok: ${x.stok}) ${x.exp ? ' ⏳ Exp: '+DateHelper.toUI(x.exp) : ''}</option>`).join('');
                }

                // Baris Kunci: Gunakan ?. agar tidak error jika t_stk_tot dihapus (di Form IN)
                const elStkTot = document.getElementById('t_stk_tot');
                if(elStkTot) elStkTot.value = act.reduce((a, b) => a + b.stok, 0); 
                
                const elQty = document.getElementById('t_q');
                if(elQty) elQty.value = '';
            }
        } else if (src === 'b') {
            const k = document.getElementById('t_k').value;
            const b = document.getElementById('t_b_sel')?.value; // Tambah ?.
            
            const elStkB = document.getElementById('t_stk_b');
            if(!k || !b) { 
                if(elStkB) elStkB.value = ''; 
                return; 
            }

            const st = Engine.calculate().find(x => x.kode === k && x.batch === b);
            if(elStkB) elStkB.value = st ? st.stok : 0; 
            
            const elQty = document.getElementById('t_q');
            if(elQty) { elQty.value = ''; elQty.focus(); }
        }
    },

    checkBatchIn: () => {
        const k = document.getElementById('t_k').value.toUpperCase(), b = document.getElementById('t_b').value.trim();
        if(!k || !b) return;
        const exist = Engine.calculate().find(x => x.kode === k && x.batch === b);
        if(exist && confirm(`Batch "${b}" sudah ada (Stok: ${exist.stok}). Tambah barang ke batch ini?`)) {
            if(exist.exp) document.getElementById('t_exp').value = DateHelper.toUI(exist.exp);
        }
    },

   openTrx: (t) => {
        const modal = document.getElementById('modalTrx');
        const mContent = document.getElementById('trxBody');
        if (!modal || !mContent) return alert("Error: Wadah Modal tidak ditemukan!");

        // Pastikan modal tidak memblokir klik/scroll ke tabel belakang
        modal.style.pointerEvents = "none"; 
        mContent.style.pointerEvents = "auto";

        const todayUI = DateHelper.toUI(new Date().toISOString().split('T')[0]);
        
        // Atur ukuran dan tampilan modal agar tidak "kecil"
        mContent.style.padding = '0';
        mContent.style.minWidth = '350px'; 
        mContent.style.maxWidth = '500px';
        mContent.style.position = 'absolute'; // Wajib agar bisa digeser

        // Reset posisi jika sebelumnya form sudah digeser-geser
        if (typeof Draggable !== 'undefined') Draggable.reset('trxBody');

        let judul = "Form " + t;
        if(t === 'IN') judul = "Barang Masuk";
        else if(t === 'OUT') judul = "Barang Keluar";
        else if(t === 'ADJ') judul = "Stok Opname (ADJ)";

        // Tambahkan cursor:grab agar terlihat bisa ditarik
        let h = `
            <div id="trxHeader" style="background:#f1f5f9; padding:12px 15px; border-radius:8px 8px 0 0; border-bottom:1px solid #ddd; display:flex; justify-content:space-between; align-items:center; font-weight:bold; cursor:grab;">
                <span>${judul}</span>
                <span onclick="UI.closeModal('modalTrx')" style="cursor:pointer; color:#ef4444;">✕</span>
            </div>
            <div style="padding: 20px; display:flex; flex-direction:column; gap:10px;">
                <label>Tanggal:</label>
                <input type="text" id="t_tgl" value="${todayUI}" oninput="UI.formatDateInput(this)">
                
                <label>No. Ref:</label>
                <input id="t_ref" placeholder="Contoh: Nota-001">

                <label>Barang (Kode/Nama):</label>
                <div style="display:flex; gap:5px; position:relative;">
                    <input id="t_k" style="flex:2" placeholder="Kode" onkeyup="UI.showAutoList('k', '${t}', event)">
                    <input id="t_n" style="flex:3" placeholder="Nama Barang" onkeyup="UI.showAutoList('n', '${t}', event)">
                    <div id="t_k_list" class="autocomplete-items"></div>
                    <div id="t_n_list" class="autocomplete-items"></div>
                </div>`;

        if(t === 'IN') {
            h += `
                <label>Batch:</label><input id="t_b" placeholder="Nomor Batch">
                <div style="display:flex; gap:10px;">
                    <div style="flex:1"><label>Qty:</label><input id="t_q" type="number"></div>
                    <div style="flex:1"><label>Expired:</label><input id="t_exp" placeholder="DD-MM-YYYY"></div>
                </div>`;
        } else {
            h += `
                <label>Stok Barang Total:</label>
                <input id="t_stk_tot" readonly class="read-only" value="0">

                <label>Pilih Batch:</label>
                <select id="t_b_sel" onchange="UI.syncTrx('b', '${t}')"><option value="">--Pilih Kode Dulu--</option></select>`;
            
            if(t === 'ADJ') {
                h += `
                    <label>Jenis Adjustment:</label>
                    <select id="t_adj_type"><option value="IN">Tambah (+)</option><option value="OUT">Kurang (-)</option></select>`;
            }

            h += `
                <div style="display:flex; gap:10px;">
                    <div style="flex:1"><label>Stok per Batch:</label><input id="t_stk_b" readonly class="read-only"></div>
                    <div style="flex:1"><label>Qty:</label><input id="t_q" type="number"></div>
                </div>
                <label>Keterangan:</label><input id="t_ket" placeholder="-">`;
        }

        h += `
            <div style="display:flex; gap:10px; margin-top:15px;">
                <button class="btn-primary" style="flex:1;" onclick="App.prepareSave('${t}')">Simpan</button>
                <button class="btn-outline" style="flex:1; margin-top:0" onclick="UI.closeModal('modalTrx')">Batal</button>
            </div>
        </div>`;

        mContent.innerHTML = h;
        modal.style.display = 'block'; // PAKSA MUNCUL

	   // --- TAMBAHKAN BARIS INI (Baris Kunci) ---
        mContent.style.left = '50%'; 
        mContent.style.transform = 'translateX(-50%)';
        // -
        // PANGGIL FUNGSI GESER BUATANMU SENDIRI DI SINI
        if (typeof Draggable !== 'undefined') {
            Draggable.init('trxBody', 'trxHeader');
        }
    },

    findRef: () => {
        const r = document.getElementById('t_ref_s').value.trim(); if(!r) return;
        const l = DB.get('l').filter(x => x.ref === r && x.tipe === 'OUT'), s = document.getElementById('t_ret_item');
        if(l.length === 0) { alert("Ref tidak ditemukan!"); s.innerHTML = '<option value="">--Kosong--</option>'; } 
        else { s.innerHTML = '<option value="">--Pilih Barang--</option>' + l.map(x => `<option value='${JSON.stringify(x)}'>${x.kode} (Qty: ${x.qty})</option>`).join(''); }
    },

    fillRet: () => {
        const val = document.getElementById('t_ret_item').value; if(!val) return;
        const d = JSON.parse(val), act = Engine.calculate().find(b => b.kode === d.kode && b.batch === d.batch);
        document.getElementById('t_k').value = d.kode; document.getElementById('t_n').value = DB.get('m').find(x=>x.kode===d.kode)?.nama || "";
        document.getElementById('t_q_old').value = d.qty; document.getElementById('t_stk_b').value = act ? act.stok : 0;
    },
	showToast: (msg) => {
        const t = document.createElement('div');
        t.className = 'toast-container';
        t.innerText = msg;
        document.body.appendChild(t);
        setTimeout(() => t.remove(), 2000); 
    },
	// Tambahkan di dalam UI: { ... }
    handlePreviewKey: (e) => {
        const modal = document.getElementById('modalPreview');
        // Hanya jalan jika modal Preview sedang tampil (display block)
        if (modal && modal.style.display === 'block') {
            if (e.keyCode === 13) { 
                e.preventDefault();
                App.executeSave(); // Panggil fungsi simpan permanen
            } else if (e.keyCode === 27) {
                UI.closeModal('modalPreview'); // Opsional: Esc untuk batal
            }
        }
    }
};

const App = {
    editLog: (id) => {
        const logs = DB.get('l') || [];
        const masters = DB.get('m') || [];
        const item = logs.find(x => x.id == id);
        
        if (!item) return alert("Data tidak ditemukan! Refresh (F5) dulu.");

        // Buka wadah form sesuai tipenya
        UI.openTrx(item.tipe);

        // Isi form dengan jeda agar HTML selesai dimuat
        setTimeout(() => {
            const m = masters.find(i => i.kode === item.kode);
            
            const elTgl = document.getElementById('t_tgl');
            const elRef = document.getElementById('t_ref');
            const elK   = document.getElementById('t_k');
            const elN   = document.getElementById('t_n');
            const elB   = document.getElementById('t_b');
            const elQ   = document.getElementById('t_q');
            const elExp = document.getElementById('t_exp');

            // 1. ISI FIELD YANG BISA DIEDIT (Tgl, Ref, Batch, Exp)
            if(elTgl) elTgl.value = DateHelper.toUI(item.tgl);
            if(elRef) elRef.value = item.ref || '';
            if(elB) elB.value = item.batch || '';
            if(elExp) elExp.value = item.exp ? DateHelper.toUI(item.exp) : '';
            
            // 2. KUNCI KODE BARANG
            if(elK) {
                elK.value = item.kode || '';
                elK.readOnly = true;
                elK.style.background = '#e2e8f0';
                elK.style.cursor = 'not-allowed';
                elK.tabIndex = -1;
            }
            
            // 3. KUNCI NAMA BARANG
            if(elN) {
                elN.value = m ? m.nama : 'Tidak Ditemukan';
                elN.readOnly = true;
                elN.style.background = '#e2e8f0'; 
                elN.style.cursor = 'not-allowed';
                elN.tabIndex = -1;
            }
            
            // 4. KUNCI QUANTITY (QTY)
            if(elQ) {
                elQ.value = Math.abs(item.qty);
                elQ.readOnly = true;
                elQ.style.background = '#e2e8f0';
                elQ.style.cursor = 'not-allowed';
                elQ.tabIndex = -1;
            }
            
            // Simpan ID agar sistem tahu ini mode UPDATE
            window.editingLogId = id;
            
            // Ubah teks tombol simpan
            const btn = document.querySelector('#modalTrx .btn-primary');
            if(btn) btn.innerText = "Update Data (Enter)";
            
            console.log("Edit Mode aktif untuk ID:", id, "- Kode, Nama, dan Qty dilock.");
        }, 300);
    },

    // 2. FORM PREPARATION (VALIDASI & PREVIEW)
    prepareSave: (t) => {
        const ms = DB.get('m') || [];
        const qInput = document.getElementById('t_q')?.value || document.getElementById('t_new_q')?.value;
        let q = parseInt(qInput); 
        
        // Form edit kita tanpa field keterangan, jadi set default "-"
        const ket = "-";
        
        const tglRaw = document.getElementById('t_tgl')?.value || ""; 
        const tglDB = DateHelper.toDB(tglRaw);
        
        if(!tglDB || tglDB.length !== 10) return alert("Format Tanggal tidak valid! (DD-MM-YYYY)");
        
        // Expired Date sekarang universal untuk semua tipe (agar data lama tidak hilang saat edit)
        const expRaw = document.getElementById('t_exp')?.value.trim() || ""; 
        let expDB = expRaw ? DateHelper.toDB(expRaw) : null;
        
        if(expRaw && (!expDB || expDB.length !== 10)) return alert("Format Expired salah!");
        if(isNaN(q) || q <= 0) return alert("Qty tidak valid!");

        // Ambil data lama jika sedang mode edit (agar status verifikasi/v tidak hilang)
        let existingData = {};
        if (window.editingLogId) {
            existingData = (DB.get('l') || []).find(x => x.id == window.editingLogId) || {};
        }
        
        let previewHTML = "";
        
        if(t === 'RET') {
            const rData = document.getElementById('t_ret_item').value; 
            if(!rData) return;
            const refLog = JSON.parse(rData); 
            const oldQ = parseInt(document.getElementById('t_q_old').value);
            if(q > oldQ) return alert(`Koreksi maksimal ${oldQ}`);
            
            const selisih = oldQ - q;
            window.pendingData = { 
                tgl: tglDB, ref: refLog.ref + "-RET", kode: refLog.kode, 
                batch: refLog.batch, exp: refLog.exp, qty: selisih, 
                tipe: 'IN', ket: "RETURN/KOREKSI REF: " + refLog.ref,
                v: existingData.v || false 
            };
            previewHTML = `<b>KOREKSI RETURN</b><br>Ref: ${refLog.ref}<br>Balik ke Stok: ${selisih}`;
        } else {
            const ref = document.getElementById('t_ref').value.trim(); 
            const kode = document.getElementById('t_k').value.toUpperCase();
            const masterItem = ms.find(x => x.kode === kode); 
            if(!ref || !kode) return alert("Ref dan Kode wajib diisi!");
            
            // Logika Batch: Ambil dari t_b (input) atau t_b_sel (dropdown)
            const batchInput = document.getElementById('t_b')?.value || document.getElementById('t_b_sel')?.value || "";
            
            let trType = t; 
            let finalQty = q;

            if (t === 'ADJ') {
                const adjType = document.getElementById('t_adj_type')?.value || 'IN';
                finalQty = (adjType === 'IN') ? Math.abs(q) : -Math.abs(q);
            } else if (t === 'OUT') {
                finalQty = -Math.abs(q);
            }

            window.pendingData = { 
                tgl: tglDB, ref, kode, batch: batchInput.toUpperCase(), 
                exp: expDB, qty: finalQty, tipe: trType, ket,
                v: existingData.v || false 
            };
            
            previewHTML = `<table style="width:100%; font-size:13px; border-collapse:collapse;">
                <tr><td style="padding:4px"><b>Tanggal</b></td><td>: ${tglRaw}</td></tr>
                <tr><td style="padding:4px"><b>Tipe</b></td><td>: ${trType}</td></tr>
                <tr><td style="padding:4px"><b>Ref</b></td><td>: ${ref}</td></tr>
                <tr><td style="padding:4px"><b>Barang</b></td><td>: ${masterItem?.nama || kode}</td></tr>
                <tr><td style="padding:4px"><b>Batch</b></td><td>: ${batchInput || '-'}</td></tr>
                <tr><td style="padding:4px"><b>Qty</b></td><td>: <b>${Math.abs(finalQty)}</b></td></tr>
                <tr><td style="padding:4px"><b>Exp Date</b></td><td>: ${expRaw || '-'}</td></tr>
            </table>`;
        }
        
        document.getElementById('previewContent').innerHTML = previewHTML;
        UI.showModal('modalPreview');
    },

    executeSave: async () => {
        const data = window.pendingData;
        if (!data) return;

        const btn = document.getElementById('btnConfirmSave');
        if (btn) { btn.innerText = 'Menyimpan...'; btn.disabled = true; }
        
        try {
            const payload = {
                tgl: data.tgl, ref: data.ref, kode: data.kode,
                batch: data.batch || null, qty: data.qty, tipe: data.tipe,
                ket: data.ket || null, exp: data.exp || null, v: data.v
            };

            // KUNCI EDIT: Masukkan ID lama ke payload jika mode edit aktif
            if (window.editingLogId) payload.id = window.editingLogId;

            const { error } = await sb.from('transaksi_log').upsert(payload);
            if (error) throw error;

            UI.closeModal('modalPreview'); 
            UI.closeModal('modalTrx'); 
            
            window.editingLogId = null;
            window.pendingData = null;

            await DB.load(); 
            UI.refresh();
            
            if (typeof UI.showToast === 'function') {
                UI.showToast("✅ Menyimpan Data!");
            } else {
                alert("✅ Data Berhasil Disimpan!");
            }

        } catch (err) { 
            alert("Gagal simpan: " + err.message); 
        } finally { 
            if (btn) { btn.innerText = 'Simpan'; btn.disabled = false; } 
        }
    },
    // 4. DELETE TRANSACTION
    deleteLog: async (id) => {
        if (!confirm("Yakin hapus transaksi ini? Stok akan otomatis terkoreksi.")) return;
        try {
            const { error } = await sb.from('transaksi_log').delete().eq('id', id);
            if (error) throw error;
            await DB.load(); 
            UI.refresh(); 
            UI.showToast("🗑️ Transaksi Dihapus!");
        } catch (err) { alert("Error: " + err.message); }
    },

    // 5. MASTER BARANG & EXPORT/IMPORT (LENGKAP)
    openMasterAdd: () => {
        document.getElementById('m_k_old').value = ''; document.getElementById('m_k').value = ''; 
        document.getElementById('m_n').value = ''; document.getElementById('m_m').value = '';
        document.getElementById('masterTitle').innerText = 'Tambah Barang Baru';
        UI.showModal('modalMaster');
    },

    saveMaster: async () => {
        const k = document.getElementById('m_k').value.trim().toUpperCase();
        const n = document.getElementById('m_n').value.trim();
        const m = document.getElementById('m_m').value;
        const old_k = document.getElementById('m_k_old').value;
        if (!k || !n) return alert("Kode/Nama wajib diisi!");
        try {
            if (old_k && old_k !== k) await sb.from('master_barang').delete().eq('kode', old_k);
            await sb.from('master_barang').upsert({ kode: k, nama: n, masa: m ? parseInt(m) : 0 });
            UI.closeModal('modalMaster');
            await DB.load(); UI.refresh();
        } catch (err) { alert("Gagal simpan master!"); }
    },

    exportDB: () => {
        const b = new Blob([JSON.stringify({ m: DB.get('m'), l: DB.get('l') })], { type: 'application/json' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(b); 
        a.download = `Backup_${new Date().getTime()}.json`; a.click();
    },

    init: async () => {
        await DB.load();
        UI.refresh();
    }
};

// Pastikan dipanggil saat halaman siap
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

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
	
	// --- PERUBAHAN DI SINI (Baris 360+) ---
    // 1a. Inisialisasi Dropdown Tahun & Bulan Pivot
    const selY = document.getElementById('f_mutasi_y');
    const selM = document.getElementById('f_mutasi_m');
    const now = new Date();

    if (selY) {
        const currentYear = now.getFullYear();
        selY.innerHTML = ""; // Bersihkan dulu
        for (let y = currentYear; y >= currentYear - 3; y--) {
            selY.innerHTML += `<option value="${y}">${y}</option>`;
        }
        selY.value = currentYear; // Set ke tahun ini
    }

    if (selM) {
        selM.value = now.getMonth() + 1; // Set ke bulan ini (1-12)
    }
    // 2. Cek Sesi Supabase
    try {
        const { data: { session }, error } = await sb.auth.getSession();

        if (session?.user && !error) {
            // --- MODE LOGIN (ADMIN/STAFF) ---
            const email = session.user.email;
            let role = session.user.user_metadata?.role || (email === 'admin@stockmaster.local' ? 'admin' : 'staff');
            DB.set('currentUser', { role, email });

            document.body.classList.remove('is-public');
            document.body.classList.add(role + '-mode');
            Auth.applySession(role);

            // Munculkan semua UI Privat
            const tabMenu = document.querySelector('.tab-menu'); if (tabMenu) tabMenu.style.removeProperty('display');
            const sidebar = document.querySelector('.sidebar'); if (sidebar) sidebar.style.removeProperty('display');
            document.querySelectorAll('.private').forEach(el => el.style.removeProperty('display'));
            
            await DB.load();
            DB.subscribe(); // Aktifkan Realtime

        } else {
            // --- MODE PUBLIC (GUEST) ---
            document.body.classList.remove('admin-mode', 'staff-mode');
            document.body.classList.add('is-public');
            DB.set('currentUser', { role: 'guest' });

            // SEMBUNYIKAN MENU (Kecuali Stok Ringkas)
            const tabMenu = document.querySelector('.tab-menu');
            if (tabMenu) tabMenu.style.setProperty('display', 'none', 'important');
            
            const sidebar = document.querySelector('.sidebar');
            if (sidebar) sidebar.style.setProperty('display', 'none', 'important');

            // Sembunyikan elemen .private lainnya
            document.querySelectorAll('.private').forEach(el => {
                if (!el.classList.contains('auth-group') && !el.closest('.auth-group')) {
                    el.style.setProperty('display', 'none', 'important');
                }
            });

            // Pastikan tombol login di kanan
            const authGroup = document.querySelector('.auth-group');
            if (authGroup) authGroup.style.setProperty('margin-left', 'auto', 'important');

            // TARIK DATA UNTUK STOK RINGKAS
            await DB.load();
        }
    } catch (err) {
        console.error("Auth Error:", err);
    }

    // 3. Final Render
    const main = document.getElementById('main-content');
    if (main) main.classList.add('content-animate-in', 'visible');
    UI.refresh(); // Ini yang akan menggambar tabel stok ringkas untuk guest

    // Click Listener Autocomplete
    document.addEventListener('click', (e) => {
        const ids = ['t_k', 't_n', 'b_f_kode', 'b_f_nama', 'l_f_kode', 'l_f_nama'];
        if (!ids.includes(e.target.id)) document.querySelectorAll('.autocomplete-items').forEach(el => { if (el) el.style.display = 'none'; });
    });
};
