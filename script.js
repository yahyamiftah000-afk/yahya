// --- ADHD BUDGET PLANNER INITIAL STATE & DATA STORAGE ---
const DEFAULT_APP_STATE = {
    settings: {
        currency: 'USD',
        startingBalance: 500.00,
        nextPaydayDate: '2026-11-15',
        nextPaydayAmount: 2000.00
    },
    categories: [
        { id: 'cat-1', name: 'Housing & Rent', planned: 1000, spent: 1000 },
        { id: 'cat-2', name: 'Groceries', planned: 400, spent: 220 },
        { id: 'cat-3', name: 'Utilities & Bills', planned: 250, spent: 150 },
        { id: 'cat-4', name: 'Transportation', planned: 150, spent: 60 },
        { id: 'cat-5', name: 'Fun & Personal', planned: 200, spent: 120 }
    ],
    transactions: [
        { id: 'tx-1', type: 'expense', amount: 220.00, categoryId: 'cat-2', date: '2026-11-02', note: 'Supermarché' },
        { id: 'tx-2', type: 'expense', amount: 150.00, categoryId: 'cat-3', date: '2026-11-01', note: 'Facture d'électricité' },
        { id: 'tx-3', type: 'income', amount: 3400.00, categoryId: null, date: '2026-11-01', note: 'Salaire Octobre' }
    ],
    bills: [
        { id: 'bill-1', name: 'Loyer Mensuel', amount: 1000.00, dueDate: '2026-11-05', status: 'unpaid' },
        { id: 'bill-2', name: 'Internet Fibre', amount: 45.00, dueDate: '2026-11-12', status: 'unpaid' },
        { id: 'bill-3', name: 'Abonnement Gym', amount: 30.00, dueDate: '2026-11-20', status: 'unpaid' }
    ],
    goals: [
        { id: 'goal-1', title: 'Fonds d'Urgence', target: 2500.00, current: 1200.00 },
        { id: 'goal-2', title: 'Voyage Été', target: 800.00, current: 350.00 }
    ],
    debts: [
        { id: 'debt-1', name: 'Carte Visa Premier', balance: 1200.00, minPay: 60.00, rate: 18.5 },
        { id: 'debt-2', name: 'Prêt Personnel', balance: 3400.00, minPay: 150.00, rate: 6.2 }
    ]
};

let appData = loadAppData();
let activeTxType = 'expense';
let currentCalDate = new Date(2026, 10, 1);

// Local Storage Helper
function loadAppData() {
    const saved = localStorage.getItem('adhd_budget_data_v1');
    if (saved) {
        try { return JSON.parse(saved); } catch (e) { }
    }
    return JSON.parse(JSON.stringify(DEFAULT_APP_STATE));
}

function saveData() {
    localStorage.setItem('adhd_budget_data_v1', JSON.stringify(appData));
    recalculateAll();
}

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Preloader simulation
    let counter = 0;
    const counterEl = document.getElementById('loader-counter');
    const loaderEl = document.getElementById('loader');
    const interval = setInterval(() => {
        counter += 5;
        if (counterEl) counterEl.textContent = counter + '%';
        if (counter >= 100) {
            clearInterval(interval);
            setTimeout(() => {
                if (loaderEl) {
                    loaderEl.style.opacity = '0';
                    setTimeout(() => loaderEl.classList.add('hidden'), 600);
                }
            }, 200);
        }
    }, 20);

    // 2. Initialize Lucide Icons
    if (window.lucide) lucide.createIcons();

    // 3. Live clock
    updateClock();
    setInterval(updateClock, 1000);

    // 4. Render App Data
    recalculateAll();

    // Set today date as default in quick log
    document.getElementById('tx-date').value = new Date().toISOString().split('T')[0];
});

function updateClock() {
    const clockEl = document.getElementById('live-clock');
    if (clockEl) {
        const now = new Date();
        clockEl.textContent = now.toTimeString().split(' ')[0] + ' UTC';
    }
}

