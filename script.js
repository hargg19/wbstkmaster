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
    clear: () => localStorage.clear()
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
            const response = await fetch(App.driveURL, { 
                method: "POST", 
                body: JSON.stringify({ action: "LOGIN", role: r, pass: p }) 
            });
            const result = await response.json();
            
            if (result.status === "sukses") {
                DB.set('currentUser', { role: r }); 
                Auth.applySession(r); 
                UI.closeModal('modalLogin'); 
                UI.refresh();
            } else {
                alert("Akses Ditolak! Password Salah.");
                document.getElementById('adminPass').value = '';
                document.getElementById('adminPass').focus();
            }
        } catch (error) {
            alert("Gagal terhubung ke server verifikasi.");
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
    logout: () => { localStorage.removeItem('currentUser'); location.reload(); }
};

const Engine = {
    calculate: () => {
        const logs = DB.get('l') || []; let res = {};
        logs.forEach(x => {
            const k = `${x.kode}|${x.batch}`; if(!res[k]) res[k] = {...x, stok: 0};
            if(x.exp && x.tipe === 'IN') res[k].exp = x.exp;
            x.tipe === 'IN' ? res[k].stok += x.qty : res[k].stok -= x.qty;
        });
        return Object.values(res).filter(x => x.stok > 0);
    }
};

