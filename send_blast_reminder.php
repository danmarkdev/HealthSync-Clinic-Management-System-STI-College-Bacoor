<?php
include __DIR__ . '/db.php';
header('Content-Type: application/json');

$autoloadPath = __DIR__ . '/vendor/autoload.php';
if (!file_exists($autoloadPath)) {
    echo json_encode([
        'status' => 'error',
        'message' => 'PHPMailer is not installed. Open a terminal in PHP DATABASE and run: composer require phpmailer/phpmailer'
    ]);
    exit();
}
require $autoloadPath;

$smtpConfigPath = __DIR__ . '/smtp_config.php';
if (!file_exists($smtpConfigPath)) {
    echo json_encode([
        'status' => 'error',
        'message' => 'Missing smtp_config.php. Copy smtp_config.example.php to smtp_config.php and add your clinic email SMTP settings.'
    ]);
    exit();
}
require $smtpConfigPath;

use PHPMailer\PHPMailer\Exception;
use PHPMailer\PHPMailer\PHPMailer;

function cleanup_temp_attachments($attachments = []) {
    if (empty($attachments) || !is_array($attachments)) {
        return;
    }

    foreach ($attachments as $attachment) {
        if (!empty($attachment['path']) && is_file($attachment['path'])) {
            @unlink($attachment['path']);
        }
    }
}

function prepare_temp_attachments($upload) {
    if (empty($upload)) {
        return [];
    }

    $tmpDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'healthsync_blast_' . bin2hex(random_bytes(6));
    if (!is_dir($tmpDir) && !mkdir($tmpDir, 0700, true)) {
        throw new Exception('Could not prepare attachment folder.');
    }

    $prepared = [];
    $files = [];

    if (isset($upload['tmp_name']) && !is_array($upload['tmp_name'])) {
        $files[] = [
            'tmp_name' => $upload['tmp_name'],
            'name' => $upload['name'] ?? basename($upload['tmp_name']),
            'error' => $upload['error'] ?? UPLOAD_ERR_OK
        ];
    } elseif (isset($upload['tmp_name']) && is_array($upload['tmp_name'])) {
        foreach ($upload['tmp_name'] as $index => $tmpName) {
            $files[] = [
                'tmp_name' => $tmpName,
                'name' => $upload['name'][$index] ?? basename($tmpName),
                'error' => $upload['error'][$index] ?? UPLOAD_ERR_OK
            ];
        }
    }

    try {
        foreach ($files as $file) {
            if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
                continue;
            }
            if (empty($file['tmp_name']) || !is_uploaded_file($file['tmp_name'])) {
                continue;
            }
            $safeName = preg_replace('/[^A-Za-z0-9._-]/', '_', basename($file['name']));
            $target = $tmpDir . DIRECTORY_SEPARATOR . uniqid('att_', true) . '_' . $safeName;
            if (!move_uploaded_file($file['tmp_name'], $target)) {
                throw new Exception('Could not save uploaded attachment.');
            }
            $prepared[] = ['path' => $target, 'name' => $safeName];
        }
    } catch (Exception $e) {
        cleanup_temp_attachments($prepared);
        @rmdir($tmpDir);
        throw $e;
    }

    return $prepared;
}

function add_attachments_to_mail(PHPMailer $mail, $attachments = []) {
    if (empty($attachments) || !is_array($attachments)) {
        return;
    }

    foreach ($attachments as $attachment) {
        if (empty($attachment['path']) || !is_file($attachment['path'])) {
            continue;
        }
        $mail->addAttachment($attachment['path'], $attachment['name'] ?? basename($attachment['path']));
    }
}

function reply_address_for_student($studentId) {
    $studentId = preg_replace('/[^0-9A-Za-z_-]/', '', (string)$studentId);
    if ($studentId === '' || !defined('SMTP_FROM_EMAIL') || strpos(SMTP_FROM_EMAIL, '@') === false) {
        return SMTP_FROM_EMAIL;
    }
    [$local, $domain] = explode('@', SMTP_FROM_EMAIL, 2);
    return $local . '+hs' . $studentId . '@' . $domain;
}

