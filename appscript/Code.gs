/**
 * MERCY 2026 - GOOGLE APPS SCRIPT BACKEND (V7 - STABLE)
 * Admin: medtools.mercy@gmail.com
 */

// ============================================================
// ANSWER KEYS - Server-side only, never sent to client
// ============================================================
const ANSWER_KEYS = {
  "1":  "D", "2":  "C", "3":  "B", "4":  "B", "5":  "B",
  "6":  "D", "7":  "B", "8":  "B", "9":  "C", "10": "B",
  "11": "C", "12": "B", "13": "C", "14": "B", "15": "C",
  "16": "C", "17": "A", "18": "B", "19": "D", "20": "B",
  "21": "D", "22": "C", "23": "D", "24": "B", "25": "C",
  "26": "C", "27": "C", "28": "C", "29": "D", "30": "B",
  "31": "C", "32": "C", "33": "C", "34": "C", "35": "C",
  "36": "D", "37": "B", "38": "C", "39": "C", "40": "B",
  "41": "C", "42": "C", "43": "C", "44": "B", "45": "C",
  "46": "C", "47": "B", "48": "C", "49": "C", "50": "C"
};

const TOTAL_QUESTIONS = 50;
const SECRET_SALT = "MERCY_SECRET_SALT_2026";

// ============================================================
// ENTRY POINTS
// ============================================================

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(15000);
  try {
    var body = e.postData ? e.postData.contents : '{}';
    var params = JSON.parse(body);
    var action = params.action;
    if (params.email) params.email = params.email.toString().toLowerCase().trim();

    if (action === 'register')     return handleRegistration(params);
    if (action === 'submit_quiz')  return handleSubmitQuiz(params);

    return responseJSON({ success: false, message: 'Unknown action: ' + action });
  } catch (err) {
    logToSheet("doPost Error", err.toString());
    return responseJSON({ success: false, message: "Server error: " + err.toString() });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  try {
    var action = e.parameter.action || '';
    var email  = e.parameter.email
      ? e.parameter.email.toString().toLowerCase().trim()
      : '';

    if (action === 'check_email')   return handleCheckEmail(email);
    if (action === 'get_leaderboard') return handleGetLeaderboard();
    if (action === 'start_quiz')    return handleStartQuiz(email);
    if (action === 'validate_quiz') return handleValidateQuizGet(e.parameter);

    return responseJSON({ success: false, message: 'Unknown action: ' + action });
  } catch (err) {
    logToSheet("doGet Error", err.toString());
    return responseJSON({ success: false, message: "Server error: " + err.toString() });
  }
}

// ============================================================
// REGISTRATION
// ============================================================

function handleRegistration(data) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getOrCreateSheet(ss, 'Registrations');

    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['Timestamp','Nama','Email','Institusi','Instagram','Semester','WhatsApp']);
    }

    var email = (data.email || '').toLowerCase().trim();
    if (!email) return responseJSON({ success: false, message: 'Email kosong.' });

    // Duplicate check
    var lastRow = sheet.getLastRow();
    if (lastRow >= 2) {
      var existing = sheet.getRange(2, 3, lastRow - 1, 1).getValues().flat();
      for (var k = 0; k < existing.length; k++) {
        if (existing[k].toString().toLowerCase().trim() === email) {
          return responseJSON({ success: false, message: 'Email sudah terdaftar.' });
        }
      }
    }

    sheet.appendRow([
      new Date(), data.nama, email,
      data.institusi, data.instagram, data.semester, data.whatsapp
    ]);

    try { sendEmailConfirmation(data); } catch(f) { logToSheet("Email Confirmation", f.toString()); }
    try { sendAdminNotification(data); } catch(f) { logToSheet("Admin Notification", f.toString()); }

    return responseJSON({ success: true, message: 'Pendaftaran berhasil.' });
  } catch (err) {
    logToSheet("handleRegistration Error", err.toString());
    return responseJSON({ success: false, message: 'Gagal mendaftar: ' + err.toString() });
  }
}

