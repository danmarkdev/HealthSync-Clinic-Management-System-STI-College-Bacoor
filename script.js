/* ============================================================
   HEALTHSYNC — Combined JavaScript
   Sections: Registration/Login, Reset Password, Dashboard
   ============================================================ */

/* ============================================================
   SECTION 1: REGISTRATION / LOGIN LOGIC
   ============================================================ */

/* ============================================================
   HEALTHSYNC — Clinic Registration / Login Logic
   FILE: JAVASCRIPT/clinic registration.js

   FIXES & CHANGES:
   ✅ OTP email fix — uses correct EmailJS template params
      (email, name, subject, message, from_name)
      so "address not found" error is resolved
   ✅ Branch field removed from Register
   ✅ Password strength BLOCKS account creation if Weak or Very Weak
      even when Terms checkbox is ticked
   ✅ Register button stays disabled until password is Fair or stronger
      AND Terms are agreed
   ✅ Delete button in Medical Records removed (handled in dashboard)
   ============================================================ */

// ── On page load ─────────────────────────────────────────────
// Global variables for OTP and Reset
var activeResetToken = null; 
var pendingLoginAccount  = null;
var pendingLoginRemember = false;
var activeLoginOtp       = '';
var activeLoginOtpExpiry = 0;

window.addEventListener('load', function () {
    if (!document.getElementById('loginEmail')) return;

    // Already logged in → go to dashboard
    if (sessionStorage.getItem('userSession')) {
        window.location.href = 'index.html';
        return;
    }
});

// ── Legal content ─────────────────────────────────────────────
var legalContent = {
    terms: {
        title: 'Terms of Use',
        subtitle: 'These terms explain how clinic personnel may use HealthSync.',
        body:
            '<div class="legal-copy">'
          + '<p>By creating an account, you agree to use HealthSync only for official school clinic operations.</p>'
          + '<p>You must keep your login credentials secure and must not share patient or student information with unauthorized persons.</p>'
          + '<p>All records entered into the system should be accurate, updated, and handled according to your school clinic procedures.</p>'
          + '<p>Improper access, misuse of records, or unauthorized editing may result in account removal and administrative action.</p>'
          + '</div>'
    },
    privacy: {
        title: 'Privacy Policy',
        subtitle: 'This explains how personnel information is handled during registration.',
        body:
            '<div class="legal-copy">'
          + '<p>HealthSync stores the registration details needed to manage your clinic account, including your name, role, email, and login credentials.</p>'
          + '<p>Your information is used only for authentication, profile setup, and clinic system operations.</p>'
          + '<p>Authorized clinic personnel should access the system only for legitimate school health services and record management.</p>'
          + '<p>By continuing, you confirm that you understand how your account data will be used inside the clinic management system.</p>'
          + '</div>'
    }
};

// ── Tab switcher ──────────────────────────────────────────────

function hideAlerts() {
    ['loginError','loginSuccess','regError','regSuccess'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
}

// ── Toggle password visibility ────────────────────────────────
function togglePass(inputId, btn) {
    var input = document.getElementById(inputId);
    var icon  = btn ? btn.querySelector('i') : null;
    if (!input) return;
    if (input.type === 'password') {
        input.type = 'text';
        if (icon) icon.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
        input.type = 'password';
        if (icon) icon.classList.replace('fa-eye-slash', 'fa-eye');
    }
}

// ============================================================
//  PASSWORD STRENGTH
//  Score 0-1 = Very Weak / Weak  → BLOCKED
//  Score 2   = Fair              → ALLOWED (depends on password)
//  Score 3-5 = Strong/Very Strong → ALLOWED
// ============================================================
var PASS_LEVELS = [
    { pct: '0%',   color: '',         label: '' },
    { pct: '20%',  color: '#e74c3c',  label: '🔴 Very Weak'  },  // score 1
    { pct: '45%',  color: '#e67e22',  label: '🟠 Weak'       },  // score 2
    { pct: '65%',  color: '#f1c40f',  label: '🟡 Fair'       },  // score 3
    { pct: '85%',  color: '#2ecc71',  label: '🟢 Strong'     },  // score 4
    { pct: '100%', color: '#27ae60',  label: '✅ Very Strong' }   // score 5
];

function calcPassScore(val) {
    var score = 0;
    if (val.length >= 6)           score++;  // meets minimum
    if (val.length >= 10)          score++;  // longer is better
    if (/[A-Z]/.test(val))         score++;  // uppercase
    if (/[0-9]/.test(val))         score++;  // number
    if (/[^A-Za-z0-9]/.test(val))  score++;  // symbol
    return Math.min(score, 5);
}

/* Forgot password / reset modal strength meter */
function updateResetStrength() {
    var val = (document.getElementById('resetNewPass') || {}).value || '';
    var bar = document.getElementById('resetStrengthBar');
    var lbl = document.getElementById('resetStrengthLabel');
    if (!bar) return;
    var score = calcPassScore(val);
    var lvl   = PASS_LEVELS[score];
    bar.style.width      = val.length === 0 ? '0%' : lvl.pct;
    bar.style.background = lvl.color;
    if (lbl) { lbl.textContent = val.length === 0 ? '' : lvl.label; lbl.style.color = lvl.color; }
}

/* Reset password page strength meter (used in resetpassword.html) */
function updateStrength() {
    var val = '';
    var inp = document.getElementById('resetNewPass') || document.getElementById('newPass');
    if (inp) val = inp.value || '';
    var bar = document.getElementById('strengthBar');
    var lbl = document.getElementById('strengthLabel');
    if (!bar) return;
    var score = calcPassScore(val);
    var lvl   = PASS_LEVELS[score];
    bar.style.width      = val.length === 0 ? '0%' : lvl.pct;
    bar.style.background = lvl.color;
    if (lbl) { lbl.textContent = val.length === 0 ? '' : lvl.label; lbl.style.color = lvl.color; }
}

// ── Register button gating ────────────────────────────────────
// Enabled ONLY when: Terms agreed AND password score ≥ 3 (Fair+)
function toggleRegisterButton() {
    var agree = document.getElementById('agreeTerms');
    var btn   = document.getElementById('registerBtn');
    if (!agree || !btn) return;

    var passVal = (document.getElementById('regPassword') || {}).value || '';
    var score   = calcPassScore(passVal);
    var strongEnough = passVal.length === 0 || score >= 3; // blank = not yet typed, don't block early

    // If password is typed and still weak → keep button disabled
    if (passVal.length > 0 && score < 3) {
        btn.disabled = true;
        btn.title = 'Password is too weak. Please use a stronger password.';
        return;
    }

    btn.disabled = !agree.checked;
    btn.title    = agree.checked ? '' : 'You must agree to the Terms first.';
}

// ============================================================
//  LOGIN — with OTP via EmailJS
// ============================================================
function generateOtp() {
    return String(Math.floor(100000 + Math.random() * 900000));
}

function setOtpMsg(msg, type) {
    var el = document.getElementById('loginOtpMsg');
    if (!el) return;
    el.textContent   = msg;
    el.style.display = 'block';
    var styles = {
        error:   { bg:'#fdf0ef', color:'#c0392b', border:'1px solid #f5c6c2' },
        success: { bg:'#edfbf3', color:'#1e8449', border:'1px solid #b2e4c9' },
        info:    { bg:'#f0f4ff', color:'#0d2b52', border:'1px solid #c7d7f5' }
    };
    var s = styles[type] || styles.info;
    el.style.background = s.bg;
    el.style.color      = s.color;
    el.style.border     = s.border;
}

function showLoginOtpModal() {
    var modal = document.getElementById('loginOtpModal');
    if (!modal) return;
    modal.classList.add('open');
    var inp = document.getElementById('loginOtpCode');
    if (inp) inp.value = '';
    var msg = document.getElementById('loginOtpMsg');
    if (msg) msg.style.display = 'none';
    if (pendingLoginAccount && pendingLoginAccount.email) {
        document.getElementById('otpTargetEmail').textContent = 'Code sent to: ' + pendingLoginAccount.email;
    }
}

function hideLoginOtpModal() {
    var modal = document.getElementById('loginOtpModal');
    if (modal) modal.classList.remove('open');
}

/*
 * ✅ OTP EMAIL FIX
 * Root cause: EMAILJS_LOGIN_OTP_TEMPLATE_ID must use the active reminder/OTP template.
 * (the reminder template). That template expects these params:
 *   email, name, subject, message, from_name
 * Previously the code was sending: email, name, reset_link — causing
 * EmailJS to fail and bounce back "address not found".
 *
 * Fix: always send the params that the active reminder/OTP template uses.
 */
function sendLoginOtpEmail(account) {
    var otp = generateOtp();
    activeLoginOtp       = otp;
    activeLoginOtpExpiry = Date.now() + (5 * 60 * 1000); // 5 minutes

    var otpMessage =
        'Your HealthSync login verification code is:\n\n' +
        '    ' + otp + '\n\n' +
        'This code is valid for 5 minutes.\n' +
        'Do not share this code with anyone.\n\n' +
        '— STI College Bacoor Clinic';

    /* Use the active reminder/OTP template with correct params */
    return emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
        email:     account.email,        // {{email}}     → recipient address
        name:      account.name,         // {{name}}      → Dear [name]
        subject:   'HealthSync Login OTP — ' + otp,  // {{subject}}
        message:   otpMessage,           // {{message}}   → body
        from_name: 'STI Bacoor Clinic'   // {{from_name}}
    });
}

function getEmailJsErrorMessage(err) {
    if (!err) return 'Unknown EmailJS error';
    if (typeof err === 'string') return err;
    if (err.text) return err.text;
    if (err.message) return err.message;
    try {
        return JSON.stringify(err);
    } catch (e) {
        return 'Unknown EmailJS error';
    }
}

function completeLoginSession(account, remember, email) {
    var session = {
        email:    email || account.email,
        name:     account.name,
        position: account.position,
        nickname: account.nickname,
        photo:    account.photo,
        notif_pending: account.notif_pending,
        notif_archive: account.notif_archive,
        default_chart: account.default_chart,
        dark_mode: account.dark_mode, // Include dark_mode from login response
        branch:   'STI College Bacoor',
        loginAt:  new Date().toISOString()
    };

    // Session is only created here AFTER OTP verification
    sessionStorage.setItem('userSession', JSON.stringify(session));
    document.getElementById('loginSuccess').style.display = 'flex';
    setTimeout(function () { window.location.href = 'index.html'; }, 1000);
}

function doLogin() {
    var email    = (document.getElementById('loginEmail').value    || '').trim();
    var password =  document.getElementById('loginPassword').value || '';
    var remember =  document.getElementById('rememberMe').checked;
    var btn      =  document.querySelector('#form-login .btn-auth');

    hideAlerts();

    if (!email || !password) {
        showLoginError('Please enter your email and password.');
        return;
    }

    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in...'; }

    var formData = new FormData();
    formData.append('loginEmail', email);
    formData.append('loginPassword', password);

    fetch('login_process.php', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            pendingLoginAccount = {
                email:    email,
                name:     data.name,
                position: data.position,
                nickname: data.nickname,
                photo:    data.photo,
                notif_pending: data.notif_pending,
                notif_archive: data.notif_archive,
                default_chart: data.default_chart,
                dark_mode: data.dark_mode
            };
            pendingLoginRemember = remember;
            if (typeof HEALTHSYNC_REQUIRE_LOGIN_OTP !== 'undefined' && !HEALTHSYNC_REQUIRE_LOGIN_OTP) {
                completeLoginSession(pendingLoginAccount, pendingLoginRemember, email);
                return;
            }
            setOtpMsg('Sending OTP to your Gmail...', 'info');
            sendLoginOtpEmail(pendingLoginAccount)
                .then(function () {
                    showLoginOtpModal();
                    setOtpMsg('OTP sent successfully. Please check your Gmail.', 'success');
                })
                .catch(function (err) {
                    console.error('OTP send error:', err);
                    pendingLoginAccount = null;
                    pendingLoginRemember = false;
                    activeLoginOtp = '';
                    activeLoginOtpExpiry = 0;
                    showLoginError('Failed to send OTP: ' + getEmailJsErrorMessage(err));
                });
        } else {
            showLoginError(data.message);
        }
    })
    .catch(err => {
        console.error('Login error:', err);
        showLoginError('Server connection failed.');
    })
    .finally(() => {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In'; }
    });
}

function verifyLoginOtp() {
    var otp = (document.getElementById('loginOtpCode').value || '').trim();
    if (!pendingLoginAccount) {
        setOtpMsg('Session expired. Please sign in again.', 'error');
        hideLoginOtpModal();
        return;
    }
    if (!otp || otp.length !== 6) {
        setOtpMsg('Please enter the 6-digit OTP.', 'error');
        return;
    }
    if (Date.now() > activeLoginOtpExpiry) {
        setOtpMsg('OTP expired. Please request a new one.', 'error');
        return;
    }
    if (otp !== activeLoginOtp) {
        setOtpMsg('Incorrect OTP. Please try again.', 'error');
        return;
    }
    hideLoginOtpModal();
    completeLoginSession(pendingLoginAccount, pendingLoginRemember, pendingLoginAccount.email);
    pendingLoginAccount  = null;
    pendingLoginRemember = false;
    activeLoginOtp       = '';
    activeLoginOtpExpiry = 0;
}

function resendLoginOtp() {
    if (!pendingLoginAccount) {
        setOtpMsg('Session expired. Please sign in again.', 'error');
        return;
    }
    setOtpMsg('📨 Resending OTP...', 'info');
    sendLoginOtpEmail(pendingLoginAccount)
        .then(function () {
            setOtpMsg('✅ New OTP sent. Check your Gmail.', 'success');
        })
        .catch(function (err) {
            console.error('Resend OTP error:', err);
            setOtpMsg('❌ Failed to resend OTP: ' + getEmailJsErrorMessage(err), 'error');
        });
}

function showLoginError(msg) {
    var el = document.getElementById('loginError');
    document.getElementById('loginErrorMsg').textContent = msg;
    if (el) el.style.display = 'flex';
}

// Enter key support
document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    var otpModal = document.getElementById('loginOtpModal');
    if (otpModal && otpModal.classList.contains('open')) { verifyLoginOtp(); return; }
    var activeForm = document.querySelector('.auth-form.active');
    if (!activeForm) return;
    if (activeForm.id === 'form-login')    doLogin();
});

// ============================================================
//  REGISTER — password strength gate + no branch field
// ============================================================
// ── Legal modal ───────────────────────────────────────────────
function showLegalModal(type) {
    var modal    = document.getElementById('legalModal');
    var title    = document.getElementById('legalModalTitle');
    var subtitle = document.getElementById('legalModalSubtitle');
    var body     = document.getElementById('legalModalBody');
    var content  = legalContent[type] || legalContent.terms;
    if (!modal) return;
    title.textContent    = content.title;
    subtitle.textContent = content.subtitle;
    body.innerHTML       = content.body;
    modal.classList.add('open');
}

function hideLegalModal() {
    var modal = document.getElementById('legalModal');
    if (modal) modal.classList.remove('open');
}

function acceptLegalFromModal() {
    var agree = document.getElementById('agreeTerms');
    if (agree) agree.checked = true;
    toggleRegisterButton();
    hideLegalModal();
}

// ── Forgot password ───────────────────────────────────────────
function showForgot() {
    document.getElementById('forgotModal').classList.add('open');
    var msg = document.getElementById('forgotMsg');
    if (msg) msg.style.display = 'none';
    var fe = document.getElementById('forgotEmail');
    var le = document.getElementById('loginEmail');
    if (fe && le) fe.value = le.value || '';
}

function hideForgot() {
    document.getElementById('forgotModal').classList.remove('open');
}

/*
 * ✅ FORGOT PASSWORD — also uses correct template params
 * Uses EMAILJS_FORGOT_TEMPLATE_ID which expects:
 *   email, name, reset_link
 */
function generateToken() {
    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var token = '';
    for (var i = 0; i < 32; i++) token += chars.charAt(Math.floor(Math.random() * chars.length));
    return token;
}

function doForgot() {
    var email = (document.getElementById('forgotEmail').value || '').trim();
    var btn   = document.getElementById('forgotSendBtn');
    if (!email) { alert('Please enter your email address.'); return; }

    var formData = new FormData();
    formData.append('email', email);

    showForgotMsg('📨 Checking email and generating reset link...', 'info');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...'; }

    fetch('request_password_reset.php', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            var token = data.token;
            var currentPath = window.location.href.split('?')[0].split('#')[0];
            var baseUrl     = currentPath.substring(0, currentPath.lastIndexOf('/') + 1);
            var resetLink   = baseUrl + 'resetpassword.html?reset=' + token;
            var userName = data.name || 'HealthSync User';

            emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_FORGOT_TEMPLATE_ID, {
                email:      email,
                name:       userName,
                reset_link: resetLink
            })
            .then(function () {
                showForgotMsg('✅ Reset link sent! Check your Gmail inbox — ' + email, 'success');
                if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Reset Link'; }
            })
            .catch(function (err) {
                console.error('EmailJS send error:', err);
                showForgotMsg('❌ Failed to send email. Please try again.', 'error');
                if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Reset Link'; }
            });
        } else {
            showForgotMsg('❌ ' + data.message, 'error');
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Reset Link'; }
        }
    })
    .catch(function (err) {
        console.error('Server connection error:', err);
        showForgotMsg('❌ Server connection failed. Please try again.', 'error');
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Reset Link'; }
    });
}

function showForgotMsg(msg, type) {
    var el = document.getElementById('forgotMsg');
    if (!el) return;
    el.textContent   = msg;
    el.style.display = 'block';
    var styles = {
        error:   { bg:'#fdf0ef', color:'#c0392b', border:'1px solid #f5c6c2' },
        success: { bg:'#edfbf3', color:'#1e8449', border:'1px solid #b2e4c9' },
        info:    { bg:'#f0f4ff', color:'#0d2b52', border:'1px solid #c7d7f5' }
    };
    var s = styles[type] || styles.info;
    el.style.background = s.bg;
    el.style.color      = s.color;
    el.style.border     = s.border;
}

function doResetPassword() {
    var newPass     = (document.getElementById('resetNewPass')    || {}).value || '';
    var confirmPass = (document.getElementById('resetConfirmPass') || {}).value || '';
    var msgEl       = document.getElementById('resetMsg');

    function showErr(msg) {
        if (!msgEl) return;
        msgEl.textContent       = msg;
        msgEl.style.display     = 'block';
        msgEl.style.background  = '#fdf0ef';
        msgEl.style.color       = '#c0392b';
        msgEl.style.border      = '1px solid #f5c6c2';
    }

    if (newPass.length < 6) { showErr('Password must be at least 6 characters.'); return; }
    if (newPass !== confirmPass) { showErr('Passwords do not match.'); return; }

    if (!activeResetToken) { showErr('❌ Reset session expired or invalid. Please request a new link.'); return; }

    var formData = new FormData();
    formData.append('token', activeResetToken);
    formData.append('newPassword', newPass);

    fetch('update_user_password.php', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            activeResetToken = null;
            if (msgEl) {
                msgEl.textContent = '✅ Password updated successfully! Redirecting...';
                msgEl.style.display = 'block';
                msgEl.style.background = '#edfbf3';
                msgEl.style.color = '#1e8449';
                msgEl.style.border = '1px solid #b2e4c9';
            }
            // Siguradong babalik sa login tab
            setTimeout(() => { window.location.href = 'index.html'; }, 2000);
        } else {
            showErr('❌ ' + data.message);
        }
    });
}

// ── Handle reset page token (resetpassword.html) ─────────────
function handleResetPage() {
    var params = new URLSearchParams(window.location.search);
    var token  = params.get('reset');
    window.history.replaceState({}, document.title, window.location.pathname);

    function showState(id) {
        ['stateInvalid','stateReset','stateSuccess'].forEach(function (s) {
            var el = document.getElementById(s);
            if (el) el.classList.remove('active');
        });
        var target = document.getElementById(id);
        if (target) target.classList.add('active');
    }

    if (!token) { showState('stateInvalid'); return; }
    
    activeResetToken = token;
    showState('stateReset');
}

// ── Helpers ───────────────────────────────────────────────────
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ── Modal close on overlay click ─────────────────────────────
var forgotModal = document.getElementById('forgotModal');
if (forgotModal) forgotModal.addEventListener('click', function (e) { if (e.target === this) hideForgot(); });

var loginOtpModal = document.getElementById('loginOtpModal');
if (loginOtpModal) loginOtpModal.addEventListener('click', function (e) { if (e.target === this) hideLoginOtpModal(); });

/* ============================================================
   SECTION 2: RESET PASSWORD LOGIC
   ============================================================ */

/* ============================================================
   HEALTHSYNC — Reset Password Logic
   FILE: JAVASCRIPT/ResetPassword.js
   ============================================================ */

var activeToken = null;
var activeEntry = null;

// ── On load: validate token from URL ──────────────────────
window.addEventListener('load', function () {
    var params = new URLSearchParams(window.location.search);
    var token  = params.get('reset');

    if (!token) { showState('invalid'); return; }

    var formData = new FormData();
    formData.append('token', token);

    fetch('validate_reset_token.php', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            // Valid — show the form
            activeToken = token;
            activeEntry = { email: data.email }; // Store email for later use
            showState('form');
        } else {
            showState('invalid');
        }
    })
    .catch(err => {
        console.error('Token validation error:', err);
        showState('invalid'); // Server connection error or other issue
    });
});

// ── Show correct panel ─────────────────────────────────────
function showState(state) {
    ['stateInvalid', 'stateExpired', 'stateForm', 'stateSuccess'].forEach(function (id) {
        document.getElementById(id).classList.remove('active');
    });
    var map = {
        invalid : 'stateInvalid',
        expired : 'stateExpired',
        form    : 'stateForm',
        success : 'stateSuccess'
    };
    document.getElementById(map[state]).classList.add('active');
}

// ── Save new password ──────────────────────────────────────
function doResetPassword() {
    var newPass     = document.getElementById('resetNewPass').value    || '';
    var confirmPass = document.getElementById('resetConfirmPass').value || '';

    hideAlert();

    if (newPass.length < 6) {
        showAlert('Password must be at least 6 characters.');
        return;
    }
    if (newPass !== confirmPass) {
        showAlert('Passwords do not match. Please try again.');
        return;
    }

    if (!activeToken || !activeEntry || !activeEntry.email) {
        showAlert('Reset session expired. Please request a new reset link.');
        return;
    }

    var formData = new FormData();
    formData.append('token', activeToken);
    formData.append('newPassword', newPass);

    fetch('update_user_password.php', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            showState('success');
            setTimeout(function () { goToLogin(); }, 2500);
        } else {
            showAlert('❌ ' + data.message);
        }
    })
    .catch(err => {
        console.error('Password update error:', err);
        showAlert('❌ Server connection failed.');
    });
}

// ── Toggle password show/hide ──────────────────────────────
function togglePass(inputId, btn) {
    var input = document.getElementById(inputId);
    var icon  = btn.querySelector('i');
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.replace('fa-eye-slash', 'fa-eye');
    }
}

