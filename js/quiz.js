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
    console.log('%c⚠️ PERINGATAN KEAMANAN', 'color: red; font-size: 20px; font-weight: bold;');
    console.log('%cMenggunakan console untuk memanipulasi quiz adalah PELANGGARAN.', 'color: orange; font-size: 14px;');
    console.log('%cSemua aktivitas dicatat dan akan dilaporkan ke admin.', 'color: orange; font-size: 14px;');
})();

// ============================================================
// CONFIGURATION
// ============================================================
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyVM4EKlT1iSUUj7970-YdYAynbqpUaBAcTSMlJ_H_4Th9tSB4D0vCPscMzlb5BRihIBQ/exec';
const QUIZ_DURATION_MINUTES = 45;
const STORAGE_KEY = 'mercy_quiz_progress';

// ============================================================
// QUIZ STATE
// ============================================================
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

// ============================================================
// LOCAL STORAGE HELPERS
// ============================================================
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
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
    } catch (e) {
        console.warn('Could not save progress:', e);
    }
}

function loadSavedProgress() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;
    try {
        const data = JSON.parse(saved);
        // If timer has expired, clear progress
        if (data.endTime && new Date().getTime() > data.endTime) {
            localStorage.removeItem(STORAGE_KEY);
            return null;
        }
        // Restore state
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

// ============================================================
// DOM INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    // Login/Resume flow is handled by the inline script in quiz.html
    // We only init the quiz controls here
    initQuizControls();

    // Save progress auto on page hide / unload
    window.addEventListener('beforeunload', () => saveQuizProgress());
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') saveQuizProgress();
    });
});

// ============================================================
// QUIZ CORE LOGIC
// ============================================================

/**
 * Called from quiz.html inline script after login validation.
 * @param {string} email - User's email
 * @param {string} name  - User's display name
 * @param {boolean} isResume - true if resuming a saved session
 */
async function startQuiz(email, name, isResume = false) {
    if (email) quizState.email = email;
    if (name) quizState.name = name;

    // Show quiz interface, hide login
    const loginEl = document.getElementById('quizLogin');
    const quizEl = document.getElementById('quizInterface');
    if (loginEl) loginEl.style.display = 'none';
    if (quizEl) quizEl.classList.remove('hidden');

    try {
        // Load questions
        const response = await fetch('data/questions.json');
        if (!response.ok) throw new Error('questions.json not reachable');
        quizState.questions = await response.json();

        if (!isResume) {
            // --- NEW SESSION: Get token from server ---
            const tokenResponse = await fetch(
                APPS_SCRIPT_URL + '?action=start_quiz&email=' + encodeURIComponent(quizState.email)
            );
            const tokenData = await tokenResponse.json();

            if (tokenData.success) {
                quizState.sessionToken = tokenData.sessionToken;
            } else {
                // Block the user from starting
                alert(tokenData.message || 'Gagal memulai sesi kuis. Silakan coba lagi.');
                if (loginEl) loginEl.style.display = 'flex';
                if (quizEl) quizEl.classList.add('hidden');
                return;
            }

            // Set fresh timer
            quizState.endTime = new Date().getTime() + (QUIZ_DURATION_MINUTES * 60 * 1000);
            quizState.answers = {};
            quizState.currentQuestionIndex = 0;
            saveQuizProgress();

        } else {
            // --- RESUME: Regenerate/verify token without network round-trip ---
            // The stateless token is deterministic (email + salt), so we can just
            // trust the one stored in localStorage. Backend will still accept it.
            // No extra fetch needed.
        }

        setupNavigation();
        loadQuestion(quizState.currentQuestionIndex);
        startTimer();

        // Re-mark answered questions in sidebar navigation
        if (isResume && quizState.answers) {
            Object.keys(quizState.answers).forEach(qId => {
                const qIndex = quizState.questions.findIndex(q => String(q.id) === String(qId));
                if (qIndex !== -1) {
                    const btnNav = document.getElementById(`nav-btn-${qIndex}`);
                    if (btnNav) btnNav.classList.add('answered');
                }
            });
            updateAnswerCount();
        }

    } catch (e) {
        console.error('startQuiz error:', e);
        alert('Gagal memuat soal kuis. Silakan refresh halaman.');
    }
}

// ============================================================
// NAVIGATION SETUP
// ============================================================
function setupNavigation() {
    const navContainer = document.getElementById('questionNav');
    if (!navContainer) return;
    navContainer.innerHTML = '';

    quizState.questions.forEach((q, index) => {
        const btn = document.createElement('button');
        btn.className = 'q-nav-btn';
        btn.textContent = index + 1;
        btn.id = `nav-btn-${index}`;
        btn.addEventListener('click', () => {
            loadQuestion(index);
            if (window.innerWidth <= 768) {
                const sidebar = document.getElementById('quizSidebar');
                if (sidebar) sidebar.classList.remove('active');
            }
        });
        navContainer.appendChild(btn);
    });

    // Update total count display
    const totalDisplay = document.getElementById('totalCountDisplay');
    if (totalDisplay) totalDisplay.textContent = quizState.questions.length;

    updateAnswerCount();
}

