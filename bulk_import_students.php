<?php
header('Content-Type: application/json');
include __DIR__ . '/db.php';

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $data = json_decode($_POST['students'], true);
    if (!$data) {
        echo json_encode(["status" => "error", "message" => "No data received."]);
        exit();
    }

    $added = 0;
    $skipped = 0;
    $skippedIds = [];
    $seenIds = [];
    $source = isset($_POST['source']) && $_POST['source'] === 'excel' ? 'Excel / CSV Import' : 'Manual Entry';
    $stmt = $conn->prepare("INSERT INTO students (student_id, name, strand, course, level, type, year_level, section, school_year, gmail, outlook_email, emergency_contact, allergies, mental_state, requirements_passed, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $subStmt = $conn->prepare("INSERT INTO submissions (id, student_id, file_name, message, channel, status, reviewed_at) VALUES (?, ?, ?, ?, ?, ?, NOW())");

    foreach ($data as $s) {
        $gmail = isset($s['gmail']) ? strtolower(trim($s['gmail'])) : '';
        $outlook_email = isset($s['outlook_email']) ? strtolower(trim($s['outlook_email'])) : '';
        $strand = isset($s['strand']) ? $s['strand'] : '';
        $course = isset($s['course']) ? $s['course'] : '';
        $level = isset($s['level']) ? $s['level'] : 'SHS';
        $type = isset($s['type']) ? $s['type'] : 'Student';
        $yearLevel = isset($s['yearLevel']) ? $s['yearLevel'] : '';
        $section = isset($s['section']) ? $s['section'] : '';
        $schoolYear = isset($s['schoolYear']) ? trim(str_replace(['–','—'], '-', $s['schoolYear'])) : '';
        $emergencyContact = isset($s['emergency_contact']) ? $s['emergency_contact'] : '';
        $allergies = isset($s['allergies']) ? $s['allergies'] : '';
        $mentalState = isset($s['mental_state']) ? $s['mental_state'] : '';
        $requirementsPassed = isset($s['requirements_passed']) ? $s['requirements_passed'] : '';
        $status = isset($s['status']) ? $s['status'] : 'Pending';
        $id = isset($s['id']) ? trim((string)$s['id']) : '';
        $name = isset($s['name']) ? trim((string)$s['name']) : '';

        if (!preg_match('/^\d+$/', $id)) {
            $skipped++;
            $skippedIds[] = $id === '' ? '(blank ID)' : $id . ' (invalid ID)';
            continue;
        }
        if ($id === '' || $name === '') {
            $skipped++;
            $skippedIds[] = $id === '' ? '(blank ID)' : $id . ' (missing name)';
            continue;
        }
        if (isset($seenIds[$id])) {
            $skipped++;
            $skippedIds[] = $id . ' (duplicate in import)';
            continue;
        }
        $seenIds[$id] = true;

        $stmt->bind_param("ssssssssssssssss", 
            $id, $name, $strand, $course, $level, $type,
            $yearLevel, $section, $schoolYear, $gmail, $outlook_email,
            $emergencyContact, $allergies, $mentalState, $requirementsPassed, $status
        );
        if ($stmt->execute()) {
            $added++;
            if ($status === 'Complete' && $subStmt) {
                $submissionId = 'clinic_' . $id . '_' . date('YmdHis') . '_' . mt_rand(100, 999);
                $fileName = 'NURSE_VERIFIED_NO_FILE';
                $message = 'Clinic verified complete via ' . $source . '. No digital file attached.';
                $channel = 'Clinic Verification - ' . $source;
                $submissionStatus = 'approved';
                $subStmt->bind_param("ssssss", $submissionId, $id, $fileName, $message, $channel, $submissionStatus);
                $subStmt->execute();
            }
        } else {
            $skipped++;
            if ($conn->errno == 1062) {
                $skippedIds[] = $id . ' (ID already exists)';
            } else {
                $skippedIds[] = $id . ' (' . $stmt->error . ')';
            }
        }
    }
    echo json_encode(["status" => "success", "added" => $added, "skipped" => $skipped, "skipped_ids" => $skippedIds]);
    $stmt->close();
    if ($subStmt) $subStmt->close();
    $conn->close();
}
?>
