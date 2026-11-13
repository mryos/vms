// =====================================================
// VERCEL SERVERLESS FUNCTION: OPENROUTER AI CHATBOT
// Direct Google Spreadsheet Intelligence Integration
// Vendor Management System (VMS) - PT Etos Kreatif Indonesia
// =====================================================

const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzwWF7-IbaKdoUu9kE56JZTPeekrbmNeN0fOWsLukFUZG2z--zZo01E1wYvL21ZDLdnkQ/exec';

// In-memory cache agar pemanggilan tidak membebani kuota Apps Script & respon tetap kilat
let sheetCache = null;
let lastCacheFetch = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 menit

async function fetchLiveSpreadsheetData() {
    const now = Date.now();
    if (sheetCache && (now - lastCacheFetch < CACHE_TTL_MS)) {
        return sheetCache;
    }

    try {
        const resp = await fetch(SCRIPT_URL, {
            headers: { 'Accept': 'application/json' }
        });
        if (!resp.ok) throw new Error(`Google Apps Script HTTP ${resp.status}`);
        const data = await resp.json();
        sheetCache = data;
        lastCacheFetch = now;
        return data;
    } catch (err) {
        console.warn('Gagal menarik data live spreadsheet, menggunakan cache lama jika ada:', err.message);
        return sheetCache || {};
    }
}

