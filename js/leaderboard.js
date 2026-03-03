/**
 * leaderboard.js - Leaderboard Display and Achievement Sharing
 * Unobfuscated version
 */

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyVM4EKlT1iSUUj7970-YdYAynbqpUaBAcTSMlJ_H_4Th9tSB4D0vCPscMzlb5BRihIBQ/exec';

document.addEventListener('DOMContentLoaded', () => {
    fetchLeaderboard();
    setupShareButtons();
});

async function fetchLeaderboard() {
    const leaderboardBody = document.getElementById('leaderboardBody');
    const loading = document.getElementById('loading');

    // Get params
    const urlParams = new URLSearchParams(window.location.search);
    const userEmail = urlParams.get('email')?.toLowerCase().trim();
    const userName = urlParams.get('name');

    try {
        const response = await fetch(`${APPS_SCRIPT_URL}?action=get_leaderboard&t=${Date.now()}`);
        const data = await response.json();

        loading.style.display = 'none';
        leaderboardBody.innerHTML = '';

        if (data.length === 0) {
            leaderboardBody.innerHTML = '<tr><td colspan="3" class="text-center">Belum ada data.</td></tr>';
            return;
        }

        // Check if user is in leaderboard
        let userRank = -1;
        data.forEach((entry, index) => {
            const rank = index + 1;
            const isUser = userName && entry.name === userName; // Simplification as we don't have email in LB sheet

            if (isUser && userRank === -1) userRank = rank;

            const row = document.createElement('tr');
            if (isUser) row.style.backgroundColor = '#dbeafe';

            row.innerHTML = `
                <td><span class="rank-badge ${rank <= 3 ? 'rank-' + rank : ''}">${rank}</span></td>
                <td>
                    <div style="font-weight: 600; color: var(--color-navy);">${entry.name}</div>
                    <div style="font-size: 0.75rem; color: #666;">INC Mercy Participant</div>
                </td>
                <td>
                    <span style="font-size: 0.85rem; color: #059669; font-weight: 600;">
                        <i class="fas fa-check-circle"></i> Selesai
                    </span>
                </td>
            `;
            leaderboardBody.appendChild(row);
        });

        // Personalization
        if (userRank !== -1 && userName) {
            const personalHeader = document.getElementById('personalHeader');
            const personalSub = document.getElementById('personalSub');
            const personalMessageContainer = document.getElementById('personalMessageContainer');
            const defaultHeader = document.getElementById('defaultHeader');
            const shareSection = document.getElementById('shareSection');

            personalHeader.textContent = `Hebat, ${userName}!`;
            personalSub.innerHTML = `Kamu berhasil menduduki leaderboard peringkat <strong>${userRank}</strong> dari <strong>${data.length}</strong> peserta.`;

            personalMessageContainer.classList.remove('hidden');
            defaultHeader.classList.add('hidden');
            shareSection.classList.remove('hidden');

            // Setup Poster Data
            document.getElementById('posterName').textContent = userName;
            document.getElementById('posterRank').textContent = userRank;
            document.getElementById('posterTotal').textContent = data.length;

            // Fill Poster Top 10
            const posterLB = document.getElementById('posterLeaderboardBody');
            posterLB.innerHTML = '';
            data.slice(0, 10).forEach((entry, i) => {
                const tr = document.createElement('tr');
                tr.style.borderBottom = (i < 9) ? '1px solid #eee' : 'none';
                tr.innerHTML = `
                    <td style="padding: 12px 10px; font-weight: 800; color: #666; width: 60px;">#${i + 1}</td>
                    <td style="padding: 12px 10px; font-weight: 600; color: var(--color-navy);">${entry.name}</td>
                    <td style="padding: 12px 10px; text-align: right; color: #10b981;"><i class="fas fa-check"></i></td>
                `;
                posterLB.appendChild(tr);
            });
        }

    } catch (error) {
        console.error("Leaderboard fetch error:", error);
        loading.innerHTML = '<span style="color: red;">Gagal memuat data. Mohon refresh halaman.</span>';
    }
}

function setupShareButtons() {
    const shareModal = document.getElementById('shareModal');
    const btnShareStory = document.getElementById('btnShareStory');
    const closeShareModal = document.getElementById('closeShareModal');
    const btnShareIG = document.getElementById('btnShareIG');
    const btnSavePNG = document.getElementById('btnSavePNG');

    if (btnShareStory) {
        btnShareStory.onclick = () => {
            shareModal.classList.add('active');
        };
    }

    if (closeShareModal) {
        closeShareModal.onclick = () => {
            shareModal.classList.remove('active');
        };
    }

    if (btnShareIG) {
        btnShareIG.onclick = () => generateAndAction('share');
    }

    if (btnSavePNG) {
        btnSavePNG.onclick = () => generateAndAction('download');
    }
}

async function generateAndAction(type) {
    const loader = document.getElementById('generatingLoader');
    const canvasContainer = document.getElementById('posterContainer');

    loader.classList.remove('hidden');

    try {
        // Ensure images/fonts are loaded
        await document.fonts.ready;

        const canvas = await html2canvas(canvasContainer, {
            scale: 2, // High resolution
            useCORS: true,
            allowTaint: true,
            logging: false,
            backgroundColor: '#ffffff'
        });

        if (type === 'download') {
            const link = document.createElement('a');
            link.download = `INC-Achievement-${Date.now()}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } else if (type === 'share') {
            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
            const file = new File([blob], 'achievement.png', { type: 'image/png' });

            if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: 'My Achievement in INC Mercy 2026',
                    text: 'Saya berhasil masuk leaderboard INC Mercy 2026! Yuk ikut kompetisinya.'
                });
            } else {
                // Fallback for desktop or non-supported browsers
                const link = document.createElement('a');
                link.download = `Achievement.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
                alert("Browser tidak mendukung fitur Share langsung. Gambar telah diunduh, silakan bagikan secara manual ke Instagram!");
            }
        }
    } catch (err) {
        console.error("Generation error:", err);
        alert("Gagal membuat poster. Mohon coba lagi.");
    } finally {
        loader.classList.add('hidden');
    }
}