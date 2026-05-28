<?php
header('Content-Type: application/json');
include __DIR__ . '/db.php';

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $recipients = $_POST['recipients'];
    $channels = $_POST['channels'];
    $subject = $_POST['subject'];
    $message = $_POST['message'];
    $success = $_POST['success'] ?? 0;
    $failed = $_POST['failed'] ?? 0;

    $stmt = $conn->prepare("INSERT INTO reminder_logs (recipients, channels, subject, message, success, failed) VALUES (?, ?, ?, ?, ?, ?)");
    $stmt->bind_param("ssssii", $recipients, $channels, $subject, $message, $success, $failed);

    if ($stmt->execute()) echo json_encode(["status" => "success"]);
    else echo json_encode(["status" => "error", "message" => $stmt->error]);
}
?>