// ── Password strength meter ────────────────────────────────
function updateStrength() {
    var val = document.getElementById('resetNewPass').value;
    var bar = document.getElementById('strengthBar');
    var lbl = document.getElementById('strengthLabel');

    var score = 0;
    if (val.length >= 6)           score++;
    if (val.length >= 10)          score++;
    if (/[A-Z]/.test(val))         score++;
    if (/[0-9]/.test(val))         score++;
    if (/[^A-Za-z0-9]/.test(val))  score++;

    var levels = [
        { pct: '0%',   color: '',        label: '' },
        { pct: '20%',  color: '#e74c3c', label: '🔴 Very Weak' },
        { pct: '45%',  color: '#e67e22', label: '🟠 Weak' },
        { pct: '65%',  color: '#f1c40f', label: '🟡 Fair' },
        { pct: '85%',  color: '#2ecc71', label: '🟢 Strong' },
        { pct: '100%', color: '#27ae60', label: '✅ Very Strong' }
    ];

    var lvl = levels[Math.min(score, 5)];
    bar.style.width      = val.length === 0 ? '0%' : lvl.pct;
    bar.style.background = lvl.color;
    lbl.textContent      = val.length === 0 ? '' : lvl.label;
    lbl.style.color      = lvl.color;
}

// ── Alert helpers ──────────────────────────────────────────
function showAlert(msg) {
    var el = document.getElementById('resetAlert');
    document.getElementById('resetAlertMsg').textContent = msg;
    el.style.display = 'flex';
}

function hideAlert() {
    document.getElementById('resetAlert').style.display = 'none';
}

// ── Go back to login ───────────────────────────────────────
function goToLogin() {
    window.location.href = 'index.html';
}

/* ============================================================
   SECTION 3: DASHBOARD LOGIC
   ============================================================ */

﻿/* ============================================================
   HEALTHSYNC — Clinic Dashboard Logic (Updated)
   FILE: JAVASCRIPT/clinic dashboard.js
   
   CHANGES:
   ✅ Import Students — Manual + Excel/CSV bulk import
   ✅ Compliance Email Submission Review + Bell Approval
   ✅ Dashboard chart now shows Complete vs Pending per strand
   ✅ Removed Branch section from Settings
   ✅ Removed Delete button from Medical Records (only Archive remains)
   ============================================================ */

// ── Auth guard ─────────────────────────────────────────────
(function () {
    var session = sessionStorage.getItem('userSession');
    if (!session) window.location.replace('index.html');
})();

// ── Sign out ─────────────────────────────────────────────────
function signOut() {
    if (!confirm('Sign out of HealthSync?')) return;
    sessionStorage.clear();
    // window.location.replace removes the dashboard from browser history
    window.location.replace('index.html');
}

// ── Initialization Trigger ──────────────────────────────────
let isDashboardInitialized = false;
function triggerInit() {
    const session = sessionStorage.getItem('userSession');
    if (!session) {
        window.location.replace('index.html');
        return;
    }
    if (!isDashboardInitialized) {
        isDashboardInitialized = true;
        initDashboard();
    }
}
document.addEventListener('DOMContentLoaded', triggerInit);
window.addEventListener('pageshow', triggerInit);

// Reliable trigger for both initial load and refresh
window.addEventListener('load', triggerInit);
window.addEventListener('pageshow', function(e) {
    if (e.persisted) triggerInit(); 
});

var allUsers = []; // Will contain all students and teachers
var shsStudents = [];
var shsTeachers = [];
var collegeStudents = [];
var collegeTeachers = [];
var archives = [];
var reminderLogs = [];
var scheduledReminders = [];
var blastReminderAttachment = null;
var BLAST_ATTACHMENT_MAX_BYTES = 500 * 1024;
var pendingSubmissions = []; // 🆕 Email submissions awaiting approval
var scheduledReminderTimer = null;
var scheduledReminderProcessorRunning = false;
var emailReplyTimer = null;
var emailReplyCheckerRunning = false;
var emailReplyConfigWarned = false;
var liveDataRefreshTimer = null;
var liveDataRefreshRunning = false;
var knownPendingSubmissionIds = {};
var dashboardInitialDataLoaded = false;

// Categories for overall dashboard chart
var ALL_CATEGORIES = ['SHS Students', 'SHS Teachers', 'Tertiary Students', 'Tertiary Teachers'];
var CATEGORY_COLORS = {
    'SHS Students': '#3498db', // Blue
    'SHS Teachers': '#2ecc71', // Green
    'Tertiary Students': '#f1c40f', // Yellow
    'Tertiary Teachers': '#e67e22'  // Orange
};
var SHS_STRANDS = ['ICT','STEM','ABM','HUMSS','TOP'];
var SCOLORS = ['#3498db','#2ecc71','#f1c40f','#e67e22','#9b59b6'];

var COLLEGE_COURSES = ['BSCS', 'BSIT', 'BSBA', 'BAPsy', 'BSTM'];
var COLLEGE_COURSE_COLORS = { 
    BSCS:  {bg:'#fef3c7',text:'#92400e',border:'#f59e0b',icon:'💻'},
    BSIT:  {bg:'#dbeafe',text:'#1d4ed8',border:'#3b82f6',icon:'🌐'},
    BSBA:  {bg:'#dcfce7',text:'#15803d',border:'#22c55e',icon:'📊'},
    BAPsy: {bg:'#fce7f3',text:'#9d174d',border:'#ec4899',icon:'🧠'},
    BSTM:  {bg:'#ede9fe',text:'#5b21b6',border:'#8b5cf6',icon:'✈️'}
};

function recordKey(record) {
    return String((record && (record.student_id || record.studentId || record.id)) || '').trim();
}

function hasPendingApproval(record) {
    var id = recordKey(record);
    if (!id) return false;
    return (pendingSubmissions || []).some(function(sub) {
        var status = String(sub.status || '').toLowerCase();
        return status === 'pending_review' && recordKey(sub) === id;
    });
}

function hasApprovedRequirementFile(record) {
    var id = recordKey(record);
    if (!id) return false;
    return (pendingSubmissions || []).some(function(sub) {
        var status = String(sub.status || '').toLowerCase();
        return recordKey(sub) === id
            && (status === 'approved' || status === 'complete')
            && getSubmissionFiles(sub).length > 0;
    });
}

function hasApprovedRequirementProof(record) {
    var id = recordKey(record);
    if (!id) return false;
    return (pendingSubmissions || []).some(function(sub) {
        var status = String(sub.status || '').toLowerCase();
        return recordKey(sub) === id && (status === 'approved' || status === 'complete');
    });
}

function effectiveStatus(record) {
    if (hasPendingApproval(record)) return 'Pending';
    return hasApprovedRequirementProof(record) ? 'Complete' : 'Pending';
}

function loadAccountData() {
    // Synchronize all data fetching to ensure connectivity across all features
    return Promise.all([
        fetch('get_students.php').then(res => res.ok ? res.json() : []),
        fetch('get_reminder_logs.php').then(res => res.ok ? res.json() : []),
        fetch('get_submissions.php').then(res => res.ok ? res.json() : []),
        fetch('get_scheduled_reminders.php').then(res => res.ok ? res.json() : [])
    ])
    .then(([studentsData, logsData, submissionsData, scheduledData]) => {
        if (!Array.isArray(studentsData)) studentsData = [];
        // 1. Process and Sort Master Data
        studentsData.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        allUsers = studentsData;
        pendingSubmissions = Array.isArray(submissionsData) ? submissionsData : [];
        announceNewPendingSubmissions(pendingSubmissions);
        allUsers.forEach(function(user) {
            user.status = effectiveStatus(user);
        });

        // 2. Categorize data and enforce strict Alphabetical Sorting (A-Z)
        const alphaSort = (arr) => arr.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

        shsStudents = alphaSort(allUsers.filter(u => u.level === 'SHS' && u.type === 'Student' && u.is_archived == 0));
        shsTeachers = alphaSort(allUsers.filter(u => u.level === 'SHS' && u.type === 'Teacher' && u.is_archived == 0));
        collegeStudents = alphaSort(allUsers.filter(u => u.level === 'Tertiary' && u.type === 'Student' && u.is_archived == 0));
        collegeTeachers = alphaSort(allUsers.filter(u => u.level === 'Tertiary' && u.type === 'Teacher' && u.is_archived == 0));
        archives = alphaSort(allUsers.filter(u => u.is_archived == 1));

        reminderLogs = logsData;
        scheduledReminders = Array.isArray(scheduledData) ? scheduledData : [];

        // 3. Refresh all UI components simultaneously
        renderTables(); 
        updateStats();
        updateOverallChart();
        renderComplianceTable(allUsers);
        renderReminderLog();
        renderScheduledReminders();
        updateBellNotif();
        renderSubmissionReview();

        // Update active page specific views
        var activePage = document.querySelector('.page.active');
        if (activePage && activePage.id === 'shs-students') updateSHSStrandChart();
        if (activePage && activePage.id === 'college-students') renderCollegeView(collegeStudents);
    })
    .catch(err => {
        console.error('Error loading all account data:', err);
        showToast('❌ Error loading data. Please refresh.');
    });
}

function saveAccountData() {
    // No-op: Data is handled by MySQL
}

function initDashboard() {
    // Load from session immediately so "Danmark" shows up without waiting for the server
    loadProfile();
    loadSettings();
    initializeScheduleControls();
    initializeImportManualValidation();
    
    var session = getUserSession(); 
    if(session && session.dark_mode) applyDarkMode(true);

    document.getElementById('date-now').innerText = new Date().toDateString();
    
    refreshProfile()
        .catch(err => console.warn('Profile refresh skipped:', err))
        .then(() => loadAccountData())
        .then(() => showPage('dash'))
        .then(() => startScheduledReminderAutoProcessor())
        .then(() => startEmailReplyAutoChecker())
        .then(() => startLiveDataAutoRefresh())
        .catch(err => {
            console.error('Initial Load Error:', err);
            showToast('❌ Error loading initial data. Please check console.');
        });
}

function announceNewPendingSubmissions(submissions) {
    var pending = (submissions || []).filter(function(sub) {
        return String(sub.status || '').toLowerCase() === 'pending_review';
    });
    var newCount = 0;
    var nextKnown = {};

    pending.forEach(function(sub) {
        var id = String(sub.id || '');
        if (!id) return;
        nextKnown[id] = true;
        if (dashboardInitialDataLoaded && !knownPendingSubmissionIds[id]) {
            newCount++;
        }
    });

    knownPendingSubmissionIds = nextKnown;
    if (!dashboardInitialDataLoaded) {
        dashboardInitialDataLoaded = true;
        return;
    }

    if (newCount > 0) {
        showToast(newCount + ' new submission' + (newCount === 1 ? '' : 's') + ' added to Pending Approval.');
    }
}

function startLiveDataAutoRefresh() {
    if (liveDataRefreshTimer) return;
    liveDataRefreshTimer = setInterval(function() {
        if (document.hidden || liveDataRefreshRunning) return;
        liveDataRefreshRunning = true;
        loadAccountData()
            .catch(function(err) {
                console.warn('Live dashboard refresh failed:', err);
            })
            .finally(function() {
                liveDataRefreshRunning = false;
            });
    }, 10000);
}

function startScheduledReminderAutoProcessor() {
    if (scheduledReminderTimer) return;
    runScheduledReminderProcessor(false);
    scheduledReminderTimer = setInterval(function() {
        runScheduledReminderProcessor(false);
    }, 60000);
}

function runScheduledReminderProcessor(showMessage) {
    if (scheduledReminderProcessorRunning) return Promise.resolve();
    scheduledReminderProcessorRunning = true;
    return fetch('process_scheduled_reminders.php', { cache: 'no-store' })
        .then(function(response) {
            return response.ok ? response.json() : { status: 'error', message: 'Processor request failed.' };
        })
        .then(function(data) {
            var processed = parseInt(data.processed, 10) || 0;
            if (processed > 0) {
                return loadAccountData().then(function() {
                    if (showMessage) showToast('Scheduled reminders processed: ' + processed);
                });
            }
            if (showMessage) showToast('No due scheduled reminders right now.');
        })
        .catch(function(err) {
            console.warn('Scheduled reminder auto-check failed:', err);
            if (showMessage) showToast('Could not process scheduled reminders.');
        })
        .finally(function() {
            scheduledReminderProcessorRunning = false;
        });
}

function startEmailReplyAutoChecker() {
    if (emailReplyTimer) return;
    runEmailReplyChecker(false);
    emailReplyTimer = setInterval(function() {
        runEmailReplyChecker(false);
    }, 20000);
}

function runEmailReplyChecker(showMessage) {
    if (emailReplyCheckerRunning) return Promise.resolve();
    emailReplyCheckerRunning = true;
    var controller = new AbortController();
    var timeoutId = setTimeout(function() { controller.abort(); }, 45000);
    return fetch('check_email_replies.php', { cache: 'no-store', signal: controller.signal })
        .then(function(response) {
            return response.ok ? response.json() : { status: 'error', errors: ['Inbox checker request failed.'] };
        })
        .then(function(data) {
            var saved = parseInt(data.saved, 10) || 0;
            if (saved > 0) {
                return loadAccountData();
            }
            if (showMessage) showToast('No new email replies found.');
            if (data.status === 'not_configured' && !emailReplyConfigWarned) {
                emailReplyConfigWarned = true;
                console.warn('Email inbox checker is not configured:', data.errors || data.message || data);
            }
            if (data.status === 'error' && !emailReplyConfigWarned) {
                emailReplyConfigWarned = true;
                console.warn('Email inbox checker could not run:', data.errors || data.message || data);
            }
        })
        .catch(function(err) {
            if (!emailReplyConfigWarned) {
                emailReplyConfigWarned = true;
                console.warn('Email inbox checker failed:', err);
            }
        })
        .finally(function() {
            clearTimeout(timeoutId);
            emailReplyCheckerRunning = false;
        });
}

function applyDarkMode(enable) {
    if (enable) {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }
    var toggle = document.getElementById('darkModeToggle');
    if (toggle) toggle.checked = !!enable;
}

function refreshProfile() {
    var session = getUserSession();
    if (!session || !session.email) return Promise.resolve();
    var formData = new FormData();
    formData.append('email', session.email);
    return fetch('get_profile.php', { method: 'POST', body: formData })
    .then(res => res.ok ? res.json() : {status: 'error'})
    .then(data => {
        if (data && data.status === 'success') {
            var u = data.data || {};
            session.name = u.full_name;
            session.nickname = u.nickname;
            session.position = u.position;
            session.photo = u.photo;
            session.notif_pending = u.notif_pending;
            session.notif_archive = u.notif_archive;
            session.default_chart = u.default_chart;
            session.dark_mode = u.dark_mode; // Store dark mode preference
            setUserSession(session); // Update session storage
            applyDarkMode(!!u.dark_mode); // Apply dark mode immediately after profile refresh
            updateBranchDisplay(session.branch || 'STI College Bacoor');
        }
    }).catch(() => null);
}

function validatePhone(input, errId) {
    input.value = input.value.replace(/[^0-9]/g, '');
    var err = document.getElementById(errId);
    if (err) err.style.display = (input.value.length > 0 && (input.value.length !== 11 || !input.value.startsWith('09'))) ? 'block' : 'none';
}

function togglePass(inputId, btn) {
    var input = document.getElementById(inputId);
    var icon = btn ? btn.querySelector('i') : null;
    if (!input) return;
    if (input.type === 'password') {
        input.type = 'text';
        if (icon) icon.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
        input.type = 'password';
        if (icon) icon.classList.replace('fa-eye-slash', 'fa-eye');
    }
}

function getUserSession() {
    try { return JSON.parse(sessionStorage.getItem('userSession') || 'null'); } catch(e) { return null; }
}
function setUserSession(session) { sessionStorage.setItem('userSession', JSON.stringify(session)); }
function getCurrentAccountIndex(accounts) {
    var session = getUserSession();
    if (!session || !session.email) return -1;
    return accounts.findIndex(function(a){ return String(a.email||'').toLowerCase() === String(session.email||'').toLowerCase(); });
}
function updateBranchDisplay(branchName) {
    var branchLabel = document.getElementById('nav-branch-name');
    if (!branchLabel) return;
    branchLabel.textContent = String(branchName || 'STI College Bacoor').toUpperCase();
}

function showPage(p) {
    // 1. Siguraduhin na ang bell ay lilitaw lamang sa Dashboard
    var bell = document.getElementById('bellWrap');
    if (bell) {
        bell.style.cssText = (p === 'dash') 
            ? 'display: flex !important; position: fixed !important; top: 20px !important; right: 28px !important; z-index: 99999 !important;' 
            : 'display: none !important;';
    }

    // 2. I-clear ang active states
    document.querySelectorAll('.page').forEach(function(pg){ pg.classList.remove('active'); });
    document.querySelectorAll('nav a').forEach(function(a){ a.classList.remove('active'); });

    // 3. I-activate ang tamang page at link
    var targetPage = document.getElementById(p);
    if (targetPage) targetPage.classList.add('active');

    var targetLink = document.getElementById('link-' + p);
    if (targetLink) targetLink.classList.add('active');

    window.scrollTo(0,0);
    if (p === 'dash') { 
    }
    else if (p === 'shs-students')    { renderStrandView(shsStudents); updateSHSStrandChart(); }
    else if (p === 'shs-teachers')    { renderCategoryTable('shsTeachersTableBody', shsTeachers); }
    else if (p === 'college-students') { renderCollegeView(collegeStudents); }
    else if (p === 'college-teachers') { renderCategoryTable('collegeTeachersTableBody', collegeTeachers); }
    else if (p === 'compliance') {
        renderComplianceTable(allUsers);
        renderReminderLog();
        renderSubmissionReview();
        runEmailReplyChecker(false);
    }
    else if (p === 'archive')    { renderArchiveRows(archives); }
}

// ============================================================
//  STUDENT MANAGEMENT
// ============================================================
function addStudent() {
    var id = document.getElementById('sID').value.trim();
    var name = document.getElementById('sName').value.trim(); // Full Name for student/teacher
    var level = document.getElementById('sLevel').value; // SHS or Tertiary
    var type = document.getElementById('sType').value; // Student or Teacher
    var strand = document.getElementById('sStrand').value; // For SHS Students
    var course = document.getElementById('sCourse').value; // For Tertiary Students

    if (!id || !name || !level || !type) { alert('ID, Full Name, Level, and Type are required!'); return; }
    if (level === 'SHS' && type === 'Student' && !strand) { alert('Strand is required for SHS Students!'); return; }
    if (level === 'Tertiary' && type === 'Student' && !course) { alert('Course is required for Tertiary Students!'); return; }

    var s = {
        id: id, name: name,
        level: level, type: type,
        strand: strand, // Will be empty for Tertiary or Teachers
        course: course, // Will be empty for SHS or Teachers
        yearLevel: document.getElementById('sYearLevel').value,
        section: document.getElementById('sSection').value,
        gmail: (document.getElementById('sGmail').value || '').trim(),
        outlook_email: document.getElementById('sOutlook').value,
        status: document.getElementById('sStatus').value
    };

    var formData = new FormData();
    for (var key in s) { formData.append(key, s[key]); }

    fetch('add_student.php', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            showToast('✅ Student added to Database!');
            loadAccountData(); // Refresh all data
            resetForm();
        } else {
            showToast('❌ Error: ' + data.message);
        }
    });
}

function resetForm() {
    ['sID','sName','sSection','sGmail'].forEach(function(id){
        var el = document.getElementById(id); if (el) el.value = '';
    });
    ['sLevel','sType','sStrand','sCourse','sYearLevel','sStatus'].forEach(function(id){
        var el = document.getElementById(id); if (el) el.selectedIndex = 0;
    });
    document.getElementById('sDateRecorded').value = new Date().toISOString().split('T')[0];
    // Hide/show strand/course based on default type/level
    toggleStrandCourseFields();
}

function toggleStrandCourseFields() {
    var level = document.getElementById('sLevel').value;
    var type  = document.getElementById('sType').value;
    if (document.getElementById('sStrandGroup')) document.getElementById('sStrandGroup').style.display = (level === 'SHS' && type === 'Student') ? 'block' : 'none';
    if (document.getElementById('sCourseGroup')) document.getElementById('sCourseGroup').style.display = (level === 'Tertiary' && type === 'Student') ? 'block' : 'none';
}

function filterRecords() {
    var q = document.getElementById('recSearch').value.trim().toLowerCase();
    if (!q) { renderMasterRows(allUsers); return; }
    renderMasterRows(allUsers.filter(function(s){
        return String(s.name||'').toLowerCase().includes(q)
            || String(s.id||'').toLowerCase().includes(q)
            || String(s.status||'').toLowerCase().includes(q)
            || String(s.level||'').toLowerCase().includes(q)
            || String(s.type||'').toLowerCase().includes(q);
    }));
}

function archiveStudent(studentId, studentName) {
    if (!confirm('Archive record for "' + studentName + '"?')) return;
    var formData = new FormData();
    formData.append('student_id', studentId);
    formData.append('archive', 1);

    fetch('archive_student.php', { method: 'POST', body: formData })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                loadAccountData();
                showToast('Record archived.');
            }
        });
}

function renderArchiveRows(list) {
    var tbody = document.getElementById('archiveTableBody');
    if (!list || list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#999;padding:20px;">No archived records.</td></tr>';
        return;
    }
    tbody.innerHTML = list.map(function(s, idx) {
        return '<tr><td>'+s.id+'</td><td>'+s.name+'</td><td>'+categoryBadge(s.level, s.type, s.strand || s.course)+'</td><td>'+(s.date||'-')+'</td>'
            +'<td style="white-space:nowrap;">'
            +'<button class="btn-sm" style="background:#27ae60;color:white;margin-right:4px;" onclick="restoreStudent(\''+s.id+'\', \''+s.name+'\')"><i class="fas fa-undo"></i> Restore</button>'
            +'</td></tr>';
    }).join('');
}

function restoreStudent(studentId, studentName) {
    if (!confirm('Restore "' + studentName + '" back to Medical Records?')) return;
    var formData = new FormData();
    formData.append('student_id', studentId);
    formData.append('archive', 0);

    fetch('archive_student.php', { method: 'POST', body: formData })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                loadAccountData();
                showToast('Record restored!');
            }
        });
}

function deleteArchive(studentId, studentName) {
    if (!confirm('Permanently DELETE archived record for "' + studentName + '"?')) return;
    var formData = new FormData();
    formData.append('student_id', studentId);

    fetch('delete_student.php', { method: 'POST', body: formData })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                loadAccountData();
                showToast('Record permanently deleted.');
            }
        });
}

// ⛔ deleteStudent removed — only Archive is allowed in Medical Records

function renderTables() {
    renderDashRows(allUsers); // Render dashboard table with all users
    renderMasterRows(allUsers); // Render master records table with all users
    renderArchiveRows(archives);

    // connectivity: ensure sub-sections update when master data changes
    renderStrandView(shsStudents);
    renderCategoryTable('shsTeachersTableBody', shsTeachers);
    renderCollegeView(collegeStudents);
    renderCategoryTable('collegeTeachersTableBody', collegeTeachers);
}

