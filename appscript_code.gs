/**
 * ==============================================================================
 * GOOGLE APPS SCRIPT - VENDOR ASSESSMENT SYSTEM (MULTI-PERIOD & DYNAMIC PO SHEETS)
 * ==============================================================================
 * Spreadsheet Target:
 * https://docs.google.com/spreadsheets/d/1GqsrZeTHhEpyCu5iGWk5OxoT8XPnXKk8usJUWSs27sw/
 * ==============================================================================
 * Cara Deploy / Update:
 * 1. Buka Google Sheets Anda (https://docs.google.com/spreadsheets/d/1GqsrZeTHhEpyCu5iGWk5OxoT8XPnXKk8usJUWSs27sw/)
 * 2. Klik menu Ekstensi -> Apps Script
 * 3. Hapus kode lama dan tempel (paste) seluruh kode ini
 * 4. Simpan (Ctrl+S / klik ikon 💾)
 * 5. Klik Deploy -> Manage deployments -> klik ikon Pensil (Edit)
 * 6. Pada bagian Version pilih "New version", lalu klik Deploy
 * ==============================================================================
 * FITUR DUAL-MODE PERIODE:
 * 1. Mode Sheet Khusus: Buat/duplikat sheet seperti "Quartal 2 2026", "Quartal 2 2027", "Q2 2027", dll.
 * 2. Mode Auto-Partition: Sheet master "PO" atau "Purchase Order" (format Odoo/ERP) otomatis
 *    dikelompokkan per kuartal (Q3 2026, Q2 2026, Q1 2026, dst) berdasarkan Confirmation Date!
 * ==============================================================================
 */

// Nama-nama Sheet Sistem / Master Data
var SHEET_PENILAIAN_VENDOR = 'Penilaian Vendor';
var SHEET_AKSES_PENILAI = 'Akses Penilai';
var SHEET_DAFTAR_VENDOR = 'Daftar Vendor';
var SHEET_KATEGORI_VENDOR = 'Kategori Vendor';
var SHEET_KRITERIA_PENILAIAN = 'Kriteria Penilaian';
var SHEET_PR = 'Purchase Request';
var SHEET_KONTRAK = 'Kontrak Vendor';
var SHEET_PO_DEFAULT = 'Purchase Order';
var SHEET_PO_ALT = 'PO';

// ======================================================================
// PETA KRITERIA PER KATEGORI (9 Kategori × 11 Pertanyaan)
// Digunakan untuk membuat header kolom sheet "Penilaian - <Kategori>"
// ======================================================================
var CATEGORY_KRITERIA_MAP = {
  'BarangJasa': [
    'Kualitas Barang/Jasa', 'Kesesuaian Spesifikasi', 'Ketepatan Waktu Pengiriman',
    'Kelengkapan Pesanan', 'Harga & Kewajaran', 'Pelayanan & Responsivitas',
    'Garansi & Purna Jual', 'Ketersediaan Stok', 'Kemasan & Pengemasan',
    'Fleksibilitas Pesanan', 'Dokumentasi & Administrasi'
  ],
  'Branding': [
    'Kreativitas Konsep', 'Kesesuaian Brief', 'Kualitas Desain Visual',
    'Konsistensi Brand Identity', 'Ketepatan Waktu Pengerjaan', 'Revisi & Fleksibilitas',
    'Komunikasi & Koordinasi', 'Pemahaman Target Audiens', 'Kualitas Material Produksi',
    'Harga & Nilai Tambah', 'Dampak Terhadap Brand Awareness'
  ],
  'KOLInfPodcast': [
    'Relevansi Audiens', 'Kualitas Konten', 'Engagement Rate',
    'Ketepatan Waktu Posting', 'Kesesuaian Brief & Pesan', 'Profesionalisme & Etika',
    'Jangkauan & Reach', 'Kreativitas Eksekusi', 'Responsivitas Komunikasi',
    'Harga & ROI', 'Dampak Terhadap Brand'
  ],
  'PhotoVideo': [
    'Kualitas Visual & Teknis', 'Kreativitas Konsep', 'Kesesuaian Brief',
    'Ketepatan Waktu Pengerjaan', 'Kualitas Editing & Post-Production', 'Profesionalisme Tim',
    'Kelengkapan Peralatan', 'Revisi & Fleksibilitas', 'Komunikasi & Koordinasi',
    'Harga & Kewajaran', 'Hasil Akhir & Deliverable'
  ],
  'Konsultan': [
    'Keahlian & Kompetensi', 'Kualitas Analisa & Rekomendasi', 'Pemahaman Bisnis Klien',
    'Ketepatan Waktu Deliverable', 'Kualitas Laporan', 'Komunikasi & Presentasi',
    'Dampak & Hasil Implementasi', 'Metodologi Kerja', 'Ketersediaan & Responsivitas',
    'Harga & Kewajaran', 'Transfer Knowledge'
  ],
  'ITSoftware': [
    'Kualitas Produk/Sistem', 'Stabilitas & Performa', 'Keamanan Sistem',
    'Dukungan Teknis', 'Ketepatan Waktu Implementasi', 'User Experience & Interface',
    'Dokumentasi Teknis', 'Garansi & Pemeliharaan', 'Skalabilitas Solusi',
    'Harga & Lisensi', 'Training & Onboarding'
  ],
  'EventOrganizer': [
    'Konsep & Kreativitas Acara', 'Eksekusi & Koordinasi Lapangan', 'Ketepatan Waktu & Jadwal',
    'Kualitas Venue & Logistik', 'Manajemen Anggaran', 'Komunikasi & Responsivitas',
    'Penanganan Masalah', 'Kualitas Tim & SDM', 'Keamanan & Keselamatan',
    'Dokumentasi Acara', 'Dampak & Kepuasan Peserta'
  ],
  'BrandAmbasador': [
    'Kesesuaian Image & Brand Values', 'Profesionalisme & Etika', 'Pengaruh & Reputasi',
    'Engagement dengan Audiens', 'Kualitas Konten', 'Ketepatan Waktu & Komitmen',
    'Pemahaman Produk/Brand', 'Jangkauan & Reach', 'Kreativitas Eksekusi',
    'Harga & ROI', 'Dampak Terhadap Penjualan'
  ],
  'DigitalMarketing': [
    'Strategi & Perencanaan', 'Kualitas Konten Digital', 'Optimasi SEO/SEM',
    'Pengelolaan Media Sosial', 'Analisis Data & Reporting', 'Ketepatan Target Audiens',
    'Kreativitas Kampanye', 'Ketepatan Waktu Eksekusi', 'ROI & Efektivitas Budget',
    'Komunikasi & Koordinasi', 'Inovasi & Tren Digital'
  ]
};

// Normalisasi kategori vendor dari Daftar Vendor ke kode kategori standar
var CATEGORY_NORMALIZE_MAP = {
  'it': 'ITSoftware', 'software': 'ITSoftware', 'hardware': 'ITSoftware',
  'itsoftware': 'ITSoftware', 'it software': 'ITSoftware', 'teknologi informasi': 'ITSoftware',
  'branding': 'Branding', 'marketing': 'Branding', 'branding & marketing': 'Branding',
  'kol': 'KOLInfPodcast', 'influencer': 'KOLInfPodcast', 'podcast': 'KOLInfPodcast',
  'kolinfpodcast': 'KOLInfPodcast', 'kol influencer podcast': 'KOLInfPodcast',
  'photo': 'PhotoVideo', 'video': 'PhotoVideo', 'photovideo': 'PhotoVideo',
  'photo & video': 'PhotoVideo', 'foto': 'PhotoVideo', 'foto video': 'PhotoVideo',
  'konsultan': 'Konsultan', 'consultant': 'Konsultan', 'advisory': 'Konsultan',
  'konsultan & advisory': 'Konsultan', 'konsultan & services': 'Konsultan',
  'event': 'EventOrganizer', 'eo': 'EventOrganizer', 'eventorganizer': 'EventOrganizer',
  'event organizer': 'EventOrganizer',
  'brand ambassador': 'BrandAmbasador', 'brandambasador': 'BrandAmbasador',
  'ambassador': 'BrandAmbasador', 'ba': 'BrandAmbasador',
  'digital marketing': 'DigitalMarketing', 'digitalmarketing': 'DigitalMarketing',
  'digital': 'DigitalMarketing', 'dm': 'DigitalMarketing',
  'barang jasa': 'BarangJasa', 'barangjasa': 'BarangJasa', 'barang & jasa': 'BarangJasa',
  'barang_jasa': 'BarangJasa', 'general': 'BarangJasa', 'umum': 'BarangJasa',
  'percetakan': 'BarangJasa', 'konveksi': 'BarangJasa', 'printing': 'BarangJasa',
  'atk': 'BarangJasa', 'furniture': 'BarangJasa', 'logistik': 'BarangJasa',
  'ekspedisi': 'BarangJasa'
};

function normalizeCategoryCode(rawCategory) {
  if (!rawCategory) return 'BarangJasa';
  var clean = rawCategory.toString().trim().toLowerCase();
  if (CATEGORY_NORMALIZE_MAP[clean]) return CATEGORY_NORMALIZE_MAP[clean];
  for (var key in CATEGORY_NORMALIZE_MAP) {
    if (clean.indexOf(key) !== -1 || key.indexOf(clean) !== -1) {
      return CATEGORY_NORMALIZE_MAP[key];
    }
  }
  for (var catKey in CATEGORY_KRITERIA_MAP) {
    if (catKey.toLowerCase() === clean) return catKey;
  }
  return 'BarangJasa';
}

// GID sheet Akses Penilai (dari URL spreadsheet: gid=1971078762)
var GID_AKSES_PENILAI = 1971078762;

// GID sheet Kontrak Vendor (dari URL spreadsheet: gid=487575887)
var GID_KONTRAK_VENDOR = 487575887;

/**
 * Mencari sheet Akses Penilai secara fleksibel:
 * 1. Pertama cari berdasarkan GID (paling akurat, tidak terpengaruh rename)
 * 2. Fallback: cari berdasarkan nama sheet (case-insensitive)
 */
function getAksesPenilaiSheet(ss) {
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) return null;
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getSheetId() === GID_AKSES_PENILAI) {
      return sheets[i];
    }
  }
  var possibleNames = ['akses penilai', 'penilai', 'daftar penilai', 'assessor', 'user access'];
  for (var i = 0; i < sheets.length; i++) {
    var sName = sheets[i].getName().trim().toLowerCase();
    for (var j = 0; j < possibleNames.length; j++) {
      if (sName === possibleNames[j] || sName.indexOf(possibleNames[j]) !== -1) {
        return sheets[i];
      }
    }
  }
  return ss.getSheetByName(SHEET_AKSES_PENILAI);
}

/**
 * Mencari sheet Kontrak Vendor secara fleksibel:
 * 1. Pertama cari berdasarkan GID 487575887 (paling akurat, tidak terpengaruh rename)
 * 2. Fallback: cari berdasarkan nama sheet (case-insensitive)
 */
function getKontrakVendorSheet(ss) {
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) return null;
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getSheetId() === GID_KONTRAK_VENDOR) {
      return sheets[i];
    }
  }
  var possibleNames = ['kontrak vendor', 'kontrak', 'data kontrak', 'daftar kontrak', 'contract', 'contracts'];
  for (var i = 0; i < sheets.length; i++) {
    var sName = sheets[i].getName().trim().toLowerCase();
    for (var j = 0; j < possibleNames.length; j++) {
      if (sName === possibleNames[j] || sName.indexOf(possibleNames[j]) !== -1) {
        return sheets[i];
      }
    }
  }
  return ss.getSheetByName(SHEET_KONTRAK);
}

/**
 * Mencari sheet Penilaian Vendor secara fleksibel:
 * 1. Cari berdasarkan nama sheet standar
 * 2. Fallback: pencarian case-insensitive & partial match
 */
function getPenilaianVendorSheet(ss) {
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) return null;
  var candidates = [
    SHEET_PENILAIAN_VENDOR,
    'penilaian vendor',
    'penilaian',
    'evaluasi vendor',
    'evaluasi',
    'hasil penilaian',
    'assessment'
  ];
  for (var c = 0; c < candidates.length; c++) {
    var s = ss.getSheetByName(candidates[c]);
    if (s) return s;
  }
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var sName = sheets[i].getName().trim().toLowerCase();
    for (var j = 0; j < candidates.length; j++) {
      if (sName === candidates[j] || sName.indexOf(candidates[j]) !== -1) {
        return sheets[i];
      }
    }
  }
  return null;
}

/**
 * Mencari data assessor berdasarkan PIN secara fleksibel:
 * - Dynamic header: otomatis cari kolom PIN, Nama, Vendor dari header
 * - Multi-row aggregation: jika PIN muncul di beberapa baris, gabungkan semua vendor
 * - Support ALL/SEMUA: jika kolom vendor berisi ALL/SEMUA, berikan semua master vendor
 */
function getAssessorByPin(ss, pin, allMasterVendors) {
  var sheet = getAksesPenilaiSheet(ss);
  if (!sheet || sheet.getLastRow() < 2) return null;

  var data = sheet.getDataRange().getValues();
  var headers = data[0];

  // Deteksi kolom secara dinamis berdasarkan nama header
  var colPin = -1, colNama = -1, colVendor = -1;
  for (var c = 0; c < headers.length; c++) {
    var h = headers[c].toString().trim().toLowerCase();
    if (colPin === -1 && (h === 'pin' || h === 'kode' || h === 'kode pin' || h === 'code')) {
      colPin = c;
    } else if (colNama === -1 && (h === 'nama' || h === 'nama penilai' || h === 'name' || h === 'assessor')) {
      colNama = c;
    } else if (colVendor === -1 && (h.indexOf('vendor') !== -1 || h.indexOf('akses') !== -1 || h.indexOf('assigned') !== -1)) {
      colVendor = c;
    }
  }

  // Jika header tidak ditemukan, gunakan default kolom 0, 1, 2
  if (colPin === -1) colPin = 0;
  if (colNama === -1) colNama = 1;
  if (colVendor === -1) colVendor = 2;

  // Agregasi: kumpulkan semua baris yang cocok dengan PIN ini
  var namaPenilai = '';
  var allRawVendors = [];
  var found = false;

  for (var i = 1; i < data.length; i++) {
    var rowPin = data[i][colPin] !== undefined && data[i][colPin] !== null
      ? data[i][colPin].toString().trim() : '';
    
    if (rowPin === pin) {
      found = true;
      if (!namaPenilai && colNama < data[i].length && data[i][colNama]) {
        namaPenilai = data[i][colNama].toString().trim();
      }
      if (colVendor < data[i].length && data[i][colVendor]) {
        allRawVendors.push(data[i][colVendor].toString());
      }
    }
  }

  if (!found) return null;

  // Gabungkan semua vendor text dari multi-row
  var combinedVendorText = allRawVendors.join('\n');

  // Cek keyword ALL / SEMUA
  var textUpper = combinedVendorText.toUpperCase().trim();
  if (textUpper === 'ALL' || textUpper === 'SEMUA' || textUpper === 'ALL VENDOR' || textUpper === 'SEMUA VENDOR') {
    return {
      namaPenilai: namaPenilai || 'Penilai',
      assignedVendors: allMasterVendors.slice()
    };
  }

  var assignedVendors = parseAssignedVendors(combinedVendorText, allMasterVendors);

  return {
    namaPenilai: namaPenilai || 'Penilai',
    assignedVendors: assignedVendors
  };
}

/**
 * GET Request
 * Mengembalikan seluruh data database untuk halaman Penilaian dan Dashboard
 */
