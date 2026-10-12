param(
  [string]$PathA,
  [string]$PathB
)

Add-Type -AssemblyName System.Windows.Forms
$wa = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
$left = [int]$wa.X
$top = [int]$wa.Y
$totalW = [int]$wa.Width
$height = [int]$wa.Height
$halfW = [int]($totalW / 2)
$rightW = [int]($totalW - $halfW)

$typeDef = @"
using System;
using System.Runtime.InteropServices;

public class WinSnapHelper {
    [DllImport("user32.dll")]
    public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll")]
    public static extern bool MoveWindow(IntPtr hWnd, int X, int Y, int nWidth, int nHeight, bool bRepaint);

    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
}
"@
Add-Type -TypeDefinition $typeDef -ErrorAction SilentlyContinue

$baseA = [System.IO.Path]::GetFileName($PathA)
$stemA = [System.IO.Path]::GetFileNameWithoutExtension($PathA)
$baseB = [System.IO.Path]::GetFileName($PathB)
$stemB = [System.IO.Path]::GetFileNameWithoutExtension($PathB)

$hWndA = [IntPtr]::Zero
$hWndB = [IntPtr]::Zero

for ($attempt = 1; $attempt -le 5; $attempt++) {
    $procs = Get-Process | Where-Object { $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle.Length -gt 0 }
    
    if ($stemA -and $stemB -and ($stemA -eq $stemB)) {
        # Both files have identical name (common in duplicates)
        $matches = @($procs | Where-Object { 
            ($_.MainWindowTitle -match [regex]::Escape($baseA)) -or 
            ($_.MainWindowTitle -match [regex]::Escape($stemA)) 
        })
        if ($matches.Count -ge 2) {
            $hWndA = $matches[0].MainWindowHandle
            $hWndB = $matches[1].MainWindowHandle
            break
        } elseif ($matches.Count -eq 1 -and $attempt -ge 3) {
            $hWndA = $matches[0].MainWindowHandle
            $hWndB = $matches[0].MainWindowHandle
            break
        }
    } else {
        # Distinct file names
        if ($hWndA -eq [IntPtr]::Zero -and $stemA) {
            $matchA = $procs | Where-Object { 
                ($_.MainWindowTitle -match [regex]::Escape($baseA)) -or 
                ($_.MainWindowTitle -match [regex]::Escape($stemA)) 
            } | Select-Object -First 1
            if ($matchA) { $hWndA = $matchA.MainWindowHandle }
        }
        
        if ($hWndB -eq [IntPtr]::Zero -and $stemB) {
            $matchB = $procs | Where-Object { 
                ($_.MainWindowTitle -match [regex]::Escape($baseB)) -or 
                ($_.MainWindowTitle -match [regex]::Escape($stemB)) 
            } | Select-Object -First 1
            if ($matchB) { $hWndB = $matchB.MainWindowHandle }
        }

        if ($hWndA -ne [IntPtr]::Zero -and $hWndB -ne [IntPtr]::Zero) {
            break
        }
    }

    Start-Sleep -Milliseconds 400
}

$result = @{
    arranged = $false
    isSingleInstanceTabbed = $false
    left = $left
    top = $top
    width = $totalW
    height = $height
}

if ($hWndA -ne [IntPtr]::Zero -and $hWndB -ne [IntPtr]::Zero) {
    if ($hWndA -eq $hWndB) {
        $result.isSingleInstanceTabbed = $true
        $result.arranged = $false
        $result.message = "Both files opened in tabs within a single application window (e.g. tabbed viewer). Use Win+Left / Win+Right or drag a tab out to arrange side-by-side."
    } else {
        # Restore windows if maximized or minimized (SW_RESTORE = 9)
        [WinSnapHelper]::ShowWindowAsync($hWndA, 9) | Out-Null
        [WinSnapHelper]::MoveWindow($hWndA, $left, $top, $halfW, $height, $true) | Out-Null

        [WinSnapHelper]::ShowWindowAsync($hWndB, 9) | Out-Null
        [WinSnapHelper]::MoveWindow($hWndB, ($left + $halfW), $top, $rightW, $height, $true) | Out-Null

        [WinSnapHelper]::SetForegroundWindow($hWndA) | Out-Null
        [WinSnapHelper]::SetForegroundWindow($hWndB) | Out-Null

        $result.arranged = $true
        $result.message = "Arranged both windows side-by-side (50/50 screen split)."
    }
} elseif ($hWndA -ne [IntPtr]::Zero -or $hWndB -ne [IntPtr]::Zero) {
    $result.message = "Opened files. One application window was detected."
} else {
    $result.message = "Opened both files in your default desktop applications."
}

[Console]::WriteLine((ConvertTo-Json $result))
