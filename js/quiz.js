/**
 * quiz.js - Core Quiz Engine
 * Unobfuscated version
 */

const STORAGE_KEY = 'mercy_quiz_progress';
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyVM4EKlT1iSUUj7970-YdYAynbqpUaBAcTSMlJ_H_4Th9tSB4D0vCPscMzlb5BRihIBQ/exec';
const QUIZ_DURATION_MINUTES = 45;

window.quizState = {
    name: '',
    email: '',
    questions: [],
    answers: {}, // { "1": "C", "2": "B" }
    currentQuestionIndex: 0,
    endTime: null,
    timerInterval: null,
    sessionToken: null,
    isSubmitting: false
};

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    // If we are on quiz page, check if we should be here
    // Note: quiz.html has its own login hijacking that calls startQuiz
});

function initQuizControls() {
    document.getElementById('btnPrev').addEventListener('click', prevQuestion);
    document.getElementById('btnNext').addEventListener('click', nextQuestion);
    document.getElementById('btnFinish').addEventListener('click', () => {
        // This is now handled in quiz.html confirm modal
    });

    // Sidebar toggle
    const quizSidebar = document.getElementById('quizSidebar');
    const toggleSidebar = () => quizSidebar.classList.toggle('active');
    const closeSidebar = () => quizSidebar.classList.remove('active');

    // Add shortcuts or mobile button listeners if they exist in HTML
    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') prevQuestion();
        if (e.key === 'ArrowRight') nextQuestion();
    });
}

// --- CORE FUNCTIONS ---

async function startQuiz(email, name) {
    window.quizState.email = email;
    window.quizState.name = name;

    try {
        // 1. Fetch Questions
        const response = await fetch('data/questions.json');
        window.quizState.questions = await response.json();

        // 2. Setup Session on Backend
        const sessionResponse = await fetch(`${APPS_SCRIPT_URL}?action=start_quiz&email=${encodeURIComponent(email)}`);
        const sessionResult = await sessionResponse.json();

        if (sessionResult.success) {
            window.quizState.sessionToken = sessionResult.sessionToken;
        } else {
            console.error("Session token error:", sessionResult.message);
            // We proceed anyway as backend has fallbacks, but token is preferred
        }

        // 3. UI Transition
        document.getElementById('quizLogin').style.display = 'none';
        document.getElementById('quizInterface').classList.remove('hidden');

        // 4. Timer setup
        if (!window.quizState.endTime) {
            window.quizState.endTime = Date.now() + (QUIZ_DURATION_MINUTES * 60 * 1000);
        }
        startTimer();

        // 5. Render first question & Navigation
        setupNavigation();
        loadQuestion(window.quizState.currentQuestionIndex);
        updateAnswerCount();
        initQuizControls();

        saveQuizProgress();

    } catch (error) {
        console.error("Failed to start quiz:", error);
        alert("Gagal memuat soal. Silakan refresh halaman.");
    }
}

