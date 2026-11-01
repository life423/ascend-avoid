function Get-AndroidTarget {
    param([ValidateSet('production','test')][string]$Name = 'production')
    $root = Split-Path -Parent $PSScriptRoot
    $targets = Get-Content -LiteralPath (Join-Path $root 'android/targets.json') -Raw | ConvertFrom-Json
    $target = $targets.$Name
    if (-not $target -or ([uri]$target.origin).Scheme -ne 'https') { throw 'Invalid Android target configuration.' }
    if ($Name -eq 'test' -and ($target.origin -eq $targets.production.origin -or $target.packageId -eq $targets.production.packageId)) { throw 'The Test app must have its own origin and package ID.' }
    $artifactRoot = Join-Path $root 'artifacts/android'
    if ($target.artifactFolder) { $artifactRoot = Join-Path $artifactRoot $target.artifactFolder }
    $target | Add-Member -NotePropertyName artifactRoot -NotePropertyValue $artifactRoot
    $target | Add-Member -NotePropertyName launcher -NotePropertyValue 'io.drewclark.ascendavoid.LauncherActivity'
    return $target
}