// ============================================================
// CHECK EMAIL (GET)
// ============================================================

/**
 * Returns { exists: bool, submitted: bool }
 * Works both as a doGet handler AND as an internal helper.
 * When called internally, returns the plain object (not a TextOutput).
 */
function handleCheckEmail(email) {
  try {
    var result = { exists: false, submitted: false };
    if (!email) return responseJSON(result);

    email = email.toLowerCase().trim();
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // Check Registrations sheet
    var regSheet = ss.getSheetByName('Registrations');
    if (regSheet && regSheet.getLastRow() >= 2) {
      var regRows = regSheet.getRange(2, 3, regSheet.getLastRow() - 1, 1).getValues().flat();
      for (var i = 0; i < regRows.length; i++) {
        if (regRows[i].toString().toLowerCase().trim() === email) {
          result.exists = true;
          break;
        }
      }
    }

    // Check QuizSubmissions sheet
    var quizSheet = ss.getSheetByName('QuizSubmissions');
    if (quizSheet && quizSheet.getLastRow() >= 2) {
      var quizRows = quizSheet.getRange(2, 2, quizSheet.getLastRow() - 1, 1).getValues().flat();
      for (var j = 0; j < quizRows.length; j++) {
        if (quizRows[j].toString().toLowerCase().trim() === email) {
          result.submitted = true;
          break;
        }
      }
    }

    return responseJSON(result);
  } catch (err) {
    logToSheet("handleCheckEmail Error", err.toString());
    return responseJSON({ exists: false, submitted: false, error: err.toString() });
  }
}

// Internal helper - returns plain object (not ContentService output)
function checkEmailInternal(email) {
  var result = { exists: false, submitted: false };
  if (!email) return result;
  email = email.toLowerCase().trim();

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var regSheet = ss.getSheetByName('Registrations');
    if (regSheet && regSheet.getLastRow() >= 2) {
      var regRows = regSheet.getRange(2, 3, regSheet.getLastRow() - 1, 1).getValues().flat();
      for (var i = 0; i < regRows.length; i++) {
        if (regRows[i].toString().toLowerCase().trim() === email) {
          result.exists = true;
          break;
        }
      }
    }
    var quizSheet = ss.getSheetByName('QuizSubmissions');
    if (quizSheet && quizSheet.getLastRow() >= 2) {
      var quizRows = quizSheet.getRange(2, 2, quizSheet.getLastRow() - 1, 1).getValues().flat();
      for (var j = 0; j < quizRows.length; j++) {
        if (quizRows[j].toString().toLowerCase().trim() === email) {
          result.submitted = true;
          break;
        }
      }
    }
  } catch (err) {
    logToSheet("checkEmailInternal Error", err.toString());
  }
  return result;
}

// ============================================================
// START QUIZ (GET) - issues session token
// ============================================================

function handleStartQuiz(email) {
  if (!email) return responseJSON({ success: false, message: 'Email wajib diisi.' });
  email = email.toLowerCase().trim();

  // Admin bypass
  if (email === 'medtools.mercy@gmail.com') {
    var token = generateStatelessToken(email);
    return responseJSON({ success: true, sessionToken: token });
  }

  var status = checkEmailInternal(email);

  if (!status.exists) {
    return responseJSON({ success: false, message: 'Email belum terdaftar di sistem Mercy. Silakan daftar terlebih dahulu.' });
  }
  if (status.submitted) {
    return responseJSON({ success: false, message: 'Peserta ini sudah pernah mensubmit kuis. Setiap peserta hanya diperbolehkan 1 kali submit.' });
  }

  var sessionToken = generateStatelessToken(email);
  try {
    var cache = CacheService.getScriptCache();
    cache.put('session_' + email, sessionToken, 21600); // 6 hours
  } catch (ce) {
    logToSheet("Cache Write Error", ce.toString());
  }

  return responseJSON({ success: true, sessionToken: sessionToken });
}

