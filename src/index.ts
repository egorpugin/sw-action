import { Events, Inputs, State } from "./cache/constants";
import * as utils from "./cache/utils/actionUtils";

const fs = require("fs");
const os = require('os');
const core = require("@actions/core");
const exec = require("@actions/exec");
const cache = require("@actions/cache");
const { http, https } = require('follow-redirects');
//const github = require('@actions/github');

// cache
var url;
async function run(): Promise<void> {
    //const urlbase = "https://software-network.org/";
    const urlbase = "http://52.51.158.31/";
    if (os.platform() == "win32") {
      url = urlbase + "/client/sw-master-windows-client.zip";
    } else if (os.platform() == "darwin") {
      url = urlbase + "/client/sw-master-macos-client.tar.gz";
    } else if (os.platform() == "linux") {
      url = urlbase + "/client/sw-master-linux-client.tar.gz";
      try{
        fs.accessSync('/etc/fedora-release');
      } catch(e) {
        url = urlbase + "/client/sw-master-ubuntu20.04-client.tar.gz";
      }
    } else {
      core.setFailed("Unknown os: " + os.platform());
    }
    core.info(`sw url: ${url}`);

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
          exec.exec("./sw --version");
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

        var primaryKey = core.getInput(Inputs.Key);
        if (!primaryKey) {
            // get day of year
            var date = new Date();
            var day =
                (Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
                - Date.UTC(date.getFullYear(), 0, 0)) / 24 / 60 / 60 / 1000;
            var day7 = day / 14; // actually two weeks
            day7 = day7 | 0; // round
            //
            primaryKey = "sw-" + os.platform() + "-cache-" + date.getFullYear() + "-" + day7;
            core.info(`Cache key was not set. Using default: ${primaryKey}`);
        }
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

            // remove pch cache on load
            // some ubuntu systems update glibc or some other headers like '/usr/include/linux/errno.h'
            // so we get build errors
            const dir = os.homedir() + "/.sw/storage/tmp";
            core.info(`Clearing sw temp cache: ` + dir);
            fs.rmdirSync(dir, { recursive: true }, err => {});

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
