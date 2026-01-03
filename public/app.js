import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getFirestore, collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, setDoc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";

// --- COLE SUAS CHAVES FIREBASE AQUI ---
const firebaseConfig = {
    apiKey: "AIzaSyC2NH5D5-dBk057use7wRQtF25vcBDw7Lo",
    authDomain: "financas-2abdf.firebaseapp.com",
    projectId: "financas-2abdf",
    storageBucket: "financas-2abdf.firebasestorage.app",
    messagingSenderId: "720802610676",
    appId: "1:720802610676:web:e1aea9c52df5b67ff24da1",
    measurementId: "G-8F06PFR2N4"
};

let db, auth, currentUser;
let trans = [], notifs = [], fixos = [];
let chart1, chart2;
const moneyFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
} catch (e) { showToast("Erro de conexão.", "error"); }

const loadingScreen = document.getElementById('loading-overlay');
const authScreen = document.getElementById('auth-screen');
const appScreen = document.getElementById('app-screen');

function showToast(msg, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = msg;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 3000);
}

onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            const ref = doc(db, "users", user.uid);
            let snap = await getDoc(ref);
            if (!snap.exists()) {
                await setDoc(ref, { name: user.email.split('@')[0], email: user.email, role: 'user', createdAt: Date.now() });
                snap = await getDoc(ref);
            }
            currentUser = { uid: user.uid, ...snap.data() };
            document.getElementById('user-display').textContent = currentUser.name;
            
            const adminBtn = document.querySelector('.admin-only');
            if (currentUser.role === 'admin') {
                if(adminBtn) adminBtn.classList.remove('hidden');
                initAdmin();
            } else {
                if(adminBtn) adminBtn.classList.add('hidden');
            }

            authScreen.classList.add('hidden');
            appScreen.classList.remove('hidden');
            initData();
            setTimeout(() => loadingScreen.classList.add('hidden'), 500);
        } catch(e) { loadingScreen.classList.add('hidden'); showToast("Erro login.", "error"); }
    } else {
        appScreen.classList.add('hidden');
        authScreen.classList.remove('hidden');
        loadingScreen.classList.add('hidden');
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const menuItems = document.querySelectorAll('.menu-item');
    const views = document.querySelectorAll('.view');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    menuItems.forEach(btn => {
        btn.addEventListener('click', () => {
            menuItems.forEach(b => b.classList.remove('active'));
            views.forEach(v => v.classList.remove('active'));
            btn.classList.add('active');
            
            const target = document.getElementById('view-' + btn.dataset.target);
            if(target) {
                target.classList.add('active');
                if(btn.dataset.target === 'dash') renderCharts();
            }
            if(sidebar) sidebar.classList.remove('open');
            if(overlay) overlay.classList.remove('visible');
        });
    });

    // Forms
    document.getElementById('form-login').addEventListener('submit', (e) => {
        e.preventDefault();
        signInWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-pass').value)
        .catch(err => { document.getElementById('auth-error').textContent = "Dados inválidos."; document.getElementById('auth-error').style.display = 'block'; });
    });

    document.getElementById('btn-show-register').addEventListener('click', () => {
        document.getElementById('form-login').classList.toggle('hidden');
        document.getElementById('form-register').classList.toggle('hidden');
    });

    document.getElementById('form-register').addEventListener('submit', (e) => {
        e.preventDefault();
        const em = document.getElementById('reg-email').value;
        const pw = document.getElementById('reg-pass').value;
        const nm = document.getElementById('reg-name').value;
        createUserWithEmailAndPassword(auth, em, pw).then(cred => {
            setDoc(doc(db, "users", cred.user.uid), { name: nm, email: em, role: 'user', createdAt: Date.now() });
            showToast("Criado com sucesso!");
        }).catch(err => alert(err.message));
    });

    document.getElementById('btn-logout').addEventListener('click', () => signOut(auth));

    // Menu Mobile
    const btnMenu = document.getElementById('btn-menu-toggle');
    if(btnMenu) {
        btnMenu.addEventListener('click', () => { sidebar.classList.toggle('open'); overlay.classList.toggle('visible'); });
        overlay.addEventListener('click', () => { sidebar.classList.remove('open'); overlay.classList.remove('visible'); });
    }

    // Transações (COM CATEGORIA)
    document.getElementById('form-trans').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const desc = document.getElementById('t-desc').value;
            const cat = document.getElementById('t-cat').value; // NOVA CAPTURA
            const val = parseFloat(document.getElementById('t-val').value);
            
            await addDoc(collection(db, "transacoes"), {
                desc, categoria: cat, valor: val,
                tipo: document.getElementById('t-tipo').value,
                data: document.getElementById('t-data').value,
                createdAt: Date.now()
            });
            gravarLog("Lançamento", `${desc} (${cat})`);
            showToast("Salvo!");
            e.target.reset(); document.getElementById('t-data').valueAsDate = new Date();
        } catch(err) { showToast("Erro ao salvar.", "error"); }
    });

    document.getElementById('form-fixo').addEventListener('submit', async (e) => {
        e.preventDefault();
        await addDoc(collection(db, "fixos"), {
            desc: document.getElementById('f-desc').value,
            valor: parseFloat(document.getElementById('f-val').value)
        });
        showToast("Fixo salvo"); e.target.reset();
    });

    document.getElementById('form-notif').addEventListener('submit', async (e) => {
        e.preventDefault();
        await addDoc(collection(db, "vencimentos"), {
            desc: document.getElementById('n-desc').value,
            dia: parseInt(document.getElementById('n-dia').value)
        });
        showToast("Alerta criado"); e.target.reset();
    });

    const sd = document.getElementById('n-dia');
    for (let i = 1; i <= 31; i++) { let o = document.createElement('option'); o.value = i; o.textContent = `Dia ${i}`; sd.appendChild(o); }
});

