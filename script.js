// =====================================================
// KONFIGURASI
// =====================================================
// Ganti URL di bawah dengan URL Web App Google Apps Script Anda
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwQ5iOR9woaUkUMLodZl-SJ-8YhkXNTU2oEfv6fP4SuC_pliMWb1KWBOJ6SkMtdlAH0RQ/exec';

// Daftar vendor default (fallback offline)
const DEFAULT_VENDORS = [
    'MULTINDO MEDIA KREASI UTAMA, PT (Kreasi)',
    'CHIPSET COMPUTER - EKI',
    'CERIA PRODUKSI INDONESIA, PT',
    'VELOURA BESAR PERSADA, CV',
    'PT TELEKOMUNIKASI INDONESIA (Persero) TBK',
    'Toko HERO',
    'NAZLA STICKER CILACAP - TEGUH PRIHATIN',
    'ADA AJA PRINTING',
    'PT.GLOBAL JET EXPRESS',
    'INDRA EXPRESS',
    'DUA KOMUNIKASI INDONESIA, PT (Two Comm)',
    'SUKSES BERSAMA MAXI, CV',
    'QUADRA PURWOKERTO FH',
    'Chipset Computer - FHI',
    'AMIRA PRIMAL Arsyindo, CV',
    'Eka Surya Plaza',
    'PT. JAKARTA INTERNATIONAL EXPO',
    'Kina Berkah Mandiri, CV',
    'SAPB INDONESIA GROUP, PT - EKI',
    'QUADRA PURWOKERTO',
    'Onidel Pty Ltd',
    'PT Cloud Hosting Indonesia',
    'Shopee - FH',
    'KEDAI DIGITAL CUTTING',
    'PT UPALAKSANA PRIMA',
    'SOOCA BCKM Network, PT',
    'MAISA GORDEN (INDIVIDU)',
    'PERURI (Perusahaan Umum Percetakan Uang Republik Indonesia)',
    'PT SIEM LESTARI',
    'LANYARDKILAT',
    'Bass Comp Komputer Seluler',
    'Dekoruma Furniture & Interior Custom',
    'STARCOMP PURWOKERTO (STAR MEDIA COMPUTAMA, CV)',
    'Toko Berkah Cilacap',
    'Indocom',
    'Zakiyah (Rizky Abadi)',
    'KITA COMPUTER CILACAP - FHI',
    'Hero Housewares',
    'PT TRI LINE TEKNOLOGI',
    'PUTRA KITA, CV',
    'PITOYO HOME Catridge',
    'PT KAWAN LAMA SOLUSI',
    'PT. BHAKTI JAYA TRANS',
    'KONSULTAN DEVELOPER WACOS',
    'BHAKTI JAYA, CV',
    'RUPA-RUPA',
    'PT POS INDONESIA (JUANDA)',
    'AVARA BERKAH BERSAMA, PT',
    'CV JANGKRIK PRODUCTION',
    'CHIPSET COMPUTER - FH',
    'SEKAR PRINTING',
    'PRIVY IDENTITAS DIGITAL, PT',
    'SAPB INDONESIA GROUP, PT - EKI',
    'PT GERAK CEPAT INDONESIA FHI',
    'PT. CITRA MANDIRI NEGARA (PRINTHINK)',
    'BABY CLAIRE (INDIVIDU)',
    'MITRA SATU SOLUSINDO, PT - FH',
    'CV. GRIYA TEKNIKA',
    'NEO SHIRT(EKI)',
    'PT BAGIPAY SUKSES NOTORIBA',
    'MUH.HASIM (ARJUNA JATI)',
    'ZAQ ATK',
    'HARMONI JASA BERKARYA, PT (Galuna)',
    'PT BIZNET GIO NUSANTARA',
    'CV STUDIO MORFOREKA',
    'PT. DILLIA MITRA INDONESIA',
    'MK STORE FHI (SUGIYONO)',
    'HASHMICRO SOLUSI Indonesia, PT',
    'PT TEKNOLOGI CEKAT INDONESIA',
    'INTEGRA INOVASI Indonesia, PT',
    'Welding Zone Cilacap',
    'Tunas Wijaya Kusuma Digital Printing',
    'KREASI PERGI JAUH, PT (Grindboys)',
    'WE ARE SOCIAL INDONESIA, PT',
    'ARTOMI DAYA PAMUNGKAS, CV',
    'SAFIRO INTI LOGISTIC, PT',
    'Gedhe Jaya Indonesia, CV - FHI',
    'PT DINAMIKA RAYA PRIMA (Biznet Data Center)',
    'AGUNG SAPUTRA'
];

const AVATAR_COLORS = [
    '#10b981', '#3b82f6', '#8b5cf6', '#f59e0b',
    '#ef4444', '#ec4899', '#06b6d4', '#84cc16',
    '#f97316', '#6366f1', '#14b8a6', '#e11d48'
];

// PIN Default Contoh (Untuk pengujian offline / sebelum Apps Script terhubung)
const DEFAULT_PINS = {
    '1001': { nama: 'Andi', vendors: ['MULTINDO MEDIA KREASI UTAMA, PT (Kreasi)', 'VELOURA BESAR PERSADA, CV', 'Toko HERO'] },
    '1002': { nama: 'Budi', vendors: ['CHIPSET COMPUTER - EKI', 'QUADRA PURWOKERTO FH', 'PT BIZNET GIO NUSANTARA'] },
    '1003': { nama: 'Cici', vendors: ['PERURI (Perusahaan Umum Percetakan Uang Republik Indonesia)'] }
};

// =====================================================
// STATE
// =====================================================
let currentPin = '';
let currentAssessorName = '';
let userAssignedVendors = []; // Daftar vendor yang ditugaskan khusus untuk penilai ini
let vendors = []; // Array of string (nama vendor) yang ditampilkan saat ini
let allMasterVendors = [...DEFAULT_VENDORS];
let selectedVendor = null;
let selectedPeriode = ''; // Akan diisi dari data server (nama sheet di spreadsheet)

let serverPeriods = {}; // { 'Q2 2026': { vendors: [], poStats: {} }, ... }
let serverPeriodList = []; // ['Q2 2027', 'Q4 2026', 'Q3 2026', 'Q2 2026']
let scoreSummary = {}; // Ringkasan evaluasi dari server untuk cek lock per periode
let allRawOrders = []; // Seluruh daftar PO dari semua periode

let activeCategories = ['all'];
let viewMode = 'all'; // 'all' | 'pinned'
let ratings = {}; // Akan diisi dinamis berdasarkan kriteria aktif
let vendorCategoryMap = {}; // { 'Nama Vendor': 'it', ... }
let kriteriaList = []; // Diambil dari spreadsheet
let categoriesList = []; // Diambil dari spreadsheet
let poStats = { totalOrders: 0, totalOnTime: 0, overallOnTimePct: 0, vendorMap: {} };

