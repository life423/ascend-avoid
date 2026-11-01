param([switch]$AcceptLicenses)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$toolRoot = Join-Path $env:USERPROFILE '.android/ascend-avoid-build'
$downloadRoot = Join-Path $toolRoot 'downloads'
$sdkRoot = Join-Path $toolRoot 'sdk'
New-Item -ItemType Directory -Force -Path $downloadRoot | Out-Null

function Get-VerifiedDownload($Url, $Destination, $Checksum, $Algorithm = 'SHA256') {
    if (-not (Test-Path -LiteralPath $Destination) -or (Get-FileHash -LiteralPath $Destination -Algorithm $Algorithm).Hash -ne $Checksum) {
        Write-Host ('Downloading ' + [IO.Path]::GetFileName($Destination))
        Invoke-WebRequest -Uri $Url -OutFile $Destination
    }
    if ((Get-FileHash -LiteralPath $Destination -Algorithm $Algorithm).Hash -ne $Checksum) { throw "Download checksum mismatch: $Destination" }
}

$configPath = Join-Path $toolRoot 'toolchain.json'
Get-VerifiedDownload 'https://github.com/google/bundletool/releases/download/1.18.3/bundletool-all-1.18.3.jar' (Join-Path $downloadRoot 'bundletool-all-1.18.3.jar') 'a099cfa1543f55593bc2ed16a70a7c67fe54b1747bb7301f37fdfd6d91028e29'
$config = if (Test-Path -LiteralPath $configPath) { Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json } else { $null }
if ($config -and (Test-Path -LiteralPath (Join-Path $config.javaHome 'bin/javac.exe'))) {
    $javaHome = $config.javaHome
} else {
    $release = (Invoke-RestMethod 'https://api.adoptium.net/v3/assets/latest/17/hotspot?architecture=x64&image_type=jdk&os=windows&vendor=eclipse')[0]
    $archive = Join-Path $downloadRoot $release.binary.package.name
    Get-VerifiedDownload $release.binary.package.link $archive $release.binary.package.checksum
    $javaHome = Join-Path $toolRoot $release.release_name
    if (-not (Test-Path -LiteralPath (Join-Path $javaHome 'bin/javac.exe'))) { Expand-Archive -LiteralPath $archive -DestinationPath $toolRoot -Force }
    if (-not (Test-Path -LiteralPath (Join-Path $javaHome 'bin/javac.exe'))) { throw 'JDK extraction did not produce the expected compiler' }
}

$sdkManager = Join-Path $sdkRoot 'cmdline-tools/latest/bin/sdkmanager.bat'
if (-not (Test-Path -LiteralPath $sdkManager)) {
    [xml]$repository = (Invoke-WebRequest 'https://dl.google.com/android/repository/repository2-1.xml').Content
    $package = $repository.SelectNodes("//*[local-name()='remotePackage' and @path='cmdline-tools;latest']") | Select-Object -First 1
    $archiveInfo = $package.archives.archive | Where-Object { $_.'host-os' -eq 'windows' } | Select-Object -First 1
    if (-not $archiveInfo) { throw 'Windows Android SDK command-line tools not found' }
    $archive = Join-Path $downloadRoot ([string]$archiveInfo.complete.url)
    Get-VerifiedDownload ('https://dl.google.com/android/repository/' + $archiveInfo.complete.url) $archive ([string]$archiveInfo.complete.checksum) 'SHA1'
    $unpack = Join-Path $toolRoot 'sdk-unpack'
    Expand-Archive -LiteralPath $archive -DestinationPath $unpack -Force
    New-Item -ItemType Directory -Force -Path (Join-Path $sdkRoot 'cmdline-tools/latest') | Out-Null
    Copy-Item -LiteralPath (Join-Path $unpack 'cmdline-tools/bin') -Destination (Join-Path $sdkRoot 'cmdline-tools/latest') -Recurse -Force
    Copy-Item -LiteralPath (Join-Path $unpack 'cmdline-tools/lib') -Destination (Join-Path $sdkRoot 'cmdline-tools/latest') -Recurse -Force
    Copy-Item -LiteralPath (Join-Path $unpack 'cmdline-tools/NOTICE.txt') -Destination (Join-Path $sdkRoot 'cmdline-tools/latest') -Force
    Copy-Item -LiteralPath (Join-Path $unpack 'cmdline-tools/source.properties') -Destination (Join-Path $sdkRoot 'cmdline-tools/latest') -Force
}

$oldJava = $env:JAVA_HOME
try {
    $env:JAVA_HOME = $javaHome
    $required = @('platform-tools/adb.exe', 'platforms/android-36/android.jar', 'build-tools/36.1.0/apksigner.bat')
    if ($required | Where-Object { -not (Test-Path -LiteralPath (Join-Path $sdkRoot $_)) }) {
        if (-not $AcceptLicenses) { throw 'Run with -AcceptLicenses to install the required Android SDK packages and accept their SDK licenses.' }
        ('y' + [Environment]::NewLine) * 30 | & $sdkManager "--sdk_root=$sdkRoot" 'platform-tools' 'platforms;android-36' 'build-tools;36.1.0'
        if ($LASTEXITCODE -ne 0) { throw "Android SDK install failed ($LASTEXITCODE)" }
    }
    & (Join-Path $javaHome 'bin/java.exe') -version
    if ($LASTEXITCODE -ne 0) { throw 'Java verification failed' }
    @{javaHome=$javaHome; sdkRoot=$sdkRoot} | ConvertTo-Json | Set-Content -LiteralPath $configPath -Encoding utf8
    Write-Host "Android toolchain ready: $configPath"
} finally { $env:JAVA_HOME = $oldJava }
