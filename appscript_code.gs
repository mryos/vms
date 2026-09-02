/**
 * ==============================================================================
 * GOOGLE APPS SCRIPT - VENDOR ASSESSMENT SYSTEM (MULTI-PERIOD & DYNAMIC PO SHEETS)
 * ==============================================================================
 * Spreadsheet Target:
 * https://docs.google.com/spreadsheets/d/1GqsrZeTHhEpyCu5iGWk5OxoT8XPnXKk8usJUWSs27sw/
 * ==============================================================================
 * Cara Deploy / Update:
 * 1. Buka Google Sheets Anda
 * 2. Klik menu Ekstensi -> Apps Script
 * 3. Hapus kode bawaan dan tempel (paste) seluruh kode ini
 * 4. Simpan (Ctrl+S / klik ikon 💾)
 * 5. Klik Deploy -> Manage deployments -> Edit (atau New deployment)
 * 6. Konfigurasi:
 *    - Description: VMS Multi-Period PO Database & Dashboard API
 *    - Execute as: Me (email Anda)
 *    - Who has access: Anyone (Penting agar web bisa akses)
 * 7. Klik Deploy, selesaikan otorisasi akun Google Anda jika diminta
 * 8. Salin URL Web App yang dihasilkan (format: https://script.google.com/macros/s/.../exec)
 * 9. Tempelkan URL tersebut ke variabel SCRIPT_URL di script.js dan dashboard.js
 * ==============================================================================
 * FITUR MULTI-PERIODE FLEKSIBEL:
 * - Anda dapat membuat banyak sheet untuk masing-masing periode/quartal PO.
 * - Format nama sheet bebas, contoh:
 *   - "Quartal 2 2026", "Quartal 3 2026", "Quartal 2, 2027", "Quartal 1 2027"
 *   - "Q2 2026", "Q3 2026", "Q4 2026", "Q1 2027", "Q2 2027"
 *   - "PO Q2 2026", "PO Quartal 2 2027", "PO 2027 Q2"
 * - Cukup copy-paste data PO ke sheet periode baru, sistem web akan OTOMATIS:
 *   1. Membaca sheet periode tersebut.
 *   2. Menampilkan tombol chip periode (misal: "Q2 2027") di halaman utama.
 *   3. Menampilkan daftar vendor yang ada pada sheet PO periode tersebut untuk dinilai!
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
    var scoreSummary = getVendorScoreSummary(ss);
    var contractCompliance = getContractCompliance(ss);

    // Deteksi seluruh sheet periode PO yang ada di spreadsheet
    var periodDataResult = detectAllPeriodSheets(ss, allMasterVendors);
    var periods = periodDataResult.periods;
    var periodList = periodDataResult.periodList;
    var aggregatedPoStats = periodDataResult.aggregatedPoStats;

    // Tentukan vendor default berdasarkan periode terbaru (jika ada) atau master vendor
    var defaultPeriodId = periodList.length > 0 ? periodList[0] : '';
    var baseVendors = (defaultPeriodId && periods[defaultPeriodId] && periods[defaultPeriodId].vendors.length > 0)
      ? periods[defaultPeriodId].vendors
      : allMasterVendors;

    // Jika ada request verifikasi PIN
    if (pin) {
      if (pin === '9999' || pin === 'admin') {
        return createJsonResponse({
          status: 'success',
          pin: pin,
          namaPenilai: 'Administrator',
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
          contractCompliance: contractCompliance
        });
      }

      // Cari PIN di sheet Akses Penilai
      var sheetAkses = ss.getSheetByName(SHEET_AKSES_PENILAI);
      var dataAkses = sheetAkses ? sheetAkses.getDataRange().getValues() : [];
      for (var i = 1; i < dataAkses.length; i++) {
        var rowPin = dataAkses[i][0] !== undefined && dataAkses[i][0] !== null ? dataAkses[i][0].toString().trim() : '';
        if (rowPin === pin) {
          var namaPenilai = dataAkses[i][1] ? dataAkses[i][1].toString().trim() : 'Penilai';
          var rawVendors = dataAkses[i][2] ? dataAkses[i][2].toString() : '';
          var allowedNames = rawVendors.split(/[,;]+/).map(function(v) { return v.trim(); }).filter(Boolean);

          // Filter baseVendors sesuai PIN
          var filteredVendors = baseVendors.filter(function(v) {
            return allowedNames.indexOf(v.nama) !== -1;
          });

          // Filter juga list vendor per periode sesuai hak akses PIN
          var filteredPeriods = {};
          for (var pKey in periods) {
            var pObj = periods[pKey];
            var pFilteredVendors = pObj.vendors.filter(function(v) {
              return allowedNames.indexOf(v.nama) !== -1;
            });
            filteredPeriods[pKey] = {
              id: pObj.id,
              label: pObj.label,
              sheetName: pObj.sheetName,
              vendors: pFilteredVendors,
              poStats: pObj.poStats
            };
          }

          return createJsonResponse({
            status: 'success',
            pin: pin,
            namaPenilai: namaPenilai,
            vendors: filteredVendors,
            allVendors: allMasterVendors,
            kategori: kategoriList,
            kriteria: kriteriaList,
            poStats: aggregatedPoStats,
            periods: filteredPeriods,
            periodList: periodList,
            defaultPeriod: defaultPeriodId,
            prList: prList,
            scoreSummary: scoreSummary,
            contractCompliance: contractCompliance
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
      contractCompliance: contractCompliance
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
 * DETEKSI DYNAMIC PERIOD SHEETS
 * ------------------------------------------------------------------------------
 * Mendeteksi semua sheet yang mewakili PO per periode (misal: "Quartal 2 2026", "Quartal 2, 2027", "Q2 2026")
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

  // Buat lookup map untuk master vendors
  var masterMap = {};
  for (var i = 0; i < masterVendors.length; i++) {
    var v = masterVendors[i];
    masterMap[v.nama.toLowerCase().trim()] = v;
  }

  var sheets = ss.getSheets();
  var periodMap = {};
  var periodList = [];
  var aggregatedPoStats = {
    totalOrders: 0,
    totalOnTime: 0,
    totalValue: 0,
    overallOnTimePct: 0,
    vendorMap: {}
  };

  for (var s = 0; s < sheets.length; s++) {
    var sheet = sheets[s];
    var sheetName = sheet.getName().trim();
    var sNameLower = sheetName.toLowerCase();

    // Skip sheet sistem
    if (systemSheets.indexOf(sNameLower) !== -1) continue;

    // Parse nama sheet untuk mencari periode (Quarter & Tahun)
    var periodInfo = parsePeriodName(sheetName);

    // Proses data PO dari sheet ini
    var parsedPo = parsePoFromSheet(sheet, masterMap);

    // Jika sheet ini memiliki data PO atau memiliki nama periode yang valid
    if (parsedPo.hasData || periodInfo.isPeriodSheet || sNameLower === SHEET_PO_DEFAULT.toLowerCase()) {
      var periodId = periodInfo.id || sheetName;
      var periodLabel = periodInfo.label || sheetName;

      // Jika ID sudah ada (misal ada sheet Q2 2026 dan PO Q2 2026), bedakan ID
      if (periodMap[periodId]) {
        periodId = sheetName;
        periodLabel = sheetName;
      }

      periodMap[periodId] = {
        id: periodId,
        label: periodLabel,
        sheetName: sheetName,
        year: periodInfo.year || 0,
        quarter: periodInfo.quarter || 0,
        vendors: parsedPo.vendors,
        poStats: parsedPo.poStats,
        rawOrders: parsedPo.rawOrders
      };

      periodList.push(periodId);

      // Akumulasi ke aggregated stats
      aggregatedPoStats.totalOrders += parsedPo.poStats.totalOrders;
      aggregatedPoStats.totalOnTime += parsedPo.poStats.totalOnTime;
      aggregatedPoStats.totalValue += parsedPo.poStats.totalValue;

      for (var vName in parsedPo.poStats.vendorMap) {
        var vData = parsedPo.poStats.vendorMap[vName];
        if (!aggregatedPoStats.vendorMap[vName]) {
          aggregatedPoStats.vendorMap[vName] = {
            totalPo: 0,
            onTimePo: 0,
            latePo: 0,
            totalValue: 0,
            onTimeRatePct: 0,
            recentOrders: []
          };
        }
        var aggV = aggregatedPoStats.vendorMap[vName];
        aggV.totalPo += vData.totalPo;
        aggV.onTimePo += vData.onTimePo;
        aggV.latePo += vData.latePo;
        aggV.totalValue += vData.totalValue;
        aggV.recentOrders = aggV.recentOrders.concat(vData.recentOrders).slice(0, 5);
      }
    }
  }

  // Hitung persentase untuk aggregated stats
  for (var vKey in aggregatedPoStats.vendorMap) {
    var vItem = aggregatedPoStats.vendorMap[vKey];
    vItem.onTimeRatePct = vItem.totalPo > 0 ? Math.round((vItem.onTimePo / vItem.totalPo) * 100) : 100;
  }
  aggregatedPoStats.overallOnTimePct = aggregatedPoStats.totalOrders > 0
    ? Math.round((aggregatedPoStats.totalOnTime / aggregatedPoStats.totalOrders) * 100)
    : 100;

  // Urutkan periodList secara kronologis menurun (terbaru di depan, misal: Q2 2027, Q4 2026, Q3 2026)
  periodList.sort(function(a, b) {
    var pA = periodMap[a];
    var pB = periodMap[b];
    if (pA.year !== pB.year) return pB.year - pA.year;
    if (pA.quarter !== pB.quarter) return pB.quarter - pA.quarter;
    return a.localeCompare(b);
  });

  return {
    periods: periodMap,
    periodList: periodList,
    aggregatedPoStats: aggregatedPoStats
  };
}

/**
 * Helper untuk mem-parsing Quarter & Tahun dari nama sheet
 * Contoh input: "Quartal 2 2026", "Quartal 2, 2027", "PO Q2 2026", "Q3 2026", "Kuartal 1 2027"
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
  var headers = data[0].map(function(h) { return h.toString().trim().toLowerCase(); });

  var idxNoPo = getHeaderIndex(headers, ['no po', 'po', 'reference', 'number', 'kode po']);
  var idxVendor = getHeaderIndex(headers, ['vendor', 'nama vendor', 'supplier', 'rekanan']);
  var idxNilai = getHeaderIndex(headers, ['nilai', 'nilai (rp)', 'harga', 'amount', 'total', 'nominal']);
  var idxExp = getHeaderIndex(headers, ['tanggal diharapkan', 'expected date', 'deadline', 'diharapkan', 'tgl estimasi']);
  var idxEff = getHeaderIndex(headers, ['tanggal diterima', 'effective date', 'diterima', 'realisasi', 'tgl selesai']);
  var idxItem = getHeaderIndex(headers, ['item', 'deskripsi', 'item/deskripsi', 'product', 'uraian', 'pekerjaan']);

  // Jika tidak ditemukan kolom Vendor, anggap bukan sheet PO
  if (idxVendor === -1) {
    return { hasData: false, poStats: stats, vendors: [], rawOrders: [] };
  }

  for (var i = 1; i < data.length; i++) {
    var vendorName = data[i][idxVendor] ? data[i][idxVendor].toString().trim() : '';
    if (!vendorName) continue;

    var noPo = idxNoPo !== -1 && data[i][idxNoPo] ? data[i][idxNoPo].toString().trim() : 'PO-' + i;
    var nilai = idxNilai !== -1 ? parseFloat(data[i][idxNilai]) || 0 : 0;
    var expDate = idxExp !== -1 ? data[i][idxExp] : '';
    var effDate = idxEff !== -1 ? data[i][idxEff] : '';
    var item = idxItem !== -1 && data[i][idxItem] ? data[i][idxItem].toString().trim() : 'Barang/Jasa';

    stats.totalOrders++;
    stats.totalValue += nilai;

    // Catat vendor ke daftar vendor unik sheet ini
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
      isOnTime: isOnTime
    };

    rawOrders.push(orderObj);
    if (vData.recentOrders.length < 5) {
      vData.recentOrders.push(orderObj);
    }
  }

  // Hitung persentase ketepatan waktu
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
 * Mendapatkan data kepatuhan kontrak (KPI Point 4)
 */