const DEFAULT_KRITERIA = [
    { id: 'harga', kriteria: 'Harga', deskripsi: 'Kewajaran dan daya saing harga yang ditawarkan', kategori: 'all' },
    { id: 'pelayanan', kriteria: 'Pelayanan', deskripsi: 'Responsivitas, komunikasi, dan profesionalisme', kategori: 'all' },
    { id: 'ketepatanWaktu', kriteria: 'Ketepatan Waktu', deskripsi: 'Kemampuan menyelesaikan/mengirim sesuai jadwal', kategori: 'all' },
    { id: 'kualitasProdukIT', kriteria: 'Kualitas Produk IT', deskripsi: 'Kualitas hardware/software yang disediakan', kategori: 'it' },
    { id: 'dukunganTeknis', kriteria: 'Dukungan Teknis', deskripsi: 'Kecepatan dan kualitas dukungan teknis / after-sales', kategori: 'it' },
    { id: 'garansiPemeliharaan', kriteria: 'Garansi & Pemeliharaan', deskripsi: 'Cakupan garansi dan layanan pemeliharaan', kategori: 'it' },
    { id: 'keamananPengiriman', kriteria: 'Keamanan Pengiriman', deskripsi: 'Kondisi barang saat diterima (tidak rusak/hilang)', kategori: 'logistics' },
    { id: 'jangkauanArea', kriteria: 'Jangkauan Area', deskripsi: 'Kemampuan menjangkau area pengiriman yang dibutuhkan', kategori: 'logistics' },
    { id: 'ketepatanEstimasi', kriteria: 'Ketepatan Estimasi', deskripsi: 'Akurasi estimasi waktu pengiriman yang diberikan', kategori: 'logistics' },
    { id: 'kreativitasDesain', kriteria: 'Kreativitas Desain', deskripsi: 'Kualitas dan originalitas konsep desain', kategori: 'branding' },
    { id: 'kesesuaianBrief', kriteria: 'Kesesuaian Brief', deskripsi: 'Kemampuan memahami dan mengeksekusi brief klien', kategori: 'branding' },
    { id: 'revisiFleksibilitas', kriteria: 'Revisi & Fleksibilitas', deskripsi: 'Kesediaan dan kecepatan dalam melakukan revisi', kategori: 'branding' },
    { id: 'kualitasCetak', kriteria: 'Kualitas Cetak', deskripsi: 'Ketajaman warna, detail, dan kualitas bahan cetak', kategori: 'printing' },
    { id: 'kesesuaianSpek', kriteria: 'Kesesuaian Spesifikasi', deskripsi: 'Hasil cetak sesuai ukuran, bahan, dan finishing yang diminta', kategori: 'printing' },
    { id: 'kapasitasProduksi', kriteria: 'Kapasitas Produksi', deskripsi: 'Kemampuan menangani volume pesanan besar', kategori: 'printing' },
    { id: 'keahlianKompetensi', kriteria: 'Keahlian & Kompetensi', deskripsi: 'Tingkat keahlian dan pengalaman di bidangnya', kategori: 'consultant' },
    { id: 'kualitasLaporan', kriteria: 'Kualitas Laporan', deskripsi: 'Kelengkapan dan kejelasan laporan / deliverable', kategori: 'consultant' },
    { id: 'dampakHasil', kriteria: 'Dampak & Hasil', deskripsi: 'Efektivitas rekomendasi atau solusi yang diberikan', kategori: 'consultant' },
    { id: 'kualitasBarang', kriteria: 'Kualitas Barang', deskripsi: 'Kesesuaian produk dengan standar spesifikasi', kategori: 'general' },
    { id: 'kelengkapanPesanan', kriteria: 'Kelengkapan Pesanan', deskripsi: 'Ketepatan jumlah dan jenis barang yang dikirim', kategori: 'general' },
    { id: 'ketersediaanStok', kriteria: 'Ketersediaan Stok', deskripsi: 'Kemampuan menyediakan barang yang dibutuhkan', kategori: 'general' }
];

// =====================================================
// INIT
// =====================================================
document.addEventListener('DOMContentLoaded', () => {
    checkWelcome();
    initPeriodeChips();
    initFilterToggle();
    initCategoryChips();
    initForm();
    initModalClose();
    initHeaderUser();
    initSearch();
    updatePinnedCount();
});

// =====================================================
// PO ANALYTICS RENDER
// =====================================================
function updatePoInsightsBanner() {
    const totalEl = document.getElementById('statTotalPo');
    const pctEl = document.getElementById('statOnTimePct');
    const topEl = document.getElementById('statTopVendor');

    if (totalEl) totalEl.textContent = poStats.totalOrders ? `${poStats.totalOrders} PO` : '0 PO';
    if (pctEl) pctEl.textContent = poStats.overallOnTimePct ? `${poStats.overallOnTimePct}%` : '100%';

    if (topEl) {
        let bestVendor = 'Belum Ada Data';
        let maxPo = 0;
        for (let vName in poStats.vendorMap) {
            let v = poStats.vendorMap[vName];
            if (v.totalPo > maxPo && v.onTimeRatePct >= 90) {
                maxPo = v.totalPo;
                bestVendor = vName.split(' ')[0];
            }
        }
        topEl.textContent = bestVendor;
    }
}

// =====================================================
// WELCOME & PIN AUTHENTICATION
// =====================================================
function checkWelcome() {
    const savedPin = localStorage.getItem('ethos_pin');
    const savedName = localStorage.getItem('ethos_nama');
    const savedVendors = localStorage.getItem('ethos_user_vendors');
    const savedKriteria = localStorage.getItem('ethos_kriteria');
    const savedCategories = localStorage.getItem('ethos_categories');

    if (savedKriteria) {
        try { kriteriaList = JSON.parse(savedKriteria); } catch { kriteriaList = [...DEFAULT_KRITERIA]; }
    } else {
        kriteriaList = [...DEFAULT_KRITERIA];
    }

    if (savedCategories) {
        try { categoriesList = JSON.parse(savedCategories); } catch { categoriesList = []; }
    }

    renderCategoryChips(categoriesList.length > 0 ? categoriesList : DEFAULT_CATEGORIES);

    if (savedPin && savedName && savedVendors) {
        currentPin = savedPin;
        currentAssessorName = savedName;
        try {
            userAssignedVendors = JSON.parse(savedVendors);
            vendors = (currentPin === '9999' || currentPin === 'admin') ? [...allMasterVendors] : [...userAssignedVendors];
        } catch {
            userAssignedVendors = [];
            vendors = [];
        }
        updateHeaderUser(savedName, savedPin);
        renderVendorList();

        // Background fetch untuk sinkronisasi periode & PO stats terbaru dari server
        refreshPoStatsFromServer(savedPin);
    } else {
        showWelcome();
    }
}

/**
 * Ambil data periode, kriteria, kategori, dan PO stats terbaru dari server secara dinamis
 */
async function refreshPoStatsFromServer(pin) {
    if (SCRIPT_URL === 'PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE') return;

    try {
        const url = pin ? `${SCRIPT_URL}?pin=${encodeURIComponent(pin)}` : SCRIPT_URL;
        const res = await fetch(url);
        const data = await res.json();
        if (data.status === 'success') {
            if (data.allVendors && data.allVendors.length > 0) {
                allMasterVendors = data.allVendors.map(v => typeof v === 'object' ? v.nama : v);
            }

            // Update userAssignedVendors jika bukan admin
            if (pin !== '9999' && pin !== 'admin') {
                if (data.vendors && data.vendors.length > 0) {
                    userAssignedVendors = data.vendors.map(v => typeof v === 'object' ? v.nama : v.toString());
                    localStorage.setItem('ethos_user_vendors', JSON.stringify(userAssignedVendors));
                }
            } else {
                userAssignedVendors = [...allMasterVendors];
            }

            // 1. Simpan Score Summary dari server
            if (data.scoreSummary) {
                scoreSummary = data.scoreSummary;
            }

            // 2. Simpan Period Data dari server
            if (data.periods && data.periodList && data.periodList.length > 0) {
                serverPeriods = data.periods;
                serverPeriodList = data.periodList;

                if (Array.isArray(data.allRawOrders)) {
                    allRawOrders = data.allRawOrders;
                }

                if (pin !== '9999' && pin !== 'admin') {
                    selectedPeriode = getBestPeriodForUser(userAssignedVendors);
                }

                renderPeriodChips(serverPeriodList);
                switchPeriod(selectedPeriode);
            } else {
                switchPeriod(selectedPeriode);
            }

            // 3. Update kriteria dari server
            if (data.kriteria && data.kriteria.length > 0) {
                kriteriaList = data.kriteria;
                localStorage.setItem('ethos_kriteria', JSON.stringify(kriteriaList));
            }

            // 4. Update kategori dari server
            if (data.kategori && data.kategori.length > 0) {
                categoriesList = data.kategori;
                localStorage.setItem('ethos_categories', JSON.stringify(categoriesList));
                renderCategoryChips(categoriesList);
            }
        }
    } catch (err) {
        console.warn('Background data refresh gagal:', err);
    }
}

