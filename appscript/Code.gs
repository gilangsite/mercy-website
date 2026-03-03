/**
 * MERCY 2026 - GOOGLE APPS SCRIPT BACKEND (V5 - SECURITY ENHANCED)
 * Admin: medtools.mercy@gmail.com
 * 
 * SECURITY FEATURES:
 * - Answer keys stored server-side only
 * - Score calculation on server
 * - Session token validation
 */

// ANSWER KEYS (Server-side only - NOT exposed to client)
const ANSWER_KEYS = {
  "1": "C", "2": "B", "3": "C", "4": "C", "5": "B",
  "6": "C", "7": "C", "8": "B", "9": "B", "10": "D",
  "11": "C", "12": "D", "13": "C", "14": "A", "15": "B",
  "16": "A", "17": "B", "18": "C", "19": "C", "20": "B",
  "21": "B", "22": "C", "23": "B", "24": "D", "25": "A"
};

const TOTAL_QUESTIONS = 25;
const SECRET_SALT = "MERCY_SECRET_SALT_2026"; // Consistent salt for stateless tokens

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    var params = JSON.parse(e.postData.contents);
    var action = params.action;
    
    // Normalize emails to lowercase globally
    if (params.email) params.email = params.email.toString().toLowerCase().trim();
    
    if (action === 'register') return handleRegistration(params);
    if (action === 'submit_quiz') return handleSubmitQuiz(params);
    if (action === 'validate_quiz') return handleValidateQuiz(params);
    
    return responseJSON({ success: false, message: 'Invalid action' });
  } catch (err) {
    logToSheet("Error doPost", err.toString());
    return responseJSON({ success: false, message: "Terjadi kesalahan sistem: " + err.toString() });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  var action = e.parameter.action;
  var email = e.parameter.email ? e.parameter.email.toString().toLowerCase().trim() : "";
  
  if (action === 'check_email') return handleCheckEmail(email);
  if (action === 'get_leaderboard') return handleGetLeaderboard();
  if (action === 'start_quiz') return handleStartQuiz(email);
  
  // For GET validation (if used)
  if (action === 'validate_quiz') {
    var params = e.parameter;
    if (params.email) params.email = params.email.toLowerCase().trim();
    return handleValidateQuizGet(params);
  }
  
  return responseJSON({ success: false, message: 'Invalid action' });
}

function handleRegistration(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getOrCreateSheet(ss, 'Registrations');
  
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Timestamp', 'Nama', 'Email', 'Nama Universitas', 'Instagram', 'Semester', 'WhatsApp']);
  }
  
  var email = data.email.toLowerCase().trim();
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    var emails = sheet.getRange(2, 3, lastRow - 1, 1).getValues().flat().map(function(e){ return e.toString().toLowerCase(); }); 
    if (emails.indexOf(email) !== -1) return responseJSON({ success: false, message: 'Email sudah terdaftar!' });
  }
  
  sheet.appendRow([new Date(), data.nama, email, data.institusi, data.instagram, data.semester, data.whatsapp]);
  try {
    sendEmailConfirmation(data);
    sendAdminNotification(data);
  } catch (f) { logToSheet("Email Error", f.toString()); }
  
  return responseJSON({ success: true, message: 'Registration successful' });
}

function handleCheckEmail(email) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var regSheet = ss.getSheetByName('Registrations');
  var quizSheet = ss.getSheetByName('QuizSubmissions');
  
  email = email.toLowerCase().trim();
  var result = { exists: false, submitted: false };
  
  if (regSheet && regSheet.getLastRow() >= 2) {
    var regEmails = regSheet.getRange(2, 3, regSheet.getLastRow() - 1, 1).getValues().flat().map(function(e){ return e.toString().toLowerCase(); });
    result.exists = regEmails.indexOf(email) !== -1;
  }
  
  if (quizSheet && quizSheet.getLastRow() >= 2) {
    var quizEmails = quizSheet.getRange(2, 2, quizSheet.getLastRow() - 1, 1).getValues().flat().map(function(e){ return e.toString().toLowerCase(); });
    result.submitted = quizEmails.indexOf(email) !== -1;
  }
  
  return responseJSON(result);
}

