$ErrorActionPreference = 'Stop'
$projectPath = $PSScriptRoot
$ipcPath = Join-Path $projectPath '.director-ipc'
$nodePath = (Get-Command node -ErrorAction Stop).Source
if (-not (Test-Path -LiteralPath $ipcPath)) { New-Item -ItemType Directory -Path $ipcPath | Out-Null }
if ((Get-Item -LiteralPath $ipcPath).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'IPC directory must not be a link.' }
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$acl = [Security.AccessControl.DirectorySecurity]::new()
$acl.SetOwner($identity.User)
$acl.SetAccessRuleProtection($true, $false)
foreach ($sid in @($identity.User, [Security.Principal.SecurityIdentifier]::new('S-1-5-18'))) {
 $rule = [Security.AccessControl.FileSystemAccessRule]::new($sid, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
 $acl.AddAccessRule($rule)
}
$existingAcl = Get-Acl -LiteralPath $ipcPath
$allowedSids = @($identity.User.Value, 'S-1-5-18')
$existingRules = @($existingAcl.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier]))
$secure = $existingAcl.AreAccessRulesProtected -and $existingRules.Count -eq 2
foreach ($existingRule in $existingRules) {
 if ($existingRule.IdentityReference.Value -notin $allowedSids -or $existingRule.AccessControlType -ne 'Allow' -or $existingRule.FileSystemRights -ne 'FullControl' -or $existingRule.IsInherited) { $secure = $false }
}
if (-not $secure) { Set-Acl -LiteralPath $ipcPath -AclObject $acl }
$lockPath = Join-Path $ipcPath 'host.lock'
if (Test-Path -LiteralPath $lockPath) {
 $hostRecord = Get-Content -LiteralPath $lockPath -Raw | ConvertFrom-Json
 if (Get-Process -Id $hostRecord.pid -ErrorAction SilentlyContinue) { throw "Host already running (PID $($hostRecord.pid))." }
}
# WMI owns process creation, so this process is not a child of the temporary tool shell.
# No service, scheduled task, startup entry, credentials or new network endpoint.
$startup = New-CimInstance -ClassName Win32_ProcessStartup -ClientOnly -Property @{ShowWindow=[uint16]0}
$commandLine = '"' + $nodePath + '" "' + (Join-Path $projectPath 'host.mjs') + '" --live --host'
$result = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{CommandLine=$commandLine;CurrentDirectory=$projectPath;ProcessStartupInformation=$startup}
if ($result.ReturnValue -ne 0) { throw "Host launch failed with Windows code $($result.ReturnValue)." }
Write-Output "Host launch requested: PID $($result.ProcessId). Check server_status for readiness."

