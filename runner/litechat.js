#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const https = require("https");
const { exec } = require("child_process");
const express = require("express");
const app = express();

// Parse command line arguments
const args = process.argv.slice(2);
const port = args[0] || 3000;
const hostAllInterfaces = args.includes("--host") || args.includes("-h");

// Create temp directory if it doesn't exist
const tempDir = path.join(__dirname, "litechat-app");
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

console.log("Downloading LiteChat release...");
const zipPath = path.join(tempDir, "litechat.zip");
const file = fs.createWriteStream(zipPath);

https
  .get("https://litechat.dbuild.dev/release/latest.zip", (response) => {
    response.pipe(file);
    file.on("finish", () => {
      file.close();
      console.log("Download complete. Extracting...");

      // Extract the zip file
      const extractCommand =
        process.platform === "win32"
          ? `powershell -command "Expand-Archive -Path '${zipPath}' -DestinationPath '${tempDir}' -Force"`
          : `unzip -o ${zipPath} -d ${tempDir}`;

      exec(extractCommand, (error) => {
        if (error) {
          console.error("Error extracting files:", error);
          return;
        }

        console.log("Extraction complete.");

        // Delete the zip file
        fs.unlinkSync(zipPath);

        // Serve the files
        app.use(express.static(tempDir));

        // Handle SPA routing
        app.get("*", (req, res) => {
          res.sendFile(path.join(tempDir, "index.html"));
        });

        const host = hostAllInterfaces ? "0.0.0.0" : "localhost";
        app.listen(port, host, () => {
          const accessUrl = hostAllInterfaces
            ? `http://${require("os").hostname()}:${port} (accessible from other devices)`
            : `http://localhost:${port} (local access only)`;

          console.log(`LiteChat is running at ${accessUrl}`);
        });
      });
    });
  })
  .on("error", (err) => {
    fs.unlinkSync(zipPath);
    console.error("Error downloading LiteChat:", err);
  });