function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var pin = e && e.parameter && e.parameter.pin ? e.parameter.pin.toString().trim() : '';

    // Pastikan semua sheet dasar terinisialisasi
    initAllDatabaseSheets(ss);

    // Ambil master data
    var kategoriList = getKategoriVendor(ss);
    var kriteriaList = getKriteriaPenilaian(ss);
    var allMasterVendors = getAllVendors(ss);
    var prList = getPurchaseRequests(ss);
    var scoreData = getVendorScoreSummary(ss);
    var scoreSummary = scoreData.summary;
    var evaluationsList = scoreData.evaluationsList;
    var contractCompliance = getContractCompliance(ss);

    // Deteksi seluruh sheet & data periode PO yang ada di spreadsheet
    var periodDataResult = detectAllPeriodSheets(ss, allMasterVendors);
    var periods = periodDataResult.periods;
    var periodList = periodDataResult.periodList;
    var aggregatedPoStats = periodDataResult.aggregatedPoStats;

    // Tentukan periode default: periode pertama dari daftar sheet yang ada
    var defaultPeriodId = periodList.length > 0 ? periodList[0] : '';
    var baseVendors = (defaultPeriodId && periods[defaultPeriodId] && periods[defaultPeriodId].vendors.length > 0)
      ? periods[defaultPeriodId].vendors
      : allMasterVendors;

    // Kumpulkan seluruh rawOrders dari semua periode
    var allRawOrders = [];
    for (var pk in periods) {
      if (periods[pk].rawOrders && periods[pk].rawOrders.length > 0) {
        var pLbl = periods[pk].label || pk;
        periods[pk].rawOrders.forEach(function(o) { if (!o.periode) o.periode = pLbl; });
        allRawOrders = allRawOrders.concat(periods[pk].rawOrders);
      }
    }

    // Jika ada request verifikasi PIN
    if (pin) {
      if (pin === '9999' || pin === 'admin' || pin === '8899') {
        return createJsonResponse({
          status: 'success',
          pin: pin,
          namaPenilai: pin === '8899' ? 'User Katalog' : 'Administrator',
          role: pin === '8899' ? 'katalog_only' : 'admin',
          vendors: baseVendors,
          allVendors: allMasterVendors,
          kategori: kategoriList,
          kriteria: kriteriaList,
          poStats: aggregatedPoStats,
          periods: periods,
          periodList: periodList,
          defaultPeriod: defaultPeriodId,
          prList: prList,
          scoreSummary: scoreSummary,
          evaluationsList: evaluationsList,
          contractCompliance: contractCompliance,
          allRawOrders: allRawOrders
        });
      }

      // Cari PIN di sheet Akses Penilai (fleksibel: dynamic header, multi-row, ALL/SEMUA)
      var assessorResult = getAssessorByPin(ss, pin, allMasterVendors);
      if (assessorResult) {
        var namaPenilai = assessorResult.namaPenilai;
        var assignedVendors = assessorResult.assignedVendors;

        // Buat filteredPeriods khusus penilai ini
        // Hanya tampilkan vendor yang ditugaskan DAN memiliki data PO di periode tersebut
        var filteredPeriods = {};
        for (var pKey in periods) {
          var pObj = periods[pKey];

          // Kumpulkan nama vendor yang memiliki PO di periode ini
          var periodVendorNames = {};
          if (pObj.rawOrders && pObj.rawOrders.length > 0) {
            pObj.rawOrders.forEach(function(o) {
              if (o.vendor) periodVendorNames[o.vendor.toLowerCase().trim()] = true;
            });
          }
          if (pObj.poStats && pObj.poStats.vendorMap) {
            for (var vk in pObj.poStats.vendorMap) {
              periodVendorNames[vk.toLowerCase().trim()] = true;
            }
          }

          // Filter: hanya vendor yang ditugaskan DAN memiliki PO di periode ini
          var periodAssigned = assignedVendors;
          var hasPeriodPoData = Object.keys(periodVendorNames).length > 0;
          if (hasPeriodPoData) {
            periodAssigned = assignedVendors.filter(function(av) {
              var avName = (typeof av === 'object' ? (av.nama || '') : av.toString()).toLowerCase().trim();
              // Cek kecocokan langsung atau fuzzy
              for (var pvn in periodVendorNames) {
                if (avName === pvn) return true;
                var normAv = avName.replace(/[^a-z0-9]/g, '');
                var normPv = pvn.replace(/[^a-z0-9]/g, '');
                if (normAv === normPv) return true;
                if (normAv.length > 4 && normPv.length > 4 && (normAv.indexOf(normPv) !== -1 || normPv.indexOf(normAv) !== -1)) return true;
              }
              return false;
            });
            // Jika tidak ada match sama sekali, tetap tampilkan semua assigned (safety fallback)
            if (periodAssigned.length === 0) periodAssigned = assignedVendors;
          }

          filteredPeriods[pKey] = {
            id: pObj.id,
            label: pObj.label,
            sheetName: pObj.sheetName,
            year: pObj.year,
            quarter: pObj.quarter,
            vendors: periodAssigned,
            poStats: pObj.poStats,
            rawOrders: pObj.rawOrders || []
          };
        }

        return createJsonResponse({
          status: 'success',
          pin: pin,
          namaPenilai: namaPenilai,
          vendors: assignedVendors,
          allVendors: allMasterVendors,
          kategori: kategoriList,
          kriteria: kriteriaList,
          poStats: aggregatedPoStats,
          periods: filteredPeriods,
          periodList: periodList,
          defaultPeriod: defaultPeriodId,
          prList: prList,
          scoreSummary: scoreSummary,
          evaluationsList: evaluationsList,
          contractCompliance: contractCompliance,
          allRawOrders: allRawOrders
        });
      }

      return createJsonResponse({
        status: 'error',
        message: 'Kode PIN "' + pin + '" tidak terdaftar. Hubungi Admin.'
      });
    }

    // Default response tanpa PIN (kembalikan semua data)
    return createJsonResponse({
      status: 'success',
      vendors: baseVendors,
      allVendors: allMasterVendors,
      kategori: kategoriList,
      kriteria: kriteriaList,
      poStats: aggregatedPoStats,
      periods: periods,
      periodList: periodList,
      defaultPeriod: defaultPeriodId,
      prList: prList,
      scoreSummary: scoreSummary,
      evaluationsList: evaluationsList,
      contractCompliance: contractCompliance,
      allRawOrders: allRawOrders
    });

  } catch (error) {
    return createJsonResponse({
      status: 'error',
      message: 'System Error: ' + error.toString()
    });
  }
}

/**
 * POST Request
 * Menerima data hasil penilaian dari web client dan menyimpannya ke sheet Penilaian Vendor
 */
function doPost(e) {
  try {
    var payload;
    if (e && e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    } else if (e && e.parameter) {
      payload = e.parameter;
    } else {
      throw new Error('Payload data tidak ditemukan.');
    }

    // === ACTION: HAPUS EVALUASI (DELETE / NILAI ULANG) ===
    if (payload.action === 'deleteEvaluation') {
      var delVendor = payload.vendor ? payload.vendor.toString().trim() : '';
      var delPenilai = payload.penilai ? payload.penilai.toString().trim() : '';
      var ssDel = SpreadsheetApp.getActiveSpreadsheet();
      var pSheet = getPenilaianVendorSheet(ssDel);
      if (pSheet && pSheet.getLastRow() >= 2) {
        var pData = pSheet.getDataRange().getValues();
        var pHeaders = pData[0].map(function(h) { return h ? h.toString().trim().toLowerCase() : ''; });
        var pIdxVendor = getHeaderIndex(pHeaders, ['nama vendor', 'vendor', 'rekanan', 'supplier']);
        var pIdxPenilai = getHeaderIndex(pHeaders, ['nama penilai', 'penilai', 'assessor', 'user']);

        var deletedCount = 0;
        for (var r = pData.length - 1; r >= 1; r--) {
          var rowVendor = pIdxVendor !== -1 && pData[r][pIdxVendor] ? pData[r][pIdxVendor].toString().trim() : '';
          var rowPenilai = pIdxPenilai !== -1 && pData[r][pIdxPenilai] ? pData[r][pIdxPenilai].toString().trim() : '';

          var cleanV1 = delVendor.toLowerCase().replace(/^(pt\.?|cv\.?|ud\.?|toko)\s+/i, '').replace(/[^a-z0-9]/g, '');
          var cleanV2 = rowVendor.toLowerCase().replace(/^(pt\.?|cv\.?|ud\.?|toko)\s+/i, '').replace(/[^a-z0-9]/g, '');
          var matchVendor = cleanV1 && cleanV2 && (cleanV1 === cleanV2 || cleanV1.indexOf(cleanV2) !== -1 || cleanV2.indexOf(cleanV1) !== -1);
          var matchPenilai = !delPenilai || (rowPenilai && rowPenilai.toLowerCase().indexOf(delPenilai.toLowerCase()) !== -1);

          if (matchVendor && matchPenilai) {
            pSheet.deleteRow(r + 1);
            deletedCount++;
          }
        }
        return createJsonResponse({
          status: 'success',
          message: 'Berhasil menghapus ' + deletedCount + ' baris evaluasi untuk vendor ' + delVendor
        });
      }
      return createJsonResponse({ status: 'error', message: 'Sheet Penilaian Vendor tidak ditemukan.' });
    }

    var namaPenilai = payload.namaPenilai || '';
    var namaVendor = payload.namaVendor || '';
    var periodePenilaian = payload.periodePenilaian || '';
    var skor = payload.skor || {};
    var catatan = payload.catatan || '';

    // Jika skor dikirim datar di root payload
    if (Object.keys(skor).length === 0) {
      var skipKeys = ['namaPenilai', 'namaVendor', 'periodePenilaian', 'catatan', 'rataRata', 'predikat', 'timestamp'];
      for (var k in payload) {
        if (skipKeys.indexOf(k) === -1) {
          skor[k] = payload[k];
        }
      }
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // Hitung rata-rata skor
    var totalSkor = 0;
    var countSkor = 0;
    for (var key in skor) {
      var val = parseFloat(skor[key]);
      if (!isNaN(val) && val > 0) {
        totalSkor += val;
        countSkor++;
      }
    }
    var avgSkor = countSkor > 0 ? Math.round((totalSkor / countSkor) * 100) / 100 : 0;
    var predikat = getPredikat(avgSkor);
    var timestamp = new Date();

    // === Deteksi kategori vendor ===
    var kategoriRaw = payload.kategori || '';
    if (!kategoriRaw) {
      var allVendorsData = getAllVendors(ss);
      for (var v = 0; v < allVendorsData.length; v++) {
        if (allVendorsData[v].nama === namaVendor) {
          kategoriRaw = allVendorsData[v].kategori;
          break;
        }
      }
    }
    var normKategori = normalizeCategoryCode(kategoriRaw);

    // ============================================================
    // ============================================================
    // 1. TULIS KE MASTER "Penilaian Vendor" (RINGKASAN SAJA)
    //    Memetakan nilai secara dinamis sesuai nama header kolom di sheet
    // ============================================================
    var sheet = getPenilaianVendorSheet(ss);
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_PENILAIAN_VENDOR);
      setupSheetPenilaianHeaders(sheet);
    }

    var mHeaders = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
    var masterRow = [];
    for (var mi = 0; mi < mHeaders.length; mi++) {
      var mhLower = (mHeaders[mi] || '').toString().toLowerCase().trim();
      if (mhLower.indexOf('timestamp') !== -1 || mhLower.indexOf('tanggal') !== -1 || mhLower === 'waktu') {
        masterRow.push(timestamp);
      } else if (mhLower.indexOf('penilai') !== -1 || mhLower.indexOf('assessor') !== -1) {
        masterRow.push(namaPenilai);
      } else if (mhLower.indexOf('vendor') !== -1 || mhLower.indexOf('rekanan') !== -1) {
        masterRow.push(namaVendor);
      } else if (mhLower.indexOf('kategori') !== -1) {
        masterRow.push(normKategori);
      } else if (mhLower.indexOf('periode') !== -1 || mhLower.indexOf('kuartal') !== -1) {
        masterRow.push(periodePenilaian);
      } else if (mhLower.indexOf('rata') !== -1 || mhLower === 'skor' || mhLower.indexOf('avg') !== -1) {
        masterRow.push(avgSkor);
      } else if (mhLower.indexOf('predikat') !== -1 || mhLower === 'status') {
        masterRow.push(predikat);
      } else if (mhLower.indexOf('catatan') !== -1 || mhLower.indexOf('notes') !== -1 || mhLower.indexOf('keterangan') !== -1) {
        masterRow.push(catatan);
      } else {
        masterRow.push('');
      }
    }
    sheet.appendRow(masterRow);

    // ============================================================
    // 2. TULIS KE SHEET KATEGORI: "Penilaian - <Kategori>" (DETAIL SKOR)
    // ============================================================
    try {
      var catSheetName = 'Penilaian - ' + normKategori;
      var catSheet = ss.getSheetByName(catSheetName);

      if (!catSheet) {
        catSheet = ss.insertSheet(catSheetName);
        var catHeaders = ['Timestamp', 'Nama Penilai', 'Nama Vendor', 'Periode Penilaian'];
        var catKriteria = CATEGORY_KRITERIA_MAP[normKategori] || [];
        for (var q = 0; q < catKriteria.length; q++) {
          catHeaders.push(catKriteria[q] + ' (1-5)');
        }
        catHeaders.push('Rata-rata Skor');
        catHeaders.push('Predikat');
        catHeaders.push('Catatan');
        catSheet.appendRow(catHeaders);
        styleHeaders(catSheet, catHeaders.length);
      }

      var catLastCol = catSheet.getLastColumn();
      var catHeaderVals = catSheet.getRange(1, 1, 1, catLastCol).getValues()[0].map(function(h) { return h.toString().trim(); });
      var catRow = [];
      for (var ch = 0; ch < catHeaderVals.length; ch++) {
        var chLower = catHeaderVals[ch].toLowerCase();
        if (chLower.indexOf('timestamp') !== -1 || chLower.indexOf('tanggal') !== -1) {
          catRow.push(timestamp);
        } else if (chLower.indexOf('penilai') !== -1) {
          catRow.push(namaPenilai);
        } else if (chLower.indexOf('vendor') !== -1) {
          catRow.push(namaVendor);
        } else if (chLower.indexOf('periode') !== -1) {
          catRow.push(periodePenilaian);
        } else if (chLower.indexOf('rata') !== -1 || chLower === 'skor' || chLower.indexOf('avg') !== -1) {
          catRow.push(avgSkor);
        } else if (chLower.indexOf('predikat') !== -1) {
          catRow.push(predikat);
        } else if (chLower.indexOf('catatan') !== -1 || chLower.indexOf('notes') !== -1) {
          catRow.push(catatan);
        } else {
          var foundVal = '';
          var cleanHeader = chLower.replace(/\s*\([0-9-]+\)\s*$/, '').replace(/[^a-z0-9]/g, '');
          for (var sk in skor) {
            var skLower = sk.toLowerCase().trim();
            var cleanSk = skLower.replace(/\s*\([0-9-]+\)\s*$/, '').replace(/[^a-z0-9]/g, '');
            if (chLower === skLower || cleanHeader === cleanSk || (cleanHeader.length >= 4 && cleanSk.length >= 4 && (cleanHeader.indexOf(cleanSk) !== -1 || cleanSk.indexOf(cleanHeader) !== -1))) {
              foundVal = parseFloat(skor[sk]) || '';
              break;
            }
          }
          catRow.push(foundVal);
        }
      }
      catSheet.appendRow(catRow);
    } catch (catError) {
      Logger.log('Gagal menulis ke sheet kategori: ' + catError.toString());
    }

    return createJsonResponse({ status: 'success', message: 'Penilaian vendor berhasil disimpan.' });

  } catch (error) {
    return createJsonResponse({ status: 'error', message: error.toString() });
  }
}

/**
 * ------------------------------------------------------------------------------
 * DETEKSI DYNAMIC PERIOD SHEETS & AUTO-PARTITIONING DARI SHEET PO
 * ------------------------------------------------------------------------------
 */
