import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getFirestore, collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, setDoc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";

// --- CHAVES FIREBASE AQUI ---
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

try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
} catch (e) { console.error(e); }

const loadingScreen = document.getElementById('loading-overlay');
const authScreen = document.getElementById('auth-screen');
const appScreen = document.getElementById('app-screen');

onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            const ref = doc(db, "users", user.uid);
            let snap = await getDoc(ref);
            if (!snap.exists()) {
                await setDoc(ref, { name: user.email, email: user.email, role: 'user' });
                snap = await getDoc(ref);
            }
            currentUser = { uid: user.uid, ...snap.data() };
            document.getElementById('user-display').innerText = currentUser.name;
            
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
        } catch(e) { loadingScreen.classList.add('hidden'); }
    } else {
        appScreen.classList.add('hidden');
        authScreen.classList.remove('hidden');
        loadingScreen.classList.add('hidden');
    }
});

document.addEventListener('DOMContentLoaded', () => {
    
    // --- CORREÇÃO DO CLICK NAS ABAS ---
    const menuItems = document.querySelectorAll('.menu-item');
    const views = document.querySelectorAll('.view'); // Procura pela classe .view
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    menuItems.forEach(btn => {
        btn.addEventListener('click', () => {
            // Tira active de tudo
            menuItems.forEach(b => b.classList.remove('active'));
            views.forEach(v => v.classList.remove('active'));
            
            // Põe active no clicado
            btn.classList.add('active');
            
            // Pega o ID alvo (ex: 'home') e busca 'view-home'
            const targetId = btn.getAttribute('data-target');
            const targetView = document.getElementById('view-' + targetId);
            
            if(targetView) {
                targetView.classList.add('active'); // O CSS fará ele aparecer
                if(targetId === 'dash') renderCharts();
            }

            if(sidebar) sidebar.classList.remove('open');
            if(overlay) overlay.classList.remove('visible');
        });
    });

    // Login
    document.getElementById('form-login').addEventListener('submit', (e) => {
        e.preventDefault();
        signInWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-pass').value)
        .catch(err => alert("Erro: " + err.message));
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
        }).catch(err => alert(err.message));
    });

    document.getElementById('btn-logout').addEventListener('click', () => signOut(auth));

    // Menu Mobile
    const btnMenu = document.getElementById('btn-menu-toggle');
    if(btnMenu) {
        btnMenu.addEventListener('click', () => {
            sidebar.classList.toggle('open');
            if(overlay) overlay.classList.toggle('visible');
        });
        if(overlay) overlay.addEventListener('click', () => {
            sidebar.classList.remove('open');
            overlay.classList.remove('visible');
        });
    }

    // Forms
    document.getElementById('form-trans').addEventListener('submit', async (e) => {
        e.preventDefault();
        await addDoc(collection(db, "transacoes"), {
            desc: document.getElementById('t-desc').value,
            valor: parseFloat(document.getElementById('t-val').value),
            tipo: document.getElementById('t-tipo').value,
            data: document.getElementById('t-data').value,
            createdAt: Date.now()
        });
        gravarLog("Lançamento", document.getElementById('t-desc').value);
        e.target.reset(); document.getElementById('t-data').valueAsDate = new Date();
    });

    document.getElementById('form-fixo').addEventListener('submit', async (e) => {
        e.preventDefault();
        await addDoc(collection(db, "fixos"), {
            desc: document.getElementById('f-desc').value,
            valor: parseFloat(document.getElementById('f-val').value)
        });
        e.target.reset();
    });

    document.getElementById('form-notif').addEventListener('submit', async (e) => {
        e.preventDefault();
        await addDoc(collection(db, "vencimentos"), {
            desc: document.getElementById('n-desc').value,
            dia: parseInt(document.getElementById('n-dia').value)
        });
        e.target.reset();
    });

    const sd = document.getElementById('n-dia');
    for (let i = 1; i <= 31; i++) { let o = document.createElement('option'); o.value = i; o.innerText = `Dia ${i}`; sd.appendChild(o); }
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
        let totalF = 0;
        fixos.forEach(f => {
            totalF += f.valor;
            lf.innerHTML += `<div class="list-item"><span>${f.desc}</span><span>R$ ${f.valor} <button onclick="window.delItem('${f.id}','fixos')" style="color:red;border:none;background:none">×</button></span></div>`;
        });
    }

    const list = document.getElementById('list-trans');
    if(list) {
        list.innerHTML = '';
        let e = 0, s = 0;
        trans.slice(0, 30).forEach(t => {
            if (t.tipo === 'entrada') e += t.valor; else s += t.valor;
            list.innerHTML += `<div class="list-item"><div><b>${t.desc}</b><br><small>${t.data}</small></div><div><b style="color:${t.tipo==='entrada'?'#10b981':'#ef4444'}">R$ ${t.valor}</b><button onclick="window.delItem('${t.id}','transacoes')" style="margin-left:10px;border:none;background:none">🗑️</button></div></div>`;
        });
        let totalF = fixos.reduce((a,b)=>a+b.valor,0);
        document.getElementById('val-saldo').innerText = `R$ ${(e - s - totalF).toFixed(2)}`;
        document.getElementById('val-ent').innerText = `R$ ${e.toFixed(2)}`;
        document.getElementById('val-sai').innerText = `R$ ${(s + totalF).toFixed(2)}`;
    }
}

