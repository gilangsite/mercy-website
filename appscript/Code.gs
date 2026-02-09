/**
 * MERCY 2026 - GOOGLE APPS SCRIPT BACKEND (V4 - ANTI-ERROR STABLE)
 * Admin: medtools.mercy@gmail.com
 * 
 * PENTING: Untuk mengetes, pilih fungsi 'testSystem' di dropdown lalu klik 'Run'.
 */

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    var params = JSON.parse(e.postData.contents);
    var action = params.action;
    if (action === 'register') return handleRegistration(params);
    if (action === 'submit_quiz') return handleSubmitQuiz(params);
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
    sendEmailConfirmation(data.email, data.nama);
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
  sheet.appendRow([new Date(), data.email, JSON.stringify(data.answers), data.score]);
  lbSheet.appendRow([data.name, data.score, data.timestamp]);
  return responseJSON({ success: true });
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

function sendEmailConfirmation(email, name) {
  if (!email || !name) {
    Logger.log("Info: Fungsi sendEmailConfirmation dihentikan karena tidak ada data. Gunakan 'testSystem' untuk mengetes.");
    return;
  }
  var subject = "Konfirmasi Pendaftaran INC Mercy 2026";
  var body = "Halo " + name + ",\n\n" +
             "Selamat! Pendaftaran kamu untuk Iseng Ngetest Competition (INC) Mercy 2026 telah berhasil.\n\n" +
             "Berikut langkah selanjutnya:\n" +
             "1. Join Grup WhatsApp Peserta untuk info teknis.\n" +
             "2. Kompetisi akan dilaksanakan pada tanggal [DATE].\n" +
             "3. Login menggunakan email ini saat kompetisi dimulai.\n\n" +
             "Salam,\n" +
             "Panitia Mercy 2026";
  MailApp.sendEmail(email, subject, body);
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
    sendEmailConfirmation(dummyData.email, dummyData.nama);
    Logger.log("Email Konfirmasi Peserta BERHASIL dikirim ke: " + dummyData.email);
    Logger.log("Tes Selesai! Silakan cek inbox email Anda.");
  } catch(e) {
    Logger.log("Error saat tes: " + e.toString());
  }
}
