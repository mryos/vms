// =====================================================
// KONFIGURASI
// Ganti URL di bawah dengan URL Web App Google Apps Script Anda
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbySjL6G3zAUKQhWUK8qhBYQdGjx9MUPtYoeXJkZm1DrIAwPN_S-i9ygymgU3exNDe37Sw/exec';

// =====================================================
// =====================================================
// STATE & INIT
// =====================================================
let dashboardData = null;
let activeTab = 'all';
let slicerState = {
    category: 'all',
    compliance: 'all', // 'all' | 'comply' | 'not-comply'
    tier: 'all' // 'all' | 'high' | 'good' | 'poor'
};

document.addEventListener('DOMContentLoaded', () => {
    initHeader();
    initTabs();
    loadDashboardData();
});

function initHeader() {
    const savedPin = localStorage.getItem('ethos_pin');
    const savedName = localStorage.getItem('ethos_nama');
    const userEl = document.getElementById('headerUser');

    if (savedPin && savedName && userEl) {
        userEl.textContent = `👤 ${savedName} (PIN: ${savedPin})`;
    }
}

function initTabs() {
    const tabs = document.querySelectorAll('.db-tab-btn');
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
    const perfSec = document.getElementById('sectionPerformance');
    const ordersCol = document.getElementById('sectionOrders');

    if (tab === 'all') {
        if (chartsSec) chartsSec.style.display = 'grid';
        if (contractsSec) contractsSec.style.display = 'block';
        if (perfSec) perfSec.style.display = 'grid';
        if (ordersCol) ordersCol.style.display = 'flex';
    } else if (tab === 'clm') {
        if (chartsSec) chartsSec.style.display = 'grid';
        if (contractsSec) contractsSec.style.display = 'block';
        if (perfSec) perfSec.style.display = 'none';
        if (ordersCol) ordersCol.style.display = 'none';
    } else if (tab === 'performance') {
        if (chartsSec) chartsSec.style.display = 'grid';
        if (contractsSec) contractsSec.style.display = 'none';
        if (perfSec) perfSec.style.display = 'grid';
        if (ordersCol) ordersCol.style.display = 'none';
    } else if (tab === 'orders') {
        if (chartsSec) chartsSec.style.display = 'none';
        if (contractsSec) contractsSec.style.display = 'none';
        if (perfSec) perfSec.style.display = 'grid';
        if (ordersCol) ordersCol.style.display = 'flex';
    }
}

function initSlicers(kategoriList) {
    // 1. Inisialisasi Category Slicer Chips secara dinamis dari database
    const catContainer = document.getElementById('slicerCategoryChips');
    if (catContainer && kategoriList && kategoriList.length > 0) {
        catContainer.innerHTML = `<button class="slicer-btn ${slicerState.category === 'all' ? 'active' : ''}" data-slicer="category" data-val="all">Semua Bidang</button>` +
            kategoriList.map(k => `
                <button class="slicer-btn ${slicerState.category === k.kode ? 'active' : ''}" data-slicer="category" data-val="${esc(k.kode)}">
                    ${k.ikon || '📦'} ${esc(k.nama)}
                </button>
            `).join('');
    }

    // 2. Pasang event listener untuk semua tombol slicer
    document.querySelectorAll('.slicer-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const slicerType = btn.dataset.slicer;
            const slicerVal = btn.dataset.val;

            // Hapus class active pada group yang sama
            const parentRow = btn.closest('.slicer-chips');
            if (parentRow) {
                parentRow.querySelectorAll('.slicer-btn').forEach(b => b.classList.remove('active', 'active-green', 'active-amber', 'active-red'));
            }

            // Tambah active class
            if (slicerVal === 'comply' || slicerVal === 'high') btn.classList.add('active-green');
            else if (slicerVal === 'good') btn.classList.add('active-amber');
            else if (slicerVal === 'not-comply' || slicerVal === 'poor') btn.classList.add('active-red');
            else btn.classList.add('active');

            // Simpan state dan re-render
            slicerState[slicerType] = slicerVal;
            filterAndRenderDashboard();
        });
    });
}

