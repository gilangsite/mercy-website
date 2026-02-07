/**
 * MERCY 2026 - Quiz Logic
 * Handles quiz mechanics: login, timer, navigation, scoring
 */

// CONFIGURATION
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby1_17nAVrjJ0rcWvtSOvTXRnpptTeEnepr5FaVuttwmZJ9AZ43KsXDsuEkHnwRUJYtzw/exec';
const QUIZ_DURATION_MINUTES = 60;

let quizState = {
    email: '',
    questions: [],
    answers: {}, // { questionId: "A" }
    currentQuestionIndex: 0,
    startTime: null,
    timerInterval: null
};

document.addEventListener('DOMContentLoaded', () => {
    initLogin();
    initQuizControls();
});

// --- Login & Validation ---
function initLogin() {
    const loginForm = document.getElementById('loginForm');
    if (!loginForm) return;

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const btn = document.getElementById('btnLogin');
        const msg = document.getElementById('loginMessage');

        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memeriksa...';
        msg.innerHTML = '';

        try {
            // Check if user is registered via Apps Script
            const response = await fetch(APPS_SCRIPT_URL + '?action=check_email&email=' + encodeURIComponent(email));
            const result = await response.json();

            if (result.exists || email === 'mercy.medtools@gmail.com') { // Admin override
                quizState.email = email;
                startQuiz();
            } else {
                msg.textContent = 'Email belum terdaftar. Silakan daftar INC terlebih dahulu.';
                msg.className = 'form-error mb-2';
                btn.disabled = false;
                btn.textContent = 'MULAI KOMPETISI';
            }
        } catch (error) {
            console.error(error);
            msg.textContent = 'Terjadi kesalahan sistem.';
            msg.className = 'form-error mb-2';
            btn.disabled = false;
            btn.textContent = 'MULAI KOMPETISI';
        }
    });
}

// --- Quiz Core Logic ---
async function startQuiz() {
    // Hide login, show quiz
    document.getElementById('quizLogin').style.display = 'none';
    document.getElementById('quizInterface').classList.remove('hidden');

    // Load Questions
    try {
        const response = await fetch('data/questions.json');
        const data = await response.json();

        // For production: shuffle questions or pick 50
        quizState.questions = data;

        setupNavigation();
        loadQuestion(0);
        startTimer();
    } catch (e) {
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
        btn.onclick = () => loadQuestion(index);
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
    let timeLeft = QUIZ_DURATION_MINUTES * 60;
    const display = document.getElementById('timerDisplay');

    quizState.timerInterval = setInterval(() => {
        timeLeft--;

        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;

        display.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        if (timeLeft <= 300) { // Last 5 mins
            display.style.color = '#EF4444';
        }

        if (timeLeft <= 0) {
            clearInterval(quizState.timerInterval);
            finishQuiz(true); // Auto submit
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
async function finishQuiz(auto = false) {
    clearInterval(quizState.timerInterval);

    if (auto) alert('Waktu habis! Jawaban Anda akan disubmit otomatis.');

    const loadingHtml = '<div style="position:fixed;inset:0;background:rgba(255,255,255,0.9);z-index:3000;display:flex;flex-direction:column;align-items:center;justify-content:center;"><h2>Menyimpan Jawaban...</h2><p>Mohon jangan tutup halaman ini.</p></div>';
    document.body.insertAdjacentHTML('beforeend', loadingHtml);

    // Calculate dummy score locally for demo
    let score = 0;
    quizState.questions.forEach(q => {
        if (quizState.answers[q.id] === q.correct) {
            score += 1; // 1 point per correct answer
        }
    });
    const finalScore = score * 2; // Scale to 100 (if 50 questions) - for 5 questions, scale to 100

    // Prepare Data
    const payload = {
        action: 'submit_quiz',
        email: quizState.email,
        answers: quizState.answers,
        score: finalScore, // In real app, calculate on backend!
        timestamp: new Date().toISOString()
    };

    // Submit to Apps Script
    try {
        await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        console.log('Quiz submitted successfully');
    } catch (err) {
        console.error('Submission failed:', err);
    }

    // Redirect to Leaderboard
    window.location.href = 'leaderboard.html';
}