function renderCharts() {
    const ctx = document.getElementById('chart-bar');
    if(!ctx) return;
    let tE=0, tS=0; const map={}; for(let i=5;i>=0;i--){const d=new Date();d.setMonth(d.getMonth()-i);map[d.toISOString().slice(0,7)]={e:0,s:0};}
    trans.forEach(t=>{if(!t.data)return;const k=t.data.slice(0,7);if(t.tipo==='entrada'){tE+=t.valor;if(map[k])map[k].e+=t.valor;}else{tS+=t.valor;if(map[k])map[k].s+=t.valor;}});
    const labels=Object.keys(map); const dE=Object.values(map).map(v=>v.e); const dS=Object.values(map).map(v=>v.s);
    if(chart1) chart1.destroy(); chart1 = new Chart(ctx, {type:'bar',data:{labels,datasets:[{label:'Entrada',data:dE,backgroundColor:'#10b981'},{label:'Saída',data:dS,backgroundColor:'#ef4444'}]}});
    if(chart2) chart2.destroy(); chart2 = new Chart(document.getElementById('chart-pie'), {type:'doughnut',data:{labels:['Ganho','Gasto'],datasets:[{data:[tE,tS],backgroundColor:['#10b981','#ef4444']}]}});
}

function renderNotif() {
    const l = document.getElementById('list-notif');
    if(l) {
        l.innerHTML = '';
        notifs.forEach(n => l.innerHTML += `<div class="list-item"><div>Dia ${n.dia} - ${n.desc}</div><button onclick="window.delItem('${n.id}','vencimentos')" style="color:red;border:none;background:none">×</button></div>`);
    }
}

function initAdmin() {
    onSnapshot(collection(db, "users"), (s) => {
        const l = document.getElementById('list-users');
        if(l) {
            l.innerHTML = '';
            s.forEach(d => {
                const u = d.data();
                l.innerHTML += `<div class="admin-row"><div><b>${u.name}</b> (${u.role})<br>${u.email}</div><div><button onclick="window.changeRole('${d.id}','${u.role}')" class="btn-small" style="background:#4f46e5;color:white;border:none">Cargo</button></div></div>`;
            });
        }
    });
    onSnapshot(collection(db, "logs"), (s) => {
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

// Funções Globais para o HTML acessar
window.delItem = async (id, col) => { if(confirm("Excluir?")) await deleteDoc(doc(db, col, id)); }
window.changeRole = async (uid, r) => { if(confirm("Mudar cargo?")) await updateDoc(doc(db,"users",uid),{role:r==='admin'?'user':'admin'}); }
async function gravarLog(a, d) { if(currentUser) await addDoc(collection(db,"logs"),{user:currentUser.email,action:a,details:d,timestamp:Date.now()}); }

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');