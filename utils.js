import http from "http";
import https from "https";

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

export function respond(response, data, code=200, contentType='text/html') {
    response.writeHead(code, { 'Content-Type': contentType });
    response.write(data);
    response.end();
}
