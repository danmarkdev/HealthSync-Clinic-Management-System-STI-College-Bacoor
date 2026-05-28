<?php
date_default_timezone_set('Asia/Manila');

$configPath = __DIR__ . '/app_config.php';
$config = file_exists($configPath) ? require $configPath : [];

function healthsync_config($config, $key, $default = '') {
    if (isset($config[$key]) && $config[$key] !== '') {
        return $config[$key];
    }

    $envValue = getenv('HEALTHSYNC_' . strtoupper($key));
    return $envValue !== false && $envValue !== '' ? $envValue : $default;
}

$servername = healthsync_config($config, 'db_host', 'localhost');
$username = healthsync_config($config, 'db_user', 'root');
$password = healthsync_config($config, 'db_pass', '');
$dbname = healthsync_config($config, 'db_name', 'healthsync_db');

$conn = new mysqli($servername, $username, $password, $dbname);

if ($conn->connect_error) {
    header('Content-Type: application/json');
    echo json_encode([
        "status" => "error",
        "message" => "Database connection failed. Check PHP DATABASE/app_config.php database settings."
    ]);
    exit();
}
$conn->set_charset("utf8mb4");
$conn->query("SET time_zone = '+08:00'");

function ensureTertiaryLevel($conn) {
    $result = $conn->query("SHOW COLUMNS FROM students LIKE 'level'");
    if (!$result || $result->num_rows === 0) return;

    $conn->query("ALTER TABLE students MODIFY level ENUM('SHS','College','Tertiary') NOT NULL");
    $conn->query("UPDATE students SET level = 'Tertiary' WHERE level = 'College'");
    $conn->query("ALTER TABLE students MODIFY level ENUM('SHS','Tertiary') NOT NULL");
}

ensureTertiaryLevel($conn);

function ensureStudentProfileColumns($conn) {
    $needed = [
        'school_year' => "VARCHAR(20)",
        'emergency_contact' => "VARCHAR(150)",
        'allergies' => "VARCHAR(255)",
        'mental_state' => "VARCHAR(255)",
        'requirements_passed' => "TEXT"
    ];

    $existing = [];
    $result = $conn->query("SHOW COLUMNS FROM students");
    if (!$result) return;
    if ($result) {
        while ($row = $result->fetch_assoc()) {
            $existing[$row['Field']] = true;
        }
    }

    foreach ($needed as $column => $definition) {
        if (!isset($existing[$column])) {
            $conn->query("ALTER TABLE students ADD COLUMN `$column` $definition NULL");
        }
    }
}

ensureStudentProfileColumns($conn);

function ensureScheduledRemindersTable($conn) {
    $sql = "CREATE TABLE IF NOT EXISTS scheduled_reminders (
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
    )";
    $conn->query($sql);

    $needed = [
        'scheduled_date' => "DATE NOT NULL",
        'scheduled_time' => "TIME NOT NULL DEFAULT '00:00:00'",
        'recipients_json' => "TEXT NOT NULL",
        'channels' => "VARCHAR(50) NOT NULL",
        'subject' => "VARCHAR(255) NOT NULL",
        'message' => "TEXT NOT NULL",
        'attachments' => "TEXT",
        'status' => "ENUM('pending','processing','sent','skipped','failed') DEFAULT 'pending'",
        'success' => "INT(11) DEFAULT 0",
        'failed' => "INT(11) DEFAULT 0",
        'skipped' => "TEXT",
        'created_at' => "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
        'sent_at' => "DATETIME NULL"
    ];

    $existing = [];
    $result = $conn->query("SHOW COLUMNS FROM scheduled_reminders");
    if ($result) {
        while ($row = $result->fetch_assoc()) {
            $existing[$row['Field']] = true;
        }
    }

    foreach ($needed as $column => $definition) {
        if (!isset($existing[$column])) {
            $conn->query("ALTER TABLE scheduled_reminders ADD COLUMN `$column` $definition");
        }
    }
}

ensureScheduledRemindersTable($conn);

function ensureReminderLogsColumns($conn) {
    $needed = [
        'skipped' => "TEXT"
    ];

    $existing = [];
    $result = $conn->query("SHOW COLUMNS FROM reminder_logs");
    if (!$result) return;

    while ($row = $result->fetch_assoc()) {
        $existing[$row['Field']] = true;
    }

    foreach ($needed as $column => $definition) {
        if (!isset($existing[$column])) {
            $conn->query("ALTER TABLE reminder_logs ADD COLUMN `$column` $definition");
        }
    }
}

ensureReminderLogsColumns($conn);

function ensureSubmissionsTable($conn) {
    $sql = "CREATE TABLE IF NOT EXISTS submissions (
        id VARCHAR(50) PRIMARY KEY,
        student_id VARCHAR(50) NOT NULL,
        file_name TEXT,
        message TEXT,
        channel VARCHAR(50),
        status VARCHAR(50) DEFAULT 'pending_review',
        rejection_reason TEXT,
        reviewed_at DATETIME NULL,
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )";
    $conn->query($sql);

    $needed = [
        'message' => "TEXT",
        'channel' => "VARCHAR(50)",
        'status' => "VARCHAR(50) DEFAULT 'pending_review'",
        'rejection_reason' => "TEXT",
        'reviewed_at' => "DATETIME NULL",
        'source_account' => "VARCHAR(150)",
        'source_uid' => "VARCHAR(80)",
        'submitted_at' => "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
    ];

    $existing = [];
    $result = $conn->query("SHOW COLUMNS FROM submissions");
    if (!$result) return;

    while ($row = $result->fetch_assoc()) {
        $existing[$row['Field']] = true;
    }

    if (isset($existing['file_name'])) {
        $conn->query("ALTER TABLE submissions MODIFY file_name TEXT");
    }

    foreach ($needed as $column => $definition) {
        if (!isset($existing[$column])) {
            $conn->query("ALTER TABLE submissions ADD COLUMN `$column` $definition");
        }
    }
}

ensureSubmissionsTable($conn);

function ensureReminderRecipientMapTable($conn) {
    $sql = "CREATE TABLE IF NOT EXISTS reminder_recipient_map (
        id INT(11) AUTO_INCREMENT PRIMARY KEY,
        student_id VARCHAR(50) NOT NULL,
        recipient_email VARCHAR(150) NOT NULL,
        channel VARCHAR(50),
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_recipient_email (recipient_email),
        INDEX idx_sent_at (sent_at)
    )";
    $conn->query($sql);
}

ensureReminderRecipientMapTable($conn);
?>