function detectAllPeriodSheets(ss, masterVendors) {
  var systemSheets = [
    SHEET_PENILAIAN_VENDOR.toLowerCase(),
    SHEET_AKSES_PENILAI.toLowerCase(),
    SHEET_DAFTAR_VENDOR.toLowerCase(),
    SHEET_KATEGORI_VENDOR.toLowerCase(),
    SHEET_KRITERIA_PENILAIAN.toLowerCase(),
    SHEET_PR.toLowerCase(),
    SHEET_KONTRAK.toLowerCase()
  ];

  var masterMap = {};
  for (var i = 0; i < masterVendors.length; i++) {
    var v = masterVendors[i];
    masterMap[v.nama.toLowerCase().trim()] = v;
  }

  var sheets = ss.getSheets();
  var periodMap = {};
  var dedicatedPeriodsFound = false;

  var aggregatedPoStats = {
    totalOrders: 0,
    totalOnTime: 0,
    totalValue: 0,
    overallOnTimePct: 0,
    vendorMap: {}
  };

  // 1. Periksa Sheet Khusus Periode (contoh: "Quartal 2 2026", "Q2 2027", "PO Q3 2026")
  for (var s = 0; s < sheets.length; s++) {
    var sheet = sheets[s];
    var sheetName = sheet.getName().trim();
    var sNameLower = sheetName.toLowerCase();

    if (systemSheets.indexOf(sNameLower) !== -1) continue;
    if (sNameLower === SHEET_PO_DEFAULT.toLowerCase() || sNameLower === SHEET_PO_ALT.toLowerCase()) continue;

    var periodInfo = parsePeriodName(sheetName);

    // Jika nama sheet mencerminkan periode tertentu
    if (periodInfo.isPeriodSheet) {
      var parsedPo = parsePoFromSheet(sheet, masterMap);
      var periodId = periodInfo.id || sheetName;
      var periodLabel = periodInfo.label || sheetName;

      periodMap[periodId] = {
        id: periodId,
        label: periodLabel,
        sheetName: sheetName,
        year: periodInfo.year || 0,
        quarter: periodInfo.quarter || 0,
        vendors: (parsedPo.vendors && parsedPo.vendors.length > 0) ? parsedPo.vendors : masterVendors,
        poStats: parsedPo.poStats,
        rawOrders: parsedPo.rawOrders
      };

      dedicatedPeriodsFound = true;
      mergePoStats(aggregatedPoStats, parsedPo.poStats);
    }
  }

  // 2. Jika tidak ada sheet periode khusus yang banyak, atau ada sheet master PO ("PO" / "Purchase Order"),
  // kita auto-partition data PO berdasarkan Confirmation Date / Tanggal PO!
  var masterPoSheet = ss.getSheetByName(SHEET_PO_ALT) || ss.getSheetByName(SHEET_PO_DEFAULT);
  if (masterPoSheet && masterPoSheet.getLastRow() >= 2) {
    var partitionedResult = partitionPoSheetByDate(masterPoSheet, masterMap);
    
    // Gabungkan partisi periode dari sheet master PO jika belum didefinisikan oleh sheet dedicated
    for (var pId in partitionedResult.periods) {
      if (!periodMap[pId]) {
        periodMap[pId] = partitionedResult.periods[pId];
      }
    }

    if (!dedicatedPeriodsFound) {
      aggregatedPoStats = partitionedResult.aggregatedPoStats;
    }
  }


  // Compile dan urutkan periodList: murni dari sheet yang ada di spreadsheet
  var periodList = Object.keys(periodMap);
  periodList.sort(function(a, b) {
    var pA = periodMap[a];
    var pB = periodMap[b];
    if (pA.year !== pB.year) return pA.year - pB.year;
    if (pA.quarter !== pB.quarter) return pA.quarter - pB.quarter;
    return a.localeCompare(b);
  });

  // Hitung persentase untuk aggregated stats
  for (var vKey in aggregatedPoStats.vendorMap) {
    var vItem = aggregatedPoStats.vendorMap[vKey];
    vItem.onTimeRatePct = vItem.totalPo > 0 ? Math.round((vItem.onTimePo / vItem.totalPo) * 100) : 100;
  }
  aggregatedPoStats.overallOnTimePct = aggregatedPoStats.totalOrders > 0
    ? Math.round((aggregatedPoStats.totalOnTime / aggregatedPoStats.totalOrders) * 100)
    : 100;

  return {
    periods: periodMap,
    periodList: periodList,
    aggregatedPoStats: aggregatedPoStats
  };
}

/**
 * Ekstraksi daftar vendor dari teks kolom Akses Penilai secara cerdas & fleksibel
 * Mendukung pemisah baris baru (\n), titik-koma (;), atau koma (,),
 * serta toleran terhadap tanda kurung, variasi PT/CV, dan spasi.
 */
function parseAssignedVendors(rawVendorsText, allMasterVendors) {
  if (!rawVendorsText) return [];
  var text = rawVendorsText.toString().trim();
  if (!text) return [];

  var assigned = [];
  var assignedSet = {};

  // 1. Cek apakah ada nama dari allMasterVendors yang termuat dalam teks kolom Akses Penilai
  if (Array.isArray(allMasterVendors)) {
    allMasterVendors.forEach(function(mv) {
      var vName = typeof mv === 'object' ? mv.nama : mv.toString();
      if (!vName) return;

      var cleanV = vName.toLowerCase().trim();
      var cleanText = text.toLowerCase();

      // Cocokkan secara substring langsung
      if (cleanText.indexOf(cleanV) !== -1) {
        if (!assignedSet[vName.toLowerCase()]) {
          assignedSet[vName.toLowerCase()] = true;
          assigned.push(typeof mv === 'object' ? mv : { nama: vName, kategori: 'general' });
        }
      }
    });
  }

  // 2. Pecah teks berdasarkan baris baru, titik-koma, atau koma
  var rawTokens = text.split(/[\r\n;]+/).map(function(s) { return s.trim(); }).filter(Boolean);
  if (rawTokens.length <= 1 && text.indexOf(',') !== -1) {
    var commaTokens = text.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
    if (commaTokens.length > 1) {
      rawTokens = commaTokens;
    }
  }

  rawTokens.forEach(function(token) {
    var normToken = token.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!normToken) return;

    var matchedMaster = null;
    if (Array.isArray(allMasterVendors)) {
      for (var j = 0; j < allMasterVendors.length; j++) {
        var mv = allMasterVendors[j];
        var vName = typeof mv === 'object' ? mv.nama : mv.toString();
        var normV = vName.toLowerCase().replace(/[^a-z0-9]/g, '');

        if (normV === normToken || (normToken.length > 4 && (normV.indexOf(normToken) !== -1 || normToken.indexOf(normV) !== -1))) {
          matchedMaster = mv;
          break;
        }
      }
    }

    if (matchedMaster) {
      var mName = typeof matchedMaster === 'object' ? matchedMaster.nama : matchedMaster.toString();
      if (!assignedSet[mName.toLowerCase()]) {
        assignedSet[mName.toLowerCase()] = true;
        assigned.push(typeof matchedMaster === 'object' ? matchedMaster : { nama: mName, kategori: 'general' });
      }
    } else {
      // Jika vendor baru ditambahkan dan belum ada di master vendor, tetap tampilkan!
      if (!assignedSet[token.toLowerCase()]) {
        assignedSet[token.toLowerCase()] = true;
        assigned.push({ nama: token, kategori: 'general' });
      }
    }
  });

  return assigned;
}

/**
 * Mengelompokkan isi sheet PO master secara otomatis ke dalam Kuartal/Tahun berdasarkan tanggal
 */
function partitionPoSheetByDate(sheet, masterMap) {
  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function(h) { return h.toString().trim().toLowerCase(); });

  var idxNoPo = getHeaderIndex(headers, ['no po', 'nopo', 'order reference', 'po number', 'po', 'reference', 'number', 'kode po']);
  var idxDate = getHeaderIndex(headers, ['confirmation date', 'date', 'tanggal po', 'tanggal', 'order date', 'start date']);
  var idxVendor = getHeaderIndex(headers, ['vendor', 'nama vendor', 'supplier', 'rekanan', 'partner']);
  var idxItem = getHeaderIndex(headers, ['barangjasa', 'barang jasa', 'barang/jasa', 'product', 'item', 'deskripsi', 'item/deskripsi', 'display name', 'uraian']);
  var idxNilai = getHeaderIndex(headers, ['total', 'grand total', 'total untaxed amount', 'nilai', 'nilai (rp)', 'harga', 'amount', 'nominal']);
  var idxExp = getHeaderIndex(headers, ['expected date', 'tanggal diharapkan', 'deadline', 'diharapkan', 'tgl estimasi', 'scheduled date']);
  var idxEff = getHeaderIndex(headers, ['tanggal diterima', 'effective date', 'effective date / tanggal diterima', 'diterima', 'realisasi', 'tgl selesai', 'delivery with receipt date']);

  var periodGroups = {}; // { 'Q3 2026': { vendorsMap: {}, poStats: {}, rawOrders: [], year: 2026, quarter: 3 } }
  var aggregatedPoStats = {
    totalOrders: 0,
    totalOnTime: 0,
    totalValue: 0,
    overallOnTimePct: 0,
    vendorMap: {}
  };

  for (var i = 1; i < data.length; i++) {
    var vendorName = idxVendor !== -1 && data[i][idxVendor] ? data[i][idxVendor].toString().trim() : '';
    if (!vendorName) continue;

    var noPo = idxNoPo !== -1 && data[i][idxNoPo] ? data[i][idxNoPo].toString().trim() : 'PO-' + i;
    var rawDate = idxDate !== -1 ? data[i][idxDate] : '';
    var nilai = idxNilai !== -1 ? parseFloat(data[i][idxNilai]) || 0 : 0;
    var expDate = idxExp !== -1 ? data[i][idxExp] : '';
    var effDate = idxEff !== -1 ? data[i][idxEff] : '';
    var item = idxItem !== -1 && data[i][idxItem] ? data[i][idxItem].toString().trim() : 'Barang/Jasa';

    // Tentukan Kuartal dan Tahun dari Tanggal PO (atau nomor PO)
    var pInfo = extractQuarterAndYear(rawDate || expDate, noPo);
    var pId = pInfo.id;

    if (!periodGroups[pId]) {
      periodGroups[pId] = {
        id: pId,
        label: pId,
        sheetName: sheet.getName(),
        year: pInfo.year,
        quarter: pInfo.quarter,
        vendorsMap: {},
        poStats: {
          totalOrders: 0,
          totalOnTime: 0,
          totalValue: 0,
          overallOnTimePct: 0,
          vendorMap: {}
        },
        rawOrders: []
      };
    }

    var grp = periodGroups[pId];
    grp.poStats.totalOrders++;
    grp.poStats.totalValue += nilai;
    aggregatedPoStats.totalOrders++;
    aggregatedPoStats.totalValue += nilai;

    // Catat vendor
    var vKeyLower = vendorName.toLowerCase();
    if (!grp.vendorsMap[vKeyLower]) {
      var masterInfo = masterMap[vKeyLower];
      grp.vendorsMap[vKeyLower] = {
        nama: masterInfo ? masterInfo.nama : vendorName,
        kategori: masterInfo ? masterInfo.kategori : 'BARANG_JASA',
        kontak: masterInfo ? masterInfo.kontak : '-',
        alamat: masterInfo ? masterInfo.alamat : '-'
      };
    }

    if (!grp.poStats.vendorMap[vendorName]) {
      grp.poStats.vendorMap[vendorName] = {
        totalPo: 0,
        onTimePo: 0,
        latePo: 0,
        totalValue: 0,
        onTimeRatePct: 0,
        recentOrders: []
      };
    }

    var vData = grp.poStats.vendorMap[vendorName];
    vData.totalPo++;
    vData.totalValue += nilai;

    var isOnTime = false;
    var status = 'Proses';

    if (effDate && effDate.toString().trim() !== '' && effDate.toString().trim() !== '-') {
      var dateExp = new Date(expDate);
      var dateEff = new Date(effDate);
      if (!isNaN(dateExp.getTime()) && !isNaN(dateEff.getTime())) {
        if (dateEff <= dateExp || (dateEff - dateExp) <= 86400000) {
          isOnTime = true;
          status = 'Selesai (Tepat Waktu)';
        } else {
          status = 'Selesai (Terlambat)';
        }
      } else {
        status = 'Selesai';
      }
    } else if (expDate) {
      var now = new Date();
      var dateExp = new Date(expDate);
      if (!isNaN(dateExp.getTime())) {
        if (now <= dateExp) {
          isOnTime = true;
          status = 'Proses';
        } else {
          status = 'Terlambat (Belum Diterima)';
        }
      }
    }

    if (isOnTime) {
      vData.onTimePo++;
      grp.poStats.totalOnTime++;
      aggregatedPoStats.totalOnTime++;
    } else {
      vData.latePo++;
    }

    var orderObj = {
      poNum: noPo,
      vendor: vendorName,
      product: item,
      expectedDate: expDate ? formatDate(expDate) : '-',
      effectiveDate: (effDate && effDate.toString().trim() !== '-') ? formatDate(effDate) : 'Belum Diterima',
      status: status,
      isOnTime: isOnTime,
      nilai: nilai,
      periode: pId
    };

    grp.rawOrders.push(orderObj);
    vData.recentOrders.push(orderObj);
  }

  // Finalisasi kelompok periode
  var finalPeriods = {};
  for (var k in periodGroups) {
    var g = periodGroups[k];
    var vList = [];
    for (var vk in g.vendorsMap) vList.push(g.vendorsMap[vk]);

    for (var vKey in g.poStats.vendorMap) {
      var vItem = g.poStats.vendorMap[vKey];
      vItem.onTimeRatePct = vItem.totalPo > 0 ? Math.round((vItem.onTimePo / vItem.totalPo) * 100) : 100;
    }
    g.poStats.overallOnTimePct = g.poStats.totalOrders > 0
      ? Math.round((g.poStats.totalOnTime / g.poStats.totalOrders) * 100)
      : 100;

    finalPeriods[k] = {
      id: g.id,
      label: g.label,
      sheetName: g.sheetName,
      year: g.year,
      quarter: g.quarter,
      vendors: vList,
      poStats: g.poStats,
      rawOrders: g.rawOrders
    };
  }

  return {
    periods: finalPeriods,
    aggregatedPoStats: aggregatedPoStats
  };
}

/**
 * Ekstrak Kuartal dan Tahun dari nilai tanggal atau nomor PO
 */
function extractQuarterAndYear(dateVal, noPo) {
  if (dateVal) {
    if (dateVal instanceof Date && !isNaN(dateVal.getTime())) {
      var year = dateVal.getFullYear();
      var month = dateVal.getMonth() + 1;
      var quarter = Math.floor((month - 1) / 3) + 1;
      return { id: 'Q' + quarter + ' ' + year, year: year, quarter: quarter };
    }
    var str = dateVal.toString().trim();
    var isoMatch = str.match(/(20\d{2})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (isoMatch) {
      var year = parseInt(isoMatch[1], 10);
      var month = parseInt(isoMatch[2], 10);
      if (month >= 1 && month <= 12) {
        var quarter = Math.floor((month - 1) / 3) + 1;
        return { id: 'Q' + quarter + ' ' + year, year: year, quarter: quarter };
      }
    }
    var ddmmyyyyMatch = str.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](20\d{2})/);
    if (ddmmyyyyMatch) {
      var year = parseInt(ddmmyyyyMatch[3], 10);
      var month = parseInt(ddmmyyyyMatch[2], 10);
      if (month >= 1 && month <= 12) {
        var quarter = Math.floor((month - 1) / 3) + 1;
        return { id: 'Q' + quarter + ' ' + year, year: year, quarter: quarter };
      }
    }
    try {
      var d = new Date(str);
      if (!isNaN(d.getTime())) {
        var year = d.getFullYear();
        var month = d.getMonth() + 1;
        var quarter = Math.floor((month - 1) / 3) + 1;
        return { id: 'Q' + quarter + ' ' + year, year: year, quarter: quarter };
      }
    } catch(e) {}
  }

  // Fallback: deteksi tanggal dari nomor PO (misal: PO/EKI/S/2026/06/29/221 -> Q2 2026)
  if (noPo) {
    var poMatch = noPo.toString().match(/(20\d{2})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (poMatch) {
      var year = parseInt(poMatch[1], 10);
      var month = parseInt(poMatch[2], 10);
      if (month >= 1 && month <= 12) {
        var quarter = Math.floor((month - 1) / 3) + 1;
        return { id: 'Q' + quarter + ' ' + year, year: year, quarter: quarter };
      }
    }
  }

  return { id: 'General', year: 2026, quarter: 0 };
}

