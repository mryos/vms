// =====================================================
// KONFIGURASI
// =====================================================
// Ganti URL di bawah dengan URL Web App Google Apps Script Anda
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzZoqLwWggG_JSQ3Imyd6AMQwfCbDBHng9GkCddAlJorKSB_jcxMlZejJIUmaqYqMSUkg/exec';

// Daftar vendor dari spreadsheet (gid=783208627)
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

// Kategori vendor sekarang diambil dari spreadsheet (kolom B di sheet 'Daftar Vendor')
// vendorCategoryMap diisi saat data diterima dari API
// Format: { 'NAMA VENDOR': 'it', 'NAMA VENDOR 2': 'logistics', ... }

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
let vendors = []; // Array of string (nama vendor) yang BERHAK dinilai oleh PIN ini
let allMasterVendors = [...DEFAULT_VENDORS];
let selectedVendor = null;
let selectedPeriode = (() => {
    const now = new Date();
    const q = Math.floor(now.getMonth() / 3) + 1;
    return `Q${q} ${now.getFullYear()}`;
})();
let activeCategories = ['all'];
let viewMode = 'all'; // 'all' | 'pinned'
let ratings = {}; // Akan diisi dinamis berdasarkan kriteria aktif
let vendorCategoryMap = {}; // { 'Nama Vendor': 'it', ... } — diisi dari spreadsheet
let kriteriaList = []; // Diambil dari spreadsheet
let categoriesList = []; // Diambil dari spreadsheet
let poStats = { totalOrders: 0, totalOnTime: 0, overallOnTimePct: 0, vendorMap: {} };

const DEFAULT_KRITERIA = [
    // Kriteria Umum (semua vendor)
    { id: 'harga', kriteria: 'Harga', deskripsi: 'Kewajaran dan daya saing harga yang ditawarkan', kategori: 'all' },
    { id: 'pelayanan', kriteria: 'Pelayanan', deskripsi: 'Responsivitas, komunikasi, dan profesionalisme', kategori: 'all' },
    { id: 'ketepatanWaktu', kriteria: 'Ketepatan Waktu', deskripsi: 'Kemampuan menyelesaikan/mengirim sesuai jadwal', kategori: 'all' },
    // Kriteria IT
    { id: 'kualitasProdukIT', kriteria: 'Kualitas Produk IT', deskripsi: 'Kualitas hardware/software yang disediakan', kategori: 'it' },
    { id: 'dukunganTeknis', kriteria: 'Dukungan Teknis', deskripsi: 'Kecepatan dan kualitas dukungan teknis / after-sales', kategori: 'it' },
    { id: 'garansiPemeliharaan', kriteria: 'Garansi & Pemeliharaan', deskripsi: 'Cakupan garansi dan layanan pemeliharaan', kategori: 'it' },
    // Kriteria Ekspedisi
    { id: 'keamananPengiriman', kriteria: 'Keamanan Pengiriman', deskripsi: 'Kondisi barang saat diterima (tidak rusak/hilang)', kategori: 'logistics' },
    { id: 'jangkauanArea', kriteria: 'Jangkauan Area', deskripsi: 'Kemampuan menjangkau area pengiriman yang dibutuhkan', kategori: 'logistics' },
    { id: 'ketepatanEstimasi', kriteria: 'Ketepatan Estimasi', deskripsi: 'Akurasi estimasi waktu pengiriman yang diberikan', kategori: 'logistics' },
    // Kriteria Branding
    { id: 'kreativitasDesain', kriteria: 'Kreativitas Desain', deskripsi: 'Kualitas dan originalitas konsep desain', kategori: 'branding' },
    { id: 'kesesuaianBrief', kriteria: 'Kesesuaian Brief', deskripsi: 'Kemampuan memahami dan mengeksekusi brief klien', kategori: 'branding' },
    { id: 'revisiFleksibilitas', kriteria: 'Revisi & Fleksibilitas', deskripsi: 'Kesediaan dan kecepatan dalam melakukan revisi', kategori: 'branding' },
    // Kriteria Percetakan
    { id: 'kualitasCetak', kriteria: 'Kualitas Cetak', deskripsi: 'Ketajaman warna, detail, dan kualitas bahan cetak', kategori: 'printing' },
    { id: 'kesesuaianSpek', kriteria: 'Kesesuaian Spesifikasi', deskripsi: 'Hasil cetak sesuai ukuran, bahan, dan finishing yang diminta', kategori: 'printing' },
    { id: 'kapasitasProduksi', kriteria: 'Kapasitas Produksi', deskripsi: 'Kemampuan menangani volume pesanan besar', kategori: 'printing' },
    // Kriteria Konsultan
    { id: 'keahlianKompetensi', kriteria: 'Keahlian & Kompetensi', deskripsi: 'Tingkat keahlian dan pengalaman di bidangnya', kategori: 'consultant' },
    { id: 'kualitasLaporan', kriteria: 'Kualitas Laporan', deskripsi: 'Kelengkapan dan kejelasan laporan / deliverable', kategori: 'consultant' },
    { id: 'dampakHasil', kriteria: 'Dampak & Hasil', deskripsi: 'Efektivitas rekomendasi atau solusi yang diberikan', kategori: 'consultant' },
    // Kriteria Barang Jasa (General)
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
        // Cari vendor dengan PO terbanyak & 100% on time
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

    // Render kategori terlebih dahulu
    renderCategoryChips(categoriesList.length > 0 ? categoriesList : DEFAULT_CATEGORIES);

    if (savedPin && savedName && savedVendors) {
        currentPin = savedPin;
        currentAssessorName = savedName;
        try { vendors = JSON.parse(savedVendors); } catch { vendors = [...DEFAULT_VENDORS]; }
        updateHeaderUser(savedName, savedPin);
        renderVendorList();

        // Background fetch untuk PO stats terbaru dari server
        refreshPoStatsFromServer(savedPin);
    } else {
        showWelcome();
    }
}

