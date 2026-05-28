<?php
header('Content-Type: application/json');
include __DIR__ . '/db.php';

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $student_id = $_POST['student_id'];
    $status = $_POST['status']; // 'Complete' or 'Pending'
    $submission_id = $_POST['submission_id'] ?? '';

    $stmt = $conn->prepare("UPDATE students SET status = ? WHERE student_id = ?");
    $stmt->bind_param("ss", $status, $student_id);

    if ($stmt->execute()) {
        if ($submission_id !== '' && $status === 'Complete') {
            $submissionStatus = 'approved';
            $subStmt = $conn->prepare("UPDATE submissions SET status = ? WHERE id = ? AND student_id = ?");
            $subStmt->bind_param("sss", $submissionStatus, $submission_id, $student_id);
            $subStmt->execute();
            $subStmt->close();
        }
        echo json_encode(["status" => "success"]);
    } else {
        echo json_encode(["status" => "error", "message" => $stmt->error]);
    }
}
?>
