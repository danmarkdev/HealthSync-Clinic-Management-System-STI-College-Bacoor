<?php
if (php_sapi_name() !== 'cli') {
    header('Content-Type: application/json');
}
include __DIR__ . '/db.php';

$autoloadPath = __DIR__ . '/vendor/autoload.php';
if (!file_exists($autoloadPath)) {
    echo json_encode(["status" => "error", "message" => "PHPMailer is not installed."]);
    exit();
}
require $autoloadPath;

$smtpConfigPath = __DIR__ . '/smtp_config.php';
if (!file_exists($smtpConfigPath)) {
    echo json_encode(["status" => "error", "message" => "Missing smtp_config.php."]);
    exit();
}
require $smtpConfigPath;

use PHPMailer\PHPMailer\Exception;
use PHPMailer\PHPMailer\PHPMailer;

function add_file_attachments(PHPMailer $mail, $attachments = []) {
    if (empty($attachments) || !is_array($attachments)) return;
    foreach ($attachments as $attachment) {
        if (!is_string($attachment) || !file_exists($attachment)) continue;
        $mail->addAttachment($attachment, basename($attachment));
    }
}

function scheduled_reply_address_for_student($studentId) {
    $studentId = preg_replace('/[^0-9A-Za-z_-]/', '', (string)$studentId);
    if ($studentId === '' || !defined('SMTP_FROM_EMAIL') || strpos(SMTP_FROM_EMAIL, '@') === false) {
        return SMTP_FROM_EMAIL;
    }
    [$local, $domain] = explode('@', SMTP_FROM_EMAIL, 2);
    return $local . '+hs' . $studentId . '@' . $domain;
}

function send_scheduled_email($to, $subject, $message, $attachments = [], &$errorMessage = '', $studentId = '') {
    $mail = new PHPMailer(true);
    try {
        $mail->isSMTP();
        $mail->Host = SMTP_HOST;
        $mail->SMTPAuth = true;
        $mail->Username = SMTP_USERNAME;
        $mail->Password = SMTP_PASSWORD;
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port = SMTP_PORT;
        $mail->CharSet = 'UTF-8';
        $mail->setFrom(SMTP_FROM_EMAIL, SMTP_FROM_NAME);
        $mail->addReplyTo(scheduled_reply_address_for_student($studentId), SMTP_FROM_NAME);
        $mail->addAddress($to);
        $mail->Subject = $subject;
        $mail->Body = $message;
        $mail->isHTML(false);
        add_file_attachments($mail, $attachments);
        return $mail->send();
    } catch (Exception $e) {
        $errorMessage = $mail->ErrorInfo ?: $e->getMessage();
        error_log('Scheduled reminder mailer error: ' . $errorMessage);
        return false;
    }
}

function remember_scheduled_recipient($conn, $studentId, $email, $channel) {
    $studentId = trim((string)$studentId);
    $email = strtolower(trim((string)$email));
    if ($studentId === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) return;

    $stmt = $conn->prepare("INSERT INTO reminder_recipient_map (student_id, recipient_email, channel) VALUES (?, ?, ?)");
    if (!$stmt) return;
    $stmt->bind_param("sss", $studentId, $email, $channel);
    $stmt->execute();
    $stmt->close();
}

$processed = 0;
$sentSchedules = 0;
$failedSchedules = 0;
$errors = [];

$lockResult = $conn->query("SELECT GET_LOCK('healthsync_scheduled_reminders', 0) AS got_lock");
$lockRow = $lockResult ? $lockResult->fetch_assoc() : null;
if (!$lockRow || (int)$lockRow['got_lock'] !== 1) {
    $conn->close();
    echo json_encode([
        "status" => "success",
        "processed" => 0,
        "sent_schedules" => 0,
        "failed_or_skipped_schedules" => 0,
        "message" => "Scheduled reminder processor is already running."
    ]);
    exit();
}

$due = $conn->query("SELECT * FROM scheduled_reminders WHERE status = 'pending' AND (scheduled_date < CURDATE() OR (scheduled_date = CURDATE() AND scheduled_time <= CURTIME())) ORDER BY scheduled_date ASC, scheduled_time ASC, id ASC");
if (!$due) {
    $errors[] = $conn->error;
}

