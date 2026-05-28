<?php
$file = isset($_GET['file']) ? basename($_GET['file']) : '';
if ($file === '') {
    http_response_code(400);
    echo 'Missing file.';
    exit();
}

$uploadDir = realpath(__DIR__ . '/../UPLOADS');
if (!$uploadDir) {
    http_response_code(404);
    echo 'Upload folder not found.';
    exit();
}

$path = realpath($uploadDir . DIRECTORY_SEPARATOR . $file);
if (!$path || strpos($path, $uploadDir) !== 0 || !is_file($path)) {
    http_response_code(404);
    echo 'File not found.';
    exit();
}

$mime = function_exists('mime_content_type') ? mime_content_type($path) : 'application/octet-stream';
header('Content-Type: ' . ($mime ?: 'application/octet-stream'));
header('Content-Disposition: inline; filename="' . basename($path) . '"');
header('Content-Length: ' . filesize($path));
readfile($path);
?>
