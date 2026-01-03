// --- IMPORTAÇÕES FIREBASE ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getFirestore, collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, setDoc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";

// --- CONFIGURAÇÃO (COLE SUAS CHAVES AQUI) ---
const firebaseConfig = {
    apiKey: "AIzaSyC2NH5D5-dBk057use7wRQtF25vcBDw7Lo",
    authDomain: "financas-2abdf.firebaseapp.com",
    projectId: "financas-2abdf",
    storageBucket: "financas-2abdf.firebasestorage.app",
    messagingSenderId: "720802610676",
    appId: "1:720802610676:web:e1aea9c52df5b67ff24da1",
    measurementId: "G-8F06PFR2N4"
};

// --- INICIALIZAÇÃO ---
let db, auth, currentUser;
let trans = [], notifs = [];
let chart1, chart2;

try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
} catch (e) {
    alert("Erro crítico: Verifique sua internet ou config do Firebase.");
}

// --- ELEMENTOS DO DOM (CACHE) ---
const loadingScreen = document.getElementById('loading-overlay');
const authScreen = document.getElementById('auth-screen');
const appScreen = document.getElementById('app-screen');

// --- SISTEMA DE LOGIN/AUTH ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // Usuário logado
        const ref = doc(db, "users", user.uid);
        let snap = await getDoc(ref);

        if (!snap.exists()) {
            await setDoc(ref, { name: user.email, email: user.email, role: 'user' });
            snap = await getDoc(ref);
        }

        currentUser = { uid: user.uid, ...snap.data() };
        
        // Atualiza Interface
        document.getElementById('user-display').innerText = currentUser.name;
        
        if (currentUser.role === 'admin') {
            document.querySelector('.admin-only').classList.remove('hidden');
            initAdmin();
        } else {
            document.querySelector('.admin-only').classList.add('hidden');
        }

        authScreen.classList.add('hidden');
        appScreen.classList.remove('hidden');
        initData();
        loadingScreen.classList.add('hidden');

    } else {
        // Não logado
        appScreen.classList.add('hidden');
        authScreen.classList.remove('hidden');
        loadingScreen.classList.add('hidden');
    }
});

// --- EVENTOS DE CLIQUE (Substitui onclick) ---
document.addEventListener('DOMContentLoaded', () => {
    
    // Login & Registro
    document.getElementById('form-login').addEventListener('submit', (e) => {
        e.preventDefault();
        const em = document.getElementById('login-email').value;
        const pw = document.getElementById('login-pass').value;
        signInWithEmailAndPassword(auth, em, pw).catch(err => alert("Erro: " + err.message));
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
    document.getElementById('btn-menu-toggle').addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('open');
    });

    // Navegação Sidebar
    document.querySelectorAll('.menu-item').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.menu-item').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
            const target = btn.getAttribute('data-target');
            document.getElementById('view-' + target).classList.remove('hidden');
            
            // Renderiza gráfico se for dash
            if(target === 'dash') renderCharts();
            
            // Fecha menu mobile
            document.getElementById('sidebar').classList.remove('open');
        });
    });

    // Formulários de Dados
    document.getElementById('form-trans').addEventListener('submit', async (e) => {
        e.preventDefault();
        await addDoc(collection(db, "transacoes"), {
            desc: document.getElementById('t-desc').value,
            valor: parseFloat(document.getElementById('t-val').value),
            tipo: document.getElementById('t-tipo').value,
            data: document.getElementById('t-data').value,
            createdAt: Date.now()
        });
        gravarLog("Novo Lançamento", document.getElementById('t-desc').value);
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

    // Select Dias
    const sd = document.getElementById('n-dia');
    for (let i = 1; i <= 31; i++) {
        let o = document.createElement('option'); o.value = i; o.innerText = `Dia ${i}`; sd.appendChild(o);
    }
});

// --- FUNÇÕES DE DADOS ---
function initData() {
    onSnapshot(query(collection(db, "transacoes"), orderBy("data", "desc")), (s) => {
        trans = s.docs.map(d => ({ id: d.id, ...d.data() }));
        renderHome();
    });
    onSnapshot(query(collection(db, "vencimentos")), (s) => {
        notifs = s.docs.map(d => ({ id: d.id, ...d.data() }));
        renderNotif();
    });
}