function showWelcome() {
    const overlay = document.getElementById('welcomeOverlay');
    overlay.classList.add('show');

    const input = document.getElementById('welcomePinInput');
    const btn = document.getElementById('welcomeSubmit');
    const errEl = document.getElementById('pinErrorMsg');

    input.value = '';
    errEl.style.display = 'none';

    btn.onclick = async () => {
        const pin = input.value.trim();
        if (!pin) {
            showPinError('Mohon masukkan Kode PIN Penilai Anda');
            return;
        }
        await processPinLogin(pin);
    };

    input.onkeydown = async (e) => {
        if (e.key === 'Enter') {
            const pin = input.value.trim();
            if (pin) await processPinLogin(pin);
        }
        errEl.style.display = 'none';
        input.style.borderColor = '';
    };
}

async function processPinLogin(pin) {
    const input = document.getElementById('welcomePinInput');
    const btn = document.getElementById('welcomeSubmit');
    const btnText = btn.querySelector('.btn-text');
    const spinner = btn.querySelector('.btn-spinner');
    const overlay = document.getElementById('welcomeOverlay');

    btn.disabled = true;
    btnText.textContent = 'Memeriksa PIN...';
    spinner.style.display = 'inline-block';

    let verifiedData = null;

    // Reset selectedPeriode agar periode tidak tersisa dari sesi sebelumnya
    selectedPeriode = '';

    if (SCRIPT_URL !== 'PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE') {
        try {
            const res = await fetch(`${SCRIPT_URL}?pin=${encodeURIComponent(pin)}`);
            const data = await res.json();
            if (data.status === 'success') {
                if (data.allVendors && data.allVendors.length > 0) {
                    allMasterVendors = data.allVendors.map(v => typeof v === 'object' ? v.nama : v);
                }

                currentPin = pin;
                currentAssessorName = data.namaPenilai || 'Penilai';

                if (pin === '9999' || pin === 'admin') {
                    userAssignedVendors = [...allMasterVendors];
                } else {
                    userAssignedVendors = (data.vendors || []).map(v => typeof v === 'object' ? v.nama : v);
                }

                if (data.scoreSummary) scoreSummary = data.scoreSummary;

                if (data.kriteria && data.kriteria.length > 0) {
                    kriteriaList = data.kriteria;
                    localStorage.setItem('ethos_kriteria', JSON.stringify(kriteriaList));
                }

                if (data.kategori && data.kategori.length > 0) {
                    categoriesList = data.kategori;
                    localStorage.setItem('ethos_categories', JSON.stringify(categoriesList));
                    renderCategoryChips(categoriesList);
                }

                if (data.periods && data.periodList && data.periodList.length > 0) {
                    serverPeriods = data.periods;
                    serverPeriodList = data.periodList;
                }

                if (Array.isArray(data.allRawOrders)) {
                    allRawOrders = data.allRawOrders;
                }

                if (pin === '9999' || pin === 'admin') {
                    selectedPeriode = serverPeriodList.length > 0 ? serverPeriodList[0] : '';
                } else {
                    selectedPeriode = getBestPeriodForUser(userAssignedVendors);
                }
                renderPeriodChips(serverPeriodList);

                verifiedData = {
                    pin: pin,
                    nama: currentAssessorName,
                    vendors: userAssignedVendors
                };
            } else if (data.status === 'error') {
                if (pin !== 'admin' && pin !== '9999') {
                    showPinError(data.message || 'Kode PIN tidak terdaftar di Google Spreadsheet.');
                    resetPinBtn(btn, btnText, spinner);
                    return;
                }
            }
        } catch (err) {
            console.warn('Gagal hubungi Apps Script, mencoba fallback offline PIN...', err);
        }
    }

    // Fallback jika Apps Script offline / mode demo
    if (!verifiedData) {
        if (DEFAULT_PINS[pin]) {
            verifiedData = {
                pin: pin,
                nama: DEFAULT_PINS[pin].nama,
                vendors: DEFAULT_PINS[pin].vendors
            };
        } else if (pin === 'admin' || pin === '9999') {
            verifiedData = {
                pin: pin,
                nama: 'Administrator',
                vendors: allMasterVendors
            };
        }
    }

    if (verifiedData) {
        currentPin = verifiedData.pin;
        currentAssessorName = verifiedData.nama;
        userAssignedVendors = verifiedData.vendors;

        localStorage.setItem('ethos_pin', currentPin);
        localStorage.setItem('ethos_nama', currentAssessorName);
        localStorage.setItem('ethos_user_vendors', JSON.stringify(userAssignedVendors));

        updateHeaderUser(currentAssessorName, currentPin);

        // Sembunyikan overlay paksa dengan inline style (bukan hanya class)
        overlay.classList.remove('show');
        overlay.style.display = 'none';
        overlay.style.opacity = '0';
        overlay.style.visibility = 'hidden';
        overlay.style.pointerEvents = 'none';

        switchPeriod(selectedPeriode);
    } else {
        showPinError(`PIN "${pin}" tidak terdaftar. Masukkan PIN yang valid (Contoh PIN Demo: 1001, 1002, 1003).`);
    }

    resetPinBtn(btn, btnText, spinner);
}

function showPinError(msg) {
    const errEl = document.getElementById('pinErrorMsg');
    const input = document.getElementById('welcomePinInput');
    if (errEl) {
        errEl.textContent = msg;
        errEl.style.display = 'block';
    }
    if (input) {
        input.style.borderColor = '#ef4444';
        input.focus();
    }
}

function resetPinBtn(btn, text, spinner) {
    btn.disabled = false;
    text.textContent = 'Masuk & Verifikasi PIN';
    spinner.style.display = 'none';
}

function updateHeaderUser(name, pin) {
    const el = document.getElementById('headerUser');
    if (el) el.textContent = `👤 ${name} (PIN: ${pin || '–'})`;

    updateRoleBasedView(pin);
}

/**
 * Kontrol tampilan berbasis role / PIN:
 * - Admin (PIN 9999): Tampilkan KPI Cards (poInsightsBanner), Filter Panel (filterControlsCard), dan Link Dashboard
 * - Penilai Biasa (Selain 9999): Sembunyikan semuanya, hanya tampilkan daftar vendor yang harus dinilai
 */
