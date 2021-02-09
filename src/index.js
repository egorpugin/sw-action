import { Events, Inputs, State } from "./cache/constants";
import * as utils from "./cache/utils/actionUtils";

const fs = require("fs");
const os = require('os');
const core = require("@actions/core");
const exec = require("@actions/exec");
const cache = require("@actions/cache");
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
const ar = "sw.zip";

try {
  const file = fs.createWriteStream("sw.zip");
  const request = https.get(url, function(response) {
    response.pipe(file);
  });

  file.on("close", () => {
    exec.exec("cmake -E tar xvf " + ar).then(() => {
      fs.unlink(ar, err => { if (err) throw err; });
    }).then(() => {
      exec.exec("./sw setup");
    });
  });
} catch (error) {
  core.setFailed(error.message);
}

// cache
try {
    core.info(`Trying to load cache`);

    if (utils.isGhes()) {
        utils.logWarning("Cache action is not supported on GHES");
        utils.setCacheHitOutput(false);
        process.exit(1);
    }

    if (!utils.isValidEvent()) {
        utils.logWarning(
            `Event Validation Error: The event type ${
                process.env[Events.Key]
            } is not supported because it's not tied to a branch or tag ref.`
        );
        process.exit(1);
    }

    const state = utils.getCacheState();

    // Inputs are re-evaluted before the post action, so we want the original key used for restore
    const primaryKey = core.getState(State.CachePrimaryKey);
    if (!primaryKey) {
        utils.logWarning(`Error retrieving key from state.`);
        process.exit(1);
    }

    if (utils.isExactKeyMatch(primaryKey, state)) {
        core.info(
            `Cache hit occurred on the primary key ${primaryKey}, not saving cache.`
        );
        process.exit(1);
    }

    //const path = Inputs.Path;
    const path = "~/.sw";
    const cachePaths = utils.getInputAsArray(path, {
        required: true
    });

    try {
        cache.saveCache(cachePaths, primaryKey, {
            uploadChunkSize: utils.getInputAsInt(Inputs.UploadChunkSize)
        });
        core.info(`Cache saved with key: ${primaryKey}`);
    } catch (error) {
        if (error.name === cache.ValidationError.name) {
            throw error;
        } else if (error.name === cache.ReserveCacheError.name) {
            core.info(error.message);
        } else {
            utils.logWarning(error.message);
        }
    }
} catch (error) {
    utils.logWarning(error.message);
}