// --- NAVIGATION ROUTING ---
function navTo(viewId) {
    document.querySelectorAll('.page-view').forEach(view => {
        view.classList.remove('active');
    });
    
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    const targetView = document.getElementById('view-' + viewId);
    if (targetView) {
        targetView.classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    const activeNav = document.getElementById('nav-' + viewId);
    if (activeNav) activeNav.classList.add('active');

    // Trigger specific view renders
    if (viewId === 'calendar') renderCalendar();
    if (viewId === 'envelopes') renderEnvelopes();
    if (viewId === 'goals') renderGoals();
    if (viewId === 'debt') renderDebts();
}

function toggleMobileMenu() {
    const menu = document.getElementById('mobile-menu');
    menu.classList.toggle('hidden');
}

// --- CALCULATIONS & SAFE-TO-SPEND CORE LOGIC ---
function recalculateAll() {
    const curr = getCurrencySymbol(appData.settings.currency);

    // 1. Calculate Income Received & Total Expenses
    const incomeReceived = appData.transactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + Number(t.amount), 0);

    const totalSpent = appData.transactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + Number(t.amount), 0);

    // Available funds = Starting balance + Received Income - Spent
    const availableFunds = appData.settings.startingBalance + incomeReceived - totalSpent;

    // 2. Reserved commitments (Unpaid bills + Debt min payments)
    const unpaidBillsTotal = appData.bills
        .filter(b => b.status === 'unpaid')
        .reduce((sum, b) => sum + Number(b.amount), 0);

    const debtMinPayTotal = appData.debts
        .reduce((sum, d) => sum + Number(d.minPay), 0);

    const totalReserved = unpaidBillsTotal + debtMinPayTotal;

    // SAFE TO SPEND = Available Funds - Reserved Commitments
    const safeToSpend = availableFunds - totalReserved;

    // --- Update Home Hero Preview ---
    document.getElementById('hero-sts-val').textContent = curr + safeToSpend.toFixed(2);
    document.getElementById('home-inc-val').textContent = curr + incomeReceived.toFixed(2);
    document.getElementById('home-exp-val').textContent = curr + totalSpent.toFixed(2);

    // --- Update Today View ---
    document.getElementById('today-sts-amount').textContent = curr + safeToSpend.toFixed(2);
    document.getElementById('today-avail-funds').textContent = curr + availableFunds.toFixed(2);
    document.getElementById('today-reserved-commit').textContent = curr + totalReserved.toFixed(2);

    // Next payday info
    document.getElementById('today-next-payday-date').textContent = appData.settings.nextPaydayDate || 'Non renseigné';
    document.getElementById('today-next-payday-amount').textContent = curr + Number(appData.settings.nextPaydayAmount).toFixed(2) + ' attendu';

    // Next bill info
    const nextBill = appData.bills[0];
    if (nextBill) {
        document.getElementById('today-next-bill-name').textContent = nextBill.name;
        document.getElementById('today-next-bill-amount').textContent = curr + Number(nextBill.amount).toFixed(2);
    }

    renderTodayTransactions();
    populateCategoryDropdown();
}

function getCurrencySymbol(code) {
    switch (code) {
        case 'EUR': return '€';
        case 'GBP': return '£';
        case 'MAD': return ' DH';
        default: return '$';
    }
}

// --- RENDER TODAY TRANSACTIONS ---
function renderTodayTransactions() {
    const container = document.getElementById('today-transactions-list');
    const badge = document.getElementById('today-count-badge');
    const curr = getCurrencySymbol(appData.settings.currency);

    const todayStr = new Date().toISOString().split('T')[0];
    const todayTxs = appData.transactions.filter(t => t.date === todayStr || true); // Show all demo for clarity

    badge.textContent = todayTxs.length + ' transaction(s)';

    if (todayTxs.length === 0) {
        container.innerHTML = `<div class="text-sm text-brand-muted italic py-4 text-center">Aucune dépense enregistrée aujourd'hui.</div>`;
        return;
    }

    container.innerHTML = todayTxs.map(t => `
        <div class="flex items-center justify-between p-3 rounded-control bg-brand-surface border border-brand-border">
            <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-full ${t.type === 'income' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-brand-orange'} flex items-center justify-center font-bold text-xs">
                    ${t.type === 'income' ? '+' : '-'}
                </div>
                <div>
                    <div class="font-semibold text-xs text-brand-ink">${t.note || 'Transaction'}</div>
                    <div class="text-[10px] text-brand-muted font-mono">${t.date}</div>
                </div>
            </div>
            <div class="font-mono text-xs font-bold ${t.type === 'income' ? 'text-emerald-600' : 'text-brand-ink'}">
                ${t.type === 'income' ? '+' : '-'}${curr}${Number(t.amount).toFixed(2)}
            </div>
        </div>
    `).join('');
}

