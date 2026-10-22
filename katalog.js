// =====================================================
// KONFIGURASI API SPREADSHEET
// =====================================================
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxZPk7gIhZ75OPAgdS8PD_AGRBmC3d7BdP2ZtqhJXJEbD6V4Tdil4HiYCnFiL-FLNx_Fw/exec';

// =====================================================
// STATE & INIT
// =====================================================
let catalogData = null;
let catalogSearchQuery = '';
let catalogPeriodFilter = 'all'; // 'all' | 'Q1 2026' | 'Q2 2026' | etc.
let catalogSortBy = 'po-desc'; // 'po-desc' | 'name-asc' | 'ontime-desc'
let catalogViewMode = 'group'; // 'group' | 'raw'
let currentPage = 1;
let pageSize = 25; // default 25 item per halaman

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
    // 1. Search Box
    const searchInput = document.getElementById('catalogSearchInput');
    if (searchInput && !searchInput.dataset.bound) {
        searchInput.dataset.bound = 'true';
        searchInput.addEventListener('input', (e) => {
            catalogSearchQuery = (e.target.value || '').toLowerCase().trim();
            currentPage = 1;
            renderCatalog();
        });
    }

    // 2. Period Filter
    const periodSelect = document.getElementById('catalogPeriodSelect');
    if (periodSelect && !periodSelect.dataset.bound) {
        periodSelect.dataset.bound = 'true';
        periodSelect.addEventListener('change', (e) => {
            catalogPeriodFilter = e.target.value;
            currentPage = 1;
            renderCatalog();
        });
    }

    // 3. Sort Selector
    const sortSelect = document.getElementById('catalogSortSelect');
    if (sortSelect && !sortSelect.dataset.bound) {
        sortSelect.dataset.bound = 'true';
        sortSelect.addEventListener('change', (e) => {
            catalogSortBy = e.target.value;
            currentPage = 1;
            renderCatalog();
        });
    }

    // 4. Page Size Selector
    const sizeSelect = document.getElementById('pageSizeSelect');
    if (sizeSelect && !sizeSelect.dataset.bound) {
        sizeSelect.dataset.bound = 'true';
        sizeSelect.addEventListener('change', (e) => {
            pageSize = parseInt(e.target.value, 10) || 25;
            currentPage = 1;
            renderCatalog();
        });
    }

    // 5. Mode Switcher (Group vs Raw)
    const btnModeGroup = document.getElementById('catViewModeGroup');
    const btnModeRaw = document.getElementById('catViewModeRaw');
    if (btnModeGroup && !btnModeGroup.dataset.bound) {
        btnModeGroup.dataset.bound = 'true';
        btnModeGroup.addEventListener('click', () => {
            catalogViewMode = 'group';
            currentPage = 1;
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
            currentPage = 1;
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

            // Pastikan setiap order diberi tag periode asal & sinkronkan allRawOrders
            const compiledAllOrders = [];
            if (catalogData.periods) {
                for (const pk in catalogData.periods) {
                    const pObj = catalogData.periods[pk];
                    const pLabel = (pObj && (pObj.label || pObj.id)) ? (pObj.label || pObj.id) : pk;
                    if (pObj && Array.isArray(pObj.rawOrders)) {
                        pObj.rawOrders.forEach(o => {
                            o.periode = pLabel;
                            compiledAllOrders.push(o);
                        });
                    }
                }
            }

            if (compiledAllOrders.length > 0) {
                catalogData.allRawOrders = compiledAllOrders;
            } else if (Array.isArray(catalogData.allRawOrders)) {
                catalogData.allRawOrders.forEach(o => {
                    if (!o.periode) o.periode = 'Semua Periode';
                });
            }

            // Inisialisasi opsi filter periode
            populatePeriodFilterOptions();

            if (syncStatusEl) syncStatusEl.textContent = `Tersinkronisasi (${new Date().toLocaleTimeString('id-ID')})`;
            currentPage = 1;
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

function populatePeriodFilterOptions() {
    const select = document.getElementById('catalogPeriodSelect');
    if (!select || !catalogData) return;

    let periodList = [];
    if (Array.isArray(catalogData.periodList) && catalogData.periodList.length > 0) {
        periodList = catalogData.periodList;
    } else if (catalogData.periods) {
        periodList = Object.keys(catalogData.periods);
    }

    const currentVal = catalogPeriodFilter;
    select.innerHTML = `<option value="all">📅 Semua Periode</option>` +
        periodList.map(p => {
            const count = (catalogData.periods && catalogData.periods[p] && Array.isArray(catalogData.periods[p].rawOrders))
                ? catalogData.periods[p].rawOrders.length
                : 0;
            const countLabel = count > 0 ? ` (${count} PO)` : '';
            return `<option value="${esc(p)}">📅 ${esc(p)}${countLabel}</option>`;
        }).join('');

    select.value = periodList.includes(currentVal) ? currentVal : 'all';
    catalogPeriodFilter = select.value;
}

/**
 * Mengambil daftar pesanan PO sesuai filter periode yang aktif
 */
function getCatalogOrders() {
    if (!catalogData) return [];

    // Jika filter adalah "all", kembalikan seluruh pesanan
    if (catalogPeriodFilter === 'all') {
        if (Array.isArray(catalogData.allRawOrders) && catalogData.allRawOrders.length > 0) {
            return catalogData.allRawOrders;
        }
        const fallbackList = [];
        if (catalogData.periods) {
            for (const pk in catalogData.periods) {
                const pObj = catalogData.periods[pk];
                if (pObj && Array.isArray(pObj.rawOrders)) {
                    fallbackList.push(...pObj.rawOrders);
                }
            }
        }
        return fallbackList;
    }

    // Jika periode spesifik dipilih (misal: "Q1 2026", "Q2 2026")
    // 1. Ambil langsung dari catalogData.periods[catalogPeriodFilter]
    if (catalogData.periods && catalogData.periods[catalogPeriodFilter] && Array.isArray(catalogData.periods[catalogPeriodFilter].rawOrders)) {
        return catalogData.periods[catalogPeriodFilter].rawOrders;
    }

    // 2. Pencocokan toleran key/label/id tanpa case & spasi
    if (catalogData.periods) {
        const cleanFilter = catalogPeriodFilter.toLowerCase().replace(/\s+/g, '');
        for (const pk in catalogData.periods) {
            const pObj = catalogData.periods[pk];
            const cleanKey = pk.toLowerCase().replace(/\s+/g, '');
            const cleanLabel = (pObj?.label || '').toLowerCase().replace(/\s+/g, '');
            const cleanId = (pObj?.id || '').toLowerCase().replace(/\s+/g, '');
            if (cleanKey === cleanFilter || cleanLabel === cleanFilter || cleanId === cleanFilter) {
                if (Array.isArray(pObj.rawOrders)) {
                    return pObj.rawOrders;
                }
            }
        }
    }

    // 3. Fallback: filter dari allRawOrders
    if (Array.isArray(catalogData.allRawOrders)) {
        const cleanFilter = catalogPeriodFilter.toLowerCase().replace(/\s+/g, '');
        return catalogData.allRawOrders.filter(o => {
            if (!o.periode) return false;
            return o.periode.toLowerCase().replace(/\s+/g, '') === cleanFilter;
        });
    }

    return [];
}

// =====================================================
// RENDERING FUNCTIONS
// =====================================================
function renderCatalog() {
    const groupedTbody = document.getElementById('catalogGroupedTableBody');
    const rawTbody = document.getElementById('catalogRawTableBody');
    const badgeCount = document.getElementById('catalogBadgeCount');

    // 1. Ambil data pesanan sesuai periode yang dipilih
    const allOrders = getCatalogOrders();

    // 2. Ekstrak dan Kelompokkan Data per Produk
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
    });

    // 3. Update KPI Mini Cards di Bagian Atas
    const elTotProd = document.getElementById('catStatTotalProducts');
    const elTotOrd = document.getElementById('catStatTotalOrders');
    const elTopProd = document.getElementById('catStatTopProduct');
    const elTopProdMeta = document.getElementById('catStatTopProductMeta');
    const elOnTimeRate = document.getElementById('catStatOnTimeRate');

    if (elTotProd) elTotProd.textContent = groupedProducts.length;
    if (elTotOrd) elTotOrd.textContent = allOrders.length;
    if (elTopProd) {
        if (groupedProducts.length > 0) {
            // Temukan produk dengan pesanan terbanyak
            const topProdSorted = [...groupedProducts].sort((a, b) => b.totalOrders - a.totalOrders);
            elTopProd.textContent = topProdSorted[0].productName;
            if (elTopProdMeta) elTopProdMeta.textContent = `${topProdSorted[0].totalOrders} pesanan tercatat`;
        } else {
            elTopProd.textContent = '-';
            if (elTopProdMeta) elTopProdMeta.textContent = 'Belum ada data';
        }
    }
    if (elOnTimeRate) {
        const overallRate = allOrders.length > 0 ? Math.round((totalOnTimeAll / allOrders.length) * 100) : 100;
        elOnTimeRate.textContent = `${overallRate}%`;
    }

    // 4. Filter Pencarian (Live Search)
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

    // 5. Sorting Cerdas
    if (catalogSortBy === 'name-asc') {
        filteredGrouped.sort((a, b) => a.productName.localeCompare(b.productName));
        filteredOrders.sort((a, b) => (a.product || '').localeCompare(b.product || ''));
    } else if (catalogSortBy === 'ontime-desc') {
        filteredGrouped.sort((a, b) => b.onTimeRate - a.onTimeRate || b.totalOrders - a.totalOrders);
        filteredOrders.sort((a, b) => (b.isOnTime ? 1 : 0) - (a.isOnTime ? 1 : 0));
    } else {
        // Default: po-desc
        filteredGrouped.sort((a, b) => b.totalOrders - a.totalOrders);
    }

    // Update Badge Counter
    if (badgeCount) {
        badgeCount.textContent = catalogViewMode === 'group'
            ? `${filteredGrouped.length} Ragam Produk`
            : `${filteredOrders.length} Pesanan PO`;
    }

    // 6. Pagination Slicing
    const totalItems = (catalogViewMode === 'group' ? filteredGrouped.length : filteredOrders.length);
    const totalPages = Math.ceil(totalItems / pageSize) || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalItems);

    const pagedGrouped = filteredGrouped.slice(startIndex, endIndex);
    const pagedOrders = filteredOrders.slice(startIndex, endIndex);

    renderPaginationUI(totalItems, totalPages, startIndex, endIndex);

    // 7. Render Mode Grouped (Agregasi Produk & Top 3 Penyuplai Format Kompak)
    if (groupedTbody) {
        if (pagedGrouped.length === 0) {
            groupedTbody.innerHTML = `<tr><td colspan="6" class="text-center text-gray-400 py-12">Tidak ada produk atau penyuplai yang cocok dengan kriteria filter.</td></tr>`;
        } else {
            groupedTbody.innerHTML = pagedGrouped.map((item, idx) => {
                const globalIdx = startIndex + idx;
                const rankIcons = ['🥇', '🥈', '🥉'];
                const rankBorderColors = ['border-amber-300 bg-amber-50/70 text-amber-950', 'border-slate-300 bg-slate-50 text-slate-800', 'border-orange-300 bg-orange-50/70 text-orange-950'];

                // Top 3 vendor dalam 1 baris badge horizontal yang ringkas
                const topVendorsHtml = item.top3Vendors.map((v, rIdx) => {
                    const icon = rankIcons[rIdx] || '•';
                    const colorClass = rankBorderColors[rIdx] || 'border-gray-200 bg-gray-50 text-gray-800';
                    return `
                        <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border ${colorClass} text-xs shadow-2xs" title="${esc(v.vendor)}">
                            <span>${icon}</span>
                            <span class="font-semibold text-gray-900 truncate max-w-[150px] sm:max-w-[200px]">${esc(v.vendor)}</span>
                            <span class="font-mono text-[11px] font-semibold text-blue-700 bg-white px-1.5 py-0.2 rounded border border-gray-200/80">
                                ${v.count} PO · ${v.percentage}%
                            </span>
                        </span>
                    `;
                }).join('');

                const otherVendorsCount = item.topVendors.length - item.top3Vendors.length;
                const otherVendorsNotice = otherVendorsCount > 0
                    ? `<span class="inline-flex items-center text-[11px] text-gray-500 font-medium bg-gray-100 px-2 py-0.5 rounded-md whitespace-nowrap">+${otherVendorsCount} vendor lain</span>`
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
                        <tr class="border-b border-gray-100 text-xs hover:bg-gray-50/50">
                            <td class="py-1 px-3 font-mono font-semibold text-gray-800">${esc(o.poNum || '-')}</td>
                            <td class="py-1 px-3 text-gray-700">${esc(o.vendor || '-')}</td>
                            <td class="py-1 px-3 text-gray-500 font-mono text-[11px]">${esc(o.expectedDate || '-')}</td>
                            <td class="py-1 px-3 text-gray-500 font-mono text-[11px]">${esc(o.effectiveDate || '-')}</td>
                            <td class="py-1 px-3">${stBadge}</td>
                        </tr>
                    `;
                }).join('');

                return `
                    <tr class="hover:bg-gray-50/60 transition-colors border-b border-gray-100 align-middle">
                        <td class="text-xs text-gray-400 font-mono">${globalIdx + 1}</td>
                        <td>
                            <div class="flex items-center gap-2">
                                <span class="text-base">📦</span>
                                <div class="min-w-0">
                                    <h4 class="text-xs sm:text-sm font-bold text-gray-900 leading-snug truncate max-w-[240px]" title="${esc(item.productName)}">${esc(item.productName)}</h4>
                                    <span class="text-[10px] text-gray-400">${item.topVendors.length} vendor penyuplai</span>
                                </div>
                            </div>
                        </td>
                        <td class="text-center">
                            <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                ${item.totalOrders} PO
                            </span>
                        </td>
                        <td>
                            <div class="flex items-center gap-1.5 flex-wrap py-1">
                                ${topVendorsHtml}
                                ${otherVendorsNotice}
                            </div>
                        </td>
                        <td class="text-center">
                            ${onTimeBadge}
                        </td>
                        <td class="text-center">
                            <button onclick="toggleProductPoDetail(${globalIdx})" class="px-2 py-1 text-xs font-semibold rounded-lg border border-gray-200 text-blue-600 hover:bg-blue-50 transition shadow-2xs whitespace-nowrap">
                                Rincian (${item.totalOrders})
                            </button>
                        </td>
                    </tr>
                    <tr id="productPoRow_${globalIdx}" style="display: none;" class="bg-gray-50/70 border-b border-gray-200">
                        <td colspan="6" class="p-3">
                            <div class="bg-white rounded-xl border border-gray-200 p-3 shadow-xs">
                                <div class="flex items-center justify-between mb-2">
                                    <h5 class="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                                        <span>📋 Rincian Pesanan:</span>
                                        <span class="text-blue-600">${esc(item.productName)}</span>
                                    </h5>
                                    <span class="text-[11px] text-gray-400">${item.orders.length} riwayat transaksi PO</span>
                                </div>
                                <div class="table-scroll-container max-h-56 overflow-y-auto">
                                    <table class="w-full text-left border-collapse">
                                        <thead>
                                            <tr class="text-[10px] text-gray-500 uppercase border-b border-gray-200 bg-gray-50/90 sticky top-0">
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

    // 8. Render Mode Raw (Log Seluruh PO Format Kompak)
    if (rawTbody) {
        if (pagedOrders.length === 0) {
            rawTbody.innerHTML = `<tr><td colspan="7" class="text-center text-gray-400 py-12">Tidak ada data pesanan PO yang ditemukan.</td></tr>`;
        } else {
            rawTbody.innerHTML = pagedOrders.map((o, idx) => {
                const globalIdx = startIndex + idx;
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
                        <td class="text-xs text-gray-400 font-mono">${globalIdx + 1}</td>
                        <td class="text-xs font-semibold text-gray-900 font-mono">${esc(o.poNum || '-')}</td>
                        <td class="text-xs font-semibold text-gray-900">${esc(o.product || '-')}</td>
                        <td class="text-xs text-gray-600">${esc(o.vendor || '-')}</td>
                        <td class="text-xs text-gray-500 font-mono text-[11px]">${esc(o.expectedDate || '-')}</td>
                        <td class="text-xs text-gray-500 font-mono text-[11px]">${esc(o.effectiveDate || '-')}</td>
                        <td class="text-xs">${statusBadge}</td>
                    </tr>
                `;
            }).join('');
        }
    }
}

// =====================================================
// PAGINATION UI & ACTIONS
// =====================================================
function renderPaginationUI(totalItems, totalPages, startIndex, endIndex) {
    const infoEl = document.getElementById('paginationInfo');
    const navEl = document.getElementById('paginationNav');
    if (!infoEl || !navEl) return;

    const unit = (catalogViewMode === 'group' ? 'produk' : 'pesanan');
    infoEl.innerHTML = totalItems === 0
        ? `Tidak ada data ${unit}`
        : `Menampilkan <strong class="text-gray-900">${startIndex + 1} - ${endIndex}</strong> dari <strong class="text-gray-900">${totalItems}</strong> ${unit}`;

    if (totalPages <= 1) {
        navEl.innerHTML = '';
        return;
    }

    let buttonsHtml = '';

    // Tombol Sebelumnya
    buttonsHtml += `
        <button onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''} class="page-btn">
            ‹ Prev
        </button>
    `;

    // Tombol Halaman (Maksimal 5 tombol angka dinamis)
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);
    if (endPage - startPage < 4) {
        startPage = Math.max(1, endPage - 4);
    }

    if (startPage > 1) {
        buttonsHtml += `<button onclick="goToPage(1)" class="page-btn">1</button>`;
        if (startPage > 2) buttonsHtml += `<span class="text-xs text-gray-400 px-1">…</span>`;
    }

    for (let p = startPage; p <= endPage; p++) {
        buttonsHtml += `
            <button onclick="goToPage(${p})" class="page-btn ${p === currentPage ? 'active' : ''}">
                ${p}
            </button>
        `;
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) buttonsHtml += `<span class="text-xs text-gray-400 px-1">…</span>`;
        buttonsHtml += `<button onclick="goToPage(${totalPages})" class="page-btn">${totalPages}</button>`;
    }

    // Tombol Berikutnya
    buttonsHtml += `
        <button onclick="goToPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''} class="page-btn">
            Next ›
        </button>
    `;

    navEl.innerHTML = buttonsHtml;
}

function goToPage(page) {
    currentPage = page;
    renderCatalog();
    // Scroll mulus kembali ke atas tabel
    const tableCard = document.getElementById('catalogGroupedContainer');
    if (tableCard) {
        tableCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

// =====================================================
// EXPORT CSV (BERSIFAT FILTERED & PERIODE-AWARE)
// =====================================================
function exportCatalogToCSV() {
    let allOrders = getCatalogOrders();

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
        });

        if (catalogSearchQuery) {
            list = list.filter(p => p.productName.toLowerCase().includes(catalogSearchQuery));
        }

        // Sorting
        if (catalogSortBy === 'name-asc') {
            list.sort((a, b) => a.productName.localeCompare(b.productName));
        } else if (catalogSortBy === 'ontime-desc') {
            list.sort((a, b) => b.onTimePct - a.onTimePct || b.totalOrders - a.totalOrders);
        } else {
            list.sort((a, b) => b.totalOrders - a.totalOrders);
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

        const periodLabel = catalogPeriodFilter === 'all' ? 'Semua_Periode' : catalogPeriodFilter.replace(/[^a-zA-Z0-9]/g, '_');
        const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `Katalog_Top3_Vendor_${periodLabel}_${new Date().toISOString().slice(0, 10)}.csv`);
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

        const periodLabel = catalogPeriodFilter === 'all' ? 'Semua_Periode' : catalogPeriodFilter.replace(/[^a-zA-Z0-9]/g, '_');
        const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `Katalog_Log_PO_${periodLabel}_${new Date().toISOString().slice(0, 10)}.csv`);
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
