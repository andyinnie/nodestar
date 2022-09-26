import https from "https";
import fs from "fs";
import dotenv from "dotenv";
import mime from "mime";
import {PROTOCOLS, log, respond} from "./utils.js";
import {getHackAttempts, recordHackAttempt} from "./hackattempts.js";

dotenv.config();

const protocol = PROTOCOLS.http;

export function getOriginalURL(request) {
    return new URL(request.url, `${protocol.str}://${request.headers.host}`);
}

function respondWithFile(response, filename, code=200, contentType='text/html') {
    fs.readFile(filename, (err, data) => {
        if (err) {
            recordHackAttempt(err.path)
            respondWithError(response);
            return;
        }
        respond(response, data, code, contentType);
    });
}

export function respondWithError(response, code=404) {
    switch (code) {
        case 404:
            RESPONDERS.error404(response);
            break;
        default:
            respondWithFile(response, 'error.html', code);
            break;
    }
}

const RESPONDERS = {
    index: response => respondWithFile(response, 'hugo/public/index.html'),
    error404: response => respondWithFile(response, 'hugo/public/404.html', 404),
    gtfo: response => respondWithFile(response, 'gtfo.html', 404),
};

const root = {
    'spotify': (request, response, searchParams) => {
        log('spotify callback')
        const code = searchParams.get('code');
        const state = searchParams.get('state');

        if (!code || !state) {
            respondWithError(response, 500);
            return;
        }

        const outgoing = https.request(process.env.SPOTIFY_WEBHOOK, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        }, res => {
            respondWithFile(response, 'success.html');
        });

        outgoing.write(
            JSON.stringify({
                'content': JSON.stringify({
                    'code': code,
                    'state': state
                })
            })
        );

        outgoing.end();
    },
    'isitchristmas': (request, response, searchParams) => {
        const today = new Date();
        respond(response,
            '<h1 style="text-align: center; font-size:50pt">' +
            (today.getMonth() === 11 && today.getDate() === 25 ? 'YES' : 'NO') +
            '</h1>'
        );
    },
    'default': (request, response, searchParams) => {
        RESPONDERS.index(response);
    }
};

const server = protocol.module.createServer((request, response) => {
    log(new Date().toString());

    let url;
    try {
        url = getOriginalURL(request);
    } catch (e) {
        log('that didn\'t last long');
        respondWithError(response, 500);
        return;
    }

    log(`Received request for path ${url.pathname}`);
    const pathSplit = url.pathname.trim().substring(1).split('/');
    let current = root;
    for (const p of pathSplit) {
        if (!p) continue;

        if (p in current) {
            const next = current[p];
            if (typeof next === 'object') {
                current = next;
            } else if (typeof next === 'function') {
                next(request, response, url.searchParams);
                return;
            }
        } else {
            getHackAttempts(set => {
                if (set.has(url.pathname) || url.pathname.includes('..')) {
                    recordHackAttempt(url.pathname);
                    RESPONDERS.gtfo(response);
                    return;
                }

                respondWithFile(response, 'hugo/public' + url.pathname, 200, mime.getType(url.pathname));
            });

            return;
        }
    }
    if (typeof current === 'object' && 'default' in current) {
        current['default'](request, response, url.searchParams);
        return;
    }
    RESPONDERS.error404(response);
}).listen(protocol.port);

console.log(`nodestar listening on port ${protocol.port}`);
