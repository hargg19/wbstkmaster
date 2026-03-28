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
    login: () => {
        const r = document.getElementById('loginRole').value, p = document.getElementById('adminPass').value; const btn = document.querySelector('#modalLogin .btn-primary'); const originalText = btn.innerText;
        btn.innerText = "Memverifikasi..."; btn.disabled = true;
        setTimeout(() => {
            if(r === 'admin' && p !== 'rootakses') { alert("Password Admin Salah!"); btn.innerText = originalText; btn.disabled = false; return; }
            DB.set('currentUser', { role: r }); Auth.applySession(r); UI.closeModal('modalLogin'); UI.refresh();
            btn.innerText = originalText; btn.disabled = false;
        }, 400); 
    },
    applySession: (role) => {
        if(!role) return;
        document.body.className = (role === 'admin') ? 'admin-mode' : 'guest-mode';
        document.querySelectorAll('.private').forEach(el => el.style.display = 'block');
        
        if (role !== 'admin') { 
            const btnPush = document.getElementById('btnPushDrive'); if (btnPush) btnPush.style.display = 'none'; 
        } else {
            // FITUR BARU: Auto-Minimize Sidebar saat Admin Login
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
    sortCol: 'kode', sortAsc: true, currentFocus: -1, 

    // FITUR BARU: Pembersihan Modal Login
    openLogin: () => {
        document.getElementById('loginRole').value = 'guest';
        document.getElementById('adminPass').value = '';
        UI.loginUX('guest'); 
        UI.showModal('modalLogin');
    },

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
    showModal: (id) => document.getElementById(id).style.display = 'block',
    closeModal: (id) => document.getElementById(id).style.display = 'none',
    toggleSidebar: () => document.getElementById('sidebar').classList.toggle('mini'),
    checkRole: () => document.getElementById('adminPassArea').style.display = document.getElementById('loginRole').value === 'admin' ? 'block' : 'none',
    loginUX: (r) => { const p = document.getElementById('adminPassArea'); p.style.display = (r==='admin')?'block':'none'; if(r==='admin') document.getElementById('adminPass').focus(); },

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
                if (type === 'k') document.getElementById('t_n').value = '';
                if (type === 'n') document.getElementById('t_k').value = '';
                if(document.getElementById('t_stk_tot')) document.getElementById('t_stk_tot').value = '';
                if(document.getElementById('t_b_sel')) document.getElementById('t_b_sel').innerHTML = '<option value="">--Pilih Kode Dulu--</option>';
                if(document.getElementById('t_stk_b')) document.getElementById('t_stk_b').value = '';
            } else if (['b_f_k', 'b_f_n'].includes(type)) {
                if (type === 'b_f_k') document.getElementById('b_f_nama').value = ''; if (type === 'b_f_n') document.getElementById('b_f_kode').value = '';
            } else if (['l_f_k', 'l_f_n'].includes(type)) {
                if (type === 'l_f_k') document.getElementById('l_f_nama').value = ''; if (type === 'l_f_n') document.getElementById('l_f_kode').value = '';
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
        else if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            if (UI.currentFocus > -1) { items[UI.currentFocus].click(); } else if (items.length > 0) { items[0].click(); } 
        }
    },
    
    addActive: (items) => {
        if (!items) return;
        for (let i = 0; i < items.length; i++) { items[i].style.backgroundColor = ''; items[i].style.color = ''; items[i].style.fontWeight = 'normal'; }
        if (UI.currentFocus >= items.length) UI.currentFocus = 0; if (UI.currentFocus < 0) UI.currentFocus = (items.length - 1);
        items[UI.currentFocus].style.backgroundColor = '#eff6ff'; items[UI.currentFocus].style.color = '#2563eb'; items[UI.currentFocus].style.fontWeight = 'bold';
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
            document.getElementById('b_f_k_list').style.display = 'none'; document.getElementById('b_f_n_list').style.display = 'none'; UI.refresh();
        } else { 
            document.getElementById('l_f_kode').value = item.kode; document.getElementById('l_f_nama').value = item.nama;
            document.getElementById('l_f_k_list').style.display = 'none'; document.getElementById('l_f_n_list').style.display = 'none'; UI.refresh();
        }
    },

    refresh: () => {
        const ms = DB.get('m') || []; const l = DB.get('l') || []; const act = Engine.calculate(); 
        const searchEl = document.getElementById('searchInput'); const qG = searchEl ? searchEl.value.toUpperCase() : '';

        const session = DB.get('currentUser') || {}; const isAdmin = session.role === 'admin';
        const thAksi = document.getElementById('th_aksi'); if(thAksi) thAksi.style.display = isAdmin ? 'table-cell' : 'none';

        if(document.getElementById('tab-stok').classList.contains('active')) {
            let stokData = ms.filter(m => {
                const k = m.kode ? m.kode.toUpperCase() : ''; const n = m.nama ? m.nama.toUpperCase() : ''; return k.includes(qG) || n.includes(qG);
            }).map(m => {
                const bts = act.filter(b => b.kode === m.kode), ttl = bts.reduce((a,b)=>a+b.stok, 0); return { kode: m.kode || '-', nama: m.nama || '-', stok: ttl };
            });

            stokData.sort((a, b) => {
                let vA = a[UI.sortCol]; let vB = b[UI.sortCol];
                if(typeof vA === 'string') vA = vA.toUpperCase(); if(typeof vB === 'string') vB = vB.toUpperCase();
                if(vA < vB) return UI.sortAsc ? -1 : 1; if(vA > vB) return UI.sortAsc ? 1 : -1; return 0;
            });

            document.getElementById('inventoryBody').innerHTML = stokData.map(m => {
                let actionBtn = isAdmin ? `<td style="text-align:center;"><button class="btn-outline" style="padding:2px 8px; font-size:11px; margin:0;" onclick="App.editMaster('${m.kode}')">✏️ Edit</button></td>` : `<td style="display:none;"></td>`;
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

    renderExpiry: (ms, act) => {
        const today = new Date(); today.setHours(0,0,0,0); let htmlContent = '';
        act.forEach(b => {
            if(!b.exp) return; const m = ms.find(x => x.kode === b.kode); if(!m) return;
            const masaSimpan = parseInt(m.masa) || 0; if(masaSimpan === 0) return; 
            const expDate = new Date(b.exp); expDate.setHours(0,0,0,0);
            const diffTime = expDate - today; const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            const threshold = masaSimpan * 0.5;
            if (diffDays <= threshold) {
                let statusTxt = ""; let rowClass = "";
                if (diffDays < 0) { statusTxt = `<span style="color:red; font-weight:bold;">Telah Kadaluarsa! (${Math.abs(diffDays)} hari lewat)</span>`; rowClass = "background-color: #fef2f2;"; } 
                else { statusTxt = `<span style="color:#d97706; font-weight:bold;">Mendekati Expired (Sisa ${diffDays} hari)</span>`; rowClass = "background-color: #fffbeb;"; }
                htmlContent += `<tr style="${rowClass}"><td><b>${b.kode}</b></td><td>${m.nama}</td><td>📦 ${b.batch}</td><td class="txt-m">${b.stok}</td><td><b>${DateHelper.toUI(b.exp)}</b></td><td>${masaSimpan} hari</td><td>${statusTxt}</td></tr>`;
            }
        });
        if(htmlContent === '') htmlContent = '<tr><td colspan="7" align="center" style="padding:20px;">✅ Semua komponen aman. Tidak ada yang mendekati batas 50% kadaluarsa.</td></tr>';
        document.getElementById('expiryTableBody').innerHTML = htmlContent;
    },

    renderDaily: (id, tipe, ms, l) => {
        const pane = document.getElementById('tab-' + id); if (!pane || !pane.classList.contains('active')) return;
        const tglFilterRaw = document.getElementById(`f_${id.replace('-','_')}_tgl`).value; 
        const tglFilter = DateHelper.toDB(tglFilterRaw);
        const searchVal = document.getElementById(`f_${id.replace('-','_')}_q`).value.toUpperCase();
        const filtered = l.filter(x => x.tgl === tglFilter && x.tipe === tipe && (x.kode.includes(searchVal) || ((ms.find(m=>m.kode===x.kode)||{}).nama||'').toUpperCase().includes(searchVal)));
        document.getElementById(`${id.replace('-','')}TableBody`).innerHTML = filtered.reverse().map(x => { const m = ms.find(i => i.kode === x.kode); return `<tr class="${x.v ? 'is-verified' : ''}"><td>${x.ref}</td><td><b>${x.kode}</b></td><td>${m ? m.nama : ''}</td><td>${x.batch}</td><td>${x.qty}</td><td>${x.ket || '-'}</td><td align="center"><input type="checkbox" ${x.v ? 'checked' : ''} onchange="UI.toggleVerify(${l.indexOf(x)})"></td></tr>`; }).join('');
    },
    renderMutasiPivot: (ms, l) => {
        const bul = document.getElementById('f_mutasi_bulan').value; if(!bul) return;
        const [y, m] = bul.split('-').map(Number), days = new Date(y, m, 0).getDate(); const q = document.getElementById('f_mutasi_q').value.toUpperCase();
        let h1 = `<tr><th rowspan="2" class="sticky-col k-kode">Kode</th><th rowspan="2" class="sticky-col k-nama">Nama Barang</th><th rowspan="2" style="background:#fffde7">Awal</th>`; let h2 = `<tr>`;
        for(let i=1; i<=days; i++) { h1 += `<th colspan="2" class="day-header">${i}</th>`; h2 += `<th class="sub-col">M</th><th class="sub-col">K</th>`; }
        h1 += `<th rowspan="2">IN</th><th rowspan="2">OUT</th><th rowspan="2" style="background:#e8f5e9">Akhir</th></tr>`; document.getElementById('mutasiHeader').innerHTML = h1 + h2 + `</tr>`;
        document.getElementById('mutasiTableBody').innerHTML = ms.filter(m_ => (m_.kode||'').includes(q) || (m_.nama||'').toUpperCase().includes(q)).map(it => {
            let aw = 0, ti = 0, to = 0, dM = Array(days+1).fill(0), dK = Array(days+1).fill(0);
            l.filter(x => x.kode === it.kode).forEach(log => {
                const ld = new Date(log.tgl), ly = ld.getFullYear(), lm = ld.getMonth()+1;
                if (ly < y || (ly === y && lm < m)) log.tipe === 'IN' ? aw += log.qty : aw -= log.qty;
                else if (ly === y && lm === m) { const day = ld.getDate(); if(log.tipe === 'IN') { dM[day] += log.qty; ti += log.qty; } else { dK[day] += log.qty; to += log.qty; } }
            });
            let row = `<tr><td class="sticky-col k-kode">${it.kode}</td><td class="sticky-col k-nama">${it.nama}</td><td style="background:#fffde7">${aw}</td>`;
            for(let i=1; i<=days; i++) row += `<td class="sub-col txt-m">${dM[i]||''}</td><td class="sub-col txt-k">${dK[i]||''}</td>`;
            return row + `<td>${ti}</td><td>${to}</td><td style="background:#e8f5e9">${aw+ti-to}</td></tr>`;
        }).join('');
    },
    renderBatch: (ms, act) => {
        const qK = document.getElementById('b_f_kode').value.toUpperCase(); const qN = document.getElementById('b_f_nama').value.toUpperCase(); let ttlS = 0; 
        const filteredMs = ms.filter(m => (qK ? m.kode === qK : true) && (qN ? m.nama === qN : true)); let htmlContent = '';
        filteredMs.forEach(m => { const bts = act.filter(b => b.kode === m.kode); if(bts.length > 0) { bts.forEach(b => { 
            let expText = b.exp ? `<span style="color:#d97706; font-weight:bold;">${DateHelper.toUI(b.exp)}</span>` : '-'; 
            htmlContent += `<tr><td><b>${m.kode}</b></td><td>${m.nama}</td><td>📦 ${b.batch}</td><td>${expText}</td><td class="txt-m">${b.stok}</td></tr>`; ttlS += b.stok; 
        }); } });
        document.getElementById('batchContainer').innerHTML = htmlContent; document.getElementById('b_f_stok').value = ttlS;
    },
    renderLog: (ms, l) => {
        const t1 = DateHelper.toDB(document.getElementById('f_tgl_1').value), t2 = DateHelper.toDB(document.getElementById('f_tgl_2').value); 
        const qK = document.getElementById('l_f_kode').value.toUpperCase(), tipe = document.getElementById('f_tipe').value;
        const filtered = l.filter(x => (x.tgl >= t1 && x.tgl <= t2) && (qK ? x.kode === qK : true) && (tipe === 'ALL' || x.tipe === tipe));
        document.getElementById('logTableBody').innerHTML = filtered.reverse().map(x => { const m = ms.find(i => i.kode === x.kode); return `<tr class="${x.v ? 'is-verified' : ''}"><td>${DateHelper.toUI(x.tgl)}</td><td>${x.ref}</td><td><b>${x.kode}</b></td><td>${m?m.nama:''}</td><td>${x.batch}</td><td>${x.qty}</td><td class="${x.tipe==='IN'?'txt-m':'txt-k'}">${x.tipe}</td><td>${x.ket || '-'}</td><td align="center"><input type="checkbox" ${x.v ? 'checked' : ''} onchange="UI.toggleVerify(${l.indexOf(x)})"></td></tr>`; }).join('');
    },
    updStk: () => { const s = document.getElementById('t_b_sel'); if (s && s.selectedIndex > 0) { document.getElementById('t_stk_b').value = s.options[s.selectedIndex].getAttribute('data-s') || 0; } else { document.getElementById('t_stk_b').value = ""; } },
    
    toggleVerify: (idx) => { let l = DB.get('l'); l[idx].v = !l[idx].v; DB.set('l', l); UI.refresh(); },
    checkBatchExist: () => {
        const kEl = document.getElementById('t_k'); const bEl = document.getElementById('t_b'); if(!kEl || !bEl) return;
        const k = kEl.value.toUpperCase(); const b = bEl.value.trim(); if(!k || !b) return;
        const act = Engine.calculate(); const exist = act.find(x => x.kode === k && x.batch === b);
        if(exist) {
            if(confirm(`⚠️ BATCH SUDAH ADA ⚠️\n\nBatch "${b}" sudah terdaftar dengan sisa stok ${exist.stok} Pcs.\n\nKlik OK jika yakin ingin MENAMBAH barang ke batch yang sama.`)) {
                if(exist.exp) { const elExp = document.getElementById('t_exp'); if(elExp) elExp.value = DateHelper.toUI(exist.exp); } document.getElementById('t_q').focus();
            } else { bEl.value = ""; setTimeout(() => bEl.focus(), 10); }
        }
    },
    
    openTrx: (t) => {
        const todayUI = DateHelper.toUI(new Date().toISOString().split('T')[0]); 
        const mContent = document.getElementById('trxBody'); mContent.style.padding = '0'; mContent.className = 'modal-content sz-medium';
        let h = `<div id="trxHeader" style="cursor:grab; background:#f1f5f9; padding:12px 15px; border-radius:8px 8px 0 0; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center; font-weight:bold; color:var(--s);"><span>Form ${t}</span><span style="font-size:14px; color:#64748b;">✥ Geser Panel</span></div><div style="padding: 15px; display:flex; flex-direction:column;">`;
        if(t === 'RET') { 
            h += `<label>Ref Out:</label><div style="display:flex;gap:4px;margin-bottom:5px;"><input id="t_ref_s"><button class="btn-primary" id="btnCariRef" onclick="UI.findRef()">Cari</button></div><select id="t_ret_item" onchange="UI.fillRet()"><option value="">--Menunggu Referensi--</option></select>
                  <label>Nama Barang:</label><div style="position:relative;"><input id="t_n" readonly class="read-only"><div id="t_n_list" class="autocomplete-items"></div></div>
                  <div class="form-row-compact"><div class="f-item"><label>Kode:</label><div style="position:relative;"><input id="t_k" readonly class="read-only"><div id="t_k_list" class="autocomplete-items"></div></div></div><div class="f-item"><label>Stok Aktif:</label><input id="t_stk_b" readonly class="read-only"></div></div><div class="form-row-compact"><div class="f-item"><label>Qty Keluar Lama:</label><input id="t_q_old" readonly class="read-only"></div><div class="f-item"><label>Koreksi Menjadi:</label><input id="t_new_q" type="number" min="0"></div></div>`; 
        } else { 
            h += `<label>Tgl:</label><input type="text" id="t_tgl" value="${todayUI}" placeholder="DD-MM-YYYY" maxlength="10" oninput="UI.formatDateInput(this)" onblur="UI.expandDate(this)"><label>No. Nota / Berita Acara:</label><input id="t_ref" placeholder="No. Dokumen/Ref">
                  <label>Kode Barang:</label><div style="position:relative;"><input id="t_k" oninput="UI.showAutoList('k','${t}')" onfocus="UI.showAutoList('k','${t}')" onkeydown="UI.handleAutoKey(event, 'k', '${t}')" autocomplete="off" placeholder="Ketik Kode/Pilih..."><div id="t_k_list" class="autocomplete-items"></div></div>
                  <label>Nama Barang:</label><div style="position:relative;"><input id="t_n" oninput="UI.showAutoList('n','${t}')" onfocus="UI.showAutoList('n','${t}')" onkeydown="UI.handleAutoKey(event, 'n', '${t}')" autocomplete="off" placeholder="Ketik Nama/Pilih..."><div id="t_n_list" class="autocomplete-items"></div></div>`;
            if(t==='IN') { 
                h += `<label>Batch / Rak:</label><input id="t_b" placeholder="Kode Batch / Lokasi Rak" onchange="UI.checkBatchExist()">
                      <div class="form-row-compact">
                          <div class="f-item"><label>Qty (Jumlah):</label><input id="t_q" type="number" min="1"></div>
                          <div class="f-item"><label>Exp. Date (Ops):</label><input type="text" id="t_exp" placeholder="DD-MM-YYYY" maxlength="10" oninput="UI.formatDateInput(this)" onblur="UI.expandDate(this)"></div>
                      </div>`; 
            } 
            else if (t === 'ADJ') { h += `<label>Total Stok Keseluruhan:</label><input id="t_stk_tot" readonly class="read-only" style="text-align:center; font-size:15px; font-weight:bold; color:var(--success); margin-bottom:8px;" placeholder="0"><label>Pilih Batch (Yang Terdaftar):</label><select id="t_b_sel" onchange="UI.updStk()"><option value="">--Pilih Kode Dulu--</option></select><div class="form-row-compact"><div class="f-item"><label>Stok di Sistem:</label><input id="t_stk_b" readonly class="read-only"></div><div class="f-item"><label>Aksi Opname:</label><select id="t_adj_type"><option value="OUT">📉 Kurang (Hilang/Rusak)</option><option value="IN">📈 Lebih (Sisa/Ditemukan)</option></select></div></div><div class="form-row-compact" style="margin-top:5px;"><div class="f-item"><label>Jumlah Selisih:</label><input id="t_q" type="number" min="1" placeholder="Masukkan selisih qty"></div></div>`; } 
            else { h += `<label>Total Stok Keseluruhan:</label><input id="t_stk_tot" readonly class="read-only" style="text-align:center; font-size:15px; font-weight:bold; color:var(--success); margin-bottom:8px;" placeholder="0"><label>Pilih Batch:</label><select id="t_b_sel" onchange="UI.updStk()"><option value="">--Pilih Kode Dulu--</option></select><div class="form-row-compact"><div class="f-item"><label>Saldo (Per Batch):</label><input id="t_stk_b" readonly class="read-only"></div><div class="f-item"><label>Qty Keluar:</label><input id="t_q" type="number" min="1"></div></div>`; }
        }
        h += `<label>Keterangan:</label><input type="text" id="t_ket" placeholder="Catatan (Opsional)"><div style="display:flex; gap:10px; margin-top:10px;"><button class="btn-primary" onclick="App.prepareSave('${t}')">Preview & Simpan</button><button class="btn-outline" style="margin-top:0;" onclick="UI.closeModal('modalTrx')">Tutup Panel</button></div></div>`;
        mContent.innerHTML = h; UI.showModal('modalTrx'); Draggable.reset('trxBody'); Draggable.init('trxBody', 'trxHeader'); 
    },
    
    syncTrx: (m, t) => {
        const ms = DB.get('m') || []; const k = document.getElementById('t_k'); const n = document.getElementById('t_n');
        if(!k || !n) return;
        const v = m === 'k' ? (k.value || '').toUpperCase() : n.value; const res = ms.find(x => m === 'k' ? x.kode === v : x.nama === v);
        
        if(res) { 
            k.value = res.kode; n.value = res.nama; 
            if(t !== 'IN') { 
                const act = Engine.calculate(); const bts = act.filter(b => b.kode === res.kode); 
                const totStok = bts.reduce((sum, b) => sum + b.stok, 0); const elTot = document.getElementById('t_stk_tot'); 
                if(elTot) elTot.value = totStok + " Pcs"; 
                const elSel = document.getElementById('t_b_sel');
                if(elSel) elSel.innerHTML = '<option value="">--Pilih Batch--</option>' + bts.map(b => `<option value="${b.batch}" data-s="${b.stok}">${b.batch} (Sisa: ${b.stok})</option>`).join(''); 
                const elStkB = document.getElementById('t_stk_b'); if(elStkB) elStkB.value = ""; 
            } 
        }
    },

    findRef: () => {
        const r = document.getElementById('t_ref_s').value.trim(); const btn = document.getElementById('btnCariRef'); if(!r) { alert("Masukkan No. Referensi!"); return; }
        btn.innerText = "Mencari..."; btn.disabled = true;
        setTimeout(() => {
            const l = DB.get('l').filter(x => x.ref === r && x.tipe === 'OUT'); const ms = DB.get('m'); const selectEl = document.getElementById('t_ret_item');
            if(l.length === 0) { alert(`Data dengan Ref "${r}" tidak ditemukan!`); selectEl.innerHTML = '<option value="">--Tidak ada data--</option>'; } 
            else { selectEl.innerHTML = '<option value="">--Pilih Barang Yang Diretur--</option>' + l.map(x => { const masterData = ms.find(m => m.kode === x.kode); const namaBarang = masterData ? masterData.nama : 'Tidak Diketahui'; return `<option value='${JSON.stringify(x)}'>${x.kode} - ${namaBarang} (Keluar: ${x.qty})</option>`; }).join(''); }
            document.getElementById('t_k').value = ""; document.getElementById('t_n').value = ""; document.getElementById('t_q_old').value = ""; document.getElementById('t_stk_b').value = ""; btn.innerText = "Cari"; btn.disabled = false;
        }, 300);
    },
    fillRet: () => { 
        const val = document.getElementById('t_ret_item').value; if(!val) return;
        const d = JSON.parse(val); const ms = DB.get('m'); const act = Engine.calculate();
        document.getElementById('t_k').value = d.kode; document.getElementById('t_n').value = ms.find(x=>x.kode===d.kode)?.nama || ""; document.getElementById('t_q_old').value = d.qty; 
        const batchStock = act.find(b => b.kode === d.kode && b.batch === d.batch); document.getElementById('t_stk_b').value = batchStock ? batchStock.stok : 0; 
    }
};

const App = {
    pendingTrx: null, driveURL: "https://script.google.com/macros/s/AKfycbwV_EsebWHPkoRH6DBngsumFc4GT90Tdhk1TU1B4KDLP4QQilHS2whhrwgqbABjdgH0/exec", 
    syncLoad: async () => { const btn = document.querySelector('button[onclick="App.syncLoad()"]'); const origText = btn.innerText; btn.innerText = "🔄 Menarik..."; btn.disabled = true; try { const response = await fetch(App.driveURL); const data = await response.json(); if(data) { DB.set('m', data.m || []); DB.set('l', data.l || []); UI.refresh(); alert("✅ Sinkronisasi Berhasil!\nData terbaru dimuat."); } } catch (error) { console.error(error); alert("❌ Gagal menarik data."); } finally { btn.innerText = origText; btn.disabled = false; } },
    syncPush: async () => { const btn = document.getElementById('btnPushDrive'); const origText = btn.innerText; btn.innerText = "☁️ Mengirim..."; btn.disabled = true; const dataToSave = { m: DB.get('m') || [], l: DB.get('l') || [] }; try { const response = await fetch(App.driveURL, { method: "POST", body: JSON.stringify(dataToSave) }); const result = await response.json(); if(result.status === 'sukses') { alert("✅ Push Berhasil!\nData disimpan ke Google Drive."); } } catch (error) { console.error(error); alert("❌ Gagal mengirim data."); } finally { btn.innerText = origText; btn.disabled = false; } },
    exportDB: () => { const data = { m: DB.get('m'), l: DB.get('l') }; const b = new Blob([JSON.stringify(data)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `Backup_StockMaster_${new Date().getTime()}.json`; a.click(); },
    importDB: (input) => { const r = new FileReader(); r.onload = (e) => { const d = JSON.parse(e.target.result); DB.set('m', d.m); DB.set('l', d.l); alert("Database Lokal Berhasil Dimuat!"); UI.refresh(); }; r.readAsText(input.files[0]); },
    resetLog: () => { if(confirm("Hapus seluruh log lokal?")) { DB.set('l', []); UI.refresh(); } },
    exportToExcel: () => { const actBtn = document.querySelector('.tab-btn.active'); if(!actBtn) return; const act = actBtn.innerText; let tid = ""; if(act.includes("Stok")) tid = "inventoryBody"; else if(act.includes("Masuk")) tid = "dayinTableBody"; else if(act.includes("Keluar")) tid = "dayoutTableBody"; else if(act.includes("Mutasi")) tid = "tableMutasi"; else if(act.includes("Log")) tid = "logTableBody"; else if(act.includes("Batch")) tid = "batchContainer"; else if(act.includes("Expired")) tid = "expiryTableBody"; const el = document.getElementById(tid); const table = el.tagName === 'TABLE' ? el : el.closest('table') || el.querySelector('table'); const wb = XLSX.utils.table_to_book(table); XLSX.writeFile(wb, `Laporan_${new Date().getTime()}.xlsx`); },
    
    prepareSave: (t) => {
        let l = DB.get('l') || []; const qInput = document.getElementById('t_q')?.value || document.getElementById('t_new_q')?.value;
        let q = parseInt(qInput); const ket = document.getElementById('t_ket').value.trim(); 
        
        const tglRaw = document.getElementById('t_tgl') ? document.getElementById('t_tgl').value : "";
        const tglDB = DateHelper.toDB(tglRaw);
        if(!tglDB || tglDB.length !== 10) { alert("Format Tanggal tidak valid! Gunakan format DD-MM-YYYY\nContoh: 15-03-2026"); return; }

        const expRaw = document.getElementById('t_exp') ? document.getElementById('t_exp').value.trim() : ""; 
        let expDB = "";
        if(expRaw) {
            expDB = DateHelper.toDB(expRaw);
            if(!expDB || expDB.length !== 10) { alert("Format Expired Date tidak valid!\nContoh: 31-12-2026 atau 31-12-26"); return; }
        }

        if(!q || isNaN(q) || q < 0) { alert("Kuantitas (Qty) tidak valid!"); return; }
        let previewHTML = ""; let pendingData = null;

        if(t === 'RET') {
            const r = document.getElementById('t_ref_s').value; const k = document.getElementById('t_k').value; const n = document.getElementById('t_n').value;
            if(!k) { alert("Pilih barang!"); return; }
            const idx = l.findIndex(x => x.ref===r && x.kode===k && x.tipe==='OUT');
            if(idx !== -1) { pendingData = { action: 'UPDATE', idx: idx, q: q, ket: ket, t: t }; previewHTML = `<b>Ref:</b> ${r}<br><b>Barang:</b> ${k} - ${n}<br><b>Qty Menjadi:</b> <span style="color:red; font-size:16px; font-weight:bold;">${q}</span><br><b>Keterangan:</b> ${ket || '-'}`; } else { alert("Data tidak ditemukan"); return; }
        } else {
            const ref = document.getElementById('t_ref').value.trim(); const kode = document.getElementById('t_k').value.toUpperCase(); const n = document.getElementById('t_n').value;
            if(!ref || !kode) { alert("Referensi dan Kode Barang wajib diisi!"); return; }
            if (t === 'OUT' || t === 'ADJ') {
                const batchSel = document.getElementById('t_b_sel').value; if(!batchSel) { alert("Pilih Batch terlebih dahulu!"); return; }
                let stokAktif = parseInt(document.getElementById('t_stk_b').value) || 0; let isSubtracting = (t === 'OUT') || (t === 'ADJ' && document.getElementById('t_adj_type').value === 'OUT');
                if (isSubtracting && q > stokAktif) { alert(`Stok tidak mencukupi!\nSisa stok aktif pada batch ini hanya ${stokAktif}.`); return; }
            }

            const batch = (t === 'IN') ? document.getElementById('t_b').value : document.getElementById('t_b_sel').value;
            let trType = (t === 'IN') ? 'IN' : 'OUT'; if (t === 'ADJ') { trType = document.getElementById('t_adj_type').value; }
            
            pendingData = { action: 'INSERT', tgl: tglDB, ref, kode, batch, exp: expDB, qty: q, tipe: trType, ket, v: false, t: t };
            let tipeColor = trType === 'IN' ? 'green' : 'red'; let labelAct = t;
            if(t === 'ADJ') labelAct = trType === 'IN' ? 'Stok Opname (Penambahan +)' : 'Stok Opname (Pengurangan -)';

            previewHTML = `<b>Transaksi: ${labelAct}</b><br><br><b>Tgl:</b> ${tglRaw}<br><b>No. Ref:</b> ${ref}<br><b>Barang:</b> ${kode} - ${n}<br><b>Batch:</b> ${batch || '-'}<br>`;
            if (t === 'IN') previewHTML += `<b>Exp Date:</b> ${expRaw ? expRaw : '-'}<br>`; 
            previewHTML += `<b>Selisih Qty:</b> <span style="color:${tipeColor}; font-size:16px; font-weight:bold;">${q}</span><br><b>Ket:</b> ${ket || '-'}`;
        }

        App.pendingTrx = pendingData; document.getElementById('previewContent').innerHTML = previewHTML;
        UI.showModal('modalPreview'); Draggable.reset('previewBox'); Draggable.init('previewBox', 'previewHeader'); setTimeout(() => document.getElementById('btnConfirmSave').focus(), 100); 
    },

    executeSave: () => {
        if(!App.pendingTrx) return;
        const btn = document.getElementById('btnConfirmSave'); const origText = btn.innerText; btn.innerText = "Merekam Data..."; btn.disabled = true;

        setTimeout(() => {
            let l = DB.get('l') || [];
            if(App.pendingTrx.action === 'UPDATE') { l[App.pendingTrx.idx].qty = App.pendingTrx.q; if(App.pendingTrx.ket) l[App.pendingTrx.idx].ket = App.pendingTrx.ket; } 
            else { let { action, t, ...newData } = App.pendingTrx; l.push(newData); }
            DB.set('l', l);
            const t = App.pendingTrx.t; App.pendingTrx = null; btn.innerText = origText; btn.disabled = false; UI.closeModal('modalPreview');
            
            if(t === 'RET') {
                document.getElementById('t_ref_s').value = ""; document.getElementById('t_ret_item').innerHTML = '<option value="">--Menunggu Referensi--</option>'; document.getElementById('t_k').value = ""; document.getElementById('t_n').value = ""; document.getElementById('t_q_old').value = ""; document.getElementById('t_stk_b').value = ""; document.getElementById('t_new_q').value = ""; document.getElementById('t_ket').value = ""; document.getElementById('t_ref_s').focus();
            } else {
                document.getElementById('t_k').value = ""; document.getElementById('t_n').value = "";
                if(t === 'IN') { document.getElementById('t_b').value = ""; document.getElementById('t_exp').value = ""; } 
                else { document.getElementById('t_b_sel').innerHTML = '<option value="">--Pilih Kode Dulu--</option>'; document.getElementById('t_stk_b').value = ""; if(document.getElementById('t_stk_tot')) document.getElementById('t_stk_tot').value = ""; if(t === 'ADJ') document.getElementById('t_adj_type').value = "OUT"; }
                document.getElementById('t_q').value = ""; document.getElementById('t_ket').value = ""; document.getElementById('t_k').focus(); 
            }
            UI.refresh(); 
        }, 500); 
    },
    
    openMasterAdd: () => {
        document.getElementById('m_k_old').value = ""; document.getElementById('m_k').value = ""; document.getElementById('m_n').value = ""; document.getElementById('m_m').value = "";
        document.getElementById('masterTitle').innerText = "Tambah Barang"; document.getElementById('btnHapusMaster').style.display = 'none'; UI.showModal('modalMaster');
    },
    editMaster: (k) => {
        const d = DB.get('m').find(x => x.kode === k); if(!d) return;
        document.getElementById('m_k_old').value = d.kode; document.getElementById('m_k').value = d.kode; document.getElementById('m_n').value = d.nama; document.getElementById('m_m').value = d.masa || 0;
        document.getElementById('masterTitle').innerText = "Edit Komponen"; document.getElementById('btnHapusMaster').style.display = 'block'; UI.showModal('modalMaster');
    },
    saveMaster: () => { 
        const k_old = document.getElementById('m_k_old').value; const k = document.getElementById('m_k').value.toUpperCase(); const n = document.getElementById('m_n').value; const masa = document.getElementById('m_m').value;
        if(!k) return alert("Kode wajib diisi!"); 
        let d = DB.get('m') || []; let l = DB.get('l') || [];

        if (k_old) {
            if(k !== k_old && d.some(x => x.kode === k)) return alert("Kode Barang baru sudah dipakai!");
            let idx = d.findIndex(x => x.kode === k_old);
            if(idx > -1) { d[idx].kode = k; d[idx].nama = n; d[idx].masa = masa; }
            if(k !== k_old) { l.forEach(log => { if(log.kode === k_old) log.kode = k; }); DB.set('l', l); }
            alert("Data berhasil diupdate!");
        } else {
            if(d.some(x => x.kode === k)) return alert("Kode Barang sudah terdaftar!");
            d.push({kode: k, nama: n, masa: masa}); alert("Barang baru ditambahkan!");
        }
        DB.set('m', d); 
        document.getElementById('m_k_old').value = ""; document.getElementById('m_k').value = ""; document.getElementById('m_n').value = ""; document.getElementById('m_m').value = "";
        UI.closeModal('modalMaster'); UI.refresh(); 
    },
    deleteMaster: () => {
        const k = document.getElementById('m_k_old').value; if(!k) return;
        const act = Engine.calculate(); const sisaStok = act.filter(x => x.kode === k).reduce((a,b)=>a+b.stok, 0);
        
        if (sisaStok > 0) { alert(`⛔ PENOLAKAN SISTEM ⛔\n\nKomponen "${k}" tidak bisa dihapus karena masih ada SISA STOK fisik sebanyak ${sisaStok} Pcs di bengkel.`); return; }
        if(confirm(`🚨 PERINGATAN BENGKEL 🚨\n\nAnda yakin ingin menghapus komponen "${k}" secara permanen dari Database Master?`)) {
            let m = DB.get('m') || []; m = m.filter(x => x.kode !== k); DB.set('m', m);
            alert("✅ Komponen berhasil dihapus permanen dari sistem!"); UI.closeModal('modalMaster'); UI.refresh();
        }
    },
    processImport: () => { 
        const lns = document.getElementById('importArea').value.trim().split('\n'); let m = DB.get('m') || []; 
        lns.forEach(ln => { const c = ln.split('\t'); if(c.length>=2 && !m.some(x => x.kode === c[0].toUpperCase())) { m.push({kode:c[0].toUpperCase(), nama:c[1], masa:c[2]||0}); } }); 
        DB.set('m', m); UI.refresh(); UI.closeModal('modalImport'); 
    }
};

window.onload = () => {
    const tObj = new Date(); tObj.setMinutes(tObj.getMinutes() - tObj.getTimezoneOffset()); 
    const today = tObj.toISOString().split('T')[0];
    const pObj = new Date(); pObj.setDate(pObj.getDate() - 30); pObj.setMinutes(pObj.getMinutes() - pObj.getTimezoneOffset()); 
    const past30 = pObj.toISOString().split('T')[0];
    
    const todayUI = DateHelper.toUI(today);
    const past30UI = DateHelper.toUI(past30);

    if(document.getElementById('f_day_in_tgl')) document.getElementById('f_day_in_tgl').value = todayUI; 
    if(document.getElementById('f_day_out_tgl')) document.getElementById('f_day_out_tgl').value = todayUI; 
    if(document.getElementById('f_mutasi_bulan')) document.getElementById('f_mutasi_bulan').value = today.substring(0, 7); 
    if(document.getElementById('f_tgl_1')) document.getElementById('f_tgl_1').value = past30UI; 
    if(document.getElementById('f_tgl_2')) document.getElementById('f_tgl_2').value = todayUI;
    
    const session = DB.get('currentUser'); if(session && session.role) Auth.applySession(session.role);
    UI.refresh();

    document.addEventListener('click', function (e) {
        const ids = ['t_k', 't_n', 'b_f_kode', 'b_f_nama', 'l_f_kode', 'l_f_nama'];
        if(!ids.includes(e.target.id)) { document.querySelectorAll('.autocomplete-items').forEach(el => el.style.display = 'none'); }
    });
};