function mergePoStats(target, source) {
  target.totalOrders += source.totalOrders;
  target.totalOnTime += source.totalOnTime;
  target.totalValue += source.totalValue;

  for (var vName in source.vendorMap) {
    var sData = source.vendorMap[vName];
    if (!target.vendorMap[vName]) {
      target.vendorMap[vName] = {
        totalPo: 0,
        onTimePo: 0,
        latePo: 0,
        totalValue: 0,
        onTimeRatePct: 0,
        recentOrders: []
      };
    }
    var tData = target.vendorMap[vName];
    tData.totalPo += sData.totalPo;
    tData.onTimePo += sData.onTimePo;
    tData.latePo += sData.latePo;
    tData.totalValue += sData.totalValue;
    tData.recentOrders = tData.recentOrders.concat(sData.recentOrders).slice(0, 5);
  }
}

/**
 * Helper untuk mem-parsing Quarter & Tahun dari nama sheet
 */
function parsePeriodName(sheetName) {
  var raw = sheetName.trim();
  var qMatch = raw.match(/(?:q|quartal|kuartal|triwulan|quarter)\s*([1-4])/i);
  var yMatch = raw.match(/(20\d{2})/);

  var quarter = qMatch ? parseInt(qMatch[1], 10) : 0;
  var year = yMatch ? parseInt(yMatch[1], 10) : 0;

  if (quarter > 0 && year > 0) {
    return {
      isPeriodSheet: true,
      quarter: quarter,
      year: year,
      id: 'Q' + quarter + ' ' + year,
      label: 'Q' + quarter + ' ' + year
    };
  }

  if (year > 0) {
    return {
      isPeriodSheet: true,
      quarter: 0,
      year: year,
      id: raw,
      label: raw
    };
  }

  return {
    isPeriodSheet: false,
    quarter: 0,
    year: 0,
    id: raw,
    label: raw
  };
}

/**
 * Membaca data PO dari sebuah sheet dan mengekstrak daftar vendor yang ada
 */
function parsePoFromSheet(sheet, masterMap) {
  var stats = {
    totalOrders: 0,
    totalOnTime: 0,
    totalValue: 0,
    overallOnTimePct: 0,
    vendorMap: {}
  };
  var vendorMapInside = {};
  var vendorList = [];
  var rawOrders = [];

  if (!sheet || sheet.getLastRow() < 2) {
    return { hasData: false, poStats: stats, vendors: [], rawOrders: [] };
  }

  var data = sheet.getDataRange().getValues();
  if (data.length < 2) {
    return { hasData: false, poStats: stats, vendors: [], rawOrders: [] };
  }

  // Cari baris header di 5 baris pertama (jika ada baris judul/kosong di atas tabel)
  var headerRowIdx = 0;
  var headers = [];
  var idxVendor = -1;

  for (var r = 0; r < Math.min(data.length, 5); r++) {
    var candidateHeaders = data[r].map(function(h) { return h ? h.toString().trim().toLowerCase() : ''; });
    var foundV = getHeaderIndex(candidateHeaders, ['vendor', 'nama vendor', 'supplier', 'rekanan', 'partner']);
    if (foundV !== -1) {
      headerRowIdx = r;
      headers = candidateHeaders;
      idxVendor = foundV;
      break;
    }
  }

  // Jika tidak ditemukan kata 'vendor', ambil baris pertama sebagai header default
  if (idxVendor === -1) {
    headerRowIdx = 0;
    headers = data[0].map(function(h) { return h ? h.toString().trim().toLowerCase() : ''; });
    idxVendor = getHeaderIndex(headers, ['vendor', 'nama vendor', 'supplier', 'rekanan', 'partner']);
  }

  var idxNoPo = getHeaderIndex(headers, ['no po', 'nopo', 'order reference', 'po number', 'po', 'reference', 'number', 'kode po']);
  var idxItem = getHeaderIndex(headers, ['barangjasa', 'barang jasa', 'barang/jasa', 'product', 'item', 'deskripsi', 'item/deskripsi', 'display name', 'uraian']);
  var idxNilai = getHeaderIndex(headers, ['total', 'grand total', 'total untaxed amount', 'nilai', 'nilai (rp)', 'harga', 'amount', 'nominal']);
  var idxExp = getHeaderIndex(headers, ['expected date', 'tanggal diharapkan', 'deadline', 'diharapkan', 'tgl estimasi', 'scheduled date']);
  var idxEff = getHeaderIndex(headers, ['tanggal diterima', 'effective date', 'effective date / tanggal diterima', 'diterima', 'realisasi', 'tgl selesai', 'delivery with receipt date']);

  if (idxVendor === -1) {
    return { hasData: false, poStats: stats, vendors: [], rawOrders: [] };
  }

  for (var i = headerRowIdx + 1; i < data.length; i++) {
    var vendorName = data[i][idxVendor] ? data[i][idxVendor].toString().replace(/[\r\n]+/g, ' ').trim() : '';
    if (!vendorName) continue;

    var noPo = idxNoPo !== -1 && data[i][idxNoPo] ? data[i][idxNoPo].toString().trim() : 'PO-' + i;
    var nilai = idxNilai !== -1 ? parseFloat(data[i][idxNilai]) || 0 : 0;
    var expDate = idxExp !== -1 ? data[i][idxExp] : '';
    var effDate = idxEff !== -1 ? data[i][idxEff] : '';
    var item = idxItem !== -1 && data[i][idxItem] ? data[i][idxItem].toString().trim() : 'Barang/Jasa';

    stats.totalOrders++;
    stats.totalValue += nilai;

    var vKeyLower = vendorName.toLowerCase();
    if (!vendorMapInside[vKeyLower]) {
      var masterInfo = masterMap[vKeyLower];
      vendorMapInside[vKeyLower] = {
        nama: masterInfo ? masterInfo.nama : vendorName,
        kategori: masterInfo ? masterInfo.kategori : 'BARANG_JASA',
        kontak: masterInfo ? masterInfo.kontak : '-',
        alamat: masterInfo ? masterInfo.alamat : '-'
      };
    }

    if (!stats.vendorMap[vendorName]) {
      stats.vendorMap[vendorName] = {
        totalPo: 0,
        onTimePo: 0,
        latePo: 0,
        totalValue: 0,
        onTimeRatePct: 0,
        recentOrders: []
      };
    }

    var vData = stats.vendorMap[vendorName];
    vData.totalPo++;
    vData.totalValue += nilai;

    var isOnTime = false;
    var status = 'Proses';

    if (effDate && effDate.toString().trim() !== '' && effDate.toString().trim() !== '-') {
      var dateExp = new Date(expDate);
      var dateEff = new Date(effDate);
      if (!isNaN(dateExp.getTime()) && !isNaN(dateEff.getTime())) {
        if (dateEff <= dateExp || (dateEff - dateExp) <= 86400000) {
          isOnTime = true;
          status = 'Selesai (Tepat Waktu)';
        } else {
          status = 'Selesai (Terlambat)';
        }
      } else {
        status = 'Selesai';
      }
    } else if (expDate) {
      var now = new Date();
      var dateExp = new Date(expDate);
      if (!isNaN(dateExp.getTime())) {
        if (now <= dateExp) {
          isOnTime = true;
          status = 'Proses';
        } else {
          status = 'Terlambat (Belum Diterima)';
        }
      }
    }

    if (isOnTime) {
      vData.onTimePo++;
      stats.totalOnTime++;
    } else {
      vData.latePo++;
    }

    var orderObj = {
      poNum: noPo,
      vendor: vendorName,
      product: item,
      expectedDate: expDate ? formatDate(expDate) : '-',
      effectiveDate: (effDate && effDate.toString().trim() !== '-') ? formatDate(effDate) : 'Belum Diterima',
      status: status,
      isOnTime: isOnTime,
      nilai: nilai,
      periode: sheet.getName().trim()
    };

    rawOrders.push(orderObj);
    vData.recentOrders.push(orderObj);
  }

  for (var vk in stats.vendorMap) {
    var vItem = stats.vendorMap[vk];
    vItem.onTimeRatePct = vItem.totalPo > 0 ? Math.round((vItem.onTimePo / vItem.totalPo) * 100) : 100;
  }
  stats.overallOnTimePct = stats.totalOrders > 0 ? Math.round((stats.totalOnTime / stats.totalOrders) * 100) : 100;

  for (var k in vendorMapInside) {
    vendorList.push(vendorMapInside[k]);
  }

  return {
    hasData: stats.totalOrders > 0,
    poStats: stats,
    vendors: vendorList,
    rawOrders: rawOrders
  };
}

/**
 * ------------------------------------------------------------------------------
 * DATABASE READ FUNCTIONS
 * ------------------------------------------------------------------------------
 */

function getKategoriVendor(ss) {
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss ? ss.getSheetByName(SHEET_KATEGORI_VENDOR) : null;
  var list = [];
  if (sheet && sheet.getLastRow() >= 2) {
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      var kode = data[i][0] ? data[i][0].toString().trim() : '';
      var nama = data[i][1] ? data[i][1].toString().trim() : '';
      var ikon = data[i][2] ? data[i][2].toString().trim() : '📦';
      if (kode) {
        list.push({ kode: kode, nama: nama, ikon: ikon });
      }
    }
  }
  // Jika sheet kosong atau belum ada, gunakan 9 kategori standar dari CATEGORY_KRITERIA_MAP
  if (list.length === 0) {
    var catIcons = {
      'BarangJasa': '📦', 'Branding': '📣', 'KOLInfPodcast': '🎙️',
      'PhotoVideo': '📸', 'Konsultan': '💼', 'ITSoftware': '💻',
      'EventOrganizer': '🎪', 'BrandAmbasador': '🌟', 'DigitalMarketing': '📱'
    };
    for (var catKey in CATEGORY_KRITERIA_MAP) {
      list.push({
        kode: catKey,
        nama: catKey,
        ikon: catIcons[catKey] || '📦'
      });
    }
  }
  return list;
}

function getAllVendors(ss) {
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss ? ss.getSheetByName(SHEET_DAFTAR_VENDOR) : null;
  var list = [];
  if (sheet && sheet.getLastRow() >= 2) {
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      var nama = data[i][0] ? data[i][0].toString().trim() : '';
      var kategori = data[i][1] ? data[i][1].toString().trim() : '';
      var kontak = data[i][2] ? data[i][2].toString().trim() : '-';
      var alamat = data[i][3] ? data[i][3].toString().trim() : '-';
      if (nama && nama.toLowerCase() !== 'nama vendor') {
        list.push({ nama: nama, kategori: kategori, kontak: kontak, alamat: alamat });
      }
    }
  }
  return list;
}

function isCriteriaAdminOnly(qText, tag) {
  if (tag) {
    var tagStr = tag.toString().trim().toLowerCase();
    if (tagStr === 'y' || tagStr === 'ya' || tagStr === 'yes' || tagStr === 'true' || tagStr === 'admin' || tagStr === '1') {
      return true;
    }
  }
  var t = (qText || '').toString().toLowerCase();
  return t.indexOf('dokumen legal') !== -1 ||
         t.indexOf('dokumen transaksi') !== -1 ||
         t.indexOf('validasi dokumen') !== -1 ||
         t.indexOf('kelengkapan & validasi') !== -1 ||
         t.indexOf('[admin]') !== -1 ||
         t.indexOf('(admin)') !== -1;
}

function getKriteriaPenilaian(ss) {
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  var list = [];

  // 1. Coba baca dari sheet "Kriteria Penilaian" jika ada
  var sheet = ss ? ss.getSheetByName(SHEET_KRITERIA_PENILAIAN) : null;
  if (sheet && sheet.getLastRow() >= 2) {
    var data = sheet.getDataRange().getValues();
    var header = data[0].map(function(h) { return h.toString().trim().toLowerCase(); });
    var isHorizontal = header.some(function(h) { return h.indexOf('pertanyaan') !== -1; }) || (header[1] && header[1].indexOf('vendor') !== -1);

    if (isHorizontal) {
      for (var i = 1; i < data.length; i++) {
        var kategori = data[i][0] ? data[i][0].toString().trim() : 'BarangJasa';
        var vendorSpesifik = data[i][1] ? data[i][1].toString().trim() : '';
        if (vendorSpesifik.toLowerCase() === 'semua') vendorSpesifik = '';

        for (var col = 2; col < data[i].length; col++) {
          var qVal = data[i][col];
          if (qVal && qVal.toString().trim() !== '' && qVal.toString().trim().toLowerCase() !== 'null') {
            var qText = qVal.toString().trim();
            var id = generateQuestionId(qText);
            list.push({
              id: id,
              kriteria: qText,
              deskripsi: getQuestionDescription(qText),
              kategori: normalizeCategoryCode(kategori),
              vendorSpesifik: vendorSpesifik,
              adminOnly: isCriteriaAdminOnly(qText)
            });
          }
        }
      }
    } else {
      for (var i = 1; i < data.length; i++) {
        var kategori = data[i][0] ? data[i][0].toString().trim() : '';
        var kriteria = data[i][1] ? data[i][1].toString().trim() : '';
        var deskripsi = data[i][2] ? data[i][2].toString().trim() : '';

        if (kriteria && kriteria.toLowerCase() !== 'kriteria') {
          var id = generateQuestionId(kriteria);
          var adminColIdx = getHeaderIndex(header, ['admin', 'admin only', 'admin_only', 'khusus admin']);
          var adminTag = adminColIdx !== -1 ? data[i][adminColIdx] : (data[i][3] || '');
          list.push({
            id: id,
            kriteria: kriteria,
            deskripsi: deskripsi || getQuestionDescription(kriteria),
            kategori: normalizeCategoryCode(kategori),
            vendorSpesifik: '',
            adminOnly: isCriteriaAdminOnly(kriteria, adminTag)
          });
        }
      }
    }
  }

  // 2. Jika sheet Kriteria Penilaian tidak ada/kosong, baca langsung dari HEADER SHEET "Penilaian - <Kategori>"!
  if (list.length === 0 && ss) {
    for (var catCode in CATEGORY_KRITERIA_MAP) {
      var catSheet = ss.getSheetByName('Penilaian - ' + catCode);
      if (catSheet && catSheet.getLastColumn() >= 5) {
        var headers = catSheet.getRange(1, 1, 1, catSheet.getLastColumn()).getValues()[0];
        // Kolom 1-4: Timestamp, Nama Penilai, Nama Vendor, Periode
        // Kolom terakhir 3: Rata-rata Skor, Predikat, Catatan
        for (var h = 4; h < headers.length; h++) {
          var hName = headers[h].toString().trim();
          var hLower = hName.toLowerCase();
          if (hLower.indexOf('rata') !== -1 || hLower === 'skor' || hLower.indexOf('predikat') !== -1 || hLower.indexOf('catatan') !== -1) {
            continue;
          }
          var cleanQ = hName.replace(/\s*\([0-9-]+\)\s*$/, '').trim();
          if (cleanQ) {
            list.push({
              id: generateQuestionId(cleanQ),
              kriteria: cleanQ,
              deskripsi: getQuestionDescription(cleanQ),
              kategori: catCode,
              vendorSpesifik: '',
              adminOnly: isCriteriaAdminOnly(cleanQ)
            });
          }
        }
      }
    }
  }

  // 3. Fallback: jika sheet belum dibuat, ambil dari CATEGORY_KRITERIA_MAP
  if (list.length === 0) {
    for (var catCode in CATEGORY_KRITERIA_MAP) {
      var questions = CATEGORY_KRITERIA_MAP[catCode];
      for (var q = 0; q < questions.length; q++) {
        var qText = questions[q];
        list.push({
          id: generateQuestionId(qText),
          kriteria: qText,
          deskripsi: getQuestionDescription(qText),
          kategori: catCode,
          vendorSpesifik: ''
        });
      }
    }
  }

  return list;
}

