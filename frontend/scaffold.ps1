$dirs = @(
  'src/features/dashboard/hooks',
  'src/features/supervisors/components',
  'src/features/supervisors/hooks',
  'src/features/supervisors/services'
)
foreach ($d in $dirs) {
  New-Item -ItemType Directory -Force -Path $d | Out-Null
  $gk = Join-Path $d '.gitkeep'
  if (-not (Test-Path $gk)) { New-Item -ItemType File -Path $gk | Out-Null }
}
Write-Host "Done: $($dirs.Count) directories"