function resetAllSlicers() {
    slicerState = {
        category: 'all',
        compliance: 'all',
        tier: 'all'
    };

    // Reset tombol UI
    document.querySelectorAll('.slicer-chips').forEach(group => {
        group.querySelectorAll('.slicer-btn').forEach(b => {
            b.classList.remove('active', 'active-green', 'active-amber', 'active-red');
            if (b.dataset.val === 'all') b.classList.add('active');
        });
    });

    filterAndRenderDashboard();
    showToast('Semua filter slicer telah direset ke kondisi awal.', 'info');
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
            initSlicers(dashboardData.kategori);
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

    const rawVendors = dashboardData.vendors || [];
    const rawScore = dashboardData.scoreSummary || {};
    const rawCC = dashboardData.contractCompliance || { list: [] };
    const rawPO = dashboardData.poStats || { vendorMap: {} };
    const categories = dashboardData.kategori || [];

    // Filter Vendors berdasarkan Slicers
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

    // Filter Contract Compliance List & Stats
    const filteredContractsList = rawCC.list ? rawCC.list.filter(c => activeVendorNames.has(c.vendor)) : [];
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
        overallOnTimePct: totalPoOrders > 0 ? Math.round((totalPoOnTime / totalPoOrders) * 100) : 0,
        vendorMap: filteredVendorMap
    };

    // Update Slicer Indicator Text
    const indicatorEl = document.getElementById('slicerActiveInfo');
    if (indicatorEl) {
        const isFiltered = slicerState.category !== 'all' || slicerState.compliance !== 'all' || slicerState.tier !== 'all';
        if (isFiltered) {
            indicatorEl.innerHTML = `<b style="color:var(--primary);">${filteredVendors.length}</b> dari ${rawVendors.length} vendor terpilih`;
        } else {
            indicatorEl.textContent = `Menampilkan seluruh ${rawVendors.length} vendor`;
        }
    }

    // Render All Components with Sliced Data
    renderDashboard(filteredVendors, filteredScore, filteredCC, filteredPO, categories);
}

// =====================================================
// RENDERING FUNCTIONS
// =====================================================
function renderDashboard(vendors, scoreSummary, cc, poStats, kategori) {
    // 1. Render Gatekeeper 5-Card Key Metrics
    renderSummaryCards(vendors, scoreSummary, cc, poStats);

    // 2. Check for Expiring Contracts Banner (Gatekeeper CLM feature)
    checkExpiringContracts(cc);

    // 3. Render Enterprise Charts (Chart.js)
    renderComplianceChart(cc);
    renderSpendChart(cc, kategori, poStats);
    renderRadarChart(vendors, scoreSummary, kategori);

    // 4. Render Tables
    renderContractTable(cc);
    renderTopVendors(scoreSummary, vendors, kategori);
    renderAttentionVendors(scoreSummary, vendors, kategori);
    renderPoPerformance(poStats);
}

