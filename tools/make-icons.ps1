# Lager PNG-ikoner (oransje hantel på mørk bakgrunn) i ../icons
Add-Type -AssemblyName System.Drawing
$out = Join-Path (Split-Path -Parent $PSScriptRoot) 'icons'

function New-Icon([int]$size, [string]$file, [bool]$rounded, [double]$glyphScale) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.Clear([System.Drawing.Color]::Transparent)
  $bg = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 21, 21, 21))
  $white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 255, 107, 26))

  function RR($x, $y, $w, $h, $r) {
    $p = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = [float]($r * 2)
    $p.AddArc([float]$x, [float]$y, $d, $d, 180, 90)
    $p.AddArc([float]($x + $w - $d), [float]$y, $d, $d, 270, 90)
    $p.AddArc([float]($x + $w - $d), [float]($y + $h - $d), $d, $d, 0, 90)
    $p.AddArc([float]$x, [float]($y + $h - $d), $d, $d, 90, 90)
    $p.CloseFigure()
    return $p
  }

  if ($rounded) { $g.FillPath($bg, (RR 0 0 $size $size ($size * 0.22))) } else { $g.FillRectangle($bg, 0, 0, $size, $size) }

  $s = $size / 512.0 * $glyphScale
  $o = ($size - 512 * $s) / 2
  foreach ($r in @(@(96,176,40,160,14), @(144,146,48,220,16), @(320,146,48,220,16), @(376,176,40,160,14), @(192,238,128,36,8))) {
    $g.FillPath($white, (RR ($o + $r[0]*$s) ($o + $r[1]*$s) ($r[2]*$s) ($r[3]*$s) ($r[4]*$s)))
  }
  $bmp.Save((Join-Path $out $file), [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
}

New-Icon 192 'icon-192.png' $true 1.0
New-Icon 512 'icon-512.png' $true 1.0
New-Icon 512 'icon-maskable-512.png' $false 0.8
New-Icon 180 'apple-touch-icon.png' $false 1.0
Write-Host "Ikoner laget i $out"
