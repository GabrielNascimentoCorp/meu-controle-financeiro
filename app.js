import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getFirestore, collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, setDoc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";

// --- COLE SUAS CHAVES AQUI ---
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

// Formatador de Moeda Profissional (Brasil)
const moneyFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
} catch (e) { showToast("Erro de conexão com o servidor.", "error"); }

const loadingScreen = document.getElementById('loading-overlay');
const authScreen = document.getElementById('auth-screen');
const appScreen = document.getElementById('app-screen');

// --- SISTEMA DE TOASTS (NOTIFICAÇÕES FLUTUANTES) ---
function showToast(msg, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = msg;
    container.appendChild(toast);
    
    // Animação de entrada
    requestAnimationFrame(() => toast.classList.add('show'));
    
    // Remove após 3 segundos
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// --- AUTH ---
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
        } catch(e) { 
            console.error(e);
            loadingScreen.classList.add('hidden');
            showToast("Erro ao carregar perfil.", "error");
        }
    } else {
        appScreen.classList.add('hidden');
        authScreen.classList.remove('hidden');
        loadingScreen.classList.add('hidden');
    }
});

document.addEventListener('DOMContentLoaded', () => {
    
    // NAVEGAÇÃO
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

    // LOGIN & REGISTRO
    const authError = document.getElementById('auth-error');
    
    document.getElementById('form-login').addEventListener('submit', (e) => {
        e.preventDefault();
        authError.style.display = 'none';
        signInWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-pass').value)
        .catch(err => {
            authError.textContent = "Acesso negado: Verifique e-mail e senha.";
            authError.style.display = 'block';
        });
    });

    document.getElementById('btn-show-register').addEventListener('click', () => {
        document.getElementById('form-login').classList.toggle('hidden');
        document.getElementById('form-register').classList.toggle('hidden');
        authError.style.display = 'none';
    });

    document.getElementById('form-register').addEventListener('submit', (e) => {
        e.preventDefault();
        const em = document.getElementById('reg-email').value;
        const pw = document.getElementById('reg-pass').value;
        const nm = document.getElementById('reg-name').value;
        
        createUserWithEmailAndPassword(auth, em, pw).then(cred => {
            setDoc(doc(db, "users", cred.user.uid), { name: nm, email: em, role: 'user', createdAt: Date.now() });
            showToast("Conta criada com sucesso!");
        }).catch(err => {
            authError.textContent = "Erro ao criar conta: " + err.message;
            authError.style.display = 'block';
        });
    });

    document.getElementById('btn-logout').addEventListener('click', () => signOut(auth));

    // MOBILE MENU
    const btnMenu = document.getElementById('btn-menu-toggle');
    if(btnMenu) {
        btnMenu.addEventListener('click', () => {
            sidebar.classList.toggle('open');
            overlay.classList.toggle('visible');
        });
        overlay.addEventListener('click', () => {
            sidebar.classList.remove('open');
            overlay.classList.remove('visible');
        });
    }

    // FORMS (COM FEEDBACK TOAST)
    document.getElementById('form-trans').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const desc = document.getElementById('t-desc').value;
            const val = parseFloat(document.getElementById('t-val').value);
            await addDoc(collection(db, "transacoes"), {
                desc, valor: val,
                tipo: document.getElementById('t-tipo').value,
                data: document.getElementById('t-data').value,
                createdAt: Date.now()
            });
            gravarLog("Lançamento", `${desc} (${moneyFmt.format(val)})`);
            showToast("Lançamento salvo!");
            e.target.reset(); document.getElementById('t-data').valueAsDate = new Date();
        } catch(err) { showToast("Erro ao salvar.", "error"); }
    });

    document.getElementById('form-fixo').addEventListener('submit', async (e) => {
        e.preventDefault();
        await addDoc(collection(db, "fixos"), {
            desc: document.getElementById('f-desc').value,
            valor: parseFloat(document.getElementById('f-val').value)
        });
        showToast("Custo fixo adicionado");
        e.target.reset();
    });

    document.getElementById('form-notif').addEventListener('submit', async (e) => {
        e.preventDefault();
        await addDoc(collection(db, "vencimentos"), {
            desc: document.getElementById('n-desc').value,
            dia: parseInt(document.getElementById('n-dia').value)
        });
        showToast("Alerta criado");
        e.target.reset();
    });

    const sd = document.getElementById('n-dia');
    for (let i = 1; i <= 31; i++) { 
        let o = document.createElement('option'); o.value = i; o.textContent = `Dia ${i}`; sd.appendChild(o); 
    }
});

