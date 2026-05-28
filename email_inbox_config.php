<?php
require_once __DIR__ . '/smtp_config.php';

$outlookUsername = (defined('OUTLOOK_IMAP_USERNAME') && OUTLOOK_IMAP_USERNAME !== '') ? OUTLOOK_IMAP_USERNAME : getenv('HEALTHSYNC_OUTLOOK_USERNAME');
$outlookPassword = (defined('OUTLOOK_IMAP_PASSWORD') && OUTLOOK_IMAP_PASSWORD !== '') ? OUTLOOK_IMAP_PASSWORD : getenv('HEALTHSYNC_OUTLOOK_PASSWORD');
$outlookEnabled = filter_var((defined('OUTLOOK_IMAP_ENABLED') && OUTLOOK_IMAP_ENABLED) ? OUTLOOK_IMAP_ENABLED : getenv('HEALTHSYNC_OUTLOOK_ENABLED'), FILTER_VALIDATE_BOOLEAN);
if (!$outlookEnabled) {
    $outlookEnabled = !empty($outlookUsername) && !empty($outlookPassword);
}

return [
    'accounts' => [
        [
            'name' => 'Clinic Gmail',
            'enabled' => true,
            'mailbox' => '{imap.gmail.com:993/imap/ssl/novalidate-cert}INBOX',
            'username' => SMTP_USERNAME,
            'password' => SMTP_PASSWORD,
            'channel' => 'Gmail'
        ],
        [
            'name' => 'Clinic Outlook',
            'enabled' => $outlookEnabled,
            'mailbox' => '{outlook.office365.com:993/imap/ssl/novalidate-cert}INBOX',
            'username' => $outlookUsername ?: '',
            'password' => $outlookPassword ?: '',
            'channel' => 'Outlook'
        ]
    ]
];
?>
