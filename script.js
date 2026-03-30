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

            DB.set('m', resMaster.data || []);
            DB.set('l', resTrx.data || []);
            
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
    currentFocus: -1,

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
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active')); document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        btn.classList.add('active'); const target = document.getElementById('tab-' + id); if(target) target.classList.add('active');
        document.getElementById('global-header').style.display = (id === 'stok') ? 'block' : 'none'; UI.refresh();
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
        // 1. Abaikan jika hanya tombol navigasi (Panah/Enter/Tab)
        if (e && [38, 40, 13, 9].includes(e.keyCode)) return;

        const inpId = type === 'k' ? 't_k' : (type === 'n' ? 't_n' : (type === 'b_f_k' ? 'b_f_kode' : (type === 'b_f_n' ? 'b_f_nama' : (type === 'l_f_k' ? 'l_f_kode' : 'l_f_nama'))));
        const listId = (inpId === 't_k' ? 't_k_list' : (inpId === 't_n' ? 't_n_list' : type + '_list'));
        const inp = document.getElementById(inpId); const listEl = document.getElementById(listId);
        if(!inp || !listEl) return;

        // --- TAMBAHKAN LOGIKA PEMBERSIHAN INSTANT DI SINI ---
        if (['k', 'n'].includes(type)) {
            // Jika ngetik di KODE, kosongkan NAMA. Jika ngetik di NAMA, kosongkan KODE.
            const targetId = type === 'k' ? 't_n' : 't_k';
            const targetEl = document.getElementById(targetId);
            if (targetEl) targetEl.value = ''; 
            
            // Kosongkan juga stok dan reset dropdown batch (biar tidak salah input)
            const elStk = document.getElementById('t_stk_tot') || document.getElementById('t_stk_b');
            if (elStk) elStk.value = '';
            
            const bSelect = document.getElementById('t_b_sel');
            if (bSelect) bSelect.innerHTML = '<option value="">--Pilih Kode Dulu--</option>';
        }
        // --- AKHIR LOGIKA PEMBERSIHAN ---

        const ms = DB.get('m') || []; 
        const val = inp.value.trim().toUpperCase(); 
        currentFocus = -1; 

        if(val === '') {
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
        const listId = (inpId === 't_k' ? 't_k_list' : (inpId === 't_n' ? 't_n_list' : type + '_list'));
        
        let x = document.getElementById(listId);
        if (x) x = x.getElementsByTagName("div");
        if (!x || x.length === 0) return;

        if (e.keyCode == 40) { // BAWAH
            currentFocus++;
            UI.addActive(x);
        } else if (e.keyCode == 38) { // ATAS
            currentFocus--;
            UI.addActive(x);
        } else if (e.keyCode == 13) { // ENTER
            e.preventDefault();
            if (currentFocus > -1 && x[currentFocus]) x[currentFocus].click();
        }
    },

    addActive: (x) => {
        if (!x) return false;
        // Bersihkan class active dari semua item
        for (let i = 0; i < x.length; i++) x[i].classList.remove("autocomplete-active");

        if (currentFocus >= x.length) currentFocus = 0;
        if (currentFocus < 0) currentFocus = (x.length - 1);
        
        x[currentFocus].classList.add("autocomplete-active");
        x[currentFocus].scrollIntoView({ block: "nearest" });
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
            const listK = document.getElementById('t_k_list');
            const listN = document.getElementById('t_n_list');
            if(listK) listK.style.display = 'none'; 
            if(listN) listN.style.display = 'none';

            // 3. Jalankan Sinkronisasi (Data Batch/Stok)
            UI.syncTrx('k', formType);

            // 4. Pindahkan Fokus Kursor (Delay sedikit agar DOM siap)
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
        const ms = DB.get('m') || []; const l = DB.get('l') || []; const act = Engine.calculate(); 
        const searchEl = document.getElementById('searchInput'); const qG = searchEl ? searchEl.value.toUpperCase() : '';
        const session = DB.get('currentUser') || {}; const isAdmin = session.role === 'admin';
        const thAksi = document.getElementById('th_aksi'); if(thAksi) thAksi.style.display = isAdmin ? 'table-cell' : 'none';

        if(document.getElementById('tab-stok').classList.contains('active')) {
            let stokData = ms.filter(m => (m.kode||'').toUpperCase().includes(qG) || (m.nama||'').toUpperCase().includes(qG)).map(m => {
                const bts = act.filter(b => b.kode === m.kode), ttl = bts.reduce((a,b)=>a+b.stok, 0); return { kode: m.kode || '-', nama: m.nama || '-', stok: ttl };
            });
            stokData.sort((a, b) => {
                let vA = a[UI.sortCol]; let vB = b[UI.sortCol];
                if(typeof vA === 'string') { vA = vA.toUpperCase(); vB = vB.toUpperCase(); }
                if(vA < vB) return UI.sortAsc ? -1 : 1; if(vA > vB) return UI.sortAsc ? 1 : -1; return 0;
            });
            document.getElementById('inventoryBody').innerHTML = stokData.map(m => {
                let actionBtn = isAdmin ? `<td style="text-align:center;"><button class="btn-outline" style="padding:2px 8px; font-size:11px; margin:0;" onclick="App.editMaster('${m.kode}')">✏️ Edit</button></td>` : '';
                return `<tr><td><b>${m.kode}</b></td><td>${m.nama}</td><td>${m.stok}</td><td>${m.stok > 0 ? '<span class="txt-m">Aktif</span>' : '-'}</td>${actionBtn}</tr>`;
            }).join('');
            ['kode', 'nama', 'stok'].forEach(c => { const el = document.getElementById(`sort_${c}`); if(el) el.innerHTML = UI.sortCol === c ? (UI.sortAsc ? '▲' : '▼') : ''; });
        }

        UI.renderDaily('day-in', 'IN', ms, l); UI.renderDaily('day-out', 'OUT', ms, l);
        if (document.getElementById('tab-mutasi').classList.contains('active')) UI.renderMutasiPivot(ms, l);
        if (document.getElementById('tab-batch').classList.contains('active')) UI.renderBatch(ms, act);
        if (document.getElementById('tab-log').classList.contains('active')) UI.renderLog(ms, l);
		// Di dalam UI.refresh (Sekitar Baris 215)
		if (document.getElementById('tab-expiry').classList.contains('active')) UI.renderExpiry();
    },

    renderMutasiPivot: (ms, l) => {
        const selM = document.getElementById('f_mutasi_m'); 
        const selY = document.getElementById('f_mutasi_y');
        if(!selM || !selY) return;

        const now = new Date();
        // Baris Kunci: Jika value kosong/NaN, ambil bulan (1-12) dan tahun sekarang
        const m = selM.value ? parseInt(selM.value) : now.getMonth() + 1;
        const y = selY.value ? parseInt(selY.value) : now.getFullYear();
        
        const days = new Date(y, m, 0).getDate(); 
        const q = (document.getElementById('f_mutasi_q').value || "").toUpperCase();
// --- Akhir Perubahan ---
        const getArrow = (col) => UI.sortMutasiCol === col ? (UI.sortMutasiAsc ? ' ▲' : ' ▼') : '';
        let h1 = `<tr><th rowspan="2" class="sticky-col k-kode sortable" onclick="UI.sortMutasi('kode')">Kode${getArrow('kode')}</th><th rowspan="2" class="sticky-col k-nama sortable" onclick="UI.sortMutasi('nama')">Nama Barang${getArrow('nama')}</th><th rowspan="2" class="sticky-col k-awal" style="background-color: var(--bg-awal);">Awal</th>`; 
        let h2 = `<tr>`;
        for(let i=1; i<=days; i++) { h1 += `<th colspan="2" class="day-header">${i}</th>`; h2 += `<th class="sub-col" style="background-color: var(--bg-in);">M</th><th class="sub-col" style="background-color: var(--bg-out);">K</th>`; }
        h1 += `<th rowspan="2">IN</th><th rowspan="2">OUT</th><th rowspan="2" class="sortable" onclick="UI.sortMutasi('akhir')" style="background-color: var(--bg-akhir);">Akhir${getArrow('akhir')}</th></tr>`; 
        document.getElementById('mutasiHeader').innerHTML = h1 + h2 + `</tr>`;
        
        // --- Kode Sebelum (Baris 180) ---
        let pivotData = ms.filter(m_ => (m_.kode||'').includes(q) || (m_.nama||'').toUpperCase().includes(q)).map(it => {
            let aw = 0, ti = 0, to = 0, dM = Array(days+1).fill(0), dK = Array(days+1).fill(0);
            
            l.filter(x => x.kode === it.kode).forEach(log => {
                const ld = new Date(log.tgl), ly = ld.getFullYear(), lm = ld.getMonth()+1;
                
                // 1. Logika Saldo Awal (Bulan-bulan sebelumnya)
                if (ly < y || (ly === y && lm < m)) {
                    log.tipe === 'IN' ? aw += log.qty : aw -= log.qty;
                } 
                
                // 2. Logika Harian (Bulan berjalan) - Baris 190
                else if (ly === y && lm === m) { 
                    const day = ld.getDate();
                    
                    // CEK JIKA TRANSAKSI ADALAH RETURN (-RET)
                    if (log.ref && String(log.ref).endsWith('-RET')) {
                        dK[day] -= log.qty; // Kurangi kolom K (Keluar)
                        to -= log.qty;      // Perbaiki total Keluar bulanan
                    } 
                    else if (log.tipe === 'IN') { 
                        dM[day] += log.qty; 
                        ti += log.qty; 
                    } 
                    else { 
                        dK[day] += log.qty; 
                        to += log.qty; 
                    } 
                }
            });

            // 3. Return Object Data untuk Pivot - Baris 200
            return { 
                kode: it.kode, 
                nama: it.nama, 
                awal: aw, 
                masuk: ti, 
                keluar: to, 
                akhir: (aw + ti - to), 
                harianM: dM, 
                harianK: dK 
            };
        });
// --- Kode Sesudah ---

        pivotData.sort((a, b) => {
            let vA = a[UI.sortMutasiCol]; let vB = b[UI.sortMutasiCol];
            if(typeof vA === 'string') { vA = vA.toUpperCase(); vB = vB.toUpperCase(); }
            if(vA < vB) return UI.sortMutasiAsc ? -1 : 1; if(vA > vB) return UI.sortMutasiAsc ? 1 : -1; return 0;
        });

        document.getElementById('mutasiTableBody').innerHTML = pivotData.map(row => {
            let htmlRow = `<tr><td class="sticky-col k-kode"><b>${row.kode}</b></td><td class="sticky-col k-nama">${row.nama}</td><td class="sticky-col k-awal" style="background-color: var(--bg-awal);">${row.awal}</td>`;
            for(let i=1; i<=days; i++) { htmlRow += `<td class="sub-col txt-m" style="background-color: var(--bg-in);">${row.harianM[i]||''}</td><td class="sub-col txt-k" style="background-color: var(--bg-out);">${row.harianK[i]||''}</td>`; }
            return htmlRow + `<td>${row.masuk}</td><td>${row.keluar}</td><td style="background-color: var(--bg-akhir); font-weight:bold;">${row.akhir}</td></tr>`;
        }).join('');
    },

    // --- Kode Sebelum (Baris 218) ---
    renderDaily: (id, tipe, ms, l) => {
        const pane = document.getElementById('tab-' + id); if (!pane || !pane.classList.contains('active')) return;
        const tglInput = document.getElementById(`f_${id.replace('-','_')}_tgl`);
        const qInput = document.getElementById(`f_${id.replace('-','_')}_q`);
        if(!tglInput || !qInput) return;

        const tglFilter = DateHelper.toDB(tglInput.value);
        const searchVal = qInput.value.toUpperCase();

// --- Perubahan (Logika Filter Gabungan) ---
        const filtered = l.filter(x => {
            const isMatch = x.tgl === tglFilter && x.tipe === tipe;
            const isSearch = (x.kode||'').toUpperCase().includes(searchVal) || 
                             ((ms.find(m=>m.kode===x.kode)||{}).nama||'').toUpperCase().includes(searchVal);
            
            // Baris Kunci: Sembunyikan transaksi Return dari Tab IN (karena itu koreksi, bukan stok masuk baru)
            const isNotReturn = !(tipe === 'IN' && x.ref && String(x.ref).endsWith('-RET'));
            
            return isMatch && isSearch && isNotReturn;
        });

        document.getElementById(`${id.replace('-','')}TableBody`).innerHTML = filtered.reverse().map(x => {
            const m = ms.find(i => i.kode === x.kode);
            
            // Baris Kunci: Jika di Tab OUT, kurangi tampilan Qty dengan total Return terkait
            let displayQty = x.qty;
            if (tipe === 'OUT') {
                const totalRet = l.filter(r => r.ref === x.ref + "-RET").reduce((a, b) => a + b.qty, 0);
                displayQty = x.qty - totalRet;
            }

            return `<tr class="${x.v ? 'is-verified' : ''}">
                <td>${x.ref}</td>
                <td><b>${x.kode}</b></td>
                <td>${m ? m.nama : ''}</td>
                <td>${x.batch}</td>
                <td><b>${displayQty}</b> ${displayQty !== x.qty ? `<br><small style="color:#ef4444">(Ret: ${x.qty - displayQty})</small>` : ''}</td>
                <td>${x.ket || '-'}</td>
                <td align="center"><input type="checkbox" ${x.v ? 'checked' : ''} onchange="UI.toggleVerify('${x.id}')"></td>
            </tr>`;
        }).join('');
// --- Akhir Perubahan ---
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
        const t1 = DateHelper.toDB(document.getElementById('f_tgl_1').value), t2 = DateHelper.toDB(document.getElementById('f_tgl_2').value), qK = document.getElementById('l_f_kode').value.toUpperCase(), tipe = document.getElementById('f_tipe').value;
        const filtered = l.filter(x => (x.tgl >= t1 && x.tgl <= t2) && (qK ? x.kode === qK : true) && (tipe === 'ALL' || x.tipe === tipe));
        document.getElementById('logTableBody').innerHTML = filtered.reverse().map(x => {
            const m = ms.find(i => i.kode === x.kode); let tColor = x.tipe === 'IN' ? 'txt-m' : 'txt-k';
            return `<tr><td>${DateHelper.toUI(x.tgl)}</td><td>${x.ref}</td><td><b>${x.kode}</b></td><td>${m ? m.nama : ''}</td><td>${x.batch}</td><td class="${tColor}"><b>${x.qty}</b></td><td>${x.tipe}</td><td>${x.ket || '-'}</td></tr>`;
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

   // --- Ganti Bagian openTrx Anda dengan ini ---
    openTrx: (t) => {
        const todayUI = DateHelper.toUI(new Date().toISOString().split('T')[0]);
        const mContent = document.getElementById('trxBody'); mContent.style.padding = '0'; mContent.className = 'modal-content sz-medium';
        let h = `<div id="trxHeader" style="cursor:grab; background:#f1f5f9; padding:12px 15px; border-radius:8px 8px 0 0; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center; font-weight:bold; color:var(--s);"><span>Form ${t}</span><span style="font-size:14px; color:#64748b;">✥</span></div><div style="padding: 15px; display:flex; flex-direction:column;">`;
        h += `<label>Tgl:</label><input type="text" id="t_tgl" value="${todayUI}" maxlength="10" oninput="UI.formatDateInput(this)" onblur="UI.expandDate(this)">`;
        
        if(t === 'RET') {
            h += `<label>Ref Out:</label><div style="display:flex;gap:4px;margin-bottom:5px;"><input id="t_ref_s"><button class="btn-primary" id="btnCariRef" onclick="UI.findRef()">Cari</button></div><select id="t_ret_item" onchange="UI.fillRet()"><option value="">--Cari Ref--</option></select><label>Barang:</label><input id="t_n" readonly class="read-only"><div class="form-row-compact"><div class="f-item"><label>Kode:</label><input id="t_k" readonly class="read-only"></div><div class="f-item"><label>Stok:</label><input id="t_stk_b" readonly class="read-only"></div></div><div class="form-row-compact"><div class="f-item"><label>Qty Lama:</label><input id="t_q_old" readonly class="read-only"></div><div class="f-item"><label>Koreksi Jadi:</label><input id="t_new_q" type="number"></div></div>`;
        } else {
            h += `<label>Ref:</label><input id="t_ref" value="${t === 'ADJ' ? 'OPNAME-' + new Date().getTime().toString().slice(-4) : ''}"><div style="position:relative;"><label>Barang / Kode:</label><div class="form-row-compact"><div class="f-item" style="flex:2"><input id="t_k" placeholder="Ketik Kode" onkeyup="UI.showAutoList('k', '${t}', event)" onkeydown="UI.handleAutoKey(event, 'k', '${t}')" autocomplete="off"><div id="t_k_list" class="autocomplete-items"></div></div><div class="f-item" style="flex:3"><input id="t_n" placeholder="Ketik Nama" onkeyup="UI.showAutoList('n', '${t}', event)" onkeydown="UI.handleAutoKey(event, 'n', '${t}')" autocomplete="off"><div id="t_n_list" class="autocomplete-items"></div></div></div></div>`;
            
            if(t === 'IN') { 
                // Form IN: Hanya Batch, Expired, dan Qty
                h += `<div class="form-row-compact"><div class="f-item"><label>Batch:</label><input id="t_b" onblur="UI.checkBatchIn()"></div><div class="f-item"><label>Expired:</label><input id="t_exp" placeholder="DD-MM-YYYY" oninput="UI.formatDateInput(this)" onblur="UI.expandDate(this)"></div></div>`; 
                h += `<label>Qty Transaksi:</label><input id="t_q" type="number">`;
            } else { 
                // Form OUT / ADJ: Tetap ada Stok Batch dan Keterangan
                h += `<label>Pilih Batch:</label><select id="t_b_sel" onchange="UI.syncTrx('b', '${t}')"><option value="">--Pilih Kode Dulu--</option></select>`; 
                if(t === 'ADJ') h += `<label>Jenis Penyesuaian:</label><select id="t_adj_type"><option value="IN">(+) Tambah Stok (Ditemukan)</option><option value="OUT">(-) Kurangi Stok (Rusak/Hilang)</option></select>`;
                h += `<div class="form-row-compact"><div class="f-item"><label>Stok (Batch):</label><input id="t_stk_b" readonly class="read-only"></div><div class="f-item"><label>Qty Transaksi:</label><input id="t_q" type="number"></div></div>`;
                h += `<label>Ket:</label><input id="t_ket">`;
            }
        }
        
        h += `<div style="display:flex; gap:5px; margin-top:10px;"><button class="btn-primary" style="flex:1;" onclick="App.prepareSave('${t}')">Lanjut >></button><button class="btn-outline" style="flex:1;" onclick="UI.closeModal('modalTrx')">Batal</button></div></div>`;
        mContent.innerHTML = h; UI.showModal('modalTrx'); Draggable.init('trxBody', 'trxHeader');
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
    }
};

const App = {
    
    exportDB: () => {
        const b = new Blob([JSON.stringify({ m: DB.get('m'), l: DB.get('l') })], { type: 'application/json' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `Backup_${new Date().getTime()}.json`; a.click();
    },

    importDB: (input) => {
        const r = new FileReader();
        r.onload = (e) => {
            const d = JSON.parse(e.target.result); DB.set('m', d.m); DB.set('l', d.l); UI.refresh(); alert("Data Dimuat!");
        }; r.readAsText(input.files[0]);
    },

    exportToExcel: () => {
        const actBtn = document.querySelector('.tab-btn.active'); let tid = "";
        if(actBtn.innerText.includes("Stok")) tid = "inventoryBody";
        else if(actBtn.innerText.includes("Mutasi")) tid = "tableMutasi";
        else if(actBtn.innerText.includes("Log")) tid = "logTableBody";
        const el = document.getElementById(tid);
        const wb = XLSX.utils.table_to_book(el.tagName === 'TABLE' ? el : el.closest('table'));
        XLSX.writeFile(wb, `Laporan_${new Date().getTime()}.xlsx`);
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
        let l = DB.get('l') || []; const ms = DB.get('m') || [];
        const qInput = document.getElementById('t_q')?.value || document.getElementById('t_new_q')?.value;
        let q = parseInt(qInput); const ket = document.getElementById('t_ket')?.value.trim() || "-";
        const tglRaw = document.getElementById('t_tgl')?.value || ""; const tglDB = DateHelper.toDB(tglRaw);
        if(!tglDB || tglDB.length !== 10) { alert("Format Tanggal tidak valid! (DD-MM-YYYY)"); return; }
        const expRaw = document.getElementById('t_exp')?.value.trim() || ""; let expDB = DateHelper.toDB(expRaw);
        if(t === 'IN' && expRaw && expDB.length !== 10) { alert("Format Expired salah!"); return; }
        if(isNaN(q) || q <= 0) { alert("Qty tidak valid!"); return; }
        let previewHTML = "";
        
        if(t === 'RET') {
            const rData = document.getElementById('t_ret_item').value; if(!rData) return;
            const refLog = JSON.parse(rData); const stkb = parseInt(document.getElementById('t_stk_b').value); const oldQ = parseInt(document.getElementById('t_q_old').value);
            if(q > oldQ) { alert(`Koreksi maksimal ${oldQ}`); return; }
            if(q === oldQ) { alert("Qty baru sama dengan yang lama, tidak ada perubahan."); return; }
            const selisih = oldQ - q;
            window.pendingData = { tgl: tglDB, ref: refLog.ref + "-RET", kode: refLog.kode, batch: refLog.batch, exp: refLog.exp, qty: selisih, tipe: 'IN', ket: "RETURN/KOREKSI REF: " + refLog.ref, t: t };
            previewHTML = `<b>TIPE:</b> RETURN / KOREKSI<br><b>Ref Awal:</b> ${refLog.ref}<br><b>Kode:</b> ${refLog.kode}<br><b>Qty Kembali ke Stok:</b> ${selisih}`;
        } else {
            const ref = document.getElementById('t_ref').value.trim(); const kode = document.getElementById('t_k').value.toUpperCase();
            const masterItem = ms.find(x => x.kode === kode); const n = masterItem ? masterItem.nama : "Tidak Dikenal";
            if(!ref || !kode) { alert("Ref dan Kode wajib diisi!"); return; }
            const batch = (t === 'IN') ? document.getElementById('t_b').value : document.getElementById('t_b_sel').value;
            let trType = (t === 'IN') ? 'IN' : 'OUT'; if (t === 'ADJ') trType = document.getElementById('t_adj_type').value;
            window.pendingData = { tgl: tglDB, ref, kode, batch, exp: expDB, qty: q, tipe: trType, ket, t: t };
            let labelAct = t === 'ADJ' ? (trType === 'IN' ? 'STOK OPNAME (+)' : 'STOK OPNAME (-)') : t;
            previewHTML = `<div style="background:rgba(0,0,0,0.05); padding:8px; border-radius:5px; margin-bottom:10px;"><b style="color:var(--p);">TIPE:</b> ${labelAct}</div>
            <table style="width:100%; font-size:13px;">
                <tr><td width="35%"><b>Tanggal</b></td><td>: ${tglRaw}</td></tr>
                <tr><td><b>No. Ref</b></td><td>: ${ref}</td></tr>
                <tr><td><b>Kode</b></td><td>: ${kode}</td></tr>
                <tr><td><b>Nama</b></td><td>: ${n}</td></tr>
                <tr><td><b>Batch</b></td><td>: ${batch}</td></tr>
                <tr><td><b>Qty</b></td><td>: <b style="color:${trType === 'IN' ? '#16a34a' : '#dc2626'}">${q}</b></td></tr>
            </table>`;
        }
        document.getElementById('previewContent').innerHTML = previewHTML;
        UI.showModal('modalPreview');
    },

    // --- GANTI FUNGSI EXECUTESAVE LAMA ANDA DENGAN INI ---
    executeSave: async () => {
        if (!window.pendingData) return;
        const btn = document.getElementById('btnConfirmSave');
        if (btn) { btn.innerText = 'Menyimpan...'; btn.disabled = true; }
        
        try {
            const { error } = await sb.from('transaksi_log').insert({
                tgl: window.pendingData.tgl, 
                ref: window.pendingData.ref, 
                kode: window.pendingData.kode,
                batch: window.pendingData.batch || null, 
                qty: window.pendingData.qty, 
                tipe: window.pendingData.tipe,
                ket: window.pendingData.ket || null, 
                exp: window.pendingData.exp || null, 
                v: false
            });

            if (error) throw error;

            // 1. Tutup modal Preview (Kroscek)
            UI.closeModal('modalPreview'); 

            // 2. Refresh data Supabase & UI
            await DB.load(); 
            UI.refresh();

            // 3. Tampilkan Toast 1 detik
            UI.showToast("✅ Data Tersimpan!");

            // 4. Bersihkan SEMUA field input (Penting untuk Form OUT agar bersih)
            const idsToClear = ['t_k', 't_n', 't_q', 't_new_q', 't_b', 't_stk_b', 't_stk_tot', 't_ket', 't_exp'];
            idsToClear.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });

            // 5. Reset Dropdown Batch (Khusus Form OUT)
            const selBatch = document.getElementById('t_b_sel');
            if (selBatch) {
                selBatch.innerHTML = '<option value="">--Pilih Kode Dulu--</option>';
            }

            // 6. Kembalikan fokus ke Kode Barang (Langsung bisa ketik item baru)
            const inputKode = document.getElementById('t_k');
            if (inputKode) inputKode.focus();

        } catch (err) { 
            alert("Gagal menyimpan transaksi: " + err.message); 
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
