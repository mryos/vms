// =====================================================
// KONFIGURASI API & STATE DASHBOARD KONTRAK
// =====================================================
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzwWF7-IbaKdoUu9kE56JZTPeekrbmNeN0fOWsLukFUZG2z--zZo01E1wYvL21ZDLdnkQ/exec';

let contractDashboardData = null;
let lastContractComplianceData = null;

let contractExpiryFilter = 'all'; // 'all' | 'expired' | 'critical' | 'warning' | 'safe'
let contractStageFilter = 'all';  // 'all' | 'pengajuan' | 'draft' | 'paraf_vendor' | 'paraf_ethos' | 'revisi' | 'renvoi' | 'ttd' | 'aktif'
let contractCategoryFilter = 'all';
let contractComplianceFilter = 'all';

let contractCurrentPage = 1;
let contractPageSize = 10;

let complianceChartInstance = null;
let workflowChartInstance = null;

document.addEventListener('DOMContentLoaded', () => {
    checkAdminAccess();
});

// =====================================================
// ADMIN AUTHENTICATION (PIN 9999)
// =====================================================
function checkAdminAccess() {
    const savedPin = sessionStorage.getItem('ethos_pin') || localStorage.getItem('ethos_pin');
    const authOverlay = document.getElementById('adminAuthOverlay');
    
    if (savedPin === '8899') {
        window.location.href = 'katalog.html';
        return;
    }

    if (savedPin === '9999') {
        if (authOverlay) authOverlay.style.display = 'none';
        initHeader();
        initFilterListeners();
        loadContractDashboardData();
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
            initFilterListeners();
            loadContractDashboardData();
        } else if (pin === '8899') {
            if (errEl) {
                errEl.innerHTML = '❌ Akses Ditolak. PIN 8899 hanya untuk <strong>Katalog Produk</strong>.<br><a href="katalog.html" class="underline font-bold text-blue-600 mt-1 inline-block">Buka Katalog Produk &rarr;</a>';
                errEl.style.display = 'block';
            }
        } else {
            if (errEl) {
                errEl.textContent = '❌ PIN salah. Akses Dashboard Kontrak hanya untuk Administrator (PIN: 9999).';
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

function initFilterListeners() {
    const catSelect = document.getElementById('slicerCategorySelect');
    if (catSelect && !catSelect.dataset.bound) {
        catSelect.dataset.bound = 'true';
        catSelect.addEventListener('change', () => {
            contractCategoryFilter = catSelect.value;
            contractCurrentPage = 1;
            applyAndRender();
        });
    }

    const compSelect = document.getElementById('slicerComplianceSelect');
    if (compSelect && !compSelect.dataset.bound) {
        compSelect.dataset.bound = 'true';
        compSelect.addEventListener('change', () => {
            contractComplianceFilter = compSelect.value;
            contractCurrentPage = 1;
            applyAndRender();
        });
    }

    const searchInput = document.getElementById('contractSearchInput');
    if (searchInput && !searchInput.dataset.bound) {
        searchInput.dataset.bound = 'true';
        searchInput.addEventListener('input', () => {
            contractCurrentPage = 1;
            applyAndRender();
        });
    }
}

// =====================================================
// DATA FETCHING & SYNCHRONIZATION
// =====================================================
async function loadContractDashboardData() {
    const statusEl = document.getElementById('liveSyncStatus');
    if (statusEl) statusEl.textContent = 'Sedang menyinkronkan data...';

    const tableBody = document.getElementById('contractTableBody');
    if (tableBody) {
        tableBody.innerHTML = `<tr><td colspan="8" class="text-center text-gray-400 py-10">
            <div class="inline-flex items-center gap-2">
                <span class="w-4 h-4 rounded-full border-2 border-blue-600 border-t-transparent animate-spin"></span>
                <span>Mengambil data contract repository &amp; compliance dari Google Spreadsheet...</span>
            </div>
        </td></tr>`;
    }

    try {
        const resp = await fetch(SCRIPT_URL);
        if (!resp.ok) throw new Error(`HTTP error! status: ${resp.status}`);
        const data = await resp.json();

        contractDashboardData = data;
        lastContractComplianceData = data.contractCompliance || { list: [] };

        if (statusEl) {
            const now = new Date();
            const timeStr = `${('0'+now.getHours()).slice(-2)}:${('0'+now.getMinutes()).slice(-2)}:${('0'+now.getSeconds()).slice(-2)}`;
            statusEl.textContent = `Tersinkronisasi pk ${timeStr}`;
        }

        // Populate Category Slicer
        populateCategorySlicer(data.kategori || []);

        // Render Top KPIs, Charts & Table
        applyAndRender();
        showToast('Data kontrak berhasil diperbarui.', 'success');
    } catch (err) {
        console.error('Gagal memuat data:', err);
        if (statusEl) statusEl.textContent = 'Gagal sinkron data';
        if (tableBody) {
            tableBody.innerHTML = `<tr><td colspan="8" class="text-center text-red-500 py-10">Gagal memuat data kontrak: ${err.message}. Silakan periksa koneksi atau deployment Apps Script.</td></tr>`;
        }
        showToast('Gagal memuat data kontrak.', 'error');
    }
}

function populateCategorySlicer(kategoriList) {
    const select = document.getElementById('slicerCategorySelect');
    if (!select) return;

    let html = '<option value="all">Semua Bidang</option>';
    if (Array.isArray(kategoriList)) {
        kategoriList.forEach(k => {
            const nama = typeof k === 'object' ? (k.nama || k.Kode) : k;
            html += `<option value="${esc(nama)}">${esc(nama)}</option>`;
        });
    }
    select.innerHTML = html;
}

// =====================================================
// DATA NORMALIZATION & COMPUTATION
// =====================================================
function getContractDaysRemaining(dateStr) {
    if (!dateStr || dateStr === '-' || dateStr.toLowerCase().includes('belum')) return null;
    const target = new Date(dateStr);
    if (isNaN(target.getTime())) return null;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}

function getContractProcessDays(tglPengajuan, tglRealisasi) {
    if (!tglPengajuan || tglPengajuan === '-' || tglPengajuan.toLowerCase().includes('belum')) return null;
    const submit = new Date(tglPengajuan);
    if (isNaN(submit.getTime())) return null;
    let end = new Date();
    if (tglRealisasi && tglRealisasi !== '-' && !tglRealisasi.toLowerCase().includes('belum')) {
        const r = new Date(tglRealisasi);
        if (!isNaN(r.getTime())) end = r;
    }
    submit.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    return Math.max(0, Math.floor((end - submit) / (1000 * 60 * 60 * 24)));
}

function normalizeContractStageFrontend(rawStage, rawStatus, tglSelesai) {
    const s = (rawStage || '').toString().trim().toLowerCase();
    
    if (s.includes('pengajuan') || s.includes('masuk legal') || s.includes('ajukan')) {
        return { step: 1, key: 'pengajuan', label: '1. Pengajuan ke Legal', percent: 15, badgeColor: '#2563eb', badgeBg: '#eff6ff', isRevision: false, isRenvoi: false, isFinal: false };
    }
    if (s.includes('draft') || s.includes('penyusunan')) {
        return { step: 2, key: 'draft', label: '2. Draft Keluar', percent: 35, badgeColor: '#4f46e5', badgeBg: '#eef2ff', isRevision: false, isRenvoi: false, isFinal: false };
    }
    if (s.includes('paraf vendor') || s.includes('review vendor')) {
        return { step: 3, key: 'paraf_vendor', label: '3. Paraf Vendor', percent: 50, badgeColor: '#d97706', badgeBg: '#fffbeb', isRevision: false, isRenvoi: false, isFinal: false };
    }
    if (s.includes('paraf ethos') || s.includes('paraf internal') || (s.includes('paraf') && !s.includes('vendor'))) {
        return { step: 4, key: 'paraf_ethos', label: '4. Paraf Ethos', percent: 65, badgeColor: '#7c3aed', badgeBg: '#f5f3ff', isRevision: false, isRenvoi: false, isFinal: false };
    }
    if (s.includes('revisi')) {
        return { step: 5, key: 'revisi', label: '5. Revisi', percent: 60, badgeColor: '#e11d48', badgeBg: '#fff1f2', isRevision: true, isRenvoi: false, isFinal: false };
    }
    if (s.includes('renvoi')) {
        return { step: 6, key: 'renvoi', label: '6. Renvoi', percent: 75, badgeColor: '#ea580c', badgeBg: '#fff7ed', isRevision: false, isRenvoi: true, isFinal: false };
    }
    if (s.includes('tanda tangan') || s.includes('ttd') || s.includes('signing') || s.includes('e-sign')) {
        return { step: 7, key: 'ttd', label: '7. Tanda Tangan', percent: 85, badgeColor: '#0d9488', badgeBg: '#f0fdfa', isRevision: false, isRenvoi: false, isFinal: false };
    }
    if (s.includes('aktif') || s.includes('selesai') || s.includes('berlaku') || s.includes('done')) {
        return { step: 8, key: 'aktif', label: '8. Aktif / Selesai', percent: 100, badgeColor: '#16a34a', badgeBg: '#f0fdf4', isRevision: false, isRenvoi: false, isFinal: true };
    }
    if (s.includes('expired') || s.includes('kadaluarsa') || s.includes('berakhir')) {
        return { step: 9, key: 'expired', label: '9. Berakhir / Expired', percent: 100, badgeColor: '#64748b', badgeBg: '#f8fafc', isRevision: false, isRenvoi: false, isFinal: true };
    }

    if (rawStage && rawStage.toString().trim() !== '') {
        return { step: 0, key: 'lainnya', label: rawStage.toString().trim(), percent: 50, badgeColor: '#475569', badgeBg: '#f1f5f9', isRevision: false, isRenvoi: false, isFinal: false };
    }

    const isComply = (rawStatus || '').toString().toLowerCase().includes('comply');
    if (isComply) {
        return { step: 8, key: 'aktif', label: '8. Aktif / Selesai', percent: 100, badgeColor: '#16a34a', badgeBg: '#f0fdf4', isRevision: false, isRenvoi: false, isFinal: true };
    }

    return { step: 1, key: 'pengajuan', label: '1. Pengajuan ke Legal', percent: 15, badgeColor: '#2563eb', badgeBg: '#eff6ff', isRevision: false, isRenvoi: false, isFinal: false };
}

// =====================================================
// RENDER EXECUTIVE DASHBOARD (KPIS, CHARTS & TABLE)
// =====================================================
function applyAndRender() {
    if (!contractDashboardData || !contractDashboardData.contractCompliance) return;

    const rawList = contractDashboardData.contractCompliance.list || [];
    
    // Annotate list items
    rawList.forEach(c => {
        c._stageObj = normalizeContractStageFrontend(c.tahapProgress, c.status, c.tglSelesai);
        c._daysRemaining = getContractDaysRemaining(c.tglSelesai);
        c._processDays = getContractProcessDays(c.tglPengajuan, c.tglRealisasi);
    });

    // 1. Filter Category jika dipilih
    let filteredList = [...rawList];
    if (contractCategoryFilter !== 'all') {
        const catVendorNames = new Set();
        (contractDashboardData.allVendors || contractDashboardData.vendors || []).forEach(v => {
            if (v.kategori === contractCategoryFilter) {
                catVendorNames.add(v.nama.toLowerCase().trim());
            }
        });
        filteredList = filteredList.filter(c => catVendorNames.has((c.vendor || '').toLowerCase().trim()));
    }

    // 2. Filter Compliance Status
    if (contractComplianceFilter !== 'all') {
        filteredList = filteredList.filter(c => {
            const isComply = c.status && c.status.toLowerCase() === 'comply';
            return contractComplianceFilter === 'comply' ? isComply : !isComply;
        });
    }

    // Hitung seluruh KPI eksekutif berdasarkan filteredList
    let totalValue = 0;
    let countComply = 0;
    let countNotComply = 0;
    let countActive = 0;
    let countInProgress = 0;
    let countExpiring = 0;
    let countOverdueSla = 0;

    let countExpired = 0;
    let countCritical = 0;
    let countWarning = 0;
    let countSafe = 0;

    const stageCounts = {
        pengajuan: 0,
        draft: 0,
        paraf_vendor: 0,
        paraf_ethos: 0,
        revisi: 0,
        renvoi: 0,
        ttd: 0,
        aktif: 0,
        expired: 0
    };

    filteredList.forEach(c => {
        if (c.nilai) totalValue += Number(c.nilai) || 0;
        const isComply = c.status && c.status.toLowerCase() === 'comply';
        if (isComply) countComply++; else countNotComply++;

        const step = c._stageObj.step;
        if (step === 8) countActive++;
        if (step >= 1 && step <= 7) countInProgress++;
        if (c.isOverdueSla) countOverdueSla++;

        if (stageCounts[c._stageObj.key] !== undefined) {
            stageCounts[c._stageObj.key]++;
        }

        if (c._daysRemaining !== null) {
            if (c._daysRemaining < 0) {
                countExpired++;
                countExpiring++;
            } else if (c._daysRemaining <= 30) {
                countCritical++;
                countExpiring++;
            } else if (c._daysRemaining <= 90) {
                countWarning++;
            } else {
                countSafe++;
            }
        } else {
            countSafe++;
        }
    });

    // Update Top 5 KPI Cards
    const totalCount = filteredList.length;
    const complianceRate = totalCount > 0 ? Math.round((countComply / totalCount) * 100) : 100;

    const elKpiVal = document.getElementById('kpiTotalValue');
    const elKpiTot = document.getElementById('kpiTotalContractsCount');
    const elKpiAct = document.getElementById('kpiActiveContractsCount');
    const elKpiCompRate = document.getElementById('kpiComplianceRate');
    const elKpiCompBadge = document.getElementById('kpiComplianceBadge');
    const elKpiCompProg = document.getElementById('kpiComplianceProgress');
    const elKpiInProg = document.getElementById('kpiInProgressCount');
    const elKpiExp = document.getElementById('kpiExpiringCount');
    const elKpiOverdue = document.getElementById('kpiOverdueSlaCount');

    if (elKpiVal) elKpiVal.textContent = totalValue > 0 ? formatRupiah(totalValue) : 'Rp 0';
    if (elKpiTot) elKpiTot.textContent = `${totalCount} kontrak terdaftar`;
    if (elKpiAct) elKpiAct.textContent = `${countActive} aktif`;
    if (elKpiCompRate) elKpiCompRate.textContent = `${complianceRate}%`;
    if (elKpiCompProg) elKpiCompProg.style.width = `${complianceRate}%`;
    if (elKpiCompBadge) {
        elKpiCompBadge.textContent = complianceRate >= 80 ? 'Optimal' : (complianceRate >= 50 ? 'Cukup' : 'Perlu Perhatian');
        elKpiCompBadge.className = `text-[10px] font-bold px-1.5 py-0.5 rounded-full ${complianceRate >= 80 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`;
    }
    if (elKpiInProg) elKpiInProg.textContent = countInProgress;
    if (elKpiExp) elKpiExp.textContent = countExpiring;
    if (elKpiOverdue) elKpiOverdue.textContent = countOverdueSla;

    // Update Pipeline Funnel Cards
    const elSumTot = document.getElementById('summaryTotalContracts');
    const elSumAct = document.getElementById('summaryActiveContractsCount');
    const elSumVal = document.getElementById('summaryTotalValue');
    const elSumLegal = document.getElementById('summaryLegalDraftCount');
    const elSumParaf = document.getElementById('summaryParafCount');
    const elSumRev = document.getElementById('summaryRevisiRenvoiCount');
    const elSumTtd = document.getElementById('summaryTtdAktifCount');
    const elSumExp = document.getElementById('summaryExpiringCount');

    if (elSumTot) elSumTot.textContent = totalCount;
    if (elSumAct) elSumAct.textContent = `${countActive} aktif`;
    if (elSumVal) elSumVal.textContent = totalValue > 0 ? formatRupiah(totalValue) : 'Rp 0';
    if (elSumLegal) elSumLegal.textContent = stageCounts.pengajuan + stageCounts.draft;
    if (elSumParaf) elSumParaf.textContent = stageCounts.paraf_vendor + stageCounts.paraf_ethos;
    if (elSumRev) elSumRev.textContent = stageCounts.revisi + stageCounts.renvoi;
    if (elSumTtd) elSumTtd.textContent = stageCounts.ttd + stageCounts.aktif;
    if (elSumExp) elSumExp.textContent = countExpiring;

    // Update Expiry Badges
    const elCountExpired = document.getElementById('countExpExpired');
    const elCountCritical = document.getElementById('countExpCritical');
    const elCountWarning = document.getElementById('countExpWarning');
    const elCountSafe = document.getElementById('countExpSafe');
    if (elCountExpired) elCountExpired.textContent = countExpired;
    if (elCountCritical) elCountCritical.textContent = countCritical;
    if (elCountWarning) elCountWarning.textContent = countWarning;
    if (elCountSafe) elCountSafe.textContent = countSafe;

    // Update Stage Badges
    const stageBadgeMap = {
        'countStagePengajuan': stageCounts.pengajuan,
        'countStageDraft': stageCounts.draft,
        'countStageParafVendor': stageCounts.paraf_vendor,
        'countStageParafEthos': stageCounts.paraf_ethos,
        'countStageRevisi': stageCounts.revisi,
        'countStageRenvoi': stageCounts.renvoi,
        'countStageTtd': stageCounts.ttd,
        'countStageAktif': stageCounts.aktif
    };
    for (const id in stageBadgeMap) {
        const el = document.getElementById(id);
        if (el) el.textContent = stageBadgeMap[id];
    }

    // Render Charts
    renderContractComplianceChart(countComply, countNotComply);
    renderContractWorkflowChart(stageCounts);

    // Filter Table List berdasarkan Expiry, Stage, & Search Input
    let tableDisplayList = [...filteredList];

    if (contractExpiryFilter === 'expired') {
        tableDisplayList = tableDisplayList.filter(c => c._daysRemaining !== null && c._daysRemaining < 0);
    } else if (contractExpiryFilter === 'critical') {
        tableDisplayList = tableDisplayList.filter(c => c._daysRemaining !== null && c._daysRemaining >= 0 && c._daysRemaining <= 30);
    } else if (contractExpiryFilter === 'warning') {
        tableDisplayList = tableDisplayList.filter(c => c._daysRemaining !== null && c._daysRemaining > 30 && c._daysRemaining <= 90);
    } else if (contractExpiryFilter === 'safe') {
        tableDisplayList = tableDisplayList.filter(c => c._daysRemaining === null || c._daysRemaining > 90);
    }

    if (contractStageFilter !== 'all') {
        tableDisplayList = tableDisplayList.filter(c => c._stageObj && c._stageObj.key === contractStageFilter);
    }

    const searchQuery = document.getElementById('contractSearchInput')?.value.trim().toLowerCase();
    if (searchQuery) {
        tableDisplayList = tableDisplayList.filter(c => {
            return (c.noKontrak && c.noKontrak.toLowerCase().includes(searchQuery)) ||
                   (c.vendor && c.vendor.toLowerCase().includes(searchQuery)) ||
                   (c.jenisPekerjaan && c.jenisPekerjaan.toLowerCase().includes(searchQuery)) ||
                   (c.picDivisi && c.picDivisi.toLowerCase().includes(searchQuery)) ||
                   (c.tahapProgress && c.tahapProgress.toLowerCase().includes(searchQuery)) ||
                   (c.statusRevisi && c.statusRevisi.toLowerCase().includes(searchQuery)) ||
                   (c.keterangan && c.keterangan.toLowerCase().includes(searchQuery));
        });
    }

    // Render Table
    renderTableRows(tableDisplayList);
}

// =====================================================
// CHARTS (DONUT COMPLIANCE & HORIZONTAL WORKFLOW BAR)
// =====================================================
function renderContractComplianceChart(comply, notComply) {
    const canvas = document.getElementById('contractComplianceChart');
    if (!canvas) return;

    const total = comply + notComply;
    const noData = total === 0;

    const badge = document.getElementById('chartComplianceBadge');
    if (badge) {
        const pct = total > 0 ? Math.round((comply / total) * 100) : 100;
        badge.textContent = `${pct}% Comply`;
    }

    const elC = document.getElementById('donutComplyCount');
    const elNc = document.getElementById('donutNotComplyCount');
    if (elC) elC.textContent = comply;
    if (elNc) elNc.textContent = notComply;

    if (complianceChartInstance) complianceChartInstance.destroy();

    complianceChartInstance = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: noData ? ['Belum ada data'] : ['Comply', 'Not Comply'],
            datasets: [{
                data: noData ? [1] : [comply, notComply],
                backgroundColor: noData ? ['#e2e8f0'] : ['#10b981', '#ef4444'],
                borderColor: '#ffffff',
                borderWidth: 3,
                hoverOffset: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            cutout: '70%',
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(ctx) {
                            if (noData) return 'Belum ada data';
                            const pct = total > 0 ? Math.round((ctx.raw / total) * 100) : 0;
                            return ` ${ctx.label}: ${ctx.raw} kontrak (${pct}%)`;
                        }
                    }
                }
            }
        }
    });
}

