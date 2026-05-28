<?php
header('Content-Type: application/json');
include __DIR__ . '/db.php';

$sql = "SELECT id, scheduled_date, scheduled_time, channels, subject, message, status, success, failed, skipped, created_at, sent_at
        FROM scheduled_reminders
        WHERE status IN ('pending','processing','failed','skipped')
           OR (status = 'sent' AND sent_at >= DATE_SUB(NOW(), INTERVAL 7 DAY))
        ORDER BY
            CASE WHEN status IN ('pending','processing') THEN 0 ELSE 1 END,
            scheduled_date ASC,
            scheduled_time ASC,
            id ASC";
$result = $conn->query($sql);

$schedules = [];
if ($result) {
    while ($row = $result->fetch_assoc()) {
        $schedules[] = [
            'id' => (int)$row['id'],
            'scheduled_date' => $row['scheduled_date'],
            'scheduled_time' => $row['scheduled_time'],
            'channels' => $row['channels'],
            'subject' => $row['subject'],
            'message' => $row['message'],
            'status' => $row['status'],
            'success' => (int)$row['success'],
            'failed' => (int)$row['failed'],
            'skipped' => $row['skipped'],
            'created_at' => $row['created_at'],
            'sent_at' => $row['sent_at']
        ];
    }
}

$conn->close();
echo json_encode($schedules);
?>
