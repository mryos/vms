// =====================================================
// KONFIGURASI
// Ganti URL di bawah dengan URL Web App Google Apps Script Anda
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxZPk7gIhZ75OPAgdS8PD_AGRBmC3d7BdP2ZtqhJXJEbD6V4Tdil4HiYCnFiL-FLNx_Fw/exec';

// =====================================================
// STATE & INIT
// =====================================================
let dashboardData = null;
let activeTab = 'all';
let slicerState = {
    period: 'all',
    category: 'all',
    compliance: 'all', // 'all' | 'comply' | 'not-comply'
    tier: 'all' // 'all' | 'high' | 'good' | 'poor'
};
let catalogSearchQuery = '';
let catalogViewMode = 'group'; // 'group' | 'raw'

document.addEventListener('DOMContentLoaded', () => {
    checkAdminAccess();
});

function checkAdminAccess() {
    const savedPin = localStorage.getItem('ethos_pin');
    const authOverlay = document.getElementById('adminAuthOverlay');
    
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
            if (errEl) errEl.style.display = 'none';
            if (authOverlay) authOverlay.style.display = 'none';
            initHeader();
            initTabs();
            loadDashboardData();
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
    const chartsSec = document.getElementById('chartsSection');
    const contractsSec = document.getElementById('sectionContracts');
    const evalSec = document.getElementById('sectionEvaluations');
    const perfSec = document.getElementById('sectionPerformance');
    const ordersCol = document.getElementById('sectionOrders');
    const catalogSec = document.getElementById('sectionCatalog');

    if (tab === 'all') {
        if (chartsSec) chartsSec.style.display = 'grid';
        if (contractsSec) contractsSec.style.display = 'block';
        if (evalSec) evalSec.style.display = 'block';
        if (perfSec) perfSec.style.display = 'grid';
        if (ordersCol) ordersCol.style.display = 'flex';
        if (catalogSec) catalogSec.style.display = 'none';
    } else if (tab === 'clm') {
        if (chartsSec) chartsSec.style.display = 'grid';
        if (contractsSec) contractsSec.style.display = 'block';
        if (evalSec) evalSec.style.display = 'block';
        if (perfSec) perfSec.style.display = 'none';
        if (ordersCol) ordersCol.style.display = 'none';
        if (catalogSec) catalogSec.style.display = 'none';
    } else if (tab === 'performance') {
        if (chartsSec) chartsSec.style.display = 'grid';
        if (contractsSec) contractsSec.style.display = 'none';
        if (evalSec) evalSec.style.display = 'block';
        if (perfSec) perfSec.style.display = 'grid';
        if (ordersCol) ordersCol.style.display = 'none';
        if (catalogSec) catalogSec.style.display = 'none';
    } else if (tab === 'orders') {
        if (chartsSec) chartsSec.style.display = 'none';
        if (contractsSec) contractsSec.style.display = 'none';
        if (evalSec) evalSec.style.display = 'none';
        if (perfSec) perfSec.style.display = 'grid';
        if (ordersCol) ordersCol.style.display = 'flex';
        if (catalogSec) catalogSec.style.display = 'none';
    } else if (tab === 'catalog') {
        if (chartsSec) chartsSec.style.display = 'none';
        if (contractsSec) contractsSec.style.display = 'none';
        if (evalSec) evalSec.style.display = 'none';
        if (perfSec) perfSec.style.display = 'none';
        if (ordersCol) ordersCol.style.display = 'none';
        if (catalogSec) catalogSec.style.display = 'block';
        renderProductCatalog();
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

    const catSearchEl = document.getElementById('catalogSearchInput');
    if (catSearchEl && !catSearchEl.dataset.bound) {
        catSearchEl.dataset.bound = 'true';
        catSearchEl.addEventListener('input', (e) => {
            catalogSearchQuery = (e.target.value || '').toLowerCase().trim();
            renderProductCatalog();
        });
    }

    const exportCatalogBtn = document.getElementById('btnExportCatalogCsv');
    if (exportCatalogBtn && !exportCatalogBtn.dataset.bound) {
        exportCatalogBtn.dataset.bound = 'true';
        exportCatalogBtn.addEventListener('click', () => {
            exportCatalogToCSV();
        });
    }

    const btnModeGroup = document.getElementById('catViewModeGroup');
    const btnModeRaw = document.getElementById('catViewModeRaw');
    if (btnModeGroup && !btnModeGroup.dataset.bound) {
        btnModeGroup.dataset.bound = 'true';
        btnModeGroup.addEventListener('click', () => {
            catalogViewMode = 'group';
            btnModeGroup.className = 'px-2.5 py-1 rounded-md bg-white text-gray-800 shadow-2xs border border-gray-200/60 transition';
            if (btnModeRaw) btnModeRaw.className = 'px-2.5 py-1 rounded-md text-gray-500 hover:text-gray-800 transition';
            const grpEl = document.getElementById('catalogGroupedContainer');
            const rawEl = document.getElementById('catalogRawContainer');
            if (grpEl) grpEl.style.display = 'block';
            if (rawEl) rawEl.style.display = 'none';
            renderProductCatalog();
        });
    }
    if (btnModeRaw && !btnModeRaw.dataset.bound) {
        btnModeRaw.dataset.bound = 'true';
        btnModeRaw.addEventListener('click', () => {
            catalogViewMode = 'raw';
            btnModeRaw.className = 'px-2.5 py-1 rounded-md bg-white text-gray-800 shadow-2xs border border-gray-200/60 transition';
            if (btnModeGroup) btnModeGroup.className = 'px-2.5 py-1 rounded-md text-gray-500 hover:text-gray-800 transition';
            const grpEl = document.getElementById('catalogGroupedContainer');
            const rawEl = document.getElementById('catalogRawContainer');
            if (grpEl) grpEl.style.display = 'none';
            if (rawEl) rawEl.style.display = 'block';
            renderProductCatalog();
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

    // 4. Render Operational Tables & Tracking Cards
    renderContractTable(cc);
    renderEvaluationsTable(evaluations);
    renderTopVendors(scoreSummary, vendors, kategori);
    renderPendingVendors(vendors, scoreSummary, kategori);
    renderPoPerformance(poStats);
    renderProductCatalog();

    // 5. Update Status & Filter Counters
    updateFilterCountSummary(vendors, cc, evaluations);
}

function renderSummaryCards(vendors, scoreSummary, cc, poStats) {
    const totalVendors = vendors ? vendors.length : 0;
    
    // 1. Total Nilai Kontrak
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
    if (valEl) valEl.textContent = formatRupiah(totalContractVal);
    if (valCountEl) valCountEl.textContent = `${totalContractsCount} kontrak aktif`;
    if (valAvgEl) {
        const avgVal = totalContractsCount > 0 ? (totalContractVal / totalContractsCount) : 0;
        valAvgEl.textContent = totalContractVal > 0 ? `Rata-rata: ${formatRupiah(avgVal)}` : `Portofolio Aktif`;
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
    if (!tableBody) return;

    if (!scoreSummary || Object.keys(scoreSummary).length === 0) {
        tableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#94a3b8; padding:2rem;">Belum ada vendor yang dinilai.</td></tr>`;
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
            <td style="font-weight:700;">${rankBadges[i] || (i + 1)}</td>
            <td>
                <div style="font-weight:600; color:#0f172a; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:180px;" title="${esc(v.name)}">${esc(v.name)}</div>
                <div style="font-size:0.75rem; color:#64748b;">${esc(v.categoryIcon)} ${esc(v.categoryName)}</div>
            </td>
            <td style="text-align:right; font-weight:800; color:#0f172a; font-size:1rem;">${v.avgScore.toFixed(2)}</td>
            <td style="text-align:center;">
                <span class="predikat-badge" style="background:${getPredikatColor(v.avgScore)}15; color:${getPredikatColor(v.avgScore)}; border:1px solid ${getPredikatColor(v.avgScore)}30;">
                    ${esc(v.predikat)}
                </span>
            </td>
        </tr>
    `).join('');
}

function renderPendingVendors(vendors, scoreSummary, categories) {
    const container = document.getElementById('pendingVendorsContainer');
    const badge = document.getElementById('pendingVendorBadge');
    if (!container) return;

    const evaluatedNames = new Set(scoreSummary ? Object.keys(scoreSummary) : []);
    const allList = vendors || [];
    
    const pendingList = allList.filter(v => !evaluatedNames.has(v.nama));
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

    // Daftar vendor belum dievaluasi
    if (pendingList.length > 0) {
        html += `
        <div class="text-xs font-bold text-gray-700 mb-2 flex items-center justify-between">
            <span>Menunggu Penilaian:</span>
            <span class="text-gray-400 font-normal">${pendingList.length} rekanan</span>
        </div>
        <div class="space-y-1.5">
            ${pendingList.slice(0, 7).map(v => {
                const catCode = v.kategori || 'general';
                const catInfo = (categories && categories.find(c => c.kode === catCode)) || { nama: 'General', ikon: '📦' };
                return `
                <div class="flex items-center justify-between p-2 rounded-lg bg-gray-50 border border-gray-100 hover:bg-gray-100/70 transition">
                    <div class="min-w-0 pr-2">
                        <div class="font-semibold text-xs text-gray-800 truncate" title="${esc(v.nama)}">${esc(v.nama)}</div>
                        <div class="text-2xs text-gray-400">${esc(catInfo.ikon)} ${esc(catInfo.nama)}</div>
                    </div>
                    <span class="text-2xs font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 whitespace-nowrap">
                        ⏳ Belum Dinilai
                    </span>
                </div>`;
            }).join('')}
            ${pendingList.length > 7 ? `
                <div class="text-center text-xs text-gray-400 pt-1 font-medium">
                    +${pendingList.length - 7} vendor lainnya
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
        const color = pct >= 80 ? 'var(--accent)' : pct >= 60 ? '#f59e0b' : '#ef4444';
        
        return `
        <div class="po-perf-item" style="margin-bottom: 1.25rem;">
            <div style="display:flex; justify-content:space-between; margin-bottom:0.35rem; font-size:0.875rem;">
                <span style="font-weight:600; color:var(--text); text-overflow:ellipsis; overflow:hidden; white-space:nowrap; max-width:260px;" title="${esc(name)}">${esc(name)}</span>
                <span style="font-weight:700; color:${color}; font-size:0.8rem; white-space:nowrap; margin-left:0.5rem;">${pct}% (${v.onTimePo}/${v.totalPo} PO)</span>
            </div>
            <div class="progress-bar-container" style="background:var(--border); height:8px; border-radius:4px; overflow:hidden; display:flex;">
                <div class="progress-bar-fill" style="width:${pct}%; background:${color}; height:100%; border-radius:4px;"></div>
            </div>
        </div>`;
    }).join('');

    container.innerHTML = html;
}

function renderContractTable(cc) {
    const tableBody = document.getElementById('contractTableBody');
    if (!tableBody) return;

    const badgeCount = document.getElementById('contractBadgeCount');
    if (badgeCount && cc && Array.isArray(cc.list)) {
        badgeCount.textContent = `${cc.list.length} Kontrak`;
    }

    if (!cc || !cc.list || cc.list.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--text3); padding:2rem;">Belum ada data kontrak vendor terdaftar di sheet 'Kontrak Vendor'.</td></tr>`;
        return;
    }

    tableBody.innerHTML = cc.list.map(c => {
        const isComply = c.status && c.status.toLowerCase() === 'comply';
        const statusColor = isComply ? '#10b981' : '#ef4444';
        
        const isDocComplete = c.kelengkapan && c.kelengkapan.toLowerCase().includes('lengkap');
        const docColor = isDocComplete ? '#0284c7' : '#f59e0b';

        const cleanVendor = (c.vendor || '').replace(/\r?\n|\r/g, ' ').trim();
        const cleanJenis = (c.jenisPekerjaan || '-').replace(/\r?\n|\r/g, ' ').trim();
        const cleanKet = (c.keterangan || '-').replace(/\r?\n|\r/g, ' ').trim();

        return `
        <tr class="hover:bg-blue-50/40 transition-colors">
            <td style="font-weight:700; color:#2563eb; font-size:0.78rem; white-space:nowrap;">#${esc(c.noKontrak)}</td>
            <td>
                <div style="font-weight:600; color:#0f172a; max-width:240px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${esc(cleanVendor)}">${esc(cleanVendor)}</div>
            </td>
            <td>
                <div style="font-size:0.78rem; color:#475569; max-width:180px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${esc(cleanJenis)}">${esc(cleanJenis)}</div>
            </td>
            <td style="font-size:0.75rem; color:#64748b; white-space:nowrap;">
                <span>${esc(c.tglMulai || '-')} &ndash; ${esc(c.tglSelesai || '-')}</span>
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
            <td>
                <div style="font-size:0.75rem; color:#64748b; max-width:180px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${esc(cleanKet)}">${esc(cleanKet)}</div>
            </td>
        </tr>`;
    }).join('');
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
        tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text3); padding:2rem;">Belum ada data penilaian vendor. Mulai beri penilaian dari halaman utama.</td></tr>`;
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
                    catScores[catCode] = { label: catInfo.nama, icon: catInfo.ikon || '📦', sum: 0, count: 0 };
                }
                catScores[catCode].sum += evalData.avgScore;
                catScores[catCode].count++;
            }
        });
    }

    const labels = [];
    const data = [];
    for (const code in catScores) {
        const cat = catScores[code];
        labels.push(`${cat.icon} ${cat.label}`);
        data.push(parseFloat((cat.sum / cat.count).toFixed(2)));
    }

    if (labels.length === 0) {
        labels.push('Belum ada data evaluasi');
        data.push(0);
    }

    const radarMetaEl = document.getElementById('radarSummaryMeta');
    if (radarMetaEl) {
        const catCount = Object.keys(catScores).length;
        radarMetaEl.textContent = catCount > 0
            ? `Membandingkan performa pada ${catCount} bidang rekanan aktif`
            : 'Belum ada data evaluasi untuk bidang rekanan';
    }

    if (radarChartInstance) radarChartInstance.destroy();

    radarChartInstance = new Chart(canvas, {
        type: 'radar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Skor Rata-rata',
                data: data,
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                borderColor: '#10b981',
                borderWidth: 2,
                pointBackgroundColor: '#10b981',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                r: {
                    beginAtZero: true,
                    max: 5,
                    ticks: {
                        stepSize: 1,
                        font: { size: 11 },
                        backdropColor: 'transparent'
                    },
                    pointLabels: {
                        font: { size: 12, weight: '600' },
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
                    titleFont: { size: 13, weight: '700' },
                    bodyFont: { size: 12 },
                    padding: 10,
                    cornerRadius: 8,
                    callbacks: {
                        label: function(ctx) { return `Skor: ${ctx.raw} / 5.0`; }
                    }
                }
            }
        }
    });
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
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 10,
                        usePointStyle: true,
                        pointStyle: 'circle',
                        font: { size: 11, weight: '600' },
                        color: '#475569'
                    }
                },
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

                ctx.font = 'bold 24px Inter, sans-serif';
                ctx.fillStyle = '#0f172a';
                ctx.fillText(`${total}`, centerX, centerY - 8);

                ctx.font = '600 11px Inter, sans-serif';
                ctx.fillStyle = '#64748b';
                ctx.fillText('Vendor Dinilai', centerX, centerY + 14);

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
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 14,
                        usePointStyle: true,
                        pointStyle: 'circle',
                        font: { size: 12, weight: '600' },
                        color: '#334155'
                    }
                },
                tooltip: {
                    backgroundColor: '#1e293b',
                    titleFont: { size: 13, weight: '700' },
                    bodyFont: { size: 12 },
                    padding: 10,
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

                ctx.font = 'bold 26px Inter, sans-serif';
                ctx.fillStyle = '#1e293b';
                ctx.fillText(`${rate}%`, centerX, centerY - 8);

                ctx.font = '600 11px Inter, sans-serif';
                ctx.fillStyle = '#64748b';
                ctx.fillText('Compliance Rate', centerX, centerY + 14);

                ctx.restore();
            }
        }]
    });
}

