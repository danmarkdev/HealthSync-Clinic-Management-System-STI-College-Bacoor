   <?php
header('Content-Type: application/json');
include __DIR__ . '/db.php';

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $current_email = $_POST['current_email'];
    $full_name = $_POST['name'];
    $nickname = $_POST['nickname'];
    $email = $_POST['email'];
    $notif_pending = $_POST['notif_pending'];
    $notif_archive = $_POST['notif_archive'];
    $default_chart = $_POST['default_chart'];
    $dark_mode = $_POST['dark_mode'];
    $photo = isset($_POST['photo']) ? $_POST['photo'] : null;
    
    // Siguraduhin na ang numeric/boolean fields ay integer bago i-bind sa SQL
    $notif_pending = (int)$notif_pending;
    $notif_archive = (int)$notif_archive;
    $dark_mode = (int)$dark_mode;

    if ($photo) {
        $stmt = $conn->prepare("UPDATE users SET full_name=?, nickname=?, email=?, notif_pending=?, notif_archive=?, default_chart=?, dark_mode=?, photo=? WHERE email=?");
        $stmt->bind_param("sssiisiss", $full_name, $nickname, $email, $notif_pending, $notif_archive, $default_chart, $dark_mode, $photo, $current_email);
    } else {
        $stmt = $conn->prepare("UPDATE users SET full_name=?, nickname=?, email=?, notif_pending=?, notif_archive=?, default_chart=?, dark_mode=? WHERE email=?");
        $stmt->bind_param("sssiisis", $full_name, $nickname, $email, $notif_pending, $notif_archive, $default_chart, $dark_mode, $current_email);
    }

    if ($stmt->execute()) {
        echo json_encode(["status" => "success", "message" => "Profile updated successfully"]);
    } else {
        echo json_encode(["status" => "error", "message" => "Update failed: " . $stmt->error]);
    }

    $stmt->close();
    $conn->close();
}
?>
