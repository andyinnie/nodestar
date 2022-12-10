import https from "https";
import fs from "fs";
import dotenv from "dotenv";
import mime from "mime";
import mysql from "mysql2";

import {PROTOCOLS, log, respond, respondCustomHeaders, randomString} from "./utils.js";
import {getHackAttempts, recordHackAttempt} from "./hackattempts.js";

dotenv.config();

const protocol = PROTOCOLS.http;

export function getOriginalURL(request) {
    return new URL(request.url, `${protocol.str}://${request.headers.host}`);
}

function respondWithFile(response, filename, code=200, contentType='text/html', replacements={}) {
    fs.readFile(filename, (err, data) => {
        if (err) {
            recordHackAttempt(err.path)
            respondWithError(response);
            return;
        }

        if (contentType === 'text/html') {
            data = data.toString();
            for (const k in replacements) {
                data = data.replace(new RegExp(`%%${k}%%`, 'g'), replacements[k]);
            }
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


function getDBConnection() {
    const db = mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: process.env.MYSQL_PW,
        database: 'nodestar'
    });

    db.connect(function (err) {
        if (err) throw err;
        log('Connected to MySql!');
    });
    return db;
}

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
    'urlshorten': {
        '*': (request, response, searchParams, path) => {
            if (path === undefined) {
                RESPONDERS.error404(response);
                return;
            }

            if (path.length === 0) {
                respondWithFile(response, 'urlshorten.html');
                return;
            }

            if (path === 'submit') {
                const id = randomString(8);
                const url = decodeURI(searchParams.get('url'));
                // should i be worried about id collisions? nahhhh
                const db = getDBConnection();
                db.query(
                    `INSERT INTO urlshorten (id, url) VALUES (?, ?);`,
                    [id, url],
                    (err, results, fields) => {
                        if (err) throw err;
                        const shorter = 'andrewjm.me/urlshorten/' + id;
                        const shortened = 'https://' + shorter;
                        respondWithFile(
                            response,
                            'urlshortensuccess.html',
                            200,
                            'text/html',
                            {'url': shortened, 'urlbrief': shorter}
                        );
                        db.end();
                    }
                );
                return;
            }

            const db = getDBConnection();
            db.query(
                `SELECT url FROM urlshorten WHERE id=?;`,
                [path],
                (err, results, fields) => {
                    if (err) throw err;

                    if (results.length === 0) {
                        RESPONDERS.error404(response);
                        return;
                    }

                    respondCustomHeaders(response, '', {'Location': results[0].url}, 301);
                    db.end();
                }
            );
        }
    },
    'default': (request, response, searchParams) => {
        RESPONDERS.index(response);
    },
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

    log(url.toString());
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
                try {
                    next(request, response, url.searchParams);
                } catch (e) {
                    respondWithError(response, 500);
                }
                return;
            }
        } else if ('*' in current) {
            try {
                current['*'](request, response, url.searchParams, p);  // TODO: include the remainder of pathSplit, after p
            }  catch (e) {
                respondWithError(response, 500);
            }
            return;
        } else {
            log('Suspected hack attempt')
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
        try {
            current['default'](request, response, url.searchParams);
        } catch (e) {
            respondWithError(response, 500);
        }
        return;
    }
    if (typeof current === 'object' && '*' in current) {
        try {
            current['*'](request, response, url.searchParams, '');
        } catch (e) {
            respondWithError(response, 500);
        }
        return;
    }
    RESPONDERS.error404(response);
}).listen(protocol.port);

console.log(`nodestar listening on port ${protocol.port}`);
