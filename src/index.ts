import { Events, Inputs, State } from "./cache/constants";
import * as utils from "./cache/utils/actionUtils";

const fs = require("fs");
const os = require('os');
const core = require("@actions/core");
const exec = require("@actions/exec");
const cache = require("@actions/cache");
const { http, https } = require('follow-redirects');

// cache
async function run(): Promise<void> {
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

    try {
        if (utils.isGhes()) {
            utils.logWarning("Cache action is not supported on GHES");
            utils.setCacheHitOutput(false);
            return;
        }

        // Validate inputs, this can cause task failure
        if (!utils.isValidEvent()) {
            utils.logWarning(
                `Event Validation Error: The event type ${
                    process.env[Events.Key]
                } is not supported because it's not tied to a branch or tag ref.`
            );
            return;
        }

        const primaryKey = "${{ runner.os }}-sw";
        //const primaryKey = core.getInput(Inputs.Key, { required: true });
        core.saveState(State.CachePrimaryKey, primaryKey);

        const restoreKeys = utils.getInputAsArray(Inputs.RestoreKeys);
        const cachePaths = ["~/.sw"];
        /*const cachePaths = utils.getInputAsArray(path, {
            required: true
        });*/

        try {
            const cacheKey = await cache.restoreCache(
                cachePaths,
                primaryKey,
                restoreKeys
            );
            if (!cacheKey) {
                core.info(
                    `Cache not found for input keys: ${[
                        primaryKey,
                        ...restoreKeys
                    ].join(", ")}`
                );
                return;
            }

            // Store the matched cache key
            utils.setCacheState(cacheKey);

            const isExactKeyMatch = utils.isExactKeyMatch(primaryKey, cacheKey);
            utils.setCacheHitOutput(isExactKeyMatch);

            core.info(`Cache restored from key: ${cacheKey}`);
        } catch (error) {
            if (error.name === cache.ValidationError.name) {
                throw error;
            } else {
                utils.logWarning(error.message);
                utils.setCacheHitOutput(false);
            }
        }
    } catch (error) {
        core.setFailed(error.message);
    }
}

run();
