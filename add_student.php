<?php
header('Content-Type: application/json');
include __DIR__ . '/db.php';

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $student_id    = $_POST['id'];
    $name          = $_POST['name'];
    $level         = $_POST['level'];
    $type          = $_POST['type'];
    $strand        = isset($_POST['strand'])        ? $_POST['strand']        : '';
    $course        = isset($_POST['course'])        ? $_POST['course']        : '';
    $year_level    = isset($_POST['yearLevel'])     ? $_POST['yearLevel']     : '';
    $section       = isset($_POST['section'])       ? $_POST['section']       : '';
    $gmail         = isset($_POST['gmail'])         ? $_POST['gmail']         : '';
    $outlook_email = isset($_POST['outlook_email']) ? $_POST['outlook_email'] : '';
    $status        = $_POST['status'];

    $stmt = $conn->prepare("INSERT INTO students 
        (student_id, name, level, type, strand, course, year_level, section, gmail, outlook_email, status) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->bind_param("sssssssssss",
        $student_id, $name, $level, $type, $strand, $course,
        $year_level, $section, $gmail, $outlook_email, $status
    );

    if ($stmt->execute()) {
        echo json_encode(["status" => "success"]);
    } else {
        echo json_encode(["status" => "error", "message" => $stmt->error]);
    }
}
?>


