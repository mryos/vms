// =====================================================
// KONFIGURASI
// Ganti URL di bawah dengan URL Web App Google Apps Script Anda
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxugRLhYSb9vUs8D1h09jt24w8vKsJr8Y7CMf6hccKKwyQLQx60zs26W7_0EMHSiig6kA/exec';

// =====================================================
// STATE & INIT
// =====================================================
let dashboardData = null;
let activeTab = 'all';
let contractExpiryFilter = 'all'; // 'all' | 'expired' | 'critical' | 'warning' | 'safe'
let contractCurrentPage = 1;
let contractPageSize = 10;
let lastContractComplianceData = null;
let slicerState = {
    period: 'all',
    category: 'all',
    compliance: 'all', // 'all' | 'comply' | 'not-comply'
    tier: 'all' // 'all' | 'high' | 'good' | 'poor'
};

document.addEventListener('DOMContentLoaded', () => {
    checkAdminAccess();
});

function checkAdminAccess() {
    const savedPin = localStorage.getItem('ethos_pin');
    const authOverlay = document.getElementById('adminAuthOverlay');
    
    // Khusus pengguna PIN 8899: dilarang akses dashboard, otomatis dialihkan ke katalog
    if (savedPin === '8899') {
        window.location.href = 'katalog.html';
        return;
    }

    // Hanya PIN 9999 yang boleh mengakses Dashboard
    if (savedPin === '9999') {
        if (authOverlay) authOverlay.style.display = 'none';
        initHeader();
        initTabs();
        loadDashboardData();
    } else {
        if (authOverlay) authOverlay.style.display = 'flex';
        initAdminAuth();
    }
}

function initAdminAuth() {
    const input = document.getElementById('adminPinInput');
    const btn = document.getElementById('adminSubmitBtn');
    const errEl = document.getElementById('adminPinError');
    const authOverlay = document.getElementById('adminAuthOverlay');

    function verify() {
        const pin = (input ? input.value : '').trim();
        if (pin === '9999') {
            localStorage.setItem('ethos_pin', '9999');
            localStorage.setItem('ethos_nama', 'Administrator');
            localStorage.removeItem('ethos_role');
            if (errEl) errEl.style.display = 'none';
            if (authOverlay) authOverlay.style.display = 'none';
            initHeader();
            initTabs();
            loadDashboardData();
        } else if (pin === '8899') {
            if (errEl) {
                errEl.innerHTML = '❌ Akses Ditolak. PIN 8899 hanya diizinkan mengakses <strong>Katalog Produk</strong>.<br><a href="katalog.html" class="underline font-bold text-blue-600 mt-1 inline-block">Buka Katalog Produk &rarr;</a>';
                errEl.style.display = 'block';
            }
        } else {
            if (errEl) {
                errEl.textContent = '❌ PIN salah. Akses Dashboard hanya untuk Administrator (PIN: 9999).';
                errEl.style.display = 'block';
            }
            if (input) {
                input.value = '';
                input.focus();
            }
        }
    }

    if (btn) btn.onclick = verify;
    if (input) {
        input.onkeydown = (e) => {
            if (e.key === 'Enter') verify();
            if (errEl) errEl.style.display = 'none';
        };
        setTimeout(() => input.focus(), 150);
    }
}

function initHeader() {
    const savedPin = localStorage.getItem('ethos_pin');
    const savedName = localStorage.getItem('ethos_nama');
    const userEl = document.getElementById('headerUser');

    if (savedPin && savedName && userEl) {
        userEl.textContent = `👤 ${savedName} (PIN: ${savedPin})`;
    }
}

function adminLogout() {
    localStorage.removeItem('ethos_pin');
    localStorage.removeItem('ethos_nama');
    localStorage.removeItem('ethos_user_vendors');
    window.location.href = 'index.html';
}

function initTabs() {
    const tabs = document.querySelectorAll('.tremor-tab');
    tabs.forEach(btn => {
        btn.addEventListener('click', () => {
            tabs.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeTab = btn.dataset.tab;
            applyTabFilter(activeTab);
        });
    });
}

function applyTabFilter(tab) {
    const bentoDash = document.getElementById('bentoDashboard');
    const contractsSec = document.getElementById('sectionContracts');
    const evalSec = document.getElementById('sectionEvaluations');
    const ordersCol = document.getElementById('sectionOrders');
    const kraljicSec = document.getElementById('sectionKraljic');

    if (tab === 'all') {
        if (bentoDash) bentoDash.style.display = 'grid';
        if (contractsSec) contractsSec.style.display = 'block';
        if (evalSec) evalSec.style.display = 'block';
        if (ordersCol) ordersCol.style.display = 'flex';
        if (kraljicSec) kraljicSec.style.display = 'block';
    } else if (tab === 'clm') {
        if (bentoDash) bentoDash.style.display = 'grid';
        if (contractsSec) contractsSec.style.display = 'block';
        if (evalSec) evalSec.style.display = 'block';
        if (ordersCol) ordersCol.style.display = 'flex';
        if (kraljicSec) kraljicSec.style.display = 'none';
    } else if (tab === 'kraljic') {
        if (bentoDash) bentoDash.style.display = 'none';
        if (contractsSec) contractsSec.style.display = 'none';
        if (evalSec) evalSec.style.display = 'none';
        if (kraljicSec) kraljicSec.style.display = 'block';
    } else if (tab === 'performance') {
        if (bentoDash) bentoDash.style.display = 'grid';
        if (contractsSec) contractsSec.style.display = 'none';
        if (evalSec) evalSec.style.display = 'block';
        if (ordersCol) ordersCol.style.display = 'none';
        if (kraljicSec) kraljicSec.style.display = 'none';
    } else if (tab === 'orders') {
        if (bentoDash) bentoDash.style.display = 'grid';
        if (contractsSec) contractsSec.style.display = 'none';
        if (evalSec) evalSec.style.display = 'none';
        if (ordersCol) ordersCol.style.display = 'flex';
        if (kraljicSec) kraljicSec.style.display = 'none';
    }
}

function initSlicers(kategoriList, periodList) {
    // 1. Inisialisasi Period Select Options (Dinamis dari Sheet Spreadsheet)
    const periodSelect = document.getElementById('slicerPeriodSelect');
    if (periodSelect) {
        const list = Array.isArray(periodList) ? periodList : [];
        periodSelect.innerHTML = `<option value="all">📅 Semua Periode</option>` +
            list.map(p => `<option value="${esc(p)}">📅 ${esc(p)}</option>`).join('');
    }

    // 2. Inisialisasi Category Select Options secara dinamis dari database
    const catSelect = document.getElementById('slicerCategorySelect');
    if (catSelect && kategoriList && kategoriList.length > 0) {
        catSelect.innerHTML = `<option value="all">📁 Semua Bidang</option>` +
            kategoriList.map(k => `<option value="${esc(k.kode)}">${k.ikon || '📦'} ${esc(k.nama)}</option>`).join('');
    }

    // 3. Pasang event listener untuk dropdown filter
    const compSelect = document.getElementById('slicerComplianceSelect');
    const tierSelect = document.getElementById('slicerTierSelect');

    if (periodSelect) {
        periodSelect.addEventListener('change', () => {
            slicerState.period = periodSelect.value;
            filterAndRenderDashboard();
        });
    }

    if (catSelect) {
        catSelect.addEventListener('change', () => {
            slicerState.category = catSelect.value;
            filterAndRenderDashboard();
        });
    }

    if (compSelect) {
        compSelect.addEventListener('change', () => {
            slicerState.compliance = compSelect.value;
            filterAndRenderDashboard();
        });
    }

    if (tierSelect) {
        tierSelect.addEventListener('change', () => {
            slicerState.tier = tierSelect.value;
            filterAndRenderDashboard();
        });
    }

    const contractSearchEl = document.getElementById('contractSearchInput');
    if (contractSearchEl && !contractSearchEl.dataset.bound) {
        contractSearchEl.dataset.bound = 'true';
        contractSearchEl.addEventListener('input', () => {
            contractCurrentPage = 1;
            filterAndRenderDashboard();
        });
    }

    const evalSearchEl = document.getElementById('evalSearchInput');
    if (evalSearchEl && !evalSearchEl.dataset.bound) {
        evalSearchEl.dataset.bound = 'true';
        evalSearchEl.addEventListener('input', () => {
            filterAndRenderDashboard();
        });
    }
}

function resetAllSlicers() {
    slicerState = {
        period: 'all',
        category: 'all',
        compliance: 'all',
        tier: 'all'
    };

    // Reset dropdown UI
    const periodSelect = document.getElementById('slicerPeriodSelect');
    const catSelect = document.getElementById('slicerCategorySelect');
    const compSelect = document.getElementById('slicerComplianceSelect');
    const tierSelect = document.getElementById('slicerTierSelect');

    if (periodSelect) periodSelect.value = 'all';
    if (catSelect) catSelect.value = 'all';
    if (compSelect) compSelect.value = 'all';
    if (tierSelect) tierSelect.value = 'all';

    filterAndRenderDashboard();
    showToast('Filter telah direset ke kondisi awal.', 'info');
}

async function loadDashboardData() {
    const savedPin = localStorage.getItem('ethos_pin') || '';
    const url = savedPin ? `${SCRIPT_URL}?pin=${encodeURIComponent(savedPin)}` : SCRIPT_URL;

    if (SCRIPT_URL === 'PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE') {
        showToast('Variabel SCRIPT_URL belum dikonfigurasi. Hubungkan API spreadsheet dahulu.', 'error');
        return;
    }

    try {
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.status === 'success') {
            dashboardData = data;
            initSlicers(dashboardData.kategori, dashboardData.periodList);
            filterAndRenderDashboard();
        } else {
            showToast(data.message || 'Gagal memuat data dari server.', 'error');
        }
    } catch (err) {
        console.error('Error fetching dashboard data:', err);
        showToast('Gagal terhubung ke Google Spreadsheet API.', 'error');
    }
}

