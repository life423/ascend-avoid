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
if ([int]$manifest.manifest.GetAttribute('versionCode',$androidNamespace) -ne $targetConfig.versionCode -or $manifest.manifest.GetAttribute('versionName',$androidNamespace) -cne $targetConfig.versionName) { throw 'Bundle version does not match the selected target' }
$launchers = @($manifest.manifest.application.activity | Where-Object { $_.GetAttribute('name',$androidNamespace) -eq $targetConfig.launcher })
if ($launchers.Count -ne 1) { throw 'The expected Android launcher is missing or duplicated' }
$launcherMetadata = @($launchers[0].'meta-data')
foreach ($required in @(
    @{name='android.support.customtabs.trusted.DEFAULT_URL';attribute='value';expected='@string/launchUrl'},
    @{name='android.support.customtabs.trusted.ADDITIONAL_TRUSTED_ORIGINS';attribute='resource';expected='@array/additional_trusted_origins'},
    @{name='android.support.customtabs.trusted.DISPLAY_MODE';attribute='value';expected='immersive'}
)) {
    $entries = @($launcherMetadata | Where-Object { $_.GetAttribute('name',$androidNamespace) -eq $required.name })
    if ($entries.Count -ne 1 -or $entries[0].GetAttribute($required.attribute,$androidNamespace) -cne $required.expected) { throw "Bundle launcher metadata does not match: $($required.name)" }
}
$applicationTrust = @($manifest.manifest.application.'meta-data' | Where-Object { $_.GetAttribute('name',$androidNamespace) -eq 'asset_statements' })
if ($applicationTrust.Count -ne 1 -or $applicationTrust[0].GetAttribute('resource',$androidNamespace) -cne '@string/assetStatements') { throw 'Bundle native website association is missing' }
$badging = & (Join-Path $toolchain.sdkRoot 'build-tools/36.1.0/aapt2.exe') dump badging $apk
if ($LASTEXITCODE -ne 0 -or -not ($badging | Select-String "targetSdkVersion:'$targetSdk'")) { throw 'APK target does not match the validated bundle' }
if (-not ($badging | Select-String -SimpleMatch "package: name='$($targetConfig.packageId)'")) { throw 'APK package does not match the selected app' }
if (-not ($badging | Select-String -SimpleMatch "versionCode='$($targetConfig.versionCode)' versionName='$($targetConfig.versionName)'")) { throw 'APK version does not match the selected target' }
$resources = & (Join-Path $toolchain.sdkRoot 'build-tools/36.1.0/aapt2.exe') dump resources $apk
if ($LASTEXITCODE -ne 0) { throw 'APK resource inspection failed' }
$resourceBlocks = ($resources | Out-String) -split '\r?\n\s*resource '
function Get-ApkResourceBlock {
    param([string]$ResourceName)
    $blocksFound = @($resourceBlocks | Where-Object { $_ -match "^\S+ $([regex]::Escape($ResourceName))\b" })
    if ($blocksFound.Count -ne 1) { throw "Expected one APK resource: $ResourceName" }
    return $blocksFound[0]
}
function Get-ApkString {
    param([string]$ResourceName)
    $block = Get-ApkResourceBlock -ResourceName $ResourceName
    $stringsFound = @($block -split '\r?\n' | ForEach-Object { if ($_ -match '^\s*\(\) "(.*)"\s*$') { $Matches[1] } })
    if ($stringsFound.Count -ne 1) { throw "Expected one default APK string: $ResourceName" }
    return $stringsFound[0]
}
if ((Get-ApkString -ResourceName 'string/launchUrl') -cne "$($targetConfig.origin)/") { throw 'APK launch URL does not match the selected environment' }
if ((Get-ApkString -ResourceName 'string/hostName') -cne ([uri]$targetConfig.origin).Host) { throw 'APK deep-link hostname does not match the selected environment' }
if ((Get-ApkString -ResourceName 'string/webManifestUrl') -cne "$($targetConfig.origin)/manifest.webmanifest") { throw 'APK web manifest URL does not match the selected environment' }
$originsResource = Get-ApkResourceBlock -ResourceName 'array/additional_trusted_origins'
$compiledAdditionalOrigins = @([regex]::Matches($originsResource, '"([^"]*)"') | ForEach-Object { $_.Groups[1].Value })
if ((($compiledAdditionalOrigins | Sort-Object) -join "`n") -cne (($targetConfig.additionalTrustedOrigins | Sort-Object) -join "`n")) { throw 'APK additional trusted origins do not match the selected target' }
$nativeStatements = @(Get-ApkString -ResourceName 'string/assetStatements' | ConvertFrom-Json)
$compiledWebOrigins = @(foreach ($statement in $nativeStatements) {
    if ($statement.target.namespace -cne 'web' -or @($statement.relation).Count -ne 1 -or $statement.relation[0] -cne 'delegate_permission/common.handle_all_urls') { throw 'Unexpected APK native website association' }
    $statement.target.site
})
if ((($compiledWebOrigins | Sort-Object) -join "`n") -cne (($targetConfig.trustedOrigins | Sort-Object) -join "`n")) { throw 'APK native website associations do not exactly match the trusted origins' }
$apkManifest = & (Join-Path $toolchain.sdkRoot 'build-tools/36.1.0/aapt2.exe') dump xmltree $apk --file AndroidManifest.xml
if ($LASTEXITCODE -ne 0) { throw 'APK launcher metadata inspection failed' }
$apkMetadata = @(($apkManifest | Out-String) -split '(?m)^\s*E: ' | Where-Object { $_ -match '^meta-data\b' })
foreach ($required in @(
    @{name='asset_statements';attribute='resource';resource='string/assetStatements'},
    @{name='android.support.customtabs.trusted.DEFAULT_URL';attribute='value';resource='string/launchUrl'},
    @{name='android.support.customtabs.trusted.ADDITIONAL_TRUSTED_ORIGINS';attribute='resource';resource='array/additional_trusted_origins'}
)) {
    $block = Get-ApkResourceBlock -ResourceName $required.resource
    $resourceId = ($block -split '\s+',2)[0]
    $entries = @($apkMetadata | Where-Object { $_ -match "name\([^)]*\)=`"$([regex]::Escape($required.name))`"" })
    if ($entries.Count -ne 1 -or $entries[0] -notmatch ":$($required.attribute)\([^)]*\)=@$([regex]::Escape($resourceId))\b") { throw "APK launcher does not use the expected trusted resource: $($required.name)" }
}
$immersive = @($apkMetadata | Where-Object { $_ -match 'name\([^)]*\)="android\.support\.customtabs\.trusted\.DISPLAY_MODE"' })
if ($immersive.Count -ne 1 -or $immersive[0] -notmatch ':value\([^)]*\)="immersive"') { throw 'APK launcher is not configured for immersive display' }
if (-not ($badging | Select-String -SimpleMatch "application-label:'$($targetConfig.name)'")) { throw 'APK label does not match the selected app' }
$expectedLauncherIcon = if ($Target -eq 'test') { 'ic_launcher_test' } else { 'ic_launcher_production' }
if ($manifest.manifest.application.GetAttribute('icon',$androidNamespace) -ne "@mipmap/$expectedLauncherIcon") { throw 'Launcher icon does not match the selected app' }
if (-not ($resources | Select-String -SimpleMatch "mipmap/$expectedLauncherIcon")) { throw 'Selected launcher icon is missing from the APK' }
$expectedRoundLauncherIcon = "$($expectedLauncherIcon)_round"
if ($manifest.manifest.application.GetAttribute('roundIcon',$androidNamespace) -ne "@mipmap/$expectedRoundLauncherIcon") { throw 'Round launcher icon does not match the selected app' }
foreach ($launcherResource in @($expectedLauncherIcon,$expectedRoundLauncherIcon)) {
    $iconResource = ($resources | Out-String) -split '\r?\n\s*resource ' | Where-Object { $_ -match "^\S+ mipmap/$launcherResource\b" }
    if ($iconResource -notmatch '\(anydpi-v26\) \(file\) (\S+) type=XML') { throw "Modern Android adaptive icon is missing: $launcherResource" }
    $adaptiveFile = $Matches[1]
    $adaptiveTree = & (Join-Path $toolchain.sdkRoot 'build-tools/36.1.0/aapt2.exe') dump xmltree $apk --file $adaptiveFile
    if ($LASTEXITCODE -ne 0 -or -not ($adaptiveTree | Select-String 'E: adaptive-icon') -or -not ($adaptiveTree | Select-String 'E: background') -or -not ($adaptiveTree | Select-String 'E: foreground')) { throw "Packaged icon is not a layered adaptive icon: $launcherResource" }
}
$proof = [ordered]@{checkedAt=[DateTime]::UtcNow.ToString('o');packageId=[string]$manifest.manifest.package;origin=$targetConfig.origin;appName=$targetConfig.name;versionName=$manifest.manifest.GetAttribute('versionName',$androidNamespace);versionCode=$manifest.manifest.GetAttribute('versionCode',$androidNamespace);minSdk=$minimum;targetSdk=$targetSdk;apkSignatureVerified=$true;bundleSignatureVerified=$true;googleBundleValidation=$true;websiteCertificateMatch=$true;certificateSha256=$fingerprint;apkSha256=(Get-FileHash -LiteralPath $apk -Algorithm SHA256).Hash;aabSha256=(Get-FileHash -LiteralPath $aab -Algorithm SHA256).Hash;installedDeviceTested=$false}
$proof['launcherResource'] = $expectedLauncherIcon
$proof['roundLauncherResource'] = $expectedRoundLauncherIcon
$proof['adaptiveLauncherVerified'] = $true
$proof['trustedOrigins'] = @($targetConfig.trustedOrigins)
$proof['additionalTrustedOrigins'] = @($compiledAdditionalOrigins)
$proof['compiledNativeTrustVerified'] = $true
$proof['immersiveDisplayModeVerified'] = $true
$proof | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $artifactRoot 'verification.json') -Encoding utf8
$proof | ConvertTo-Json
