Add-Type -AssemblyName System.Drawing

$outputPath = Join-Path $PSScriptRoot '..\build\icon.png'
$bitmap = New-Object System.Drawing.Bitmap 256, 256
$bitmap.SetResolution(96, 96)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.Clear([System.Drawing.Color]::Transparent)

function New-RoundedPath([float]$x, [float]$y, [float]$width, [float]$height, [float]$radius) {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $diameter = $radius * 2
  $path.AddArc($x, $y, $diameter, $diameter, 180, 90)
  $path.AddArc($x + $width - $diameter, $y, $diameter, $diameter, 270, 90)
  $path.AddArc($x + $width - $diameter, $y + $height - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($x, $y + $height - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  return $path
}

$shadowPath = New-RoundedPath 40 34 176 188 44
$shadowBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(35, 36, 25, 92))
$graphics.TranslateTransform(0, 8)
$graphics.FillPath($shadowBrush, $shadowPath)
$graphics.ResetTransform()

$backPath = New-RoundedPath 30 32 150 176 38
$backBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
  (New-Object System.Drawing.Point 30, 32),
  (New-Object System.Drawing.Point 180, 208),
  ([System.Drawing.Color]::FromArgb(255, 205, 197, 250)),
  ([System.Drawing.Color]::FromArgb(255, 151, 132, 230))
)
$graphics.RotateTransform(-8)
$graphics.TranslateTransform(-19, 18)
$graphics.FillPath($backBrush, $backPath)
$graphics.ResetTransform()

$frontPath = New-RoundedPath 76 35 150 184 38
$frontBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
  (New-Object System.Drawing.Point 76, 35),
  (New-Object System.Drawing.Point 226, 219),
  ([System.Drawing.Color]::FromArgb(255, 132, 110, 229)),
  ([System.Drawing.Color]::FromArgb(255, 87, 66, 184))
)
$graphics.FillPath($frontBrush, $frontPath)

$white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(235, 255, 255, 255))
$avatarPath = New-RoundedPath 108 71 86 70 25
$graphics.FillPath($white, $avatarPath)
$purple = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 105, 84, 204))
$graphics.FillEllipse($purple, 137, 83, 28, 28)
$bodyPath = New-RoundedPath 124 112 54 19 9
$graphics.FillPath($purple, $bodyPath)
$lineBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(210, 255, 255, 255))
$lineOne = New-RoundedPath 107 162 87 12 6
$lineTwo = New-RoundedPath 107 185 58 12 6
$graphics.FillPath($lineBrush, $lineOne)
$graphics.FillPath($lineBrush, $lineTwo)

$bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
$lineTwo.Dispose(); $lineOne.Dispose(); $lineBrush.Dispose(); $bodyPath.Dispose(); $purple.Dispose(); $avatarPath.Dispose(); $white.Dispose()
$frontBrush.Dispose(); $frontPath.Dispose(); $backBrush.Dispose(); $backPath.Dispose(); $shadowBrush.Dispose(); $shadowPath.Dispose()
$graphics.Dispose(); $bitmap.Dispose()
Write-Output $outputPath