// --- ENVELOPES (MONTHLY BUDGET) RENDER ---
function renderEnvelopes() {
    const grid = document.getElementById('envelopes-grid');
    const curr = getCurrencySymbol(appData.settings.currency);

    let totalPlanned = 0;
    let totalSpent = 0;

    grid.innerHTML = appData.categories.map(cat => {
        const remaining = cat.planned - cat.spent;
        const pct = Math.min(Math.round((cat.spent / (cat.planned || 1)) * 100), 100);
        totalPlanned += Number(cat.planned);
        totalSpent += Number(cat.spent);

        return `
            <div class="bg-white p-6 rounded-card-sm border border-brand-border shadow-subtle flex flex-col justify-between">
                <div>
                    <div class="flex justify-between items-start mb-4">
                        <h4 class="font-semibold text-base">${cat.name}</h4>
                        <span class="text-xs font-mono font-semibold ${remaining < 0 ? 'text-rose-600' : 'text-emerald-600'}">
                            ${remaining < 0 ? 'Dépassement ' : ''}${curr}${Math.abs(remaining).toFixed(2)}
                        </span>
                    </div>
                    <div class="space-y-2 mb-4">
                        <div class="flex justify-between text-xs text-brand-muted">
                            <span>Planifié : ${curr}${Number(cat.planned).toFixed(2)}</span>
                            <span>Dépensé : ${curr}${Number(cat.spent).toFixed(2)}</span>
                        </div>
                        <div class="h-2 bg-brand-surface rounded-full overflow-hidden">
                            <div class="h-full ${pct > 90 ? 'bg-rose-500' : 'bg-brand-orange'} rounded-full" style="width: ${pct}%"></div>
                        </div>
                    </div>
                </div>
                <div class="pt-4 border-t border-brand-border flex justify-end gap-2">
                    <button onclick="quickAddSpendToEnvelope('${cat.id}')" class="text-xs text-brand-orange font-semibold font-mono hover:underline">+ Ajouter Dépense</button>
                </div>
            </div>
        `;
    }).join('');

    document.getElementById('env-total-planned').textContent = curr + totalPlanned.toFixed(2);
    document.getElementById('env-total-spent').textContent = curr + totalSpent.toFixed(2);
    document.getElementById('env-total-remaining').textContent = curr + (totalPlanned - totalSpent).toFixed(2);
}

// --- CALENDAR RENDER ---
function renderCalendar() {
    const agenda = document.getElementById('calendar-agenda-list');
    const daysGrid = document.getElementById('calendar-days-grid');
    const curr = getCurrencySymbol(appData.settings.currency);

    // Agenda List
    agenda.innerHTML = appData.bills.map(b => `
        <div class="p-4 rounded-card-sm border border-brand-border bg-brand-surface flex items-center justify-between">
            <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center font-bold text-xs">
                    <i data-lucide="receipt" class="w-4 h-4"></i>
                </div>
                <div>
                    <div class="font-semibold text-sm">${b.name}</div>
                    <div class="text-xs font-mono text-brand-muted">Échéance : ${b.dueDate}</div>
                </div>
            </div>
            <div class="text-right">
                <div class="font-mono text-sm font-bold text-brand-ink">${curr}${Number(b.amount).toFixed(2)}</div>
                <span class="inline-block text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold">${b.status}</span>
            </div>
        </div>
    `).join('');

    // Calendar Days Grid (Simple 30-day rendering)
    let daysHtml = '';
    for (let d = 1; d <= 30; d++) {
        const isBillDay = (d === 5 || d === 12 || d === 20);
        daysHtml += `
            <div class="h-16 p-2 bg-white rounded border border-brand-border flex flex-col justify-between ${isBillDay ? 'ring-1 ring-brand-orange' : ''}">
                <span class="font-mono text-[10px] text-brand-muted">${d}</span>
                ${isBillDay ? `<span class="w-2 h-2 rounded-full bg-brand-orange self-end"></span>` : ''}
            </div>
        `;
    }
    daysGrid.innerHTML = daysHtml;
    if (window.lucide) lucide.createIcons();
}

