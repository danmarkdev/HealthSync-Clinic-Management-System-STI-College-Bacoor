<?php
header('Content-Type: application/json');
include __DIR__ . '/db.php';

$autoloadPath = __DIR__ . '/vendor/autoload.php';
$smtpConfigPath = __DIR__ . '/smtp_config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['status' => 'error', 'message' => 'Invalid request method']);
    exit();
}

$submissionId = $_POST['id'] ?? '';
$studentId = $_POST['student_id'] ?? '';
$reason = trim($_POST['reason'] ?? '');

if ($submissionId === '' || $studentId === '' || $reason === '') {
    echo json_encode(['status' => 'error', 'message' => 'Missing rejection details']);
    exit();
}

if (!file_exists($autoloadPath)) {
    echo json_encode(['status' => 'error', 'message' => 'PHPMailer is not installed.']);
    exit();
}

if (!file_exists($smtpConfigPath)) {
    echo json_encode(['status' => 'error', 'message' => 'Missing smtp_config.php.']);
    exit();
}

require $autoloadPath;
require $smtpConfigPath;

use PHPMailer\PHPMailer\Exception as MailException;
use PHPMailer\PHPMailer\PHPMailer;

function send_rejection_email($to, $name, $fileName, $reason, &$errorMessage = '') {
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
        $mail->addReplyTo(SMTP_FROM_EMAIL, SMTP_FROM_NAME);
        $mail->addAddress($to, $name);
        $mail->Subject = 'REJECTED: Medical Requirement Submission';
        $mail->Body = "Hi {$name},\n\nYour submitted requirement ({$fileName}) was not approved for this reason:\n\n{$reason}\n\nPlease reply again with the corrected requirement file.\n\nThank you,\nHealthSync Clinic Team";
        $mail->isHTML(false);

        return $mail->send();
    } catch (MailException $e) {
        $errorMessage = $mail->ErrorInfo ?: $e->getMessage();
        error_log('Rejection mailer error: ' . $errorMessage);
        return false;
    }
}

$stmt = $conn->prepare(
    "SELECT s.file_name, s.channel, st.name, st.gmail, st.outlook_email
     FROM submissions s
     JOIN students st ON s.student_id = st.student_id
     WHERE s.id = ? AND s.student_id = ?
     LIMIT 1"
);
$stmt->bind_param("ss", $submissionId, $studentId);
$stmt->execute();
$record = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$record) {
    echo json_encode(['status' => 'error', 'message' => 'Submission not found']);
    exit();
}

$channel = strtolower((string)($record['channel'] ?? ''));
$targetEmail = $channel === 'outlook' ? ($record['outlook_email'] ?? '') : ($record['gmail'] ?? '');
if (!filter_var($targetEmail, FILTER_VALIDATE_EMAIL)) {
    $targetEmail = filter_var($record['gmail'] ?? '', FILTER_VALIDATE_EMAIL) ? $record['gmail'] : ($record['outlook_email'] ?? '');
}

if (!filter_var($targetEmail, FILTER_VALIDATE_EMAIL)) {
    echo json_encode(['status' => 'error', 'message' => 'No valid email address found for this person.']);
    exit();
}

$sendError = '';
if (!send_rejection_email($targetEmail, $record['name'], $record['file_name'] ?: 'submitted file', $reason, $sendError)) {
    echo json_encode(['status' => 'error', 'message' => 'Email failed' . ($sendError ? ': ' . $sendError : '')]);
    exit();
}

$conn->begin_transaction();

try {
    $studentStatus = 'Pending';
    $updateStudent = $conn->prepare("UPDATE students SET status = ? WHERE student_id = ?");
    $updateStudent->bind_param("ss", $studentStatus, $studentId);
    $updateStudent->execute();
    $updateStudent->close();

    $submissionStatus = 'rejected';
    $updateSubmission = $conn->prepare("UPDATE submissions SET status = ?, rejection_reason = ?, reviewed_at = NOW() WHERE id = ? AND student_id = ?");
    $updateSubmission->bind_param("ssss", $submissionStatus, $reason, $submissionId, $studentId);
    $updateSubmission->execute();
    $updateSubmission->close();

    $conn->commit();
    echo json_encode(['status' => 'success']);
} catch (Exception $e) {
    $conn->rollback();
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}

$conn->close();
?>
