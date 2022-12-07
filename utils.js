import http from "http";
import https from "https";

const BASE_64_ALPHABET_URL_SAFE = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_';

export const PROTOCOLS = {
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

export function log(message) {console.log(message);}

export function respond(response, data, code=200, contentType='text/html', headers=undefined) {
    response.writeHead(code, headers ? headers : { 'Content-Type': contentType });
    response.write(data);
    response.end();
}

export function respondCustomHeaders(response, data, headers, code=200) {
    respond(response, data, code, '', headers)
}

export function randomString(length, alphabet=BASE_64_ALPHABET_URL_SAFE) {
    let outStr = '';
    const alphabetSplit = alphabet.split('');
    for (let i = 0; i < length; i++) {
        outStr += alphabetSplit[Math.floor(Math.random() * alphabetSplit.length)];
    }
    return outStr;
}