// =====================================================
// SLICER FILTERING & RENDERING
// =====================================================
function filterAndRenderDashboard() {
    if (!dashboardData) return;

    let rawVendors = (dashboardData.allVendors && dashboardData.allVendors.length > 0) ? [...dashboardData.allVendors] : (dashboardData.vendors ? [...dashboardData.vendors] : []);
    let rawScore = dashboardData.scoreSummary || {};
    let rawCC = dashboardData.contractCompliance || { list: [] };
    let rawPO = dashboardData.poStats || { vendorMap: {} };
    const categories = dashboardData.kategori || [];

    // Jika filter periode dipilih secara spesifik
    if (slicerState.period !== 'all') {
        const selectedPeriodData = (dashboardData.periods && dashboardData.periods[slicerState.period]) ? dashboardData.periods[slicerState.period] : null;
        if (selectedPeriodData) {
            if (selectedPeriodData.vendors && selectedPeriodData.vendors.length > 0) {
                rawVendors = selectedPeriodData.vendors;
            }
            if (selectedPeriodData.poStats) {
                rawPO = selectedPeriodData.poStats;
            }
        } else {
            rawVendors = dashboardData.allVendors || dashboardData.vendors || [];
            rawPO = { totalOrders: 0, totalOnTime: 0, overallOnTimePct: 0, totalValue: 0, vendorMap: {} };
        }

        // Filter skor evaluasi hanya yang dinilai pada periode tersebut
        const periodScores = {};
        for (let name in rawScore) {
            const vData = rawScore[name];
            if (vData && Array.isArray(vData.periodeScores)) {
                const matchScores = vData.periodeScores.filter(p => p.periode === slicerState.period);
                if (matchScores.length > 0) {
                    const avg = matchScores.reduce((sum, s) => sum + s.score, 0) / matchScores.length;
                    periodScores[name] = {
                        avgScore: Math.round(avg * 100) / 100,
                        predikat: matchScores[0].predikat || getPredikat(avg),
                        periodeScores: matchScores
                    };
                }
            }
        }
        rawScore = periodScores;
    }

    // Filter Vendors berdasarkan Slicers Kategori, Kepatuhan, Rating
    const filteredVendors = rawVendors.filter(v => {
        const name = v.nama;
        const cat = v.kategori || 'GENERAL';

        // 1. Slicer Kategori
        if (slicerState.category !== 'all' && cat !== slicerState.category) {
            return false;
        }

        // 2. Slicer Kepatuhan Kontrak
        if (slicerState.compliance !== 'all') {
            const vendorContracts = rawCC.list ? rawCC.list.filter(c => c.vendor === name) : [];
            if (vendorContracts.length === 0) return false;
            const hasComply = vendorContracts.some(c => c.status.toLowerCase() === 'comply');
            const hasNotComply = vendorContracts.some(c => c.status.toLowerCase() !== 'comply');

            if (slicerState.compliance === 'comply' && !hasComply) return false;
            if (slicerState.compliance === 'not-comply' && !hasNotComply) return false;
        }

        // 3. Slicer Rating Tier
        if (slicerState.tier !== 'all') {
            const scoreData = rawScore[name];
            const score = scoreData ? scoreData.avgScore : null;
            if (score === null) return false;

            if (slicerState.tier === 'high' && score < 4.5) return false;
            if (slicerState.tier === 'good' && (score < 3.5 || score >= 4.5)) return false;
            if (slicerState.tier === 'poor' && score >= 2.5) return false;
        }

        return true;
    });

    const activeVendorNames = new Set(filteredVendors.map(v => v.nama));

    // Filter Score Summary
    const filteredScore = {};
    for (let name in rawScore) {
        if (activeVendorNames.has(name)) {
            filteredScore[name] = rawScore[name];
        }
    }

    // Filter Contract Compliance List & Stats (Data murni dari sheet 'Kontrak Vendor')
    let filteredContractsList = rawCC.list ? [...rawCC.list] : [];

    // Filter Kepatuhan Kontrak jika dipilih di slicer
    if (slicerState.compliance !== 'all') {
        filteredContractsList = filteredContractsList.filter(c => {
            const isComply = c.status && c.status.toLowerCase() === 'comply';
            return slicerState.compliance === 'comply' ? isComply : !isComply;
        });
    }

    // Filter Kategori jika dipilih di slicer
    if (slicerState.category !== 'all') {
        const catVendorNames = new Set();
        (dashboardData.allVendors || dashboardData.vendors || []).forEach(v => {
            if (v.kategori === slicerState.category) {
                catVendorNames.add(v.nama.toLowerCase().trim());
            }
        });
        filteredContractsList = filteredContractsList.filter(c => {
            return catVendorNames.has(c.vendor.toLowerCase().trim());
        });
    }

    // Filter Search Kontrak jika admin mengetik pencarian
    const contractSearchQuery = document.getElementById('contractSearchInput')?.value.trim().toLowerCase();
    if (contractSearchQuery) {
        filteredContractsList = filteredContractsList.filter(c => {
            return (c.noKontrak && c.noKontrak.toLowerCase().includes(contractSearchQuery)) ||
                   (c.vendor && c.vendor.toLowerCase().includes(contractSearchQuery)) ||
                   (c.jenisPekerjaan && c.jenisPekerjaan.toLowerCase().includes(contractSearchQuery)) ||
                   (c.keterangan && c.keterangan.toLowerCase().includes(contractSearchQuery));
        });
    }

    let uniqueContrVendors = 0;
    let uniqueComplVendors = 0;
    const vendorContrMap = {};
    filteredContractsList.forEach(c => {
        if (!vendorContrMap[c.vendor]) vendorContrMap[c.vendor] = { total: 0, comply: 0 };
        vendorContrMap[c.vendor].total++;
        if (c.status.toLowerCase() === 'comply') vendorContrMap[c.vendor].comply++;
    });
    for (let v in vendorContrMap) {
        uniqueContrVendors++;
        if (vendorContrMap[v].comply === vendorContrMap[v].total) uniqueComplVendors++;
    }
    const filteredCC = {
        totalContracts: filteredContractsList.length,
        totalCompliantContracts: filteredContractsList.filter(c => c.status.toLowerCase() === 'comply').length,
        uniqueContractedVendors: uniqueContrVendors,
        uniqueCompliantVendors: uniqueComplVendors,
        vendorComplianceRate: uniqueContrVendors > 0 ? Math.round((uniqueComplVendors / uniqueContrVendors) * 100) : 100,
        list: filteredContractsList
    };

    // Filter PO Stats
    const filteredVendorMap = {};
    let totalPoOrders = 0;
    let totalPoOnTime = 0;
    let totalPoValue = 0;
    if (rawPO.vendorMap) {
        for (let name in rawPO.vendorMap) {
            if (activeVendorNames.has(name)) {
                filteredVendorMap[name] = rawPO.vendorMap[name];
                totalPoOrders += (rawPO.vendorMap[name].totalPo || 0);
                totalPoOnTime += (rawPO.vendorMap[name].onTimePo || 0);
                totalPoValue += (rawPO.vendorMap[name].totalValue || 0);
            }
        }
    }
    const filteredPO = {
        totalOrders: totalPoOrders,
        totalOnTime: totalPoOnTime,
        totalValue: totalPoValue,
        overallOnTimePct: totalPoOrders > 0 ? Math.round((totalPoOnTime / totalPoOrders) * 100) : 100,
        vendorMap: filteredVendorMap
    };

    // Filter Evaluations List (dari sheet Penilaian Vendor)
    let filteredEvals = dashboardData.evaluationsList ? [...dashboardData.evaluationsList] : [];

    // Filter by periode
    if (slicerState.period !== 'all') {
        filteredEvals = filteredEvals.filter(ev => ev.periode === slicerState.period);
    }

    // Filter by kategori vendor
    if (slicerState.category !== 'all') {
        const catVendorNames = new Set();
        (dashboardData.allVendors || dashboardData.vendors || []).forEach(v => {
            if (v.kategori === slicerState.category) {
                catVendorNames.add(v.nama.toLowerCase().trim());
            }
        });
        filteredEvals = filteredEvals.filter(ev => catVendorNames.has(ev.vendor.toLowerCase().trim()));
    }

    // Filter by search input
    const evalSearchQuery = document.getElementById('evalSearchInput')?.value.trim().toLowerCase();
    if (evalSearchQuery) {
        filteredEvals = filteredEvals.filter(ev => {
            return (ev.vendor && ev.vendor.toLowerCase().includes(evalSearchQuery)) ||
                   (ev.penilai && ev.penilai.toLowerCase().includes(evalSearchQuery)) ||
                   (ev.periode && ev.periode.toLowerCase().includes(evalSearchQuery)) ||
                   (ev.catatan && ev.catatan.toLowerCase().includes(evalSearchQuery));
        });
    }

    // Render All Components with Sliced Data
    renderDashboard(filteredVendors, filteredScore, filteredCC, filteredPO, categories, filteredEvals);
}

// =====================================================
// RENDERING FUNCTIONS
// =====================================================
function renderDashboard(vendors, scoreSummary, cc, poStats, kategori, evaluations) {
    // 1. Render 5-Card Key Metrics
    renderSummaryCards(vendors, scoreSummary, cc, poStats);

    // 2. Check for Expiring Contracts Banner
    checkExpiringContracts(cc);

    // 3. Render Enterprise Charts (Chart.js)
    renderComplianceChart(cc);
    renderPredicateChart(scoreSummary);
    renderRadarChart(vendors, scoreSummary, kategori);

    window._lastDashboardArgs = { vendors, scoreSummary, cc, poStats, kategori, evaluations };

    // 4. Render Operational Tables & Tracking Cards
    renderContractTable(cc);
    renderEvaluationsTable(evaluations);
    renderTopVendors(scoreSummary, vendors, kategori);
    renderPendingVendors(vendors, scoreSummary, kategori, poStats);
    renderPoPerformance(poStats);

    // 5. Render Kraljic Strategic Matrix (FITUR 3)
    renderKraljicMatrix(vendors, scoreSummary, poStats, cc, kategori);

    // 6. Update Status & Filter Counters
    updateFilterCountSummary(vendors, cc, evaluations);
}

function renderSummaryCards(vendors, scoreSummary, cc, poStats) {
    const totalVendors = vendors ? vendors.length : 0;
    
    // 1. Total Nilai Kontrak & Spend PO (Spend Analytics Mekari)
    let totalContractVal = 0;
    let totalContractsCount = 0;
    if (cc && cc.list) {
        totalContractsCount = cc.list.length;
        cc.list.forEach(c => {
            totalContractVal += (Number(c.nilai) || 0);
        });
    }
    const valEl = document.getElementById('statTotalContractValue');
    const valCountEl = document.getElementById('statTotalContractsCount');
    const valAvgEl = document.getElementById('statAvgContractValue');
    const kpiSpendTitleEl = document.getElementById('kpiSpendTitle');

    const totalPoSpend = poStats ? (poStats.totalValue || 0) : 0;
    const totalPoOrders = poStats ? (poStats.totalOrders || 0) : 0;

    if (totalContractVal > 0) {
        if (kpiSpendTitleEl) kpiSpendTitleEl.textContent = 'Nilai Kontrak';
        if (valEl) valEl.textContent = formatRupiah(totalContractVal);
        if (valCountEl) valCountEl.textContent = `${totalContractsCount} kontrak aktif`;
        if (valAvgEl) {
            const avgVal = totalContractsCount > 0 ? (totalContractVal / totalContractsCount) : 0;
            valAvgEl.textContent = totalPoSpend > 0 ? `Belanja PO: ${formatRupiah(totalPoSpend)}` : `Rata-rata: ${formatRupiah(avgVal)}`;
        }
    } else {
        // Fallback cerdas: Jika nilai kontrak belum diisi/0 di spreadsheet, tampilkan Total Belanja PO riil
        if (kpiSpendTitleEl) kpiSpendTitleEl.textContent = 'Total Belanja PO';
        if (valEl) valEl.textContent = totalPoSpend > 0 ? formatRupiah(totalPoSpend) : 'Rp 0';
        if (valCountEl) valCountEl.textContent = `${totalContractsCount} kontrak aktif`;
        if (valAvgEl) {
            valAvgEl.textContent = totalPoOrders > 0 ? `${totalPoOrders} pesanan PO terdata` : 'Portofolio Belanja';
        }
    }

    // 2. KPI 4: Contract Compliance
    const ccRate = cc.vendorComplianceRate != null ? cc.vendorComplianceRate : 100;
    const ccEl = document.getElementById('statContractCompliance');
    const ccRatioEl = document.getElementById('statContractRatio');
    const ccProg = document.getElementById('progressCompliance');
    const ccBadgeEl = document.getElementById('statComplianceBadge');
    if (ccEl) ccEl.textContent = `${ccRate}%`;
    if (ccRatioEl) ccRatioEl.textContent = `${cc.uniqueCompliantVendors || 0} / ${cc.uniqueContractedVendors || 0} vendor comply`;
    if (ccProg) ccProg.style.width = `${ccRate}%`;
    if (ccBadgeEl) {
        if (ccRate >= 80) {
            ccBadgeEl.textContent = 'Optimal';
            ccBadgeEl.className = 'text-xs font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-md';
        } else if (ccRate >= 50) {
            ccBadgeEl.textContent = 'Cukup';
            ccBadgeEl.className = 'text-xs font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-md';
        } else {
            ccBadgeEl.textContent = 'Perlu Review';
            ccBadgeEl.className = 'text-xs font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded-md';
        }
    }

    // Update Donut numbers
    const donutComply = document.getElementById('donutComplyCount');
    const donutNotComply = document.getElementById('donutNotComplyCount');
    if (donutComply) donutComply.textContent = cc.uniqueCompliantVendors || 0;
    if (donutNotComply) donutNotComply.textContent = Math.max((cc.uniqueContractedVendors || 0) - (cc.uniqueCompliantVendors || 0), 0);

    // 3. KPI 1: Performance Score
    let sumScore = 0;
    let countScore = 0;
    if (scoreSummary) {
        for (let key in scoreSummary) {
            sumScore += scoreSummary[key].avgScore || 0;
            countScore++;
        }
    }
    const avgScore = countScore > 0 ? (sumScore / countScore).toFixed(1) : '0.0';
    const scorePct = Math.round((Number(avgScore) / 5) * 100);
    const scoreEl = document.getElementById('statAvgScore');
    const scoreCountEl = document.getElementById('statEvalCount');
    const scoreProg = document.getElementById('progressScore');
    const scoreBenchmarkEl = document.getElementById('statScoreBenchmark');
    if (scoreEl) scoreEl.textContent = `${avgScore}`;
    if (scoreCountEl) scoreCountEl.textContent = `${countScore} vendor dinilai`;
    if (scoreProg) scoreProg.style.width = `${scorePct}%`;
    if (scoreBenchmarkEl) {
        const numAvg = Number(avgScore);
        if (numAvg >= 4.5) {
            scoreBenchmarkEl.textContent = 'Sangat Baik';
            scoreBenchmarkEl.className = 'text-xs font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-md ml-auto';
        } else if (numAvg >= 3.5) {
            scoreBenchmarkEl.textContent = 'Baik (Target Tercapai)';
            scoreBenchmarkEl.className = 'text-xs font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded-md ml-auto';
        } else if (numAvg >= 2.5) {
            scoreBenchmarkEl.textContent = 'Cukup';
            scoreBenchmarkEl.className = 'text-xs font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-md ml-auto';
        } else {
            scoreBenchmarkEl.textContent = 'Perlu Perhatian';
            scoreBenchmarkEl.className = 'text-xs font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded-md ml-auto';
        }
    }

    // 4. KPI 2: Evaluation Completion
    const evalCompletionPct = totalVendors > 0 ? Math.round((countScore / totalVendors) * 100) : 0;
    const pendingCount = Math.max(totalVendors - countScore, 0);
    const evalEl = document.getElementById('statEvalCompletion');
    const evalRatioEl = document.getElementById('statEvalRatio');
    const evalProg = document.getElementById('progressCompletion');
    const pendingBadgeEl = document.getElementById('statPendingEvalCount');
    if (evalEl) evalEl.textContent = `${evalCompletionPct}%`;
    if (evalRatioEl) evalRatioEl.textContent = `${countScore} / ${totalVendors} vendor dinilai`;
    if (evalProg) evalProg.style.width = `${evalCompletionPct}%`;
    if (pendingBadgeEl) pendingBadgeEl.textContent = `${pendingCount} Belum Dinilai`;

    // 5. On-Time PO Delivery Rate
    const onTimePct = (poStats && poStats.overallOnTimePct != null) ? poStats.overallOnTimePct : 100;
    const totalOrders = poStats ? (poStats.totalOrders || 0) : 0;
    const onTimeOrders = poStats ? (poStats.totalOnTime || 0) : 0;
    const lateOrders = Math.max(totalOrders - onTimeOrders, 0);
    const onTimeEl = document.getElementById('statOnTimePct');
    const onTimeMetaEl = document.getElementById('statTotalPoMeta');
    const lateMetaEl = document.getElementById('statLateOrdersMeta');
    const onTimeProg = document.getElementById('progressOnTime');
    if (onTimeEl) onTimeEl.textContent = `${onTimePct}%`;
    if (onTimeMetaEl) onTimeMetaEl.textContent = `${totalOrders} total pesanan PO`;
    if (lateMetaEl) {
        lateMetaEl.textContent = lateOrders > 0 ? `${lateOrders} Terlambat` : `100% Tepat Waktu`;
        lateMetaEl.className = lateOrders > 0
            ? 'text-xs font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded-md ml-auto'
            : 'text-xs font-bold text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded-md ml-auto';
    }
    if (onTimeProg) onTimeProg.style.width = `${onTimePct}%`;
}