function updateRoleBasedView(pin) {
    const isAdmin = (pin === '9999' || pin === 'admin');

    const poBanner = document.getElementById('poInsightsBanner');
    if (poBanner) {
        poBanner.style.display = isAdmin ? 'grid' : 'none';
    }

    const filterCard = document.getElementById('filterControlsCard');
    if (filterCard) {
        filterCard.style.display = isAdmin ? 'block' : 'none';
    }

    const dashLink = document.getElementById('dashboardNavLink');
    if (dashLink) {
        dashLink.style.display = isAdmin ? 'inline-flex' : 'none';
    }
}

function doLogout() {
    // Hapus semua data sesi dari localStorage
    localStorage.removeItem('ethos_pin');
    localStorage.removeItem('ethos_nama');
    localStorage.removeItem('ethos_user_vendors');

    // Reset semua variabel global sesi
    currentPin = '';
    currentAssessorName = '';
    userAssignedVendors = [];
    vendors = [];
    scoreSummary = {};
    allRawOrders = [];
    serverPeriods = {};
    serverPeriodList = [];
    selectedPeriode = '';
    activeCategories = ['all'];
    viewMode = 'all';
    poStats = { totalOrders: 0, totalOnTime: 0, overallOnTimePct: 0, vendorMap: {} };
    allMasterVendors = [...DEFAULT_VENDORS];

    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = '';

    // Tampilkan PIN overlay
    const overlay = document.getElementById('welcomeOverlay');
    if (overlay) {
        overlay.classList.add('show');
        overlay.style.display = 'flex';
        overlay.style.opacity = '1';
        overlay.style.visibility = 'visible';
        overlay.style.pointerEvents = 'auto';
    }

    // Reset input PIN
    const input = document.getElementById('welcomePinInput');
    if (input) {
        input.value = '';
        setTimeout(() => input.focus(), 100);
    }
    const errEl = document.getElementById('pinErrorMsg');
    if (errEl) errEl.style.display = 'none';
}

function initHeaderUser() {
    // Tetap dukung klik pada headerUser untuk backward compatibility
    const el = document.getElementById('headerUser');
    if (el) {
        el.style.cursor = 'default';
    }
}

// =====================================================
// CATEGORY CHIPS (Multi-Select Supported)
// =====================================================
const DEFAULT_CATEGORIES = [
    { kode: 'it', nama: 'IT & Komputer', ikon: '💻' },
    { kode: 'logistics', nama: 'Ekspedisi & Logistik', ikon: '🚚' },
    { kode: 'branding', nama: 'Branding & Marketing', ikon: '📣' },
    { kode: 'printing', nama: 'Percetakan & Custom', ikon: '🖨️' },
    { kode: 'consultant', nama: 'Konsultan & Services', ikon: '💼' },
    { kode: 'general', nama: 'General & ATK', ikon: '📦' }
];

function initCategoryChips() {
    renderCategoryChips(categoriesList.length > 0 ? categoriesList : DEFAULT_CATEGORIES);
}

function renderCategoryChips(categories) {
    const container = document.getElementById('categoryChips');
    if (!container) return;

    let html = `<button class="cat-chip ${activeCategories.includes('all') ? 'active' : ''}" data-cat="all">Semua Bidang</button>`;
    
    categories.forEach(cat => {
        const isActive = activeCategories.includes(cat.kode);
        const icon = cat.ikon || '📦';
        html += `<button class="cat-chip ${isActive ? 'active' : ''}" data-cat="${esc(cat.kode)}">${esc(icon)} ${esc(cat.nama)}</button>`;
    });

    container.innerHTML = html;

    container.querySelectorAll('.cat-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const cat = chip.dataset.cat;

            if (cat === 'all') {
                activeCategories = ['all'];
                container.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
            } else {
                activeCategories = activeCategories.filter(c => c !== 'all');
                
                if (activeCategories.includes(cat)) {
                    activeCategories = activeCategories.filter(c => c !== cat);
                } else {
                    activeCategories.push(cat);
                }

                if (activeCategories.length === 0) {
                    activeCategories = ['all'];
                }

                container.querySelector('[data-cat="all"]').classList.toggle('active', activeCategories.includes('all'));
                chip.classList.toggle('active', activeCategories.includes(cat));
            }

            renderVendorList();
        });
    });
}

// =====================================================
// FILTER TOGGLE (Semua Vendor vs Vendorku)
// =====================================================
function initFilterToggle() {
    const btnAll = document.getElementById('btnFilterAll');
    const btnPinned = document.getElementById('btnFilterPinned');

    if (btnAll && btnPinned) {
        btnAll.addEventListener('click', () => {
            viewMode = 'all';
            btnAll.classList.add('active');
            btnPinned.classList.remove('active');
            renderVendorList();
        });

        btnPinned.addEventListener('click', () => {
            viewMode = 'pinned';
            btnPinned.classList.add('active');
            btnAll.classList.remove('active');
            renderVendorList();
        });
    }
}

// =====================================================
// PINNED / FAVORITE VENDORS (localStorage)
// =====================================================
function getPinnedVendors() {
    try { return JSON.parse(localStorage.getItem('ethos_pinned') || '[]'); }
    catch { return []; }
}

function togglePinVendor(vendorName) {
    let pinned = getPinnedVendors();
    if (pinned.includes(vendorName)) {
        pinned = pinned.filter(v => v !== vendorName);
    } else {
        pinned.push(vendorName);
    }
    localStorage.setItem('ethos_pinned', JSON.stringify(pinned));
    updatePinnedCount();
    renderVendorList();
}

function updatePinnedCount() {
    const el = document.getElementById('pinnedCount');
    if (el) el.textContent = getPinnedVendors().length;
}

// =====================================================
// SEARCH
// =====================================================
function initSearch() {
    const input = document.getElementById('searchInput');
    if (!input) return;

    input.addEventListener('input', () => {
        const q = input.value.trim().toLowerCase();
        const filtered = vendors.filter(v => v.toLowerCase().includes(q));
        renderVendorList(filtered);
    });
}

// =====================================================
// PERIODE CHIPS (DINAMIS DARI SHEET DI SPREADSHEET)
// =====================================================
function initPeriodeChips() {
    // Awalnya tampilkan loading, akan di-render ulang setelah data server masuk
    const container = document.getElementById('periodeChips');
    if (!container) return;
    container.innerHTML = `<span style="color:#6b7280; font-size:0.85rem;">⏳ Memuat periode...</span>`;
}

function renderPeriodChips(periodList) {
    const container = document.getElementById('periodeChips');
    if (!container) return;

    // Gunakan langsung periodList dari server (nama sheet di spreadsheet)
    const list = Array.isArray(periodList) ? periodList : [];

    if (list.length === 0) {
        container.innerHTML = `<span style="color:#ef4444; font-size:0.85rem;">⚠️ Tidak ada sheet periode di spreadsheet</span>`;
        return;
    }

    // Jika selectedPeriode belum di-set atau tidak ada di list, gunakan yang pertama
    if (!selectedPeriode || !list.includes(selectedPeriode)) {
        selectedPeriode = list[0];
    }

    container.innerHTML = `
        <select id="periodeSelect" class="tremor-select font-semibold text-sm text-blue-900 bg-blue-50/60 border-blue-200 hover:border-blue-400 focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-sm py-2 px-3.5 pr-8 rounded-lg transition" title="Pilih Periode Penilaian">
            ${list.map(p => `<option value="${esc(p)}"${p === selectedPeriode ? ' selected' : ''}>📅 ${esc(p)}</option>`).join('')}
        </select>
    `;

    const selectEl = document.getElementById('periodeSelect');
    if (selectEl) {
        selectEl.addEventListener('change', (e) => {
            switchPeriod(e.target.value);
        });
    }
}

