param([ValidateSet('Debug','Release')][string]$Configuration = 'Debug', [ValidateSet('production','test')][string]$Target = 'production', [switch]$CiAab, [string]$Bundletool, [string]$OutputDirectory)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'android-target.ps1')
$targetConfig = Get-AndroidTarget -Name $Target
$repoRoot = Split-Path -Parent $PSScriptRoot
# CI variant: no upload key, local signing path, or website association mutation.
if ($CiAab) {
    if ($Configuration -ne 'Release' -or $Target -ne 'production') { throw 'CI builds only the unsigned production release bundle.' }
    if ($env:ASCEND_ANDROID_KEYSTORE -or $env:ASCEND_ANDROID_STORE_PASSWORD) { throw 'Signing material is forbidden in the CI build.' }
    if (-not $env:JAVA_HOME -or -not $env:ANDROID_HOME -or -not $Bundletool -or -not $OutputDirectory) {
        throw 'CI mode requires JAVA_HOME, ANDROID_HOME, bundletool and a fresh output directory.'
    }
    if ($env:GITHUB_SHA -notmatch '^[a-f0-9]{40}$' -or $env:GITHUB_RUN_ID -notmatch '^[1-9][0-9]*$' -or
        $env:GITHUB_RUN_ATTEMPT -notmatch '^[1-9][0-9]*$') { throw 'Missing exact CI run provenance.' }
    if ((& git -C $repoRoot rev-parse HEAD).Trim() -cne $env:GITHUB_SHA) { throw 'Checkout does not match CI commit.' }
    & git -C $repoRoot diff --quiet HEAD -- android
    if ($LASTEXITCODE -ne 0) { throw 'Android sources differ from the selected commit.' }
    if (Test-Path -LiteralPath $OutputDirectory) { throw 'CI artifact output must not already exist.' }
    $bundletoolPath = (Get-Item -LiteralPath $Bundletool).FullName
    if ((Get-FileHash -LiteralPath $bundletoolPath).Hash -ne 'a099cfa1543f55593bc2ed16a70a7c67fe54b1747bb7301f37fdfd6d91028e29') {
        throw 'The pinned bundletool 1.18.3 SHA-256 does not match.'
    }
    $java = Join-Path $env:JAVA_HOME ('bin/java' + $(if ($IsWindows) { '.exe' }))
    Push-Location (Join-Path $repoRoot 'android')
    try {
        $wrapper = if ($IsWindows) { './gradlew.bat' } else { './gradlew' }
        & $wrapper 'bundleRelease' 'lintRelease' '-PascendTarget=production' '--console=plain' '--no-daemon'
        if ($LASTEXITCODE -ne 0) { throw "Android CI build failed ($LASTEXITCODE)" }
    } finally { Pop-Location }
    $bundle = Join-Path $repoRoot 'android/app/build/outputs/bundle/release/app-release.aab'
    $zip = [IO.Compression.ZipFile]::OpenRead($bundle)
    try {
        if ($zip.Entries.FullName -match '(?i)^META-INF/(?:[^/]+\.(?:SF|RSA|DSA|EC)|SIG-[^/]+)$') { throw 'CI produced a signed bundle unexpectedly.' }
    } finally { $zip.Dispose() }
    & $java -jar $bundletoolPath validate "--bundle=$bundle" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Bundletool validation failed.' }
    $manifestText = & $java -jar $bundletoolPath dump manifest "--bundle=$bundle"
    if ($LASTEXITCODE -ne 0) { throw 'AAB manifest inspection failed.' }
    [xml]$document = $manifestText -join [Environment]::NewLine
    $androidNamespace = 'http://schemas.android.com/apk/res/android'
    $sdk = $document.manifest.'uses-sdk'
    $targetSdk = [int]$sdk.GetAttribute('targetSdkVersion',$androidNamespace)
    $minSdk = [int]$sdk.GetAttribute('minSdkVersion',$androidNamespace)
    $versionCode = [int]$document.manifest.GetAttribute('versionCode',$androidNamespace)
    $versionName = $document.manifest.GetAttribute('versionName',$androidNamespace)
    if ($document.manifest.package -ne $targetConfig.packageId -or $targetSdk -ne 36 -or $minSdk -ne 24 -or
        $versionCode -lt 1 -or $versionCode -gt 2100000000 -or $versionName -notmatch '^[0-9A-Za-z][0-9A-Za-z.+-]{0,59}$') {
        throw 'Unexpected Android release package, SDK bounds, or version.'
    }
    New-Item -ItemType Directory -Path $OutputDirectory | Out-Null
    Copy-Item -LiteralPath $bundle -Destination (Join-Path $OutputDirectory 'Ascend-Avoid-unsigned.aab')
    @{schema=1;packageId=$targetConfig.packageId;targetSdk=$targetSdk;minSdk=$minSdk;versionCode=$versionCode;
      versionName=$versionName;commit=$env:GITHUB_SHA;ciRun=$env:GITHUB_RUN_ID;ciAttempt=$env:GITHUB_RUN_ATTEMPT;
      sha256=(Get-FileHash -LiteralPath $bundle).Hash.ToLowerInvariant();lintPassed=$true;bundletoolValidated=$true;
      signed=$false} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $OutputDirectory 'proof.json') -Encoding utf8NoBOM
    return
}
$toolRoot = Join-Path $env:USERPROFILE '.android/ascend-avoid-build'
$configPath = Join-Path $toolRoot 'toolchain.json'
if (-not (Test-Path -LiteralPath $configPath)) { throw 'Run scripts/android-setup.ps1 -AcceptLicenses first.' }
$toolchain = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
$environmentNames = @('JAVA_HOME','ANDROID_HOME','ASCEND_ANDROID_KEYSTORE','ASCEND_ANDROID_STORE_PASSWORD')
$previousEnvironment = @{}
foreach ($name in $environmentNames) { $previousEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
try {
    $env:JAVA_HOME = $toolchain.javaHome
    $env:ANDROID_HOME = $toolchain.sdkRoot
    if ($Configuration -eq 'Release') {
        $keyRoot = Join-Path $env:USERPROFILE '.android/ascend-avoid-signing'
        $keyFile = Join-Path $keyRoot 'upload.jks'
        $passwordFile = Join-Path $keyRoot 'password.xml'
        New-Item -ItemType Directory -Force -Path $keyRoot | Out-Null
        if ((Test-Path -LiteralPath $keyFile) -xor (Test-Path -LiteralPath $passwordFile)) { throw 'Signing material is incomplete; restore its matching key/password backup before building.' }
        if (-not (Test-Path -LiteralPath $keyFile)) {
            $password = ConvertTo-SecureString ([Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))) -AsPlainText -Force
            $password | Export-Clixml -LiteralPath $passwordFile
        } else { $password = Import-Clixml -LiteralPath $passwordFile }
        $env:ASCEND_ANDROID_STORE_PASSWORD = [Net.NetworkCredential]::new('', $password).Password
        $env:ASCEND_ANDROID_KEYSTORE = $keyFile
        if (-not (Test-Path -LiteralPath $keyFile)) {
            & (Join-Path $env:JAVA_HOME 'bin/keytool.exe') -genkeypair -keystore $keyFile -storetype JKS -alias ascend-avoid-upload -keyalg RSA -keysize 3072 -validity 10000 -dname 'CN=drewclark.io' -storepass:env ASCEND_ANDROID_STORE_PASSWORD -keypass:env ASCEND_ANDROID_STORE_PASSWORD
            if ($LASTEXITCODE -ne 0) { throw 'Upload key creation failed. Restore or remove only the incomplete signing material before retrying.' }
        }
    }
    Push-Location (Join-Path $repoRoot 'android')
    try {
        $tasks = if ($Configuration -eq 'Release') { @('assembleRelease','bundleRelease','lintRelease') } else { @('assembleDebug') }
        & .\gradlew.bat @tasks "-PascendTarget=$Target" '--console=plain' '--no-daemon'
        if ($LASTEXITCODE -ne 0) { throw "Android build failed ($LASTEXITCODE)" }
    } finally { Pop-Location }
    $artifacts = $targetConfig.artifactRoot
    New-Item -ItemType Directory -Force -Path $artifacts | Out-Null
    if ($Configuration -eq 'Release') {
        Copy-Item -LiteralPath (Join-Path $repoRoot 'android/app/build/outputs/apk/release/app-release.apk') -Destination (Join-Path $artifacts "$($targetConfig.artifactName).apk") -Force
        Copy-Item -LiteralPath (Join-Path $repoRoot 'android/app/build/outputs/bundle/release/app-release.aab') -Destination (Join-Path $artifacts "$($targetConfig.artifactName).aab") -Force
        & (Join-Path $PSScriptRoot 'android-assetlinks.ps1') -Target $Target
    } else {
        Copy-Item -LiteralPath (Join-Path $repoRoot 'android/app/build/outputs/apk/debug/app-debug.apk') -Destination (Join-Path $artifacts "$($targetConfig.artifactName)-debug.apk") -Force
    }
    Get-ChildItem -LiteralPath $artifacts | Select-Object Name,Length
} finally {
    foreach ($name in $environmentNames) { [Environment]::SetEnvironmentVariable($name, $previousEnvironment[$name], 'Process') }
}