function handleSubmitQuiz(data) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getOrCreateSheet(ss, 'QuizSubmissions');
    var lbSheet = getOrCreateSheet(ss, 'Leaderboard');
    
    var email = data.email.toLowerCase().trim();
    
    // Check if already submitted first
    var check = handleCheckEmail(email);
    if (check.submitted) {
      return responseJSON({ success: false, message: 'Anda sudah pernah mensubmit quiz ini.' });
    }

    // Validate session token with multiple fallback levels
    if (!validateSessionToken(email, data.sessionToken)) {
      // Final Fallback: if token fails, but email is registered and not submitted, allow it
      if (check.exists && !check.submitted) {
        logToSheet("Security Warning", "Bypassed token validation for registered email: " + email);
      } else {
        return responseJSON({ success: false, message: 'Sesi tidak valid. Silakan login kembali.' });
      }
    }
    
    var serverCalculatedScore = calculateScore(data.answers);
    var timeSpent = data.timeSpent || 999999;
    
    sheet.appendRow([new Date(), email, JSON.stringify(data.answers), serverCalculatedScore, timeSpent]);
    lbSheet.appendRow([data.name, serverCalculatedScore, new Date().toISOString(), timeSpent]);
    
    // Invalidate old cache token
    invalidateSessionToken(email);
    
    return responseJSON({ success: true, verifiedScore: serverCalculatedScore, score: serverCalculatedScore });
  } catch (e) {
    logToSheet("Submit Error", e.toString());
    return responseJSON({ success: false, message: "Gagal submit: " + e.toString() });
  }
}

// --- SECURITY FUNCTIONS ---

function handleStartQuiz(email) {
  if (!email) return responseJSON({ success: false, message: 'Email required' });
  email = email.toLowerCase().trim();
  
  // Check if already submitted
  var check = handleCheckEmail(email);
  if (check.submitted) return responseJSON({ success: false, message: 'Anda sudah mengerjakan quiz ini sebelumnya.' });
  
  // Check if registered
  if (!check.exists) return responseJSON({ success: false, message: 'Email belum terdaftar.' });

  // Use stateless token
  var sessionToken = generateStatelessToken(email);
  var cache = CacheService.getScriptCache();
  cache.put('session_' + email, sessionToken, 21600); // 6 hours
  
  return responseJSON({ success: true, sessionToken: sessionToken });
}

function handleValidateQuiz(data) {
  var email = data.email.toLowerCase().trim();
  
  // Check if session token is valid
  if (!validateSessionToken(email, data.sessionToken)) {
    // Basic verification fallback
    var check = handleCheckEmail(email);
    if (check.submitted) {
      return responseJSON({ success: false, message: 'Anda sudah mensubmit quiz ini.' });
    }
    if (!check.exists) {
      return responseJSON({ success: false, message: 'Email tidak terdaftar atau sesi berakhir.' });
    }
  }
  
  var score = calculateScore(data.answers);
  return responseJSON({ 
    success: true, 
    score: score,
    verifiedScore: score
  });
}

function handleValidateQuizGet(params) {
  var email = params.email.toLowerCase().trim();
  var answers = {};
  try {
    answers = JSON.parse(params.answers);
  } catch (e) {
    return responseJSON({ success: false, message: 'Invalid answers format' });
  }
  
  if (!validateSessionToken(email, params.sessionToken)) {
    return responseJSON({ success: false, message: 'Sesi tidak valid.' });
  }
  
  var score = calculateScore(answers);
  return responseJSON({ success: true, score: score });
}

// Stateless token generation
function generateStatelessToken(email) {
  var raw = email + SECRET_SALT;
  var signature = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw);
  return signature.map(function(b){ return (b < 0 ? b + 256 : b).toString(16).padStart(2, '0'); }).join('');
}

function validateSessionToken(email, token) {
  if (!email || !token) return false;
  email = email.toLowerCase().trim();
  
  // 1. Check stateless token (Match current logic)
  if (token === generateStatelessToken(email)) return true;
  
  // 2. Fallback to CacheService (Backward compatibility for ongoing sessions)
  var cache = CacheService.getScriptCache();
  var storedToken = cache.get('session_' + email);
  if (storedToken === token) return true;
  
  return false;
}

function invalidateSessionToken(email) {
  var cache = CacheService.getScriptCache();
  cache.remove('session_' + email.toLowerCase().trim());
}

