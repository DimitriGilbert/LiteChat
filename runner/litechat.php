#!/usr/bin/env php
<?php
// Function to safely create directories
function safeMkdir($dir) {
    if (!file_exists($dir)) {
        mkdir($dir, 0755, true);
    }
}

// Function to get an option from command line arguments
function getOption($args, $option, $default = false) {
    foreach ($args as $arg) {
        if ($arg === $option) {
            return true;
        }
    }
    return $default;
}

// Parse command line arguments
$args = array_slice($argv, 1);
$port = isset($args[0]) && is_numeric($args[0]) ? (int)$args[0] : 3000;
$hostAll = getOption($args, '--host') || getOption($args, '-h');

// Create temp directory
$scriptDir = dirname(__FILE__);
$tempDir = $scriptDir . '/litechat-app';
safeMkdir($tempDir);

// Download the zip file
$zipPath = $tempDir . '/litechat.zip';
echo "Downloading LiteChat release...\n";

// Create a stream context to handle redirects
$context = stream_context_create([
    'http' => [
        'follow_location' => true
    ]
]);

$zipContent = file_get_contents('https://litechat.dbuild.dev/release/latest.zip', false, $context);
if ($zipContent === false) {
    echo "Error downloading LiteChat.\n";
    exit(1);
}

file_put_contents($zipPath, $zipContent);
echo "Download complete. Extracting...\n";

// Extract the zip file
$zip = new ZipArchive();
if ($zip->open($zipPath) === TRUE) {
    $zip->extractTo($tempDir);
    $zip->close();
    echo "Extraction complete.\n";

    // Remove the zip file
    unlink($zipPath);

    // Start the server
    $host = $hostAll ? '0.0.0.0' : 'localhost';
    $accessUrl = $hostAll ?
        "http://" . gethostbyname(gethostname()) . ":{$port} (accessible from other devices)" :
        "http://localhost:{$port} (local access only)";

    echo "LiteChat is running at {$accessUrl}\n";

    // Create router script for SPA
    $routerPath = $tempDir . '/router.php';
    file_put_contents($routerPath, '<?php
    $path = parse_url($_SERVER["REQUEST_URI"], PHP_URL_PATH);
    $file = __DIR__ . $path;
    if (is_file($file)) {
        return false; // Serve the requested file
    } else {
        include __DIR__ . "/index.html";
    }
    ?>');

    // Change to the temp directory and start PHP's built-in server
    chdir($tempDir);
    $command = "php -S {$host}:{$port} router.php";
    system($command);
} else {
    echo "Failed to extract the zip file.\n";
    unlink($zipPath);
    exit(1);
}
?>
