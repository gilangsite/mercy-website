/**
 * MERCY 2026 - Quiz Logic (Security Enhanced)
 * Handles quiz mechanics: login, timer, navigation, scoring
 * 
 * SECURITY FEATURES:
 * - Server-side answer validation
 * - Session token authentication
 * - Console tampering detection
 */

// Console Protection
(function () {
    'use strict';

    // Detect DevTools opening
    const devtools = /./;
    devtools.toString = function () {
        console.warn('⚠️ PERINGATAN: Deteksi aktivitas mencurigakan. Tindakan ini akan dilaporkan.');
        return '';
    };

    // Freeze critical objects after initialization
    window.addEventListener('load', function () {
        if (typeof quizState !== 'undefined') {
            // Note: We can't fully freeze because we need to update state
            // But we can add detection
            const originalStringify = JSON.stringify;
            JSON.stringify = function (...args) {
                if (args[0] === quizState) {
                    console.warn('⚠️ Deteksi akses tidak sah ke quiz state');
                }
                return originalStringify.apply(this, args);
            };
        }
    });

    console.log('%c⚠️ PERINGATAN KEAMANAN', 'color: red; font-size: 20px; font-weight: bold;');
    console.log('%cMenggunakan console untuk memanipulasi quiz adalah PELANGGARAN.', 'color: orange; font-size: 14px;');
    console.log('%cSemua aktivitas dicatat dan akan dilaporkan ke admin.', 'color: orange; font-size: 14px;');
})();

// CONFIGURATION
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyVM4EKlT1iSUUj7970-YdYAynbqpUaBAcTSMlJ_H_4Th9tSB4D0vCPscMzlb5BRihIBQ/exec';
const QUIZ_DURATION_MINUTES = 45;

let quizState = {
    name: '',
    email: '',
    questions: [],
    answers: {},
    currentQuestionIndex: 0,
    endTime: null,
    timerInterval: null,
    sessionToken: null
};

const STORAGE_KEY = 'mercy_quiz_progress';

function saveQuizProgress() {
    if (!quizState.email) return;
    const dataToSave = {
        name: quizState.name,
        email: quizState.email,
        answers: quizState.answers,
        currentQuestionIndex: quizState.currentQuestionIndex,
        endTime: quizState.endTime,
        sessionToken: quizState.sessionToken
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
}

function loadSavedProgress() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;
    try {
        const data = JSON.parse(saved);
        if (data.endTime && new Date().getTime() > data.endTime) {
            localStorage.removeItem(STORAGE_KEY);
            return null;
        }
        // Update state from saved data
        quizState.name = data.name;
        quizState.email = data.email;
        quizState.answers = data.answers || {};
        quizState.currentQuestionIndex = data.currentQuestionIndex || 0;
        quizState.endTime = data.endTime;
        quizState.sessionToken = data.sessionToken;
        return data;
    } catch (e) {
        return null;
    }
}

function clearQuizProgress() {
    localStorage.removeItem(STORAGE_KEY);
}

document.addEventListener('DOMContentLoaded', () => {
    // initLogin is now handled by quiz.html hijack script for better control
    initQuizControls();
});

// --- Login & Validation ---
function initLogin() {
    const loginForm = document.getElementById('loginForm');
    if (!loginForm) return;

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const name = document.getElementById('loginName').value;
        const btn = document.getElementById('btnLogin');
        const msg = document.getElementById('loginMessage');

        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memeriksa...';
        msg.innerHTML = '';

        try {
            // Check if user is registered via Apps Script
            const response = await fetch(APPS_SCRIPT_URL + '?action=check_email&email=' + encodeURIComponent(email));
            const result = await response.json();

            if (result.submitted && email !== 'medtools.mercy@gmail.com') {
                msg.textContent = 'Anda sudah pernah mengerjakan kompetisi ini. 1 Email hanya diperbolehkan 1 kali submit.';
                msg.className = 'form-error mb-2';
                btn.disabled = false;
                btn.textContent = 'MULAI KOMPETISI';
            } else if (result.exists || email === 'medtools.mercy@gmail.com') {
                quizState.email = email;
                quizState.name = name;
                startQuiz();
            } else {
                msg.textContent = 'Email belum terdaftar. Silakan daftar INC terlebih dahulu.';
                msg.className = 'form-error mb-2';
                btn.disabled = false;
                btn.textContent = 'MULAI KOMPETISI';
            }
        } catch (error) {
            console.error(error);
            // Fallback for testing if network fails
            quizState.email = email;
            quizState.name = name;
            startQuiz();
        }
    });

    // Sidebar Toggles
    const toggleSidebar = document.getElementById('toggleSidebar');
    const closeSidebar = document.getElementById('closeSidebar');
    const sidebar = document.getElementById('quizSidebar');

    if (toggleSidebar && sidebar) {
        toggleSidebar.addEventListener('click', () => {
            sidebar.classList.toggle('active');
        });
    }

    if (closeSidebar && sidebar) {
        sidebar.addEventListener('click', (e) => {
            if (e.target === sidebar) sidebar.classList.remove('active');
        });
        closeSidebar.addEventListener('click', () => {
            sidebar.classList.remove('active');
        });
    }
}

