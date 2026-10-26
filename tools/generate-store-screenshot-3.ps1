Add-Type -AssemblyName System.Drawing

$srcDrop = Join-Path $PSScriptRoot "..\store\Captura de tela 2026-10-26 000705.png"
$logoPath = (Resolve-Path "$PSScriptRoot\..\icons\icon128.png").Path
$outputDir = "$PSScriptRoot\..\store"

if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

# Carregar Google Sans oficial
$pfc = New-Object System.Drawing.Text.PrivateFontCollection
$pfc.AddFontFile((Resolve-Path "$PSScriptRoot\fonts\GoogleSans-Regular.ttf").Path)
$pfc.AddFontFile((Resolve-Path "$PSScriptRoot\fonts\GoogleSans-Bold.ttf").Path)
$pfc.AddFontFile((Resolve-Path "$PSScriptRoot\fonts\GoogleSans-Medium.ttf").Path)
$googleSans = $pfc.Families | Where-Object { $_.Name -eq "Google Sans" } | Select-Object -First 1
if (-not $googleSans) { $googleSans = $pfc.Families[0] }

$canvasWidth = 1280
$canvasHeight = 800

# Formato 24bppRgb sem canal alfa
$bmp = New-Object System.Drawing.Bitmap($canvasWidth, $canvasHeight, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit

# 1. Fundo Gradiente Tech Dark
$bgRect = New-Object System.Drawing.Rectangle(0, 0, $canvasWidth, $canvasHeight)
$bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $bgRect,
    [System.Drawing.Color]::FromArgb(11, 17, 32),
    [System.Drawing.Color]::FromArgb(6, 10, 18),
    [System.Drawing.Drawing2D.LinearGradientMode]::Vertical
)
$g.FillRectangle($bgBrush, $bgRect)
$bgBrush.Dispose()

# Ambient glow no topo
$glowBrush1 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(16, 55, 42))
$g.FillEllipse($glowBrush1, -80, -100, 600, 380)
$glowBrush1.Dispose()

$glowBrush2 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(14, 45, 75))
$g.FillEllipse($glowBrush2, 760, -100, 600, 380)
$glowBrush2.Dispose()

# Ambient glow central suave para destacar o popup
$glowCenter = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(12, 35, 55))
$g.FillEllipse($glowCenter, 340, 160, 600, 500)
$glowCenter.Dispose()

# 2. Header & Branding
$logoImg = [System.Drawing.Bitmap]::FromFile($logoPath)
$logoSize = 72
$logoX = 45
$logoY = 32
$g.DrawImage($logoImg, $logoX, $logoY, $logoSize, $logoSize)
$logoImg.Dispose()

# Fontes Google Sans
$titleFont = New-Object System.Drawing.Font($googleSans, 25, [System.Drawing.FontStyle]::Bold)
$tagFont = New-Object System.Drawing.Font($googleSans, 9.5, [System.Drawing.FontStyle]::Bold)
$subFont = New-Object System.Drawing.Font($googleSans, 12, [System.Drawing.FontStyle]::Regular)
$badgeTitleFont = New-Object System.Drawing.Font($googleSans, 12, [System.Drawing.FontStyle]::Bold)
$badgeDescFont = New-Object System.Drawing.Font($googleSans, 9.5, [System.Drawing.FontStyle]::Regular)
$pillFont = New-Object System.Drawing.Font($googleSans, 10, [System.Drawing.FontStyle]::Bold)

# Eyebrow Pill com medicao dinamica
$tagText = "CONFIGURAÇÃO SIMPLES & INTUITIVA"
$tagSize = $g.MeasureString($tagText, $tagFont)
$tagBoxW = [int]($tagSize.Width + 20)
$tagBoxH = 24
$tagBoxX = 132
$tagBoxY = 30

$tagBg = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(16, 50, 40))
$tagBorder = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(16, 185, 129), 1)
$tagTextBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(52, 211, 153))

$g.FillRectangle($tagBg, $tagBoxX, $tagBoxY, $tagBoxW, $tagBoxH)
$g.DrawRectangle($tagBorder, $tagBoxX, $tagBoxY, $tagBoxW, $tagBoxH)
$g.DrawString($tagText, $tagFont, $tagTextBrush, ($tagBoxX + 10), ($tagBoxY + 4))

$tagBg.Dispose(); $tagBorder.Dispose(); $tagTextBrush.Dispose()

# Titulo Principal
$titleBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$g.DrawString("Interface da Extensão & Modelos Gemini Multimodais", $titleFont, $titleBrush, 130, 56)
$titleBrush.Dispose()

# Subtitulo
$subBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(156, 163, 175))
$g.DrawString("Alterne entre modelos Gemini em tempo real, teste sua conexão em 1 clique e zere o cache com facilidade.", $subFont, $subBrush, 132, 104)
$subBrush.Dispose()

# 3. Card Central com o Print Real do Popup
$popupImg = [System.Drawing.Bitmap]::FromFile($srcDrop)
$popW = 496
$popH = 522
$popX = [int](($canvasWidth - $popW) / 2)
$popY = 160

# Sombra suave do Popup
$shadowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(2, 6, 12))
$g.FillRectangle($shadowBrush, $popX + 8, $popY + 8, $popW, $popH)
$shadowBrush.Dispose()

# Desenhar o Popup no Canvas
$g.DrawImage($popupImg, $popX, $popY, $popW, $popH)
$popupImg.Dispose()

# Borda neon elegante ao redor do Popup
$popPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(35, 65, 95), 1.5)
$g.DrawRectangle($popPen, $popX, $popY, $popW, $popH)
$popPen.Dispose()