function renderContractWorkflowChart(stages) {
    const canvas = document.getElementById('contractWorkflowChart');
    if (!canvas) return;

    const labels = [
        '1. Pengajuan Legal',
        '2. Draft Keluar',
        '3. Paraf Vendor',
        '4. Paraf Ethos',
        '5. Revisi',
        '6. Renvoi',
        '7. Tanda Tangan',
        '8. Aktif Sah'
    ];

    const dataValues = [
        stages.pengajuan || 0,
        stages.draft || 0,
        stages.paraf_vendor || 0,
        stages.paraf_ethos || 0,
        stages.revisi || 0,
        stages.renvoi || 0,
        stages.ttd || 0,
        stages.aktif || 0
    ];

    const colors = [
        '#0284c7', // 1. Pengajuan (sky-600)
        '#2563eb', // 2. Draft (blue-600)
        '#f59e0b', // 3. Paraf Vendor (amber-500)
        '#7c3aed', // 4. Paraf Ethos (purple-600)
        '#e11d48', // 5. Revisi (rose-600)
        '#ea580c', // 6. Renvoi (orange-600)
        '#0d9488', // 7. TTD (teal-600)
        '#059669'  // 8. Aktif (emerald-600)
    ];

    const elRatio = document.getElementById('pipelineActiveRatio');
    if (elRatio) {
        const sumAll = dataValues.reduce((a, b) => a + b, 0);
        elRatio.textContent = `${stages.aktif || 0}/${sumAll} Kontrak Aktif Selesai`;
    }

    if (workflowChartInstance) workflowChartInstance.destroy();

    workflowChartInstance = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Jumlah Kontrak',
                data: dataValues,
                backgroundColor: colors,
                borderRadius: 6,
                maxBarThickness: 20
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => ` ${ctx.raw} berkas kontrak`
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: { precision: 0, font: { size: 10, family: '"Plus Jakarta Sans", sans-serif' } },
                    grid: { color: '#f1f5f9' }
                },
                y: {
                    ticks: { font: { size: 10.5, weight: '600', family: '"Plus Jakarta Sans", sans-serif' }, color: '#334155' },
                    grid: { display: false }
                }
            }
        }
    });
}