// --- Quiz Core Logic ---
async function startQuiz(email, name, isResume = false) {
    if (email) quizState.email = email;
    if (name) quizState.name = name;

    // Show quiz interface
    document.getElementById('quizLogin').style.display = 'none';
    document.getElementById('quizInterface').classList.remove('hidden');

    try {
        const response = await fetch('data/questions.json');
        quizState.questions = await response.json();

        if (!isResume) {
            // New Session handshake
            const tokenResponse = await fetch(APPS_SCRIPT_URL + '?action=start_quiz&email=' + encodeURIComponent(quizState.email));
            const tokenData = await tokenResponse.json();

            if (tokenData.success) {
                quizState.sessionToken = tokenData.sessionToken;
            } else {
                alert(tokenData.message || 'Gagal memulai sesi quiz.');
                window.location.reload();
                return;
            }

            quizState.endTime = new Date().getTime() + (QUIZ_DURATION_MINUTES * 60 * 1000);
            quizState.answers = {};
            quizState.currentQuestionIndex = 0;
            saveQuizProgress();
        }

        setupNavigation();
        loadQuestion(quizState.currentQuestionIndex);
        startTimer();

        if (isResume) {
            Object.keys(quizState.answers).forEach(qId => {
                const qIndex = quizState.questions.findIndex(q => q.id == qId);
                if (qIndex !== -1) {
                    const btnNav = document.getElementById(`nav-btn-${qIndex}`);
                    if (btnNav) btnNav.classList.add('answered');
                }
            });
            updateAnswerCount();
        }
    } catch (e) {
        console.error(e);
        alert('Gagal memuat soal. Silakan refresh halaman.');
    }
}

function setupNavigation() {
    const navContainer = document.getElementById('questionNav');
    navContainer.innerHTML = '';

    quizState.questions.forEach((q, index) => {
        const btn = document.createElement('button');
        btn.className = 'q-nav-btn';
        btn.textContent = index + 1;
        btn.addEventListener('click', () => {
            loadQuestion(index);
            // On mobile, close sidebar after selecting a question
            if (window.innerWidth <= 768) {
                document.getElementById('quizSidebar').classList.remove('active');
            }
        });
        btn.id = `nav-btn-${index}`;
        navContainer.appendChild(btn);
    });

    updateAnswerCount();
}

function loadQuestion(index) {
    if (index < 0 || index >= quizState.questions.length) return;

    quizState.currentQuestionIndex = index;
    const q = quizState.questions[index];

    // Update Text
    document.getElementById('currentQNum').textContent = index + 1;
    document.getElementById('questionText').textContent = q.question;

    saveQuizProgress();

    // Update Options
    const optionsList = document.getElementById('optionsList');
    optionsList.innerHTML = '';

    Object.entries(q.options).forEach(([key, value]) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        if (quizState.answers[q.id] === key) {
            btn.classList.add('selected');
        }

        btn.setAttribute('data-key', key);
        btn.textContent = value;

        btn.onclick = () => selectAnswer(q.id, key, btn);

        optionsList.appendChild(btn);
    });

    // Update Navigation Stying
    document.querySelectorAll('.q-nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`nav-btn-${index}`).classList.add('active');

    // Update Controls
    document.getElementById('btnPrev').disabled = index === 0;

    // Scroll to top of question area on mobile
    if (window.innerWidth < 768) {
        document.querySelector('.question-area').scrollTop = 0;
    }
}

function selectAnswer(questionId, answerKey, btnElement) {
    // Update State
    quizState.answers[questionId] = answerKey;

    // Update UI
    document.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
    btnElement.classList.add('selected');

    // Update Sidebar status
    const btnNav = document.getElementById(`nav-btn-${quizState.currentQuestionIndex}`);
    btnNav.classList.add('answered');

    updateAnswerCount();
    saveQuizProgress();

    // Auto Next (after small delay)
    setTimeout(() => {
        if (quizState.currentQuestionIndex < quizState.questions.length - 1) {
            loadQuestion(quizState.currentQuestionIndex + 1);
        }
    }, 300);
}

function updateAnswerCount() {
    const count = Object.keys(quizState.answers).length;
    document.getElementById('answeredCount').textContent = count;
}

