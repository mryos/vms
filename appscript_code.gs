/**
 * ==============================================================================
 * GOOGLE APPS SCRIPT - VENDOR ASSESSMENT SYSTEM (RELATIONAL DATABASE & DASHBOARD)
 * ==============================================================================
 * Spreadsheet Target:
 * https://docs.google.com/spreadsheets/d/1GqsrZeTHhEpyCu5iGWk5OxoT8XPnXKk8usJUWSs27sw/
 * ==============================================================================
 * Cara Deploy:
 * 1. Buka Google Sheets Anda
 * 2. Klik menu Ekstensi -> Apps Script
 * 3. Hapus kode bawaan dan tempel (paste) seluruh kode ini
 * 4. Simpan (Ctrl+S / klik ikon 💾)
 * 5. Klik Deploy -> New deployment
 * 6. Klik ikon gerigi (Select type) -> pilih Web app
 * 7. Konfigurasi:
 *    - Description: VMS Database & Dashboard API
 *    - Execute as: Me (email Anda)
 *    - Who has access: Anyone (Penting agar web bisa akses)
 * 8. Klik Deploy, selesaikan otorisasi akun Google Anda
 * 9. Salin URL Web App yang dihasilkan (format: https://script.google.com/macros/s/.../exec)
 * 10. Tempelkan URL tersebut ke variabel SCRIPT_URL di script.js dan dashboard.js
 * ==============================================================================
 */

// Nama-nama Sheet (Tabel Database)
var SHEET_PENILAIAN_VENDOR = 'Penilaian Vendor';
var SHEET_AKSES_PENILAI = 'Akses Penilai';
var SHEET_DAFTAR_VENDOR = 'Daftar Vendor';
var SHEET_KATEGORI_VENDOR = 'Kategori Vendor';
var SHEET_KRITERIA_PENILAIAN = 'Kriteria Penilaian';
var SHEET_PO = 'Purchase Order';
var SHEET_PR = 'Purchase Request';

/**
 * GET Request
 * Mengembalikan seluruh data database untuk halaman Penilaian dan Dashboard
 */
