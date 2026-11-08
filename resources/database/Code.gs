/* Google Apps Script backend: the bound Google Sheet is the database.
   Sheets "users" and "messages" are created automatically on first use. */
const SS = SpreadsheetApp.getActive();
const fail = m => ({ ok: false, m });
const clean = (v, n) => { v = String(v || '').trim().slice(0, n); return /^[=+\-@]/.test(v) ? "'" + v : v; }; // blocks formula injection

function sheet(name, head) {
  let s = SS.getSheetByName(name);
  if (!s) { s = SS.insertSheet(name); s.appendRow(head); }
  return s;
}

function hash(pass, salt) {
  let h = salt + pass;
  for (let i = 0; i < 200; i++)
    h = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, h + salt));
  return h;
}

function doPost(e) {
  let out;
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    out = handle(JSON.parse(e.postData.contents));
  } catch (err) {
    out = fail('خطای سرور. دوباره تلاش کنید.');
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function handle(r) {
  const users = sheet('users', ['email', 'name', 'salt', 'hash', 'token', 'created']);
  const cache = CacheService.getScriptCache();
  const email = String(r.email || '').trim().toLowerCase();
  const find = (col, val) => {
    if (!val) return null;
    const rows = users.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) if (String(rows[i][col]) === val) return { n: i + 1, row: rows[i] };
    return null;
  };
  const pub = row => ({ name: row[1], email: row[0], created: row[5] });

  if (r.action === 'register') {
    const name = clean(r.name, 80), pass = String(r.password || '');
    if (!/^[^@\s=+\-][^@\s]*@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 120) return fail('ایمیل معتبر نیست.');
    if (name.length < 2) return fail('نام را وارد کنید.');
    if (pass.length < 8) return fail('رمز عبور باید حداقل ۸ نویسه باشد.');
    if (find(0, email)) return fail('این ایمیل قبلاً ثبت شده است.');
    const salt = Utilities.getUuid(), token = Utilities.getUuid(), created = Date.now();
    users.appendRow([email, name, salt, hash(pass, salt), token, created]);
    return { ok: true, m: 'ثبت‌نام با موفقیت انجام شد.', token, user: pub([email, name, '', '', '', created]) };
  }
  if (r.action === 'login') {
    const k = 'try:' + email, tries = Number(cache.get(k) || 0);
    if (tries >= 5) return fail('تلاش‌های زیاد. ده دقیقه بعد دوباره امتحان کنید.');
    const u = find(0, email);
    if (!u || hash(String(r.password || ''), String(u.row[2])) !== String(u.row[3])) {
      cache.put(k, String(tries + 1), 600);
      return fail('ایمیل یا رمز عبور درست نیست.');
    }
    const token = Utilities.getUuid();
    users.getRange(u.n, 5).setValue(token);
    cache.remove(k);
    return { ok: true, m: 'خوش آمدید!', token, user: pub(u.row) };
  }
  if (r.action === 'me') {
    const u = find(4, String(r.token || ''));
    return u ? { ok: true, user: pub(u.row) } : fail('نشست منقضی شده است.');
  }
  if (r.action === 'logout') {
    const u = find(4, String(r.token || ''));
    if (u) users.getRange(u.n, 5).clearContent();
    return { ok: true };
  }
  if (r.action === 'contact') {
    const text = clean(r.text, 2000);
    if (!text) return fail('متن پیام خالی است.');
    sheet('messages', ['name', 'email', 'text', 'date']).appendRow([clean(r.name, 80), clean(r.email, 120), text, Date.now()]);
    return { ok: true, m: 'پیام شما ثبت شد. سپاس از شما!' };
  }
  if (r.action === 'reset_request') {
    const sk = 'rs:' + email, sent = Number(cache.get(sk) || 0);
    if (sent >= 3) return fail('تعداد درخواست‌ها زیاد است. یک ساعت بعد دوباره تلاش کنید.');
    cache.put(sk, String(sent + 1), 3600);
    if (find(0, email)) {
      const code = String(parseInt(Utilities.getUuid().replace(/-/g, '').slice(0, 8), 16) % 1000000).padStart(6, '0');
      const salt = Utilities.getUuid();
      cache.put('rc:' + email, JSON.stringify({ salt, h: hash(code, salt) }), 900); // valid for 15 minutes
      cache.remove('rt:' + email);
      MailApp.sendEmail({
        to: email, subject: 'کد بازیابی رمز عبور - دانش‌رایان',
        body: 'کد بازیابی رمز عبور شما: ' + code + '\nاین کد ۱۵ دقیقه معتبر است. اگر شما درخواست نداده‌اید، این ایمیل را نادیده بگیرید.',
        htmlBody: '<div dir="rtl" style="font-family:Tahoma,sans-serif"><p>کد بازیابی رمز عبور شما:</p><p style="font-size:26px;letter-spacing:4px"><b dir="ltr">' + code + '</b></p><p>این کد ۱۵ دقیقه معتبر است. اگر شما درخواست نداده‌اید، این ایمیل را نادیده بگیرید.</p></div>'
      });
    }
    return { ok: true, m: 'اگر این ایمیل ثبت شده باشد، کد ۶ رقمی برای شما ارسال شد.' };
  }
  if (r.action === 'reset_confirm') {
    const tk = 'rt:' + email, tries = Number(cache.get(tk) || 0), saved = cache.get('rc:' + email);
    const bad = fail('کد نادرست است یا منقضی شده است.');
    if (!saved || tries >= 5) return bad;
    const s = JSON.parse(saved), u = find(0, email), pass = String(r.password || '');
    if (!u || hash(String(r.code || '').trim(), s.salt) !== s.h) { cache.put(tk, String(tries + 1), 900); return bad; }
    if (pass.length < 8) return fail('رمز عبور باید حداقل ۸ نویسه باشد.');
    const salt = Utilities.getUuid();
    users.getRange(u.n, 3, 1, 3).setValues([[salt, hash(pass, salt), '']]); // new salt, new hash, token cleared = logged out everywhere
    ['rc:', 'rt:', 'try:'].forEach(k => cache.remove(k + email));
    return { ok: true, m: 'رمز عبور تغییر کرد. اکنون وارد شوید.' };
  }
  if (r.action === 'rename') {
    const u = find(4, String(r.token || '')), name = clean(r.name, 80);
    if (!u) return fail('نشست منقضی شده است.');
    if (name.length < 2) return fail('نام را وارد کنید.');
    users.getRange(u.n, 2).setValue(name);
    return { ok: true, m: 'نام شما تغییر کرد.' };
  }
  if (r.action === 'delete') {
    const u = find(4, String(r.token || ''));
    if (!u) return fail('نشست منقضی شده است.');
    if (hash(String(r.password || ''), String(u.row[2])) !== String(u.row[3])) return fail('رمز عبور درست نیست.');
    users.deleteRow(u.n);
    const ms = SS.getSheetByName('messages');
    if (ms) {
      const rows = ms.getDataRange().getValues();
      for (let i = rows.length - 1; i > 0; i--) if (String(rows[i][1]).toLowerCase() === u.row[0]) ms.deleteRow(i + 1);
    }
    return { ok: true, m: 'حساب شما برای همیشه حذف شد.' };
  }
  return fail('درخواست نامعتبر.');
}

// Run this once from the editor to grant the "send email" permission.
function authorize() { return MailApp.getRemainingDailyQuota(); }