function renderSummaryCards(vendors, scoreSummary, cc, poStats) {
    const totalVendors = vendors ? vendors.length : 0;
    
    // 1. Total Contract Value
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
    if (valEl) valEl.textContent = formatRupiah(totalContractVal);
    if (valCountEl) valCountEl.textContent = `${totalContractsCount} kontrak terdaftar`;

    // 2. KPI 4: Contract Compliance
    const ccRate = cc.vendorComplianceRate != null ? cc.vendorComplianceRate : 100;
    const ccEl = document.getElementById('statContractCompliance');
    const ccRatioEl = document.getElementById('statContractRatio');
    const ccProg = document.getElementById('progressCompliance');
    if (ccEl) ccEl.textContent = `${ccRate}%`;
    if (ccRatioEl) ccRatioEl.textContent = `${cc.uniqueCompliantVendors || 0} / ${cc.uniqueContractedVendors || 0} vendor comply`;
    if (ccProg) ccProg.style.width = `${ccRate}%`;

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
    if (scoreEl) scoreEl.textContent = `${avgScore} / 5.0`;
    if (scoreCountEl) scoreCountEl.textContent = `${countScore} vendor dinilai`;
    if (scoreProg) scoreProg.style.width = `${scorePct}%`;

    // 4. KPI 2: Evaluation Completion
    const evalCompletionPct = totalVendors > 0 ? Math.round((countScore / totalVendors) * 100) : 0;
    const evalEl = document.getElementById('statEvalCompletion');
    const evalRatioEl = document.getElementById('statEvalRatio');
    const evalProg = document.getElementById('progressCompletion');
    if (evalEl) evalEl.textContent = `${evalCompletionPct}%`;
    if (evalRatioEl) evalRatioEl.textContent = `${countScore} / ${totalVendors} vendor selesai`;
    if (evalProg) evalProg.style.width = `${evalCompletionPct}%`;

    // 5. On-Time PO Delivery Rate
    const onTimePct = (poStats && poStats.overallOnTimePct != null) ? poStats.overallOnTimePct : 0;
    const totalOrders = poStats ? poStats.totalOrders : 0;
    const onTimeEl = document.getElementById('statOnTimePct');
    const onTimeMetaEl = document.getElementById('statTotalPoMeta');
    const onTimeProg = document.getElementById('progressOnTime');
    if (onTimeEl) onTimeEl.textContent = `${onTimePct}%`;
    if (onTimeMetaEl) onTimeMetaEl.textContent = `${totalOrders} total pesanan PO`;
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
        tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text3); padding:2rem;">Belum ada vendor yang dinilai.</td></tr>`;
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

    tableBody.innerHTML = sorted.map((v, i) => `
        <tr>
            <td style="font-weight:700; color:var(--secondary);">${i + 1}</td>
            <td style="font-weight:600; color:var(--text);">${esc(v.name)}</td>
            <td style="font-size:0.85rem; color:var(--text2);">${esc(v.categoryIcon)} ${esc(v.categoryName)}</td>
            <td style="text-align:right; font-weight:700; color:var(--accent); font-size:1.05rem;">${v.avgScore.toFixed(2)}</td>
            <td style="text-align:center;">
                <span class="predikat-badge" style="background:${getPredikatColor(v.avgScore)}15; color:${getPredikatColor(v.avgScore)}; border:1px solid ${getPredikatColor(v.avgScore)}30;">
                    ${esc(v.predikat)}
                </span>
            </td>
        </tr>
    `).join('');
}

function renderAttentionVendors(scoreSummary, vendors, categories) {
    const tableBody = document.getElementById('attentionVendorsTable');
    if (!tableBody) return;

    const poorVendors = [];
    if (scoreSummary) {
        for (let name in scoreSummary) {
            const score = scoreSummary[name].avgScore;
            if (score < 2.5) {
                const vInfo = (vendors && vendors.find(v => v.nama === name)) || {};
                const catCode = vInfo.kategori || 'general';
                const catInfo = (categories && categories.find(c => c.kode === catCode)) || { nama: 'General', ikon: '📦' };
                
                poorVendors.push({
                    name: name,
                    categoryName: catInfo.nama,
                    categoryIcon: catInfo.ikon,
                    avgScore: score,
                    predikat: scoreSummary[name].predikat
                });
            }
        }
    }

    poorVendors.sort((a, b) => a.avgScore - b.avgScore);

    if (poorVendors.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#10b981; font-weight:600; padding:2rem;">🎉 Semua vendor dalam kondisi BAIK (Skor &ge; 2.5)</td></tr>`;
        return;
    }

    tableBody.innerHTML = poorVendors.map(v => `
        <tr>
            <td style="font-weight:600; color:var(--text);">${esc(v.name)}</td>
            <td style="font-size:0.85rem; color:var(--text2);">${esc(v.categoryIcon)} ${esc(v.categoryName)}</td>
            <td style="text-align:right; font-weight:700; color:#ef4444; font-size:1.05rem;">${v.avgScore.toFixed(2)}</td>
            <td style="text-align:center;">
                <span class="predikat-badge" style="background:#ef444415; color:#ef4444; border:1px solid #ef444430;">
                    ${esc(v.predikat)}
                </span>
            </td>
        </tr>
    `).join('');
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

    if (!cc || !cc.list || cc.list.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--text3); padding:2rem;">Belum ada data kontrak vendor terdaftar di sheet 'Kontrak Vendor'.</td></tr>`;
        return;
    }

    tableBody.innerHTML = cc.list.map(c => {
        const isComply = c.status && c.status.toLowerCase() === 'comply';
        const statusColor = isComply ? '#10b981' : '#ef4444';
        
        const isDocComplete = c.kelengkapan && c.kelengkapan.toLowerCase().includes('lengkap');
        const docColor = isDocComplete ? '#0284c7' : '#f59e0b';

        return `
        <tr>
            <td style="font-weight:700; color:var(--primary); font-size:0.85rem; white-space:nowrap;">${esc(c.noKontrak)}</td>
            <td style="font-weight:600; color:var(--text); white-space:nowrap;">${esc(c.vendor)}</td>
            <td style="font-size:0.85rem; color:var(--text2); max-width:200px;">${esc(c.jenisPekerjaan)}</td>
            <td style="font-size:0.8rem; color:var(--text3); white-space:nowrap;">
                <span>📅 ${esc(c.tglMulai)} &ndash; ${esc(c.tglSelesai)}</span>
            </td>
            <td>
                <span class="predikat-badge" style="background:${docColor}15; color:${docColor}; border:1px solid ${docColor}30; font-size:0.72rem; font-weight:600;">
                    ${esc(c.kelengkapan)}
                </span>
            </td>
            <td style="text-align:right; font-weight:700; color:var(--text); font-size:0.85rem; white-space:nowrap;">${c.nilai ? formatRupiah(c.nilai) : '-'}</td>
            <td style="text-align:center;">
                <span class="predikat-badge" style="background:${statusColor}15; color:${statusColor}; border:1px solid ${statusColor}30; font-size:0.75rem; font-weight:700;">
                    ${isComply ? '✓ Comply' : '✗ Not Comply'}
                </span>
            </td>
            <td style="font-size:0.8rem; color:var(--text3); max-width:220px;">${esc(c.keterangan)}</td>
        </tr>`;
    }).join('');
}