function checkExpiringContracts(cc) {
    const banner = document.getElementById('expiringContractsBanner');
    if (!banner || !cc || !cc.list || cc.list.length === 0) {
        if (banner) banner.style.display = 'none';
        return;
    }

    const now = new Date();
    const ninetyDaysAhead = new Date();
    ninetyDaysAhead.setDate(now.getDate() + 90);

    const expiring = [];
    cc.list.forEach(c => {
        if (c.tglSelesai && c.tglSelesai !== '-') {
            const endDate = new Date(c.tglSelesai);
            if (!isNaN(endDate.getTime()) && endDate >= now && endDate <= ninetyDaysAhead) {
                expiring.push(c);
            }
        }
    });

    if (expiring.length > 0) {
        banner.style.display = 'flex';
        const titleEl = document.getElementById('alertBannerTitle');
        const descEl = document.getElementById('alertBannerDesc');
        if (titleEl) titleEl.textContent = `⚠️ Peringatan: ${expiring.length} Kontrak Segera Berakhir (< 90 Hari)`;
        if (descEl) descEl.textContent = `Vendor: ${expiring.map(e => e.vendor).slice(0, 3).join(', ')}${expiring.length > 3 ? '...' : ''}. Persiapkan proses review & perpanjangan.`;
    } else {
        banner.style.display = 'none';
    }
}

function renderTopVendors(scoreSummary, vendors, categories) {
    const tableBody = document.getElementById('topVendorsTable');
    const noticeEl = document.getElementById('topVendorsFooterNotice');
    if (!tableBody) return;

    if (!scoreSummary || Object.keys(scoreSummary).length === 0) {
        tableBody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:#94a3b8; padding:2rem;">Belum ada vendor yang dinilai.</td></tr>`;
        if (noticeEl) noticeEl.innerHTML = '';
        return;
    }

    const sorted = Object.keys(scoreSummary).map(name => {
        const vInfo = (vendors && vendors.find(v => v.nama === name)) || {};
        const catCode = vInfo.kategori || 'general';
        const catInfo = (categories && categories.find(c => c.kode === catCode)) || { nama: 'General', ikon: '📦' };

        return {
            name: name,
            categoryName: catInfo.nama,
            categoryIcon: catInfo.ikon,
            avgScore: scoreSummary[name].avgScore,
            predikat: scoreSummary[name].predikat
        };
    }).sort((a, b) => b.avgScore - a.avgScore).slice(0, 5);

    const rankBadges = [
        '<span class="rank-badge-1 px-1.5 py-0.5 rounded-full text-xs">🥇 1</span>',
        '<span class="rank-badge-2 px-1.5 py-0.5 rounded-full text-xs">🥈 2</span>',
        '<span class="rank-badge-3 px-1.5 py-0.5 rounded-full text-xs">🥉 3</span>',
        '<span class="bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded-full text-xs font-bold">4</span>',
        '<span class="bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded-full text-xs font-bold">5</span>'
    ];

    tableBody.innerHTML = sorted.map((v, i) => `
        <tr>
            <td style="font-weight:700; width:36px;">${rankBadges[i] || (i + 1)}</td>
            <td>
                <div style="font-weight:600; color:#0f172a; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:180px;" title="${esc(v.name)}">${esc(v.name)}</div>
                <div class="flex items-center gap-1.5 mt-0.5">
                    <span style="font-size:0.72rem; color:#64748b;">${esc(v.categoryIcon)} ${esc(v.categoryName)}</span>
                    <button onclick="openVendorScorecard('${esc(v.name)}')" class="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition shadow-2xs" title="Cetak Rapor Kinerja ${esc(v.name)}">
                        📄 Rapor
                    </button>
                </div>
            </td>
            <td style="text-align:right; width:90px;">
                <div class="inline-flex items-center justify-end gap-1.5">
                    <span style="font-weight:800; color:#0f172a; font-size:0.95rem;">${v.avgScore.toFixed(2)}</span>
                    <span class="predikat-badge" style="background:${getPredikatColor(v.avgScore)}15; color:${getPredikatColor(v.avgScore)}; border:1px solid ${getPredikatColor(v.avgScore)}30; padding:0.1rem 0.45rem; font-size:0.68rem;">
                        ${esc(v.predikat)}
                    </span>
                </div>
            </td>
        </tr>
    `).join('');

    if (noticeEl) {
        const totalEvaluated = Object.keys(scoreSummary).length;
        const totalVendors = vendors ? vendors.length : 0;
        if (totalEvaluated < 5) {
            noticeEl.innerHTML = `
                <div class="p-2 bg-blue-50/70 border border-blue-100 rounded-lg flex items-center justify-between text-2xs mt-1.5">
                    <span class="text-blue-900 font-medium">Baru <strong>${totalEvaluated}</strong> dari <strong>${totalVendors}</strong> rekanan dinilai</span>
                    <a href="index.html" class="font-bold text-blue-600 hover:text-blue-800 hover:underline">Nilai Rekanan →</a>
                </div>
            `;
        } else {
            noticeEl.innerHTML = `
                <div class="text-2xs text-gray-400 text-center pt-1.5 border-t border-gray-100 font-medium">
                    Menampilkan 5 rekanan berkinerja tertinggi
                </div>
            `;
        }
    }
}

function renderPendingVendors(vendors, scoreSummary, categories, poStats) {
    const container = document.getElementById('pendingVendorsContainer');
    const badge = document.getElementById('pendingVendorBadge');
    if (!container) return;

    const evaluatedNames = new Set(scoreSummary ? Object.keys(scoreSummary) : []);
    const allList = vendors || [];
    
    // Prioritas Evaluasi: Berdasarkan aktivitas PO (Spend Strategic Priority ala Mekari)
    const pendingList = allList.filter(v => !evaluatedNames.has(v.nama)).map(v => {
        const poData = (poStats && poStats.vendorMap) ? poStats.vendorMap[v.nama] : null;
        return {
            ...v,
            totalPo: poData ? (poData.totalPo || 0) : 0,
            onTimePo: poData ? (poData.onTimePo || 0) : 0,
            totalSpend: poData ? (poData.totalValue || 0) : 0
        };
    }).sort((a, b) => {
        if (b.totalPo !== a.totalPo) return b.totalPo - a.totalPo;
        return b.totalSpend - a.totalSpend;
    });

    const attentionList = [];
    if (scoreSummary) {
        for (let name in scoreSummary) {
            if (scoreSummary[name].avgScore < 2.5) {
                attentionList.push({ name: name, ...scoreSummary[name] });
            }
        }
    }

    if (badge) {
        badge.textContent = `${pendingList.length} Belum Dinilai`;
        badge.className = pendingList.length > 0
            ? 'tremor-badge tremor-badge-purple'
            : 'tremor-badge tremor-badge-emerald';
    }

    if (pendingList.length === 0 && attentionList.length === 0) {
        container.innerHTML = `
        <div class="text-center py-6 px-4 bg-emerald-50/70 rounded-xl border border-emerald-100">
            <div class="text-2xl mb-1">🎉</div>
            <div class="font-bold text-xs text-emerald-800">Semua Vendor Telah Dievaluasi</div>
            <div class="text-2xs text-emerald-600 mt-0.5">Seluruh rekanan pada periode ini memiliki nilai dan dalam status prima (&ge; 2.5).</div>
        </div>`;
        return;
    }

    let html = '';

    // Peringatan jika ada vendor kritis (< 2.5)
    if (attentionList.length > 0) {
        html += `
        <div class="mb-3 p-2.5 bg-rose-50 border border-rose-200 rounded-xl">
            <div class="flex items-center gap-1.5 text-xs font-bold text-rose-800 mb-1">
                <span>⚠️</span>
                <span>Perlu Atensi Khusus (${attentionList.length} Rekanan)</span>
            </div>
            <div class="space-y-1">
                ${attentionList.map(v => `
                    <div class="flex items-center justify-between text-xs py-0.5">
                        <span class="font-semibold text-rose-900 truncate max-w-[170px]" title="${esc(v.name)}">${esc(v.name)}</span>
                        <span class="font-bold text-rose-700 bg-rose-100 px-1.5 py-0.2 rounded text-2xs">${v.avgScore.toFixed(2)} (${esc(v.predikat)})</span>
                    </div>
                `).join('')}
            </div>
        </div>`;
    }

    // Daftar vendor prioritas penilaian (Compact & Clean)
    if (pendingList.length > 0) {
        const withPoCount = pendingList.filter(p => p.totalPo > 0).length;
        html += `
        <div class="text-xs font-bold text-gray-700 mb-1.5 flex items-center justify-between">
            <span class="flex items-center gap-1 text-gray-800">
                <span>🎯 Prioritas Penilaian</span>
                ${withPoCount > 0 ? `<span class="text-2xs font-semibold text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200/80">${withPoCount} Ber-PO</span>` : ''}
            </span>
            <span class="text-gray-400 font-normal text-2xs">${pendingList.length} rekanan</span>
        </div>
        <div class="space-y-1">
            ${pendingList.slice(0, 10).map(v => {
                const catCode = v.kategori || 'general';
                const catInfo = (categories && categories.find(c => c.kode === catCode)) || { nama: 'General', ikon: '📦' };
                const hasPo = v.totalPo > 0;
                return `
                <div class="flex items-center justify-between py-1 px-2 rounded-lg ${hasPo ? 'bg-amber-50/25 border border-amber-100/80 hover:bg-amber-50/60' : 'bg-gray-50/80 border border-gray-100 hover:bg-gray-100/60'} transition">
                    <div class="min-w-0 pr-2">
                        <div class="font-semibold text-xs text-gray-900 truncate leading-tight" title="${esc(v.nama)}">${esc(v.nama)}</div>
                        <div class="flex items-center gap-1.5 text-2xs text-gray-500 mt-0.5 leading-tight">
                            <span>${esc(catInfo.ikon)} ${esc(catInfo.nama)}</span>
                            ${hasPo ? `<span class="font-semibold text-2xs text-amber-800 bg-amber-50 px-1 py-0.2 rounded border border-amber-200/70">${v.totalPo} PO</span>` : ''}
                        </div>
                    </div>
                    <a href="index.html" class="inline-flex items-center gap-0.5 text-2xs font-semibold px-2 py-0.5 rounded-md border border-gray-200 bg-white text-gray-700 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50/50 whitespace-nowrap transition shadow-2xs" title="Beri nilai sekarang">
                        Nilai →
                    </a>
                </div>`;
            }).join('')}
            ${pendingList.length > 10 ? `
                <div class="text-center text-2xs text-gray-400 pt-1 font-medium">
                    +${pendingList.length - 10} vendor lainnya
                </div>
            ` : ''}
        </div>`;
    }

    container.innerHTML = html;
}

function updateFilterCountSummary(vendors, cc, evaluations) {
    const el = document.getElementById('filterCountSummary');
    if (!el) return;
    const vCount = vendors ? vendors.length : 0;
    const cCount = (cc && cc.list) ? cc.list.length : 0;
    const eCount = evaluations ? evaluations.length : 0;
    el.innerHTML = `<span>Menampilkan: <strong class="text-gray-800">${vCount}</strong> Rekanan · <strong class="text-gray-800">${cCount}</strong> Kontrak · <strong class="text-gray-800">${eCount}</strong> Evaluasi</span>`;
}

