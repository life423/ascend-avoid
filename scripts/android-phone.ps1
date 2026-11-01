param(
    [ValidateSet('Install','Devices','Pair')][string]$Action = 'Install',
    [ValidatePattern('^\S+:\d{1,5}$')][string]$Address,
    [ValidatePattern('^\S+$')][string]$Serial,
    [switch]$SkipBuild
)
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$configPath = Join-Path $env:USERPROFILE '.android/ascend-avoid-build/toolchain.json'
if (-not (Test-Path -LiteralPath $configPath)) { throw 'Run npm run android:setup -- -AcceptLicenses first.' }
$toolchain = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
$adb = Join-Path $toolchain.sdkRoot 'platform-tools/adb.exe'

function Invoke-Adb {
    param([string[]]$Arguments)
    $output = @(& $adb @Arguments 2>&1 | ForEach-Object { $_.ToString() })
    if ($LASTEXITCODE -ne 0) { throw "ADB command failed: $($output -join [Environment]::NewLine)" }
    $output
}

function Select-Phone {
    param([string[]]$DeviceLines, [string]$RequestedSerial)
    $devices = @(foreach ($line in $DeviceLines) {
        if ($line -match '^(\S+)\s+(device|offline|unauthorized)\b') {
            [pscustomobject]@{Serial=$Matches[1];State=$Matches[2]}
        }
    })
    if ($RequestedSerial) {
        $selected = @($devices | Where-Object Serial -eq $RequestedSerial)
        if ($selected.Count -ne 1) { throw 'The selected phone is not connected. Check Wireless debugging, then use npm run android:devices.' }
    } else {
        if ($devices.Count -eq 0) { throw 'No phone connected. Pair in Developer options > Wireless debugging, then use npm run android:pair -- -Address IP:PAIRING_PORT. If necessary connect using android:phone -- -Address IP:CONNECTION_PORT.' }
        if ($devices.Count -gt 1) { throw 'Multiple devices found. Use npm run android:devices, then android:phone -- -Serial YOUR_DEVICE to select one.' }
        $selected = $devices
    }
    if ($selected[0].State -ne 'device') { throw "Phone is $($selected[0].State). Unlock it, approve debugging if prompted, and reconnect before installing." }
    $selected[0].Serial
}

if ($Action -eq 'Devices') {
    Invoke-Adb -Arguments @('devices','-l')
    Invoke-Adb -Arguments @('mdns','services')
    return
}
if ($Action -eq 'Pair') {
    if (-not $Address) { throw 'Use npm run android:pair -- -Address IP:PAIRING_PORT from the phone pairing dialog. Enter its six-digit code at the prompt.' }
    # Let adb prompt directly; pairing codes are not script arguments or saved configuration.
    & $adb pair $Address
    if ($LASTEXITCODE -ne 0) { throw 'Pairing failed. Keep the pairing dialog open and try its current address and code.' }
    return
}
if ($Address) {
    if ($Serial) { throw 'Choose either -Address to connect a phone or -Serial to select an already connected device.' }
    $connection = Invoke-Adb -Arguments @('connect',$Address)
    if (-not ($connection -match '^(already )?connected to ')) { throw "Could not connect to phone: $($connection -join ' ')" }
    $Serial = $Address
}
$device = Select-Phone -DeviceLines @(Invoke-Adb -Arguments @('devices','-l')) -RequestedSerial $Serial
$sdk = (Invoke-Adb -Arguments @('-s',$device,'shell','getprop','ro.build.version.sdk') | Out-String).Trim()
if ($sdk -notmatch '^\d+$' -or [int]$sdk -lt 24) { throw 'Ascend Avoid requires Android 7.0/API 24 or newer.' }
$model = (Invoke-Adb -Arguments @('-s',$device,'shell','getprop','ro.product.model') | Out-String).Trim()
Write-Host "Selected phone: $model (Android API $sdk)"

if (-not $SkipBuild) { & (Join-Path $PSScriptRoot 'android-build.ps1') -Configuration Release }
& (Join-Path $PSScriptRoot 'android-verify.ps1')
$artifactRoot = Join-Path $repoRoot 'artifacts/android'
$apk = Join-Path $artifactRoot 'Ascend-Avoid.apk'
$packageId = 'io.drewclark.ascendavoid'
$installed = Invoke-Adb -Arguments @('-s',$device,'install','-r',$apk)
if (-not ($installed -match '^Success\s*$')) { throw "Installation did not report success: $($installed -join ' ')" }
$packagePath = Invoke-Adb -Arguments @('-s',$device,'shell','pm','path',$packageId)
if (-not ($packagePath -match '^package:')) { throw 'Android did not report the installed app package.' }
$launch = Invoke-Adb -Arguments @('-s',$device,'shell','am','start','-W','-n',"$packageId/.LauncherActivity")
if (-not ($launch -match '^Status:\s+ok\s*$')) { throw "Android did not confirm a successful launch: $($launch -join ' ')" }
$proof = [ordered]@{
    installedAt=[DateTime]::UtcNow.ToString('o');device=$device;model=$model;sdk=[int]$sdk
    packageId=$packageId;apkSha256=(Get-FileHash -LiteralPath $apk -Algorithm SHA256).Hash
    installed=$true;launcherStarted=$true;fullScreenVerified=$false;manualPlaytestComplete=$false
}
$proof | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $artifactRoot 'device-installation.json') -Encoding utf8
Write-Host 'Ascend Avoid installed and launched. Check full screen, touch controls and sound on the phone.'