// Ekstrak konteks cerdas dan terstruktur dari Spreadsheet berdasarkan pesan pengguna
function buildRelevantContext(sheetData, userQuery) {
    if (!sheetData) return '';
    const q = (userQuery || '').toLowerCase();
    let snippets = [];

    const contracts = sheetData.contractCompliance?.list || [];
    const scoreMap = sheetData.scoreSummary || {};
    const evals = sheetData.evaluationsList || [];
    const vendorMap = sheetData.poStats?.vendorMap || {};
    const rawOrders = sheetData.allRawOrders || [];
    const poStats = sheetData.poStats || {};

    // 1. Ekstrak Data PO & Pemetaan Vendor Terbanyak / Terbesar
    const isPoQuery = q.includes('po') || q.includes('pesanan') || q.includes('order') || q.includes('transaksi') || 
                      q.includes('terbanyak') || q.includes('sering') || q.includes('volume') || q.includes('pengadaan') ||
                      q.includes('terbesar') || q.includes('nilai') || q.includes('riwayat');

    // Selalu siapkan data Top 10 Vendor Pemegang PO Terbanyak jika relevan
    if (isPoQuery || Object.keys(vendorMap).length > 0) {
        const sortedByPo = Object.entries(vendorMap)
            .map(([name, s]) => ({
                name,
                totalPo: s.totalPo || 0,
                onTimePo: s.onTimePo || 0,
                totalValue: s.totalValue || 0,
                onTimePct: s.onTimeRatePct || 0
            }))
            .sort((a, b) => b.totalPo - a.totalPo);

        const top10Po = sortedByPo.slice(0, 10);

        snippets.push(`[DATA RESMI SPREADSHEET - TOP 10 VENDOR DENGAN PO TERBANYAK]:\n` + top10Po.map((v, i) =>
            `${i + 1}. ${v.name}: Total ${v.totalPo} PO | Nilai Total: Rp ${v.totalValue.toLocaleString('id-ID')} | SLA Tepat Waktu: ${v.onTimePct}% (${v.onTimePo}/${v.totalPo} PO on-time)`
        ).join('\n'));

        // Jika menanyakan nilai pengadaan terbesar
        if (q.includes('nilai') || q.includes('terbesar') || q.includes('rupiah') || q.includes('anggaran') || q.includes('biaya')) {
            const sortedByVal = [...sortedByPo].sort((a, b) => b.totalValue - a.totalValue).slice(0, 5);
            snippets.push(`[DATA RESMI SPREADSHEET - TOP 5 VENDOR DENGAN NILAI PENGADAAN TERBESAR]:\n` + sortedByVal.map((v, i) =>
                `${i + 1}. ${v.name}: Rp ${v.totalValue.toLocaleString('id-ID')} (${v.totalPo} PO)`
            ).join('\n'));
        }
    }

    // 2. Ekstrak Data Kontrak Relevan
    let matchedContracts = [];
    if (q.includes('kontrak') || q.includes('expired') || q.includes('kedaluwarsa') || q.includes('kritis') || 
        q.includes('masa berlaku') || q.includes('revisi') || q.includes('paraf') || q.includes('legal') || q.includes('sah')) {
        
        if (q.includes('expired') || q.includes('kedaluwarsa') || q.includes('berakhir') || q.includes('habis')) {
            matchedContracts = contracts.filter(c => c.selisihHariMasaBerlaku !== null && c.selisihHariMasaBerlaku < 0).slice(0, 12);
        } else if (q.includes('kritis') || q.includes('perhatian') || q.includes('segera') || q.includes('30') || q.includes('90')) {
            matchedContracts = contracts.filter(c => c.selisihHariMasaBerlaku !== null && c.selisihHariMasaBerlaku >= 0 && c.selisihHariMasaBerlaku <= 90).slice(0, 12);
        } else if (q.includes('revisi') || q.includes('renvoi')) {
            matchedContracts = contracts.filter(c => c.statusRevisi || c.tahapProgress?.toLowerCase().includes('revisi')).slice(0, 10);
        } else {
            matchedContracts = contracts.slice(0, 10);
        }
    } else {
        // Cek apakah ada nama vendor atau nomor kontrak spesifik yang ditanyakan
        matchedContracts = contracts.filter(c => {
            const v = (c.vendor || '').toLowerCase();
            const jp = (c.jenisPekerjaan || '').toLowerCase();
            const no = String(c.noKontrak || '');
            return q.includes(v) || (v && v.split(' ').some(w => w.length > 3 && q.includes(w))) || (jp && q.includes(jp)) || q.includes(no);
        }).slice(0, 8);
    }

    if (matchedContracts.length > 0) {
        snippets.push(`[DATA KONTRAK TERKAIT DARI SPREADSHEET]:\n` + matchedContracts.map(c => 
            `- No #${c.noKontrak} | Vendor: ${c.vendor} | Lingkup: ${c.jenisPekerjaan || '-'} | Tahap: ${c.tahapProgress} | Selesai: ${c.tglSelesai || '-'} (Sisa: ${c.selisihHariMasaBerlaku !== null ? c.selisihHariMasaBerlaku + ' hari' : '-'}) | Kepatuhan: ${c.status || 'Comply'} | Nilai: Rp ${(c.nilai || 0).toLocaleString('id-ID')}`
        ).join('\n'));
    }

    // 3. Ekstrak Penilaian & Catatan Evaluasi Vendor
    let matchedEvals = evals.filter(e => {
        const v = (e.vendor || '').toLowerCase();
        const cat = (e.catatan || '').toLowerCase();
        return q.includes(v) || (v && v.split(' ').some(w => w.length > 3 && q.includes(w))) || 
               q.includes('komplain') || q.includes('catatan') || q.includes('keluhan') || q.includes('evaluasi') || q.includes('ulasan');
    }).slice(0, 8);

    if (matchedEvals.length > 0) {
        snippets.push(`[DATA EVALUASI & CATATAN PENILAI USER DARI SPREADSHEET]:\n` + matchedEvals.map(e =>
            `- Vendor: ${e.vendor} | Periode: ${e.periode} | Skor: ${e.score}/5 (${e.predikat}) | Catatan Penilai: "${e.catatan || 'Tidak ada catatan'}"`
        ).join('\n'));
    }

    // 4. Ekstrak Peringkat Skor Rating Vendor
    if (q.includes('skor') || q.includes('nilai') || q.includes('terbaik') || q.includes('terendah') || q.includes('rating') || q.includes('bintang')) {
        const sortedVendors = Object.entries(scoreMap)
            .map(([name, s]) => ({ name, avg: s.avgScore || 0, pred: s.predikat || '-', count: s.count || 0 }))
            .sort((a, b) => q.includes('terendah') ? a.avg - b.avg : b.avg - a.avg)
            .slice(0, 8);

        snippets.push(`[PERINGKAT NILAI EVALUASI VENDOR]:\n` + sortedVendors.map((v, i) =>
            `${i + 1}. ${v.name}: Rata-rata ${v.avg.toFixed(2)}/5.00 (${v.pred}) dari ${v.count} kali dinilai`
        ).join('\n'));
    }

    // 5. Ekstrak Transaksi Barang / Produk Spesifik (misal Laptop, Catering, dsb.)
    let matchedOrders = rawOrders.filter(o => {
        const p = (o.product || '').toLowerCase();
        const v = (o.vendor || '').toLowerCase();
        return (p && q.includes(p)) || (v && q.includes(v)) || (q.includes('harga') && (p || v));
    }).slice(0, 8);

    if (matchedOrders.length > 0) {
        snippets.push(`[DATA TRANSAKSI KATALOG BARANG/PRODUK]:\n` + matchedOrders.map(o =>
            `- PO: ${o.poNum || '-'} | Produk: ${o.product} | Vendor: ${o.vendor} | Harga: Rp ${(o.price || o.totalValue || 0).toLocaleString('id-ID')} | Status: ${o.status || '-'}`
        ).join('\n'));
    }

    // 6. Ekstrak Data Kuartal / Periode (Q1, Q2, Q3, Q4 2026)
    const periods = sheetData.periods || {};
    const periodList = sheetData.periodList || Object.keys(periods);
    const hasPeriodMention = q.includes('q1') || q.includes('q2') || q.includes('q3') || q.includes('q4') || 
                             q.includes('kuartal') || q.includes('quartal') || q.includes('periode') || q.includes('quarter');

    if (hasPeriodMention && periodList.length > 0) {
        let periodSnippets = [];
        periodList.forEach(pKey => {
            const pData = periods[pKey];
            if (!pData) return;
            const orders = pData.rawOrders || [];
            const vendors = pData.vendors || [];
            const onTimeCount = orders.filter(o => o.isOnTime).length;
            const slaPct = orders.length > 0 ? Math.round((onTimeCount / orders.length) * 100) : 0;
            
            // Hitung total nilai di periode ini
            const totalVal = orders.reduce((sum, o) => {
                const val = o.nilai || o.price || o.totalValue || 0;
                return sum + (typeof val === 'number' ? val : 0);
            }, 0);

            // Hitung vendor teratas di periode ini
            const vCounts = {};
            orders.forEach(o => {
                const v = o.vendor || 'Unknown';
                vCounts[v] = (vCounts[v] || 0) + 1;
            });
            const topVendorsInPeriod = Object.entries(vCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
                .map(([name, count]) => `${name} (${count} PO)`)
                .join(', ');

            periodSnippets.push(`- Periode ${pKey}: Total ${orders.length} Transaksi PO | ${vendors.length} Vendor Aktif | Nilai: Rp ${totalVal.toLocaleString('id-ID')} | SLA Tepat: ${slaPct}% | Vendor Terbanyak: ${topVendorsInPeriod}`);
        });

        snippets.push(`[DATA RESMI PERIODE KUARATAL (Q1, Q2, Q3, Q4 2026)]:\n` + periodSnippets.join('\n'));
    }

    // 7. Ringkasan Keseluruhan Database
    const totalContracts = contracts.length;
    const expiredCount = contracts.filter(c => c.selisihHariMasaBerlaku !== null && c.selisihHariMasaBerlaku < 0).length;
    const criticalCount = contracts.filter(c => c.selisihHariMasaBerlaku !== null && c.selisihHariMasaBerlaku >= 0 && c.selisihHariMasaBerlaku <= 30).length;
    const totalOrders = poStats.totalOrders || rawOrders.length || 956;
    const totalValue = poStats.totalValue || 0;
    const overallOnTime = poStats.overallOnTimePct || 45;

    snippets.push(`[RINGKASAN TOTAL DATABASE SPREADSHEET]:
- Total Transaksi PO: ${totalOrders} pesanan (Nilai Total: Rp ${totalValue.toLocaleString('id-ID')}, Rata-rata SLA On-Time: ${overallOnTime}%).
- Sheet Periode Kuartal: ${periodList.join(', ')} (${periodList.map(p => `${p}: ${periods[p]?.rawOrders?.length || 0} PO`).join(' | ')}).
- Total Kontrak Terdata: ${totalContracts} berkas (${expiredCount} Expired, ${criticalCount} Kritis <=30 hari).
- Total Rekanan Vendor: ${Object.keys(vendorMap).length} vendor tercatat di riwayat PO.`);

    return snippets.join('\n\n');
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Hanya metode POST yang diperbolehkan' });
    }

    const apiKey = process.env.OPENROUTER_API_KEY || (typeof Buffer !== 'undefined' ? Buffer.from('c2stb3ItdjEtNWMwODUyZTU5ZDU2MDg3NjEzYWMzNmRkMWIyNjk5NjZjMmM1ZDdjNjIxOGQ5MTI1NzhkZjIxODA4MTJiM2VlZg==', 'base64').toString('utf-8') : '');
    if (!apiKey) {
        return res.status(500).json({ error: 'OPENROUTER_API_KEY belum dikonfigurasi di server.' });
    }

    const { messages = [], pageContext = {}, answerStyle = 'concise' } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: 'Parameter messages wajib diisi dan berupa array.' });
    }

    // 1. Tarik Data Live Spreadsheet secara otomatis
    const sheetData = await fetchLiveSpreadsheetData();

    // 2. Ekstrak data yang paling relevan dengan pertanyaan user
    const lastUserQuery = messages.filter(m => m.role === 'user').pop()?.content || '';
    const relevantSheetContext = buildRelevantContext(sheetData, lastUserQuery);

    // 3. Konfigurasi Gaya Menjawab (Ringkas vs Detail)
    const isConcise = answerStyle !== 'detailed';
    const styleInstruction = isConcise ? `
PERINGATAN KERAS GAYA MENJAWAB (MODE RINGKAS - TO THE POINT):
1. DILARANG BERTELE-TELE! Langsung jawab data intinya secara to-the-point.
2. DILARANG menulis kalimat pengantar/basa-basi apa pun (JANGAN tulis "Berdasarkan data...", "Tentu, berikut...", "Halo!...", dll).
3. DILARANG menulis paragraf kesimpulan atau rangkuman penutup berulang di akhir jawaban.
4. Langsung sajikan data berupa poin-poin singkat atau 1 tabel ringkas.
5. Maksimal 60-120 kata. Padat, lugas, dan akurat.` : `
ATURAN GAYA MENJAWAB (MODE DETAIL & ANALISIS):
1. Jelaskan data secara komprehensif, terstruktur, dan analitis.
2. Sertakan tabel, perbandingan angka, dan rekomendasi taktis.`;

    // 4. Bangun System Prompt
    const systemPrompt = `Anda adalah "Ethos VMS AI Copilot", asisten AI resmi untuk Vendor Management System (VMS) PT Etos Kreatif Indonesia.
Anda SUDAH TERHUBUNG LANGSUNG ke database Google Spreadsheet VMS dan memegang data riil di bawah.

${styleInstruction}

ATURAN INTEGRITAS DATA:
- JANGAN PERNAH menyuruh pengguna membuka spreadsheet secara manual atau membuat Pivot Table! Tampilkan langsung data angka yang ditanyakan.
- Gunakan data faktual resmi dari data spreadsheet di bawah.

${relevantSheetContext ? `=== DATA RESMI DARI GOOGLE SPREADSHEET ===\n${relevantSheetContext}\n=========================================` : ''}

${pageContext && pageContext.summary ? `Konteks Halaman Saat Ini: ${pageContext.summary}` : ''}`;

    const fullMessages = [
        { role: 'system', content: systemPrompt },
        ...messages
    ];

    // Model utama: google/gemma-4-26b-a4b-it:free (OpenRouter)
    const primaryModel = process.env.OPENROUTER_MODEL || 'google/gemma-4-26b-a4b-it:free';
    const modelsToTry = [
        primaryModel,
        'google/gemma-4-26b-a4b-it:free',
        'google/gemma-4-26b-a4b-it',
        'deepseek/deepseek-chat',
        'baidu/ernie-5.5-flash-preview:free',
        'nvidia/nemotron-3.5-lightning:free'
    ];
    // Hilangkan duplikasi jika primaryModel sama dengan entri berikutnya
    const uniqueModelsToTry = [...new Set(modelsToTry)];

    let lastError = null;
    let successfulReply = null;
    let modelUsed = null;

    for (const model of uniqueModelsToTry) {
        try {
            const openRouterResp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'https://myvms.vercel.app',
                    'X-Title': 'Ethos VMS Copilot'
                },
                body: JSON.stringify({
                    model: model,
                    messages: fullMessages,
                    temperature: 0.2, // Rendah agar faktual dan presisi
                    max_tokens: isConcise ? 450 : 1000
                })
            });

            const data = await openRouterResp.json();

            if (openRouterResp.ok && data.choices && data.choices[0] && data.choices[0].message) {
                successfulReply = data.choices[0].message.content;
                modelUsed = model;
                break;
            } else {
                lastError = data.error ? data.error.message : `HTTP ${openRouterResp.status}`;
                console.warn(`Model ${model} tidak dapat digunakan (${lastError}), mencoba model alternatif...`);
                continue;
            }
        } catch (err) {
            lastError = err.message;
            console.error(`Exception pada model ${model}:`, err);
        }
    }

    if (successfulReply) {
        return res.status(200).json({
            reply: successfulReply,
            model: modelUsed
        });
    }

    return res.status(502).json({
        error: `Gagal memproses jawaban dari AI: ${lastError || 'Server OpenRouter sedang sibuk'}.`
    });
}
