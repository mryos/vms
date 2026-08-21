// =====================================================
// KONFIGURASI
// Ganti URL di bawah dengan URL Web App Google Apps Script Anda
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbye_zCYekrKoZvcIdoEMWtAI7nj0FQnrb0qT5QGPxcXDIXwybXd7DFU7MoGjGt1CcW45Q/exec';

// =====================================================
// STATE & INIT
// =====================================================
let dashboardData = null;

document.addEventListener('DOMContentLoaded', () => {
    initHeader();
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
            renderDashboard();
        } else {
            showToast(data.message || 'Gagal memuat data dari server.', 'error');
        }
    } catch (err) {
        console.error('Error fetching dashboard data:', err);
        showToast('Gagal terhubung ke Google Spreadsheet API.', 'error');
    }
}

// =====================================================
// RENDERING FUNCTIONS
// =====================================================
function renderDashboard() {
    if (!dashboardData) return;

    const { vendors, poStats, prList, scoreSummary, kategori } = dashboardData;

    // 1. Render Summary Cards (KPI 1 - KPI 4)
    const totalVendors = vendors ? vendors.length : 0;
    
    // Hitung KPI 1: Vendor Performance Score & evaluasi count
    let sumScore = 0;
    let countScore = 0;
    if (scoreSummary) {
        for (let key in scoreSummary) {
            sumScore += scoreSummary[key].avgScore || 0;
            countScore++;
        }
    }
    const avgScore = countScore > 0 ? (sumScore / countScore).toFixed(1) : '0.0';

    // Hitung KPI 2: Vendor Evaluation Completion
    const evalCompletionPct = totalVendors > 0 ? Math.round((countScore / totalVendors) * 100) : 0;

    // Ambil KPI 4: Contract Compliance
    const cc = dashboardData.contractCompliance || { uniqueContractedVendors: 0, uniqueCompliantVendors: 0, vendorComplianceRate: 100 };

    // Update UI elements
    document.getElementById('statAvgScore').textContent = `${avgScore} / 5.0`;
    document.getElementById('statEvalCount').textContent = `${countScore} vendor dinilai`;
    
    document.getElementById('statEvalCompletion').textContent = `${evalCompletionPct}%`;
    document.getElementById('statEvalRatio').textContent = `${countScore} / ${totalVendors} vendor selesai`;

    document.getElementById('statContractCompliance').textContent = `${cc.vendorComplianceRate}%`;
    document.getElementById('statContractRatio').textContent = `${cc.uniqueCompliantVendors} / ${cc.uniqueContractedVendors} vendor comply`;

    // 2. Render Charts (Chart.js)
    renderRadarChart(vendors, scoreSummary, kategori);
    renderComplianceChart(cc);

    // 3. Render Top 5 Vendors
    renderTopVendors(scoreSummary, vendors, kategori);

    // 4. Render Attention Vendors
    renderAttentionVendors(scoreSummary, vendors, kategori);

    // 5. Render PO Performance
    renderPoPerformance(poStats);

    // 6. Render PR Table
    renderPrTable(prList);

    // 7. Render Contract Compliance Table (KPI 4)
    renderContractTable(cc);
}