function initData() {
    onSnapshot(query(collection(db, "transacoes"), orderBy("data", "desc")), (s) => {
        trans = s.docs.map(d => ({ id: d.id, ...d.data() }));
        renderHome();
    });
    onSnapshot(query(collection(db, "fixos")), (s) => {
        fixos = s.docs.map(d => ({ id: d.id, ...d.data() }));
        renderHome();
    });
    onSnapshot(query(collection(db, "vencimentos")), (s) => {
        notifs = s.docs.map(d => ({ id: d.id, ...d.data() }));
        renderNotif();
    });
}

function renderHome() {
    const lf = document.getElementById('list-fixos');
    if(lf) {
        lf.innerHTML = '';
        fixos.forEach(f => {
            const el = document.createElement('div'); el.className = 'list-item';
            el.innerHTML = `<div><b>${f.desc}</b></div><div><span style="font-weight:600">${moneyFmt.format(f.valor)}</span><button onclick="window.delItem('${f.id}','fixos')" style="margin-left:10px;border:none;background:none;color:red">×</button></div>`;
            lf.appendChild(el);
        });
    }

    const list = document.getElementById('list-trans');
    if(list) {
        list.innerHTML = '';
        let e = 0, s = 0;
        trans.slice(0, 30).forEach(t => {
            if (t.tipo === 'entrada') e += t.valor; else s += t.valor;
            const el = document.createElement('div'); el.className = 'list-item';
            // EXIBINDO A CATEGORIA NA LISTA
            const catDisplay = t.categoria ? `<span class="cat-tag">${t.categoria}</span>` : '';
            
            el.innerHTML = `
                <div><div style="font-weight:600;color:var(--text)">${t.desc} ${catDisplay}</div><div style="font-size:0.8rem;color:#94a3b8">${t.data.split('-').reverse().join('/')}</div></div>
                <div style="text-align:right"><div style="font-weight:700; color:${t.tipo === 'entrada' ? 'var(--secondary)' : 'var(--danger)'}">${(t.tipo === 'entrada' ? '+' : '-') + moneyFmt.format(t.valor)}</div><button onclick="window.delItem('${t.id}','transacoes')" style="border:none;background:none;color:#cbd5e1;font-size:0.75rem">Excluir</button></div>
            `;
            list.appendChild(el);
        });
        let totalF = fixos.reduce((a,b)=>a+b.valor,0);
        if(document.getElementById('val-saldo')) document.getElementById('val-saldo').textContent = moneyFmt.format(e - s - totalF);
        if(document.getElementById('val-ent')) document.getElementById('val-ent').textContent = moneyFmt.format(e);
        if(document.getElementById('val-sai')) document.getElementById('val-sai').textContent = moneyFmt.format(s + totalF);
    }
}

function renderNotif() {
    const l = document.getElementById('list-notif');
    if(l) {
        l.innerHTML = '';
        notifs.forEach(n => l.innerHTML += `<div class="list-item"><div>Dia <b>${n.dia}</b> - ${n.desc}</div><button onclick="window.delItem('${n.id}','vencimentos')" style="color:red;border:none;background:none">×</button></div>`);
    }
}

