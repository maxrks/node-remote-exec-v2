const remoteExec = require('./index');
const connection_options = {
  port: 22,
  username: "Administrator",
  privateKey: require("fs").readFileSync(require("path").resolve("~/.ssh/id_rsa".replace("~", require("os").homedir))),
  encoding:'gbk',
};
remoteExec(
  [
   "192.168.0.101", "192.168.0.102"
  ],
  ["echo Hello", "dir c:\\windows /w"],
  connection_options, 
  (err) => {
    if (err) console.error("Execution error:", err);
    else console.log("All done!");
  }
);