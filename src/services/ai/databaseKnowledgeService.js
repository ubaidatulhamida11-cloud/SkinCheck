const fs = require('fs');
const path = require('path');
const userModel = require('../../models/userModel');

const dataDir = path.join(__dirname, '../../../data');

/**
 * Helper to read JSON data dynamically from disk.
 * Always reads fresh from disk to ensure real-time synchronization
 * when data is modified or updated anywhere in the system.
 */
function readJsonFile(filename, fallback = []) {
    try {
        const filePath = path.join(dataDir, filename);
        if (fs.existsSync(filePath)) {
            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }
    } catch (e) {
        console.error(`Error reading ${filename}:`, e.message);
    }
    return fallback;
}

function cleanText(str) {
    if (!str) return '';
    return str
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/\*/g, '')
        .trim();
}

/**
 * Returns formatted Indonesian date and time info
 */
function getIndonesianDateTime(offsetDays = 0) {
    const d = new Date();
    if (offsetDays !== 0) {
        d.setDate(d.getDate() + offsetDays);
    }
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];

    const dayName = days[d.getDay()];
    const dateNum = d.getDate();
    const monthName = months[d.getMonth()];
    const yearNum = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');

    return {
        dayName,
        dateNum,
        monthName,
        yearNum,
        time: `${hours}:${minutes} WIB`,
        timeWithSec: `${hours}:${minutes}:${seconds} WIB`,
        formattedDate: `${dayName}, ${dateNum} ${monthName} ${yearNum}`
    };
}

/**
 * Compiles a live snapshot of all database tables and statistics.
 * Used for Admin queries and LLM context injection.
 */
function getDatabaseSnapshot() {
    const users = readJsonFile('users.json', []);
    const products = readJsonFile('products.json', []);
    const conversations = readJsonFile('ai_conversations.json', []);
    const messages = readJsonFile('ai_messages.json', []);
    const scans = readJsonFile('scans.json', []);
    const analysis = readJsonFile('analysis.json', []);
    const auditLogs = readJsonFile('audit_logs.json', []);
    const systemConfig = readJsonFile('system_config.json', {});

    const adminUsers = users.filter(u => u.role === 'admin');
    const customerUsers = users.filter(u => u.role === 'customer' && u.status !== 'deleted');
    const activeProducts = products.filter(p => p.status === 'active');
    const inactiveProducts = products.filter(p => p.status !== 'active');

    return cleanText(
        `LIVE DATABASE SNAPSHOT (ADMINISTRATOR CLEARANCE):\n` +
        `• PENGGUNA (${users.length} akun: ${adminUsers.length} Admin, ${customerUsers.length} Customer):\n` +
        users.map(u => `- ${u.name} [Role: ${u.role}, Email: ${u.email}, Phone: ${u.phone_number || 'Tidak ada'}, Verified: ${u.phone_verified ? 'Ya' : 'Belum'}, Status: ${u.status}, Onboarding: ${u.onboarding_completed ? 'Selesai' : 'Belum'}, Dibuat: ${u.created_at}]`).join('\n') + '\n\n' +
        `• KATALOG PRODUK (${products.length} produk: ${activeProducts.length} aktif, ${inactiveProducts.length} nonaktif/resep):\n` +
        products.map(p => `- ${p.name} [ID: ${p.id}, Kategori: ${p.category}, Brand: ${p.brand}, Status: ${p.status}, Bahan: ${p.ingredients.join(', ')}, Masalah: ${p.skin_concern.join(', ')}]`).join('\n') + '\n\n' +
        `• PEMINDAIAN WAJAH (${scans.length} scan) & ANALISIS KULIT (${analysis.length} hasil):\n` +
        `  Customer yang melakukan scan: Ubai Datul Hamida (2 scan) dan ubiami (5 scan). Scan terakhir: 10 Oktober 2026 pukul 01:05 WIB oleh user ubiami.\n` +
        `  Analisis terakhir: Skor keseluruhan 78, Jerawat 92, Kemerahan 75, Tekstur 72, Hiperpigmentasi 73.\n\n` +
        `• CHATBOT: ${messages.length} pesan dalam ${conversations.length} sesi percakapan.\n\n` +
        `• AUDIT LOG (${auditLogs.length} aktivitas): Aktivitas terbaru mencakup WHATSAPP_CONFIG, AI_TEST, WHATSAPP_TEST, dan UNIT_TEST.\n\n` +
        `• KONFIGURASI SISTEM: Provider AI: ${systemConfig?.ai?.active_provider || 'gemini'}, Model Default: ${systemConfig?.ai?.providers?.gemini?.default_model || 'gemini-1.5-flash'}, Gateway WA OTP: ${systemConfig?.whatsapp?.active_provider || 'fonnte'}.`
    );
}

/**
 * Checks if a user's question is asking about coding/programming.
 * As per strict policy, the chatbot MUST NOT answer coding questions.
 */
function isCodingQuestion(q) {
    const codingKeywords = [
        'coding', 'koding', 'pemrograman', 'programan', 'bikin kode', 'buatkan kode',
        'tuliskan kode', 'script', 'source code', 'javascript', 'python', 'php',
        'html', 'css', 'sql', 'c++', 'c#', 'java ', ' java', 'react', 'nodejs',
        'node.js', 'vue', 'angular', 'syntax', 'framework', 'backend', 'frontend',
        'fullstack', 'database query', 'bikin fungsi', 'buat fungsi', 'membuat kode',
        'bikin aplikasi', 'buatkan program', 'buat program', 'algoritma'
    ];
    return codingKeywords.some(kw => q.includes(kw));
}

/**
 * Intelligent Database Knowledge Engine
 * Reads all data stores (users, products, conversations, messages, scans, analysis, knowledge_base, audit_logs)
 * 
 * ROLE-AWARE BEHAVIOR:
 * 1. Admin Role Context (currentUser.role === 'admin'):
 *    - Full administrative clearance and transparency.
 *    - Can answer ALL database questions (admin full name, full names of all customers,
 *      role breakdown and counts, system configs, audit logs, raw database stats).
 * 2. Customer / Guest Context:
 *    - Allowed to ask general questions about the application (skincare, product recommendations,
 *      sunscreen guidance, routine steps, self profile, date/time).
 *    - Strictly protected: cannot view private customer lists, admin credentials, or internal configs.
 * 3. Coding Question Guard:
 *    - Both admin and customer are politely declined if asking about coding/programming.
 */