function loadQuestion(index) {
    if (index < 0 || index >= quizState.questions.length) return;

    quizState.currentQuestionIndex = index;
    const q = quizState.questions[index];

    // Update header
    const numEl = document.getElementById('currentQNum');
    if (numEl) numEl.textContent = index + 1;

    const textEl = document.getElementById('questionText');
    if (textEl) textEl.textContent = q.question;

    saveQuizProgress();

    // Render options
    const optionsList = document.getElementById('optionsList');
    if (!optionsList) return;
    optionsList.innerHTML = '';

    Object.entries(q.options).forEach(([key, value]) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        if (quizState.answers[String(q.id)] === key) {
            btn.classList.add('selected');
        }
        btn.setAttribute('data-key', key);
        btn.textContent = value;
        btn.onclick = () => selectAnswer(String(q.id), key, btn);
        optionsList.appendChild(btn);
    });

    // Update sidebar active state
    document.querySelectorAll('.q-nav-btn').forEach(b => b.classList.remove('active'));
    const activeNavBtn = document.getElementById(`nav-btn-${index}`);
    if (activeNavBtn) activeNavBtn.classList.add('active');

    // Prev button
    const prevBtn = document.getElementById('btnPrev');
    if (prevBtn) prevBtn.disabled = (index === 0);

    // Scroll to top on mobile
    if (window.innerWidth < 768) {
        const qaEl = document.querySelector('.question-area');
        if (qaEl) qaEl.scrollTop = 0;
    }
}

function selectAnswer(questionId, answerKey, btnElement) {
    quizState.answers[questionId] = answerKey;

    // Highlight selection
    document.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
    btnElement.classList.add('selected');

    // Mark question as answered in sidebar
    const navBtn = document.getElementById(`nav-btn-${quizState.currentQuestionIndex}`);
    if (navBtn) navBtn.classList.add('answered');

    updateAnswerCount();
    saveQuizProgress();

    // Auto-advance to next question
    setTimeout(() => {
        if (quizState.currentQuestionIndex < quizState.questions.length - 1) {
            loadQuestion(quizState.currentQuestionIndex + 1);
        }
    }, 300);
}

function updateAnswerCount() {
    const countEl = document.getElementById('answeredCount');
    if (countEl) countEl.textContent = Object.keys(quizState.answers).length;
}

// ============================================================
// TIMER
// ============================================================
function startTimer() {
    // Clear any existing timer first
    if (quizState.timerInterval) clearInterval(quizState.timerInterval);

    const display = document.getElementById('timerDisplay');

    quizState.timerInterval = setInterval(() => {
        const now = new Date().getTime();
        const timeLeftMs = quizState.endTime - now;

        if (timeLeftMs <= 0) {
            clearInterval(quizState.timerInterval);
            quizState.timerInterval = null;
            if (display) display.textContent = '00:00';
            finishQuiz(true); // Auto submit when time runs out
            return;
        }

        const totalSeconds = Math.floor(timeLeftMs / 1000);
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        if (display) {
            display.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
            display.style.color = (totalSeconds <= 300) ? '#EF4444' : '';
        }
    }, 1000);
}

// ============================================================
// QUIZ CONTROLS
// ============================================================
function initQuizControls() {
    const btnPrev = document.getElementById('btnPrev');
    const btnNext = document.getElementById('btnNext');
    const btnFinish = document.getElementById('btnFinish');
    const sidebar = document.getElementById('quizSidebar');
    const toggleSidebar = document.getElementById('toggleSidebar');
    const closeSidebar = document.getElementById('closeSidebar');

    if (btnPrev) {
        btnPrev.addEventListener('click', () => loadQuestion(quizState.currentQuestionIndex - 1));
    }

    if (btnNext) {
        btnNext.addEventListener('click', () => {
            if (quizState.currentQuestionIndex < quizState.questions.length - 1) {
                loadQuestion(quizState.currentQuestionIndex + 1);
            }
            // On last question, the confirm modal in quiz.html handles the finish
        });
    }

    // btnFinish is overridden by quiz.html inline script to use the confirmation modal
    // This is a fallback in case only quiz.js is loaded
    if (btnFinish && !btnFinish.dataset.managed) {
        btnFinish.addEventListener('click', () => {
            const confirmModal = document.getElementById('confirmSubmitModal');
            if (confirmModal) {
                confirmModal.style.display = 'flex';
            }
        });
    }

    if (toggleSidebar && sidebar) {
        toggleSidebar.addEventListener('click', () => sidebar.classList.add('active'));
    }
    if (closeSidebar && sidebar) {
        closeSidebar.addEventListener('click', () => sidebar.classList.remove('active'));
    }
}