// =====================================================
// CSV EXPORT UTILITIES
// =====================================================
function downloadCsv(content, filename) {
    const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function escCsv(val) {
    if (val === undefined || val === null) return '';
    return val.toString().replace(/"/g, '""');
}

function exportContractCsv() {
    if (!dashboardData || !dashboardData.contractCompliance || !dashboardData.contractCompliance.list || dashboardData.contractCompliance.list.length === 0) {
        showToast('Tidak ada data kontrak untuk diexport.', 'error');
        return;
    }
    const list = dashboardData.contractCompliance.list;
    let csv = 'No Kontrak,Vendor,Ruang Lingkup,Tgl Mulai,Tgl Selesai,Kelengkapan,Nilai Kontrak,Status,Keterangan\n';
    list.forEach(c => {
        csv += `"${escCsv(c.noKontrak)}","${escCsv(c.vendor)}","${escCsv(c.jenisPekerjaan)}","${escCsv(c.tglMulai)}","${escCsv(c.tglSelesai)}","${escCsv(c.kelengkapan)}","${c.nilai || 0}","${escCsv(c.status)}","${escCsv(c.keterangan)}"\n`;
    });
    const nowStr = new Date().toISOString().slice(0, 10);
    downloadCsv(csv, `Laporan_Kontrak_Vendor_${nowStr}.csv`);
    showToast('Laporan kontrak berhasil diunduh.', 'success');
}

function exportEvaluationCsv() {
    if (!dashboardData || !dashboardData.evaluationsList || dashboardData.evaluationsList.length === 0) {
        showToast('Tidak ada data evaluasi untuk diexport.', 'error');
        return;
    }
    const list = dashboardData.evaluationsList;
    let csv = 'Tanggal,Penilai,Vendor,Periode,Skor Rata-rata,Predikat,Catatan\n';
    list.forEach(e => {
        csv += `"${escCsv(e.timestamp)}","${escCsv(e.penilai)}","${escCsv(e.vendor)}","${escCsv(e.periode)}","${e.score}","${escCsv(e.predikat)}","${escCsv(e.catatan)}"\n`;
    });
    const nowStr = new Date().toISOString().slice(0, 10);
    downloadCsv(csv, `Laporan_Evaluasi_Vendor_${nowStr}.csv`);
    showToast('Laporan evaluasi berhasil diunduh.', 'success');
}

function exportDashboardCsv() {
    exportEvaluationCsv();
}

// =====================================================
// ERP / ODOO CSV EXPORT UTILITIES (SESUAI TEMPLATE ERP)
// =====================================================
function openErpExportModal() {
    const modal = document.getElementById('erpExportModal');
    if (!modal) return;

    // 1. Populate period dropdown
    const periodSelect = document.getElementById('erpExportPeriodSelect');
    if (periodSelect) {
        let periodOptions = '<option value="all">📅 Semua Periode Evaluasi</option>';
        if (dashboardData && Array.isArray(dashboardData.periodList)) {
            periodOptions += dashboardData.periodList.map(p => `<option value="${esc(p)}">📅 ${esc(p)}</option>`).join('');
        }
        periodSelect.innerHTML = periodOptions;

        // Default to current slicer period if not "all"
        const currentSlicer = document.getElementById('slicerPeriodSelect')?.value;
        if (currentSlicer && currentSlicer !== 'all') {
            periodSelect.value = currentSlicer;
        } else {
            periodSelect.value = 'all';
        }
    }

    // 2. Populate vendor dropdown
    const vendorSelect = document.getElementById('erpExportVendorSelect');
    if (vendorSelect) {
        let vendorOptions = '<option value="all">🤝 Semua Rekanan yang Dinilai</option>';
        const evaluatedVendors = new Set();
        if (dashboardData && Array.isArray(dashboardData.evaluationsList)) {
            dashboardData.evaluationsList.forEach(e => {
                if (e.vendor) evaluatedVendors.add(e.vendor);
            });
        }
        Array.from(evaluatedVendors).sort().forEach(v => {
            vendorOptions += `<option value="${esc(v)}">${esc(v)}</option>`;
        });
        vendorSelect.innerHTML = vendorOptions;
    }

    // 3. Update preview
    updateErpExportPreview();

    modal.style.display = 'flex';
}

function closeErpExportModal() {
    const modal = document.getElementById('erpExportModal');
    if (modal) modal.style.display = 'none';
}

function updateErpExportPreview() {
    const periodFilter = document.getElementById('erpExportPeriodSelect')?.value || 'all';
    const vendorFilter = document.getElementById('erpExportVendorSelect')?.value || 'all';
    const badge = document.getElementById('erpExportSummaryBadge');
    const textEl = document.getElementById('erpExportSummaryText');

    const evals = getFilteredEvaluationsForErp(periodFilter, vendorFilter);
    let totalLinesCount = 0;
    evals.forEach(e => {
        const lines = getEvaluationLinesForRecord(e);
        totalLinesCount += lines.length;
    });

    if (badge) {
        badge.textContent = `${evals.length} Rekanan · ${totalLinesCount} Baris CSV`;
    }
    if (textEl) {
        if (evals.length === 0) {
            textEl.innerHTML = '<span class="text-rose-600 font-semibold">⚠️ Tidak ada data evaluasi yang cocok dengan filter yang dipilih.</span>';
        } else {
            const sample = evals[0];
            const sampleLines = getEvaluationLinesForRecord(sample);
            textEl.innerHTML = `Siap mengekspor <strong>${evals.length} sesi evaluasi</strong> (${totalLinesCount} baris detail kriteria).<br>
            <span class="text-indigo-600 font-mono text-[10px] mt-1 block">Contoh Record: ${esc(sample.vendor)} (${esc(sample.periode || 'General')}) &bull; ${sampleLines.length} kriteria penilaian</span>`;
        }
    }
}

function getFilteredEvaluationsForErp(periodFilter, vendorFilter) {
    if (!dashboardData || !Array.isArray(dashboardData.evaluationsList)) return [];
    return dashboardData.evaluationsList.filter(e => {
        if (periodFilter !== 'all' && e.periode !== periodFilter) {
            const pClean = (e.periode || '').toLowerCase().replace(/\s+/g, '');
            const filterClean = periodFilter.toLowerCase().replace(/\s+/g, '');
            if (pClean !== filterClean) return false;
        }
        if (vendorFilter !== 'all' && e.vendor !== vendorFilter) {
            return false;
        }
        return true;
    });
}

function getVendorBusinessTitle(vendorName, categoryCode) {
    // 1. Cek dari sheet Kontrak Vendor (ruang lingkup / jenis pekerjaan)
    if (dashboardData && dashboardData.contractCompliance && Array.isArray(dashboardData.contractCompliance.list)) {
        const c = dashboardData.contractCompliance.list.find(item => item.vendor && item.vendor.toLowerCase().trim() === vendorName.toLowerCase().trim());
        if (c && c.jenisPekerjaan && c.jenisPekerjaan !== '-') {
            return c.jenisPekerjaan;
        }
    }

    // 2. Cek dari PO produk yang pernah disuplai
    if (dashboardData && Array.isArray(dashboardData.allRawOrders)) {
        const po = dashboardData.allRawOrders.find(o => o.vendor && o.vendor.toLowerCase().trim() === vendorName.toLowerCase().trim() && o.product);
        if (po && po.product) {
            return po.product;
        }
    }

    // 3. Cek dari nama kategori vendor
    if (categoryCode && dashboardData && Array.isArray(dashboardData.kategoriList)) {
        const cat = dashboardData.kategoriList.find(k => k.kode === categoryCode || k.nama === categoryCode);
        if (cat && cat.nama) return cat.nama;
    }

    return 'Barang & Jasa';
}

function getVendorEmail(vendorName) {
    if (dashboardData && Array.isArray(dashboardData.allMasterVendors)) {
        const v = dashboardData.allMasterVendors.find(item => item.nama && item.nama.toLowerCase().trim() === vendorName.toLowerCase().trim());
        if (v && v.kontak && v.kontak.includes('@')) {
            return v.kontak.trim();
        }
    }
    return '';
}

function formatToDmY(dateStr) {
    if (!dateStr || dateStr === '-') return '';
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
    }
    return dateStr;
}

function getPeriodDateRange(periode) {
    const text = (periode || '').toString();
    const yearMatch = text.match(/\b(20\d\d)\b/);
    const year = yearMatch ? yearMatch[1] : new Date().getFullYear().toString();

    let q = 0;
    if (text.includes('1') || text.toLowerCase().includes('q1')) q = 1;
    else if (text.includes('2') || text.toLowerCase().includes('q2')) q = 2;
    else if (text.includes('3') || text.toLowerCase().includes('q3')) q = 3;
    else if (text.includes('4') || text.toLowerCase().includes('q4')) q = 4;

    if (q === 1) return { startDmY: `1/1/${year}`, endDmY: `31/03/${year}` };
    if (q === 2) return { startDmY: `1/4/${year}`, endDmY: `30/06/${year}` };
    if (q === 3) return { startDmY: `1/7/${year}`, endDmY: `30/09/${year}` };
    if (q === 4) return { startDmY: `1/10/${year}`, endDmY: `31/12/${year}` };

    return { startDmY: `1/1/${year}`, endDmY: `31/12/${year}` };
}

function mapScoreToErpRate(score) {
    const val = parseFloat(score) || 0;
    if (val >= 4.5) return 'Excellent';
    if (val >= 3.5) return 'Good';
    if (val >= 2.5) return 'Fair';
    if (val >= 1.5) return 'Poor';
    return 'Very Poor';
}

function calculateLineFactors(lines) {
    if (!lines || lines.length === 0) return [];
    const n = lines.length;
    const base = Math.floor(100 / n);
    const factors = new Array(n).fill(base);

    // Kustomisasi bobot sesuai kriteria spesifik
    lines.forEach((l, idx) => {
        const lName = (l.name || '').toLowerCase();
        if (lName.includes('dokumen legal') || lName.includes('dokumen transaksi') || lName.includes('efisiensi') || lName.includes('budget')) {
            factors[idx] = 5;
        } else if (lName.includes('kualitas') || lName.includes('hasil') || lName.includes('portofolio')) {
            factors[idx] = 20;
        } else {
            factors[idx] = 10;
        }
    });

    // Normalisasi agar tepat total 100
    const sum = factors.reduce((a, b) => a + b, 0);
    const diff = 100 - sum;
    if (factors.length > 0) {
        factors[factors.length - 1] += diff;
    }
    return factors;
}

function getEvaluationLinesForRecord(e) {
    // 1. Jika sudah ada data lines dari sheet Penilaian - <Kategori>
    if (Array.isArray(e.lines) && e.lines.length > 0) {
        return e.lines;
    }

    // 2. Fallback: ambil kriteria berdasarkan kategori vendor
    const vCat = e.kategori || (dashboardData && dashboardData.vendors && dashboardData.vendors.find(v => v.nama === e.vendor)?.kategori) || 'BarangJasa';
    let matched = [];
    if (dashboardData && Array.isArray(dashboardData.kriteriaList)) {
        matched = dashboardData.kriteriaList.filter(k => k.kategori === vCat || (k.vendorSpesifik && k.vendorSpesifik.toLowerCase() === (e.vendor || '').toLowerCase()));
    }

    if (matched.length > 0) {
        return matched.map(m => ({
            name: m.kriteria,
            score: e.score || 4
        }));
    }

    // 3. Fallback standar 10 kriteria umum
    const fallbackNames = [
        'Kelengkapan & Validasi Dokumen Legal',
        'Pengalaman & Portofolio',
        'Kualitas Hasil Pekerjaan',
        'Kesesuaian Brand Guideline',
        'Kreativitas & Inovasi',
        'Kesesuaian Timeline & Jadwal',
        'Kecepatan Respon & Komunikasi',
        'Penanganan Masalah & Revisi',
        'Kemampuan Koordinasi Teknis',
        'Efisiensi Biaya & Penawaran'
    ];
    return fallbackNames.map(name => ({
        name: name,
        score: e.score || 4
    }));
}

function getVendorPoCheck(vendorName) {
    if (dashboardData && dashboardData.poStats && dashboardData.poStats.vendorMap) {
        const vPo = dashboardData.poStats.vendorMap[vendorName];
        if (vPo && vPo.onTimeRatePct >= 80) return true;
    }
    return false;
}

function getVendorFulfillmentCheck(vendorName) {
    if (dashboardData && dashboardData.contractCompliance && Array.isArray(dashboardData.contractCompliance.list)) {
        const c = dashboardData.contractCompliance.list.find(item => item.vendor && item.vendor.toLowerCase() === vendorName.toLowerCase());
        if (c && (c.kelengkapan === 'Lengkap' || c.status === 'Aktif')) return true;
    }
    return false;
}

function formatCsvCell(val, delim = ',') {
    if (val === undefined || val === null) return '';
    const str = val.toString().trim();
    if (str.includes(delim) || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

function executeErpCsvDownload() {
    const periodFilter = document.getElementById('erpExportPeriodSelect')?.value || 'all';
    const vendorFilter = document.getElementById('erpExportVendorSelect')?.value || 'all';
    const defaultManager = (document.getElementById('erpExportManagerInput')?.value || '').trim() || 'yanis.ahmad@ethos.co.id';
    const delimiterChoice = document.getElementById('erpExportDelimiterSelect')?.value || 'comma';
    const isSemicolon = (delimiterChoice === 'semicolon');
    const delim = isSemicolon ? ';' : ',';

    const evals = getFilteredEvaluationsForErp(periodFilter, vendorFilter);
    if (evals.length === 0) {
        showToast('Tidak ada data evaluasi yang cocok untuk diekspor.', 'error');
        return;
    }

    // Header sesuai template ERP / Odoo
    const headers = [
        'External ID',
        'Vendor',
        'Business Title',
        'Email',
        'Date Entry',
        'Review Period',
        'Period End',
        'Manager',
        'on_time_rate_check',
        'fulfillment_check',
        'Evaluation Line/Evaluation Name',
        'Evaluation Line/Rate',
        'Evaluation Line/Factor',
        'Evaluation Line/Comment'
    ];

    let csv = headers.join(delim) + (isSemicolon ? ';\n' : '\n');
    let totalLines = 0;

    evals.forEach((e, idx) => {
        const vName = e.vendor;
        const cleanVendorSlug = vName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
        const cleanPeriodSlug = (e.periode || 'general').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
        const extId = `ve_${cleanPeriodSlug}_${cleanVendorSlug}`;

        const bTitle = getVendorBusinessTitle(vName, e.kategori);
        const vEmail = getVendorEmail(vName);
        const { startDmY, endDmY } = getPeriodDateRange(e.periode);
        const dateEntry = formatToDmY(e.timestamp) || endDmY;

        let managerEmail = defaultManager;
        if (e.penilai && e.penilai !== '-' && e.penilai.includes('@')) {
            managerEmail = e.penilai.trim();
        } else if (e.penilai && e.penilai !== '-') {
            managerEmail = e.penilai.toLowerCase().trim().replace(/[^a-z0-9]+/g, '.') + '@ethos.co.id';
        }

        const poCheck = getVendorPoCheck(vName);
        const fulfillCheck = getVendorFulfillmentCheck(vName);

        const lines = getEvaluationLinesForRecord(e);
        const factors = calculateLineFactors(lines);

        lines.forEach((line, lIdx) => {
            const factor = factors[lIdx] || 10;
            const rateStr = mapScoreToErpRate(line.score);
            const comment = (lIdx === 0 && e.catatan) ? e.catatan : (line.comment || '');

            if (isSemicolon) {
                // Format template dengan semicolon setelah External ID
                csv += `${extId};${vName},${bTitle},${vEmail},${dateEntry},${startDmY},${endDmY},${managerEmail},${poCheck ? 'TRUE' : 'FALSE'},${fulfillCheck ? 'TRUE' : 'FALSE'},${line.name},${rateStr},${factor},${comment}\n`;
            } else {
                // Standar RFC / Odoo CSV dengan koma dan quoting
                const rowCells = [
                    extId,
                    vName,
                    bTitle,
                    vEmail,
                    dateEntry,
                    startDmY,
                    endDmY,
                    managerEmail,
                    poCheck ? 'TRUE' : 'FALSE',
                    fulfillCheck ? 'TRUE' : 'FALSE',
                    line.name,
                    rateStr,
                    factor,
                    comment
                ];
                csv += rowCells.map(c => formatCsvCell(c, ',')).join(',') + '\n';
            }
            totalLines++;
        });
    });

    const nowStr = new Date().toISOString().slice(0, 10);
    const periodLabel = periodFilter === 'all' ? 'Semua_Periode' : periodFilter.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `vendor-evaluation-import-template-${periodLabel}-${nowStr}.csv`;
    downloadCsv(csv, filename);
    showToast(`Berhasil mengunduh ${totalLines} baris data evaluasi untuk ERP!`, 'success');
    closeErpExportModal();
}


function renderPoPerformance(poStats) {
    const container = document.getElementById('poPerformanceList');
    const badge = document.getElementById('overallOnTimeBadge');
    if (!container) return;

    if (!poStats || !poStats.vendorMap || Object.keys(poStats.vendorMap).length === 0) {
        container.innerHTML = `<div style="text-align:center; color:var(--text3); padding:2rem;">Belum ada data pengiriman PO.</div>`;
        if (badge) badge.style.display = 'none';
        return;
    }

    if (badge) {
        badge.textContent = `${poStats.overallOnTimePct}% Tepat Waktu`;
        badge.style.background = poStats.overallOnTimePct >= 80 ? '#10b98120' : poStats.overallOnTimePct >= 60 ? '#f59e0b20' : '#ef444420';
        badge.style.color = poStats.overallOnTimePct >= 80 ? '#10b981' : poStats.overallOnTimePct >= 60 ? '#f59e0b' : '#ef4444';
        badge.style.display = 'inline-block';
    }

    const sortedVendorNames = Object.keys(poStats.vendorMap).sort((a, b) => {
        return poStats.vendorMap[b].totalPo - poStats.vendorMap[a].totalPo;
    });

    const html = sortedVendorNames.map(name => {
        const v = poStats.vendorMap[name];
        const pct = v.onTimeRatePct;
        const color = pct >= 80 ? '#10b981' : pct >= 60 ? '#f59e0b' : '#ef4444';
        const badgeBg = pct >= 80 ? '#ecfdf5' : pct >= 60 ? '#fffbeb' : '#fef2f2';
        const badgeText = pct >= 80 ? '#065f46' : pct >= 60 ? '#92400e' : '#991b1b';
        
        return `
        <div class="po-perf-item py-1 px-2 rounded-lg bg-gray-50/80 border border-gray-100 hover:bg-gray-100/60 transition mb-1.5">
            <div class="flex items-center justify-between mb-1 text-xs">
                <span class="font-semibold text-gray-900 truncate max-w-[170px] leading-tight" title="${esc(name)}">${esc(name)}</span>
                <span class="font-bold text-2xs px-1.5 py-0.2 rounded" style="background:${badgeBg}; color:${badgeText};">${pct}% (${v.onTimePo}/${v.totalPo} PO)</span>
            </div>
            <div class="progress-bar-container bg-gray-200 h-1.5 rounded-full overflow-hidden">
                <div class="progress-bar-fill h-full rounded-full transition-all duration-500" style="width:${pct}%; background:${color};"></div>
            </div>
        </div>`;
    }).join('');

    container.innerHTML = html;
}

function getContractDaysRemaining(dateStr) {
    if (!dateStr || dateStr === '-' || dateStr.toLowerCase().includes('belum')) return null;
    const target = new Date(dateStr);
    if (isNaN(target.getTime())) return null;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}

function filterContractsByExpiry(filter) {
    contractExpiryFilter = filter;
    contractCurrentPage = 1;
    
    // Update button styles
    const btnIds = {
        'all': 'btnExpAll',
        'expired': 'btnExpExpired',
        'critical': 'btnExpCritical',
        'warning': 'btnExpWarning',
        'safe': 'btnExpSafe'
    };
    
    for (const key in btnIds) {
        const btn = document.getElementById(btnIds[key]);
        if (btn) {
            if (key === filter) {
                btn.className = 'px-2.5 py-1 rounded-lg bg-blue-600 text-white font-bold transition shadow-2xs';
            } else {
                btn.className = 'px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200/80 transition font-medium';
            }
        }
    }
    
    if (lastContractComplianceData) {
        renderContractTable(lastContractComplianceData);
    } else if (dashboardData && dashboardData.contractCompliance) {
        renderContractTable(dashboardData.contractCompliance);
    }
}

function renderContractTable(cc) {
    lastContractComplianceData = cc;
    const tableBody = document.getElementById('contractTableBody');
    if (!tableBody) return;

    if (!cc || !cc.list || cc.list.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text3); padding:2rem;">Belum ada data kontrak vendor terdaftar di sheet 'Kontrak Vendor'.</td></tr>`;
        const badgeCount = document.getElementById('contractBadgeCount');
        if (badgeCount) badgeCount.textContent = `0 Kontrak`;
        renderContractPaginationUI(0, 1, 0, 0);
        return;
    }

    // Hitung counter kategori masa berlaku (Fitur 2)
    let countExpired = 0;
    let countCritical = 0;
    let countWarning = 0;
    let countSafe = 0;

    cc.list.forEach(c => {
        const days = getContractDaysRemaining(c.tglSelesai);
        if (days !== null) {
            if (days < 0) countExpired++;
            else if (days <= 30) countCritical++;
            else if (days <= 90) countWarning++;
            else countSafe++;
        } else {
            countSafe++;
        }
    });

    const elCountExpired = document.getElementById('countExpExpired');
    const elCountCritical = document.getElementById('countExpCritical');
    const elCountWarning = document.getElementById('countExpWarning');
    const elCountSafe = document.getElementById('countExpSafe');

    if (elCountExpired) elCountExpired.textContent = countExpired;
    if (elCountCritical) elCountCritical.textContent = countCritical;
    if (elCountWarning) elCountWarning.textContent = countWarning;
    if (elCountSafe) elCountSafe.textContent = countSafe;

    // Filter daftar kontrak berdasarkan contractExpiryFilter
    let displayList = cc.list;
    if (contractExpiryFilter === 'expired') {
        displayList = displayList.filter(c => {
            const d = getContractDaysRemaining(c.tglSelesai);
            return d !== null && d < 0;
        });
    } else if (contractExpiryFilter === 'critical') {
        displayList = displayList.filter(c => {
            const d = getContractDaysRemaining(c.tglSelesai);
            return d !== null && d >= 0 && d <= 30;
        });
    } else if (contractExpiryFilter === 'warning') {
        displayList = displayList.filter(c => {
            const d = getContractDaysRemaining(c.tglSelesai);
            return d !== null && d > 30 && d <= 90;
        });
    } else if (contractExpiryFilter === 'safe') {
        displayList = displayList.filter(c => {
            const d = getContractDaysRemaining(c.tglSelesai);
            return d === null || d > 90;
        });
    }

    const totalItems = displayList.length;
    const badgeCount = document.getElementById('contractBadgeCount');
    if (badgeCount) {
        badgeCount.textContent = `${totalItems} Kontrak`;
    }

    if (totalItems === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#94a3b8; padding:2rem;">Tidak ada kontrak pada kategori masa berlaku ini.</td></tr>`;
        renderContractPaginationUI(0, 1, 0, 0);
        return;
    }

    // Paginasi Kontrak
    const totalPages = Math.ceil(totalItems / contractPageSize) || 1;
    if (contractCurrentPage > totalPages) contractCurrentPage = totalPages;
    if (contractCurrentPage < 1) contractCurrentPage = 1;

    const startIndex = (contractCurrentPage - 1) * contractPageSize;
    const endIndex = Math.min(startIndex + contractPageSize, totalItems);
    const pagedList = displayList.slice(startIndex, endIndex);

    tableBody.innerHTML = pagedList.map(c => {
        const isComply = c.status && c.status.toLowerCase() === 'comply';
        const statusColor = isComply ? '#10b981' : '#ef4444';
        
        const isDocComplete = c.kelengkapan && c.kelengkapan.toLowerCase().includes('lengkap');
        const docColor = isDocComplete ? '#0284c7' : '#f59e0b';

        const cleanVendor = (c.vendor || '').replace(/\r?\n|\r/g, ' ').trim();
        const cleanJenis = (c.jenisPekerjaan || '-').replace(/\r?\n|\r/g, ' ').trim();

        return `
        <tr class="hover:bg-blue-50/40 transition-colors">
            <td style="font-weight:700; color:#2563eb; font-size:0.78rem; white-space:nowrap;">#${esc(c.noKontrak)}</td>
            <td>
                <div style="font-weight:600; color:#0f172a; max-width:220px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${esc(cleanVendor)}">${esc(cleanVendor)}</div>
            </td>
            <td>
                <div style="font-size:0.78rem; color:#475569; max-width:180px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${esc(cleanJenis)}">${esc(cleanJenis)}</div>
            </td>
            <td style="font-size:0.75rem; color:#64748b; white-space:nowrap;">
                ${esc(c.tglMulai || '-')} &ndash; ${esc(c.tglSelesai || '-')}
            </td>
            <td>
                <span class="predikat-badge" style="background:${docColor}15; color:${docColor}; border:1px solid ${docColor}30; font-size:0.68rem; font-weight:600; padding:1px 6px;">
                    ${esc(c.kelengkapan)}
                </span>
            </td>
            <td style="text-align:right; font-weight:700; color:#0f172a; font-size:0.78rem; white-space:nowrap;">${c.nilai ? formatRupiah(c.nilai) : '-'}</td>
            <td style="text-align:center;">
                <span class="predikat-badge" style="background:${statusColor}15; color:${statusColor}; border:1px solid ${statusColor}30; font-size:0.7rem; font-weight:700; padding:1px 6px;">
                    ${isComply ? '✓ Comply' : '✗ Not Comply'}
                </span>
            </td>
        </tr>`;
    }).join('');

    renderContractPaginationUI(totalItems, totalPages, startIndex, endIndex);
}

function renderContractPaginationUI(totalItems, totalPages, startIndex, endIndex) {
    const infoEl = document.getElementById('contractPaginationInfo');
    const navEl = document.getElementById('contractPaginationNav');
    if (!infoEl || !navEl) return;

    infoEl.innerHTML = totalItems === 0
        ? `Tidak ada data kontrak`
        : `Menampilkan <strong class="text-gray-900">${startIndex + 1} - ${endIndex}</strong> dari <strong class="text-gray-900">${totalItems}</strong> kontrak`;

    if (totalPages <= 1) {
        navEl.innerHTML = '';
        return;
    }

    let buttonsHtml = '';

    // Tombol Sebelumnya (Prev)
    buttonsHtml += `
        <button onclick="goToContractPage(${contractCurrentPage - 1})" ${contractCurrentPage === 1 ? 'disabled' : ''} class="page-btn">
            ‹ Prev
        </button>
    `;

    // Tombol Angka Halaman
    let startPage = Math.max(1, contractCurrentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);
    if (endPage - startPage < 4) {
        startPage = Math.max(1, endPage - 4);
    }

    if (startPage > 1) {
        buttonsHtml += `<button onclick="goToContractPage(1)" class="page-btn">1</button>`;
        if (startPage > 2) buttonsHtml += `<span class="text-xs text-gray-400 px-1">…</span>`;
    }

    for (let p = startPage; p <= endPage; p++) {
        buttonsHtml += `
            <button onclick="goToContractPage(${p})" class="page-btn ${p === contractCurrentPage ? 'active' : ''}">
                ${p}
            </button>
        `;
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) buttonsHtml += `<span class="text-xs text-gray-400 px-1">…</span>`;
        buttonsHtml += `<button onclick="goToContractPage(${totalPages})" class="page-btn">${totalPages}</button>`;
    }

    // Tombol Berikutnya (Next)
    buttonsHtml += `
        <button onclick="goToContractPage(${contractCurrentPage + 1})" ${contractCurrentPage === totalPages ? 'disabled' : ''} class="page-btn">
            Next ›
        </button>
    `;

    navEl.innerHTML = buttonsHtml;
}

function goToContractPage(page) {
    contractCurrentPage = page;
    if (lastContractComplianceData) {
        renderContractTable(lastContractComplianceData);
    }
    const section = document.getElementById('sectionContracts');
    if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function changeContractPageSize(newSize) {
    contractPageSize = parseInt(newSize, 10) || 10;
    contractCurrentPage = 1;
    if (lastContractComplianceData) {
        renderContractTable(lastContractComplianceData);
    }
}

function renderEvaluationsTable(evaluations) {
    const tableBody = document.getElementById('evalTableBody');
    if (!tableBody) return;

    const badgeCount = document.getElementById('evalBadgeCount');
    if (badgeCount) {
        badgeCount.textContent = evaluations && evaluations.length > 0
            ? `${evaluations.length} Evaluasi`
            : 'Sheet: Penilaian Vendor';
    }

    if (!evaluations || evaluations.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--text3); padding:2rem;">Belum ada data penilaian vendor. Mulai beri penilaian dari halaman utama.</td></tr>`;
        return;
    }

    // Urutkan dari terbaru
    const sorted = [...evaluations].sort((a, b) => {
        if (a.timestamp && b.timestamp && a.timestamp !== '-' && b.timestamp !== '-') {
            return new Date(b.timestamp) - new Date(a.timestamp);
        }
        return 0;
    });

    tableBody.innerHTML = sorted.map(ev => {
        const score = parseFloat(ev.score) || 0;
        const color = getPredikatColor(score);
        const pred = ev.predikat || getPredikat(score);
        const cleanVendor = (ev.vendor || '').replace(/\r?\n|\r/g, ' ').trim();
        const cleanCatatan = (ev.catatan || '-').replace(/\r?\n|\r/g, ' ').trim();

        return `
        <tr class="hover:bg-blue-50/40 transition-colors">
            <td style="font-size:0.75rem; color:#64748b; white-space:nowrap;">${esc(ev.timestamp)}</td>
            <td style="font-size:0.78rem; color:#475569; white-space:nowrap;">${esc(ev.penilai)}</td>
            <td>
                <div style="font-weight:600; color:#0f172a; max-width:220px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${esc(cleanVendor)}">${esc(cleanVendor)}</div>
            </td>
            <td style="font-size:0.75rem; color:#64748b; white-space:nowrap;">${esc(ev.periode)}</td>
            <td style="text-align:right; font-weight:800; color:${color}; font-size:0.85rem;">${score.toFixed(2)}</td>
            <td style="text-align:center;">
                <span class="predikat-badge" style="background:${color}15; color:${color}; border:1px solid ${color}30; font-size:0.7rem; font-weight:700; padding:1px 6px;">
                    ${esc(pred)}
                </span>
            </td>
            <td>
                <div style="font-size:0.75rem; color:#64748b; max-width:220px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${esc(cleanCatatan)}">${esc(cleanCatatan)}</div>
            </td>
            <td style="text-align:center; white-space:nowrap;">
                <button onclick="openVendorScorecard('${esc(cleanVendor)}')" class="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition shadow-2xs" title="Cetak Rapor Kinerja ${esc(cleanVendor)}">
                    <span>📄 Rapor</span>
                </button>
            </td>
        </tr>`;
    }).join('');
}

// =====================================================
// UTILS
// =====================================================
function esc(str) {
    if (str === undefined || str === null) return '';
    const d = document.createElement('div');
    d.textContent = str.toString();
    return d.innerHTML;
}

function formatRupiah(number) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(number);
}

