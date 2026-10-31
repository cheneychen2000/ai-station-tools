Add-Type -AssemblyName System.Drawing
$w = 1200
$h = 630
$bmp = New-Object System.Drawing.Bitmap($w, $h)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.Clear([System.Drawing.Color]::FromArgb(31, 58, 138))

$brandFont = New-Object System.Drawing.Font("Microsoft YaHei", 72, [System.Drawing.FontStyle]::Bold)
$subFont = New-Object System.Drawing.Font("Microsoft YaHei", 32)
$sub2Font = New-Object System.Drawing.Font("Microsoft YaHei", 24)
$siteFont = New-Object System.Drawing.Font("Microsoft YaHei", 26, [System.Drawing.FontStyle]::Bold)
$soft = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(224, 232, 248))
$gold = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(232, 185, 62))
$fmt = [System.Drawing.StringFormat]::GenericTypographic

$t1 = "Reflex Hub"
$sz = $g.MeasureString($t1, $brandFont, [int]::MaxValue, $fmt)
$g.DrawString($t1, $brandFont, [System.Drawing.Brushes]::White, ($w - $sz.Width) / 2, 150)

$t2 = "大模型 API 成本与模型选型工具"
$sz2 = $g.MeasureString($t2, $subFont, [int]::MaxValue, $fmt)
$g.DrawString($t2, $subFont, $soft, ($w - $sz2.Width) / 2, 300)

$t2b = "免费使用 · 无需注册 · 数据来源可查"
$sz2b = $g.MeasureString($t2b, $sub2Font, [int]::MaxValue, $fmt)
$g.DrawString($t2b, $sub2Font, $soft, ($w - $sz2b.Width) / 2, 380)

$t3 = "reflex-hub.com"
$sz3 = $g.MeasureString($t3, $siteFont, [int]::MaxValue, $fmt)
$g.DrawString($t3, $siteFont, $gold, ($w - $sz3.Width) / 2, 480)

$g.Dispose()
$dst = "C:\Users\cc\WebProjects\ai-station-tools\dist\assets\og-cover.png"
$bmp.Save($dst, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
$item = Get-Item $dst
Write-Output ("saved: " + $item.FullName + " " + [math]::Round($item.Length / 1KB, 1) + " KB")
