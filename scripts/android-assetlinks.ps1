param([ValidatePattern('^([A-Fa-f0-9]{2}:){31}[A-Fa-f0-9]{2}$')][string]$PlaySigningFingerprint, [ValidateSet('production','test')][string]$Target = 'production')
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'android-target.ps1')
$targetConfig = Get-AndroidTarget -Name $Target
$repoRoot = Split-Path -Parent $PSScriptRoot
$toolchain = Get-Content -LiteralPath (Join-Path $env:USERPROFILE '.android/ascend-avoid-build/toolchain.json') -Raw | ConvertFrom-Json
$keyRoot = Join-Path $env:USERPROFILE '.android/ascend-avoid-signing'
$keyFile = Join-Path $keyRoot 'upload.jks'
if (-not (Test-Path -LiteralPath $keyFile)) { throw 'Create the upload key by running android-build.ps1 -Configuration Release first.' }
$password = Import-Clixml -LiteralPath (Join-Path $keyRoot 'password.xml')
$previousPassword = $env:ASCEND_ANDROID_STORE_PASSWORD
try {
    $env:ASCEND_ANDROID_STORE_PASSWORD = [Net.NetworkCredential]::new('', $password).Password
    $artifactRoot = $targetConfig.artifactRoot
    New-Item -ItemType Directory -Force -Path $artifactRoot | Out-Null
    $certificate = Join-Path $artifactRoot 'upload-certificate.der'
    $pem = Join-Path $artifactRoot 'upload-certificate.pem'
    $keytool = Join-Path $toolchain.javaHome 'bin/keytool.exe'
    & $keytool -exportcert -keystore $keyFile -alias ascend-avoid-upload -storepass:env ASCEND_ANDROID_STORE_PASSWORD -file $certificate
    if ($LASTEXITCODE -ne 0) { throw 'Certificate export failed' }
    & $keytool -exportcert -rfc -keystore $keyFile -alias ascend-avoid-upload -storepass:env ASCEND_ANDROID_STORE_PASSWORD -file $pem
    if ($LASTEXITCODE -ne 0) { throw 'PEM export failed' }
    $fingerprint = [regex]::Matches((Get-FileHash -LiteralPath $certificate -Algorithm SHA256).Hash, '..').Value -join ':'
    $publicRoot = Join-Path $repoRoot 'public/.well-known'
    New-Item -ItemType Directory -Force -Path $publicRoot | Out-Null
    $destination = Join-Path $publicRoot $targetConfig.assetlinksFile
    $fingerprints = @($fingerprint)
    if (Test-Path -LiteralPath $destination) {
        foreach ($entry in (Get-Content -LiteralPath $destination -Raw | ConvertFrom-Json)) {
            if ($entry.target.package_name -eq $targetConfig.packageId) { $fingerprints += $entry.target.sha256_cert_fingerprints }
        }
    }
    if ($PlaySigningFingerprint) { $fingerprints += $PlaySigningFingerprint.ToUpperInvariant() }
    $fingerprints = @($fingerprints | Sort-Object -Unique)
    $statement = [ordered]@{ relation=@('delegate_permission/common.handle_all_urls'); target=[ordered]@{namespace='android_app';package_name=$targetConfig.packageId;sha256_cert_fingerprints=$fingerprints} }
    ConvertTo-Json -InputObject @($statement) -Depth 5 | Set-Content -LiteralPath $destination -Encoding utf8
    Write-Host "Upload certificate SHA-256: $fingerprint"
    Write-Host "Website verification file: $destination"
} finally { $env:ASCEND_ANDROID_STORE_PASSWORD = $previousPassword }