function getPredikat(score) {
    const val = parseFloat(score);
    if (val >= 4.5) return 'Sangat Baik';
    if (val >= 3.5) return 'Baik';
    if (val >= 2.5) return 'Cukup';
    if (val >= 1.5) return 'Kurang';
    return 'Sangat Kurang';
}

function getPredikatColor(score) {
    if (score >= 4.5) return 'var(--accent)';
    if (score >= 3.5) return '#0284c7';
    if (score >= 2.5) return '#f59e0b';
    return '#ef4444';
}

function showToast(msg, type = 'success') {
    const box = document.getElementById('toastBox');
    if (!box) return;

    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `
        <span class="toast-icon">${type === 'success' ? '✓' : type === 'error' ? '✗' : 'ℹ'}</span>
        <span class="toast-msg">${esc(msg)}</span>
    `;

    box.appendChild(t);
    setTimeout(() => t.classList.add('show'), 10);

    setTimeout(() => {
        t.classList.remove('show');
        setTimeout(() => t.remove(), 400);
    }, 4000);
}

// =====================================================
// CHART.JS RENDERING (GATEKEEPER CLM CHARTS)
// =====================================================
let radarChartInstance = null;
let complianceChartInstance = null;
let currentBidangChartType = 'bar'; // Default to horizontal bar to avoid single-line collapse!