/**
 * Berpindah periode: secara instan memuat vendor & PO stats dari sheet periode tersebut
 */
function switchPeriod(periodId) {
    selectedPeriode = periodId;

    const selectEl = document.getElementById('periodeSelect');
    if (selectEl && selectEl.value !== periodId) {
        selectEl.value = periodId;
    }

    if (serverPeriods && serverPeriods[periodId] && serverPeriods[periodId].poStats) {
        poStats = serverPeriods[periodId].poStats;
    } else {
        poStats = { totalOrders: 0, totalOnTime: 0, overallOnTimePct: 0, vendorMap: {} };
    }

    if (currentPin === '9999' || currentPin === 'admin') {
        const pVendors = (serverPeriods && serverPeriods[periodId] && serverPeriods[periodId].vendors && serverPeriods[periodId].vendors.length > 0)
            ? serverPeriods[periodId].vendors
            : (allMasterVendors.length > 0 ? allMasterVendors : DEFAULT_VENDORS);
        processVendorData(pVendors);
    } else {
        // Penilai biasa HANYA melihat vendor yang ditugaskan kepada mereka!
        processVendorData(userAssignedVendors);
    }

    updatePoInsightsBanner();
    renderVendorList();
}

// =====================================================
// PO STATS & VENDOR RESOLUTION HELPERS
// =====================================================

/**
 * Mencocokkan nama vendor secara cerdas:
 * Mengabaikan perbedaan variasi PT / PT. / CV / CV. / spasi / kapital / tanda baca
 */
function isSameVendor(n1, n2) {
    if (!n1 || !n2) return false;
    const s1 = n1.toString().toLowerCase().trim();
    const s2 = n2.toString().toLowerCase().trim();
    if (s1 === s2) return true;
    if (s1.includes(s2) || s2.includes(s1)) return true;
    const clean = s => s.replace(/^(pt\.|pt|cv\.|cv|ud\.|ud|toko)\s+/i, '').replace(/[^a-z0-9]/g, '');
    const c1 = clean(s1);
    const c2 = clean(s2);
    return c1.length > 2 && c2.length > 2 && (c1 === c2 || c1.includes(c2) || c2.includes(c1));
}

/**
 * Mengambil seluruh PO yang dimiliki suatu vendor:
 * 1. Pertama cek di periode aktif (selectedPeriode)
 * 2. Jika tidak ada, cari di seluruh periode yang ada (misal Q3 2026, Q2 2026, dll.)
 * 3. Jika masih tidak ada, cari di allRawOrders & vendorMap
 */
function getAllOrdersForVendor(vendorName) {
    if (!vendorName) return { orders: [], period: selectedPeriode };

    let foundOrders = [];
    let detectedPeriod = selectedPeriode;

    // 1. Cek periode aktif terlebih dahulu
    if (serverPeriods && serverPeriods[selectedPeriode]) {
        const cur = serverPeriods[selectedPeriode];
        if (cur.rawOrders && cur.rawOrders.length > 0) {
            foundOrders = cur.rawOrders.filter(o => isSameVendor(o.vendor, vendorName));
        }
        if (foundOrders.length === 0 && cur.poStats && cur.poStats.vendorMap) {
            for (let k in cur.poStats.vendorMap) {
                if (isSameVendor(k, vendorName)) {
                    foundOrders = cur.poStats.vendorMap[k].recentOrders || [];
                    break;
                }
            }
        }
    }

    // 2. Jika tidak ada di periode aktif, cari di seluruh periode lain (seperti Q3 2026, Q4 2026, Q2 2026)
    if (foundOrders.length === 0 && serverPeriods) {
        for (let pKey in serverPeriods) {
            if (pKey === selectedPeriode) continue;
            const pObj = serverPeriods[pKey];
            let pOrders = [];
            if (pObj.rawOrders && pObj.rawOrders.length > 0) {
                pOrders = pObj.rawOrders.filter(o => isSameVendor(o.vendor, vendorName));
            }
            if (pOrders.length === 0 && pObj.poStats && pObj.poStats.vendorMap) {
                for (let k in pObj.poStats.vendorMap) {
                    if (isSameVendor(k, vendorName)) {
                        pOrders = pObj.poStats.vendorMap[k].recentOrders || [];
                        break;
                    }
                }
            }
            if (pOrders.length > 0) {
                foundOrders = pOrders;
                detectedPeriod = pKey;
                break;
            }
        }
    }

    // 3. Cek di allRawOrders jika ada
    if (foundOrders.length === 0 && Array.isArray(allRawOrders) && allRawOrders.length > 0) {
        foundOrders = allRawOrders.filter(o => isSameVendor(o.vendor, vendorName));
    }

    // 4. Fallback ke global poStats
    if (foundOrders.length === 0 && poStats && poStats.vendorMap) {
        for (let k in poStats.vendorMap) {
            if (isSameVendor(k, vendorName)) {
                foundOrders = poStats.vendorMap[k].recentOrders || [];
                break;
            }
        }
    }

    return { orders: foundOrders, period: detectedPeriod };
}

/**
 * Menemukan periode paling relevan untuk daftar vendor yang ditugaskan kepada penilai
 */
function getBestPeriodForUser(assignedVendors) {
    if (!serverPeriods || !assignedVendors || assignedVendors.length === 0) {
        return (serverPeriodList && serverPeriodList.length > 0) ? serverPeriodList[0] : 'Q3 2026';
    }

    let bestP = null;
    let maxMatch = 0;

    for (let pKey of (serverPeriodList || [])) {
        const pObj = serverPeriods[pKey];
        if (!pObj) continue;

        let matchCount = 0;
        if (pObj.rawOrders && pObj.rawOrders.length > 0) {
            matchCount = pObj.rawOrders.filter(o => assignedVendors.some(v => isSameVendor(v, o.vendor))).length;
        } else if (pObj.poStats && pObj.poStats.vendorMap) {
            for (let vKey in pObj.poStats.vendorMap) {
                if (assignedVendors.some(v => isSameVendor(v, vKey))) {
                    matchCount += (pObj.poStats.vendorMap[vKey].totalPo || 1);
                }
            }
        }

        if (matchCount > maxMatch) {
            maxMatch = matchCount;
            bestP = pKey;
        }
    }

    if (maxMatch > 0 && bestP) return bestP;
    return (serverPeriodList && serverPeriodList.includes('Q3 2026')) ? 'Q3 2026' : (serverPeriodList[0] || 'Q3 2026');
}

function getVendorPoStats(vName) {
    if (!vName) return null;

    // 1. Cek poStats periode saat ini
    if (poStats && poStats.vendorMap) {
        for (let k in poStats.vendorMap) {
            if (isSameVendor(k, vName)) return poStats.vendorMap[k];
        }
    }

    // 2. Cek di seluruh serverPeriods
    if (serverPeriods) {
        for (let pKey in serverPeriods) {
            const pObj = serverPeriods[pKey];
            if (pObj && pObj.poStats && pObj.poStats.vendorMap) {
                for (let k in pObj.poStats.vendorMap) {
                    if (isSameVendor(k, vName)) return pObj.poStats.vendorMap[k];
                }
            }
        }
    }

    return null;
}