function loadQuestion(index) {
    if (index < 0 || index >= window.quizState.questions.length) return;

    window.quizState.currentQuestionIndex = index;
    const question = window.quizState.questions[index];

    document.getElementById('currentQNum').textContent = index + 1;
    document.getElementById('totalCountDisplay').textContent = window.quizState.questions.length;
    document.getElementById('questionText').textContent = question.question;

    const optionsList = document.getElementById('optionsList');
    optionsList.innerHTML = '';

    Object.entries(question.options).forEach(([key, text]) => {
        const button = document.createElement('button');
        button.className = 'option-btn';
        if (window.quizState.answers[question.id] === key) {
            button.classList.add('selected');
        }

        button.innerHTML = `
            <span class="option-label">${key}</span>
            <span class="option-text">${text}</span>
        `;

        button.onclick = () => selectAnswer(question.id, key);
        optionsList.appendChild(button);
    });

    // Update navigation active state
    document.querySelectorAll('.q-nav-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(`nav-btn-${question.id}`);
    if (activeBtn) activeBtn.classList.add('active');

    // Update buttons
    document.getElementById('btnPrev').disabled = (index === 0);
    const btnNext = document.getElementById('btnNext');
    const btnFinish = document.getElementById('btnFinish');

    if (index === window.quizState.questions.length - 1) {
        btnNext.classList.add('hidden');
        btnFinish.classList.remove('hidden');
    } else {
        btnNext.classList.remove('hidden');
        btnFinish.classList.add('hidden');
    }

    // Scroll to top of question area for mobile
    document.querySelector('.question-area').scrollTop = 0;
    saveQuizProgress();
}

function selectAnswer(questionId, optionKey) {
    window.quizState.answers[questionId] = optionKey;

    // Update UI immediately
    document.querySelectorAll('.option-btn').forEach(btn => {
        const label = btn.querySelector('.option-label').textContent;
        if (label === optionKey) btn.classList.add('selected');
        else btn.classList.remove('selected');
    });

    // Mark as answered in sidebar
    const navBtn = document.getElementById(`nav-btn-${questionId}`);
    if (navBtn) navBtn.classList.add('answered');

    updateAnswerCount();
    saveQuizProgress();
}

function nextQuestion() {
    if (window.quizState.currentQuestionIndex < window.quizState.questions.length - 1) {
        loadQuestion(window.quizState.currentQuestionIndex + 1);
    }
}

function prevQuestion() {
    if (window.quizState.currentQuestionIndex > 0) {
        loadQuestion(window.quizState.currentQuestionIndex - 1);
    }
}

function setupNavigation() {
    const navContainer = document.getElementById('questionNav');
    navContainer.innerHTML = '';

    window.quizState.questions.forEach((q, i) => {
        const btn = document.createElement('button');
        btn.className = 'q-nav-btn';
        btn.id = `nav-btn-${q.id}`;
        btn.textContent = i + 1;

        if (window.quizState.answers[q.id]) {
            btn.classList.add('answered');
        }

        btn.onclick = () => {
            loadQuestion(i);
            if (window.innerWidth < 768) {
                document.getElementById('quizSidebar').classList.remove('active');
            }
        };
        navContainer.appendChild(btn);
    });
}

function updateAnswerCount() {
    const count = Object.keys(window.quizState.answers).length;
    const el = document.getElementById('answeredCount');
    if (el) el.textContent = count;
}

// --- TIMER ---
function startTimer() {
    if (window.quizState.timerInterval) clearInterval(window.quizState.timerInterval);

    const timerDisplay = document.getElementById('timerDisplay');

    window.quizState.timerInterval = setInterval(() => {
        const now = Date.now();
        const diff = window.quizState.endTime - now;

        if (diff <= 0) {
            clearInterval(window.quizState.timerInterval);
            timerDisplay.textContent = "00:00";
            alert("Waktu habis! Jawaban Anda akan disubmit otomatis.");
            finishQuiz();
            return;
        }

        const minutes = Math.floor(diff / 1000 / 60);
        const seconds = Math.floor((diff / 1000) % 60);

        timerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

        if (minutes < 5) {
            timerDisplay.style.color = '#EF4444';
        }
    }, 1000);
}

// --- SUBMISSION ---
async function finishQuiz() {
    if (window.quizState.isSubmitting) return;
    window.quizState.isSubmitting = true;

    clearInterval(window.quizState.timerInterval);

    const btnConfirm = document.getElementById('btnConfirmSubmit');
    if (btnConfirm) {
        btnConfirm.disabled = true;
        btnConfirm.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
    }

    try {
        const timeSpent = Math.floor((Date.now() - (window.quizState.endTime - (QUIZ_DURATION_MINUTES * 60 * 1000))) / 1000);

        // 1. Validate and get score first (while session is still active)
        const validateURL = `${APPS_SCRIPT_URL}?action=validate_quiz&email=${encodeURIComponent(window.quizState.email)}&sessionToken=${encodeURIComponent(window.quizState.sessionToken)}&answers=${encodeURIComponent(JSON.stringify(window.quizState.answers))}`;
        const validateResponse = await fetch(validateURL);
        const validateResult = await validateResponse.json();

        if (!validateResult.success) {
            throw new Error(validateResult.message || "Gagal memvalidasi jawaban.");
        }

        const score = validateResult.score;

        // 2. Submit to record data
        const submissionData = {
            action: 'submit_quiz',
            email: window.quizState.email,
            name: window.quizState.name,
            answers: window.quizState.answers,
            sessionToken: window.quizState.sessionToken,
            timeSpent: timeSpent,
            timestamp: new Date().toISOString()
        };

        await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(submissionData)
        });

        // 3. Success UI
        clearQuizProgress();
        showScorePopup(score);

        setTimeout(() => {
            window.location.href = `leaderboard.html?email=${encodeURIComponent(window.quizState.email)}&name=${encodeURIComponent(window.quizState.name)}&score=${score}`;
        }, 3000);

    } catch (error) {
        console.error("Submission error:", error);
        alert("Submission failed, but don't worry. Your progress is saved. Please try refresh or contact admin.");
        window.quizState.isSubmitting = false;
        if (btnConfirm) {
            btnConfirm.disabled = false;
            btnConfirm.innerHTML = 'Ya, Kirim Sekarang';
        }
    }
}

function showScorePopup(score) {
    const scoreModal = document.getElementById('scoreModal');
    const finalScoreValue = document.getElementById('finalScoreValue');

    if (scoreModal && finalScoreValue) {
        finalScoreValue.textContent = score;
        scoreModal.style.display = 'flex';
        document.getElementById('quizInterface').style.opacity = '0.3';
        document.getElementById('quizInterface').style.pointerEvents = 'none';

        if (typeof confetti === 'function') {
            confetti({
                particleCount: 150,
                spread: 70,
                origin: { y: 0.6 }
            });
        }
    }
}

// --- PERSISTENCE ---

function saveQuizProgress() {
    if (window.quizState.isSubmitting || !window.quizState.email) return;

    const data = {
        email: window.quizState.email,
        name: window.quizState.name,
        answers: window.quizState.answers,
        currentQuestionIndex: window.quizState.currentQuestionIndex,
        endTime: window.quizState.endTime,
        sessionToken: window.quizState.sessionToken
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function loadSavedProgress() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;

    try {
        const parsed = JSON.parse(saved);
        window.quizState.email = parsed.email;
        window.quizState.name = parsed.name;
        window.quizState.answers = parsed.answers || {};
        window.quizState.currentQuestionIndex = parsed.currentQuestionIndex || 0;
        window.quizState.endTime = parsed.endTime;
        window.quizState.sessionToken = parsed.sessionToken;
    } catch (e) {
        console.error("Error loading progress:", e);
    }
}

function clearQuizProgress() {
    localStorage.removeItem(STORAGE_KEY);
    window.quizState.answers = {};
    window.quizState.endTime = null;
    window.quizState.sessionToken = null;
}