// --- FUNÇÕES DE DADOS (DOM SEGURO) ---
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
    // FIXOS
    const lf = document.getElementById('list-fixos');
    if(lf) {
        lf.innerHTML = '';
        let totalF = 0;
        fixos.forEach(f => {
            totalF += f.valor;
            const el = document.createElement('div');
            el.className = 'list-item';
            
            // Criação segura de elementos (sem innerHTML perigoso)
            const txt = document.createElement('div');
            txt.innerHTML = `<b>${f.desc}</b>`;
            
            const right = document.createElement('div');
            right.innerHTML = `<span style="font-weight:600">${moneyFmt.format(f.valor)}</span>`;
            
            const btnDel = document.createElement('button');
            btnDel.textContent = '×';
            btnDel.style.cssText = "margin-left:10px; border:none; background:none; color:red; cursor:pointer; font-size:1.2rem";
            btnDel.onclick = () => deleteItem(f.id, 'fixos');
            
            right.appendChild(btnDel);
            el.append(txt, right);
            lf.appendChild(el);
        });
    }

    // TRANSAÇÕES
    const list = document.getElementById('list-trans');
    if(list) {
        list.innerHTML = '';
        let e = 0, s = 0;
        trans.slice(0, 30).forEach(t => {
            if (t.tipo === 'entrada') e += t.valor; else s += t.valor;
            
            const el = document.createElement('div');
            el.className = 'list-item';
            
            const info = document.createElement('div');
            info.innerHTML = `<div style="font-weight:600;color:var(--text)">${t.desc}</div><div style="font-size:0.8rem;color:#94a3b8">${t.data.split('-').reverse().join('/')}</div>`;
            
            const valDiv = document.createElement('div');
            valDiv.style.textAlign = 'right';
            
            const valTxt = document.createElement('div');
            valTxt.style.fontWeight = '700';
            valTxt.style.color = t.tipo === 'entrada' ? 'var(--secondary)' : 'var(--danger)';
            valTxt.textContent = (t.tipo === 'entrada' ? '+' : '-') + moneyFmt.format(t.valor);
            
            const btnDel = document.createElement('button');
            btnDel.textContent = 'Excluir';
            btnDel.style.cssText = "border:none; background:none; color:#cbd5e1; font-size:0.75rem; cursor:pointer; margin-top:2px";
            btnDel.onclick = () => deleteItem(t.id, 'transacoes');
            
            valDiv.append(valTxt, btnDel);
            el.append(info, valDiv);
            list.appendChild(el);
        });

        // TOTAIS
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
        notifs.forEach(n => {
            const el = document.createElement('div');
            el.className = 'list-item';
            el.innerHTML = `<div>Dia <b>${n.dia}</b> - ${n.desc}</div>`;
            const btn = document.createElement('button');
            btn.textContent = '×';
            btn.style.cssText = "color:red;border:none;background:none;font-size:1.2rem;cursor:pointer";
            btn.onclick = () => deleteItem(n.id, 'vencimentos');
            el.appendChild(btn);
            l.appendChild(el);
        });
    }
}

// GRÁFICOS
function renderCharts() {
    const ctx = document.getElementById('chart-bar');
    if(!ctx) return;
    let tE=0, tS=0; const map={}; for(let i=5;i>=0;i--){const d=new Date();d.setMonth(d.getMonth()-i);map[d.toISOString().slice(0,7)]={e:0,s:0};}
    trans.forEach(t=>{if(!t.data)return;const k=t.data.slice(0,7);if(t.tipo==='entrada'){tE+=t.valor;if(map[k])map[k].e+=t.valor;}else{tS+=t.valor;if(map[k])map[k].s+=t.valor;}});
    const labels=Object.keys(map).map(k=>{const p=k.split('-');return `${p[1]}/${p[0].slice(2)}`});
    const dE=Object.values(map).map(v=>v.e); const dS=Object.values(map).map(v=>v.s);
    
    if(chart1) chart1.destroy();
    chart1 = new Chart(ctx, {type:'bar',data:{labels,datasets:[{label:'Entradas',data:dE,backgroundColor:'#10b981',borderRadius:4},{label:'Saídas',data:dS,backgroundColor:'#ef4444',borderRadius:4}]}, options:{responsive:true,maintainAspectRatio:false,scales:{x:{grid:{display:false}},y:{beginAtZero:true}}}});
    
    if(chart2) chart2.destroy();
    chart2 = new Chart(document.getElementById('chart-pie'), {type:'doughnut',data:{labels:['Ganho','Gasto'],datasets:[{data:[tE,tS],backgroundColor:['#10b981','#ef4444'],borderWidth:0}]},options:{cutout:'75%',responsive:true,maintainAspectRatio:false}});
    
    const ratio = tE > 0 ? (tS/tE)*100 : 0;
    if(document.getElementById('kpi-saude')) {
        const el = document.getElementById('kpi-saude');
        if(ratio > 100) { el.innerHTML = '<span class="text-danger">CRÍTICA</span>'; }
        else if(ratio > 70) { el.innerHTML = '<span style="color:#f59e0b">ATENÇÃO</span>'; }
        else { el.innerHTML = '<span class="text-success">EXCELENTE</span>'; }
    }
    if(document.getElementById('kpi-poupanca')) {
        document.getElementById('kpi-poupanca').textContent = Math.max(0, ((tE-tS)/tE)*100).toFixed(0) + "%";
    }
}

