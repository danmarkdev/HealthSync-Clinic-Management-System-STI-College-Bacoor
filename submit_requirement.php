<?php
header('Content-Type: application/json');
include __DIR__ . '/db.php';

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $id = 'sub_' . uniqid();
    $student_id = $_POST['student_id'] ?? '';
    $file_name = !empty($_POST['file_name']) ? basename($_POST['file_name']) : 'No_file_attached';
    $message = $_POST['message'] ?? '';
    $channel = $_POST['channel'] ?? 'Portal'; // 'Gmail', 'Outlook', or 'Portal'

    if ($student_id === '') {
        echo json_encode(["status" => "error", "message" => "Student ID is required."]);
        exit();
    }

    $uploaded_files = [];
    if (isset($_FILES['file']) && ($_FILES['file']['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_OK) {
        $uploaded_files[] = $_FILES['file'];
    } elseif (isset($_FILES['attachments']) && is_array($_FILES['attachments']['name'])) {
        foreach ($_FILES['attachments']['name'] as $index => $name) {
            if (($_FILES['attachments']['error'][$index] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) continue;
            $uploaded_files[] = [
                'name' => $name,
                'tmp_name' => $_FILES['attachments']['tmp_name'][$index],
                'error' => $_FILES['attachments']['error'][$index],
                'size' => $_FILES['attachments']['size'][$index] ?? 0
            ];
        }
    }

    if (!empty($uploaded_files)) {
        $upload_dir = __DIR__ . '/../UPLOADS/';
        if (!is_dir($upload_dir)) {
            mkdir($upload_dir, 0777, true);
        }

        $saved_files = [];
        foreach ($uploaded_files as $uploaded_file) {
            $safe_name = time() . '_' . preg_replace('/[^a-zA-Z0-9._-]/', '_', basename($uploaded_file['name']));
            if (move_uploaded_file($uploaded_file['tmp_name'], $upload_dir . $safe_name)) {
                $saved_files[] = $safe_name;
            }
        }
        if (!empty($saved_files)) {
            $file_name = implode(',', $saved_files);
        }
    }

    $stmt = $conn->prepare("INSERT INTO submissions (id, student_id, file_name, message, channel) VALUES (?, ?, ?, ?, ?)");
    $stmt->bind_param("sssss", $id, $student_id, $file_name, $message, $channel);

    if ($stmt->execute()) {
        echo json_encode(["status" => "success", "message" => "Submission received!"]);
    } else {
        echo json_encode(["status" => "error", "message" => $stmt->error]);
    }

    $stmt->close();
    $conn->close();
}
?>