function renderDashRows(list) {
    var data = (list || allUsers)
        .filter(u => u.is_archived == 0)
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    var tbody = document.getElementById('dashTableBody');
    if (!tbody) return;
    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;color:#999;">No active records found.</td></tr>';
        return;
    }
    tbody.innerHTML = data.map(function(s){
        var idToDisplay = (s.type === 'Teacher') ? s.id : (s.student_id || s.id);
        return '<tr>'
            + '<td style="font-weight:600;color:#0d2b52;">'+idToDisplay+'</td>'
            + '<td>'+s.name+'</td>'
            + '<td>'+categoryBadge(s.level, s.type, s.strand || s.course)+'</td>'
            + '<td>'+statusBadge(s.status)+'</td>'
            + '<td style="text-align:center;"><button class="btn-sm" style="background:#0d2b52;color:white;" onclick="showStudentProfileModal(\''+s.id+'\')"><i class="fas fa-user-circle"></i> View</button></td>'
            + '</tr>';
    }).join('');
}

/**
 * Professional Category Table Renderer
 */
function renderCategoryTable(tableBodyId, data) {
    var tbody = document.getElementById(tableBodyId);
    if (!tbody) return;
    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;color:#999;">No records available.</td></tr>';
        return;
    }
    tbody.innerHTML = data.map(function(u) {
        var categoryInfo = (u.type === 'Teacher') ? (u.yearLevel || 'Faculty') : (u.strand || u.course || '—');
        return '<tr>'
            + '<td>' + u.id + '</td>'
            + '<td style="font-weight:600;">' + u.name + '</td>'
            + '<td>' + categoryInfo + '</td>'
            + '<td>' + (u.schoolYear || '—') + '</td>'
            + '<td>' + (u.outlook_email || u.gmail || '—') + '</td>'
            + '<td>' + statusBadge(u.status) + '</td>'
            + '<td style="text-align:center;"><button class="btn-sm" style="background:#0d2b52;color:white;" onclick="showStudentProfileModal(\''+u.id+'\')"><i class="fas fa-user-circle"></i> View</button></td>'
            + '</tr>';
    }).join('');
}

function renderMasterRows(list) {
    var data = (list || allUsers).filter(u => u.is_archived == 0).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    var tbody = document.getElementById('masterTableBody');
    if (!tbody) return;
    tbody.innerHTML = data.map(function(s){
        return '<tr><td>'+s.id+'</td><td>'+s.name+'</td><td>'+categoryBadge(s.level, s.type, s.strand || s.course)+'</td><td>'+(s.yearLevel||'-')+'</td>'
            +'<td style="font-size:12px;">'+(s.outlook_email||'—')+'</td>'
            +'<td style="font-size:12px;">'+(s.gmail||'—')+'</td>'
            +'<td>'+statusBadge(s.status)+'</td>'
                +'<td style="white-space:nowrap; text-align:center;">'
                +'<button class="btn-sm" style="background:#0d2b52;color:white;margin-right:4px;" onclick="showStudentProfileModal(\''+s.id+'\')" title="View Profile"><i class="fas fa-user-circle"></i></button>'
            +'<button class="btn-sm" style="background:#e74c3c;color:white;margin-right:4px;" onclick="deleteArchive(\''+s.id+'\', \''+s.name+'\')" title="Delete Permanent"><i class="fas fa-trash"></i></button>'
            +'<button class="btn-sm" style="background:#e67e22;color:white;" onclick="archiveStudent(\''+s.id+'\', \''+s.name+'\')"><i class="fas fa-archive"></i> Archive</button>'
            +'</td></tr>';
    }).join('') || '<tr><td colspan="8" style="text-align:center;padding:20px;">No active records found.</td></tr>';
}

function categoryBadge(level, type, category) {
    var label = '';
    var colorMap = {};
    if (type === 'Student') {
        if (level === 'SHS') {
            label = category; // Strand
            colorMap = {
                ICT:['#dbeafe','#1d4ed8'],STEM:['#dcfce7','#15803d'],ABM:['#fef9c3','#854d0e'],HUMSS:['#fce7f3','#9d174d'],TOP:['#ede9fe','#5b21b6']
            };
        } else if (level === 'Tertiary') {
            label = category; // Course
            colorMap = {
                BSIT:['#dbeafe','#1d4ed8'],BSCS:['#fef3c7','#92400e'],BSBA:['#dcfce7','#15803d'],
                BAPsy:['#fce7f3','#9d174d'],BSTM:['#ede9fe','#5b21b6'],BSHM:['#fff7ed','#c2410c']
            };
        }
    } else if (type === 'Teacher') {
        label = level + ' Teacher';
        colorMap = {'SHS Teacher':['#e0f2fe','#0369a1'], 'Tertiary Teacher':['#fff7ed','#c2410c']};
    }

    if (!label || label === '—' || label === 'N/A') return '<span class="badge" style="background:#f0f0f0;color:#555;">—</span>';
    var map = {
        ICT:['#dbeafe','#1d4ed8'],STEM:['#dcfce7','#15803d'],ABM:['#fef9c3','#854d0e'],HUMSS:['#fce7f3','#9d174d'],TOP:['#ede9fe','#5b21b6'],
        GAS:['#ede9fe','#5b21b6'],TVL:['#ffedd5','#9a3412'],BSIT:['#dbeafe','#1d4ed8'],BSHM:['#fff7ed','#c2410c'],
        BSCS:['#fef3c7','#92400e'],BSBA:['#dcfce7','#15803d'],BAPsy:['#fce7f3','#9d174d'],BSTM:['#ede9fe','#5b21b6'],
        'SHS Teacher':['#e0f2fe','#0369a1'], 'Tertiary Teacher':['#fff7ed','#c2410c']
    };
    var c = map[label] || ['#e2e8f0','#475569']; // Fallback color
    return '<span class="badge" style="background:'+c[0]+';color:'+c[1]+';">'+label+'</span>';
}
function statusBadge(status) {
    var normalized = status === 'Complete' ? 'Complete' : 'Pending';
    return '<span class="badge status-badge '+(normalized==='Complete'?'badge-complete':'badge-pending')+'" data-status="'+normalized+'">'+normalized+'</span>';
}

function statusBadgeFor(record) {
    return statusBadge(effectiveStatus(record));
}

function scheduleStatusBadge(status) {
    var normalized = String(status || 'pending').toLowerCase();
    var labels = { pending: 'Pending', processing: 'Sending', sent: 'Sent', failed: 'Failed', skipped: 'Skipped' };
    var label = labels[normalized] || (normalized.charAt(0).toUpperCase() + normalized.slice(1));
    return '<span class="reminder-status reminder-status-' + normalized + '">' + label + '</span>';
}

function reminderResultHtml(success, failed, skipped, subject) {
    var sCount = parseInt(success, 10) || 0;
    var fCount = parseInt(failed, 10) || 0;
    var hasSkipped = !!(skipped && String(skipped).trim());
    var isAutomatic = /^\[Scheduled\]/i.test(String(subject || ''));
    var isFailed = fCount > 0 || (sCount === 0 && hasSkipped);

    if (sCount === 0 && fCount === 0 && !hasSkipped) {
        return '<span class="reminder-result-empty">No result</span>';
    }

    var label = isAutomatic
        ? (isFailed ? 'Failed Automatic' : 'Success Automatic')
        : (isFailed ? 'Failed Send' : 'Success Send');
    var detail = sCount + ' sent, ' + fCount + ' failed' + (hasSkipped ? ', skipped: ' + skipped : '');
    var icon = isFailed ? 'fa-times' : 'fa-check';
    var cls = isFailed ? 'result-final-failed' : 'result-final-success';

    return '<span class="reminder-result-final ' + cls + '" title="' + String(detail).replace(/"/g, '&quot;') + '"><i class="fas ' + icon + '"></i> ' + label + '</span>';
}

function shouldShowReminderLogItem(log) {
    var sCount = parseInt(log && log.success, 10) || 0;
    var fCount = parseInt(log && log.failed, 10) || 0;
    var hasSkipped = !!(log && log.skipped && String(log.skipped).trim());
    return !(fCount > 0 || (sCount === 0 && hasSkipped));
}

// ============================================================
//  COMPLIANCE
// ============================================================
function renderComplianceTable(list = allUsers) { // Default to all users
    var tbody = document.getElementById('compTableBody');
    var tableWrap = document.getElementById('compTableWrap');
    var groupedView = document.getElementById('compGroupedView');
    var viewMode = (document.getElementById('compViewMode') || {}).value || 'table';
    list = (list || []).filter(function(u){ return u.is_archived == 0; });
    var compCount = list.filter(function(s){ return s.status==='Complete'; }).length;
    document.getElementById('comp-total').innerText = list.length;
    document.getElementById('comp-complete').innerText = compCount;
    document.getElementById('comp-pending').innerText = list.length - compCount;

    if (viewMode === 'grouped') {
        if (tableWrap) tableWrap.style.display = 'none';
        if (groupedView) {
            groupedView.style.display = 'block';
            groupedView.innerHTML = buildComplianceGroupedHtml(list);
        }
        updateSelectedCount();
        return;
    }

    if (tableWrap) tableWrap.style.display = 'block';
    if (groupedView) {
        groupedView.style.display = 'none';
        groupedView.innerHTML = '';
    }

    if (!list || list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;color:#999;padding:24px;">No student records yet.</td></tr>';
        updateSelectedCount();
        return;
    }
    list = list.slice().sort(function(a, b){ return (a.name || '').localeCompare(b.name || ''); });
    tbody.innerHTML = list.map(function(s){
        var sid = s.id;
        var idToDisplay = (s.type === 'Teacher') ? s.id : (s.student_id || s.id);
        return '<tr>'
            +'<td style="text-align:center;"><input type="checkbox" class="comp-check" data-id="'+sid+'" data-level="'+s.level+'" data-type="'+s.type+'" style="width:16px;height:16px;cursor:pointer;accent-color:var(--sti-blue);" onchange="updateSelectedCount()"></td>'
            +'<td>'+idToDisplay+'</td>'
            +'<td>'+s.name+'</td>'
            +'<td>'+categoryBadge(s.level, s.type, s.strand || s.course)+'</td>'
            +'<td>'+s.level+'</td>'
            +'<td>'+s.type+'</td>'
            +'<td style="font-size:12px;">'+(s.yearLevel||'—')+'</td>'
            +'<td style="font-size:12px;max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+(s.gmail||'<span style="color:#ccc;">—</span>')+'</td>'
            +'<td style="font-size:12px;max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+(s.outlook_email||'<span style="color:#ccc;">—</span>')+'</td>'
            +'<td>'+statusBadge(s.status)+'</td>'
            +'</tr>';
    }).join('');
    updateSelectedCount();
}

function initializeScheduleControls() {
    var dateEl = document.getElementById('scheduledReminderDate');
    var timeEl = document.getElementById('scheduledReminderTime');
    var today = new Date().toISOString().slice(0, 10);
    if (dateEl) {
        dateEl.min = today;
        if (!dateEl.value) dateEl.value = today;
    }
    if (timeEl && !timeEl.value) timeEl.value = '08:00';
}

function complianceProgramLabel(s) {
    if (!s) return 'Unassigned';
    if (s.type === 'Teacher') return (s.level || 'School') + ' Teachers';
    return s.strand || s.course || 'Unassigned';
}

function complianceSchoolYearLabel(s) {
    var raw = (s && (s.schoolYear || s.school_year)) || '';
    var label = String(raw).trim().replace(/[\u2013\u2014]/g, '-').replace(/\s*-\s*/g, '-');
    return label || 'No School Year';
}

function complianceYearLevelLabel(s) {
    if (!s) return 'No Year Level';
    return s.yearLevel || s.year_level || (s.type === 'Teacher' ? 'Faculty' : 'No Year Level');
}

function categoryDisplayLabel(s) {
    if (!s) return 'Unassigned';
    if (s.type === 'Teacher') return (s.level === 'Tertiary' ? 'Tertiary Teacher' : 'SHS Teacher');
    return s.strand || s.course || 'Unassigned';
}

function buildComplianceGroupedHtml(list) {
    if (!list || list.length === 0) {
        return '<div style="text-align:center;color:#999;padding:24px;border:1px dashed #d8dee9;border-radius:8px;">No records found for the selected filters.</div>';
    }

    var programOrder = SHS_STRANDS.concat(COLLEGE_COURSES).concat(['SHS Teachers', 'Tertiary Teachers', 'Unassigned']);
    var groups = {};
    list.forEach(function(s) {
        var schoolYear = complianceSchoolYearLabel(s);
        var program = complianceProgramLabel(s);
        var yearLevel = complianceYearLevelLabel(s);
        if (!groups[schoolYear]) groups[schoolYear] = {};
        if (!groups[schoolYear][program]) groups[schoolYear][program] = {};
        if (!groups[schoolYear][program][yearLevel]) groups[schoolYear][program][yearLevel] = [];
        groups[schoolYear][program][yearLevel].push(s);
    });

    var schoolYears = Object.keys(groups).sort(function(a, b) {
        if (a === 'No School Year') return 1;
        if (b === 'No School Year') return -1;
        return String(b).localeCompare(String(a), undefined, { numeric: true });
    });

    return schoolYears.map(function(schoolYear) {
        var schoolYearRows = [];
        Object.keys(groups[schoolYear]).forEach(function(program) {
            Object.keys(groups[schoolYear][program]).forEach(function(yl) {
                schoolYearRows = schoolYearRows.concat(groups[schoolYear][program][yl]);
            });
        });
        var syComplete = schoolYearRows.filter(function(s){ return s.status === 'Complete'; }).length;
        var syPending = schoolYearRows.length - syComplete;
        var syPct = schoolYearRows.length ? Math.round((syComplete / schoolYearRows.length) * 100) : 0;

        var programs = Object.keys(groups[schoolYear]).sort(function(a, b) {
            var ai = programOrder.indexOf(a);
            var bi = programOrder.indexOf(b);
            if (ai === -1 && bi === -1) return a.localeCompare(b);
            if (ai === -1) return 1;
            if (bi === -1) return -1;
            return ai - bi;
        });

        var programHtml = programs.map(function(program) {
            var programRows = [];
            Object.keys(groups[schoolYear][program]).forEach(function(yl) {
                programRows = programRows.concat(groups[schoolYear][program][yl]);
            });
            var complete = programRows.filter(function(s){ return s.status === 'Complete'; }).length;
            var pending = programRows.length - complete;

            var yearLevels = Object.keys(groups[schoolYear][program]).sort(function(a, b) {
                return String(a).localeCompare(String(b), undefined, { numeric: true });
            });

            var yearLevelHtml = yearLevels.map(function(yearLevel) {
                var rows = groups[schoolYear][program][yearLevel].slice().sort(function(a, b) {
                    return String(a.section || '').localeCompare(String(b.section || ''), undefined, { numeric: true })
                        || String(a.name || '').localeCompare(String(b.name || ''));
                });
                var yearComplete = rows.filter(function(s){ return s.status === 'Complete'; }).length;
                var yearPending = rows.length - yearComplete;

                return '<div style="border:1px solid #e5e9f2;border-radius:8px;margin-top:10px;overflow:hidden;background:#fff;">'
                    + '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;background:#f7f9fc;padding:10px 12px;border-bottom:1px solid #e5e9f2;">'
                    + '<strong style="color:#0d2b52;font-size:13px;">' + yearLevel + '</strong>'
                    + '<span style="font-size:11px;color:#666;">' + rows.length + ' total | ' + yearComplete + ' complete | ' + yearPending + ' pending</span>'
                    + '</div>'
                    + '<div class="tbl-wrap" style="box-shadow:none;border-radius:0;">'
                    + '<table><thead><tr><th style="width:42px;"></th><th>ID</th><th>Name</th><th>Section</th><th>Gmail</th><th>Outlook</th><th>Status</th></tr></thead><tbody>'
                    + rows.map(function(s) {
                        var sid = s.id;
                        var idToDisplay = (s.type === 'Teacher') ? s.id : (s.student_id || s.id);
                        return '<tr>'
                            + '<td style="text-align:center;"><input type="checkbox" class="comp-check" data-id="' + sid + '" data-level="' + s.level + '" data-type="' + s.type + '" style="width:16px;height:16px;cursor:pointer;accent-color:var(--sti-blue);" onchange="updateSelectedCount()"></td>'
                            + '<td>' + idToDisplay + '</td>'
                            + '<td>' + (s.name || '-') + '</td>'
                            + '<td>' + (s.section || '-') + '</td>'
                            + '<td style="font-size:12px;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + (s.gmail || '<span style="color:#ccc;">-</span>') + '</td>'
                            + '<td style="font-size:12px;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + (s.outlook_email || '<span style="color:#ccc;">-</span>') + '</td>'
                            + '<td>' + statusBadge(s.status) + '</td>'
                            + '</tr>';
                    }).join('')
                    + '</tbody></table></div></div>';
            }).join('');

            return '<div style="border:1px solid #dce3ef;border-radius:8px;margin-top:12px;background:#fff;overflow:hidden;">'
                + '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;background:#eef3fb;padding:11px 12px;border-bottom:1px solid #dce3ef;">'
                + '<strong style="color:#0d2b52;">' + program + '</strong>'
                + '<span style="font-size:12px;color:#555;">' + programRows.length + ' total | ' + complete + ' complete | ' + pending + ' pending</span>'
                + '</div>'
                + '<div style="padding:10px;">' + yearLevelHtml + '</div>'
                + '</div>';
        }).join('');

        return '<div style="border:1.5px solid #dce3ef;border-radius:8px;margin-bottom:14px;background:#fbfcff;overflow:hidden;">'
            + '<div style="padding:14px 16px;background:#eef3fb;border-left:5px solid #0d2b52;">'
            + '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">'
            + '<h4 style="margin:0;color:#0d2b52;font-size:15px;">School Year ' + schoolYear + '</h4>'
            + '<span style="font-size:12px;color:#555;">' + schoolYearRows.length + ' total | ' + syComplete + ' complete | ' + syPending + ' pending</span>'
            + '</div>'
            + '<div style="height:7px;background:#d8e0ee;border-radius:99px;margin-top:10px;overflow:hidden;"><div style="height:100%;width:' + syPct + '%;background:#27ae60;border-radius:99px;"></div></div>'
            + '</div>'
            + '<div style="padding:12px;">' + programHtml + '</div>'
            + '</div>';
    }).join('');
}
function filterCompliance() {
    var q      = document.getElementById('compSearch').value.trim().toLowerCase();
    var strand = document.getElementById('compStrandFilter').value;
    var level  = document.getElementById('compLevelFilter').value;
    var type   = document.getElementById('compTypeFilter').value;
    var status = document.getElementById('compStatusFilter').value;
    var filtered = allUsers.filter(function(s){
        var matchQ = !q || String(s.name||'').toLowerCase().includes(q) || String(s.id||'').toLowerCase().includes(q) || String(s.strand||'').toLowerCase().includes(q) || String(s.yearLevel||'').toLowerCase().includes(q) || String(s.section||'').toLowerCase().includes(q);
        var matchStrand = !strand || (s.strand === strand || s.course === strand); 
        var matchLevel = !level || s.level === level;
        var matchType = !type || s.type === type;
        var matchStatus = !status || s.status === status;
        return matchQ && matchStrand && matchLevel && matchType && matchStatus;
    });
    renderComplianceTable(filtered);
}

function toggleSelectAll(cb) {
    document.querySelectorAll('.comp-check').forEach(function(c){ c.checked = cb.checked; });
    updateSelectedCount();
}

function updateSelectedCount() {
    var checked = document.querySelectorAll('.comp-check:checked').length;
    var total   = document.querySelectorAll('.comp-check').length;
    document.getElementById('selectedCount').innerText = checked + ' record' + (checked === 1 ? '' : 's') + ' selected';
    var sa = document.getElementById('selectAll');
    if (sa) {
        sa.checked = checked > 0 && checked === total;
        sa.indeterminate = checked > 0 && checked < total;
    }
    updatePendingSelectionButton();
}

function renderExcelFiles() { renderSubmissionReview(); }

function selectPendingOnly() {
    var pendingChecks = Array.from(document.querySelectorAll('.comp-check')).filter(function(c){
        var sid = c.getAttribute('data-id');
        var s = allUsers.find(x => x.id === sid);
        return s && s.status === 'Pending';
    });
    var allPendingSelected = pendingChecks.length > 0 && pendingChecks.every(function(c){ return c.checked; });
    pendingChecks.forEach(function(c){ c.checked = !allPendingSelected; });
    updateSelectedCount();
}

function clearSelection() {
    document.querySelectorAll('.comp-check').forEach(function(c){ c.checked = false; });
    document.getElementById('selectAll').checked = false;
    updateSelectedCount();
}

function clearMessageFields() {
    var subject = document.getElementById('msgSubject');
    var message = document.getElementById('compMessage');
    var template = document.getElementById('msgTemplate');
    if (subject) subject.value = '';
    if (message) message.value = '';
    if (template) template.selectedIndex = 0;
    clearBlastReminderAttachment();
    showToast('Message cleared.');
}

function handleBlastFileSelect(event) {
    var file = event.target.files && event.target.files[0];
    setBlastReminderAttachment(file);
}

function handleBlastFileDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    var zone = document.getElementById('blastFileDrop');
    if (zone) zone.classList.remove('dragover');
    var file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
    setBlastReminderAttachment(file);
}

function handleBlastFileDragOver(event) {
    event.preventDefault();
    var zone = document.getElementById('blastFileDrop');
    if (zone) zone.classList.add('dragover');
}

function handleBlastFileDragLeave(event) {
    event.preventDefault();
    var zone = document.getElementById('blastFileDrop');
    if (zone) zone.classList.remove('dragover');
}

function setBlastReminderAttachment(file) {
    if (!file) return;
    if (file.size > BLAST_ATTACHMENT_MAX_BYTES) {
        showToast('Attachment is too large. Please choose a file 500 KB or smaller.');
        clearBlastReminderAttachment();
        return;
    }
    blastReminderAttachment = {
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
        file: file
    };
    updateBlastAttachmentUi();
}

function clearBlastReminderAttachment(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    blastReminderAttachment = null;
    var input = document.getElementById('blastFileInput');
    if (input) input.value = '';
    updateBlastAttachmentUi();
}

function updateBlastAttachmentUi() {
    var zone = document.getElementById('blastFileDrop');
    var title = document.getElementById('blastFileTitle');
    var hint = document.getElementById('blastFileHint');
    var clear = document.getElementById('blastFileClear');
    if (!zone || !title || !hint || !clear) return;
    if (blastReminderAttachment) {
        zone.classList.add('has-file');
        title.textContent = blastReminderAttachment.name;
        hint.textContent = 'Attached to blast reminder (' + Math.ceil(blastReminderAttachment.size / 1024) + ' KB)';
        clear.style.display = 'inline-flex';
    } else {
        zone.classList.remove('has-file');
        title.textContent = 'Drop a file here or click to attach';
        hint.textContent = 'Optional attachment for this blast reminder. Max 500 KB.';
        clear.style.display = 'none';
    }
}

function updateAttachmentLabel() {
    updateBlastAttachmentUi();
}

function updatePendingSelectionButton() {
    var btn = document.getElementById('pendingSelectBtn');
    if (!btn) return;
    var pendingChecks = Array.from(document.querySelectorAll('.comp-check')).filter(function(c){ // Check all users
        var sid = c.getAttribute('data-id');
        var s = allUsers.find(x => x.id === sid);
        return s && s.status === 'Pending';
    });
    var allPendingSelected = pendingChecks.length > 0 && pendingChecks.every(function(c){ return c.checked; });
    btn.innerHTML = allPendingSelected ? '<i class="fas fa-filter"></i> Unselect Pending' : '<i class="fas fa-filter"></i> Select All Pending';
}

