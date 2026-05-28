<?php
header('Content-Type: application/json');
include __DIR__ . '/db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['status' => 'error', 'message' => 'Invalid request method']);
    exit();
}

$submissionId = $_POST['id'] ?? '';
$studentId = $_POST['student_id'] ?? '';

if ($submissionId === '' || $studentId === '') {
    echo json_encode(['status' => 'error', 'message' => 'Missing submission or student ID']);
    exit();
}

$conn->begin_transaction();

try {
    $stmt = $conn->prepare("SELECT file_name FROM submissions WHERE id = ? AND student_id = ? LIMIT 1");
    $stmt->bind_param("ss", $submissionId, $studentId);
    $stmt->execute();
    $submission = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$submission) {
        throw new Exception('Submission not found.');
    }

    $status = 'Complete';
    $requirements = trim((string)($submission['file_name'] ?? ''));
    $updateStudent = $conn->prepare(
        "UPDATE students
         SET status = ?,
             requirements_passed = TRIM(BOTH '\n' FROM CONCAT(COALESCE(requirements_passed, ''), IF(COALESCE(requirements_passed, '') = '', '', '\n'), ?))
         WHERE student_id = ?"
    );
    $updateStudent->bind_param("sss", $status, $requirements, $studentId);
    $updateStudent->execute();
    $updateStudent->close();

    $submissionStatus = 'approved';
    $updateSubmission = $conn->prepare("UPDATE submissions SET status = ?, reviewed_at = NOW() WHERE id = ? AND student_id = ?");
    $updateSubmission->bind_param("sss", $submissionStatus, $submissionId, $studentId);
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