function renderTopVendors(scoreSummary, vendors, categories) {
    const tableBody = document.getElementById('topVendorsTable');
    if (!tableBody) return;

    if (!scoreSummary || Object.keys(scoreSummary).length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text3); padding:2rem;">Belum ada vendor yang dinilai.</td></tr>`;
        return;
    }

    // Ubah ke array, hubungkan dengan kategori asli vendor, lalu urutkan
    const sorted = Object.keys(scoreSummary).map(name => {
        const vInfo = vendors.find(v => v.nama === name) || {};
        const catCode = vInfo.kategori || 'general';
        const catInfo = categories.find(c => c.kode === catCode) || { nama: 'General', ikon: '📦' };

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
                const vInfo = vendors.find(v => v.nama === name) || {};
                const catCode = vInfo.kategori || 'general';
                const catInfo = categories.find(c => c.kode === catCode) || { nama: 'General', ikon: '📦' };
                
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

    // Urutkan vendor berdasarkan total PO terbanyak agar yang paling aktif tampil di atas
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

function renderPrTable(prList) {
    const tableBody = document.getElementById('prTableBody');
    if (!tableBody) return;

    if (!prList || prList.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text3); padding:2rem;">Belum ada Purchase Request terdaftar.</td></tr>`;
        return;
    }

    // Sort PR terbaru dan limit ke 5
    const latestPr = [...prList].reverse().slice(0, 5);

    tableBody.innerHTML = latestPr.map(pr => {
        let badgeColor = '#94a3b8';
        if (pr.status.toLowerCase().includes('po')) badgeColor = 'var(--secondary)';
        else if (pr.status.toLowerCase().includes('approved')) badgeColor = 'var(--accent)';
        else if (pr.status.toLowerCase().includes('pending')) badgeColor = '#f59e0b';
        else if (pr.status.toLowerCase().includes('reject')) badgeColor = '#ef4444';

        return `
        <tr>
            <td style="font-weight:600; color:var(--text);">${esc(pr.noPr)}</td>
            <td style="font-size:0.85rem; color:var(--text2);">${esc(pr.tanggal)}</td>
            <td style="font-size:0.85rem; font-weight:500; color:var(--text); max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${esc(pr.deskripsi)}">${esc(pr.deskripsi)}</td>
            <td style="text-align:right; font-weight:600; color:var(--primary); font-size:0.9rem;">${formatRupiah(pr.nilai)}</td>
            <td style="text-align:center;">
                <span class="predikat-badge" style="background:${badgeColor}15; color:${badgeColor}; border:1px solid ${badgeColor}30; font-size:0.75rem;">
                    ${esc(pr.status)}
                </span>
            </td>
        </tr>
    `;
    }).join('');
}

function renderContractTable(cc) {
    const tableBody = document.getElementById('contractTableBody');
    if (!tableBody) return;

    if (!cc || !cc.list || cc.list.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="9" style="text-align:center; color:var(--text3); padding:2rem;">Belum ada data kontrak vendor terdaftar di sheet 'Kontrak Vendor'.</td></tr>`;
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
            <td style="font-weight:600; color:var(--text);">${esc(c.vendor)}</td>
            <td style="font-size:0.85rem; color:var(--text2); max-width:220px;">${esc(c.jenisPekerjaan)}</td>
            <td style="font-size:0.8rem; color:var(--text3); white-space:nowrap;">${esc(c.tglMulai)}</td>
            <td style="font-size:0.8rem; color:var(--text3); white-space:nowrap;">${esc(c.tglSelesai)}</td>
            <td>
                <span class="predikat-badge" style="background:${docColor}15; color:${docColor}; border:1px solid ${docColor}30; font-size:0.75rem; font-weight:600;">
                    ${esc(c.kelengkapan)}
                </span>
            </td>
            <td style="text-align:right; font-weight:600; color:var(--text); font-size:0.85rem; white-space:nowrap;">${c.nilai ? formatRupiah(c.nilai) : '-'}</td>
            <td style="text-align:center;">
                <span class="predikat-badge" style="background:${statusColor}15; color:${statusColor}; border:1px solid ${statusColor}30; font-size:0.75rem; font-weight:700;">
                    ${isComply ? '✓ Comply' : '✗ Not Comply'}
                </span>
            </td>
            <td style="font-size:0.8rem; color:var(--text3); max-width:240px;">${esc(c.keterangan)}</td>
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
// CHART.JS RENDERING
// =====================================================
let radarChartInstance = null;
let complianceChartInstance = null;

function renderRadarChart(vendors, scoreSummary, kategori) {
    const canvas = document.getElementById('radarChart');
    if (!canvas) return;

    // Hitung rata-rata skor per kategori
    const catScores = {};
    if (vendors && scoreSummary) {
        vendors.forEach(v => {
            const name = v.nama;
            const catCode = v.kategori || 'GENERAL';
            const evalData = scoreSummary[name];
            if (evalData) {
                if (!catScores[catCode]) {
                    const catInfo = kategori.find(c => c.kode === catCode) || { nama: catCode, ikon: '📦' };
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

    // Fallback jika belum ada data
    if (labels.length === 0) {
        labels.push('Belum ada data');
        data.push(0);
    }

    // Destroy previous instance if exists
    if (radarChartInstance) radarChartInstance.destroy();

    radarChartInstance = new Chart(canvas, {
        type: 'radar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Skor Rata-rata',
                data: data,
                backgroundColor: 'rgba(2, 132, 199, 0.15)',
                borderColor: '#0284c7',
                borderWidth: 2,
                pointBackgroundColor: '#0284c7',
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
                    grid: {
                        color: '#e2e8f0'
                    },
                    angleLines: {
                        color: '#e2e8f0'
                    }
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
                        label: function(ctx) {
                            return `Skor: ${ctx.raw} / 5.0`;
                        }
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
    const noContract = (comply === 0 && notComply === 0) ? 1 : 0; // fallback

    // Destroy previous instance if exists
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
            cutout: '65%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 16,
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
            // Center text plugin: show compliance rate in the middle
            id: 'centerText',
            afterDraw(chart) {
                const { ctx, chartArea } = chart;
                const centerX = (chartArea.left + chartArea.right) / 2;
                const centerY = (chartArea.top + chartArea.bottom) / 2;
                const rate = cc.vendorComplianceRate != null ? cc.vendorComplianceRate : 0;

                ctx.save();
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                // Rate percentage
                ctx.font = 'bold 28px Inter, sans-serif';
                ctx.fillStyle = '#1e293b';
                ctx.fillText(`${rate}%`, centerX, centerY - 8);

                // Label
                ctx.font = '500 11px Inter, sans-serif';
                ctx.fillStyle = '#64748b';
                ctx.fillText('Compliance', centerX, centerY + 16);

                ctx.restore();
            }
        }]
    });
}