# 4. Badges Comerciais Laterais em Google Sans
function DrawFeatureCard {
    param($x, $y, $w, $h, $bulletColor, $title, $descLine1, $descLine2, $borderColor)
    $cardBg = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(15, 23, 42))
    $cardBorder = New-Object System.Drawing.Pen($borderColor, 1.2)
    
    $global:g.FillRectangle($cardBg, $x, $y, $w, $h)
    $global:g.DrawRectangle($cardBorder, $x, $y, $w, $h)
    
    # Bullet icon circular
    $dotBrush = New-Object System.Drawing.SolidBrush($bulletColor)
    $global:g.FillEllipse($dotBrush, ($x + 14), ($y + 16), 8, 8)
    $dotBrush.Dispose()

    $titleBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $descBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(148, 163, 184))
    
    $global:g.DrawString($title, $global:badgeTitleFont, $titleBrush, ($x + 28), ($y + 10))
    $global:g.DrawString($descLine1, $global:badgeDescFont, $descBrush, ($x + 14), ($y + 36))
    $global:g.DrawString($descLine2, $global:badgeDescFont, $descBrush, ($x + 14), ($y + 55))
    
    $cardBg.Dispose(); $cardBorder.Dispose(); $titleBrush.Dispose(); $descBrush.Dispose()
}

$sideCardW = 320
$sideCardH = 88

# Cartoes Laterais Esquerdos
$leftX = 35
DrawFeatureCard -x $leftX -y 250 -w $sideCardW -h $sideCardH -bulletColor ([System.Drawing.Color]::FromArgb(16, 185, 129)) -title "Seleção de Modelos IA" -descLine1 "Escolha entre Gemini 2.5 Flash," -descLine2 "3.8 Flash ou 2.5 Pro em tempo real." -borderColor ([System.Drawing.Color]::FromArgb(16, 185, 129))
DrawFeatureCard -x $leftX -y 390 -w $sideCardW -h $sideCardH -bulletColor ([System.Drawing.Color]::FromArgb(6, 182, 212)) -title "Validador de Conexão" -descLine1 "O botão Testar valida sua API" -descLine2 "e chave direto com a Google na hora." -borderColor ([System.Drawing.Color]::FromArgb(6, 182, 212))

# Cartoes Laterais Direitos
$rightX = 925
DrawFeatureCard -x $rightX -y 250 -w $sideCardW -h $sideCardH -bulletColor ([System.Drawing.Color]::FromArgb(59, 130, 246)) -title "Acesso Rápido ao Pool" -descLine1 "Abra o gerenciador com 1 toque" -descLine2 "para configurar múltiplas chaves." -borderColor ([System.Drawing.Color]::FromArgb(59, 130, 246))
DrawFeatureCard -x $rightX -y 390 -w $sideCardW -h $sideCardH -bulletColor ([System.Drawing.Color]::FromArgb(168, 85, 247)) -title "Controle Total de Cache" -descLine1 "Zere o cache de áudios salvos" -descLine2 "localmente quando preferir." -borderColor ([System.Drawing.Color]::FromArgb(168, 85, 247))

# 5. Barra Inferior com Destaques
$pillY = 728
function DrawBottomPill {
    param($x, $w, $text, $accentColor)
    $bg = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(17, 24, 39))
    $pen = New-Object System.Drawing.Pen($accentColor, 1)
    $txt = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(226, 232, 240))
    $checkBrush = New-Object System.Drawing.SolidBrush($accentColor)
    
    $global:g.FillRectangle($bg, $x, $global:pillY, $w, 38)
    $global:g.DrawRectangle($pen, $x, $global:pillY, $w, 38)
    
    $global:g.DrawString("✓", $global:pillFont, $checkBrush, ($x + 12), ($global:pillY + 9))
    $global:g.DrawString($text, $global:pillFont, $txt, ($x + 28), ($global:pillY + 9))
    
    $bg.Dispose(); $pen.Dispose(); $txt.Dispose(); $checkBrush.Dispose()
}

DrawBottomPill -x 35 -w 280 -text "Teste de Chave em 1 Clique" -accentColor ([System.Drawing.Color]::FromArgb(16, 185, 129))
DrawBottomPill -x 335 -w 280 -text "Modelos Multimodais Oficiais" -accentColor ([System.Drawing.Color]::FromArgb(6, 182, 212))
DrawBottomPill -x 635 -w 310 -text "Armazenamento 100% no Navegador" -accentColor ([System.Drawing.Color]::FromArgb(59, 130, 246))
DrawBottomPill -x 965 -w 280 -text "Zero Configuração Complexa" -accentColor ([System.Drawing.Color]::FromArgb(168, 85, 247))

# 6. Salvar Artefato exclusivamente em JPEG
$jpgPath = Join-Path $outputDir "screenshot-3-1280x800.jpg"

$jpgEncoder = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.FormatDescription -eq "JPEG" }
$encoderParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
$encoderParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, 96L)
$bmp.Save($jpgPath, $jpgEncoder, $encoderParams)

# Limpeza de recursos
$g.Dispose()
$bmp.Dispose()
$titleFont.Dispose(); $tagFont.Dispose(); $subFont.Dispose()
$badgeTitleFont.Dispose(); $badgeDescFont.Dispose(); $pillFont.Dispose()
$pfc.Dispose()

Write-Host "Sucesso! Screenshot 3 1280x800 gerado exclusivamente em JPEG com Google Sans:"
Write-Host "JPEG: $jpgPath"
