<?php
header('Content-Type: application/json');
include __DIR__ . '/db.php';

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $token = $_POST['token'];

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

    if (time() > $expires_at) {
        echo json_encode(["status" => "error", "message" => "Token has expired."]);
        exit();
    }

    echo json_encode(["status" => "success", "email" => $email]);

    $stmt->close();
    $conn->close();
}
?>
