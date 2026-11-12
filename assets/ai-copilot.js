// =====================================================
// ETHOS VMS AI COPILOT - FLOATING CHATBOT CLIENT
// Integrated with OpenRouter AI API (DeepSeek / Free Models)
// =====================================================

(function () {
    if (window.VmsAiCopilotInitialized) return;
    window.VmsAiCopilotInitialized = true;

    // Pastikan stylesheet ai-copilot.css terpasang
    if (!document.getElementById('vmsAiCopilotStyles')) {
        const link = document.createElement('link');
        link.id = 'vmsAiCopilotStyles';
        link.rel = 'stylesheet';
        link.href = 'assets/ai-copilot.css';
        document.head.appendChild(link);
    }

    // State Chat
    let currentAnswerStyle = localStorage.getItem('vms_ai_style') || 'concise'; // 'concise' | 'detailed'
    let chatHistory = [
        {
            role: 'assistant',
            content: 'Silakan tanyakan data seputar vendor, nomor kontrak, riwayat PO, atau performa SLA.'
        }
    ];
    let isWaitingResponse = false;

    // Helper: deteksi konteks halaman saat ini
    function getPageContext() {
        const path = window.location.pathname.toLowerCase();
        let summary = `Halaman saat ini: ${path}. `;

        if (path.includes('katalog')) {
            const totProd = document.getElementById('catStatTotalProducts')?.textContent || '-';
            const totOrd = document.getElementById('catStatTotalOrders')?.textContent || '-';
            const topProd = document.getElementById('catStatTopProduct')?.textContent || '-';
            const onTime = document.getElementById('catStatOnTimeRate')?.textContent || '-';
            const scored = document.getElementById('catStatVendorScored')?.textContent || '-';
            summary += `Data Katalog Pengadaan: Total ${totProd} jenis produk, ${totOrd} transaksi PO. Produk terbanyak: ${topProd}. Ketepatan SLA pengiriman: ${onTime}. Vendor yang sudah dinilai: ${scored}.`;
        } else if (path.includes('kontrak')) {
            const compRate = document.getElementById('kpiComplianceRate')?.textContent || '-';
            const totalActive = document.getElementById('pipelineActiveRatio')?.textContent || '-';
            summary += `Data Contract Repository & Compliance: Rasio Kepatuhan: ${compRate}, Kontrak Aktif Selesai: ${totalActive}.`;
        } else if (path.includes('dashboard')) {
            summary += `Halaman Analitik Utama Evaluasi Kinerja Vendor.`;
        }

        return { summary, path };
    }

    // Helper: render Markdown sederhana menjadi HTML yang aman
    function formatMessageContent(text) {
        if (!text) return '';
        let sanitized = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        // Bold: **text**
        sanitized = sanitized.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        // Italic: *text*
        sanitized = sanitized.replace(/\*(.*?)\*/g, '<em>$1</em>');
        // Bullet list: line starting with - or *
        sanitized = sanitized.replace(/^\s*[-•]\s+(.*)$/gm, '<li class="ml-4 list-disc">$1</li>');
        // Linebreaks
        sanitized = sanitized.replace(/\n/g, '<br>');

        return sanitized;
    }

    // Inisialisasi DOM Widget
    function createWidget() {
        // 1. Launcher Button
        const launcher = document.createElement('div');
        launcher.className = 'vms-ai-launcher';
        launcher.id = 'vmsAiLauncher';
        launcher.innerHTML = `
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <span>Tanya AI</span>
        `;
        document.body.appendChild(launcher);

        // 2. Chat Window
        const win = document.createElement('div');
        win.className = 'vms-ai-window';
        win.id = 'vmsAiWindow';
        win.innerHTML = `
            <div class="vms-ai-header">
                <div class="vms-ai-title-wrap">
                    <span class="vms-ai-status-indicator"></span>
                    <div>
                        <div style="font-weight: 700; font-size: 13px; line-height: 1.2;">Asisten VMS</div>
                        <div style="font-size: 10px; color: #94a3b8;">Data Spreadsheet Terhubung</div>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 6px;">
                    <button class="vms-ai-mode-pill" id="vmsAiModeToggle" title="Ganti mode: Ringkas (To-the-point) vs Detail Analisis">
                        ${currentAnswerStyle === 'concise' ? '⚡ Ringkas' : '📊 Detail'}
                    </button>
                    <button class="vms-ai-header-btn" id="vmsAiClearBtn" title="Hapus Riwayat Chat">
                        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    </button>
                    <button class="vms-ai-header-btn" id="vmsAiCloseBtn" title="Tutup Jendela">
                        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                </div>
            </div>

            <div class="vms-ai-messages" id="vmsAiMessages">
                <!-- Chat messages rendered dynamically -->
            </div>

            <!-- Quick Suggestions -->
            <div class="vms-ai-quick-prompts">
                <button class="vms-ai-chip" data-prompt="Siapa vendor dengan jumlah PO terbanyak?">Vendor Terbanyak</button>
                <button class="vms-ai-chip" data-prompt="Kontrak mana yang kritis atau mendekati kedaluwarsa?">Kontrak Kritis</button>
                <button class="vms-ai-chip" data-prompt="Bagaimana analisis ketepatan SLA pengiriman vendor?">Analisis SLA</button>
                <button class="vms-ai-chip" data-prompt="Tampilkan rekomendasi vendor dengan skor tertinggi">Vendor Rating Tertinggi</button>
            </div>

            <!-- Input Bar -->
            <form class="vms-ai-input-bar" id="vmsAiForm">
                <input type="text" id="vmsAiInput" class="vms-ai-input" placeholder="Tanyakan data vendor, PO, kontrak..." autocomplete="off">
                <button type="submit" id="vmsAiSendBtn" class="vms-ai-send-btn" title="Kirim">
                    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M12 5l7 7-7 7"/></svg>
                </button>
            </form>
        `;
        document.body.appendChild(win);

        // Bind Events
        launcher.onclick = () => {
            const isVisible = win.classList.contains('active');
            if (isVisible) {
                win.classList.remove('active');
            } else {
                win.classList.add('active');
                setTimeout(() => document.getElementById('vmsAiInput')?.focus(), 100);
            }
        };

        document.getElementById('vmsAiCloseBtn').onclick = () => {
            win.classList.remove('active');
        };

        const modeBtn = document.getElementById('vmsAiModeToggle');
        if (modeBtn) {
            modeBtn.onclick = () => {
                currentAnswerStyle = currentAnswerStyle === 'concise' ? 'detailed' : 'concise';
                localStorage.setItem('vms_ai_style', currentAnswerStyle);
                modeBtn.textContent = currentAnswerStyle === 'concise' ? '⚡ Ringkas' : '📊 Detail';
                modeBtn.title = currentAnswerStyle === 'concise' ? 'Mode Ringkas Aktif (Klik untuk Mode Detail)' : 'Mode Detail Aktif (Klik untuk Mode Ringkas)';
            };
        }

        document.getElementById('vmsAiClearBtn').onclick = () => {
            chatHistory = [
                {
                    role: 'assistant',
                    content: 'Riwayat obrolan dibersihkan. Ada yang bisa saya bantu lagi?'
                }
            ];
            renderMessages();
        };

        // Quick prompts click
        win.querySelectorAll('.vms-ai-chip').forEach(btn => {
            btn.onclick = () => {
                const prompt = btn.getAttribute('data-prompt');
                if (prompt && !isWaitingResponse) {
                    sendUserMessage(prompt);
                }
            };
        });

        // Form submit
        const form = document.getElementById('vmsAiForm');
        form.onsubmit = (e) => {
            e.preventDefault();
            const input = document.getElementById('vmsAiInput');
            const val = (input ? input.value : '').trim();
            if (val && !isWaitingResponse) {
                input.value = '';
                sendUserMessage(val);
            }
        };

        renderMessages();
    }

    // Render daftar pesan
    function renderMessages() {
        const msgContainer = document.getElementById('vmsAiMessages');
        if (!msgContainer) return;

        msgContainer.innerHTML = chatHistory.map(msg => {
            const isUser = msg.role === 'user';
            const formatted = formatMessageContent(msg.content);
            return `
                <div class="vms-ai-msg ${isUser ? 'user' : 'assistant'}">
                    ${formatted}
                </div>
            `;
        }).join('');

        if (isWaitingResponse) {
            msgContainer.innerHTML += `
                <div class="vms-ai-msg assistant" id="vmsAiTypingIndicator">
                    <span class="vms-ai-typing">
                        <span class="vms-ai-dot"></span>
                        <span class="vms-ai-dot"></span>
                        <span class="vms-ai-dot"></span>
                    </span>
                    <span style="font-size: 11px; color: #64748b; margin-left: 4px;">Menganalisis...</span>
                </div>
            `;
        }

        msgContainer.scrollTop = msgContainer.scrollHeight;
    }

    // Mengirim pesan pengguna ke serverless function /api/chat
    async function sendUserMessage(text) {
        chatHistory.push({ role: 'user', content: text });
        isWaitingResponse = true;
        renderMessages();

        const sendBtn = document.getElementById('vmsAiSendBtn');
        const inputEl = document.getElementById('vmsAiInput');
        if (sendBtn) sendBtn.disabled = true;
        if (inputEl) inputEl.disabled = true;

        try {
            const pageContext = getPageContext();
            
            // Format pesan yang dikirimkan (ambil 6 pesan terakhir agar konteks efisien)
            const recentMessages = chatHistory.slice(-6).map(m => ({
                role: m.role,
                content: m.content
            }));

            const resp = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    messages: recentMessages,
                    pageContext: pageContext,
                    answerStyle: currentAnswerStyle
                })
            });

            if (!resp.ok) {
                const errData = await resp.json().catch(() => ({}));
                throw new Error(errData.error || `HTTP ${resp.status}`);
            }

            const data = await resp.json();
            const botReply = data.reply || 'Maaf, saya tidak menerima jawaban yang valid.';
            
            chatHistory.push({
                role: 'assistant',
                content: botReply
            });
        } catch (err) {
            console.error('AI Chat Error:', err);
            chatHistory.push({
                role: 'assistant',
                content: `⚠️ **Gagal terhubung ke AI**: ${err.message}. Pastikan koneksi internet stabil atau periksa konfigurasi OpenRouter API di Vercel.`
            });
        } finally {
            isWaitingResponse = false;
            renderMessages();
            if (sendBtn) sendBtn.disabled = false;
            if (inputEl) {
                inputEl.disabled = false;
                inputEl.focus();
            }
        }
    }

    // Inisialisasi saat dokumen siap
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createWidget);
    } else {
        createWidget();
    }
})();