function applyTemplate() {
    var v = document.getElementById('msgTemplate').value;
    if (!v) return;
    var parts = v.split('||');
    var subj = parts[0] || '';
    var body = parts[1] || v;
    var subjEl = document.getElementById('msgSubject');
    if (subjEl && subj) subjEl.value = subj;
    document.getElementById('compMessage').value = body;
}

// ============================================================
//  🆕 PENDING SUBMISSIONS — Email Submission Review
//  Students submit via Gmail/Outlook → nurse approves via bell
// ============================================================

// Simulate a student submission (called from bell demo or real integration)
function simulateStudentSubmission(studentId, fileName, channel, studentMsg) {
    var student = allUsers.find(function(s){ return s.id === studentId; });

    if (!student) { showToast('❌ Student ID not found.'); return; }

    var formData = new FormData();
    formData.append('student_id', studentId);
    formData.append('file_name', fileName || 'medical_requirements.pdf');
    formData.append('message', studentMsg || 'Good day Nurse, here are my requirements. Thank you!');
    formData.append('channel', channel || 'Gmail');

    fetch('add_submission.php', { method: 'POST', body: formData })
    .then(res => res.json())
    .then(data => {
        if (data.status === 'success') {
            loadAccountData(); // Refresh UI to show new submission
            showToast('📩 Simulated submission received from ' + student.name);
        }
    });
}

function approveSubmission(subId) {
    var sub = pendingSubmissions.find(function(s){ return s.id === subId; });
    if (!sub) return;

    var formData = new FormData();
    formData.append('student_id', sub.student_id || sub.studentId);
    formData.append('id', subId);

    fetch('approve_submission.php', { method: 'POST', body: formData })
        .then(function(response) { return response.json(); })
        .then(function(data) {
            if (data.status === 'success') {
                loadAccountData();
                showToast('Approved! Status changed to Complete and the file was saved to the profile.');
            } else {
                showToast(data.message || 'Error approving submission.');
            }
        })
        .catch(function(err) {
            console.error('Approval Error:', err);
            showToast('Could not approve submission.');
        });
}
function rejectSubmission(subId) {
    var sub = pendingSubmissions.find(function(s){ return s.id === subId; });
    if (!sub) return;

    var student = allUsers.find(function(s) { return s.id === (sub.student_id || sub.studentId) || s.student_id === (sub.student_id || sub.studentId); });
    if (!student) { showToast('Student record not found.'); return; }

    var rejectionReason = prompt('Type the reason/reply to send back to ' + (student.name || 'student') + ':');
    if (rejectionReason === null || rejectionReason.trim() === '') return;

    showSendingOverlay(true);

    var formData = new FormData();
    formData.append('id', subId);
    formData.append('student_id', sub.student_id || sub.studentId);
    formData.append('reason', rejectionReason);

    fetch('reject_submission.php', { method: 'POST', body: formData })
    .then(function(response) { return response.json(); })
    .then(function(data) {
        showSendingOverlay(false);
        if (data.status === 'success') {
            loadAccountData();
            showToast('Rejected. Status stays Pending and the reply was sent.');
        } else {
            showToast(data.message || 'There was an error rejecting the submission.');
        }
    })
    .catch(function(err) {
        console.error('Rejection Error:', err);
        showSendingOverlay(false);
        showToast('There was an error rejecting the submission.');
    });
}

function escapeHtml(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function getSubmissionFiles(sub) {
    var raw = sub.file_name || sub.fileName || '';
    return String(raw || '')
        .split(',')
        .map(function(file) { return file.trim(); })
        .filter(function(file) {
            var normalized = file.toLowerCase();
            return file
                && normalized !== 'no_file_attached'
                && normalized !== 'no file attached'
                && normalized !== 'nurse_verified_no_file';
        });
}

function isClinicVerificationSubmission(sub) {
    var rawFile = String((sub && (sub.file_name || sub.fileName)) || '').toLowerCase();
    var channel = String((sub && sub.channel) || '').toLowerCase();
    return rawFile.indexOf('nurse_verified_no_file') >= 0 || channel.indexOf('clinic verification') >= 0;
}

function renderSubmissionFileChips(sub) {
    var files = getSubmissionFiles(sub);
    if (!files.length) {
        return '<div class="sub-file-chip"><i class="fas fa-paperclip"></i> No file attached</div>';
    }
    return files.map(function(fileName) {
        var safeFile = encodeURIComponent(fileName);
        return '<div class="sub-file-chip sub-file-link" title="View Document" onclick="window.open(\'view_upload.php?file='+safeFile+'\', \'_blank\')"><i class="fas fa-file-alt"></i> '+escapeHtml(fileName)+' <small>(Click to view)</small></div>';
    }).join('');
}

function submissionCategoryLabel(record) {
    if (!record) return 'Unassigned';
    var level = record.level || '';
    var type = record.type || '';
    if (type === 'Teacher') return (level === 'Tertiary' ? 'Tertiary Teacher' : 'SHS Teacher');
    if (level === 'SHS') return record.strand || 'SHS Student';
    if (level === 'Tertiary') return record.course || 'Tertiary Student';
    return type || level || 'Unassigned';
}

function senderFirstInitial(name) {
    name = String(name || '').trim();
    if (!name) return '?';
    if (name.indexOf(',') >= 0) {
        var afterComma = name.split(',').slice(1).join(',').trim();
        if (afterComma) return afterComma.charAt(0).toUpperCase();
    }
    return name.charAt(0).toUpperCase();
}

function senderRoleLabel(record) {
    return record && record.type === 'Teacher' ? 'Teacher' : 'Student';
}

function senderProgramLabel(record) {
    if (!record) return 'Unassigned';
    if (record.type === 'Teacher') {
        if (record.level === 'Tertiary') return record.course || record.strand || 'Tertiary Department';
        return record.strand || record.course || 'SHS Department';
    }
    if (record.level === 'SHS') return record.strand || 'No Strand';
    if (record.level === 'Tertiary') return record.course || 'No Course';
    return record.strand || record.course || 'Unassigned';
}

function joinUniqueLabels(labels) {
    var seen = {};
    return labels.filter(function(label) {
        label = String(label || '').trim();
        if (!label) return false;
        var key = label.toLowerCase();
        if (seen[key]) return false;
        seen[key] = true;
        return true;
    }).join(' · ');
}

function isGenericDepartmentLabel(label) {
    label = String(label || '').trim().toLowerCase();
    return label === 'tertiary department' || label === 'shs department';
}

function renderSubmissionReview() {
    var card  = document.getElementById('submissionReviewCard');
    var list  = document.getElementById('submissionList');
    var empty = document.getElementById('submissionEmpty');
    var count = document.getElementById('submissionCount');
    if (!card) return;

    var pending = pendingSubmissions.filter(function(s){ return s.status === 'pending_review'; });

    if (count) count.textContent = pending.length;

    if (pending.length === 0) {
        card.style.display = 'block';
        if (list)  list.innerHTML = '';
        if (empty) empty.style.display = 'block';
        return;
    }

    card.style.display = 'block';
    if (empty) empty.style.display = 'none';

    var STRAND_SC = {ICT:['#dbeafe','#1d4ed8'],STEM:['#dcfce7','#15803d'],ABM:['#fef9c3','#854d0e'],HUMSS:['#fce7f3','#9d174d'],TOP:['#ede9fe','#5b21b6']};

    list.innerHTML = pending.map(function(sub) {
        var sid = sub.student_id || sub.studentId;
        var student = allUsers.find(function(s){ return (s.student_id || s.id) === sid; });
        var record = sub || student || {};
        var strand = record.strand || record.course || 'TOP';
        var studentName = (sub.student_name || sub.studentName || (student ? student.name : '')) || 'Unknown Sender';
        var categoryText = submissionCategoryLabel(record);
        var roleText = senderRoleLabel(record);
        var programText = senderProgramLabel(record);
        var idLabel = roleText + ' ID';
        var programLabel = roleText === 'Teacher' ? 'Teacher Department' : (record.level === 'SHS' ? 'Student Strand' : 'Student Course');
        var messageLabel = roleText + ' Message';
        var metaText = joinUniqueLabels([idLabel + ' ' + sid, categoryText, isGenericDepartmentLabel(programText) ? '' : programText]);
        var programChipHtml = isGenericDepartmentLabel(programText)
            ? ''
            : '<div class="sub-file-chip"><i class="fas fa-layer-group"></i> '+escapeHtml(programLabel)+': '+escapeHtml(programText)+'</div>';
        var sc = STRAND_SC[strand] || ['#f0f4f8','#555'];
        var channel = String(sub.channel || '').toLowerCase();
        var channelIcon = (channel === 'outlook') ? '🔵' : '🔴';
        var initial = senderFirstInitial(studentName);
        var safeSubId = escapeHtml(sub.id);
        
        return '<div class="sub-review-card unread" id="subcard-'+safeSubId+'" style="border-left-color:'+sc[1]+';">'
            + '<div class="sub-review-head">'
            +   '<div class="sub-avatar" style="background:'+sc[0]+';color:'+sc[1]+';">'+escapeHtml(initial)+'</div>'
            +   '<div class="sub-info">'
            +     '<div class="sub-name">'+escapeHtml(studentName)+'</div>'
            +     '<div class="sub-meta">'+escapeHtml(metaText)+'</div>'
            +   '</div>'
            +   '<div class="sub-time">'+escapeHtml(sub.submitted_at || sub.submittedAt || 'Recently')+'</div>'
            + '</div>'
            + '<div class="sub-review-body">'
            +   '<div class="student-msg-box">'
            +     '<strong>'+escapeHtml(messageLabel)+':</strong><br>"' + escapeHtml(sub.message || 'Walang mensaheng kasama.') + '"'
            +   '</div>'
            +   '<div class="sub-file-chip"><i class="fas fa-id-card"></i> '+escapeHtml(idLabel)+': '+escapeHtml(sid)+'</div>'
            +   programChipHtml
            +   renderSubmissionFileChips(sub)
            +   '<div class="sub-file-chip">'+channelIcon+' via '+escapeHtml(sub.channel || 'System')+'</div>'
            +   '<div class="sub-actions" style="margin-top:12px; display:flex; gap:8px;">'
            +     '<button class="btn-approve" onclick="approveSubmission(\''+safeSubId+'\')"><i class="fas fa-check"></i> Approve</button>'
            +     '<button class="btn-reject"  onclick="rejectSubmission(\''+safeSubId+'\')"><i class="fas fa-times"></i> Reject</button>'
            +   '</div>'
            + '</div>'
            + '</div>';
    }).join('');
}

// ============================================================
//  BLAST REMINDER
// ============================================================
function getEmailJsErrorMessage(err) {
    if (!err) return 'Unknown EmailJS error';
    if (typeof err === 'string') return err;
    if (err.text) return err.text;
    if (err.status) return 'Status ' + err.status;
    if (err.message) return err.message;
    try { return JSON.stringify(err); } catch (e) { return 'Unknown EmailJS error'; }
}

function scheduleComplianceReminder() {
    var checks = document.querySelectorAll('.comp-check:checked');
    if (checks.length === 0) { showToast('Please select at least one student first.'); return; }

    var dateEl = document.getElementById('scheduledReminderDate');
    var timeEl = document.getElementById('scheduledReminderTime');
    var scheduledDate = dateEl ? dateEl.value : '';
    var scheduledTime = timeEl ? timeEl.value : '';
    if (!scheduledDate) { showToast('Please choose a schedule date.'); return; }
    if (!scheduledTime) { showToast('Please choose a schedule time.'); return; }

    var msg = (document.getElementById('compMessage').value || '').trim();
    var subjEl = document.getElementById('msgSubject');
    var subject = subjEl ? (subjEl.value.trim() || 'Reminder - STI College Bacoor Clinic') : 'Reminder - STI College Bacoor Clinic';
    var useGmail = document.getElementById('chGmail').checked;
    var useOutlook = document.getElementById('chOutlook').checked;
    if (!msg) { showToast('Please write a message before scheduling.'); return; }
    if (!useGmail && !useOutlook) { showToast('Please select at least one channel.'); return; }

    var channels = [];
    if (useGmail) channels.push('Gmail');
    if (useOutlook) channels.push('Outlook');

    var recipientIds = [];
    Array.from(checks).forEach(function(c) {
        var sid = c.getAttribute('data-id');
        var s = allUsers.find(function(x) { return x.id === sid; });
        if (s && s.status !== 'Complete') recipientIds.push(sid);
    });
    if (recipientIds.length === 0) {
        showToast('Only pending students can be scheduled for reminders.');
        return;
    }

    var formData = new FormData();
    formData.append('scheduled_date', scheduledDate);
    formData.append('scheduled_time', scheduledTime);
    formData.append('recipients_json', JSON.stringify(recipientIds));
    formData.append('channels', channels.join(','));
    formData.append('subject', subject);
    formData.append('message', msg);

    if (blastReminderAttachment && blastReminderAttachment.file) {
        formData.append('attachments[]', blastReminderAttachment.file, blastReminderAttachment.name);
    }

    fetch('save_scheduled_reminder.php', { method: 'POST', body: formData })
        .then(function(response) { return response.json(); })
        .then(function(data) {
            if (data.status !== 'success') {
                showToast(data.message || 'Could not schedule reminder.');
                return;
            }
            showToast('Reminder scheduled for ' + formatScheduledDateTime(scheduledDate, scheduledTime));
            clearSelection();
            if (subjEl) subjEl.value = '';
            document.getElementById('compMessage').value = '';
            var tmpl = document.getElementById('msgTemplate');
            if (tmpl) tmpl.selectedIndex = 0;
            clearBlastReminderAttachment();
            loadAccountData().then(function() {
                runScheduledReminderProcessor(false);
            });
        })
        .catch(function(err) {
            console.error('Schedule reminder error:', err);
            showToast('Server error while scheduling reminder.');
        });
}

function blastReminder() {
    var checks = document.querySelectorAll('.comp-check:checked');
    if (checks.length === 0) { showToast('Please select at least one student first.'); return; }
    var msg    = (document.getElementById('compMessage').value || '').trim();
    var subjEl = document.getElementById('msgSubject');
    var subject = subjEl ? (subjEl.value.trim() || 'Reminder — STI College Bacoor Clinic') : 'Reminder — STI College Bacoor Clinic';
    var priority = document.getElementById('msgPriority').value;
    var attachmentInput = document.getElementById('msgAttachment');
    var attachments = attachmentInput ? attachmentInput.files : [];
    if (!msg) { showToast('Please write a message before sending.'); return; }
    var useGmail   = document.getElementById('chGmail').checked;
    var useOutlook = document.getElementById('chOutlook').checked;
    if (!useGmail && !useOutlook) { showToast('Please select at least one channel.'); return; }
    var channels = [];
    if (useGmail)   channels.push('Gmail');
    if (useOutlook) channels.push('Outlook');

    // Adjust subject based on priority
    if (priority === 'urgent') {
        subject = 'URGENT: ' + subject;
    } else if (priority === 'final') {
        subject = 'FINAL NOTICE: ' + subject;
    }

    showSendingOverlay(true);
    var recipientNames = [];
    var sendPromises   = [];
    var skipped        = [];
    var successCount   = 0;
    var failCount      = 0;
    var pendingRecipients = [];

    // Handle attachments: convert to base64
    var attachmentPromises = [];
    for (let i = 0; i < attachments.length; i++) {
        let file = attachments[i];
        attachmentPromises.push(new Promise(function(resolve, reject) {
            let reader = new FileReader();
            reader.onload = function(e) {
                resolve({
                    name: file.name,
                    filename: file.name,
                    type: file.type || 'application/octet-stream',
                    data: e.target.result,
                    path: e.target.result
                });
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        }));
    }

    Promise.all(attachmentPromises).then(function(attachmentData) {
        Array.from(checks).forEach(function(c) {
            var sid = c.getAttribute('data-id'); // Get ID from checkbox
            var s   = allUsers.find(x => x.id === sid); // Find user in allUsers
            if (!s) return;
            // Strictly send only to Pending students
            if (s.status === 'Complete') {
                skipped.push(s.name + ' (already complete)');
                return;
            }
            recipientNames.push(s.name);
            pendingRecipients.push(s);

            var baseParams = {
                email: '',
                name: s.name,
                subject: subject,
                message: msg.replace(/\{\{to_name\}\}/g, s.name),
                from_name: 'STI College Bacoor Clinic'
            };
            if (attachmentData.length > 0) {
                baseParams.attachments = attachmentData;
                baseParams.attachment = attachmentData;
            }

            if (useGmail) {
                if (s.gmail) {
                    var gmailParams = Object.assign({}, baseParams, { email: s.gmail });
                    var p1 = emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, gmailParams)
                        .then(function(){ successCount++; })
                        .catch(function(err){
                            failCount++;
                            var errMsg = getEmailJsErrorMessage(err);
                            skipped.push(s.name + ' Gmail failed: ' + errMsg);
                            console.error('EmailJS Gmail error:', err);
                        });
                    sendPromises.push(p1);
                } else { skipped.push(s.name + ' (no Gmail)'); }
            }
            if (useOutlook) {
                if (s.outlook_email) {
                    var outlookParams = Object.assign({}, baseParams, { email: s.outlook_email });
                    var p2 = emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, outlookParams)
                        .then(function(){ successCount++; })
                        .catch(function(err){
                            failCount++;
                            var errMsg = getEmailJsErrorMessage(err);
                            skipped.push(s.name + ' Outlook failed: ' + errMsg);
                            console.error('EmailJS Outlook error:', err);
                        });
                    sendPromises.push(p2);
                } else { skipped.push(s.name + ' (no Outlook)'); }
            }
        });

        if (pendingRecipients.length === 0) {
            showSendingOverlay(false);
            showToast('Only pending students without submitted medicals can receive reminders.');
            return;
        }

        Promise.allSettled(sendPromises).then(function() {
            showSendingOverlay(false);
            var log = {
                datetime: new Date().toLocaleString(),
                recipients: recipientNames.join(', '),
                channels: channels.join(', '),
                subject: subject,
                message: msg,
                success: successCount,
                failed: failCount,
                skipped: skipped.join(', ')
            };
            var logData = new FormData();
            logData.append('recipients', log.recipients);
            logData.append('channels', log.channels);
            logData.append('subject', log.subject);
            logData.append('message', log.message);
            logData.append('success', log.success);
            logData.append('failed', log.failed);

            fetch('save_reminder_log.php', { method: 'POST', body: logData })
                .then(function(response){ return response.json(); })
                .then(function(data) {
                    loadAccountData(); // Refresh records from DB to ensure persistence
                    renderReminderLog();
                    var toast = 'Reminder sent: ' + successCount + ' success, ' + failCount + ' failed';
                    if (skipped.length) toast += ' | Skipped: ' + skipped.join(', ');
                    if (data.status !== 'success') toast += ' | Log not saved';
                    showToast(toast);
                })
                .catch(function() {
                    renderReminderLog();
                    var toast = 'Reminder sent: ' + successCount + ' success, ' + failCount + ' failed';
                    if (skipped.length) toast += ' | Skipped: ' + skipped.join(', ');
                    toast += ' | Log not saved';
                    showToast(toast);
                })
                .finally(function() {
                    clearSelection();
                    document.getElementById('compMessage').value = '';
                    if (subjEl) subjEl.value = '';
                    var tmpl = document.getElementById('msgTemplate');
                    if (tmpl) tmpl.selectedIndex = 0;
                    // Clear attachment
                    if (attachmentInput) attachmentInput.value = '';
                    updateAttachmentLabel();
                });
        });
    }).catch(function(err) {
        showSendingOverlay(false);
        showToast('Error processing attachments: ' + err.message);
    });
}

function blastReminder() {
    var checks = document.querySelectorAll('.comp-check:checked');
    if (checks.length === 0) { showToast('Please select at least one student first.'); return; }

    var msg = (document.getElementById('compMessage').value || '').trim();
    var subjEl = document.getElementById('msgSubject');
    var subject = subjEl ? (subjEl.value.trim() || 'Reminder - STI College Bacoor Clinic') : 'Reminder - STI College Bacoor Clinic';
    if (!msg) { showToast('Please write a message before sending.'); return; }

    var useGmail = document.getElementById('chGmail').checked;
    var useOutlook = document.getElementById('chOutlook').checked;
    if (!useGmail && !useOutlook) { showToast('Please select at least one channel.'); return; }

    var skipped = [];
    var recipientNames = [];
    var pendingRecipients = [];
    var recipients = [];

    Array.from(checks).forEach(function(c) {
        var sid = c.getAttribute('data-id');
        var s = allUsers.find(function(x) { return x.id === sid; });
        if (!s) return;
        if (s.status === 'Complete') {
            skipped.push(s.name + ' (already complete)');
            return;
        }

        recipientNames.push(s.name);
        pendingRecipients.push(s);

        if (useGmail) {
            if (s.gmail) recipients.push({ id: s.student_id || s.id, name: s.name, email: s.gmail, channel: 'Gmail' });
            else skipped.push(s.name + ' (no Gmail)');
        }
        if (useOutlook) {
            if (s.outlook_email) recipients.push({ id: s.student_id || s.id, name: s.name, email: s.outlook_email, channel: 'Outlook' });
            else skipped.push(s.name + ' (no Outlook)');
        }
    });

    if (pendingRecipients.length === 0 || recipients.length === 0) {
        showToast('Only pending students with email addresses can receive reminders.');
        return;
    }

    var formData = new FormData();
    formData.append('recipients', JSON.stringify(recipients));
    formData.append('subject', subject);
    formData.append('message', msg);
    if (blastReminderAttachment && blastReminderAttachment.file) {
        formData.append('attachments', blastReminderAttachment.file, blastReminderAttachment.name);
    }

    showSendingOverlay(true);
    fetch('send_blast_reminder.php', { method: 'POST', body: formData })
        .then(function(response){ return response.json(); })
        .then(function(data) {
            showSendingOverlay(false);
            if (data.status !== 'success') {
                showToast('Reminder failed: ' + (data.message || 'Unknown server error'));
                return;
            }

            var successCount = parseInt(data.success) || 0;
            var failCount = parseInt(data.failed) || 0;
            if (Array.isArray(data.skipped)) skipped = skipped.concat(data.skipped);

            loadAccountData();
            renderReminderLog();
            var toast = 'Reminder sent: ' + successCount + ' success, ' + failCount + ' failed';
            if (skipped.length) toast += ' | Skipped: ' + skipped.join(', ');
            showToast(toast);
        })
        .catch(function(err) {
            showSendingOverlay(false);
            console.error('Blast reminder error:', err);
            showToast('Reminder failed: server connection error.');
        })
        .finally(function() {
            clearSelection();
            document.getElementById('compMessage').value = '';
            if (subjEl) subjEl.value = '';
            var tmpl = document.getElementById('msgTemplate');
            if (tmpl) tmpl.selectedIndex = 0;
            clearBlastReminderAttachment();
        });
}

