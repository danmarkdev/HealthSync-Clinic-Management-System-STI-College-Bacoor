<?php
header('Content-Type: application/json');
include __DIR__ . '/db.php';

$configPath = __DIR__ . '/email_inbox_config.php';
$result = [
    'status' => 'success',
    'processed' => 0,
    'saved' => 0,
    'skipped' => 0,
    'errors' => []
];

set_time_limit(45);

if (!function_exists('imap_open')) {
    $result['status'] = 'error';
    $result['errors'][] = 'PHP IMAP extension is not enabled on this server. Email reply checking is optional and depends on host support.';
    echo json_encode($result);
    exit();
}

if (!file_exists($configPath)) {
    $result['status'] = 'not_configured';
    $result['errors'][] = 'Missing PHP DATABASE/email_inbox_config.php. Copy email_inbox_config.example.php and fill in mailbox details.';
    echo json_encode($result);
    exit();
}

$config = include $configPath;
$accounts = isset($config['accounts']) && is_array($config['accounts']) ? $config['accounts'] : [];

$lockResult = $conn->query("SELECT GET_LOCK('healthsync_email_reply_checker', 0) AS got_lock");
$lockRow = $lockResult ? $lockResult->fetch_assoc() : null;
if (!$lockRow || (int)$lockRow['got_lock'] !== 1) {
    $result['status'] = 'busy';
    $result['errors'][] = 'Email checker is already running. Please wait for the next auto-check.';
    echo json_encode($result);
    exit();
}

imap_timeout(IMAP_OPENTIMEOUT, 8);
imap_timeout(IMAP_READTIMEOUT, 8);
imap_timeout(IMAP_WRITETIMEOUT, 8);
imap_timeout(IMAP_CLOSETIMEOUT, 5);

function column_exists($conn, $table, $column) {
    $stmt = $conn->prepare("SHOW COLUMNS FROM `$table` LIKE ?");
    if (!$stmt) return false;
    $stmt->bind_param("s", $column);
    $stmt->execute();
    $exists = $stmt->get_result()->num_rows > 0;
    $stmt->close();
    return $exists;
}

if (!column_exists($conn, 'submissions', 'source_account')) {
    $conn->query("ALTER TABLE submissions ADD COLUMN source_account VARCHAR(150)");
}
if (!column_exists($conn, 'submissions', 'source_uid')) {
    $conn->query("ALTER TABLE submissions ADD COLUMN source_uid VARCHAR(80)");
}

// Clean up clinic self-replies that were imported before self-sent mail was blocked.
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
      )
");

function extract_email_address($from) {
    if (preg_match('/[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}/i', $from, $matches)) {
        return strtolower($matches[0]);
    }
    return '';
}

function extract_email_addresses($value) {
    if (!preg_match_all('/[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}/i', (string)$value, $matches)) {
        return [];
    }
    $emails = [];
    foreach ($matches[0] as $email) {
        $email = strtolower(trim($email));
        if ($email !== '' && !in_array($email, $emails, true)) {
            $emails[] = $email;
        }
    }
    return $emails;
}

function extract_reference_id_from_addresses($value) {
    if (preg_match('/\+hs([0-9A-Za-z_-]+)@/i', (string)$value, $matches)) {
        return $matches[1];
    }
    return '';
}

function decode_mime_text($value) {
    $parts = imap_mime_header_decode($value ?: '');
    $text = '';
    foreach ($parts as $part) {
        $text .= $part->text;
    }
    return $text;
}

function decode_message_part($content, $encoding) {
    if ((int)$encoding === 3) return base64_decode($content);
    if ((int)$encoding === 4) return quoted_printable_decode($content);
    return $content;
}

