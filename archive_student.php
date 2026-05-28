<?php
header('Content-Type: application/json');
include __DIR__ . '/db.php';

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $student_id = $_POST['student_id'];
    $archive_val = $_POST['archive']; // 1 for archive, 0 for restore

    $stmt = $conn->prepare("UPDATE students SET is_archived = ? WHERE student_id = ?");
    $stmt->bind_param("is", $archive_val, $student_id);

    if ($stmt->execute()) {
        echo json_encode(["status" => "success"]);
    } else {
        echo json_encode(["status" => "error", "message" => $stmt->error]);
    }
}
?>