function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var pin = e && e.parameter && e.parameter.pin ? e.parameter.pin.toString().trim() : '';

    // Pastikan semua sheet terinisialisasi
    initAllDatabaseSheets(ss);

    // Ambil semua master data
    var kategoriList = getKategoriVendor(ss);
    var kriteriaList = getKriteriaPenilaian(ss);
    var poStats = calculatePoStats(ss);
    var prList = getPurchaseRequests(ss);
    var scoreSummary = getVendorScoreSummary(ss);
    var allVendors = getAllVendors(ss);

    // Jika ada request verifikasi PIN
    if (pin) {
      if (pin === '9999' || pin === 'admin') {
        return createJsonResponse({
          status: 'success',
          pin: pin,
          namaPenilai: 'Administrator',
          vendors: allVendors,
          kategori: kategoriList,
          kriteria: kriteriaList,
          poStats: poStats,
          prList: prList,
          scoreSummary: scoreSummary
        });
      }

      // Cari PIN di sheet Akses Penilai
      var sheetAkses = ss.getSheetByName(SHEET_AKSES_PENILAI);
      var dataAkses = sheetAkses.getDataRange().getValues();
      for (var i = 1; i < dataAkses.length; i++) {
        var rowPin = dataAkses[i][0] !== undefined && dataAkses[i][0] !== null ? dataAkses[i][0].toString().trim() : '';
        if (rowPin === pin) {
          var namaPenilai = dataAkses[i][1] ? dataAkses[i][1].toString().trim() : 'Penilai';
          var rawVendors = dataAkses[i][2] ? dataAkses[i][2].toString() : '';
          var allowedNames = rawVendors.split(/[,;]+/).map(function(v) { return v.trim(); }).filter(Boolean);

          // Saring allVendors agar hanya berisi vendor yang diperbolehkan untuk PIN ini
          var filteredVendors = allVendors.filter(function(v) {
            return allowedNames.indexOf(v.nama) !== -1;
          });

          return createJsonResponse({
            status: 'success',
            pin: pin,
            namaPenilai: namaPenilai,
            vendors: filteredVendors,
            kategori: kategoriList,
            kriteria: kriteriaList,
            poStats: poStats,
            prList: prList,
            scoreSummary: scoreSummary
          });
        }
      }

      return createJsonResponse({
        status: 'error',
        message: 'Kode PIN "' + pin + '" tidak terdaftar. Hubungi Admin.'
      });
    }

    // Default response tanpa PIN (kembalikan semua data)
    return createJsonResponse({
      status: 'success',
      vendors: allVendors,
      kategori: kategoriList,
      kriteria: kriteriaList,
      poStats: poStats,
      prList: prList,
      scoreSummary: scoreSummary
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
    var sheet = ss.getSheetByName(SHEET_PENILAIAN_VENDOR);

    if (!sheet) {
      sheet = ss.insertSheet(SHEET_PENILAIAN_VENDOR);
      setupSheetPenilaianHeaders(sheet);
    }

    var lastCol = sheet.getLastColumn();
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) { return h.toString().trim(); });

    // Pastikan kolom Rata-rata Skor ada
    var idxRataRata = headers.indexOf('Rata-rata Skor');
    if (idxRataRata === -1) {
      sheet.insertColumnAfter(lastCol);
      sheet.getRange(1, lastCol + 1).setValue('Rata-rata Skor');
      headers.push('Rata-rata Skor');
      idxRataRata = headers.length - 1;
    }

    // Pastikan setiap kriteria yang dinilai ada kolomnya di sheet
    for (var key in skor) {
      var headerIndex = -1;
      var keyStr = key.toLowerCase();

      for (var h = 0; h < headers.length; h++) {
        var hStr = headers[h].toString().toLowerCase();
        if (hStr === keyStr || hStr.indexOf(keyStr) !== -1 || keyStr.indexOf(hStr) !== -1) {
          headerIndex = h;
          break;
        }
      }

      if (headerIndex === -1) {
        // Kolom baru disisipkan tepat sebelum kolom Rata-rata Skor
        sheet.insertColumnBefore(idxRataRata + 1);
        var displayHeader = key.charAt(0).toUpperCase() + key.slice(1);
        if (displayHeader.indexOf('(1-5)') === -1) displayHeader += ' (1-5)';

        var newColRange = sheet.getRange(1, idxRataRata + 1);
        newColRange.setValue(displayHeader);
        newColRange.setFontWeight('bold').setBackground('#0a2e5c').setFontColor('#ffffff');

        headers.splice(idxRataRata, 0, displayHeader);
        idxRataRata++;
      }
    }

    // Muat ulang header terbaru setelah sinkronisasi kolom
    lastCol = sheet.getLastColumn();
    headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) { return h.toString().trim(); });

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

    // Buat baris data baru sesuai urutan kolom header
    var timestamp = new Date();
    var newRow = [];

    for (var h = 0; h < headers.length; h++) {
      var hNameLower = headers[h].toLowerCase();

      if (hNameLower === 'timestamp') {
        newRow.push(timestamp);
      } else if (hNameLower === 'nama penilai') {
        newRow.push(namaPenilai);
      } else if (hNameLower === 'nama vendor') {
        newRow.push(namaVendor);
      } else if (hNameLower === 'periode penilaian') {
        newRow.push(periodePenilaian);
      } else if (hNameLower === 'rata-rata skor') {
        newRow.push(avgSkor);
      } else if (hNameLower === 'predikat') {
        newRow.push(predikat);
      } else if (hNameLower === 'catatan') {
        newRow.push(catatan);
      } else {
        // Ambil nilai skor yang sesuai
        var scoreVal = '';
        for (var key in skor) {
          var keyStr = key.toLowerCase();
          if (hNameLower === keyStr || hNameLower.indexOf(keyStr) !== -1 || keyStr.indexOf(hNameLower) !== -1) {
            scoreVal = parseFloat(skor[key]) || '';
            break;
          }
        }
        newRow.push(scoreVal);
      }
    }

    sheet.appendRow(newRow);
    return createJsonResponse({ status: 'success', message: 'Penilaian vendor berhasil disimpan.' });

  } catch (error) {
    return createJsonResponse({ status: 'error', message: error.toString() });
  }
}

