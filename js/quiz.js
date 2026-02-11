/**
 * MERCY 2026 - Quiz Logic
 * Handles quiz mechanics: login, timer, navigation, scoring
 */

// CONFIGURATION
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby1_17nAVrjJ0rcWvtSOvTXRnpptTeEnepr5FaVuttwmZJ9AZ43KsXDsuEkHnwRUJYtzw/exec';
const QUIZ_DURATION_MINUTES = 45;

let quizState = {
    name: '', // Display name for leaderboard
    email: '',
    questions: [],
    answers: {},
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
async function startQuiz() {
    // Hide login, show quiz
    document.getElementById('quizLogin').style.display = 'none';
    document.getElementById('quizInterface').classList.remove('hidden');

    // Load Questions
    try {
        const response = await fetch('data/questions.json');
        const data = await response.json();

        // Use all 30 questions
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
    let timeLeft = Math.floor(QUIZ_DURATION_MINUTES * 60);
    const display = document.getElementById('timerDisplay');

    quizState.timerInterval = setInterval(() => {
        timeLeft--;

        const minutes = Math.floor(timeLeft / 60);
        const seconds = Math.floor(timeLeft % 60);

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
let isSubmitting = false;
async function finishQuiz(auto = false) {
    if (isSubmitting) return;
    isSubmitting = true;

    clearInterval(quizState.timerInterval);

    if (auto) alert('Waktu habis! Jawaban Anda akan disubmit otomatis.');

    // Calculate score
    let correctCount = 0;
    quizState.questions.forEach(q => {
        if (quizState.answers[q.id] === q.correct) {
            correctCount += 1;
        }
    });

    // Scoring Logic: 
    // If all correct (30) -> 100
    // If 29 correct -> 3.3 * 29 = 95.7 -> round to 96
    // Use Math.round(correctCount * 3.333...) but floor/ceil to match user logic
    let finalScore = (correctCount === quizState.questions.length) ? 100 : Math.round(correctCount * 3.3);

    // Show Score Popup with Confetti
    showScorePopup(finalScore);

    // Prepare Data for Apps Script
    const payload = {
        action: 'submit_quiz',
        email: quizState.email,
        name: quizState.name,
        answers: quizState.answers,
        score: finalScore,
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
        // Fade out transition
        document.getElementById('scoreModal').style.opacity = '0';
        document.getElementById('quizInterface').style.opacity = '0';
        document.getElementById('quizInterface').style.transition = 'opacity 1s ease';

        setTimeout(() => {
            window.location.href = `leaderboard.html?email=${encodeURIComponent(quizState.email)}&name=${encodeURIComponent(quizState.name)}&score=${finalScore}`;
        }, 1000);
    }, 4000); // Show popup for 4 seconds
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
