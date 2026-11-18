const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const sh = (value) => "'" + value.replace(/'/g, "'\\''") + "'";
const ps = (value) => "'" + value.replace(/'/g, "''") + "'";

function plans(platform, directory, node) {
    const p = platform === "win32" ? path.win32 : path.posix;
    return ["node", "app"].map((mode) => platform === "win32"
        ? `Set-Location -LiteralPath ${ps(directory)}; & ${ps(node)} ${ps(p.join(directory, "scripts", "portable.js"))} ${mode}`
        : `cd ${sh(directory)} && ${sh(node)} ${sh(p.join(directory, "scripts", "portable.js"))} ${mode}`);
}

if (require.main === module) {
    const commands = plans(process.platform, root, process.execPath);
    if (process.argv.includes("--print")) console.log(commands.join("\n"));
    else if (process.platform === "darwin") {
        const apple = `tell application "Terminal"\nactivate\n${commands.map((command) => "do script " + JSON.stringify(command)).join("\n")}\nend tell`;
        const result = spawnSync("/usr/bin/osascript", ["-e", apple], { stdio: "inherit" });
        process.exitCode = result.status || 0;
    } else if (process.platform === "win32") {
        for (const command of commands) {
            const child = spawn("powershell.exe", ["-NoExit", "-EncodedCommand", Buffer.from(command, "utf16le").toString("base64")], { detached: true, stdio: "ignore", windowsHide: false });
            child.on("error", (error) => console.error(error.message));
            child.unref();
        }
    } else {
        console.log("Open two terminals and run these commands:");
        console.log(commands.join("\n"));
    }
}
module.exports = { plans };
