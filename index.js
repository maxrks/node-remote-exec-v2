const { Client } = require("ssh2");
const fs = require("fs");
const path = require("path");
const os = require("os");
const iconv = require("iconv-lite");

// Default SSH connection options
const defaultOptions = {
  port: 22,
  username: "root",
  privateKey: fs.readFileSync(path.resolve(os.homedir(), ".ssh", "id_rsa")),
  force: false, // Flag to allow risky commands
  encoding: null, // Optional encoding for stdout and stderr
};

// List of risky commands
const riskyCommands = [
  "rm",
  "rmdir",
  "del",
  "rimraf", // Common risky commands
  "rm -rf",
  "shutdown",
  "reboot",
  "mkfs",
  "dd if=",
  "chmod 777 /",
  "chown root",
  "kill -9 -1",
  "mv /",
  "cp /", // Linux / macOS
  "del /f /s /q",
  "format",
  "netsh advfirewall reset",
  "netsh firewall",
  "erase /f",
  "rd /s /q",
  "taskkill /F /IM",
  "reg delete",
  "sc stop",
  "sc delete", // Windows
];

// Function to check if a command is risky
function isCommandRisky(cmd) {
  return riskyCommands.some((riskyCmd) =>
    cmd.toLowerCase().includes(riskyCmd.toLowerCase())
  );
}

// Filter and mark commands as risky or safe
function filterCommands(cmds, options = {}) {
  return cmds.map((cmd) => ({
    cmd,
    isRisky: isCommandRisky(cmd) && !options.force, // Mark risky if not forced
  }));
}

// Main remoteExec function
async function remoteExec(hosts, cmds, options = {}, cb = (err) => {}) {
  let errorOccurred = null;

  // Merge user options with default options
  const mergedOptions = { ...defaultOptions, ...options };
  const filteredCmds = filterCommands(cmds, mergedOptions);

  for (const hostEntry of hosts) {
    const host = typeof hostEntry === "string" ? hostEntry : hostEntry.host;
    const serverName =
      typeof hostEntry === "string" ? hostEntry : hostEntry.name || host;

    console.log(`Connecting to host: ${serverName} (${host})`);
    const conn = new Client();
    const hostOptions = { ...mergedOptions, host };

    try {
      await new Promise((resolve, reject) => {
        conn.on("ready", async () => {
          console.log(`Connected to ${serverName}`);

          try {
            await executeCommands(conn, filteredCmds); // Execute filtered commands
            console.log(`Completed all commands on ${serverName}`);
            conn.end();
            resolve();
          } catch (err) {
            conn.end();
            reject(err);
          }
        });

        conn.on("error", (err) => {
          reject(err);
        });

        conn.connect(hostOptions);
      });
    } catch (err) {
      errorOccurred = errorOccurred || err;
      break;
    }
  }

  cb(errorOccurred);
}

// Function to execute commands on the remote host
function executeCommands(conn, filteredCmds) {
  return new Promise((resolve, reject) => {
    let currentCmdIndex = 0;

    function runNextCommand() {
      if (currentCmdIndex >= filteredCmds.length) {
        resolve();
        return;
      }

      const { cmd, isRisky } = filteredCmds[currentCmdIndex];
      if (isRisky) {
        console.warn(
          `Skipping risky command "${cmd}" - use force:true in options to execute.`
        );
        currentCmdIndex++;
        runNextCommand();
        return;
      }

      console.log(`Executing command: ${cmd}`);

      conn.exec(cmd, (err, stream) => {
        if (err) {
          reject(err);
          return;
        }

        stream.setEncoding("binary");

        stream.on("data", (data) => {
          const output = iconv.decode(Buffer.from(data, "binary"), "gbk");
          console.log(output);
        });

        stream.stderr.on("data", (data) => {
          const output = iconv.decode(Buffer.from(data, "binary"), "gbk");
          console.log(output);
        });

        stream.on("close", (code, signal) => {
          console.log(`Command "${cmd}" completed with code: ${code}`);
          currentCmdIndex++;
          runNextCommand();
        });
      });
    }

    runNextCommand();
  });
}

// Export the remoteExec function
module.exports = remoteExec;
