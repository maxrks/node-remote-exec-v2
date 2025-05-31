const { Client } = require("ssh2");
const fs = require("fs");
const path = require("path");
const os = require("os");
const iconv = require("iconv-lite");

const defaultOptions = {
  port: 22,
  username: "root",
  privateKey: fs.readFileSync(path.resolve(os.homedir(), ".ssh", "id_rsa")),
  force: false,
  encoding: null,
};

const riskyCommands = [
  "rm",
  "rmdir",
  "del",
  "rimraf",
  "rm -rf",
  "shutdown",
  "reboot",
  "mkfs",
  "dd if=",
  "chmod 777 /",
  "chown root",
  "kill -9 -1",
  "mv /",
  "cp /",
  "del /f /s /q",
  "format",
  "netsh advfirewall reset",
  "netsh firewall",
  "erase /f",
  "rd /s /q",
  "taskkill /F /IM",
  "reg delete",
  "sc stop",
  "sc delete",
];

function isCommandRisky(cmd) {
  return riskyCommands.some((riskyCmd) =>
    cmd.toLowerCase().includes(riskyCmd.toLowerCase())
  );
}

function filterCommands(cmds, options = {}) {
  return cmds.map((cmd) => ({
    cmd,
    isRisky: isCommandRisky(cmd) && !options.force,
  }));
}

function executeCommands(conn, filteredCmds, hostEntry, options, serverName) {
  return new Promise((resolve, reject) => {
    let index = 0;
    const encoding = hostEntry.encoding || options.encoding;

    function runNext() {
      if (index >= filteredCmds.length) return resolve();

      const { cmd, isRisky } = filteredCmds[index];
      if (isRisky) {
        console.warn(`[${serverName}] Skipping risky command: ${cmd}`);
        index++;
        runNext();
        return;
      }

      console.log(`[${serverName}] > Executing: ${cmd}`);
      conn.exec(cmd, (err, stream) => {
        if (err) return reject(err);
        if (encoding) stream.setEncoding("binary");

        stream.on("data", (data) => {
          const output = encoding
            ? iconv.decode(Buffer.from(data, "binary"), encoding)
            : data.toString();
          process.stdout.write(`[${serverName}] ${output}`);
        });

        stream.stderr.on("data", (data) => {
          const output = encoding
            ? iconv.decode(Buffer.from(data, "binary"), encoding)
            : data.toString();
          process.stderr.write(`[${serverName}] ERROR: ${output}`);
        });

        stream.on("close", () => {
          index++;
          runNext();
        });
      });
    }

    runNext();
  });
}

async function remoteExec(hosts, cmds, options = {}, cb = () => {}) {
  const mergedOptions = { ...defaultOptions, ...options };
  const filteredCmds = filterCommands(cmds, mergedOptions);

  const tasks = hosts.map((hostEntry) => {
    const host = typeof hostEntry === "string" ? hostEntry : hostEntry.host;
    const serverName =
      typeof hostEntry === "string" ? hostEntry : hostEntry.name || host;

    const conn = new Client();
    const hostOptions = { ...mergedOptions, host };

    return new Promise((resolve, reject) => {
      conn
        .on("ready", async () => {
          console.log(`[${serverName}] Connected`);
          try {
            await executeCommands(
              conn,
              filteredCmds,
              hostEntry,
              mergedOptions,
              serverName
            );
            conn.end();
            resolve({ host, success: true });
          } catch (err) {
            conn.end();
            reject({ host, success: false, error: err });
          }
        })
        .on("error", (err) => {
          reject({ host, success: false, error: err });
        })
        .connect(hostOptions);
    });
  });

  const results = await Promise.allSettled(tasks);
  const errors = results
    .filter((r) => r.status === "rejected")
    .map((r) => r.reason);

  if (errors.length > 0) {
    console.error("Some hosts failed:", errors.map((e) => e.host).join(", "));
    cb(errors[0]);
  } else {
    console.log("✅ All hosts executed successfully.");
    cb(null);
  }
}

module.exports = remoteExec;
