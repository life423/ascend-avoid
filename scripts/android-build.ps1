param([ValidateSet('Debug','Release')][string]$Configuration = 'Debug', [ValidateSet('production','test')][string]$Target = 'production')
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'android-target.ps1')
$targetConfig = Get-AndroidTarget -Name $Target
$repoRoot = Split-Path -Parent $PSScriptRoot
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
