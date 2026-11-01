param(
    [string]$Destination,
    [Security.SecureString]$BackupPassword
)
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$artifactRoot = Join-Path $repoRoot 'artifacts/android'
if (-not $Destination) { $Destination = Join-Path $artifactRoot 'signing-backup.p12' }
$Destination = [IO.Path]::GetFullPath($Destination)
if (Test-Path -LiteralPath $Destination) { throw 'Backup destination already exists. Choose a new filename; the existing backup will not be replaced.' }
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Destination) | Out-Null
$toolchain = Get-Content -LiteralPath (Join-Path $env:USERPROFILE '.android/ascend-avoid-build/toolchain.json') -Raw | ConvertFrom-Json
$keytool = Join-Path $toolchain.javaHome 'bin/keytool.exe'
$keyRoot = Join-Path $env:USERPROFILE '.android/ascend-avoid-signing'
$sourceKey = Join-Path $keyRoot 'upload.jks'
$sourcePassword = Import-Clixml -LiteralPath (Join-Path $keyRoot 'password.xml')
if (-not $BackupPassword) {
    Write-Host 'Choose a unique backup passphrase and save it in your password manager. Do not paste it into chat.'
    $BackupPassword = Read-Host 'Backup passphrase (at least 16 characters)' -AsSecureString
    $confirmation = Read-Host 'Repeat backup passphrase' -AsSecureString
    if ([Net.NetworkCredential]::new('', $BackupPassword).Password -cne [Net.NetworkCredential]::new('', $confirmation).Password) { throw 'Passphrases did not match.' }
}
if ($BackupPassword.Length -lt 16) { throw 'Use a backup passphrase of at least 16 characters.' }
$names = @('ASCEND_BACKUP_SOURCE_PASSWORD','ASCEND_BACKUP_PASSWORD','ASCEND_BACKUP_RESTORE_PASSWORD')
$previous = @{}
foreach ($name in $names) { $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
$temporaryRoot = Join-Path $artifactRoot ('backup-check-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $temporaryRoot -Force | Out-Null
function Invoke-Keytool {
    param([string[]]$Arguments)
    $result = @(& $keytool @Arguments 2>&1 | ForEach-Object { $_.ToString() })
    if ($LASTEXITCODE -ne 0) { throw "Signing backup operation failed: $($result -join [Environment]::NewLine)" }
}
try {
    $env:ASCEND_BACKUP_SOURCE_PASSWORD = [Net.NetworkCredential]::new('', $sourcePassword).Password
    $env:ASCEND_BACKUP_PASSWORD = [Net.NetworkCredential]::new('', $BackupPassword).Password
    $env:ASCEND_BACKUP_RESTORE_PASSWORD = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
    Invoke-Keytool -Arguments @('-importkeystore','-noprompt','-srckeystore',$sourceKey,'-srcstoretype','JKS','-srcstorepass:env','ASCEND_BACKUP_SOURCE_PASSWORD','-srcalias','ascend-avoid-upload','-destkeystore',$Destination,'-deststoretype','PKCS12','-deststorepass:env','ASCEND_BACKUP_PASSWORD')
    # Importing into a fresh keystore proves the private key is recoverable, not just its public certificate.
    $restored = Join-Path $temporaryRoot 'restored.jks'
    Invoke-Keytool -Arguments @('-importkeystore','-noprompt','-srckeystore',$Destination,'-srcstoretype','PKCS12','-srcstorepass:env','ASCEND_BACKUP_PASSWORD','-srcalias','ascend-avoid-upload','-destkeystore',$restored,'-deststoretype','JKS','-deststorepass:env','ASCEND_BACKUP_RESTORE_PASSWORD','-destkeypass:env','ASCEND_BACKUP_RESTORE_PASSWORD')
    $sourceCertificate = Join-Path $temporaryRoot 'source.der'
    $restoredCertificate = Join-Path $temporaryRoot 'restored.der'
    Invoke-Keytool -Arguments @('-exportcert','-keystore',$sourceKey,'-storepass:env','ASCEND_BACKUP_SOURCE_PASSWORD','-alias','ascend-avoid-upload','-file',$sourceCertificate)
    Invoke-Keytool -Arguments @('-exportcert','-keystore',$restored,'-storepass:env','ASCEND_BACKUP_RESTORE_PASSWORD','-alias','ascend-avoid-upload','-file',$restoredCertificate)
    $fingerprint = (Get-FileHash -LiteralPath $sourceCertificate -Algorithm SHA256).Hash
    if ($fingerprint -ne (Get-FileHash -LiteralPath $restoredCertificate -Algorithm SHA256).Hash) { throw 'Restored key certificate does not match the original.' }
    [ordered]@{verifiedAt=[DateTime]::UtcNow.ToString('o');backup=$Destination;format='PKCS12';alias='ascend-avoid-upload';certificateSha256=$fingerprint;privateKeyRestoreVerified=$true;copiedOffComputer=$false} | ConvertTo-Json | Set-Content -LiteralPath "$Destination.verification.json" -Encoding utf8
    Write-Host "Encrypted signing backup created and restoration verified: $Destination"
    Write-Host 'Copy this encrypted file to a secure location outside this PC. Keep the passphrase separately in your password manager.'
} finally {
    foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process') }
    # Only named files created in this unique verification directory are removed.
    foreach ($file in @('restored.jks','source.der','restored.der')) {
        $temporaryFile = Join-Path $temporaryRoot $file
        if (Test-Path -LiteralPath $temporaryFile) { Remove-Item -LiteralPath $temporaryFile -Force }
    }
    Remove-Item -LiteralPath $temporaryRoot -Force
}
