<?php
header('Content-Type: application/json');
include __DIR__ . '/db.php';

$sql = "TRUNCATE TABLE reminder_logs";
if ($conn->query($sql) === TRUE) {
    echo json_encode(["status" => "success"]);
} else {
    echo json_encode(["status" => "error", "message" => $conn->error]);
}
$conn->close();
?>