function getContractCompliance(ss) {
  var sheet = ss.getSheetByName(SHEET_KONTRAK);
  var stats = {
    totalContracts: 0,
    totalCompliantContracts: 0,
    complianceRate: 100,
    uniqueContractedVendors: 0,
    uniqueCompliantVendors: 0,
    vendorComplianceRate: 100,
    list: []
  };

  if (!sheet || sheet.getLastRow() < 2) return stats;

  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function(h) { return h.toString().toLowerCase().trim(); });

  var idxNo = getHeaderIndex(headers, ['no kontrak', 'nomor kontrak', 'kode kontrak']);
  var idxVendor = getHeaderIndex(headers, ['vendor', 'nama vendor', 'rekanan']);
  var idxPekerjaan = getHeaderIndex(headers, ['jenis pekerjaan', 'pekerjaan', 'ruang lingkup', 'deskripsi']);
  var idxMulai = getHeaderIndex(headers, ['tanggal mulai', 'tgl mulai', 'mulai', 'start date']);
  var idxSelesai = getHeaderIndex(headers, ['tanggal selesai', 'tanggal berakhir', 'tgl selesai', 'tgl berakhir', 'end date']);
  var idxKelengkapan = getHeaderIndex(headers, ['kelengkapan dokumen', 'kelengkapan', 'dokumen']);
  var idxNilai = getHeaderIndex(headers, ['nilai kontrak', 'nilai', 'nominal', 'amount', 'harga']);
  var idxStatus = getHeaderIndex(headers, ['status kepatuhan', 'status', 'kepatuhan', 'compliance']);
  var idxKeterangan = getHeaderIndex(headers, ['keterangan', 'catatan', 'remarks', 'note']);

  var uniqueVendors = {};

  for (var i = 1; i < data.length; i++) {
    var noKontrak = idxNo !== -1 && data[i][idxNo] ? data[i][idxNo].toString().trim() : (data[i][0] ? data[i][0].toString().trim() : '');
    var vendor = idxVendor !== -1 && data[i][idxVendor] ? data[i][idxVendor].toString().trim() : (data[i][1] ? data[i][1].toString().trim() : '');
    var jenisPekerjaan = idxPekerjaan !== -1 && data[i][idxPekerjaan] ? data[i][idxPekerjaan].toString().trim() : '-';
    var tglMulai = idxMulai !== -1 && data[i][idxMulai] ? formatDate(data[i][idxMulai]) : '-';
    var tglSelesai = idxSelesai !== -1 && data[i][idxSelesai] ? formatDate(data[i][idxSelesai]) : '-';
    var kelengkapan = idxKelengkapan !== -1 && data[i][idxKelengkapan] ? data[i][idxKelengkapan].toString().trim() : 'Lengkap';
    var nilai = idxNilai !== -1 && !isNaN(Number(data[i][idxNilai])) ? Number(data[i][idxNilai]) : 0;
    var status = idxStatus !== -1 && data[i][idxStatus] ? data[i][idxStatus].toString().trim() : 'Comply';
    var keterangan = idxKeterangan !== -1 && data[i][idxKeterangan] ? data[i][idxKeterangan].toString().trim() : '';

    if (noKontrak && vendor) {
      stats.totalContracts++;
      var isComply = status.toLowerCase() === 'comply';
      if (isComply) stats.totalCompliantContracts++;

      if (!uniqueVendors[vendor]) {
        uniqueVendors[vendor] = { total: 0, comply: 0 };
      }
      uniqueVendors[vendor].total++;
      if (isComply) uniqueVendors[vendor].comply++;

      stats.list.push({
        noKontrak: noKontrak,
        vendor: vendor,
        jenisPekerjaan: jenisPekerjaan,
        tglMulai: tglMulai,
        tglSelesai: tglSelesai,
        kelengkapan: kelengkapan,
        nilai: nilai,
        status: status,
        keterangan: keterangan
      });
    }
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
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Inisialisasi Seluruh Sheet Database secara Otomatis
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

  // 2. Daftar Vendor (Master Data Rekanan)
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

  // 3. Kriteria Penilaian
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

  // 5. Template Contoh Sheet Periode: Quartal 2 2026
  var sheetQ2 = ss.getSheetByName('Quartal 2 2026') || ss.getSheetByName('Q2 2026') || ss.getSheetByName(SHEET_PO_DEFAULT);
  if (!sheetQ2) {
    sheetQ2 = ss.insertSheet('Quartal 2 2026');
    var h = ['No PO', 'Tanggal PO', 'Vendor', 'Item/Deskripsi', 'Qty', 'Nilai (Rp)', 'Tanggal Diharapkan', 'Tanggal Diterima', 'Status'];
    sheetQ2.appendRow(h);
    var rows = [
      ['PO-2026-001', '2026-04-15', 'CHIPSET COMPUTER - EKI', 'Laptop Dell Latitude 3440 Core i5', 10, 150000000, '2026-04-30', '2026-04-28', 'Selesai (Tepat Waktu)'],
      ['PO-2026-002', '2026-05-01', 'Toko HERO', 'ATK Kantor Bulanan (Kertas, Pena, Map)', 1, 5000000, '2026-05-10', '2026-05-15', 'Selesai (Terlambat)'],
      ['PO-2026-003', '2026-06-01', 'PT.GLOBAL JET EXPRESS', 'Distribusi Paket Dokumen & Produk Ethos', 150, 4500000, '2026-06-05', '2026-06-04', 'Selesai (Tepat Waktu)'],
      ['PO-2026-004', '2026-06-10', 'PT BIZNET GIO NUSANTARA', 'Sewa Cloud Server & Layanan Backup Server', 1, 12000000, '2026-06-25', '', 'Proses']
    ];
    for (var i = 0; i < rows.length; i++) sheetQ2.appendRow(rows[i]);
    styleHeaders(sheetQ2, h.length);
    sheetQ2.setColumnWidth(1, 130);
    sheetQ2.setColumnWidth(2, 110);
    sheetQ2.setColumnWidth(3, 260);
    sheetQ2.setColumnWidth(4, 300);
    sheetQ2.setColumnWidth(5, 60);
    sheetQ2.setColumnWidth(6, 120);
    sheetQ2.setColumnWidth(7, 140);
    sheetQ2.setColumnWidth(8, 140);
    sheetQ2.setColumnWidth(9, 150);
  }

  // 6. Purchase Request
  sheet = ss.getSheetByName(SHEET_PR);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_PR);
    var h = ['No PR', 'Tanggal PR', 'Pemohon', 'Departemen', 'Item/Deskripsi', 'Estimasi Nilai (Rp)', 'Vendor Ditunjuk', 'Status', 'No PO Terkait'];
    sheet.appendRow(h);
    var rows = [
      ['PR-2026-001', '2026-04-10', 'Andi', 'IT Support', 'Kebutuhan Laptop Baru Dev Team', 150000000, 'CHIPSET COMPUTER - EKI', 'Approved → PO', 'PO-2026-001'],
      ['PR-2026-002', '2026-04-28', 'Budi', 'General Affair', 'Belanja ATK Rutin Awal Tahun', 5000000, 'Toko HERO', 'Approved → PO', 'PO-2026-002']
    ];
    for (var i = 0; i < rows.length; i++) sheet.appendRow(rows[i]);
    styleHeaders(sheet, h.length);
  }

  // 7. Penilaian Vendor Output
  sheet = ss.getSheetByName(SHEET_PENILAIAN_VENDOR);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_PENILAIAN_VENDOR);
    setupSheetPenilaianHeaders(sheet);
  }

  // 8. Kontrak Vendor (KPI Point 4: Contract Compliance)
  sheet = ss.getSheetByName(SHEET_KONTRAK);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_KONTRAK);
    var h = ['No Kontrak', 'Vendor', 'Jenis Pekerjaan', 'Tanggal Mulai', 'Tanggal Selesai', 'Kelengkapan Dokumen', 'Nilai Kontrak', 'Status Kepatuhan', 'Keterangan'];
    sheet.appendRow(h);
    var rows = [
      ['KTR/2026/IT/001', 'CHIPSET COMPUTER - EKI', 'Pengadaan & Maintenance Perangkat IT', '2026-01-01', '2026-12-31', 'Lengkap (NPWP, NIB, SLA, NDA)', 150000000, 'Comply', 'Klaim garansi hardware & SLA respon 24 jam terpenuhi baik'],
      ['KTR/2026/IT/002', 'PT BIZNET GIO NUSANTARA', 'Layanan Cloud Server & Infrastructure Hosting', '2026-02-01', '2026-08-01', 'Lengkap (NPWP, NIB, ISO 27001, SLA)', 75000000, 'Comply', 'Uptime server 99.95% sesuai ketentuan kontrak'],
      ['KTR/2026/LOG/001', 'PT.GLOBAL JET EXPRESS', 'Jasa Ekspedisi Logistik Distribusi Nasional', '2026-01-01', '2026-06-30', 'Kurang (Klaim Asuransi Pending)', 45000000, 'Not Comply', 'Keterlambatan ganti rugi barang rusak melebihi batas 14 hari kerja']
    ];
    for (var i = 0; i < rows.length; i++) sheet.appendRow(rows[i]);
    styleHeaders(sheet, h.length);
    sheet.setColumnWidth(1, 140);
    sheet.setColumnWidth(2, 260);
    sheet.setColumnWidth(3, 260);
    sheet.setColumnWidth(4, 120);
    sheet.setColumnWidth(5, 120);
    sheet.setColumnWidth(6, 220);
    sheet.setColumnWidth(7, 140);
    sheet.setColumnWidth(8, 130);
    sheet.setColumnWidth(9, 320);
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
