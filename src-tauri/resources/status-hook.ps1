# Terminal Canvas - Claude Code Status Hook (Windows)
# Only handles Stop and Notification(permission_prompt) events.

$input_json = [Console]::In.ReadToEnd()
$data = $input_json | ConvertFrom-Json

$session_id = $data.session_id
$event = $data.hook_event_name
$cwd = $data.cwd

if (-not $session_id -or -not $event) { exit 0 }

$status_dir = Join-Path $env:TEMP "terminal-canvas"
if (-not (Test-Path $status_dir)) {
    New-Item -ItemType Directory -Path $status_dir -Force | Out-Null
}

switch ($event) {
    "Stop" {
        $stop_active = $data.stop_hook_active
        if ($stop_active -eq $true) { exit 0 }
        $status = "idle"
    }
    "Notification" {
        $ntype = $data.notification_type
        if ($ntype -eq "permission_prompt") {
            $status = "permission"
        } else {
            exit 0
        }
    }
    default { exit 0 }
}

$timestamp = [int][double]::Parse((Get-Date -UFormat %s))
$output = @{
    status    = $status
    cwd       = $cwd
    timestamp = $timestamp
} | ConvertTo-Json -Compress

$target_path = Join-Path $status_dir "$session_id.json"
$temp_path = Join-Path $status_dir ".tmp.$PID"
$output | Out-File -FilePath $temp_path -Encoding utf8 -NoNewline
Move-Item -Path $temp_path -Destination $target_path -Force

exit 0
