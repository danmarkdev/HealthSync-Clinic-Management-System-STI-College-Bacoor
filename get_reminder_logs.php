<?php
header('Content-Type: application/json');
include __DIR__ . '/db.php';

$sql = "SELECT * FROM reminder_logs ORDER BY datetime DESC";
$result = $conn->query($sql);
$logs = [];
while($row = $result->fetch_assoc()) {
    $logs[] = [
        'datetime' => $row['datetime'],
        'recipients' => $row['recipients'],
        'channels' => $row['channels'],
        'subject' => $row['subject'],
        'message' => $row['message'],
        'success' => $row['success'],
        'failed' => $row['failed'],
        'skipped' => $row['skipped']
    ];
}
$conn->close();
echo json_encode($logs);
?>
