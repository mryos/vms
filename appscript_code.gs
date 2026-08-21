/**
 * ==============================================================================
 * GOOGLE APPS SCRIPT - VENDOR ASSESSMENT SYSTEM WITH PO ANALYTICS & PIN ACCESS
 * ==============================================================================
 * Spreadsheet Target:
 * https://docs.google.com/spreadsheets/d/1GqsrZeTHhEpyCu5iGWk5OxoT8XPnXKk8usJUWSs27sw/
 * ==============================================================================
 */

var SHEET_PENILAIAN_VENDOR = 'Penilaian Vendor';
var SHEET_AKSES_PENILAI = 'Akses Penilai';
var SHEET_DAFTAR_VENDOR = 'Daftar Vendor';
var SHEET_PO = 'PO';
var SHEET_KRITERIA_PENILAIAN = 'Kriteria Penilaian';

/**
 * GET Request
 * Kembalikan daftar vendor, statistik PO, kriteria penilaian, dan verifikasi PIN jika dikirim.
 */
function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var pin = e && e.parameter && e.parameter.pin ? e.parameter.pin.toString().trim() : '';

    // Pastikan sheet 'Akses Penilai' sudah ada
    var sheetAkses = ss.getSheetByName(SHEET_AKSES_PENILAI);
    if (!sheetAkses) {
      sheetAkses = ss.insertSheet(SHEET_AKSES_PENILAI);
      setupSheetAksesHeaders(sheetAkses);
    }

    // Ambil kriteria penilaian dinamis
    var kriteriaList = getKriteriaPenilaian(ss);

    // Ambil statistik PO dari sheet 'PO'
    var poStats = calculatePoStats(ss);

    if (pin) {
      // PIN Admin Master — bisa melihat semua vendor tanpa perlu ada di sheet
      if (pin === '9999' || pin === 'admin') {
        var allVendors = getAllVendors(ss);
        return createJsonResponse({
          status: 'success',
          pin: pin,
          namaPenilai: 'Administrator',
          vendors: allVendors,
          poStats: poStats,
          kriteria: kriteriaList
        });
      }

      // Verifikasi PIN dari sheet 'Akses Penilai'
      var data = sheetAkses.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        // Konversi ke string untuk menghindari masalah tipe data number vs string
        var rowPin = data[i][0] !== undefined && data[i][0] !== null && data[i][0] !== '' 
                     ? data[i][0].toString().trim() 
                     : '';
        if (rowPin === pin) {
          var namaPenilai = data[i][1] ? data[i][1].toString().trim() : 'Penilai';
          var rawVendors = data[i][2] ? data[i][2].toString() : '';
          var vendorList = rawVendors.split(/[,;]+/).map(function(v) { return v.trim(); }).filter(Boolean);

          return createJsonResponse({
            status: 'success',
            pin: pin,
            namaPenilai: namaPenilai,
            vendors: vendorList,
            poStats: poStats,
            kriteria: kriteriaList
          });
        }
      }

      return createJsonResponse({
        status: 'error',
        message: 'Kode PIN "' + pin + '" tidak terdaftar. Hubungi Admin.'
      });
    }

    // Jika tanpa parameter PIN, kembalikan semua vendor
    var allVendors = getAllVendors(ss);
    return createJsonResponse({
      status: 'success',
      vendors: allVendors,
      poStats: poStats,
      kriteria: kriteriaList
    });

  } catch (error) {
    return createJsonResponse({
      status: 'error',
      message: 'Error: ' + error.toString()
    });
  }
}

/**
 * Mendapatkan kriteria penilaian dari sheet 'Kriteria Penilaian'.
 * Format Horizontal:
 * Kolom A: Kategori (UMUM, IT, EKSPEDISI, etc.)
 * Kolom B: Nama Vendor (Opsional, isi nama vendor tertentu jika pertanyaan khusus vendor tersebut, atau 'Semua')
 * Kolom C sampai M: Pertanyaan 1, Pertanyaan 2, dst.
 */