const UI = {
    sortCol: 'kode', sortAsc: true, 
    sortMutasiCol: 'kode', sortMutasiAsc: true, // Sorting State untuk Pivot
    currentFocus: -1,

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
    
    // Logic Sorting Khusus Mutasi
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
        if (document.getElementById('tab-expiry').classList.contains('active')) UI.renderExpiry(ms, act);
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
            let aw = 0, ti = 0, to = 0, dM = Array(days+1).fill(0), dK = Array(days+1).fill(0);
            l.filter(x => x.kode === it.kode).forEach(log => {
                const ld = new Date(log.tgl), ly = ld.getFullYear(), lm = ld.getMonth()+1;
                if (ly < y || (ly === y && lm < m)) log.tipe === 'IN' ? aw += log.qty : aw -= log.qty;
                else if (ly === y && lm === m) { const day = ld.getDate(); if(log.tipe === 'IN') { dM[day] += log.qty; ti += log.qty; } else { dK[day] += log.qty; to += log.qty; } }
            });
            return { kode: it.kode, nama: it.nama, awal: aw, masuk: ti, keluar: to, akhir: (aw+ti-to), harianM: dM, harianK: dK };
        });

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

    renderDaily: (id, tipe, ms, l) => {
        const pane = document.getElementById('tab-' + id); if (!pane || !pane.classList.contains('active')) return;
        const tglFilter = DateHelper.toDB(document.getElementById(`f_${id.replace('-','_')}_tgl`).value), searchVal = document.getElementById(`f_${id.replace('-','_')}_q`).value.toUpperCase();
        const filtered = l.filter(x => x.tgl === tglFilter && x.tipe === tipe && (x.kode.includes(searchVal) || ((ms.find(m=>m.kode===x.kode)||{}).nama||'').toUpperCase().includes(searchVal)));
        document.getElementById(`${id.replace('-','')}TableBody`).innerHTML = filtered.reverse().map(x => { const m = ms.find(i => i.kode === x.kode); return `<tr class="${x.v ? 'is-verified' : ''}"><td>${x.ref}</td><td><b>${x.kode}</b></td><td>${m ? m.nama : ''}</td><td>${x.batch}</td><td>${x.qty}</td><td>${x.ket || '-'}</td><td align="center"><input type="checkbox" ${x.v ? 'checked' : ''} onchange="UI.toggleVerify(${l.indexOf(x)})"></td></tr>`; }).join('');
    },
    renderBatch: (ms, act) => {
        const qK = document.getElementById('b_f_kode').value.toUpperCase(), qN = document.getElementById('b_f_nama').value.toUpperCase(); let ttlS = 0, htmlContent = '';
        ms.filter(m => (qK ? m.kode === qK : true) && (qN ? m.nama === qN : true)).forEach(m => { act.filter(b => b.kode === m.kode).forEach(b => { 
            htmlContent += `<tr><td><b>${m.kode}</b></td><td>${m.nama}</td><td>📦 ${b.batch}</td><td>${b.exp ? DateHelper.toUI(b.exp) : '-'}</td><td class="txt-m">${b.stok}</td></tr>`; ttlS += b.stok; 
        }); });
        document.getElementById('batchContainer').innerHTML = htmlContent; document.getElementById('b_f_stok').value = ttlS;
    },
    renderLog: (ms, l) => {
        const t1 = DateHelper.toDB(document.getElementById('f_tgl_1').value), t2 = DateHelper.toDB(document.getElementById('f_tgl_2').value), qK = document.getElementById('l_f_kode').value.toUpperCase(), tipe = document.getElementById('f_tipe').value;
        const filtered = l.filter(x => (x.tgl >= t1 && x.tgl <= t2) && (qK ? x.kode === qK : true) && (tipe === 'ALL' || x.tipe === tipe));
        document.getElementById('logTableBody').innerHTML = filtered.reverse().map(x => { const m = ms.find(i => i.kode === x.kode); return `<tr class="${x.v ? 'is-verified' : ''}"><td>${DateHelper.toUI(x.tgl)}</td><td>${x.ref}</td><td><b>${x.kode}</b></td><td>${m?m.nama:''}</td><td>${x.batch}</td><td>${x.qty}</td><td class="${x.tipe==='IN'?'txt-m':'txt-k'}">${x.tipe}</td><td>${x.ket || '-'}</td><td align="center"><input type="checkbox" ${x.v ? 'checked' : ''} onchange="UI.toggleVerify(${l.indexOf(x)})"></td></tr>`; }).join('');
    },
    renderExpiry: (ms, act) => {
        const today = new Date(); today.setHours(0,0,0,0); let htmlContent = '';
        act.forEach(b => {
            if(!b.exp) return; const m = ms.find(x => x.kode === b.kode); if(!m || !m.masa) return;
            const expDate = new Date(b.exp); expDate.setHours(0,0,0,0);
            const diffDays = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
            if (diffDays <= (parseInt(m.masa) * 0.5)) {
                let statusTxt = diffDays < 0 ? `<span style="color:red;">Expired!</span>` : `<span style="color:#d97706;">Near Expired</span>`;
                htmlContent += `<tr><td><b>${b.kode}</b></td><td>${m.nama}</td><td>📦 ${b.batch}</td><td class="txt-m">${b.stok}</td><td><b>${DateHelper.toUI(b.exp)}</b></td><td>${m.masa} hari</td><td>${statusTxt}</td></tr>`;
            }
        });
        document.getElementById('expiryTableBody').innerHTML = htmlContent || '<tr><td colspan="7" align="center">Aman.</td></tr>';
    },

    updStk: () => { const s = document.getElementById('t_b_sel'); document.getElementById('t_stk_b').value = (s && s.selectedIndex > 0) ? s.options[s.selectedIndex].getAttribute('data-s') : ""; },
    toggleVerify: (idx) => { let l = DB.get('l'); l[idx].v = !l[idx].v; DB.set('l', l); UI.refresh(); },
    checkBatchExist: () => {
        const k = document.getElementById('t_k').value.toUpperCase(), b = document.getElementById('t_b').value.trim(); if(!k || !b) return;
        const exist = Engine.calculate().find(x => x.kode === k && x.batch === b);
        if(exist && confirm(`Batch "${b}" sudah ada (Stok: ${exist.stok}). Tambah barang ke batch ini?`)) {
            if(exist.exp) document.getElementById('t_exp').value = DateHelper.toUI(exist.exp);
        }
    },
    
    openTrx: (t) => {
        const todayUI = DateHelper.toUI(new Date().toISOString().split('T')[0]); 
        const mContent = document.getElementById('trxBody'); mContent.style.padding = '0'; mContent.className = 'modal-content sz-medium';
        let h = `<div id="trxHeader" style="cursor:grab; background:#f1f5f9; padding:12px 15px; border-radius:8px 8px 0 0; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center; font-weight:bold; color:var(--s);"><span>Form ${t}</span><span style="font-size:14px; color:#64748b;">✥ Geser</span></div><div style="padding: 15px; display:flex; flex-direction:column;">`;
        if(t === 'RET') { 
            h += `<label>Ref Out:</label><div style="display:flex;gap:4px;margin-bottom:5px;"><input id="t_ref_s"><button class="btn-primary" id="btnCariRef" onclick="UI.findRef()">Cari</button></div><select id="t_ret_item" onchange="UI.fillRet()"><option value="">--Cari Ref--</option></select><label>Barang:</label><input id="t_n" readonly class="read-only"><div class="form-row-compact"><div class="f-item"><label>Kode:</label><input id="t_k" readonly class="read-only"></div><div class="f-item"><label>Stok:</label><input id="t_stk_b" readonly class="read-only"></div></div><div class="form-row-compact"><div class="f-item"><label>Qty Lama:</label><input id="t_q_old" readonly class="read-only"></div><div class="f-item"><label>Koreksi Jadi:</label><input id="t_new_q" type="number"></div></div>`; 
        } else { 
            h += `<label>Tgl:</label><input type="text" id="t_tgl" value="${todayUI}" maxlength="10" oninput="UI.formatDateInput(this)" onblur="UI.expandDate(this)"><label>No. Ref:</label><input id="t_ref" placeholder="No. Nota">
                  <label>Kode Barang:</label><div style="position:relative;"><input id="t_k" oninput="UI.showAutoList('k','${t}')" onfocus="UI.showAutoList('k','${t}')" onkeydown="UI.handleAutoKey(event, 'k', '${t}')" autocomplete="off"><div id="t_k_list" class="autocomplete-items"></div></div>
                  <label>Nama Barang:</label><div style="position:relative;"><input id="t_n" oninput="UI.showAutoList('n','${t}')" onfocus="UI.showAutoList('n','${t}')" onkeydown="UI.handleAutoKey(event, 'n', '${t}')" autocomplete="off"><div id="t_n_list" class="autocomplete-items"></div></div>`;
            if(t==='IN') { h += `<label>Batch / Rak:</label><input id="t_b" onchange="UI.checkBatchExist()"><div class="form-row-compact"><div class="f-item"><label>Qty:</label><input id="t_q" type="number"></div><div class="f-item"><label>Exp Date:</label><input type="text" id="t_exp" maxlength="10" oninput="UI.formatDateInput(this)" onblur="UI.expandDate(this)"></div></div>`; } 
            else if (t === 'ADJ') { h += `<label>Total Stok:</label><input id="t_stk_tot" readonly class="read-only"><label>Pilih Batch:</label><select id="t_b_sel" onchange="UI.updStk()"><option value="">--Pilih Kode--</option></select><div class="form-row-compact"><div class="f-item"><label>Stok Sistem:</label><input id="t_stk_b" readonly class="read-only"></div><div class="f-item"><label>Aksi:</label><select id="t_adj_type"><option value="OUT">📉 Kurang</option><option value="IN">📈 Lebih</option></select></div></div><div class="form-row-compact"><div class="f-item"><label>Selisih Qty:</label><input id="t_q" type="number"></div></div>`; } 
            else { h += `<label>Total Stok:</label><input id="t_stk_tot" readonly class="read-only"><label>Pilih Batch:</label><select id="t_b_sel" onchange="UI.updStk()"><option value="">--Pilih Kode--</option></select><div class="form-row-compact"><div class="f-item"><label>Saldo:</label><input id="t_stk_b" readonly class="read-only"></div><div class="f-item"><label>Qty Keluar:</label><input id="t_q" type="number"></div></div>`; }
        }
        h += `<label>Ket:</label><input type="text" id="t_ket"><div style="display:flex; gap:10px; margin-top:10px;"><button class="btn-primary" onclick="App.prepareSave('${t}')">Preview & Simpan</button><button class="btn-outline" onclick="UI.closeModal('modalTrx')">Tutup</button></div></div>`;
        mContent.innerHTML = h; UI.showModal('modalTrx'); Draggable.init('trxBody', 'trxHeader'); 
    },
    
    syncTrx: (m, t) => {
        const ms = DB.get('m') || [], k = document.getElementById('t_k'), n = document.getElementById('t_n'); if(!k || !n) return;
        const res = ms.find(x => m === 'k' ? (x.kode||'').toUpperCase() === k.value.toUpperCase() : x.nama === n.value);
        if(res) { 
            k.value = res.kode; n.value = res.nama; 
            if(t !== 'IN') { 
                const bts = Engine.calculate().filter(b => b.kode === res.kode);
                if(document.getElementById('t_stk_tot')) document.getElementById('t_stk_tot').value = bts.reduce((sum, b) => sum + b.stok, 0) + " Pcs"; 
                document.getElementById('t_b_sel').innerHTML = '<option value="">--Pilih Batch--</option>' + bts.map(b => `<option value="${b.batch}" data-s="${b.stok}">${b.batch} (Sisa: ${b.stok})</option>`).join(''); 
            } 
        }
    },

    findRef: () => {
        const r = document.getElementById('t_ref_s').value.trim(); if(!r) return;
        const l = DB.get('l').filter(x => x.ref === r && x.tipe === 'OUT'), ms = DB.get('m'), s = document.getElementById('t_ret_item');
        if(l.length === 0) { alert("Ref tidak ditemukan!"); s.innerHTML = '<option value="">--Kosong--</option>'; } 
        else { s.innerHTML = '<option value="">--Pilih Barang--</option>' + l.map(x => `<option value='${JSON.stringify(x)}'>${x.kode} (Qty: ${x.qty})</option>`).join(''); }
    },
    fillRet: () => { 
        const val = document.getElementById('t_ret_item').value; if(!val) return;
        const d = JSON.parse(val), act = Engine.calculate().find(b => b.kode === d.kode && b.batch === d.batch);
        document.getElementById('t_k').value = d.kode; document.getElementById('t_n').value = DB.get('m').find(x=>x.kode===d.kode)?.nama || ""; 
        document.getElementById('t_q_old').value = d.qty; document.getElementById('t_stk_b').value = act ? act.stok : 0; 
    }
};

