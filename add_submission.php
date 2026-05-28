<?php
header('Content-Type: application/json');
include __DIR__ . '/db.php';

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    // 1. Webhook Extraction (CloudMailin / Generic Format)
    // Ang 'from' field ay karaniwang: "Juan Dela Cruz <juan@gmail.com>"
    $from_header = $_POST['from'] ?? ($_POST['sender'] ?? ($_POST['email'] ?? '')); 
    preg_match('/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z0-9]{2,}/i', $from_header, $matches);
    $sender_email = $matches[0] ?? '';
    $sid = null; // Initialize

    // Ang body ng email (Plain text)
    $msg = $_POST['plain'] ?? $_POST['message'] ?? 'No message body provided.';

    if (empty($sender_email) && (!isset($_POST['student_id']) || empty($_POST['student_id']))) {
        echo json_encode(["status" => "error", "message" => "Sender email or student_id is required."]);
        exit();
    } elseif (empty($sender_email)) {
        // Fallback para sa manual testing
        $sid = $_POST['student_id'] ?? null;
        $chan = $_POST['channel'] ?? 'Portal';
        if (!$sid) { 
            echo json_encode(["status" => "error", "message" => "Student ID required for manual test."]); exit(); 
        }
    } else {
        // 2. Lookup Student ID base sa email ng nag-send
        $sid = null; // Initialize
        $stmt_find = $conn->prepare("SELECT student_id, name, gmail, outlook_email FROM students WHERE gmail = ? OR outlook_email = ? LIMIT 1");
        // Error handling for prepare statement
        if (!$stmt_find) {
            echo json_encode(["status" => "error", "message" => "SQL Prepare failed: " . $conn->error]);
            exit();
        }
        $stmt_find->bind_param("ss", $sender_email, $sender_email);
        $stmt_find->execute();
        // Check for execution errors
        if ($stmt_find->errno) { echo json_encode(["status" => "error", "message" => "SQL Execute failed: " . $stmt_find->error]); exit(); }
        $res = $stmt_find->get_result();
        $student = $res->fetch_assoc();

        if ($student) {
            $sid = $student['student_id'];
            $chan = strcasecmp($sender_email, $student['outlook_email']) === 0 ? 'Outlook' : 'Gmail';
        } else {
            // Kung hindi kilala ang email, hindi tatanggapin ang submission
            echo json_encode(["status" => "error", "message" => "Email $sender_email is not registered."]);
            exit();
        }
    }

    $id = 'sub_' . uniqid(); // Unique ID for submission record
    $file_name = !empty($_POST['file_name']) ? basename($_POST['file_name']) : 'No_file_attached'; // Default value if no file is uploaded

    // 3. File Handling for Webhooks
    $uploaded_files = [];
    
    if (isset($_FILES['file']) && $_FILES['file']['error'] == 0) {
        $uploaded_files[] = $_FILES['file'];
    } elseif (isset($_FILES['attachments']) && is_array($_FILES['attachments']['name']) && isset($_FILES['attachments']['name'][0])) {
        foreach ($_FILES['attachments']['name'] as $index => $name) {
            if (($_FILES['attachments']['error'][$index] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) continue;
            $uploaded_files[] = [
                'name'     => $name,
                'tmp_name' => $_FILES['attachments']['tmp_name'][$index],
                'error'    => $_FILES['attachments']['error'][$index],
                'size'     => $_FILES['attachments']['size'][$index]
            ];
        }
    } elseif (isset($_FILES['attachment-1'])) {
        $uploaded_files[] = $_FILES['attachment-1'];
    }

    if (!empty($uploaded_files)) {
        $upload_dir = __DIR__ . '/../UPLOADS/';
        if (!is_dir($upload_dir)) {
            mkdir($upload_dir, 0777, true);
        }

        $saved_files = [];
        foreach ($uploaded_files as $uploaded_file) {
            if (($uploaded_file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) continue;
            $safe_name = time() . '_' . preg_replace("/[^a-zA-Z0-9._-]/", "_", basename($uploaded_file['name']));
            $target = $upload_dir . $safe_name;
            if (move_uploaded_file($uploaded_file['tmp_name'], $target)) {
                $saved_files[] = $safe_name;
            }
        }
        if (!empty($saved_files)) {
            $file_name = implode(',', $saved_files);
        }
    }

    if ($file_name === 'No_file_attached' && !empty($_POST['attachment_name'])) {
        $file_name = basename($_POST['attachment_name']);
    }

    // 4. Save Submission
    if (empty($sid)) {
        echo json_encode(["status" => "error", "message" => "Could not determine student ID."]);
        exit();
    }

    $stmt = $conn->prepare("INSERT INTO submissions (id, student_id, file_name, message, channel) VALUES (?, ?, ?, ?, ?)");
    $stmt->bind_param("sssss", $id, $sid, $file_name, $msg, $chan);

    if ($stmt->execute()) { // Check for execution errors
        echo json_encode(["status" => "success"]);
    } else {
        // Log the error for debugging
        error_log("Failed to insert submission: " . $stmt->error);
        echo json_encode(["status" => "error", "message" => $stmt->error]);
    }
    $stmt->close();
    $conn->close();
}
?>
