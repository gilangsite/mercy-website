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
const urlName = urlParams.get('name'); // Also get name for immediate display

if (urlEmail) {
    currentUserEmail = urlEmail;
    localStorage.setItem('mercy_quiz_email', urlEmail);
}
if (urlName) {
    localStorage.setItem('mercy_quiz_name', urlName);
}

async function fetchLeaderboard() {
    const tbody = document.getElementById('leaderboardBody');
    const posterTbody = document.getElementById('posterLeaderboardBody');
    const loading = document.getElementById('loading');
    const personalResult = document.getElementById('personalResult');

    // New UI Elements
    const personalMessageContainer = document.getElementById('personalMessageContainer');
    const defaultHeader = document.getElementById('defaultHeader');
    const shareSection = document.getElementById('shareSection');

    try {
        const response = await fetch(APPS_SCRIPT_URL + '?action=get_leaderboard');
        const allData = await response.json();

        // Render Main Table
        loading.style.display = 'none';
        tbody.innerHTML = '';

        if (allData.length === 0) {
            // If no data but we have local user, show them pending
            if (currentUserEmail) {
                // Show temporary "Pending" state or just the personal header
                handlePendingUser();
            } else {
                tbody.innerHTML = '<tr><td colspan="3" class="text-center">Belum ada data kompetisi.</td></tr>';
            }
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
            // Hide Default Header, Show Personal Header
            if (defaultHeader) defaultHeader.classList.add('hidden');
            if (personalMessageContainer) personalMessageContainer.classList.remove('hidden');

            // Update Text
            const pHeader = document.getElementById('personalHeader');
            const pSub = document.getElementById('personalSub');

            if (pHeader) pHeader.textContent = `Hebat, ${currentUserData.name}!`;
            if (pSub) pSub.innerHTML = `Kamu berhasil menduduki leaderboard peringkat <strong>${currentUserRank}</strong> dari <strong>${allData.length}</strong> peserta.`;

            // Show Share Button (Bottom)
            if (shareSection) shareSection.classList.remove('hidden');

            // --- Populate Hidden Poster Data ---
            const postName = document.getElementById('posterName');
            const postRank = document.getElementById('posterRank');
            const postTotal = document.getElementById('posterTotal');

            if (postName) postName.textContent = currentUserData.name;
            if (postRank) postRank.textContent = currentUserRank;
            if (postTotal) postTotal.textContent = allData.length;

            // Populate Poster Leaderboard (Top 10)
            if (posterTbody) {
                posterTbody.innerHTML = '';
                const top10 = allData.slice(0, 10); // Grab Top 10

                top10.forEach((u, i) => {
                    const r = i + 1;
                    const isMe = currentUserEmail && u.email === currentUserEmail;

                    posterTbody.innerHTML += `
                        <tr style="${isMe ? 'color:#1e40af; font-weight:bold;' : 'color:#333;'}">
                            <td style="padding: 12px; border-bottom: 2px solid #eee; width: 80px;">#${r}</td>
                            <td style="padding: 12px; border-bottom: 2px solid #eee;">${u.name}</td>
                            <td style="padding: 12px; border-bottom: 2px solid #eee; text-align:right;">Selesai</td>
                        </tr>
                    `;
                });
            }
        } else {
            // User logged in but not yet in leaderboard (or sync delay)
            handlePendingUser();
        }

    } catch (error) {
        console.error('Leaderboard Fetch Error:', error);
        if (loading) loading.textContent = 'Gagal memuat data peringkat.';
    }
}

function handlePendingUser() {
    const defaultHeader = document.getElementById('defaultHeader');
    const personalMessageContainer = document.getElementById('personalMessageContainer');
    const shareSection = document.getElementById('shareSection');
    const name = localStorage.getItem('mercy_quiz_name') || 'Peserta';

    // Show simplified personal header
    if (currentUserEmail) {
        if (defaultHeader) defaultHeader.classList.add('hidden');
        if (personalMessageContainer) {
            personalMessageContainer.classList.remove('hidden');
            const pHeader = document.getElementById('personalHeader');
            const pSub = document.getElementById('personalSub');

            if (pHeader) pHeader.textContent = `Hebat, ${name}!`;
            if (pSub) pSub.innerHTML = `Data kamu sedang diproses. Tunggu sebentar untuk melihat peringkatmu.`;
        }
    } else {
        if (defaultHeader) defaultHeader.classList.remove('hidden');
        if (personalMessageContainer) personalMessageContainer.classList.add('hidden');
        if (shareSection) shareSection.classList.add('hidden');
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