function getKriteriaPenilaian(ss) {
  var sheet = ss.getSheetByName(SHEET_KRITERIA_PENILAIAN);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_KRITERIA_PENILAIAN);
    var headers = ['Kategori', 'Nama Vendor', 'Pertanyaan 1', 'Pertanyaan 2', 'Pertanyaan 3', 'Pertanyaan 4', 'Pertanyaan 5', 'Pertanyaan 6', 'Pertanyaan 7', 'Pertanyaan 8', 'Pertanyaan 9', 'Pertanyaan 10'];
    sheet.appendRow(headers);

    // Pertanyaan Default disusun secara horizontal (Baris per Kategori/Vendor)
    var defaults = [
      ['UMUM',       'Semua', 'Harga', 'Pelayanan', 'Ketepatan Waktu'],
      ['IT',         'Semua', 'Kualitas Produk IT', 'Dukungan Teknis', 'Garansi & Pemeliharaan'],
      ['EKSPEDISI',  'Semua', 'Keamanan Pengiriman', 'Jangkauan Area', 'Ketepatan Estimasi'],
      ['BRANDING',   'Semua', 'Kreativitas Desain', 'Kesesuaian Brief', 'Revisi & Fleksibilitas'],
      ['PERCETAKAN', 'Semua', 'Kualitas Cetak', 'Kesesuaian Spesifikasi', 'Kapasitas Progres'],
      ['KONSULTAN',  'Semua', 'Keahlian & Kompetensi', 'Kualitas Laporan', 'Dampak & Hasil'],
      ['BARANG JASA','Semua', 'Kualitas Barang', 'Kelengkapan Pesanan', 'Ketersediaan Stok']
    ];

    for (var d = 0; d < defaults.length; d++) {
      sheet.appendRow(defaults[d]);
    }

    // Styling
    var range = sheet.getRange(1, 1, 1, headers.length);
    range.setFontWeight('bold');
    range.setBackground('#0a2e5c');
    range.setFontColor('#ffffff');
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 130);
    sheet.setColumnWidth(2, 180);
    for (var c = 3; c <= headers.length; c++) {
      sheet.setColumnWidth(c, 200);
    }
  }

  var KATEGORI_MAP = {
    'umum':        'all',
    'all':         'all',
    'semua':       'all',
    'it':          'it',
    'ekspedisi':   'logistics',
    'logistik':    'logistics',
    'logistics':   'logistics',
    'branding':    'branding',
    'marketing':   'branding',
    'percetakan':  'printing',
    'printing':    'printing',
    'konsultan':   'consultant',
    'consultant':  'consultant',
    'services':    'consultant',
    'barang jasa': 'general',
    'general':     'general',
    'atk':         'general'
  };

  var list = [];
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    var rawCat = data[i][0] ? data[i][0].toString().trim() : '';
    var rawVendor = data[i][1] ? data[i][1].toString().trim() : '';

    if (!rawCat) continue;
    var catCode = KATEGORI_MAP[rawCat.toLowerCase()] || rawCat.toLowerCase() || 'all';

    // Baca kolom C dan seterusnya (index 2 dst)
    for (var col = 2; col < data[i].length; col++) {
      var qText = data[i][col] ? data[i][col].toString().trim() : '';
      if (qText) {
        var id = generateQuestionId(qText);
        list.push({
          id: id,
          kriteria: qText,
          deskripsi: 'Penilaian ' + qText,
          kategori: catCode,
          vendorSpesifik: (rawVendor && rawVendor.toLowerCase() !== 'semua') ? rawVendor : null
        });
      }
    }
  }
  return list;
}

// Helper untuk membuat ID camelCase dari teks pertanyaan
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

/**
 * Menganalisis sheet 'PO' untuk menghitung statistik pengiriman tepat waktu per vendor
 */
