const http = require('http');
const https = require('https');
const fs = require('fs');

function log(message) {console.log(message);}

function respond(response, data, code=200) {
    response.writeHead(code, { 'Content-Type': 'text/html' });
    response.write(data);
    response.end();
}

function respondWithHTML(response, filename, code=200) {
    fs.readFile(filename, (err, data) => {
        respond(response, data, code);
    });
}

function respondWithError(response, code=404) {
    respondWithHTML(response, 'error.html', code);
}

function getOriginalURL(request) {
    return new URL(request.url, `http://${request.headers.host}`);
}

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
            respondWithHTML(response, 'success.html');
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
        respondWithHTML(response, 'index.html');
    }
};

const server = http.createServer((request, response) => {
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
            respondWithError(response);
            return;
        }
    }
    if (typeof current === 'object') {
        if ('default' in current) {
            current['default'](request, response, url.searchParams);
            return;
        }
    }
    respondWithError(response);
}).listen(80);

console.log('hello from nodestar');