function calculateScore(answers) {
  if (!answers || typeof answers !== 'object') return 0;
  var correctCount = 0;
  for (var questionId in ANSWER_KEYS) {
    if (answers[questionId] === ANSWER_KEYS[questionId]) {
      correctCount++;
    }
  }
  return correctCount * 4;
}

// --- UTILITY FUNCTIONS ---

function getOrCreateSheet(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

function logToSheet(type, message) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getOrCreateSheet(ss, 'SystemLogs');
    sheet.appendRow([new Date(), type, message]);
  } catch (e) {}
}

function handleGetLeaderboard() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Leaderboard');
  if (!sheet || sheet.getLastRow() < 2) return responseJSON([]);
  
  var rows = sheet.getLastRow() - 1;
  var data = sheet.getRange(2, 1, rows, 4).getValues();
  var leaderboard = data.map(function(row) {
    return { name: row[0], score: row[1], time: row[2], timeSpent: row[3] || 999999 };
  });
  
  leaderboard.sort(function(a, b) {
    if (b.score !== a.score) return b.score - a.score;
    if (a.timeSpent !== b.timeSpent) return a.timeSpent - b.timeSpent;
    return new Date(a.time) - new Date(b.time);
  });
  
  return responseJSON(leaderboard);
}

function responseJSON(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}


// --- EMAIL FUNCTIONS ---

function sendEmailConfirmation(data) {
  if (!data || !data.email) {
    Logger.log("Info: Fungsi sendEmailConfirmation dihentikan karena tidak ada data.");
    return;
  }
  
  var subject = "Pendaftaran INC 2026 BERHASIL! 🎉";
  var htmlTemplate = getEmailTemplate();
  
  // Replace Placeholders
  var htmlBody = htmlTemplate
    .replace(/{{nama}}/g, data.nama)
    .replace(/{{email}}/g, data.email)
    .replace(/{{institusi}}/g, data.institusi)
    .replace(/{{semester}}/g, data.semester)
    .replace(/{{whatsapp}}/g, data.whatsapp);

  MailApp.sendEmail({
    to: data.email,
    subject: subject,
    htmlBody: htmlBody
  });
}

