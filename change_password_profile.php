<?php
header('Content-Type: application/json');
include __DIR__ . '/db.php';

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $email           = $_POST['email'] ?? '';
    $currentPassword = $_POST['currentPassword'] ?? '';
    $newPassword     = $_POST['newPassword'] ?? '';

    // 1. Verify current password
    $stmt = $conn->prepare("SELECT password FROM users WHERE email = ?");
    $stmt->bind_param("s", $email);
    $stmt->execute();
    $result = $stmt->get_result();
    $user = $result->fetch_assoc();
    $stmt->close();

    if ($user && password_verify($currentPassword, $user['password'])) {
        // 2. Hash and update new password
        $hashedPassword = password_hash($newPassword, PASSWORD_DEFAULT);
        $updateStmt = $conn->prepare("UPDATE users SET password = ? WHERE email = ?");
        $updateStmt->bind_param("ss", $hashedPassword, $email);
        
        if ($updateStmt->execute()) {
            echo json_encode(["status" => "success", "message" => "Password updated."]);
        } else {
            echo json_encode(["status" => "error", "message" => "Failed to update password."]);
        }
        $updateStmt->close();
    } else {
        echo json_encode(["status" => "error", "message" => "Incorrect current password."]);
    }

    $conn->close();
}
?>