function html_message_to_text($html) {
    $html = (string)$html;
    $html = preg_replace('/<style\b[^>]*>.*?<\/style>/is', ' ', $html);
    $html = preg_replace('/<script\b[^>]*>.*?<\/script>/is', ' ', $html);
    $html = preg_replace('/<head\b[^>]*>.*?<\/head>/is', ' ', $html);
    $html = preg_replace('/<(br|p|div|li|tr|table)\b[^>]*>/i', "\n", $html);
    $html = strip_tags($html);
    return html_entity_decode($html, ENT_QUOTES | ENT_HTML5, 'UTF-8');
}

function get_part_charset($part) {
    if (empty($part->parameters)) return '';
    foreach ($part->parameters as $param) {
        if (strtolower($param->attribute ?? '') === 'charset') {
            return $param->value;
        }
    }
    return '';
}

function fetch_body_part($imap, $msgNo, $part, $partNo, $preferredSubtype) {
    $type = (int)($part->type ?? 0);
    $subtype = strtolower($part->subtype ?? '');

    if (!empty($part->parts) && is_array($part->parts)) {
        foreach ($part->parts as $index => $child) {
            $childNo = $partNo === '' ? (string)($index + 1) : $partNo . '.' . ($index + 1);
            $found = fetch_body_part($imap, $msgNo, $child, $childNo, $preferredSubtype);
            if (trim($found) !== '') return $found;
        }
        return '';
    }

    if ($type !== 0 || $subtype !== strtolower($preferredSubtype)) return '';

    $content = imap_fetchbody($imap, $msgNo, $partNo ?: '1');
    $content = decode_message_part($content, $part->encoding ?? 0);
    $charset = get_part_charset($part);
    if ($charset && strtoupper($charset) !== 'UTF-8') {
        $converted = @iconv($charset, 'UTF-8//IGNORE', $content);
        if ($converted !== false) $content = $converted;
    }
    return $content;
}

function clean_reply_message($body) {
    $body = str_replace(["\r\n", "\r"], "\n", trim((string)$body));
    if (stripos($body, '<html') !== false || stripos($body, '<body') !== false || stripos($body, '<div') !== false) {
        $body = html_message_to_text($body);
    }
    $body = preg_replace('/^\s*(body|html|table|td|div|span|p|ul|ol|li|a|img|font|mso-[a-z-]+|font-family|font-size|line-height|margin|padding|color|background|border)[^"\n]*[{;][^\n]*$/mi', '', $body);
    $body = preg_replace('/^\s*[.#]?[a-z0-9_-]+\s*\{[^}]*\}\s*$/mi', '', $body);
    $body = preg_replace('/--[a-zA-Z0-9_+=\/.-]{6,}--?/m', '', $body);
    $body = preg_replace('/Content-Type:.*$/mi', '', $body);
    $body = preg_replace('/Content-Transfer-Encoding:.*$/mi', '', $body);
    $body = preg_replace('/Content-Disposition:.*$/mi', '', $body);
    $body = preg_replace('/\n?\s*On\s[\s\S]+?wrote:\s*[\s\S]*$/i', '', $body);
    $body = preg_replace('/\n?\s*From:\s.+?(Sent:|Date:|To:|Subject:)[\s\S]*$/i', '', $body);
    $body = preg_replace('/\n?\s*_{5,}\s*[\s\S]*$/', '', $body);
    $body = preg_replace('/\n?\s*-{2,}\s*Original Message\s*-{2,}[\s\S]*$/i', '', $body);
    $body = preg_replace('/^>.*$/m', '', $body);
    $body = preg_replace('/\n{3,}/', "\n\n", $body);
    return trim($body);
}

function get_message_body($imap, $msgNo, $structure) {
    $body = fetch_body_part($imap, $msgNo, $structure, '', 'plain');
    if (trim($body) === '') {
        $body = fetch_body_part($imap, $msgNo, $structure, '', 'html');
        $body = html_message_to_text($body);
    }
    if (trim($body) === '') {
        $body = imap_body($imap, $msgNo);
    }
    $body = clean_reply_message($body);
    return $body !== '' ? $body : 'No message body provided.';
}

