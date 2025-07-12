// ============== Bootloader simulation from your existing script ===============
    function simulateBootloader() {
      const output = document.getElementById("simOutput");
      output.innerText = "";

      const lines = [
        "Loading boot sector into memory at 0x7c00...",
        "Jumping to bootloader code...",
        "Printing message:",
        "Hello from your bootloader! Press Ctrl+C to quit.",
        "",
        "Bootloader finished. CPU halted in infinite loop.",
      ];

      let i = 0;

      function printNextLine() {
        if (i < lines.length) {
          output.innerText += lines[i] + "\n";
          i++;
          setTimeout(printNextLine, 700);
        }
      }

      printNextLine();
    }
  const asmOutput = document.getElementById("asmOutput");
  const asmCodeArea = document.getElementById("asmCodeArea");
  const downloadAsmBtn = document.getElementById("downloadAsmBtn");
  const downloadPaintBtn = document.getElementById("downloadPaintBtn");

  let mode = "loading"; // loading, dashboard, write, paint, shutdown
  let writeText = "";
  const paintWidth = 20;
  const paintHeight = 10;
  let paintGrid = Array(paintHeight).fill(null).map(() => Array(paintWidth).fill(false));
  let paintCursor = { x: 0, y: 0 };

  // TEXT STYLE PROGRESS BAR VARIABLES
  let progress = 0;
  const progressDuration = 3000; // 3 seconds
  const progressInterval = 150; // update every 150ms
  const totalBars = 30; // total '|' bars in progress bar

  function renderProgressBar() {
    const progressPercent = Math.min(progress / progressDuration, 1);
    const barsToShow = Math.floor(progressPercent * totalBars);
    const barStr = "[" + "|".repeat(barsToShow) + " ".repeat(totalBars - barsToShow) + "] ";
    const percentStr = Math.floor(progressPercent * 100) + "%";
    asmOutput.textContent = barStr + percentStr;
  }

  function loadingStep() {
    progress += progressInterval;
    if (progress > progressDuration) {
      progress = progressDuration;
      renderProgressBar();
      mode = "dashboard";
      renderDashboard();
      window.addEventListener("keydown", handleKeydown);
      return;
    }
    renderProgressBar();
    setTimeout(loadingStep, progressInterval);
  }

  // Start loading bar simulation on page load
  renderProgressBar();
  setTimeout(loadingStep, progressInterval);

  // Render Dashboard text
  function renderDashboard() {
    asmOutput.textContent =
      "=== TinyASM OS Dashboard ===\n\n" +
      "Press W: Write App\n" +
      "Press P: Paint App\n" +
      "Press S: Shutdown\n\n" +
      "(Use keyboard to interact)";
    downloadPaintBtn.style.display = "none";
  }

  // Render Write app text
  function renderWrite() {
    asmOutput.textContent = "Write App (type your text, ESC to return):\n\n" + writeText;
    downloadPaintBtn.style.display = "none";
  }

  // Render Paint app
  function renderPaint() {
    let text = "Paint App (Use Arrow keys, SPACE to toggle pixel, ESC to return):\n\n";
    for (let y = 0; y < paintHeight; y++) {
      for (let x = 0; x < paintWidth; x++) {
        if (x === paintCursor.x && y === paintCursor.y) {
          text += paintGrid[y][x] ? "▣" : "▢"; // cursor block filled/empty
        } else {
          text += paintGrid[y][x] ? "■" : "·"; // pixel filled/empty
        }
      }
      text += "\n";
    }
    asmOutput.textContent = text;
    downloadPaintBtn.style.display = "inline-block";
  }

  // Shutdown screen
  function renderShutdown() {
    asmOutput.textContent = "Shutting down... Goodbye!";
    downloadPaintBtn.style.display = "none";
  }

  // Handle keyboard events based on mode
  function handleKeydown(e) {
    if (mode === "dashboard") {
      if (e.key.toLowerCase() === "w") {
        mode = "write";
        writeText = "";
        renderWrite();
      } else if (e.key.toLowerCase() === "p") {
        mode = "paint";
        paintCursor = { x: 0, y: 0 };
        renderPaint();
      } else if (e.key.toLowerCase() === "s") {
        mode = "shutdown";
        renderShutdown();
        window.removeEventListener("keydown", handleKeydown);
      }
    } else if (mode === "write") {
      if (e.key === "Escape") {
        mode = "dashboard";
        renderDashboard();
      } else if (e.key === "Backspace") {
        writeText = writeText.slice(0, -1);
        renderWrite();
      } else if (e.key.length === 1) {
        writeText += e.key;
        renderWrite();
      }
    } else if (mode === "paint") {
      if (e.key === "Escape") {
        mode = "dashboard";
        renderDashboard();
      } else if (e.key === "ArrowUp") {
        if (paintCursor.y > 0) paintCursor.y--;
        renderPaint();
      } else if (e.key === "ArrowDown") {
        if (paintCursor.y < paintHeight - 1) paintCursor.y++;
        renderPaint();
      } else if (e.key === "ArrowLeft") {
        if (paintCursor.x > 0) paintCursor.x--;
        renderPaint();
      } else if (e.key === "ArrowRight") {
        if (paintCursor.x < paintWidth - 1) paintCursor.x++;
        renderPaint();
      } else if (e.key === " ") {
        paintGrid[paintCursor.y][paintCursor.x] = !paintGrid[paintCursor.y][paintCursor.x];
        renderPaint();
      }
    }
  }

  // Download asm file button logic stays the same
  downloadAsmBtn.onclick = () => {
    const asmText = asmCodeArea.textContent.trim();
    const blob = new Blob([asmText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tinyasm_os.asm";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 0);
  };

  // Download paint image button logic stays the same
  downloadPaintBtn.onclick = () => {
    let paintData = "";
    for (let y = 0; y < paintHeight; y++) {
      for (let x = 0; x < paintWidth; x++) {
        paintData += paintGrid[y][x] ? "1" : "0";
      }
      paintData += "\n";
    }
    const blob = new Blob([paintData], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "paint_image.txt";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 0);
  };