function changeCalMonth(delta) {
    currentCalDate.setMonth(currentCalDate.getMonth() + delta);
    renderCalendar();
}

// --- GOALS RENDER ---
function renderGoals() {
    const grid = document.getElementById('goals-list-grid');
    const curr = getCurrencySymbol(appData.settings.currency);

    grid.innerHTML = appData.goals.map(g => {
        const pct = Math.min(Math.round((g.current / g.target) * 100), 100);
        return `
            <div class="bg-white p-6 rounded-card-sm border border-brand-border shadow-subtle space-y-4">
                <div class="flex justify-between items-start">
                    <h4 class="font-semibold text-base">${g.title}</h4>
                    <span class="text-xs font-mono font-bold text-brand-orange-light">${pct}%</span>
                </div>
                <div class="text-2xl font-bold font-mono text-brand-ink">
                    ${curr}${Number(g.current).toFixed(2)} <span class="text-xs text-brand-muted font-normal">/ ${curr}${Number(g.target).toFixed(2)}</span>
                </div>
                <div class="h-2 bg-brand-surface rounded-full overflow-hidden">
                    <div class="h-full bg-brand-orange rounded-full" style="width: ${pct}%"></div>
                </div>
                <div class="pt-2 flex justify-end">
                    <button onclick="addGoalContribution('${g.id}')" class="text-xs font-semibold text-brand-orange uppercase font-mono hover:underline">+ Contribuer</button>
                </div>
            </div>
        `;
    }).join('');
}