// =====================================================
// RENDER VENDOR LIST
// =====================================================
function renderVendorList(overrideList = null) {
    const list = document.getElementById('vendorList');
    const countEl = document.getElementById('vendorCount');
    if (!list) return;

    let displayVendors = overrideList;

    if (!displayVendors) {
        let baseList = vendors;

        // Filter Pinned / Vendorku jika viewMode === 'pinned'
        if (viewMode === 'pinned') {
            const pinned = getPinnedVendors();
            baseList = vendors.filter(v => pinned.includes(v));
        }

        // Filter berdasarkan Bidang / Kategori (multi-select)
        if (!activeCategories.includes('all')) {
            baseList = baseList.filter(v => {
                const vCat = getVendorCategory(v);
                return activeCategories.includes(vCat);
            });
        }

        displayVendors = baseList;
    }

    // Filter pencarian jika ada di input search
    const searchVal = document.getElementById('searchInput')?.value.trim().toLowerCase();
    if (searchVal && !overrideList) {
        displayVendors = displayVendors.filter(v => v.toLowerCase().includes(searchVal));
    }

    if (countEl) {
        countEl.textContent = `${displayVendors.length} vendor ${viewMode === 'pinned' ? '(Vendorku)' : ''}`;
    }

    if (displayVendors.length === 0) {
        const isAdm = currentPin === '9999' || currentPin === 'admin';
        list.innerHTML = `
        <div style="grid-column: 1 / -1; text-align:center; padding:3rem 1.5rem; background:#fff; border:1px dashed #e5e7eb; border-radius:0.75rem; color:#6b7280;">
            <div style="font-size:2rem; margin-bottom:0.5rem;">📋</div>
            <div style="font-weight:700; color:#111827; margin-bottom:0.25rem;">${isAdm ? 'Tidak Ada Vendor pada Periode "' + esc(selectedPeriode) + '"' : 'Belum Ada Vendor Ditugaskan'}</div>
            <div style="font-size:0.85rem; color:#6b7280;">
                ${viewMode === 'pinned' ? 'Anda belum menyematkan vendor favorit.' : (isAdm ? 'Tidak ada catatan PO untuk vendor pada periode ini, atau belum cocok dengan filter pencarian.' : 'Belum ada vendor yang ditugaskan untuk PIN Penilai Anda di sheet "Akses Penilai", atau belum cocok dengan filter.')}
            </div>
            ${viewMode === 'pinned' ? '<button class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 shadow-sm mt-3" onclick="document.getElementById(\'btnFilterAll\').click()">🌐 Lihat Semua Vendorku</button>' : ''}
        </div>`;
        return;
    }

    const assessed = getAssessedVendorsForPeriod(selectedPeriode);
    const pinned = getPinnedVendors();
    const isAdmin = currentPin === '9999' || currentPin === 'admin';

    list.innerHTML = displayVendors.map((v, i) => {
        const originalIndex = vendors.indexOf(v);
        const done = assessed.includes(v);
        const isPinned = pinned.includes(v);
        const color = AVATAR_COLORS[(originalIndex >= 0 ? originalIndex : i) % AVATAR_COLORS.length];
        const vNameStr = (v || '').toString();
        const initials = vNameStr.split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'VN';
        const vOrdersInfo = getAllOrdersForVendor(v);
        const vOrders = vOrdersInfo.orders;
        const itemPreview = vOrders.length > 0 ? vOrders.map(o => o.product).filter(Boolean).slice(0, 2).join(', ') : '';

        const rowStyle = done && !isAdmin ? 'style="opacity: 0.65; cursor: not-allowed;"' : '';

        return `
        <div class="vendor-row ${done ? 'locked' : ''}" data-vendor="${esc(v)}" ${rowStyle}>
            <button class="vendor-pin-btn ${isPinned ? 'pinned' : ''}" data-pin="${esc(v)}" title="${isPinned ? 'Hapus dari Vendorku' : 'Sematkan ke Vendorku'}">
                ${isPinned ? '📌' : '📍'}
            </button>
            <div class="vendor-avatar" style="background:${color}12;color:${color};border:1px solid ${color}25;">${initials}</div>
            <div style="flex: 1; min-width: 0; display: flex; flex-direction: column;">
                <span class="vendor-name">${esc(v)}</span>
                ${itemPreview ? `<span style="font-size: 0.75rem; color: #2563eb; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">📦 ${esc(itemPreview)}${vOrders.length > 2 ? ` (+${vOrders.length - 2} lainnya)` : ''}</span>` : ''}
            </div>
            ${done ? '<span class="vendor-badge-done" style="background: rgba(16,185,129,0.15); color: #10b981; border: 1px solid rgba(16,185,129,0.3);">🔒 Dinilai (Terkunci)</span>' : ''}
            ${done && isAdmin ? `<button class="vendor-unlock-btn" data-unlock="${esc(v)}" title="Buka Kunci Penilaian Periode Ini (Admin Only)" style="background:none; border:none; cursor:pointer; font-size:1.1rem; padding: 4px; margin-left: 8px;">🔓</button>` : ''}
            ${done ? '' : '<span class="vendor-arrow">›</span>'}
        </div>`;
    }).join('');

    // Attach row click (modal open)
    list.querySelectorAll('.vendor-row').forEach(row => {
        row.addEventListener('click', (e) => {
            if (e.target.closest('.vendor-pin-btn') || e.target.closest('.vendor-unlock-btn')) return;
            
            if (row.classList.contains('locked') && !isAdmin) {
                showToast(`Vendor ini sudah dinilai pada periode ${selectedPeriode} dan terkunci.`, 'info');
                return;
            }
            openModal(row.dataset.vendor);
        });
    });

    // Attach pin button click
    list.querySelectorAll('.vendor-pin-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            togglePinVendor(btn.dataset.pin);
        });
    });

    // Attach unlock button click (Admin Only)
    list.querySelectorAll('.vendor-unlock-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const vendor = btn.dataset.unlock;
            if (confirm(`Buka kunci penilaian untuk "${vendor}" pada periode ${selectedPeriode}?`)) {
                unlockVendor(vendor);
            }
        });
    });
}

/**
 * Cek apakah vendor sudah dinilai pada periode tertentu
 */
function getAssessedVendorsForPeriod(period) {
    const assessedSet = new Set();

    // 1. Dari server scoreSummary
    if (scoreSummary) {
        for (let vName in scoreSummary) {
            const vData = scoreSummary[vName];
            if (vData && Array.isArray(vData.periodeScores)) {
                if (vData.periodeScores.some(p => p.periode === period)) {
                    assessedSet.add(vName);
                }
            }
        }
    }

    // 2. Dari localStorage per-periode
    try {
        const localList = JSON.parse(localStorage.getItem(`ethos_assessed_${period}`) || '[]');
        localList.forEach(v => assessedSet.add(v));
    } catch (e) {}

    return Array.from(assessedSet);
}

function saveAssessedForPeriod(vendorName, period) {
    let localList = [];
    try {
        localList = JSON.parse(localStorage.getItem(`ethos_assessed_${period}`) || '[]');
    } catch (e) {}

    if (!localList.includes(vendorName)) {
        localList.push(vendorName);
        localStorage.setItem(`ethos_assessed_${period}`, JSON.stringify(localList));
    }

    // Update in-memory scoreSummary
    if (!scoreSummary[vendorName]) {
        scoreSummary[vendorName] = { periodeScores: [] };
    }
    if (!scoreSummary[vendorName].periodeScores) {
        scoreSummary[vendorName].periodeScores = [];
    }
    scoreSummary[vendorName].periodeScores.push({ periode: period, score: 5, predikat: 'Baik' });
}