// ============================================================
// VALIDATE QUIZ (GET) - calculates score from answers
// ============================================================

function handleValidateQuizGet(params) {
  try {
    var email = params.email ? params.email.toLowerCase().trim() : '';
    var answers = {};
    var sessionToken = params.sessionToken || '';

    if (!email) return responseJSON({ success: false, message: 'Email tidak ditemukan.' });

    try {
      answers = JSON.parse(decodeURIComponent(params.answers || '{}'));
    } catch (parseErr) {
      return responseJSON({ success: false, message: 'Format jawaban tidak valid.' });
    }

    // Validate token - but be lenient: if email exists + not submitted, proceed
    var tokenValid = validateSessionToken(email, sessionToken);
    if (!tokenValid) {
      if (email === 'medtools.mercy@gmail.com') {
        tokenValid = true; // Admin bypass
      } else {
        var status = checkEmailInternal(email);
        if (status.exists && !status.submitted) {
          tokenValid = true; // Graceful fallback for registered users
          logToSheet("Token Bypass", "Validate fallback for: " + email);
        }
      }
    }

    if (!tokenValid) {
      return responseJSON({ success: false, message: 'Sesi tidak valid atau sudah kadaluarsa. Silakan login kembali.' });
    }

    var score = calculateScore(answers);
    return responseJSON({ success: true, score: score });
  } catch (err) {
    logToSheet("handleValidateQuizGet Error", err.toString());
    return responseJSON({ success: false, message: 'Gagal memvalidasi: ' + err.toString() });
  }
}

// ============================================================
// SUBMIT QUIZ (POST)
// ============================================================

function handleSubmitQuiz(data) {
  var lock = LockService.getScriptLock();
  lock.tryLock(20000);
  try {
    var email = (data.email || '').toLowerCase().trim();
    if (!email) return responseJSON({ success: false, message: 'Email tidak ditemukan dalam data.' });

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet   = getOrCreateSheet(ss, 'QuizSubmissions');
    var lbSheet = getOrCreateSheet(ss, 'Leaderboard');

    // Create headers if needed
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['Timestamp','Email','Answers','Score','TimeSpent','Name']);
    }
    if (lbSheet.getLastRow() === 0) {
      lbSheet.appendRow(['Name','Score','Timestamp','TimeSpent','Email']);
    }

    // --- Prevent duplicate submissions ---
    var status = checkEmailInternal(email);
    if (status.submitted && email !== 'medtools.mercy@gmail.com') {
      return responseJSON({ success: false, message: 'Email ini sudah pernah mensubmit kuis.' });
    }

    // --- Token validation (lenient for registered users) ---
    var tokenValid = validateSessionToken(email, data.sessionToken || '');
    if (!tokenValid && email !== 'medtools.mercy@gmail.com') {
      if (status.exists && !status.submitted) {
        logToSheet("Submit Token Bypass", email);
      } else {
        return responseJSON({ success: false, message: 'Sesi tidak valid. Silakan login kembali.' });
      }
    }

    // --- Always recalculate score on server ---
    var answers = data.answers || {};
    if (typeof answers === 'string') {
      try { answers = JSON.parse(answers); } catch(e) { answers = {}; }
    }

    var finalScore = calculateScore(answers);
    var timestamp  = new Date();

    // Write to QuizSubmissions
    sheet.appendRow([
      timestamp,
      email,
      JSON.stringify(answers),
      finalScore,
      data.timeSpent || 0,
      data.name || 'Peserta'
    ]);

    // Write to Leaderboard
    lbSheet.appendRow([
      data.name || 'Peserta',
      finalScore,
      timestamp.toISOString(),
      data.timeSpent || 0,
      email
    ]);

    // Invalidate cache token
    invalidateSessionToken(email);

    return responseJSON({
      success: true,
      score: finalScore,
      message: 'Submit berhasil!'
    });

  } catch (err) {
    logToSheet("handleSubmitQuiz Error", err.toString());
    return responseJSON({ success: false, message: 'Gagal menyimpan hasil: ' + err.toString() });
  } finally {
    lock.releaseLock();
  }
}