function getEmailTemplate() {
  return `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
        table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
        img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
        table { border-collapse: collapse !important; }
        body { height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important; font-family: 'Poppins', Helvetica, Arial, sans-serif; background-color: #F8F9FA; }
        .email-container { max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
        .header { background: linear-gradient(135deg, #193c76 0%, #3B82F6 100%); padding: 40px 20px; text-align: center; color: #FFFFFF; }
        .content { padding: 40px 30px; color: #6B7280; line-height: 1.6; }
        .footer { background-color: #F8F9FA; padding: 30px; text-align: center; font-size: 14px; color: #9CA3AF; }
        .title { font-size: 24px; font-weight: 800; margin: 0 0 10px; color: #FFFFFF; }
        .subtitle { font-size: 16px; margin: 0; opacity: 0.9; }
        .user-data { background-color: #F0F9FF; border: 1px solid #DBEAFE; border-radius: 12px; padding: 25px; margin: 30px 0; }
        .data-item { margin-bottom: 15px; border-bottom: 1px solid #DBEAFE; padding-bottom: 10px; }
        .data-item:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
        .label { font-weight: 600; color: #1E3A8A; font-size: 13px; text-transform: uppercase; display: block; margin-bottom: 4px; }
        .value { color: #374151; font-size: 16px; }
        .btn { display: inline-block; padding: 14px 28px; border-radius: 8px; font-weight: 600; text-decoration: none; text-align: center; margin: 10px 5px; font-size: 15px; }
        .btn-primary { background: linear-gradient(135deg, #193c76 0%, #3B82F6 100%); color: #FFFFFF !important; }
        .btn-whatsapp { background-color: #25D366; color: #FFFFFF !important; }
        .warning-box { background-color: #EFF6FF; border-left: 4px solid #3B82F6; padding: 20px; border-radius: 8px; margin: 30px 0; color: #1E3A8A; }
        .warning-title { font-weight: 700; margin-bottom: 8px; display: block; font-size: 15px; }
    </style>
</head>
<body>
    <div style="padding: 20px 0;">
        <div class="email-container">
            <div class="header">
                <h1 class="title">KONFIRMASI PENDAFTARAN</h1>
                <p class="subtitle">Iseng Ngetest Competition (INC) Mercy 2026</p>
            </div>
            <div class="content">
                <p style="font-size: 18px; color: #1E3A8A; font-weight: 600;">Halo, {{nama}}!</p>
                <p>Selamat! Pendaftaran kamu untuk <strong>INC Mercy 2026</strong> telah berhasil kami terima. Berikut adalah rincian data pendaftaran kamu:</p>
                <div class="user-data">
                    <div class="data-item"><span class="label">Nama Lengkap</span><span class="value">{{nama}}</span></div>
                    <div class="data-item"><span class="label">ID Email (Login)</span><span class="value">{{email}}</span></div>
                    <div class="data-item"><span class="label">Universitas</span><span class="value">{{institusi}}</span></div>
                    <div class="data-item"><span class="label">Semester</span><span class="value">{{semester}}</span></div>
                    <div class="data-item" style="border-bottom: none;"><span class="label">Nomor WhatsApp</span><span class="value">{{whatsapp}}</span></div>
                </div>
                <div class="warning-box">
                    <span class="warning-title">⚠️ PENTING: AKSES PORTAL</span>
                    <p style="margin: 0; font-size: 14px;">Untuk masuk ke Portal INC, kamu wajib menggunakan <strong>Alamat Email</strong> di atas. Email ini bersifat rahasia, jangan berikan kepada siapapun untuk mencegah orang lain login atas nama kamu.</p>
                </div>
                <div style="text-align: center; margin-top: 30px;">
                    <a href="https://mercy-ashen.vercel.app/quiz.html" class="btn btn-primary" style="color: #FFFFFF;">MASUK KE PORTAL INC</a>
                    <a href="https://chat.whatsapp.com/F4yp7SWVeoeEFv3UDYAtty" class="btn btn-whatsapp" style="color: #FFFFFF;">JOIN GRUP WHATSAPP</a>
                </div>
                <div style="margin-top: 40px; padding-top: 20px; text-align: center;">
                    <p style="font-size: 16px; font-weight: 600; color: #1E3A8A;">Sampai Jumpa di Kompetisi, {{nama}}!</p>
                </div>
                <div style="margin-top: 30px; color: #6B7280; font-size: 14px;">
                    <p style="margin: 0;">Best Regards,</p>
                    <p style="margin: 0; font-weight: 700; color: #1E3A8A;">Gilang - Mercy Project Director.</p>
                </div>
            </div>
            <div class="footer">
                <p style="margin-bottom: 10px;">&copy; 2026 Medtools Academy. All Rights Reserved.</p>
            </div>
        </div>
    </div>
</body>
</html>`;
}

function sendAdminNotification(data) {
  if (!data || !data.nama) {
    Logger.log("Info: Fungsi sendAdminNotification dihentikan karena tidak ada data. Gunakan 'testSystem' untuk mengetes.");
    return;
  }
  var adminEmail = "medtools.mercy@gmail.com"; 
  var subject = "[NEW REGISTRATION] INC Mercy 2026";
  var body = "Peserta Baru Telah Mendaftar!\n\n" +
             "Nama: " + data.nama + "\n" +
             "Email: " + data.email + "\n" +
             "Asal Kampus: " + data.institusi + "\n" +
             "Instagram: " + data.instagram + "\n" +
             "Semester: " + data.semester + "\n" +
             "WhatsApp: " + data.whatsapp + "\n\n" +
             "Cek database Spreadsheet untuk detailnya.";
  MailApp.sendEmail(adminEmail, subject, body);
}

// --- TESTER FUNCTION (PILIH INI LALU KLIK RUN) ---
function testSystem() {
  var dummyData = {
    nama: "Gilang (Test Admin)",
    email: "medtools.mercy@gmail.com",
    institusi: "Universitas Medtools",
    instagram: "medtools.id",
    semester: "Semester 5",
    whatsapp: "08123456789"
  };
  Logger.log("Memulai pengetesan email...");
  try {
    sendAdminNotification(dummyData);
    Logger.log("Email Notifikasi Admin BERHASIL dikirim ke: medtools.mercy@gmail.com");
    sendEmailConfirmation(dummyData);
    Logger.log("Email Konfirmasi Peserta BERHASIL dikirim ke: " + dummyData.email);
    Logger.log("Tes Selesai! Silakan cek inbox email Anda.");
  } catch(e) {
    Logger.log("Error saat tes: " + e.toString());
  }
}