window.setBidangChartType = function(type) {
    currentBidangChartType = type;
    const btnBar = document.getElementById('btnChartBar');
    const btnRadar = document.getElementById('btnChartRadar');
    const badge = document.getElementById('chartBidangBadge');
    if (btnBar && btnRadar) {
        if (type === 'bar') {
            btnBar.className = 'px-2 py-0.5 rounded-md font-semibold text-xs bg-white text-gray-800 shadow-2xs transition';
            btnRadar.className = 'px-2 py-0.5 rounded-md font-semibold text-xs text-gray-500 hover:text-gray-800 transition';
            if (badge) badge.textContent = 'Bar Chart';
        } else {
            btnRadar.className = 'px-2 py-0.5 rounded-md font-semibold text-xs bg-white text-gray-800 shadow-2xs transition';
            btnBar.className = 'px-2 py-0.5 rounded-md font-semibold text-xs text-gray-500 hover:text-gray-800 transition';
            if (badge) badge.textContent = 'Radar Mutu';
        }
    }
    if (window._lastDashboardArgs) {
        renderRadarChart(window._lastDashboardArgs.vendors, window._lastDashboardArgs.scoreSummary, window._lastDashboardArgs.kategori);
    }
};

function renderRadarChart(vendors, scoreSummary, kategori) {
    const canvas = document.getElementById('radarChart');
    if (!canvas) return;

    const catScores = {};
    if (vendors && scoreSummary) {
        vendors.forEach(v => {
            const name = v.nama;
            const catCode = v.kategori || 'GENERAL';
            const evalData = scoreSummary[name];
            if (evalData) {
                if (!catScores[catCode]) {
                    const catInfo = (kategori && kategori.find(c => c.kode === catCode)) || { nama: catCode, ikon: '📦' };
                    catScores[catCode] = { code: catCode, label: catInfo.nama, icon: catInfo.ikon || '📦', sum: 0, count: 0 };
                }
                catScores[catCode].sum += evalData.avgScore;
                catScores[catCode].count++;
            }
        });
    }

    const radarMetaEl = document.getElementById('radarSummaryMeta');
    const evaluatedCatCount = Object.keys(catScores).length;

    if (radarChartInstance) radarChartInstance.destroy();

    if (currentBidangChartType === 'bar') {
        // ========== HORIZONTAL BAR CHART (ADAPTIF & BERSIH) ==========
        const barItems = [];
        for (const code in catScores) {
            const cat = catScores[code];
            const avg = parseFloat((cat.sum / cat.count).toFixed(2));
            barItems.push({
                label: `${cat.icon} ${cat.label}`,
                score: avg,
                count: cat.count
            });
        }
        barItems.sort((a, b) => b.score - a.score);

        if (barItems.length === 0) {
            barItems.push({ label: 'Belum ada penilaian bidang', score: 0, count: 0 });
        }

        const labels = barItems.map(b => b.label);
        const data = barItems.map(b => b.score);
        const bgColors = data.map(val => val >= 4.0 ? '#10b981' : val >= 3.0 ? '#3b82f6' : val >= 2.0 ? '#f59e0b' : '#ef4444');

        if (radarMetaEl) {
            radarMetaEl.textContent = evaluatedCatCount > 0
                ? `Rata-rata performa mutu pada ${evaluatedCatCount} bidang rekanan aktif`
                : 'Belum ada data evaluasi untuk bidang rekanan';
        }

        radarChartInstance = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Skor Mutu (1-5)',
                    data: data,
                    backgroundColor: bgColors,
                    borderRadius: 6,
                    barThickness: Math.min(32, Math.max(18, 120 / (labels.length || 1)))
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        beginAtZero: true,
                        max: 5,
                        grid: { color: '#f1f5f9' },
                        ticks: {
                            stepSize: 1,
                            font: { size: 10, weight: '600' },
                            color: '#64748b'
                        }
                    },
                    y: {
                        grid: { display: false },
                        ticks: {
                            font: { size: 11, weight: '600' },
                            color: '#1e293b'
                        }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#1e293b',
                        titleFont: { size: 12, weight: '700' },
                        bodyFont: { size: 11 },
                        padding: 8,
                        cornerRadius: 8,
                        callbacks: {
                            label: function(ctx) { return ` Skor Rata-rata: ${ctx.raw} / 5.0`; }
                        }
                    }
                }
            }
        });
    } else {
        // ========== RADAR CHART (DENGAN MASTER CATEGORIES AGAR TIDAK MENGKERUT) ==========
        const allCategories = (kategori && kategori.length > 0) ? kategori : [
            { kode: 'ITSoftware', nama: 'IT & Software', ikon: '💻' },
            { kode: 'BarangJasa', nama: 'Pengadaan Barang & Jasa', ikon: '📦' },
            { kode: 'KOLInfPodcast', nama: 'KOL & Media', ikon: '🎙️' }
        ];

        const labels = [];
        const data = [];
        allCategories.forEach(cat => {
            labels.push(`${cat.ikon || '📦'} ${cat.nama}`);
            if (catScores[cat.kode]) {
                data.push(parseFloat((catScores[cat.kode].sum / catScores[cat.kode].count).toFixed(2)));
            } else {
                data.push(0);
            }
        });

        if (radarMetaEl) {
            radarMetaEl.textContent = evaluatedCatCount > 0
                ? `Memetakan polygon mutu pada ${allCategories.length} kategori rekanan`
                : 'Belum ada data evaluasi untuk bidang rekanan';
        }

        radarChartInstance = new Chart(canvas, {
            type: 'radar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Skor Rata-rata',
                    data: data,
                    backgroundColor: 'rgba(59, 130, 246, 0.18)',
                    borderColor: '#2563eb',
                    borderWidth: 2,
                    pointBackgroundColor: '#2563eb',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    r: {
                        beginAtZero: true,
                        max: 5,
                        ticks: {
                            stepSize: 1,
                            font: { size: 10 },
                            backdropColor: 'transparent'
                        },
                        pointLabels: {
                            font: { size: 10, weight: '600' },
                            color: '#334155'
                        },
                        grid: { color: '#e2e8f0' },
                        angleLines: { color: '#e2e8f0' }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#1e293b',
                        titleFont: { size: 12, weight: '700' },
                        bodyFont: { size: 11 },
                        padding: 8,
                        cornerRadius: 8,
                        callbacks: {
                            label: function(ctx) { return `Skor: ${ctx.raw} / 5.0`; }
                        }
                    }
                }
            }
        });
    }
}

let predicateChartInstance = null;

function renderPredicateChart(scoreSummary) {
    const canvas = document.getElementById('predicateChart');
    if (!canvas) return;

    let sangatBaik = 0;
    let baik = 0;
    let cukup = 0;
    let kurang = 0;

    if (scoreSummary) {
        for (let name in scoreSummary) {
            const score = scoreSummary[name].avgScore;
            if (score >= 4.5) sangatBaik++;
            else if (score >= 3.5) baik++;
            else if (score >= 2.5) cukup++;
            else kurang++;
        }
    }

    const total = sangatBaik + baik + cukup + kurang;

    // Update counter labels di bawah chart
    const elSB = document.getElementById('distSangatBaikCount');
    const elB = document.getElementById('distBaikCount');
    const elC = document.getElementById('distCukupCount');
    const elK = document.getElementById('distKurangCount');
    if (elSB) elSB.textContent = sangatBaik;
    if (elB) elB.textContent = baik;
    if (elC) elC.textContent = cukup;
    if (elK) elK.textContent = kurang;

    if (predicateChartInstance) predicateChartInstance.destroy();

    const noData = (total === 0);

    predicateChartInstance = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: noData ? ['Belum ada penilaian'] : ['Sangat Baik (≥ 4.5)', 'Baik (3.5 - 4.4)', 'Cukup (2.5 - 3.4)', 'Kurang (< 2.5)'],
            datasets: [{
                data: noData ? [1] : [sangatBaik, baik, cukup, kurang],
                backgroundColor: noData ? ['#e2e8f0'] : ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'],
                borderColor: '#ffffff',
                borderWidth: 3,
                hoverOffset: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            cutout: '68%',
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#0f172a',
                    titleFont: { size: 12, weight: '700' },
                    bodyFont: { size: 11 },
                    padding: 8,
                    cornerRadius: 8,
                    callbacks: {
                        label: function(ctx) {
                            if (noData) return 'Belum ada data evaluasi';
                            const val = ctx.raw;
                            const pct = total > 0 ? Math.round((val / total) * 100) : 0;
                            return `${ctx.label}: ${val} rekanan (${pct}%)`;
                        }
                    }
                }
            }
        },
        plugins: [{
            id: 'centerTextPredicate',
            afterDraw(chart) {
                const { ctx, chartArea } = chart;
                const centerX = (chartArea.left + chartArea.right) / 2;
                const centerY = (chartArea.top + chartArea.bottom) / 2;

                ctx.save();
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                ctx.font = 'bold 22px Inter, sans-serif';
                ctx.fillStyle = '#0f172a';
                ctx.fillText(`${total}`, centerX, centerY - 6);

                ctx.font = '600 9px Inter, sans-serif';
                ctx.fillStyle = '#64748b';
                ctx.fillText('Vendor Dinilai', centerX, centerY + 12);

                ctx.restore();
            }
        }]
    });
}

function renderComplianceChart(cc) {
    const canvas = document.getElementById('complianceChart');
    if (!canvas) return;

    const comply = cc.uniqueCompliantVendors || 0;
    const notComply = Math.max((cc.uniqueContractedVendors || 0) - comply, 0);
    const noContract = (comply === 0 && notComply === 0) ? 1 : 0;

    if (complianceChartInstance) complianceChartInstance.destroy();

    complianceChartInstance = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: noContract ? ['Belum ada kontrak'] : ['Comply', 'Not Comply'],
            datasets: [{
                data: noContract ? [1] : [comply, notComply],
                backgroundColor: noContract ? ['#e2e8f0'] : ['#10b981', '#ef4444'],
                borderColor: '#fff',
                borderWidth: 3,
                hoverOffset: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            cutout: '68%',
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1e293b',
                    titleFont: { size: 12, weight: '700' },
                    bodyFont: { size: 11 },
                    padding: 8,
                    cornerRadius: 8,
                    callbacks: {
                        label: function(ctx) {
                            if (noContract) return 'Belum ada data kontrak';
                            const total = comply + notComply;
                            const pct = total > 0 ? Math.round((ctx.raw / total) * 100) : 0;
                            return `${ctx.label}: ${ctx.raw} vendor (${pct}%)`;
                        }
                    }
                }
            }
        },
        plugins: [{
            id: 'centerText',
            afterDraw(chart) {
                const { ctx, chartArea } = chart;
                const centerX = (chartArea.left + chartArea.right) / 2;
                const centerY = (chartArea.top + chartArea.bottom) / 2;
                const rate = cc.vendorComplianceRate != null ? cc.vendorComplianceRate : 100;

                ctx.save();
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                ctx.font = 'bold 22px Inter, sans-serif';
                ctx.fillStyle = '#1e293b';
                ctx.fillText(`${rate}%`, centerX, centerY - 6);

                ctx.font = '600 9px Inter, sans-serif';
                ctx.fillStyle = '#64748b';
                ctx.fillText('Compliance', centerX, centerY + 12);

                ctx.restore();
            }
        }]
    });
}