function unlockVendor(vendorName) {
    let localList = [];
    try {
        localList = JSON.parse(localStorage.getItem(`ethos_assessed_${selectedPeriode}`) || '[]');
    } catch (e) {}

    localList = localList.filter(v => v !== vendorName);
    localStorage.setItem(`ethos_assessed_${selectedPeriode}`, JSON.stringify(localList));

    if (scoreSummary[vendorName] && scoreSummary[vendorName].periodeScores) {
        scoreSummary[vendorName].periodeScores = scoreSummary[vendorName].periodeScores.filter(p => p.periode !== selectedPeriode);
    }

    showToast(`Kunci penilaian untuk "${vendorName}" pada periode ${selectedPeriode} berhasil dibuka.`, 'success');
    renderVendorList();
}

function esc(str) {
    if (str === undefined || str === null) return '';
    const d = document.createElement('div');
    d.textContent = str.toString();
    return d.innerHTML;
}

// =====================================================
// MODAL & PO INSIGHTS INTEGRATION
// =====================================================
function openModal(vendorName) {
    if (!vendorName) return;

    selectedVendor = vendorName;

    const modalEl = document.getElementById('modalBg');
    if (!modalEl) {
        console.error('modalBg element not found!');
        return;
    }

    try {
        resetForm();
    } catch (e) {
        console.warn('resetForm error:', e);
    }

    // Deteksi PO dan periode yang cocok untuk vendor ini
    const poInfo = getAllOrdersForVendor(vendorName);
    if (poInfo.period && poInfo.period !== selectedPeriode) {
        selectedPeriode = poInfo.period;
    }

    const titleEl = document.getElementById('modalVendorName');
    if (titleEl) titleEl.textContent = vendorName;

    const badgeEl = document.getElementById('modalPeriodBadge');
    if (badgeEl && selectedPeriode) {
        badgeEl.textContent = `• Periode ${selectedPeriode}`;
    }

    // Render form dinamis berdasarkan kriteria & kategori vendor
    try {
        renderDynamicForm(vendorName);
    } catch (e) {
        console.error('renderDynamicForm error:', e);
    }

    // Auto-suggest rating ketepatan waktu jika vendor memiliki PO stats dan kriterianya aktif
    try {
        const vStats = getVendorPoStats(vendorName);
        if (vStats && vStats.totalPo > 0 && ratings && 'ketepatanWaktu' in ratings) {
            let suggestVal = 2;
            if (vStats.onTimeRatePct >= 90) suggestVal = 5;
            else if (vStats.onTimeRatePct >= 75) suggestVal = 4;
            else if (vStats.onTimeRatePct >= 50) suggestVal = 3;
            autoSuggestRating('ketepatanWaktu', suggestVal);
        }
    } catch (e) {
        console.warn('autoSuggest error:', e);
    }

    // Render panel ringkasan PO vendor pada periode ini
    try {
        renderVendorPoPanel(vendorName);
    } catch (e) {
        console.warn('renderVendorPoPanel error:', e);
    }

    // Tampilkan modal
    modalEl.classList.add('show');
    modalEl.style.display = 'flex';
    modalEl.style.opacity = '1';
    modalEl.style.visibility = 'visible';
    modalEl.style.pointerEvents = 'auto';
    document.body.style.overflow = 'hidden';
}

/**
 * Render daftar item PO (BarangJasa) vendor pada periode yang dipilih
 * di panel atas modal, agar penilai tahu apa yang disuplai vendor.
 */
function renderVendorPoPanel(vendorName) {
    const panel = document.getElementById('vendorPoPanel');
    const body = document.getElementById('vendorPoBody');
    const countEl = document.getElementById('vendorPoCount');
    const titleEl = document.getElementById('vendorPoTitle');
    if (!panel || !body) return;

    const poInfo = getAllOrdersForVendor(vendorName);
    const allOrders = poInfo.orders;

    if (!allOrders || allOrders.length === 0) {
        panel.style.display = 'none';
        return;
    }

    panel.style.display = 'block';
    if (titleEl) {
        titleEl.textContent = `📦 Riwayat PO (${poInfo.period || selectedPeriode})`;
    }
    if (countEl) {
        countEl.textContent = `${allOrders.length} PO`;
    }

    body.innerHTML = allOrders.map(o => {
        const isOnTime = o.isOnTime;
        const statusColor = isOnTime ? '#10b981' : (o.status && o.status.includes('Terlambat') ? '#ef4444' : '#f59e0b');
        const statusBg = isOnTime ? '#ecfdf5' : (o.status && o.status.includes('Terlambat') ? '#fef2f2' : '#fffbeb');
        return `
        <tr class="border-b border-blue-50 hover:bg-blue-50/50">
            <td class="px-3 py-2 font-mono font-semibold text-blue-700 whitespace-nowrap">${esc(o.poNum || '-')}</td>
            <td class="px-3 py-2 text-gray-800 font-medium max-w-[200px]">${esc(o.product || 'Barang/Jasa')}</td>
            <td class="px-3 py-2 text-right text-gray-500 whitespace-nowrap">${esc(o.expectedDate || '-')}</td>
            <td class="px-3 py-2 text-right text-gray-500 whitespace-nowrap">${esc(o.effectiveDate || 'Belum Diterima')}</td>
            <td class="px-3 py-2 text-center">
                <span style="background:${statusBg}; color:${statusColor}; border:1px solid ${statusColor}30; font-size:0.65rem; font-weight:700; padding:2px 7px; border-radius:999px; white-space:nowrap; display:inline-block;">
                    ${esc(o.status || '-')}
                </span>
            </td>
        </tr>`;
    }).join('');
}

function getVendorCategory(vendorName) {
    if (vendorCategoryMap[vendorName]) {
        return vendorCategoryMap[vendorName];
    }
    const nameLower = vendorName.toLowerCase();
    for (let key in vendorCategoryMap) {
        if (key.toLowerCase() === nameLower) return vendorCategoryMap[key];
    }
    return 'general';
}

function processVendorData(vendorData) {
    if (!Array.isArray(vendorData) || vendorData.length === 0) return;

    if (typeof vendorData[0] === 'object' && vendorData[0].nama) {
        vendors = vendorData.map(v => v.nama);
        vendorData.forEach(v => {
            if (v.nama && v.kategori) {
                vendorCategoryMap[v.nama] = v.kategori;
            }
        });
    } else {
        vendors = vendorData.map(v => typeof v === 'string' ? v : v.toString());
    }
}