function send_email_with_attachment($to, $subject, $message, $attachments = [], &$errorMessage = '', $studentId = '') {
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
        $mail->addReplyTo(reply_address_for_student($studentId), SMTP_FROM_NAME);
        $mail->addAddress($to);
        $mail->Subject = $subject;
        $mail->Body = $message;
        $mail->isHTML(false);

        add_attachments_to_mail($mail, $attachments);

        return $mail->send();
    } catch (Exception $e) {
        $errorMessage = $mail->ErrorInfo ?: $e->getMessage();
        error_log('Mailer Error: ' . $errorMessage);
        return false;
    }
}

function normalize_recipients($rawRecipients) {
    $decoded = json_decode($rawRecipients, true);
    if (!is_array($decoded)) {
        return [];
    }

    $recipients = [];
    foreach ($decoded as $item) {
        if (is_string($item)) {
            $recipients[] = ['email' => $item, 'name' => $item, 'channel' => 'Email'];
            continue;
        }

        if (is_array($item) && !empty($item['email'])) {
            $recipients[] = [
                'id' => $item['id'] ?? '',
                'email' => $item['email'],
                'name' => $item['name'] ?? $item['email'],
                'channel' => $item['channel'] ?? 'Email'
            ];
        }
    }

    return $recipients;
}

function remember_reminder_recipient($conn, $studentId, $email, $channel) {
    $studentId = trim((string)$studentId);
    $email = strtolower(trim((string)$email));
    if ($studentId === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) return;

    $stmt = $conn->prepare("INSERT INTO reminder_recipient_map (student_id, recipient_email, channel) VALUES (?, ?, ?)");
    if (!$stmt) return;
    $stmt->bind_param("sss", $studentId, $email, $channel);
    $stmt->execute();
    $stmt->close();
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $recipients = isset($_POST['recipients']) ? normalize_recipients($_POST['recipients']) : [];
    $subject = isset($_POST['subject']) ? $_POST['subject'] : '';
    $message = isset($_POST['message']) ? $_POST['message'] : '';
    $attachments = [];

    if (empty($recipients) || empty($subject) || empty($message)) {
        echo json_encode(['status' => 'error', 'message' => 'Missing required fields']);
        exit();
    }

    $success = 0;
    $failed = 0;
    $skipped = [];

    try {
        $attachments = prepare_temp_attachments($_FILES['attachments'] ?? []);

        foreach ($recipients as $email) {
            $targetEmail = $email['email'];
            $targetName = $email['name'];
            $targetChannel = $email['channel'];
            $targetId = trim((string)($email['id'] ?? ''));

            if (!filter_var($targetEmail, FILTER_VALIDATE_EMAIL)) {
                $skipped[] = $targetName . ' ' . $targetChannel . ': Invalid email';
                $failed++;
                continue;
            }

            $personalMessage = str_replace('{{to_name}}', $targetName, $message);
            $sendError = '';
            if (send_email_with_attachment($targetEmail, $subject, $personalMessage, $attachments, $sendError, $targetId)) {
                $success++;
                remember_reminder_recipient($conn, $targetId, $targetEmail, $targetChannel);
            } else {
                $failed++;
                $skipped[] = $targetName . ' ' . $targetChannel . ': Send failed' . ($sendError ? ' - ' . $sendError : '');
            }
        }
    } catch (Exception $e) {
        echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
        cleanup_temp_attachments($attachments);
        $conn->close();
        exit();
    } finally {
        cleanup_temp_attachments($attachments);
    }

    $uniqueRecipients = [];
    foreach ($recipients as $item) {
        $key = trim((string)($item['id'] ?? ''));
        if ($key === '') $key = strtolower(trim((string)($item['email'] ?? $item['name'])));
        if ($key === '') continue;
        $uniqueRecipients[$key] = $item['name'];
    }
    $recipients_str = implode('; ', array_values($uniqueRecipients));
    $channels = implode(', ', array_values(array_unique(array_map(function($item) { return $item['channel']; }, $recipients))));
    $skipped_str = implode('; ', $skipped);
    $stmt = $conn->prepare("INSERT INTO reminder_logs (recipients, channels, subject, message, success, failed, skipped) VALUES (?, ?, ?, ?, ?, ?, ?)");
    if ($stmt) {
        $stmt->bind_param("ssssiis", $recipients_str, $channels, $subject, $message, $success, $failed, $skipped_str);
        $stmt->execute();
        $stmt->close();
    }

    echo json_encode(['status' => 'success', 'success' => $success, 'failed' => $failed, 'skipped' => $skipped]);
} else {
    echo json_encode(['status' => 'error', 'message' => 'Invalid request method']);
}

$conn->close();
?>
