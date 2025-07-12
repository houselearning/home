const canvas = document.getElementById("varsCanvas");
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#C7FCEC";
    ctx.font = "20px Consolas";

    let y = 40;
    function write(text, color = "#7DF9AA", size = 20) {
      ctx.fillStyle = color;
      ctx.font = size + "px Consolas";
      ctx.fillText(text, 20, y);
      y += size + 6;
    }

    // Cheat Sheet Content
    write("💠 PowerShell Variables", "#5DFDCB", 30);
    y += 10;
    write("🔸 Declaring Variables:");
    write('$greeting = "Hello World!"');
    write("$year = 2025");
    write('$path = "C:\\Users\\Alex"');
    y += 10;
    write("🔸 Viewing Variable Values:");
    write('Write-Output $greeting');
    write('Write-Host $year');
    y += 10;
    write("🔸 Variable Types:");
    write('$number = 42          # Integer');
    write('$text   = "Hey!"      # String');
    write('$flag   = $true       # Boolean');
    write('$arr    = @(1,2,3)    # Array');
    write('$hash   = @{Name="Alex"; OS="NATO-OS 7"} # Hashtable');
    y += 10;
    write("🔸 Remove Variables:");
    write('Remove-Variable year');
    y += 10;
    write("🔸 Special Variables:");
    write('$PSVersionTable   # PowerShell version info');
    write('$env:USERNAME     # Current username');
    write('$PWD              # Current directory object');
    write('$HOME             # User home directory path');
    y += 10;
    write("🔸 Array Example:");
    write('$colors = @("Red","Blue","Green")');
    write('$colors[0]   # Red');
    y += 10;
    write("✅ Done. You’re a PowerShell Variables Pro.", "#5DFDCB", 26);

    function downloadCanvas() {
      const link = document.createElement('a');
      link.download = 'safelibrary-var-cheat-sheet.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    }