// =====================================================
// KRALJIC PORTFOLIO MATRIX (FITUR 3)
// =====================================================
function renderKraljicMatrix(vendors, scoreSummary, poStats, cc, kategori) {
    const listStrategicEl = document.getElementById('kraljicListStrategic');
    const listLeverageEl = document.getElementById('kraljicListLeverage');
    const listBottleneckEl = document.getElementById('kraljicListBottleneck');
    const listRoutineEl = document.getElementById('kraljicListRoutine');

    if (!listStrategicEl || !listLeverageEl || !listBottleneckEl || !listRoutineEl) return;

    const vendorMap = {};
    (vendors || []).forEach(v => {
        const name = (typeof v === 'object' ? v.nama : v) || '';
        if (name) vendorMap[name] = typeof v === 'object' ? v : { nama: name };
    });

    // Hitung total belanja (spend) per vendor dari poStats
    const spendList = [];
    const vendorItems = Object.keys(vendorMap).map(name => {
        const poData = (poStats && poStats.vendorMap && poStats.vendorMap[name]) || null;
        const totalValue = poData ? (poData.totalValue || 0) : 0;
        const totalPo = poData ? (poData.totalPo || 0) : 0;
        const scoreInfo = (scoreSummary && scoreSummary[name]) || null;
        const avgScore = scoreInfo ? scoreInfo.avgScore : 0;
        const vObj = vendorMap[name];
        const cat = (vObj.kategori || '').toLowerCase();

        // Kategori risiko tinggi: IT, Mesin, Bahan Baku, Jasa Kritis, atau score < 3.0
        const isHighRiskCategory = cat.includes('it') || cat.includes('teknologi') || cat.includes('mesin') || cat.includes('aset') || cat.includes('alat') || cat.includes('raw') || cat.includes('bahan');
        const isHighRisk = isHighRiskCategory || (avgScore > 0 && avgScore < 3.0);

        if (totalValue > 0) spendList.push(totalValue);
        else if (totalPo > 0) spendList.push(totalPo * 1000000); // estimasi nilai per PO

        return {
            name: name,
            category: vObj.kategori || 'General',
            spend: totalValue > 0 ? totalValue : (totalPo * 1000000),
            totalPo: totalPo,
            avgScore: avgScore,
            isHighRisk: isHighRisk
        };
    });

    // Hitung median spend
    spendList.sort((a, b) => a - b);
    const medianSpend = spendList.length > 0 ? spendList[Math.floor(spendList.length / 2)] : 5000000;

    const strategicList = [];
    const leverageList = [];
    const bottleneckList = [];
    const routineList = [];

    vendorItems.forEach(item => {
        const isHighSpend = item.spend >= medianSpend && item.spend > 0;
        if (isHighSpend && item.isHighRisk) {
            strategicList.push(item);
        } else if (isHighSpend && !item.isHighRisk) {
            leverageList.push(item);
        } else if (!isHighSpend && item.isHighRisk) {
            bottleneckList.push(item);
        } else {
            routineList.push(item);
        }
    });

    // Update Counter Badges
    const elTotKraljic = document.getElementById('kraljicTotalVendorsCount');
    const elCountStrat = document.getElementById('kraljicCountStrategic');
    const elCountLev = document.getElementById('kraljicCountLeverage');
    const elCountBot = document.getElementById('kraljicCountBottleneck');
    const elCountRout = document.getElementById('kraljicCountRoutine');

    if (elTotKraljic) elTotKraljic.textContent = `${vendorItems.length} Rekanan Terpetakan`;
    if (elCountStrat) elCountStrat.textContent = `${strategicList.length} Vendor`;
    if (elCountLev) elCountLev.textContent = `${leverageList.length} Vendor`;
    if (elCountBot) elCountBot.textContent = `${bottleneckList.length} Vendor`;
    if (elCountRout) elCountRout.textContent = `${routineList.length} Vendor`;

    function renderKraljicPillList(list, badgeColor) {
        if (list.length === 0) {
            return `<div class="text-[11px] text-gray-400 italic py-3 text-center">Belum ada rekanan di kuadran ini.</div>`;
        }
        return `
        <div class="flex items-center gap-1.5 flex-wrap">
            ${list.map(v => `
                <button onclick="openVendorScorecard('${esc(v.name)}')" class="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border ${badgeColor} text-xs font-semibold transition hover:shadow-xs group cursor-pointer" title="Cetak Rapor Kinerja: ${esc(v.name)}">
                    <span class="truncate max-w-[130px] sm:max-w-[170px] text-gray-900 group-hover:text-blue-600">${esc(v.name)}</span>
                    <span class="text-[10px] font-mono px-1 py-0.2 bg-white rounded border border-gray-200/80 text-gray-600">${v.avgScore > 0 ? v.avgScore.toFixed(1) + '★' : v.totalPo + ' PO'}</span>
                    <span class="text-[10px] text-blue-600 opacity-60 group-hover:opacity-100">📄</span>
                </button>
            `).join('')}
        </div>`;
    }

    listStrategicEl.innerHTML = renderKraljicPillList(strategicList, 'border-purple-200 bg-purple-50/60');
    listLeverageEl.innerHTML = renderKraljicPillList(leverageList, 'border-blue-200 bg-blue-50/60');
    listBottleneckEl.innerHTML = renderKraljicPillList(bottleneckList, 'border-amber-200 bg-amber-50/60');
    listRoutineEl.innerHTML = renderKraljicPillList(routineList, 'border-gray-200 bg-gray-50/60');
}

// =====================================================
// VENDOR SCORECARD OFFICIAL PDF (FITUR 5)
// =====================================================
function calculateDeliveryDeviation(expDate, effDate) {
    if (!expDate || !effDate || effDate === 'Belum Diterima' || effDate === '-' || expDate === '-') {
        return { text: 'Belum Diterima', color: 'text-amber-600 font-medium', isLate: false };
    }
    const dExp = new Date(expDate);
    const dEff = new Date(effDate);
    if (isNaN(dExp.getTime()) || isNaN(dEff.getTime())) {
        return { text: '-', color: 'text-gray-400', isLate: false };
    }
    const diffDays = Math.round((dEff - dExp) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) {
        return { text: `${Math.abs(diffDays)} hari lebih cepat`, color: 'text-emerald-700 font-semibold', isLate: false };
    } else if (diffDays === 0) {
        return { text: 'Tepat hari-H', color: 'text-blue-700 font-semibold', isLate: false };
    } else if (diffDays === 1) {
        return { text: 'Tepat waktu (H+1)', color: 'text-emerald-700 font-semibold', isLate: false };
    } else {
        return { text: `Terlambat ${diffDays} hari`, color: 'text-rose-700 font-bold', isLate: true };
    }
}

