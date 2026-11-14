// =====================================================
// KONFIGURASI API & STATE DASHBOARD KONTRAK
// =====================================================
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxJcNZ4VGYBugfucxm3eZh68r8NieCeAL4E_KuARRrDM5ycpDlfJrZ99u6Zi8I_aIG_Rg/exec';

let contractDashboardData = null;
let lastContractComplianceData = null;

let contractExpiryFilter = 'all'; // 'all' | 'expired' | 'critical' | 'warning' | 'safe'
let contractStageFilter = 'all';  // 'all' | 'pengajuan' | 'draft' | 'paraf_vendor' | 'paraf_ethos' | 'revisi' | 'renvoi' | 'ttd' | 'aktif'
let contractCategoryFilter = 'all';
let contractComplianceFilter = 'all';

let contractCurrentPage = 1;
let contractPageSize = 10;
let contractViewMode = 'table'; // 'table' | 'kanban'

let complianceChartInstance = null;
let workflowChartInstance = null;

document.addEventListener('DOMContentLoaded', () => {
    checkAdminAccess();
});

// =====================================================
// AUTHENTICATION (PIN 9999 Admin / PIN 1282 User Kontrak)
// =====================================================
function checkAdminAccess() {
    const savedPin = sessionStorage.getItem('ethos_pin') || localStorage.getItem('ethos_pin');
    const authOverlay = document.getElementById('adminAuthOverlay');
    
    if (savedPin === '8899') {
        window.location.href = 'katalog.html';
        return;
    }

    if (savedPin === '9999' || savedPin === '1282') {
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
        if (pin === '9999' || pin === '1282') {
            const roleName = pin === '1282' ? 'User Kontrak' : 'Administrator';
            sessionStorage.setItem('ethos_pin', pin);
            sessionStorage.setItem('ethos_nama', roleName);
            localStorage.setItem('ethos_pin', pin);
            localStorage.setItem('ethos_nama', roleName);
            if (pin === '1282') {
                sessionStorage.setItem('ethos_role', 'kontrak_only');
                localStorage.setItem('ethos_role', 'kontrak_only');
            } else {
                sessionStorage.removeItem('ethos_role');
                localStorage.removeItem('ethos_role');
            }
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
                errEl.textContent = '❌ PIN salah. Akses Contract Repository hanya untuk Administrator (PIN: 9999) atau User Kontrak (PIN: 1282).';
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
    const savedPin = sessionStorage.getItem('ethos_pin') || localStorage.getItem('ethos_pin');
    const savedName = sessionStorage.getItem('ethos_nama') || localStorage.getItem('ethos_nama');
    const userEl = document.getElementById('headerUser');
    const navDashboard = document.getElementById('navLinkDashboard');
    const navKatalog = document.getElementById('navLinkKatalog');
    const navPenilaian = document.getElementById('navLinkPenilaian');
    const footerNav = document.getElementById('footerNavLinks');

    if (savedPin === '1282') {
        if (userEl) userEl.textContent = `👤 User Kontrak (PIN: 1282)`;
        if (navDashboard) navDashboard.style.display = 'none';
        if (navKatalog) navKatalog.style.display = 'none';
        if (navPenilaian) navPenilaian.style.display = 'none';
        if (footerNav) footerNav.style.display = 'none';
    } else {
        const displayName = savedName || 'Administrator';
        const displayPin = savedPin || '9999';
        if (userEl) userEl.textContent = `👤 ${displayName} (PIN: ${displayPin})`;
        if (navDashboard) navDashboard.style.display = '';
        if (navKatalog) navKatalog.style.display = '';
        if (navPenilaian) navPenilaian.style.display = '';
        if (footerNav) footerNav.style.display = '';
    }
}

function adminLogout() {
    sessionStorage.removeItem('ethos_pin');
    sessionStorage.removeItem('ethos_nama');
    sessionStorage.removeItem('ethos_role');
    sessionStorage.removeItem('ethos_user_vendors');
    localStorage.removeItem('ethos_pin');
    localStorage.removeItem('ethos_nama');
    localStorage.removeItem('ethos_role');
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
function isDateString(val) {
    if (!val || val === '-' || val === '---') return false;
    const s = String(val).trim();
    if (s.includes('GMT') || s.includes('Waktu Indonesia')) return true;
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return true;
    if (/^\d{1,2}[\s\-\/\.]+[a-zA-Z]+[\s\-\/\.]+\d{4}/.test(s)) return true;
    if (/^\d{1,2}[\s\-\/\.]+\d{1,2}[\s\-\/\.]+\d{4}/.test(s)) return true;
    const d = new Date(s);
    return !isNaN(d.getTime()) && d.getFullYear() > 2000 && d.getFullYear() < 2100;
}

function parseAnyDate(val) {
    if (!val || val === '-' || val === '---') return null;
    if (val instanceof Date && !isNaN(val.getTime())) return val;
    const s = String(val).trim();
    if (!s || s === '-') return null;

    const idMonths = {
        'jan': 0, 'januari': 0,
        'feb': 1, 'februari': 1,
        'mar': 2, 'maret': 2,
        'apr': 3, 'april': 3,
        'mei': 4, 'may': 4,
        'jun': 5, 'juni': 5,
        'jul': 6, 'juli': 6,
        'agu': 7, 'agustus': 7, 'agt': 7, 'aug': 7,
        'sep': 8, 'september': 8,
        'okt': 9, 'oktober': 9, 'oct': 9,
        'nov': 10, 'november': 10,
        'des': 11, 'desember': 11, 'dec': 11
    };

    const m1 = s.match(/^(\d{1,2})[\s\-\/\.]+(\w+)[\s\-\/\.]+(\d{4})/);
    if (m1) {
        const day = parseInt(m1[1], 10);
        const mStr = m1[2].toLowerCase();
        const yr = parseInt(m1[3], 10);
        if (idMonths[mStr] !== undefined) {
            return new Date(yr, idMonths[mStr], day);
        }
        const mNum = parseInt(mStr, 10);
        if (!isNaN(mNum) && mNum >= 1 && mNum <= 12) {
            return new Date(yr, mNum - 1, day);
        }
    }

    const d = new Date(s);
    if (!isNaN(d.getTime())) return d;
    return null;
}

function formatPrettyDate(val) {
    const d = parseAnyDate(val);
    if (!d) return (typeof val === 'string' && val.length < 25 && val !== '-') ? val : '-';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function getContractDaysRemaining(dateStr) {
    if (!dateStr || dateStr === '-' || dateStr.toLowerCase().includes('belum')) return null;
    const target = parseAnyDate(dateStr);
    if (!target) return null;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);
    return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}

function getContractProcessDays(tglPengajuan, tglRealisasi) {
    if (!tglPengajuan || tglPengajuan === '-' || tglPengajuan.toLowerCase().includes('belum')) return null;
    const submit = parseAnyDate(tglPengajuan);
    if (!submit) return null;
    let end = new Date();
    if (tglRealisasi && tglRealisasi !== '-' && !tglRealisasi.toLowerCase().includes('belum')) {
        const r = parseAnyDate(tglRealisasi);
        if (r) end = r;
    }
    submit.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    return Math.max(0, Math.floor((end - submit) / (1000 * 60 * 60 * 24)));
}

function normalizeContractStageFrontend(rawStage, rawStatus, tglSelesai) {
    const s = (rawStage || '').toString().trim().toLowerCase();
    
    // 1. Pemenuhan Dokumen
    if (s.includes('pemenuhan') || s.includes('kelengkapan dokumen') || s.includes('syarat dokumen') || s.includes('pemenuhan dokumen')) {
        return { step: 1, key: 'pemenuhan_dokumen', label: '1. Pemenuhan Dokumen', percent: 10, badgeColor: '#0284c7', badgeBg: '#f0f9ff', isRevision: false, isRenvoi: false, isFinal: false };
    }
    // 3. Review Legal Ethos (sebelum generic ethos/legal)
    if (s.includes('review legal ethos') || s.includes('review ethos') || s.includes('legal ethos') || s.includes('review internal')) {
        return { step: 3, key: 'review_legal_ethos', label: '3. Review Legal Ethos', percent: 30, badgeColor: '#4f46e5', badgeBg: '#eef2ff', isRevision: false, isRenvoi: false, isFinal: false };
    }
    // 5. Review Legal Vendor (sebelum generic vendor)
    if (s.includes('review legal vendor') || s.includes('review legal rekanan') || s.includes('review legal pihak ke')) {
        return { step: 5, key: 'review_legal_vendor', label: '5. Review Legal Vendor', percent: 50, badgeColor: '#c026d3', badgeBg: '#fdf4ff', isRevision: false, isRenvoi: false, isFinal: false };
    }
    // 2. Pengajuan Legal
    if (s.includes('pengajuan') || s.includes('masuk legal') || s.includes('ajukan')) {
        return { step: 2, key: 'pengajuan', label: '2. Pengajuan Legal', percent: 20, badgeColor: '#2563eb', badgeBg: '#eff6ff', isRevision: false, isRenvoi: false, isFinal: false };
    }
    // 4. Draft Keluar
    if (s.includes('draft') || s.includes('penyusunan')) {
        return { step: 4, key: 'draft', label: '4. Draft Keluar', percent: 40, badgeColor: '#7c3aed', badgeBg: '#f5f3ff', isRevision: false, isRenvoi: false, isFinal: false };
    }
    // 6. Paraf Vendor
    if (s.includes('paraf vendor') || s.includes('review vendor') || s.includes('paraf rekanan')) {
        return { step: 6, key: 'paraf_vendor', label: '6. Paraf Vendor', percent: 60, badgeColor: '#d97706', badgeBg: '#fffbeb', isRevision: false, isRenvoi: false, isFinal: false };
    }
    // 7. Paraf Ethos
    if (s.includes('paraf ethos') || s.includes('paraf internal') || (s.includes('paraf') && !s.includes('vendor'))) {
        return { step: 7, key: 'paraf_ethos', label: '7. Paraf Ethos', percent: 70, badgeColor: '#9333ea', badgeBg: '#faf5ff', isRevision: false, isRenvoi: false, isFinal: false };
    }
    // 8. Revisi
    if (s.includes('revisi')) {
        return { step: 8, key: 'revisi', label: '8. Revisi', percent: 65, badgeColor: '#e11d48', badgeBg: '#fff1f2', isRevision: true, isRenvoi: false, isFinal: false };
    }
    // 9. Tanda Tangan
    if (s.includes('tanda tangan') || s.includes('ttd') || s.includes('signing') || s.includes('e-sign')) {
        return { step: 9, key: 'ttd', label: '9. Tanda Tangan', percent: 85, badgeColor: '#0d9488', badgeBg: '#f0fdfa', isRevision: false, isRenvoi: false, isFinal: false };
    }
    // 10. Aktif Sah
    if (s.includes('aktif') || s.includes('selesai') || s.includes('berlaku') || s.includes('done')) {
        return { step: 10, key: 'aktif', label: '10. Aktif Sah', percent: 100, badgeColor: '#16a34a', badgeBg: '#f0fdf4', isRevision: false, isRenvoi: false, isFinal: true };
    }
    // 11. Expired
    if (s.includes('expired') || s.includes('kadaluarsa') || s.includes('berakhir')) {
        return { step: 11, key: 'expired', label: '11. Berakhir / Expired', percent: 100, badgeColor: '#64748b', badgeBg: '#f8fafc', isRevision: false, isRenvoi: false, isFinal: true };
    }
    // 12. Renvoi (paling bawah sendiri)
    if (s.includes('renvoi')) {
        return { step: 12, key: 'renvoi', label: '12. Renvoi', percent: 75, badgeColor: '#ea580c', badgeBg: '#fff7ed', isRevision: false, isRenvoi: true, isFinal: false };
    }

    if (rawStage && rawStage.toString().trim() !== '') {
        return { step: 0, key: 'lainnya', label: rawStage.toString().trim(), percent: 50, badgeColor: '#475569', badgeBg: '#f1f5f9', isRevision: false, isRenvoi: false, isFinal: false };
    }

    const isComply = (rawStatus || '').toString().toLowerCase().includes('comply');
    if (isComply) {
        return { step: 10, key: 'aktif', label: '10. Aktif Sah', percent: 100, badgeColor: '#16a34a', badgeBg: '#f0fdf4', isRevision: false, isRenvoi: false, isFinal: true };
    }

    return { step: 2, key: 'pengajuan', label: '2. Pengajuan Legal', percent: 20, badgeColor: '#2563eb', badgeBg: '#eff6ff', isRevision: false, isRenvoi: false, isFinal: false };
}

// =====================================================
// RENDER EXECUTIVE DASHBOARD (KPIS, CHARTS & TABLE)
// =====================================================
function applyAndRender() {
    if (!contractDashboardData || !contractDashboardData.contractCompliance) return;

    const rawList = contractDashboardData.contractCompliance.list || [];
    
    // Annotate list items & detect shifted date columns from Sheet
    rawList.forEach(c => {
        let startCandidate = c.tglMulai;
        let endCandidate = c.tglSelesai;
        let cleanLingkup = c.jenisPekerjaan || '-';
        let cleanDiv = c.picDivisi || '-';

        // Jika jenisPekerjaan berisi string tanggal (misal akibat pergeseran kolom sheet), jadikan tglMulai
        if (isDateString(c.jenisPekerjaan)) {
            if (!startCandidate || startCandidate === '-') {
                startCandidate = c.jenisPekerjaan;
            }
            cleanLingkup = '-';
        }
        // Jika picDivisi berisi string tanggal, jadikan tglSelesai
        if (isDateString(c.picDivisi)) {
            if (!endCandidate || endCandidate === '-') {
                endCandidate = c.picDivisi;
            }
            cleanDiv = '-';
        }

        c._cleanMulai = formatPrettyDate(startCandidate);
        c._cleanSelesai = formatPrettyDate(endCandidate);
        c._cleanLingkup = cleanLingkup;
        c._cleanDiv = cleanDiv;

        c._stageObj = normalizeContractStageFrontend(c.tahapProgress, c.status, c._cleanSelesai);
        c._daysRemaining = getContractDaysRemaining(c._cleanSelesai);
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
        pemenuhan_dokumen: 0,
        pengajuan: 0,
        review_legal_ethos: 0,
        draft: 0,
        review_legal_vendor: 0,
        paraf_vendor: 0,
        paraf_ethos: 0,
        revisi: 0,
        ttd: 0,
        aktif: 0,
        renvoi: 0,
        expired: 0
    };

    filteredList.forEach(c => {
        if (c.nilai) totalValue += Number(c.nilai) || 0;
        const isComply = c.status && c.status.toLowerCase() === 'comply';
        if (isComply) countComply++; else countNotComply++;

        const step = c._stageObj.step;
        if (step === 10) countActive++;
        if (step >= 1 && step <= 9) countInProgress++;
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
    if (elSumLegal) elSumLegal.textContent = stageCounts.pemenuhan_dokumen + stageCounts.pengajuan + stageCounts.review_legal_ethos + stageCounts.draft;
    if (elSumParaf) elSumParaf.textContent = stageCounts.review_legal_vendor + stageCounts.paraf_vendor + stageCounts.paraf_ethos;
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
        'countStagePemenuhanDokumen': stageCounts.pemenuhan_dokumen,
        'countStagePengajuan': stageCounts.pengajuan,
        'countStageReviewLegalEthos': stageCounts.review_legal_ethos,
        'countStageDraft': stageCounts.draft,
        'countStageReviewLegalVendor': stageCounts.review_legal_vendor,
        'countStageParafVendor': stageCounts.paraf_vendor,
        'countStageParafEthos': stageCounts.paraf_ethos,
        'countStageRevisi': stageCounts.revisi,
        'countStageTtd': stageCounts.ttd,
        'countStageAktif': stageCounts.aktif,
        'countStageExpired': stageCounts.expired,
        'countStageRenvoi': stageCounts.renvoi
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

    // Render Table or Kanban based on current view mode
    renderTableRows(tableDisplayList);
    renderKanbanBoard(tableDisplayList);
    syncViewModeVisibility();
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
        '1. Pemenuhan Dokumen',
        '2. Pengajuan Legal',
        '3. Review Legal Ethos',
        '4. Draft Keluar',
        '5. Review Legal Vendor',
        '6. Paraf Vendor',
        '7. Paraf Ethos',
        '8. Revisi',
        '9. Tanda Tangan',
        '10. Aktif Sah',
        '11. Berakhir / Expired',
        '12. Renvoi'
    ];

    const dataValues = [
        stages.pemenuhan_dokumen || 0,
        stages.pengajuan || 0,
        stages.review_legal_ethos || 0,
        stages.draft || 0,
        stages.review_legal_vendor || 0,
        stages.paraf_vendor || 0,
        stages.paraf_ethos || 0,
        stages.revisi || 0,
        stages.ttd || 0,
        stages.aktif || 0,
        stages.expired || 0,
        stages.renvoi || 0
    ];

    const colors = [
        '#0284c7', // 1. Pemenuhan Dokumen (sky-600)
        '#3b82f6', // 2. Pengajuan Legal (blue-500)
        '#6366f1', // 3. Review Legal Ethos (indigo-500)
        '#8b5cf6', // 4. Draft Keluar (violet-500)
        '#d946ef', // 5. Review Legal Vendor (fuchsia-500)
        '#f59e0b', // 6. Paraf Vendor (amber-500)
        '#7c3aed', // 7. Paraf Ethos (purple-600)
        '#e11d48', // 8. Revisi (rose-600)
        '#0d9488', // 9. Tanda Tangan (teal-600)
        '#059669', // 10. Aktif Sah (emerald-600)
        '#64748b', // 11. Berakhir / Expired (slate-500)
        '#ea580c'  // 12. Renvoi (orange-600 - paling bawah)
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
            layout: {
                padding: { top: 4, bottom: 6, left: 2, right: 10 }
            },
            onClick: (event, elements) => {
                if (elements && elements.length > 0) {
                    const idx = elements[0].index;
                    const stageKeys = [
                        'pemenuhan_dokumen',
                        'pengajuan',
                        'review_legal_ethos',
                        'draft',
                        'review_legal_vendor',
                        'paraf_vendor',
                        'paraf_ethos',
                        'revisi',
                        'ttd',
                        'aktif',
                        'expired',
                        'renvoi'
                    ];
                    const selectedStage = stageKeys[idx];
                    if (selectedStage) {
                        filterContractsByStage(selectedStage);
                        const tableSection = document.getElementById('sectionContractsTableCard');
                        if (tableSection) tableSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                }
            },
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
                    ticks: { 
                        autoSkip: false,
                        font: { size: 10.5, weight: '600', family: '"Plus Jakarta Sans", sans-serif' }, 
                        color: '#334155' 
                    },
                    grid: { display: false }
                }
            }
        }
    });
}

// =====================================================
// TABLE RENDERING & PAGINATION (COMPACT & DENSE)
// =====================================================
function renderTableRows(list) {
    const tableBody = document.getElementById('contractTableBody');
    const badgeCount = document.getElementById('contractBadgeCount');
    if (!tableBody) return;

    const totalItems = list.length;
    if (badgeCount) badgeCount.textContent = `${totalItems} Kontrak`;

    if (totalItems === 0) {
        tableBody.innerHTML = `<tr><td colspan="8" class="text-center text-slate-400 py-8">
            <span class="text-xs">Tidak ada data kontrak pada filter yang dipilih.</span>
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
        const cleanVendor = (c.vendor || '').replace(/\r?\n|\r/g, ' ').trim();

        // Periode Masa Berlaku yang sudah dibersihkan
        let displayMasa = '-';
        if (c._cleanMulai && c._cleanMulai !== '-' && c._cleanSelesai && c._cleanSelesai !== '-') {
            displayMasa = `${c._cleanMulai} – ${c._cleanSelesai}`;
        } else if (c._cleanSelesai && c._cleanSelesai !== '-') {
            displayMasa = `s/d ${c._cleanSelesai}`;
        } else if (c._cleanMulai && c._cleanMulai !== '-') {
            displayMasa = `Mulai ${c._cleanMulai}`;
        }

        const days = c._daysRemaining;
        let expiryBadge = '';
        if (days !== null) {
            if (days < 0) {
                expiryBadge = `<span class="inline-block px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-rose-50 text-rose-700 border border-rose-200">Expired ${Math.abs(days)}h</span>`;
            } else if (days <= 30) {
                expiryBadge = `<span class="inline-block px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-amber-50 text-amber-800 border border-amber-200">Kritis ${days}h</span>`;
            } else if (days <= 90) {
                expiryBadge = `<span class="inline-block px-1.5 py-0.2 rounded text-[9.5px] font-semibold bg-orange-50 text-orange-800 border border-orange-200">Perhatian ${days}h</span>`;
            } else {
                expiryBadge = `<span class="inline-block px-1.5 py-0.2 rounded text-[9.5px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">Aman ${days}h</span>`;
            }
        }

        const stage = c._stageObj || normalizeContractStageFrontend(c.tahapProgress, c.status, c._cleanSelesai);

        let docLink = '<span class="text-slate-300">-</span>';
        if (c.linkDokumen && c.linkDokumen !== '-' && c.linkDokumen.startsWith('http')) {
            docLink = `<a href="${esc(c.linkDokumen)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-0.5 text-sky-600 hover:text-sky-800 hover:underline font-bold text-[11px]" title="Buka File Drive"><span>🔗</span><span>Drive</span></a>`;
        }

        // Subtitle jika ada lingkup asli yang bukan tanggal
        let subText = '';
        if (c._cleanLingkup && c._cleanLingkup !== '-' && !isDateString(c._cleanLingkup)) {
            subText = `<div class="text-[10.5px] text-slate-400 truncate max-w-[240px]">${esc(c._cleanLingkup)}</div>`;
        } else if (c._cleanDiv && c._cleanDiv !== '-' && !isDateString(c._cleanDiv)) {
            subText = `<div class="text-[10.5px] text-slate-400 truncate max-w-[240px]">${esc(c._cleanDiv)}</div>`;
        }

        return `
        <tr class="hover:bg-slate-50 transition-colors">
            <!-- 1. # (No Kontrak) -->
            <td class="text-center font-mono font-bold text-slate-700 text-xs whitespace-nowrap">
                <span class="bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded text-[11px]">#${esc(c.noKontrak)}</span>
            </td>

            <!-- 2. Vendor -->
            <td>
                <div class="font-bold text-slate-900 text-xs truncate max-w-[260px]" title="${esc(cleanVendor)}">${esc(cleanVendor)}</div>
                ${subText}
            </td>

            <!-- 3. Tahap Progress (Visual Progress Bar & Segmented Indicator) -->
            <td class="whitespace-nowrap">
                <div class="flex items-center justify-between gap-1 mb-1">
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold" style="background:${stage.badgeBg}; color:${stage.badgeColor}; border:1px solid ${stage.badgeColor}35;">
                        <span class="w-1.5 h-1.5 rounded-full" style="background:${stage.badgeColor};"></span>
                        <span>${esc(stage.label)}</span>
                    </span>
                    <span class="text-[9.5px] font-bold text-slate-500 font-mono">${stage.percent}%</span>
                </div>
                <!-- 12-Segment Progress Tracker Bar -->
                <div class="flex items-center gap-0.5 w-32" title="Progres PKS #${esc(c.noKontrak)}: ${stage.percent}% (${stage.label})">
                    ${renderMiniStepSegments(stage.step, stage.badgeColor)}
                </div>
            </td>

            <!-- 4. Masa Berlaku & Sisa Hari -->
            <td class="whitespace-nowrap">
                <div class="text-slate-800 font-medium text-[11px] leading-tight">${esc(displayMasa)}</div>
                <div class="mt-0.5 leading-none">${expiryBadge}</div>
            </td>

            <!-- 5. Dokumen -->
            <td class="text-center whitespace-nowrap">
                ${docLink}
            </td>

            <!-- 6. Nilai Kontrak -->
            <td class="text-right font-mono font-bold text-slate-900 text-xs whitespace-nowrap">
                ${c.nilai ? formatRupiah(c.nilai) : '<span class="text-slate-400 font-normal">-</span>'}
            </td>

            <!-- 7. Kepatuhan -->
            <td class="text-center whitespace-nowrap">
                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${isComply ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}">
                    ${isComply ? '✓ Comply' : '✗ Not Comply'}
                </span>
            </td>

            <!-- 8. Aksi (Detail PKS) -->
            <td class="text-center whitespace-nowrap">
                <button onclick="toggleContractRowExpand('${esc(c.noKontrak)}')" id="btnExpand_${esc(c.noKontrak)}" class="px-2.5 py-1 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] border border-indigo-200 shadow-2xs transition cursor-pointer inline-flex items-center gap-1" title="Buka detail alur pengerjaan PKS ini">
                    <span>Detail</span>
                    <span class="expand-arrow text-[9px]">▼</span>
                </button>
            </td>
        </tr>
        <!-- Expandable Inline Stepper & Context Row -->
        <tr id="expandRow_${esc(c.noKontrak)}" class="bg-indigo-50/30 border-y border-indigo-100/70" style="display: none;">
            <td colspan="8" class="p-3">
                <div class="bg-white border border-indigo-100 rounded-xl p-3.5 shadow-xs">
                    <!-- Header Alur -->
                    <div class="flex items-center justify-between mb-2.5 pb-2 border-b border-slate-100 flex-wrap gap-2">
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class="text-xs font-bold text-slate-900">Alur Pengerjaan: #${esc(c.noKontrak)} - ${esc(cleanVendor)}</span>
                            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold" style="background:${stage.badgeBg}; color:${stage.badgeColor}; border:1px solid ${stage.badgeColor}35;">
                                ${esc(stage.label)} (${stage.percent}% Selesai)
                            </span>
                        </div>
                        <div class="text-[11px] text-slate-500 font-medium flex items-center gap-2 flex-wrap">
                            <span>Target SLA: <strong class="text-slate-800">${esc(c.targetSelesai || '-')}</strong></span>
                            <span>·</span>
                            <span>Realisasi TTD: <strong class="text-slate-800">${esc(c.tglRealisasi || '-')}</strong></span>
                            ${c.linkDokumen && c.linkDokumen !== '-' && c.linkDokumen.startsWith('http') ? `<span>·</span> <a href="${esc(c.linkDokumen)}" target="_blank" rel="noopener noreferrer" class="text-sky-600 hover:underline font-bold inline-flex items-center gap-0.5"><span>🔗</span><span>Buka Drive</span></a>` : ''}
                        </div>
                    </div>

                    <!-- 12-Step Horizontal Connected Stepper Tracker -->
                    <div class="w-full overflow-x-auto pb-4 pt-3 px-3 mb-2.5 custom-scrollbar bg-slate-50/60 rounded-xl border border-slate-100 shadow-2xs">
                        <div class="flex items-start justify-between min-w-[960px] relative px-3">
                            ${renderInlineWorkflowSteps(c, stage)}
                        </div>
                    </div>

                    <!-- Ringkasan Info Tambahan (Ruang Lingkup, PIC, Keterangan, Revisi) -->
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-[11px]">
                        <div class="bg-slate-50 p-2 rounded-lg border border-slate-100">
                            <span class="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Ruang Lingkup &amp; PIC</span>
                            <div class="font-bold text-slate-800 mt-0.5 truncate" title="${esc(c.jenisPekerjaan || '-')}">${esc(c.jenisPekerjaan || '-')}</div>
                            <div class="text-slate-500 text-[10.5px]">Divisi/PIC: <span class="font-semibold text-slate-700">${esc(c.picDivisi || '-')}</span></div>
                        </div>
                        <div class="bg-slate-50 p-2 rounded-lg border border-slate-100">
                            <span class="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Durasi &amp; Status SLA</span>
                            <div class="font-bold text-slate-800 mt-0.5">${c._processDays !== null ? `${c._processDays} hari kalender` : '-'}</div>
                            <div class="text-[10.5px] ${c.isOverdueSla ? 'text-rose-600 font-bold' : 'text-emerald-600 font-semibold'}">${c.slaStatus || (c.isOverdueSla ? '⚠️ Lewat SLA' : '✓ Sesuai SLA')}</div>
                        </div>
                        <div class="bg-slate-50 p-2 rounded-lg border border-slate-100">
                            <span class="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Revisi &amp; Catatan</span>
                            <div class="font-medium text-slate-700 mt-0.5 truncate" title="${esc(c.statusRevisi || c.keterangan || '-')}">${esc(c.statusRevisi || c.keterangan || 'Tidak ada catatan revisi')}</div>
                            <div class="text-[10px] text-slate-400">Kelengkapan: ${esc(c.kelengkapan || 'Lengkap')}</div>
                        </div>
                    </div>
                </div>
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
// INLINE PROGRESS & EXPANDABLE ACCORDION PER PKS
// =====================================================
function renderMiniStepSegments(currentStep, color) {
    let html = '';
    for (let i = 1; i <= 12; i++) {
        let bg = '#e2e8f0';
        let op = '0.45';
        if (i < currentStep || (currentStep >= 10 && i <= 10)) {
            bg = '#10b981'; // completed green
            op = '1';
        } else if (i === currentStep) {
            bg = color || '#0284c7'; // active current
            op = '1';
        }
        html += `<span class="flex-1 h-1 rounded-xs transition" style="background: ${bg}; opacity: ${op};"></span>`;
    }
    return html;
}

function getContractStageDatesMap(c) {
    const raw = (c && c.stageDates && typeof c.stageDates === 'object') ? c.stageDates : {};
    return {
        1: raw[1] || c.tglDokumen || '-',
        2: raw[2] || c.tglPengajuan || '-',
        3: raw[3] || c.tglReviewEthos || '-',
        4: raw[4] || c.tglDraft || '-',
        5: raw[5] || c.tglReviewVendor || '-',
        6: raw[6] || c.tglParafVendor || '-',
        7: raw[7] || c.tglParafEthos || '-',
        8: raw[8] || c.tglRevisi || '-',
        9: raw[9] || c.tglRealisasi || '-',
        10: raw[10] || c._cleanMulai || c.tglMulai || '-',
        11: raw[11] || c._cleanSelesai || c.tglSelesai || '-',
        12: raw[12] || c.tglRenvoi || '-'
    };
}

function formatStepperDate(val) {
    if (!val) return '';
    const d = parseAnyDate(val);
    if (!d) return (typeof val === 'string' && val.length > 0 && val !== '-' && val !== '---' && !val.toLowerCase().includes('belum')) ? val : '';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function renderInlineWorkflowSteps(c, stage) {
    const steps = [
        { num: 1, key: 'pemenuhan_dokumen', title: 'Pemenuhan Dokumen' },
        { num: 2, key: 'pengajuan', title: 'Pengajuan Legal' },
        { num: 3, key: 'review_legal_ethos', title: 'Review Legal Ethos' },
        { num: 4, key: 'draft', title: 'Penyusunan Draf' },
        { num: 5, key: 'review_legal_vendor', title: 'Review Vendor' },
        { num: 6, key: 'paraf_vendor', title: 'Paraf Vendor' },
        { num: 7, key: 'paraf_ethos', title: 'Paraf Ethos' },
        { num: 8, key: 'revisi', title: 'Revisi' },
        { num: 9, key: 'ttd', title: 'Tanda Tangan' },
        { num: 10, key: 'aktif', title: 'Aktif Sah' },
        { num: 11, key: 'expired', title: 'Selesai / Expired' },
        { num: 12, key: 'renvoi', title: 'Renvoi' }
    ];

    const currentStepNum = stage.step;
    const hasRenvoi = stage.isRenvoi;
    const stageDates = getContractStageDatesMap(c);

    // Parse all dates to Date objects normalized to 00:00:00
    const parsedDates = {};
    for (let i = 1; i <= 12; i++) {
        const raw = stageDates[i];
        const dt = parseAnyDate(raw);
        if (dt) {
            dt.setHours(0, 0, 0, 0);
            parsedDates[i] = dt;
        } else {
            parsedDates[i] = null;
        }
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return steps.map((st, idx) => {
        let isDone = false;
        let isCurrent = false;

        if (st.num < 10) {
            if (currentStepNum > st.num || currentStepNum >= 10) isDone = true;
            else if (currentStepNum === st.num) isCurrent = true;
        } else if (st.num === 10) {
            if (currentStepNum === 10) isCurrent = true;
            else if (currentStepNum > 10) isDone = true;
        } else if (st.num === 11) {
            if (currentStepNum === 11) isCurrent = true;
        } else if (st.num === 12) {
            if (currentStepNum === 12) isCurrent = true;
            else if (hasRenvoi || (parsedDates[12] !== null)) isDone = true;
        }

        const rawDate = stageDates[st.num];
        const thisDate = parsedDates[st.num];
        const dateFormatted = formatStepperDate(thisDate || rawDate);

        // --- 1. Connecting Line to Next Step ---
        let lineHtml = '';
        if (idx < steps.length - 1) {
            const nextSt = steps[idx + 1];
            let isNextDone = false;
            let isNextCurrent = false;

            if (nextSt.num < 10) {
                if (currentStepNum > nextSt.num || currentStepNum >= 10) isNextDone = true;
                else if (currentStepNum === nextSt.num) isNextCurrent = true;
            } else if (nextSt.num === 10) {
                if (currentStepNum === 10) isNextCurrent = true;
                else if (currentStepNum > 10) isNextDone = true;
            } else if (nextSt.num === 11) {
                if (currentStepNum === 11) isNextCurrent = true;
            } else if (nextSt.num === 12) {
                if (currentStepNum === 12) isNextCurrent = true;
                else if (hasRenvoi || (parsedDates[12] !== null)) isNextDone = true;
            }

            let lineColorClass = 'bg-slate-200';
            let pillBadgeHtml = '';

            if (isDone && isNextDone) {
                // Completed -> Completed: Green line
                lineColorClass = 'bg-emerald-500';

                const dateNext = parsedDates[nextSt.num];
                if (thisDate && dateNext) {
                    const diffDays = Math.round((dateNext - thisDate) / (1000 * 60 * 60 * 24));
                    if (diffDays >= 0) {
                        pillBadgeHtml = `
                            <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
                                <span class="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs whitespace-nowrap">
                                    +${diffDays} hari
                                </span>
                            </div>`;
                    }
                }
            } else if (isDone && isNextCurrent) {
                // Completed -> Current: Blue line with running pill
                lineColorClass = 'bg-blue-600';

                let prevCompletedDate = null;
                for (let p = idx; p >= 0; p--) {
                    if (parsedDates[steps[p].num]) {
                        prevCompletedDate = parsedDates[steps[p].num];
                        break;
                    }
                }

                if (prevCompletedDate) {
                    const runDays = Math.max(0, Math.round((today - prevCompletedDate) / (1000 * 60 * 60 * 24)));
                    pillBadgeHtml = `
                        <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
                            <span class="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs whitespace-nowrap">
                                +${runDays} hari
                            </span>
                        </div>`;
                }
            } else {
                lineColorClass = 'bg-slate-200';
            }

            lineHtml = `
                <div class="absolute top-[14px] left-1/2 w-full h-[2.5px] ${lineColorClass} z-0 pointer-events-none">
                    ${pillBadgeHtml}
                </div>`;
        }

        // --- 2. Node Circle ---
        let nodeCircleHtml = '';
        if (isDone) {
            nodeCircleHtml = `
                <div class="relative z-10 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0 ring-4 ring-white">
                    <svg class="w-4 h-4 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                    </svg>
                </div>`;
        } else if (isCurrent) {
            nodeCircleHtml = `
                <div class="relative z-10 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center ring-4 ring-blue-100 shadow-xs shrink-0 ring-4 ring-white">
                    <div class="w-4 h-4 rounded-full bg-blue-600 flex items-center justify-center">
                        <div class="w-1.5 h-1.5 rounded-full bg-white"></div>
                    </div>
                </div>`;
        } else {
            nodeCircleHtml = `
                <div class="relative z-10 w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 border-slate-300 bg-white shrink-0 ring-4 ring-white"></div>`;
        }

        // --- 3. Text Below Node ---
        let titleClass = 'text-slate-400 font-medium';
        let subTextHtml = '';

        if (isCurrent) {
            titleClass = 'text-slate-900 font-black';

            let prevCompletedDate = null;
            for (let p = idx - 1; p >= 0; p--) {
                if (parsedDates[steps[p].num]) {
                    prevCompletedDate = parsedDates[steps[p].num];
                    break;
                }
            }
            const runDays = prevCompletedDate
                ? Math.max(0, Math.round((today - prevCompletedDate) / (1000 * 60 * 60 * 24)))
                : 0;

            subTextHtml = `
                <div class="text-[10px] text-slate-600 font-medium mt-1 leading-tight whitespace-nowrap">
                    Berjalan ${runDays} hari
                </div>`;
        } else if (isDone) {
            titleClass = 'text-slate-900 font-bold';

            if (dateFormatted) {
                subTextHtml = `
                    <div class="text-[10px] text-slate-500 font-medium mt-1 leading-tight whitespace-nowrap">
                        ${esc(dateFormatted)}
                    </div>`;
            } else {
                subTextHtml = `
                    <div class="text-[9.5px] text-emerald-600 font-medium mt-1 leading-tight">
                        Selesai
                    </div>`;
            }
        } else {
            titleClass = 'text-slate-500 font-medium';

            if (st.num === 11) {
                const tglSelesaiFormatted = formatStepperDate(c._cleanSelesai || c.tglSelesai);
                if (tglSelesaiFormatted) {
                    subTextHtml = `
                        <div class="text-[9.5px] text-slate-400 mt-1 leading-tight whitespace-nowrap">
                            ${esc(tglSelesaiFormatted)}
                        </div>`;
                }
            }
        }

        return `
        <div class="flex-1 flex flex-col items-center relative text-center min-w-[76px] px-0.5">
            ${lineHtml}
            ${nodeCircleHtml}
            <div class="mt-2 text-center w-full px-0.5">
                <div class="text-[11px] leading-tight truncate ${titleClass}" title="${esc(st.title)}">
                    ${st.title}
                </div>
                ${subTextHtml}
            </div>
        </div>`;
    }).join('');
}

// =====================================================
// KANBAN BOARD VIEW
// =====================================================
const KANBAN_PHASES = [
    {
        id: 'pra_kontrak', title: '📥 Pra-Kontrak & Legal',
        color: 'sky', borderColor: '#0284c7', bgColor: '#f0f9ff',
        steps: [1, 2, 3, 4],
        stepLabels: { 1: 'Dokumen', 2: 'Pengajuan', 3: 'Rev Ethos', 4: 'Draft' }
    },
    {
        id: 'negosiasi', title: '🤝 Negosiasi & Review',
        color: 'amber', borderColor: '#d97706', bgColor: '#fffbeb',
        steps: [5, 8],
        stepLabels: { 5: 'Rev Vendor', 8: 'Revisi' }
    },
    {
        id: 'paraf_ttd', title: '✍️ Paraf & TTD',
        color: 'violet', borderColor: '#7c3aed', bgColor: '#f5f3ff',
        steps: [6, 7, 9],
        stepLabels: { 6: 'Paraf Vendor', 7: 'Paraf Ethos', 9: 'TTD' }
    },
    {
        id: 'aktif', title: '🟢 Kontrak Aktif',
        color: 'emerald', borderColor: '#059669', bgColor: '#ecfdf5',
        steps: [10],
        stepLabels: { 10: 'Aktif Sah' }
    },
    {
        id: 'pasca', title: '📑 Pasca Kontrak',
        color: 'rose', borderColor: '#e11d48', bgColor: '#fff1f2',
        steps: [11, 12],
        stepLabels: { 11: 'Expired', 12: 'Renvoi' }
    }
];

function toggleContractViewMode() {
    contractViewMode = contractViewMode === 'table' ? 'kanban' : 'table';
    syncViewModeVisibility();
    const btn = document.getElementById('btnViewToggle');
    if (btn) {
        btn.innerHTML = contractViewMode === 'table'
            ? '<span>⊞</span><span>Kanban</span>'
            : '<span>☰</span><span>Tabel</span>';
    }
}

function syncViewModeVisibility() {
    const tableCard = document.getElementById('sectionContractsTableCard');
    const kanbanCard = document.getElementById('sectionKanbanBoard');
    const pagination = document.getElementById('contractPagination');
    const expandAllBtn = document.getElementById('btnToggleExpandAll');

    if (contractViewMode === 'kanban') {
        if (tableCard) tableCard.style.display = 'none';
        if (kanbanCard) kanbanCard.style.display = 'block';
        if (pagination) pagination.style.display = 'none';
        if (expandAllBtn) expandAllBtn.style.display = 'none';
    } else {
        if (tableCard) tableCard.style.display = '';
        if (kanbanCard) kanbanCard.style.display = 'none';
        if (pagination) pagination.style.display = '';
        if (expandAllBtn) expandAllBtn.style.display = '';
    }
}

function renderKanbanBoard(list) {
    const container = document.getElementById('kanbanBoardContent');
    if (!container) return;

    // Group contracts by phase
    const phaseGroups = {};
    KANBAN_PHASES.forEach(p => { phaseGroups[p.id] = []; });

    list.forEach(c => {
        const step = c._stageObj ? c._stageObj.step : (c.progressStep || 10);
        for (const phase of KANBAN_PHASES) {
            if (phase.steps.includes(step)) {
                phaseGroups[phase.id].push(c);
                return;
            }
        }
        // Fallback: Aktif
        phaseGroups['aktif'].push(c);
    });

    container.innerHTML = KANBAN_PHASES.map(phase => {
        const items = phaseGroups[phase.id] || [];
        const totalValue = items.reduce((s, c) => s + (c.nilai || 0), 0);

        return `
        <div class="kanban-col flex flex-col bg-slate-50/80 rounded-xl border border-slate-200 min-w-[220px] max-w-[280px] w-full shadow-xs">
            <!-- Column Header -->
            <div class="px-3 py-2.5 rounded-t-xl border-b-2" style="border-color: ${phase.borderColor}; background: ${phase.bgColor};">
                <div class="flex items-center justify-between mb-1">
                    <span class="font-black text-xs text-slate-800 truncate">${phase.title}</span>
                    <span class="inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-black text-white shadow-sm" style="background: ${phase.borderColor};">${items.length}</span>
                </div>
                <div class="text-[10px] text-slate-500 font-mono">${totalValue > 0 ? formatRupiah(totalValue) : '-'}</div>
            </div>

            <!-- Cards Container -->
            <div class="flex-1 overflow-y-auto p-2 space-y-2 kanban-scroll" style="max-height: 520px;">
                ${items.length === 0
                    ? `<div class="text-center text-[11px] text-slate-400 py-6 italic">Tidak ada kontrak</div>`
                    : items.map(c => renderKanbanCard(c, phase)).join('')
                }
            </div>
        </div>`;
    }).join('');
}

function renderKanbanCard(c, phase) {
    const stage = c._stageObj || normalizeContractStageFrontend(c.tahapProgress, c.status, c._cleanSelesai || c.tglSelesai);
    const days = c._daysRemaining;
    const cleanVendor = (c.vendor || '').replace(/\r?\n|\r/g, ' ').trim();
    const shortVendor = cleanVendor.length > 28 ? cleanVendor.substring(0, 26) + '…' : cleanVendor;
    const shortNo = (c.noKontrak || '-').length > 22 ? (c.noKontrak || '-').substring(0, 20) + '…' : (c.noKontrak || '-');

    // Urgency color
    let urgencyBorder = 'border-slate-200';
    let urgencyDot = '';
    if (days !== null && days !== undefined) {
        if (days < 0) {
            urgencyBorder = 'border-rose-300';
            urgencyDot = '<span class="w-2 h-2 rounded-full bg-rose-500 shrink-0 animate-pulse" title="Expired"></span>';
        } else if (days <= 30) {
            urgencyBorder = 'border-amber-300';
            urgencyDot = '<span class="w-2 h-2 rounded-full bg-amber-500 shrink-0 animate-pulse" title="Kritis"></span>';
        } else if (days <= 90) {
            urgencyBorder = 'border-orange-200';
            urgencyDot = '<span class="w-2 h-2 rounded-full bg-orange-400 shrink-0" title="Perhatian"></span>';
        }
    }

    // SLA badge
    let slaBadge = '';
    if (c.isOverdueSla) {
        slaBadge = `<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-100 text-rose-700 border border-rose-200">⚠ Lewat SLA</span>`;
    } else if (c._processDays !== null && c._processDays !== undefined) {
        slaBadge = `<span class="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">${c._processDays}h proses</span>`;
    }

    // Days remaining badge
    let daysBadge = '';
    if (days !== null && days !== undefined) {
        if (days < 0) {
            daysBadge = `<span class="text-[9px] font-bold text-rose-700">Lewat ${Math.abs(days)}h</span>`;
        } else if (days <= 30) {
            daysBadge = `<span class="text-[9px] font-bold text-amber-800">Sisa ${days}h</span>`;
        } else if (days <= 90) {
            daysBadge = `<span class="text-[9px] font-semibold text-orange-700">Sisa ${days}h</span>`;
        } else {
            daysBadge = `<span class="text-[9px] font-semibold text-emerald-700">Sisa ${days}h</span>`;
        }
    }

    // Compliance badge
    const isComply = c.status && c.status.toLowerCase() === 'comply';

    return `
    <div class="bg-white rounded-lg border ${urgencyBorder} p-2.5 shadow-2xs hover:shadow-md hover:border-slate-300 transition-all cursor-pointer group" onclick="openContractDetailModal('${esc(c.noKontrak)}')">
        <!-- Header: Vendor + urgency dot -->
        <div class="flex items-start gap-1.5 mb-1.5">
            ${urgencyDot}
            <div class="min-w-0 flex-1">
                <div class="font-bold text-[11px] text-slate-900 leading-tight truncate group-hover:text-sky-700 transition" title="${esc(cleanVendor)}">
                    ${esc(shortVendor)}
                </div>
                <div class="text-[9.5px] font-mono text-slate-400 truncate mt-0.5" title="${esc(c.noKontrak || '-')}">
                    ${esc(shortNo)}
                </div>
            </div>
            ${isComply
                ? '<span class="text-[8px] px-1 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 shrink-0">✓</span>'
                : '<span class="text-[8px] px-1 py-0.5 rounded bg-rose-50 text-rose-700 font-bold border border-rose-200 shrink-0">✗</span>'
            }
        </div>

        <!-- Stage badge -->
        <div class="flex items-center gap-1.5 mb-1.5 flex-wrap">
            <span class="px-1.5 py-0.5 rounded text-[9px] font-bold" style="background:${stage.badgeBg}; color:${stage.badgeColor}; border: 1px solid ${stage.badgeColor}30;">
                ${esc(stage.label)}
            </span>
            ${slaBadge}
        </div>

        <!-- Info: Divisi + Nilai -->
        <div class="flex items-center justify-between text-[9.5px] text-slate-500 mb-1">
            <span class="truncate" title="${esc(c.picDivisi || '-')}">${esc(c.picDivisi || '-')}</span>
            <span class="font-bold text-slate-700 shrink-0 ml-1">${c.nilai ? formatRupiah(c.nilai) : '-'}</span>
        </div>

        <!-- Footer: Days remaining + link -->
        <div class="flex items-center justify-between pt-1 border-t border-slate-100">
            ${daysBadge || '<span class="text-[9px] text-slate-400">-</span>'}
            ${c.linkDokumen && c.linkDokumen !== '-' && c.linkDokumen.startsWith('http')
                ? `<a href="${esc(c.linkDokumen)}" target="_blank" rel="noopener noreferrer" class="text-[9px] text-sky-600 hover:underline font-semibold" onclick="event.stopPropagation();">🔗 Drive</a>`
                : ''
            }
        </div>
    </div>`;
}

function toggleContractRowExpand(noKontrak) {
    const row = document.getElementById(`expandRow_${noKontrak}`);
    const btn = document.getElementById(`btnExpand_${noKontrak}`);
    if (!row) return;
    const isHidden = row.style.display === 'none';
    row.style.display = isHidden ? 'table-row' : 'none';
    if (btn) {
        const arrow = btn.querySelector('.expand-arrow');
        if (arrow) arrow.textContent = isHidden ? '▲' : '▼';
        btn.classList.toggle('bg-indigo-600', isHidden);
        btn.classList.toggle('text-white', isHidden);
        btn.classList.toggle('bg-indigo-50', !isHidden);
        btn.classList.toggle('text-indigo-700', !isHidden);
    }
}

let allRowsExpanded = false;
function toggleExpandAllContractRows() {
    allRowsExpanded = !allRowsExpanded;
    const expandRows = document.querySelectorAll('[id^="expandRow_"]');
    const expandBtns = document.querySelectorAll('[id^="btnExpand_"]');
    const toggleAllBtn = document.getElementById('btnToggleExpandAll');

    expandRows.forEach(row => {
        row.style.display = allRowsExpanded ? 'table-row' : 'none';
    });

    expandBtns.forEach(btn => {
        const arrow = btn.querySelector('.expand-arrow');
        if (arrow) arrow.textContent = allRowsExpanded ? '▲' : '▼';
        btn.classList.toggle('bg-indigo-600', allRowsExpanded);
        btn.classList.toggle('text-white', allRowsExpanded);
        btn.classList.toggle('bg-indigo-50', !allRowsExpanded);
        btn.classList.toggle('text-indigo-700', !allRowsExpanded);
    });

    if (toggleAllBtn) {
        toggleAllBtn.innerHTML = allRowsExpanded ? '<span>▲ Tutup Semua Detail</span>' : '<span>⚡ Buka Semua Detail</span>';
    }
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
        'pemenuhan_dokumen': 'btnStagePemenuhanDokumen',
        'pengajuan': 'btnStagePengajuan',
        'review_legal_ethos': 'btnStageReviewLegalEthos',
        'draft': 'btnStageDraft',
        'review_legal_vendor': 'btnStageReviewLegalVendor',
        'paraf_vendor': 'btnStageParafVendor',
        'paraf_ethos': 'btnStageParafEthos',
        'revisi': 'btnStageRevisi',
        'ttd': 'btnStageTtd',
        'aktif': 'btnStageAktif',
        'expired': 'btnStageExpired',
        'renvoi': 'btnStageRenvoi'
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

    const cleanVendor = (c.vendor || '').replace(/\r?\n|\r/g, ' ').trim();
    if (titleEl) titleEl.textContent = `Kontrak #${c.noKontrak}`;
    if (subEl) subEl.textContent = cleanVendor;

    const stage = c._stageObj || normalizeContractStageFrontend(c.tahapProgress, c.status, c._cleanSelesai || c.tglSelesai);
    const days = c._daysRemaining !== undefined ? c._daysRemaining : getContractDaysRemaining(c._cleanSelesai || c.tglSelesai);
    const isComply = c.status && c.status.toLowerCase() === 'comply';

    // Periode Masa Berlaku yang bersih
    let displayMasa = '-';
    if (c._cleanMulai && c._cleanMulai !== '-' && c._cleanSelesai && c._cleanSelesai !== '-') {
        displayMasa = `${c._cleanMulai} – ${c._cleanSelesai}`;
    } else if (c._cleanSelesai && c._cleanSelesai !== '-') {
        displayMasa = `s/d ${c._cleanSelesai}`;
    } else if (c._cleanMulai && c._cleanMulai !== '-') {
        displayMasa = `Mulai ${c._cleanMulai}`;
    }

    let daysBadge = '<span class="text-slate-400 font-normal">-</span>';
    if (days !== null) {
        if (days < 0) {
            daysBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">Expired (${Math.abs(days)}h lalu)</span>`;
        } else if (days <= 30) {
            daysBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">Kritis (Sisa ${days}h)</span>`;
        } else if (days <= 90) {
            daysBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-50 text-orange-700 border border-orange-200">Perhatian (Sisa ${days}h)</span>`;
        } else {
            daysBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">Aman (Sisa ${days}h)</span>`;
        }
    }

    const workflowSteps = [
        { num: 1, key: 'pemenuhan_dokumen', title: '1. Dokumen' },
        { num: 2, key: 'pengajuan', title: '2. Pengajuan' },
        { num: 3, key: 'review_legal_ethos', title: '3. Rev Ethos' },
        { num: 4, key: 'draft', title: '4. Draft' },
        { num: 5, key: 'review_legal_vendor', title: '5. Rev Vendor' },
        { num: 6, key: 'paraf_vendor', title: '6. Paraf Vendor' },
        { num: 7, key: 'paraf_ethos', title: '7. Paraf Ethos' },
        { num: 8, key: 'revisi', title: '8. Revisi' },
        { num: 9, key: 'ttd', title: '9. TTD' },
        { num: 10, key: 'aktif', title: '10. Aktif Sah' },
        { num: 11, key: 'expired', title: '11. Expired' },
        { num: 12, key: 'renvoi', title: '12. Renvoi' }
    ];

    const currentStepNum = stage.step;
    const hasRevision = stage.isRevision || (c.statusRevisi && c.statusRevisi.trim() !== '' && c.statusRevisi !== '-');
    const hasRenvoi = stage.isRenvoi;

    // 1. Sleek Compact Stepper
    let stepperHtml = `
    <div class="bg-slate-50 border border-slate-200 rounded-xl p-3 shadow-2xs">
        <div class="flex items-center justify-between mb-2 flex-wrap gap-1.5">
            <div class="flex items-center gap-2">
                <span class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Tahap Kontrak:</span>
                <span class="px-2 py-0.5 rounded-full text-[10.5px] font-black" style="background:${stage.badgeBg}; color:${stage.badgeColor}; border:1px solid ${stage.badgeColor}40;">
                    ${esc(stage.label)}
                </span>
            </div>
            <span class="text-[10.5px] font-bold text-slate-700 bg-white border border-slate-200 px-2 py-0.5 rounded shadow-2xs">${stage.percent}% Selesai</span>
        </div>

        <div class="w-full bg-slate-200 rounded-full h-1.5 mb-2.5 overflow-hidden">
            <div class="h-1.5 rounded-full transition-all duration-500" style="width:${stage.percent}%; background:${stage.badgeColor};"></div>
        </div>

        <div class="w-full overflow-x-auto pb-3 pt-2 px-2 custom-scrollbar bg-white rounded-lg border border-slate-100 mt-2">
            <div class="flex items-start justify-between min-w-[920px] relative px-2">
                ${renderInlineWorkflowSteps(c, stage)}
            </div>
        </div>
    </div>
    `;

    // 2. Compact 2-Column Info Grid
    let infoHtml = `
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
        <div class="bg-white border border-slate-200 rounded-xl p-3 space-y-2 shadow-2xs">
            <h4 class="font-bold text-slate-800 text-[10.5px] uppercase tracking-wider flex items-center gap-1 border-b border-slate-100 pb-1.5">
                <span>⚖️</span> Data Kontrak &amp; Legal
            </h4>
            
            <div class="flex justify-between items-center text-[11px]">
                <span class="text-slate-500">Nomor Kontrak:</span>
                <strong class="text-slate-900 font-mono font-bold">#${esc(c.noKontrak)}</strong>
            </div>

            <div class="flex justify-between items-center text-[11px]">
                <span class="text-slate-500">Divisi PIC:</span>
                <strong class="text-slate-800">${c._cleanDiv && c._cleanDiv !== '-' ? esc(c._cleanDiv) : '-'}</strong>
            </div>

            <div class="flex justify-between items-center text-[11px]">
                <span class="text-slate-500">Ruang Lingkup:</span>
                <strong class="text-slate-800 truncate max-w-[150px]" title="${esc(c._cleanLingkup || '-')}">${c._cleanLingkup && c._cleanLingkup !== '-' ? esc(c._cleanLingkup) : '-'}</strong>
            </div>

            <div class="flex justify-between items-center text-[11px]">
                <span class="text-slate-500">Kepatuhan Regulasi:</span>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${isComply ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}">
                    ${isComply ? '✓ Comply' : '✗ Not Comply'}
                </span>
            </div>
        </div>

        <div class="bg-white border border-slate-200 rounded-xl p-3 space-y-2 shadow-2xs">
            <h4 class="font-bold text-slate-800 text-[10.5px] uppercase tracking-wider flex items-center gap-1 border-b border-slate-100 pb-1.5">
                <span>💼</span> Komersial &amp; Masa Berlaku
            </h4>

            <div class="flex justify-between items-center text-[11px]">
                <span class="text-slate-500">Nilai Kontrak:</span>
                <strong class="text-slate-900 font-bold font-mono">${c.nilai ? formatRupiah(c.nilai) : '-'}</strong>
            </div>

            <div class="flex justify-between items-center text-[11px]">
                <span class="text-slate-500">Periode:</span>
                <strong class="text-slate-800">${displayMasa}</strong>
            </div>

            <div class="flex justify-between items-center text-[11px]">
                <span class="text-slate-500">Sisa Waktu:</span>
                ${daysBadge}
            </div>

            <div class="flex justify-between items-center text-[11px]">
                <span class="text-slate-500">Dokumen:</span>
                <div class="flex items-center gap-1.5">
                    <span class="text-slate-700">${esc(c.kelengkapan || 'Lengkap')}</span>
                    ${c.linkDokumen && c.linkDokumen.trim() !== '' && c.linkDokumen !== '-' ? `
                        <a href="${esc(c.linkDokumen)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sky-600 hover:bg-sky-700 text-white font-bold text-[10px] transition cursor-pointer shadow-2xs" title="Buka File Google Drive">
                            <span>🔗 Drive</span>
                        </a>
                    ` : ''}
                </div>
            </div>
        </div>
    </div>
    `;

    let revisionDetailHtml = '';
    if (hasRevision) {
        revisionDetailHtml = `
        <div class="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-xs text-amber-900">
            <div class="flex items-center gap-1.5 font-bold mb-0.5 text-[11px]">
                <span>🔄</span>
                <span>Catatan Revisi / Renvoi:</span>
            </div>
            <p class="text-amber-800 text-[11px] leading-relaxed">
                ${esc(c.statusRevisi || 'Terdapat penyesuaian klausul kontrak yang sedang diproses oleh tim Legal.')}
            </p>
        </div>
        `;
    }

    let remarksHtml = '';
    if (c.keterangan && c.keterangan.trim() !== '' && c.keterangan !== '-') {
        remarksHtml = `
        <div class="bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-700">
            <strong class="text-slate-800 block text-[10.5px] mb-0.5">📝 Catatan:</strong>
            <p class="text-slate-600 text-[11px] leading-relaxed">${esc(c.keterangan)}</p>
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
        'Tahap Progress Pengerjaan',
        'Tanggal Dokumen',
        'Tanggal Pengajuan ke Legal',
        'Tanggal Review Legal Ethos',
        'Tanggal Draft Keluar',
        'Tanggal Review Legal Vendor',
        'Tanggal Paraf Vendor',
        'Tanggal Paraf Ethos',
        'Tanggal Revisi',
        'Target Selesai SLA',
        'Tanggal Realisasi TTD',
        'Tanggal Mulai Kontrak',
        'Tanggal Selesai Kontrak',
        'Tanggal Renvoi',
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
            showToast('24 Header Lengkap (termasuk 12 Tanggal Alur) berhasil disalin ke Clipboard! Tinggal paste di Baris 1 Sheet.', 'success');
        }).catch(() => {
            fallbackCopyText(textToCopy, '24 Header Lengkap berhasil disalin ke Clipboard!');
        });
    } else {
        fallbackCopyText(textToCopy, '24 Header Lengkap berhasil disalin ke Clipboard!');
    }
}

function copyAuditDateHeadersToClipboard() {
    const headers = [
        'Tanggal Dokumen',
        'Tanggal Pengajuan ke Legal',
        'Tanggal Review Legal Ethos',
        'Tanggal Draft Keluar',
        'Tanggal Review Legal Vendor',
        'Tanggal Paraf Vendor',
        'Tanggal Paraf Ethos',
        'Tanggal Revisi',
        'Target Selesai SLA',
        'Tanggal Realisasi TTD',
        'Tanggal Mulai Kontrak',
        'Tanggal Selesai Kontrak',
        'Tanggal Renvoi'
    ];
    const textToCopy = headers.join('\t');
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(textToCopy).then(() => {
            showToast('13 Kolom Tanggal Audit & SLA disalin! Tempel langsung di baris 1 di sebelah kolom terakhir spreadsheet Anda.', 'success');
        }).catch(() => {
            fallbackCopyText(textToCopy, '13 Kolom Tanggal Audit & SLA berhasil disalin!');
        });
    } else {
        fallbackCopyText(textToCopy, '13 Kolom Tanggal Audit & SLA berhasil disalin!');
    }
}

function fallbackCopyText(text, successMsg) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
        document.execCommand('copy');
        showToast(successMsg || 'Header kolom berhasil disalin ke Clipboard!', 'success');
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
    let csv = 'No Kontrak,Vendor,Ruang Lingkup,Divisi/PIC,Tahap Progress,Tgl Dokumen,Tgl Pengajuan Legal,Tgl Review Ethos,Tgl Draft Keluar,Tgl Review Vendor,Tgl Paraf Vendor,Tgl Paraf Ethos,Tgl Revisi,Target SLA,Tgl Realisasi TTD,Tgl Mulai Kontrak,Tgl Selesai Kontrak,Tgl Renvoi,Status Revisi/Renvoi,Sisa Hari Masa Berlaku,Durasi Pengerjaan (Hari),Status SLA,Kelengkapan Dokumen,Nilai Kontrak,Status Kepatuhan,Link Dokumen,Keterangan\n';
    list.forEach(c => {
        const stage = c._stageObj || normalizeContractStageFrontend(c.tahapProgress, c.status, c.tglSelesai);
        const daysRemaining = c._daysRemaining !== undefined ? c._daysRemaining : getContractDaysRemaining(c.tglSelesai);
        const processDays = c._processDays !== undefined ? c._processDays : getContractProcessDays(c.tglPengajuan, c.tglRealisasi);
        const slaStatus = c.slaStatus || '-';
        const stageDates = getContractStageDatesMap(c);
        csv += `"${escCsv(c.noKontrak)}","${escCsv(c.vendor)}","${escCsv(c.jenisPekerjaan || '-')}","${escCsv(c.picDivisi || '-')}","${escCsv(stage.label)}","${escCsv(stageDates[1])}","${escCsv(stageDates[2])}","${escCsv(stageDates[3])}","${escCsv(stageDates[4])}","${escCsv(stageDates[5])}","${escCsv(stageDates[6])}","${escCsv(stageDates[7])}","${escCsv(stageDates[8])}","${escCsv(c.targetSelesai || '-')}","${escCsv(stageDates[9])}","${escCsv(stageDates[10])}","${escCsv(stageDates[11])}","${escCsv(stageDates[12])}","${escCsv(c.statusRevisi || '-')}","${daysRemaining !== null ? daysRemaining : '-'}","${processDays !== null ? processDays : '-'}","${escCsv(slaStatus)}","${escCsv(c.kelengkapan || '-')}","${c.nilai || 0}","${escCsv(c.status || 'Comply')}","${escCsv(c.linkDokumen || '-')}","${escCsv(c.keterangan || '-')}"\n`;
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
