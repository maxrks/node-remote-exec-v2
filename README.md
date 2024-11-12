# remote-exec-v2

`remote-exec-v2` is a Node.js package that enables you to execute commands remotely on multiple servers via SSH. This package helps to automate tasks across multiple hosts, while ensuring safe execution by filtering risky commands.

## Why remote-exec-v2?

Thanks to [https://github.com/tpresley/node-remote-exec](), but it had not been updated for a long time and cannot connect to OpenSSH server version 8.8 and newer SSH servers.  This package is fresh, parameters may not be fully compatible.


## Runtime

 Developed with node v22.11.0 under MacOS 15.1, not tested on other platforms.

## Features

- Execute commands on multiple servers
- Automatically skip risky commands (e.g., `rm -rf /`, `shutdown`, etc.)
- Use force option to override command safety checks

## Installation

```bash
npm install remote-exec-v2
```

## Usage

```javascript
const remoteExec = require('remote-exec-v2');

// Define connection options and hosts
const hosts = [
  { host: '192.168.0.111', name: 'Server1' },
  { host: '192.168.0.222', name: 'Server2' }
];

const cmds = [
  'ping 192.168.0.254',
  'rm ~/something.txt' // This will be skipped due to safety checks
];

const options = { force: false }; // Set to true to override risky command checks

// Execute commands
remoteExec(hosts, cmds, options, (err) => {
  if (err) {
    console.error('Error executing commands:', err);
  } else {
    console.log('Commands executed successfully on all hosts.');
  }
});
```

## Options

- **force**: If set to `true`, risky commands will be executed. Default is `false`.
- **port**: SSH port (default is `22`).
- **username**: SSH username (default is `root`).
- **privateKey**: Path to the private key for authentication.

## Risky Commands

The following commands are considered risky and will be skipped unless `force` is set to `true`:

- `rm -rf /`
- `shutdown`
- `reboot`
- `del`
- `format`
- `sc delete`

## Contributing

Thanks to [openai/chatgpt](https://openai.com/) for code generation.

If you want to contribute, feel free to fork the repository and create a pull request.

## License

MIT License