function calculatePoStats(ss) {
  var sheetPo = ss.getSheetByName(SHEET_PO);
  var stats = {
    totalOrders: 0,
    totalOnTime: 0,
    overallOnTimePct: 0,
    vendorMap: {}
  };

  if (!sheetPo || sheetPo.getLastRow() < 2) {
    return stats;
  }

  var data = sheetPo.getDataRange().getValues();
  var headers = data[0].map(function(h) { return h.toString().trim(); });

  // Cari index kolom
  var idxVendor = headers.indexOf('Vendor');
  var idxExpected = headers.indexOf('Expected Date');
  var idxEffective = headers.indexOf('Effective Date');
  var idxPoNum = headers.indexOf('Order Reference');
  if (idxPoNum === -1) idxPoNum = headers.indexOf('Display Name');
  var idxProduct = headers.indexOf('Product');

  if (idxVendor === -1 || idxExpected === -1 || idxEffective === -1) {
    return stats;
  }

  var vendorMap = {};

  for (var i = 1; i < data.length; i++) {
    var vendor = data[i][idxVendor] ? data[i][idxVendor].toString().trim() : '';
    if (!vendor) continue;

    var expectedStr = data[i][idxExpected];
    var effectiveStr = data[i][idxEffective];
    var poNum = idxPoNum !== -1 && data[i][idxPoNum] ? data[i][idxPoNum].toString() : 'PO-' + i;
    var product = idxProduct !== -1 && data[i][idxProduct] ? data[i][idxProduct].toString() : 'Barang/Jasa';

    if (!vendorMap[vendor]) {
      vendorMap[vendor] = {
        totalPo: 0,
        onTimePo: 0,
        latePo: 0,
        onTimeRatePct: 0,
        recentOrders: []
      };
    }

    vendorMap[vendor].totalPo++;
    stats.totalOrders++;

    var isOnTime = false;
    var hasEffectiveDate = false;

    if (effectiveStr && effectiveStr.toString().trim() !== '') {
      hasEffectiveDate = true;
      var dateExp = new Date(expectedStr);
      var dateEff = new Date(effectiveStr);

      if (!isNaN(dateExp.getTime()) && !isNaN(dateEff.getTime())) {
        // Tepat waktu jika effective date <= expected date (ditambah toleransi 1 hari)
        if (dateEff <= dateExp || (dateEff - dateExp) <= 86400000) {
          isOnTime = true;
        }
      }
    } else {
      // Jika belum diterima tapi belum melewati expected date
      var now = new Date();
      var dateExp = new Date(expectedStr);
      if (!isNaN(dateExp.getTime()) && now <= dateExp) {
        isOnTime = true;
      }
    }

    if (isOnTime) {
      vendorMap[vendor].onTimePo++;
      stats.totalOnTime++;
    } else {
      vendorMap[vendor].latePo++;
    }

    if (vendorMap[vendor].recentOrders.length < 3) {
      vendorMap[vendor].recentOrders.push({
        poNum: poNum,
        product: product,
        expectedDate: expectedStr ? expectedStr.toString().split(' ')[0] : '-',
        effectiveDate: effectiveStr ? effectiveStr.toString().split(' ')[0] : 'Belum Diterima',
        isOnTime: isOnTime
      });
    }
  }

  // Hitung persentase per vendor
  for (var vKey in vendorMap) {
    var v = vendorMap[vKey];
    v.onTimeRatePct = v.totalPo > 0 ? Math.round((v.onTimePo / v.totalPo) * 100) : 100;
  }

  stats.overallOnTimePct = stats.totalOrders > 0 ? Math.round((stats.totalOnTime / stats.totalOrders) * 100) : 0;
  stats.vendorMap = vendorMap;

  return stats;
}