function getQuestionDescription(qText) {
  var map = {
    'harga': 'Kewajaran, daya saing, dan kesesuaian harga terhadap penawaran/pasar',
    'pelayanan': 'Responsivitas, etika komunikasi, dan profesionalisme layanan',
    'ketepatan waktu': 'Kecepatan dan ketepatan pengiriman/penyelesaian sesuai jadwal PO',
    'kualitas produk it': 'Stabilitas, keaslian, dan performa hardware/software',
    'dukungan teknis': 'Kecepatan tanggapan troubleshooting, klaim garansi & after-sales',
    'garansi & pemeliharaan': 'Cakupan garansi resmi dan kemudahan layanan pemeliharaan',
    'keamanan pengiriman': 'Kondisi fisik barang aman, tidak rusak/hilang saat diterima',
    'jangkauan area': 'Kemampuan menjangkau area pengiriman yang dibutuhkan',
    'ketepatan estimasi': 'Akurasi resi/manifest dan ketersediaan tracking online',
    'kreativitas desain': 'Originalitas ide konsep, estetika desain, dan relevansi visual',
    'kesesuaian brief': 'Kemampuan memahami dan mengeksekusi brief klien dengan tepat',
    'revisi & fleksibilitas': 'Kesediaan dan kecepatan dalam mengakomodasi revisi',
    'kualitas cetak': 'Ketajaman warna, presisi ukuran, dan mutu material cetak',
    'kesesuaian spesifikasi': 'Hasil produksi sesuai spesifikasi teknis dan mock-up',
    'kapasitas progres': 'Kapasitas produksi dan konsistensi kecepatan pesanan',
    'keahlian & kompetensi': 'Tingkat keahlian, pengalaman, dan kompetensi konsultan',
    'kualitas laporan': 'Kelengkapan analisa, kejelasan rekomendasi dan deliverable',
    'dampak & hasil': 'Efektivitas rekomendasi dan dampak nyata bagi operasional',
    'kualitas barang': 'Kesesuaian fisik dan fungsi produk dengan standar spesifikasi',
    'kelengkapan pesanan': 'Ketepatan jumlah dan kelengkapan barang yang dikirim',
    'ketersediaan stok': 'Kemampuan menyediakan barang yang dibutuhkan secara kontinyu'
  };

  var key = qText.toLowerCase().trim();
  return map[key] || ('Penilaian ' + qText);
}

function getPurchaseRequests(ss) {
  var sheet = ss.getSheetByName(SHEET_PR);
  var list = [];
  if (sheet && sheet.getLastRow() >= 2) {
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      var noPr = data[i][0] ? data[i][0].toString().trim() : '';
      if (noPr && noPr.toLowerCase() !== 'no pr') {
        list.push({
          noPr: noPr,
          tanggal: data[i][1] ? formatDate(data[i][1]) : '-',
          pemohon: data[i][2] ? data[i][2].toString().trim() : '',
          departemen: data[i][3] ? data[i][3].toString().trim() : '',
          deskripsi: data[i][4] ? data[i][4].toString().trim() : '',
          nilai: parseFloat(data[i][5]) || 0,
          vendor: data[i][6] ? data[i][6].toString().trim() : '',
          status: data[i][7] ? data[i][7].toString().trim() : 'Pending',
          noPo: data[i][8] ? data[i][8].toString().trim() : ''
        });
      }
    }
  }
  return list;
}

function getVendorScoreSummary(ss) {
  var sheet = getPenilaianVendorSheet(ss);
  var result = {
    summary: {},
    evaluationsList: []
  };

  // Lookup map dari Akses Penilai: vendor -> namaPenilai sebagai fallback
  var vendorToAssessorMap = {};
  try {
    var sheetAkses = getAksesPenilaiSheet(ss);
    if (sheetAkses && sheetAkses.getLastRow() >= 2) {
      var aData = sheetAkses.getDataRange().getValues();
      var aHeaders = aData[0].map(function(h) { return h ? h.toString().trim().toLowerCase() : ''; });
      var aIdxNama = getHeaderIndex(aHeaders, ['nama penilai', 'nama', 'penilai', 'assessor']);
      var aIdxVendor = getHeaderIndex(aHeaders, ['vendor yang boleh dinilai', 'vendor', 'assigned vendors', 'akses']);
      if (aIdxNama !== -1 && aIdxVendor !== -1) {
        for (var ai = 1; ai < aData.length; ai++) {
          var aNama = aData[ai][aIdxNama] ? aData[ai][aIdxNama].toString().trim() : '';
          var aVendors = aData[ai][aIdxVendor] ? aData[ai][aIdxVendor].toString().split(/[\n,;]+/) : [];
          for (var vi = 0; vi < aVendors.length; vi++) {
            var vTrim = aVendors[vi].trim();
            if (vTrim && !vendorToAssessorMap[vTrim.toLowerCase()]) {
              vendorToAssessorMap[vTrim.toLowerCase()] = aNama;
            }
          }
        }
      }
    }
  } catch (err) {}

  if (!sheet || sheet.getLastRow() < 2) return result;

  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return result;

  // Scan 5 baris pertama untuk mencari baris header
  var headerRowIdx = 0;
  var headers = [];
  var idxVendor = -1;

  for (var r = 0; r < Math.min(data.length, 5); r++) {
    var candidateHeaders = data[r].map(function(h) { return h ? h.toString().trim().toLowerCase() : ''; });
    var foundVendor = getHeaderIndex(candidateHeaders, ['nama vendor', 'vendor', 'rekanan', 'supplier', 'nama rekanan']);
    if (foundVendor !== -1) {
      headerRowIdx = r;
      headers = candidateHeaders;
      idxVendor = foundVendor;
      break;
    }
  }

  if (idxVendor === -1) {
    headers = data[0].map(function(h) { return h ? h.toString().trim().toLowerCase() : ''; });
    idxVendor = getHeaderIndex(headers, ['nama vendor', 'vendor', 'rekanan', 'supplier', 'nama rekanan']);
  }

  if (idxVendor === -1) return result;

  var idxAvg = getHeaderIndex(headers, ['rata-rata skor', 'rata-rata', 'ratarata', 'skor rata-rata', 'skor', 'nilai akhir', 'average', 'avg']);
  var idxPred = getHeaderIndex(headers, ['predikat', 'kategori predikat', 'status']);
  var idxPeriode = getHeaderIndex(headers, ['periode penilaian', 'periode', 'kuartal', 'quarter']);
  var idxPenilai = getHeaderIndex(headers, ['nama penilai', 'penilai', 'evaluator', 'nama evaluator', 'assessor', 'nama assessor', 'pic', 'dibuat oleh', 'diisi oleh', 'pengisi', 'user', 'reviewer']);
  var idxTimestamp = getHeaderIndex(headers, ['timestamp', 'tanggal', 'waktu', 'date']);
  var idxCatatan = getHeaderIndex(headers, ['catatan', 'keterangan', 'notes', 'remarks']);

  for (var i = headerRowIdx + 1; i < data.length; i++) {
    var vendor = idxVendor !== -1 && data[i][idxVendor] ? data[i][idxVendor].toString().trim() : '';
    if (!vendor || vendor.toLowerCase() === 'nama vendor' || vendor.toLowerCase() === 'vendor') continue;

    var score = 0;
    if (idxAvg !== -1 && data[i][idxAvg] !== '' && data[i][idxAvg] !== null && data[i][idxAvg] !== undefined) {
      var rawScore = data[i][idxAvg];
      if (typeof rawScore === 'number') {
        score = rawScore;
      } else if (rawScore) {
        var cleanedScore = rawScore.toString().replace(',', '.').replace(/[^0-9.]/g, '');
        score = parseFloat(cleanedScore) || 0;
      }
    }

    // Jika idxAvg tidak ada atau kosong, hitung rata-rata dari kolom kriteria (1-5)
    if (score === 0) {
      var sumCrit = 0;
      var countCrit = 0;
      for (var c = 0; c < headers.length; c++) {
        if (c !== idxVendor && c !== idxPeriode && c !== idxPenilai && c !== idxTimestamp && c !== idxPred && c !== idxCatatan && c !== idxAvg) {
          var val = data[i][c];
          var numVal = 0;
          if (typeof val === 'number') {
            numVal = val;
          } else if (val) {
            numVal = parseFloat(val.toString().replace(',', '.')) || 0;
          }
          if (numVal >= 1 && numVal <= 5) {
            sumCrit += numVal;
            countCrit++;
          }
        }
      }
      if (countCrit > 0) {
        score = Math.round((sumCrit / countCrit) * 100) / 100;
      }
    }

    if (score > 0) {
      var predikat = idxPred !== -1 && data[i][idxPred] ? data[i][idxPred].toString().trim() : getPredikat(score);
      var periode = idxPeriode !== -1 && data[i][idxPeriode] ? data[i][idxPeriode].toString().trim() : 'General';
      var rawPenilai = idxPenilai !== -1 && data[i][idxPenilai] ? data[i][idxPenilai].toString().trim() : '';
      var penilai = (rawPenilai && rawPenilai !== '-' && rawPenilai.toLowerCase() !== 'null') 
        ? rawPenilai 
        : (vendorToAssessorMap[vendor.toLowerCase()] || 'Tim Penilai Pengadaan');
      var timestampStr = idxTimestamp !== -1 && data[i][idxTimestamp] ? formatDate(data[i][idxTimestamp]) : '-';
      var catatan = idxCatatan !== -1 && data[i][idxCatatan] ? data[i][idxCatatan].toString().trim() : '';

      if (!result.summary[vendor]) {
        result.summary[vendor] = {
          totalScore: 0,
          count: 0,
          avgScore: 0,
          predikat: 'Cukup',
          periodeScores: []
        };
      }

      var vSum = result.summary[vendor];
      vSum.totalScore += score;
      vSum.count++;
      vSum.periodeScores.push({ periode: periode, score: score, predikat: predikat });

      result.evaluationsList.push({
        timestamp: timestampStr,
        penilai: penilai,
        vendor: vendor,
        periode: periode,
        score: score,
        predikat: predikat,
        catatan: catatan
      });
    }
  }

  // === JUGA SCAN SHEET "Penilaian - *" UNTUK AGREGASI ===
  var allSheets = ss.getSheets();
  for (var si = 0; si < allSheets.length; si++) {
    var sName = allSheets[si].getName();
    if (sName.indexOf('Penilaian - ') !== 0) continue; // Hanya sheet kategori
    if (allSheets[si].getLastRow() < 2) continue;

    var catData = allSheets[si].getDataRange().getValues();
    var catHeaders = catData[0].map(function(h) { return h ? h.toString().trim().toLowerCase() : ''; });
    var catIdxVendor = getHeaderIndex(catHeaders, ['nama vendor', 'vendor', 'rekanan']);
    var catIdxAvg = getHeaderIndex(catHeaders, ['rata-rata skor', 'rata-rata', 'skor', 'avg']);
    var catIdxPred = getHeaderIndex(catHeaders, ['predikat', 'status']);
    var catIdxPeriode = getHeaderIndex(catHeaders, ['periode penilaian', 'periode']);
    var catIdxPenilai = getHeaderIndex(catHeaders, ['nama penilai', 'penilai', 'evaluator', 'nama evaluator', 'assessor', 'pic', 'user']);
    var catIdxTimestamp = getHeaderIndex(catHeaders, ['timestamp', 'tanggal']);
    var catIdxCatatan = getHeaderIndex(catHeaders, ['catatan', 'notes']);

    if (catIdxVendor === -1) continue;

    for (var ci = 1; ci < catData.length; ci++) {
      var catVendor = catData[ci][catIdxVendor] ? catData[ci][catIdxVendor].toString().trim() : '';
      if (!catVendor) continue;

      var catScore = 0;
      var cSum = 0, cCnt = 0;
      var evalLines = [];
      for (var cc = 0; cc < catHeaders.length; cc++) {
        if (cc !== catIdxVendor && cc !== catIdxAvg && cc !== catIdxPred && cc !== catIdxPeriode && cc !== catIdxPenilai && cc !== catIdxTimestamp && cc !== catIdxCatatan) {
          var cv = typeof catData[ci][cc] === 'number' ? catData[ci][cc] : (parseFloat((catData[ci][cc] || '').toString().replace(',', '.')) || 0);
          if (cv >= 1 && cv <= 5) {
            cSum += cv;
            cCnt++;
            var rawH = catData[0][cc] ? catData[0][cc].toString().trim() : '';
            var cleanH = rawH.replace(/\s*\([0-9-]+\)\s*$/, '').trim();
            evalLines.push({
              name: cleanH,
              score: cv
            });
          }
        }
      }
      if (cCnt > 0) {
        catScore = Math.round((cSum / cCnt) * 100) / 100;
      } else if (catIdxAvg !== -1 && catData[ci][catIdxAvg] !== '' && catData[ci][catIdxAvg] !== null) {
        catScore = typeof catData[ci][catIdxAvg] === 'number' ? catData[ci][catIdxAvg] : (parseFloat(catData[ci][catIdxAvg].toString().replace(',', '.')) || 0);
      }

      if (catScore > 0) {
        var catPredikat = catIdxPred !== -1 && catData[ci][catIdxPred] ? catData[ci][catIdxPred].toString().trim() : getPredikat(catScore);
        var catPeriode = catIdxPeriode !== -1 && catData[ci][catIdxPeriode] ? catData[ci][catIdxPeriode].toString().trim() : 'General';
        var rawCatPenilai = catIdxPenilai !== -1 && catData[ci][catIdxPenilai] ? catData[ci][catIdxPenilai].toString().trim() : '';
        var catPenilai = (rawCatPenilai && rawCatPenilai !== '-' && rawCatPenilai.toLowerCase() !== 'null') 
          ? rawCatPenilai 
          : (vendorToAssessorMap[catVendor.toLowerCase()] || 'Tim Penilai Pengadaan');
        var catTimestamp = catIdxTimestamp !== -1 && catData[ci][catIdxTimestamp] ? formatDate(catData[ci][catIdxTimestamp]) : '-';
        var catCatatan = catIdxCatatan !== -1 && catData[ci][catIdxCatatan] ? catData[ci][catIdxCatatan].toString().trim() : '';
        var catKategoriName = sName.replace(/^Penilaian\s*-\s*/, '');

        // Cek apakah sudah ada entry dari master sheet, jika ada lengkapi dengan lines detail
        var existingEv = result.evaluationsList.find(function(ev) {
          return ev.vendor === catVendor && ev.periode === catPeriode && ev.penilai === catPenilai;
        });
        if (existingEv) {
          existingEv.lines = evalLines;
          existingEv.kategori = catKategoriName;
          continue;
        }

        if (!result.summary[catVendor]) {
          result.summary[catVendor] = { totalScore: 0, count: 0, avgScore: 0, predikat: 'Cukup', periodeScores: [] };
        }
        result.summary[catVendor].totalScore += catScore;
        result.summary[catVendor].count++;
        result.summary[catVendor].periodeScores.push({ periode: catPeriode, score: catScore, predikat: catPredikat });

        result.evaluationsList.push({
          timestamp: catTimestamp, penilai: catPenilai, vendor: catVendor,
          kategori: catKategoriName, periode: catPeriode, score: catScore,
          predikat: catPredikat, catatan: catCatatan, lines: evalLines
        });
      }
    }
  }

  for (var vKey in result.summary) {
    var v = result.summary[vKey];
    v.avgScore = Math.round((v.totalScore / v.count) * 100) / 100;
    v.predikat = getPredikat(v.avgScore);
  }

  return result;
}

/**
 * Standarisasi dan klasifikasi Tahap Progress Kontrak (Workflow Lifecycle)
 */