function showSendingOverlay(show) {
    var overlay = document.getElementById('sendingOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'sendingOverlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:99999;display:flex;align-items:center;justify-content:center;';
        overlay.innerHTML = '<div style="background:white;border-radius:20px;padding:40px 48px;text-align:center;box-shadow:0 24px 64px rgba(0,0,0,0.25);max-width:340px;width:90%;"><div style="font-size:42px;margin-bottom:14px;">📨</div><div style="font-size:17px;font-weight:700;color:#0d2b52;margin-bottom:8px;">Sending Message</div><div style="font-size:13px;color:#888;margin-bottom:20px;">Please wait while the message is being delivered.</div><div style="height:5px;background:#e8ecf4;border-radius:4px;overflow:hidden;"><div id="loadBarInner" style="height:100%;width:45%;background:linear-gradient(90deg,#0d2b52,#ffcb05);border-radius:4px;animation:loadBar 1.4s ease-in-out infinite;"></div></div></div>';
        var style = document.createElement('style');
        style.textContent = '@keyframes loadBar{0%{transform:translateX(-120%)}100%{transform:translateX(280%)}}';
        document.head.appendChild(style);
        document.body.appendChild(overlay);
    }
    overlay.style.display = show ? 'flex' : 'none';
}

function formatScheduledDateTime(dateValue, timeValue) {
    if (!dateValue) return '';
    var time = (timeValue || '00:00').substring(0, 5);
    var date = new Date(dateValue + 'T' + time);
    if (isNaN(date.getTime())) return dateValue + ' ' + time;
    return date.toLocaleString([], {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });
}

function renderScheduledReminders() {
    var tbody = document.getElementById('scheduledReminderList');
    var empty = document.getElementById('scheduledReminderEmpty');
    if (!tbody) return;
    if (!scheduledReminders || scheduledReminders.length === 0) {
        tbody.innerHTML = '';
        if (empty) empty.style.display = 'block';
        return;
    }
    if (empty) empty.style.display = 'none';
    tbody.innerHTML = scheduledReminders.map(function(item) {
        var preview = item.message ? (item.message.length > 60 ? item.message.substring(0, 60) + '...' : item.message) : '';
        var subject = item.subject || '-';
        return '<tr>'
            + '<td class="reminder-date-cell">' + formatScheduledDateTime(item.scheduled_date, item.scheduled_time) + '</td>'
            + '<td><span class="channel-pill">' + item.channels + '</span></td>'
            + '<td class="reminder-message-cell"><strong>' + subject + '</strong><span>' + preview + '</span></td>'
            + '<td>' + scheduleStatusBadge(item.status) + '</td>'
            + '</tr>';
    }).join('');
}

function renderReminderLog() {
    var tbody = document.getElementById('reminderLog');
    var empty = document.getElementById('logEmpty');
    var visibleLogs = (reminderLogs || []).filter(shouldShowReminderLogItem);
    if (visibleLogs.length === 0) {
        tbody.innerHTML = '';
        if (empty) empty.style.display = 'block';
        return;
    }
    if (empty) empty.style.display = 'none';
    tbody.innerHTML = visibleLogs.map(function(log) {
        var preview = log.message ? (log.message.length > 60 ? log.message.substring(0,60)+'...' : log.message) : '';
        var subj    = log.subject || '—';
        var recipientInfo = parseReminderRecipients(log.recipients);
        var recipText = recipientInfo.names.join('; ');
        var recipLabel = reminderRecipientLabel(recipientInfo.records, recipientInfo.names.length);
        
        var resultHTML = reminderResultHtml(log.success, log.failed, log.skipped, subj);

        return '<tr>'
            +'<td class="reminder-date-cell">'+log.datetime+'</td>'
            +'<td class="reminder-recipient-cell"><strong>'+recipLabel+'</strong><div>'+recipText+'</div></td>'
            +'<td><span class="channel-pill">'+log.channels+'</span></td>'
            +'<td class="reminder-message-cell"><strong>'+subj+'</strong><span>'+preview+'</span></td>'
            +'<td>'+resultHTML+'</td>'
            +'</tr>';
    }).join('');
}

function clearReminderLogs() {
    if (!confirm('Are you sure you want to clear all reminder logs for testing?')) return;
    console.log('Attempting to clear reminder logs...'); // Added for debugging
    fetch('clear_reminder_logs.php')
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                reminderLogs = [];
                renderReminderLog();
                showToast('Reminder logs cleared successfully.');
            } else {
                showToast('Failed to clear logs.');
                console.error('Failed to clear logs:', data.message); // Log error message from server
            }
        })
        .catch(err => { console.error('Clear logs fetch error:', err); showToast('Server error clearing logs.'); });
}

// ============================================================
//  DASHBOARD
// ============================================================
function filterDashTable() {
    var typeFilter = document.getElementById('dashTypeFilter').value;
    var filteredData = allUsers;
    if (typeFilter !== 'All') {
        filteredData = allUsers.filter(u => u.type === typeFilter);
    }
    renderDashRows(filteredData);
}

function filterArchive(query) {
    var q = (query || '').trim().toLowerCase();
    if (!q) { renderArchiveRows(archives); return; }
    renderArchiveRows(archives.filter(function(s){
        return String(s.name||'').toLowerCase().includes(q)
            || String(s.id||'').toLowerCase().includes(q)
            || String(s.strand||'').toLowerCase().includes(q)
            || String(s.status||'').toLowerCase().includes(q)
            || String(s.yearLevel||'').toLowerCase().includes(q)
            || String(s.section||'').toLowerCase().includes(q);
    }));
}

// ============================================================
//  CHART — Stacked bar: Complete vs Pending per Strand
// ============================================================
var overallChart; // Declare overallChart globally
var shsStrandChart; // Declare shsStrandChart globally

function initOverallChart() {
    var ctx = document.getElementById('overallDistributionChart').getContext('2d');
    if (!ctx) return;
    
    var session = getUserSession();
    var ct = (session && session.default_chart) ? session.default_chart : 'bar';

    var chartData = {
        labels: ALL_CATEGORIES,
        datasets: [{
            label: 'Total Users',
            data: ALL_CATEGORIES.map(cat => 0),
            backgroundColor: ALL_CATEGORIES.map(cat => CATEGORY_COLORS[cat]),
            borderColor: '#fff',
            borderWidth: 2
        }]
    };

    var chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: ct === 'bar' ? 'y' : 'x', // Horizontal bars look cleaner for categories
        plugins: {
            tooltip: {
                backgroundColor: 'rgba(13, 43, 82, 0.9)',
                titleFont: { size: 14, weight: 'bold' },
                bodyFont: { size: 13 },
                padding: 12,
                cornerRadius: 8,
                callbacks: {
                    label: function(context) {
                        let label = context.label || '';
                        let value = context.raw || 0;
                        let total = context.dataset.data.reduce((a, b) => a + b, 0);
                        let percentage = total > 0 ? ((value / total) * 100).toFixed(1) + '%' : '0.0%';
                        if (ct === 'bar') return ' ' + value + ' Users (' + percentage + ')';
                        return label + ': ' + value + ' (' + percentage + ')';
                    }
                }
            },
            legend: { // Consolidated legend definition
                display: (ct !== 'bar'), // Hide legend for bar chart, show for others by default
                position: 'right',
                labels: { 
                    font: { family: "'Poppins', sans-serif", size: 12 },
                    usePointStyle: (ct === 'doughnut' || ct === 'pie') // Use point style for pie/doughnut
                }
            }
        }
    };

    // Specific options for different chart types
    if (ct === 'bar') {
        chartOptions.scales = {
            x: {
                beginAtZero: true,
                ticks: { stepSize: 1, font: { family: "'Poppins', sans-serif", weight: '500' } },
                grid: { display: false }
            },
            y: {
                beginAtZero: true,
                ticks: { stepSize: 1, font: { family: "'Poppins', sans-serif" } },
                grid: { color: 'rgba(0, 0, 0, 0.1)', display: false }
            }
        };
        chartData.datasets[0].barThickness = 25;
        chartData.datasets[0].borderRadius = 5;
        chartData.datasets[0].borderWidth = 1; // Thicker border for bars
    } else if (ct === 'doughnut' || ct === 'pie') {
        chartOptions.cutout = (ct === 'doughnut') ? '50%' : '0%';
        delete chartOptions.scales; // Radial charts cannot have scales
    }

    overallChart = new Chart(ctx, {
        type: ct,
        data: chartData,
        options: chartOptions
    });
}

function updateOverallChart() {
    var session = getUserSession();
    var ct = (session && session.default_chart) ? session.default_chart : 'bar';

    if (overallChart) {
        overallChart.destroy();
        overallChart = null;
    }
    initOverallChart();
    if (!overallChart) return;

    overallChart.data.datasets[0].data = [
        shsStudents.length,
        shsTeachers.length,
        collegeStudents.length,
        collegeTeachers.length
    ];
    overallChart.update();
    renderOverallLegend();
}
function resetAllRecords() {
    if (!confirm("⚠️ Are you sure you want to RESET ALL RECORDS? This action cannot be undone.")) return;
    fetch('reset_records.php', { method: 'POST' })
    .then(res => res.json())
    .then(data => {
        if (data.status === 'success') {
            showToast("🗑️ All records have been cleared.");
            loadAccountData();
        } else {
            showToast("❌ Error: " + data.message);
        }
    });
}

function renderOverallLegend() {
    var total = shsStudents.length + shsTeachers.length + collegeStudents.length + collegeTeachers.length;
    var el = document.getElementById('overallLegend');
    if (!el) return;
    
    el.innerHTML = ALL_CATEGORIES.map(cat => {
        var count = 0;
        if(cat === 'SHS Students') count = shsStudents.length;
        if(cat === 'SHS Teachers') count = shsTeachers.length;
        if(cat === 'Tertiary Students') count = collegeStudents.length;
        if(cat === 'Tertiary Teachers') count = collegeTeachers.length;
        
        var pct = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';
        var color = CATEGORY_COLORS[cat];
        
        return '<div class="strand-legend-item">' +
            '<div class="leg-color" style="background:'+color+';"></div>' +
            '<div class="leg-bar-wrap">' +
                '<div class="leg-label"><span><b>'+cat+'</b></span><span>'+count+'</span></div>' +
                '<div class="leg-bar-bg"><div class="leg-bar-fill" style="width:'+pct+'%;background:'+color+';"></div></div>' +
                '<div class="leg-pct">'+pct+'%</div>' +
            '</div>' +
        '</div>';
    }).join('');
}

// Existing chart for SHS Strands (repurposed from original initChart)
function initSHSStrandChart() {
    var canvas = document.getElementById('shsStrandDistributionChart');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var session = getUserSession();
    var ct  = (session && session.default_chart) ? session.default_chart : 'bar';
    var chartOptions = {
        responsive: true, maintainAspectRatio: false,
        plugins: {
            legend: { // Consolidated legend definition
                display: true,
                position: 'top', // Default position for SHS chart
                labels: {
                    font: { family: "'Poppins', sans-serif", size: 11 },
                    boxWidth: 12,
                    usePointStyle: true, // Use point style for all SHS chart legends
                    generateLabels: function(chart) {
                        const data = chart.data;
                        if (data.datasets.length && (chart.config.type === 'pie' || chart.config.type === 'doughnut')) {
                            return data.datasets.map((dataset, i) => ({
                                text: dataset.label,
                                fillStyle: dataset.backgroundColor[0],
                                strokeStyle: dataset.borderColor,
                                lineWidth: dataset.borderWidth,
                                hidden: !chart.isDatasetVisible(i),
                                index: i
                            }));
                        }
                        // For bar chart, use default label generation
                        return Chart.defaults.plugins.legend.labels.generateLabels(chart); 
                    }
                }
            },
            tooltip: {
                backgroundColor: 'rgba(13, 43, 82, 0.9)',
                padding: 12,
                cornerRadius: 8,
                bodyFont: { family: "'Poppins', sans-serif" },
                titleFont: { family: "'Poppins', sans-serif", weight: 'bold' },
                callbacks: {
                    label: function(context) {
                        let label = context.dataset.label || '';
                        let value = context.parsed.y !== undefined ? context.parsed.y : context.parsed; // For stacked bar, use y; for others, use parsed
                        let total = context.dataset.data.reduce((a, b) => a + b, 0);
                        let percentage = total > 0 ? ((value / total) * 100).toFixed(1) + '%' : '0.0%';
                        if (ct === 'bar') return ' ' + label + ': ' + value + ' (' + percentage + ')';
                        return context.label + ': ' + value + ' (' + percentage + ')';
                    }
                }
            }
        }
    };

    var completeCounts = SHS_STRANDS.map(function(st){ return shsStudents.filter(function(s){ return s.strand===st && s.status==='Complete'; }).length; });
    var pendingCounts  = SHS_STRANDS.map(function(st){ return shsStudents.filter(function(s){ return s.strand===st && s.status!=='Complete'; }).length; });

    var chartData = {
        labels: SHS_STRANDS,
        datasets: []
    };

    if (ct === 'bar') {
        chartData.datasets.push(
            { label: '✅ Complete', data: completeCounts, backgroundColor: '#2ecc71', borderRadius: 5, barThickness: 20, borderWidth: 1, borderColor: '#fff' },
            { label: '⏳ Pending',  data: pendingCounts,  backgroundColor: '#e74c3c', borderRadius: 5, barThickness: 20, borderWidth: 1, borderColor: '#fff' }
        );
        chartOptions.scales = {
            x: { 
                stacked: true, 
                grid: { display: false },
                ticks: { font: { family: "'Poppins', sans-serif", weight: '600' } }
            },
            y: { 
                stacked: true, 
                beginAtZero: true, 
                ticks: { stepSize: 1, font: { family: "'Poppins', sans-serif" } },
                grid: { color: 'rgba(0, 0, 0, 0.1)' }
            }
        };
    } else { // doughnut or pie
        chartData.datasets.push(
            { label: '✅ Complete', data: completeCounts, backgroundColor: SHS_STRANDS.map(function(){ return '#2ecc71'; }), borderWidth: 1, borderColor: '#fff' },
            { label: '⏳ Pending',  data: pendingCounts,  backgroundColor: SHS_STRANDS.map(function(){ return '#e74c3c'; }), borderWidth: 1, borderColor: '#fff' }
        );
        chartOptions.cutout = (ct === 'doughnut') ? '50%' : '0%'; 
        chartOptions.plugins.legend.position = 'right';
        if (chartOptions.scales) delete chartOptions.scales;
    }
    
    shsStrandChart = new Chart(ctx, {
        type: ct,
        data: chartData,
        options: chartOptions
    });
    renderSHSStrandLegend(); // Ensure legend is rendered on init
}
function updateSHSStrandChart() { // Renamed from updateChart
    var session = getUserSession();
    var ct = (session && session.default_chart) ? session.default_chart : 'bar';

    if (shsStrandChart) {
        shsStrandChart.destroy();
        shsStrandChart = null;
    }
    
    initSHSStrandChart();
    renderSHSStrandLegend();
}

function renderSHSStrandLegend() { // Renamed from renderLegend
    var total = shsStudents.length;
    var el = document.getElementById('shsStrandLegend');
    if (!el) return;
    el.innerHTML = SHS_STRANDS.map(function(s,i){
        var count   = shsStudents.filter(function(st){ return st.strand===s; }).length;
        var done    = shsStudents.filter(function(st){ return st.strand===s && st.status==='Complete'; }).length;
        var pct     = total > 0 ? ((count/total)*100).toFixed(1) : '0.0';
        return '<div class="strand-legend-item"><div class="leg-color" style="background:'+SCOLORS[i]+';"></div><div class="leg-bar-wrap"><div class="leg-label"><span><b>'+s+'</b></span><span>'+count+' ('+done+' done)</span></div><div class="leg-bar-bg"><div class="leg-bar-fill" style="width:'+pct+'%;background:'+SCOLORS[i]+';"></div></div><div class="leg-pct">'+pct+'%</div></div></div>';
    }).join('');
}

function updateStats() {
    var totalActiveUsers = allUsers.filter(u => u.is_archived == 0).length;
    var pending = allUsers.filter(function(x){ return x.status==='Pending' && x.is_archived == 0; }).length;
    document.getElementById('total-count').innerText = totalActiveUsers;
    document.getElementById('compliant-count').innerText = totalActiveUsers - pending;
    document.getElementById('pending-count').innerText = pending;
    updateBellNotif();
}

// ============================================================
//  NOTIFICATION BELL — Pending Students + Submissions
// ============================================================
var BELL_SC = {ICT:{bg:'#dbeafe',text:'#1d4ed8'},STEM:{bg:'#dcfce7',text:'#15803d'},ABM:{bg:'#fef9c3',text:'#854d0e'},HUMSS:{bg:'#fce7f3',text:'#9d174d'},TOP:{bg:'#ede9fe',text:'#5b21b6'}};
var BELL_ICONS = {ICT:'💻',STEM:'🔬',ABM:'📊',HUMSS:'📚',TOP:'🌟'};

function updateBellNotif() {
    var pendingUsers  = allUsers.filter(function(s){ return s.status === 'Pending' && s.is_archived == 0; }); // All pending active users
    var pendingSubs      = pendingSubmissions.filter(function(s){ return s.status === 'pending_review'; });
    var scheduledResults = (scheduledReminders || []).filter(function(item) {
        var status = String(item.status || '').toLowerCase();
        return item.sent_at && (status === 'sent' || status === 'failed');
    });
    var totalNotif       = pendingUsers.length + pendingSubs.length + scheduledResults.length;

    var badge   = document.getElementById('bellBadge');
    var countEl = document.getElementById('notifCount');
    var listEl  = document.getElementById('notifList');
    if (!badge) return;

    if (totalNotif > 0) {
        badge.style.display = 'flex';
        badge.innerText = totalNotif > 99 ? '99+' : String(totalNotif);
    } else {
        badge.style.display = 'none';
    }
    if (countEl) countEl.innerText = totalNotif;
    if (!listEl) return;

    if (totalNotif === 0) {
        listEl.innerHTML = '<div class="hs-notif-empty"><i class="fas fa-check-circle"></i><p>No pending students, submissions, or scheduled reminder results.</p></div>';
        return;
    } 

    var html = '';

    // ── Section 1: Pending Submissions (Approval needed) ──
    if (pendingSubs.length > 0) { // Submissions are for any user type
        html += '<div class="hs-strand-label"><span>📩</span><span>Submissions for Approval</span><span style="margin-left:auto;color:#2ecc71;font-weight:800;">'+pendingSubs.length+'</span></div>';
        pendingSubs.forEach(function(sub, i) {
            var sc = BELL_SC[sub.strand || sub.course] || {bg:'#f0f0f0',text:'#666'}; // Use strand or course
            var safeSubId = escapeHtml(sub.id);
            var files = getSubmissionFiles(sub);
            var fileLabel = files.length ? files.join(', ') : 'No file attached';
            var messagePreview = String(sub.message || '').replace(/\s+/g, ' ').trim();
            if (messagePreview.length > 120) messagePreview = messagePreview.substring(0, 117) + '...';
            html += '<div class="hs-notif-item approval" style="animation-delay:'+(i*35)+'ms">'
                +   '<div class="hs-notif-avatar" style="background:'+sc.bg+';color:'+sc.text+';">'+escapeHtml(sub.studentName?sub.studentName.charAt(0).toUpperCase():'?')+'</div>'
                +   '<div class="hs-notif-info">'
                +     '<div class="hs-notif-name">'+escapeHtml(sub.studentName)+'</div>'
                +     '<div class="hs-notif-meta">📎 '+escapeHtml(fileLabel)+' via '+escapeHtml(sub.channel)+'</div>'
                +     '<div class="hs-notif-message">'+escapeHtml(messagePreview || 'No message body provided.')+'</div>'
                +   '</div>'
                +   '<div class="hs-notif-actions">'
                +     '<button class="hs-notif-action-btn hs-notif-approve-btn" onclick="approveSubmission(\''+safeSubId+'\');toggleNotifPanel();">✓ Approve</button>'
                +     '<button class="hs-notif-action-btn hs-notif-reject-btn" onclick="rejectSubmission(\''+safeSubId+'\');toggleNotifPanel();">Reject</button>'
                +   '</div>'
                + '</div>';
        });
    }

    // Scheduled compliance reminders appear here only after the automatic processor runs.
    if (scheduledResults.length > 0) {
        html += '<div class="hs-strand-label"><span><i class="fas fa-clock-rotate-left"></i></span><span>Scheduled Reminder Results</span><span style="margin-left:auto;color:#0d9488;font-weight:800;">'+scheduledResults.length+'</span></div>';
        scheduledResults.slice(0, 8).forEach(function(item, i) {
            var status = String(item.status || '').toLowerCase();
            var ok = status === 'sent';
            var sent = parseInt(item.success, 10) || 0;
            var failed = parseInt(item.failed, 10) || 0;
            var statusText = ok ? 'Sent' : (status === 'failed' ? 'Failed' : 'Skipped');
            html += '<div class="hs-notif-item scheduled-result" style="animation-delay:'+(i*35)+'ms">'
                +   '<div class="hs-notif-avatar '+(ok ? 'scheduled-ok' : 'scheduled-fail')+'"><i class="fas '+(ok ? 'fa-check' : 'fa-times')+'"></i></div>'
                +   '<div class="hs-notif-info">'
                +     '<div class="hs-notif-name">'+statusText+' automatic reminder</div>'
                +     '<div class="hs-notif-meta">'+sent+' sent · '+failed+' failed · '+formatScheduledDateTime(item.scheduled_date, item.scheduled_time)+'</div>'
                +   '</div>'
                +   scheduleStatusBadge(status)
                + '</div>';
        });
    }

    // ── Section 2: Pending (no submission yet) ──
    if (pendingUsers.length > 0) {
        var groups = {};
        pendingUsers.forEach(function(s){ var st=s.level + ' ' + s.type + (s.strand ? ' ' + s.strand : '') + (s.course ? ' ' + s.course : ''); if(!groups[st]) groups[st]=[]; groups[st].push(s); });
        html += '<div class="hs-strand-label"><span>⏳</span><span>No Submission Yet</span><span style="margin-left:auto;color:#e74c3c;font-weight:800;">'+pendingUsers.length+'</span></div>';
        Object.keys(groups).forEach(function(st) { // Group by level, type, and strand/course
            var sc = BELL_SC[st] || {bg:'#f0f0f0',text:'#666'};
            var icon = BELL_ICONS[st] || '';
            html += '<div class="hs-strand-label" style="font-size:10px;opacity:.7;"><span>'+icon+'</span><span>'+st+'</span><span style="margin-left:auto;color:#e74c3c;font-weight:800;">'+groups[st].length+'</span></div>';
            groups[st].forEach(function(s,i){
                html += '<div class="hs-notif-item" style="animation-delay:'+(i*35)+'ms">'
                    +   '<div class="hs-notif-avatar" style="background:'+sc.bg+';color:'+sc.text+';">'+(s.name?s.name.charAt(0).toUpperCase():'?')+'</div>'
                    +   '<div class="hs-notif-info"><div class="hs-notif-name">'+(s.name||'—')+'</div><div class="hs-notif-meta">ID '+s.id+(s.yearLevel?' · '+s.yearLevel:'')+(s.section?' · '+s.section:'')+'</div></div>'
                    +   '<div class="hs-notif-pip"></div>'
                    + '</div>';
            });
        });
    }

    listEl.innerHTML = html;
}

