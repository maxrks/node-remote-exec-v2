# remote-exec-v2

`remote-exec-v2` is a modern Node.js package that allows executing commands over SSH on multiple servers. It enhances automation while being careful with dangerous operations.

## Why remote-exec-v2?

Thanks to https://github.com/tpresley/node-remote-exec, which inspired this project. However, that package has not been updated for years and cannot connect to newer OpenSSH servers (v8.8+). `remote-exec-v2` is a fresh alternative with updated features.

## Runtime

Developed and tested with:

- Node.js v22.11.0
- macOS 15.1

> Other platforms are not officially tested yet.

## Features

- Execute commands on multiple remote hosts via SSH
- Automatically skips dangerous commands (e.g., `rm -rf /`, `shutdown`)
- Sequential or parallel execution mode
- Force execution of risky commands (optional)
- Supports custom encoding (e.g., GBK for Windows)
- Optional timestamped output and detailed logging

## Installation

```bash
npm install remote-exec-v2
```

## Usage

```javascript
const remoteExec = require("remote-exec-v2");

const hosts = [
  { host: "192.168.0.101", name: "Server-A", encoding: "gbk" },
  { host: "192.168.0.102", name: "Server-B" }
];

// or hosts in simple way
// const hosts = ["192.168.0.101","192.168.0.12"];

const commands = [
  "echo Hello World",
  "dir /w",
  "rm -rf /important" // this will be skipped unless force: true
];

const options = {
  force: false,      // Skip risky commands (default)
  timestamp: true,   // Show timestamps and host names
  parallel: false    // Run sequentially
};

remoteExec(hosts, commands, options, (err) => {
  if (err) {
    console.error("Error during execution:", err);
  } else {
    console.log("Commands executed successfully on all hosts.");
  }
});
```

## Options

| Option         | Type             | Default           | Description                                      |
| -------------- | ---------------- | ----------------- | ------------------------------------------------ |
| `port`       | number           | `22`            | SSH port                                         |
| `username`   | string           | `"root"`        | SSH username                                     |
| `privateKey` | string or Buffer | `~/.ssh/id_rsa` | Path or buffer of private key                    |
| `encoding`   | string or null   | `null`          | Remote system output encoding (e.g.,`"gbk"`)   |
| `force`      | boolean          | `false`         | Allow execution of risky commands                |
| `parallel`   | boolean          | `false`         | Run all hosts in parallel                        |
| `timestamp`  | boolean          | `false`         | Show detailed logs with timestamps and hostnames |

## Risky Commands

The following commands are considered risky and will be skipped unless `force: true`:

- `rm`
- `rmdir`
- `del`
- `rimraf`
- `rm -rf`
- `shutdown`
- `reboot`
- `mkfs`
- `dd if=`
- `chmod 777 /`
- `chown root`
- `kill -9 -1`
- `mv /`
- `cp /`
- `del /f /s /q`
- `format`
- `netsh advfirewall reset`
- `netsh firewall`
- `erase /f`
- `rd /s /q`
- `taskkill /F /IM`
- `reg delete`
- `sc stop`
- `sc delete`

## Contributing

Thanks to https://openai.com/ (ChatGPT) for code generation assistance.

If you want to contribute, feel free to fork the repository and create a pull request.

## License

MIT License
"""