// ============================================================
// LEADERBOARD (GET)
// ============================================================

function handleGetLeaderboard() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Leaderboard');
    if (!sheet || sheet.getLastRow() < 2) return responseJSON([]);

    var rows = sheet.getLastRow() - 1;
    var data = sheet.getRange(2, 1, rows, 5).getValues();

    var leaderboard = data.map(function(row) {
      return {
        name:      row[0] || 'Peserta',
        score:     parseFloat(row[1]) || 0,
        time:      row[2] || '',
        timeSpent: parseFloat(row[3]) || 999999,
        email:     (row[4] || '').toString().toLowerCase().trim()
      };
    });

    leaderboard.sort(function(a, b) {
      if (b.score !== a.score) return b.score - a.score;
      if (a.timeSpent !== b.timeSpent) return a.timeSpent - b.timeSpent;
      return new Date(a.time) - new Date(b.time);
    });

    return responseJSON(leaderboard);
  } catch (err) {
    logToSheet("handleGetLeaderboard Error", err.toString());
    return responseJSON([]);
  }
}

// ============================================================
// TOKEN HELPERS
// ============================================================

function generateStatelessToken(email) {
  var raw = email.toLowerCase().trim() + SECRET_SALT;
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw);
  return bytes.map(function(b) {
    return (b < 0 ? b + 256 : b).toString(16).padStart(2, '0');
  }).join('');
}

function validateSessionToken(email, token) {
  if (!email || !token) return false;
  email = email.toLowerCase().trim();

  // Check stateless token first (always works, no cache needed)
  if (token === generateStatelessToken(email)) return true;

  // Check cache (backward compat)
  try {
    var cache = CacheService.getScriptCache();
    var cached = cache.get('session_' + email);
    if (cached && cached === token) return true;
  } catch(e) {}

  return false;
}

function invalidateSessionToken(email) {
  try {
    var cache = CacheService.getScriptCache();
    cache.remove('session_' + email.toLowerCase().trim());
  } catch(e) {}
}

// ============================================================
// SCORE CALCULATION
// ============================================================

function calculateScore(answers) {
  if (!answers || typeof answers !== 'object') return 0;
  var correct = 0;
  for (var qid in ANSWER_KEYS) {
    if (String(answers[qid]) === String(ANSWER_KEYS[qid])) {
      correct++;
    }
  }
  return correct * 4;
}

// ============================================================
// UTILITY
// ============================================================

function getOrCreateSheet(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  return sheet;
}

function logToSheet(type, message) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getOrCreateSheet(ss, 'SystemLogs');
    sheet.appendRow([new Date(), type, message]);
  } catch(e) {}
}

