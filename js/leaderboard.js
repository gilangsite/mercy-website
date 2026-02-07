/**
 * MERCY 2026 - Leaderboard Logic
 * Fetches and displays real-time rankings
 */

document.addEventListener('DOMContentLoaded', () => {
    fetchLeaderboard();

    // Auto refresh every 10 seconds
    setInterval(fetchLeaderboard, 10000);
});

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby1_17nAVrjJ0rcWvtSOvTXRnpptTeEnepr5FaVuttwmZJ9AZ43KsXDsuEkHnwRUJYtzw/exec';

async function fetchLeaderboard() {
    const tbody = document.getElementById('leaderboardBody');
    const loading = document.getElementById('loading');

    try {
        const response = await fetch(APPS_SCRIPT_URL + '?action=get_leaderboard');
        const allData = await response.json();

        // Render
        loading.style.display = 'none';
        tbody.innerHTML = '';

        if (allData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="text-center">Belum ada data kompetisi.</td></tr>';
            return;
        }

        allData.forEach((user, index) => {
            const rank = index + 1;
            let rankBadge = `<span class="rank-badge">${rank}</span>`;

            if (rank === 1) rankBadge = `<span class="rank-badge rank-1">${rank}</span>`;
            if (rank === 2) rankBadge = `<span class="rank-badge rank-2">${rank}</span>`;
            if (rank === 3) rankBadge = `<span class="rank-badge rank-3">${rank}</span>`;

            const row = `
            <tr>
                <td>${rankBadge}</td>
                <td><div style="font-weight: 500;">${user.name}</div></td>
                <td><span class="badge" style="background:#dbeafe; color:#1e40af; padding:4px 8px; border-radius:4px; font-size:0.8rem;">Selesai</span></td>
            </tr>
        `;
            tbody.innerHTML += row;
        });
    } catch (error) {
        console.error('Leaderboard Fetch Error:', error);
        if (loading) loading.textContent = 'Gagal memuat data peringkat.';
    }
}
