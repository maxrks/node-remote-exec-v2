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
  parallel: false,
  timestamp: false,
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

function getTimestamp() {
  const now = new Date();
  const pad = (n) => n.toString().padStart(2, "0");
  return (
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ` +
    `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(
      now.getSeconds()
    )}.` +
    `${now.getMilliseconds().toString().padStart(3, "0")}`
  );
}

function makeLogger(options, serverName = "") {
  const useTimestamp = options.timestamp;
  return {
    log: (msg) => {
      if (useTimestamp) {
        console.log(`[${getTimestamp()}][${serverName}] ${msg}`);
      } else {
        process.stdout.write(`${msg}\n`);
      }
    },
    warn: (msg) => {
      if (useTimestamp) {
        console.warn(`[${getTimestamp()}][${serverName}] ${msg}`);
      } else {
        process.stderr.write(`WARNING: ${msg}\n`);
      }
    },
    error: (msg) => {
      if (useTimestamp) {
        console.error(`[${getTimestamp()}][${serverName}] ${msg}`);
      } else {
        process.stderr.write(`ERROR: ${msg}\n`);
      }
    },
  };
}

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

function execCommands(conn, cmds, encoding, serverName, options) {
  const logger = makeLogger(options, serverName);
  return new Promise((resolve, reject) => {
    let index = 0;

    const runNext = () => {
      if (index >= cmds.length) return resolve();

      const { cmd, isRisky } = cmds[index];
      if (isRisky) {
        logger.warn(`Skipping risky command: ${cmd}`);
        index++;
        runNext();
        return;
      }

      logger.log(`> Executing: ${cmd}`);

      conn.exec(cmd, (err, stream) => {
        if (err) return reject(err);
        if (encoding) stream.setEncoding("binary");

        stream.on("data", (data) => {
          const output = encoding
            ? iconv.decode(Buffer.from(data, "binary"), encoding)
            : data.toString();
          output.split(/\r?\n/).forEach((line) => {
            if (line.trim()) {
              options.timestamp
                ? logger.log(line)
                : process.stdout.write(`${line}\n`);
            }
          });
        });

        stream.stderr.on("data", (data) => {
          const output = encoding
            ? iconv.decode(Buffer.from(data, "binary"), encoding)
            : data.toString();
          output.split(/\r?\n/).forEach((line) => {
            if (line.trim()) {
              options.timestamp
                ? logger.error(line)
                : process.stderr.write(`${line}\n`);
            }
          });
        });

        stream.on("close", () => {
          index++;
          runNext();
        });
      });
    };

    runNext();
  });
}

function runOnHost(hostEntry, cmds, options) {
  return new Promise((resolve, reject) => {
    const host = typeof hostEntry === "string" ? hostEntry : hostEntry.host;
    const serverName =
      typeof hostEntry === "string" ? hostEntry : hostEntry.name || host;
    const encoding = hostEntry.encoding || options.encoding;

    const logger = makeLogger(options, serverName);
    const conn = new Client();

    conn
      .on("ready", async () => {
        const connectedMsg = `ℹ️ [${serverName}] is Connected`;
        options.timestamp
          ? logger.log("Connected")
          : process.stdout.write(`${connectedMsg}\n`);
        try {
          await execCommands(conn, cmds, encoding, serverName, options);
          conn.end();
        } catch (err) {
          conn.end();
          reject({ host, success: false, error: err });
        }
      })
      .on("close", () => {
        const disconnectedMsg = `ℹ️ [${serverName}] is Disconnected`;
        options.timestamp
          ? logger.log("Disconnected")
          : process.stdout.write(`${disconnectedMsg}\n`);
        resolve({ host, success: true });
      })
      .on("error", (err) => {
        logger.error(`Connection error: ${err.message}`);
        reject({ host, success: false, error: err });
      })
      .connect({ ...options, host });
  });
}

async function remoteExec(hosts, cmds, options = {}, cb = () => {}) {
  const mergedOptions = { ...defaultOptions, ...options };
  const filteredCmds = filterCommands(cmds, mergedOptions);

  const runTasks = mergedOptions.parallel
    ? () =>
        Promise.allSettled(
          hosts.map((host) => runOnHost(host, filteredCmds, mergedOptions))
        ).then((results) =>
          results.map((res) =>
            res.status === "fulfilled" ? res.value : res.reason
          )
        )
    : async () => {
        const results = [];
        for (const host of hosts) {
          try {
            results.push(await runOnHost(host, filteredCmds, mergedOptions));
          } catch (err) {
            results.push(err);
          }
        }
        return results;
      };

  const results = await runTasks();
  const failed = results.filter((r) => !r.success);
  const logger = makeLogger(mergedOptions);

  if (failed.length > 0) {
    const msg = `Some hosts failed: ${failed.map((e) => e.host).join(", ")}`;
    mergedOptions.timestamp
      ? logger.error(msg)
      : process.stderr.write(`${msg}\n`);
    cb(failed[0]);
  } else {
    console.log("✅ All hosts executed successfully.");
    cb(null);
  }
}

module.exports = remoteExec;
