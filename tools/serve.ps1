# Enkel lokal testserver for Treningslogg: http://localhost:5510/
$root = Split-Path -Parent $PSScriptRoot
$port = 5510
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()
Write-Host "Serving $root on http://localhost:$port/"

while ($listener.IsListening) {
  try {
    $context = $listener.GetContext()
    $reqPath = $context.Request.Url.LocalPath
    if ($reqPath -eq "/") { $reqPath = "/index.html" }
    $filePath = Join-Path $root ([Uri]::UnescapeDataString($reqPath.TrimStart("/")))

    if (Test-Path $filePath -PathType Leaf) {
      $bytes = [System.IO.File]::ReadAllBytes($filePath)
      $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
      $contentType = switch ($ext) {
        ".html" { "text/html; charset=utf-8" }
        ".js"   { "application/javascript; charset=utf-8" }
        ".css"  { "text/css; charset=utf-8" }
        ".json" { "application/json; charset=utf-8" }
        ".webmanifest" { "application/manifest+json; charset=utf-8" }
        ".svg"  { "image/svg+xml" }
        ".png"  { "image/png" }
        default { "application/octet-stream" }
      }
      $context.Response.ContentType = $contentType
      $context.Response.Headers.Add("Cache-Control", "no-cache")
      $context.Response.ContentLength64 = $bytes.Length
      $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $context.Response.StatusCode = 404
      $msg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $reqPath")
      $context.Response.OutputStream.Write($msg, 0, $msg.Length)
    }
    $context.Response.OutputStream.Close()
  } catch {
    Write-Host "Request error: $_"
  }
}
