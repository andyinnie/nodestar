const http = require('http');
const https = require('https');
const fs = require('fs');
const dotenv = require('dotenv');
const mime = require('mime');

dotenv.config();

const PROTOCOLS = {
    http: {
        str: 'http',
        module: http,
        port: 80
    },
    https: {
        str: 'https',
        module: https,
        port: 443
    }
};

const protocol = PROTOCOLS.http;

function log(message) {console.log(message);}

function getOriginalURL(request) {
    return new URL(request.url, `${protocol.str}://${request.headers.host}`);
}

function respond(response, data, code=200, contentType='text/html') {
    response.writeHead(code, { 'Content-Type': contentType });
    response.write(data);
    response.end();
}

function respondWithFile(response, filename, code=200, contentType='text/html') {
    fs.readFile(filename, (err, data) => {
        if (err) {
            log(err);
            fs.promises.appendFile('hackattempts.txt', err.path + '\n');
            respondWithError(response);
            return;
        }
        respond(response, data, code, contentType);
    });
}

function respondWithError(response, code=404) {
    respondWithFile(response, 'error.html', code);
}

const RESPONDERS = {
    index: response => respondWithFile(response, 'hugo/public/index.html'),
    error404: response => respondWithFile(response, 'hugo/public/404.html', 404)
};

const root = {
    'spotify': (request, response, searchParams) => {
        log('spotify callback')
        const code = searchParams.get('code');
        const state = searchParams.get('state');

        if (!code || !state) {
            respondWithError(response);
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
    'wp-includes': (request, response, searchParams) => {
        respond(response, '<h1>fuck off</h1>');
    },
    '.env': (request, response, searchParams) => {
        respond(response, '<h1>fuck off</h1>');
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
        respondWithError(response);
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
            if (url.pathname.includes('..')) {
                fs.promises.appendFile('hackattempts.txt', url.pathname + '\n');
                RESPONDERS.error404(response);
                return;
            }
            respondWithFile(response, 'hugo/public' + url.pathname, 200, mime.getType(url.pathname));
            return;
        }
    }
    if (typeof current === 'object') {
        if ('default' in current) {
            current['default'](request, response, url.searchParams);
            return;
        }
    }
    RESPONDERS.error404(response);
}).listen(protocol.port);

console.log(`nodestar listening on port ${protocol.port}`);
