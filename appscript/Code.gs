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
  "1": "C", "2": "B", "3": "D", "4": "C", "5": "C",
  "6": "C", "7": "B", "8": "C", "9": "B", "10": "B",
  "11": "C", "12": "C", "13": "C", "14": "C", "15": "C",
  "16": "B", "17": "B", "18": "C", "19": "C", "20": "B",
  "21": "B", "22": "C", "23": "C", "24": "A", "25": "B",
  "26": "D", "27": "C", "28": "C", "29": "C", "30": "B"
};

const TOTAL_QUESTIONS = 30;
const SESSION_EXPIRY_SECONDS = 3600 * 6; // 6 hours


function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    var params = JSON.parse(e.postData.contents);
    var action = params.action;
    if (action === 'register') return handleRegistration(params);
    if (action === 'submit_quiz') return handleSubmitQuiz(params);
    if (action === 'validate_quiz') return handleValidateQuiz(params);
    return responseJSON({result: 'error', message: 'Invalid action'});
  } catch (err) {
    return responseJSON({result: 'error', message: err.toString()});
  } finally {
    lock.releaseLock();
  }
}



function doGet(e) {
  var action = e.parameter.action;
  if (action === 'check_email') return handleCheckEmail(e.parameter.email);
  if (action === 'get_leaderboard') return handleGetLeaderboard();
  if (action === 'start_quiz') return handleStartQuiz(e.parameter.email);
  if (action === 'validate_quiz') return handleValidateQuizGet(e.parameter);
  return responseJSON({result: 'error', message: 'Invalid action'});
}

function handleRegistration(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Registrations');
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Timestamp', 'Nama', 'Email', 'Nama Universitas', 'Instagram', 'Semester', 'WhatsApp']);
  }
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    var emails = sheet.getRange(2, 3, lastRow - 1, 1).getValues().flat(); 
    if (emails.indexOf(data.email) !== -1) return responseJSON({ success: false, message: 'Email sudah terdaftar!' });
  }
  sheet.appendRow([new Date(), data.nama, data.email, data.institusi, data.instagram, data.semester, data.whatsapp]);
  try {
    sendEmailConfirmation(data);
    sendAdminNotification(data);
  } catch (f) { Logger.log("Email error: " + f.toString()); }
  return responseJSON({ success: true, message: 'Registration successful' });
}

function handleCheckEmail(email) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var regSheet = ss.getSheetByName('Registrations');
  var quizSheet = ss.getSheetByName('QuizSubmissions');
  
  var result = { exists: false, submitted: false };
  
  if (regSheet && regSheet.getLastRow() >= 2) {
    var regEmails = regSheet.getRange(2, 3, regSheet.getLastRow() - 1, 1).getValues().flat();
    result.exists = regEmails.indexOf(email) !== -1;
  }
  
  if (quizSheet && quizSheet.getLastRow() >= 2) {
    var quizEmails = quizSheet.getRange(2, 2, quizSheet.getLastRow() - 1, 1).getValues().flat();
    result.submitted = quizEmails.indexOf(email) !== -1;
  }
  
  return responseJSON(result);
}


function handleSubmitQuiz(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('QuizSubmissions');
  var lbSheet = ss.getSheetByName('Leaderboard');
  
  // Validate session token
  if (!validateSessionToken(data.email, data.sessionToken)) {
    return responseJSON({ success: false, message: 'Invalid session token' });
  }
  
  // SECURITY FIX: Re-calculate score on server, ignore client-provided score
  var serverCalculatedScore = calculateScore(data.answers);
  
  // Use serverCalculatedScore for spreadsheet and leaderboard
  sheet.appendRow([new Date(), data.email, JSON.stringify(data.answers), serverCalculatedScore]);
  lbSheet.appendRow([data.name, serverCalculatedScore, data.timestamp]);
  
  // Invalidate session token after submission
  invalidateSessionToken(data.email);
  
  return responseJSON({ success: true, verifiedScore: serverCalculatedScore });
}

// --- SECURITY FUNCTIONS ---

function handleStartQuiz(email) {
  if (!email) return responseJSON({ success: false, message: 'Email required' });
  
  var sessionToken = generateSessionToken(email);
  return responseJSON({ success: true, sessionToken: sessionToken });
}

function handleValidateQuiz(data) {
  // Validate session token
  if (!validateSessionToken(data.email, data.sessionToken)) {
    return responseJSON({ success: false, message: 'Invalid or expired session' });
  }
  
  // Calculate score server-side
  var score = calculateScore(data.answers);
  
  return responseJSON({ 
    success: true, 
    score: score
  });
}

function handleValidateQuizGet(params) {
  // Parse answers from URL parameter
  var answers = {};
  try {
    answers = JSON.parse(params.answers);
  } catch (e) {
    return responseJSON({ success: false, message: 'Invalid answers format' });
  }
  
  // Validate session token
  if (!validateSessionToken(params.email, params.sessionToken)) {
    return responseJSON({ success: false, message: 'Invalid or expired session' });
  }
  
  // Calculate score server-side
  var score = calculateScore(answers);
  
  return responseJSON({ 
    success: true, 
    score: score
  });
}

function generateSessionToken(email) {
  var token = Utilities.getUuid();
  var cache = CacheService.getScriptCache();
  var key = 'session_' + email;
  cache.put(key, token, SESSION_EXPIRY_SECONDS);
  return token;
}

function validateSessionToken(email, token) {
  if (!email || !token) return false;
  var cache = CacheService.getScriptCache();
  var key = 'session_' + email;
  var storedToken = cache.get(key);
  return storedToken === token;
}

function invalidateSessionToken(email) {
  var cache = CacheService.getScriptCache();
  var key = 'session_' + email;
  cache.remove(key);
}

function calculateScore(answers) {
  if (!answers || typeof answers !== 'object') return 0;
  
  var correctCount = 0;
  for (var questionId in ANSWER_KEYS) {
    if (answers[questionId] === ANSWER_KEYS[questionId]) {
      correctCount++;
    }
  }
  
  // Same scoring logic as before
  var finalScore = (correctCount === TOTAL_QUESTIONS) ? 100 : Math.round(correctCount * 3.3);
  return finalScore;
}

function handleGetLeaderboard() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Leaderboard');
  if (!sheet || sheet.getLastRow() < 2) return responseJSON([]);
  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 3).getValues();
  var leaderboard = data.map(function(row) {
    return { name: row[0], score: row[1], time: row[2] };
  });
  leaderboard.sort(function(a, b) {
    if (b.score !== a.score) return b.score - a.score;
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