function renderHome() {
    const list = document.getElementById('list-trans');
    list.innerHTML = '';
    let e = 0, s = 0;

    trans.slice(0, 30).forEach(t => {
        if (t.tipo === 'entrada') e += t.valor; else s += t.valor;
        
        const el = document.createElement('div');
        el.className = 'list-item';
        el.innerHTML = `
            <div><b>${t.desc}</b><br><small>${t.data}</small></div>
            <div>
                <b style="color:${t.tipo === 'entrada' ? '#10b981' : '#ef4444'}">R$ ${t.valor.toFixed(2)}</b>
                <button class="btn-del" style="margin-left:10px; border:none; background:none; cursor:pointer">🗑️</button>
            </div>
        `;
        // Evento de deletar direto no elemento
        el.querySelector('.btn-del').addEventListener('click', () => deleteItem(t.id, 'transacoes'));
        list.appendChild(el);
    });

    document.getElementById('val-saldo').innerText = `R$ ${(e - s).toFixed(2)}`;
    document.getElementById('val-ent').innerText = `R$ ${e.toFixed(2)}`;
    document.getElementById('val-sai').innerText = `R$ ${s.toFixed(2)}`;
}

function renderCharts() {
    if(!document.getElementById('chart-bar')) return;
    
    let tE=0, tS=0;
    const map={}; 
    for(let i=5;i>=0;i--){const d=new Date();d.setMonth(d.getMonth()-i);map[d.toISOString().slice(0,7)]={e:0,s:0};}

    trans.forEach(t=>{
        if(!t.data)return;
        const k=t.data.slice(0,7);
        if(t.tipo==='entrada'){tE+=t.valor;if(map[k])map[k].e+=t.valor;}
        else{tS+=t.valor;if(map[k])map[k].s+=t.valor;}
    });

    const labels=Object.keys(map);
    const dE=Object.values(map).map(v=>v.e);
    const dS=Object.values(map).map(v=>v.s);

    if(chart1) chart1.destroy();
    chart1 = new Chart(document.getElementById('chart-bar'), {
        type: 'bar',
        data: { labels, datasets: [{label:'Entradas', data:dE, backgroundColor:'#10b981'}, {label:'Saídas', data:dS, backgroundColor:'#ef4444'}] }
    });

    if(chart2) chart2.destroy();
    chart2 = new Chart(document.getElementById('chart-pie'), {
        type: 'doughnut',
        data: { labels: ['Ganho', 'Gasto'], datasets: [{data: [tE, tS], backgroundColor: ['#10b981', '#ef4444']}] }
    });
}

function renderNotif() {
    const list = document.getElementById('list-notif');
    list.innerHTML = '';
    notifs.forEach(n => {
        const el = document.createElement('div');
        el.className = 'list-item';
        el.innerHTML = `<div>Dia ${n.dia} - ${n.desc}</div><button style="border:none;background:none;color:red">X</button>`;
        el.querySelector('button').addEventListener('click', () => deleteItem(n.id, 'vencimentos'));
        list.appendChild(el);
    });
}

// --- ADMIN ---
function initAdmin() {
    onSnapshot(collection(db, "users"), (snap) => {
        const list = document.getElementById('list-users');
        list.innerHTML = '';
        snap.forEach(docSnap => {
            const u = docSnap.data();
            const el = document.createElement('div');
            el.className = 'admin-row';
            el.innerHTML = `
                <div><b>${u.name}</b> (${u.role})<br><small>${u.email}</small></div>
                <div>
                    <button class="btn-role btn btn-small btn-primary">Cargo</button>
                    <button class="btn-kill btn btn-small" style="background:#ef4444; color:white">X</button>
                </div>
            `;
            
            // Eventos Admin
            el.querySelector('.btn-role').addEventListener('click', async () => {
                if(confirm("Mudar cargo?")) await updateDoc(doc(db,"users",docSnap.id), {role: u.role==='admin'?'user':'admin'});
            });
            el.querySelector('.btn-kill').addEventListener('click', async () => {
                if(confirm("Remover usuário?")) await deleteDoc(doc(db,"users",docSnap.id));
            });
            
            list.appendChild(el);
        });
    });

    onSnapshot(collection(db, "logs"), (snap) => {
        const list = document.getElementById('list-logs');
        list.innerHTML = '';
        snap.forEach(d => {
            const l = d.data();
            list.innerHTML += `<div style="padding:5px; border-bottom:1px solid #eee"><small>${l.user}</small><br><b>${l.action}</b>: ${l.details}</div>`;
        });
    });
}

// --- UTILITÁRIOS ---
async function deleteItem(id, col) {
    if(confirm("Excluir?")) await deleteDoc(doc(db, col, id));
}

async function gravarLog(acao, detalhe) {
    if(currentUser) await addDoc(collection(db, "logs"), {
        user: currentUser.email, action: acao, details: detalhe, timestamp: Date.now()
    });
}

// Service Worker Registration
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');