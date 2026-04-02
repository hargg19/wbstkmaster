// --- INIT SUPABASE ---
const SUPABASE_URL = "https://vwgdrmyrutsjwnmzfrwv.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3Z2RybXlydXRzandubXpmcnd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3OTMyMjQsImV4cCI6MjA5MDM2OTIyNH0.8abwamRFE-hVpA4Xyy4zcZAbZt-Gm6tYaMDfpkh9-nI";
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

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
	sortDayCol: 'tgl', 
    sortDayAsc: false,
	sortDayCol: 'ref', 
    sortDayAsc: true,
    currentFocus: -1,
	
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
    
    sortMutasi: (col) => {
        if (UI.sortMutasiCol === col) { UI.sortMutasiAsc = !UI.sortMutasiAsc; } 
        else { UI.sortMutasiCol = col; UI.sortMutasiAsc = true; }
        UI.refresh();
    },

    showModal: (id) => document.getElementById(id).style.display = 'block',
    closeModal: (id) => document.getElementById(id).style.display = 'none',
    toggleSidebar: () => document.getElementById('sidebar').classList.toggle('mini'),

    switchTab: (tabId, btn) => {
        // 1. Sembunyikan semua pane
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        // 2. Nonaktifkan semua tombol
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        
        // 3. Aktifkan yang dipilih
        const target = document.getElementById('tab-' + tabId);
        if (target) {
            target.classList.add('active');
            btn.classList.add('active');
            // 4. Baru jalankan refresh
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


editLog: (index) => {
    const logs = DB.get('l');
    const logEntry = logs[index];

    if (!logEntry) {
        UI.showToast("❌ Data tidak ditemukan!");
        return;
    }

    const masterItems = DB.get('m');
    const itemName = (masterItems.find(m => m.kode === logEntry.kode) || {}).nama || '';

    
    UI.openTrx(logEntry.tipe);

    setTimeout(() => {
        const waitForDOM = () => {
           
            const tglInput = document.getElementById('t_tgl');
            const refInput = document.getElementById('t_ref');
            const kInput = document.getElementById('t_k');
            const nInput = document.getElementById('t_n');
            
            const qInput = document.getElementById('t_q');
            const ketInput = document.getElementById('t_ket');

            // Cek apakah elemen-elemen input umum ditemukan
            if (tglInput && refInput && kInput && nInput && qInput && ketInput) {
                 // Semua elemen umum ditemukan, lanjutkan pengisian
                 tglInput.value = DateHelper.toUI(logEntry.tgl);
                 refInput.value = logEntry.ref;
                 kInput.value = logEntry.kode;
                 nInput.value = itemName;
                 // Qty dikunci nanti, tapi tetap isi dulu
                 qInput.value = logEntry.qty;
                 ketInput.value = logEntry.ket || '';

                 // --- LOGIKA KHUSUS BERDASARKAN TIPE LOG ---
                 if (logEntry.tipe === 'IN') {
                      const bInput = document.getElementById('t_b');
                      const expInput = document.getElementById('t_exp'); // Expired untuk IN

                      if (bInput) {
                           bInput.value = logEntry.batch || '';
                      } else {
                           console.warn("Input batch 't_b' tidak ditemukan untuk log IN.");
                      }

                      if (expInput) {
                           if (logEntry.exp) {
                               expInput.value = DateHelper.toUI(logEntry.exp);
                           } else {
                               expInput.value = ''; // Kosongkan jika tidak ada
                           }
                      } else {
                           console.warn("Input expired 't_exp' tidak ditemukan untuk log IN.");
                      }
                 } else if (logEntry.tipe === 'OUT' || logEntry.tipe === 'ADJ') {
                      const bSelect = document.getElementById('t_b_sel');
                      const stokBInput = document.getElementById('t_stk_b'); // Stok (Batch) untuk OUT/ADJ

                      if (bSelect) {
                           // Isi select batch dengan batch dari log
                           bSelect.value = logEntry.batch || '';
                           // Panggil syncTrx untuk mengisi stok batch terkait batch yang dipilih
                           if (stokBInput) {
                                // Tunggu sebentar agar select benar-benar diperbarui sebelum syncTrx
                                setTimeout(() => {
                                    UI.syncTrx('b', logEntry.tipe);
                                }, 50);
                           }
                      } else {
                           console.warn(`Select batch 't_b_sel' tidak ditemukan untuk log ${logEntry.tipe}.`);
                           // Jika select tidak ditemukan, kita tetap lanjutkan, bisa diedit
                      }

                 } else if (logEntry.tipe === 'RET') {
                      // Form RET tidak diedit lewat sini (karena kompleksitasnya)
                      UI.showToast("⚠️ Edit untuk transaksi Return belum didukung.");
                      UI.closeModal('modalTrx');
                      return; // Hentikan eksekusi untuk RET
                 } else {
                      // Tipe log tidak dikenal
                      console.warn("Tipe log tidak dikenal:", logEntry.tipe);
                      UI.showToast("⚠️ Tipe log tidak dikenal. Tidak bisa diedit.");
                      UI.closeModal('modalTrx');
                      return; // Hentikan eksekusi untuk tipe tidak dikenal
                 }

                 // Kunci field kode, nama, dan qty setelah semua pengisian selesai
                 kInput.readOnly = true;
                 nInput.readOnly = true;
                 qInput.readOnly = true; // Pastikan Qty juga dikunci

                 // Simpan ID log yang sedang diedit
                 window.currentlyEditingLogIndex = index;
                 window.currentlyEditingOriginalData = {...logEntry}; // Salinan data asli

                 UI.showToast("📝 Edit mode aktif. Simpan untuk update.");
            } else {
                // Elemen belum siap, tunggu lagi satu frame
                requestAnimationFrame(waitForDOM);
            }
        };

        // Mulai menunggu DOM siap
        requestAnimationFrame(waitForDOM);

    }, 100); // Timeout 100ms untuk memastikan openTrx selesai sebelum rAF
},

		deleteLog: async (id) => {
        console.log("Parameter ID yang diterima:", id);

        // Cek apakah ID benar-benar ada (bukan undefined, null, atau string kosong)
        if (id === undefined || id === null || id === "") {
            UI.showToast("❌ Error: ID Transaksi tidak terbaca.");
            return;
        }

        if (!confirm(`Hapus transaksi ID: ${id}?`)) return;
        
        try {
            // Gunakan string untuk bigint agar aman
            const targetId = id.toString();

            const { data, error } = await sb
                .from('transaksi_log')
                .delete()
                .eq('id', targetId)
                .select();

            if (error) throw error;

            if (!data || data.length === 0) {
                UI.showToast("⚠️ Gagal: Data sudah tidak ada atau ID salah.");
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

saveEditedLog: async () => {
    // Cek apakah data asli yang sedang diedit tersedia
    if (!window.currentlyEditingOriginalData) {
         UI.showToast("❌ Tidak ada data yang sedang diedit.");
         return;
    }

    const originalData = window.currentlyEditingOriginalData;

    // Ambil data baru dari form
    const newData = {
        tgl: DateHelper.toDB(document.getElementById('t_tgl').value),
        ref: document.getElementById('t_ref').value.trim(),
        ket: document.getElementById('t_ket').value.trim()
    };

    // Ambil batch & exp sesuai tipe
    if (originalData.tipe === 'IN') {
        newData.batch = document.getElementById('t_b').value.trim();
        newData.exp = document.getElementById('t_exp').value.trim() ? DateHelper.toDB(document.getElementById('t_exp').value.trim()) : null;
    } else {
        // Untuk OUT atau ADJ
        const bSel = document.getElementById('t_b_sel');
        newData.batch = bSel ? bSel.value : originalData.batch;
        newData.exp = null;
    }

    if (!newData.tgl || !newData.ref) {
         UI.showToast("❌ Tgl dan Ref wajib diisi.");
         return;
    }

    try {
        // Update ke Supabase berdasarkan ID unik
        const { error } = await sb.from('transaksi_log').update({
             tgl: newData.tgl,
             ref: newData.ref,
             batch: newData.batch,
             exp: newData.exp,
             ket: newData.ket
        }).eq('id', originalData.id); // Gunakan ID asli sebagai kunci update

        if (error) throw error;

        await DB.load();
        UI.refresh();
        UI.closeModal('modalTrx');

        // Reset variabel state edit
        window.currentlyEditingOriginalData = undefined;
        UI.showToast("💾 Log berhasil diperbarui!");

    } catch (err) {
        console.error("Gagal update log:", err);
        UI.showToast("❌ Gagal update log: " + err.message);
    }
},
deleteLog: async (id) => {
    if (!id || id === "undefined") return UI.showToast("❌ ID tidak valid");
    if (!confirm(`Hapus transaksi ID: ${id}?`)) return;
    
    try {
        // Hapus menggunakan id asli dari database
        const { data, error } = await sb.from('transaksi_log')
            .delete()
            .eq('id', id.toString()) 
            .select();
        
        if (error) throw error;
        if (!data || data.length === 0) throw new Error("Data sudah tidak ada di server");

        UI.showToast("✅ Berhasil dihapus");
        
        await DB.load();
        UI.refresh();
    } catch (err) {
        console.error("Gagal hapus:", err);
        UI.showToast("❌ Gagal: " + err.message);
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
    const act = Engine.calculate(); 

    const searchEl = document.getElementById('searchInput'); 
    const qG = searchEl ? searchEl.value.toUpperCase() : '';
    const session = DB.get('currentUser') || {}; 
    const isAdmin = session.role === 'admin';
    
    const thAksi = document.getElementById('th_aksi'); 
    if(thAksi) thAksi.style.display = isAdmin ? 'table-cell' : 'none';

    // --- FUNGSI PEMBANTU UNTUK CEK TAB AKTIF ---
    const isTabActive = (id) => {
        const el = document.getElementById('tab-' + id);
        return el && el.classList.contains('active');
    };

    // 2. Render Tab STOK
    if(isTabActive('stok')) {
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
                let actionBtn = isAdmin ? `<td style="text-align:center;"><button class="btn-outline" style="padding:2px 8px; font-size:11px; margin:0;" onclick="App.editMaster('${m.kode}')">✏️ Edit</button></td>` : '';
                return `<tr><td><b>${m.kode}</b></td><td>${m.nama}</td><td>${m.stok}</td><td>${m.stok > 0 ? '<span class="txt-m">Aktif</span>' : '-'}</td>${actionBtn}</tr>`;
            }).join('');
        }
        ['kode', 'nama', 'stok'].forEach(c => { const el = document.getElementById(`sort_${c}`); if(el) el.innerHTML = UI.sortCol === c ? (UI.sortAsc ? '▲' : '▼') : ''; });
    }

    // 3. Render Tab Harian (Hanya jika tab tersebut ADA dan AKTIF)
    if(isTabActive('day-in')) UI.renderDaily('day-in', 'IN', ms, l); 
    if(isTabActive('day-out')) UI.renderDaily('day-out', 'OUT', ms, l);
    
    // 4. Render Tab Lainnya dengan Pengecekan Aman
    if (isTabActive('mutasi')) UI.renderMutasiPivot(ms, l);
    if (isTabActive('batch')) UI.renderBatch(ms, act);
    if (isTabActive('log')) UI.renderLog(ms, l);
    if (isTabActive('expiry')) UI.renderExpiry();
},

    renderMutasiPivot: (ms, l) => {
        const selM = document.getElementById('f_mutasi_m'); const selY = document.getElementById('f_mutasi_y');
        if(!selM || !selY) return;
        const m = parseInt(selM.value), y = parseInt(selY.value), days = new Date(y, m, 0).getDate(), q = document.getElementById('f_mutasi_q').value.toUpperCase();
        
        const getArrow = (col) => UI.sortMutasiCol === col ? (UI.sortMutasiAsc ? ' ▲' : ' ▼') : '';
        let h1 = `<tr><th rowspan="2" class="sticky-col k-kode sortable" onclick="UI.sortMutasi('kode')">Kode${getArrow('kode')}</th><th rowspan="2" class="sticky-col k-nama sortable" onclick="UI.sortMutasi('nama')">Nama Barang${getArrow('nama')}</th><th rowspan="2" class="sticky-col k-awal" style="background-color: var(--bg-awal);">Awal</th>`; 
        let h2 = `<tr>`;
        for(let i=1; i<=days; i++) { h1 += `<th colspan="2" class="day-header">${i}</th>`; h2 += `<th class="sub-col" style="background-color: var(--bg-in);">M</th><th class="sub-col" style="background-color: var(--bg-out);">K</th>`; }
        h1 += `<th rowspan="2">IN</th><th rowspan="2">OUT</th><th rowspan="2" class="sortable" onclick="UI.sortMutasi('akhir')" style="background-color: var(--bg-akhir);">Akhir${getArrow('akhir')}</th></tr>`; 
        document.getElementById('mutasiHeader').innerHTML = h1 + h2 + `</tr>`;
        
        let pivotData = ms.filter(m_ => (m_.kode||'').includes(q) || (m_.nama||'').toUpperCase().includes(q)).map(it => {
            let aw = 0, ti = 0, to = 0, adjTotal = 0; 
            let dM = Array(days+1).fill(0), dK = Array(days+1).fill(0);
            
            l.filter(x => x.kode === it.kode).forEach(log => {
                const ld = new Date(log.tgl), ly = ld.getFullYear(), lm = ld.getMonth()+1;
                
                // 1. Logika Saldo Awal (Bulan-bulan sebelumnya)
                if (ly < y || (ly === y && lm < m)) {
                    // Masukkan IN dan ADJ positif ke penambah saldo awal
                    if (log.tipe === 'IN' || (log.tipe === 'ADJ' && log.qty > 0)) {
                        aw += log.qty;
                    } else {
                        // Sisanya (OUT, RET, ADJ negatif) pengurang saldo awal
                        aw -= Math.abs(log.qty);
                    }
                } 
                
                // 2. Logika Harian (Bulan berjalan)
                else if (ly === y && lm === m) { 
                    const day = ld.getDate();
                    
                    // KHUSUS ADJ: Hanya pengaruhi saldo (adjTotal), JANGAN isi dM/dK
                    if (log.tipe === 'ADJ') {
                        adjTotal += log.qty;
                    } 
                    // LOGIKA RETURN
                    else if (log.ref && String(log.ref).endsWith('-RET')) {
                        dK[day] -= log.qty; 
                        to -= log.qty;      
                    } 
                    // LOGIKA IN (Masuk Reguler)
                    else if (log.tipe === 'IN') { 
                        dM[day] += log.qty; 
                        ti += log.qty; 
                    } 
                    // LOGIKA OUT (Keluar Reguler)
                    else { 
                        dK[day] += log.qty; 
                        to += log.qty; 
                    } 
                }
            });

            return { 
                kode: it.kode, 
                nama: it.nama, 
                awal: aw, 
                masuk: ti, 
                keluar: to, 
                // Rumus Akhir: (Awal + Masuk - Keluar) + Penyesuaian Opname
                akhir: (aw + ti - to + adjTotal), 
                harianM: dM, 
                harianK: dK 
            };
        });

        pivotData.sort((a, b) => {
            let vA = a[UI.sortMutasiCol]; let vB = b[UI.sortMutasiCol];
            if(typeof vA === 'string') { vA = vA.toUpperCase(); vB = vB.toUpperCase(); }
            if(vA < vB) return UI.sortMutasiAsc ? -1 : 1; if(vA > vB) return UI.sortMutasiAsc ? 1 : -1; return 0;
        });

        document.getElementById('mutasiTableBody').innerHTML = pivotData.map(row => {
            let htmlRow = `<tr><td class="sticky-col k-kode"><b>${row.kode}</b></td><td class="sticky-col k-nama">${row.nama}</td><td class="sticky-col k-awal" style="background-color: var(--bg-awal);">${row.awal}</td>`;
            for(let i=1; i<=days; i++) { 
                // Nilai 0 atau kosong tidak ditampilkan agar tabel bersih
                const valM = row.harianM[i] || '';
                const valK = row.harianK[i] || '';
                htmlRow += `<td class="sub-col txt-m" style="background-color: var(--bg-in);">${valM}</td><td class="sub-col txt-k" style="background-color: var(--bg-out);">${valK}</td>`; 
            }
            return htmlRow + `<td>${row.masuk}</td><td>${row.keluar}</td><td style="background-color: var(--bg-akhir); font-weight:bold;">${row.akhir}</td></tr>`;
        }).join('');
    },

renderDaily: (id, tipe, ms, l) => {
    const pane = document.getElementById('tab-' + id); 
    if (!pane || !pane.classList.contains('active')) return;
    
    const tglInput = document.getElementById(`f_${id.replace('-','_')}_tgl`);
    const qInput = document.getElementById(`f_${id.replace('-','_')}_q`);
    if(!tglInput || !qInput) return;

    const tglFilter = DateHelper.toDB(tglInput.value);
    const searchVal = qInput.value.toUpperCase();

    // 1. Filter Data
    let filtered = l.filter(x => {
        const isMatch = x.tgl === tglFilter && x.tipe === tipe;
        const isSearch = (x.kode||'').toUpperCase().includes(searchVal) ||
                         ((ms.find(m=>m.kode===x.kode)||{}).nama||'').toUpperCase().includes(searchVal);
        const isNotReturn = !(tipe === 'IN' && x.ref && String(x.ref).endsWith('-RET'));
        return isMatch && isSearch && isNotReturn;
    });

    // 2. Logika Sorting
    filtered.sort((a, b) => {
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
        return 0;
    });

    const session = DB.get('currentUser') || {};
    const isAdmin = session.role === 'admin';

    // 3. Render ke HTML
    document.getElementById(`${id.replace('-','')}TableBody`).innerHTML = filtered.map(x => {
        const m = ms.find(i => i.kode === x.kode);
        let displayQty = x.qty;
        
        if (tipe === 'OUT') {
            const totalRet = l.filter(r => r.ref === x.ref + "-RET").reduce((a, b) => a + b.qty, 0);
            displayQty = x.qty - totalRet;
        }

        // PERBAIKAN: Gunakan x.id untuk tombol aksi
        let actionButtons = '';
        if (isAdmin) {
            actionButtons = `
                <td align="center">
                    <button class="btn-outline" style="padding: 2px 5px; font-size: 10px; margin: 0 1px;" 
                            onclick="App.editLog('${x.id}')">✏️</button>
                    <button class="btn-outline" style="padding: 2px 5px; font-size: 10px; margin: 0 1px;" 
                            onclick="UI.deleteLog('${x.id}')">🗑️</button>
                </td>`;
        } else {
            actionButtons = '<td></td>';
        }

        return `
            <tr class="${x.v ? 'is-verified' : ''}">
                <td>${x.ref}</td>
                <td><b>${x.kode}</b></td>
                <td>${m ? m.nama : ''}</td>
                <td>${x.batch}</td>
                <td><b>${displayQty}</b> ${displayQty !== x.qty ? `<br><small style="color:#ef4444;">(Ret: ${x.qty - displayQty})</small>` : ''}</td>
                <td>${x.ket || '-'}</td>
                <td align="center">
                    <input type="checkbox" ${x.v ? 'checked' : ''} 
                           onchange="UI.toggleVerify('${x.id}')"> </td>
                ${actionButtons}
            </tr>`;
    }).join('');

    // 4. Update Indikator Panah
    ['ref', 'kode', 'nama', 'batch'].forEach(c => {
        const el = document.getElementById(`sort_day_${c}`);
        if(el) el.innerHTML = UI.sortDayCol === c ? (UI.sortDayAsc ? ' ▲' : ' ▼') : '';
    });
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
        // 1. Ambil kriteria filter dari UI
        const t1 = DateHelper.toDB(document.getElementById('f_tgl_1').value);
        const t2 = DateHelper.toDB(document.getElementById('f_tgl_2').value);
        const qK = document.getElementById('l_f_kode').value.toUpperCase();
        const tipe = document.getElementById('f_tipe').value;

        // 2. Filter data dari array 'l' (logs)
        const filtered = l.filter(x => 
            (x.tgl >= t1 && x.tgl <= t2) && 
            (qK ? x.kode === qK : true) && 
            (tipe === 'ALL' || x.tipe === tipe)
        );

        // 3. Cek Role Pengguna
        const session = DB.get('currentUser') || {};
        const isAdmin = session.role === 'admin';

        // 4. Render ke Table Body
        // .reverse() digunakan agar data terbaru (ID besar) muncul di atas
        document.getElementById('logTableBody').innerHTML = filtered.reverse().map((x) => {
            const m = ms.find(i => i.kode === x.kode);
            const tColor = x.tipe === 'IN' ? 'txt-m' : 'txt-k';

            // Logika Kolom Aksi (Khusus Admin)
            let actionButtons = '';
            if (isAdmin) {
                // PENTING: Gunakan '${x.id}' sebagai parameter, bukan index array
                actionButtons = `
                    <td align="center">
                        <button class="btn-outline" style="padding: 2px 5px; font-size: 10px; margin: 0 1px;" 
                                onclick="App.editLog('${x.id}')">✏️</button>
                        <button class="btn-outline" style="padding: 2px 5px; font-size: 10px; margin: 0 1px;" 
                                onclick="UI.deleteLog('${x.id}')">🗑️</button>
                    </td>`;
            } else {
                actionButtons = '<td></td>';
            }

            return `
                <tr>
                    <td>${DateHelper.toUI(x.tgl)}</td>
                    <td>${x.ref}</td>
                    <td><b>${x.kode}</b></td>
                    <td>${m ? m.nama : 'Tidak Dikenal'}</td>
                    <td>${x.batch}</td>
                    <td class="${tColor}"><b>${x.qty}</b></td>
                    <td>${x.tipe}</td>
                    <td>${x.ket || '-'}</td>
                    ${actionButtons}
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
        const k = document.getElementById('t_k').value.toUpperCase(), b = document.getElementById('t_b').value.trim();
        if(!k || !b) return;
        const exist = Engine.calculate().find(x => x.kode === k && x.batch === b);
        if(exist && confirm(`Batch "${b}" sudah ada (Stok: ${exist.stok}). Tambah barang ke batch ini?`)) {
            if(exist.exp) document.getElementById('t_exp').value = DateHelper.toUI(exist.exp);
        }
    },

    openTrx: (t) => {
    const todayUI = DateHelper.toUI(new Date().toISOString().split('T')[0]);
    const mContent = document.getElementById('trxBody');
    mContent.style.padding = '0';
    mContent.className = 'modal-content sz-medium';
    
    let h = `<div id="trxHeader" style="cursor:grab; background:#f1f5f9; padding:12px 15px; border-radius:8px 8px 0 0; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center; font-weight:bold; color:var(--s);">
                <span>Form ${t === 'IN' ? 'Barang Masuk' : t === 'OUT' ? 'Barang Keluar' : t === 'RET' ? 'Barang Return' : 'Penyesuaian (ADJ)'}</span>
                <span style="font-size:14px; color:#64748b;">✥</span>
             </div>
             <div style="padding: 15px; display:flex; flex-direction:column; gap:8px;">`;

    // 1. BARIS TANGGAL & REF
    h += `<div class="form-row-compact">
            <div class="f-item"><label>Tanggal:</label><input type="text" id="t_tgl" value="${todayUI}" maxlength="10" oninput="UI.formatDateInput(this)" onblur="UI.expandDate(this)"></div>
            <div class="f-item"><label>No. Ref:</label><input id="t_ref" value="${t === 'ADJ' ? 'OPNAME-' + new Date().getTime().toString().slice(-4) : ''}" placeholder="..."></div>
          </div>`;

    if(t === 'RET') {
        h += `<label>Cari No. Ref Asal:</label><div style="display:flex;gap:2px;margin-bottom:5px;"><input id="t_ref_s" placeholder="Masukkan No. Ref..."><button class="btn-primary" id="btnCariRef" onclick="UI.findRef()">Cari</button></div>`;
        h += `<label>Pilih Item:</label><select id="t_ret_item" onchange="UI.fillRet()"><option value="">-- Cari Ref Dulu --</option></select>`;
        h += `<div class="form-row-compact"><div class="f-item" style="flex:2"><label>Kode:</label><input id="t_k" readonly class="read-only"></div><div class="f-item" style="flex:3"><label>Nama:</label><input id="t_n" readonly class="read-only"></div></div>`;
        h += `<div class="form-row-compact"><div class="f-item"><label>Qty Lama:</label><input id="t_q_old" readonly class="read-only"></div><div class="f-item"><label>Qty Baru (Return):</label><input id="t_new_q" type="number" onkeydown="if(event.key==='Enter') App.prepareSave('RET')"></div></div>`;
        h += `<label>Keterangan:</label><input id="t_ket" placeholder="Alasan Return">`;
    } else {
        h += `<div style="position:relative;">
                <div class="form-row-compact">
                    <div class="f-item" style="flex:2"><label>Kode:</label><input id="t_k" placeholder="Kode" onkeyup="UI.showAutoList('k', '${t}')" onkeydown="UI.handleAutoKey(event, 'k', '${t}')" autocomplete="off"><div id="t_k_list" class="autocomplete-items"></div></div>
                    <div class="f-item" style="flex:3"><label>Nama Barang:</label><input id="t_n" placeholder="Cari Nama..." onkeyup="UI.showAutoList('n', '${t}')" onkeydown="UI.handleAutoKey(event, 'n', '${t}')" autocomplete="off"><div id="t_n_list" class="autocomplete-items"></div></div>
                </div>
              </div>`;

        if(t === 'IN') {
            // Baris 1: Batch (Sendirian)
            h += `<div class="form-row-compact">
                    <div class="f-item"><label>No. Batch:</label><input id="t_b" onblur="UI.checkBatchIn()" placeholder="Nomor Batch"></div>
                  </div>`;
            
            // Baris 2: Qty & Expired (Berdampingan + Enter)
            h += `<div class="form-row-compact">
                    <div class="f-item"><label>Qty Masuk:</label><input id="t_q" type="number" placeholder="0" onkeydown="if(event.key==='Enter') App.prepareSave('IN')"></div>
                    <div class="f-item"><label>Expired Date:</label><input id="t_exp" placeholder="DD-MM-YYYY" oninput="UI.formatDateInput(this)" onblur="UI.expandDate(this)" onkeydown="if(event.key==='Enter') App.prepareSave('IN')"></div>
                  </div>`;
            
            // Keterangan Sembunyi
            h += `<div style="display:none;"><input id="t_ket" value="-"></div>`;
        } else {
            h += `<div class="form-row-compact">
                    <div class="f-item" style="flex:1"><label>Stok Total:</label><input id="t_stk_tot" readonly class="read-only" style="background:#f0f9ff; font-weight:bold; color:#0369a1;"></div>
                    <div class="f-item" style="flex:3"><label>Pilih Batch:</label><select id="t_b_sel" onchange="UI.syncTrx('b', '${t}')" style="width:100%; padding:5px; border-radius:4px;"><option value="">-- Pilih --</option></select></div>
                  </div>`;
            h += `<div class="form-row-compact">
                    <div class="f-item"><label>Stok Batch:</label><input id="t_stk_b" readonly class="read-only" style="background:#fef2f2; font-weight:bold; color:#b91c1c;"></div>
                    <div class="f-item"><label>Qty ${t === 'ADJ' ? 'Adj' : 'Keluar'}:</label><input id="t_q" type="number" placeholder="0" onkeydown="if(event.key==='Enter') App.prepareSave('${t}')"></div>
                  </div>`;

            if(t === 'ADJ') {
                h += `<div class="form-row-compact">
                        <div class="f-item"><label>Jenis ADJ:</label><select id="t_adj_type"><option value="IN">(+) Tambah</option><option value="OUT">(-) Kurang</option></select></div>
                        <div class="f-item"><label>Ket:</label><input id="t_ket" placeholder="Alasan Penyesuaian"></div>
                      </div>`;
            } else {
                h += `<label>Keterangan:</label><input id="t_ket" placeholder="Tujuan / Catatan">`;
            }
        }
    }

    h += `<div style="display:flex; gap:5px; margin-top:10px;">
            <button id="btnPrepare" class="btn-primary" style="flex:1;" onclick="if(window.currentlyEditingLogIndex !== undefined) { UI.saveEditedLog(); } else { App.prepareSave('${t}'); }">💾 Lanjut</button>
            <button class="btn-outline" style="flex:1;" onclick="UI.closeModal('modalTrx')">Batal</button>
          </div></div>`;

    mContent.innerHTML = h; 
    UI.showModal('modalTrx'); 
    Draggable.init('trxBody', 'trxHeader');

    // Fokus otomatis ke Kode Barang
    setTimeout(() => {
        const k = document.getElementById('t_k');
        if(k) k.focus();
    }, 150);
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
        setTimeout(() => t.remove(), 1000); 
    }
};

const App = {
    syncLoad: async () => {
        // Ambil elemen tombol agar bisa diubah teksnya
        const btn = document.querySelector('button[onclick="App.syncLoad()"]');
        if (btn) {
            btn.disabled = true;
            btn.innerText = "Sync...";
        }

        try {
            console.log("Memulai Sync Data...");
            // 1. Tarik data dari Supabase
            await DB.load(); 
            
            // 2. Gambar ulang UI
            UI.refresh();
            
            UI.showToast("🔄 Data Berhasil Disinkronkan");
        } catch (err) {
            console.error("Sync Error:", err);
            UI.showToast("❌ Gagal Sync: " + err.message);
        } finally {
            // 3. Kembalikan tombol ke keadaan normal (ini kuncinya agar tidak 'Sync...' terus)
            if (btn) {
                btn.disabled = false;
                btn.innerText = "Sync";
            }
        }
    },
    
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
        const ms = DB.get('m') || [];
        const tglRaw = document.getElementById('t_tgl')?.value || "";
        const tglDB = DateHelper.toDB(tglRaw);
        const ref = document.getElementById('t_ref')?.value.trim() || "";
        const ket = document.getElementById('t_ket')?.value.trim() || "-";
        
        // Ambil Qty (Mendukung input manual atau hasil hitung otomatis)
        const qInput = document.getElementById('t_q')?.value || document.getElementById('t_new_q')?.value;
        let q = parseInt(qInput);

        // Validasi Dasar
        if (!tglDB || tglDB.length !== 10) return UI.showToast("⚠️ Format Tanggal Salah!");
        if (isNaN(q) || q <= 0) return UI.showToast("⚠️ Qty tidak valid!");

        let previewHTML = "";
        let trType = t; // Default tipe (IN/OUT/RET)

        if (t === 'RET') {
            // LOGIKA RETUR
            const rData = document.getElementById('t_ret_item')?.value;
            if (!rData) return UI.showToast("⚠️ Pilih data retur!");
            
            const refLog = JSON.parse(rData);
            const oldQ = parseInt(document.getElementById('t_q_old')?.value || 0);
            
            if (q > oldQ) return UI.showToast(`⚠️ Koreksi maksimal ${oldQ}`);
            if (q === oldQ) return UI.showToast("⚠️ Qty baru sama, tidak ada perubahan.");

            const selisih = oldQ - q; // Jumlah yang dikembalikan ke stok
            
            window.pendingData = { 
                tgl: tglDB, 
                ref: refLog.ref + "-RET", 
                kode: refLog.kode, 
                batch: refLog.batch, 
                exp: refLog.exp, 
                qty: selisih, 
                tipe: 'RET', // Simpan sebagai RET di DB
                ket: "RETURN/KOREKSI REF: " + refLog.ref + " | " + ket 
            };

            previewHTML = `
                <div style="background:rgba(22, 163, 74, 0.1); padding:8px; border-radius:5px; margin-bottom:10px;">
                    <b style="color:#16a34a;">TIPE: RETURN / KOREKSI</b>
                </div>
                <table style="width:100%; font-size:13px;">
                    <tr><td width="35%"><b>Ref Awal</b></td><td>: ${refLog.ref}</td></tr>
                    <tr><td><b>Kode</b></td><td>: ${refLog.kode}</td></tr>
                    <tr><td><b>Batch</b></td><td>: ${refLog.batch}</td></tr>
                    <tr><td><b>Qty Masuk</b></td><td>: <b style="color:#16a34a">${selisih}</b></td></tr>
                </table>`;

        } else {
            // LOGIKA IN, OUT, ADJ
            const kode = document.getElementById('t_k')?.value.toUpperCase() || "";
            if (!ref || !kode) return UI.showToast("⚠️ Ref dan Kode wajib diisi!");

            const masterItem = ms.find(x => x.kode === kode);
            const n = masterItem ? masterItem.nama : "Tidak Dikenal";
            
            // Tentukan Batch
            const batch = (t === 'IN') ? document.getElementById('t_b')?.value : document.getElementById('t_b_sel')?.value;
            if (!batch) return UI.showToast("⚠️ Nomor Batch wajib diisi!");

            // Tentukan Tipe DB (Khusus ADJ ambil dari dropdown)
            trType = (t === 'IN') ? 'IN' : 'OUT';
            if (t === 'ADJ') trType = document.getElementById('t_adj_type')?.value;

            // Ambil Expired (Hanya untuk IN)
            const expRaw = document.getElementById('t_exp')?.value.trim() || "";
            let expDB = DateHelper.toDB(expRaw);

            window.pendingData = { 
                tgl: tglDB, 
                ref: ref, 
                kode: kode, 
                batch: batch, 
                exp: expDB || null, 
                qty: q, 
                tipe: trType, 
                ket: ket 
            };

            let labelAct = t === 'ADJ' ? (trType === 'IN' ? 'OPNAME (+)' : 'OPNAME (-)') : t;
            let colorType = trType === 'IN' ? '#16a34a' : '#dc2626';

            previewHTML = `
                <div style="background:rgba(0,0,0,0.05); padding:8px; border-radius:5px; margin-bottom:10px;">
                    <b style="color:${colorType};">TIPE: ${labelAct}</b>
                </div>
                <table style="width:100%; font-size:13px;">
                    <tr><td width="35%"><b>Tanggal</b></td><td>: ${tglRaw}</td></tr>
                    <tr><td><b>No. Ref</b></td><td>: ${ref}</td></tr>
                    <tr><td><b>Barang</b></td><td>: ${kode} - ${n}</td></tr>
                    <tr><td><b>Batch</b></td><td>: ${batch}</td></tr>
                    <tr><td><b>Qty</b></td><td>: <b style="color:${colorType}">${q}</b></td></tr>
                </table>`;
        }

        document.getElementById('previewContent').innerHTML = previewHTML;
        UI.showModal('modalPreview');
		
       const contentEl = document.getElementById('previewContent');
        if (contentEl) contentEl.innerHTML = previewHTML;

        UI.showModal('modalPreview');

        // GANTI/TAMBAHKAN BAGIAN INI:
        const btnS = document.getElementById('btnConfirmSave');
        if (btnS) {
            btnS.disabled = true; 
            btnS.style.opacity = "0.5";
            btnS.innerText = "Tunggu...";
            
            window.setTimeout(() => {
                btnS.disabled = false; 
                btnS.style.opacity = "1";
                btnS.innerText = "💾 Simpan";
                
                // PAKSA FOKUS agar Enter selanjutnya tidak meleset
                btnS.focus(); 
            }, 400); 
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
                v: false
            };

            const { error } = await sb.from('transaksi_log').insert([payload]);
            if (error) throw error;

            UI.closeModal('modalPreview'); 
            await DB.load(); 
            UI.refresh();
            UI.showToast("✅ Data Tersimpan!");

            // IDs yang dibersihkan (t_tgl dan t_ref TIDAK ADA di sini agar tetap ada)
            const idsToClear = ['t_k', 't_n', 't_q', 't_new_q', 't_stk_b', 't_stk_tot', 't_ket', 't_exp', 't_b'];
            idsToClear.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });

            // Fokus kembali ke Kode
            setTimeout(() => {
                const inputKode = document.getElementById('t_k');
                if (inputKode) inputKode.focus();
            }, 100);

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
        // --- Kode untuk mengatur bulan dan tahun default di Mutasi Pivot ke bulan/tahun saat ini ---
const selM = document.getElementById('f_mutasi_m');


if (selM && selY) {
    const now = new Date();
    const currentMonth = now.getMonth() + 1; // Januari = 0, jadi perlu ditambah 1
    const currentYear = now.getFullYear();

    selM.value = currentMonth;
    selY.value = currentYear;
}
// --- Akhir kode ---
	
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
                App.executeSave(); // Memanggil fungsi simpan
            }
            return;
        }

        // CASE 2: Jika masih di Form Input, tekan Enter untuk Buka Preview
        if (modalT && (modalT.style.display === 'flex' || modalT.style.display === 'block')) {
            // Abaikan jika sedang mengetik di Keterangan
            if (e.target.tagName === 'TEXTAREA') return;

            e.preventDefault();
            // Ambil tipe transaksi dari window.currentTrxType yang sudah diset di UI.openTrx
            const currentType = window.currentTrxType || 'IN';
            App.prepareSave(currentType); // <--- Sekarang memanggil App.prepareSave
        }
    }

    if (e.key === 'Escape') {
        UI.closeModal('modalPreview');
    }
}, true);