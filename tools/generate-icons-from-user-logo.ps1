Add-Type -ReferencedAssemblies "System.Drawing" -TypeDefinition @"
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;

public class UserIconResizer
{
    public static void ResizeAll(string sourcePath, string outputDir)
    {
        using (Bitmap src = new Bitmap(sourcePath))
        {
            int[] sizes = new int[] { 16, 32, 48, 128, 512 };
            foreach (int sz in sizes)
            {
                using (Bitmap resized = new Bitmap(sz, sz, PixelFormat.Format32bppArgb))
                {
                    using (Graphics g = Graphics.FromImage(resized))
                    {
                        g.Clear(Color.Transparent);
                        g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                        g.SmoothingMode = SmoothingMode.HighQuality;
                        g.PixelOffsetMode = PixelOffsetMode.HighQuality;
                        g.CompositingQuality = CompositingQuality.HighQuality;
                        g.DrawImage(src, new Rectangle(0, 0, sz, sz));
                    }
                    string dest = System.IO.Path.Combine(outputDir, "icon" + sz + ".png");
                    resized.Save(dest, ImageFormat.Png);
                }
            }
        }
    }
}
"@

$source = "$PSScriptRoot\..\icons\Gemini_Generated_Image_f02oqf02oqf02oqf-removebg-preview.png"
$outputDir = "$PSScriptRoot\..\icons"

[UserIconResizer]::ResizeAll($source, $outputDir)

# Gerar favicon.ico
$icon32 = [System.Drawing.Bitmap]::FromFile("$outputDir\icon32.png")
$iconHandle = $icon32.GetHicon()
$ico = [System.Drawing.Icon]::FromHandle($iconHandle)
$stream = [System.IO.File]::Create("$outputDir\favicon.ico")
$ico.Save($stream)
$stream.Close()
$icon32.Dispose()

Write-Host "Ícones gerados com sucesso a partir da imagem oficial do usuário."