// =====================================================
// KATALOG PRODUK (ADMIN PIN 9999 ONLY)
// =====================================================
function renderProductCatalog() {
    const groupedTbody = document.getElementById('catalogGroupedTableBody');
    const rawTbody = document.getElementById('catalogRawTableBody');
    const badgeCount = document.getElementById('catalogBadgeCount');
    if (!groupedTbody && !rawTbody) return;

    let allOrders = (dashboardData && Array.isArray(dashboardData.allRawOrders)) ? dashboardData.allRawOrders : [];

    // 1. Ekstrak dan Kelompokkan Data per Produk
    const productMap = {};
    let totalOnTimeAll = 0;

    allOrders.forEach(o => {
        const rawName = (o.product || 'Lain-lain').trim();
        const key = rawName.toLowerCase();
        if (!productMap[key]) {
            productMap[key] = {
                productName: rawName,
                totalOrders: 0,
                onTimeOrders: 0,
                lateOrders: 0,
                vendorsCount: {},
                orders: []
            };
        }
        productMap[key].totalOrders++;
        if (o.isOnTime) {
            productMap[key].onTimeOrders++;
            totalOnTimeAll++;
        } else {
            productMap[key].lateOrders++;
        }

        const vName = (o.vendor || 'Unknown').trim();
        productMap[key].vendorsCount[vName] = (productMap[key].vendorsCount[vName] || 0) + 1;
        productMap[key].orders.push(o);
    });

    let groupedProducts = Object.values(productMap).map(p => {
        const vendorEntries = Object.entries(p.vendorsCount)
            .map(([vendor, count]) => ({
                vendor,
                count,
                percentage: p.totalOrders > 0 ? Math.round((count / p.totalOrders) * 100) : 0
            }))
            .sort((a, b) => b.count - a.count);

        const onTimeRate = p.totalOrders > 0 ? Math.round((p.onTimeOrders / p.totalOrders) * 100) : 100;
        return {
            ...p,
            topVendors: vendorEntries,
            top3Vendors: vendorEntries.slice(0, 3),
            onTimeRate
        };
    }).sort((a, b) => b.totalOrders - a.totalOrders);

    // 2. Update KPI Mini Cards di Bagian Atas Katalog
    const elTotProd = document.getElementById('catStatTotalProducts');
    const elTotOrd = document.getElementById('catStatTotalOrders');
    const elTopProd = document.getElementById('catStatTopProduct');
    const elTopProdMeta = document.getElementById('catStatTopProductMeta');
    const elOnTimeRate = document.getElementById('catStatOnTimeRate');

    if (elTotProd) elTotProd.textContent = groupedProducts.length;
    if (elTotOrd) elTotOrd.textContent = allOrders.length;
    if (elTopProd) {
        if (groupedProducts.length > 0) {
            elTopProd.textContent = groupedProducts[0].productName;
            if (elTopProdMeta) elTopProdMeta.textContent = `${groupedProducts[0].totalOrders} pesanan dipesan`;
        } else {
            elTopProd.textContent = '-';
            if (elTopProdMeta) elTopProdMeta.textContent = 'Belum ada data';
        }
    }
    if (elOnTimeRate) {
        const overallRate = allOrders.length > 0 ? Math.round((totalOnTimeAll / allOrders.length) * 100) : 100;
        elOnTimeRate.textContent = `${overallRate}%`;
    }

    // 3. Filter berdasarkan Pencarian (Live Search)
    let filteredGrouped = groupedProducts;
    let filteredOrders = allOrders;

    if (catalogSearchQuery) {
        filteredGrouped = groupedProducts.filter(p => {
            const matchName = p.productName.toLowerCase().includes(catalogSearchQuery);
            const matchVendor = p.topVendors.some(v => v.vendor.toLowerCase().includes(catalogSearchQuery));
            const matchPo = p.orders.some(o => (o.poNum || '').toLowerCase().includes(catalogSearchQuery));
            return matchName || matchVendor || matchPo;
        });

        filteredOrders = allOrders.filter(o => {
            const p = (o.product || '').toLowerCase();
            const v = (o.vendor || '').toLowerCase();
            const po = (o.poNum || '').toLowerCase();
            const st = (o.status || '').toLowerCase();
            return p.includes(catalogSearchQuery) || v.includes(catalogSearchQuery) || po.includes(catalogSearchQuery) || st.includes(catalogSearchQuery);
        });
    }

    // Update Badge Counter
    if (badgeCount) {
        badgeCount.textContent = catalogViewMode === 'group'
            ? `${filteredGrouped.length} Ragam Produk`
            : `${filteredOrders.length} Pesanan PO`;
    }

    // 4. Render Mode Grouped (Agregasi Produk & Top 3 Penyuplai)
    if (groupedTbody) {
        if (filteredGrouped.length === 0) {
            groupedTbody.innerHTML = `<tr><td colspan="6" class="text-center text-gray-400 py-8">Tidak ada produk atau penyuplai yang cocok dengan filter "${esc(catalogSearchQuery)}".</td></tr>`;
        } else {
            groupedTbody.innerHTML = filteredGrouped.map((item, idx) => {
                // Medals / Badges untuk Top 3 Penyuplai
                const rankIcons = ['🥇', '🥈', '🥉'];
                const rankTextColors = ['text-amber-800', 'text-slate-700', 'text-amber-900'];
                const rankBgColors = ['bg-amber-50/80 border-amber-200/70', 'bg-slate-50 border-slate-200', 'bg-orange-50/70 border-orange-200/60'];

                const topVendorsHtml = item.top3Vendors.map((v, rIdx) => {
                    const icon = rankIcons[rIdx] || '•';
                    const textColor = rankTextColors[rIdx] || 'text-gray-700';
                    const bgColor = rankBgColors[rIdx] || 'bg-gray-50 border-gray-200';
                    return `
                        <div class="flex items-center justify-between gap-2 p-1.5 rounded-lg border ${bgColor} text-xs mb-1">
                            <div class="flex items-center gap-1.5 min-w-0">
                                <span>${icon}</span>
                                <span class="font-semibold ${textColor} truncate" title="${esc(v.vendor)}">${esc(v.vendor)}</span>
                            </div>
                            <span class="shrink-0 font-mono text-[11px] font-semibold text-gray-600 bg-white px-2 py-0.5 rounded shadow-2xs border border-gray-100">
                                ${v.count} PO · <strong class="text-blue-600">${v.percentage}%</strong>
                            </span>
                        </div>
                    `;
                }).join('');

                const otherVendorsCount = item.topVendors.length - item.top3Vendors.length;
                const otherVendorsNotice = otherVendorsCount > 0
                    ? `<div class="text-[11px] text-gray-400 font-medium pl-1 mt-0.5">+ ${otherVendorsCount} vendor penyuplai lainnya</div>`
                    : '';

                // On-Time Delivery Badge
                let onTimeBadge = '';
                if (item.onTimeRate >= 90) {
                    onTimeBadge = `<span class="tremor-badge bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold">✅ ${item.onTimeRate}%</span>`;
                } else if (item.onTimeRate >= 75) {
                    onTimeBadge = `<span class="tremor-badge bg-blue-50 text-blue-700 border-blue-200 font-semibold">👍 ${item.onTimeRate}%</span>`;
                } else {
                    onTimeBadge = `<span class="tremor-badge bg-rose-50 text-rose-700 border-rose-200 font-semibold">⚠️ ${item.onTimeRate}%</span>`;
                }

                // Sub-table untuk rincian PO produk ini
                const poRowsHtml = item.orders.map(o => {
                    let stBadge = '';
                    const stLower = (o.status || '').toLowerCase();
                    if (stLower.includes('tepat') || stLower === 'selesai') {
                        stBadge = `<span class="px-2 py-0.5 text-[11px] font-semibold rounded bg-emerald-50 text-emerald-700 border border-emerald-200">✅ Selesai</span>`;
                    } else if (stLower.includes('terlambat')) {
                        stBadge = `<span class="px-2 py-0.5 text-[11px] font-semibold rounded bg-rose-50 text-rose-700 border border-rose-200">⚠️ Terlambat</span>`;
                    } else {
                        stBadge = `<span class="px-2 py-0.5 text-[11px] font-semibold rounded bg-blue-50 text-blue-700 border border-blue-200">⏳ Proses</span>`;
                    }
                    return `
                        <tr class="border-b border-gray-100 text-xs">
                            <td class="py-1.5 px-3 font-mono font-semibold text-gray-800">${esc(o.poNum || '-')}</td>
                            <td class="py-1.5 px-3 text-gray-700">${esc(o.vendor || '-')}</td>
                            <td class="py-1.5 px-3 text-gray-500">${esc(o.expectedDate || '-')}</td>
                            <td class="py-1.5 px-3 text-gray-500">${esc(o.effectiveDate || '-')}</td>
                            <td class="py-1.5 px-3">${stBadge}</td>
                        </tr>
                    `;
                }).join('');

                return `
                    <tr class="hover:bg-gray-50/70 transition-colors border-b border-gray-100 align-top">
                        <td class="text-xs text-gray-400 font-mono pt-3.5">${idx + 1}</td>
                        <td class="pt-3">
                            <div class="flex items-start gap-2.5">
                                <span class="text-xl">📦</span>
                                <div>
                                    <h4 class="text-sm font-bold text-gray-900 leading-tight">${esc(item.productName)}</h4>
                                    <p class="text-[11px] text-gray-500 mt-0.5">Disuplai oleh ${item.topVendors.length} rekanan vendor</p>
                                </div>
                            </div>
                        </td>
                        <td class="text-center pt-3">
                            <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                ${item.totalOrders} PO
                            </span>
                        </td>
                        <td class="pt-2 pb-2">
                            ${topVendorsHtml}
                            ${otherVendorsNotice}
                        </td>
                        <td class="text-center pt-3">
                            ${onTimeBadge}
                            <div class="w-20 mx-auto bg-gray-200 rounded-full h-1.5 mt-1.5 overflow-hidden">
                                <div class="${item.onTimeRate >= 90 ? 'bg-emerald-500' : (item.onTimeRate >= 75 ? 'bg-blue-500' : 'bg-rose-500')} h-1.5 rounded-full" style="width: ${item.onTimeRate}%"></div>
                            </div>
                        </td>
                        <td class="text-center pt-3">
                            <button onclick="toggleProductPoDetail(${idx})" class="px-2.5 py-1 text-xs font-semibold rounded-lg border border-gray-200 text-blue-600 hover:bg-blue-50 transition shadow-2xs">
                                Rincian (${item.totalOrders})
                            </button>
                        </td>
                    </tr>
                    <tr id="productPoRow_${idx}" style="display: none;" class="bg-gray-50/60 border-b border-gray-200">
                        <td colspan="6" class="p-3">
                            <div class="bg-white rounded-xl border border-gray-200 p-3 shadow-xs">
                                <div class="flex items-center justify-between mb-2">
                                    <h5 class="text-xs font-bold text-gray-800">📋 Daftar PO untuk Produk: <span class="text-blue-600">${esc(item.productName)}</span></h5>
                                    <span class="text-[11px] text-gray-400">${item.orders.length} riwayat pesanan</span>
                                </div>
                                <div class="table-scroll-container max-h-48 overflow-y-auto">
                                    <table class="w-full text-left border-collapse">
                                        <thead>
                                            <tr class="text-[11px] text-gray-500 uppercase border-b border-gray-200 bg-gray-50/70">
                                                <th class="py-1 px-3">No. PO</th>
                                                <th class="py-1 px-3">Vendor</th>
                                                <th class="py-1 px-3">Tgl Expected</th>
                                                <th class="py-1 px-3">Tgl Realisasi</th>
                                                <th class="py-1 px-3">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${poRowsHtml}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        }
    }

    // 5. Render Mode Raw (Log Seluruh PO)
    if (rawTbody) {
        if (filteredOrders.length === 0) {
            rawTbody.innerHTML = `<tr><td colspan="7" class="text-center text-gray-400 py-8">Tidak ada data pesanan PO yang ditemukan.</td></tr>`;
        } else {
            rawTbody.innerHTML = filteredOrders.map((o, idx) => {
                let statusBadge = '';
                const statusLower = (o.status || '').toLowerCase();
                if (statusLower.includes('tepat') || statusLower === 'selesai') {
                    statusBadge = `<span class="tremor-badge bg-emerald-50 text-emerald-700 border-emerald-200">✅ ${esc(o.status)}</span>`;
                } else if (statusLower.includes('terlambat')) {
                    statusBadge = `<span class="tremor-badge bg-rose-50 text-rose-700 border-rose-200">⚠️ ${esc(o.status)}</span>`;
                } else {
                    statusBadge = `<span class="tremor-badge bg-blue-50 text-blue-700 border-blue-200">⏳ ${esc(o.status || 'Proses')}</span>`;
                }

                return `
                    <tr class="hover:bg-gray-50/80 transition-colors">
                        <td class="text-xs text-gray-400 font-mono">${idx + 1}</td>
                        <td class="text-xs font-semibold text-gray-900 font-mono">${esc(o.poNum || '-')}</td>
                        <td class="text-xs font-semibold text-gray-900">${esc(o.product || '-')}</td>
                        <td class="text-xs text-gray-600">${esc(o.vendor || '-')}</td>
                        <td class="text-xs text-gray-500">${esc(o.expectedDate || '-')}</td>
                        <td class="text-xs text-gray-500">${esc(o.effectiveDate || '-')}</td>
                        <td class="text-xs">${statusBadge}</td>
                    </tr>
                `;
            }).join('');
        }
    }
}

function toggleProductPoDetail(idx) {
    const row = document.getElementById(`productPoRow_${idx}`);
    if (!row) return;
    if (row.style.display === 'none' || row.style.display === '') {
        row.style.display = 'table-row';
    } else {
        row.style.display = 'none';
    }
}

function exportCatalogToCSV() {
    let allOrders = (dashboardData && Array.isArray(dashboardData.allRawOrders)) ? dashboardData.allRawOrders : [];

    if (catalogViewMode === 'group') {
        // Ekspor data Agregasi Produk & Top 3 Penyuplai
        const productMap = {};
        allOrders.forEach(o => {
            const rawName = (o.product || 'Lain-lain').trim();
            const key = rawName.toLowerCase();
            if (!productMap[key]) {
                productMap[key] = { productName: rawName, totalOrders: 0, onTimeOrders: 0, vendorsCount: {} };
            }
            productMap[key].totalOrders++;
            if (o.isOnTime) productMap[key].onTimeOrders++;
            const vName = (o.vendor || 'Unknown').trim();
            productMap[key].vendorsCount[vName] = (productMap[key].vendorsCount[vName] || 0) + 1;
        });

        let list = Object.values(productMap).map(p => {
            const vendorEntries = Object.entries(p.vendorsCount)
                .map(([vendor, count]) => ({ vendor, count, pct: Math.round((count / p.totalOrders) * 100) }))
                .sort((a, b) => b.count - a.count);
            return {
                ...p,
                top3: vendorEntries.slice(0, 3),
                onTimePct: p.totalOrders > 0 ? Math.round((p.onTimeOrders / p.totalOrders) * 100) : 100
            };
        }).sort((a, b) => b.totalOrders - a.totalOrders);

        if (catalogSearchQuery) {
            list = list.filter(p => p.productName.toLowerCase().includes(catalogSearchQuery));
        }

        if (list.length === 0) {
            showToast('Tidak ada data analisis katalog untuk diekspor.', 'warning');
            return;
        }

        const headers = ['No', 'Produk / Jasa', 'Total Pemesanan (PO)', 'Top Penyuplai #1', 'Penyuplai #2', 'Penyuplai #3', 'Ketepatan Waktu (%)'];
        const rows = list.map((item, idx) => {
            const v1 = item.top3[0] ? `${item.top3[0].vendor} (${item.top3[0].count} PO - ${item.top3[0].pct}%)` : '-';
            const v2 = item.top3[1] ? `${item.top3[1].vendor} (${item.top3[1].count} PO - ${item.top3[1].pct}%)` : '-';
            const v3 = item.top3[2] ? `${item.top3[2].vendor} (${item.top3[2].count} PO - ${item.top3[2].pct}%)` : '-';
            return [
                idx + 1,
                `"${item.productName.replace(/"/g, '""')}"`,
                item.totalOrders,
                `"${v1.replace(/"/g, '""')}"`,
                `"${v2.replace(/"/g, '""')}"`,
                `"${v3.replace(/"/g, '""')}"`,
                `${item.onTimePct}%`
            ];
        });

        const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `Katalog_Top3_Vendor_Penyuplai_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('Katalog Analisis Top 3 Penyuplai berhasil diunduh (CSV).', 'success');

    } else {
        // Ekspor Raw Orders
        let orders = allOrders;
        if (catalogSearchQuery) {
            orders = orders.filter(o => {
                const p = (o.product || '').toLowerCase();
                const v = (o.vendor || '').toLowerCase();
                const po = (o.poNum || '').toLowerCase();
                const st = (o.status || '').toLowerCase();
                return p.includes(catalogSearchQuery) || v.includes(catalogSearchQuery) || po.includes(catalogSearchQuery) || st.includes(catalogSearchQuery);
            });
        }

        if (orders.length === 0) {
            showToast('Tidak ada data pesanan PO untuk diekspor.', 'warning');
            return;
        }

        const headers = ['No', 'No PO', 'Nama Produk / Jasa', 'Vendor', 'Tgl Expected', 'Tgl Realisasi', 'Status'];
        const rows = orders.map((o, idx) => [
            idx + 1,
            `"${(o.poNum || '').replace(/"/g, '""')}"`,
            `"${(o.product || '').replace(/"/g, '""')}"`,
            `"${(o.vendor || '').replace(/"/g, '""')}"`,
            `"${(o.expectedDate || '').replace(/"/g, '""')}"`,
            `"${(o.effectiveDate || '').replace(/"/g, '""')}"`,
            `"${(o.status || '').replace(/"/g, '""')}"`
        ]);

        const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `Katalog_Log_PO_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('Log Pesanan PO berhasil diunduh (CSV).', 'success');
    }
}