// Function to show student profile in a modal
function showStudentProfileModal(studentId) {
    var student = allUsers.find(function(s) { return s.id === studentId || s.student_id === studentId; });
    if (!student) {
        showToast('Student not found.');
        return;
    }

    document.getElementById('profName').innerText = student.name;
    document.getElementById('profRole').innerText = student.type + (student.level ? ' - ' + student.level : '');

    var avatarEl = document.getElementById('profAvatar');
    if (avatarEl) {
        // Assuming students don't have photos stored in the system,
        // display initials. If they do, you'd fetch it here.
        avatarEl.style.backgroundImage = '';
        avatarEl.innerText = (student.name || 'U').charAt(0).toUpperCase();
        avatarEl.style.backgroundSize = 'cover';
    }

    var programLabel = student.strand || student.course || 'N/A';
    var submittedItems = pendingSubmissions.filter(function(sub) {
        var sid = sub.student_id || sub.studentId;
        var status = String(sub.status || '').toLowerCase();
        return String(sid || '') === String(student.student_id || student.id || '')
            && (status === 'approved' || status === 'complete');
    });
    var realFileItems = submittedItems.filter(function(sub) {
        return getSubmissionFiles(sub).length > 0;
    });
    var displaySubmissionItems = realFileItems.length
        ? realFileItems
        : submittedItems.filter(isClinicVerificationSubmission);
    var submittedHtml = displaySubmissionItems.length
        ? displaySubmissionItems.map(function(sub) {
            var files = getSubmissionFiles(sub);
            var filesHtml = files.length ? files.map(function(fileName) {
                var safeFile = encodeURIComponent(fileName);
                return '<a class="profile-file-link" href="view_upload.php?file=' + safeFile + '" target="_blank"><i class="fas fa-file-alt"></i><span>' + escapeHtml(fileName) + '</span></a>';
            }).join('<br>') : '<span class="profile-verified-note"><i class="fas fa-check-circle"></i> Verified</span>';
            return '<div class="profile-submission-item">'
                + '<div class="profile-detail-row"><span>File Requirement</span><strong>' + filesHtml + '</strong></div>'
                + '</div>';
        }).join('')
        : '<div class="profile-detail-row"><span>Submitted Requirements</span><strong>None submitted yet</strong></div>';
    var detailsHtml = ''
        + '<div class="profile-detail-section">'
        + '<h4><i class="fas fa-id-card"></i> Information</h4>'
        + '<div class="profile-detail-row"><span>Teacher ID / Student ID</span><strong>' + (student.student_id || student.id || 'N/A') + '</strong></div>'
        + '<div class="profile-detail-row"><span>Level</span><strong>' + (student.level || 'N/A') + '</strong></div>'
        + '<div class="profile-detail-row"><span>Type</span><strong>' + (student.type || 'N/A') + '</strong></div>'
        + '<div class="profile-detail-row"><span>Program</span><strong>' + programLabel + '</strong></div>'
        + '<div class="profile-detail-row"><span>Year Level</span><strong>' + (student.yearLevel || 'N/A') + '</strong></div>'
        + '<div class="profile-detail-row"><span>Section</span><strong>' + (student.section || 'N/A') + '</strong></div>'
        + '</div>'
        + '<div class="profile-detail-section">'
        + '<h4><i class="fas fa-notes-medical"></i> Medical Records</h4>'
        + '<div class="profile-detail-row"><span>Compliance Status</span><strong>' + statusBadge(student.status) + '</strong></div>'
        + '<div class="profile-detail-row"><span>Allergies</span><strong>' + (student.allergies || 'None recorded') + '</strong></div>'
        + '<div class="profile-detail-row"><span>Mental State</span><strong>' + (student.mental_state || 'None recorded') + '</strong></div>'
        + '</div>'
        + '<div class="profile-detail-section">'
        + '<h4><i class="fas fa-folder-open"></i> Submitted Requirements</h4>'
        + submittedHtml
        + '</div>'
        + '<div class="profile-detail-section">'
        + '<h4><i class="fas fa-phone profile-emergency-icon"></i> Emergency Contact</h4>'
        + '<div class="profile-detail-row"><span>Emergency Contact</span><strong>' + (student.emergency_contact || 'None recorded') + '</strong></div>'
        + '<div class="profile-detail-row"><span>Outlook Email</span><strong>' + (student.outlook_email || 'N/A') + '</strong></div>'
        + '<div class="profile-detail-row"><span>Gmail</span><strong>' + (student.gmail || 'N/A') + '</strong></div>'
        + '</div>';
    document.getElementById('profDetails').innerHTML = detailsHtml;
    document.getElementById('profileModal').style.display = 'flex';
}

function normalizeReminderName(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\b[a-z]\b/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function findReminderUserByName(name, usedRecords) {
    var normalized = normalizeReminderName(name);
    if (!normalized) return null;
    var wanted = normalized.split(' ').filter(Boolean);
    if (wanted.length === 0) return null;

    return (allUsers || []).find(function(user) {
        var id = String(user.student_id || user.id || user.name || '').trim();
        if (id && usedRecords[id]) return false;
        var candidate = normalizeReminderName(user.name);
        if (!candidate) return false;
        var candidateWords = candidate.split(' ');
        return wanted.every(function(word) { return candidateWords.indexOf(word) !== -1; });
    }) || null;
}

function parseReminderRecipients(raw) {
    raw = String(raw || '').trim();
    if (!raw) return { names: [], records: [] };

    raw = raw.replace(/\b\d+\s+recipients?\b/gi, '').trim();

    var matched = [];
    var used = {};
    var usedRecords = {};
    (allUsers || []).forEach(function(user) {
        var name = String(user.name || '').trim();
        if (!name || used[name]) return;
        var variants = [name];
        if (name.indexOf(',') >= 0) {
            var parts = name.split(',');
            var last = (parts[0] || '').trim();
            var first = parts.slice(1).join(',').trim();
            if (first && last) variants.push(first + ' ' + last, last + ' ' + first);
        } else {
            var tokens = name.split(/\s+/);
            if (tokens.length >= 2) variants.push(tokens.slice(1).join(' ') + ' ' + tokens[0]);
        }
        if (variants.some(function(v) { return raw.indexOf(v) >= 0; })) {
            used[name] = true;
            usedRecords[String(user.student_id || user.id || name)] = true;
            matched.push({ name: name, record: user });
        }
    });

    if (matched.length === 0) {
        raw.split(/[;,]/).forEach(function(name) {
            name = name.trim();
            if (name && !used[name]) {
                used[name] = true;
                var record = findReminderUserByName(name, usedRecords);
                if (record) {
                    usedRecords[String(record.student_id || record.id || record.name || name)] = true;
                }
                matched.push({ name: record ? record.name : name, record: record || null });
            }
        });
    }

    return {
        names: matched.map(function(item) { return item.name; }),
        records: matched.map(function(item) { return item.record; }).filter(Boolean)
    };
}

function reminderRecipientRoleLabel(record) {
    if (!record) return 'Recipient';
    if (record.type === 'Teacher') return record.level === 'Tertiary' ? 'Tertiary Teacher' : 'SHS Teacher';
    return record.level === 'Tertiary' ? 'Tertiary Student' : 'SHS Student';
}

function reminderRecipientLabel(records, fallbackCount) {
    if (!records || records.length === 0) {
        var count = fallbackCount || 0;
        return count + ' student' + (count === 1 ? '' : 's');
    }
    var counts = {};
    records.forEach(function(record) {
        var label = reminderRecipientRoleLabel(record);
        counts[label] = (counts[label] || 0) + 1;
    });
    return Object.keys(counts).map(function(label) {
        var count = counts[label];
        return count + ' ' + label;
    }).join(', ');
}

function toggleNotifPanel() {
    var panel = document.getElementById('notifPanel');
    if (!panel) return;
    var isOpen = panel.style.display === 'block';
    panel.style.display = isOpen ? 'none' : 'block';
}

document.addEventListener('click', function(e) {
    var panel = document.getElementById('notifPanel');
    var bell  = document.getElementById('bellBtn');
    if (!panel || !bell) return;
    if (!panel.contains(e.target) && !bell.contains(e.target)) panel.style.display = 'none';
});
function closeProfileModal() { document.getElementById('profileModal').style.display = 'none'; } // Close the student profile modal
// ============================================================
//  SETTINGS (Branch removed)
// ============================================================
function loadSettings() {
    var s = getUserSession();
    if (!s) return;
    document.getElementById('nurseNicknameInput').value = s.nickname || s.name || '';
    document.getElementById('nursePositionInput').value = s.position || 'Clinic Nurse';
    document.getElementById('emailInput').value = s.email || '';
    document.getElementById('nav-nurse-name').innerText = s.nickname || s.name || 'User';
    document.getElementById('notifPending').checked = !!s.notif_pending;
    document.getElementById('notifArchive').checked = !!s.notif_archive;
    document.getElementById('defaultChart').value = s.default_chart || 'bar';
    var darkToggle = document.getElementById('darkModeToggle');
    if (darkToggle) darkToggle.checked = !!s.dark_mode;
}

function saveSettings(successMessage) {
    var name = (document.getElementById('nurseNicknameInput').value || '').trim();
    var position = (document.getElementById('nursePositionInput').value || '').trim();
    var email = (document.getElementById('emailInput').value || '').trim();
    var chartType = document.getElementById('defaultChart').value;
    var isDark = document.getElementById('darkModeToggle').checked;

    var session = getUserSession();
    if (!name || !email) { showToast('Please complete nurse name and work email.'); return; }

    var formData = new FormData();
    formData.append('current_email', session.email);
    formData.append('name', name);
    formData.append('nickname', name);
    formData.append('position', position);
    formData.append('email', email);
    formData.append('notif_pending', document.getElementById('notifPending').checked ? 1 : 0);
    formData.append('notif_archive', document.getElementById('notifArchive').checked ? 1 : 0);
    formData.append('default_chart', chartType);
    formData.append('dark_mode', isDark ? 1 : 0);

    fetch('update_profile.php', { method: 'POST', body: formData })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            session.name = name;
            session.nickname = name;
            session.email = email;
            session.position = position;
            session.notif_pending = document.getElementById('notifPending').checked ? 1 : 0;
            session.notif_archive = document.getElementById('notifArchive').checked ? 1 : 0;
            session.default_chart = chartType;
            session.dark_mode = isDark ? 1 : 0;
            
            sessionStorage.setItem('userSession', JSON.stringify(session));
            showToast(successMessage || 'Profile updated');
            loadSettings();
            applyDarkMode(isDark);
            refreshProfile().then(function() {
                updateOverallChart();
                updateSHSStrandChart();
            });
        } else {
            showToast('❌ Update failed: ' + data.message);
        }
    });
}

function savePreferences() {
    saveSettings('Preferences updated'); // Use saveSettings for preferences as they are in the same table
}

function updateSecurity() {
    var current = (document.getElementById('currentPassword') || {}).value || '';
    var np      = (document.getElementById('newPassword')     || {}).value || '';
    var cp      = (document.getElementById('confirmPassword') || {}).value || '';

    if (!current || !np || !cp) {
        showToast('❌ Please fill in all password fields.');
        return;
    }
    if (np.length < 6) {
        showToast('❌ New password must be at least 6 characters.');
        return;
    }
    if (np !== cp) {
        showToast('❌ New passwords do not match.');
        return;
    }

    var session = getUserSession();
    var formData = new FormData();
    formData.append('email', session.email);
    formData.append('currentPassword', current);
    formData.append('newPassword', np);

    fetch('change_password_profile.php', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            showToast('Security info updated');
            document.getElementById('currentPassword').value = '';
            document.getElementById('newPassword').value = '';
            document.getElementById('confirmPassword').value = '';
        } else {
            showToast('❌ ' + data.message);
        }
    })
    .catch(err => {
        console.error('Security update error:', err);
        showToast('❌ Server connection failed.');
    });
}

function uploadPhoto(e) {
    var file = e.target && e.target.files ? e.target.files[0] : null;
    if (!file) return;
    var r = new FileReader();
    r.onload = function(){ 
        var session = getUserSession();
        var formData = new FormData();
        formData.append('current_email', session.email);
        formData.append('name', session.name);
        formData.append('nickname', session.nickname || session.name);
        formData.append('position', session.position);
        formData.append('email', session.email);
        formData.append('notif_pending', session.notif_pending ? 1 : 0);
        formData.append('notif_archive', session.notif_archive ? 1 : 0);
        formData.append('default_chart', session.default_chart || 'bar');
        formData.append('dark_mode', session.dark_mode ? 1 : 0);
        formData.append('photo', r.result);
        fetch('update_profile.php', { method: 'POST', body: formData })
        .then(() => { refreshProfile(); showToast('✅ Photo saved to Database!'); });
    };
    r.readAsDataURL(file);
}

function loadProfile() {
    var s = getUserSession();
    var img = s ? s.photo : null;
    ['nav-avatar','settings-avatar'].forEach(function(id){
        var el = document.getElementById(id); if (!el) return;
        if (img) { el.style.backgroundImage = 'url('+img+')'; el.innerText = ''; }
        else { el.style.backgroundImage = ''; var name = s ? (s.nickname || s.name) : 'User'; el.innerText = name.split(' ').map(function(w){ return w[0]; }).slice(0,2).join('').toUpperCase(); }
    });
}

function showToast(msg) {
    var t = document.getElementById('toast');
    t.innerText = msg; t.classList.add('show');
    setTimeout(function(){ t.classList.remove('show'); }, 2800);
}
function saveData() { /* Data is saved via PHP now, no need for localStorage saveAccountData() */ }

// ============================================================
//  🆕 IMPORT STUDENTS — Manual + Excel/CSV
// ============================================================
var importManualQueue  = [];
var importExcelData    = [];
var activeImportTab    = 'manual';

function openImportModal() {
    document.getElementById('importModalOverlay').classList.add('open');
    switchImportTab('manual');
    importManualQueue = [];
    importExcelData = [];
    refreshManualQueue();
    clearExcelFile();
    document.getElementById('importResultMsg').textContent = '';
    toggleImpFields(); // initialize year level options on open
}

function closeImportModal() {
    document.getElementById('importModalOverlay').classList.remove('open');
}

function switchImportTab(tab) {
    activeImportTab = tab;
    ['manual','excel'].forEach(function(t){
        document.getElementById('itab-'+t).classList.toggle('active', t===tab);
        document.getElementById('ipanel-'+t).classList.toggle('active', t===tab);
    });
}

function sanitizeImportValue(value, filter) {
    value = String(value || '');
    if (filter === 'numbers') return value.replace(/[^0-9]/g, '');
    if (filter === 'school-year') return value.replace(/[^0-9-]/g, '').replace(/-{2,}/g, '-').slice(0, 9);
    if (filter === 'letters-spaces') return value.replace(/[^\p{L} ]/gu, '').replace(/\s{2,}/g, ' ');
    return value;
}

function normalizeSchoolYearInput(value) {
    return String(value || '').trim().replace(/[\u2013\u2014]/g, '-').replace(/\s*-\s*/g, '-');
}

function initializeImportManualValidation() {
    document.querySelectorAll('#ipanel-manual input[data-filter]').forEach(function(input) {
        if (input.dataset.importValidationBound === '1') return;
        input.dataset.importValidationBound = '1';
        input.addEventListener('input', function() {
            var cleaned = sanitizeImportValue(input.value, input.dataset.filter);
            if (input.value !== cleaned) input.value = cleaned;
            input.classList.remove('input-invalid');
        });
    });
    document.querySelectorAll('#ipanel-manual input, #ipanel-manual select').forEach(function(input) {
        if (input.dataset.importInvalidBound === '1') return;
        input.dataset.importInvalidBound = '1';
        input.addEventListener('change', function() {
            input.classList.remove('input-invalid');
        });
    });
}

function setImportInvalid(el, message) {
    if (el) {
        el.classList.add('input-invalid');
        el.focus();
    }
    showToast(message);
    return false;
}

function validateOptionalEmail(el, label) {
    var value = el ? el.value.trim() : '';
    if (!value) return true;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        return setImportInvalid(el, label + ' must be a valid email address.');
    }
    return true;
}

function addManualToImportQueue() {
    var elId      = document.getElementById('imp_id');
    var elName    = document.getElementById('imp_name');
    var elLevel   = document.getElementById('imp_level');
    var elType    = document.getElementById('imp_type');
    
    if (!elId || !elName || !elLevel || !elType) return;

    ['imp_id','imp_name','imp_sy','imp_allergies','imp_mental_state'].forEach(function(fid) {
        var input = document.getElementById(fid);
        if (input && input.dataset.filter) input.value = sanitizeImportValue(input.value, input.dataset.filter);
    });

    document.querySelectorAll('#ipanel-manual .input-invalid').forEach(function(el) {
        el.classList.remove('input-invalid');
    });

    var id      = elId.value.trim();
    var name    = elName.value.trim().replace(/\s{2,}/g, ' ');
    var level   = elLevel.value;
    var type    = elType.value;
    var elStrand = document.getElementById('imp_strand');
    var elCourse = document.getElementById('imp_course');
    var strand  = (elStrand || {}).value || '';
    var course  = (elCourse || {}).value || '';
    var year    = (document.getElementById('imp_year') || {}).value || '';
    var section = (document.getElementById('imp_section') || {}).value || '';
    var elSy = document.getElementById('imp_sy');
    var sy      = normalizeSchoolYearInput((elSy || {}).value || '');
    var elOutlook = document.getElementById('imp_outlook');
    var elGmail = document.getElementById('imp_gmail');
    var outlook = (elOutlook || {}).value || '';
    var gmail   = (elGmail || {}).value || '';
    var emergencyContact = (document.getElementById('imp_emergency') || {}).value || '';
    var elAllergies = document.getElementById('imp_allergies');
    var elMentalState = document.getElementById('imp_mental_state');
    var allergies = (elAllergies || {}).value.trim().replace(/\s{2,}/g, ' ');
    var mentalState = (elMentalState || {}).value.trim().replace(/\s{2,}/g, ' ');
    var status  = (document.getElementById('imp_status') || {}).value || 'Pending';

    if (!id) { return setImportInvalid(elId, 'Teacher ID / Student ID is required.'); }
    if (!/^[0-9]+$/.test(id)) { return setImportInvalid(elId, 'Teacher ID / Student ID must contain numbers only.'); }
    if (!name) { return setImportInvalid(elName, 'Full Name is required.'); }
    if (!/^[\p{L} ]+$/u.test(name)) { return setImportInvalid(elName, 'Full Name must contain letters and spaces only.'); }
    if (!level) { return setImportInvalid(elLevel, 'Level is required.'); }
    if (!type) { return setImportInvalid(elType, 'Type is required.'); }
    if (level === 'SHS' && type === 'Student' && !strand) { return setImportInvalid(elStrand, 'Strand is required for SHS Students.'); }
    if (level === 'Tertiary' && type === 'Student' && !course) { return setImportInvalid(elCourse, 'Course is required for Tertiary Students.'); }
    if (sy && !/^([0-9]{8}|[0-9]{4}-[0-9]{4})$/.test(sy)) { return setImportInvalid(elSy, 'School Year must be like 20262027 or 2026-2027.'); }
    if (!validateOptionalEmail(elOutlook, 'STI Outlook Email')) return;
    if (!validateOptionalEmail(elGmail, 'Personal Gmail')) return;
    if (allergies && !/^[\p{L} ]+$/u.test(allergies)) { return setImportInvalid(elAllergies, 'Allergies must contain letters and spaces only.'); }
    if (mentalState && !/^[\p{L} ]+$/u.test(mentalState)) { return setImportInvalid(elMentalState, 'Mental State must contain letters and spaces only.'); }

    // Check duplicate in main records (allUsers)
    if (allUsers.some(function(s){ return String(s.student_id || s.id).trim() === String(id); })) { 
        showToast('ID '+id+' already exists in records!'); 
        return; 
    }

    // Check duplicate in current queue to prevent accidental double-adding
    if (importManualQueue.some(function(s){ return String(s.id).trim() === String(id); })) { 
        showToast('ID '+id+' is already in your import list!'); 
        return; 
    }

    // Create entry object ensuring field names match what the backend and main list expect
    var entry = { 
        id: id, 
        student_id: id, 
        name: name, 
        level: level, 
        type: type, 
        strand: (level === 'SHS' && type === 'Student') ? strand : '', 
        course: (level === 'Tertiary' && type === 'Student') ? course : '', 
        yearLevel: year, 
        section: section, 
        schoolYear: sy, 
        outlook_email: outlook, 
        gmail: gmail, 
        emergency_contact: emergencyContact,
        allergies: allergies,
        mental_state: mentalState,
        requirements_passed: '',
        status: status, 
        is_archived: 0, 
        dateRecorded: new Date().toISOString().split('T')[0], 
        condition: 'None', 
        nationality: 'Filipino' 
    };

    importManualQueue.push(entry);
    
    // Clear text inputs
    ['imp_id','imp_name','imp_section','imp_sy','imp_outlook','imp_gmail','imp_emergency','imp_allergies','imp_mental_state'].forEach(function(fid){ 
        var el=document.getElementById(fid); if(el) el.value=''; 
    });
    // Reset dropdowns to first option
    ['imp_level','imp_type','imp_strand','imp_course','imp_year','imp_status'].forEach(function(fid){ 
        var el=document.getElementById(fid); if(el) el.selectedIndex=0; 
    });

    toggleImpFields();
    refreshManualQueue();
    showToast('✅ Added to list: ' + name);
}

function toggleImpFields() {
    var level = document.getElementById('imp_level').value;
    var type  = document.getElementById('imp_type').value;
    if (document.getElementById('impStrandGroup')) document.getElementById('impStrandGroup').style.display = (level === 'SHS' && type === 'Student') ? 'block' : 'none';
    if (document.getElementById('impCourseGroup')) document.getElementById('impCourseGroup').style.display = (level === 'Tertiary' && type === 'Student') ? 'block' : 'none';

    // Swap year level options based on level
    var yearSel = document.getElementById('imp_year');
    if (yearSel) {
        yearSel.innerHTML = '<option value="">-- Select --</option>';
        var opts = (level === 'Tertiary')
            ? ['1st Year Tertiary', '2nd Year Tertiary', '3rd Year Tertiary', '4th Year Tertiary']
            : ['Grade 11', 'Grade 12'];
        opts.forEach(function(y) {
            var o = document.createElement('option');
            o.value = y; o.textContent = y;
            yearSel.appendChild(o);
        });
    }
}

function removeFromManualQueue(i) {
    importManualQueue.splice(i, 1);
    refreshManualQueue();
}

