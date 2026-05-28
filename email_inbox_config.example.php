<?php
// Copy this file to email_inbox_config.php and fill in your mailbox details.
// Gmail usually needs an App Password, not your normal account password.
return [
    'accounts' => [
        [
            'name' => 'Clinic Gmail',
            'enabled' => false,
            'mailbox' => '{imap.gmail.com:993/imap/ssl}INBOX',
            'username' => 'yourclinic@gmail.com',
            'password' => 'your-app-password',
            'channel' => 'Gmail'
        ],
        [
            'name' => 'Clinic Outlook',
            'enabled' => false,
            'mailbox' => '{outlook.office365.com:993/imap/ssl}INBOX',
            'username' => 'yourclinic@outlook.com',
            'password' => 'your-password-or-app-password',
            'channel' => 'Outlook'
        ]
    ]
];
?>
