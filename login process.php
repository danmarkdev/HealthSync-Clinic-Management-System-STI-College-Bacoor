<?php
header('Content-Type: application/json');
include __DIR__ . '/db.php';

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $email = trim($_POST['loginEmail'] ?? '');
    $password = $_POST['loginPassword'] ?? '';

    if ($email === '' || $password === '') {
        echo json_encode(["status" => "error", "message" => "Email and password are required."]);
        exit();
    }

    $stmt = $conn->prepare("SELECT * FROM users WHERE email = ?");
    $stmt->bind_param("s", $email);
    $stmt->execute();
    $res = $stmt->get_result();
    $user = $res->fetch_assoc();

    if ($user && password_verify($password, $user['password'])) {
        echo json_encode([
            "status" => "success",
            "name" => $user['full_name'], // Ito ang 'name' sa JS
            "nickname" => $user['nickname'],
            "position" => $user['position'],
            "photo" => $user['photo'],
            "notif_pending" => $user['notif_pending'],
            "notif_archive" => $user['notif_archive'],
            "default_chart" => $user['default_chart'],
            "dark_mode" => $user['dark_mode']
        ]);
    } else {
        echo json_encode(["status" => "error", "message" => "Invalid email or password."]);
    }
}
?>