/**
 * ------------------------------------------------------------------------------
 * DATABASE READ FUNCTIONS
 * ------------------------------------------------------------------------------
 */

function getKategoriVendor(ss) {
  var sheet = ss.getSheetByName(SHEET_KATEGORI_VENDOR);
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
  return list;
}

function getAllVendors(ss) {
  var sheet = ss.getSheetByName(SHEET_DAFTAR_VENDOR);
  var list = [];
  if (sheet && sheet.getLastRow() >= 2) {
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      var nama = data[i][0] ? data[i][0].toString().trim() : '';
      var kategori = data[i][1] ? data[i][1].toString().trim() : '';
      var kontak = data[i][2] ? data[i][2].toString().trim() : '-';
      var alamat = data[i][3] ? data[i][3].toString().trim() : '-';
      if (nama) {
        list.push({ nama: nama, kategori: kategori, kontak: kontak, alamat: alamat });
      }
    }
  }
  return list;
}

function getKriteriaPenilaian(ss) {
  var sheet = ss.getSheetByName(SHEET_KRITERIA_PENILAIAN);
  var list = [];
  if (sheet && sheet.getLastRow() >= 2) {
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      var kategori = data[i][0] ? data[i][0].toString().trim() : '';
      var kriteria = data[i][1] ? data[i][1].toString().trim() : '';
      var deskripsi = data[i][2] ? data[i][2].toString().trim() : '';

      if (kriteria) {
        var id = generateQuestionId(kriteria);
        list.push({
          id: id,
          kriteria: kriteria,
          deskripsi: deskripsi || ('Penilaian ' + kriteria),
          kategori: kategori
        });
      }
    }
  }
  return list;
}

function getPurchaseRequests(ss) {
  var sheet = ss.getSheetByName(SHEET_PR);
  var list = [];
  if (sheet && sheet.getLastRow() >= 2) {
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      var noPr = data[i][0] ? data[i][0].toString().trim() : '';
      if (noPr) {
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

function calculatePoStats(ss) {
  var sheet = ss.getSheetByName(SHEET_PO);
  var stats = {
    totalOrders: 0,
    totalOnTime: 0,
    totalValue: 0,
    overallOnTimePct: 0,
    vendorMap: {}
  };

  if (!sheet || sheet.getLastRow() < 2) return stats;

  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function(h) { return h.toString().trim().toLowerCase(); });

  var idxNoPo = getHeaderIndex(headers, ['no po', 'po', 'reference', 'number']);
  var idxVendor = getHeaderIndex(headers, ['vendor', 'nama vendor', 'supplier']);
  var idxNilai = getHeaderIndex(headers, ['nilai', 'nilai (rp)', 'harga', 'amount', 'total']);
  var idxExp = getHeaderIndex(headers, ['tanggal diharapkan', 'expected date', 'deadline', 'diharapkan']);
  var idxEff = getHeaderIndex(headers, ['tanggal diterima', 'effective date', 'diterima', 'realisasi']);
  var idxItem = getHeaderIndex(headers, ['item', 'deskripsi', 'item/deskripsi', 'product']);

  var vendorMap = {};

  for (var i = 1; i < data.length; i++) {
    var vendorName = idxVendor !== -1 && data[i][idxVendor] ? data[i][idxVendor].toString().trim() : '';
    if (!vendorName) continue;

    var noPo = idxNoPo !== -1 && data[i][idxNoPo] ? data[i][idxNoPo].toString().trim() : 'PO-' + i;
    var nilai = idxNilai !== -1 ? parseFloat(data[i][idxNilai]) || 0 : 0;
    var expDate = idxExp !== -1 ? data[i][idxExp] : '';
    var effDate = idxEff !== -1 ? data[i][idxEff] : '';
    var item = idxItem !== -1 && data[i][idxItem] ? data[i][idxItem].toString().trim() : 'Barang/Jasa';

    stats.totalOrders++;
    stats.totalValue += nilai;

    if (!vendorMap[vendorName]) {
      vendorMap[vendorName] = {
        totalPo: 0,
        onTimePo: 0,
        latePo: 0,
        totalValue: 0,
        onTimeRatePct: 0,
        recentOrders: []
      };
    }

    var vendorData = vendorMap[vendorName];
    vendorData.totalPo++;
    vendorData.totalValue += nilai;

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
          isOnTime = true; // Belum telat
          status = 'Proses';
        } else {
          status = 'Terlambat (Belum Diterima)';
        }
      }
    }

    if (isOnTime) {
      vendorData.onTimePo++;
      stats.totalOnTime++;
    } else {
      vendorData.latePo++;
    }

    if (vendorData.recentOrders.length < 5) {
      vendorData.recentOrders.push({
        poNum: noPo,
        product: item,
        expectedDate: expDate ? formatDate(expDate) : '-',
        effectiveDate: (effDate && effDate.toString().trim() !== '-') ? formatDate(effDate) : 'Belum Diterima',
        status: status,
        isOnTime: isOnTime
      });
    }
  }

  // Hitung persentase
  for (var vKey in vendorMap) {
    var v = vendorMap[vKey];
    v.onTimeRatePct = v.totalPo > 0 ? Math.round((v.onTimePo / v.totalPo) * 100) : 100;
  }

  stats.overallOnTimePct = stats.totalOrders > 0 ? Math.round((stats.totalOnTime / stats.totalOrders) * 100) : 0;
  stats.vendorMap = vendorMap;

  return stats;
}

