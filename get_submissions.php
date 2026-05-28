<?php
header('Content-Type: application/json');
include __DIR__ . '/db.php';

$conn->query("
    UPDATE submissions
    SET status = 'ignored',
        reviewed_at = COALESCE(reviewed_at, NOW())
    WHERE status = 'pending_review'
      AND (
          message LIKE '%not approved for this reason:%'
          OR message LIKE '%HealthSync Clinic Team%'
          OR message LIKE '%This is from the STI College Bacoor Clinic%'
          OR message LIKE '%HealthSync login verification code%'
          OR message LIKE '%linkedin%'
          OR message LIKE '%unsubscribe%'
          OR message LIKE '%people you may know%'
          OR message LIKE '%notification emails%'
      )
");

function clean_submission_message($message) {
    $message = str_replace(["\r\n", "\r"], "\n", trim((string)$message));
    $message = preg_replace('/--[a-zA-Z0-9_+=\/.-]{6,}--?/m', '', $message);
    $message = preg_replace('/Content-Type:.*$/mi', '', $message);
    $message = preg_replace('/Content-Transfer-Encoding:.*$/mi', '', $message);
    $message = preg_replace('/Content-Disposition:.*$/mi', '', $message);
    $message = preg_replace('/\n?\s*On\s[\s\S]+?wrote:\s*[\s\S]*$/i', '', $message);
    $message = preg_replace('/\n?\s*From:\s.+?(Sent:|Date:|To:|Subject:)[\s\S]*$/i', '', $message);
    $message = preg_replace('/\n?\s*_{5,}\s*[\s\S]*$/', '', $message);
    $message = preg_replace('/\n?\s*-{2,}\s*Original Message\s*-{2,}[\s\S]*$/i', '', $message);
    $message = preg_replace('/^>.*$/m', '', $message);
    $message = preg_replace('/\n{3,}/', "\n\n", $message);
    return trim($message) ?: 'No message body provided.';
}

function normalize_submission_name_text($value) {
    return strtolower(preg_replace('/[^a-z0-9]+/i', ' ', (string)$value));
}

function find_submission_sender_by_mentioned_name($conn, $message) {
    $text = ' ' . normalize_submission_name_text($message) . ' ';
    $result = $conn->query("SELECT student_id, name FROM students WHERE is_archived = 0");
    if (!$result) return null;

    $found = [];
    while ($row = $result->fetch_assoc()) {
        $name = trim((string)$row['name']);
        if ($name === '') continue;
        $variants = [normalize_submission_name_text($name)];
        if (strpos($name, ',') !== false) {
            $parts = array_map('trim', explode(',', $name, 2));
            $last = $parts[0] ?? '';
            $first = $parts[1] ?? '';
            if ($first !== '' && $last !== '') {
                $variants[] = normalize_submission_name_text($first . ' ' . $last);
                $variants[] = normalize_submission_name_text($last . ' ' . $first);
                $variants[] = normalize_submission_name_text($first);
            }
        } else {
            $tokens = preg_split('/\s+/', $name);
            if (!empty($tokens[0])) $variants[] = normalize_submission_name_text($tokens[0]);
        }

        foreach (array_unique($variants) as $variant) {
            $variant = trim($variant);
            if (strlen($variant) < 3) continue;
            if (strpos($text, ' ' . $variant . ' ') !== false) {
                $found[$row['student_id']] = $row;
                break;
            }
        }
    }

    return count($found) === 1 ? array_values($found)[0] : null;
}

function repair_pending_sender_links($conn) {
    $result = $conn->query("SELECT id, student_id, message FROM submissions WHERE status = 'pending_review'");
    if (!$result) return;
    while ($row = $result->fetch_assoc()) {
        $matched = find_submission_sender_by_mentioned_name($conn, $row['message']);
        if (!$matched || $matched['student_id'] === $row['student_id']) continue;
        $stmt = $conn->prepare("UPDATE submissions SET student_id = ? WHERE id = ?");
        if (!$stmt) continue;
        $stmt->bind_param("ss", $matched['student_id'], $row['id']);
        $stmt->execute();
        $stmt->close();
    }
}

repair_pending_sender_links($conn);

$sql = "SELECT s.id, s.student_id, s.file_name, s.message, s.channel, s.status, s.rejection_reason, s.reviewed_at, s.submitted_at, st.name as student_name, st.strand, st.course, st.level, st.type, st.year_level, st.section 
        FROM submissions s 
        JOIN students st ON s.student_id = st.student_id 
        ORDER BY s.submitted_at DESC";
$result = $conn->query($sql);
$subs = [];
while($row = $result->fetch_assoc()) {
    $subs[] = [
        'id' => $row['id'],
        'studentId' => $row['student_id'],
        'student_id' => $row['student_id'],
        'studentName' => $row['student_name'],
        'student_name' => $row['student_name'],
        'strand' => $row['strand'],
        'course' => $row['course'],
        'level' => $row['level'],
        'type' => $row['type'],
        'yearLevel' => $row['year_level'], // Added for completeness in bell notif
        'section' => $row['section'],       // Added for completeness in bell notif
        'fileName' => $row['file_name'],
        'file_name' => $row['file_name'],
        'message' => clean_submission_message($row['message']),
        'channel' => $row['channel'],
        'status' => $row['status'],
        'rejectionReason' => $row['rejection_reason'] ?? '',
        'rejection_reason' => $row['rejection_reason'] ?? '',
        'reviewedAt' => $row['reviewed_at'] ?? '',
        'reviewed_at' => $row['reviewed_at'] ?? '',
        'submittedAt' => $row['submitted_at']
        ,'submitted_at' => $row['submitted_at']
    ];
}
echo json_encode($subs);
?>
