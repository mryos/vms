// =====================================================
// VERCEL SERVERLESS FUNCTION: OPENROUTER AI CHATBOT
// Vendor Management System (VMS) - PT Etos Kreatif Indonesia
// =====================================================

export default async function handler(req, res) {
    // Set CORS headers
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

    // Bangun System Prompt yang kaya konteks VMS PT Etos Kreatif Indonesia
    const systemPrompt = `Anda adalah "Ethos VMS AI Copilot", asisten kecerdasan buatan cerdas untuk Vendor Management System (VMS) PT Etos Kreatif Indonesia.
Tugas utama Anda:
1. Membantu tim pengadaan (Procurement), Legal, dan Manajemen menganalisis data rekanan vendor, katalog harga pengadaan, kontrak legalitas, dan evaluasi performa SLA.
2. Memberikan rekomendasi vendor terbaik berdasarkan skor rating user, histori SLA ketepatan pengiriman, dan perbandingan harga termurah.
3. Menjelaskan status kepatuhan (Comply / Not Comply) serta masa berlaku kontrak rekanan jika ditanyakan.

Karakter & Gaya Komunikasi:
- Ramah, profesional, ringkas, solutif, dan objektif.
- Gunakan bahasa Indonesia yang baik, lugas, dan terstruktur (bisa menggunakan poin atau markdown jika relevan).
- Jika ada konteks data halaman yang disertakan, prioritaskan menjawab berbasis data aktual tersebut.

${pageContext && pageContext.summary ? `Konteks Halaman Saat Ini:\n${pageContext.summary}` : ''}`;

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
                    temperature: 0.3,
                    max_tokens: 800
                })
            });

            const data = await openRouterResp.json();

            if (openRouterResp.ok && data.choices && data.choices[0] && data.choices[0].message) {
                successfulReply = data.choices[0].message.content;
                modelUsed = model;
                break;
            } else {
                lastError = data.error ? data.error.message : `HTTP ${openRouterResp.status}`;
                console.warn(`Gagal memanggil model ${model}:`, lastError);
                // Jika error saldo habis (402) atau model not found (404), lanjutkan ke model gratis berikutnya
                continue;
            }
        } catch (err) {
            lastError = err.message;
            console.error(`Exception saat memanggil model ${model}:`, err);
        }
    }

    if (successfulReply) {
        return res.status(200).json({
            reply: successfulReply,
            model: modelUsed
        });
    }

    return res.status(502).json({
        error: `Gagal mendapatkan respon dari AI: ${lastError || 'Semua provider sedang sibuk'}.`
    });
}