function refreshManualQueue() {
    var wrap  = document.getElementById('manualQueueWrap');
    var tbody = document.getElementById('manualQueueBody');
    var count = document.getElementById('manualQueueCount');
    if (count) count.textContent = importManualQueue.length;
    if (importManualQueue.length === 0) { if(wrap) wrap.style.display='none'; return; }
    if (wrap) wrap.style.display = 'block';
    tbody.innerHTML = importManualQueue.map(function(s,i){
        var cat = (s.type === 'Teacher') ? 'Teacher' : (s.strand || s.course || '—');
        return '<tr>'
            +'<td style="color:#aaa;">'+(i+1)+'</td>'
            +'<td style="font-weight:700;color:#0d2b52;">'+s.id+'</td>'
            +'<td>'+s.name+'</td>'
            +'<td>'+categoryBadge(s.level, s.type, s.strand || s.course)+'</td>'
            +'<td style="font-size:11px;">'+(s.yearLevel||'—')+'</td>'
            +'<td style="font-size:11px;">'+s.level+'</td>'
            +'<td><span class="import-status-badge '+(s.status==='Complete'?'import-complete':'import-pending')+'">'+s.status+'</span></td>'
            +'<td><button onclick="removeFromManualQueue('+i+')" style="background:none;border:none;color:#e74c3c;cursor:pointer;font-size:14px;" title="Remove">✕</button></td>'
            +'</tr>';
    }).join('');
}

// Download template
function downloadTemplate() {
    if (typeof XLSX === 'undefined') { alert('Excel library not loaded. Please check your internet connection.'); return; }
    var gmailBase = 'kdanmarkrosalejos';
    var gmailDomain = 'gmail.com';
    var outlookBase = 'rosalejos.391698';
    var outlookDomain = 'bacoor.sti.edu.ph';
    var seed = Date.now();
    var idBase = 202600000 + (seed % 90000);
    var set = Math.floor(seed / 1000) % 4;
    var studentNames = [
        ['Dela Cruz, Mikaela','Reyes, Adrian','Santos, Trisha Mae','Garcia, Paolo'],
        ['Lim, Cassandra','Navarro, Joshua','Torres, Bea Nicole','Ramos, Enzo Miguel'],
        ['Flores, Alyssa','Cruz, Nathaniel','Sy, Camille Anne','Castillo, Marcus'],
        ['Lopez, Bianca','Rivera, Gian Carlo','Morales, Sophia','Tan, Luis Miguel']
    ][set];
    var teacherNames = [
        ['Villanueva, Angela','Bautista, Jerome','Mendoza, Clarissa','Aquino, Rafael'],
        ['Santiago, Mariel','Del Rosario, Kenneth','Soriano, Patricia','Uy, Vincent'],
        ['Mercado, Lianne','Ocampo, Francis','Valdez, Regina','Chua, Daniel'],
        ['Salazar, Katrina','Gutierrez, Paulo','Fernandez, Elaine','Domingo, Carlo']
    ][set];
    var headers = [
        ['Teacher ID / Student ID','Full Name','Level (SHS/Tertiary)','Type (Student/Teacher)','Strand (for SHS)','Course (for Tertiary)','Year Level','Section','School Year','Outlook Email','Gmail','Emergency Contact','Allergies','Mental State','Status']
    ];
    function gmailFor(id) { return gmailBase + '+' + id + '@' + gmailDomain; }
    function outlookFor(id) { return outlookBase + '+' + id + '@' + outlookDomain; }
    var studentRows = headers.concat([
        [String(idBase + 1), studentNames[0], 'SHS', 'Student', 'ICT', '', 'Grade 11', 'ICT-A', '2026-2027', outlookFor(idBase + 1), gmailFor(idBase + 1), 'Parent / Guardian - 09171234567', 'None', 'Stable', 'Complete'],
        [String(idBase + 2), studentNames[1], 'SHS', 'Student', 'STEM', '', 'Grade 12', 'STEM-B', '2026-2027', outlookFor(idBase + 2), gmailFor(idBase + 2), 'Parent / Guardian - 09181234567', 'Seafood', 'Stable', 'Pending'],
        [String(idBase + 3), studentNames[2], 'Tertiary', 'Student', '', 'BSIT', '2nd Year', 'BSIT-2A', '2026-2027', outlookFor(idBase + 3), gmailFor(idBase + 3), 'Parent / Guardian - 09191234567', 'None', 'Stable', 'Complete'],
        [String(idBase + 4), studentNames[3], 'Tertiary', 'Student', '', 'BSCS', '1st Year', 'BSCS-1B', '2026-2027', outlookFor(idBase + 4), gmailFor(idBase + 4), 'Parent / Guardian - 09201234567', 'Penicillin', 'Stable', 'Pending']
    ]);
    var teacherRows = headers.concat([
        [String(idBase + 101), teacherNames[0], 'SHS', 'Teacher', '', '', 'Faculty', 'SHS Faculty', '2026-2027', outlookFor(idBase + 101), gmailFor(idBase + 101), 'Emergency Contact - 09211234567', 'None', 'Stable', 'Complete'],
        [String(idBase + 102), teacherNames[1], 'SHS', 'Teacher', '', '', 'Faculty', 'SHS Faculty', '2026-2027', outlookFor(idBase + 102), gmailFor(idBase + 102), 'Emergency Contact - 09221234567', 'Dust allergy', 'Stable', 'Pending'],
        [String(idBase + 103), teacherNames[2], 'Tertiary', 'Teacher', '', '', 'Faculty', 'Tertiary Faculty', '2026-2027', outlookFor(idBase + 103), gmailFor(idBase + 103), 'Emergency Contact - 09231234567', 'None', 'Stable', 'Complete'],
        [String(idBase + 104), teacherNames[3], 'Tertiary', 'Teacher', '', '', 'Faculty', 'Tertiary Faculty', '2026-2027', outlookFor(idBase + 104), gmailFor(idBase + 104), 'Emergency Contact - 09241234567', 'None', 'Stable', 'Pending']
    ]);
    var notesRows = [
        ['HealthSync Import Template Notes'],
        ['Use the Students sheet for student records and the Teachers sheet for teacher records.'],
        ['All sample IDs are numeric only because the system accepts numeric IDs only.'],
        ['School Year is included in every sample row.'],
        ['Sample Gmail uses unique plus-addresses per record so reply matching does not all go to one person.'],
        ['Sample Outlook also uses unique plus-addresses per record. Replace with each real student/teacher email before expo use.'],
        ['Reminder replies also include a Reference ID, so the system can match a reply even if you test multiple records with one inbox.'],
        ['Status Complete means the record is marked compliant after import. Status Pending means requirements are still missing.'],
        ['Actual submitted requirement files/messages are not imported from this template. They appear in View Profile after the student or teacher submits files through the submissions system.'],
        ['Required columns: Teacher ID / Student ID, Full Name, Level, Type. For students, include Strand for SHS or Course for Tertiary.']
    ];
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(studentRows), 'Students');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(teacherRows), 'Teachers');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(notesRows), 'Notes');
    XLSX.writeFile(wb, 'HealthSync_Import_Template.xlsx');
    showToast('📥 Template downloaded!');
}

function handleFileDrop(e) {
    e.preventDefault();
    document.getElementById('dropZone').classList.remove('dragover');
    var file = e.dataTransfer && e.dataTransfer.files ? e.dataTransfer.files[0] : null;
    if (file) processImportFile(file);
}

function handleFileSelect(e) {
    var file = e.target && e.target.files ? e.target.files[0] : null;
    if (file) processImportFile(file);
}

function processImportFile(file) {
    document.getElementById('dropZoneFileName').textContent = '📄 ' + file.name;
    document.getElementById('excelErrorWrap').style.display = 'none';

    var ext = file.name.split('.').pop().toLowerCase();
    var reader = new FileReader();

    if (ext === 'csv') {
        reader.onload = function(e){ parseCSV(e.target.result, file.name); };
        reader.readAsText(file);
    } else if (ext === 'xlsx' || ext === 'xls') {
        if (typeof XLSX === 'undefined') { showExcelError('Excel parser not loaded. Please check internet connection.'); return; }
        reader.onload = function(e) {
            try {
                var data = new Uint8Array(e.target.result);
                var wb   = XLSX.read(data, {type:'array'});
                var rows = [];
                wb.SheetNames.forEach(function(sheetName) {
                    if (String(sheetName).toLowerCase() === 'notes') return;
                    var ws = wb.Sheets[sheetName];
                    var sheetRows = XLSX.utils.sheet_to_json(ws, {header:1, defval:''});
                    if (!sheetRows || sheetRows.length === 0) return;
                    rows = rows.length === 0 ? sheetRows : rows.concat(sheetRows.slice(1));
                });
                parseRows(rows, file.name);
            } catch(err) {
                showExcelError('Could not read Excel file: ' + err.message);
            }
        };
        reader.readAsArrayBuffer(file);
    } else {
        showExcelError('Unsupported file type. Please use .xlsx, .xls, or .csv');
    }
}

function parseCSV(text, filename) {
    var lines = text.trim().split('\n').map(function(l){ return l.split(',').map(function(c){ return c.trim().replace(/^"|"$/g,''); }); });
    parseRows(lines, filename);
}

function parseRows(rows, filename) {
    if (!rows || rows.length < 2) { showExcelError('File is empty or missing data rows.'); return; }
    var header = rows[0].map(function(h){ return String(h).trim().toLowerCase(); });
    var colMap = {
        id:      findCol(header, ['teacher id / student id','teacher id','student id','studentid','id','student_id']),
        name:    findCol(header, ['full name','name','fullname','student name']),
        level:   findCol(header, ['level','shs/tertiary']),
        type:    findCol(header, ['type','student/teacher']),
        strand:  findCol(header, ['strand']),
        course:  findCol(header, ['course']),
        year:    findCol(header, ['year level','yearlevel','year','grade']),
        section: findCol(header, ['section']),
        sy:      findCol(header, ['school year','schoolyear','sy']),
        outlook: findCol(header, ['outlook','outlook email','sti email','sti outlook']),
        gmail:   findCol(header, ['gmail','personal email','personal gmail']),
        emergency: findCol(header, ['emergency contact','emergency','contact person','guardian']),
        allergies: findCol(header, ['allergies','allergy']),
        mental: findCol(header, ['mental state','mental_state','mental health','notes']),
        status:  findCol(header, ['status','compliance','compliance status'])
    };
    if (colMap.id === -1 || colMap.name === -1) {
        showExcelError('Could not find required columns (Teacher ID / Student ID, Full Name). Please use the provided template.');
        return;
    }
    var errors = [];
    var parsed = [];
    var VALID_LEVELS = ['SHS', 'Tertiary'];
    var VALID_TYPES = ['Student', 'Teacher'];
    var VALID_SHS_STRANDS = SHS_STRANDS;
    var VALID_COLLEGE_COURSES = COLLEGE_COURSES;

    rows.slice(1).forEach(function(row, i) {
        if (row.every(function(c){ return !c; })) return;
        var id     = String(row[colMap.id] || '').trim();
        var name   = String(row[colMap.name] || '').trim();
        var level  = colMap.level >= 0 ? String(row[colMap.level] || '').trim() : '';
        var type   = colMap.type >= 0 ? String(row[colMap.type] || '').trim() : '';
        var strand = colMap.strand >= 0 ? String(row[colMap.strand] || '').trim().toUpperCase() : ''; // SHS
        var course = colMap.course >= 0 ? String(row[colMap.course] || '').trim().toUpperCase() : ''; // Tertiary
        var year   = colMap.year >= 0 ? String(row[colMap.year] || '').trim() : '';
        var section= colMap.section >= 0 ? String(row[colMap.section] || '').trim() : '';
        var sy     = colMap.sy >= 0 ? String(row[colMap.sy] || '').trim() : '';
        var outlook= colMap.outlook >= 0 ? String(row[colMap.outlook] || '').trim() : '';
        var gmail  = colMap.gmail >= 0 ? String(row[colMap.gmail] || '').trim() : '';
        var emergencyContact = colMap.emergency >= 0 ? String(row[colMap.emergency] || '').trim() : '';
        var allergies = colMap.allergies >= 0 ? String(row[colMap.allergies] || '').trim() : '';
        var mentalState = colMap.mental >= 0 ? String(row[colMap.mental] || '').trim() : '';
        var status = colMap.status >= 0 ? String(row[colMap.status] || '').trim() : 'Pending';
        sy = normalizeSchoolYearInput(sy);

        // Strict "No Blanks" check for both Students and Teachers
        if (!id || !name || !level || !type || !year || !section || !sy || !outlook || !gmail || !status) {
            var missing = []; if(!id)missing.push('ID'); if(!name)missing.push('Name'); if(!level)missing.push('Level'); if(!type)missing.push('Type'); if(!year)missing.push('Year'); if(!section)missing.push('Section'); if(!sy)missing.push('SY'); if(!outlook)missing.push('Outlook'); if(!gmail)missing.push('Gmail'); if(!status)missing.push('Status');
            errors.push('Row ' + (i + 2) + ': Missing fields (' + missing.join(', ') + ').');
            return;
        }

        if (!level || !VALID_LEVELS.includes(level)) { errors.push('Row ' + (i + 2) + ': Invalid Level (use: SHS, Tertiary)'); return; }
        if (!type || !VALID_TYPES.includes(type)) { errors.push('Row ' + (i + 2) + ': Invalid Type (use: Student, Teacher)'); return; }
        if (sy && !/^([0-9]{8}|[0-9]{4}-[0-9]{4})$/.test(sy)) { errors.push('Row ' + (i + 2) + ': Invalid School Year (use 20262027 or 2026-2027).'); return; }
        if (gmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(gmail)) { errors.push('Row ' + (i + 2) + ': Invalid Gmail address.'); return; }
        if (outlook && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(outlook)) { errors.push('Row ' + (i + 2) + ': Invalid Outlook email address.'); return; }
        
        // Specific checks for Students
        if (level === 'SHS' && type === 'Student' && (!strand || !VALID_SHS_STRANDS.includes(strand))) { 
            errors.push('Row ' + (i + 2) + ': Missing or invalid SHS Strand.'); 
            return; 
        }
        if (level === 'Tertiary' && type === 'Student' && (!course || !VALID_COLLEGE_COURSES.includes(course))) { 
            errors.push('Row ' + (i + 2) + ': Missing or invalid Tertiary Course.'); 
            return; 
        }

        var normStatus = (String(status).toLowerCase().includes('complete') || String(status).toLowerCase() === 'done') ? 'Complete' : 'Pending';
        parsed.push({
            id: id,
            name: name,
            level: level,
            type: type,
            strand: strand,
            course: course,
            yearLevel: year,
            section: section,
            schoolYear: sy,
            outlook_email: outlook,
            gmail: gmail,
            emergency_contact: emergencyContact,
            allergies: allergies,
            mental_state: mentalState,
            requirements_passed: '',
            status: normStatus,
            dateRecorded: new Date().toISOString().split('T')[0],
            condition: 'None',
            nationality: 'Filipino'
        });
    });
    importExcelData = parsed;
    var errWrap = document.getElementById('excelErrorWrap');
    if (errors.length > 0) {
        errWrap.style.display = 'block';
        errWrap.innerHTML = '<strong>?????? Some rows had errors and were skipped:</strong><br>' + errors.join('<br>');
    } else {
        errWrap.style.display = 'none';
        errWrap.innerHTML = '';
    }
    renderExcelPreview();
}
function findCol(header, names) {
    for (var i=0; i<names.length; i++) {
        var idx = header.findIndex(function(h){ return h.includes(names[i]); });
        if (idx >= 0) return idx;
    }
    return -1;
}

function renderExcelPreview() {
    var wrap  = document.getElementById('excelPreviewWrap');
    var tbody = document.getElementById('excelPreviewBody');
    var count = document.getElementById('excelRowCount');
    count.textContent = importExcelData.length;
    if (importExcelData.length === 0) { wrap.style.display='none'; return; }
    if (wrap) wrap.style.display = 'block';
    tbody.innerHTML = importExcelData.slice(0,50).map(function(s,i){
        var exists = allUsers.some(function(st){ return st.id === s.id; });
        return '<tr style="'+(exists?'background:#fff8e1;':'')+'">'
            +'<td style="color:#aaa;">'+(i+1)+'</td>'
            +'<td style="font-weight:700;color:'+(exists?'#e67e22':'#0d2b52')+';">'+s.id+(exists?' ⚠️':'')+'</td>'
            +'<td>'+s.name+'</td>'
            +'<td>'+categoryBadge(s.level, s.type, s.strand || s.course)+'</td>'
            +'<td style="font-size:11px;">'+s.level+' '+s.type+'</td>'
            +'<td style="font-size:11px;">'+(s.section||'—')+'</td>'
            +'<td style="font-size:10px;max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+(s.outlook_email||'—')+'</td>'
            +'<td style="font-size:10px;max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+(s.gmail||'—')+'</td>'
            +'<td><span class="import-status-badge '+(s.status==='Complete'?'import-complete':'import-pending')+'">'+s.status+'</span></td>'
            +'</tr>';
    }).join('');
    if (importExcelData.length > 50) {
        tbody.innerHTML += '<tr><td colspan="9" style="text-align:center;color:#999;">...and ' + (importExcelData.length - 50) + ' more rows</td></tr>';
    }
}

function clearExcelFile() {
    importExcelData = [];
    document.getElementById('dropZoneFileName').textContent = 'Files cleared';
    document.getElementById('excelErrorWrap').style.display = 'none';
    var inp = document.getElementById('excelFileInput');
    if (inp) inp.value = '';
}

function showExcelError(msg) {
    var el = document.getElementById('excelErrorWrap');
    el.innerHTML = '❌ ' + msg;
    el.style.display = 'block';
}

function saveImportedStudents() {
    var toSave = activeImportTab === 'manual' ? importManualQueue : importExcelData;
    if (toSave.length === 0) { showToast('No students to save.'); return; }

    var formData = new FormData();
    formData.append('students', JSON.stringify(toSave));
    formData.append('source', activeImportTab === 'excel' ? 'excel' : 'manual');

    fetch('bulk_import_students.php', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            var msg = '✅ Saved ' + data.added + ' record' + (Number(data.added) === 1 ? '' : 's') + '.';
            if (data.skipped > 0) msg += ' ⚠️ ' + data.skipped + ' skipped (existing).';
            showToast(msg);
            document.getElementById('importResultMsg').textContent = msg;
            
            importManualQueue = [];
            importExcelData = [];
            refreshManualQueue();
            clearExcelFile();
            loadAccountData(); // Refresh main tables from DB
            setTimeout(function(){ closeImportModal(); }, 1500);
        } else {
            showToast('❌ Error: ' + data.message);
        }
    })
    .catch(err => {
        console.error('Import error:', err);
        showToast('❌ Server connection failed.');
    });
}

