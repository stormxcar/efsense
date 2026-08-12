param(
  [Parameter(Mandatory = $true)]
  [string]$PublishableKey
)

$ErrorActionPreference = 'Stop'
$projectRef = 'iptmtmlgdwhtxhhvvith'
$projectUrl = "https://$projectRef.supabase.co"
$workspace = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $workspace '.env'
$migrationFile = Join-Path $workspace 'supabase\migrations\202607300001_initial_football_stories.sql'

if ($PublishableKey -notmatch '^(sb_publishable_|eyJ)') {
  throw 'Publishable/anon key không đúng định dạng Supabase.'
}

if (-not (Test-Path -LiteralPath $migrationFile)) {
  throw "Không tìm thấy migration: $migrationFile"
}

$accessTokenSecure = Read-Host 'Nhập Supabase Personal Access Token (sbp_...)' -AsSecureString
$databasePasswordSecure = Read-Host 'Nhập database password của project FOOTBALL STORIES' -AsSecureString
$accessToken = [System.Net.NetworkCredential]::new('', $accessTokenSecure).Password
$databasePassword = [System.Net.NetworkCredential]::new('', $databasePasswordSecure).Password

if ($accessToken -notmatch '^sbp_') {
  throw 'Personal Access Token không đúng định dạng sbp_...'
}
if ([string]::IsNullOrWhiteSpace($databasePassword)) {
  throw 'Database password không được để trống.'
}

$existing = if (Test-Path -LiteralPath $envFile) { Get-Content -LiteralPath $envFile } else { @() }
$filtered = $existing | Where-Object {
  $_ -notmatch '^VITE_SUPABASE_URL=' -and
  $_ -notmatch '^VITE_SUPABASE_ANON_KEY=' -and
  $_ -notmatch '^VITE_SUPABASE_PUBLISHABLE_KEY='
}
$nextEnv = @(
  "VITE_SUPABASE_URL=$projectUrl"
  "VITE_SUPABASE_PUBLISHABLE_KEY=$PublishableKey"
) + $filtered
Set-Content -LiteralPath $envFile -Value $nextEnv -Encoding utf8

$env:SUPABASE_ACCESS_TOKEN = $accessToken
$env:SUPABASE_DB_PASSWORD = $databasePassword

Push-Location $workspace
try {
  Write-Host "Đang liên kết project $projectRef..."
  npx supabase link --project-ref $projectRef
  if ($LASTEXITCODE -ne 0) { throw 'Không thể liên kết Supabase project.' }

  Write-Host 'Đang kiểm tra migration ở chế độ dry-run...'
  npx supabase db push --linked --dry-run
  if ($LASTEXITCODE -ne 0) { throw 'Migration dry-run thất bại. Chưa có thay đổi nào được push.' }

  Write-Host 'Dry-run thành công. Đang áp dụng migration...'
  npx supabase db push --linked
  if ($LASTEXITCODE -ne 0) { throw 'Không thể áp dụng migration.' }

  Write-Host 'Đang kiểm tra lịch sử migration...'
  npx supabase migration list --linked
  if ($LASTEXITCODE -ne 0) { throw 'Không thể đọc lịch sử migration.' }

  Write-Host 'Hoàn tất kết nối và tạo schema cho FOOTBALL STORIES.'
}
finally {
  Pop-Location
  Remove-Item Env:SUPABASE_ACCESS_TOKEN -ErrorAction SilentlyContinue
  Remove-Item Env:SUPABASE_DB_PASSWORD -ErrorAction SilentlyContinue
  $accessToken = $null
  $databasePassword = $null
}
