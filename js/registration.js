/**
 * MERCY 2026 - Registration Logic
 * Handles user registration and Apps Script submission
 */

// CONFIGURATION - TO BE UPDATED WITH DEPLOYED SCRIPT URL
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby1_17nAVrjJ0rcWvtSOvTXRnpptTeEnepr5FaVuttwmZJ9AZ43KsXDsuEkHnwRUJYtzw/exec';

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
    const data = {
        action: 'register',
        nama: formData.get('nama'),
        email: formData.get('email'),
        institusi: formData.get('institusi'), // Field renamed to "Nama Universitas" in UI but kept "institusi" key for consistency or can change to university
        instagram: formData.get('instagram'),
        semester: formData.get('semester'),
        whatsapp: formData.get('whatsapp')
    };

    try {
        const response = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors', // Important for Apps Script
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });

        // Mode 'no-cors' will always return an opaque response with status 0, 
        // which means we can't check 'response.ok' or see the JSON.
        // For Apps Script production, we assume success if no error is thrown.

        // Show success state
        formContainer.classList.add('hidden');
        successContainer.classList.remove('hidden');

        // Save to local storage for quick access detection (UI only)
        const registeredUsers = JSON.parse(localStorage.getItem('mercy_users') || '[]');
        registeredUsers.push(data.email);
        localStorage.setItem('mercy_users', JSON.stringify(registeredUsers));

    } catch (error) {
        console.error('Registration Error:', error);
        messageDiv.textContent = 'Terjadi kesalahan: ' + error.message;
        messageDiv.className = 'form-error mb-2';
        submitBtn.disabled = false;
        submitBtn.textContent = 'DAFTAR SEKARANG';
    }
}