function normalizeContractStage(rawStage, rawStatus, tglSelesai) {
  var s = (rawStage || '').toString().trim().toLowerCase();
  
  // 1. Persiapan Dokumen
  if (s.indexOf('persiapan dokumen') !== -1 || s.indexOf('pemenuhan') !== -1 || s.indexOf('kelengkapan dokumen') !== -1 || s.indexOf('1. persiapan') !== -1) {
    return {
      step: 1,
      key: 'persiapan_dokumen',
      label: '1. Persiapan Dokumen',
      percent: 10,
      badgeColor: '#0284c7',
      badgeBg: '#f0f9ff',
      isRevision: false,
      isRenvoi: false,
      isFinal: false
    };
  }
  // 3. Review Legal Ethos
  if (s.indexOf('review legal ethos') !== -1 || s.indexOf('review ethos') !== -1 || s.indexOf('legal ethos') !== -1 || s.indexOf('3. review') !== -1) {
    return {
      step: 3,
      key: 'review_legal_ethos',
      label: '3. Review Legal Ethos',
      percent: 30,
      badgeColor: '#4f46e5',
      badgeBg: '#eef2ff',
      isRevision: false,
      isRenvoi: false,
      isFinal: false
    };
  }
  // 5. Review Vendor
  if (s.indexOf('review vendor') !== -1 || s.indexOf('review legal vendor') !== -1 || s.indexOf('5. review') !== -1) {
    return {
      step: 5,
      key: 'review_vendor',
      label: '5. Review Vendor',
      percent: 55,
      badgeColor: '#c026d3',
      badgeBg: '#fdf4ff',
      isRevision: false,
      isRenvoi: false,
      isFinal: false
    };
  }
  // 2. Pengajuan Ke Legal
  if (s.indexOf('pengajuan') !== -1 || s.indexOf('masuk legal') !== -1 || s.indexOf('ajukan') !== -1 || s.indexOf('2. pengajuan') !== -1) {
    return {
      step: 2,
      key: 'pengajuan',
      label: '2. Pengajuan Ke Legal',
      percent: 20,
      badgeColor: '#2563eb',
      badgeBg: '#eff6ff',
      isRevision: false,
      isRenvoi: false,
      isFinal: false
    };
  }
  // 4. Draft Keluar
  if (s.indexOf('draft') !== -1 || s.indexOf('penyusunan') !== -1 || s.indexOf('4. draft') !== -1) {
    return {
      step: 4,
      key: 'draft',
      label: '4. Draft Keluar',
      percent: 45,
      badgeColor: '#7c3aed',
      badgeBg: '#f5f3ff',
      isRevision: false,
      isRenvoi: false,
      isFinal: false
    };
  }
  // 6. Paraf & Tanda Tangan Vendor
  if (s.indexOf('paraf & tanda tangan vendor') !== -1 || s.indexOf('paraf & ttd vendor') !== -1 || s.indexOf('paraf vendor') !== -1 || s.indexOf('ttd vendor') !== -1 || s.indexOf('6. paraf') !== -1) {
    return {
      step: 6,
      key: 'paraf_ttd_vendor',
      label: '6. Paraf & Tanda Tangan Vendor',
      percent: 70,
      badgeColor: '#d97706',
      badgeBg: '#fffbeb',
      isRevision: false,
      isRenvoi: false,
      isFinal: false
    };
  }
  // 7. Paraf & Tanda Tangan Ethos
  if (s.indexOf('paraf & tanda tangan ethos') !== -1 || s.indexOf('paraf & ttd ethos') !== -1 || s.indexOf('paraf ethos') !== -1 || s.indexOf('paraf internal') !== -1 || s.indexOf('ttd ethos') !== -1 || s.indexOf('7. paraf') !== -1 || s.indexOf('tanda tangan') !== -1 || s.indexOf('ttd') !== -1) {
    return {
      step: 7,
      key: 'paraf_ttd_ethos',
      label: '7. Paraf & Tanda Tangan Ethos',
      percent: 85,
      badgeColor: '#9333ea',
      badgeBg: '#faf5ff',
      isRevision: false,
      isRenvoi: false,
      isFinal: false
    };
  }
  // 9. Renvoi (Jika Ada)
  if (s.indexOf('renvoi') !== -1 || s.indexOf('9. renvoi') !== -1) {
    return {
      step: 9,
      key: 'renvoi',
      label: '9. Renvoi (Jika Ada)',
      percent: 90,
      badgeColor: '#ea580c',
      badgeBg: '#fff7ed',
      isRevision: false,
      isRenvoi: true,
      isFinal: false
    };
  }
  // 10. Kontrak Selesai
  if (s.indexOf('kontrak selesai') !== -1 || s.indexOf('selesai') !== -1 || s.indexOf('expired') !== -1 || s.indexOf('kadaluarsa') !== -1 || s.indexOf('berakhir') !== -1 || s.indexOf('10. kontrak') !== -1 || s.indexOf('11. berakhir') !== -1) {
    return {
      step: 10,
      key: 'selesai',
      label: '10. Kontrak Selesai',
      percent: 100,
      badgeColor: '#64748b',
      badgeBg: '#f8fafc',
      isRevision: false,
      isRenvoi: false,
      isFinal: true
    };
  }
  // 8. Kontrak Aktif
  if (s.indexOf('kontrak aktif') !== -1 || s.indexOf('aktif') !== -1 || s.indexOf('berlaku') !== -1 || s.indexOf('done') !== -1 || s.indexOf('8. kontrak') !== -1 || s.indexOf('10. aktif') !== -1) {
    return {
      step: 8,
      key: 'aktif',
      label: '8. Kontrak Aktif',
      percent: 100,
      badgeColor: '#16a34a',
      badgeBg: '#f0fdf4',
      isRevision: false,
      isRenvoi: false,
      isFinal: true
    };
  }

  // Jika ada custom teks dari sheet
  if (rawStage && rawStage.toString().trim() !== '') {
    return {
      step: 0,
      key: 'lainnya',
      label: rawStage.toString().trim(),
      percent: 50,
      badgeColor: '#475569',
      badgeBg: '#f1f5f9',
      isRevision: false,
      isRenvoi: false,
      isFinal: false
    };
  }

  // Default fallback: bila status Comply dan masih berlaku, anggap Aktif
  var isComply = (rawStatus || '').toString().toLowerCase().indexOf('comply') !== -1;
  if (isComply) {
    return {
      step: 8,
      key: 'aktif',
      label: '8. Kontrak Aktif',
      percent: 100,
      badgeColor: '#16a34a',
      badgeBg: '#f0fdf4',
      isRevision: false,
      isRenvoi: false,
      isFinal: true
    };
  }

  return {
    step: 2,
    key: 'pengajuan',
    label: '2. Pengajuan Ke Legal',
    percent: 20,
    badgeColor: '#2563eb',
    badgeBg: '#eff6ff',
    isRevision: false,
    isRenvoi: false,
    isFinal: false
  };
}

/**
 * Mendapatkan data kepatuhan kontrak & progress lifecycle (Contract Repository & Compliance)
 */
