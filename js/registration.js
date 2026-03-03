/**
 * MERCY 2026 - Registration Logic
 * Handles user registration and Apps Script submission
 */

// CONFIGURATION - TO BE UPDATED WITH DEPLOYED SCRIPT URL
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby4K1ZDyEHiU3Jm5gG91E32_tFD4m3nHc68AilD9-M7FxrK4PVt_YwPp-lDl5iOAjI_/exec';

document.addEventListener('DOMContentLoaded', () => {
    const regForm = document.getElementById('registrationForm');

    if (regForm) {
        regForm.addEventListener('submit', handleRegistration);
    }
});

async function handleRegistration(e) {
    e.preventDefault();

    const submitBtn = document.getElementById('btnSubmit');
    const messageDiv = document.getElementById('formMessage');
    const formContainer = document.getElementById('registrationState');
    const successContainer = document.getElementById('successState');

    // Initial State
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';
    messageDiv.innerHTML = '';
    messageDiv.className = 'mb-2';

    // Get Data
    const formData = new FormData(e.target);
    const whatsappValue = formData.get('whatsapp');

    // Extra Validation for WhatsApp (Numbers only)
    if (!/^\d+$/.test(whatsappValue)) {
        messageDiv.textContent = 'Nomor WhatsApp harus berupa angka saja.';
        messageDiv.className = 'form-error mb-2';
        submitBtn.disabled = false;
        submitBtn.textContent = 'DAFTAR SEKARANG';
        return;
    }

    const data = {
        action: 'register',
        nama: formData.get('nama'),
        email: formData.get('email').trim().toLowerCase(), // Normalize email
        institusi: formData.get('institusi'),
        instagram: formData.get('instagram'),
        semester: formData.get('semester'),
        whatsapp: whatsappValue
    };

    try {
        console.log('Checking email existence for:', data.email);

        // --- STRENGTHENED PRE-CHECK ---
        // Using a timestamp to avoid any potential caching
        const checkUrl = APPS_SCRIPT_URL + '?action=check_email&email=' + encodeURIComponent(data.email) + '&t=' + Date.now();
        const checkResponse = await fetch(checkUrl);

        if (!checkResponse.ok) {
            throw new Error('Gagal melakukan validasi email ke server.');
        }

        const checkResult = await checkResponse.json();
        console.log('Pre-check result:', checkResult);

        if (checkResult.exists) {
            messageDiv.textContent = 'Email sudah terdaftar pada sistem Mercy, mohon masukkan email baru.';
            messageDiv.className = 'form-error mb-2';
            submitBtn.disabled = false;
            submitBtn.textContent = 'DAFTAR SEKARANG';
            return;
        }

        // Proceed if email is not found
        const response = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });

        // Show success state
        formContainer.classList.add('hidden');
        successContainer.classList.remove('hidden');

        // UI only: track locally
        const registeredUsers = JSON.parse(localStorage.getItem('mercy_users') || '[]');
        if (!registeredUsers.includes(data.email)) {
            registeredUsers.push(data.email);
            localStorage.setItem('mercy_users', JSON.stringify(registeredUsers));
        }

    } catch (error) {
        console.error('Registration Error:', error);
        messageDiv.textContent = 'Terjadi kesalahan: ' + error.message;
        messageDiv.className = 'form-error mb-2';
        submitBtn.disabled = false;
        submitBtn.textContent = 'DAFTAR SEKARANG';
    }
}
