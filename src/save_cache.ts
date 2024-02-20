import * as cache from "@actions/cache";
import * as core from "@actions/core";

import { Events, Inputs, State } from "./cache/constants";
import * as utils from "./cache/utils/actionUtils";

const fs = require("fs");
const os = require('os');

async function run(): Promise<void> {
    try {
        if (utils.isGhes()) {
            utils.logWarning("Cache action is not supported on GHES");
            return;
        }

        if (!utils.isValidEvent()) {
            utils.logWarning(
                `Event Validation Error: The event type ${
                    process.env[Events.Key]
                } is not supported because it's not tied to a branch or tag ref.`
            );
            return;
        }

        const state = utils.getCacheState();

        // Inputs are re-evaluted before the post action, so we want the original key used for restore
        const primaryKey = core.getState(State.CachePrimaryKey);
        if (!primaryKey) {
            utils.logWarning(`Error retrieving key from state.`);
            return;
        }

        if (utils.isExactKeyMatch(primaryKey, state)) {
            /*core.info(
                `Cache hit occurred on the primary key ${primaryKey}, not saving cache.`
            );
            return;*/
        }

        const cachePaths = ["~/.sw"];
        /*const cachePaths = utils.getInputAsArray(Inputs.Path, {
            required: true
        });*/

        try {
            // remove pch cache on save
            // it takes a lot of space
            const dir = os.homedir() + "/.sw/storage/tmp";
            core.info(`Clearing sw temp dir: ` + dir);
            await fs.rmSync(dir, { recursive: true, force: true });

            await cache.saveCache(cachePaths, primaryKey, {
                uploadChunkSize: utils.getInputAsInt(Inputs.UploadChunkSize)
            });
            core.info(`Cache saved with key: ${primaryKey}`);
        } catch (e) {
            const error = e as Error;
            if (error.name === cache.ValidationError.name) {
                throw error;
            } else if (error.name === cache.ReserveCacheError.name) {
                core.info(error.message);
            } else {
                utils.logWarning(error.message);
            }
        }
    } catch (e) {
        const error = e as Error;
        utils.logWarning(error.message);
    }
}

run();