// =====================================================
// UTILS
// =====================================================
function esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
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
let spendChartInstance = null;

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

function renderSpendChart(cc, kategori, poStats) {
    const canvas = document.getElementById('spendChart');
    if (!canvas) return;

    // Hitung spend per kategori (dari kontrak dan PO)
    const catSpend = {};
    if (cc && cc.list) {
        cc.list.forEach(c => {
            const vendorName = c.vendor || '';
            let catName = 'Lainnya';
            if (c.noKontrak && c.noKontrak.includes('IT')) catName = 'IT & Hardware';
            else if (c.noKontrak && c.noKontrak.includes('LOG')) catName = 'Ekspedisi / Logistik';
            else if (c.noKontrak && c.noKontrak.includes('PRN')) catName = 'Percetakan';
            else if (c.noKontrak && c.noKontrak.includes('BRD')) catName = 'Branding & Desain';
            else if (c.noKontrak && c.noKontrak.includes('DEV')) catName = 'Software & Dev';

            catSpend[catName] = (catSpend[catName] || 0) + (Number(c.nilai) || 0);
        });
    }

    const labels = Object.keys(catSpend);
    const data = Object.values(catSpend);

    if (labels.length === 0) {
        labels.push('Belum ada data kontrak');
        data.push(0);
    }

    if (spendChartInstance) spendChartInstance.destroy();

    spendChartInstance = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Nilai Kontrak (Rp)',
                data: data,
                backgroundColor: [
                    'rgba(2, 132, 199, 0.8)',
                    'rgba(16, 185, 129, 0.8)',
                    'rgba(245, 158, 11, 0.8)',
                    'rgba(139, 92, 246, 0.8)',
                    'rgba(79, 70, 229, 0.8)'
                ],
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return 'Rp ' + (value / 1000000) + ' Jt';
                        },
                        font: { size: 11 }
                    },
                    grid: { color: '#f1f5f9' }
                },
                x: {
                    ticks: { font: { size: 11, weight: '600' } },
                    grid: { display: false }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1e293b',
                    titleFont: { size: 13, weight: '700' },
                    padding: 10,
                    cornerRadius: 8,
                    callbacks: {
                        label: function(ctx) {
                            return formatRupiah(ctx.raw);
                        }
                    }
                }
            }
        }
    });
}

