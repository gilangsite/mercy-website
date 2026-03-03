/**
 * registration.js - User Registration Logic
 * Unobfuscated version
 */

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyVM4EKlT1iSUUj7970-YdYAynbqpUaBAcTSMlJ_H_4Th9tSB4D0vCPscMzlb5BRihIBQ/exec';

document.addEventListener('DOMContentLoaded', () => {
    const registrationForm = document.getElementById('registrationForm');
    if (registrationForm) {
        registrationForm.addEventListener('submit', handleRegistration);
    }
});

async function handleRegistration(e) {
    if (e) e.preventDefault();

    const form = e.target;
    const btnSubmit = document.getElementById('btnSubmit');
    const formMessage = document.getElementById('formMessage');
    const registrationState = document.getElementById('registrationState');
    const successState = document.getElementById('successState');

    // Reset UI
    if (formMessage) {
        formMessage.innerHTML = '';
        formMessage.className = 'mb-2';
    }

    if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';
    }

    try {
        const formData = new FormData(form);
        const name = formData.get('nama')?.trim();
        const email = formData.get('email')?.trim().toLowerCase();
        const whatsapp = formData.get('whatsapp')?.trim();
        const institusi = formData.get('institusi')?.trim();
        const instagram = formData.get('instagram')?.trim();
        const semester = formData.get('semester');

        // Validation
        if (!name || !email || !whatsapp) {
            throw new Error('Nama, Email, dan WhatsApp wajib diisi.');
        }

        if (!/^\d+$/.test(whatsapp)) {
            throw new Error('Nomor WhatsApp harus berupa angka saja.');
        }

        // 1. Check if email exists
        console.log('Checking email existence for:', email);
        const checkResponse = await fetch(`${APPS_SCRIPT_URL}?action=check_email&email=${encodeURIComponent(email)}&t=${Date.now()}`);

        if (!checkResponse.ok) {
            throw new Error('Gagal melakukan validasi email ke server.');
        }

        const checkResult = await checkResponse.json();
        console.log('Pre-check result:', checkResult);

        if (checkResult.exists) {
            throw new Error('Email sudah terdaftar pada sistem Mercy, mohon gunakan email lain atau hubungi admin.');
        }

        // 2. Submit Registration
        const registrationData = {
            action: 'register',
            nama: name,
            email: email,
            whatsapp: whatsapp,
            institusi: institusi,
            instagram: instagram,
            semester: semester
        };

        // Note: GAS legacy post often works better with no-cors if not returning JSON, 
        // but here we expect the user is registered. 
        // We'll use standard fetch and handle potential CORS if the backend is configured.
        // If it fails due to CORS, we still proceed to success UI since data likely reached GS (if using no-cors).

        await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(registrationData)
        });

        // 3. Success UI
        if (registrationState) registrationState.classList.add('hidden');
        if (successState) successState.classList.remove('hidden');

        // Store email locally for easier login later
        localStorage.setItem('mercy_quiz_email', email);
        localStorage.setItem('mercy_quiz_name', name);

        // Track in mercy_users list if needed
        const users = JSON.parse(localStorage.getItem('mercy_users') || '[]');
        if (!users.includes(email)) {
            users.push(email);
            localStorage.setItem('mercy_users', JSON.stringify(users));
        }

    } catch (error) {
        console.error('Registration Error:', error);
        if (formMessage) {
            formMessage.textContent = error.message;
            formMessage.className = 'form-error mb-2';
            formMessage.style.color = 'red';
        }
        if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = 'DAFTAR SEKARANG';
        }
    }
}