function getContractCompliance(ss) {
  var sheet = getKontrakVendorSheet(ss);
  var stats = {
    totalContracts: 0,
    totalCompliantContracts: 0,
    complianceRate: 100,
    uniqueContractedVendors: 0,
    uniqueCompliantVendors: 0,
    vendorComplianceRate: 100,
    stageCounts: {
      all: 0,
      persiapan_dokumen: 0,
      pengajuan: 0,
      review_legal_ethos: 0,
      draft: 0,
      review_vendor: 0,
      paraf_ttd_vendor: 0,
      paraf_ttd_ethos: 0,
      aktif: 0,
      renvoi: 0,
      selesai: 0,
      lainnya: 0
    },
    totalActive: 0,
    totalInProgress: 0,
    totalRevisiRenvoi: 0,
    totalOverdueSla: 0,
    list: []
  };

  if (!sheet || sheet.getLastRow() < 2) return stats;

  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return stats;

  // Cari baris header di 5 baris pertama (jika ada baris judul/kosong di atas tabel)
  var headerRowIdx = 0;
  var headers = [];
  var idxNo = -1;
  var idxVendor = -1;

  for (var r = 0; r < Math.min(data.length, 5); r++) {
    var candidateHeaders = data[r].map(function(h) { return h ? h.toString().trim().toLowerCase() : ''; });
    var foundNo = getHeaderIndex(candidateHeaders, ['no kontrak', 'nomor kontrak', 'kode kontrak', 'no', 'kontrak', 'id kontrak']);
    var foundVendor = getHeaderIndex(candidateHeaders, ['vendor', 'nama vendor', 'rekanan', 'supplier', 'partner']);
    if (foundNo !== -1 || foundVendor !== -1) {
      headerRowIdx = r;
      headers = candidateHeaders;
      idxNo = foundNo;
      idxVendor = foundVendor;
      break;
    }
  }

  if (idxVendor === -1 && idxNo === -1) {
    headerRowIdx = 0;
    headers = data[0].map(function(h) { return h ? h.toString().trim().toLowerCase() : ''; });
    idxNo = getHeaderIndex(headers, ['no kontrak', 'nomor kontrak', 'kode kontrak', 'no', 'kontrak', 'id kontrak']);
    idxVendor = getHeaderIndex(headers, ['vendor', 'nama vendor', 'rekanan', 'supplier', 'partner']);
  }

  var idxPekerjaan = getHeaderIndex(headers, ['jenis pekerjaan', 'pekerjaan', 'ruang lingkup', 'deskripsi', 'uraian', 'item', 'scope of work', 'scope']);
  var idxDivisi = getHeaderIndex(headers, ['pic / divisi', 'pic', 'divisi', 'dept', 'departemen', 'pemohon', 'user', 'pic pengaju', 'divisi pemohon']);
  
  // 10 Tanggal Alur PKS Sesuai Standar Baru & Tanggal Tanggal Eksisting
  var idxTglDokumen = getHeaderIndex(headers, ['1. persiapan dokumen', 'persiapan dokumen', 'tanggal persiapan dokumen', 'tgl persiapan dokumen', 'tanggal dokumen', 'tgl dokumen', 'tanggal pemenuhan dokumen', 'tgl pemenuhan dokumen', 'dokumen lengkap', 'tgl kelengkapan', 'dokumen']);
  var idxTglPengajuan = getHeaderIndex(headers, ['2. pengajuan ke legal', 'pengajuan ke legal', 'tanggal pengajuan ke legal', 'tgl pengajuan ke legal', 'tgl pengajuan', 'tanggal pengajuan', 'tgl masuk legal', 'tanggal masuk', 'tgl ajukan', 'pengajuan legal', 'masuk legal']);
  var idxTglReviewEthos = getHeaderIndex(headers, ['3. review legal ethos', 'review legal ethos', 'tanggal review legal ethos', 'tgl review legal ethos', 'tgl review ethos', 'tanggal review ethos', 'tgl review internal', 'review ethos']);
  var idxTglDraft = getHeaderIndex(headers, ['4. draft keluar', 'draft keluar', 'tanggal draft keluar', 'tgl draft keluar', 'tgl draft', 'tanggal draft', 'tgl draf', 'draft']);
  var idxTglReviewVendor = getHeaderIndex(headers, ['5. review vendor', 'review vendor', 'tanggal review vendor', 'tgl review vendor', 'tanggal review legal vendor', 'tgl review legal vendor', 'tgl review rekanan', 'review legal vendor']);
  var idxTglParafVendor = getHeaderIndex(headers, ['6. paraf & tanda tangan vendor', 'paraf & tanda tangan vendor', 'paraf & ttd vendor', 'tanggal paraf & tanda tangan vendor', 'tanggal paraf & ttd vendor', 'tanggal paraf vendor', 'tgl paraf vendor', 'tgl paraf rekanan', 'paraf vendor']);
  var idxTglParafEthos = getHeaderIndex(headers, ['7. paraf & tanda tangan ethos', 'paraf & tanda tangan ethos', 'paraf & ttd ethos', 'tanggal paraf & tanda tangan ethos', 'tanggal paraf & ttd ethos', 'tanggal paraf ethos', 'tgl paraf ethos', 'tgl paraf internal', 'paraf ethos']);
  
  // Alur 8: Kontrak Aktif / Tanggal Mulai Kontrak (dukung kolom Alur maupun kolom lama)
  var idxStep8 = getHeaderIndex(headers, ['8. kontrak aktif', '8. aktif', 'kontrak aktif', 'aktif sah', 'tanggal kontrak aktif', 'tgl kontrak aktif']);
  var idxTglMulaiKontrak = getHeaderIndex(headers, ['tanggal mulai kontrak', 'tgl mulai kontrak', 'tanggal mulai', 'tgl mulai', 'mulai', 'start date', 'periode awal']);
  var idxMulai = idxStep8 !== -1 ? idxStep8 : idxTglMulaiKontrak;

  // Alur 9: Renvoi
  var idxTglRenvoi = getHeaderIndex(headers, ['9. renvoi (jika ada)', '9. renvoi', 'renvoi (jika ada)', 'renvoi', 'tanggal renvoi', 'tgl renvoi', 'tgl addendum', 'tanggal addendum']);

  // Alur 10: Kontrak Selesai / Tanggal Selesai Kontrak / Masa Berlaku
  var idxStep10 = getHeaderIndex(headers, ['10. kontrak selesai', '10. selesai', 'kontrak selesai (step 10)']);
  var idxTglSelesaiKontrak = getHeaderIndex(headers, ['tanggal selesai kontrak', 'tgl selesai kontrak', 'tanggal selesai', 'tgl selesai', 'tanggal berakhir', 'tgl berakhir', 'masa berlaku', 'expired', 'end date', 'deadline', 'periode akhir']);
  var idxSelesai = idxStep10 !== -1 ? idxStep10 : idxTglSelesaiKontrak;

  var idxTargetSla = getHeaderIndex(headers, ['target selesai sla', 'target selesai', 'target legal', 'sla target', 'sla', 'target draft', 'deadline proses']);
  var idxTglRealisasi = getHeaderIndex(headers, ['tanggal realisasi ttd', 'tgl realisasi ttd', 'tgl realisasi', 'tanggal selesai proses', 'tgl ttd', 'tanggal ttd', 'tgl sah', 'realisasi ttd']);
  var idxTglRevisi = getHeaderIndex(headers, ['tanggal revisi', 'tgl revisi', 'tgl perbaikan', 'tanggal perbaikan', 'tgl catatan revisi']);

  var idxTahap = getHeaderIndex(headers, ['tahap progress pengerjaan', 'tahap progress', 'progress pengerjaan', 'progress', 'tahap', 'status progress', 'tahapan', 'current stage', 'workflow', 'status pengerjaan', 'tahap pengerjaan']);
  var idxRevisi = getHeaderIndex(headers, ['status revisi / renvoi', 'status revisi', 'revisi', 'renvoi', 'revisi / renvoi', 'catatan revisi', 'addendum', 'keterangan revisi']);
  var idxKelengkapan = getHeaderIndex(headers, ['kelengkapan dokumen', 'kelengkapan', 'dokumen', 'status dokumen', 'legalitas']);
  var idxNilai = getHeaderIndex(headers, ['nilai kontrak (rp)', 'nilai kontrak', 'nilai', 'nominal', 'amount', 'harga', 'total', 'nominal kontrak']);
  var idxStatus = getHeaderIndex(headers, ['status kepatuhan', 'status', 'kepatuhan', 'compliance']);
  var idxLink = getHeaderIndex(headers, ['link dokumen kontrak', 'link dokumen', 'link draft', 'link', 'url', 'dokumen link', 'drive link', 'file kontrak', 'lampiran']);
  var idxKeterangan = getHeaderIndex(headers, ['keterangan', 'catatan', 'remarks', 'note', 'catatan tambahan']);

  var uniqueVendors = {};
  var now = new Date();
  var todayZero = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  for (var i = headerRowIdx + 1; i < data.length; i++) {
    var noKontrak = idxNo !== -1 && data[i][idxNo] ? data[i][idxNo].toString().trim() : (data[i][0] ? data[i][0].toString().trim() : '');
    var vendor = idxVendor !== -1 && data[i][idxVendor] ? data[i][idxVendor].toString().trim() : (data[i][1] ? data[i][1].toString().trim() : '');
    if (!noKontrak || !vendor || noKontrak.toLowerCase() === 'no kontrak' || noKontrak.toLowerCase() === 'nomor kontrak') {
      continue;
    }

    var jenisPekerjaan = idxPekerjaan !== -1 && data[i][idxPekerjaan] ? data[i][idxPekerjaan].toString().trim() : '-';
    var picDivisi = idxDivisi !== -1 && data[i][idxDivisi] ? data[i][idxDivisi].toString().trim() : '-';
    
    // 10 Tanggal Alur PKS
    var tglDokumen = idxTglDokumen !== -1 && data[i][idxTglDokumen] ? formatDate(data[i][idxTglDokumen]) : '-';
    var tglPengajuan = idxTglPengajuan !== -1 && data[i][idxTglPengajuan] ? formatDate(data[i][idxTglPengajuan]) : '-';
    var tglReviewEthos = idxTglReviewEthos !== -1 && data[i][idxTglReviewEthos] ? formatDate(data[i][idxTglReviewEthos]) : '-';
    var tglDraft = idxTglDraft !== -1 && data[i][idxTglDraft] ? formatDate(data[i][idxTglDraft]) : '-';
    var tglReviewVendor = idxTglReviewVendor !== -1 && data[i][idxTglReviewVendor] ? formatDate(data[i][idxTglReviewVendor]) : '-';
    var tglParafVendor = idxTglParafVendor !== -1 && data[i][idxTglParafVendor] ? formatDate(data[i][idxTglParafVendor]) : '-';
    var tglParafEthos = idxTglParafEthos !== -1 && data[i][idxTglParafEthos] ? formatDate(data[i][idxTglParafEthos]) : '-';
    
    // 8. Kontrak Aktif / Mulai
    var valStep8 = idxStep8 !== -1 && data[i][idxStep8] ? formatDate(data[i][idxStep8]) : '-';
    var valMulai = idxTglMulaiKontrak !== -1 && data[i][idxTglMulaiKontrak] ? formatDate(data[i][idxTglMulaiKontrak]) : '-';
    var tglMulai = valStep8 !== '-' ? valStep8 : (valMulai !== '-' ? valMulai : '-');

    var tglRenvoi = idxTglRenvoi !== -1 && data[i][idxTglRenvoi] ? formatDate(data[i][idxTglRenvoi]) : '-';

    // 10. Kontrak Selesai / Tanggal Selesai Kontrak
    var valStep10 = idxStep10 !== -1 && data[i][idxStep10] ? formatDate(data[i][idxStep10]) : '-';
    var valSelesai = idxTglSelesaiKontrak !== -1 && data[i][idxTglSelesaiKontrak] ? formatDate(data[i][idxTglSelesaiKontrak]) : '-';
    var tglSelesai = valStep10 !== '-' ? valStep10 : (valSelesai !== '-' ? valSelesai : '-');

    var targetSelesai = idxTargetSla !== -1 && data[i][idxTargetSla] ? formatDate(data[i][idxTargetSla]) : '-';
    if (tglSelesai === '-' && targetSelesai !== '-' && !targetSelesai.toLowerCase().includes('belum')) {
      tglSelesai = targetSelesai;
    }

    var tglRealisasi = idxTglRealisasi !== -1 && data[i][idxTglRealisasi] ? formatDate(data[i][idxTglRealisasi]) : (tglParafEthos !== '-' ? tglParafEthos : '-');
    var tglRevisi = idxTglRevisi !== -1 && data[i][idxTglRevisi] ? formatDate(data[i][idxTglRevisi]) : '-';

    var rawTahap = idxTahap !== -1 && data[i][idxTahap] ? data[i][idxTahap].toString().trim() : '';
    var statusRevisi = idxRevisi !== -1 && data[i][idxRevisi] ? data[i][idxRevisi].toString().trim() : '';
    var kelengkapan = idxKelengkapan !== -1 && data[i][idxKelengkapan] ? data[i][idxKelengkapan].toString().trim() : 'Lengkap';
    
    var rawNilai = idxNilai !== -1 ? data[i][idxNilai] : 0;
    var nilai = 0;
    if (typeof rawNilai === 'number') {
      nilai = rawNilai;
    } else if (rawNilai) {
      var cleaned = rawNilai.toString().replace(/[^0-9.-]/g, '');
      nilai = parseFloat(cleaned) || 0;
    }

    var status = idxStatus !== -1 && data[i][idxStatus] ? data[i][idxStatus].toString().trim() : 'Comply';
    var linkDokumen = idxLink !== -1 && data[i][idxLink] ? data[i][idxLink].toString().trim() : '';
    var keterangan = idxKeterangan !== -1 && data[i][idxKeterangan] ? data[i][idxKeterangan].toString().trim() : '';

    // Normalisasi Tahap Progress (Didukung auto-detect dari tanggal alur tertinggi jika belum diisi)
    var stageObj = normalizeContractStage(rawTahap, status, tglSelesai);
    if (!rawTahap || rawTahap === '-' || rawTahap === '---' || stageObj.step === 0 || stageObj.key === 'lainnya') {
      if (tglSelesai && tglSelesai !== '-' && new Date(tglSelesai).getTime() <= todayZero) {
        stageObj = { step: 10, key: 'selesai', label: '10. Kontrak Selesai', percent: 100, badgeColor: '#64748b', badgeBg: '#f8fafc', isRevision: false, isRenvoi: false, isFinal: true };
      } else if (tglRenvoi && tglRenvoi !== '-' && !tglRenvoi.toLowerCase().includes('belum')) {
        stageObj = { step: 9, key: 'renvoi', label: '9. Renvoi (Jika Ada)', percent: 90, badgeColor: '#ea580c', badgeBg: '#fff7ed', isRevision: false, isRenvoi: true, isFinal: false };
      } else if (tglMulai && tglMulai !== '-') {
        stageObj = { step: 8, key: 'aktif', label: '8. Kontrak Aktif', percent: 100, badgeColor: '#16a34a', badgeBg: '#f0fdf4', isRevision: false, isRenvoi: false, isFinal: true };
      } else if (tglParafEthos && tglParafEthos !== '-') {
        stageObj = { step: 7, key: 'paraf_ttd_ethos', label: '7. Paraf & Tanda Tangan Ethos', percent: 85, badgeColor: '#9333ea', badgeBg: '#faf5ff', isRevision: false, isRenvoi: false, isFinal: false };
      } else if (tglParafVendor && tglParafVendor !== '-') {
        stageObj = { step: 6, key: 'paraf_ttd_vendor', label: '6. Paraf & Tanda Tangan Vendor', percent: 70, badgeColor: '#d97706', badgeBg: '#fffbeb', isRevision: false, isRenvoi: false, isFinal: false };
      } else if (tglReviewVendor && tglReviewVendor !== '-') {
        stageObj = { step: 5, key: 'review_vendor', label: '5. Review Vendor', percent: 55, badgeColor: '#c026d3', badgeBg: '#fdf4ff', isRevision: false, isRenvoi: false, isFinal: false };
      } else if (tglDraft && tglDraft !== '-') {
        stageObj = { step: 4, key: 'draft', label: '4. Draft Keluar', percent: 45, badgeColor: '#7c3aed', badgeBg: '#f5f3ff', isRevision: false, isRenvoi: false, isFinal: false };
      } else if (tglReviewEthos && tglReviewEthos !== '-') {
        stageObj = { step: 3, key: 'review_legal_ethos', label: '3. Review Legal Ethos', percent: 30, badgeColor: '#4f46e5', badgeBg: '#eef2ff', isRevision: false, isRenvoi: false, isFinal: false };
      } else if (tglPengajuan && tglPengajuan !== '-') {
        stageObj = { step: 2, key: 'pengajuan', label: '2. Pengajuan Ke Legal', percent: 20, badgeColor: '#2563eb', badgeBg: '#eff6ff', isRevision: false, isRenvoi: false, isFinal: false };
      } else if (tglDokumen && tglDokumen !== '-') {
        stageObj = { step: 1, key: 'persiapan_dokumen', label: '1. Persiapan Dokumen', percent: 10, badgeColor: '#0284c7', badgeBg: '#f0f9ff', isRevision: false, isRenvoi: false, isFinal: false };
      }
    }

    // Hitung Selisih Hari Masa Berlaku Kontrak
    var daysRemaining = null;
    var expiryCategory = 'safe';
    if (tglSelesai && tglSelesai !== '-' && !tglSelesai.toLowerCase().includes('belum')) {
      var endParsed = new Date(tglSelesai);
      if (!isNaN(endParsed.getTime())) {
        var endZero = new Date(endParsed.getFullYear(), endParsed.getMonth(), endParsed.getDate()).getTime();
        daysRemaining = Math.ceil((endZero - todayZero) / 86400000);
        if (daysRemaining < 0) {
          expiryCategory = 'expired';
          // Kontrak yang masa berlakunya sudah berakhir otomatis tampil sebagai Kontrak Selesai
          if (stageObj.step === 8 || stageObj.step === 0 || stageObj.key === 'aktif') {
            stageObj = { step: 10, key: 'selesai', label: '10. Kontrak Selesai', percent: 100, badgeColor: '#64748b', badgeBg: '#f8fafc', isRevision: false, isRenvoi: false, isFinal: true };
          }
        } else if (daysRemaining <= 30) {
          expiryCategory = 'critical';
        } else if (daysRemaining <= 90) {
          expiryCategory = 'warning';
        } else {
          expiryCategory = 'safe';
        }
      }
    }

    // Hitung Selisih Hari Pengerjaan / Aging (Sejak diajukan)
    var selisihHariPengerjaan = null;
    if (tglPengajuan && tglPengajuan !== '-') {
      var submitParsed = new Date(tglPengajuan);
      if (!isNaN(submitParsed.getTime())) {
        var submitZero = new Date(submitParsed.getFullYear(), submitParsed.getMonth(), submitParsed.getDate()).getTime();
        var finishZero = todayZero;
        if (tglRealisasi && tglRealisasi !== '-') {
          var realParsed = new Date(tglRealisasi);
          if (!isNaN(realParsed.getTime())) {
            finishZero = new Date(realParsed.getFullYear(), realParsed.getMonth(), realParsed.getDate()).getTime();
          }
        }
        selisihHariPengerjaan = Math.max(0, Math.floor((finishZero - submitZero) / 86400000));
      }
    }

    // Hitung Status SLA
    var slaStatus = '-';
    var isOverdueSla = false;
    if (stageObj.isFinal) {
      slaStatus = 'Selesai';
    } else if (targetSelesai && targetSelesai !== '-') {
      var targetParsed = new Date(targetSelesai);
      if (!isNaN(targetParsed.getTime())) {
        var targetZero = new Date(targetParsed.getFullYear(), targetParsed.getMonth(), targetParsed.getDate()).getTime();
        var diffSla = Math.ceil((targetZero - todayZero) / 86400000);
        if (diffSla < 0) {
          slaStatus = 'Overdue (' + Math.abs(diffSla) + ' hari)';
          isOverdueSla = true;
        } else if (diffSla <= 3) {
          slaStatus = 'Mendekati (' + diffSla + ' hari)';
        } else {
          slaStatus = 'On Track (' + diffSla + ' hari)';
        }
      }
    }

    stats.totalContracts++;
    var isComply = status.toLowerCase() === 'comply';
    if (isComply) stats.totalCompliantContracts++;

    if (!uniqueVendors[vendor]) {
      uniqueVendors[vendor] = { total: 0, comply: 0 };
    }
    uniqueVendors[vendor].total++;
    if (isComply) uniqueVendors[vendor].comply++;

    // Akumulasi metrics
    stats.stageCounts.all++;
    if (stats.stageCounts[stageObj.key] !== undefined) {
      stats.stageCounts[stageObj.key]++;
    } else {
      stats.stageCounts.lainnya++;
    }

    if (stageObj.step === 8) stats.totalActive++;
    if (stageObj.step >= 1 && stageObj.step <= 7) stats.totalInProgress++;
    if (stageObj.isRenvoi) stats.totalRevisiRenvoi++;
    if (isOverdueSla) stats.totalOverdueSla++;

    stats.list.push({
      noKontrak: noKontrak,
      vendor: vendor,
      jenisPekerjaan: jenisPekerjaan,
      picDivisi: picDivisi,
      tglDokumen: tglDokumen,
      tglPengajuan: tglPengajuan,
      tglReviewEthos: tglReviewEthos,
      tglDraft: tglDraft,
      tglReviewVendor: tglReviewVendor,
      tglParafVendor: tglParafVendor,
      tglParafEthos: tglParafEthos,
      tglRevisi: tglRevisi,
      tglRealisasi: tglRealisasi,
      tglMulai: tglMulai,
      tglSelesai: tglSelesai,
      tglRenvoi: tglRenvoi,
      stageDates: {
        1: tglDokumen,
        2: tglPengajuan,
        3: tglReviewEthos,
        4: tglDraft,
        5: tglReviewVendor,
        6: tglParafVendor,
        7: tglParafEthos,
        8: tglMulai,
        9: tglRenvoi,
        10: tglSelesai
      },
      tahapProgress: stageObj.label,
      stageKey: stageObj.key,
      progressStep: stageObj.step,
      progressPercent: stageObj.percent,
      badgeColor: stageObj.badgeColor,
      badgeBg: stageObj.badgeBg,
      isRevision: stageObj.isRevision,
      isRenvoi: stageObj.isRenvoi,
      targetSelesai: targetSelesai,
      tglRealisasi: tglRealisasi,
      statusRevisi: statusRevisi,
      selisihHariMasaBerlaku: daysRemaining,
      expiryCategory: expiryCategory,
      selisihHariPengerjaan: selisihHariPengerjaan,
      slaStatus: slaStatus,
      isOverdueSla: isOverdueSla,
      kelengkapan: kelengkapan,
      nilai: nilai,
      status: status,
      linkDokumen: linkDokumen,
      keterangan: keterangan
    });
  }

  var berkontrakCount = 0;
  var complyCount = 0;
  for (var v in uniqueVendors) {
    berkontrakCount++;
    if (uniqueVendors[v].comply === uniqueVendors[v].total) {
      complyCount++;
    }
  }

  stats.uniqueContractedVendors = berkontrakCount;
  stats.uniqueCompliantVendors = complyCount;
  stats.complianceRate = stats.totalContracts > 0 ? Math.round((stats.totalCompliantContracts / stats.totalContracts) * 100) : 100;
  stats.vendorComplianceRate = berkontrakCount > 0 ? Math.round((complyCount / berkontrakCount) * 100) : 100;

  return stats;
}

/**
 * ------------------------------------------------------------------------------
 * HELPERS & AUTO-INITIALIZATION
 * ------------------------------------------------------------------------------
 */

function generateQuestionId(text) {
  return text.toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .trim()
    .split(/\s+/)
    .map(function(word, idx) {
      return idx === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join('');
}

function getHeaderIndex(headers, keys) {
  // 1. Coba pencocokan tepat (exact match)
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i].toLowerCase().trim();
    var idx = headers.indexOf(key);
    if (idx !== -1) return idx;
  }
  // 2. Coba pencocokan normalisasi (mengabaikan spasi, garis miring, strip, simbol)
  for (var i = 0; i < keys.length; i++) {
    var keyNorm = keys[i].toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!keyNorm) continue;
    for (var h = 0; h < headers.length; h++) {
      var hNorm = headers[h].toLowerCase().replace(/[^a-z0-9]/g, '');
      if (hNorm === keyNorm || (keyNorm.length >= 4 && (hNorm.indexOf(keyNorm) !== -1 || keyNorm.indexOf(hNorm) !== -1))) {
        return h;
      }
    }
  }
  return -1;
}

function formatDate(dateVal) {
  if (!dateVal) return '-';
  try {
    var d = new Date(dateVal);
    if (isNaN(d.getTime())) return dateVal.toString();
    var yyyy = d.getFullYear();
    var mm = ('0' + (d.getMonth() + 1)).slice(-2);
    var dd = ('0' + d.getDate()).slice(-2);
    return yyyy + '-' + mm + '-' + dd;
  } catch (e) {
    return dateVal.toString();
  }
}