function renderCharts() {
    const ctx = document.getElementById('chart-bar');
    if(!ctx) return;
    
    // Gráfico de Barras (Fluxo)
    let tE=0, tS=0; const map={}; for(let i=5;i>=0;i--){const d=new Date();d.setMonth(d.getMonth()-i);map[d.toISOString().slice(0,7)]={e:0,s:0};}
    trans.forEach(t=>{if(!t.data)return;const k=t.data.slice(0,7);if(t.tipo==='entrada'){tE+=t.valor;if(map[k])map[k].e+=t.valor;}else{tS+=t.valor;if(map[k])map[k].s+=t.valor;}});
    const labels=Object.keys(map).map(k=>{const p=k.split('-');return `${p[1]}/${p[0].slice(2)}`});
    const dE=Object.values(map).map(v=>v.e); const dS=Object.values(map).map(v=>v.s);
    if(chart1) chart1.destroy();
    chart1 = new Chart(ctx, {type:'bar',data:{labels,datasets:[{label:'Entradas',data:dE,backgroundColor:'#10b981',borderRadius:4},{label:'Saídas',data:dS,backgroundColor:'#ef4444',borderRadius:4}]}, options:{responsive:true,maintainAspectRatio:false,scales:{x:{grid:{display:false}},y:{beginAtZero:true}}}});
    
    // Gráfico de Pizza (AGORA POR CATEGORIA)
    const cats = {};
    trans.forEach(t => {
        if(t.tipo === 'saida') { // Analisa apenas gastos
            const c = t.categoria || 'Outros';
            cats[c] = (cats[c] || 0) + t.valor;
        }
    });
    
    const catLabels = Object.keys(cats);
    const catValues = Object.values(cats);
    // Cores para as categorias
    const colors = ['#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899', '#6366f1', '#10b981', '#64748b'];

    if(chart2) chart2.destroy();
    chart2 = new Chart(document.getElementById('chart-pie'), {
        type: 'doughnut',
        data: {
            labels: catLabels.length ? catLabels : ['Sem dados'],
            datasets: [{
                data: catValues.length ? catValues : [1],
                backgroundColor: catLabels.length ? colors : ['#e2e8f0'],
                borderWidth: 0
            }]
        },
        options: { cutout: '70%', responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { boxWidth: 10 } } } }
    });
    
    const ratio = tE > 0 ? (tS/tE)*100 : 0;
    if(document.getElementById('kpi-saude')) {
        const el = document.getElementById('kpi-saude');
        if(ratio > 100) el.innerHTML = '<span class="text-danger">CRÍTICA</span>';
        else if(ratio > 70) el.innerHTML = '<span style="color:#f59e0b">ATENÇÃO</span>';
        else el.innerHTML = '<span class="text-success">EXCELENTE</span>';
    }
    if(document.getElementById('kpi-poupanca')) document.getElementById('kpi-poupanca').textContent = Math.max(0, ((tE-tS)/tE)*100).toFixed(0) + "%";
}

function initAdmin() {
    onSnapshot(collection(db, "users"), (s) => {
        const l = document.getElementById('list-users');
        if(l) {
            l.innerHTML = '';
            s.forEach(d => {
                const u = d.data();
                l.innerHTML += `<div class="admin-row"><div><b>${u.name}</b> (${u.role})<br>${u.email}</div><div><button onclick="window.changeRole('${d.id}','${u.role}')" class="btn-small" style="background:#e0e7ff;color:#4338ca;border:none">Cargo</button></div></div>`;
            });
        }
    });
    onSnapshot(query(collection(db,"logs"), orderBy("timestamp","desc")), (s) => {
        const l = document.getElementById('list-logs');
        if(l) {
            l.innerHTML = '';
            s.docs.slice(0,30).forEach(d => {
                const log = d.data();
                l.innerHTML += `<div style="padding:10px;border-bottom:1px solid #eee"><b>${log.action}</b>: ${log.details}<br><small>${log.user}</small></div>`;
            });
        }
    });
}

window.delUser = async (id) => { if(confirm("Bloquear?")) { await deleteDoc(doc(db,"users",id)); showToast("Removido"); } }
window.changeRole = async (id, r) => { if(confirm("Mudar cargo?")) { await updateDoc(doc(db,"users",id),{role:r==='admin'?'user':'admin'}); showToast("Alterado"); } }
window.delItem = async (id, col) => { if(confirm("Excluir?")) { await deleteDoc(doc(db, col, id)); showToast("Excluído"); } }
window.exportExcel = () => { const ws = XLSX.utils.json_to_sheet(trans); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Dados"); XLSX.writeFile(wb, "Relatorio.xlsx"); }
window.testNotif = () => Notification.requestPermission().then(p => p==="granted" ? showToast("Ativo!", "success") : showToast("Permita notificações", "error"));
async function gravarLog(a, d) { if(currentUser) await addDoc(collection(db,"logs"),{user:currentUser.email,action:a,details:d,timestamp:Date.now()}); }

// Refresh Mobile
let touchStart = 0;
const contentArea = document.querySelector('.content');
if (contentArea) {
    contentArea.addEventListener('touchstart', (e) => { if (contentArea.scrollTop === 0) touchStart = e.touches[0].clientY; }, { passive: true });
    contentArea.addEventListener('touchend', (e) => {
        const touchEnd = e.changedTouches[0].clientY;
        if (touchStart > 0 && touchEnd - touchStart > 150 && contentArea.scrollTop === 0) window.location.reload();
        touchStart = 0;
    }, { passive: true });
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');