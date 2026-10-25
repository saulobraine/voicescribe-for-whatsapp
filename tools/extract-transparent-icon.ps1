Add-Type -ReferencedAssemblies "System.Drawing" -TypeDefinition @"
using System;
using System.Drawing;
using System.Drawing.Imaging;

public class TransparencyProcessor
{
    public static void Process(string inputPath, string outputDir)
    {
        using (Bitmap src = new Bitmap(inputPath))
        {
            int width = src.Width;
            int height = src.Height;

            using (Bitmap rawAlpha = new Bitmap(width, height, PixelFormat.Format32bppArgb))
            {
                int minX = width, maxX = 0, minY = height, maxY = 0;

                for (int y = 0; y < height; y++)
                {
                    for (int x = 0; x < width; x++)
                    {
                        Color c = src.GetPixel(x, y);
                        int r = c.R;
                        int g = c.G;
                        int b = c.B;

                        int max = Math.Max(r, Math.Max(g, b));
                        int min = Math.Min(r, Math.Min(g, b));
                        int delta = max - min;
                        double brightness = (r + g + b) / 3.0;

                        // Se for pixel neutro/cinza do xadrez escuro
                        bool isChecker = (delta < 18 && brightness < 82) || (delta < 25 && brightness < 58);

                        if (isChecker)
                        {
                            rawAlpha.SetPixel(x, y, Color.FromArgb(0, 0, 0, 0));
                        }
                        else
                        {
                            int alpha = 255;
                            // Suavização nas bordas de glow/transição
                            if (delta < 32 && brightness < 115)
                            {
                                double factor = Math.Max(0.0, Math.Min(1.0, (delta - 12.0) / 20.0));
                                alpha = (int)(255 * factor);
                            }

                            if (alpha > 25)
                            {
                                if (x < minX) minX = x;
                                if (x > maxX) maxX = x;
                                if (y < minY) minY = y;
                                if (y > maxY) maxY = y;
                            }

                            rawAlpha.SetPixel(x, y, Color.FromArgb(alpha, r, g, b));
                        }
                    }
                }

                // Margem segura
                int pad = 24;
                minX = Math.Max(0, minX - pad);
                minY = Math.Max(0, minY - pad);
                maxX = Math.Min(width - 1, maxX + pad);
                maxY = Math.Min(height - 1, maxY + pad);

                int cropW = maxX - minX;
                int cropH = maxY - minY;
                int squareSize = Math.Max(cropW, cropH);

                using (Bitmap croppedSquare = new Bitmap(squareSize, squareSize, PixelFormat.Format32bppArgb))
                {
                    using (Graphics gCrop = Graphics.FromImage(croppedSquare))
                    {
                        gCrop.Clear(Color.Transparent);
                        int offsetX = (squareSize - cropW) / 2;
                        int offsetY = (squareSize - cropH) / 2;
                        gCrop.DrawImage(rawAlpha, new Rectangle(offsetX, offsetY, cropW, cropH),
                            new Rectangle(minX, minY, cropW, cropH), GraphicsUnit.Pixel);
                    }

                    int[] sizes = new int[] { 16, 32, 48, 128, 512 };
                    foreach (int sz in sizes)
                    {
                        using (Bitmap resized = new Bitmap(sz, sz, PixelFormat.Format32bppArgb))
                        {
                            using (Graphics g = Graphics.FromImage(resized))
                            {
                                g.Clear(Color.Transparent);
                                g.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
                                g.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.HighQuality;
                                g.PixelOffsetMode = System.Drawing.Drawing2D.PixelOffsetMode.HighQuality;
                                g.CompositingQuality = System.Drawing.Drawing2D.CompositingQuality.HighQuality;
                                g.DrawImage(croppedSquare, 0, 0, sz, sz);
                            }
                            string destFile = System.IO.Path.Combine(outputDir, "icon" + sz + ".png");
                            resized.Save(destFile, ImageFormat.Png);
                        }
                    }

                    croppedSquare.Save(System.IO.Path.Combine(outputDir, "icon-transparent.png"), ImageFormat.Png);
                }
            }
        }
    }
}
"@

$inputPath = "C:\Users\admin\.gemini\antigravity-cli\brain\d3e6cbea-22f1-4d07-8535-e177ef47ea01\whatsapp_gemini_transparent_icon_1791431891687.jpg"
$outputDir = "$PSScriptRoot\..\icons"
if (-not (Test-Path $outputDir)) { New-Item -ItemType Directory -Path $outputDir }

[TransparencyProcessor]::Process($inputPath, $outputDir)

# Gerar favicon.ico sem fundo a partir do icon32.png
$icon32 = [System.Drawing.Bitmap]::FromFile("$outputDir\icon32.png")
$iconHandle = $icon32.GetHicon()
$ico = [System.Drawing.Icon]::FromHandle($iconHandle)
$stream = [System.IO.File]::Create("$outputDir\favicon.ico")
$ico.Save($stream)
$stream.Close()
$icon32.Dispose()

Write-Host "Ícones transparentes gerados com sucesso em $outputDir"
