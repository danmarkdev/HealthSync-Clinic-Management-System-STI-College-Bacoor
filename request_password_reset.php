<?php
header('Content-Type: application/json');
include __DIR__ . '/db.php';

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $email = $_POST['email'];

    // 1. Check if email exists in users table
    $stmt = $conn->prepare("SELECT id, full_name FROM users WHERE email = ?");
    $stmt->bind_param("s", $email);
    $stmt->execute();
    $stmt->store_result();

    if ($stmt->num_rows === 0) {
        echo json_encode(["status" => "error", "message" => "No account found with that email address."]);
        exit();
    }
    $stmt->bind_result($user_id, $full_name);
    $stmt->fetch();
    $stmt->close();

    // 2. Generate a unique token
    $token = bin2hex(random_bytes(32)); // 64 characters long
    $expires_at = date('Y-m-d H:i:s', strtotime('+30 minutes')); // Token valid for 30 minutes

    // 3. Remove old reset tokens for this email, then create a fresh token
    $stmt = $conn->prepare("DELETE FROM password_resets WHERE email = ?");
    $stmt->bind_param("s", $email);
    $stmt->execute();
    $stmt->close();

    $stmt = $conn->prepare("INSERT INTO password_resets (email, token, expires_at) VALUES (?, ?, ?)");
    $stmt->bind_param("sss", $email, $token, $expires_at);

    if ($stmt->execute()) {
        echo json_encode([
            "status" => "success",
            "message" => "Reset link generated.",
            "token" => $token,
            "name" => $full_name
        ]);
    } else {
        echo json_encode(["status" => "error", "message" => "Failed to generate reset link: " . $stmt->error]);
    }

    $stmt->close();
    $conn->close();
}
?>