function getPredikat(score) {
  var val = parseFloat(score);
  if (val >= 4.5) return 'Sangat Baik';
  if (val >= 3.5) return 'Baik';
  if (val >= 2.5) return 'Cukup';
  if (val >= 1.5) return 'Kurang';
  return 'Sangat Kurang';
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Inisialisasi Seluruh Sheet Database secara Otomatis jika belum ada
 */
function initAllDatabaseSheets(ss) {
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) return;
  // Hanya inisialisasi jika sheet esensial belum ada sama sekali
  var sheetKategori = ss.getSheetByName(SHEET_KATEGORI_VENDOR);
  if (!sheetKategori) {
    sheetKategori = ss.insertSheet(SHEET_KATEGORI_VENDOR);
    var h = ['Kode', 'Nama Kategori', 'Ikon'];
    sheetKategori.appendRow(h);
    var rows = [
      ['BarangJasa', 'Barang & Jasa Umum', '📦'],
      ['Branding', 'Branding & Marketing', '📣'],
      ['KOLInfPodcast', 'KOL, Influencer & Podcast', '🎙️'],
      ['PhotoVideo', 'Photo & Video Production', '📸'],
      ['Konsultan', 'Konsultan & Advisory', '💼'],
      ['ITSoftware', 'IT & Software', '💻'],
      ['EventOrganizer', 'Event Organizer', '🎪'],
      ['BrandAmbasador', 'Brand Ambassador', '🌟'],
      ['DigitalMarketing', 'Digital Marketing', '📱']
    ];
    for (var i = 0; i < rows.length; i++) sheetKategori.appendRow(rows[i]);
    styleHeaders(sheetKategori, h.length);
  }

  var sheetAkses = ss.getSheetByName(SHEET_AKSES_PENILAI);
  if (!sheetAkses) {
    sheetAkses = ss.insertSheet(SHEET_AKSES_PENILAI);
    setupSheetAksesHeaders(sheetAkses);
  }

  var sheetPenilaian = ss.getSheetByName(SHEET_PENILAIAN_VENDOR);
  if (!sheetPenilaian) {
    sheetPenilaian = ss.insertSheet(SHEET_PENILAIAN_VENDOR);
    setupSheetPenilaianHeaders(sheetPenilaian);
  }

  // Inisialisasi atau migrasi struktur kolom sheet Kontrak Vendor
  setupSheetKontrakVendor(ss);
}

/**
 * Setup & Migrasi Struktur Kolom Sheet Kontrak Vendor
 * Mendukung tracking progress lifecycle (Pengajuan, Draft, Paraf Vendor/Ethos, Revisi, Renvoi, TTD, Aktif),
 * selisih hari masa berlaku, durasi proses SLA, dan link dokumen draft.
 */
function setupSheetKontrakVendor(ss) {
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) return;
  
  var sheet = getKontrakVendorSheet(ss);
  var standardHeaders = [
    'No Kontrak',
    'Nama Vendor',
    'Ruang Lingkup / Jenis Pekerjaan',
    'PIC / Divisi',
    'Tahap Progress Pengerjaan',
    '1. Persiapan Dokumen',
    '2. Pengajuan Ke Legal',
    '3. Review Legal Ethos',
    '4. Draft Keluar',
    '5. Review Vendor',
    '6. Paraf & Tanda Tangan Vendor',
    '7. Paraf & Tanda Tangan Ethos',
    '8. Kontrak Aktif',
    '9. Renvoi (Jika Ada)',
    '10. Kontrak Selesai',
    'Target Selesai SLA',
    'Status Revisi / Renvoi',
    'Kelengkapan Dokumen',
    'Nilai Kontrak (Rp)',
    'Status Kepatuhan',
    'Link Dokumen Kontrak',
    'Keterangan'
  ];

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_KONTRAK);
    sheet.appendRow(standardHeaders);
    
    var today = new Date();
    function offsetDate(days) {
      var d = new Date(today.getTime() + days * 86400000);
      return Utilities.formatDate(d, Session.getScriptTimeZone() || 'Asia/Jakarta', 'yyyy-MM-dd');
    }
    
    var sampleRows = [
      [
        'KTR/ETHOS/2026/001', 'PT BIZNET GIO NUSANTARA', 'Cloud Server Infrastructure & Maintenance',
        'IT & Software', '8. Kontrak Aktif',
        offsetDate(-45), offsetDate(-40), offsetDate(-38), offsetDate(-35), offsetDate(-33), offsetDate(-31), offsetDate(-30),
        offsetDate(-30), '', offsetDate(335), offsetDate(-25),
        'Tidak Ada Revisi', 'Lengkap (KTP, NPWP, Akta, Rekening)', 125000000,
        'Comply', 'https://drive.google.com/', 'Kontrak aktif tahunan, performa SLA stabil'
      ],
      [
        'KTR/ETHOS/2026/002', 'CHIPSET COMPUTER - EKI', 'Pengadaan Perangkat Hardware & Laptop Kantor',
        'Procurement', '7. Paraf & Tanda Tangan Ethos',
        offsetDate(-14), offsetDate(-12), offsetDate(-10), offsetDate(-8), offsetDate(-6), offsetDate(-3), offsetDate(-1),
        '', '', offsetDate(180), offsetDate(0),
        'Final Draft Disetujui', 'Lengkap', 85000000,
        'Comply', 'https://drive.google.com/', 'Menunggu penandatanganan Direksi'
      ],
      [
        'KTR/ETHOS/2026/003', 'MULTINDO MEDIA KREASI UTAMA, PT (Kreasi)', 'Jasa Produksi Konten Video & Creative Campaign Q3-Q4',
        'Branding & Marketing', '9. Renvoi (Jika Ada)',
        offsetDate(-20), offsetDate(-18), offsetDate(-15), offsetDate(-12), offsetDate(-10), offsetDate(-7), offsetDate(-5),
        offsetDate(-4), offsetDate(2), offsetDate(120), offsetDate(5),
        'Renvoi Pasal 7 Hak Cipta & Output Video', 'Lengkap (NPWP, NIB)', 65000000,
        'Comply', 'https://drive.google.com/', 'Proses penyesuaian klausul hak cipta'
      ],
      [
        'KTR/ETHOS/2026/004', 'PT.GLOBAL JET EXPRESS', 'Ekspedisi & Distribusi Logistik Nasional',
        'Operasional / Logistik', '6. Paraf & Tanda Tangan Vendor',
        offsetDate(-10), offsetDate(-8), offsetDate(-6), offsetDate(-4), offsetDate(-2), offsetDate(0), '',
        '', '', offsetDate(365), offsetDate(7),
        'Revisi SLA Pengiriman & Klausul Asuransi', 'Lengkap', 150000000,
        'Comply', 'https://drive.google.com/', 'Vendor memeriksa klausul asuransi'
      ],
      [
        'KTR/ETHOS/2026/005', 'Toko HERO', 'Pengadaan ATK & Perlengkapan Operasional Kantor',
        'General Affairs', '5. Review Vendor',
        offsetDate(-8), offsetDate(-6), offsetDate(-4), offsetDate(-2), offsetDate(0), '', '',
        '', '', offsetDate(90), offsetDate(10),
        'Belum Ada Revisi', 'Lengkap', 28000000,
        'Comply', 'https://drive.google.com/', 'Draft disetujui internal, sedang dikaji vendor'
      ],
      [
        'KTR/ETHOS/2026/006', 'CV MANDIRI JAYA KREASI', 'Jasa Desain Booth & Event Exhibition Launching',
        'Event Organizer', '4. Draft Keluar',
        offsetDate(-5), offsetDate(-4), offsetDate(-2), offsetDate(0), '', '', '',
        '', '', offsetDate(45), offsetDate(15),
        'Draft Dikirim ke Vendor', 'Menunggu NPWP Baru', 45000000,
        'Comply', 'https://drive.google.com/', 'Draft kontrak sudah diterbitkan Legal'
      ],
      [
        'KTR/ETHOS/2026/007', 'PT SOLUSI DIGITAL MEDIA', 'Jasa Social Media Management & Influencer Campaign',
        'Digital Marketing', '3. Review Legal Ethos',
        offsetDate(-3), offsetDate(-2), offsetDate(0), '', '', '', '',
        '', '', offsetDate(180), offsetDate(20),
        'Draft Awal Legal', 'Lengkap', 90000000,
        'Comply', 'https://drive.google.com/', 'Sedang diteliti Legal Internal Ethos'
      ],
      [
        'KTR/ETHOS/2026/008', 'KOL MANAGEMENT NUSANTARA', 'Jasa Endorsement Brand Ambassador Q3',
        'Branding', '2. Pengajuan Ke Legal',
        offsetDate(-2), offsetDate(0), '', '', '', '', '',
        '', '', offsetDate(90), offsetDate(25),
        'Tahap Awal', 'Menunggu Draft Perjanjian', 50000000,
        'Comply', 'https://drive.google.com/', 'Dokumen penawaran dan draft ToR baru masuk ke Legal'
      ],
      [
        'KTR/ETHOS/2026/009', 'PT ADHI KARYA TEKNIK', 'Maintenance Fasilitas & Genset Gedung',
        'General Affairs', '1. Persiapan Dokumen',
        offsetDate(0), '', '', '', '', '', '',
        '', '', offsetDate(180), offsetDate(14),
        'Tahap Pengumpulan Dokumen', 'Kurang NIB', 35000000,
        'Comply', 'https://drive.google.com/', 'Menunggu kelengkapan legalitas dari vendor'
      ],
      [
        'KTR/ETHOS/2025/088', 'PT SUMBER MAKMUR LOGISTIK', 'Penyewaan Armada Truk Pengiriman Luar Kota',
        'Operasional', '10. Kontrak Selesai',
        offsetDate(-395), offsetDate(-390), offsetDate(-385), offsetDate(-380), offsetDate(-375), offsetDate(-370), offsetDate(-365),
        offsetDate(-365), '', offsetDate(-15), offsetDate(-365),
        'Kontrak Selesai', 'Lengkap', 110000000,
        'Comply', 'https://drive.google.com/', 'Masa berlaku kontrak habis, dalam evaluasi perpanjangan'
      ]
    ];
    
    for (var i = 0; i < sampleRows.length; i++) {
      sheet.appendRow(sampleRows[i]);
    }
    
    styleHeaders(sheet, standardHeaders.length);
    sheet.setColumnWidth(1, 160); // No Kontrak
    sheet.setColumnWidth(2, 220); // Nama Vendor
    sheet.setColumnWidth(3, 260); // Ruang Lingkup
    sheet.setColumnWidth(4, 140); // PIC/Divisi
    sheet.setColumnWidth(5, 180); // Tahap Progress
    for (var colIdx = 6; colIdx <= 15; colIdx++) {
      sheet.setColumnWidth(colIdx, 130); // 10 Tanggal Alur
    }
    sheet.setColumnWidth(16, 130); // Target SLA
    sheet.setColumnWidth(17, 160); // Status Revisi / Renvoi
    sheet.setColumnWidth(18, 160); // Kelengkapan Dokumen
    sheet.setColumnWidth(19, 130); // Nilai Kontrak
    sheet.setColumnWidth(20, 120); // Status Kepatuhan
    sheet.setColumnWidth(21, 160); // Link Dokumen
    sheet.setColumnWidth(22, 220); // Keterangan
  } else {
    // Sheet sudah ada: periksa kolom yang belum ada dan tambahkan di baris header tanpa merusak data!
    var lastCol = sheet.getLastColumn();
    if (lastCol > 0) {
      var existingHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) {
        return h ? h.toString().trim().toLowerCase() : '';
      });
      
      var checkHeaders = [
        { key: 'pic / divisi', label: 'PIC / Divisi' },
        { key: 'tahap progress', label: 'Tahap Progress Pengerjaan' },
        { key: '1. persiapan', label: '1. Persiapan Dokumen' },
        { key: '2. pengajuan', label: '2. Pengajuan Ke Legal' },
        { key: '3. review legal ethos', label: '3. Review Legal Ethos' },
        { key: '4. draft', label: '4. Draft Keluar' },
        { key: '5. review vendor', label: '5. Review Vendor' },
        { key: '6. paraf & tanda tangan vendor', label: '6. Paraf & Tanda Tangan Vendor' },
        { key: '7. paraf & tanda tangan ethos', label: '7. Paraf & Tanda Tangan Ethos' },
        { key: '8. kontrak aktif', label: '8. Kontrak Aktif' },
        { key: '9. renvoi', label: '9. Renvoi (Jika Ada)' },
        { key: '10. kontrak selesai', label: '10. Kontrak Selesai' },
        { key: 'target selesai sla', label: 'Target Selesai SLA' },
        { key: 'status revisi', label: 'Status Revisi / Renvoi' },
        { key: 'link dokumen', label: 'Link Dokumen Kontrak' }
      ];
      
      var colsToAdd = [];
      for (var c = 0; c < checkHeaders.length; c++) {
        var found = false;
        for (var e = 0; e < existingHeaders.length; e++) {
          if (existingHeaders[e].indexOf(checkHeaders[c].key) !== -1 || checkHeaders[c].key.indexOf(existingHeaders[e]) !== -1) {
            found = true;
            break;
          }
        }
        if (!found) {
          colsToAdd.push(checkHeaders[c].label);
        }
      }
      
      if (colsToAdd.length > 0) {
        for (var a = 0; a < colsToAdd.length; a++) {
          sheet.getRange(1, lastCol + 1 + a).setValue(colsToAdd[a]);
        }
        var newTotalCols = lastCol + colsToAdd.length;
        styleHeaders(sheet, newTotalCols);
      }
    }
  }

  try {
    SpreadsheetApp.getUi().alert('Berhasil! Struktur kolom sheet "Kontrak Vendor" telah disiapkan & diperbarui dengan 22 kolom standar (termasuk 10 Alur PKS & Tanggal Otomatis).');
  } catch (e) {
    Logger.log('setupSheetKontrakVendor complete');
  }
}

function styleHeaders(sheet, numCols) {
  var range = sheet.getRange(1, 1, 1, numCols);
  range.setFontWeight('bold').setBackground('#0a2e5c').setFontColor('#ffffff');
  sheet.setFrozenRows(1);
}

function setupSheetAksesHeaders(sheet) {
  var headers = ['PIN', 'Nama Penilai', 'Vendor yang Boleh Dinilai (Pisahkan Koma)'];
  sheet.appendRow(headers);
  sheet.appendRow(['1001', 'Andi', 'CHIPSET COMPUTER - EKI, Toko HERO, MULTINDO MEDIA KREASI UTAMA, PT (Kreasi)']);
  sheet.appendRow(['1002', 'Budi', 'PT BIZNET GIO NUSANTARA, PT.GLOBAL JET EXPRESS']);
  sheet.appendRow(['1003', 'Cici', 'Toko HERO']);
  styleHeaders(sheet, headers.length);
}

function setupSheetPenilaianHeaders(sheet) {
  var headers = [
    'Timestamp', 'Nama Penilai', 'Nama Vendor', 'Kategori', 'Periode Penilaian',
    'Rata-rata Skor', 'Predikat', 'Catatan'
  ];
  sheet.appendRow(headers);
  styleHeaders(sheet, headers.length);
}

/**
 * Membuat 9 sheet penilaian kategori sekaligus di spreadsheet
 */
function createCategorySheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var created = [];
  var skipped = [];

  for (var catKey in CATEGORY_KRITERIA_MAP) {
    var sheetName = 'Penilaian - ' + catKey;
    var existing = ss.getSheetByName(sheetName);
    if (existing) {
      skipped.push(sheetName);
      continue;
    }

    var sheet = ss.insertSheet(sheetName);
    var headers = ['Timestamp', 'Nama Penilai', 'Nama Vendor', 'Periode Penilaian'];
    var kriteria = CATEGORY_KRITERIA_MAP[catKey];
    for (var i = 0; i < kriteria.length; i++) {
      headers.push(kriteria[i] + ' (1-5)');
    }
    headers.push('Rata-rata Skor');
    headers.push('Predikat');
    headers.push('Catatan');

    sheet.appendRow(headers);
    styleHeaders(sheet, headers.length);
    sheet.setColumnWidth(1, 160);
    sheet.setColumnWidth(2, 150);
    sheet.setColumnWidth(3, 250);
    sheet.setColumnWidth(4, 140);
    created.push(sheetName);
  }

  var msg = 'Selesai!\n';
  if (created.length > 0) msg += 'Dibuat: ' + created.join(', ') + '\n';
  if (skipped.length > 0) msg += 'Sudah ada: ' + skipped.join(', ');
  try {
    SpreadsheetApp.getUi().alert(msg);
  } catch (e) {
    Logger.log(msg);
  }
}

function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('⚡ Evaluasi Vendor')
      .addItem('Buat / Pastikan 9 Sheet Kategori Penilaian', 'createCategorySheets')
      .addItem('Setup / Perbarui Kolom Sheet Kontrak Vendor', 'setupSheetKontrakVendor')
      .addItem('Inisialisasi Seluruh Sheet Sistem', 'initAllDatabaseSheets')
      .addToUi();
  } catch (e) {}
}