function openVendorScorecard(vendorName) {
    if (!vendorName) return;

    const modal = document.getElementById('vendorScorecardModal');
    const printArea = document.getElementById('scorecardPrintArea');
    if (!modal || !printArea) return;

    const vInfo = (dashboardData && dashboardData.vendors && dashboardData.vendors.find(v => v.nama === vendorName)) || { nama: vendorName };
    const scoreData = (dashboardData && dashboardData.scoreSummary && dashboardData.scoreSummary[vendorName]) || null;
    const poData = (dashboardData && dashboardData.poStats && dashboardData.poStats.vendorMap && dashboardData.poStats.vendorMap[vendorName]) || null;
    const contractData = (dashboardData && dashboardData.contractCompliance && dashboardData.contractCompliance.list && dashboardData.contractCompliance.list.find(c => c.vendor === vendorName)) || null;
    const evals = (dashboardData && dashboardData.evaluationsList && dashboardData.evaluationsList.filter(e => e.vendor === vendorName)) || [];

    const avgScore = scoreData ? parseFloat(scoreData.avgScore || 0) : (evals.length > 0 ? (evals.reduce((sum, e) => sum + (parseFloat(e.score) || 0), 0) / evals.length) : 0);
    const predikat = scoreData ? scoreData.predikat : getPredikat(avgScore);
    const score100 = Math.round((avgScore / 5) * 100);

    const totalPo = poData ? (poData.totalPo || 0) : 0;
    const onTimePo = poData ? (poData.onTimePo || 0) : 0;
    const latePo = poData ? (poData.latePo || 0) : 0;
    const onTimeRatePct = poData ? (poData.onTimeRatePct || 100) : 100;
    const totalSpend = poData ? (poData.totalValue || 0) : (contractData ? contractData.nilai : 0);

    const onTimePct = totalPo > 0 ? Math.round((onTimePo / totalPo) * 100) : 100;
    const latePct = totalPo > 0 ? Math.round((latePo / totalPo) * 100) : 0;

    // Kumpulkan seluruh data riwayat pesanan PO milik vendor ini
    const vNameLower = vendorName.toLowerCase().trim();
    let vendorOrders = [];
    if (dashboardData && Array.isArray(dashboardData.allRawOrders)) {
        vendorOrders = dashboardData.allRawOrders.filter(o => (o.vendor || '').toLowerCase().trim() === vNameLower);
    }
    if (vendorOrders.length === 0 && dashboardData && dashboardData.periods) {
        for (const pk in dashboardData.periods) {
            const pObj = dashboardData.periods[pk];
            if (pObj && Array.isArray(pObj.rawOrders)) {
                vendorOrders.push(...pObj.rawOrders.filter(o => (o.vendor || '').toLowerCase().trim() === vNameLower));
            }
        }
    }
    if (vendorOrders.length === 0 && poData && Array.isArray(poData.recentOrders)) {
        vendorOrders = [...poData.recentOrders];
    }

    // Hitung komoditas / produk utama yang disuplai
    const productFrequency = {};
    vendorOrders.forEach(o => {
        const pName = (o.product || '').trim();
        if (pName && pName !== '-') {
            productFrequency[pName] = (productFrequency[pName] || 0) + 1;
        }
    });
    const topProducts = Object.entries(productFrequency)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4);

    let topProductsHtml = '';
    if (topProducts.length > 0) {
        topProductsHtml = `
            <div class="mt-2.5 pt-2.5 border-t border-gray-200/80">
                <div class="flex items-center gap-1.5 flex-wrap text-xs">
                    <span class="text-[10px] font-bold text-gray-500 uppercase tracking-wider mr-1">Komoditas Utama:</span>
                    ${topProducts.map(([pName, count]) => `
                        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-white text-gray-800 border border-gray-200 shadow-2xs">
                            <span class="font-bold text-blue-600">${count}x</span>
                            <span class="text-gray-700 truncate max-w-[200px]" title="${esc(pName)}">${esc(pName)}</span>
                        </span>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // Riwayat Log Pesanan PO Detail (Format 4 Kolom Proporsional & Bebas Terpotong)
    let recentOrdersTableHtml = '';
    if (vendorOrders.length > 0) {
        const displayLimit = 10;
        const visibleOrders = vendorOrders.slice(0, displayLimit);
        const remainingCount = vendorOrders.length - displayLimit;

        const renderPoRow = (o) => {
            const dev = calculateDeliveryDeviation(o.expectedDate, o.effectiveDate);
            const isFinishedOnTime = o.isOnTime;
            const statusBadge = isFinishedOnTime
                ? `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">✅ Tepat Waktu</span>`
                : (o.status && o.status.toLowerCase().includes('proses') 
                    ? `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-blue-50 text-blue-700 border border-blue-200">⏳ Proses</span>`
                    : `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-rose-50 text-rose-700 border border-rose-200">⚠️ Terlambat</span>`);

            return `
                <tr class="hover:bg-gray-50/80 border-b border-gray-100 text-[11px]">
                    <td class="py-2 px-2.5 font-mono font-bold text-blue-700 whitespace-nowrap align-top">
                        <span title="${esc(o.poNum || '-')}">${esc(o.poNum || '-')}</span>
                    </td>
                    <td class="py-2 px-2.5 text-gray-800 font-medium align-top">
                        <div class="line-clamp-2" title="${esc(o.product || '-')}">${esc(o.product || '-')}</div>
                    </td>
                    <td class="py-2 px-2.5 whitespace-nowrap align-top text-[10px]">
                        <div class="text-gray-500 font-mono">Tgt: <span class="text-gray-700">${esc(o.expectedDate || '-')}</span></div>
                        <div class="text-gray-500 font-mono mt-0.5">Rls: <span class="font-bold text-gray-900">${esc(o.effectiveDate || '-')}</span></div>
                    </td>
                    <td class="py-2 px-2.5 text-right whitespace-nowrap align-top">
                        <div>${statusBadge}</div>
                        <div class="text-[9.5px] mt-0.5 ${dev.color}">${esc(dev.text)}</div>
                    </td>
                </tr>
            `;
        };

        const rowsHtml = visibleOrders.map(renderPoRow).join('');
        let hiddenRowsHtml = '';
        if (remainingCount > 0) {
            hiddenRowsHtml = vendorOrders.slice(displayLimit).map(renderPoRow).join('');
        }

        recentOrdersTableHtml = `
            <div class="mt-3.5 pt-3 border-t border-gray-200/80">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                        📋 Riwayat Transaksi Pemesanan (Log Detail PO):
                    </span>
                    <span class="text-[10px] text-gray-500 font-medium">
                        Menampilkan ${visibleOrders.length} dari ${vendorOrders.length} pesanan tercatat
                    </span>
                </div>
                <div class="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-2xs">
                    <table class="w-full text-left border-collapse table-fixed">
                        <colgroup>
                            <col class="w-[28%] sm:w-[25%]">
                            <col class="w-[38%] sm:w-[41%]">
                            <col class="w-[18%] sm:w-[17%]">
                            <col class="w-[16%] sm:w-[17%]">
                        </colgroup>
                        <thead class="bg-gray-100/90 text-gray-700 font-bold uppercase text-[9.5px]">
                            <tr>
                                <th class="py-2 px-2.5 border-b border-gray-200">No. PO</th>
                                <th class="py-2 px-2.5 border-b border-gray-200">Komoditas / Produk</th>
                                <th class="py-2 px-2.5 border-b border-gray-200">Jadwal &amp; Realisasi</th>
                                <th class="py-2 px-2.5 border-b border-gray-200 text-right">Status SLA</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-100">
                            ${rowsHtml}
                        </tbody>
                        ${remainingCount > 0 ? `
                        <tbody id="scorecardExtraPoRows" style="display: none;" class="divide-y divide-gray-100">
                            ${hiddenRowsHtml}
                        </tbody>
                        ` : ''}
                    </table>
                </div>
                ${remainingCount > 0 ? `
                    <div class="text-center mt-2.5 no-print">
                        <button type="button" onclick="toggleScorecardExtraPo()" id="btnToggleExtraPo" class="px-3 py-1 rounded-md text-[11px] font-semibold bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 shadow-2xs transition cursor-pointer">
                            ▼ Tampilkan Seluruh (${vendorOrders.length}) Riwayat Pesanan
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    }

    // Rekomendasi Sourcing
    let recBadge = '';
    let recDesc = '';
    if (avgScore >= 4.0 && onTimeRatePct >= 85) {
        recBadge = `<span class="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">⭐ PREFERRED SUPPLIER (Prioritas Pengadaan)</span>`;
        recDesc = 'Performa sangat memuaskan, kualitas layanan prima, dan pengiriman tepat waktu tinggi. Direkomendasikan untuk kontrak prioritas.';
    } else if (avgScore >= 3.0 && onTimeRatePct >= 70) {
        recBadge = `<span class="px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300">✅ QUALIFIED SUPPLIER (Pertahankan)</span>`;
        recDesc = 'Performa memenuhi standar operasional. Dapat dipertahankan untuk kerjasama berkelanjutan dengan pemantauan rutin.';
    } else if (avgScore >= 2.0) {
        recBadge = `<span class="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">⚠️ CONDITIONAL (Perlu Pembinaan)</span>`;
        recDesc = 'Performa di bawah ekspektasi. Dibutuhkan evaluasi dan rencana perbaikan (CAPA) sebelum alokasi penambahan pesanan.';
    } else {
        recBadge = `<span class="px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">❌ UNDER REVIEW (Tinjau Ulang)</span>`;
        recDesc = 'Performa kritis / tidak memenuhi standar minimum. Disarankan peninjauan ulang kelayakan kerjasama atau penghentian kontrak.';
    }

    const todayStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    const periodLabel = (slicerState && slicerState.period !== 'all') ? slicerState.period : 'Akumulasi Seluruh Periode';
    const docNo = `EK-VMS/REP/${new Date().getFullYear()}/${vendorName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase()}`;

    // Ekstrak catatan evaluasi
    const catatanList = evals.map(e => (e.catatan || '').trim()).filter(c => c && c !== '-');

    printArea.innerHTML = `
        <div class="border-b-2 border-gray-800 pb-5 mb-6">
            <div class="flex items-start justify-between gap-4">
                <div class="flex items-center gap-4">
                    <img src="assets/logo-ethos.png" alt="PT Ethos Kreatif Indonesia" class="h-12 w-auto object-contain">
                    <div>
                        <h2 class="text-base font-extrabold text-gray-900 tracking-tight leading-snug">PT ETHOS KREATIF INDONESIA</h2>
                        <p class="text-xs text-gray-500 font-medium">Head Office &amp; Operations · Vendor Management &amp; Procurement System</p>
                    </div>
                </div>
                <div class="text-right">
                    <span class="inline-block px-2.5 py-0.5 rounded text-[11px] font-mono font-bold bg-gray-100 border border-gray-300 text-gray-800">${docNo}</span>
                    <div class="text-[11px] text-gray-500 mt-1">Tanggal Terbit: <strong>${todayStr}</strong></div>
                    <div class="text-[11px] text-gray-500">Periode: <strong>${periodLabel}</strong></div>
                </div>
            </div>
            <div class="mt-4 text-center">
                <h1 class="text-lg sm:text-xl font-black text-gray-900 uppercase tracking-wide">RAPOR EVALUASI &amp; KINERJA REKANAN</h1>
                <p class="text-xs text-gray-500">Official Vendor Performance Scorecard &amp; SLA Fulfillment Report</p>
            </div>
        </div>

        <!-- 1. IDENTITAS REKANAN -->
        <div class="mb-5 bg-gray-50/80 rounded-xl border border-gray-200 p-4">
            <h3 class="text-xs font-bold text-gray-800 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <span>🏢</span>
                <span>Identitas &amp; Profil Rekanan</span>
            </h3>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                    <span class="text-gray-500 block">Nama Rekanan:</span>
                    <strong class="text-gray-900 text-sm font-bold block">${esc(vendorName)}</strong>
                </div>
                <div>
                    <span class="text-gray-500 block">Kategori / Bidang:</span>
                    <strong class="text-gray-900 block">${esc(vInfo.kategori || contractData?.jenisPekerjaan || 'Barang/Jasa')}</strong>
                </div>
                <div>
                    <span class="text-gray-500 block">No. Kontrak / PKS:</span>
                    <strong class="text-gray-900 block font-mono">${esc(contractData?.noKontrak || 'PKS-TERDAFTAR')}</strong>
                </div>
                <div>
                    <span class="text-gray-500 block">Status Kepatuhan:</span>
                    <strong class="text-gray-900 block">${contractData?.status ? esc(contractData.status) : 'Comply (Terdaftar)'}</strong>
                </div>
            </div>
        </div>

        <!-- 2. EXECUTIVE SUMMARY METRICS -->
        <div class="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div class="p-4 rounded-xl border border-blue-200 bg-blue-50/50 text-center">
                <div class="text-xs font-bold text-blue-900 uppercase">Skor Kinerja Rata-rata</div>
                <div class="text-3xl font-black text-blue-600 mt-1">${avgScore > 0 ? avgScore.toFixed(2) : 'Belum Dinilai'}</div>
                <div class="text-xs text-blue-800 font-semibold mt-1">Skala 5.00 (${score100} / 100)</div>
            </div>
            <div class="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 text-center">
                <div class="text-xs font-bold text-emerald-900 uppercase">Ketepatan Pengiriman (SLA)</div>
                <div class="text-3xl font-black text-emerald-600 mt-1">${onTimeRatePct}%</div>
                <div class="text-xs text-emerald-800 font-semibold mt-1">${onTimePo} tepat waktu dari ${totalPo} PO</div>
            </div>
            <div class="p-4 rounded-xl border border-purple-200 bg-purple-50/50 text-center">
                <div class="text-xs font-bold text-purple-900 uppercase">Predikat Evaluasi</div>
                <div class="text-2xl font-black text-purple-700 mt-1.5">${esc(predikat)}</div>
                <div class="text-xs text-purple-800 font-semibold mt-1">${evals.length} sesi penilaian tercatat</div>
            </div>
        </div>

        <!-- 3. STATUS REKOMENDASI PENGADAAN -->
        <div class="mb-6 p-4 rounded-xl border border-gray-200 bg-white shadow-2xs">
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-1.5">
                <span class="text-xs font-bold text-gray-700 uppercase tracking-wider">Status Rekomendasi Sourcing:</span>
                <div>${recBadge}</div>
            </div>
            <p class="text-xs text-gray-600 leading-relaxed">${recDesc}</p>
        </div>

        <!-- 4. LOGISTIK & RIWAYAT PEMESANAN (PO SLA) -->
        <div class="mb-6 bg-gray-50/70 rounded-xl border border-gray-200 p-4">
            <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
                <h3 class="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                    <span>📦</span>
                    <span>Rekam Jejak Pemesanan &amp; Logistik (PO SLA)</span>
                </h3>
                <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold ${onTimeRatePct >= 80 ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-rose-100 text-rose-800 border border-rose-300'}">
                    ${onTimeRatePct >= 80 ? '🟢 Memenuhi Standar SLA (≥80%)' : '🔴 Di Bawah Standar SLA (<80%)'}
                </span>
            </div>

            <!-- Metrik Grid 4 Kolom Bersih -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-2.5 text-center">
                <div class="bg-white p-2.5 rounded-lg border border-gray-200 shadow-2xs">
                    <span class="text-[10px] font-bold text-gray-500 uppercase block">Total Pesanan PO</span>
                    <strong class="text-base font-black text-gray-900 block mt-0.5">${totalPo} PO</strong>
                    <span class="text-[10px] text-gray-500 font-mono font-medium block truncate" title="${totalSpend > 0 ? formatRupiah(totalSpend) : '-'}">${totalSpend > 0 ? formatRupiah(totalSpend) : '-'}</span>
                </div>
                <div class="bg-white p-2.5 rounded-lg border border-emerald-200/80 shadow-2xs">
                    <span class="text-[10px] font-bold text-emerald-800 uppercase block">Tepat Waktu</span>
                    <strong class="text-base font-black text-emerald-600 block mt-0.5">✅ ${onTimePo} PO</strong>
                    <span class="text-[10px] text-emerald-700 font-semibold block">${onTimePct}% on-time</span>
                </div>
                <div class="bg-white p-2.5 rounded-lg border border-rose-200/80 shadow-2xs">
                    <span class="text-[10px] font-bold text-rose-800 uppercase block">Terlambat</span>
                    <strong class="text-base font-black text-rose-600 block mt-0.5">⚠️ ${latePo} PO</strong>
                    <span class="text-[10px] text-rose-700 font-semibold block">${latePct}% delayed</span>
                </div>
                <div class="bg-white p-2.5 rounded-lg border border-blue-200/80 shadow-2xs">
                    <span class="text-[10px] font-bold text-blue-800 uppercase block">On-Time SLA Rate</span>
                    <strong class="text-base font-black ${onTimeRatePct >= 80 ? 'text-emerald-600' : 'text-rose-600'} block mt-0.5 font-mono">${onTimeRatePct}%</strong>
                    <span class="text-[10px] text-gray-500 font-medium block">Target Min: 80%</span>
                </div>
            </div>

            <!-- Visual Bar SLA Ramping -->
            <div class="mb-1">
                <div class="w-full bg-gray-200 h-2 rounded-full overflow-hidden flex">
                    <div style="width: ${onTimePct}%" class="bg-emerald-500 h-full" title="Tepat Waktu: ${onTimePct}%"></div>
                    <div style="width: ${latePct}%" class="bg-rose-500 h-full" title="Terlambat: ${latePct}%"></div>
                </div>
            </div>

            <!-- Top Komoditas yang Disuplai -->
            ${topProductsHtml}

            <!-- Log Detail Transaksi PO -->
            ${recentOrdersTableHtml}
        </div>

        <!-- 5. CATATAN & AREA PERBAIKAN -->
        <div class="mb-8">
            <h3 class="text-xs font-bold text-gray-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <span>📝</span>
                <span>Catatan Evaluator &amp; Area Perbaikan</span>
            </h3>
            <div class="p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-700 leading-relaxed min-h-[60px]">
                ${catatanList.length > 0 
                    ? `<ul class="list-disc list-inside space-y-1">${catatanList.map(c => `<li>${esc(c)}</li>`).join('')}</ul>` 
                    : '<p class="text-gray-400 italic">Tidak ada catatan kendala khusus yang dilaporkan oleh penilai pada periode ini.</p>'}
            </div>
        </div>

        <!-- 6. LEMBAR PENGESAHAN TANDA TANGAN -->
        <div class="pt-6 border-t border-gray-200">
            <div class="grid grid-cols-3 gap-6 text-center text-xs">
                <div>
                    <span class="text-gray-500 block mb-1">Dipersiapkan Oleh:</span>
                    <strong class="text-gray-900 block font-bold">Procurement / Purchasing</strong>
                    <div class="h-16"></div>
                    <div class="border-b border-gray-400 mx-6"></div>
                    <span class="text-[10px] text-gray-400 mt-1 block">Staff Pengadaan</span>
                </div>
                <div>
                    <span class="text-gray-500 block mb-1">Ditinjau Oleh:</span>
                    <strong class="text-gray-900 block font-bold">Vendor Management</strong>
                    <div class="h-16"></div>
                    <div class="border-b border-gray-400 mx-6"></div>
                    <span class="text-[10px] text-gray-400 mt-1 block">VMS Officer / Supervisor</span>
                </div>
                <div>
                    <span class="text-gray-500 block mb-1">Disetujui Oleh:</span>
                    <strong class="text-gray-900 block font-bold">Management</strong>
                    <div class="h-16"></div>
                    <div class="border-b border-gray-400 mx-6"></div>
                    <span class="text-[10px] text-gray-400 mt-1 block">Direksi / Head of Operations</span>
                </div>
            </div>
        </div>
    `;

    modal.style.display = 'flex';
    const scrollContainer = document.getElementById('scorecardScrollContainer');
    if (scrollContainer) scrollContainer.scrollTop = 0;
}

function closeVendorScorecard() {
    const modal = document.getElementById('vendorScorecardModal');
    if (modal) modal.style.display = 'none';
}

// Tutup modal rapor dengan tombol Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeVendorScorecard();
    }
});

function toggleScorecardExtraPo() {
    const extraRows = document.getElementById('scorecardExtraPoRows');
    const btn = document.getElementById('btnToggleExtraPo');
    if (!extraRows || !btn) return;
    if (extraRows.style.display === 'none') {
        extraRows.style.display = 'table-row-group';
        btn.textContent = '▲ Sembunyikan Riwayat Tambahan';
    } else {
        extraRows.style.display = 'none';
        btn.textContent = '▼ Tampilkan Seluruh Riwayat Pesanan';
    }
}


