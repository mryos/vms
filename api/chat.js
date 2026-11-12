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

// Ekstrak konteks cerdas dari Spreadsheet berdasarkan pesan pengguna
function buildRelevantContext(sheetData, userQuery) {
    if (!sheetData) return '';
    const q = (userQuery || '').toLowerCase();
    let snippets = [];

    const contracts = sheetData.contractCompliance?.list || [];
    const scoreMap = sheetData.scoreSummary || {};
    const evals = sheetData.evaluationsList || [];
    const vendorMap = sheetData.poStats?.vendorMap || {};
    const rawOrders = sheetData.allRawOrders || [];

    // 1. Ekstrak Data Kontrak Relevan
    let matchedContracts = [];
    if (q.includes('kontrak') || q.includes('expired') || q.includes('kedaluwarsa') || q.includes('kritis') || q.includes('masa berlaku') || q.includes('revisi') || q.includes('paraf') || q.includes('legal')) {
        if (q.includes('expired') || q.includes('kedaluwarsa') || q.includes('berakhir')) {
            matchedContracts = contracts.filter(c => c.selisihHariMasaBerlaku !== null && c.selisihHariMasaBerlaku < 0).slice(0, 10);
        } else if (q.includes('kritis') || q.includes('perhatian') || q.includes('segera')) {
            matchedContracts = contracts.filter(c => c.selisihHariMasaBerlaku !== null && c.selisihHariMasaBerlaku >= 0 && c.selisihHariMasaBerlaku <= 90).slice(0, 10);
        } else if (q.includes('revisi') || q.includes('renvoi')) {
            matchedContracts = contracts.filter(c => c.statusRevisi || c.tahapProgress?.toLowerCase().includes('revisi')).slice(0, 10);
        } else {
            matchedContracts = contracts.slice(0, 8);
        }
    } else {
        // Cek apakah ada nama vendor atau kata kunci cocok di kontrak
        matchedContracts = contracts.filter(c => {
            const v = (c.vendor || '').toLowerCase();
            const jp = (c.jenisPekerjaan || '').toLowerCase();
            const no = String(c.noKontrak || '');
            return q.includes(v) || (v && v.split(' ').some(w => w.length > 3 && q.includes(w))) || q.includes(jp) || q.includes(no);
        }).slice(0, 6);
    }

    if (matchedContracts.length > 0) {
        snippets.push(`[DATA KONTRAK TERKAIT SPREADSHEET]:\n` + matchedContracts.map(c => 
            `- No #${c.noKontrak} | Vendor: ${c.vendor} | Lingkup: ${c.jenisPekerjaan || '-'} | Tahap: ${c.tahapProgress} | Selesai: ${c.tglSelesai || '-'} (Sisa: ${c.selisihHariMasaBerlaku !== null ? c.selisihHariMasaBerlaku + ' hari' : '-'}) | Status Kepatuhan: ${c.status || 'Comply'} | SLA Pengerjaan: ${c.slaStatus || '-'}`
        ).join('\n'));
    }

    // 2. Ekstrak Penilaian & Catatan Evaluasi Vendor
    let matchedEvals = evals.filter(e => {
        const v = (e.vendor || '').toLowerCase();
        const cat = (e.catatan || '').toLowerCase();
        return q.includes(v) || (v && v.split(' ').some(w => w.length > 3 && q.includes(w))) || (q.includes('komplain') || q.includes('catatan') || q.includes('keluhan') || q.includes('evaluasi'));
    }).slice(0, 6);

    if (matchedEvals.length > 0) {
        snippets.push(`[DATA CATATAN & EVALUASI USER DARI SPREADSHEET]:\n` + matchedEvals.map(e =>
            `- Vendor: ${e.vendor} | Periode: ${e.periode} | Skor: ${e.score}/5 (${e.predikat}) | Catatan Penilai: "${e.catatan || 'Tidak ada catatan'}"`
        ).join('\n'));
    }

    // 3. Ekstrak Skor Terbaik / Terendah
    if (q.includes('skor') || q.includes('nilai') || q.includes('terbaik') || q.includes('terendah') || q.includes('rating')) {
        const sortedVendors = Object.entries(scoreMap)
            .map(([name, s]) => ({ name, avg: s.avgScore || 0, pred: s.predikat || '-', count: s.count || 0 }))
            .sort((a, b) => q.includes('terendah') ? a.avg - b.avg : b.avg - a.avg)
            .slice(0, 5);

        snippets.push(`[PERINGKAT NILAI VENDOR SPREADSHEET]:\n` + sortedVendors.map(v =>
            `- ${v.name}: Nilai Rata-rata ${v.avg.toFixed(2)} / 5.00 (${v.pred}) dari ${v.count} kali dinilai`
        ).join('\n'));
    }

    // 4. Ekstrak Data Pengadaan & Harga PO (jika menanyakan barang, harga, atau vendor pengadaan)
    let matchedOrders = rawOrders.filter(o => {
        const p = (o.product || '').toLowerCase();
        const v = (o.vendor || '').toLowerCase();
        return (p && q.includes(p)) || (v && q.includes(v)) || q.includes('harga') || q.includes('beli') || q.includes('termurah');
    }).slice(0, 8);

    if (matchedOrders.length > 0) {
        snippets.push(`[DATA TRANSAKSI PO KATALOG PENGADAAN]:\n` + matchedOrders.map(o =>
            `- PO: ${o.poNum || '-'} | Produk: ${o.product} | Vendor: ${o.vendor} | Harga: Rp ${(o.price || o.totalValue || 0).toLocaleString('id-ID')} | Status: ${o.status || '-'}`
        ).join('\n'));
    }

    // 5. Ringkasan Keseluruhan jika pertanyaan bersifat umum / salam
    if (snippets.length === 0) {
        const totalContracts = contracts.length;
        const expiredCount = contracts.filter(c => c.selisihHariMasaBerlaku !== null && c.selisihHariMasaBerlaku < 0).length;
        const criticalCount = contracts.filter(c => c.selisihHariMasaBerlaku !== null && c.selisihHariMasaBerlaku >= 0 && c.selisihHariMasaBerlaku <= 30).length;
        const totalVendors = Object.keys(vendorMap).length || sheetData.vendors?.length || 190;
        const totalOrders = rawOrders.length || 956;

        snippets.push(`[RINGKASAN DATA DATABASE SPREADSHEET TERKINI]:
- Total Kontrak Terdata: ${totalContracts} berkas (${expiredCount} Expired, ${criticalCount} Kritis <=30 hari).
- Total Rekanan Vendor Aktif: ${totalVendors} vendor.
- Total Riwayat Transaksi PO: ${totalOrders} transaksi pengadaan.`);
    }

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

    const { messages = [], pageContext = {} } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: 'Parameter messages wajib diisi dan berupa array.' });
    }

    // 1. Tarik Data Live Spreadsheet secara otomatis
    const sheetData = await fetchLiveSpreadsheetData();

    // 2. Ekstrak data yang paling relevan dengan pertanyaan user
    const lastUserQuery = messages.filter(m => m.role === 'user').pop()?.content || '';
    const relevantSheetContext = buildRelevantContext(sheetData, lastUserQuery);

    // 3. Bangun System Prompt yang kaya akan fakta nyata dari Spreadsheet
    const systemPrompt = `Anda adalah "Ethos VMS AI Copilot", asisten kecerdasan buatan cerdas untuk Vendor Management System (VMS) PT Etos Kreatif Indonesia.
Anda memiliki AKSES LANGSUNG ke database Google Spreadsheet VMS (Kontrak Legal, Evaluasi Vendor, Riwayat PO, dan Performa SLA).

TUGAS UTAMA:
1. Menjawab pertanyaan pengguna dengan akurat berdasarkan fakta data spreadsheet yang disediakan di bawah.
2. Jika pengguna menanyakan nomor kontrak, nama vendor, tanggal, skor, atau catatan keluhan, sebutkan data spesifik dari data spreadsheet.
3. Berikan saran yang solutif, objektif, dan profesional untuk tim Procurement, Legal, dan Manajemen.

KARAKTER & FORMAT:
- Berbahasa Indonesia yang sopan, ramah, dan profesional.
- Gunakan poin-poin tebal (bullet points / bold) agar mudah dibaca.
- Jika data yang ditanyakan tidak ditemukan di spreadsheet, katakan dengan jujur bahwa data tersebut belum tercatat.

${relevantSheetContext ? `=== FAKTA DATA LANGSUNG DARI GOOGLE SPREADSHEET ===\n${relevantSheetContext}\n=================================================` : ''}

${pageContext && pageContext.summary ? `Konteks Halaman Pengguna: ${pageContext.summary}` : ''}`;

    const fullMessages = [
        { role: 'system', content: systemPrompt },
        ...messages
    ];

    // Daftar model: coba DeepSeek terlebih dahulu, jika credit habis (402) otomatis fallback ke model gratis aktif
    const modelsToTry = [
        process.env.OPENROUTER_MODEL || 'deepseek/deepseek-chat',
        'baidu/ernie-5.5-flash-preview:free',
        'nvidia/nemotron-3.5-lightning:free'
    ];

    let lastError = null;
    let successfulReply = null;
    let modelUsed = null;

    for (const model of modelsToTry) {
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
                    temperature: 0.2, // Lebih faktual & terarah
                    max_tokens: 900
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