function getVendorScoreSummary(ss) {
  var sheet = ss.getSheetByName(SHEET_PENILAIAN_VENDOR);
  var summary = {};

  if (!sheet || sheet.getLastRow() < 2) return summary;

  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function(h) { return h.toString().trim().toLowerCase(); });

  var idxVendor = headers.indexOf('nama vendor');
  var idxAvg = headers.indexOf('rata-rata skor');
  var idxPred = headers.indexOf('predikat');
  var idxPeriode = headers.indexOf('periode penilaian');

  if (idxVendor === -1 || idxAvg === -1) return summary;

  for (var i = 1; i < data.length; i++) {
    var vendor = data[i][idxVendor] ? data[i][idxVendor].toString().trim() : '';
    var score = parseFloat(data[i][idxAvg]) || 0;
    var predikat = idxPred !== -1 ? data[i][idxPred].toString().trim() : '';
    var periode = idxPeriode !== -1 ? data[i][idxPeriode].toString().trim() : 'General';

    if (vendor && score > 0) {
      if (!summary[vendor]) {
        summary[vendor] = {
          totalScore: 0,
          count: 0,
          avgScore: 0,
          predikat: 'Cukup',
          periodeScores: []
        };
      }

      var vSum = summary[vendor];
      vSum.totalScore += score;
      vSum.count++;
      vSum.periodeScores.push({ periode: periode, score: score, predikat: predikat });
    }
  }

  for (var vKey in summary) {
    var v = summary[vKey];
    v.avgScore = Math.round((v.totalScore / v.count) * 100) / 100;
    v.predikat = getPredikat(v.avgScore);
  }

  return summary;
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
  for (var i = 0; i < keys.length; i++) {
    var idx = headers.indexOf(keys[i].toLowerCase());
    if (idx !== -1) return idx;
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
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader('Access-Control-Allow-Origin', '*')
    .setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
}

/**
 * Inisialisasi Seluruh Sheet Database secara Otomatis dengan struktur Relasional
 */
