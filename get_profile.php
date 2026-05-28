<?php
header('Content-Type: application/json');
include __DIR__ . '/db.php';

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $email = $_POST['email'];
    $stmt = $conn->prepare("SELECT full_name, nickname, position, photo, notif_pending, notif_archive, default_chart, dark_mode FROM users WHERE email = ?");
    $stmt->bind_param("s", $email);
    $stmt->execute();
    $result = $stmt->get_result();
    $user = $result->fetch_assoc();

    if ($user) {
        echo json_encode(["status" => "success", "data" => $user]);
    } else {
        echo json_encode(["status" => "error", "message" => "User not found"]);
    }
}
?>