// ADMIN (DOM SEGURO)
function initAdmin() {
    onSnapshot(collection(db, "users"), (s) => {
        const l = document.getElementById('list-users');
        if(l) {
            l.innerHTML = '';
            s.forEach(d => {
                const u = d.data();
                const isMe = u.email === currentUser.email;
                const el = document.createElement('div');
                el.className = 'admin-row';
                el.innerHTML = `<div><div style="font-weight:700">${u.name}</div><div style="font-size:0.8rem;color:#64748b">${u.email} <span class="tag ${u.role}">${u.role}</span></div></div>`;
                
                if(!isMe) {
                    const acts = document.createElement('div');
                    const b1 = document.createElement('button');
                    b1.textContent = 'Cargo';
                    b1.className = 'btn btn-small';
                    b1.style.cssText = "background:#e0e7ff; color:#4338ca; margin-right:5px; width:auto";
                    b1.onclick = () => window.changeRole(d.id, u.role);
                    
                    const b2 = document.createElement('button');
                    b2.textContent = 'Remover';
                    b2.className = 'btn btn-small';
                    b2.style.cssText = "background:#fee2e2; color:#b91c1c; width:auto";
                    b2.onclick = () => window.delUser(d.id);
                    
                    acts.append(b1, b2);
                    el.appendChild(acts);
                }
                l.appendChild(el);
            });
        }
    });
    
    onSnapshot(query(collection(db,"logs"), orderBy("timestamp","desc")), (s) => {
        const l = document.getElementById('list-logs');
        if(l) {
            l.innerHTML = '';
            s.docs.slice(0,50).forEach(d => {
                const log = d.data();
                const el = document.createElement('div');
                el.style.cssText = "padding:12px 0; border-bottom:1px solid #f1f5f9; font-size:0.85rem";
                el.innerHTML = `<div style="display:flex;justify-content:space-between"><span style="color:var(--primary);font-weight:600">${log.action}</span><span style="color:#cbd5e1;font-size:0.75rem">${new Date(log.timestamp).toLocaleTimeString()}</span></div><div style="margin-top:2px">${log.details}</div><div style="font-size:0.75rem;color:#94a3b8;margin-top:2px">User: ${log.user}</div>`;
                l.appendChild(el);
            });
        }
    });
}

// UTILITÁRIOS GLOBAIS
window.delUser = async (id) => { if(confirm("Bloquear acesso deste usuário?")) { await deleteDoc(doc(db,"users",id)); showToast("Usuário removido"); gravarLog("Admin", `Removeu usuário ${id}`); } }
window.changeRole = async (id, r) => { if(confirm("Alterar nível de acesso?")) { await updateDoc(doc(db,"users",id),{role:r==='admin'?'user':'admin'}); showToast("Permissão alterada"); gravarLog("Admin", `Alterou cargo de ${id}`); } }

async function deleteItem(id, col) { if(confirm("Deseja realmente excluir?")) { await deleteDoc(doc(db, col, id)); showToast("Item excluído"); gravarLog("Exclusão", `Apagou item em ${col}`); } }
async function gravarLog(a, d) { if(currentUser) await addDoc(collection(db,"logs"),{user:currentUser.email,action:a,details:d,timestamp:Date.now()}); }

window.exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(trans);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Transacoes");
    XLSX.writeFile(wb, "Relatorio_Financas.xlsx");
    showToast("Download iniciado!");
}

window.testNotif = () => Notification.requestPermission().then(p => p==="granted" ? showToast("Permissão concedida!", "success") : showToast("Permissão necessária.", "error"));

// Puxar para Atualizar (Mobile)
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