while ($due && ($schedule = $due->fetch_assoc())) {
    $processed++;
    $scheduleId = (int)$schedule['id'];
    $conn->query("UPDATE scheduled_reminders SET status = 'processing' WHERE id = $scheduleId AND status = 'pending'");
    if ($conn->affected_rows !== 1) {
        continue;
    }

    $recipientIds = json_decode($schedule['recipients_json'], true);
    if (!is_array($recipientIds) || count($recipientIds) === 0) {
        $conn->query("UPDATE scheduled_reminders SET status = 'skipped', skipped = 'No recipients', sent_at = NOW() WHERE id = $scheduleId");
        continue;
    }

    $success = 0;
    $failed = 0;
    $skipped = [];
    $recipientNames = [];
    $channels = array_map('trim', explode(',', $schedule['channels']));
    $useGmail = in_array('Gmail', $channels);
    $useOutlook = in_array('Outlook', $channels);

    $attachments = json_decode($schedule['attachments'] ?? '[]', true);
    if (!is_array($attachments)) $attachments = [];

    foreach ($recipientIds as $studentId) {
        $stmt = $conn->prepare("SELECT student_id, name, gmail, outlook_email, status, is_archived FROM students WHERE student_id = ? LIMIT 1");
        $stmt->bind_param("s", $studentId);
        $stmt->execute();
        $student = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        if (!$student) {
            $skipped[] = $studentId . " (not found)";
            continue;
        }
        if ($student['is_archived'] == 1) {
            $skipped[] = $student['name'] . " (archived)";
            continue;
        }
        if ($student['status'] === 'Complete') {
            $skipped[] = $student['name'] . " (already complete)";
            continue;
        }

        $recipientNames[] = $student['name'];
        $personalMessage = str_replace("{{to_name}}", $student['name'], $schedule['message']);

        if ($useGmail) {
            if (!empty($student['gmail'])) {
                $sendError = '';
                if (send_scheduled_email($student['gmail'], $schedule['subject'], $personalMessage, $attachments, $sendError, $student['student_id'])) {
                    $success++;
                    remember_scheduled_recipient($conn, $student['student_id'], $student['gmail'], 'Gmail');
                } else {
                    $failed++;
                    $skipped[] = $student['name'] . ' Gmail failed' . ($sendError ? ': ' . $sendError : '');
                }
            } else {
                $failed++;
                $skipped[] = $student['name'] . ' (no Gmail)';
            }
        }
        if ($useOutlook) {
            if (!empty($student['outlook_email'])) {
                $sendError = '';
                if (send_scheduled_email($student['outlook_email'], $schedule['subject'], $personalMessage, $attachments, $sendError, $student['student_id'])) {
                    $success++;
                    remember_scheduled_recipient($conn, $student['student_id'], $student['outlook_email'], 'Outlook');
                } else {
                    $failed++;
                    $skipped[] = $student['name'] . ' Outlook failed' . ($sendError ? ': ' . $sendError : '');
                }
            } else {
                $failed++;
                $skipped[] = $student['name'] . ' (no Outlook email)';
            }
        }
    }

    $finalStatus = $success > 0 ? 'sent' : (count($skipped) > 0 ? 'skipped' : 'failed');
    if ($finalStatus === 'sent') $sentSchedules++;
    else $failedSchedules++;

    $skippedText = implode(', ', $skipped);
    $stmt = $conn->prepare("UPDATE scheduled_reminders SET status = ?, success = ?, failed = ?, skipped = ?, sent_at = NOW() WHERE id = ?");
    $stmt->bind_param("siisi", $finalStatus, $success, $failed, $skippedText, $scheduleId);
    $stmt->execute();
    $stmt->close();

    $logSubject = "[Scheduled] " . $schedule['subject'];
    $recipientsText = implode(', ', $recipientNames);
    $stmt = $conn->prepare("INSERT INTO reminder_logs (recipients, channels, subject, message, success, failed, skipped) VALUES (?, ?, ?, ?, ?, ?, ?)");
    $stmt->bind_param("ssssiis", $recipientsText, $schedule['channels'], $logSubject, $schedule['message'], $success, $failed, $skippedText);
    $stmt->execute();
    $stmt->close();
}

$conn->query("SELECT RELEASE_LOCK('healthsync_scheduled_reminders')");
$conn->close();
echo json_encode([
    "status" => count($errors) ? "error" : "success",
    "processed" => $processed,
    "sent_schedules" => $sentSchedules,
    "failed_or_skipped_schedules" => $failedSchedules,
    "errors" => $errors
]);
?>
