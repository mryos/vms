// =====================================================
// KONFIGURASI API SPREADSHEET
// =====================================================
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzwWF7-IbaKdoUu9kE56JZTPeekrbmNeN0fOWsLukFUZG2z--zZo01E1wYvL21ZDLdnkQ/exec';

// =====================================================
// STATE & INIT
// =====================================================
let catalogData = null;
let catalogSearchQuery = '';
let catalogPeriodFilter = 'all'; // 'all' | 'Q1 2026' | 'Q2 2026' | etc.
let catalogScoreFilter = 'all';  // 'all' | 'scored' | 'unscored'
let catalogSortBy = 'po-desc'; // 'po-desc' | 'score-desc' | 'score-asc' | 'name-asc' | 'ontime-desc' | 'risk-desc'
let catalogRiskFilter = 'all'; // 'all' | 'high-risk' | 'diversified'
let catalogViewMode = 'group'; // 'group' | 'raw'
let currentPage = 1;
let pageSize = 25; // default 25 item per halaman

document.addEventListener('DOMContentLoaded', () => {
    checkAdminAccess();
});

function checkAdminAccess() {
    const savedPin = sessionStorage.getItem('ethos_pin') || localStorage.getItem('ethos_pin');
    const authOverlay = document.getElementById('adminAuthOverlay');
    
    // Khusus pengguna PIN 1282: dilarang akses katalog, otomatis dialihkan ke kontrak
    if (savedPin === '1282') {
        window.location.href = 'kontrak.html';
        return;
    }

    // PIN 9999 (Administrator) dan PIN 8899 (User Khusus Katalog) diperbolehkan
    if (savedPin === '9999' || savedPin === '8899') {
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
            sessionStorage.setItem('ethos_pin', '9999');
            sessionStorage.setItem('ethos_nama', 'Administrator');
            sessionStorage.removeItem('ethos_role');
            localStorage.setItem('ethos_pin', '9999');
            localStorage.setItem('ethos_nama', 'Administrator');
            localStorage.removeItem('ethos_role');
            if (errEl) errEl.style.display = 'none';
            if (authOverlay) authOverlay.style.display = 'none';
            initHeader();
            initControls();
            loadCatalogData();
        } else if (pin === '8899') {
            sessionStorage.setItem('ethos_pin', '8899');
            sessionStorage.setItem('ethos_nama', 'User Katalog');
            sessionStorage.setItem('ethos_role', 'katalog_only');
            localStorage.setItem('ethos_pin', '8899');
            localStorage.setItem('ethos_nama', 'User Katalog');
            localStorage.setItem('ethos_role', 'katalog_only');
            if (errEl) errEl.style.display = 'none';
            if (authOverlay) authOverlay.style.display = 'none';
            initHeader();
            initControls();
            loadCatalogData();
        } else if (pin === '1282') {
            if (errEl) {
                errEl.innerHTML = '❌ Akses Ditolak. PIN 1282 hanya diizinkan mengakses <strong>Kumpulan Kontrak Kerja</strong>.<br><a href="kontrak.html" class="underline font-bold text-indigo-600 mt-1 inline-block">Buka Contract Repository &rarr;</a>';
                errEl.style.display = 'block';
            }
        } else {
            if (errEl) {
                errEl.textContent = '❌ PIN salah. Akses Katalog untuk Administrator (PIN 9999) atau User Katalog (PIN 8899).';
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
    const navForm = document.getElementById('navLinkForm');
    const navKontrak = document.getElementById('navLinkKontrak');
    const logoLink = document.getElementById('headerLogoLink');

    // Khusus pengguna PIN 8899: batasi akses hanya untuk katalog saja
    if (savedPin === '8899') {
        if (userEl) userEl.textContent = `👤 User Katalog (8899)`;
        if (navDashboard) navDashboard.style.display = 'none';
        if (navForm) navForm.style.display = 'none';
        if (navKontrak) navKontrak.style.display = 'none';
        if (logoLink) {
            logoLink.href = 'katalog.html';
            logoLink.onclick = (e) => e.preventDefault();
        }
    } else {
        const displayName = savedName || 'Administrator';
        const displayPin = savedPin || '9999';
        if (userEl) userEl.textContent = `👤 ${displayName} (${displayPin})`;
        if (navDashboard) navDashboard.style.display = '';
        if (navForm) navForm.style.display = '';
        if (navKontrak) navKontrak.style.display = '';
        if (logoLink) {
            logoLink.href = 'dashboard.html';
            logoLink.onclick = null;
        }
    }
}

function adminLogout() {
    sessionStorage.removeItem('ethos_pin');
    sessionStorage.removeItem('ethos_nama');
    sessionStorage.removeItem('ethos_role');
    localStorage.removeItem('ethos_pin');
    localStorage.removeItem('ethos_nama');
    localStorage.removeItem('ethos_role');
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

    // 2b. Score Filter Selector
    const scoreSelect = document.getElementById('catalogScoreFilter');
    if (scoreSelect && !scoreSelect.dataset.bound) {
        scoreSelect.dataset.bound = 'true';
        scoreSelect.addEventListener('change', (e) => {
            catalogScoreFilter = e.target.value;
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

    // 3b. Risk Filter Selector
    const riskSelect = document.getElementById('catalogRiskSelect');
    if (riskSelect && !riskSelect.dataset.bound) {
        riskSelect.dataset.bound = 'true';
        riskSelect.addEventListener('change', (e) => {
            catalogRiskFilter = e.target.value;
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
    // Gunakan 9999 sebagai fallback query ke backend jika live endpoint Google Apps Script belum diperbarui dengan 8899
    const apiPin = (savedPin === '8899' || savedPin === 'admin') ? '9999' : savedPin;
    const url = `${SCRIPT_URL}?pin=${encodeURIComponent(apiPin)}`;

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

            // [DEBUG] Log sample order untuk verifikasi field yang tersedia
            const sampleOrders = (catalogData.allRawOrders || []).slice(0, 3);
            if (sampleOrders.length > 0) {
                console.log('[Katalog Debug] Sample order keys:', Object.keys(sampleOrders[0]));
                console.log('[Katalog Debug] Sample orders:', JSON.stringify(sampleOrders, null, 2));
                const hasNilai = sampleOrders.some(o => o.nilai !== undefined);
                console.log('[Katalog Debug] Field "nilai" tersedia:', hasNilai);
                if (!hasNilai) {
                    console.warn('[Katalog Debug] ⚠️ Backend belum mengembalikan field "nilai". Perbarui Google Apps Script terlebih dahulu.');
                }
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
// MARKETPLACE PRICE COMPARISON HELPER
// =====================================================
function cleanProductName(name) {
    if (!name) return '';
    let cleaned = name.replace(/\[[^\]]*\]/g, '').trim();
    cleaned = cleaned.replace(/^[-:\s]+|[-:\s]+$/g, '').trim();
    return cleaned || name;
}

function getMarketplaceUrl(platform, rawName) {
    const q = cleanProductName(rawName);
    const enc = encodeURIComponent(q);
    switch (platform) {
        case 'tokopedia':
            return `https://www.tokopedia.com/search?st=product&q=${enc}`;
        case 'shopee':
            return `https://shopee.co.id/search?keyword=${enc}`;
        case 'google':
            return `https://www.google.com/search?tbm=shop&q=${enc}`;
        case 'blibli':
            return `https://www.blibli.com/cari/${enc}`;
        default:
            return `https://www.google.com/search?q=${enc}`;
    }
}

// =====================================================
// VENDOR SCORE MATCHING HELPER
// =====================================================
function matchVendorScore(vendorName) {
    if (!vendorName || !catalogData || !catalogData.scoreSummary) return null;
    const scores = catalogData.scoreSummary;
    const clean = vendorName.toLowerCase().trim();

    // 1. Exact match (case-insensitive)
    for (const k in scores) {
        if (k.toLowerCase().trim() === clean) return { matchedName: k, ...scores[k] };
    }

    // 2. Fuzzy match: strip PT/CV prefix and EKI/FHI/FH suffix
    const norm = clean.replace(/^(pt|cv|ud|toko)\.?\s+/i, '').replace(/\s*[-–]\s*(eki|fhi|fh)\s*$/i, '').replace(/\s*\(fhi?\)\s*$/i, '').replace(/[^a-z0-9]/g, '');
    if (norm.length < 4) return null;

    for (const k in scores) {
        const kNorm = k.toLowerCase().replace(/^(pt|cv|ud|toko)\.?\s+/i, '').replace(/\s*[-–]\s*(eki|fhi|fh)\s*$/i, '').replace(/\s*\(fhi?\)\s*$/i, '').replace(/[^a-z0-9]/g, '');
        if (kNorm && kNorm.length >= 4 && (kNorm === norm || (norm.length > 5 && (kNorm.includes(norm) || norm.includes(kNorm))))) {
            return { matchedName: k, ...scores[k] };
        }
    }
    return null;
}

function getVendorOnTimeFromPoStats(vendorName) {
    if (!vendorName || !catalogData || !catalogData.poStats || !catalogData.poStats.vendorMap) return null;
    const vm = catalogData.poStats.vendorMap;
    const clean = vendorName.trim();

    // Exact match first
    if (vm[clean]) return vm[clean];

    // Case-insensitive
    const lower = clean.toLowerCase();
    for (const k in vm) {
        if (k.toLowerCase() === lower) return vm[k];
    }
    return null;
}

function renderVendorScoreBadge(vendorName) {
    const scoreData = matchVendorScore(vendorName);
    if (!scoreData || !scoreData.avgScore) {
        return `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500 border border-gray-200" title="Vendor belum dinilai oleh user">— Belum Dinilai</span>`;
    }
    const avg = scoreData.avgScore;
    const pred = scoreData.predikat || 'Cukup';
    let badgeClass = 'bg-gray-100 text-gray-700 border-gray-200';
    let starIcon = '⭐';
    if (avg >= 4.5) {
        badgeClass = 'bg-emerald-50 text-emerald-800 border-emerald-200';
        starIcon = '🌟';
    } else if (avg >= 3.5) {
        badgeClass = 'bg-blue-50 text-blue-800 border-blue-200';
    } else if (avg >= 2.5) {
        badgeClass = 'bg-amber-50 text-amber-800 border-amber-200';
    } else {
        badgeClass = 'bg-rose-50 text-rose-800 border-rose-200';
    }
    return `<span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${badgeClass} border" title="${esc(pred)} (Skor ${avg.toFixed(2)} / 5.00) dari penilaian user">${starIcon} ${avg.toFixed(1)} <span class="font-medium opacity-80">${esc(pred)}</span></span>`;
}

function getProductBestScore(topVendors) {
    let best = null;
    if (!topVendors || topVendors.length === 0) return best;
    topVendors.forEach(v => {
        const s = matchVendorScore(v.vendor);
        if (s && s.avgScore > 0) {
            if (!best || s.avgScore > best.avgScore) {
                best = s;
            }
        }
    });
    return best;
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

        // Ekstraksi nilai/harga numerik bersih
        const rawVal = o.nilai ?? o.price ?? o.totalValue ?? o.amount ?? o.grandTotal ?? 0;
        let numVal = 0;
        if (typeof rawVal === 'number') {
            numVal = rawVal;
        } else if (rawVal) {
            const cleaned = rawVal.toString().replace(/[^0-9.-]+/g, '');
            numVal = parseFloat(cleaned) || 0;
        }
        o._cleanPrice = numVal;

        if (!productMap[key]) {
            productMap[key] = {
                productName: rawName,
                totalOrders: 0,
                onTimeOrders: 0,
                lateOrders: 0,
                vendorsCount: {},
                vendorOrders: {},
                prices: [],
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
        if (!productMap[key].vendorOrders[vName]) {
            productMap[key].vendorOrders[vName] = [];
        }
        productMap[key].vendorOrders[vName].push(o);

        if (numVal > 0) {
            productMap[key].prices.push(numVal);
        }
        productMap[key].orders.push(o);
    });

    let groupedProducts = Object.values(productMap).map(p => {
        // Kalkulasi harga agregat produk
        const hasPrices = p.prices.length > 0;
        const minPrice = hasPrices ? Math.min(...p.prices) : 0;
        const maxPrice = hasPrices ? Math.max(...p.prices) : 0;
        const avgPrice = hasPrices ? Math.round(p.prices.reduce((a, b) => a + b, 0) / p.prices.length) : 0;

        // Harga pembelian terakhir (dari transaksi terbaru yang memiliki nilai > 0)
        let lastPrice = 0;
        for (let i = p.orders.length - 1; i >= 0; i--) {
            if (p.orders[i]._cleanPrice > 0) {
                lastPrice = p.orders[i]._cleanPrice;
                break;
            }
        }
        if (lastPrice === 0 && hasPrices) {
            lastPrice = p.prices[p.prices.length - 1];
        }

        // Kalkulasi per vendor penyuplai
        const vendorEntries = Object.entries(p.vendorsCount)
            .map(([vendor, count]) => {
                const vOrders = p.vendorOrders[vendor] || [];
                const vPrices = vOrders.map(o => o._cleanPrice).filter(v => v > 0);
                const vOnTime = vOrders.filter(o => o.isOnTime).length;
                const vOnTimePct = vOrders.length > 0 ? Math.round((vOnTime / vOrders.length) * 100) : 100;
                let vLastPrice = 0;
                for (let i = vOrders.length - 1; i >= 0; i--) {
                    if (vOrders[i]._cleanPrice > 0) {
                        vLastPrice = vOrders[i]._cleanPrice;
                        break;
                    }
                }
                const vMinPrice = vPrices.length > 0 ? Math.min(...vPrices) : 0;
                const vMaxPrice = vPrices.length > 0 ? Math.max(...vPrices) : 0;
                const vAvgPrice = vPrices.length > 0 ? Math.round(vPrices.reduce((a, b) => a + b, 0) / vPrices.length) : 0;

                return {
                    vendor,
                    count,
                    percentage: p.totalOrders > 0 ? Math.round((count / p.totalOrders) * 100) : 0,
                    onTimePct: vOnTimePct,
                    lastPrice: vLastPrice,
                    minPrice: vMinPrice,
                    maxPrice: vMaxPrice,
                    avgPrice: vAvgPrice,
                    hasPrice: vPrices.length > 0
                };
            })
            .sort((a, b) => b.count - a.count);

        // Identifikasi vendor dengan harga termurah (hanya jika ada >= 2 vendor yang memiliki data harga)
        const vendorsWithPrice = vendorEntries.filter(v => v.lastPrice > 0);
        let lowestPrice = 0;
        if (vendorsWithPrice.length > 0) {
            lowestPrice = Math.min(...vendorsWithPrice.map(v => v.lastPrice));
        }
        vendorEntries.forEach(v => {
            v.isBestPrice = (lowestPrice > 0 && v.lastPrice === lowestPrice && vendorsWithPrice.length > 1);
            v._scoreData = matchVendorScore(v.vendor);
            v._poStatsData = getVendorOnTimeFromPoStats(v.vendor);
        });

        const onTimeRate = p.totalOrders > 0 ? Math.round((p.onTimeOrders / p.totalOrders) * 100) : 100;
        const topShare = vendorEntries.length > 0 ? vendorEntries[0].percentage : 0;
        const isSingleSourceRisk = (p.totalOrders >= 2 && topShare >= 70);
        const _bestScore = getProductBestScore(vendorEntries);
        const _hasAnyScore = vendorEntries.some(v => v._scoreData && v._scoreData.avgScore > 0);
        return {
            ...p,
            topVendors: vendorEntries,
            top3Vendors: vendorEntries.slice(0, 3),
            hasPrices,
            minPrice,
            maxPrice,
            avgPrice,
            lastPrice,
            lowestPrice,
            onTimeRate,
            topShare,
            isSingleSourceRisk,
            _bestScore,
            _hasAnyScore
        };
    });

    // 3. Update KPI Mini Cards di Bagian Atas
    const elTotProd = document.getElementById('catStatTotalProducts');
    const elTotOrd = document.getElementById('catStatTotalOrders');
    const elTopProd = document.getElementById('catStatTopProduct');
    const elTopProdMeta = document.getElementById('catStatTopProductMeta');
    const elOnTimeRate = document.getElementById('catStatOnTimeRate');
    const elRiskProd = document.getElementById('catStatRiskProducts');

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
    if (elRiskProd) {
        const riskCount = groupedProducts.filter(p => p.isSingleSourceRisk).length;
        elRiskProd.textContent = riskCount;
    }

    // Update KPI Penilaian User
    const elVendorScored = document.getElementById('catStatVendorScored');
    const elVendorScoredMeta = document.getElementById('catStatVendorScoredMeta');
    const allUniqueVendors = new Set();
    const scoredVendors = new Set();
    groupedProducts.forEach(p => p.topVendors.forEach(v => {
        allUniqueVendors.add(v.vendor);
        if (v._scoreData && v._scoreData.avgScore > 0) scoredVendors.add(v.vendor);
    }));
    if (elVendorScored) elVendorScored.textContent = scoredVendors.size;
    if (elVendorScoredMeta) elVendorScoredMeta.textContent = `dari ${allUniqueVendors.size} vendor`;

    // 4. Filter Pencarian & Risiko
    let filteredGrouped = groupedProducts;
    let filteredOrders = allOrders;

    if (catalogRiskFilter === 'high-risk') {
        filteredGrouped = filteredGrouped.filter(p => p.isSingleSourceRisk);
    } else if (catalogRiskFilter === 'diversified') {
        filteredGrouped = filteredGrouped.filter(p => !p.isSingleSourceRisk);
    }

    if (catalogScoreFilter === 'scored') {
        filteredGrouped = filteredGrouped.filter(p => p._hasAnyScore);
    } else if (catalogScoreFilter === 'unscored') {
        filteredGrouped = filteredGrouped.filter(p => !p._hasAnyScore);
    }

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
    } else if (catalogSortBy === 'price-desc') {
        filteredGrouped.sort((a, b) => (b.lastPrice || 0) - (a.lastPrice || 0) || b.totalOrders - a.totalOrders);
        filteredOrders.sort((a, b) => (b._cleanPrice || 0) - (a._cleanPrice || 0));
    } else if (catalogSortBy === 'price-asc') {
        filteredGrouped.sort((a, b) => {
            if ((a.lastPrice || 0) === 0 && (b.lastPrice || 0) > 0) return 1;
            if ((b.lastPrice || 0) === 0 && (a.lastPrice || 0) > 0) return -1;
            return (a.lastPrice || 0) - (b.lastPrice || 0) || b.totalOrders - a.totalOrders;
        });
        filteredOrders.sort((a, b) => {
            if ((a._cleanPrice || 0) === 0 && (b._cleanPrice || 0) > 0) return 1;
            if ((b._cleanPrice || 0) === 0 && (a._cleanPrice || 0) > 0) return -1;
            return (a._cleanPrice || 0) - (b._cleanPrice || 0);
        });
    } else if (catalogSortBy === 'ontime-desc') {
        filteredGrouped.sort((a, b) => b.onTimeRate - a.onTimeRate || b.totalOrders - a.totalOrders);
        filteredOrders.sort((a, b) => (b.isOnTime ? 1 : 0) - (a.isOnTime ? 1 : 0));
    } else if (catalogSortBy === 'risk-desc') {
        filteredGrouped.sort((a, b) => (b.topShare || 0) - (a.topShare || 0) || b.totalOrders - a.totalOrders);
    } else if (catalogSortBy === 'score-desc') {
        filteredGrouped.sort((a, b) => ((b._bestScore?.avgScore || 0) - (a._bestScore?.avgScore || 0)) || b.totalOrders - a.totalOrders);
    } else if (catalogSortBy === 'score-asc') {
        filteredGrouped.sort((a, b) => {
            const aS = a._bestScore?.avgScore || 0;
            const bS = b._bestScore?.avgScore || 0;
            if (aS === 0 && bS > 0) return 1;
            if (bS === 0 && aS > 0) return -1;
            return aS - bS || b.totalOrders - a.totalOrders;
        });
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
            groupedTbody.innerHTML = `<tr><td colspan="7" class="text-center text-gray-400 py-12">Tidak ada produk atau penyuplai yang cocok dengan kriteria filter.</td></tr>`;
        } else {
            groupedTbody.innerHTML = pagedGrouped.map((item, idx) => {
                const globalIdx = startIndex + idx;
                const rankIcons = ['🥇', '🥈', '🥉'];
                const rankBorderColors = ['border-amber-300 bg-amber-50/70 text-amber-950', 'border-slate-300 bg-slate-50 text-slate-800', 'border-orange-300 bg-orange-50/70 text-orange-950'];

                // Top 3 vendor dalam badge informatif dengan harga & penanda termurah
                const topVendorsHtml = item.top3Vendors.map((v, rIdx) => {
                    const icon = rankIcons[rIdx] || '•';
                    const colorClass = rankBorderColors[rIdx] || 'border-gray-200 bg-gray-50 text-gray-800';
                    const priceText = v.lastPrice > 0 ? formatCompactRupiah(v.lastPrice) : '-';
                    const bestPriceBadge = v.isBestPrice
                        ? `<span class="inline-flex items-center gap-0.5 px-1 py-0.2 rounded bg-emerald-100 text-emerald-800 text-[10px] font-extrabold tracking-tight" title="Vendor dengan harga pengadaan paling hemat untuk produk ini">🟢 Termurah</span>`
                        : '';
                    const vScoreBadge = renderVendorScoreBadge(v.vendor);

                    return `
                        <div class="inline-flex flex-col gap-0.5 px-2 py-1 rounded-md border ${colorClass} text-xs shadow-2xs min-w-[130px] sm:min-w-[150px]">
                            <div class="flex items-center justify-between gap-1.5">
                                <div class="flex items-center gap-1 min-w-0" title="${esc(v.vendor)}">
                                    <span>${icon}</span>
                                    <span class="font-bold text-gray-900 truncate max-w-[100px] sm:max-w-[130px]">${esc(v.vendor)}</span>
                                </div>
                                <span class="font-mono text-[10px] font-bold text-blue-700 bg-white px-1.5 py-0.2 rounded border border-gray-200/90 whitespace-nowrap shadow-2xs">
                                    ${v.count} PO · ${v.percentage}%
                                </span>
                            </div>
                            <div class="flex items-center justify-between gap-1 pt-1 border-t border-gray-200/60 mt-0.5">
                                <span class="text-[10px] text-gray-500 font-medium">Harga PO:</span>
                                <div class="flex items-center gap-1">
                                    <span class="font-mono text-[11px] font-bold ${v.isBestPrice ? 'text-emerald-700' : (v.lastPrice > 0 ? 'text-gray-900' : 'text-gray-400')}">
                                        ${priceText}
                                    </span>
                                    ${bestPriceBadge}
                                </div>
                            </div>
                            <div class="flex items-center justify-between gap-1 pt-0.5">
                                <span class="text-[10px] text-gray-500 font-medium">SLA Tepat:</span>
                                <span class="text-[10px] font-bold ${v.onTimePct >= 80 ? 'text-emerald-700' : 'text-amber-700'}">${v.onTimePct}%</span>
                            </div>
                            <div class="flex items-center justify-between gap-1 pt-0.5">
                                <span class="text-[10px] text-gray-500 font-medium">Nilai User:</span>
                                ${vScoreBadge}
                            </div>
                        </div>
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

                // Kolom Harga Terakhir & Kisaran
                let priceColumnHtml = '';
                if (item.hasPrices && item.lastPrice > 0) {
                    const hasRange = item.minPrice > 0 && item.maxPrice > item.minPrice;
                    priceColumnHtml = `
                        <div class="flex flex-col py-0.5">
                            <div class="flex items-baseline gap-1">
                                <span class="text-[10px] text-gray-400 font-medium">Terakhir:</span>
                                <span class="font-mono font-bold text-xs text-gray-900" title="Harga Pembelian Terakhir">${formatRupiah(item.lastPrice)}</span>
                            </div>
                            ${hasRange ? `
                                <div class="text-[10px] text-gray-500 font-mono mt-0.5 flex items-center gap-1" title="Rentang Pengadaan: ${formatRupiah(item.minPrice)} s/d ${formatRupiah(item.maxPrice)}">
                                    <span class="text-gray-400">Kisaran:</span>
                                    <span class="font-semibold text-slate-700">${formatCompactRupiah(item.minPrice)} - ${formatCompactRupiah(item.maxPrice)}</span>
                                </div>
                            ` : `
                                <div class="text-[10px] text-emerald-600 font-medium mt-0.5 flex items-center gap-1">
                                    <span>✓</span> <span>Harga seragam</span>
                                </div>
                            `}
                        </div>
                    `;
                } else {
                    priceColumnHtml = `
                        <div class="flex flex-col text-gray-400 py-0.5">
                            <span class="text-xs font-mono">-</span>
                            <span class="text-[10px] text-gray-400">Belum ada nilai PO</span>
                        </div>
                    `;
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
                    const poPriceCell = o._cleanPrice > 0
                        ? `<span class="font-mono font-bold text-gray-900 text-xs">${formatRupiah(o._cleanPrice)}</span>`
                        : `<span class="text-gray-400 font-mono text-[11px]">-</span>`;

                    return `
                        <tr class="border-b border-gray-100 text-xs hover:bg-gray-50/50">
                            <td class="py-1 px-3 font-mono font-semibold text-gray-800">${esc(o.poNum || '-')}</td>
                            <td class="py-1 px-3 text-gray-700">${esc(o.vendor || '-')}</td>
                            <td class="py-1 px-3 text-right whitespace-nowrap">${poPriceCell}</td>
                            <td class="py-1 px-3 text-gray-500 font-mono text-[11px]">${esc(o.expectedDate || '-')}</td>
                            <td class="py-1 px-3 text-gray-500 font-mono text-[11px]">${esc(o.effectiveDate || '-')}</td>
                            <td class="py-1 px-3">${stBadge}</td>
                        </tr>
                    `;
                }).join('');

                const cleanName = cleanProductName(item.productName);
                const tokpedUrl = getMarketplaceUrl('tokopedia', item.productName);
                const shopeeUrl = getMarketplaceUrl('shopee', item.productName);
                const googleUrl = getMarketplaceUrl('google', item.productName);

                return `
                    <tr class="hover:bg-gray-50/60 transition-colors border-b border-gray-100 align-middle">
                        <td class="text-xs text-gray-400 font-mono">${globalIdx + 1}</td>
                        <td>
                            <div class="flex items-start gap-2.5">
                                <span class="text-base mt-0.5">📦</span>
                                <div class="min-w-0">
                                    <h4 class="text-xs sm:text-sm font-bold text-gray-900 leading-snug truncate max-w-[260px]" title="${esc(item.productName)}">${esc(item.productName)}</h4>
                                    <div class="flex items-center gap-1.5 flex-wrap mt-1">
                                        <span class="text-[10px] text-gray-400 font-medium">${item.topVendors.length} vendor ·</span>
                                        <span class="text-[10px] text-gray-500 font-medium">🛒 Cek Pasar:</span>
                                        <a href="${tokpedUrl}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 border border-emerald-200/80 transition" title="Cari '${esc(cleanName)}' di Tokopedia">
                                            <span>Tokopedia</span>
                                            <svg class="w-2.5 h-2.5 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                                        </a>
                                        <a href="${shopeeUrl}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-orange-50 text-orange-700 hover:bg-orange-100 hover:text-orange-800 border border-orange-200/80 transition" title="Cari '${esc(cleanName)}' di Shopee">
                                            <span>Shopee</span>
                                            <svg class="w-2.5 h-2.5 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                                        </a>
                                        <a href="${googleUrl}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800 border border-blue-200/80 transition" title="Cari '${esc(cleanName)}' di Google Shopping">
                                            <span>Google Shop</span>
                                            <svg class="w-2.5 h-2.5 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                                        </a>
                                    </div>
                                    ${item.isSingleSourceRisk ? `
                                        <div class="mt-1">
                                            <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-300 shadow-2xs" title="${item.topShare}% pesanan terpusat pada 1 vendor saja">
                                                <span>⚠️ Single-Source</span>
                                                <span class="font-mono text-amber-700">${item.topShare}%</span>
                                                <span class="font-normal text-amber-800 truncate max-w-[120px]">(${esc(item.top3Vendors[0]?.vendor || '-')})</span>
                                            </span>
                                        </div>
                                    ` : ''}
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
                        <td>
                            ${priceColumnHtml}
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
                        <td colspan="7" class="p-3">
                            <div class="bg-white rounded-xl border border-gray-200 p-3 shadow-xs">
                                <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2.5 pb-2 border-b border-gray-100">
                                    <div>
                                        <h5 class="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                                            <span>📋 Rincian Pesanan:</span>
                                            <span class="text-blue-600">${esc(item.productName)}</span>
                                        </h5>
                                        <span class="text-[11px] text-gray-400">${item.orders.length} riwayat transaksi PO tercatat</span>
                                    </div>
                                    <div class="flex items-center gap-1.5 flex-wrap">
                                        <span class="text-xs font-semibold text-gray-500">🛒 Bandingkan Harga:</span>
                                        <a href="${tokpedUrl}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition shadow-2xs" title="Cari di Tokopedia">
                                            <span>🟢 Tokopedia ↗</span>
                                        </a>
                                        <a href="${shopeeUrl}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200 transition shadow-2xs" title="Cari di Shopee">
                                            <span>🟠 Shopee ↗</span>
                                        </a>
                                        <a href="${googleUrl}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition shadow-2xs" title="Cari di Google Shopping">
                                            <span>🔵 Google Shopping ↗</span>
                                        </a>
                                    </div>
                                </div>
                                ${item.isSingleSourceRisk ? `
                                    <div class="mb-3 p-2.5 bg-amber-50/90 border border-amber-200 rounded-xl text-xs text-amber-950 flex items-start gap-2 shadow-2xs">
                                        <span class="text-base leading-none mt-0.5">⚠️</span>
                                        <div class="leading-relaxed">
                                            <strong class="font-bold text-amber-900">Analisis Ketergantungan Pasokan:</strong> 
                                            Sebesar <strong>${item.topShare}%</strong> dari total ${item.totalOrders} pesanan produk ini terkonsentrasi pada satu rekanan yaitu <strong>${esc(item.top3Vendors[0]?.vendor)}</strong>.
                                            ${item.topVendors.length > 1 ? `<div class="mt-0.5 text-amber-800">💡 <em>Mitigasi Risiko: Pertimbangkan pengalihan sebagian PO ke vendor cadangan (misal: <strong>${esc(item.topVendors.slice(1, 3).map(v => v.vendor).join(', '))}</strong>) untuk menjaga stabilitas pasokan.</em></div>` : `<div class="mt-0.5 text-amber-800">💡 <em>Mitigasi Risiko: Belum ada vendor alternatif di riwayat PO. Disarankan mencari vendor pembanding baru.</em></div>`}
                                        </div>
                                    </div>
                                ` : ''}
                                <div class="table-scroll-container max-h-56 overflow-y-auto">
                                    <table class="w-full text-left border-collapse">
                                        <thead>
                                            <tr class="text-[10px] text-gray-500 uppercase border-b border-gray-200 bg-gray-50/90 sticky top-0">
                                                <th class="py-1 px-3">No. PO</th>
                                                <th class="py-1 px-3">Vendor</th>
                                                <th class="py-1 px-3 text-right">Nilai / Harga PO</th>
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
            rawTbody.innerHTML = `<tr><td colspan="9" class="text-center text-gray-400 py-12">Tidak ada data pesanan PO yang ditemukan.</td></tr>`;
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

                const tokpedUrl = getMarketplaceUrl('tokopedia', o.product);
                const shopeeUrl = getMarketplaceUrl('shopee', o.product);

                const rawPriceCell = o._cleanPrice > 0
                    ? `<span class="font-mono font-bold text-gray-900 text-xs">${formatRupiah(o._cleanPrice)}</span>`
                    : `<span class="text-gray-400 font-mono text-[11px]">-</span>`;

                return `
                    <tr class="hover:bg-gray-50/80 transition-colors">
                        <td class="text-xs text-gray-400 font-mono">${globalIdx + 1}</td>
                        <td class="text-xs font-semibold text-gray-900 font-mono">${esc(o.poNum || '-')}</td>
                        <td class="text-xs font-semibold text-gray-900">
                            <div>
                                <span>${esc(o.product || '-')}</span>
                                <div class="flex items-center gap-1.5 mt-0.5">
                                    <span class="text-[10px] text-gray-400">Riset:</span>
                                    <a href="${tokpedUrl}" target="_blank" rel="noopener noreferrer" class="text-[10px] font-semibold text-emerald-600 hover:text-emerald-700 hover:underline" title="Cari di Tokopedia">Tokopedia ↗</a>
                                    <span class="text-gray-300">·</span>
                                    <a href="${shopeeUrl}" target="_blank" rel="noopener noreferrer" class="text-[10px] font-semibold text-orange-600 hover:text-orange-700 hover:underline" title="Cari di Shopee">Shopee ↗</a>
                                </div>
                            </div>
                        </td>
                        <td class="text-xs text-gray-600">${esc(o.vendor || '-')}</td>
                        <td class="text-xs text-right whitespace-nowrap">${rawPriceCell}</td>
                        <td class="text-xs text-gray-500 font-mono text-[11px]">${esc(o.expectedDate || '-')}</td>
                        <td class="text-xs text-gray-500 font-mono text-[11px]">${esc(o.effectiveDate || '-')}</td>
                        <td class="text-xs text-center whitespace-nowrap">${renderVendorScoreBadge(o.vendor)}</td>
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
            const rawVal = o.nilai ?? o.price ?? o.totalValue ?? o.amount ?? o.grandTotal ?? 0;
            let numVal = 0;
            if (typeof rawVal === 'number') {
                numVal = rawVal;
            } else if (rawVal) {
                const cleaned = rawVal.toString().replace(/[^0-9.-]+/g, '');
                numVal = parseFloat(cleaned) || 0;
            }

            if (!productMap[key]) {
                productMap[key] = { productName: rawName, totalOrders: 0, onTimeOrders: 0, vendorsCount: {}, prices: [], orders: [] };
            }
            productMap[key].totalOrders++;
            if (o.isOnTime) productMap[key].onTimeOrders++;
            const vName = (o.vendor || 'Unknown').trim();
            productMap[key].vendorsCount[vName] = (productMap[key].vendorsCount[vName] || 0) + 1;
            if (numVal > 0) productMap[key].prices.push(numVal);
            productMap[key].orders.push({ ...o, _cleanPrice: numVal });
        });

        let list = Object.values(productMap).map(p => {
            const vendorEntries = Object.entries(p.vendorsCount)
                .map(([vendor, count]) => ({ vendor, count, pct: Math.round((count / p.totalOrders) * 100) }))
                .sort((a, b) => b.count - a.count);

            const hasPrices = p.prices.length > 0;
            const minPrice = hasPrices ? Math.min(...p.prices) : 0;
            const maxPrice = hasPrices ? Math.max(...p.prices) : 0;
            let lastPrice = 0;
            for (let i = p.orders.length - 1; i >= 0; i--) {
                if (p.orders[i]._cleanPrice > 0) {
                    lastPrice = p.orders[i]._cleanPrice;
                    break;
                }
            }

            return {
                ...p,
                top3: vendorEntries.slice(0, 3),
                onTimePct: p.totalOrders > 0 ? Math.round((p.onTimeOrders / p.totalOrders) * 100) : 100,
                lastPrice,
                minPrice,
                maxPrice
            };
        });

        if (catalogSearchQuery) {
            list = list.filter(p => p.productName.toLowerCase().includes(catalogSearchQuery));
        }

        // Sorting
        if (catalogSortBy === 'name-asc') {
            list.sort((a, b) => a.productName.localeCompare(b.productName));
        } else if (catalogSortBy === 'price-desc') {
            list.sort((a, b) => (b.lastPrice || 0) - (a.lastPrice || 0) || b.totalOrders - a.totalOrders);
        } else if (catalogSortBy === 'price-asc') {
            list.sort((a, b) => (a.lastPrice || 0) - (b.lastPrice || 0) || b.totalOrders - a.totalOrders);
        } else if (catalogSortBy === 'ontime-desc') {
            list.sort((a, b) => b.onTimePct - a.onTimePct || b.totalOrders - a.totalOrders);
        } else {
            list.sort((a, b) => b.totalOrders - a.totalOrders);
        }

        if (list.length === 0) {
            showToast('Tidak ada data analisis katalog untuk diekspor.', 'warning');
            return;
        }

        const headers = ['No', 'Produk / Jasa', 'Total Pemesanan (PO)', 'Harga Terakhir (IDR)', 'Kisaran Terendah (IDR)', 'Kisaran Tertinggi (IDR)', 'Top Penyuplai #1', 'Penyuplai #2', 'Penyuplai #3', 'Ketepatan Waktu (%)'];
        const rows = list.map((item, idx) => {
            const v1 = item.top3[0] ? `${item.top3[0].vendor} (${item.top3[0].count} PO - ${item.top3[0].pct}%)` : '-';
            const v2 = item.top3[1] ? `${item.top3[1].vendor} (${item.top3[1].count} PO - ${item.top3[1].pct}%)` : '-';
            const v3 = item.top3[2] ? `${item.top3[2].vendor} (${item.top3[2].count} PO - ${item.top3[2].pct}%)` : '-';
            return [
                idx + 1,
                `"${item.productName.replace(/"/g, '""')}"`,
                item.totalOrders,
                item.lastPrice > 0 ? item.lastPrice : '-',
                item.minPrice > 0 ? item.minPrice : '-',
                item.maxPrice > 0 ? item.maxPrice : '-',
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

        const headers = ['No', 'No PO', 'Nama Produk / Jasa', 'Vendor', 'Nilai / Harga PO (IDR)', 'Tgl Expected', 'Tgl Realisasi', 'Status'];
        const rows = orders.map((o, idx) => {
            const rawVal = o._cleanPrice || o.nilai || 0;
            return [
                idx + 1,
                `"${(o.poNum || '').replace(/"/g, '""')}"`,
                `"${(o.product || '').replace(/"/g, '""')}"`,
                `"${(o.vendor || '').replace(/"/g, '""')}"`,
                rawVal > 0 ? rawVal : '-',
                `"${(o.expectedDate || '').replace(/"/g, '""')}"`,
                `"${(o.effectiveDate || '').replace(/"/g, '""')}"`,
                `"${(o.status || '').replace(/"/g, '""')}"`
            ];
        });

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
function formatRupiah(number) {
    if (!number || isNaN(number)) return 'Rp 0';
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(number);
}

function formatCompactRupiah(val) {
    if (!val || isNaN(val)) return '-';
    if (val >= 1000000000) {
        return `Rp ${(val / 1000000000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} M`;
    }
    if (val >= 1000000) {
        return `Rp ${(val / 1000000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt`;
    }
    if (val >= 1000) {
        return `Rp ${(val / 1000).toLocaleString('id-ID', { maximumFractionDigits: 0 })} rb`;
    }
    return `Rp ${val.toLocaleString('id-ID')}`;
}

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
