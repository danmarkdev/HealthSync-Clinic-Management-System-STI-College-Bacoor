<?php
header('Content-Type: application/json');
include __DIR__ . '/db.php';

if ($conn->query("DELETE FROM students")) {
    $conn->query("DELETE FROM reminder_logs");
    $conn->query("DELETE FROM submissions");
    echo json_encode(["status" => "success"]);
} else {
    echo json_encode(["status" => "error", "message" => $conn->error]);
}
?>