// =====================================================
// TABLE RENDERING & PAGINATION
// =====================================================
function renderTableRows(list) {
    const tableBody = document.getElementById('contractTableBody');
    const badgeCount = document.getElementById('contractBadgeCount');
    if (!tableBody) return;

    const totalItems = list.length;
    if (badgeCount) badgeCount.textContent = `${totalItems} Kontrak`;

    if (totalItems === 0) {
        tableBody.innerHTML = `<tr><td colspan="8" class="text-center text-slate-400 py-12">
            <div class="flex flex-col items-center justify-center">
                <span class="text-3xl mb-2">🔍</span>
                <span class="font-bold text-slate-700 text-sm">Tidak ada kontrak ditemukan</span>
                <span class="text-xs text-slate-400 mt-1">Coba sesuaikan kata kunci pencarian atau ubah filter di atas.</span>
                <button onclick="resetAllContractFilters()" class="mt-3 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-2xs transition">Reset Filter</button>
            </div>
        </td></tr>`;
        renderContractPaginationUI(0, 1, 0, 0);
        return;
    }

    const totalPages = Math.ceil(totalItems / contractPageSize) || 1;
    if (contractCurrentPage > totalPages) contractCurrentPage = totalPages;
    if (contractCurrentPage < 1) contractCurrentPage = 1;

    const startIndex = (contractCurrentPage - 1) * contractPageSize;
    const endIndex = Math.min(startIndex + contractPageSize, totalItems);
    const pagedList = list.slice(startIndex, endIndex);

    tableBody.innerHTML = pagedList.map(c => {
        const isComply = c.status && c.status.toLowerCase() === 'comply';
        const isDocComplete = c.kelengkapan && c.kelengkapan.toLowerCase().includes('lengkap');

        const stage = c._stageObj || normalizeContractStageFrontend(c.tahapProgress, c.status, c.tglSelesai);
        const days = c._daysRemaining !== undefined ? c._daysRemaining : getContractDaysRemaining(c.tglSelesai);
        const processDays = c._processDays !== undefined ? c._processDays : getContractProcessDays(c.tglPengajuan, c.tglRealisasi);

        const cleanVendor = (c.vendor || '').replace(/\r?\n|\r/g, ' ').trim();
        const cleanJenis = (c.jenisPekerjaan || '-').replace(/\r?\n|\r/g, ' ').trim();
        const cleanDivisi = (c.picDivisi || '-').replace(/\r?\n|\r/g, ' ').trim();

        // Initials avatar
        const words = cleanVendor.replace(/[^\w\s]/gi, '').split(/\s+/).filter(w => !['pt', 'cv', 'ud', 'tbk', 'indonesia'].includes(w.toLowerCase()));
        let initials = 'VN';
        if (words.length >= 2) {
            initials = (words[0][0] + words[1][0]).toUpperCase();
        } else if (words.length === 1 && words[0].length >= 2) {
            initials = words[0].slice(0, 2).toUpperCase();
        }

        let expiryBadgeHtml = '';
        if (days !== null) {
            if (days < 0) {
                expiryBadgeHtml = `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                    <span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span> Lewat ${Math.abs(days)}h (Expired)
                </span>`;
            } else if (days <= 30) {
                expiryBadgeHtml = `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                    <span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span> Sisa ${days}h (Kritis)
                </span>`;
            } else if (days <= 90) {
                expiryBadgeHtml = `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-orange-50 text-orange-800 border border-orange-200">
                    <span class="w-1.5 h-1.5 rounded-full bg-orange-400"></span> Sisa ${days}h (Perhatian)
                </span>`;
            } else {
                expiryBadgeHtml = `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Sisa ${days}h (Aman)
                </span>`;
            }
        } else {
            expiryBadgeHtml = `<span class="text-[10.5px] text-slate-400">Tidak terbatas</span>`;
        }

        let revisionBadgeHtml = '';
        if (stage.isRevision || stage.isRenvoi || (c.statusRevisi && c.statusRevisi.trim() !== '' && c.statusRevisi !== '-')) {
            const revText = c.statusRevisi || (stage.isRenvoi ? 'Proses Renvoi' : 'Proses Revisi');
            revisionBadgeHtml = `<div class="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md mt-1 truncate max-w-[160px]" title="${esc(revText)}">
                <span>⚠️</span> <span class="truncate">${esc(revText)}</span>
            </div>`;
        }

        let linkDocHtml = '';
        if (c.linkDokumen && c.linkDokumen.trim() !== '' && c.linkDokumen !== '-') {
            linkDocHtml = `<a href="${esc(c.linkDokumen)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 text-[10px] text-ethos-700 hover:text-ethos-900 font-bold hover:underline mt-1 transition cursor-pointer" title="Buka Dokumen Google Drive">
                <svg class="w-3 h-3 text-ethos-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                <span>Draft Drive</span>
            </a>`;
        }

        return `
        <tr class="hover:bg-slate-50/80 transition-colors">
            <!-- 1. No Kontrak & Divisi -->
            <td>
                <button onclick="openContractDetailModal('${esc(c.noKontrak)}')" class="font-mono font-bold text-ethos-700 hover:text-ethos-900 bg-sky-50/80 hover:bg-sky-100 border border-sky-200/90 px-2 py-0.5 rounded text-[11px] inline-block transition text-left cursor-pointer shadow-2xs">
                    #${esc(c.noKontrak)}
                </button>
                <div class="text-[11px] text-slate-500 font-medium flex items-center gap-1.5 mt-1.5">
                    <span class="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0"></span>
                    <span class="truncate max-w-[140px]" title="${esc(cleanDivisi)}">${esc(cleanDivisi)}</span>
                </div>
                ${c.tglPengajuan && c.tglPengajuan !== '-' ? `<div class="text-[10px] text-slate-400 mt-0.5">Ajuan: ${esc(c.tglPengajuan)}</div>` : ''}
            </td>

            <!-- 2. Vendor & Ruang Lingkup -->
            <td>
                <div class="flex items-center gap-2.5">
                    <div class="w-8 h-8 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 border border-slate-200 text-slate-700 flex items-center justify-center font-bold text-[11px] shrink-0 shadow-2xs">
                        ${esc(initials)}
                    </div>
                    <div class="min-w-0">
                        <div class="font-bold text-slate-900 text-xs truncate max-w-[210px]" title="${esc(cleanVendor)}">${esc(cleanVendor)}</div>
                        <div class="text-[11px] text-slate-500 truncate max-w-[190px] mt-0.5" title="${esc(cleanJenis)}">${esc(cleanJenis)}</div>
                    </div>
                </div>
            </td>

            <!-- 3. Tahap Progress Pengerjaan -->
            <td>
                <div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md font-bold text-[10.5px]" style="background:${stage.badgeBg}; color:${stage.badgeColor}; border:1px solid ${stage.badgeColor}35;">
                    <span class="w-1.5 h-1.5 rounded-full" style="background:${stage.badgeColor};"></span>
                    <span>${esc(stage.label)}</span>
                </div>
                <div class="w-full bg-slate-100 rounded-full h-1.5 mt-1.5 overflow-hidden" style="max-width:130px;">
                    <div class="h-1.5 rounded-full transition-all duration-300" style="width:${stage.percent}%; background:${stage.badgeColor};"></div>
                </div>
                <div class="flex items-center justify-between text-[10px] text-slate-400 mt-1" style="max-width:130px;">
                    <span>${stage.percent}% Selesai</span>
                    ${c.slaStatus && c.slaStatus !== '-' ? `<span class="${c.isOverdueSla ? 'text-rose-600 font-bold' : 'text-slate-500'}">${esc(c.slaStatus)}</span>` : ''}
                </div>
                ${revisionBadgeHtml}
            </td>

            <!-- 4. Masa Berlaku & Durasi -->
            <td>
                <div class="text-[11px] text-slate-800 font-semibold whitespace-nowrap mb-1">
                    ${esc(c.tglMulai || '-')} &ndash; ${esc(c.tglSelesai || '-')}
                </div>
                <div>${expiryBadgeHtml}</div>
                <div class="text-[10px] text-slate-500 mt-1 flex items-center gap-1 font-medium">
                    <span>⏱️</span> <span>${processDays !== null ? processDays + ' hari proses' : '-'}</span>
                </div>
            </td>

            <!-- 5. Kelengkapan Berkas -->
            <td>
                <span class="inline-flex items-center px-2 py-0.5 rounded-md text-[10.5px] font-semibold ${isDocComplete ? 'bg-sky-50 text-sky-700 border border-sky-200' : 'bg-amber-50 text-amber-800 border border-amber-200'}">
                    ${esc(c.kelengkapan || 'Lengkap')}
                </span>
                <div>${linkDocHtml}</div>
            </td>

            <!-- 6. Nilai Kontrak -->
            <td class="text-right font-bold text-slate-900 text-xs font-mono whitespace-nowrap">
                ${c.nilai ? formatRupiah(c.nilai) : '-'}
            </td>

            <!-- 7. Kepatuhan -->
            <td class="text-center">
                <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold ${isComply ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}">
                    ${isComply ? '✓ Comply' : '✗ Not Comply'}
                </span>
            </td>

            <!-- 8. Aksi Detail -->
            <td class="text-center">
                <button onclick="openContractDetailModal('${esc(c.noKontrak)}')" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 hover:text-ethos-700 font-bold text-xs transition border border-slate-200 shadow-2xs hover:border-slate-300 cursor-pointer" title="Lihat Detail & Stepper">
                    <span>Detail</span>
                    <svg class="w-3 h-3 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
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
    buttonsHtml += `
        <button onclick="goToContractPage(${contractCurrentPage - 1})" ${contractCurrentPage === 1 ? 'disabled' : ''} class="page-btn">
            ‹ Prev
        </button>
    `;

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

    buttonsHtml += `
        <button onclick="goToContractPage(${contractCurrentPage + 1})" ${contractCurrentPage === totalPages ? 'disabled' : ''} class="page-btn">
            Next ›
        </button>
    `;

    navEl.innerHTML = buttonsHtml;
}

function goToContractPage(page) {
    contractCurrentPage = page;
    applyAndRender();
    const section = document.getElementById('sectionContractsTableCard');
    if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function changeContractPageSize(newSize) {
    contractPageSize = parseInt(newSize, 10) || 10;
    contractCurrentPage = 1;
    applyAndRender();
}

// =====================================================
// QUICK FILTER PILLS (EXPIRY & WORKFLOW STAGE)
// =====================================================
function filterContractsByExpiry(filter) {
    contractExpiryFilter = filter;
    contractCurrentPage = 1;
    
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
                btn.className = 'px-2.5 py-1 rounded-lg bg-ethos-600 text-white text-[11px] font-bold transition shadow-2xs cursor-pointer whitespace-nowrap';
            } else {
                btn.className = 'px-2.5 py-1 rounded-lg bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 transition text-[11px] font-semibold cursor-pointer whitespace-nowrap';
            }
        }
    }
    
    applyAndRender();
}

function filterContractsByStage(stage) {
    contractStageFilter = stage;
    contractCurrentPage = 1;

    const btnIds = {
        'all': 'btnStageAll',
        'pengajuan': 'btnStagePengajuan',
        'draft': 'btnStageDraft',
        'paraf_vendor': 'btnStageParafVendor',
        'paraf_ethos': 'btnStageParafEthos',
        'revisi': 'btnStageRevisi',
        'renvoi': 'btnStageRenvoi',
        'ttd': 'btnStageTtd',
        'aktif': 'btnStageAktif'
    };

    for (const key in btnIds) {
        const btn = document.getElementById(btnIds[key]);
        if (btn) {
            if (key === stage) {
                btn.className = 'px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-[11px] font-bold transition shadow-2xs cursor-pointer whitespace-nowrap';
            } else {
                btn.className = 'px-2.5 py-1 rounded-lg bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 transition text-[11px] font-semibold cursor-pointer whitespace-nowrap';
            }
        }
    }

    applyAndRender();
}

function resetAllContractFilters() {
    contractExpiryFilter = 'all';
    contractStageFilter = 'all';
    contractCategoryFilter = 'all';
    contractComplianceFilter = 'all';
    contractCurrentPage = 1;

    const catSelect = document.getElementById('slicerCategorySelect');
    if (catSelect) catSelect.value = 'all';
    const compSelect = document.getElementById('slicerComplianceSelect');
    if (compSelect) compSelect.value = 'all';
    const searchInput = document.getElementById('contractSearchInput');
    if (searchInput) searchInput.value = '';

    filterContractsByExpiry('all');
    filterContractsByStage('all');

    showToast('Filter telah direset ke kondisi awal.', 'info');
}

// =====================================================
// MODAL DETAIL KONTRAK & WORKFLOW LIFECYCLE TIMELINE
// =====================================================
function openContractDetailModal(noKontrak) {
    const modal = document.getElementById('contractDetailModal');
    if (!modal) return;

    const list = (contractDashboardData && contractDashboardData.contractCompliance) ? (contractDashboardData.contractCompliance.list || []) : [];
    const c = list.find(item => item.noKontrak && item.noKontrak.toString().trim() === noKontrak.toString().trim()) || list[0];
    if (!c) {
        showToast('Data kontrak tidak ditemukan.', 'error');
        return;
    }

    const titleEl = document.getElementById('cdmNoKontrak');
    const subEl = document.getElementById('cdmVendorSubtitle');
    const contentEl = document.getElementById('contractDetailContent');

    if (titleEl) titleEl.textContent = `Kontrak #${c.noKontrak}`;
    if (subEl) subEl.textContent = `${c.vendor} · ${c.jenisPekerjaan || 'Ruang Lingkup'}`;

    const stage = c._stageObj || normalizeContractStageFrontend(c.tahapProgress, c.status, c.tglSelesai);
    const days = c._daysRemaining !== undefined ? c._daysRemaining : getContractDaysRemaining(c.tglSelesai);
    const processDays = c._processDays !== undefined ? c._processDays : getContractProcessDays(c.tglPengajuan, c.tglRealisasi);
    const isComply = c.status && c.status.toLowerCase() === 'comply';

    const workflowSteps = [
        { num: 1, key: 'pengajuan', title: 'Pengajuan ke Legal', desc: 'ToR & Penawaran' },
        { num: 2, key: 'draft', title: 'Draft Keluar', desc: 'Drafting Legalitas' },
        { num: 3, key: 'paraf_vendor', title: 'Paraf Vendor', desc: 'Review Rekanan' },
        { num: 4, key: 'paraf_ethos', title: 'Paraf Ethos', desc: 'Review Internal' },
        { num: 5, key: 'revisi', title: 'Revisi / Renvoi', desc: 'Klausul & Pasal' },
        { num: 6, key: 'ttd', title: 'Tanda Tangan', desc: 'Direksi & Rekanan' },
        { num: 7, key: 'aktif', title: 'Aktif & Sah', desc: 'Berlaku Efektif' }
    ];

    const currentStepNum = stage.step;
    const hasRevision = stage.isRevision || stage.isRenvoi || (c.statusRevisi && c.statusRevisi.trim() !== '' && c.statusRevisi !== '-');

    let stepperHtml = `
    <div class="bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-2xs">
        <div class="flex items-center justify-between mb-3.5 flex-wrap gap-2">
            <div class="flex items-center gap-2">
                <span class="text-xs font-bold uppercase tracking-wider text-slate-500">Siklus Pengerjaan Kontrak</span>
                <span class="px-2.5 py-0.5 rounded-full text-[11px] font-black" style="background:${stage.badgeBg}; color:${stage.badgeColor}; border:1px solid ${stage.badgeColor}40;">
                    ${esc(stage.label)}
                </span>
            </div>
            <span class="text-xs font-bold text-slate-700 bg-white border border-slate-200 px-2 py-0.5 rounded-lg shadow-2xs">${stage.percent}% Selesai</span>
        </div>

        <div class="w-full bg-slate-200/80 rounded-full h-2 mb-4 overflow-hidden">
            <div class="h-2 rounded-full transition-all duration-500" style="width:${stage.percent}%; background:${stage.badgeColor};"></div>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-center text-xs">
    `;

    workflowSteps.forEach(st => {
        let iconHtml = '';
        let stepBorder = 'border-slate-200';
        let stepBg = 'bg-white';
        let textColor = 'text-slate-600';

        if (st.num < 5) {
            if (currentStepNum > st.num || currentStepNum >= 7) {
                stepBorder = 'border-emerald-300';
                stepBg = 'bg-emerald-50/70';
                textColor = 'text-emerald-800 font-bold';
                iconHtml = '✓';
            } else if (currentStepNum === st.num) {
                stepBorder = 'border-sky-500 shadow-xs ring-2 ring-sky-100';
                stepBg = 'bg-sky-50';
                textColor = 'text-sky-900 font-black';
                iconHtml = '▶';
            } else {
                iconHtml = st.num;
                textColor = 'text-slate-400';
            }
        } else if (st.num === 5) {
            if (hasRevision) {
                if (currentStepNum === 5 || currentStepNum === 6) {
                    stepBorder = 'border-rose-400 shadow-xs ring-2 ring-rose-100';
                    stepBg = 'bg-rose-50';
                    textColor = 'text-rose-900 font-black';
                    iconHtml = '⚠️';
                } else if (currentStepNum > 6) {
                    stepBorder = 'border-amber-300';
                    stepBg = 'bg-amber-50';
                    textColor = 'text-amber-800 font-bold';
                    iconHtml = '✓';
                } else {
                    iconHtml = '5';
                    textColor = 'text-slate-400';
                }
            } else {
                if (currentStepNum >= 7) {
                    stepBorder = 'border-slate-200';
                    stepBg = 'bg-slate-100/60';
                    textColor = 'text-slate-400';
                    iconHtml = '—';
                } else {
                    iconHtml = '5';
                    textColor = 'text-slate-400';
                }
            }
        } else if (st.num === 6) {
            if (currentStepNum > 7) {
                stepBorder = 'border-emerald-300';
                stepBg = 'bg-emerald-50/70';
                textColor = 'text-emerald-800 font-bold';
                iconHtml = '✓';
            } else if (currentStepNum === 7) {
                stepBorder = 'border-teal-500 shadow-xs ring-2 ring-teal-100';
                stepBg = 'bg-teal-50';
                textColor = 'text-teal-900 font-black';
                iconHtml = '▶';
            } else {
                iconHtml = '6';
                textColor = 'text-slate-400';
            }
        } else if (st.num === 7) {
            if (currentStepNum >= 8) {
                stepBorder = 'border-emerald-500 shadow-xs';
                stepBg = 'bg-emerald-100/80';
                textColor = 'text-emerald-900 font-black';
                iconHtml = '🎉';
            } else {
                iconHtml = '7';
                textColor = 'text-slate-400';
            }
        }

        stepperHtml += `
            <div class="border ${stepBorder} ${stepBg} rounded-xl p-2.5 flex flex-col items-center justify-between transition-all shadow-2xs">
                <div class="w-6 h-6 rounded-full flex items-center justify-center text-[10.5px] font-bold ${textColor} mb-1 bg-white/90 shadow-2xs">
                    ${iconHtml}
                </div>
                <div class="text-[10px] font-bold ${textColor} leading-tight">${st.title}</div>
                <div class="text-[9px] text-slate-400 mt-0.5">${st.desc}</div>
            </div>
        `;
    });

    stepperHtml += `
        </div>
    </div>
    `;

    let infoHtml = `
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
        <div class="bg-slate-50/80 border border-slate-200/90 rounded-2xl p-4 space-y-2.5 shadow-2xs">
            <h4 class="font-bold text-slate-900 text-[11px] uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200/80 pb-2">
                <span>⚖️</span> Informasi Legalitas &amp; SLA
            </h4>
            
            <div class="flex justify-between items-center">
                <span class="text-slate-500">Nomor Kontrak:</span>
                <strong class="text-ethos-700 font-mono font-bold">#${esc(c.noKontrak)}</strong>
            </div>

            <div class="flex justify-between items-center">
                <span class="text-slate-500">PIC / Divisi Pengaju:</span>
                <strong class="text-slate-800">${esc(c.picDivisi || '-')}</strong>
            </div>

            <div class="flex justify-between items-center">
                <span class="text-slate-500">Tanggal Pengajuan:</span>
                <strong class="text-slate-800">${esc(c.tglPengajuan || '-')}</strong>
            </div>

            <div class="flex justify-between items-center">
                <span class="text-slate-500">Durasi Pengerjaan:</span>
                <strong class="text-slate-800">${processDays !== null ? `${processDays} Hari Kalender` : '-'}</strong>
            </div>

            <div class="flex justify-between items-center">
                <span class="text-slate-500">Target Selesai SLA:</span>
                <strong class="text-slate-800">${esc(c.targetSelesai || '-')}</strong>
            </div>

            <div class="flex justify-between items-center">
                <span class="text-slate-500">Status SLA:</span>
                <span class="px-2 py-0.5 rounded text-[10px] font-bold ${c.isOverdueSla ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}">
                    ${esc(c.slaStatus || (stage.isFinal ? 'Selesai' : 'On Track'))}
                </span>
            </div>

            <div class="flex justify-between items-center">
                <span class="text-slate-500">Tanggal Realisasi TTD:</span>
                <strong class="text-slate-800">${esc(c.tglRealisasi || (stage.isFinal ? 'Selesai' : 'Dalam Proses'))}</strong>
            </div>
        </div>

        <div class="bg-slate-50/80 border border-slate-200/90 rounded-2xl p-4 space-y-2.5 shadow-2xs">
            <h4 class="font-bold text-slate-900 text-[11px] uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200/80 pb-2">
                <span>💼</span> Komersial &amp; Masa Berlaku
            </h4>

            <div class="flex justify-between items-center">
                <span class="text-slate-500">Mitra Rekanan:</span>
                <strong class="text-slate-900 truncate max-w-[170px]" title="${esc(c.vendor)}">${esc(c.vendor)}</strong>
            </div>

            <div class="flex justify-between items-center">
                <span class="text-slate-500">Nilai Kontrak:</span>
                <strong class="text-slate-900 font-bold font-mono">${c.nilai ? formatRupiah(c.nilai) : '-'}</strong>
            </div>

            <div class="flex justify-between items-center">
                <span class="text-slate-500">Periode Kontrak:</span>
                <strong class="text-slate-800">${esc(c.tglMulai || '-')} &ndash; ${esc(c.tglSelesai || '-')}</strong>
            </div>

            <div class="flex justify-between items-center">
                <span class="text-slate-500">Sisa Masa Berlaku:</span>
                ${days !== null ? (
                    days < 0 ? `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">Lewat ${Math.abs(days)} Hari (Expired)</span>` :
                    days <= 30 ? `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900">Kritis Sisa ${days} Hari</span>` :
                    `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">Sisa ${days} Hari (Aman)</span>`
                ) : '<span class="text-slate-400">-</span>'}
            </div>

            <div class="flex justify-between items-center">
                <span class="text-slate-500">Kelengkapan Dokumen:</span>
                <strong class="text-slate-800">${esc(c.kelengkapan || 'Lengkap')}</strong>
            </div>

            <div class="flex justify-between items-center">
                <span class="text-slate-500">Kepatuhan Regulasi:</span>
                <span class="px-2 py-0.5 rounded text-[10px] font-bold ${isComply ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}">
                    ${isComply ? '✓ Comply' : '✗ Not Comply'}
                </span>
            </div>

            <div class="flex justify-between items-center">
                <span class="text-slate-500">File Draft / Naskah:</span>
                ${c.linkDokumen && c.linkDokumen.trim() !== '' && c.linkDokumen !== '-' ? `
                    <a href="${esc(c.linkDokumen)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-ethos-600 hover:bg-ethos-700 text-white font-bold text-[10.5px] transition cursor-pointer shadow-2xs">
                        <span>🔗 Buka File Drive</span>
                    </a>
                ` : '<span class="text-slate-400">Belum ada link</span>'}
            </div>
        </div>
    </div>
    `;

    let revisionDetailHtml = '';
    if (hasRevision) {
        revisionDetailHtml = `
        <div class="bg-rose-50 border border-rose-200 rounded-xl p-3.5 text-xs text-rose-900">
            <div class="flex items-center gap-2 font-bold mb-1">
                <span>🔄</span>
                <span>Catatan Revisi / Renvoi Kontrak:</span>
            </div>
            <p class="text-rose-800 text-[11.5px] leading-relaxed">
                ${esc(c.statusRevisi || 'Terdapat penyesuaian klausul kontrak yang sedang diproses oleh tim Legal.')}
            </p>
        </div>
        `;
    }

    let remarksHtml = '';
    if (c.keterangan && c.keterangan.trim() !== '' && c.keterangan !== '-') {
        remarksHtml = `
        <div class="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-700">
            <strong class="text-slate-900 block mb-0.5">📝 Catatan Tambahan:</strong>
            <p class="text-slate-600 leading-relaxed">${esc(c.keterangan)}</p>
        </div>
        `;
    }

    if (contentEl) {
        contentEl.innerHTML = stepperHtml + infoHtml + revisionDetailHtml + remarksHtml;
    }

    modal.style.display = 'flex';
}

function closeContractDetailModal() {
    const modal = document.getElementById('contractDetailModal');
    if (modal) modal.style.display = 'none';
}

// =====================================================
// MODAL PANDUAN KOLOM SHEET KONTRAK VENDOR
// =====================================================
function openContractGuideModal() {
    const modal = document.getElementById('contractGuideModal');
    if (modal) modal.style.display = 'flex';
}

function closeContractGuideModal() {
    const modal = document.getElementById('contractGuideModal');
    if (modal) modal.style.display = 'none';
}

function copyContractHeadersToClipboard() {
    const headers = [
        'No Kontrak',
        'Nama Vendor',
        'Ruang Lingkup / Jenis Pekerjaan',
        'PIC / Divisi',
        'Tanggal Pengajuan ke Legal',
        'Tanggal Mulai Kontrak',
        'Tanggal Selesai Kontrak',
        'Tahap Progress Pengerjaan',
        'Target Selesai SLA',
        'Tanggal Realisasi TTD',
        'Status Revisi / Renvoi',
        'Kelengkapan Dokumen',
        'Nilai Kontrak (Rp)',
        'Status Kepatuhan',
        'Link Dokumen Kontrak',
        'Keterangan'
    ];
    const textToCopy = headers.join('\t');
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(textToCopy).then(() => {
            showToast('16 Header Kolom berhasil disalin ke Clipboard! Tinggal paste di Baris 1 Sheet Google.', 'success');
        }).catch(() => {
            fallbackCopyText(textToCopy);
        });
    } else {
        fallbackCopyText(textToCopy);
    }
}

function fallbackCopyText(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
        document.execCommand('copy');
        showToast('16 Header Kolom berhasil disalin ke Clipboard!', 'success');
    } catch (e) {
        prompt('Silakan salin header di bawah ini:', text);
    }
    document.body.removeChild(ta);
}

// =====================================================
// EXPORT CSV UTILITY
// =====================================================
function exportContractCsv() {
    if (!contractDashboardData || !contractDashboardData.contractCompliance || !contractDashboardData.contractCompliance.list || contractDashboardData.contractCompliance.list.length === 0) {
        showToast('Tidak ada data kontrak untuk diexport.', 'error');
        return;
    }
    const list = contractDashboardData.contractCompliance.list;
    let csv = 'No Kontrak,Vendor,Ruang Lingkup,Divisi/PIC,Tgl Pengajuan Legal,Tgl Mulai,Tgl Selesai,Tahap Progress,Target SLA,Tgl Realisasi TTD,Status Revisi/Renvoi,Sisa Hari Masa Berlaku,Durasi Pengerjaan (Hari),Status SLA,Kelengkapan Dokumen,Nilai Kontrak,Status Kepatuhan,Link Dokumen,Keterangan\n';
    list.forEach(c => {
        const stage = c._stageObj || normalizeContractStageFrontend(c.tahapProgress, c.status, c.tglSelesai);
        const daysRemaining = c._daysRemaining !== undefined ? c._daysRemaining : getContractDaysRemaining(c.tglSelesai);
        const processDays = c._processDays !== undefined ? c._processDays : getContractProcessDays(c.tglPengajuan, c.tglRealisasi);
        const slaStatus = c.slaStatus || '-';
        csv += `"${escCsv(c.noKontrak)}","${escCsv(c.vendor)}","${escCsv(c.jenisPekerjaan || '-')}","${escCsv(c.picDivisi || '-')}","${escCsv(c.tglPengajuan || '-')}","${escCsv(c.tglMulai || '-')}","${escCsv(c.tglSelesai || '-')}","${escCsv(stage.label)}","${escCsv(c.targetSelesai || '-')}","${escCsv(c.tglRealisasi || '-')}","${escCsv(c.statusRevisi || '-')}","${daysRemaining !== null ? daysRemaining : '-'}","${processDays !== null ? processDays : '-'}","${escCsv(slaStatus)}","${escCsv(c.kelengkapan || '-')}","${c.nilai || 0}","${escCsv(c.status || 'Comply')}","${escCsv(c.linkDokumen || '-')}","${escCsv(c.keterangan || '-')}"\n`;
    });
    const nowStr = new Date().toISOString().slice(0, 10);
    downloadCsv(csv, `Laporan_Contract_Repository_Compliance_${nowStr}.csv`);
    showToast('Laporan Contract Repository & Compliance berhasil diunduh.', 'success');
}

// =====================================================
// UTILITIES
// =====================================================
function formatRupiah(num) {
    if (num === null || num === undefined || isNaN(num)) return '-';
    return 'Rp ' + Number(num).toLocaleString('id-ID');
}

function esc(str) {
    if (str === null || str === undefined) return '';
    return str.toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function escCsv(str) {
    if (str === null || str === undefined) return '';
    return str.toString().replace(/"/g, '""');
}

function downloadCsv(csvContent, filename) {
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function showToast(msg, type = 'info') {
    const box = document.getElementById('toastBox');
    if (!box) return;
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.textContent = msg;
    box.appendChild(t);
    setTimeout(() => t.classList.add('show'), 50);
    setTimeout(() => {
        t.classList.remove('show');
        setTimeout(() => t.remove(), 350);
    }, 3500);
}
