/**
 * MERCY 2026 - Leaderboard Logic
 * Fetches and displays real-time rankings
 */

document.addEventListener('DOMContentLoaded', () => {
    fetchLeaderboard();

    // Setup Share Modal interactions
    setupShareModal();

    // Auto refresh every 10 seconds
    setInterval(() => {
        if (!isGenerating) fetchLeaderboard();
    }, 10000);
});

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby1_17nAVrjJ0rcWvtSOvTXRnpptTeEnepr5FaVuttwmZJ9AZ43KsXDsuEkHnwRUJYtzw/exec';
let currentUserEmail = localStorage.getItem('mercy_quiz_email') || ''; // Assuming email is saved during quiz login
let isGenerating = false;

// Attempt to get email from URL if redirected from quiz
const urlParams = new URLSearchParams(window.location.search);
const urlEmail = urlParams.get('email');
if (urlEmail) {
    currentUserEmail = urlEmail;
    localStorage.setItem('mercy_quiz_email', urlEmail);
}

async function fetchLeaderboard() {
    const tbody = document.getElementById('leaderboardBody');
    const posterTbody = document.getElementById('posterLeaderboardBody');
    const loading = document.getElementById('loading');
    const personalResult = document.getElementById('personalResult');

    try {
        const response = await fetch(APPS_SCRIPT_URL + '?action=get_leaderboard');
        const allData = await response.json();

        // Render Main Table
        loading.style.display = 'none';
        tbody.innerHTML = '';

        if (allData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="text-center">Belum ada data kompetisi.</td></tr>';
            return;
        }

        let currentUserRank = -1;
        let currentUserData = null;

        allData.forEach((user, index) => {
            const rank = index + 1;

            // Check for current user
            if (currentUserEmail && user.email === currentUserEmail) {
                currentUserRank = rank;
                currentUserData = user;
            }

            // Render Row
            const rankBadge = getRankBadge(rank);
            const row = `
            <tr class="${currentUserEmail && user.email === currentUserEmail ? 'highlight-row' : ''}" style="${currentUserEmail && user.email === currentUserEmail ? 'background-color: #eff6ff;' : ''}">
                <td>${rankBadge}</td>
                <td><div style="font-weight: 500;">${user.name} ${currentUserEmail && user.email === currentUserEmail ? '(Anda)' : ''}</div></td>
                <td><span class="badge" style="background:#dbeafe; color:#1e40af; padding:4px 8px; border-radius:4px; font-size:0.8rem;">Selesai</span></td>
            </tr>
        `;
            tbody.innerHTML += row;
        });

        // Show Personal Result Section if User Found
        if (currentUserData) {
            personalResult.classList.remove('hidden');
            document.getElementById('personalMessage').innerHTML = `Hebat, <strong>${currentUserData.name}</strong>! Kamu berhasil menduduki leaderboard peringkat <strong>${currentUserRank}</strong> dari <strong>${allData.length}</strong> peserta.`;

            // Populate Hidden Poster Data
            document.getElementById('posterName').textContent = currentUserData.name;
            document.getElementById('posterRank').textContent = currentUserRank;
            document.getElementById('posterTotal').textContent = allData.length;

            // Populate Poster Mini Leaderboard (Top 3)
            posterTbody.innerHTML = '';
            // Determine range to show: Top 3 always
            const top3 = allData.slice(0, 3);

            top3.forEach((u, i) => {
                const r = i + 1;
                const badge = getRankBadge(r); // Plain number or simple badge for poster? Text is better for html2canvas reliability usually, but badges ok.
                const isMe = currentUserEmail && u.email === currentUserEmail;

                posterTbody.innerHTML += `
                    <tr style="${isMe ? 'color:#1e40af; font-weight:bold;' : 'color:#333;'}">
                        <td style="padding: 15px; border-bottom: 2px solid #eee;">#${r}</td>
                        <td style="padding: 15px; border-bottom: 2px solid #eee;">${u.name}</td>
                        <td style="padding: 15px; border-bottom: 2px solid #eee; text-align:right;">Selesai</td>
                    </tr>
                `;
            });
        }

    } catch (error) {
        console.error('Leaderboard Fetch Error:', error);
        if (loading) loading.textContent = 'Gagal memuat data peringkat.';
    }
}

function getRankBadge(rank) {
    let rankBadge = `<span class="rank-badge">${rank}</span>`;
    if (rank === 1) rankBadge = `<span class="rank-badge rank-1">${rank}</span>`;
    if (rank === 2) rankBadge = `<span class="rank-badge rank-2">${rank}</span>`;
    if (rank === 3) rankBadge = `<span class="rank-badge rank-3">${rank}</span>`;
    return rankBadge;
}

// --- Share Feature ---

function setupShareModal() {
    const modal = document.getElementById('shareModal');
    const btnShareStory = document.getElementById('btnShareStory');
    const closeBtn = document.getElementById('closeShareModal');
    const btnShareIG = document.getElementById('btnShareIG');
    const btnSavePNG = document.getElementById('btnSavePNG');

    if (btnShareStory) {
        btnShareStory.addEventListener('click', () => {
            modal.classList.add('active');
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.classList.remove('active');
        });
    }

    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    });

    if (btnSavePNG) {
        btnSavePNG.addEventListener('click', () => generateAndAction('download'));
    }

    if (btnShareIG) {
        btnShareIG.addEventListener('click', () => generateAndAction('share'));
    }
}

async function generateAndAction(action) {
    const loader = document.getElementById('generatingLoader');
    loader.classList.remove('hidden');
    isGenerating = true;

    // Wait a bit for fonts to load or UI to settle
    await new Promise(resolve => setTimeout(resolve, 500));

    const element = document.getElementById('posterContainer');

    // Ensure styles are correct before capture (html2canvas sometimes needs explict scaling)
    // We are capturing a fixed 1080x1920 div hidden offscreen.

    try {
        const canvas = await html2canvas(element, {
            scale: 1, // 1:1 scale of the 1080px div
            useCORS: true,
            backgroundColor: '#ffffff',
            logging: false
        });

        const dataUrl = canvas.toDataURL('image/png');
        const fileName = `Mercy_Achievement_${new Date().getTime()}.png`;

        if (action === 'download') {
            const link = document.createElement('a');
            link.download = fileName;
            link.href = dataUrl;
            link.click();
        } else if (action === 'share') {
            // Convert DataURL to Blob
            const blob = await (await fetch(dataUrl)).blob();
            const file = new File([blob], fileName, { type: 'image/png' });

            if (navigator.share && navigator.canShare({ files: [file] })) {
                try {
                    await navigator.share({
                        files: [file],
                        title: 'Pencapaian Kompetisi Mercy 2026',
                        text: 'Cek pencapaian saya di Kompetisi Iseng Ngetest Mercy 2026! @medtools.id @medtools.academy'
                    });
                } catch (err) {
                    if (err.name !== 'AbortError') {
                        console.error('Share failed:', err);
                        alert('Gagal membuka share menu. Silakan coba "Simpan sebagai PNG" dan upload manual.');
                    }
                }
            } else {
                alert('Browser anda tidak mendukung direct share image. Silakan gunakan tombol "Simpan sebagai PNG" lalu upload ke Instagram Stories secara manual.');
                // Fallback to download
                const link = document.createElement('a');
                link.download = fileName;
                link.href = dataUrl;
                link.click();
            }
        }

    } catch (err) {
        console.error('Generation failed:', err);
        alert('Gagal membuat poster. Silakan coba lagi.');
    } finally {
        loader.classList.add('hidden');
        isGenerating = false;
    }
}