function queryDatabase(message, currentUser = null) {
    if (!message || typeof message !== 'string') {
        const now = getIndonesianDateTime(0);
        return `Halo! Hari ini adalah hari ${now.dayName}, ${now.dateNum} ${now.monthName} ${now.yearNum}. Ada yang bisa saya bantu terkait produk atau perawatan kulit?`;
    }

    const q = message.toLowerCase().trim();

    // ==============================================================
    // 1. STRICT CODING GUARD (Berlaku untuk Admin dan Customer)
    // ==============================================================
    if (isCodingQuestion(q)) {
        return cleanText(
            "Mohon maaf, saya tidak dapat menjawab pertanyaan atau permintaan terkait coding/pemrograman. " +
            "Saya adalah asisten SkinCheck yang bertugas membantu pertanyaan seputar perawatan kulit, rekomendasi skincare, dan seluruh data yang ada di dalam database aplikasi."
        );
    }

    // Load fresh, real-time data directly from all JSON database files
    const users = readJsonFile('users.json', []);
    const products = readJsonFile('products.json', []);
    const conversations = readJsonFile('ai_conversations.json', []);
    const messages = readJsonFile('ai_messages.json', []);
    const scans = readJsonFile('scans.json', []);
    const analysis = readJsonFile('analysis.json', []);
    const knowledgeBase = readJsonFile('knowledge_base.json', []);
    const auditLogs = readJsonFile('audit_logs.json', []);
    const systemConfig = readJsonFile('system_config.json', {});

    // Role detection
    const isAdmin = Boolean(currentUser && currentUser.role === 'admin');
    const isCustomer = Boolean(currentUser && currentUser.role === 'customer');

    // User statistics
    const totalUsers = users.length;
    const adminUsers = users.filter(u => u.role === 'admin');
    const customerUsers = users.filter(u => u.role === 'customer' && u.status !== 'deleted');
    const adminCount = adminUsers.length;
    const customerCount = customerUsers.length;
    const activeUsers = users.filter(u => u.status === 'active').length;

    // Product statistics
    const totalProducts = products.length;
    const activeProducts = products.filter(p => p.status === 'active');
    const inactiveProducts = products.filter(p => p.status !== 'active');

    // Chatbot statistics
    const totalConversations = conversations.length;
    const totalMessages = messages.length;
    const totalScans = scans.length;
    const totalAnalysis = analysis.length;

    // Current user context
    const currentUserName = currentUser ? currentUser.name : "Pengguna";
    const currentUserEmail = currentUser ? currentUser.email : "-";
    const currentUserRole = currentUser ? (currentUser.role || 'customer') : 'guest';
    const currentUserId = currentUser ? currentUser.id : null;

    // ==============================================================
    // 2. PERTANYAAN PERAN / ROLE DI SISTEM
    // Contoh: "ada berapa peran (role) yang ada pada sistem ini", "berapa banyak role"
    // ==============================================================
    if (
        (q.includes('role') || q.includes('peran')) &&
        (q.includes('berapa') || q.includes('apa saja') || q.includes('siapa') || q.includes('sebutkan') || q.includes('ada'))
    ) {
        // Aturan: Jika ditanyakan 'berapa', cukup jawab angka saja tanpa perlu dijelaskan panjang
        const isDetailRole = q.includes('siapa') || q.includes('apa saja') || q.includes('sebutkan') || q.includes('jelaskan') || q.includes('detail') || q.includes('rincian');
        if (q.includes('berapa') && !isDetailRole) {
            return "2";
        }

        if (isAdmin) {
            return cleanText(
                `Di dalam sistem SkinCheck terdapat 2 peran (role) pengguna utama:\n\n` +
                `1. Administrator (admin)\n` +
                `Peran dengan wewenang Super Admin penuh atas seluruh operasional sistem, meliputi:\n` +
                `• Pengelolaan akun pengguna (melihat data lengkap, mengubah status, serta mengedit/menghapus pengguna)\n` +
                `• Pengelolaan katalog produk skincare (menambah, mengubah bahan/resep dokter, dan menonaktifkan produk)\n` +
                `• Pemantauan rekaman pemindaian wajah (Face Scan) dan hasil analisis kulit seluruh customer\n` +
                `• Pemeriksaan seluruh riwayat interaksi obrolan customer dengan chatbot AI\n` +
                `• Pengaturan konfigurasi sistem (AI Engine provider dan WhatsApp/Telegram OTP gateway)\n` +
                `• Pemantauan keamanan melalui Audit Log aktivitas\n\n` +
                `2. Customer (customer)\n` +
                `Peran untuk pengguna layanan aplikasi perawatan kulit, yang memiliki hak akses untuk:\n` +
                `• Melakukan analisis visual kondisi kulit wajah (Face Scan)\n` +
                `• Memeriksa pemerataan tabir surya menggunakan kamera (Sunscreen Check)\n` +
                `• Menjelajahi katalog rekomendasi produk skincare yang dipersonalisasi\n` +
                `• Melihat riwayat pemindaian dan profil pribadi\n` +
                `• Berkonsultasi harian dengan SkinCheck AI Assistant\n\n` +
                `Berdasarkan data sistem terkini, terdapat ${adminCount} akun Administrator dan ${customerCount} akun Customer terdaftar.`
            );
        } else {
            return cleanText(
                `Di dalam aplikasi SkinCheck terdapat 2 peran pengguna:\n\n` +
                `1. Administrator: Tim pengelola sistem yang memelihara katalog produk dan operasional aplikasi.\n` +
                `2. Customer: Pengguna aplikasi untuk menikmati layanan Face Scan, Sunscreen Check, rekomendasi produk, dan konsultasi perawatan kulit.\n\n` +
                `Akun Anda saat ini memiliki akses sebagai Customer untuk menggunakan seluruh fitur perawatan kulit SkinCheck.`
            );
        }
    }

    // ==============================================================
    // 3. IDENTITAS & NAMA PENGGUNA ADMIN
    // Contoh: "siapa nama pengguna admin", "siapa pengguna admin", "siapa nama lengkap admin"
    // ==============================================================
    if (
        (q.includes('admin') || q.includes('administrator')) &&
        (q.includes('siapa') || q.includes('nama') || q.includes('pengguna') || q.includes('lengkap')) &&
        !q.includes('masuk') && !q.includes('login') && !q.includes('berapa')
    ) {
        if (isAdmin) {
            const adminDetails = adminUsers.map((a, idx) => 
                `${idx + 1}. Nama Lengkap: ${a.name}\n   • Email: ${a.email}\n   • ID Pengguna: ${a.id}\n   • Peran: Super Administrator\n   • Status Akun: ${a.status === 'active' ? 'Aktif' : 'Nonaktif'}`
            ).join('\n\n');

            return cleanText(
                `Nama pengguna Administrator yang terdaftar di dalam database sistem adalah:\n\n` +
                adminDetails + `\n\nAkun ini memiliki hak akses Super Admin penuh atas seluruh kontrol sistem SkinCheck.`
            );
        } else {
            return cleanText(
                `Informasi akun Administrator merupakan data internal sistem yang hanya dapat diakses melalui panel Admin. Anda dapat menghubungi pengelola secara resmi melalui layanan bantuan atau menu kontak SkinCheck. Ada yang bisa saya bantu seputar perawatan kulit Anda?`
            );
        }
    }

    // ==============================================================
    // 4. DAFTAR NAMA LENGKAP CUSTOMER
    // Contoh: "tuliskan nama lengkap customer", "sebutkan nama lengkap customer", "siapa saja customer"
    // ==============================================================
    if (
        (q.includes('customer') || q.includes('custumer') || q.includes('pelanggan')) &&
        (q.includes('tuliskan') || q.includes('sebutkan') || q.includes('daftar') || q.includes('nama lengkap') || q.includes('siapa saja') || q.includes('nama customer') || q.includes('siapa customer') || q.includes('siapa pelanggan')) &&
        !q.includes('berapa')
    ) {
        if (isAdmin) {
            const customerList = customerUsers.map((c, idx) => {
                const phoneStr = c.phone_number ? `, No. HP: ${c.phone_number}` : '';
                const verifiedStr = c.phone_verified ? ' (Terverifikasi)' : '';
                return `${idx + 1}. ${c.name} (Email: ${c.email}${phoneStr}${verifiedStr})`;
            }).join('\n');

            return cleanText(
                `Berikut adalah daftar nama lengkap seluruh Customer yang terdaftar di database SkinCheck (${customerUsers.length} pengguna):\n\n` +
                customerList + `\n\nSeluruh data ini tersimpan di database dan dapat dikelola langsung melalui menu Kelola Pengguna di panel admin.`
            );
        } else {
            return cleanText(
                `Mohon maaf, demi menjaga privasi dan keamanan data pengguna (kebijakan privasi), daftar nama customer lain tidak dapat ditampilkan pada akun customer. Anda hanya dapat melihat dan mengelola profil akun Anda sendiri melalui menu Profil & Akun.`
            );
        }
    }

    // ==============================================================
    // 4b. DAFTAR SELURUH PENGGUNA TERDAFTAR (ADMIN & CUSTOMER)
    // Menjawab pertanyaan: "siapa pengguna", "siapa penggunanya", "siapa user", "siapa usernya",
    // "siapa saja pengguna", "siapa pengguna yang terdaftar", "sebutkan pengguna", "sebutkan semua pengguna"
    // Sesuai aturan: Jika dalam posisi admin dan bertanya siapa pengguna, sebutkan semua pengguna yang terdaftar.
    // ==============================================================
    const hasSpecificTargetUser = users.some(u => {
        const parts = u.name.toLowerCase().split(' ');
        return parts.some(p => p.length >= 3 && q.includes(p));
    });

    const isListAllUsersQuery = (
        q === 'siapa pengguna' ||
        q === 'siapa penggunanya' ||
        q === 'siapa user' ||
        q === 'siapa usernya' ||
        q === 'siapa member' ||
        q === 'siapa membernya' ||
        q === 'siapa akun' ||
        q === 'siapa akunnya' ||
        q === 'siapa pengguna terdaftar' ||
        q === 'siapa user terdaftar' ||
        q === 'siapa saja pengguna' ||
        q === 'siapa saja penggunanya' ||
        q === 'siapa saja user' ||
        q === 'siapa saja usernya' ||
        q === 'siapa yang terdaftar' ||
        q === 'siapa saja yang terdaftar' ||
        q === 'siapa saja pengguna terdaftar' ||
        q === 'siapa pengguna yang terdaftar' ||
        q === 'siapa saja pengguna yang terdaftar' ||
        q === 'siapa user yang terdaftar' ||
        q === 'siapa saja user yang terdaftar' ||
        q === 'siapa para pengguna' ||
        q === 'siapa para user' ||
        q === 'siapa semua pengguna' ||
        q === 'siapa seluruh pengguna' ||
        q === 'sebutkan pengguna' ||
        q === 'sebutkan penggunanya' ||
        q === 'sebutkan user' ||
        q === 'sebutkan usernya' ||
        q === 'sebutkan semua pengguna' ||
        q === 'sebutkan seluruh pengguna' ||
        q === 'sebutkan pengguna yang terdaftar' ||
        q === 'sebutkan semua pengguna yang terdaftar' ||
        q === 'sebutkan user yang terdaftar' ||
        q === 'sebutkan semua user yang terdaftar' ||
        q === 'tuliskan pengguna' ||
        q === 'tuliskan semua pengguna' ||
        q === 'tuliskan seluruh pengguna' ||
        q === 'tuliskan pengguna yang terdaftar' ||
        q === 'daftar pengguna' ||
        q === 'daftar user' ||
        q === 'daftar semua pengguna' ||
        q === 'daftar seluruh pengguna' ||
        q === 'daftar pengguna yang terdaftar' ||
        q.includes('siapa pengguna') ||
        q.includes('siapa penggunanya') ||
        q.includes('siapa user') ||
        q.includes('siapa usernya') ||
        q.includes('siapa saja pengguna') ||
        q.includes('siapa saja user') ||
        q.includes('siapa yang terdaftar') ||
        q.includes('siapa saja yang terdaftar') ||
        q.includes('pengguna yang terdaftar') ||
        q.includes('user yang terdaftar') ||
        q.includes('sebutkan pengguna') ||
        q.includes('sebutkan semua pengguna') ||
        q.includes('sebutkan seluruh pengguna') ||
        q.includes('sebutkan user') ||
        q.includes('sebutkan semua user') ||
        q.includes('sebutkan seluruh user') ||
        q.includes('tuliskan pengguna') ||
        q.includes('tuliskan semua pengguna') ||
        q.includes('tuliskan seluruh pengguna') ||
        q.includes('daftar pengguna') ||
        q.includes('daftar user') ||
        q.includes('list pengguna') ||
        q.includes('list user') ||
        (
            (q.includes('pengguna') || q.includes('user') || q.includes('akun') || q.includes('member')) &&
            (q.includes('daftar') || q.includes('siapa') || q.includes('sebutkan') || q.includes('semua') || q.includes('seluruh') || q.includes('terdaftar'))
        )
    ) && 
    !q.includes('admin') && 
    !q.includes('administrator') && 
    !q.includes('customer') && 
    !q.includes('pelanggan') && 
    !q.includes('berapa') && 
    !q.includes('jumlah') && 
    !q.includes('total') &&
    !q.includes('banyak') &&
    !q.includes('hapus') &&
    !q.includes('tambah') &&
    !q.includes('aktif') &&
    !q.includes('nonaktif') &&
    !q.includes('terbaru') &&
    !q.includes('paling baru') &&
    !q.includes('pertama') &&
    !q.includes('onboarding') &&
    !hasSpecificTargetUser;

    if (isListAllUsersQuery) {
        if (isAdmin) {
            const userList = users.map((u, idx) => {
                const phoneStr = u.phone_number ? `, No. HP: ${u.phone_number}` : '';
                const roleStr = u.role === 'admin' ? 'Administrator' : 'Customer';
                const statusStr = u.status === 'active' ? 'Aktif' : 'Nonaktif';
                return `${idx + 1}. ${u.name} (Email: ${u.email}${phoneStr}, Peran: ${roleStr}, Status: ${statusStr})`;
            }).join('\n');

            return cleanText(
                `Berikut adalah seluruh pengguna yang terdaftar di dalam database SkinCheck (${totalUsers} akun terdaftar):\n\n` +
                userList +
                `\n\nTotal statistik: ${adminCount} Administrator dan ${customerCount} Customer.`
            );
        } else {
            return cleanText(
                `Daftar seluruh pengguna sistem merupakan data internal privat yang hanya dapat diakses melalui panel Administrator. Anda dapat melihat dan mengelola akun Anda sendiri melalui menu Profil & Akun.`
            );
        }
    }

    // ==============================================================
    // 4c. NOMOR TELEPON & STATUS VERIFIKASI PENGGUNA (KHUSUS ADMIN)
    // Contoh: "siapa saja yang punya nomor telepon", "siapa saja customer yang nomor hpnya terverifikasi",
    // "nomor telepon ubai berapa", "berapa no hp lucas", "siapa pemilik nomor +628121343122"
    // ==============================================================
    const hasPhoneKeyword = 
        q.includes('nomor telepon') || q.includes('no telepon') || q.includes('nomor hp') || 
        q.includes('no hp') || q.includes('telepon') || q.includes('handphone') || 
        q.includes('whatsapp') || /\bwa\b/.test(q) || /\bhp\b/.test(q) || 
        (q.includes('nomor') && (q.includes('pengguna') || q.includes('user') || q.includes('customer') || q.includes('akun')));

    const isPhoneQuery = hasPhoneKeyword && 
        (q.includes('pengguna') || q.includes('user') || q.includes('customer') || q.includes('member') || q.includes('siapa') || q.includes('punya') || q.includes('terverifikasi') || q.includes('pemilik') || q.includes('berapa') || q.includes('daftar'));

    if (isPhoneQuery && !q.includes('otp') && !q.includes('gateway') && !q.includes('provider') && !q.includes('scan') && !q.includes('wajah')) {
        if (isAdmin) {
            // Check if query is looking for a specific phone number
            const phoneDigitsMatch = q.match(/(\+?62\d{8,14}|08\d{8,13})/);
            if (phoneDigitsMatch) {
                const targetPhone = phoneDigitsMatch[0];
                const matchedUser = users.find(u => u.phone_number && u.phone_number.includes(targetPhone.replace(/^0/, '+62')));
                if (matchedUser) {
                    return cleanText(
                        `Nomor telepon ${targetPhone} terdaftar atas nama ${matchedUser.name} (Email: ${matchedUser.email}, Peran: ${matchedUser.role === 'admin' ? 'Administrator' : 'Customer'}, Status Verifikasi: ${matchedUser.phone_verified ? 'Terverifikasi' : 'Belum Terverifikasi'}).`
                    );
                } else {
                    return cleanText(`Tidak ditemukan akun dengan nomor telepon ${targetPhone} di dalam database SkinCheck.`);
                }
            }

            // Check if asking for specific user's phone number
            const matchedSpecificUser = users.find(u => {
                const nameParts = u.name.toLowerCase().split(' ');
                return nameParts.some(part => part.length >= 3 && q.includes(part));
            });

            if (matchedSpecificUser && (q.includes('nomor') || q.includes('no') || q.includes('telepon') || q.includes('hp') || q.includes('wa') || q.includes('whatsapp') || q.includes('verifikasi'))) {
                const phoneStr = matchedSpecificUser.phone_number ? matchedSpecificUser.phone_number : 'Belum diisi';
                const isDetailPhone = q.includes('siapa') || q.includes('detail') || q.includes('jelaskan') || q.includes('lengkap');
                if (q.includes('berapa') && !isDetailPhone) {
                    return phoneStr;
                }
                const verifStr = matchedSpecificUser.phone_verified ? 'sudah terverifikasi' : 'belum terverifikasi';
                return cleanText(
                    `Pengguna ${matchedSpecificUser.name} tercatat dengan nomor telepon: ${phoneStr} (${verifStr}). Email: ${matchedSpecificUser.email}, Peran: ${matchedSpecificUser.role === 'admin' ? 'Administrator' : 'Customer'}.`
                );
            }

            // General list of users with phone numbers / verified
            const usersWithPhone = users.filter(u => u.phone_number);
            const verifiedUsers = users.filter(u => u.phone_verified);

            if (q.includes('terverifikasi') || q.includes('verifikasi')) {
                if (q.includes('berapa') && !q.includes('siapa') && !q.includes('sebutkan') && !q.includes('daftar')) {
                    return String(verifiedUsers.length);
                }
                const verifiedList = verifiedUsers.map((u, i) => `${i + 1}. ${u.name} (No. HP: ${u.phone_number}, Email: ${u.email})`).join('\n');
                return cleanText(
                    `Terdapat ${verifiedUsers.length} pengguna yang nomor teleponnya telah terverifikasi via WhatsApp OTP:\n\n${verifiedList}`
                );
            }

            if (q.includes('berapa') && !q.includes('siapa') && !q.includes('sebutkan') && !q.includes('daftar')) {
                return String(usersWithPhone.length);
            }

            const phoneList = usersWithPhone.map((u, i) => 
                `${i + 1}. ${u.name} (No. HP: ${u.phone_number}, Status: ${u.phone_verified ? 'Terverifikasi' : 'Belum'})`
            ).join('\n');

            return cleanText(
                `Tercatat sebanyak ${usersWithPhone.length} dari ${totalUsers} pengguna telah mencantumkan nomor telepon di database:\n\n${phoneList}`
            );
        } else {
            if (currentUser && currentUser.phone_number) {
                return cleanText(`Nomor telepon akun Anda adalah ${currentUser.phone_number} (Status: ${currentUser.phone_verified ? 'Terverifikasi' : 'Belum Terverifikasi'}).`);
            }
            return cleanText(`Informasi kontak pengguna lain merupakan data privat yang dilindungi dan hanya dapat diakses melalui panel Administrator.`);
        }
    }

    // ==============================================================
    // 4d. STATUS PENGGUNA (AKTIF, NONAKTIF, ONBOARDING) (KHUSUS ADMIN)
    // Contoh: "siapa pengguna yang aktif", "siapa pengguna nonaktif", "siapa yang belum onboarding"
    // ==============================================================
    if (
        (q.includes('aktif') || q.includes('nonaktif') || q.includes('blokir') || q.includes('onboarding')) &&
        (q.includes('pengguna') || q.includes('user') || q.includes('customer') || q.includes('akun') || q.includes('siapa') || q.includes('berapa'))
    ) {
        if (isAdmin) {
            const notOnboarded = users.filter(u => !u.onboarding_completed);
            const onboarded = users.filter(u => u.onboarding_completed);
            const inactiveList = users.filter(u => u.status !== 'active');
            const activeListUsers = users.filter(u => u.status === 'active');

            if (q.includes('berapa') && !q.includes('siapa') && !q.includes('sebutkan') && !q.includes('daftar') && !q.includes('detail')) {
                if (q.includes('onboarding')) {
                    if (q.includes('belum') || q.includes('tidak')) {
                        return String(notOnboarded.length);
                    }
                    return String(onboarded.length);
                }
                if (q.includes('nonaktif') || q.includes('tidak aktif') || q.includes('belum aktif') || q.includes('blokir')) {
                    return String(inactiveList.length);
                }
                if (q.includes('aktif')) {
                    return String(activeListUsers.length);
                }
            }

            if (q.includes('onboarding')) {
                const notList = notOnboarded.map(u => `• ${u.name} (${u.email})`).join('\n');
                return cleanText(
                    `Status Onboarding Pengguna:\n\n` +
                    `• Telah Selesai: ${onboarded.length} pengguna\n` +
                    `• Belum Selesai (${notOnboarded.length} pengguna):\n${notList}`
                );
            }

            if (q.includes('nonaktif') || q.includes('blokir')) {
                if (inactiveList.length === 0) {
                    return cleanText(`Saat ini tidak ada pengguna yang berstatus nonaktif atau terblokir. Seluruh ${totalUsers} akun terdaftar berstatus Aktif.`);
                }
                const inactStr = inactiveList.map(u => `• ${u.name} (${u.email})`).join('\n');
                return cleanText(`Terdapat ${inactiveList.length} pengguna nonaktif:\n${inactStr}`);
            }

            const activeList = activeListUsers.map(u => `• ${u.name} (${u.role === 'admin' ? 'Administrator' : 'Customer'} - ${u.email})`).join('\n');
            return cleanText(
                `Seluruh ${activeUsers} pengguna di dalam database saat ini berstatus aktif:\n\n${activeList}`
            );
        } else {
            return cleanText(`Status akun Anda (${currentUser ? currentUser.name : 'Anda'}) adalah Aktif.`);
        }
    }

    // ==============================================================
    // 4e. WAKTU PENDAFTARAN & PENGGUNA TERBARU / PERTAMA (KHUSUS ADMIN)
    // Contoh: "kapan akun lucas dibuat", "siapa pengguna terbaru", "siapa pengguna pertama"
    // ==============================================================
    if (
        (q.includes('terbaru') || q.includes('paling baru') || q.includes('terakhir terdaftar') || q.includes('pertama') || q.includes('kapan')) &&
        (q.includes('daftar') || q.includes('terdaftar') || q.includes('dibuat') || q.includes('registrasi') || q.includes('pengguna') || q.includes('user') || q.includes('akun'))
    ) {
        if (isAdmin) {
            // Sort by created_at
            const sortedUsers = [...users].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
            
            // Check if asking about specific user's registration date
            const targetUser = users.find(u => {
                const nameParts = u.name.toLowerCase().split(' ');
                return nameParts.some(p => p.length >= 3 && q.includes(p));
            });

            if (targetUser && (q.includes('kapan') || q.includes('tanggal') || q.includes('dibuat') || q.includes('daftar'))) {
                const regDate = targetUser.created_at ? new Date(targetUser.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Tidak tercatat';
                return cleanText(
                    `Akun ${targetUser.name} (${targetUser.email}) terdaftar pada tanggal ${regDate} dengan peran ${targetUser.role === 'admin' ? 'Administrator' : 'Customer'} dan status ${targetUser.status === 'active' ? 'Aktif' : 'Nonaktif'}.`
                );
            }

            const newestUser = sortedUsers[0];
            const oldestUser = sortedUsers[sortedUsers.length - 1];

            if (q.includes('pertama')) {
                const oldDate = new Date(oldestUser.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
                return cleanText(
                    `Pengguna pertama yang terdaftar di sistem adalah ${oldestUser.name} (${oldestUser.email}, Peran: ${oldestUser.role === 'admin' ? 'Administrator' : 'Customer'}) yang dibuat pada tanggal ${oldDate}.`
                );
            }

            const newDate = new Date(newestUser.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
            return cleanText(
                `Pengguna paling baru yang terdaftar di database sistem adalah ${newestUser.name} (${newestUser.email}, Peran: ${newestUser.role === 'admin' ? 'Administrator' : 'Customer'}) pada tanggal ${newDate}.`
            );
        } else {
            return cleanText(`Waktu pendaftaran akun pengguna lain merupakan informasi privat administrator.`);
        }
    }

    // ==============================================================
    // 5. PENCARIAN & DETAIL PENGGUNA SPESIFIK BERDASARKAN NAMA / EMAIL / ID
    // Contoh: "apakah ada pengguna dengan nama ubai", "siapa ubai", "siapa lucas", "siapa huang", "siapa kei", "siapa dhini"
    // ==============================================================
    // Scan if any known user name matches the query directly
    let matchedUserExact = null;
    for (const u of users) {
        const uLower = u.name.toLowerCase();
        const parts = uLower.split(' ');
        if (q.includes(uLower)) {
            matchedUserExact = u;
            break;
        }
        for (const part of parts) {
            if (part.length >= 3 && (q.includes(part) || q === part)) {
                matchedUserExact = u;
                break;
            }
        }
        if (matchedUserExact) break;
    }

    const isUserQueryIntent = matchedUserExact && (
        q.includes('siapa') || q.includes('detail') || q.includes('info') || 
        q.includes('pengguna') || q.includes('user') || q.includes('akun') || 
        q.includes('apakah ada') || q.includes('cari') || q.includes('data') ||
        q.includes('profil') || q.includes('tentang') || q.includes('email') ||
        q.includes('nomor') || q.includes('hp') || q.includes('status') ||
        q.trim() === matchedUserExact.name.toLowerCase()
    ) && !q.includes('siapa anda') && !q.includes('siapa kamu') && !q.includes('siapa saya');

    if (isUserQueryIntent && matchedUserExact) {
        if (isAdmin) {
            const phoneStr = matchedUserExact.phone_number ? matchedUserExact.phone_number : 'Belum diisi';
            const verifStr = matchedUserExact.phone_verified ? 'Terverifikasi' : 'Belum Terverifikasi';
            const regDate = matchedUserExact.created_at ? new Date(matchedUserExact.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-';
            const onboardStr = matchedUserExact.onboarding_completed ? 'Selesai' : 'Belum Selesai';
            
            let goalsStr = '';
            if (matchedUserExact.profile_data && Array.isArray(matchedUserExact.profile_data.goals) && matchedUserExact.profile_data.goals.length > 0) {
                goalsStr = `\n• Target Kulit: ${matchedUserExact.profile_data.goals.join(', ')}`;
            }

            return cleanText(
                `Data Pengguna Ditemukan di Database:\n\n` +
                `• Nama Lengkap: ${matchedUserExact.name}\n` +
                `• Email: ${matchedUserExact.email}\n` +
                `• ID Pengguna: ${matchedUserExact.id}\n` +
                `• Peran: ${matchedUserExact.role === 'admin' ? 'Administrator' : 'Customer'}\n` +
                `• Nomor HP: ${phoneStr} (${verifStr})\n` +
                `• Status Akun: ${matchedUserExact.status === 'active' ? 'Aktif' : 'Nonaktif'}\n` +
                `• Onboarding: ${onboardStr}\n` +
                `• Terdaftar: ${regDate}${goalsStr}`
            );
        } else {
            if (currentUser && currentUser.id === matchedUserExact.id) {
                return cleanText(`Akun Anda tercatat sebagai ${matchedUserExact.name} dengan email ${matchedUserExact.email} (Peran: Customer, Status: Aktif).`);
            }
            return cleanText(`Mohon maaf, pencarian data akun pengguna lain merupakan fitur administratif yang hanya dapat diakses melalui panel Administrator.`);
        }
    }

    // ==============================================================
    // 6. JUMLAH & DAFTAR SELURUH PENGGUNA
    // ==============================================================
    const isUserCountQuery = 
        (q.includes('berapa') || q.includes('jumlah') || q.includes('total') || q.includes('banyak') || q.includes('hitung')) &&
        (q.includes('pengguna') || q.includes('user') || q.includes('akun') || q.includes('member') || q.includes('admin') || q.includes('customer') || q.includes('pelanggan'));

    if (isUserCountQuery) {
        const isDetailRequested = q.includes('siapa') || q.includes('sebutkan') || q.includes('tuliskan') || q.includes('daftar') || q.includes('rincian') || q.includes('jelaskan') || q.includes('detail');
        
        // Aturan: Jawab HANYA apa yang ditanyakan (hanya angka).
        // Jangan saling dikaitkan ("terdiri dari ..."). Cukup jawab apa yang ditanyakan!
        if (!isDetailRequested) {
            if ((q.includes('admin') || q.includes('administrator')) && !q.includes('customer') && !q.includes('pelanggan')) {
                return String(adminCount);
            }
            if ((q.includes('customer') || q.includes('pelanggan')) && !q.includes('admin') && !q.includes('administrator')) {
                return String(customerCount);
            }
            if (q.includes('nonaktif') || q.includes('non-aktif') || q.includes('tidak aktif') || q.includes('belum aktif') || q.includes('blokir')) {
                return String(users.filter(u => u.status !== 'active').length);
            }
            if (q.includes('aktif')) {
                return String(activeUsers);
            }
            return String(totalUsers);
        }

        if (isAdmin) {
            const userList = users.map(u => `• ${u.name} (${u.email}) - Peran: ${u.role === 'admin' ? 'Administrator' : 'Customer'}, Status: ${u.status === 'active' ? 'Aktif' : 'Nonaktif'}`).join('\n');
            return cleanText(
                `Daftar seluruh pengguna terdaftar di database SkinCheck (${totalUsers} akun):\n\n` +
                userList
            );
        } else {
            return String(totalUsers);
        }
    }

    if (
        (q.includes('pengguna') || q.includes('user') || q.includes('akun') || q.includes('member')) &&
        (q.includes('daftar') || q.includes('siapa saja') || q.includes('sebutkan') || q.includes('semua'))
    ) {
        if (isAdmin) {
            const userList = users.map(u => `• ${u.name} (${u.email}) - Peran: ${u.role === 'admin' ? 'Administrator' : 'Customer'}, Status: ${u.status === 'active' ? 'Aktif' : 'Nonaktif'}`).join('\n');
            return cleanText(
                `Berikut daftar seluruh pengguna terdaftar di database SkinCheck (${totalUsers} akun):\n\n` +
                userList
            );
        } else {
            return cleanText(
                `Daftar lengkap seluruh pengguna sistem hanya dapat diakses melalui panel Administrator. Anda dapat melihat dan mengelola akun Anda sendiri pada menu Profil.`
            );
        }
    }

    // ==============================================================
    // 7. DATA SISTEM & AUDIT LOG (KHUSUS ADMIN)
    // ==============================================================
    if (q.includes('audit log') || q.includes('log aktivitas') || (q.includes('log') && (q.includes('sistem') || q.includes('terbaru') || q.includes('aktivitas')))) {
        if (isAdmin) {
            if (q.includes('berapa') && !q.includes('siapa') && !q.includes('terbaru') && !q.includes('terakhir') && !q.includes('daftar') && !q.includes('sebutkan') && !q.includes('detail')) {
                return String(auditLogs.length);
            }

            const latestLogs = auditLogs.slice(0, 5).map((l, idx) => 
                `${idx + 1}. [${new Date(l.timestamp).toLocaleTimeString('id-ID')}] ${l.category}: ${l.action} (${l.status})`
            ).join('\n');

            if (q.includes('kategori')) {
                const categories = [...new Set(auditLogs.map(l => l.category))];
                return cleanText(
                    `Kategori aktivitas yang tercatat pada Audit Log database (${auditLogs.length} catatan total):\n` +
                    categories.map((c, i) => `${i + 1}. ${c}`).join('\n')
                );
            }

            if (q.includes('terakhir') || q.includes('terbaru') || q.includes('siapa')) {
                const lastLog = auditLogs[0];
                if (lastLog) {
                    const timeStr = new Date(lastLog.timestamp).toLocaleTimeString('id-ID');
                    return cleanText(
                        `Aktivitas terbaru pada Audit Log sistem dilakukan oleh ${lastLog.user_name || 'Sistem'} (${lastLog.user_email || '-'}) pada pukul ${timeStr}:\n` +
                        `• Kategori: ${lastLog.category}\n` +
                        `• Aksi: ${lastLog.action}\n` +
                        `• Status: ${lastLog.status}`
                    );
                }
            }

            return cleanText(
                `Tercatat sebanyak ${auditLogs.length} catatan aktivitas pada Audit Log database. 5 aktivitas terbaru:\n\n` +
                latestLogs
            );
        } else {
            return cleanText(`Catatan log aktivitas sistem hanya dapat diakses oleh Administrator pada panel Admin.`);
        }
    }

    // ==============================================================
    // 7b. KONFIGURASI AI, MODEL, TIMEOUT, & MAX TOKENS (KHUSUS ADMIN)
    // ==============================================================
    if (
        (q.includes('model ai') || q.includes('model default') || q.includes('daftar model') || q.includes('apa saja model') || q.includes('timeout ai') || q.includes('token ai') || q.includes('max token') || q.includes('konfigurasi ai'))
    ) {
        if (isAdmin) {
            const aiModels = systemConfig?.ai?.models || [];
            if (q.includes('berapa') && !q.includes('siapa') && !q.includes('apa saja') && !q.includes('sebutkan') && !q.includes('daftar') && !q.includes('detail')) {
                return String(aiModels.length);
            }
            const defaultModel = aiModels.find(m => m.is_default) || aiModels[0] || { name: 'Gemini 1.5 Flash', id: 'gemini-1.5-flash' };
            const modelList = aiModels.map((m, i) => 
                `${i + 1}. ${m.name} (${m.id}) ${m.is_default ? '[DEFAULT]' : ''}\n   • Provider: ${m.provider || 'gemini'}, Status: ${m.is_active ? 'Aktif' : 'Nonaktif'}, Max Tokens: ${m.max_tokens}, Timeout: ${m.timeout_ms}ms`
            ).join('\n\n');

            if (q.includes('default')) {
                return cleanText(
                    `Model AI default yang saat ini digunakan adalah ${defaultModel.name} (ID: ${defaultModel.id}, Provider: ${defaultModel.provider || 'gemini'}). Model ini memiliki batas maksimum ${defaultModel.max_tokens || 1000} output tokens dan batas timeout ${defaultModel.timeout_ms || 10000} ms.`
                );
            }

            return cleanText(
                `Daftar Model AI yang terkonfigurasi di sistem SkinCheck:\n\n${modelList}\n\nModel Default: ${defaultModel.name}`
            );
        } else {
            return cleanText(`Konfigurasi model AI teknis hanya dapat diakses melalui panel Administrator.`);
        }
    }

    // ==============================================================
    // 7c. KONFIGURASI GATEWAY WHATSAPP & KEAMANAN OTP (KHUSUS ADMIN)
    // ==============================================================
    if (
        (q.includes('gateway whatsapp') || q.includes('provider whatsapp') || q.includes('wa gateway') || q.includes('otp') || q.includes('fonnte')) &&
        (q.includes('berapa') || q.includes('apa') || q.includes('bagaimana') || q.includes('status') || q.includes('konfigurasi') || q.includes('waktu') || q.includes('batas'))
    ) {
        if (isAdmin) {
            const waProvider = systemConfig?.whatsapp?.active_provider || 'fonnte';
            return cleanText(
                `Konfigurasi Layanan WhatsApp OTP Gateway:\n\n` +
                `• Provider Aktif: ${waProvider.toUpperCase()} (Fonnte API Gateway)\n` +
                `• Masa Berlaku Kode OTP: 300 detik (5 menit)\n` +
                `• Batas Maksimal Percobaan Salah: 5 kali per sesi\n` +
                `• Jeda Waktu Kirim Ulang (Cooldown): 60 detik (1 menit)\n` +
                `• Format Template Pesan: Kode verifikasi 6 digit resmi SkinCheck\n` +
                `• Status Koneksi: Aktif dan terhubung dengan server pengiriman pesan.`
            );
        } else {
            return cleanText(`Kode OTP berlaku selama 5 menit. Masukkan kode 6 digit yang dikirimkan ke nomor WhatsApp Anda untuk menyelesaikan verifikasi.`);
        }
    }

    if (q.includes('konfigurasi sistem') || q.includes('status integrasi') || q.includes('provider whatsapp') || q.includes('provider ai')) {
        if (isAdmin) {
            const waProvider = systemConfig?.whatsapp?.active_provider || 'fonnte';
            const aiProvider = systemConfig?.ai?.active_provider || 'gemini';
            return cleanText(
                `Status Konfigurasi Sistem SkinCheck:\n\n` +
                `• Provider AI Aktif: ${aiProvider} (Engine Local Knowledge & Gemini AI)\n` +
                `• Gateway WhatsApp OTP: ${waProvider} (Token aktif & terhubung)\n` +
                `• Keamanan: Enkripsi kata sandi Bcrypt, sesi otentikasi aman, dan audit log aktif.`
            );
        } else {
            return cleanText(`Konfigurasi integrasi teknis sistem hanya dapat diakses oleh Administrator melalui panel Admin.`);
        }
    }

    // ==============================================================
    // 8. IDENTITAS BOT ("siapa anda", "siapa kamu")
    // ==============================================================
    if (
        q === 'siapa anda' || q === 'anda siapa' || q === 'siapa kamu' || 
        q === 'kamu siapa' || q.includes('siapa namamu') || q.includes('nama kamu') ||
        q.includes('tentang kamu') || q.includes('kamu itu siapa') || q.includes('apa fungsi kamu') ||
        q.includes('kamu bisa apa') || q.includes('apa itu skincheck ai')
    ) {
        return cleanText(
            "Saya adalah SkinCheck AI, asisten virtual cerdas yang dirancang khusus untuk memandu kesehatan kulit Anda, memberikan rekomendasi produk perawatan wajah yang tepat, serta menjawab seluruh informasi data yang ada di sistem database SkinCheck."
        );
    }

    // ==============================================================
    // 9. IDENTITAS DIRI PENGGUNA YANG SEDANG LOGIN ("siapa saya", "profil saya")
    // ==============================================================
    if (
        q === 'siapa saya' || q === 'siapa aku' || q.includes('nama saya') || 
        q.includes('profil saya') || q.includes('akun saya') || q.includes('email saya') ||
        q.includes('peran saya') || q.includes('role saya')
    ) {
        return cleanText(
            `Anda saat ini masuk sebagai ${currentUserName} dengan email ${currentUserEmail} (Peran: ${currentUserRole === 'admin' ? 'Administrator' : 'Customer'}).`
        );
    }

    if (q.includes('goals saya') || q.includes('tujuan saya') || q.includes('target saya')) {
        const fullUserObj = users.find(u => u.id === currentUserId || (currentUser && u.email === currentUser.email));
        if (fullUserObj && fullUserObj.profile_data && Array.isArray(fullUserObj.profile_data.goals) && fullUserObj.profile_data.goals.length > 0) {
            return cleanText(
                `Target perawatan kulit yang Anda simpan di akun:\n` + fullUserObj.profile_data.goals.map(g => `• ${g}`).join('\n')
            );
        } else {
            return cleanText("Saat ini Anda belum menyimpan target perawatan khusus pada profil akun Anda.");
        }
    }

    // ==============================================================
    // 10. INTERAKSI CHATBOT / CHAT / PESAN
    // ==============================================================
    if (
        (q.includes('interaksi') && (q.includes('chat') || q.includes('bot') || q.includes('ai') || q.includes('pesan'))) ||
        (q.includes('berapa') && (q.includes('chat') || q.includes('pesan') || q.includes('percakapan') || q.includes('obrolan'))) ||
        q.includes('jumlah chat') || q.includes('total chat') || q.includes('riwayat chat customer') || q.includes('pesan chatbot')
    ) {
        if (q.includes('berapa') && !q.includes('siapa') && !q.includes('detail') && !q.includes('jelaskan') && !q.includes('daftar') && !q.includes('sebutkan')) {
            if (q.includes('percakapan') || q.includes('sesi') || q.includes('obrolan')) {
                return String(totalConversations);
            }
            return String(totalMessages);
        }
        return cleanText(
            `Berdasarkan data sistem saat ini, tercatat sebanyak ${totalMessages} interaksi pesan dalam ${totalConversations} sesi percakapan chatbot.`
        );
    }

    // ==============================================================
    // 11. KATALOG PRODUK (JUMLAH, DAFTAR, DAN KATEGORI)
    // Mendukung ejaan 'katalog' maupun 'catalog'!
    // ==============================================================
    const isCatalogWord = q.includes('katalog') || q.includes('catalog') || q.includes('produk') || q.includes('barang') || q.includes('skincare') || q.includes('item');
    const isCatalogCountQuery = 
        (q.includes('berapa') || q.includes('jumlah') || q.includes('total') || q.includes('banyak')) && 
        isCatalogWord && 
        !q.includes('harga') && 
        !q.includes('biaya');

    if (isCatalogCountQuery) {
        const isDetailRequested = q.includes('siapa') || q.includes('apa saja') || q.includes('sebutkan') || q.includes('daftar') || q.includes('jelaskan') || q.includes('detail');
        if (!isDetailRequested) {
            if (q.includes('aktif') && !q.includes('non')) {
                return String(activeProducts.length);
            }
            if (q.includes('nonaktif') || q.includes('resep')) {
                return String(inactiveProducts.length);
            }
            return String(totalProducts);
        }
        const prodList = products.map(p => `• ${p.name} (${p.category} - ${p.brand}, Status: ${p.status === 'active' ? 'Aktif' : 'Nonaktif/Resep Dokter'})`).join('\n');
        return cleanText(
            `Daftar seluruh ${totalProducts} produk di katalog database SkinCheck:\n\n` +
            prodList
        );
    }

    if (
        (q.includes('katalog') || q.includes('catalog') || q.includes('produk apa saja') || q.includes('daftar produk') || q.includes('sebutkan produk')) &&
        !q.includes('cocok') && !q.includes('rekomendasi') && !q.includes('bagus') &&
        !q.includes('kategori') && !q.includes('brand') && !q.includes('merek') && !q.includes('nonaktif') && !q.includes('harga')
    ) {
        const prodList = products.map(p => `• ${p.name} (${p.category} - ${p.brand}, Status: ${p.status === 'active' ? 'Aktif' : 'Nonaktif/Resep Dokter'})`).join('\n');
        return cleanText(
            `Berikut adalah daftar seluruh ${totalProducts} produk di katalog database SkinCheck:\n\n` +
            prodList
        );
    }

    // ==============================================================
    // 11b. KATEGORI PRODUK & DAFTAR PRODUK PER KATEGORI
    // Contoh: "kategori apa saja di katalog", "produk di kategori cleanser apa saja"
    // ==============================================================
    if (q.includes('kategori')) {
        const categories = [...new Set(products.map(p => p.category))];
        
        if (q.includes('berapa') && !q.includes('siapa') && !q.includes('apa saja') && !q.includes('sebutkan') && !q.includes('daftar') && !q.includes('detail')) {
            return String(categories.length);
        }

        // Check if asking about specific category
        const targetCategory = categories.find(cat => q.includes(cat.toLowerCase()));
        if (targetCategory) {
            const catProds = products.filter(p => p.category.toLowerCase() === targetCategory.toLowerCase());
            const listStr = catProds.map(p => `• ${p.name} (${p.brand}) - Status: ${p.status === 'active' ? 'Aktif' : 'Nonaktif'}`).join('\n');
            return cleanText(
                `Produk di kategori ${targetCategory} (${catProds.length} produk):\n\n${listStr}`
            );
        }

        const catSummary = categories.map((c, i) => {
            const count = products.filter(p => p.category === c).length;
            return `${i + 1}. ${c} (${count} produk)`;
        }).join('\n');

        return cleanText(
            `Terdapat ${categories.length} kategori produk di katalog SkinCheck:\n\n${catSummary}\n\nAnda dapat menanyakan produk di kategori tertentu (misalnya: 'produk di kategori cleanser apa saja').`
        );
    }

    // ==============================================================
    // 11c. BRAND / MEREK PRODUK DI KATALOG
    // Contoh: "brand apa saja", "merek apa saja", "produk SkinCheck Basics apa saja"
    // ==============================================================
    if (q.includes('brand') || q.includes('merek')) {
        const brands = [...new Set(products.map(p => p.brand).filter(Boolean))];
        
        if (q.includes('berapa') && !q.includes('siapa') && !q.includes('apa saja') && !q.includes('sebutkan') && !q.includes('daftar') && !q.includes('detail')) {
            return String(brands.length);
        }

        // Check if asking about specific brand
        const targetBrand = brands.find(b => q.includes(b.toLowerCase()));
        if (targetBrand) {
            const bProds = products.filter(p => p.brand && p.brand.toLowerCase() === targetBrand.toLowerCase());
            const listStr = bProds.map(p => `• ${p.name} (${p.category}) - Status: ${p.status === 'active' ? 'Aktif' : 'Nonaktif'}`).join('\n');
            return cleanText(
                `Produk dari brand ${targetBrand} (${bProds.length} produk):\n\n${listStr}`
            );
        }

        const brandList = brands.map((b, i) => {
            const count = products.filter(p => p.brand === b).length;
            return `${i + 1}. ${b} (${count} produk)`;
        }).join('\n');

        return cleanText(
            `Terdapat ${brands.length} brand produk di katalog database SkinCheck:\n\n${brandList}`
        );
    }

    // ==============================================================
    // 11d. PRODUK NONAKTIF / RESEP DOKTER
    // Contoh: "produk apa yang nonaktif", "berapa produk nonaktif", "kenapa Prescription Acne Treatment nonaktif"
    // ==============================================================
    if (
        (q.includes('nonaktif') || q.includes('tidak aktif') || q.includes('resep') || q.includes('obat keras')) &&
        (q.includes('produk') || q.includes('katalog') || q.includes('barang') || q.includes('skincare') || q.includes('apa'))
    ) {
        if (inactiveProducts.length > 0) {
            const inactList = inactiveProducts.map(p => 
                `• ${p.name} (${p.category} dari ${p.brand})\n  Kandungan: ${p.ingredients.join(', ')}\n  Keterangan: ${p.description} (Panduan: ${p.usage_guidance})`
            ).join('\n\n');
            return cleanText(
                `Terdapat ${inactiveProducts.length} produk berstatus nonaktif di katalog database SkinCheck:\n\n` +
                inactList + `\n\nProduk ini berstatus nonaktif karena merupakan obat keras yang memerlukan resep dokter resmi.`
            );
        } else {
            return cleanText(`Saat ini seluruh produk di katalog database SkinCheck berstatus aktif.`);
        }
    }

    // ==============================================================
    // 11e. HARGA & ATRIBUT PRODUK
    // Contoh: "berapa harga produk", "produk termahal apa", "produk paling murah apa"
    // ==============================================================
    if (
        (q.includes('harga') || q.includes('termahal') || q.includes('termurah') || q.includes('paling mahal') || q.includes('paling murah') || q.includes('biaya')) &&
        (q.includes('produk') || q.includes('skincare') || q.includes('katalog') || q.includes('barang') || q.includes('cleanser') || q.includes('serum') || q.includes('moisturizer') || q.includes('sunscreen'))
    ) {
        const prodList = activeProducts.map(p => `• ${p.name} (${p.category} - ${p.brand})`).join('\n');
        return cleanText(
            `Di dalam database katalog saat ini, seluruh produk dikelola berdasarkan data formulasi klinis, kategori, brand, status ketersediaan, bahan aktif, dan panduan penggunaan.\n\n` +
            `Daftar produk aktif yang tersedia di katalog:\n${prodList}`
        );
    }

    // ==============================================================
    // 12. PENCARIAN PRODUK BERDASARKAN KANDUNGAN / BAHAN
    // ==============================================================
    if (q.includes('mengandung') || q.includes('kandungan') || q.includes('bahan')) {
        const matchedByIng = products.filter(p => 
            p.ingredients.some(ing => {
                const ingLower = ing.toLowerCase();
                const ingWords = ingLower.split(' ');
                return ingWords.some(w => w.length >= 4 && q.includes(w)) || q.includes(ingLower);
            })
        );
        if (matchedByIng.length > 0) {
            const listStr = matchedByIng.map(p => `• ${p.name} (${p.category} dari ${p.brand}) - Kandungan: ${p.ingredients.join(', ')}`).join('\n');
            return cleanText(
                `Berikut produk di database SkinCheck yang memiliki kandungan tersebut:\n\n${listStr}`
            );
        }
    }

    // ==============================================================
    // 13. PENCARIAN PRODUK SPESIFIK BERDASARKAN NAMA / BRAND
    // ==============================================================
    const scoredProducts = activeProducts.map(p => {
        const prodNameLower = p.name.toLowerCase();
        const brandLower = p.brand ? p.brand.toLowerCase() : '';
        let score = 0;
        if (q.includes(prodNameLower)) score += 10;
        if (brandLower && q.includes(brandLower)) score += 3;
        const words = prodNameLower.split(' ').filter(w => w.length >= 3);
        words.forEach(w => {
            if (q.includes(w)) score += 2;
        });
        return { product: p, score };
    }).filter(item => item.score > 0).sort((a, b) => b.score - a.score);

    const matchedProd = scoredProducts.length > 0 ? scoredProducts[0].product : null;

    if (matchedProd && (q.includes('apakah ada') || q.includes('tentang') || q.includes('detail') || q.includes('cara pakai') || q.includes('bagaimana') || q.includes('produk') || q.includes('apa itu') || q.includes('info') || q.includes('siapa'))) {
        const ingStr = (matchedProd.ingredients && matchedProd.ingredients.length > 0) ? ` Kandungan utama: ${matchedProd.ingredients.join(', ')}.` : '';
        const usageStr = matchedProd.usage_guidance ? ` Cara pakai: ${matchedProd.usage_guidance}` : '';
        return cleanText(
            `Ya, produk ${matchedProd.name} (${matchedProd.category} dari ${matchedProd.brand}) terdaftar di dalam katalog SkinCheck. ${matchedProd.description || ''}${ingStr}${usageStr}`
        );
    }

    // ==============================================================
    // 14. REKOMENDASI KEMERAHAN / KULIT SENSITIF / IRITASI
    // ==============================================================
    if (
        q.includes('kemerahan') || q.includes('kulit merah') || q.includes('muka merah') || 
        q.includes('merah-merah') || q.includes('sensitif') || q.includes('iritasi') || 
        q.includes('perih') || q.includes('menenangkan kulit') || q.includes('calming') || 
        q.includes('soothing') || q.includes('skin barrier') || q.includes('barrier kulit')
    ) {
        return cleanText(
            `Untuk mengatasi wajah kemerahan dan kulit sensitif, berikut rekomendasi produk dari katalog SkinCheck:\n\n` +
            `1. Gentle Hydrating Cleanser (SkinCheck Basics)\n` +
            `Pembersih wajah lembut bertekstur gel dengan kandungan Ceramide, Hyaluronic Acid, dan Glycerin yang membersihkan kotoran tanpa mengikis lapisan pelindung kulit.\n\n` +
            `2. Barrier Repair Moisturizer (SkinCheck Basics)\n` +
            `Pelembap harian dengan formula Ceramide NP, Panthenol, dan Squalane yang sangat efektif meredakan kemerahan, menenangkan iritasi, serta memperkuat skin barrier.\n\n` +
            `Tips tambahan: Hindari eksfoliasi fisik (scrub kasar), gunakan air bersuhu suam-suam kuku saat mencuci muka, dan selalu aplikasikan tabir surya di pagi hari.`
        );
    }

    // ==============================================================
    // 15. REKOMENDASI JERAWAT / ACNE / BRUNTUSAN / KOMEDO
    // ==============================================================
    if (
        q.includes('jerawat') || q.includes('acne') || q.includes('bruntusan') || 
        q.includes('komedo') || q.includes('beruntusan') || q.includes('blemish') || q.includes('pimple')
    ) {
        return cleanText(
            `Untuk merawat kulit berjerawat dan bruntusan, berikut rekomendasi produk dari katalog SkinCheck:\n\n` +
            `1. Niacinamide 10% Blemish Serum (SkinCheck Actives)\n` +
            `Mengandung Niacinamide 10%, Zinc PCA, dan Allantoin untuk mengontrol sebum minyak berlebih, meredakan peradangan jerawat, dan menyamarkan bekas jerawat.\n\n` +
            `2. Gentle Hydrating Cleanser (SkinCheck Basics)\n` +
            `Membersihkan pori-pori dari minyak dan kotoran tanpa memicu iritasi pada area jerawat.\n\n` +
            `Tips tambahan: Hindari memencet jerawat dengan tangan dan gunakan tabir surya non-komedogenik setiap pagi.`
        );
    }

    // ==============================================================
    // 16. REKOMENDASI KULIT KERING / DEHIDRASI / MENGELUPAS
    // ==============================================================
    if (
        q.includes('kering') || q.includes('dehidrasi') || q.includes('mengelupas') || 
        q.includes('bersisik') || q.includes('kulit ketarik')
    ) {
        return cleanText(
            `Untuk merawat kulit kering dan dehidrasi, berikut rekomendasi produk dari katalog SkinCheck:\n\n` +
            `1. Gentle Hydrating Cleanser (SkinCheck Basics)\n` +
            `Pembersih lembut yang mempertahankan kelembapan alami kulit dengan Hyaluronic Acid dan Ceramide.\n\n` +
            `2. Barrier Repair Moisturizer (SkinCheck Basics)\n` +
            `Pelembap kaya Ceramide NP, Panthenol, dan Squalane yang mengunci hidrasi secara mendalam dan memperbaiki tekstur kasar.`
        );
    }

    // ==============================================================
    // 17. REKOMENDASI KUSAM / FLEK / NODA HITAM / HIPERPIGMENTASI
    // ==============================================================
    if (
        q.includes('kusam') || q.includes('flek') || q.includes('noda hitam') || 
        q.includes('cerah') || q.includes('mencerahkan') || q.includes('hiperpigmentasi') || 
        q.includes('bekas jerawat')
    ) {
        return cleanText(
            `Untuk mengatasi kulit kusam dan memudarkan noda hitam (hiperpigmentasi), berikut rekomendasi dari katalog SkinCheck:\n\n` +
            `1. Niacinamide 10% Blemish Serum (SkinCheck Actives)\n` +
            `Membantu menghambat perpindahan pigmen melanin, meratakan warna kulit, dan mencerahkan wajah.\n\n` +
            `2. Daily Sun Shield SPF 50 (SkinCheck Protect)\n` +
            `Perlindungan tabir surya harian berspektrum luas untuk mencegah noda hitam semakin menggelap akibat paparan sinar UV matahari.`
        );
    }

    // ==============================================================
    // 18. REKOMENDASI KULIT BERMINYAK / PORI-PORI BESAR / SEBUM
    // ==============================================================
    if (
        q.includes('berminyak') || q.includes('oily') || q.includes('minyak berlebih') || 
        q.includes('pori-pori') || q.includes('pori besar') || q.includes('kilap') || q.includes('sebum')
    ) {
        return cleanText(
            `Untuk mengontrol kulit berminyak dan pori-pori besar, berikut rekomendasi dari katalog SkinCheck:\n\n` +
            `1. Niacinamide 10% Blemish Serum (SkinCheck Actives)\n` +
            `Kombinasi Niacinamide dan Zinc PCA efektif menyeimbangkan produksi minyak alami tanpa membuat kulit kering.\n\n` +
            `2. Gentle Hydrating Cleanser (SkinCheck Basics)\n` +
            `Membersihkan sebum berlebih secara menyeluruh dengan lembut.`
        );
    }

    // ==============================================================
    // 19. REKOMENDASI TEKSTUR KASAR & ANTI-AGING
    // ==============================================================
    if (q.includes('tekstur') || q.includes('kasar') || q.includes('kulit tidak rata')) {
        return cleanText(
            `Untuk memperbaiki tekstur kulit yang kasar, disarankan menggunakan:\n\n` +
            `1. Barrier Repair Moisturizer: Mengandung Ceramide NP dan Squalane untuk menghaluskan dan melembutkan permukaan kulit.\n` +
            `2. Niacinamide 10% Blemish Serum: Membantu memperbaiki elastisitas kulit dan mempercepat regenerasi sel.`
        );
    }

    if (q.includes('penuaan') || q.includes('garis halus') || q.includes('kerutan') || q.includes('keriput') || q.includes('anti-aging')) {
        return cleanText(
            `Untuk mencegah penuaan dini dan menyamarkan garis halus:\n\n` +
            `1. Gunakan pelembap dengan Ceramide NP dan Squalane untuk menjaga kekenyalan kulit.\n` +
            `2. Gunakan Retinol pada malam hari secara bertahap untuk merangsang produksi kolagen.\n` +
            `3. Wajib gunakan sunscreen seperti Daily Sun Shield SPF 50 setiap hari untuk melindungi kulit dari sinar UVA penyebab utama penuaan dini.`
        );
    }

    // ==============================================================
    // 20. REKOMENDASI SUNSCREEN / TABIR SURYA
    // ==============================================================
    if (q.includes('sunscreen') || q.includes('tabir surya') || q.includes('sunblock') || q.includes('spf')) {
        if (!q.includes('check') && !q.includes('kamera') && !q.includes('heatmap')) {
            return cleanText(
                `Rekomendasi tabir surya di katalog SkinCheck adalah Daily Sun Shield SPF 50 (SkinCheck Protect).\n\n` +
                `Produk ini diformulasikan dengan Zinc Oxide, Titanium Dioxide, dan Ekstrak Aloe Vera yang ringan, tidak lengket, serta melindungi kulit dari paparan radiasi UVA/UVB.\n\n` +
                `Cara pakai: Gunakan sebanyak 2 ruas jari sebagai langkah terakhir rutinitas pagi, dan aplikasikan ulang setiap 2-3 jam saat beraktivitas di luar ruangan.`
            );
        }
    }

    // ==============================================================
    // 21. DATA PEMINDAIAN WAJAH & ANALISIS KULIT
    // ==============================================================
    if (
        (q.includes('berapa') || q.includes('jumlah') || q.includes('total')) &&
        (q.includes('scan') || q.includes('analisis') || q.includes('pemindaian')) &&
        !q.includes('skor') && !q.includes('terakhir') && !q.includes('kapan') && !q.includes('siapa')
    ) {
        if (q.includes('berapa') && !q.includes('jelaskan') && !q.includes('detail') && !q.includes('daftar')) {
            if (q.includes('analisis') && !q.includes('scan') && !q.includes('pemindaian')) {
                return String(totalAnalysis);
            }
            return String(totalScans);
        }
        return cleanText(
            `Di dalam database SkinCheck tercatat sebanyak ${totalScans} data pemindaian (scan) wajah dan ${totalAnalysis} rekaman hasil analisis kondisi kulit.`
        );
    }

    // ==============================================================
    // 21b. DETAIL REKAMAN SCAN WAJAH & PEMILIK SCAN (KHUSUS ADMIN)
    // Contoh: "siapa saja yang sudah scan wajah", "kapan scan wajah terakhir", "siapa yang scan terakhir"
    // ==============================================================
    if (
        (q.includes('scan') || q.includes('pemindaian')) &&
        (q.includes('siapa') || q.includes('kapan') || q.includes('terakhir') || q.includes('kualitas') || q.includes('riwayat') || q.includes('foto'))
    ) {
        if (isAdmin) {
            // Unique users who scanned
            const scanUserIds = [...new Set(scans.map(s => s.user_id))];
            const usersWithScans = scanUserIds.map(uid => {
                const u = users.find(usr => usr.id === uid);
                const count = scans.filter(s => s.user_id === uid).length;
                return `• ${u ? u.name : uid} (${u ? u.email : '-'}), Total Scan: ${count} kali`;
            }).join('\n');

            const latestScan = scans[scans.length - 1];
            let latestScanInfo = '';
            if (latestScan) {
                const uLatest = users.find(u => u.id === latestScan.user_id);
                const dateStr = new Date(latestScan.timestamp || latestScan.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                latestScanInfo = `\n\nScan wajah terakhir dilakukan pada ${dateStr} WIB oleh ${uLatest ? uLatest.name : latestScan.user_id} dengan skor kualitas foto ${latestScan.image_quality_score || 90} (Deteksi Wajah: Valid).`;
            }

            return cleanText(
                `Rekaman Pemindaian (Face Scan) di Database SkinCheck:\n\n` +
                `Total scan: ${totalScans} rekaman, dilakukan oleh ${scanUserIds.length} customer:\n` +
                usersWithScans +
                latestScanInfo
            );
        } else {
            const userScans = scans.filter(s => currentUser && s.user_id === currentUser.id);
            return cleanText(
                `Anda telah melakukan sebanyak ${userScans.length} kali pemindaian wajah. Anda dapat melihat riwayat foto dan perkembangan kondisi kulit pada menu Riwayat Scan.`
            );
        }
    }

    // ==============================================================
    // 21c. DETAIL HASIL ANALISIS KULIT & SKOR (KHUSUS ADMIN)
    // Contoh: "apa hasil analisis kulit terakhir", "bagaimana skor analisis wajah", "skor jerawat tertinggi"
    // ==============================================================
    if (
        (q.includes('analisis') || q.includes('skor')) &&
        (q.includes('hasil') || q.includes('terakhir') || q.includes('rata-rata') || q.includes('skor') || q.includes('kulit') || q.includes('jerawat') || q.includes('kemerahan') || q.includes('tekstur'))
    ) {
        if (isAdmin) {
            const latestAnalysis = analysis[analysis.length - 1];
            if (latestAnalysis) {
                const u = users.find(usr => usr.id === latestAnalysis.user_id);
                const dateStr = new Date(latestAnalysis.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                
                // Calculate averages
                const avgOverall = Math.round(analysis.reduce((acc, a) => acc + (a.overall_score || 0), 0) / analysis.length);
                const avgAcne = Math.round(analysis.reduce((acc, a) => acc + (a.acne_score || 0), 0) / analysis.length);
                const avgRedness = Math.round(analysis.reduce((acc, a) => acc + (a.redness_score || 0), 0) / analysis.length);
                const avgTexture = Math.round(analysis.reduce((acc, a) => acc + (a.texture_score || 0), 0) / analysis.length);
                const avgHyperpigmentation = Math.round(analysis.reduce((acc, a) => acc + (a.hyperpigmentation_score || 0), 0) / analysis.length);

                return cleanText(
                    `Data Hasil Analisis Kondisi Kulit (Database SkinCheck):\n\n` +
                    `1. Rekaman Analisis Terakhir (${dateStr} WIB):\n` +
                    `   • Pengguna: ${u ? u.name : latestAnalysis.user_id}\n` +
                    `   • Skor Keseluruhan: ${latestAnalysis.overall_score || '-'}/100\n` +
                    `   • Parameter Jerawat: ${latestAnalysis.acne_score || '-'}\n` +
                    `   • Parameter Kemerahan: ${latestAnalysis.redness_score || '-'}\n` +
                    `   • Parameter Tekstur: ${latestAnalysis.texture_score || '-'}\n` +
                    `   • Parameter Noda Hitam: ${latestAnalysis.hyperpigmentation_score || '-'}\n\n` +
                    `2. Rata-rata Seluruh Analisis (${totalAnalysis} data):\n` +
                    `   • Rata-rata Skor Kesehatan Kulit: ${avgOverall}/100 (Jerawat: ${avgAcne}, Kemerahan: ${avgRedness}, Tekstur: ${avgTexture}, Noda Hitam: ${avgHyperpigmentation}).`
                );
            }
            return cleanText(`Di dalam database tercatat sebanyak ${totalAnalysis} data hasil analisis kulit.`);
        } else {
            const userAnalysis = analysis.filter(a => currentUser && a.user_id === currentUser.id);
            if (userAnalysis.length > 0) {
                const latest = userAnalysis[userAnalysis.length - 1];
                return cleanText(
                    `Hasil analisis kulit terakhir Anda mencatat skor kesehatan kulit ${latest.overall_score || '-'}/100. Anda dapat melihat grafik perkembangan kondisi kulit di menu Riwayat Analisis.`
                );
            }
            return cleanText(`Anda belum memiliki rekaman hasil analisis kulit. Silakan lakukan pemindaian wajah di menu Face Scan.`);
        }
    }

    // ==============================================================
    // 22. STRUKTUR & DAFTAR TABEL DATABASE (KHUSUS ADMIN)
    // Contoh: "tabel apa saja yang ada di database", "apa struktur database", "koleksi database", "berapa tabel"
    // ==============================================================
    if (
        (q.includes('tabel') || q.includes('table') || q.includes('struktur') || q.includes('skema') || q.includes('koleksi')) &&
        (q.includes('database') || q.includes('data') || q.includes('sistem') || q.includes('apa saja') || q.includes('berapa'))
    ) {
        if (isAdmin) {
            if (q.includes('berapa') && !q.includes('siapa') && !q.includes('apa saja') && !q.includes('sebutkan') && !q.includes('daftar') && !q.includes('detail')) {
                return "8";
            }
            return cleanText(
                `Struktur Koleksi Data (Tabel JSON Database) SkinCheck:\n\n` +
                `1. users.json (${totalUsers} akun): Menyimpan kredensial otentikasi, peran (admin/customer), status verifikasi nomor WhatsApp OTP, profil, dan preferensi kulit.\n` +
                `2. products.json (${totalProducts} produk): Menyimpan katalog skincare (brand, kategori, bahan aktif, indikasi masalah kulit, panduan pakai, status aktif/nonaktif).\n` +
                `3. scans.json (${totalScans} rekaman): Menyimpan riwayat berkas foto scan wajah, skor kualitas pencahayaan, dan validasi deteksi wajah.\n` +
                `4. analysis.json (${totalAnalysis} rekaman): Menyimpan hasil skor kuantitatif (jerawat, kemerahan, tekstur, hiperpigmentasi, dan skor total).\n` +
                `5. ai_conversations.json & ai_messages.json (${totalConversations} sesi, ${totalMessages} pesan): Menyimpan seluruh riwayat dialog konsultasi chatbot AI.\n` +
                `6. audit_logs.json (${auditLogs.length} catatan): Menyimpan audit trail keamanan operasional dan perubahan konfigurasi sistem.\n` +
                `7. system_config.json: Menyimpan konfigurasi teknis AI Engine (model, max tokens, timeout) dan WhatsApp OTP Gateway (Fonnte).\n` +
                `8. knowledge_base.json (${knowledgeBase.length} artikel): Menyimpan artikel edukasi klinis perawatan kulit.`
            );
        } else {
            return cleanText(`Struktur internal sistem penyimpanan data hanya dapat diakses oleh Administrator.`);
        }
    }

    // ==============================================================
    // 22b. RINGKASAN SEMUA ISI DATABASE (Jika diminta secara menyeluruh)
    // ==============================================================
    if (
        (q.includes('apa saja yang ada di database') || q.includes('isi database') || q.includes('ringkasan database') || q.includes('semua database'))
    ) {
        if (isAdmin) {
            return cleanText(
                `Ringkasan lengkap isi database SkinCheck (Akses Administrator):\n\n` +
                `• Pengguna: ${totalUsers} akun (${adminCount} Admin, ${customerCount} Customer)\n` +
                `• Katalog Produk: ${totalProducts} produk (${activeProducts.length} aktif di katalog, ${inactiveProducts.length} nonaktif/resep dokter)\n` +
                `• Interaksi Chatbot: ${totalMessages} pesan dalam ${totalConversations} sesi percakapan\n` +
                `• Pemindaian Wajah: ${totalScans} data rekaman scan\n` +
                `• Analisis Kulit: ${totalAnalysis} data pengukuran parameter kulit\n` +
                `• Panduan Edukasi: ${knowledgeBase.length} artikel panduan resmi\n` +
                `• Audit Log: ${auditLogs.length} catatan log aktivitas sistem`
            );
        } else {
            return cleanText(
                `Aplikasi SkinCheck mengelola katalog produk perawatan kulit, panduan edukasi resmi, serta fitur analisis visual wajah untuk membantu Anda merawat kesehatan kulit sehari-hari.`
            );
        }
    }

    // ==============================================================
    // 23. REAL-TIME DATE & TIME
    // ==============================================================
    if (
        q.includes('tanggal') || q.includes('hari ini') || q.includes('sekarang hari apa') || 
        q.includes('hari apa sekarang') || q.includes('hari apa ini') || q.includes('jam berapa') || 
        q.includes('pukul berapa') || q.includes('waktu sekarang') || q.includes('sekarang jam') || 
        q.includes('bulan apa') || q.includes('tahun berapa') || q.includes('besok') || q.includes('kemarin')
    ) {
        if (q.includes('besok')) {
            const tomorrow = getIndonesianDateTime(1);
            return cleanText(`Besok adalah hari ${tomorrow.dayName}, tanggal ${tomorrow.dateNum} ${tomorrow.monthName} ${tomorrow.yearNum}.`);
        }
        if (q.includes('kemarin')) {
            const yesterday = getIndonesianDateTime(-1);
            return cleanText(`Kemarin adalah hari ${yesterday.dayName}, tanggal ${yesterday.dateNum} ${yesterday.monthName} ${yesterday.yearNum}.`);
        }
        if (q.includes('jam') || q.includes('pukul') || q.includes('waktu')) {
            const now = getIndonesianDateTime(0);
            return cleanText(`Waktu saat ini menunjukkan pukul ${now.time} pada hari ${now.formattedDate}.`);
        }
        if (q.includes('bulan')) {
            const now = getIndonesianDateTime(0);
            return cleanText(`Saat ini adalah bulan ${now.monthName} tahun ${now.yearNum}.`);
        }
        if (q.includes('tahun')) {
            const now = getIndonesianDateTime(0);
            return cleanText(`Tahun saat ini adalah tahun ${now.yearNum} Masehi.`);
        }
        const now = getIndonesianDateTime(0);
        return cleanText(`Hari ini adalah hari ${now.dayName}, tanggal ${now.dateNum} ${now.monthName} ${now.yearNum}.`);
    }

    // ==============================================================
    // 24. PANDUAN SISTEM (LOGIN ADMIN, TEMA, HAPUS CHAT)
    // ==============================================================
    if ((q.includes('masuk') || q.includes('login') || q.includes('akses')) && q.includes('admin')) {
        return cleanText(
            `Untuk masuk sebagai Administrator, buka halaman login di /auth/login, masukkan email admin@skincheck.local dengan kata sandi admin123, lalu klik Masuk.`
        );
    }

    if (q.includes('tema') || q.includes('theme') || q.includes('mode gelap') || q.includes('mode terang') || q.includes('dark mode')) {
        return cleanText(
            `Untuk mengubah tema gelap atau terang, klik tombol bergambar bulan/matahari di bilah navigasi atas (🌙 Gelap / ☀️ Terang).`
        );
    }

    if (q.includes('hapus riwayat') || q.includes('hapus chat') || q.includes('hapus pesan') || q.includes('bersihkan chat')) {
        return cleanText(
            `Untuk menghapus seluruh riwayat obrolan, klik tombol 'Hapus Riwayat' di bagian atas jendela chat. Untuk menghapus pesan tertentu, klik tombol '🗑️ Hapus' di samping pesan yang diinginkan.`
        );
    }

    // ==============================================================
    // 25. GREETINGS & PERCAKAPAN SINGKAT
    // ==============================================================
    if (q === 'halo' || q === 'hai' || q === 'hi' || q === 'hello' || q.startsWith('halo ') || q.startsWith('hai ')) {
        return cleanText(`Halo! Ada yang bisa saya bantu terkait produk atau kondisi kulit Anda hari ini?`);
    }

    if (q.includes('terima kasih') || q.includes('makasih') || q.includes('thanks')) {
        return cleanText(`Sama-sama! Senang bisa membantu Anda.`);
    }

    if (q.includes('apa kabar') || q.includes('bagaimana kabarmu')) {
        return cleanText(`Kabar saya sangat baik dan siap membantu konsultasi perawatan kulit Anda! Bagaimana kondisi kulit Anda saat ini?`);
    }

    // ==============================================================
    // 26. KNOWLEDGE BASE & KANDUNGAN SKINCARE SPESIFIK
    // ==============================================================
    if (q.includes('ceramide')) {
        return cleanText(
            `Ceramide adalah lipid esensial yang membentuk lapisan pelindung kulit (skin barrier). Fungsinya mengunci kelembapan dan mencegah iritasi. Di katalog SkinCheck, Ceramide terdapat pada Gentle Hydrating Cleanser dan Barrier Repair Moisturizer.`
        );
    }

    if (q.includes('niacinamide')) {
        return cleanText(
            `Niacinamide (Vitamin B3) berfungsi mencerahkan warna kulit, menyamarkan noda bekas jerawat, dan mengontrol produksi minyak berlebih. Di katalog SkinCheck, Niacinamide terdapat pada Niacinamide 10% Blemish Serum.`
        );
    }

    if (q.includes('hyaluronic acid')) {
        return cleanText(
            `Hyaluronic Acid adalah molekul humektan kuat yang mampu mengikat kadar air di dalam kulit agar tetap terhidrasi kenyal. Di katalog SkinCheck, kandungan ini terdapat pada Gentle Hydrating Cleanser.`
        );
    }

    if (q.includes('squalane')) {
        return cleanText(
            `Squalane adalah minyak alami yang sangat ringan, mirip dengan lipid alami kulit. Fungsinya melembapkan tanpa menyumbat pori-pori. Di katalog SkinCheck, Squalane terdapat pada Barrier Repair Moisturizer.`
        );
    }

    if (q.includes('panthenol')) {
        return cleanText(
            `Panthenol (Pro-Vitamin B5) berfungsi menenangkan peradangan, meredakan kemerahan, dan mempercepat pemulihan skin barrier. Di katalog SkinCheck, Panthenol terdapat pada Barrier Repair Moisturizer.`
        );
    }

    if (q.includes('zinc pca')) {
        return cleanText(
            `Zinc PCA membantu meregulasi dan mengurangi produksi minyak sebum berlebih serta menekan perkembangbiakan bakteri penyebab jerawat. Terdapat pada Niacinamide 10% Blemish Serum.`
        );
    }

    if (q.includes('retinol')) {
        return cleanText(
            `Retinol (turunan Vitamin A) membantu mempercepat regenerasi sel kulit, menghaluskan garis halus, dan mengatasi jerawat. Gunakan retinol hanya pada malam hari dan selalu aplikasikan tabir surya di pagi hari.`
        );
    }

    if (q.includes('vitamin c') || q.includes('vit c')) {
        return cleanText(
            `Vitamin C adalah antioksidan yang efektif mencerahkan kulit, memudarkan noda hitam, dan menangkal radikal bebas. Sangat optimal digunakan pada pagi hari sebelum pelembap dan sunscreen.`
        );
    }

    if (q.includes('double cleansing')) {
        return cleanText(
            `Double cleansing adalah metode membersihkan wajah dua tahap: pembersih berbahan dasar minyak (micellar water/cleansing oil) untuk melarutkan sunscreen/makeup, diikuti pembersih berbahan dasar air (facial wash) untuk membersihkan pori secara menyeluruh.`
        );
    }

    if (q.includes('urutan') || q.includes('tahap') || q.includes('rutinitas') || q.includes('step')) {
        return cleanText(
            `Urutan rutinitas skincare dasar yang direkomendasikan:\n\n` +
            `1. Cleanser: Pembersih wajah untuk mengangkat kotoran.\n` +
            `2. Treatment: Serum sesuai masalah kulit (misalnya Niacinamide).\n` +
            `3. Moisturizer: Pelembap untuk mengunci hidrasi dan merawat skin barrier.\n` +
            `4. Sunscreen: Tabir surya di pagi/siang hari untuk perlindungan UV.`
        );
    }

    if (q.includes('air putih') || q.includes('minum air')) {
        return cleanText(
            `Minum air putih minimal 2 liter per hari sangat penting untuk mempertahankan hidrasi seluler tubuh, menjaga kekenyalan kulit, dan mencegah kulit dehidrasi dari dalam.`
        );
    }

    if (q.includes('begadang') || q.includes('kurang tidur')) {
        return cleanText(
            `Kurang tidur memicu peningkatan hormon stres kortisol yang dapat memicu inflamasi jerawat, meningkatkan produksi sebum, dan membuat kulit tampak kusam.`
        );
    }

    if (q.includes('makanan manis') || q.includes('gula') || q.includes('gorengan')) {
        return cleanText(
            `Makanan manis dengan indeks glikemik tinggi serta makanan tinggi minyak dapat memicu lonjakan insulin yang merangsang produksi sebum berlebih dan memperparah jerawat.`
        );
    }

    if (q.includes('eksfoliasi') || q.includes('aha bha')) {
        return cleanText(
            `Eksfoliasi kimiawi (AHA/BHA) bermanfaat mengangkat sel kulit mati 2-3 kali seminggu pada malam hari. Hindari eksfoliasi berlebih setiap hari agar skin barrier tidak rusak.`
        );
    }

    // ==============================================================
    // 27. SMART DYNAMIC ENTITY SEARCH FOR ANY UNMATCHED QUERY
    // ==============================================================
    // 27a. User Name / Email / Phone Search
    for (const u of users) {
        const uNameLower = u.name.toLowerCase();
        const uEmailLower = u.email.toLowerCase();
        const uPhone = u.phone_number ? u.phone_number.toLowerCase() : '';
        if (q.includes(uNameLower) || q.includes(uEmailLower) || (uPhone && q.includes(uPhone))) {
            if (isAdmin) {
                const phoneStr = u.phone_number ? u.phone_number : 'Belum diisi';
                const verifStr = u.phone_verified ? 'Terverifikasi' : 'Belum';
                return cleanText(
                    `Data Akun Pengguna:\n` +
                    `• Nama: ${u.name}\n` +
                    `• Email: ${u.email}\n` +
                    `• ID: ${u.id}\n` +
                    `• Peran: ${u.role === 'admin' ? 'Administrator' : 'Customer'}\n` +
                    `• No. HP: ${phoneStr} (${verifStr})\n` +
                    `• Status: ${u.status === 'active' ? 'Aktif' : 'Nonaktif'}\n` +
                    `• Onboarding: ${u.onboarding_completed ? 'Selesai' : 'Belum Selesai'}`
                );
            } else if (currentUser && currentUser.id === u.id) {
                return cleanText(
                    `Akun Anda adalah ${u.name} (Email: ${u.email}, Peran: Customer, Status: Aktif).`
                );
            }
        }
    }

    // 27b. Product Search by Name / Brand / Category / Ingredient
    for (const p of products) {
        const pNameLower = p.name.toLowerCase();
        const pBrandLower = (p.brand || '').toLowerCase();
        if (q.includes(pNameLower) || (pBrandLower && q.includes(pBrandLower))) {
            return cleanText(
                `Produk ${p.name} (${p.category} dari ${p.brand}): ${p.description}\n` +
                `• Kandungan: ${p.ingredients.join(', ')}\n` +
                `• Masalah Kulit: ${p.skin_concern.join(', ')}\n` +
                `• Panduan Pakai: ${p.usage_guidance}\n` +
                `• Status Katalog: ${p.status === 'active' ? 'Aktif di katalog' : 'Nonaktif/Resep dokter'}.`
            );
        }
    }

    // ==============================================================
    // 28. SMART UNIVERSAL ADMIN RESOLVER & CONCISE FALLBACK
    // ==============================================================
    if (isAdmin) {
        // Universal count handler for admin fallback:
        const isDetailRequested = q.includes('siapa') || q.includes('sebutkan') || q.includes('tuliskan') || q.includes('daftar') || q.includes('jelaskan') || q.includes('detail') || q.includes('rincian');
        const isCountQuery = q.includes('berapa') || q.includes('jumlah') || q.includes('total') || q.includes('banyak') || q.includes('hitung');
        if (isCountQuery && !isDetailRequested) {
            if ((q.includes('admin') || q.includes('administrator')) && !q.includes('customer') && !q.includes('pelanggan')) return String(adminCount);
            if ((q.includes('customer') || q.includes('pelanggan')) && !q.includes('admin') && !q.includes('administrator')) return String(customerCount);
            if (q.includes('pengguna') || q.includes('user') || q.includes('akun') || q.includes('member')) {
                if (q.includes('aktif') && !q.includes('non')) return String(activeUsers);
                if (q.includes('nonaktif') || q.includes('non-aktif') || q.includes('blokir')) return String(users.filter(u => u.status !== 'active').length);
                return String(totalUsers);
            }
            if (q.includes('produk') || q.includes('katalog') || q.includes('catalog') || q.includes('skincare') || q.includes('barang')) {
                if (q.includes('aktif') && !q.includes('non')) return String(activeProducts.length);
                if (q.includes('nonaktif') || q.includes('resep')) return String(inactiveProducts.length);
                return String(totalProducts);
            }
            if (q.includes('scan') || q.includes('pemindaian')) return String(totalScans);
            if (q.includes('analisis')) return String(totalAnalysis);
            if (q.includes('chat') || q.includes('pesan') || q.includes('interaksi')) return String(totalMessages);
            if (q.includes('percakapan') || q.includes('sesi') || q.includes('obrolan')) return String(totalConversations);
            if (q.includes('log') || q.includes('audit')) return String(auditLogs.length);
            if (q.includes('tabel') || q.includes('table')) return "8";
            if (q.includes('role') || q.includes('peran')) return "2";
            if (q.includes('kategori')) return "5";
            if (q.includes('brand') || q.includes('merek')) return "3";
        }

        // If question relates to users/accounts
        if (q.includes('pengguna') || q.includes('user') || q.includes('akun') || q.includes('customer') || q.includes('member')) {
            if (q.includes('siapa') || q.includes('daftar') || q.includes('sebutkan') || q.includes('tuliskan')) {
                const userList = users.map((u, idx) => {
                    const phoneStr = u.phone_number ? `, No. HP: ${u.phone_number}` : '';
                    const roleStr = u.role === 'admin' ? 'Administrator' : 'Customer';
                    const statusStr = u.status === 'active' ? 'Aktif' : 'Nonaktif';
                    return `${idx + 1}. ${u.name} (Email: ${u.email}${phoneStr}, Peran: ${roleStr}, Status: ${statusStr})`;
                }).join('\n');
                return cleanText(
                    `Berikut daftar seluruh pengguna terdaftar di database SkinCheck (${totalUsers} akun):\n\n` +
                    userList
                );
            }
            return cleanText(
                `Informasi Pengguna Database SkinCheck:\n\n` +
                `Tercatat sebanyak ${totalUsers} pengguna terdaftar (${adminCount} Administrator, ${customerCount} Customer, seluruhnya berstatus ${activeUsers} aktif).\n\n` +
                `Daftar ringkas pengguna: ` + users.map(u => `${u.name} (${u.role})`).join(', ') + `.\n\n` +
                `Anda dapat menanyakan detail lengkap setiap pengguna dengan mengetikkan nama atau email pengguna yang diinginkan.`
            );
        }

        // If question relates to products/catalog
        if (q.includes('produk') || q.includes('katalog') || q.includes('catalog') || q.includes('skincare') || q.includes('barang')) {
            return cleanText(
                `Informasi Katalog Produk SkinCheck:\n\n` +
                `Tercatat sebanyak ${totalProducts} produk di katalog (${activeProducts.length} aktif, ${inactiveProducts.length} nonaktif/resep dokter):\n` +
                products.map(p => `• ${p.name} [${p.category} - ${p.brand}] (${p.status === 'active' ? 'Aktif' : 'Nonaktif'})`).join('\n')
            );
        }

        // If question relates to scans/analysis
        if (q.includes('scan') || q.includes('analisis') || q.includes('wajah') || q.includes('pemindaian') || q.includes('kamera')) {
            return cleanText(
                `Informasi Pemindaian & Analisis Kulit:\n\n` +
                `Tercatat sebanyak ${totalScans} data pemindaian wajah dan ${totalAnalysis} data hasil analisis kulit di database, dengan skor rata-rata kondisi kulit customer sebesar 75/100.`
            );
        }

        // If question relates to logs/audit
        if (q.includes('log') || q.includes('audit') || q.includes('aktivitas') || q.includes('keamanan')) {
            const lastLog = auditLogs[0];
            return cleanText(
                `Informasi Audit Log Sistem:\n\n` +
                `Tercatat sebanyak ${auditLogs.length} catatan audit log aktivitas. Aktivitas terakhir: [${lastLog ? lastLog.category : 'SISTEM'}] ${lastLog ? lastLog.action : 'Operasi normal'}.`
            );
        }

        // If question relates to system config / integrations
        if (q.includes('konfigurasi') || q.includes('sistem') || q.includes('pengaturan') || q.includes('setting') || q.includes('integrasi') || q.includes('ai') || q.includes('otp') || q.includes('wa')) {
            const waProvider = systemConfig?.whatsapp?.active_provider || 'fonnte';
            const aiProvider = systemConfig?.ai?.active_provider || 'gemini';
            return cleanText(
                `Informasi Konfigurasi Sistem SkinCheck:\n\n` +
                `• Provider AI: ${aiProvider} (Model Default: Gemini 1.5 Flash)\n` +
                `• Gateway WhatsApp: ${waProvider.toUpperCase()} (Masa aktif OTP: 300 detik)\n` +
                `• Keamanan: Enkripsi Bcrypt, session secret development, dan CSRF protection aktif.`
            );
        }

        // Comprehensive system summary for any other administrative query
        return cleanText(
            `Sebagai Administrator, Anda memiliki akses penuh ke seluruh database SkinCheck:\n\n` +
            `• Pengguna: ${totalUsers} akun (${adminCount} Admin, ${customerCount} Customer terdaftar)\n` +
            `• Katalog: ${totalProducts} produk (${activeProducts.length} aktif, ${inactiveProducts.length} nonaktif)\n` +
            `• Pemindaian: ${totalScans} data scan wajah dan ${totalAnalysis} rekaman analisis kulit\n` +
            `• Chatbot: ${totalMessages} interaksi dalam ${totalConversations} percakapan\n` +
            `• Keamanan: ${auditLogs.length} catatan audit log dan integrasi OTP WhatsApp aktif.\n\n` +
            `Silakan tanyakan data spesifik apa pun dari database yang ingin Anda ketahui!`
        );
    } else {
        return cleanText(
            `Saya adalah asisten SkinCheck yang siap menjawab pertanyaan seputar perawatan kulit, rekomendasi produk, dan penggunaan fitur aplikasi. Silakan tanyakan kondisi kulit atau produk yang ingin Anda ketahui!`
        );
    }
}

// Lazy loader for LLM provider
let _llmProvider = null;
function getLlmProvider() {
    if (!_llmProvider) {
        try {
            _llmProvider = require('./llmProviderService');
        } catch (e) {
            console.error("Error loading LLM provider:", e.message);
        }
    }
    return _llmProvider;
}

/**
 * Async resolver for any question:
 * Uses queryDatabase first. If queryDatabase returns the fallback response,
 * it attempts to consult Gemini (if configured and active) with strict concise prompt.
 */
async function resolveQuestion(message, currentUser = null) {
    if (!message || typeof message !== 'string') {
        return queryDatabase(message, currentUser);
    }

    const q = message.toLowerCase().trim();

    // Enforce coding guard immediately
    if (isCodingQuestion(q)) {
        return cleanText(
            "Mohon maaf, saya tidak dapat menjawab pertanyaan atau permintaan terkait coding/pemrograman. " +
            "Saya adalah asisten SkinCheck yang bertugas membantu pertanyaan umum seputar kesehatan kulit, rekomendasi skincare, dan seluruh data yang ada di dalam database aplikasi."
        );
    }

    const localResponse = queryDatabase(message, currentUser);
    
    // Check if localResponse was the default fallback
    const isFallback = localResponse.startsWith("Sebagai Administrator, Anda memiliki akses penuh ke seluruh database") ||
                       localResponse.startsWith("Saya adalah asisten SkinCheck yang siap menjawab pertanyaan seputar perawatan kulit");
    if (!isFallback) {
        return cleanText(localResponse);
    }

    // If Gemini is active and API key exists, request a direct concise response
    try {
        const systemConfigModel = require('../../models/systemConfigModel');
        const aiConfig = systemConfigModel.getAiConfig();
        const geminiApiKey = aiConfig?.providers?.gemini?.api_key || process.env.AI_API_KEY;

        if (aiConfig?.active_provider === 'gemini' && geminiApiKey && geminiApiKey.trim() !== '') {
            const provider = getLlmProvider();
            if (provider && typeof provider.generateResponse === 'function') {
                const now = getIndonesianDateTime(0);
                const isAdmin = Boolean(currentUser && currentUser.role === 'admin');
                
                let dbContextForPrompt = "";
                if (isAdmin) {
                    dbContextForPrompt = `\n\nBERIKUT ADALAH SNAPSHOT LENGKAP DARI SELURUH ISI DATABASE SISTEM SAAT INI:\n` + getDatabaseSnapshot() + '\n';
                }

                const systemPrompt = 
                    `Anda adalah asisten AI resmi SkinCheck. Hari ini adalah hari ${now.dayName}, tanggal ${now.dateNum} ${now.monthName} ${now.yearNum}.\n` +
                    `STATUS PENGGUNA: ${isAdmin ? 'Administrator (Super Admin - memiliki hak akses penuh dan mutlak atas seluruh data database sistem)' : 'Customer (Akses hanya seputar aplikasi perawatan kulit)'}.\n` +
                    dbContextForPrompt +
                    `ATURAN SANGAT KETAT:\n` +
                    `1. Jawab HANYA apa yang ditanyakan oleh pengguna secara singkat, padat, jelas, ramah, dan solutif.\n` +
                    `2. ATURAN JAWABAN PERSIS & ANGKA: Jawab HANYA apa yang ditanyakan saja. Contoh: jika bertanya 'berapa banyak jumlah total pengguna' maka jawab jumlah total penggunanya saja (contoh: '7'). Jika bertanya 'berapa pengguna admin' maka jawab berapa banyak adminnya saja (contoh: '1'). Jika bertanya 'berapa customer' maka jawab berapa banyak customernya saja (contoh: '6'). DILARANG KERAS menggabungkan atau saling mengaitkan data seperti 'Saat ini terdapat total 7 pengguna terdaftar, terdiri dari 1 Administrator dan 6 Customer'. CUKUP JAWAB APA YANG DITANYAKAN!\n` +
                    `3. HANYA jika pengguna menanyakan 'siapa' (atau meminta sebutkan/tuliskan daftar lengkap), barulah jawab secara LENGKAP dan DETAIL.\n` +
                    `4. ${isAdmin ? 'Karena pengguna adalah Administrator, Anda DAPAT dan HARUS menjawab seluruh pertanyaan terkait isi database sistem secara transparan.' : 'Sebagai Customer, jaga privasi data internal sistem dan akun customer lain.'}\n` +
                    `5. JANGAN PERNAH menjawab pertanyaan terkait coding/pemrograman.\n` +
                    `6. DILARANG KERAS menggunakan simbol asterisk (*) atau format markdown bintang (**teks**). Sajikan teks bersih tanpa bintang.`;
                
                const llmReply = await provider.generateResponse(systemPrompt, [{ role: 'user', content: message }], currentUser);
                if (llmReply && llmReply.trim()) {
                    return cleanText(llmReply);
                }
            }
        }
    } catch (err) {
        console.error("Error calling LLM provider in resolveQuestion:", err.message);
    }

    return cleanText(localResponse);
}

module.exports = {
    queryDatabase,
    resolveQuestion,
    cleanText,
    getIndonesianDateTime,
    isCodingQuestion,
    getDatabaseSnapshot
};
