<?php
header('Content-Type: application/json');
include __DIR__ . '/db.php';

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    echo json_encode(["status" => "error", "message" => "Invalid request method."]);
    exit();
}

$scheduled_date = $_POST['scheduled_date'] ?? '';
$scheduled_time = $_POST['scheduled_time'] ?? '00:00';
$recipients_json = $_POST['recipients_json'] ?? '';
$channels = $_POST['channels'] ?? '';
$subject = $_POST['subject'] ?? '';
$message = $_POST['message'] ?? '';

if (!$scheduled_date || !$recipients_json || !$channels || !$subject || !$message) {
    echo json_encode(["status" => "error", "message" => "Missing required schedule data."]);
    exit();
}

$date = DateTime::createFromFormat('Y-m-d', $scheduled_date);
if (!$date || $date->format('Y-m-d') !== $scheduled_date) {
    echo json_encode(["status" => "error", "message" => "Invalid scheduled date."]);
    exit();
}

$time = DateTime::createFromFormat('H:i', $scheduled_time) ?: DateTime::createFromFormat('H:i:s', $scheduled_time);
if (!$time) {
    echo json_encode(["status" => "error", "message" => "Invalid scheduled time."]);
    exit();
}
$scheduled_time = $time->format('H:i:s');

$decoded = json_decode($recipients_json, true);
if (!is_array($decoded) || count($decoded) === 0) {
    echo json_encode(["status" => "error", "message" => "No recipients selected."]);
    exit();
}

$channelsList = array_filter(array_map('trim', explode(',', $channels)));
$allowedChannels = ['Gmail', 'Outlook'];
foreach ($channelsList as $channel) {
    if (!in_array($channel, $allowedChannels, true)) {
        echo json_encode(["status" => "error", "message" => "Invalid reminder channel."]);
        exit();
    }
}

$stmt = $conn->prepare("INSERT INTO scheduled_reminders (scheduled_date, scheduled_time, recipients_json, channels, subject, message) VALUES (?, ?, ?, ?, ?, ?)");
$stmt->bind_param("ssssss", $scheduled_date, $scheduled_time, $recipients_json, $channels, $subject, $message);

if ($stmt->execute()) {
    echo json_encode(["status" => "success", "id" => $conn->insert_id]);
} else {
    echo json_encode(["status" => "error", "message" => $stmt->error]);
}

$stmt->close();
$conn->close();
?>