function renderDynamicForm(vendorName) {
    const container = document.getElementById('questionsContainer');
    if (!container) return;

    const rawVendorCat = getVendorCategory(vendorName) || 'general';
    const normVendorCat = rawVendorCat.toLowerCase().replace(/[^a-z0-9]/g, '');

    // Gunakan kriteriaList dari server atau fallback ke DEFAULT_KRITERIA
    const activePool = (kriteriaList && kriteriaList.length > 0) ? kriteriaList : DEFAULT_KRITERIA;

    // Filter kriteria:
    // 1. Pertanyaan UMUM (berlaku untuk semua vendor)
    // 2. Pertanyaan kategori yang cocok dengan vendor (IT, EKSPEDISI, BRANDING, PERCETAKAN, KONSULTAN, BARANG_JASA, dll.)
    // 3. Pertanyaan vendor spesifik jika nama cocok
    let matchedKriteria = activePool.filter(k => {
        if (k.vendorSpesifik && k.vendorSpesifik.trim() !== '') {
            return k.vendorSpesifik.toLowerCase().trim() === vendorName.toLowerCase().trim();
        }

        const kCat = (k.kategori || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (kCat === 'umum' || kCat === 'all' || kCat === 'semua' || kCat === '') {
            return true;
        }

        if (normVendorCat && (normVendorCat === kCat || normVendorCat.includes(kCat) || kCat.includes(normVendorCat))) {
            return true;
        }

        return false;
    });

    // Fallback: Jika hanya pertanyaan umum (<= 3 pertanyaan), tambahkan pertanyaan spesifik BARANG JASA / General
    // agar penilai memiliki minimal 5-6 kriteria evaluasi lengkap
    if (matchedKriteria.length <= 3) {
        const generalExtras = activePool.filter(k => {
            const kCat = (k.kategori || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            return kCat === 'barangjasa' || kCat === 'general' || kCat === 'barang';
        });
        generalExtras.forEach(ge => {
            if (!matchedKriteria.some(m => m.id === ge.id)) {
                matchedKriteria.push(ge);
            }
        });
    }

    // Jika masih kosong, gunakan DEFAULT_KRITERIA
    if (matchedKriteria.length === 0) {
        matchedKriteria = DEFAULT_KRITERIA.filter(k => k.kategori === 'all' || k.kategori === 'general');
    }

    ratings = {};

    container.innerHTML = matchedKriteria.map((k, idx) => {
        ratings[k.id] = 0;
        const desc = k.deskripsi || ('Penilaian ' + k.kriteria);
        return `
        <div class="q-card">
            <div class="q-label">
                <span class="q-num">${idx + 1}</span>
                ${esc(k.kriteria)}
            </div>
            <div class="q-desc">${esc(desc)}</div>
            <div class="stars" data-name="${esc(k.id)}">
                <span class="star" data-v="1">&#9733;</span>
                <span class="star" data-v="2">&#9733;</span>
                <span class="star" data-v="3">&#9733;</span>
                <span class="star" data-v="4">&#9733;</span>
                <span class="star" data-v="5">&#9733;</span>
            </div>
        </div>`;
    }).join('');

    initDynamicStars();
}

function initDynamicStars() {
    document.querySelectorAll('#questionsContainer .stars').forEach(group => {
        const name = group.dataset.name;
        const stars = group.querySelectorAll('.star');

        stars.forEach(star => {
            star.addEventListener('mouseenter', () => {
                const val = parseInt(star.dataset.v);
                stars.forEach(s => {
                    s.classList.toggle('hover', parseInt(s.dataset.v) <= val);
                });
            });

            star.addEventListener('click', (e) => {
                e.stopPropagation();
                const val = parseInt(star.dataset.v);
                ratings[name] = val;
                stars.forEach(s => {
                    s.classList.remove('hover');
                    s.classList.toggle('active', parseInt(s.dataset.v) <= val);
                });
            });
        });

        group.addEventListener('mouseleave', () => {
            stars.forEach(s => {
                s.classList.remove('hover');
                s.classList.toggle('active', parseInt(s.dataset.v) <= ratings[name]);
            });
        });
    });
}

function autoSuggestRating(categoryName, value) {
    ratings[categoryName] = value;
    const group = document.querySelector(`.stars[data-name="${categoryName}"]`);
    if (group) {
        group.querySelectorAll('.star').forEach(s => {
            s.classList.toggle('active', parseInt(s.dataset.v) <= value);
        });
    }
}

function closeModal() {
    const modalBg = document.getElementById('modalBg');
    if (modalBg) {
        modalBg.classList.remove('show');
        modalBg.style.display = 'none';
        modalBg.style.opacity = '0';
        modalBg.style.visibility = 'hidden';
        modalBg.style.pointerEvents = 'none';
    }
    document.body.style.overflow = '';
}

function initModalClose() {
    document.getElementById('modalX').addEventListener('click', closeModal);
    document.getElementById('modalBg').addEventListener('click', (e) => {
        if (e.target.id === 'modalBg') closeModal();
    });

    document.getElementById('successClose').addEventListener('click', () => {
        document.getElementById('successBg').classList.remove('show');
        document.body.style.overflow = '';
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal();
            document.getElementById('successBg').classList.remove('show');
            document.body.style.overflow = '';
        }
    });
}

// =====================================================
// FORM SUBMIT
// =====================================================
function initForm() {
    document.getElementById('assessmentForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await submitAssessment();
    });
}

async function submitAssessment() {
    const activeKeys = Object.keys(ratings);
    
    if (activeKeys.length === 0) {
        showToast('Tidak ada kriteria penilaian untuk dikirim.', 'error');
        return;
    }

    for (let i = 0; i < activeKeys.length; i++) {
        const key = activeKeys[i];
        if (ratings[key] === 0) {
            const kObj = kriteriaList.find(k => k.id === key);
            const label = kObj ? kObj.kriteria : key;
            
            showToast('Mohon beri rating: ' + label, 'error');
            const el = document.querySelector(`.stars[data-name="${key}"]`);
            if (el) {
                el.style.animation = 'none';
                el.offsetHeight;
                el.style.animation = 'shake 0.4s ease';
            }
            return;
        }
    }

    const btn = document.getElementById('btnSubmit');
    const btnText = btn.querySelector('.btn-text');
    const spinner = btn.querySelector('.btn-spinner');

    btn.disabled = true;
    btnText.textContent = 'Mengirim...';
    spinner.style.display = 'inline-block';

    const vals = Object.values(ratings);
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    const avgR = Math.round(avg * 100) / 100;

    const payload = {
        namaPenilai: localStorage.getItem('ethos_nama'),
        namaVendor: selectedVendor,
        periodePenilaian: selectedPeriode,
        skor: ratings,
        rataRata: avgR,
        predikat: getPredikat(avgR),
        catatan: document.getElementById('catatan').value.trim()
    };

    if (SCRIPT_URL === 'PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE') {
        await new Promise(r => setTimeout(r, 800));
        saveAssessedForPeriod(selectedVendor, selectedPeriode);
        renderVendorList();
        showSuccess();
        resetBtn(btn, btnText, spinner);
        return;
    }

    try {
        await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            cache: 'no-cache',
            body: JSON.stringify(payload)
        });

        saveAssessedForPeriod(selectedVendor, selectedPeriode);
        renderVendorList();
        showSuccess();
    } catch (err) {
        console.error('Submit error:', err);
        showToast('Gagal terhubung ke server. Periksa koneksi internet Anda.', 'error');
    } finally {
        resetBtn(btn, btnText, spinner);
    }
}

function resetBtn(btn, text, spinner) {
    btn.disabled = false;
    text.textContent = 'Kirim Penilaian';
    spinner.style.display = 'none';
}

function getPredikat(avg) {
    if (avg >= 4.5) return 'Sangat Baik';
    if (avg >= 3.5) return 'Baik';
    if (avg >= 2.5) return 'Cukup';
    if (avg >= 1.5) return 'Kurang';
    return 'Sangat Kurang';
}

function showSuccess() {
    closeModal();
    setTimeout(() => {
        document.getElementById('successBg').classList.add('show');
    }, 250);
}

function resetForm() {
    ratings = {};
    document.getElementById('assessmentForm').reset();
    document.querySelectorAll('.star').forEach(s => s.classList.remove('active', 'hover'));
}

function showToast(msg, type = 'info') {
    const box = document.getElementById('toastBox');
    const t = document.createElement('div');
    t.className = 'toast' + (type === 'error' ? ' toast-error' : '');
    t.textContent = msg;
    box.appendChild(t);

    setTimeout(() => {
        t.classList.add('toast-out');
        setTimeout(() => t.remove(), 250);
    }, 3000);
}