/**
 * POST Request - Menyimpan Penilaian Vendor ke Google Sheets secara dinamis
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
    
    // Ambil skor kriteria dinamis
    var skor = payload.skor || {};
    // Fallback jika dikirim di root payload (kualitas, pelayanan, dll)
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
    } else if (sheet.getLastRow() === 0) {
      setupSheetPenilaianHeaders(sheet);
    }

    // Sinkronisasi kolom header di spreadsheet
    var lastCol = sheet.getLastColumn();
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    
    var idxRataRata = headers.indexOf('Rata-rata Skor');
    if (idxRataRata === -1) {
      sheet.insertColumnAfter(lastCol);
      sheet.getRange(1, lastCol + 1).setValue('Rata-rata Skor');
      headers.push('Rata-rata Skor');
      idxRataRata = headers.length - 1;
    }

    // Pastikan setiap kriteria dalam skor memiliki kolom di sheet
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
        // Kolom belum ada, sisipkan tepat sebelum Rata-rata Skor
        sheet.insertColumnBefore(idxRataRata + 1);
        
        // Buat nama header kolom baru
        var displayHeader = key.charAt(0).toUpperCase() + key.slice(1);
        if (displayHeader.indexOf('(1-5)') === -1) {
          displayHeader += ' (1-5)';
        }
        
        sheet.getRange(1, idxRataRata + 1).setValue(displayHeader);
        
        var headerCell = sheet.getRange(1, idxRataRata + 1);
        headerCell.setFontWeight('bold');
        headerCell.setBackground('#0a2e5c');
        headerCell.setFontColor('#ffffff');

        // Update tracking array
        headers.splice(idxRataRata, 0, displayHeader);
        idxRataRata++;
      }
    }

    // Muat ulang header terbaru
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

    // Siapkan baris data baru sesuai urutan header
    var timestamp = new Date();
    var newRow = [];

    for (var h = 0; h < headers.length; h++) {
      var hName = headers[h];
      var hNameLower = hName.toLowerCase();
      
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
        newRow.push(payload.catatan || '');
      } else {
        // Cari skor yang cocok dari criteria key
        var scoreVal = 0;
        for (var key in skor) {
          var keyStr = key.toLowerCase();
          if (hNameLower === keyStr || hNameLower.indexOf(keyStr) !== -1 || keyStr.indexOf(hNameLower) !== -1) {
            scoreVal = parseFloat(skor[key]) || 0;
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

function getPredikat(avg) {
  var score = parseFloat(avg);
  if (score >= 4.5) return 'Sangat Baik';
  if (score >= 3.5) return 'Baik';
  if (score >= 2.5) return 'Cukup';
  if (score >= 1.5) return 'Kurang';
  return 'Sangat Kurang';
}

function getAllVendors(ss) {
  var sheet = ss.getSheetByName(SHEET_DAFTAR_VENDOR);

  // Auto-buat sheet jika belum ada
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_DAFTAR_VENDOR);
    var headers = ['Nama Vendor', 'Kategori'];
    sheet.appendRow(headers);
    // Contoh data
    sheet.appendRow(['CHIPSET COMPUTER - EKI', 'IT']);
    sheet.appendRow(['PT BIZNET GIO NUSANTARA', 'IT']);
    sheet.appendRow(['Toko HERO', 'BARANG JASA']);
    sheet.appendRow(['MULTINDO MEDIA KREASI UTAMA, PT (Kreasi)', 'BRANDING']);

    var range = sheet.getRange(1, 1, 1, headers.length);
    range.setFontWeight('bold');
    range.setBackground('#0a2e5c');
    range.setFontColor('#ffffff');
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 350);
    sheet.setColumnWidth(2, 150);
  }

  // Mapping kategori yang ditulis user -> kode internal frontend
  var KATEGORI_MAP = {
    'umum': 'all', 'all': 'all', 'semua': 'all',
    'it': 'it',
    'ekspedisi': 'logistics', 'logistik': 'logistics', 'logistics': 'logistics',
    'branding': 'branding', 'marketing': 'branding',
    'percetakan': 'printing', 'printing': 'printing',
    'konsultan': 'consultant', 'consultant': 'consultant', 'services': 'consultant',
    'barang jasa': 'general', 'general': 'general', 'atk': 'general'
  };

  var list = [];
  if (sheet.getLastRow() >= 2) {
    var numCols = Math.min(sheet.getLastColumn(), 2); // Ambil maks 2 kolom
    var vals = sheet.getRange(2, 1, sheet.getLastRow() - 1, numCols).getValues();
    for (var i = 0; i < vals.length; i++) {
      var nama = vals[i][0] ? vals[i][0].toString().trim() : '';
      if (nama) {
        var rawCat = vals[i][1] ? vals[i][1].toString().trim().toLowerCase() : '';
        var catCode = KATEGORI_MAP[rawCat] || rawCat || 'general';
        list.push({ nama: nama, kategori: catCode });
      }
    }
  }
  return list;
}

function setupSheetAksesHeaders(sheet) {
  var headers = ['PIN', 'Nama Penilai', 'Vendor yang Boleh Dinilai (Pisahkan Koma)'];
  sheet.appendRow(headers);
  sheet.appendRow(['1001', 'Andi', 'MULTINDO MEDIA KREASI UTAMA, PT (Kreasi), VELOURA BESAR PERSADA, CV, Toko HERO']);
  sheet.appendRow(['1002', 'Budi', 'CHIPSET COMPUTER - EKI, QUADRA PURWOKERTO FH, PT BIZNET GIO NUSANTARA']);
  sheet.appendRow(['1003', 'Cici', 'PERURI (Perusahaan Umum Percetakan Uang Republik Indonesia)']);
  var range = sheet.getRange(1, 1, 1, headers.length);
  range.setFontWeight('bold');
  range.setBackground('#0a2e5c');
  range.setFontColor('#ffffff');
  sheet.setFrozenRows(1);
}

function setupSheetPenilaianHeaders(sheet) {
  var headers = [
    'Timestamp', 'Nama Penilai', 'Nama Vendor', 'Periode Penilaian',
    'Kualitas Barang/Jasa (1-5)', 'Ketepatan Waktu Pengiriman (1-5)',
    'Harga (1-5)', 'Pelayanan (1-5)', 'Rata-rata Skor', 'Predikat', 'Catatan'
  ];
  sheet.appendRow(headers);
  var range = sheet.getRange(1, 1, 1, headers.length);
  range.setFontWeight('bold');
  range.setBackground('#0a2e5c');
  range.setFontColor('#ffffff');
  sheet.setFrozenRows(1);
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
