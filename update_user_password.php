<?php
header('Content-Type: application/json');
include __DIR__ . '/db.php';

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $token = $_POST['token'];
    $newPassword = $_POST['newPassword'];
    $hashed_password = password_hash($newPassword, PASSWORD_DEFAULT);

    // 1. Validate token and get email
    $stmt = $conn->prepare("SELECT email, expires_at FROM password_resets WHERE token = ?");
    $stmt->bind_param("s", $token);
    $stmt->execute();
    $stmt->store_result();

    if ($stmt->num_rows === 0) {
        echo json_encode(["status" => "error", "message" => "Invalid or expired token."]);
        exit();
    }
    $stmt->bind_result($email, $expires_at_raw);
    $stmt->fetch();
    $expires_at = strtotime($expires_at_raw);
    $stmt->close();

    if (time() > $expires_at) {
        echo json_encode(["status" => "error", "message" => "Token has expired."]);
        exit();
    }

    // 2. Update user's password
    $stmt = $conn->prepare("UPDATE users SET password = ? WHERE email = ?");
    $stmt->bind_param("ss", $hashed_password, $email);

    if ($stmt->execute()) {
        $stmt->close();

        // 3. Delete the used token para hindi na maulit (One-time use logic)
        $stmtDel = $conn->prepare("DELETE FROM password_resets WHERE token = ?");
        $stmtDel->bind_param("s", $token);
        $stmtDel->execute();
        $stmtDel->close();

        echo json_encode(["status" => "success", "message" => "Password updated successfully."]);
    } else {
        echo json_encode(["status" => "error", "message" => "Failed to update password."]);
    }

    $conn->close();
}
?>
