<?php
header('Content-Type: application/json');
include __DIR__ . '/db.php';

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $fullName = trim($_POST['regName'] ?? '');
    $email = trim($_POST['regEmail'] ?? '');
    $position = trim($_POST['regPosition'] ?? '');
    $pass_input = $_POST['regPassword'] ?? '';

    if ($fullName === '' || !filter_var($email, FILTER_VALIDATE_EMAIL) || $pass_input === '') {
        echo json_encode(["status" => "error", "message" => "Please complete all required fields."]);
        exit();
    }
    $hashed_password = password_hash($pass_input, PASSWORD_DEFAULT);

    $stmt = $conn->prepare("INSERT INTO users (full_name, email, position, password) VALUES (?, ?, ?, ?)");
    $stmt->bind_param("ssss", $fullName, $email, $position, $hashed_password);

    if ($stmt->execute()) {
        echo json_encode(["status" => "success", "message" => "Account created!"]);
    } else {
        echo json_encode(["status" => "error", "message" => "Email already exists or database error."]);
     }
}
?>