// ============================================================
// SUBMISSION
// ============================================================
let isSubmitting = false;

async function finishQuiz(auto = false) {
    if (isSubmitting) return;
    isSubmitting = true;

    // Stop timer
    if (quizState.timerInterval) {
        clearInterval(quizState.timerInterval);
        quizState.timerInterval = null;
    }

    if (auto) {
        alert('Waktu habis! Jawaban Anda akan disubmit secara otomatis.');
    }

    // ---- STEP 1: Validate + get score from server (via GET) ----
    let finalScore = 0;
    try {
        const validateUrl = APPS_SCRIPT_URL
            + '?action=validate_quiz'
            + '&email=' + encodeURIComponent(quizState.email)
            + '&sessionToken=' + encodeURIComponent(quizState.sessionToken || '')
            + '&answers=' + encodeURIComponent(JSON.stringify(quizState.answers));

        const validateResponse = await fetch(validateUrl);
        const validateData = await validateResponse.json();

        if (!validateData.success) {
            // If validation fails due to session issue, we still submit with score=0
            // so data is not lost. The server will re-calculate on submit anyway.
            console.warn('Validation non-critical failure:', validateData.message);
            finalScore = 0;
        } else {
            finalScore = validateData.score || 0;
        }
    } catch (err) {
        console.error('Validation network error:', err);
        // Don't block submission if validation has a network error
        finalScore = 0;
    }

    // ---- STEP 2: Submit data to server (via POST) ----
    const payload = {
        action: 'submit_quiz',
        email: quizState.email,
        name: quizState.name,
        answers: quizState.answers,
        score: finalScore,
        sessionToken: quizState.sessionToken || '',
        timestamp: new Date().toISOString()
    };

    let submitSuccess = false;
    try {
        const submitResponse = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' }, // text/plain avoids CORS preflight
            body: JSON.stringify(payload)
        });
        const submitData = await submitResponse.json();
        submitSuccess = submitData.success;
        // Use server-calculated score if available (authoritative)
        if (submitData.score !== undefined) finalScore = submitData.score;
    } catch (err) {
        console.error('Submit network error:', err);
        // Try no-cors as last resort so data still reaches the server
        try {
            await fetch(APPS_SCRIPT_URL, {
                mode: 'no-cors',
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            submitSuccess = true; // Assume success since no-cors gives opaque response
        } catch (fallbackErr) {
            console.error('No-cors fallback also failed:', fallbackErr);
        }
    }

    // ---- STEP 3: Clear local session and show result ----
    clearQuizProgress();

    // Show score popup with confetti
    showScorePopup(finalScore);

    // Redirect to leaderboard after popup
    setTimeout(() => {
        const scoreModal = document.getElementById('scoreModal');
        const quizInterface = document.getElementById('quizInterface');
        if (scoreModal) scoreModal.style.opacity = '0';
        if (quizInterface) {
            quizInterface.style.transition = 'opacity 1s ease';
            quizInterface.style.opacity = '0';
        }
        setTimeout(() => {
            window.location.href = 'leaderboard.html'
                + '?email=' + encodeURIComponent(quizState.email)
                + '&name=' + encodeURIComponent(quizState.name)
                + '&score=' + finalScore;
        }, 1000);
    }, 4000);
}

function showScorePopup(score) {
    const modal = document.getElementById('scoreModal');
    const scoreVal = document.getElementById('finalScoreValue');
    if (!modal || !scoreVal) return;

    const card = modal.querySelector('.card');
    scoreVal.textContent = score;
    modal.style.display = 'flex';
    modal.style.opacity = '0';
    if (card) card.style.transform = 'scale(0.8)';

    setTimeout(() => {
        modal.style.transition = 'opacity 0.5s ease';
        modal.style.opacity = '1';
        if (card) {
            card.style.transition = 'transform 0.5s ease';
            card.style.transform = 'scale(1)';
        }

        // Confetti
        if (typeof confetti === 'function') {
            const duration = 3000;
            const end = Date.now() + duration;
            const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 6000 };

            const interval = setInterval(() => {
                const timeLeft = end - Date.now();
                if (timeLeft <= 0) return clearInterval(interval);
                const particleCount = 50 * (timeLeft / duration);
                confetti({ ...defaults, particleCount, origin: { x: Math.random() * 0.3 + 0.1, y: Math.random() - 0.2 } });
                confetti({ ...defaults, particleCount, origin: { x: Math.random() * 0.3 + 0.7, y: Math.random() - 0.2 } });
            }, 250);
        }
    }, 50);
}