/**
 * Ambil data PO stats terbaru dari server secara background (tidak blocking UI)
 */
async function refreshPoStatsFromServer(pin) {
    if (SCRIPT_URL === 'PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE') return;

    try {
        const url = pin ? `${SCRIPT_URL}?pin=${encodeURIComponent(pin)}` : SCRIPT_URL;
        const res = await fetch(url);
        const data = await res.json();
        if (data.status === 'success') {
            if (data.poStats) {
                poStats = data.poStats;
                renderVendorList(); // Re-render agar badge PO di vendor rows muncul
            }
            // Update vendors dari server (fresh list)
            if (data.vendors && data.vendors.length > 0) {
                processVendorData(data.vendors);
                localStorage.setItem('ethos_user_vendors', JSON.stringify(vendors));
                localStorage.setItem('ethos_vendor_categories', JSON.stringify(vendorCategoryMap));
                renderVendorList();
            }
            // Update kriteria dari server (fresh kriteria)
            if (data.kriteria && data.kriteria.length > 0) {
                kriteriaList = data.kriteria;
                localStorage.setItem('ethos_kriteria', JSON.stringify(kriteriaList));
            }
            // Update kategori dari server (fresh kategori)
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

    // 1. Coba verifikasi PIN ke Google Apps Script (Sheet 'Akses Penilai')
    let verifiedData = null;

    if (SCRIPT_URL !== 'PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE') {
        try {
            const res = await fetch(`${SCRIPT_URL}?pin=${encodeURIComponent(pin)}`);
            const data = await res.json();
            if (data.status === 'success' && data.vendors && data.vendors.length > 0) {
                // Simpan PO stats dari server ke state
                if (data.poStats) {
                    poStats = data.poStats;
                }
                // Simpan Kriteria dari server ke state
                if (data.kriteria && data.kriteria.length > 0) {
                    kriteriaList = data.kriteria;
                    localStorage.setItem('ethos_kriteria', JSON.stringify(kriteriaList));
                }
                // Simpan Kategori dari server ke state
                if (data.kategori && data.kategori.length > 0) {
                    categoriesList = data.kategori;
                    localStorage.setItem('ethos_categories', JSON.stringify(categoriesList));
                    renderCategoryChips(categoriesList);
                }
                // Proses vendor data (bisa string atau {nama, kategori})
                processVendorData(data.vendors);
                localStorage.setItem('ethos_vendor_categories', JSON.stringify(vendorCategoryMap));
                verifiedData = {
                    pin: pin,
                    nama: data.namaPenilai || 'Penilai',
                    vendors: vendors // sudah diproses jadi array string
                };
            } else if (data.status === 'error') {
                // Jika PIN admin/9999, jangan blokir — biarkan fallback ke offline
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

    // 2. Fallback jika Apps Script offline / mode demo
    if (!verifiedData) {
        if (DEFAULT_PINS[pin]) {
            verifiedData = {
                pin: pin,
                nama: DEFAULT_PINS[pin].nama,
                vendors: DEFAULT_PINS[pin].vendors
            };
        } else if (pin === 'admin' || pin === '9999') {
            // Master PIN Admin untuk melihat semua vendor
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
        vendors = verifiedData.vendors;

        localStorage.setItem('ethos_pin', currentPin);
        localStorage.setItem('ethos_nama', currentAssessorName);
        localStorage.setItem('ethos_user_vendors', JSON.stringify(vendors));

        updateHeaderUser(currentAssessorName, currentPin);
        updatePoInsightsBanner();
        overlay.classList.remove('show');
        renderVendorList();
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
}

function initHeaderUser() {
    const el = document.getElementById('headerUser');
    if (el) {
        el.addEventListener('click', () => {
            if (confirm('Apakah Anda ingin keluar / mengganti PIN Penilai?')) {
                localStorage.removeItem('ethos_pin');
                localStorage.removeItem('ethos_nama');
                localStorage.removeItem('ethos_user_vendors');
                vendors = [];
                showWelcome();
            }
        });
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
// PERIODE CHIPS
// =====================================================
function initPeriodeChips() {
    const container = document.getElementById('periodeChips');
    if (!container) return;

    const now = new Date();
    const year = now.getFullYear();
    const quarter = Math.floor(now.getMonth() / 3) + 1;

    // Generate: previous quarter, current quarter, next quarter
    const quarters = [];
    for (let offset = -1; offset <= 1; offset++) {
        let q = quarter + offset;
        let y = year;
        if (q < 1) { q = 4; y--; }
        if (q > 4) { q = 1; y++; }
        quarters.push({ label: `Q${q} ${y}`, value: `Q${q} ${y}` });
    }

    container.innerHTML = quarters.map(p =>
        `<button class="chip${p.value === selectedPeriode ? ' active' : ''}" data-value="${p.value}">${p.label}</button>`
    ).join('');

    container.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', () => {
            container.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            selectedPeriode = chip.dataset.value;
            renderVendorList();
        });
    });
}

// =====================================================
// FETCH VENDORS
// =====================================================
async function fetchVendors() {
    if (SCRIPT_URL === 'PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE') return;

    try {
        const res = await fetch(SCRIPT_URL);
        const data = await res.json();
        if (data.status === 'success' && Array.isArray(data.vendors) && data.vendors.length > 0) {
            processVendorData(data.vendors);
            // Simpan PO stats dari server
            if (data.poStats) {
                poStats = data.poStats;
                updatePoInsightsBanner();
            }
            // Simpan Kategori dari server
            if (data.kategori && data.kategori.length > 0) {
                categoriesList = data.kategori;
                localStorage.setItem('ethos_categories', JSON.stringify(categoriesList));
                renderCategoryChips(categoriesList);
            }
            // Simpan Kriteria dari server
            if (data.kriteria && data.kriteria.length > 0) {
                kriteriaList = data.kriteria;
                localStorage.setItem('ethos_kriteria', JSON.stringify(kriteriaList));
            }
            renderVendorList();
        }
    } catch (err) {
        console.warn('Gagal fetch vendor:', err);
    }
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

        // Filter berdasarkan Bidang / Kategori (multi-select) — pakai vendorCategoryMap dari spreadsheet
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
        list.innerHTML = `
        <div style="text-align:center; padding:3rem 1.5rem; background:#fff; border:1px dashed var(--border); border-radius:var(--radius); color:var(--text2);">
            <div style="font-size:2rem; margin-bottom:0.5rem;">📌</div>
            <div style="font-weight:700; color:var(--text); margin-bottom:0.25rem;">Tidak Ada Vendor Ditemukan</div>
            <div style="font-size:0.85rem; color:var(--text3);">
                ${viewMode === 'pinned' ? 'Anda belum menyematkan (pin 📌) vendor favorit Anda.' : 'Tidak ada vendor yang cocok dengan filter bidang atau pencarian saat ini.'}
            </div>
            ${viewMode === 'pinned' ? '<button class="btn btn-ghost btn-sm" style="margin-top:1rem;" onclick="document.getElementById(\'btnFilterAll\').click()">🌐 Lihat Semua Vendor</button>' : ''}
        </div>`;
        return;
    }

    const assessed = getAssessedVendors();
    const pinned = getPinnedVendors();

    const isAdmin = currentPin === '9999' || currentPin === 'admin';

    list.innerHTML = displayVendors.map((v, i) => {
        const originalIndex = vendors.indexOf(v);
        const done = assessed.includes(v);
        const isPinned = pinned.includes(v);
        const color = AVATAR_COLORS[(originalIndex >= 0 ? originalIndex : i) % AVATAR_COLORS.length];
        const initials = v.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
        const vPo = poStats.vendorMap ? poStats.vendorMap[v] : null;

        // Admin bisa klik row meskipun locked karena admin bisa buka kunci
        const rowStyle = done && !isAdmin ? 'style="opacity: 0.65; cursor: not-allowed;"' : '';

        return `
        <div class="vendor-row ${done ? 'locked' : ''}" data-vendor="${esc(v)}" ${rowStyle}>
            <button class="vendor-pin-btn ${isPinned ? 'pinned' : ''}" data-pin="${esc(v)}" title="${isPinned ? 'Hapus dari Vendorku' : 'Sematkan ke Vendorku'}">
                ${isPinned ? '📌' : '📍'}
            </button>
            <div class="vendor-avatar" style="background:${color}12;color:${color};border:1px solid ${color}25;">${initials}</div>
            <span class="vendor-name">${esc(v)}</span>
            ${done ? '<span class="vendor-badge-done" style="background: rgba(16,185,129,0.15); color: #10b981; border: 1px solid rgba(16,185,129,0.3);">🔒 Dinilai (Terkunci)</span>' : ''}
            ${done && isAdmin ? `<button class="vendor-unlock-btn" data-unlock="${esc(v)}" title="Buka Kunci Penilaian (Admin Only)" style="background:none; border:none; cursor:pointer; font-size:1.1rem; padding: 4px; margin-left: 8px;">🔓</button>` : ''}
            ${done ? '' : '<span class="vendor-arrow">›</span>'}
        </div>`;
    }).join('');

    // Attach row click (modal open)
    list.querySelectorAll('.vendor-row').forEach(row => {
        row.addEventListener('click', (e) => {
            // Abaikan jika yang diklik adalah tombol pin atau tombol unlock
            if (e.target.closest('.vendor-pin-btn') || e.target.closest('.vendor-unlock-btn')) return;
            
            // Jika sudah dinilai dan bukan admin, kunci / jangan bolehkan buka modal
            if (row.classList.contains('locked') && !isAdmin) {
                showToast('Vendor ini sudah dinilai dan terkunci.', 'info');
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
            if (confirm(`Apakah Anda yakin ingin membuka kunci penilaian untuk vendor "${vendor}"?`)) {
                unlockVendor(vendor);
            }
        });
    });
}

function unlockVendor(vendorName) {
    let assessed = getAssessedVendors();
    assessed = assessed.filter(v => v !== vendorName);
    localStorage.setItem('ethos_assessed', JSON.stringify(assessed));
    showToast(`Kunci penilaian untuk "${vendorName}" berhasil dibuka.`, 'success');
    renderVendorList();
}

// Fungsi ini tidak lagi digunakan karena akses vendor diatur via PIN di sheet 'Akses Penilai'
// Tetap tersedia sebagai fallback jika dibutuhkan
function getAssignedVendorsForUser() {
    return vendors;
}

function esc(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}

// =====================================================
// ASSESSED VENDORS (localStorage)
// =====================================================
function getAssessedVendors() {
    try { return JSON.parse(localStorage.getItem('ethos_assessed') || '[]'); }
    catch { return []; }
}

function saveAssessed(name) {
    const arr = getAssessedVendors();
    if (!arr.includes(name)) {
        arr.push(name);
        localStorage.setItem('ethos_assessed', JSON.stringify(arr));
    }
}

// =====================================================
// MODAL & PO INSIGHTS INTEGRATION
// =====================================================
function openModal(vendorName) {
    const nama = localStorage.getItem('ethos_nama');
    if (!nama) {
        showWelcome();
        return;
    }

    selectedVendor = vendorName;
    resetForm();

    document.getElementById('modalVendorName').textContent = vendorName;

    // Render form dinamis berdasarkan kriteria & kategori vendor
    renderDynamicForm(vendorName);

    // Auto-suggest rating ketepatan waktu jika vendor memiliki PO stats dan kriterianya aktif
    const vStats = poStats.vendorMap ? poStats.vendorMap[vendorName] : null;
    if (vStats && vStats.totalPo > 0 && 'ketepatanWaktu' in ratings) {
        let suggestVal = 2;
        if (vStats.onTimeRatePct >= 90) suggestVal = 5;
        else if (vStats.onTimeRatePct >= 75) suggestVal = 4;
        else if (vStats.onTimeRatePct >= 50) suggestVal = 3;
        
        autoSuggestRating('ketepatanWaktu', suggestVal);
    }

    document.getElementById('modalBg').classList.add('show');
    document.body.style.overflow = 'hidden';
}

function getVendorCategory(vendorName) {
    // Pertama cek dari vendorCategoryMap (dari spreadsheet)
    if (vendorCategoryMap[vendorName]) {
        return vendorCategoryMap[vendorName];
    }
    // Fallback: cari case-insensitive
    const nameLower = vendorName.toLowerCase();
    for (let key in vendorCategoryMap) {
        if (key.toLowerCase() === nameLower) return vendorCategoryMap[key];
    }
    return 'general';
}

/**
 * Memproses data vendor dari API.
 * API bisa mengirim array string ['Vendor A', 'Vendor B']
 * atau array objek [{nama: 'Vendor A', kategori: 'it'}, ...]
 * Fungsi ini selalu menghasilkan:
 * - vendors: array string nama vendor
 * - vendorCategoryMap: mapping nama -> kategori
 */
function processVendorData(vendorData) {
    if (!Array.isArray(vendorData) || vendorData.length === 0) return;

    // Cek apakah data berupa objek {nama, kategori} atau string biasa
    if (typeof vendorData[0] === 'object' && vendorData[0].nama) {
        vendors = vendorData.map(v => v.nama);
        vendorData.forEach(v => {
            if (v.nama && v.kategori) {
                vendorCategoryMap[v.nama] = v.kategori;
            }
        });
    } else {
        // Data lama (array string) — tidak mengubah vendorCategoryMap
        vendors = vendorData.map(v => typeof v === 'string' ? v : v.toString());
    }
}

function renderDynamicForm(vendorName) {
    const container = document.getElementById('questionsContainer');
    if (!container) return;

    const vendorCat = getVendorCategory(vendorName);
    
    // Saring kriteria:
    // 1. Jika ada vendor spesifik, wajib cocok nama vendornya.
    // 2. Jika tidak, cukup kategori cocok dengan kategori vendor atau 'all'.
    const activeKriteria = kriteriaList.filter(k => {
        if (k.vendorSpesifik) {
            return k.vendorSpesifik.toLowerCase().trim() === vendorName.toLowerCase().trim();
        }
        const kCat = (k.kategori || '').toLowerCase().trim();
        return kCat === '' || kCat === 'all' || kCat === 'semua' || kCat === vendorCat;
    });

    ratings = {}; // Reset ratings object
    
    if (activeKriteria.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--text3);">Tidak ada kriteria penilaian yang aktif untuk kategori vendor ini.</div>`;
        return;
    }

    container.innerHTML = activeKriteria.map((k, idx) => {
        ratings[k.id] = 0; // Inisialisasi skor rating = 0
        return `
        <div class="q-card">
            <div class="q-label">
                <span class="q-num">${idx + 1}</span>
                ${esc(k.kriteria)}
            </div>
            <div class="q-desc">${esc(k.deskripsi)}</div>
            <div class="stars" data-name="${esc(k.id)}">
                <span class="star" data-v="1">&#9733;</span>
                <span class="star" data-v="2">&#9733;</span>
                <span class="star" data-v="3">&#9733;</span>
                <span class="star" data-v="4">&#9733;</span>
                <span class="star" data-v="5">&#9733;</span>
            </div>
        </div>`;
    }).join('');

    // Bind event listeners ke bintang yang baru di-render
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
    document.getElementById('modalBg').classList.remove('show');
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
// STAR RATINGS
// =====================================================
function initStars() {
    document.querySelectorAll('.stars').forEach(group => {
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
                el.offsetHeight; // reflow
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
        skor: ratings, // Kirim dynamic skor kriteria
        rataRata: avgR,
        predikat: getPredikat(avgR),
        catatan: document.getElementById('catatan').value.trim()
    };

    if (SCRIPT_URL === 'PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE') {
        // Demo mode
        console.log('Demo — payload:', payload);
        await new Promise(r => setTimeout(r, 800));
        saveAssessed(selectedVendor);
        renderVendorList();
        showSuccess();
        resetBtn(btn, btnText, spinner);
        return;
    }

    try {
        // Kirim data ke Google Apps Script Web App
        await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            cache: 'no-cache',
            body: JSON.stringify(payload)
        });

        // Sukses! Simpan status & tampilkan modal berhasil
        saveAssessed(selectedVendor);
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

// =====================================================
// RESET FORM
// =====================================================
function resetForm() {
    ratings = { kualitas: 0, ketepatanWaktu: 0, harga: 0, pelayanan: 0 };
    document.getElementById('assessmentForm').reset();
    document.querySelectorAll('.star').forEach(s => s.classList.remove('active', 'hover'));
}

// =====================================================
// TOAST
// =====================================================
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