function responseJSON(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// EMAIL FUNCTIONS
// ============================================================

function sendEmailConfirmation(data) {
  if (!data || !data.email) return;
  var htmlBody = getEmailTemplate()
    .replace(/{{nama}}/g,      data.nama      || '')
    .replace(/{{email}}/g,     data.email     || '')
    .replace(/{{institusi}}/g, data.institusi || '')
    .replace(/{{semester}}/g,  data.semester  || '')
    .replace(/{{whatsapp}}/g,  data.whatsapp  || '');

  MailApp.sendEmail({
    to: data.email,
    subject: 'Pendaftaran INC 2026 BERHASIL! 🎉',
    htmlBody: htmlBody
  });
}

function getEmailTemplate() {
  return '<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>body{font-family:Poppins,Arial,sans-serif;background:#F8F9FA;margin:0;padding:20px}.wrap{max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden}.head{background:linear-gradient(135deg,#193c76,#3B82F6);padding:40px 20px;text-align:center;color:#fff}.head h1{margin:0 0 8px;font-size:24px;font-weight:800}.head p{margin:0;opacity:.9}.body{padding:40px 30px;color:#6B7280}.info-box{background:#F0F9FF;border:1px solid #DBEAFE;border-radius:12px;padding:25px;margin:24px 0}.row{margin-bottom:14px;border-bottom:1px solid #DBEAFE;padding-bottom:10px}.row:last-child{border-bottom:none;margin-bottom:0}.label{display:block;font-weight:600;color:#1E3A8A;font-size:12px;text-transform:uppercase;margin-bottom:4px}.value{color:#374151;font-size:15px}.warn{background:#EFF6FF;border-left:4px solid #3B82F6;padding:18px;border-radius:8px;margin:24px 0;color:#1E3A8A}.cta{text-align:center;margin-top:30px}.btn{display:inline-block;padding:13px 26px;border-radius:8px;font-weight:600;text-decoration:none;margin:6px 4px;font-size:15px;color:#fff}.btn-blue{background:linear-gradient(135deg,#193c76,#3B82F6)}.btn-green{background:#25D366}.foot{background:#F8F9FA;padding:24px;text-align:center;font-size:13px;color:#9CA3AF}</style></head><body><div class="wrap"><div class="head"><h1>KONFIRMASI PENDAFTARAN</h1><p>Iseng Ngetest Competition (INC) Mercy 2026</p></div><div class="body"><p style="font-size:18px;color:#1E3A8A;font-weight:600">Halo, {{nama}}!</p><p>Selamat! Pendaftaran kamu untuk <strong>INC Mercy 2026</strong> telah berhasil.</p><div class="info-box"><div class="row"><span class="label">Nama Lengkap</span><span class="value">{{nama}}</span></div><div class="row"><span class="label">Email (untuk login)</span><span class="value">{{email}}</span></div><div class="row"><span class="label">Universitas</span><span class="value">{{institusi}}</span></div><div class="row"><span class="label">Semester</span><span class="value">{{semester}}</span></div><div class="row"><span class="label">WhatsApp</span><span class="value">{{whatsapp}}</span></div></div><div class="warn"><strong>⚠️ PENTING:</strong> Gunakan email <strong>{{email}}</strong> untuk masuk ke Portal INC. Jangan bagikan ke orang lain.</div><div class="cta"><a href="https://mercy-ashen.vercel.app/quiz.html" class="btn btn-blue">MASUK KE PORTAL INC</a><a href="https://chat.whatsapp.com/F4yp7SWVeoeEFv3UDYAtty" class="btn btn-green">JOIN GRUP WHATSAPP</a></div><p style="margin-top:36px;font-size:16px;font-weight:600;color:#1E3A8A;text-align:center">Sampai Jumpa, {{nama}}!</p><p style="color:#6B7280;font-size:14px">Best Regards,<br><strong style="color:#1E3A8A">Gilang – Mercy Project Director</strong></p></div><div class="foot">&copy; 2026 Medtools Academy. All Rights Reserved.</div></div></body></html>';
}

function sendAdminNotification(data) {
  if (!data || !data.nama) return;
  MailApp.sendEmail(
    'medtools.mercy@gmail.com',
    '[NEW REGISTRATION] INC Mercy 2026',
    'Peserta Baru:\n\nNama: '     + data.nama +
    '\nEmail: '    + data.email +
    '\nKampus: '   + data.institusi +
    '\nInstagram: ' + data.instagram +
    '\nSemester: ' + data.semester +
    '\nWA: '       + data.whatsapp
  );
}

// ============================================================
// TEST FUNCTION (Run manually in Apps Script Editor)
// ============================================================
function testSystem() {
  var dummy = {
    nama: 'Gilang (Test)', email: 'medtools.mercy@gmail.com',
    institusi: 'Universitas Medtools', instagram: 'medtools.id',
    semester: '5', whatsapp: '08123456789'
  };
  try {
    sendAdminNotification(dummy);
    sendEmailConfirmation(dummy);
    Logger.log('Test selesai. Cek inbox.');
  } catch(e) {
    Logger.log('Error: ' + e.toString());
  }
}
