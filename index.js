const fs = require("fs");
const os = require('os');
const exec = require("@actions/exec");
const { http, https } = require('follow-redirects');

let url;
if (os.platform() == "win32")
  url = "https://software-network.org/client/sw-master-windows-client.zip";
else if (os.platform() == "darwin")
  url = "https://software-network.org/client/sw-master-macos-client.tar.gz";
else if (os.platform() == "linux")
  url = "https://software-network.org/client/sw-master-linux-client.tar.gz";
else
  core.setFailed("Unknown os: " + os.platform());
ar = "sw.zip";

try {
  const file = fs.createWriteStream("sw.zip");
  const request = https.get(url, function(response) {
    response.pipe(file);
  });
  
  file.on("close", () =>
  {
    exec.exec("cmake -E tar xvf " + ar).then(() =>
    {
      fs.unlink(ar, err => { if (err) throw err; });
      if (os.platform() != "win32")
        exec.exec("chmod 755 sw").then(() =>
        {
          exec.exec("sw setup");
        });
    });
  });
} catch (error) {
  core.setFailed(error.message);
}