function initAllDatabaseSheets(ss) {
  // 1. Kategori Vendor
  var sheet = ss.getSheetByName(SHEET_KATEGORI_VENDOR);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_KATEGORI_VENDOR);
    var h = ['Kode', 'Nama Kategori', 'Ikon'];
    sheet.appendRow(h);
    var rows = [
      ['IT', 'Teknologi Informasi', '💻'],
      ['EKSPEDISI', 'Ekspedisi & Logistik', '🚚'],
      ['BRANDING', 'Branding & Marketing', '📣'],
      ['PERCETAKAN', 'Percetakan & Custom', '🖨️'],
      ['KONSULTAN', 'Konsultan & Services', '💼'],
      ['BARANG_JASA', 'Barang & Jasa Umum', '📦']
    ];
    for (var i = 0; i < rows.length; i++) sheet.appendRow(rows[i]);
    styleHeaders(sheet, h.length);
    sheet.setColumnWidth(1, 120);
    sheet.setColumnWidth(2, 220);
    sheet.setColumnWidth(3, 80);
  }

  // 2. Daftar Vendor
  sheet = ss.getSheetByName(SHEET_DAFTAR_VENDOR);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_DAFTAR_VENDOR);
    var h = ['Nama Vendor', 'Kategori', 'Kontak', 'Alamat'];
    sheet.appendRow(h);
    var rows = [
      ['CHIPSET COMPUTER - EKI', 'IT', '08123456789', 'Purwokerto'],
      ['PT BIZNET GIO NUSANTARA', 'IT', '021-39700000', 'Jakarta'],
      ['PT.GLOBAL JET EXPRESS', 'EKSPEDISI', '08112233445', 'Bandung'],
      ['MULTINDO MEDIA KREASI UTAMA, PT (Kreasi)', 'BRANDING', '0855667788', 'Yogyakarta'],
      ['Toko HERO', 'BARANG_JASA', '0282-531000', 'Cilacap']
    ];
    for (var i = 0; i < rows.length; i++) sheet.appendRow(rows[i]);
    styleHeaders(sheet, h.length);
    sheet.setColumnWidth(1, 350);
    sheet.setColumnWidth(2, 140);
    sheet.setColumnWidth(3, 160);
    sheet.setColumnWidth(4, 250);
  }

  // 3. Kriteria Penilaian (Vertikal)
  sheet = ss.getSheetByName(SHEET_KRITERIA_PENILAIAN);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_KRITERIA_PENILAIAN);
    var h = ['Kategori', 'Kriteria', 'Deskripsi'];
    sheet.appendRow(h);
    var rows = [
      ['UMUM', 'Harga', 'Kewajaran dan kesesuaian harga dibanding pasar'],
      ['UMUM', 'Pelayanan', 'Responsivitas, etika komunikasi, dan profesionalisme'],
      ['UMUM', 'Ketepatan Waktu', 'Kecepatan pengiriman sesuai dengan kesepakatan'],
      ['IT', 'Kualitas Produk IT', 'Stabilitas, performa perangkat keras/lunak yang diberikan'],
      ['IT', 'Dukungan Teknis', 'Resolusi troubleshooting, kecepatan tanggapan error/after-sales'],
      ['EKSPEDISI', 'Keamanan Pengiriman', 'Kondisi fisik barang aman, tidak rusak/penyok saat diterima'],
      ['EKSPEDISI', 'Kecepatan Tracking', 'Akurasi resi/manifest dan ketersediaan tracking online'],
      ['BRANDING', 'Kreativitas Konsep', 'Originalitas ide kreatif, estetika desain, dan relevansi visual'],
      ['PERCETAKAN', 'Kualitas Cetak', 'Ketajaman warna, bahan kertas/media cetak sesuai spesifikasi'],
      ['KONSULTAN', 'Kompetensi Ahli', 'Kedalaman keahlian konsultan dan hasil analisa komprehensif'],
      ['BARANG_JASA', 'Kualitas Barang', 'Kesesuaian detail spesifikasi fisik barang yang dipesan']
    ];
    for (var i = 0; i < rows.length; i++) sheet.appendRow(rows[i]);
    styleHeaders(sheet, h.length);
    sheet.setColumnWidth(1, 140);
    sheet.setColumnWidth(2, 220);
    sheet.setColumnWidth(3, 380);
  }

  // 4. Akses Penilai
  sheet = ss.getSheetByName(SHEET_AKSES_PENILAI);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_AKSES_PENILAI);
    setupSheetAksesHeaders(sheet);
  }

  // 5. Purchase Order
  sheet = ss.getSheetByName(SHEET_PO);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_PO);
    var h = ['No PO', 'Tanggal PO', 'Vendor', 'Item/Deskripsi', 'Qty', 'Nilai (Rp)', 'Tanggal Diharapkan', 'Tanggal Diterima', 'Status'];
    sheet.appendRow(h);
    var rows = [
      ['PO-2026-001', '2026-01-15', 'CHIPSET COMPUTER - EKI', 'Laptop Dell Latitude 3440 Core i5', 10, 150000000, '2026-01-30', '2026-01-28', 'Selesai (Tepat Waktu)'],
      ['PO-2026-002', '2026-02-01', 'Toko HERO', 'ATK Kantor Bulanan (Kertas, Pena, Map)', 1, 5000000, '2026-02-10', '2026-02-15', 'Selesai (Terlambat)'],
      ['PO-2026-003', '2026-03-01', 'PT.GLOBAL JET EXPRESS', 'Distribusi Paket Dokumen & Produk Ethos', 150, 4500000, '2026-03-05', '2026-03-04', 'Selesai (Tepat Waktu)'],
      ['PO-2026-004', '2026-03-10', 'PT BIZNET GIO NUSANTARA', 'Sewa Cloud Server & Layanan Backup Server', 1, 12000000, '2026-03-25', '', 'Proses']
    ];
    for (var i = 0; i < rows.length; i++) sheet.appendRow(rows[i]);
    styleHeaders(sheet, h.length);
    sheet.setColumnWidth(1, 130);
    sheet.setColumnWidth(2, 110);
    sheet.setColumnWidth(3, 260);
    sheet.setColumnWidth(4, 300);
    sheet.setColumnWidth(5, 60);
    sheet.setColumnWidth(6, 120);
    sheet.setColumnWidth(7, 140);
    sheet.setColumnWidth(8, 140);
    sheet.setColumnWidth(9, 150);
  }

  // 6. Purchase Request
  sheet = ss.getSheetByName(SHEET_PR);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_PR);
    var h = ['No PR', 'Tanggal PR', 'Pemohon', 'Departemen', 'Item/Deskripsi', 'Estimasi Nilai (Rp)', 'Vendor Ditunjuk', 'Status', 'No PO Terkait'];
    sheet.appendRow(h);
    var rows = [
      ['PR-2026-001', '2026-01-10', 'Andi', 'IT Support', 'Kebutuhan Laptop Baru Dev Team', 150000000, 'CHIPSET COMPUTER - EKI', 'Approved → PO', 'PO-2026-001'],
      ['PR-2026-002', '2026-01-28', 'Budi', 'General Affair', 'Belanja ATK Rutin Awal Tahun', 5000000, 'Toko HERO', 'Approved → PO', 'PO-2026-002'],
      ['PR-2026-003', '2026-03-12', 'Cici', 'Branding/Design', 'Print Brosur, Banner Promo Produk Baru', 7500000, 'MULTINDO MEDIA KREASI UTAMA, PT (Kreasi)', 'Pending', '']
    ];
    for (var i = 0; i < rows.length; i++) sheet.appendRow(rows[i]);
    styleHeaders(sheet, h.length);
    sheet.setColumnWidth(1, 130);
    sheet.setColumnWidth(2, 110);
    sheet.setColumnWidth(3, 110);
    sheet.setColumnWidth(4, 130);
    sheet.setColumnWidth(5, 300);
    sheet.setColumnWidth(6, 140);
    sheet.setColumnWidth(7, 260);
    sheet.setColumnWidth(8, 130);
    sheet.setColumnWidth(9, 130);
  }

  // 7. Penilaian Vendor Output
  sheet = ss.getSheetByName(SHEET_PENILAIAN_VENDOR);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_PENILAIAN_VENDOR);
    setupSheetPenilaianHeaders(sheet);
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
  sheet.setColumnWidth(1, 100);
  sheet.setColumnWidth(2, 180);
  sheet.setColumnWidth(3, 500);
}

function setupSheetPenilaianHeaders(sheet) {
  var headers = [
    'Timestamp', 'Nama Penilai', 'Nama Vendor', 'Periode Penilaian',
    'Rata-rata Skor', 'Predikat', 'Catatan'
  ];
  sheet.appendRow(headers);
  styleHeaders(sheet, headers.length);
  sheet.setColumnWidth(1, 180);
  sheet.setColumnWidth(2, 150);
  sheet.setColumnWidth(3, 250);
  sheet.setColumnWidth(4, 150);
  sheet.setColumnWidth(5, 120);
  sheet.setColumnWidth(6, 120);
  sheet.setColumnWidth(7, 300);
}
