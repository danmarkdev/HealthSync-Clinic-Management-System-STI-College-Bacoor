<?php
header('Content-Type: application/json');
include __DIR__ . '/db.php';

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $id = $_POST['id'];

    $stmt = $conn->prepare("DELETE FROM submissions WHERE id = ?");
    $stmt->bind_param("s", $id);

    if ($stmt->execute()) echo json_encode(["status" => "success"]);
    else echo json_encode(["status" => "error", "message" => $stmt->error]);
}
?>
