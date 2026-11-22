function Get-AndroidTarget {
    param([ValidateSet('production','test')][string]$Name = 'production')
    $root = Split-Path -Parent $PSScriptRoot
    $targets = Get-Content -LiteralPath (Join-Path $root 'android/targets.json') -Raw | ConvertFrom-Json
    $target = $targets.$Name
    if (-not $target -or ([uri]$target.origin).Scheme -ne 'https') { throw 'Invalid Android target configuration.' }
    $trustedOrigins = @($target.origin) + @($target.additionalTrustedOrigins)
    foreach ($origin in $trustedOrigins) {
        $uri = [uri]$origin
        if (-not $uri.IsAbsoluteUri -or $uri.Scheme -ne 'https' -or -not $uri.Host -or $uri.UserInfo -or $uri.Query -or $uri.Fragment -or $uri.AbsolutePath -ne '/' -or $origin -cne "https://$($uri.Host)") { throw 'Trusted origins must be exact HTTPS origins without paths.' }
    }
    $other = if ($Name -eq 'production') { $targets.test } else { $targets.production }
    $otherOrigins = @($other.origin) + @($other.additionalTrustedOrigins)
    if (@($trustedOrigins | Sort-Object -Unique).Count -ne $trustedOrigins.Count -or @($trustedOrigins | Where-Object { $_ -in $otherOrigins }).Count) { throw 'App trusted origins must be unique and isolated.' }
    if ($target.versionCode -isnot [long] -and $target.versionCode -isnot [int]) { throw 'Invalid Android version code.' }
    if ($target.versionCode -lt 1 -or $target.versionName -notmatch '^\d+\.\d+\.\d+$') { throw 'Invalid Android target version.' }
    if ($Name -eq 'test' -and ($target.origin -eq $targets.production.origin -or $target.packageId -eq $targets.production.packageId)) { throw 'The Test app must have its own origin and package ID.' }
    $artifactRoot = Join-Path $root 'artifacts/android'
    if ($target.artifactFolder) { $artifactRoot = Join-Path $artifactRoot $target.artifactFolder }
    $target | Add-Member -NotePropertyName artifactRoot -NotePropertyValue $artifactRoot
    $target | Add-Member -NotePropertyName trustedOrigins -NotePropertyValue $trustedOrigins
    $target | Add-Member -NotePropertyName launcher -NotePropertyValue 'io.drewclark.ascendavoid.LauncherActivity'
    return $target
}