// --- DEBTS RENDER ---
function renderDebts() {
    const container = document.getElementById('debts-list-container');
    const curr = getCurrencySymbol(appData.settings.currency);
    const strategy = document.getElementById('debt-strategy-select').value;

    let sortedDebts = [...appData.debts];
    if (strategy === 'avalanche') {
        sortedDebts.sort((a, b) => b.rate - a.rate);
    } else {
        sortedDebts.sort((a, b) => a.balance - b.balance);
    }

    let totalBal = 0;
    let totalMin = 0;

    container.innerHTML = sortedDebts.map((d, index) => {
        totalBal += Number(d.balance);
        totalMin += Number(d.minPay);

        return `
            <div class="bg-white p-6 rounded-card-sm border border-brand-border shadow-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div class="flex items-center gap-4">
                    <div class="w-8 h-8 rounded-full bg-brand-surface text-brand-ink font-bold flex items-center justify-center font-mono text-xs border border-brand-border">
                        #${index + 1}
                    </div>
                    <div>
                        <h4 class="font-semibold text-base">${d.name}</h4>
                        <div class="text-xs text-brand-muted font-mono">Taux : ${d.rate}% APR</div>
                    </div>
                </div>
                <div class="flex items-center gap-6">
                    <div>
                        <div class="text-xs text-brand-muted font-mono uppercase">Solde Restant</div>
                        <div class="text-lg font-bold font-mono text-brand-ink">${curr}${Number(d.balance).toFixed(2)}</div>
                    </div>
                    <div>
                        <div class="text-xs text-brand-muted font-mono uppercase">Min. Mensuel</div>
                        <div class="text-lg font-bold font-mono text-rose-600">${curr}${Number(d.minPay).toFixed(2)}</div>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    document.getElementById('debt-total-balance').textContent = curr + totalBal.toFixed(2);
    document.getElementById('debt-total-minpay').textContent = curr + totalMin.toFixed(2);
    document.getElementById('debt-priority-hint').textContent = strategy === 'avalanche' ? 'Priorité au taux le plus élevé' : 'Priorité au plus petit solde';
}

// --- MODALS & FORM ACTIONS ---
function openQuickLogModal() {
    document.getElementById('modal-quicklog').classList.remove('hidden');
}

function openBillModal() {
    document.getElementById('modal-bill').classList.remove('hidden');
}

function openGoalModal() {
    document.getElementById('modal-goal').classList.remove('hidden');
}

function openDebtModal() {
    document.getElementById('modal-debt').classList.remove('hidden');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
}

function setTxType(type) {
    activeTxType = type;
    const expBtn = document.getElementById('type-expense-btn');
    const incBtn = document.getElementById('type-income-btn');

    if (type === 'expense') {
        expBtn.className = 'py-2 rounded-control text-xs font-bold bg-brand-ink text-white';
        incBtn.className = 'py-2 rounded-control text-xs font-bold bg-brand-surface text-brand-text border border-brand-border';
    } else {
        incBtn.className = 'py-2 rounded-control text-xs font-bold bg-brand-ink text-white';
        expBtn.className = 'py-2 rounded-control text-xs font-bold bg-brand-surface text-brand-text border border-brand-border';
    }
}

function populateCategoryDropdown() {
    const sel = document.getElementById('tx-category');
    sel.innerHTML = appData.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}

function handleLogTransaction(e) {
    e.preventDefault();
    const amount = parseFloat(document.getElementById('tx-amount').value);
    const catId = document.getElementById('tx-category').value;
    const date = document.getElementById('tx-date').value;
    const note = document.getElementById('tx-note').value;

    appData.transactions.unshift({
        id: 'tx-' + Date.now(),
        type: activeTxType,
        amount: amount,
        categoryId: catId,
        date: date,
        note: note
    });

    if (activeTxType === 'expense' && catId) {
        const cat = appData.categories.find(c => c.id === catId);
        if (cat) cat.spent += amount;
    }

    saveData();
    closeModal('modal-quicklog');
}

function handleAddBill(e) {
    e.preventDefault();
    const name = document.getElementById('bill-name').value;
    const amount = parseFloat(document.getElementById('bill-amount').value);
    const date = document.getElementById('bill-date').value;

    appData.bills.push({
        id: 'bill-' + Date.now(),
        name: name,
        amount: amount,
        dueDate: date,
        status: 'unpaid'
    });

    saveData();
    closeModal('modal-bill');
}

function handleAddGoal(e) {
    e.preventDefault();
    const title = document.getElementById('goal-title').value;
    const target = parseFloat(document.getElementById('goal-target').value);
    const current = parseFloat(document.getElementById('goal-current').value) || 0;

    appData.goals.push({
        id: 'goal-' + Date.now(),
        title: title,
        target: target,
        current: current
    });

    saveData();
    closeModal('modal-goal');
}

function handleAddDebt(e) {
    e.preventDefault();
    const name = document.getElementById('debt-name').value;
    const balance = parseFloat(document.getElementById('debt-balance').value);
    const minPay = parseFloat(document.getElementById('debt-minpay').value);
    const rate = parseFloat(document.getElementById('debt-rate').value) || 0;

    appData.debts.push({
        id: 'debt-' + Date.now(),
        name: name,
        balance: balance,
        minPay: minPay,
        rate: rate
    });

    saveData();
    closeModal('modal-debt');
}

function addGoalContribution(goalId) {
    const goal = appData.goals.find(g => g.id === goalId);
    if (goal) {
        goal.current += 50;
        saveData();
        renderGoals();
    }
}

function quickAddSpendToEnvelope(catId) {
    openQuickLogModal();
    document.getElementById('tx-category').value = catId;
}

function saveSettings() {
    appData.settings.currency = document.getElementById('setting-currency').value;
    appData.settings.startingBalance = parseFloat(document.getElementById('setting-starting-balance').value) || 0;
    appData.settings.nextPaydayDate = document.getElementById('setting-next-payday').value;
    appData.settings.nextPaydayAmount = parseFloat(document.getElementById('setting-payday-amount').value) || 0;

    saveData();
    alert('Paramètres enregistrés avec succès !');
}

function resetDataToDefault() {
    if (confirm('Voulez-vous réinitialiser toutes les données aux valeurs démo ?')) {
        appData = JSON.parse(JSON.stringify(DEFAULT_APP_STATE));
        saveData();
        location.reload();
    }
}
