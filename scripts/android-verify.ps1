param([ValidateSet('production','test')][string]$Target = 'production')
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'android-target.ps1')
$targetConfig = Get-AndroidTarget -Name $Target
$repoRoot = Split-Path -Parent $PSScriptRoot
$toolRoot = Join-Path $env:USERPROFILE '.android/ascend-avoid-build'
$toolchain = Get-Content -LiteralPath (Join-Path $toolRoot 'toolchain.json') -Raw | ConvertFrom-Json
$java = Join-Path $toolchain.javaHome 'bin/java.exe'
$artifactRoot = $targetConfig.artifactRoot
$apk = Join-Path $artifactRoot "$($targetConfig.artifactName).apk"
$aab = Join-Path $artifactRoot "$($targetConfig.artifactName).aab"
$bundletool = Join-Path $toolRoot 'downloads/bundletool-all-1.18.3.jar'
if (-not (Test-Path -LiteralPath $bundletool)) { throw 'Run android:setup to install the pinned Google bundletool.' }
$signatures = & $java -jar (Join-Path $toolchain.sdkRoot 'build-tools/36.1.0/lib/apksigner.jar') verify --verbose --print-certs $apk
if ($LASTEXITCODE -ne 0) { throw 'APK signature verification failed' }
$fingerprint = (($signatures | Select-String '^Signer #1 certificate SHA-256 digest: (.+)$').Matches.Groups[1].Value).Trim().ToUpperInvariant()
$statements = Get-Content -LiteralPath (Join-Path $repoRoot "public/.well-known/$($targetConfig.assetlinksFile)") -Raw | ConvertFrom-Json
$allowed = @($statements | Where-Object { $_.target.package_name -eq $targetConfig.packageId } | ForEach-Object { $_.target.sha256_cert_fingerprints } | ForEach-Object { $_.Replace(':','').ToUpperInvariant() })
if (-not $fingerprint -or $fingerprint -notin $allowed) { throw 'APK signing certificate does not match the staged website association' }
& (Join-Path $toolchain.javaHome 'bin/jarsigner.exe') -verify $aab | Set-Content -LiteralPath (Join-Path $artifactRoot 'aab-signature.txt')
if ($LASTEXITCODE -ne 0) { throw 'AAB signature verification failed' }
& $java -jar $bundletool validate "--bundle=$aab" | Set-Content -LiteralPath (Join-Path $artifactRoot 'bundle-validation.txt')
if ($LASTEXITCODE -ne 0) { throw 'Google bundletool validation failed' }
$manifestText = & $java -jar $bundletool dump manifest "--bundle=$aab"
if ($LASTEXITCODE -ne 0) { throw 'AAB manifest inspection failed' }
[xml]$manifest = $manifestText -join [Environment]::NewLine
$androidNamespace = 'http://schemas.android.com/apk/res/android'
$sdk = $manifest.manifest.'uses-sdk'
$targetSdk = [int]$sdk.GetAttribute('targetSdkVersion',$androidNamespace)
$minimum = [int]$sdk.GetAttribute('minSdkVersion',$androidNamespace)
if ($manifest.manifest.package -ne $targetConfig.packageId -or $targetSdk -lt 36 -or $minimum -lt 24) { throw 'Unexpected Android application ID or SDK bounds' }
$badging = & (Join-Path $toolchain.sdkRoot 'build-tools/36.1.0/aapt2.exe') dump badging $apk
if ($LASTEXITCODE -ne 0 -or -not ($badging | Select-String "targetSdkVersion:'$targetSdk'")) { throw 'APK target does not match the validated bundle' }
if (-not ($badging | Select-String -SimpleMatch "package: name='$($targetConfig.packageId)'")) { throw 'APK package does not match the selected app' }
$resources = & (Join-Path $toolchain.sdkRoot 'build-tools/36.1.0/aapt2.exe') dump resources $apk
if ($LASTEXITCODE -ne 0) { throw 'APK resource inspection failed' }
$launchResource = ($resources | Out-String) -split '\r?\n\s*resource ' | Where-Object { $_ -match '^\S+ string/launchUrl\b' }
if (-not $launchResource -or $launchResource -notmatch [regex]::Escape("$($targetConfig.origin)/")) { throw 'APK launch URL does not match the selected environment' }
if (-not ($badging | Select-String -SimpleMatch "application-label:'$($targetConfig.name)'")) { throw 'APK label does not match the selected app' }
$proof = [ordered]@{checkedAt=[DateTime]::UtcNow.ToString('o');packageId=[string]$manifest.manifest.package;origin=$targetConfig.origin;appName=$targetConfig.name;versionName=$manifest.manifest.GetAttribute('versionName',$androidNamespace);versionCode=$manifest.manifest.GetAttribute('versionCode',$androidNamespace);minSdk=$minimum;targetSdk=$targetSdk;apkSignatureVerified=$true;bundleSignatureVerified=$true;googleBundleValidation=$true;websiteCertificateMatch=$true;certificateSha256=$fingerprint;apkSha256=(Get-FileHash -LiteralPath $apk -Algorithm SHA256).Hash;aabSha256=(Get-FileHash -LiteralPath $aab -Algorithm SHA256).Hash;installedDeviceTested=$false}
$proof | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $artifactRoot 'verification.json') -Encoding utf8
$proof | ConvertTo-Json