const App = {
    pendingTrx: null, driveURL: "https://script.google.com/macros/s/AKfycbwzBVHURmu558034qMu_iKEL_sQrdL1DqGaYewjrcURXlxhGxm_8A19SahMIYS4y4-_/exec", 
    syncLoad: async () => {
        const btn = document.querySelector('button[onclick="App.syncLoad()"]');
        if (!btn) return; // Keamanan jika tombol tidak ditemukan

        const origText = btn.innerText; 
        btn.innerText = "Menarik..."; 
        btn.disabled = true;

        try {
            // Kita panggil Google Script pakai metode GET (Default fetch)
            const response = await fetch(App.driveURL, { 
                method: "GET",
                cache: "no-store" // Agar data selalu fresh, bukan dari cache
            }); 
            
            const data = await response.json();
            
            if (data.m && data.l) {
                DB.set('m', data.m);
                DB.set('l', data.l);
                
                // Set status guest jika belum login
                if (!DB.get('currentUser')) {
                    DB.set('currentUser', { role: 'guest' });
                    Auth.applySession('guest');
                }
                
                UI.refresh();
                alert("✅ Data Stok Berhasil Diperbarui!");
            } else if (data.error) {
                alert("⚠️ Masalah Server: " + data.error);
            } else {
                alert("❌ Database kosong atau format salah.");
            }
        } catch (error) {
            console.error("Error Detail:", error);
            alert("❌ Tombol Sync gagal terhubung ke Google. Pastikan URL di script.js sudah yang terbaru (/exec).");
        } finally {
            btn.innerText = origText; 
            btn.disabled = false;
        }
    },
    syncPush: async () => {
        const session = DB.get('currentUser');
        if (session.role !== 'admin') { alert("Hanya Admin yang bisa Push!"); return; }
        
        // Minta konfirmasi password admin untuk keamanan double
        const p = prompt("Konfirmasi Password Admin untuk Simpan ke Cloud:");
        if (!p) return;

        const btn = document.getElementById('btnPushDrive');
        const origText = btn.innerText; btn.innerText = "☁️ Mengirim..."; btn.disabled = true;
        
        const dataToSave = { 
            pass: p, // Kirim password ke server
            m: DB.get('m') || [], 
            l: DB.get('l') || [] 
        };
        
        try {
            const response = await fetch(App.driveURL, { method: "POST", body: JSON.stringify(dataToSave) });
            const result = await response.json();
            if(result.status === 'sukses') { alert("✅ Data tersimpan aman di Cloud!"); }
            else { alert("❌ Gagal: " + (result.msg || "Password Salah")); }
        } catch (error) {
            alert("❌ Koneksi Gagal.");
        } finally { btn.innerText = origText; btn.disabled = false; }
    },
    exportDB: () => { const b = new Blob([JSON.stringify({ m: DB.get('m'), l: DB.get('l') })], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `Backup_${new Date().getTime()}.json`; a.click(); },
    importDB: (input) => { const r = new FileReader(); r.onload = (e) => { const d = JSON.parse(e.target.result); DB.set('m', d.m); DB.set('l', d.l); UI.refresh(); alert("Data Dimuat!"); }; r.readAsText(input.files[0]); },
    resetLog: () => { if(confirm("Hapus semua log lokal?")) { DB.set('l', []); UI.refresh(); } },
    exportToExcel: () => { const actBtn = document.querySelector('.tab-btn.active'); let tid = ""; if(actBtn.innerText.includes("Stok")) tid = "inventoryBody"; else if(actBtn.innerText.includes("Mutasi")) tid = "tableMutasi"; else if(actBtn.innerText.includes("Log")) tid = "logTableBody"; const el = document.getElementById(tid); const wb = XLSX.utils.table_to_book(el.tagName === 'TABLE' ? el : el.closest('table')); XLSX.writeFile(wb, `Laporan_${new Date().getTime()}.xlsx`); },
    
    prepareSave: (t) => {
        let q = parseInt(document.getElementById('t_q')?.value || document.getElementById('t_new_q')?.value), ket = document.getElementById('t_ket').value.trim();
        const tgl = DateHelper.toDB(document.getElementById('t_tgl')?.value || ""), exp = DateHelper.toDB(document.getElementById('t_exp')?.value || "");
        if(!tgl || isNaN(q)) return alert("Data tidak valid!");

        if(t === 'RET') {
            const r = document.getElementById('t_ref_s').value, k = document.getElementById('t_k').value, l = DB.get('l'), idx = l.findIndex(x => x.ref===r && x.kode===k && x.tipe==='OUT');
            if(idx === -1) return alert("Data tidak ditemukan");
            App.pendingTrx = { action: 'UPDATE', idx: idx, q: q, ket: ket, t: t };
        } else {
            const ref = document.getElementById('t_ref').value.trim(), kode = document.getElementById('t_k').value.toUpperCase(), batch = (t === 'IN') ? document.getElementById('t_b').value : document.getElementById('t_b_sel').value;
            if(!ref || !kode) return alert("Ref & Kode wajib!");
            if ((t==='OUT'||t==='ADJ') && q > (parseInt(document.getElementById('t_stk_b').value)||0) && !(t==='ADJ'&&document.getElementById('t_adj_type').value==='IN')) return alert("Stok kurang!");
            App.pendingTrx = { action: 'INSERT', tgl, ref, kode, batch, exp, qty: q, tipe: (t==='ADJ'?document.getElementById('t_adj_type').value:(t==='IN'?'IN':'OUT')), ket, v: false, t: t };
        }
        document.getElementById('previewContent').innerHTML = `Simpan transaksi <b>${t}</b> untuk <b>${App.pendingTrx.kode}</b> sejumlah <b>${q}</b>?`;
        UI.showModal('modalPreview'); Draggable.init('previewBox', 'previewHeader');
    },

    executeSave: () => {
        let l = DB.get('l') || [];
        if(App.pendingTrx.action === 'UPDATE') { l[App.pendingTrx.idx].qty = App.pendingTrx.q; l[App.pendingTrx.idx].ket = App.pendingTrx.ket; } 
        else { let { action, t, ...newData } = App.pendingTrx; l.push(newData); }
        DB.set('l', l); UI.closeModal('modalPreview'); UI.closeModal('modalTrx'); UI.refresh(); App.pendingTrx = null;
    },
    
    openMasterAdd: () => { document.getElementById('m_k_old').value = ""; document.getElementById('m_k').value = ""; document.getElementById('m_n').value = ""; document.getElementById('m_m').value = ""; document.getElementById('masterTitle').innerText = "Tambah Barang"; document.getElementById('btnHapusMaster').style.display = 'none'; UI.showModal('modalMaster'); },
    editMaster: (k) => { const d = DB.get('m').find(x => x.kode === k); document.getElementById('m_k_old').value = d.kode; document.getElementById('m_k').value = d.kode; document.getElementById('m_n').value = d.nama; document.getElementById('m_m').value = d.masa || 0; document.getElementById('masterTitle').innerText = "Edit Komponen"; document.getElementById('btnHapusMaster').style.display = 'block'; UI.showModal('modalMaster'); },
    saveMaster: () => { 
        const k_old = document.getElementById('m_k_old').value, k = document.getElementById('m_k').value.toUpperCase(), n = document.getElementById('m_n').value, m = document.getElementById('m_m').value, d = DB.get('m');
        if(!k) return alert("Kode wajib!");
        if (k_old) { let idx = d.findIndex(x => x.kode === k_old); d[idx] = {kode:k, nama:n, masa:m}; } 
        else { if(d.some(x => x.kode === k)) return alert("Sudah ada!"); d.push({kode:k, nama:n, masa:m}); }
        DB.set('m', d); UI.closeModal('modalMaster'); UI.refresh(); 
    },
    deleteMaster: () => { const k = document.getElementById('m_k_old').value; if(confirm("Hapus permanen?")) { DB.set('m', DB.get('m').filter(x => x.kode !== k)); UI.closeModal('modalMaster'); UI.refresh(); } },
    processImport: () => { document.getElementById('importArea').value.trim().split('\n').forEach(ln => { const c = ln.split('\t'); if(c.length>=2) { let m = DB.get('m'); if(!m.some(x=>x.kode===c[0])) m.push({kode:c[0].toUpperCase(), nama:c[1], masa:c[2]||0}); DB.set('m', m); } }); UI.refresh(); UI.closeModal('modalImport'); }
};

window.onload = () => {
    const t = new Date(), today = t.toISOString().split('T')[0], past30 = new Date(t.setDate(t.getDate()-30)).toISOString().split('T')[0];
    if(localStorage.getItem('theme') === 'dark') { document.body.classList.add('dark-mode'); document.getElementById('btnTheme').innerText = '☀️'; }
    const selY = document.getElementById('f_mutasi_y'); if(selY) { for(let i = 2024; i <= 2030; i++) selY.innerHTML += `<option value="${i}">${i}</option>`; selY.value = new Date().getFullYear(); }
    if(document.getElementById('f_mutasi_m')) document.getElementById('f_mutasi_m').value = new Date().getMonth() + 1;
    if(document.getElementById('f_day_in_tgl')) document.getElementById('f_day_in_tgl').value = DateHelper.toUI(today);
    if(document.getElementById('f_day_out_tgl')) document.getElementById('f_day_out_tgl').value = DateHelper.toUI(today);
    if(document.getElementById('f_tgl_1')) document.getElementById('f_tgl_1').value = DateHelper.toUI(past30);
    if(document.getElementById('f_tgl_2')) document.getElementById('f_tgl_2').value = DateHelper.toUI(today);
    const session = DB.get('currentUser'); if(session && session.role) Auth.applySession(session.role);
    UI.refresh();
    document.addEventListener('click', (e) => { if(!['t_k','t_n','b_f_kode','b_f_nama','l_f_kode','l_f_nama'].includes(e.target.id)) document.querySelectorAll('.autocomplete-items').forEach(el => el.style.display = 'none'); });
};
