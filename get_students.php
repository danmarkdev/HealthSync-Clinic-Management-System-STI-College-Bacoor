<?php
header('Content-Type: application/json');
include __DIR__ . '/db.php';

$sql = "SELECT * FROM students";
$result = $conn->query($sql);
$students = [];

if ($result->num_rows > 0) {
    while($row = $result->fetch_assoc()) {
        $students[] = [
            'id' => $row['student_id'],
            'student_id' => $row['student_id'],
            'name' => $row['name'],
            'strand' => $row['strand'],
            'course' => $row['course'],
            'level' => $row['level'],
            'type' => $row['type'],
            'yearLevel' => $row['year_level'],
            'section' => $row['section'],
            'schoolYear' => isset($row['school_year']) ? $row['school_year'] : '',
            'gmail' => $row['gmail'],
            'outlook_email' => $row['outlook_email'],
            'emergency_contact' => isset($row['emergency_contact']) ? $row['emergency_contact'] : '',
            'allergies' => isset($row['allergies']) ? $row['allergies'] : '',
            'mental_state' => isset($row['mental_state']) ? $row['mental_state'] : '',
            'requirements_passed' => isset($row['requirements_passed']) ? $row['requirements_passed'] : '',
            'status' => $row['status'],
            'is_archived' => $row['is_archived'],
            'date' => $row['date_added']
        ];
    }
}
$conn->close();
echo json_encode($students);
?>
