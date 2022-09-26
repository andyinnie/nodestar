import fs from "fs";

const HACK_ATTEMPTS = new Set();

function updateHackAttempts(callback) {
    fs.readFile('hackattempts.txt', (err, data) => {
        const lines = data.toString().split('\n');
        for (let line of lines) {
            line = line.replace('hugo/public', '')
            HACK_ATTEMPTS.add(line);
        }
        callback(HACK_ATTEMPTS);
    });
}

export function getHackAttempts(callback, forceUpdate=false) {
    if (forceUpdate || HACK_ATTEMPTS.size === 0) {
        updateHackAttempts(callback);
    } else {
        callback(HACK_ATTEMPTS);
    }
}

export function recordHackAttempt(path) {
    fs.appendFileSync('hackattempts.txt', path + '\n');
    HACK_ATTEMPTS.add(path);
}