// ============================================================
//  BY COURSE VIEW (Tertiary)
// ============================================================
function renderCollegeView(list) {
    var data  = list || collegeStudents;
    var query = document.getElementById('courseSearch') ? document.getElementById('courseSearch').value.trim().toLowerCase() : '';

    if (query) {
        data = data.filter(function(s){ return String(s.name||'').toLowerCase().includes(query) || String(s.id||'').toLowerCase().includes(query); });
    }

    // Summary cards
    var cardsEl = document.getElementById('courseSummaryCards');
    if (cardsEl) {
        cardsEl.innerHTML = COLLEGE_COURSES.map(function(course) {
            var cc = COLLEGE_COURSE_COLORS[course] || {bg:'#f0f0f0',text:'#555',border:'#ccc',icon:'📋'};
            var total   = collegeStudents.filter(function(u){ return u.course === course; }).length;
            var done    = collegeStudents.filter(function(u){ return u.course === course && u.status === 'Complete'; }).length;
            var pending = total - done;
            var pct     = total > 0 ? Math.round((done/total)*100) : 0;
            return '<div style="background:'+cc.bg+';border:2px solid '+cc.border+';border-radius:16px;padding:18px 20px;cursor:pointer;transition:.2s;" onclick="jumpToCourse(this.dataset.course)" data-course="'+course+'" title="Click to scroll to '+course+' group">'
                +'<div style="font-size:24px;margin-bottom:6px;">'+cc.icon+'</div>'
                +'<div style="font-weight:700;font-size:18px;color:'+cc.text+';">'+course+'</div>'
                +'<div style="font-size:12px;color:'+cc.text+';opacity:.8;margin:4px 0;">'+total+' student'+(total!==1?'s':'')+'</div>'
                +'<div style="height:5px;background:rgba(0,0,0,.1);border-radius:3px;margin:8px 0 4px;"><div style="height:100%;width:'+pct+'%;background:'+cc.text+';border-radius:3px;transition:.4s;"></div></div>'
                +'<div style="font-size:11px;color:'+cc.text+';">✅ '+done+' compliant &nbsp; ⏳ '+pending+' pending</div>'
                +'</div>';
        }).join('');
    }

    var container = document.getElementById('courseGroupContainer');
    if (!container) return;
    container.innerHTML = '';
    COLLEGE_COURSES.forEach(function(course) {
        var cc = COLLEGE_COURSE_COLORS[course] || {bg:'#f0f0f0',text:'#555',border:'#ccc',icon:'📋'};
        var group = data.filter(function(u){ return (u.course === course || u.strand === course); });
        var totalInCourse = collegeStudents.filter(function(u){ return (u.course === course || u.strand === course); }).length;
        var html = '<div id="course-section-'+course+'" class="glass-card" style="border-top:4px solid '+cc.border+';margin-bottom:24px;">';
        html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px;"><h3 style="margin:0;color:'+cc.text+';">'+cc.icon+' '+course+' Students</h3><span style="background:'+cc.bg+';color:'+cc.text+';padding:5px 14px;border-radius:20px;font-size:12px;font-weight:700;">'+totalInCourse+' total</span></div>';
        if (group.length === 0 && !query) {
            html += '<p style="text-align:center;color:#bbb;padding:20px 0;font-size:13px;">No '+course+' students recorded yet.</p>';
        } else if (group.length === 0 && query) {
            return; // Don't show empty sections during search
        } else {
            html += '<div class="tbl-wrap"><table><thead><tr><th>#</th><th>Teacher ID / Student ID</th><th>Name</th><th>Year Level</th><th>Section</th><th>Outlook</th><th>Status</th><th style="text-align:center;">Action</th></tr></thead><tbody>';
            group.forEach(function(s, idx) {
                var statusB = s.status==='Complete' ? '<span class="badge badge-complete">✅ Complete</span>' : '<span class="badge badge-pending">⏳ Pending</span>';
                html += '<tr><td style="color:#aaa;font-size:11px;">'+(idx+1)+'</td><td style="font-weight:600;">'+s.id+'</td><td>'+s.name+'</td><td>'+(s.yearLevel||'—')+'</td><td>'+(s.section||'—')+'</td><td style="font-size:11px;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+(s.outlook_email||'<span style="color:#ccc;">—</span>')+'</td><td>'+statusB+'</td><td style="text-align:center;"><button class="btn-sm" style="background:#0d2b52;color:white;" onclick="showStudentProfileModal(\''+s.id+'\')"><i class="fas fa-user-circle"></i> View</button></td></tr>';
            });
            html += '</tbody></table></div>';
        }
        container.innerHTML += html;
    });
}
function jumpToCourse(st) { 
    var el = document.getElementById('course-section-' + st);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ============================================================
//  BY STRAND VIEW
// ============================================================
var SHS_STRAND_COLORS = { 
    ICT:  {bg:'#dbeafe',text:'#1d4ed8',border:'#3b82f6',icon:'💻'},
    STEM: {bg:'#dcfce7',text:'#15803d',border:'#22c55e',icon:'🔬'},
    ABM:  {bg:'#fef9c3',text:'#854d0e',border:'#eab308',icon:'📊'},
    HUMSS:{bg:'#fce7f3',text:'#9d174d',border:'#ec4899',icon:'📚'},
    TOP:  {bg:'#ede9fe',text:'#5b21b6',border:'#8b5cf6',icon:'🌟'}
};

function renderStrandView(list) {
    var data  = list || shsStudents;
    var query = document.getElementById('strandSearch') ? document.getElementById('strandSearch').value.trim().toLowerCase() : '';
    var stF   = (typeof activeSHSStrandFilter !== 'undefined') ? activeSHSStrandFilter : 'ALL'; // Renamed filter

    if (stF !== 'ALL' && stF !== 'NONE') data = data.filter(function(s){ return s.strand === stF; });
    if (query) data = data.filter(function(s){ return String(s.name||'').toLowerCase().includes(query) || String(s.id||'').toLowerCase().includes(query) || String(s.section||'').toLowerCase().includes(query); });

    // Summary cards
    var cardsEl = document.getElementById('strandSummaryCards');
    if (!cardsEl) return;
    cardsEl.innerHTML = SHS_STRANDS.map(function(st) { // Use SHS_STRANDS
        var sc = SHS_STRAND_COLORS[st] || {bg:'#f0f0f0',text:'#555',border:'#ccc',icon:'📋'}; // Use SHS_STRAND_COLORS
        var total   = shsStudents.filter(function(s){ return s.strand===st; }).length;
        var done    = shsStudents.filter(function(s){ return s.strand===st && s.status==='Complete'; }).length;
        var pending = total - done;
        var pct     = total > 0 ? Math.round((done/total)*100) : 0;
        return '<div style="background:'+sc.bg+';border:2px solid '+sc.border+';border-radius:16px;padding:18px 20px;cursor:pointer;transition:.2s;" onclick="jumpToStrand(this.dataset.st)" data-st="'+st+'" title="Click to scroll to '+st+' group">'
            +'<div style="font-size:24px;margin-bottom:6px;">'+sc.icon+'</div>'
            +'<div style="font-weight:700;font-size:18px;color:'+sc.text+';">'+st+'</div>'
            +'<div style="font-size:12px;color:'+sc.text+';opacity:.8;margin:4px 0;">'+total+' student'+(total!==1?'s':'')+'</div>'
            +'<div style="height:5px;background:rgba(0,0,0,.1);border-radius:3px;margin:8px 0 4px;"><div style="height:100%;width:'+pct+'%;background:'+sc.text+';border-radius:3px;transition:.4s;"></div></div>'
            +'<div style="font-size:11px;color:'+sc.text+';">✅ '+done+' compliant &nbsp; ⏳ '+pending+' pending</div>'
            +'</div>';
    }).join('');

    var container = document.getElementById('strandGroupContainer');
    if (!container) return;
    container.innerHTML = '';
    var showStrands = (typeof activeSHSStrandFilter !== 'undefined' && activeSHSStrandFilter !== 'ALL') ? [activeSHSStrandFilter] : SHS_STRANDS; // Use SHS_STRANDS
    showStrands.forEach(function(st) { // Loop through SHS_STRANDS
        var sc = SHS_STRAND_COLORS[st] || {bg:'#f0f0f0',text:'#555',border:'#ccc',icon:'📋'}; // Use SHS_STRAND_COLORS
        var group = data.filter(function(s){ return s.strand===st; });
        var html = '<div id="strand-section-'+st+'" class="glass-card" style="border-top:4px solid '+sc.border+';margin-bottom:24px;">';
        html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px;"><h3 style="margin:0;color:'+sc.text+';">'+sc.icon+' '+st+' Students</h3><span style="background:'+sc.bg+';color:'+sc.text+';padding:5px 14px;border-radius:20px;font-size:12px;font-weight:700;">'+group.length+' student'+(group.length!==1?'s':'')+'</span></div>';
        if (group.length === 0) {
            html += '<p style="text-align:center;color:#bbb;padding:20px 0;font-size:13px;">No '+st+' students recorded yet.</p>';
        } else {
            html += '<div class="tbl-wrap"><table><thead><tr><th>#</th><th>Teacher ID / Student ID</th><th>Name</th><th>Year Level</th><th>Section</th><th>Outlook</th><th>Status</th><th style="text-align:center;">Action</th></tr></thead><tbody>';
            group.forEach(function(s, idx) {
                var statusB = s.status==='Complete' ? '<span class="badge badge-complete">✅ Complete</span>' : '<span class="badge badge-pending">⏳ Pending</span>';
                html += '<tr><td style="color:#aaa;font-size:11px;">'+(idx+1)+'</td><td style="font-weight:600;">'+s.id+'</td><td>'+s.name+'</td><td>'+(s.yearLevel||'—')+'</td><td>'+(s.section||'—')+'</td><td style="font-size:11px;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+(s.outlook_email||'<span style="color:#ccc;">—</span>')+'</td><td>'+statusB+'</td><td style="text-align:center;"><button class="btn-sm" style="background:#0d2b52;color:white;" onclick="showStudentProfileModal(\''+s.id+'\')"><i class="fas fa-user-circle"></i> View</button></td></tr>';
            });
            html += '</tbody></table></div>';
            var done = group.filter(function(s){ return s.status==='Complete'; }).length;
            var pct  = group.length > 0 ? Math.round((done/group.length)*100) : 0;
            html += '<div style="margin-top:14px;padding-top:12px;border-top:1px solid #f0f0f0;display:flex;align-items:center;gap:12px;flex-wrap:wrap;"><div style="flex:1;min-width:140px;"><div style="font-size:11px;color:#999;margin-bottom:4px;">Compliance rate</div><div style="height:8px;background:#eee;border-radius:4px;"><div style="height:100%;width:'+pct+'%;background:'+sc.border+';border-radius:4px;transition:.5s;"></div></div></div><div style="font-size:13px;font-weight:700;color:'+sc.text+';">'+pct+'% ('+done+'/'+group.length+')</div></div>';
        }
        container.innerHTML += html;
    });
}

var activeSHSStrandFilter = 'ALL'; // Renamed from activeStrandFilter
function setSHSStrandFilter(st) { // Renamed from setStrandFilter
    activeSHSStrandFilter = st;
    ['ALL'].concat(SHS_STRANDS).forEach(function(s) { // Use SHS_STRANDS
        var btn = document.getElementById('sfBtn-' + s);
        if (!btn) return;
        if (s === st) {
            btn.style.fontWeight = '700';
            btn.style.boxShadow = '0 3px 10px rgba(0,0,0,0.15)';
            btn.style.transform = 'translateY(-1px)';
            btn.style.opacity = '1'; // Ensure full opacity for active
        } else {
            btn.style.fontWeight = '500';
            btn.style.boxShadow = 'none';
            btn.style.transform = 'none';
            btn.style.opacity = '0.65';
        }
    });
    renderStrandView(shsStudents); // Render SHS students
}

function searchSHSStrandFilter() { // Renamed from searchStrandFilter
    var q = document.getElementById('strandSearch') ? document.getElementById('strandSearch').value.trim().toUpperCase() : '';
    if (q === '') { setSHSStrandFilter('ALL'); return; }
    var matched = SHS_STRANDS.find(function(s){ return s.indexOf(q) !== -1; });
    setSHSStrandFilter(matched || 'NONE');
}
function jumpToStrand(st) { // This function is used in HTML, keep name
    setSHSStrandFilter(st);
    setTimeout(function(){ var el=document.getElementById('strand-section-'+st); if(el) el.scrollIntoView({behavior:'smooth',block:'start'}); }, 60);
}

// ============================================================
//  PRINT FEATURE
// ============================================================
var _printSource = 'records';
var _printInProgress = false;
function openPrintModal(source) {
    _printSource = source || 'records';
    document.getElementById('printModalOverlay').classList.add('open');
    document.querySelector('input[name="printFilter"][value="all"]').checked = true;
    var strandGroup = document.getElementById('printStrandGroup');
    if (strandGroup) strandGroup.style.display = 'none';
    var rt = document.getElementById('printReportType');
    if (source === 'compliance') rt.value = 'compliance';
    else if (source === 'strands') rt.value = 'strand';
    else rt.value = 'fulllist';
    updatePrintPreview(); refreshRadioStyles();
}
function closePrintModal() { document.getElementById('printModalOverlay').classList.remove('open'); }
document.addEventListener('click', function(e){ var overlay=document.getElementById('printModalOverlay'); if(overlay && e.target===overlay) closePrintModal(); });
function refreshRadioStyles() {
    ['all','pending','complete','shs','tertiary'].forEach(function(v){ var item=document.getElementById('popt-'+v); var radio=item?item.querySelector('input'):null; if(!item||!radio) return; if(radio.checked) item.classList.add('checked'); else item.classList.remove('checked'); });
    var filterVal=document.querySelector('input[name="printFilter"]:checked').value;
}
document.querySelectorAll('input[name="printFilter"]').forEach(function(r){ r.addEventListener('change', refreshRadioStyles); });
function updatePrintPreview() {
    refreshRadioStyles();
    var filtered=getPrintData();
    var total=filtered.length;
    var pending=filtered.filter(function(s){ return s.status!=='Complete'; }).length;
    var complete=filtered.filter(function(s){ return s.status==='Complete'; }).length;
    document.getElementById('printPreviewText').innerHTML='<strong>'+total+'</strong> Users — <span style="color:#c0392b;">❌ '+pending+' Pendings</span> &nbsp; <span style="color:#27ae60;">✅ '+complete+' Completes</span>';
}
function getPrintData() {
    var filterVal=(document.querySelector('input[name="printFilter"]:checked')||{}).value||'all';
    var data=allUsers.filter(function(u){ return u.is_archived == 0; });
    if(filterVal==='pending')  data=data.filter(function(s){ return s.status!=='Complete'; });
    if(filterVal==='complete') data=data.filter(function(s){ return s.status==='Complete'; });
    if(filterVal==='shs')      data=data.filter(function(s){ return s.level==='SHS'; });
    if(filterVal==='tertiary')  data=data.filter(function(s){ return s.level==='Tertiary'; });
    return data;
}
function doPrint(mode) {
    if (_printInProgress) return;
    var data=getPrintData(); var reportType=(document.getElementById('printReportType')||{}).value||'compliance';
    var filterVal=(document.querySelector('input[name="printFilter"]:checked')||{}).value||'all';
    var strandVal=(document.getElementById('printStrandSelect')||{}).value||'';
    if(data.length===0){ showToast('No records to print for the selected filter.'); return; }
    _printInProgress = true;
    var html=buildPrintHTML(data,reportType,filterVal,strandVal)
        .replace('@page{margin:10mm; size:auto;}', '@page{margin:8mm; size:A4 landscape;}')
        .replace(/<small>Pending<\/small>/g, '<small>Pendings</small>')
        .replace(/Pending \/ Non-Compliant/g, 'Pendings / Non-Compliant')
        .replace(/<script>[\s\S]*?window\.print\(\);[\s\S]*?<\/script>/i, '');

    var oldFrame = document.getElementById('hs-print-frame');
    if (oldFrame && oldFrame.parentNode) oldFrame.parentNode.removeChild(oldFrame);

    var frame = document.createElement('iframe');
    frame.id = 'hs-print-frame';
    frame.style.position = 'fixed';
    frame.style.left = '-10000px';
    frame.style.top = '0';
    frame.style.width = '1200px';
    frame.style.height = '800px';
    frame.style.border = '0';
    frame.style.opacity = '0';
    document.body.appendChild(frame);

    var doc = frame.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();

    var cleanup = function(){
        _printInProgress = false;
        if (frame && frame.parentNode) frame.parentNode.removeChild(frame);
    };
    frame.contentWindow.onafterprint = cleanup;

    setTimeout(function(){
        frame.contentWindow.focus();
        frame.contentWindow.print();
        setTimeout(cleanup, 1800);
    }, 350);
    closePrintModal();
}

function buildPrintHTML(data, reportType, filterVal, strandVal) {
    var session = getUserSession();
    var nurseName = session ? session.name : 'Clinic Nurse';
    var nursePos = session ? session.position : 'Clinic Nurse';
    var branch = session ? session.branch : 'STI College Bacoor';
    
    var now=new Date();
    var dateStr=now.toLocaleDateString('en-PH',{year:'numeric',month:'long',day:'numeric'});
    var timeStr=now.toLocaleTimeString('en-PH',{hour:'2-digit',minute:'2-digit'});
    var totalCount=data.length;
    var completeCount=data.filter(function(s){ return s.status==='Complete'; }).length;
    var pendingCount=totalCount-completeCount;
    var compRate=totalCount>0?Math.round((completeCount/totalCount)*100):0; // Overall compliance rate for the filtered data
    var filterLabel={all:'Overall List',pending:'Pendings / Non-Compliant',complete:'Completes',shs:'SHS Population',tertiary:'Tertiary Population'}[filterVal]||'Overall List';
    var reportTitle={compliance:'Overall Medical Compliance Summary',fulllist:'Complete Population Health Records'}[reportType]||'Medical Compliance Report';
    var bodyHTML='';
    bodyHTML=buildPrintGroupedTables(data, reportType === 'compliance');
    return '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>'+reportTitle+' — HealthSync</title><link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet"><style>*{box-sizing:border-box;margin:0;padding:0;font-family:"Poppins",sans-serif;}html,body{background:white;color:#1a1a2e;width:100%;height:auto !important;overflow:visible !important;}.print-page{padding:12px 14px;width:100%;height:auto !important;overflow:visible !important;display:block !important;position:static !important;}.rpt-header{display:flex;align-items:center;justify-content:space-between;padding-bottom:12px;border-bottom:3px solid #0d2b52;margin-bottom:16px;}.rpt-logo{display:flex;align-items:center;gap:13px;}.rpt-logo-icon{width:46px;height:46px;background:#ffcb05;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:22px;color:#0d2b52;font-weight:900;}.rpt-logo-txt h1{font-size:26px;font-weight:800;color:#0d2b52;letter-spacing:1px;}.rpt-logo-txt p{font-size:12px;color:#666;text-transform:uppercase;letter-spacing:.8px;margin-top:2px;}.rpt-meta{text-align:right;font-size:13px;color:#666;line-height:1.7;}.rpt-meta strong{color:#0d2b52;font-weight:700;}.rpt-title{margin-bottom:18px;}.rpt-title h2{font-size:24px;font-weight:800;color:#0d2b52;margin-bottom:3px;}.rpt-title p{font-size:14px;color:#888;}.rpt-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px;}.rpt-stat{padding:10px 12px;border-radius:10px;color:white;text-align:center;}.rpt-stat.blue{background:#0d2b52;}.rpt-stat.green{background:#27ae60;}.rpt-stat.red{background:#c0392b;}.rpt-stat.gray{background:#7f8c8d;}.rpt-stat h3{font-size:25px;font-weight:800;margin:3px 0;}.rpt-stat small{font-size:12px;opacity:.85;}.rpt-progress{margin-bottom:20px;}.rpt-progress-lbl{display:flex;justify-content:space-between;font-size:13px;font-weight:600;color:#0d2b52;margin-bottom:5px;}.rpt-progress-track{height:10px;background:#e8ecf4;border-radius:5px;overflow:hidden;}.rpt-progress-fill{height:100%;background:linear-gradient(90deg,#27ae60,#2ecc71);border-radius:5px;}.print-group{margin:12px 0 16px;page-break-inside:auto;}.print-group h3{background:#0d2b52;color:white;padding:12px 14px;border-radius:8px 8px 0 0;font-size:19px;display:flex;justify-content:space-between;}.print-group h3 span{font-size:13px;font-weight:600;opacity:.85;}.print-subgroup{border:1px solid #dce3ef;border-top:0;margin-bottom:10px;page-break-inside:auto;}.print-subgroup h4{background:#eef3fb;color:#0d2b52;padding:11px 12px;font-size:17px;display:flex;justify-content:space-between;}.print-subgroup h4 span{font-size:12px;color:#666;}table{width:100%;border-collapse:collapse;font-size:15px;table-layout:auto;}thead{display:table-header-group;}thead th{background:#0d2b52;color:white;padding:11px 12px;text-align:left;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;white-space:nowrap;}tbody td{padding:11px 12px;border-bottom:1px solid #eee;vertical-align:middle;}tr{page-break-inside:avoid;page-break-after:auto;}tbody tr:nth-child(even) td{background:#f8faff;}.badge{padding:5px 11px;border-radius:20px;font-size:12px;font-weight:700;display:inline-block;}.badge-complete{background:#e8f5e9;color:#2e7d32;}.badge-pending{background:#fde8e8;color:#c0392b;border:1px solid #f5c6c2;}.strand-b{padding:5px 10px;border-radius:20px;font-size:12px;font-weight:700;display:inline-block;}.rpt-footer{margin-top:44px;padding-top:15px;border-top:1.5px solid #e8ecf4;display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;page-break-inside:avoid;}.rpt-sig-box{text-align:center;}.rpt-sig-line{border-top:1.5px solid #333;margin:42px auto 7px;width:82%;}.rpt-sig-label{font-size:14px;font-weight:700;color:#0d2b52;}.rpt-sig-sub{font-size:12px;color:#888;}.rpt-generated{margin-top:20px;text-align:center;font-size:10px;color:#bbb;}@media print{@page{margin:10mm; size:auto;} html,body{height:auto !important;overflow:visible !important;} .print-page{page-break-after:auto;} .print-group{break-inside:auto;} .print-subgroup{break-inside:avoid-page;}}</style></head><body><div class="print-page"><div class="rpt-header"><div class="rpt-logo"><div class="rpt-logo-icon">❤️</div><div class="rpt-logo-txt"><h1>HealthSync</h1><p>'+branch+' — Clinic Management System</p></div></div><div class="rpt-meta"><strong>Date:</strong> '+dateStr+'<br><strong>Time:</strong> '+timeStr+'<br></div></div><div class="rpt-title"><h2><i>'+reportTitle+'</i></h2><p>Filter: '+filterLabel+'&nbsp;&nbsp;|&nbsp;&nbsp;School Year: '+(data[0]&&data[0].schoolYear?data[0].schoolYear:'—')+'</p></div><div class="rpt-stats"><div class="rpt-stat blue"><small>Total Population</small><h3>'+totalCount+'</h3></div><div class="rpt-stat green"><small>Completes</small><h3>'+completeCount+'</h3></div><div class="rpt-stat red"><small>Pending</small><h3>'+pendingCount+'</h3></div><div class="rpt-stat gray"><small>Compliance Rate</small><h3>'+compRate+'%</h3></div></div><div class="rpt-progress"><div class="rpt-progress-lbl"><span>Compliance Progress</span><span>'+completeCount+' / '+totalCount+'</span></div><div class="rpt-progress-track"><div class="rpt-progress-fill" style="width:'+compRate+'%;"></div></div></div>'+bodyHTML+'<div class="rpt-footer"><div class="rpt-sig-box"><div class="rpt-sig-line"></div><div class="rpt-sig-label">'+nurseName+'</div><div class="rpt-sig-sub">Clinic Nurse</div></div><div class="rpt-sig-box"><div class="rpt-sig-line"></div><div class="rpt-sig-label">Teacher</div><div class="rpt-sig-sub">Signature over Printed Name</div></div><div class="rpt-sig-box"><div class="rpt-sig-line"></div><div class="rpt-sig-label">School Principal</div><div class="rpt-sig-sub">Signature over Printed Name</div></div></div><div class="rpt-generated">Generated by HealthSync Clinic Management System &nbsp;|&nbsp; '+branch+' &nbsp;|&nbsp; '+dateStr+' '+timeStr+'</div></div><script>window.addEventListener("load",function(){window.print();window.onafterprint=function(){window.close();};});<\/script></body></html>';
}

function printGroupSortKey(label) {
    var order = ['ICT','STEM','ABM','HUMSS','TOP','BSCS','BSIT','BSBA','BAPsy','BSTM','SHS Teacher','Tertiary Teacher','Unassigned'];
    var idx = order.indexOf(label);
    return idx === -1 ? 999 : idx;
}

function buildPrintGroupedTables(data, showStrand) {
    var groups = {};
    data.forEach(function(s) {
        var category = categoryDisplayLabel(s);
        var year = complianceYearLevelLabel(s);
        if (!groups[category]) groups[category] = {};
        if (!groups[category][year]) groups[category][year] = [];
        groups[category][year].push(s);
    });

    return Object.keys(groups).sort(function(a, b) {
        var ai = printGroupSortKey(a);
        var bi = printGroupSortKey(b);
        if (ai !== bi) return ai - bi;
        return a.localeCompare(b);
    }).map(function(category) {
        var years = Object.keys(groups[category]).sort(function(a, b) {
            return String(a).localeCompare(String(b), undefined, { numeric: true });
        });
        var total = years.reduce(function(sum, y) { return sum + groups[category][y].length; }, 0);
        var sections = years.map(function(year) {
            var rows = groups[category][year].slice().sort(function(a, b) {
                return String(a.section || '').localeCompare(String(b.section || ''), undefined, { numeric: true })
                    || String(a.name || '').localeCompare(String(b.name || ''));
            });
            return '<div class="print-subgroup"><h4>' + year + ' <span>' + rows.length + ' record' + (rows.length === 1 ? '' : 's') + '</span></h4>' + buildStudentTable(rows, showStrand) + '</div>';
        }).join('');
        return '<section class="print-group"><h3>' + category + ' <span>' + total + ' total</span></h3>' + sections + '</section>';
    }).join('');
}

function buildStudentTable(data, showStrand) {
    var STRAND_COLORS_T={ICT:['#dbeafe','#1d4ed8'],STEM:['#dcfce7','#15803d'],ABM:['#fef9c3','#854d0e'],HUMSS:['#fce7f3','#9d174d'],TOP:['#ede9fe','#5b21b6']};
    var cols=['#','ID','Full Name','Category','Year Level','Section','Status'];
    var headerRow=cols.map(function(c){ return '<th>'+c+'</th>'; }).join('');
    var rows=data.map(function(s,i){
        var statusClass=s.status==='Complete'?'badge-complete':'badge-pending';
        var statusLabel=s.status==='Complete'?'✅ Complete':'❌ Pending';

        // Generic category label logic
        var catLabel = categoryDisplayLabel(s);
        var sc = STRAND_COLORS_T[s.strand] || ['#f0f0f0','#555'];
        var catBadge = '<span class="strand-b" style="background:'+sc[0]+';color:'+sc[1]+';">'+catLabel+'</span>';

        return '<tr>'
            + '<td style="color:#aaa;text-align:center;">'+(i+1)+'</td>'
            + '<td style="font-weight:700;color:#0d2b52;">'+s.id+'</td>'
            + '<td style="font-weight:600;">'+s.name+'</td>'
            + '<td>'+catBadge+'</td>'
            + '<td>'+(s.yearLevel||'—')+'</td>'
            + '<td>'+(s.section||'—')+'</td>'
            + '<td><span class="badge '+statusClass+'">'+statusLabel+'</span></td>'
            + '</tr>';
    }).join('');
    return '<table><thead><tr>'+headerRow+'</tr></thead><tbody>'+rows+'</tbody></table>';
}