function get_raw_message_body($imap, $msgNo, $structure) {
    $body = fetch_body_part($imap, $msgNo, $structure, '', 'plain');
    if (trim($body) === '') {
        $body = fetch_body_part($imap, $msgNo, $structure, '', 'html');
        $body = html_message_to_text($body);
    }
    if (trim($body) === '') {
        $body = imap_body($imap, $msgNo);
    }
    return str_replace(["\r\n", "\r"], "\n", trim((string)$body));
}

function find_student_by_id($conn, $studentId) {
    $studentId = trim((string)$studentId);
    if ($studentId === '') return null;
    $stmt = $conn->prepare("SELECT student_id, gmail, outlook_email FROM students WHERE student_id = ? LIMIT 1");
    $stmt->bind_param("s", $studentId);
    $stmt->execute();
    $student = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    return $student ?: null;
}

function normalize_name_text($value) {
    return strtolower(preg_replace('/[^a-z0-9]+/i', ' ', (string)$value));
}

function find_student_by_mentioned_name($conn, $message) {
    $text = ' ' . normalize_name_text($message) . ' ';
    $result = $conn->query("SELECT student_id, name FROM students WHERE is_archived = 0");
    if (!$result) return null;

    $found = [];
    while ($row = $result->fetch_assoc()) {
        $name = trim((string)$row['name']);
        if ($name === '') continue;

        $variants = [normalize_name_text($name)];
        if (strpos($name, ',') !== false) {
            $parts = array_map('trim', explode(',', $name, 2));
            $last = $parts[0] ?? '';
            $first = $parts[1] ?? '';
            if ($first !== '' && $last !== '') {
                $variants[] = normalize_name_text($first . ' ' . $last);
                $variants[] = normalize_name_text($last . ' ' . $first);
                $variants[] = normalize_name_text($first);
            }
        } else {
            $tokens = preg_split('/\s+/', $name);
            if (!empty($tokens[0])) $variants[] = normalize_name_text($tokens[0]);
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

function find_student_by_reference_or_email($conn, $message, $senderEmail, $addressReferenceId = '') {
    return find_student_by_reference_or_emails($conn, $message, [$senderEmail], $addressReferenceId);
}

function find_student_by_reference_or_emails($conn, $message, $senderEmails, $addressReferenceId = '') {
    $senderEmails = array_values(array_unique(array_filter(array_map(function($email) {
        return strtolower(trim((string)$email));
    }, (array)$senderEmails))));

    $student = find_student_by_id($conn, $addressReferenceId);
    if ($student) return $student;

    $studentId = '';
    if (preg_match('/(?:Reference\s*ID|Student\s*ID|Teacher\s*ID|\bID)\s*[:#-]?\s*([0-9]+)/i', $message, $matches)) {
        $studentId = $matches[1];
    }

    if ($studentId !== '') {
        $student = find_student_by_id($conn, $studentId);
        if ($student) return $student;
    }

    $student = find_student_by_mentioned_name($conn, $message);
    if ($student) return $student;

    foreach ($senderEmails as $senderEmail) {
        $stmt = $conn->prepare(
            "SELECT s.student_id, s.gmail, s.outlook_email
             FROM reminder_recipient_map r
             JOIN students s ON s.student_id = r.student_id
             WHERE LOWER(r.recipient_email) = ?
               AND r.sent_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
               AND s.is_archived = 0
             ORDER BY r.sent_at DESC, r.id DESC
             LIMIT 1"
        );
        if ($stmt) {
            $stmt->bind_param("s", $senderEmail);
            $stmt->execute();
            $student = $stmt->get_result()->fetch_assoc();
            $stmt->close();
            if ($student) return $student;
        }
    }

    $matches = [];
    foreach ($senderEmails as $senderEmail) {
        $stmt = $conn->prepare("SELECT student_id, gmail, outlook_email FROM students WHERE LOWER(gmail) = ? OR LOWER(outlook_email) = ? ORDER BY id ASC");
        $stmt->bind_param("ss", $senderEmail, $senderEmail);
        $stmt->execute();
        $result = $stmt->get_result();
        while ($row = $result->fetch_assoc()) {
            $matches[$row['student_id']] = $row;
        }
        $stmt->close();
    }
    $matches = array_values($matches);

    if (count($matches) === 1) return $matches[0];
    if (count($matches) > 1) {
        foreach ($matches as $row) {
            if (preg_match('/\b' . preg_quote($row['student_id'], '/') . '\b/', $message)) {
                return $row;
            }
        }
        return null;
    }

    return null;
}

function save_attachment_parts($imap, $msgNo, $parts, $prefix, $uploadDir, &$savedFiles) {
    foreach ($parts as $index => $part) {
        $partNo = $prefix === '' ? (string)($index + 1) : $prefix . '.' . ($index + 1);

        if (!empty($part->parts) && is_array($part->parts)) {
            save_attachment_parts($imap, $msgNo, $part->parts, $partNo, $uploadDir, $savedFiles);
        }

        $isAttachment = false;
        $filename = '';

        if (!empty($part->dparameters)) {
            foreach ($part->dparameters as $param) {
                if (strtolower($param->attribute) === 'filename') {
                    $isAttachment = true;
                    $filename = $param->value;
                }
            }
        }
        if (!$filename && !empty($part->parameters)) {
            foreach ($part->parameters as $param) {
                if (strtolower($param->attribute) === 'name') {
                    $isAttachment = true;
                    $filename = $param->value;
                }
            }
        }

        if (!$isAttachment || !$filename) continue;

        $content = imap_fetchbody($imap, $msgNo, $partNo);
        if ($part->encoding == 3) $content = base64_decode($content);
        elseif ($part->encoding == 4) $content = quoted_printable_decode($content);

        $safeName = time() . '_' . preg_replace('/[^a-zA-Z0-9._-]/', '_', decode_mime_text($filename));
        file_put_contents($uploadDir . $safeName, $content);
        $savedFiles[] = $safeName;
    }
}

function save_attachments($imap, $msgNo, $structure) {
    if (!isset($structure->parts) || !is_array($structure->parts)) return ['No_file_attached'];

    $uploadDir = __DIR__ . '/../UPLOADS/';
    if (!is_dir($uploadDir)) mkdir($uploadDir, 0777, true);
    $savedFiles = [];
    save_attachment_parts($imap, $msgNo, $structure->parts, '', $uploadDir, $savedFiles);

    return $savedFiles ?: ['No_file_attached'];
}

function submission_channel_for_sender($student, $senderEmail, $accountChannel) {
    $senderEmail = strtolower(trim((string)$senderEmail));
    $outlook = strtolower(trim((string)($student['outlook_email'] ?? '')));
    $gmail = strtolower(trim((string)($student['gmail'] ?? '')));

    if ($outlook !== '' && $senderEmail === $outlook) return 'Outlook';
    if ($gmail !== '' && $senderEmail === $gmail) return 'Gmail';
    return $accountChannel ?: 'Email';
}

function sender_email_for_submission($student, $senderEmails) {
    $outlook = strtolower(trim((string)($student['outlook_email'] ?? '')));
    $gmail = strtolower(trim((string)($student['gmail'] ?? '')));
    foreach ((array)$senderEmails as $email) {
        $email = strtolower(trim((string)$email));
        if ($email !== '' && ($email === $outlook || $email === $gmail)) {
            return $email;
        }
    }
    foreach ((array)$senderEmails as $email) {
        $email = strtolower(trim((string)$email));
        if ($email !== '') return $email;
    }
    return '';
}

foreach ($accounts as $account) {
    if (empty($account['enabled'])) continue;

    $imap = @imap_open($account['mailbox'], $account['username'], $account['password']);
    if (!$imap) {
        $result['errors'][] = ($account['name'] ?? $account['username']) . ': ' . imap_last_error();
        continue;
    }

    $since = date('d-M-Y', strtotime('-2 days'));
    $messages = imap_search($imap, 'SINCE "' . $since . '"') ?: [];
    rsort($messages, SORT_NUMERIC);
    $messages = array_slice($messages, 0, 25);
    foreach ($messages as $msgNo) {
        $result['processed']++;
        $header = imap_headerinfo($imap, $msgNo);
        $from = isset($header->fromaddress) ? $header->fromaddress : '';
        $to = isset($header->toaddress) ? $header->toaddress : '';
        $cc = isset($header->ccaddress) ? $header->ccaddress : '';
        $replyTo = isset($header->reply_toaddress) ? $header->reply_toaddress : '';
        $senderAddress = isset($header->senderaddress) ? $header->senderaddress : '';
        $subject = decode_mime_text(isset($header->subject) ? $header->subject : '');
        $senderEmails = extract_email_addresses($from . ' ' . $replyTo . ' ' . $senderAddress);
        $senderEmail = $senderEmails[0] ?? '';
        $addressReferenceId = extract_reference_id_from_addresses($to . ' ' . $cc . ' ' . $replyTo);
        $sourceAccount = $account['username'] ?? ($account['name'] ?? 'mailbox');
        $sourceUid = (string)imap_uid($imap, $msgNo);

        if (empty($senderEmails)) {
            $result['skipped']++;
            continue;
        }

        if (in_array(strtolower(trim((string)$sourceAccount)), $senderEmails, true)) {
            $result['skipped']++;
            continue;
        }

        $dupStmt = $conn->prepare("SELECT id FROM submissions WHERE source_account = ? AND source_uid = ? LIMIT 1");
        $dupStmt->bind_param("ss", $sourceAccount, $sourceUid);
        $dupStmt->execute();
        $duplicate = $dupStmt->get_result()->fetch_assoc();
        $dupStmt->close();

        if ($duplicate) {
            $result['skipped']++;
            continue;
        }

        $structure = imap_fetchstructure($imap, $msgNo);
        $rawMessage = get_raw_message_body($imap, $msgNo, $structure);
        $message = clean_reply_message($rawMessage);
        if ($message === '') $message = 'No message body provided.';
        $matchText = $subject . "\n" . $to . "\n" . $cc . "\n" . $replyTo . "\n" . $rawMessage . "\n" . $message;
        $student = find_student_by_reference_or_emails($conn, $matchText, $senderEmails, $addressReferenceId);

        if (!$student) {
            $result['skipped']++;
            imap_setflag_full($imap, (string)$msgNo, "\\Seen");
            continue;
        }

        if (preg_match('/(not approved for this reason|HealthSync Clinic Team|This is from the STI College Bacoor Clinic|HealthSync login verification code|Medical Requirements Reminder|URGENT: Pending Medical Status|FINAL NOTICE|linkedin|unsubscribe|people you may know|notification emails)/i', $message)) {
            $result['skipped']++;
            imap_setflag_full($imap, (string)$msgNo, "\\Seen");
            continue;
        }

        $savedAttachments = save_attachments($imap, $msgNo, $structure);
        $fileName = implode(',', $savedAttachments);
        $senderEmail = sender_email_for_submission($student, $senderEmails);
        $channel = submission_channel_for_sender($student, $senderEmail, $account['channel'] ?? 'Email');
        $id = 'sub_' . uniqid();

        $stmt = $conn->prepare("INSERT INTO submissions (id, student_id, file_name, message, channel, source_account, source_uid) VALUES (?, ?, ?, ?, ?, ?, ?)");
        $stmt->bind_param("sssssss", $id, $student['student_id'], $fileName, $message, $channel, $sourceAccount, $sourceUid);
        if ($stmt->execute()) {
            $result['saved']++;
            imap_setflag_full($imap, (string)$msgNo, "\\Seen");
        } else {
            $result['skipped']++;
            $result['errors'][] = $stmt->error;
        }
        $stmt->close();
    }

    imap_close($imap);
}

$conn->query("SELECT RELEASE_LOCK('healthsync_email_reply_checker')");
$conn->close();
echo json_encode($result);
?>