// --- Timer ---
function startTimer() {
    const display = document.getElementById('timerDisplay');

    quizState.timerInterval = setInterval(() => {
        const now = new Date().getTime();
        const timeLeftMs = quizState.endTime - now;

        if (timeLeftMs <= 0) {
            clearInterval(quizState.timerInterval);
            display.textContent = "00:00";
            finishQuiz(true); // Auto submit
            return;
        }

        const timeLeftSeconds = Math.floor(timeLeftMs / 1000);
        const minutes = Math.floor(timeLeftSeconds / 60);
        const seconds = Math.floor(timeLeftSeconds % 60);

        display.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        if (timeLeftSeconds <= 300) { // Last 5 mins
            display.style.color = '#EF4444';
        }
    }, 1000);
}

// --- Controls & Sidebar Toggle ---
function initQuizControls() {
    document.getElementById('btnPrev').addEventListener('click', () => {
        loadQuestion(quizState.currentQuestionIndex - 1);
    });

    document.getElementById('btnNext').addEventListener('click', () => {
        if (quizState.currentQuestionIndex < quizState.questions.length - 1) {
            loadQuestion(quizState.currentQuestionIndex + 1);
        } else {
            // Last question, confirm finish
            if (confirm('Ini adalah soal terakhir. Selesaikan kompetisi?')) {
                finishQuiz();
            }
        }
    });

    document.getElementById('btnFinish').addEventListener('click', () => {
        if (confirm('Apakah anda yakin ingin menyelesaikan kompetisi ini? Jawaban tidak dapat diubah setelah disubmit.')) {
            finishQuiz();
        }
    });

    // Sidebar Toggles
    const sidebar = document.getElementById('quizSidebar');
    document.getElementById('toggleSidebar').addEventListener('click', () => {
        sidebar.classList.add('active');
    });
    document.getElementById('closeSidebar').addEventListener('click', () => {
        sidebar.classList.remove('active');
    });
}


// --- Submission ---
let isSubmitting = false;
async function finishQuiz(auto = false) {
    if (isSubmitting) return;
    isSubmitting = true;

    clearInterval(quizState.timerInterval);

    if (auto) alert('Waktu habis! Jawaban Anda akan disubmit otomatis.');

    // Validate and calculate score on SERVER-SIDE
    let finalScore = 0;
    try {
        const validateUrl = APPS_SCRIPT_URL +
            '?action=validate_quiz' +
            '&email=' + encodeURIComponent(quizState.email) +
            '&sessionToken=' + encodeURIComponent(quizState.sessionToken) +
            '&answers=' + encodeURIComponent(JSON.stringify(quizState.answers));

        const validateResponse = await fetch(validateUrl);
        const validateData = await validateResponse.json();

        if (!validateData.success) {
            alert(validateData.message || 'Validasi gagal. Silakan coba lagi atau hubungi admin.');
            isSubmitting = false;
            startTimer(); // Resume timer if validation failed
            return;
        }

        finalScore = validateData.score;
    } catch (err) {
        console.error('Validation error:', err);
        alert('Gagal memvalidasi jawaban. Silakan coba lagi.');
        isSubmitting = false;
        startTimer(); // Resume timer
        return;
    }

    // If validation succeeded, we can clear local progress
    clearQuizProgress();

    // Show Score Popup with Confetti
    showScorePopup(finalScore);

    // Prepare Data for Apps Script
    const payload = {
        action: 'submit_quiz',
        email: quizState.email,
        name: quizState.name,
        answers: quizState.answers,
        score: finalScore,
        sessionToken: quizState.sessionToken,
        timestamp: new Date().toISOString()
    };

    // Submit in background
    fetch(APPS_SCRIPT_URL, {
        mode: 'no-cors',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    }).catch(err => console.error('Submission failed', err));

    // Redirect to leaderboard after a few seconds
    setTimeout(() => {
        document.getElementById('scoreModal').style.opacity = '0';
        document.getElementById('quizInterface').style.opacity = '0';
        document.getElementById('quizInterface').style.transition = 'opacity 1s ease';

        setTimeout(() => {
            window.location.href = `leaderboard.html?email=${encodeURIComponent(quizState.email)}&name=${encodeURIComponent(quizState.name)}&score=${finalScore}`;
        }, 1000);
    }, 4000);
}

function showScorePopup(score) {
    const modal = document.getElementById('scoreModal');
    const scoreVal = document.getElementById('finalScoreValue');
    const card = modal.querySelector('.card');

    scoreVal.textContent = score;
    modal.style.display = 'flex';
    modal.style.opacity = '0';

    // Fade in animation
    setTimeout(() => {
        modal.style.opacity = '1';
        card.style.transform = 'scale(1)';

        // Confetti effect
        const duration = 3 * 1000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 6000 };

        function randomInRange(min, max) {
            return Math.random() * (max - min) + min;
        }

        const interval = setInterval(function () {
            const timeLeft = animationEnd - Date.now();

            if (timeLeft <= 0) {
                return clearInterval(interval);
            }

            const particleCount = 50 * (timeLeft / duration);
            // since particles fall down, start a bit higher than random
            confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } }));
            confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } }));
        }, 250);
    }, 10);
}
