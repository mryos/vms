// =====================================================
// KONFIGURASI API SPREADSHEET
// =====================================================
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxZPk7gIhZ75OPAgdS8PD_AGRBmC3d7BdP2ZtqhJXJEbD6V4Tdil4HiYCnFiL-FLNx_Fw/exec';

// =====================================================
// STATE & INIT
// =====================================================
let catalogData = null;
let catalogSearchQuery = '';
let catalogViewMode = 'group'; // 'group' | 'raw'

document.addEventListener('DOMContentLoaded', () => {
    checkAdminAccess();
});

function checkAdminAccess() {
    const savedPin = localStorage.getItem('ethos_pin');
    const authOverlay = document.getElementById('adminAuthOverlay');
    
    // Hanya PIN 9999 yang boleh mengakses Katalog
    if (savedPin === '9999') {
        if (authOverlay) authOverlay.style.display = 'none';
        initHeader();
        initControls();
        loadCatalogData();
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
            initControls();
            loadCatalogData();
        } else {
            if (errEl) {
                errEl.textContent = '❌ PIN salah. Akses Katalog hanya untuk Administrator (PIN: 9999).';
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

    if (userEl) {
        const displayName = savedName || 'Administrator';
        const displayPin = savedPin || '9999';
        userEl.textContent = `👤 ${displayName} (${displayPin})`;
    }
}

function adminLogout() {
    localStorage.removeItem('ethos_pin');
    localStorage.removeItem('ethos_nama');
    window.location.href = 'index.html';
}

function initControls() {
    const searchInput = document.getElementById('catalogSearchInput');
    if (searchInput && !searchInput.dataset.bound) {
        searchInput.dataset.bound = 'true';
        searchInput.addEventListener('input', (e) => {
            catalogSearchQuery = (e.target.value || '').toLowerCase().trim();
            renderCatalog();
        });
    }

    const btnModeGroup = document.getElementById('catViewModeGroup');
    const btnModeRaw = document.getElementById('catViewModeRaw');
    if (btnModeGroup && !btnModeGroup.dataset.bound) {
        btnModeGroup.dataset.bound = 'true';
        btnModeGroup.addEventListener('click', () => {
            catalogViewMode = 'group';
            btnModeGroup.className = 'px-2.5 py-1.5 rounded-md bg-white text-gray-800 shadow-2xs border border-gray-200/60 transition';
            if (btnModeRaw) btnModeRaw.className = 'px-2.5 py-1.5 rounded-md text-gray-500 hover:text-gray-800 transition';
            const grpEl = document.getElementById('catalogGroupedContainer');
            const rawEl = document.getElementById('catalogRawContainer');
            if (grpEl) grpEl.style.display = 'block';
            if (rawEl) rawEl.style.display = 'none';
            renderCatalog();
        });
    }

    if (btnModeRaw && !btnModeRaw.dataset.bound) {
        btnModeRaw.dataset.bound = 'true';
        btnModeRaw.addEventListener('click', () => {
            catalogViewMode = 'raw';
            btnModeRaw.className = 'px-2.5 py-1.5 rounded-md bg-white text-gray-800 shadow-2xs border border-gray-200/60 transition';
            if (btnModeGroup) btnModeGroup.className = 'px-2.5 py-1.5 rounded-md text-gray-500 hover:text-gray-800 transition';
            const grpEl = document.getElementById('catalogGroupedContainer');
            const rawEl = document.getElementById('catalogRawContainer');
            if (grpEl) grpEl.style.display = 'none';
            if (rawEl) rawEl.style.display = 'block';
            renderCatalog();
        });
    }
}

// =====================================================
// DATA FETCHING
// =====================================================
async function loadCatalogData() {
    const syncStatusEl = document.getElementById('liveSyncStatus');
    if (syncStatusEl) syncStatusEl.textContent = 'Menyinkronkan data dari Spreadsheet...';

    const savedPin = localStorage.getItem('ethos_pin') || '9999';
    const url = `${SCRIPT_URL}?pin=${encodeURIComponent(savedPin)}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.status === 'success') {
            catalogData = data;
            if (syncStatusEl) syncStatusEl.textContent = `Tersinkronisasi (${new Date().toLocaleTimeString('id-ID')})`;
            renderCatalog();
            showToast('Data katalog produk berhasil diperbarui.', 'success');
        } else {
            showToast(data.message || 'Gagal mengambil data dari server.', 'error');
            if (syncStatusEl) syncStatusEl.textContent = 'Gagal sinkron data';
        }
    } catch (err) {
        console.error('Error fetching catalog data:', err);
        showToast('Gagal terhubung ke Google Spreadsheet API.', 'error');
        if (syncStatusEl) syncStatusEl.textContent = 'Koneksi error';
    }
}

// =====================================================
// RENDERING FUNCTIONS
// =====================================================
function renderCatalog() {
    const groupedTbody = document.getElementById('catalogGroupedTableBody');
    const rawTbody = document.getElementById('catalogRawTableBody');
    const badgeCount = document.getElementById('catalogBadgeCount');

    let allOrders = (catalogData && Array.isArray(catalogData.allRawOrders)) ? catalogData.allRawOrders : [];

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

    // 2. Update KPI Mini Cards di Bagian Atas
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
            if (elTopProdMeta) elTopProdMeta.textContent = `${groupedProducts[0].totalOrders} pesanan tercatat`;
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
            groupedTbody.innerHTML = `<tr><td colspan="6" class="text-center text-gray-400 py-12">Tidak ada produk atau penyuplai yang cocok dengan filter "${esc(catalogSearchQuery)}".</td></tr>`;
        } else {
            groupedTbody.innerHTML = filteredGrouped.map((item, idx) => {
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
            rawTbody.innerHTML = `<tr><td colspan="7" class="text-center text-gray-400 py-12">Tidak ada data pesanan PO yang ditemukan.</td></tr>`;
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
    let allOrders = (catalogData && Array.isArray(catalogData.allRawOrders)) ? catalogData.allRawOrders : [];

    if (catalogViewMode === 'group') {
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

// =====================================================
// UTILS
// =====================================================
function esc(str) {
    if (str === undefined || str === null) return '';
    const d = document.createElement('div');
    d.textContent = str.toString();
    return d.innerHTML;
}

function showToast(msg, type = 'success') {
    const box = document.getElementById('toastBox');
    if (!box) return;

    const t = document.createElement('div');
    t.className = 'toast';

    let icon = '✅';
    let bg = '#10b981';
    if (type === 'error') {
        icon = '❌';
        bg = '#ef4444';
    } else if (type === 'info') {
        icon = 'ℹ️';
        bg = '#3b82f6';
    } else if (type === 'warning') {
        icon = '⚠️';
        bg = '#f59e0b';
    }

    t.style.background = '#ffffff';
    t.style.borderLeft = `4px solid ${bg}`;
    t.style.color = '#1e293b';
    t.innerHTML = `<span>${icon}</span> <span>${esc(msg)}</span>`;

    box.appendChild(t);
    setTimeout(() => {
        t.style.opacity = '0';
        t.style.transform = 'translateX(100%)';
        t.style.transition = 'all 0.3s ease';
        setTimeout(() => t.remove(), 300);
    }, 3500);
}
