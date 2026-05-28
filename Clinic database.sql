-- SQL para idagdag o i-update ang iyong account
-- HealthSync Complete Database Setup
-- Target Database: healthsync_db

-- 1. Table para sa Admin/Staff Accounts
CREATE TABLE IF NOT EXISTS users (
    id INT(11) AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    position VARCHAR(50),
    nickname VARCHAR(50),
    photo LONGTEXT,
    notif_pending TINYINT(1) DEFAULT 0,
    notif_archive TINYINT(1) DEFAULT 1,
    default_chart VARCHAR(20) DEFAULT 'bar',
    dark_mode TINYINT(1) DEFAULT 0,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Table para sa Student Health Records
CREATE TABLE IF NOT EXISTS students (
    id INT(11) AUTO_INCREMENT PRIMARY KEY,
    student_id VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    strand VARCHAR(50),
    course VARCHAR(100),
    level ENUM('SHS', 'Tertiary') NOT NULL,
    type ENUM('Student', 'Teacher') NOT NULL DEFAULT 'Student',
    year_level VARCHAR(20),
    section VARCHAR(50),
    school_year VARCHAR(20),
    gmail VARCHAR(100),
    outlook_email VARCHAR(100),
    emergency_contact VARCHAR(150),
    allergies VARCHAR(255),
    mental_state VARCHAR(255),
    requirements_passed TEXT,
    status ENUM('Complete', 'Pending') DEFAULT 'Pending',
    is_archived TINYINT(1) DEFAULT 0,
    date_added TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Table para sa Password Reset Tokens
CREATE TABLE IF NOT EXISTS password_resets (
    id INT(11) AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(100) NOT NULL,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Table para sa Reminder Logs
CREATE TABLE IF NOT EXISTS reminder_logs (
    id INT(11) AUTO_INCREMENT PRIMARY KEY,
    datetime TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    recipients TEXT,
    channels VARCHAR(50),
    subject VARCHAR(255),
    message TEXT,
    success INT(11) DEFAULT 0,
    failed INT(11) DEFAULT 0,
    skipped TEXT
);

-- 5. Table para sa Scheduled Reminder Queue
CREATE TABLE IF NOT EXISTS scheduled_reminders (
    id INT(11) AUTO_INCREMENT PRIMARY KEY,
    scheduled_date DATE NOT NULL,
    scheduled_time TIME NOT NULL DEFAULT '00:00:00',
    recipients_json TEXT NOT NULL,
    channels VARCHAR(50) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    attachments TEXT,
    status ENUM('pending','processing','sent','skipped','failed') DEFAULT 'pending',
    success INT(11) DEFAULT 0,
    failed INT(11) DEFAULT 0,
    skipped TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sent_at DATETIME NULL
);

-- 5. Table para sa Student Submissions
CREATE TABLE IF NOT EXISTS submissions (
    id VARCHAR(50) PRIMARY KEY,
    student_id VARCHAR(50) NOT NULL,
    file_name TEXT,
    message TEXT,
    channel VARCHAR(50),
    status VARCHAR(50) DEFAULT 'pending_review',
    rejection_reason TEXT,
    reviewed_at DATETIME NULL,
    source_account VARCHAR(150),
    source_uid VARCHAR(80),
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Demo portfolio account
-- Email: demo@healthsync.local
-- Password: Demo@12345
INSERT INTO users (full_name, email, position, nickname, photo, notif_pending, notif_archive, default_chart, dark_mode, password, created_at)
VALUES ('Demo Clinic Nurse', 'demo@healthsync.local', 'Clinic Nurse', 'Demo', NULL, 1, 1, 'bar', 0, '$2y$10$XgB1ypriw0ZhTssyzIDLr.FGMkakIX/s2C/wNUkwb2AOGnR8Q2Tn6', NOW())
ON DUPLICATE KEY UPDATE password = VALUES(password);
